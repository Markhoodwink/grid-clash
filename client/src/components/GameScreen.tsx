import React, { useState, useRef, useEffect } from 'react';
import { rotateMatrix } from '../utils/polyomino';
import { socket } from '../socket';
import { sfx, ChaosEvent } from '../utils/soundFX';
import { SpaceCanvasBackground } from './SpaceCanvasBackground';
import { GameTopBar, Player } from './GameTopBar';
import { ChaosOverlays, PaintSplat } from './ChaosOverlays';
import { GameOverModal } from './GameOverModal';
import { ExitConfirmModal } from './ExitConfirmModal';

interface Shape {
    id: string;
    matrix: number[][];
    color: string;
}

interface PlacedShape extends Shape {
    row: number | null;
    col: number | null;
}

interface GameScreenProps {
    level: {
        gridWidth: number;
        gridHeight: number;
        targetCellsCount: number;
        pieces: Shape[];
        solutionGrid?: string[][];
        noEvents?: boolean; // <--- добавили
    };
    roomCode: string;
    players?: Record<string, Player>;
    myId?: string;
}

const SPLAT_COLORS = ['#ec4899', '#8b5cf6', '#10b981', '#f59e0b', '#06b6d4', '#ef4444'];
const MONO_COLOR = '#8b5cf6';

