import React, { useState, useRef, useEffect } from 'react';
import { rotateMatrix } from '../utils/polyomino';
import { socket } from '../socket';

interface Shape {
    id: string;
    matrix: number[][];
    color: string;
}

interface PlacedShape extends Shape {
    row: number | null;
    col: number | null;
}

interface Player {
    id: string;
    name: string;
    progress: number;
    score: number;
    isHost?: boolean;
}

interface PaintSplat {
    id: number;
    x: number;
    y: number;
    size: number;
    color: string;
    hp: number;
}

type ChaosEvent =
    | 'NONE'
    | 'PAINT'
    | 'FLIP'
    | 'MONOCHROME'
    | 'EARTHQUAKE'
    | 'FLASHLIGHT'
    | 'ICE'
    | 'GHOST'
    | 'SWAP';

interface GameScreenProps {
    level: {
        gridWidth: number;
        gridHeight: number;
        targetCellsCount: number;
        pieces: Shape[];
        solutionGrid?: string[][];
    };
    roomCode: string;
    players?: Record<string, Player>;
    myId?: string;
}

const EVENT_INFO: Record<ChaosEvent, { title: string; color: string }> = {
    NONE: { title: '⏳ Спокойствие перед бурей...', color: '#38bdf8' },
    PAINT: { title: '🎨 КРАСКА! Быстро три кляксы пальцем!', color: '#ec4899' },
    FLIP: { title: '🙃 ПЕРЕВОРОТ! Поле вверх ногами!', color: '#f59e0b' },
    MONOCHROME: { title: '🎭 ХАМЕЛЕОН! Все фигуры одного цвета!', color: '#a855f7' },
    EARTHQUAKE: { title: '🌋 ЗЕМЛЕТРЯСЕНИЕ! Держи экран!', color: '#ef4444' },
    FLASHLIGHT: { title: '🔦 ТЬМА! Подсвечивай поле пальцем!', color: '#eab308' },
    ICE: { title: '🧊 ЗАМОРОЗКА! Тапай по льду, чтобы разбить!', color: '#06b6d4' },
    GHOST: { title: '👀 ПРИЗРАКИ! Фигуры стали почти прозрачными!', color: '#94a3b8' },
    SWAP: { title: '🌀 СВАП ДОСОК! Обмен полями с соперником!', color: '#10b981' }
};

const SPLAT_COLORS = ['#ec4899', '#8b5cf6', '#10b981', '#f59e0b', '#06b6d4', '#ef4444'];
const MONO_COLOR = '#8b5cf6';

class SoundFX {
    private ctx: AudioContext | null = null;
    public muted: boolean = false;
    private lastSqueakTime: number = 0;

    private getContext(): AudioContext | null {
        if (this.muted) return null;
        if (!this.ctx) {
            const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
            if (AudioCtx) this.ctx = new AudioCtx();
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume().catch(() => { });
        }
        return this.ctx;
    }

    playSnap() {
        const ctx = this.getContext();
        if (!ctx) return;
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(190, now);
        osc.frequency.exponentialRampToValueAtTime(520, now + 0.085);
        gain.gain.setValueAtTime(0.28, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.09);
    }

    playReturn() {
        const ctx = this.getContext();
        if (!ctx) return;
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(240, now);
        osc.frequency.exponentialRampToValueAtTime(120, now + 0.08);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.08);
    }

    playRotate() {
        const ctx = this.getContext();
        if (!ctx) return;
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(600, now + 0.06);
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.065);
    }

    playIceCrack() {
        const ctx = this.getContext();
        if (!ctx) return;
        const now = ctx.currentTime;
        [950, 1420].forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(freq, now + i * 0.03);
            osc.frequency.exponentialRampToValueAtTime(freq * 1.4, now + i * 0.03 + 0.05);
            gain.gain.setValueAtTime(0.18, now + i * 0.03);
            gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.03 + 0.055);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + i * 0.03);
            osc.stop(now + i * 0.03 + 0.055);
        });
    }

    playSwapPortal() {
        const ctx = this.getContext();
        if (!ctx) return;
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(140, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.35);
        osc.frequency.exponentialRampToValueAtTime(220, now + 0.75);
        gain.gain.setValueAtTime(0.32, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.78);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.78);
    }

    playWipeSqueak() {
        const nowMs = Date.now();
        if (nowMs - this.lastSqueakTime < 65) return;
        this.lastSqueakTime = nowMs;

        const ctx = this.getContext();
        if (!ctx) return;
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        const baseFreq = 650 + Math.random() * 250;
        osc.frequency.setValueAtTime(baseFreq, now);
        osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.35, now + 0.045);
        gain.gain.setValueAtTime(0.09, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.05);
    }

    playEvent(event: ChaosEvent) {
        const ctx = this.getContext();
        if (!ctx) return;
        const now = ctx.currentTime;

        if (event === 'PAINT') {
            [380, 260, 490, 310].forEach((freq, i) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, now + i * 0.055);
                osc.frequency.exponentialRampToValueAtTime(freq * 1.7, now + i * 0.055 + 0.06);
                gain.gain.setValueAtTime(0.22, now + i * 0.055);
                gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.055 + 0.07);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(now + i * 0.055);
                osc.stop(now + i * 0.055 + 0.07);
            });
        } else if (event === 'FLIP') {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(200, now);
            osc.frequency.exponentialRampToValueAtTime(680, now + 0.18);
            osc.frequency.exponentialRampToValueAtTime(240, now + 0.35);
            gain.gain.setValueAtTime(0.25, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.36);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.36);
        } else if (event === 'MONOCHROME' || event === 'GHOST') {
            [440, 554.37, 659.25].forEach((freq, i) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, now + i * 0.06);
                gain.gain.setValueAtTime(0.16, now + i * 0.06);
                gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.32);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(now + i * 0.06);
                osc.stop(now + i * 0.06 + 0.32);
            });
        } else if (event === 'ICE') {
            [880, 1174.66, 1567.98].forEach((freq, i) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(freq, now + i * 0.045);
                gain.gain.setValueAtTime(0.18, now + i * 0.045);
                gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.045 + 0.2);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(now + i * 0.045);
                osc.stop(now + i * 0.045 + 0.2);
            });
        } else if (event === 'FLASHLIGHT') {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(300, now);
            osc.frequency.exponentialRampToValueAtTime(90, now + 0.25);
            gain.gain.setValueAtTime(0.24, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.26);
        } else if (event === 'EARTHQUAKE') {
            const osc = ctx.createOscillator();
            const filter = ctx.createBiquadFilter();
            const gain = ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(75, now);
            osc.frequency.linearRampToValueAtTime(42, now + 0.48);
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(150, now);
            gain.gain.setValueAtTime(0.32, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
            osc.connect(filter);
            filter.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.5);
        } else if (event === 'SWAP') {
            this.playSwapPortal();
        }
    }

    playRoundEnd(isWinner: boolean) {
        const ctx = this.getContext();
        if (!ctx) return;
        const now = ctx.currentTime;
        const notes = isWinner
            ? [523.25, 659.25, 783.99, 1046.5]
            : [392.0, 349.23, 311.13, 261.63];

        notes.forEach((freq, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, now + idx * 0.09);
            gain.gain.setValueAtTime(0.25, now + idx * 0.09);
            gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.09 + 0.32);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + idx * 0.09);
            osc.stop(now + idx * 0.09 + 0.32);
        });
    }
}

const sfx = new SoundFX();