export const GameScreen: React.FC<GameScreenProps> = ({
    level,
    roomCode,
    players = {},
    myId = ''
}) => {
    // Универсальная тактильная отдача для мобильного Telegram и браузера
    const triggerHaptic = (type: 'light' | 'medium' | 'heavy' | 'error' | 'success' = 'light') => {
        const tgHaptic = (window as any).Telegram?.WebApp?.HapticFeedback;
        if (tgHaptic) {
            if (type === 'error' || type === 'success') {
                tgHaptic.notificationOccurred(type);
            } else {
                tgHaptic.impactOccurred(type);
            }
        } else if ('vibrate' in navigator) {
            navigator.vibrate(type === 'error' ? [40, 30, 80] : type === 'medium' ? 20 : 10);
        }
    };

    const maxDimension = Math.max(level.gridWidth, level.gridHeight);
    const CELL_SIZE = maxDimension >= 8 ? 32 : maxDimension >= 6 ? 40 : maxDimension === 5 ? 48 : 54;
    const CELL_GAP = maxDimension >= 7 ? 4 : 5;
    const STEP = CELL_SIZE + CELL_GAP;

    const PREVIEW_CELL = maxDimension >= 7 ? 13 : 16;
    const PREVIEW_GAP = 2;
    const SOL_CELL_SIZE = maxDimension >= 8 ? 18 : maxDimension >= 6 ? 22 : maxDimension === 5 ? 26 : 30;

    const [pieces, setPieces] = useState<PlacedShape[]>(
        level.pieces.map((p) => ({ ...p, row: null, col: null }))
    );

    const [draggedId, setDraggedId] = useState<string | null>(null);
    const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
    const [grabOffset, setGrabOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

    const [opponents, setOpponents] = useState<Player[]>(
        Object.values(players).filter((p) => p.id !== myId)
    );

    const [showExitConfirm, setShowExitConfirm] = useState(false);
    const [roundWinner, setRoundWinner] = useState<{ id: string | null; name: string | null; isAborted?: boolean } | null>(null);
    const [roundResults, setRoundResults] = useState<Player[] | null>(null);

    const [activeEvents, setActiveEvents] = useState<ChaosEvent[]>(['NONE']);
    const [eventCountdown, setEventCountdown] = useState<number>(3);
    const [paintSplats, setPaintSplats] = useState<PaintSplat[]>([]);
    const [isMuted, setIsMuted] = useState<boolean>(sfx.muted);

    const [lightPos, setLightPos] = useState<{ x: number; y: number }>({
        x: typeof window !== 'undefined' ? window.innerWidth / 2 : 200,
        y: typeof window !== 'undefined' ? window.innerHeight * 0.42 : 300
    });
    const [frozenPieces, setFrozenPieces] = useState<Record<string, number>>({});
    const [swapBanner, setSwapBanner] = useState<{ fromName: string } | null>(null);
    const [isSwappingBoard, setIsSwappingBoard] = useState(false);
    const [endRoundVotes, setEndRoundVotes] = useState<string[]>([]);
    const [totalRoomPlayers, setTotalRoomPlayers] = useState<number>(Object.keys(players).length || 1);

    const [playerReactions, setPlayerReactions] = useState<Record<string, { emoji: string; ts: number }>>({});
    const [recentReaction, setRecentReaction] = useState<{ emoji: string; name: string } | null>(null);
    const [trayShift, setTrayShift] = useState<number>(0);
    const [jokerUsed, setJokerUsed] = useState<boolean>(false);
    const [goldPieceIds, setGoldPieceIds] = useState<string[]>([]);
    const [xrayPulseKey, setXrayPulseKey] = useState<number>(0);
    const [luckyOverrides, setLuckyOverrides] = useState<Record<string, ChaosEvent[]>>({});
    const lastLuckyPlayersRef = useRef<string[]>([]);

    // Состояния для срыва детали во время землетрясения
    const [fallingPiece, setFallingPiece] = useState<{
        id: string;
        matrix: number[][];
        color: string;
        startX: number;
        startY: number;
        key: number;
    } | null>(null);
    const [earthquakeAlert, setEarthquakeAlert] = useState<string | null>(null);
    const earthquakeDropsTriggeredRef = useRef<{ second2: boolean; second8: boolean }>({ second2: false, second8: false });

    const dragStartPointerRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
    const dragStartPiecePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
    const lastWipePosRef = useRef<{ x: number; y: number } | null>(null);

    const isHost = players[myId]?.isHost;
    const boardRef = useRef<HTMLDivElement | null>(null);
    const draggedPiece = pieces.find((p) => p.id === draggedId) || null;

    const snapTargetRef = useRef<any>(null);
    const draggedPieceRef = useRef<PlacedShape | null>(null);
    const piecesRef = useRef<PlacedShape[]>(pieces);
    const activeEventsRef = useRef<ChaosEvent[]>(activeEvents);
    const cycleCountRef = useRef<number>(0);

    draggedPieceRef.current = draggedPiece;
    piecesRef.current = pieces;
    activeEventsRef.current = activeEvents;

    const hasEvent = (ev: ChaosEvent) => activeEvents.includes(ev);

    const activateChaosEventsLocally = (eventsList: ChaosEvent[]) => {
        setActiveEvents(eventsList);
        eventsList.forEach((ev) => sfx.playEvent(ev));
        earthquakeDropsTriggeredRef.current = { second2: false, second8: false };

        // Сброс одноразового использования Джокера при новом ивенте
        if (eventsList.includes('JOKER')) {
            setJokerUsed(false);
        }

        // Запуск синхронного 2-кратного мигания Рентгена для всех клеток
        if (eventsList.includes('XRAY')) {
            setXrayPulseKey(Date.now());
        }

        if (eventsList.includes('PAINT')) {
            spawnPaintSplats();
        } else {
            setPaintSplats([]);
        }

        if (eventsList.includes('ICE')) {
            const frozen: Record<string, number> = {};
            piecesRef.current.forEach((p) => {
                if (p.row === null) frozen[p.id] = 3;
            });
            setFrozenPieces(frozen);
        } else {
            setFrozenPieces({});
        }

        if (eventsList.includes('FLASHLIGHT') && boardRef.current) {
            const rect = boardRef.current.getBoundingClientRect();
            setLightPos({
                x: rect.left + rect.width / 2,
                y: rect.top + rect.height / 2
            });
        }

        if (eventsList.includes('EARTHQUAKE') && 'vibrate' in navigator) {
            navigator.vibrate([100, 50, 150, 50, 200]);
        }
    };

    useEffect(() => {
        socket.on('player_progress_changed', ({ playerId, progress }: { playerId: string; progress: number }) => {
            setOpponents((prev) =>
                prev.map((p) => (p.id === playerId ? { ...p, progress } : p))
            );
        });

        socket.on('chaos_event_triggered', ({ events, luckyOverrides: incomingLucky }: { events?: ChaosEvent[]; luckyOverrides?: Record<string, ChaosEvent[]> }) => {
            setEventCountdown(10);
            const overrides = incomingLucky || {};
            setLuckyOverrides(overrides);

            // Если для меня выпал персональный бафф — применяем его вместо дебаффа!
            const myList = overrides[myId] || events || ['NONE'];
            activateChaosEventsLocally(myList);
        });

        socket.on('board_swapped', ({ pieces: newPieces, fromPlayerName }: { pieces: PlacedShape[]; progress: number; fromPlayerName: string }) => {
            setDraggedId(null);
            setDragPos(null);
            setIsSwappingBoard(true);
            setSwapBanner({ fromName: fromPlayerName });
            sfx.playSwapPortal();

            if ('vibrate' in navigator) {
                navigator.vibrate([80, 40, 120, 40, 180]);
            }

            setTimeout(() => {
                setPieces(newPieces);
            }, 350);

            setTimeout(() => {
                setIsSwappingBoard(false);
            }, 950);

            setTimeout(() => {
                setSwapBanner(null);
            }, 2800);
        });

        socket.on('player_reaction', ({ emoji, playerId }: { emoji: string; playerId: string }) => {
            sfx.playReaction(emoji);
            const senderName = players[playerId]?.name || (playerId === myId ? 'Вы' : 'Игрок');
            setRecentReaction({ emoji, name: senderName });
            setTimeout(() => setRecentReaction(null), 2000);
            setPlayerReactions((prev) => ({
                ...prev,
                [playerId]: { emoji, ts: Date.now() }
            }));
        });

        socket.on('end_round_vote_updated', ({ votes, total }: { votes: string[]; total: number }) => {
            setEndRoundVotes(votes);
            setTotalRoomPlayers(total);
        });

        socket.on('round_ended', ({ winnerId, winnerName, isAborted, leaderboard }: { winnerId: string | null; winnerName: string | null; isAborted?: boolean; leaderboard: Player[] }) => {
            setRoundWinner({ id: winnerId, name: winnerName, isAborted });
            setRoundResults(leaderboard);
            setDraggedId(null);
            setPaintSplats([]);
            sfx.playRoundEnd(!isAborted && winnerId === myId);
        });

        return () => {
            socket.off('player_progress_changed');
            socket.off('chaos_event_triggered');
            socket.off('board_swapped');
            socket.off('player_reaction');
            socket.off('end_round_vote_updated');
            socket.off('round_ended');
        };
    }, [myId, players]);

    const spawnPaintSplats = () => {
        const count = 3;
        const w = window.innerWidth;
        const h = window.innerHeight;
        const newSplats: PaintSplat[] = Array.from({ length: count }, (_, i) => ({
            id: Date.now() + i,
            x: w * 0.22 + Math.random() * (w * 0.56),
            y: h * 0.28 + Math.random() * (h * 0.38),
            size: 140 + Math.floor(Math.random() * 35),
            color: SPLAT_COLORS[i % SPLAT_COLORS.length],
            hp: 100
        }));
        setPaintSplats(newSplats);
    };

    // Таймер раунда
    useEffect(() => {
        if (roundResults || level.noEvents) return;

        const timer = setInterval(() => {
            setEventCountdown((prev) => {
                if (prev > 1) return prev - 1;

                if (isHost) {
                    cycleCountRef.current += 1;
                    const cycle = cycleCountRef.current;
                    const prevEvents = activeEventsRef.current;

                    const poolA: ChaosEvent[] = ['CAROUSEL', 'INVERT_X', 'ICE', 'EARTHQUAKE'];
                    const poolB: ChaosEvent[] = ['FOG', 'GHOST', 'MONOCHROME', 'PAINT', 'FLASHLIGHT'];

                    let catA = poolA.filter((ev) => !prevEvents.includes(ev));
                    let catB = poolB.filter((ev) => !prevEvents.includes(ev));
                    if (catA.length === 0) catA = poolA;
                    if (catB.length === 0) catB = poolB;

                    let nextEvents: ChaosEvent[] = [];
                    const playerCount = Object.keys(players).length;
                    const rollSwap = playerCount >= 2 && Math.random() < 0.15 && !prevEvents.includes('SWAP');

                    const luckyMap: Record<string, ChaosEvent[]> = {};

                    // 1. Редкий общий подарок судьбы (5% шанс со 2-го цикла)
                    const isGlobalGift = cycle > 1 && Math.random() < 0.05 && !rollSwap;

                    if (isGlobalGift) {
                        nextEvents = ['XRAY'];
                    } else if (rollSwap) {
                        nextEvents = ['SWAP'];
                    } else {
                        // Обычный дебафф для комнаты
                        const isCombo = cycle > 1 && Math.random() < 0.33;
                        if (isCombo) {
                            const evA = catA[Math.floor(Math.random() * catA.length)];
                            const evB = catB[Math.floor(Math.random() * catB.length)];
                            nextEvents = [evA, evB];
                        } else {
                            const allRegular = [...catA, ...catB];
                            nextEvents = [allRegular[Math.floor(Math.random() * allRegular.length)]];
                        }

                        // 2. Персональный бафф (25% шанс цикла)
                        const allPids = Object.keys(players);
                        const candidates = allPids.filter((pid) => !lastLuckyPlayersRef.current.includes(pid));

                        if (Math.random() < 0.25 && candidates.length > 0) {
                            const maxLucky = allPids.length >= 6 ? 2 : 1;
                            const shuffled = [...candidates].sort(() => Math.random() - 0.5);
                            const luckyCount = Math.min(maxLucky, shuffled.length);
                            const chosen = shuffled.slice(0, luckyCount);

                            chosen.forEach((pid) => {
                                const roll = Math.random();
                                const buff: ChaosEvent = roll < 0.50 ? 'TOTEM' : roll < 0.90 ? 'XRAY' : 'JOKER';
                                luckyMap[pid] = [buff];
                            });

                            lastLuckyPlayersRef.current = chosen;
                        } else {
                            lastLuckyPlayersRef.current = [];
                        }
                    }

                    socket.emit('host_chaos_event', { code: roomCode, events: nextEvents, luckyOverrides: luckyMap });
                }

                return 10;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [roundResults, isHost, roomCode, players]);

    // Механика землетрясения: срыв фигуры на 2-й и 8-й секунде
    const triggerEarthquakeDrop = () => {
        const placed = piecesRef.current.filter((p) => p.row !== null && p.col !== null);
        if (placed.length === 0) return;

        // Выбираем случайную фигуру с поля
        const pieceToDrop = placed[Math.floor(Math.random() * placed.length)];

        // Точные координаты на экране для анимации падения
        if (boardRef.current) {
            const boardRect = boardRef.current.getBoundingClientRect();
            const startX = boardRect.left + 10 + pieceToDrop.col! * STEP;
            const startY = boardRect.top + 10 + pieceToDrop.row! * STEP;

            setFallingPiece({
                id: pieceToDrop.id,
                matrix: pieceToDrop.matrix,
                color: pieceToDrop.color,
                startX,
                startY,
                key: Date.now()
            });

            setTimeout(() => {
                setFallingPiece(null);
            }, 850);
        }

        // Если фигура перетаскивалась прямо сейчас — отпускаем её
        if (draggedPieceRef.current?.id === pieceToDrop.id) {
            setDraggedId(null);
            setDragPos(null);
        }

        // Возвращаем деталь в лоток
        const updated = piecesRef.current.map((p) =>
            p.id === pieceToDrop.id ? { ...p, row: null, col: null } : p
        );
        setPieces(updated);
        updateTotalProgress(updated);

        // Звук удара, вибрация и плашка
        sfx.playEarthquakeDrop();
        if ('vibrate' in navigator) {
            triggerHaptic('error');
        }

        setEarthquakeAlert('🌋 Тряска сбила фигуру в лоток!');
        setTimeout(() => {
            setEarthquakeAlert(null);
        }, 2200);
    };

    // Отслеживание 2-й (countdown = 8) и 8-й (countdown = 2) секунды землетрясения
    useEffect(() => {
        if (!hasEvent('EARTHQUAKE') || roundResults) return;

        if (eventCountdown === 8 && !earthquakeDropsTriggeredRef.current.second2) {
            earthquakeDropsTriggeredRef.current.second2 = true;
            triggerEarthquakeDrop();
        } else if (eventCountdown === 2 && !earthquakeDropsTriggeredRef.current.second8) {
            earthquakeDropsTriggeredRef.current.second8 = true;
            triggerEarthquakeDrop();
        }
    }, [eventCountdown, activeEvents, roundResults]);

    // Сдвиг лотка каждые 2.5 сек во время Мегакарусели
    useEffect(() => {
        if (!hasEvent('CAROUSEL') || roundResults) {
            setTrayShift(0);
            return;
        }

        const interval = setInterval(() => {
            setTrayShift((prev) => prev + 1);
            sfx.playRotate();
        }, 2500);

        return () => clearInterval(interval);
    }, [activeEvents, roundResults]);

    const wipePaintAt = (clientX: number, clientY: number) => {
        if (paintSplats.length === 0) return;

        const last = lastWipePosRef.current;
        lastWipePosRef.current = { x: clientX, y: clientY };

        if (!last) return;
        const moveStep = Math.hypot(clientX - last.x, clientY - last.y);
        if (moveStep < 10) return;

        const scrubDamage = Math.min(9.3, moveStep * 0.3);
        let hitAny = false;

        setPaintSplats((prev) =>
            prev
                .map((splat) => {
                    const dist = Math.hypot(clientX - splat.x, clientY - splat.y);
                    if (dist < splat.size * 0.75) {
                        hitAny = true;
                        return { ...splat, hp: splat.hp - scrubDamage };
                    }
                    return splat;
                })
                .filter((splat) => splat.hp > 0)
        );

        if (hitAny) sfx.playWipeSqueak();
    };
    const handleAutoPlaceJoker = (piece: PlacedShape) => {
        if (!level.solutionGrid) return;

        let bestR: number | null = null;
        let bestC: number | null = null;
        let bestMatrix: number[][] = piece.matrix;

        // Перебираем все 4 поворота, чтобы гарантированно найти место в решении
        let testMatrix = piece.matrix;
        for (let rot = 0; rot < 4; rot++) {
            const rows = testMatrix.length;
            const cols = testMatrix[0].length;

            for (let r = 0; r <= level.gridHeight - rows; r++) {
                for (let c = 0; c <= level.gridWidth - cols; c++) {
                    let matches = true;
                    for (let mr = 0; mr < rows; mr++) {
                        for (let mc = 0; mc < cols; mc++) {
                            if (testMatrix[mr][mc] === 1) {
                                if (level.solutionGrid[r + mr]?.[c + mc] !== piece.color) {
                                    matches = false;
                                    break;
                                }
                            }
                        }
                        if (!matches) break;
                    }
                    if (matches) {
                        bestR = r;
                        bestC = c;
                        bestMatrix = testMatrix;
                        break;
                    }
                }
                if (bestR !== null) break;
            }
            if (bestR !== null) break;
            testMatrix = rotateMatrix(testMatrix);
        }

        if (bestR === null || bestC === null) return;

        // Собираем клетки, куда встанет Джокер
        const targetCells = new Set<string>();
        for (let mr = 0; mr < bestMatrix.length; mr++) {
            for (let mc = 0; mc < bestMatrix[0].length; mc++) {
                if (bestMatrix[mr][mc] === 1) {
                    targetCells.add(`${bestR + mr},${bestC + mc}`);
                }
            }
        }

        // Если игрок уже поставил туда другую деталь — возвращаем её в лоток без наложений
        let bumpedAny = false;
        const updated = piecesRef.current.map((p) => {
            if (p.id === piece.id) {
                return { ...p, matrix: bestMatrix, row: bestR, col: bestC };
            }
            if (p.row !== null && p.col !== null) {
                let overlaps = false;
                for (let mr = 0; mr < p.matrix.length; mr++) {
                    for (let mc = 0; mc < p.matrix[0].length; mc++) {
                        if (p.matrix[mr][mc] === 1 && targetCells.has(`${p.row + mr},${p.col + mc}`)) {
                            overlaps = true;
                            break;
                        }
                    }
                    if (overlaps) break;
                }
                if (overlaps) {
                    bumpedAny = true;
                    return { ...p, row: null, col: null };
                }
            }
            return p;
        });

        if (bumpedAny) sfx.playReturn();
        sfx.playSnap();
        triggerHaptic('success');

        // 1. Помечаем фигуру как навсегда ЗОЛОТУЮ
        setGoldPieceIds((prev) => [...prev, piece.id]);
        // 2. Джокер потрачен — кнопка исчезает и не переходит на другие фигуры!
        setJokerUsed(true);

        setPieces(updated);
        updateTotalProgress(updated);
    };

    const handleRotate = (id: string, e: React.PointerEvent | React.MouseEvent) => {
        e.stopPropagation();

        if (frozenPieces[id] && frozenPieces[id] > 0) {
            sfx.playIceCrack();
            triggerHaptic('medium'); // <--- добавляем сюда
            setFrozenPieces((prev) => ({
                ...prev,
                [id]: Math.max(0, (prev[id] || 0) - 1)
            }));
            return;
        }

        sfx.playRotate();
        setPieces((prev) => {
            return prev.map((p) => {
                if (p.id !== id) return p;
                const newMatrix = rotateMatrix(p.matrix);

                if (p.row !== null && p.col !== null) {
                    if (
                        p.row + newMatrix.length > level.gridHeight ||
                        p.col + newMatrix[0].length > level.gridWidth
                    ) {
                        return p;
                    }
                }
                return { ...p, matrix: newMatrix };
            });
        });
    };

    const handleStartDrag = (piece: PlacedShape, e: React.PointerEvent) => {
        if (roundResults || paintSplats.length > 0 || isSwappingBoard) return;

        setLightPos({ x: e.clientX, y: e.clientY });

        if (piece.row === null && frozenPieces[piece.id] && frozenPieces[piece.id] > 0) {
            sfx.playIceCrack();
            if ('vibrate' in navigator) navigator.vibrate(20);
            setFrozenPieces((prev) => ({
                ...prev,
                [piece.id]: Math.max(0, (prev[piece.id] || 0) - 1)
            }));
            return;
        }

        const shapeRows = piece.matrix.length;
        const shapeCols = piece.matrix[0].length;

        setGrabOffset({
            x: (shapeCols * STEP) / 2,
            y: (shapeRows * STEP) / 2
        });

        dragStartPointerRef.current = { x: e.clientX, y: e.clientY };
        dragStartPiecePosRef.current = { x: e.clientX, y: e.clientY };

        setDraggedId(piece.id);
        setDragPos({ x: e.clientX, y: e.clientY });
    };

    const getSnapTarget = () => {
        if (!draggedPiece || !dragPos || !boardRef.current) return null;

        const boardRect = boardRef.current.getBoundingClientRect();
        const padding = 10;

        const pieceTopLeftX = dragPos.x - grabOffset.x;
        const pieceTopLeftY = dragPos.y - grabOffset.y;

        const relX = pieceTopLeftX - (boardRect.left + padding);
        const relY = pieceTopLeftY - (boardRect.top + padding);

        const col = Math.round(relX / STEP);
        const row = Math.round(relY / STEP);

        const shapeRows = draggedPiece.matrix.length;
        const shapeCols = draggedPiece.matrix[0].length;

        const inBounds =
            row >= 0 &&
            col >= 0 &&
            row + shapeRows <= level.gridHeight &&
            col + shapeCols <= level.gridWidth;

        if (!inBounds) return null;

        const occupied = Array.from({ length: level.gridHeight }, () =>
            Array(level.gridWidth).fill(false)
        );

        pieces.forEach((p) => {
            if (p.id === draggedPiece.id || p.row === null || p.col === null) return;
            for (let r = 0; r < p.matrix.length; r++) {
                for (let c = 0; c < p.matrix[0].length; c++) {
                    if (p.matrix[r][c] === 1) occupied[p.row + r][p.col + c] = true;
                }
            }
        });

        let isValid = true;
        for (let r = 0; r < shapeRows; r++) {
            for (let c = 0; c < shapeCols; c++) {
                if (draggedPiece.matrix[r][c] === 1 && occupied[row + r][col + c]) {
                    isValid = false;
                    break;
                }
            }
            if (!isValid) break;
        }

        return { row, col, isValid };
    };

    const snapTarget = getSnapTarget();
    snapTargetRef.current = snapTarget;

    const updateTotalProgress = (currentPieces: PlacedShape[]) => {
        let filled = 0;
        currentPieces.forEach((p) => {
            if (p.row !== null && p.col !== null) {
                for (let r = 0; r < p.matrix.length; r++) {
                    for (let c = 0; c < p.matrix[0].length; c++) {
                        if (p.matrix[r][c] === 1) filled++;
                    }
                }
            }
        });

        const progress = Math.min(100, Math.round((filled / level.targetCellsCount) * 100));
        socket.emit('update_progress', { code: roomCode, progress, pieces: currentPieces });

        if (progress === 100) {
            socket.emit('round_finished', { code: roomCode });
        }
    };

    useEffect(() => {
        if (!draggedId) return;

        const handleWindowPointerMove = (e: PointerEvent) => {
            const hasInvertX = activeEventsRef.current.includes('INVERT_X');
            const dx = e.clientX - dragStartPointerRef.current.x;

            const targetX = hasInvertX ? dragStartPiecePosRef.current.x - dx : e.clientX;
            const targetY = e.clientY;

            setDragPos({ x: targetX, y: targetY });
            setLightPos({ x: targetX, y: targetY });
        };

        const handleWindowPointerUp = () => {
            lastWipePosRef.current = null;
            const piece = draggedPieceRef.current;
            const snap = snapTargetRef.current;
            const currentPieces = piecesRef.current;

            if (!piece) {
                setDraggedId(null);
                setDragPos(null);
                return;
            }

            if (snap && snap.isValid) {
                sfx.playSnap();
                triggerHaptic('light');

                const updated = currentPieces.map((p) =>
                    p.id === piece.id ? { ...p, row: snap.row, col: snap.col } : p
                );
                setPieces(updated);
                updateTotalProgress(updated);
            } else {
                sfx.playReturn();
                const updated = currentPieces.map((p) =>
                    p.id === piece.id ? { ...p, row: null, col: null } : p
                );
                setPieces(updated);
                updateTotalProgress(updated);
            }

            setDraggedId(null);
            setDragPos(null);
        };

        window.addEventListener('pointermove', handleWindowPointerMove);
        window.addEventListener('pointerup', handleWindowPointerUp);
        window.addEventListener('pointercancel', handleWindowPointerUp);

        return () => {
            window.removeEventListener('pointermove', handleWindowPointerMove);
            window.removeEventListener('pointerup', handleWindowPointerUp);
            window.removeEventListener('pointercancel', handleWindowPointerUp);
        };
    }, [draggedId]);

    const getDisplayColor = (originalColor: string) => {
        return hasEvent('MONOCHROME') ? MONO_COLOR : originalColor;
    };

    const isGhostMode = hasEvent('GHOST');

    const boardCells: { color: string | null; shape: PlacedShape | null }[][] = Array.from(
        { length: level.gridHeight },
        () => Array.from({ length: level.gridWidth }, () => ({ color: null, shape: null }))
    );

    pieces.forEach((p) => {
        if (p.row !== null && p.col !== null && p.id !== draggedId) {
            for (let r = 0; r < p.matrix.length; r++) {
                for (let c = 0; c < p.matrix[0].length; c++) {
                    if (p.matrix[r][c] === 1) {
                        boardCells[p.row + r][p.col + c] = {
                            color: getDisplayColor(p.color),
                            shape: p
                        };
                    }
                }
            }
        }
    });

    const rawTrayPieces = pieces.filter((p) => p.row === null);
    const trayPieces = hasEvent('CAROUSEL') && rawTrayPieces.length > 1
        ? [...rawTrayPieces.slice(trayShift % rawTrayPieces.length), ...rawTrayPieces.slice(0, trayShift % rawTrayPieces.length)]
        : rawTrayPieces;

    return (
        <div
            onPointerDown={(e) => setLightPos({ x: e.clientX, y: e.clientY })}
            onPointerMove={(e) => {
                setLightPos({ x: e.clientX, y: e.clientY });
                if (paintSplats.length > 0) wipePaintAt(e.clientX, e.clientY);
            }}
            style={{
                position: 'relative',
                paddingTop: 8,
                paddingLeft: 12,
                paddingRight: 12,
                paddingBottom: 'calc(20px + env(safe-area-inset-bottom, 16px))',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                height: '100dvh',
                maxHeight: '100dvh',
                justifyContent: 'space-between',
                userSelect: 'none',
                WebkitUserSelect: 'none',
                touchAction: 'none',
                boxSizing: 'border-box',
                overflow: 'hidden',
                background: 'radial-gradient(ellipse at 50% 25%, #1e1b4b 0%, #090d1a 60%, #030712 100%)'
            }}
        >
            <style>{`
                @keyframes chaosShake {
                    0% { transform: translate(0, 0) rotate(0deg); }
                    20% { transform: translate(-6px, 4px) rotate(-1.5deg); }
                    40% { transform: translate(6px, -5px) rotate(1.5deg); }
                    60% { transform: translate(-5px, -3px) rotate(-1deg); }
                    80% { transform: translate(5px, 5px) rotate(1deg); }
                    100% { transform: translate(0, 0) rotate(0deg); }
                }
                @keyframes orbitalDrift {
                    0% { transform: translate(0px, 0px); }
                    25% { transform: translate(26px, -20px); }
                    50% { transform: translate(-22px, 24px); }
                    75% { transform: translate(-26px, -18px); }
                    100% { transform: translate(0px, 0px); }
                }
                @keyframes conveyorTick {
                    0% { transform: scale(0.94); opacity: 0.7; }
                    100% { transform: scale(1); opacity: 1; }
                }
                @keyframes swapBoard3D {
                    0% { transform: perspective(700px) rotateY(0deg) scale(1); filter: brightness(1); }
                    45% { transform: perspective(700px) rotateY(180deg) scale(0.65); filter: brightness(2.2) hue-rotate(90deg); }
                    100% { transform: perspective(700px) rotateY(360deg) scale(1); filter: brightness(1); }
                }
                @keyframes swapPortalPulse {
                    0% { transform: translate(-50%, -50%) scale(0.3); opacity: 1; }
                    100% { transform: translate(-50%, -50%) scale(2.4); opacity: 0; }
                }
                @keyframes floatReaction {
                    0% { transform: translateY(0) scale(0.7); opacity: 0; }
                    20% { transform: translateY(-8px) scale(1.2); opacity: 1; }
                    80% { transform: translateY(-16px) scale(1); opacity: 1; }
                    100% { transform: translateY(-24px) scale(0.8); opacity: 0; }
                }
                @keyframes pieceTumbleFall {
                    0% {
                        transform: translate(0, 0) rotate(0deg) scale(1);
                        opacity: 1;
                        filter: drop-shadow(0 0 16px rgba(239, 68, 68, 0.9));
                    }
                    15% {
                        transform: translate(-10px, -15px) rotate(-10deg) scale(1.08);
                        opacity: 1;
                        filter: drop-shadow(0 0 22px rgba(239, 68, 68, 1));
                    }
                    100% {
                        transform: translate(25px, 280px) rotate(42deg) scale(0.6);
                        opacity: 0;
                        filter: drop-shadow(0 12px 24px rgba(0, 0, 0, 0.8));
                    }
                }
                @keyframes xrayBlinkTwice {
                    0% { opacity: 0; }
                    18% { opacity: 0.45; }
                    36% { opacity: 0.45; }
                    50% { opacity: 0; }
                    68% { opacity: 0.45; }
                    86% { opacity: 0.45; }
                    100% { opacity: 0; }
                }
                @keyframes jokerGoldPulse {
                    0%, 100% { box-shadow: 0 0 10px rgba(245, 158, 11, 0.4); border-color: #f59e0b; }
                    50% { box-shadow: 0 0 22px rgba(245, 158, 11, 0.9); border-color: #fde047; }
                }
                @keyframes alertPulse {
                    0% { transform: translate(-50%, -10px) scale(0.9); opacity: 0; }
                    15% { transform: translate(-50%, 0) scale(1.05); opacity: 1; }
                    85% { transform: translate(-50%, 0) scale(1); opacity: 1; }
                    100% { transform: translate(-50%, -15px) scale(0.9); opacity: 0; }
                }
            `}</style>

            {/* Фон Canvas */}
            <SpaceCanvasBackground celebrate={Boolean(roundWinner && !roundWinner.isAborted)} />

            {/* Оверлеи хаоса */}
            <ChaosOverlays
                hasEvent={hasEvent}
                roundFinished={Boolean(roundResults)}
                lightPos={lightPos}
                swapBanner={swapBanner}
                paintSplats={paintSplats}
                onWipePaint={wipePaintAt}
                recentReaction={recentReaction}
            />

            {/* Анимированная фигура, слетающая с доски от землетрясения */}
            {fallingPiece && (
                <div
                    key={fallingPiece.key}
                    style={{
                        position: 'fixed',
                        left: fallingPiece.startX,
                        top: fallingPiece.startY,
                        pointerEvents: 'none',
                        zIndex: 9998,
                        display: 'grid',
                        gridTemplateColumns: `repeat(${fallingPiece.matrix[0].length}, ${CELL_SIZE}px)`,
                        gap: `${CELL_GAP}px`,
                        animation: 'pieceTumbleFall 0.85s cubic-bezier(0.25, 1, 0.5, 1) forwards'
                    }}
                >
                    {fallingPiece.matrix.map((row, r) =>
                        row.map((val, c) => (
                            <div
                                key={`${r}-${c}`}
                                style={{
                                    width: CELL_SIZE,
                                    height: CELL_SIZE,
                                    borderRadius: 8,
                                    background: val ? fallingPiece.color : 'transparent',
                                    border: val ? '2px solid #ef4444' : 'none',
                                    boxShadow: val ? '0 0 16px rgba(239, 68, 68, 0.85)' : 'none'
                                }}
                            />
                        ))
                    )}
                </div>
            )}

            {/* Всплывающее предупреждение землетрясения */}
            {earthquakeAlert && (
                <div
                    style={{
                        position: 'fixed',
                        top: '22%',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        background: 'rgba(239, 68, 68, 0.95)',
                        border: '2px solid #fca5a5',
                        color: '#fff',
                        padding: '7px 18px',
                        borderRadius: 20,
                        fontSize: 13,
                        fontWeight: 800,
                        zIndex: 10004,
                        pointerEvents: 'none',
                        whiteSpace: 'nowrap',
                        boxShadow: '0 4px 20px rgba(239, 68, 68, 0.6)',
                        animation: 'alertPulse 2.2s ease forwards'
                    }}
                >
                    {earthquakeAlert}
                </div>
            )}

            {/* Верхняя интерфейсная панель */}
            {/* Верхняя интерфейсная панель */}
            <GameTopBar
                roomCode={roomCode}
                isHost={isHost}
                isMuted={isMuted}
                onToggleMute={() => {
                    sfx.muted = !sfx.muted;
                    setIsMuted(sfx.muted);
                }}
                onExitClick={() => setShowExitConfirm(true)}
                endRoundVotes={endRoundVotes}
                totalRoomPlayers={totalRoomPlayers}
                hasVotedEndRound={endRoundVotes.includes(myId)}
                onVoteEndRound={() => socket.emit('vote_end_round', { code: roomCode })}
                activeEvents={activeEvents}
                eventCountdown={eventCountdown}
                cycleCount={cycleCountRef.current}
                opponents={opponents}
                luckyOverrides={luckyOverrides}
                playerReactions={playerReactions}
                onSendReaction={(emoji) => socket.emit('send_reaction', { code: roomCode, emoji, playerId: myId })}
                onForceEvent={(ev) => {
                    if (ev === 'XRAY') {
                        setXrayPulseKey(Date.now());
                    }
                    if (ev === 'JOKER') {
                        setJokerUsed(false);
                    }
                    if (ev === 'TOTEM' || ev === 'XRAY' || ev === 'JOKER') {
                        socket.emit('host_chaos_event', {
                            code: roomCode,
                            events: ['NONE'],
                            luckyOverrides: { [myId]: [ev] }
                        });
                    } else {
                        socket.emit('host_chaos_event', {
                            code: roomCode,
                            events: [ev]
                        });
                    }
                }}
            />

            {/* Игровое поле: четкий пунктирный контур для призраков */}
            <div
                ref={boardRef}
                style={{
                    position: 'relative',
                    display: 'grid',
                    gridTemplateColumns: `repeat(${level.gridWidth}, ${CELL_SIZE}px)`,
                    gridTemplateRows: `repeat(${level.gridHeight}, ${CELL_SIZE}px)`,
                    gap: `${CELL_GAP}px`,
                    zIndex: 2,
                    background: 'rgba(30, 41, 59, 0.82)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    padding: 10,
                    borderRadius: 14,
                    border: isSwappingBoard ? '2px solid #10b981' : '2px solid #334155',
                    boxShadow: isSwappingBoard
                        ? '0 0 35px rgba(16, 185, 129, 0.7)'
                        : '0 8px 24px rgba(0,0,0,0.4)',
                    margin: 'auto 0',
                    flex: '0 0 auto',
                    transform: 'none',
                    animation: isSwappingBoard
                        ? 'swapBoard3D 0.9s cubic-bezier(0.22, 1, 0.36, 1)'
                        : hasEvent('EARTHQUAKE')
                            ? 'chaosShake 0.25s infinite'
                            : hasEvent('CAROUSEL')
                                ? 'orbitalDrift 4.5s ease-in-out infinite'
                                : 'none'
                }}
            >
                {boardCells.map((row, r) =>
                    row.map((cell, c) => {
                        let isGhostCell = false;
                        let isGhostValid = false;

                        if (draggedPiece && snapTarget) {
                            const localR = r - snapTarget.row;
                            const localC = c - snapTarget.col;
                            if (
                                localR >= 0 &&
                                localR < draggedPiece.matrix.length &&
                                localC >= 0 &&
                                localC < draggedPiece.matrix[0].length &&
                                draggedPiece.matrix[localR][localC] === 1
                            ) {
                                isGhostCell = true;
                                isGhostValid = snapTarget.isValid;
                            }
                        }

                        const ghostColor = draggedPiece ? getDisplayColor(draggedPiece.color) : '#38bdf8';
                        const solColor = level.solutionGrid?.[r]?.[c];
                        const isXrayActive = hasEvent('XRAY') && Boolean(solColor);
                        const isGoldCell = cell.shape && goldPieceIds.includes(cell.shape.id);

                        return (
                            <div
                                key={`${r}-${c}`}
                                onPointerDown={(e) => {
                                    if (cell.shape) handleStartDrag(cell.shape, e);
                                }}
                                style={{
                                    position: 'relative',
                                    width: CELL_SIZE,
                                    height: CELL_SIZE,
                                    borderRadius: 8,
                                    // Если деталь была поставлена Джокером — она навсегда сияет золотом!
                                    background: isGhostCell
                                        ? isGhostValid
                                            ? ghostColor
                                            : '#ef4444'
                                        : isGoldCell
                                            ? 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 50%, #d97706 100%)'
                                            : isGhostMode && cell.color
                                                ? 'rgba(148, 163, 184, 0.14)'
                                                : cell.color || 'rgba(15, 23, 42, 0.55)',
                                    opacity: isGhostCell
                                        ? isGhostValid
                                            ? 0.45
                                            : 0.65
                                        : 1,
                                    border: isGhostCell
                                        ? isGhostValid
                                            ? `2px solid ${ghostColor}`
                                            : '2px solid #ef4444'
                                        : isGoldCell
                                            ? '1.5px solid #fde047'
                                            : isGhostMode && cell.color
                                                ? '1.5px dashed rgba(226, 232, 240, 0.65)'
                                                : cell.color
                                                    ? 'none'
                                                    : '1px dashed #334155',
                                    boxShadow: isGoldCell
                                        ? '0 0 14px rgba(245, 158, 11, 0.75), inset 0 0 6px rgba(255, 255, 255, 0.4)'
                                        : 'none',
                                    cursor: cell.shape ? 'grab' : 'default',
                                    transition: 'background 0.05s ease, opacity 0.25s ease'
                                }}
                            >
                                {/* Рентген: синхронно мигает ровно 2 раза по всей доске поверх любых клеток */}
                                {isXrayActive && (
                                    <div
                                        key={`${xrayPulseKey}-${r}-${c}`}
                                        style={{
                                            position: 'absolute',
                                            inset: 0,
                                            borderRadius: 8,
                                            background: `${solColor}35`,
                                            border: `2px dashed ${solColor}`,
                                            boxShadow: `inset 0 0 8px ${solColor}55`,
                                            animation: 'xrayBlinkTwice 2s ease-in-out forwards',
                                            pointerEvents: 'none',
                                            zIndex: 5
                                        }}
                                    />
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            {/* Лоток фигур */}
            <div
                style={{
                    width: '100%',
                    maxWidth: 440,
                    flex: '0 0 auto',
                    maxHeight: '35vh',
                    overflowY: 'auto',
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'center',
                    alignContent: 'flex-start',
                    gap: 8,
                    padding: '10px 8px',
                    position: 'relative',
                    zIndex: 2,
                    background: 'rgba(11, 19, 41, 0.78)',
                    backdropFilter: 'blur(14px)',
                    WebkitBackdropFilter: 'blur(14px)',
                    borderRadius: 14,
                    border: '1px solid #1e293b',
                    boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.3)',
                    scrollbarWidth: 'none',
                    marginBottom: 4,
                    animation: hasEvent('EARTHQUAKE') ? 'chaosShake 0.3s infinite' : 'none'
                }}
            >
                {trayPieces.length === 0 && (
                    <div style={{ width: '100%', textAlign: 'center', color: '#64748b', fontSize: 13, padding: '12px 0' }}>
                        Все фигуры на поле. Стяните фигуру вниз, чтобы вернуть.
                    </div>
                )}

                {trayPieces.map((piece) => {
                    const pieceColor = getDisplayColor(piece.color);
                    const isBeingDragged = piece.id === draggedId;
                    const iceHitsLeft = frozenPieces[piece.id] || 0;
                    const isFrozen = iceHitsLeft > 0;
                    const isFogged = hasEvent('FOG');
                    const isJokerPiece = hasEvent('JOKER') && !jokerUsed && piece.id === trayPieces[0]?.id;

                    return (
                        <div
                            key={piece.id}
                            style={{
                                position: 'relative',
                                borderRadius: 12,
                                background: isFrozen
                                    ? 'rgba(8, 51, 68, 0.85)'
                                    : isFogged
                                        ? 'rgba(30, 41, 59, 0.85)'
                                        : 'rgba(30, 41, 59, 0.70)',
                                border: isJokerPiece
                                    ? '2px solid #fbbf24'
                                    : isFrozen
                                        ? '2px solid #22d3ee'
                                        : isFogged
                                            ? '1px dashed #64748b'
                                            : '1px solid #334155',
                                animation: isJokerPiece ? 'jokerGoldPulse 1.2s infinite' : 'none',
                                boxShadow: isFrozen
                                    ? '0 0 12px rgba(34, 211, 238, 0.35)'
                                    : isFogged
                                        ? '0 0 10px rgba(100, 116, 139, 0.3)'
                                        : 'none',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                padding: '4px',
                                opacity: isBeingDragged ? 0.3 : 1,
                                pointerEvents: isBeingDragged ? 'none' : 'auto',
                                touchAction: 'none',
                                transition: 'all 0.2s ease'
                            }}
                        >
                            {isFrozen && (
                                <div
                                    style={{
                                        position: 'absolute',
                                        top: 4,
                                        right: 4,
                                        background: '#06b6d4',
                                        color: '#083344',
                                        fontSize: 10,
                                        fontWeight: 900,
                                        padding: '1px 6px',
                                        borderRadius: 999,
                                        zIndex: 5,
                                        pointerEvents: 'none',
                                        boxShadow: '0 2px 6px rgba(0,0,0,0.4)'
                                    }}
                                >
                                    ❄️ {iceHitsLeft}
                                </div>
                            )}

                            {isJokerPiece && (
                                <div
                                    style={{
                                        position: 'absolute',
                                        top: 4,
                                        right: 4,
                                        background: '#f59e0b',
                                        color: '#0f172a',
                                        fontSize: 9,
                                        fontWeight: 900,
                                        padding: '1px 6px',
                                        borderRadius: 999,
                                        zIndex: 5,
                                        pointerEvents: 'none',
                                        boxShadow: '0 2px 8px rgba(245, 158, 11, 0.6)'
                                    }}
                                >
                                    ⭐ ДЖОКЕР
                                </div>
                            )}

                            <div
                                onPointerDown={(e) => handleStartDrag(piece, e)}
                                style={{
                                    minHeight: 54,
                                    minWidth: 58,
                                    padding: '6px 8px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: isFrozen ? 'pointer' : 'grab',
                                    touchAction: 'none'
                                }}
                            >
                                {isFogged ? (
                                    <div
                                        style={{
                                            fontSize: 24,
                                            fontWeight: 900,
                                            color: '#94a3b8',
                                            filter: 'drop-shadow(0 0 8px rgba(148, 163, 184, 0.5))'
                                        }}
                                    >
                                        ❓
                                    </div>
                                ) : (
                                    <div
                                        style={{
                                            display: 'grid',
                                            gridTemplateColumns: `repeat(${piece.matrix[0].length}, ${PREVIEW_CELL}px)`,
                                            gridTemplateRows: `repeat(${piece.matrix.length}, ${PREVIEW_CELL}px)`,
                                            gap: `${PREVIEW_GAP}px`,
                                            pointerEvents: 'none',
                                            opacity: isFrozen ? 0.65 : 1,
                                            filter: isFrozen ? 'saturate(0.4) brightness(1.3)' : 'none'
                                        }}
                                    >
                                        {piece.matrix.map((row, r) =>
                                            row.map((val, c) => (
                                                <div
                                                    key={`${r}-${c}`}
                                                    style={{
                                                        width: PREVIEW_CELL,
                                                        height: PREVIEW_CELL,
                                                        borderRadius: 3,
                                                        background: val
                                                            ? isGhostMode
                                                                ? 'rgba(148, 163, 184, 0.25)'
                                                                : pieceColor
                                                            : 'transparent',
                                                        border: val && isGhostMode ? '1px dashed rgba(226, 232, 240, 0.7)' : 'none'
                                                    }}
                                                />
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>

                            {isJokerPiece ? (
                                <button
                                    type="button"
                                    onPointerDown={(e) => e.stopPropagation()}
                                    onClick={() => handleAutoPlaceJoker(piece)}
                                    style={{
                                        fontSize: 10,
                                        fontWeight: 800,
                                        padding: '4px 10px',
                                        background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                                        color: '#0f172a',
                                        border: '1px solid #fde047',
                                        borderRadius: 6,
                                        cursor: 'pointer',
                                        marginTop: 2,
                                        marginBottom: 2,
                                        boxShadow: '0 0 10px rgba(245, 158, 11, 0.6)'
                                    }}
                                >
                                    ⭐ Поставить в паз
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onPointerDown={(e) => e.stopPropagation()}
                                    onClick={(e) => handleRotate(piece.id, e)}
                                    style={{
                                        fontSize: 10,
                                        fontWeight: 600,
                                        padding: '3px 8px',
                                        background: isFrozen ? '#0e7490' : '#334155',
                                        color: '#e2e8f0',
                                        border: 'none',
                                        borderRadius: 6,
                                        cursor: 'pointer',
                                        marginTop: 2,
                                        marginBottom: 2
                                    }}
                                >
                                    {isFrozen ? '🔨 Разбить лёд' : '↻ Повернуть'}
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Летающая деталь под пальцем */}
            {draggedPiece && dragPos && !roundResults && (
                <div
                    style={{
                        position: 'fixed',
                        left: dragPos.x - grabOffset.x,
                        top: dragPos.y - grabOffset.y,
                        pointerEvents: 'none',
                        zIndex: 9999,
                        display: 'grid',
                        gridTemplateColumns: `repeat(${draggedPiece.matrix[0].length}, ${CELL_SIZE}px)`,
                        gap: `${CELL_GAP}px`,
                        transform: 'none',
                        filter: 'drop-shadow(0 12px 24px rgba(0,0,0,0.6))'
                    }}
                >
                    {draggedPiece.matrix.map((row, r) =>
                        row.map((val, c) => (
                            <div
                                key={`${r}-${c}`}
                                style={{
                                    width: CELL_SIZE,
                                    height: CELL_SIZE,
                                    borderRadius: 8,
                                    background: val ? getDisplayColor(draggedPiece.color) : 'transparent',
                                    opacity: val ? (isGhostMode ? 0.6 : 0.95) : 0,
                                    border: val && isGhostMode ? '1.5px dashed #fff' : 'none'
                                }}
                            />
                        ))
                    )}
                </div>
            )}

            {/* Модалка подтверждения выхода */}
            {showExitConfirm && (
                <ExitConfirmModal
                    onCancel={() => setShowExitConfirm(false)}
                    onConfirm={() => {
                        setShowExitConfirm(false);
                        socket.emit('back_to_lobby', { code: roomCode });
                    }}
                />
            )}

            {/* Модалка победы */}
            {roundResults && roundWinner && (
                <GameOverModal
                    roundWinner={roundWinner}
                    roundResults={roundResults}
                    myId={myId}
                    isHost={isHost}
                    solutionGrid={level.solutionGrid}
                    gridWidth={level.gridWidth}
                    gridHeight={level.gridHeight}
                    solCellSize={SOL_CELL_SIZE}
                    onNextRound={() => {
                        setRoundResults(null);
                        setRoundWinner(null);
                        socket.emit('start_game', {
                            code: roomCode,
                            width: level.gridWidth,
                            height: level.gridHeight,
                            noEvents: level.noEvents
                        });
                    }}
                    onBackToLobby={() => socket.emit('back_to_lobby', { code: roomCode })}
                />
            )}
        </div>
    );
};