export const GameScreen: React.FC<GameScreenProps> = ({
    level,
    roomCode,
    players = {},
    myId = ''
}) => {
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

    const [activeEvent, setActiveEvent] = useState<ChaosEvent>('NONE');
    const [eventCountdown, setEventCountdown] = useState<number>(10);
    const [paintSplats, setPaintSplats] = useState<PaintSplat[]>([]);
    const [isMuted, setIsMuted] = useState<boolean>(sfx.muted);

    // Новые стейты для Фонарика, Заморозки, Свапа и Голосования за скип раунда
    const [lightPos, setLightPos] = useState<{ x: number; y: number }>({
        x: typeof window !== 'undefined' ? window.innerWidth / 2 : 200,
        y: typeof window !== 'undefined' ? window.innerHeight * 0.42 : 300
    });
    const [frozenPieces, setFrozenPieces] = useState<Record<string, number>>({});
    const [swapBanner, setSwapBanner] = useState<{ fromName: string } | null>(null);
    const [isSwappingBoard, setIsSwappingBoard] = useState(false);
    const [endRoundVotes, setEndRoundVotes] = useState<string[]>([]);
    const [totalRoomPlayers, setTotalRoomPlayers] = useState<number>(Object.keys(players).length || 1);

    const lastWipePosRef = useRef<{ x: number; y: number } | null>(null);
    const isHost = players[myId]?.isHost;
    const boardRef = useRef<HTMLDivElement | null>(null);
    const draggedPiece = pieces.find((p) => p.id === draggedId) || null;

    const snapTargetRef = useRef<any>(null);
    const draggedPieceRef = useRef<PlacedShape | null>(null);
    const piecesRef = useRef<PlacedShape[]>(pieces);
    const activeEventRef = useRef<ChaosEvent>(activeEvent);

    draggedPieceRef.current = draggedPiece;
    piecesRef.current = pieces;
    activeEventRef.current = activeEvent;

    // Применение локальных эффектов при запуске любого хаос-ивента
    const activateChaosEventLocally = (nextEvent: ChaosEvent) => {
        setActiveEvent(nextEvent);
        sfx.playEvent(nextEvent);

        if (nextEvent === 'PAINT') {
            spawnPaintSplats();
        } else {
            setPaintSplats([]);
        }

        if (nextEvent === 'ICE') {
            const frozen: Record<string, number> = {};
            piecesRef.current.forEach((p) => {
                if (p.row === null) {
                    frozen[p.id] = 2; // 2 нажатия, чтобы расколоть лёд
                }
            });
            setFrozenPieces(frozen);
        } else {
            setFrozenPieces({});
        }

        if (nextEvent === 'FLASHLIGHT' && boardRef.current) {
            const rect = boardRef.current.getBoundingClientRect();
            setLightPos({
                x: rect.left + rect.width / 2,
                y: rect.top + rect.height / 2
            });
        }

        if (nextEvent === 'EARTHQUAKE' && 'vibrate' in navigator) {
            navigator.vibrate([100, 50, 150, 50, 200]);
        }
    };

    useEffect(() => {
        socket.on('player_progress_changed', ({ playerId, progress }: { playerId: string; progress: number }) => {
            setOpponents((prev) =>
                prev.map((p) => (p.id === playerId ? { ...p, progress } : p))
            );
        });

        socket.on('chaos_event_triggered', ({ event }: { event: ChaosEvent }) => {
            setEventCountdown(10);
            activateChaosEventLocally(event);
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

            // В середине 3D-разворота подменяем фигуры на поле
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
            socket.off('end_round_vote_updated');
            socket.off('round_ended');
        };
    }, [myId]);

    const spawnPaintSplats = () => {
        const count = 5;
        const w = window.innerWidth;
        const h = window.innerHeight;
        const newSplats: PaintSplat[] = Array.from({ length: count }, (_, i) => ({
            id: Date.now() + i,
            x: w * 0.18 + Math.random() * (w * 0.64),
            y: h * 0.22 + Math.random() * (h * 0.45),
            size: 115 + Math.floor(Math.random() * 40),
            color: SPLAT_COLORS[i % SPLAT_COLORS.length],
            hp: 100
        }));
        setPaintSplats(newSplats);
    };

    // Таймер хаос-ивентов: хост генерирует событие с весами (SWAP выпадает в 2 раза реже остальных)
    useEffect(() => {
        if (roundResults) return;

        const timer = setInterval(() => {
            setEventCountdown((prev) => {
                if (prev > 1) return prev - 1;

                if (isHost) {
                    const current = activeEventRef.current;
                    const regularEvents: ChaosEvent[] = [
                        'PAINT',
                        'FLIP',
                        'MONOCHROME',
                        'EARTHQUAKE',
                        'FLASHLIGHT',
                        'ICE',
                        'GHOST'
                    ];

                    // Каждому обычному ивенту даем вес 2, а SWAP — вес 1 (в 2 раза реже!)
                    const weightedPool: ChaosEvent[] = [];
                    regularEvents.forEach((ev) => {
                        if (ev !== current) {
                            weightedPool.push(ev, ev);
                        }
                    });

                    const playerCount = Object.keys(players).length;
                    if (playerCount >= 2 && current !== 'SWAP') {
                        weightedPool.push('SWAP');
                    }

                    const nextEvent = weightedPool[Math.floor(Math.random() * weightedPool.length)];
                    socket.emit('host_chaos_event', { code: roomCode, event: nextEvent });
                }

                return 10;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [roundResults, isHost, roomCode, players]);

    const wipePaintAt = (clientX: number, clientY: number) => {
        if (paintSplats.length === 0) return;

        const last = lastWipePosRef.current;
        lastWipePosRef.current = { x: clientX, y: clientY };

        if (!last) return;
        const moveStep = Math.hypot(clientX - last.x, clientY - last.y);
        if (moveStep < 3) return;

        const scrubDamage = Math.min(6.5, moveStep * 0.25);
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

        if (hitAny) {
            sfx.playWipeSqueak();
        }
    };

    const toggleMute = () => {
        sfx.muted = !sfx.muted;
        setIsMuted(sfx.muted);
    };

    const handleRotate = (id: string, e: React.PointerEvent | React.MouseEvent) => {
        e.stopPropagation();

        // Если фигура заморожена — тап по кнопке тоже откалывает лёд
        if (frozenPieces[id] && frozenPieces[id] > 0) {
            sfx.playIceCrack();
            setFrozenPieces((prev) => ({
                ...prev,
                [id]: Math.max(0, (prev[id] || 0) - 1)
            }));
            return;
        }

        sfx.playRotate();
        setPieces((prev) => {
            const updated = prev.map((p) => {
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
            return updated;
        });
    };

    const handleStartDrag = (piece: PlacedShape, e: React.PointerEvent) => {
        if (roundResults || paintSplats.length > 0 || isSwappingBoard) return;

        setLightPos({ x: e.clientX, y: e.clientY });

        // Проверка заморозки: если фигура во льду, тап раскалывает лёд
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

        const rawCol = Math.round(relX / STEP);
        const rawRow = Math.round(relY / STEP);

        const shapeRows = draggedPiece.matrix.length;
        const shapeCols = draggedPiece.matrix[0].length;

        const col = activeEvent === 'FLIP' ? level.gridWidth - shapeCols - rawCol : rawCol;
        const row = activeEvent === 'FLIP' ? level.gridHeight - shapeRows - rawRow : rawRow;

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
            setDragPos({ x: e.clientX, y: e.clientY });
            setLightPos({ x: e.clientX, y: e.clientY });
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
                if ('vibrate' in navigator) navigator.vibrate(25);

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
        return activeEvent === 'MONOCHROME' ? MONO_COLOR : originalColor;
    };

    const isGhostMode = activeEvent === 'GHOST';

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

    const trayPieces = pieces.filter((p) => p.row === null);
    const hasVotedEndRound = endRoundVotes.includes(myId);

    return (
        <div
            onPointerDown={(e) => {
                setLightPos({ x: e.clientX, y: e.clientY });
            }}
            onPointerMove={(e) => {
                setLightPos({ x: e.clientX, y: e.clientY });
                if (paintSplats.length > 0) wipePaintAt(e.clientX, e.clientY);
            }}
            style={{
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
                overflow: 'hidden'
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
                @keyframes swapBoard3D {
                    0% { transform: perspective(700px) rotateY(0deg) scale(1); filter: brightness(1); }
                    45% { transform: perspective(700px) rotateY(180deg) scale(0.65); filter: brightness(2.2) hue-rotate(90deg); }
                    100% { transform: perspective(700px) rotateY(360deg) scale(1); filter: brightness(1); }
                }
                @keyframes swapPortalPulse {
                    0% { transform: translate(-50%, -50%) scale(0.3); opacity: 1; }
                    100% { transform: translate(-50%, -50%) scale(2.4); opacity: 0; }
                }
            `}</style>

            {/* 1. Верхняя панель (zIndex выше фонарика, чтобы кнопки всегда нажимались) */}
            <div style={{ width: '100%', maxWidth: 440, flex: '0 0 auto', position: 'relative', zIndex: 7500 }}>
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 6,
                        gap: 6
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <button
                            onClick={() => setShowExitConfirm(true)}
                            style={{
                                background: 'rgba(30, 41, 59, 0.9)',
                                border: '1px solid #334155',
                                color: '#94a3b8',
                                padding: '5px 10px',
                                borderRadius: 8,
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4
                            }}
                        >
                            🚪 В лобби
                        </button>

                        {/* Кнопка досрочного завершения раунда для создателя */}
                        {isHost && endRoundVotes.length === 0 && (
                            <button
                                onClick={() => socket.emit('vote_end_round', { code: roomCode })}
                                style={{
                                    background: 'rgba(245, 158, 11, 0.15)',
                                    border: '1px solid #f59e0b',
                                    color: '#fbbf24',
                                    padding: '5px 10px',
                                    borderRadius: 8,
                                    fontSize: 12,
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 4
                                }}
                            >
                                🏳️ Скип раунда
                            </button>
                        )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 12, color: '#64748b' }}>
                            Код: <b style={{ color: '#38bdf8' }}>{roomCode}</b>
                        </span>
                        <button
                            onClick={toggleMute}
                            style={{
                                background: '#1e293b',
                                border: '1px solid #334155',
                                borderRadius: 8,
                                padding: '4px 8px',
                                fontSize: 13,
                                cursor: 'pointer',
                                color: '#f8fafc'
                            }}
                            title="Звук Вкл/Выкл"
                        >
                            {isMuted ? '🔇' : '🔊'}
                        </button>
                    </div>
                </div>

                {/* Плашка голосования за досрочное завершение раунда */}
                {endRoundVotes.length > 0 && (
                    <div
                        style={{
                            background: 'rgba(30, 41, 59, 0.96)',
                            border: '1px solid #f59e0b',
                            borderRadius: 10,
                            padding: '6px 10px',
                            marginBottom: 6,
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            boxShadow: '0 4px 14px rgba(245, 158, 11, 0.25)'
                        }}
                    >
                        <span style={{ fontSize: 12, color: '#fde68a', fontWeight: 600 }}>
                            🏳️ Завершить раунд? ({endRoundVotes.length}/{totalRoomPlayers})
                        </span>

                        {!hasVotedEndRound ? (
                            <button
                                onClick={() => socket.emit('vote_end_round', { code: roomCode })}
                                style={{
                                    background: '#f59e0b',
                                    color: '#0f172a',
                                    border: 'none',
                                    borderRadius: 6,
                                    padding: '4px 10px',
                                    fontSize: 12,
                                    fontWeight: 800,
                                    cursor: 'pointer'
                                }}
                            >
                                ✓ Завершить
                            </button>
                        ) : (
                            <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>
                                ⏳ Ждем остальных...
                            </span>
                        )}
                    </div>
                )}

                {/* Индикатор текущего хаос-ивента */}
                <div
                    style={{
                        background: '#1e293b',
                        border: `1px solid ${EVENT_INFO[activeEvent].color}`,
                        borderRadius: 10,
                        padding: '6px 10px',
                        marginBottom: 6,
                        boxShadow: `0 0 12px ${EVENT_INFO[activeEvent].color}33`
                    }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, marginBottom: 4 }}>
                        <span style={{ fontWeight: 700, color: EVENT_INFO[activeEvent].color }}>
                            {EVENT_INFO[activeEvent].title}
                        </span>
                        <span style={{ fontWeight: 800, color: '#cbd5e1', fontSize: 11 }}>
                            {eventCountdown}с
                        </span>
                    </div>
                    <div style={{ width: '100%', height: 4, background: '#0f172a', borderRadius: 2, overflow: 'hidden' }}>
                        <div
                            style={{
                                width: `${(eventCountdown / 10) * 100}%`,
                                height: '100%',
                                background: EVENT_INFO[activeEvent].color,
                                transition: 'width 0.95s linear'
                            }}
                        />
                    </div>
                </div>

                {opponents.length > 0 && (
                    <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
                        {opponents.map((opp) => (
                            <div
                                key={opp.id}
                                style={{
                                    flex: 1,
                                    minWidth: 80,
                                    background: '#1e293b',
                                    padding: '4px 7px',
                                    borderRadius: 8,
                                    border: '1px solid #334155'
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2 }}>
                                    <span style={{ fontWeight: 600, color: '#e2e8f0', whiteSpace: 'nowrap' }}>{opp.name}</span>
                                    <span style={{ color: '#38bdf8' }}>{opp.progress || 0}%</span>
                                </div>
                                <div style={{ width: '100%', height: 3, background: '#0f172a', borderRadius: 2, overflow: 'hidden' }}>
                                    <div
                                        style={{
                                            width: `${opp.progress || 0}%`,
                                            height: '100%',
                                            background: '#38bdf8',
                                            transition: 'width 0.2s ease'
                                        }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* 2. Игровое поле */}
            <div
                ref={boardRef}
                style={{
                    position: 'relative',
                    display: 'grid',
                    gridTemplateColumns: `repeat(${level.gridWidth}, ${CELL_SIZE}px)`,
                    gridTemplateRows: `repeat(${level.gridHeight}, ${CELL_SIZE}px)`,
                    gap: `${CELL_GAP}px`,
                    background: '#1e293b',
                    padding: 10,
                    borderRadius: 14,
                    border: isSwappingBoard ? '2px solid #10b981' : '2px solid #334155',
                    boxShadow: isSwappingBoard
                        ? '0 0 35px rgba(16, 185, 129, 0.7)'
                        : '0 8px 24px rgba(0,0,0,0.4)',
                    margin: 'auto 0',
                    flex: '0 0 auto',
                    transform: activeEvent === 'FLIP' ? 'rotate(180deg)' : 'none',
                    animation: isSwappingBoard
                        ? 'swapBoard3D 0.9s cubic-bezier(0.22, 1, 0.36, 1)'
                        : activeEvent === 'EARTHQUAKE'
                            ? 'chaosShake 0.25s infinite'
                            : 'none',
                    transition: 'transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)'
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

                        return (
                            <div
                                key={`${r}-${c}`}
                                onPointerDown={(e) => {
                                    if (cell.shape) handleStartDrag(cell.shape, e);
                                }}
                                style={{
                                    width: CELL_SIZE,
                                    height: CELL_SIZE,
                                    borderRadius: 8,
                                    background: isGhostCell
                                        ? isGhostValid
                                            ? ghostColor
                                            : '#ef4444'
                                        : cell.color || '#0f172a',
                                    opacity: isGhostCell
                                        ? isGhostValid
                                            ? 0.45
                                            : 0.65
                                        : cell.color && isGhostMode
                                            ? 0.16
                                            : 1,
                                    border: isGhostCell
                                        ? isGhostValid
                                            ? `2px solid ${ghostColor}`
                                            : '2px solid #ef4444'
                                        : cell.color
                                            ? isGhostMode
                                                ? '1px dashed rgba(226, 232, 240, 0.4)'
                                                : 'none'
                                            : '1px dashed #334155',
                                    cursor: cell.shape ? 'grab' : 'default',
                                    transition: 'background 0.05s ease, opacity 0.25s ease'
                                }}
                            />
                        );
                    })
                )}
            </div>

            {/* 3. Лоток фигур */}
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
                    background: '#0b1329',
                    borderRadius: 14,
                    border: '1px solid #1e293b',
                    boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.3)',
                    scrollbarWidth: 'none',
                    marginBottom: 4,
                    animation: activeEvent === 'EARTHQUAKE' ? 'chaosShake 0.3s infinite' : 'none'
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

                    return (
                        <div
                            key={piece.id}
                            style={{
                                position: 'relative',
                                borderRadius: 12,
                                background: isFrozen ? 'rgba(8, 51, 68, 0.85)' : '#1e293b',
                                border: isFrozen ? '2px solid #22d3ee' : '1px solid #334155',
                                boxShadow: isFrozen ? '0 0 12px rgba(34, 211, 238, 0.35)' : 'none',
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
                            {/* Ледяная корка поверх фигуры */}
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
                                <div
                                    style={{
                                        display: 'grid',
                                        gridTemplateColumns: `repeat(${piece.matrix[0].length}, ${PREVIEW_CELL}px)`,
                                        gridTemplateRows: `repeat(${piece.matrix.length}, ${PREVIEW_CELL}px)`,
                                        gap: `${PREVIEW_GAP}px`,
                                        transform: activeEvent === 'FLIP' ? 'rotate(180deg)' : 'none',
                                        transition: 'transform 0.3s ease',
                                        pointerEvents: 'none',
                                        opacity: isGhostMode ? 0.18 : isFrozen ? 0.65 : 1,
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
                                                    background: val ? pieceColor : 'transparent',
                                                    border: val && isGhostMode ? '1px dashed rgba(255,255,255,0.45)' : 'none'
                                                }}
                                            />
                                        ))
                                    )}
                                </div>
                            </div>

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
                        </div>
                    );
                })}
            </div>

            {/* 4. Слой ФОНАРИКА (играбельная подсветка вокруг пальца) */}
            {activeEvent === 'FLASHLIGHT' && !roundResults && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 7000,
                        pointerEvents: 'none',
                        background: `radial-gradient(circle 115px at ${lightPos.x}px ${lightPos.y}px, rgba(15, 23, 42, 0) 0%, rgba(15, 23, 42, 0.15) 55%, rgba(6, 10, 20, 0.93) 100%)`
                    }}
                />
            )}

            {/* 5. Эпичная анимация СВАПА ДОСОК */}
            {swapBanner && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 9500,
                        pointerEvents: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'radial-gradient(circle, rgba(16, 185, 129, 0.28) 0%, rgba(15, 23, 42, 0) 70%)'
                    }}
                >
                    <div
                        style={{
                            position: 'absolute',
                            left: '50%',
                            top: '50%',
                            width: 220,
                            height: 220,
                            borderRadius: '50%',
                            border: '4px solid #10b981',
                            animation: 'swapPortalPulse 1.1s ease-out infinite'
                        }}
                    />
                    <div
                        style={{
                            background: 'rgba(15, 23, 42, 0.95)',
                            border: '2px solid #10b981',
                            borderRadius: 20,
                            padding: '16px 24px',
                            textAlign: 'center',
                            boxShadow: '0 0 40px rgba(16, 185, 129, 0.6)',
                            transform: 'scale(1.05)'
                        }}
                    >
                        <div style={{ fontSize: 38, marginBottom: 4 }}>🌀</div>
                        <div style={{ fontSize: 20, fontWeight: 900, color: '#10b981', letterSpacing: 1 }}>
                            СВАП ДОСОК!
                        </div>
                        <div style={{ fontSize: 13, color: '#e2e8f0', marginTop: 4, fontWeight: 600 }}>
                            Вы получили поле игрока <span style={{ color: '#38bdf8' }}>«{swapBanner.fromName}»</span>!
                        </div>
                    </div>
                </div>
            )}

            {/* 6. Кляксы краски */}
            {paintSplats.length > 0 && (
                <div
                    onPointerDown={(e) => {
                        lastWipePosRef.current = { x: e.clientX, y: e.clientY };
                    }}
                    onPointerMove={(e) => wipePaintAt(e.clientX, e.clientY)}
                    onPointerUp={() => {
                        lastWipePosRef.current = null;
                    }}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 8000,
                        touchAction: 'none',
                        cursor: 'crosshair'
                    }}
                >
                    <div
                        style={{
                            position: 'fixed',
                            top: '18%',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            background: 'rgba(15, 23, 42, 0.92)',
                            color: '#ec4899',
                            padding: '7px 16px',
                            borderRadius: 20,
                            fontWeight: 800,
                            fontSize: 13,
                            border: '1px solid #ec4899',
                            pointerEvents: 'none',
                            whiteSpace: 'nowrap',
                            boxShadow: '0 4px 15px rgba(0,0,0,0.4)'
                        }}
                    >
                        🧽 Три кляксы пальцем ({paintSplats.length} шт.)!
                    </div>

                    {paintSplats.map((splat) => (
                        <div
                            key={splat.id}
                            style={{
                                position: 'fixed',
                                left: splat.x,
                                top: splat.y,
                                width: splat.size,
                                height: splat.size,
                                transform: `translate(-50%, -50%) scale(${0.45 + (splat.hp / 100) * 0.65})`,
                                background: splat.color,
                                opacity: Math.max(0.35, splat.hp / 100),
                                borderRadius: '44% 56% 62% 38% / 53% 42% 58% 47%',
                                boxShadow: `0 0 28px ${splat.color}, inset 0 0 18px rgba(0,0,0,0.35)`,
                                pointerEvents: 'none'
                            }}
                        />
                    ))}
                </div>
            )}

            {/* 7. Летающая фигура под пальцем */}
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
                        transform: activeEvent === 'FLIP' ? 'rotate(180deg)' : 'none',
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
                                    opacity: val ? (isGhostMode ? 0.35 : 0.95) : 0,
                                    border: val && isGhostMode ? '1px dashed #fff' : 'none'
                                }}
                            />
                        ))
                    )}
                </div>
            )}

            {/* 8. Модальное окно подтверждения выхода */}
            {showExitConfirm && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(15, 23, 42, 0.85)',
                        backdropFilter: 'blur(5px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 10002,
                        padding: 20
                    }}
                >
                    <div
                        style={{
                            background: '#1e293b',
                            border: '1px solid #334155',
                            borderRadius: 16,
                            padding: 20,
                            maxWidth: 320,
                            width: '100%',
                            textAlign: 'center',
                            boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
                        }}
                    >
                        <div style={{ fontSize: 36, marginBottom: 8 }}>🚪</div>
                        <h3 style={{ fontSize: 18, color: '#f8fafc', marginBottom: 6, fontWeight: 700 }}>
                            Покинуть матч?
                        </h3>
                        <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 18, lineHeight: 1.4 }}>
                            Текущий прогресс раунда будет сброшен, и комната вернется в лобби ожидания.
                        </p>
                        <div style={{ display: 'flex', gap: 10 }}>
                            <button
                                onClick={() => setShowExitConfirm(false)}
                                style={{
                                    flex: 1,
                                    padding: 12,
                                    borderRadius: 10,
                                    background: '#334155',
                                    color: '#fff',
                                    border: 'none',
                                    fontSize: 14,
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                }}
                            >
                                Отмена
                            </button>
                            <button
                                onClick={() => {
                                    setShowExitConfirm(false);
                                    socket.emit('back_to_lobby', { code: roomCode });
                                }}
                                style={{
                                    flex: 1,
                                    padding: 12,
                                    borderRadius: 10,
                                    background: '#e11d48',
                                    color: '#fff',
                                    border: 'none',
                                    fontSize: 14,
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                }}
                            >
                                Да, выйти
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 9. Экран завершения раунда + РЕШЕНИЕ ПАЗЛА */}
            {roundResults && roundWinner && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(15, 23, 42, 0.96)',
                        backdropFilter: 'blur(8px)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 10001,
                        padding: 16,
                        overflowY: 'auto'
                    }}
                >
                    <div style={{ width: '100%', maxWidth: 380, textAlign: 'center', margin: 'auto' }}>
                        <div style={{ fontSize: 38, marginBottom: 4 }}>
                            {roundWinner.isAborted ? '🏳️' : roundWinner.id === myId ? '🏆' : '⚡'}
                        </div>

                        <h1
                            style={{
                                fontSize: 22,
                                fontWeight: 900,
                                color: roundWinner.isAborted
                                    ? '#cbd5e1'
                                    : roundWinner.id === myId
                                        ? '#38bdf8'
                                        : '#f59e0b',
                                marginBottom: 2
                            }}
                        >
                            {roundWinner.isAborted
                                ? 'РАУНД ЗАВЕРШЕН ДОСРОЧНО'
                                : roundWinner.id === myId
                                    ? 'ВЫ ПОБЕДИЛИ!'
                                    : `${roundWinner.name} собрал быстрее всех!`}
                        </h1>

                        <p style={{ color: '#94a3b8', fontSize: 12, marginBottom: 14 }}>
                            {roundWinner.isAborted
                                ? 'Все игроки проголосовали за пропуск — без начисления очков'
                                : 'Счет серии (число побед)'}
                        </p>

                        {level.solutionGrid && (
                            <div
                                style={{
                                    background: '#0b1329',
                                    border: '1px solid #334155',
                                    borderRadius: 12,
                                    padding: '10px 14px',
                                    marginBottom: 14,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    boxShadow: '0 4px 16px rgba(0,0,0,0.3)'
                                }}
                            >
                                <div
                                    style={{
                                        fontSize: 12,
                                        fontWeight: 700,
                                        color: '#94a3b8',
                                        marginBottom: 8,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 6
                                    }}
                                >
                                    <span>🧩</span> Как надо было собрать:
                                </div>

                                <div
                                    style={{
                                        display: 'grid',
                                        gridTemplateColumns: `repeat(${level.gridWidth}, ${SOL_CELL_SIZE}px)`,
                                        gridTemplateRows: `repeat(${level.gridHeight}, ${SOL_CELL_SIZE}px)`,
                                        gap: '3px',
                                        background: '#1e293b',
                                        padding: 6,
                                        borderRadius: 10,
                                        border: '1px solid #334155'
                                    }}
                                >
                                    {level.solutionGrid.map((row, r) =>
                                        row.map((cellColor, c) => (
                                            <div
                                                key={`${r}-${c}`}
                                                style={{
                                                    width: SOL_CELL_SIZE,
                                                    height: SOL_CELL_SIZE,
                                                    borderRadius: 4,
                                                    background: cellColor || '#0f172a',
                                                    boxShadow: 'inset 0 0 4px rgba(0,0,0,0.4)',
                                                    border: '1px solid rgba(255,255,255,0.06)'
                                                }}
                                            />
                                        ))
                                    )}
                                </div>
                            </div>
                        )}

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                            {roundResults.map((player, index) => {
                                const medals = ['🥇', '🥈', '🥉'];
                                const isRoundWinner = !roundWinner.isAborted && player.id === roundWinner.id;

                                return (
                                    <div
                                        key={player.id}
                                        style={{
                                            background: isRoundWinner
                                                ? 'rgba(56, 189, 248, 0.15)'
                                                : player.id === myId
                                                    ? '#1e293b'
                                                    : '#0f172a',
                                            border: isRoundWinner ? '2px solid #38bdf8' : '1px solid #334155',
                                            borderRadius: 10,
                                            padding: '8px 12px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between'
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <span style={{ fontSize: 16 }}>{medals[index] || `#${index + 1}`}</span>
                                            <span style={{ fontWeight: 600, fontSize: 14 }}>
                                                {player.name} {player.id === myId ? '(Вы)' : ''}
                                            </span>
                                        </div>
                                        <div>
                                            <span style={{ fontWeight: 900, fontSize: 16, color: '#38bdf8' }}>
                                                {player.score || 0}
                                            </span>
                                            <span style={{ fontSize: 11, color: '#64748b', marginLeft: 4 }}>
                                                {(player.score || 0) === 1
                                                    ? 'победа'
                                                    : (player.score || 0) >= 2 && (player.score || 0) <= 4
                                                        ? 'победы'
                                                        : 'побед'}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {isHost ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
                                <button
                                    onClick={() => {
                                        setRoundResults(null);
                                        setRoundWinner(null);
                                        socket.emit('start_game', {
                                            code: roomCode,
                                            width: level.gridWidth,
                                            height: level.gridHeight
                                        });
                                    }}
                                    style={{
                                        padding: 12,
                                        borderRadius: 12,
                                        background: '#e11d48',
                                        color: '#fff',
                                        border: 'none',
                                        fontWeight: 'bold',
                                        fontSize: 15,
                                        cursor: 'pointer'
                                    }}
                                >
                                    Следующий раунд ({level.gridWidth}×{level.gridHeight}) →
                                </button>

                                <button
                                    onClick={() => socket.emit('back_to_lobby', { code: roomCode })}
                                    style={{
                                        padding: 10,
                                        borderRadius: 12,
                                        background: '#1e293b',
                                        color: '#38bdf8',
                                        border: '1px solid #38bdf8',
                                        fontWeight: 'bold',
                                        fontSize: 13,
                                        cursor: 'pointer'
                                    }}
                                >
                                    В лобби (настройки / позвать друзей) 👥
                                </button>
                            </div>
                        ) : (
                            <p style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: 13 }}>
                                Ожидаем решение создателя комнаты...
                            </p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};