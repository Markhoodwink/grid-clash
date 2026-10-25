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
    hp: number; // от 100 до 0
}

type ChaosEvent = 'NONE' | 'PAINT' | 'FLIP' | 'MONOCHROME' | 'EARTHQUAKE';

interface GameScreenProps {
    level: {
        gridWidth: number;
        gridHeight: number;
        targetCellsCount: number;
        pieces: Shape[];
    };
    roomCode: string;
    players?: Record<string, Player>;
    myId?: string;
}

const EVENT_INFO: Record<ChaosEvent, { title: string; color: string }> = {
    NONE: { title: '⏳ Спокойствие перед бурей...', color: '#38bdf8' },
    PAINT: { title: '🎨 КРАСКА! Активно три кляксы пальцем!', color: '#ec4899' },
    FLIP: { title: '🙃 ПЕРЕВОРОТ! Поле вверх ногами!', color: '#f59e0b' },
    MONOCHROME: { title: '🎭 ХАМЕЛЕОН! Все фигуры одного цвета!', color: '#a855f7' },
    EARTHQUAKE: { title: '🌋 ЗЕМЛЕТРЯСЕНИЕ! Держи экран!', color: '#ef4444' }
};

const SPLAT_COLORS = ['#ec4899', '#8b5cf6', '#10b981', '#f59e0b', '#06b6d4', '#ef4444'];
const MONO_COLOR = '#8b5cf6';

// --- ВСТРОЕННЫЙ СИНТЕЗАТОР ЗВУКОВ (WEB AUDIO API) ---
class SoundFX {
    private ctx: AudioContext | null = null;
    public muted: boolean = false;
    private lastSqueakTime: number = 0;

    private getContext(): AudioContext | null {
        if (this.muted) return null;
        if (!this.ctx) {
            const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
            if (AudioCtx) this.ctx = new AudioCtx();
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume().catch(() => { });
        }
        return this.ctx;
    }

    // Звук установки фигуры в клетки поля
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

    // Звук возврата фигуры в лоток
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

    // Звук поворота фигуры
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

    // Звук трения губки при стирании кляксы
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

    // Звуки для каждого из 4 ивентов
    playEvent(event: ChaosEvent) {
        const ctx = this.getContext();
        if (!ctx) return;
        const now = ctx.currentTime;

        if (event === 'PAINT') {
            // Всплеск краски (серия пузырьков)
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
            // Гравитационный свист переворота
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
        } else if (event === 'MONOCHROME') {
            // Мистический аккорд хамелеона
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
        } else if (event === 'EARTHQUAKE') {
            // Подземный низкочастотный гул
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
        }
    }

    // Звук победы или окончания раунда
    playRoundEnd(isWinner: boolean) {
        const ctx = this.getContext();
        if (!ctx) return;
        const now = ctx.currentTime;

        const notes = isWinner
            ? [523.25, 659.25, 783.99, 1046.5] // Победная фанфара (До-Ми-Соль-До)
            : [392.0, 349.23, 311.13, 261.63]; // Сигнал поражения

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
    const [roundWinner, setRoundWinner] = useState<{ id: string; name: string } | null>(null);
    const [roundResults, setRoundResults] = useState<Player[] | null>(null);

    // Состояния хаос-ивентов и звука
    const [activeEvent, setActiveEvent] = useState<ChaosEvent>('NONE');
    const [eventCountdown, setEventCountdown] = useState<number>(10);
    const [paintSplats, setPaintSplats] = useState<PaintSplat[]>([]);
    const [isMuted, setIsMuted] = useState<boolean>(sfx.muted);

    const lastWipePosRef = useRef<{ x: number; y: number } | null>(null);
    const isHost = players[myId]?.isHost;
    const boardRef = useRef<HTMLDivElement | null>(null);
    const draggedPiece = pieces.find((p) => p.id === draggedId) || null;

    // Подписка на события сокетов
    useEffect(() => {
        socket.on('player_progress_changed', ({ playerId, progress }: { playerId: string; progress: number }) => {
            setOpponents((prev) =>
                prev.map((p) => (p.id === playerId ? { ...p, progress } : p))
            );
        });

        socket.on('round_ended', ({ winnerId, winnerName, leaderboard }: { winnerId: string; winnerName: string; leaderboard: Player[] }) => {
            setRoundWinner({ id: winnerId, name: winnerName });
            setRoundResults(leaderboard);
            setDraggedId(null);
            sfx.playRoundEnd(winnerId === myId);
        });

        return () => {
            socket.off('player_progress_changed');
            socket.off('round_ended');
        };
    }, [myId]);

    // Генерация густых клякс краски
    const spawnPaintSplats = () => {
        const count = 5;
        const w = window.innerWidth;
        const h = window.innerHeight;
        const newSplats: PaintSplat[] = Array.from({ length: count }, (_, i) => ({
            id: Date.now() + i,
            x: w * 0.18 + Math.random() * (w * 0.64),
            y: h * 0.22 + Math.random() * (h * 0.45),
            size: 120 + Math.floor(Math.random() * 45),
            color: SPLAT_COLORS[i % SPLAT_COLORS.length],
            hp: 100
        }));
        setPaintSplats(newSplats);
    };

    // Таймер смены случайного ивента каждые 10 секунд
    useEffect(() => {
        if (roundResults) return;

        const timer = setInterval(() => {
            setEventCountdown((prev) => {
                if (prev > 1) return prev - 1;

                const pool: ChaosEvent[] = ['PAINT', 'FLIP', 'MONOCHROME', 'EARTHQUAKE'];
                setActiveEvent((current) => {
                    const available = pool.filter((e) => e !== current);
                    const nextEvent = available[Math.floor(Math.random() * available.length)];

                    sfx.playEvent(nextEvent);

                    if (nextEvent === 'PAINT') {
                        spawnPaintSplats();
                    } else {
                        setPaintSplats([]);
                    }

                    if (nextEvent === 'EARTHQUAKE' && navigator.vibrate) {
                        navigator.vibrate([100, 50, 150, 50, 200]);
                    }

                    return nextEvent;
                });

                return 10;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [roundResults]);

    // Усложненное оттирание клякс: требует реального движения пальцем туда-сюда
    const wipePaintAt = (clientX: number, clientY: number) => {
        if (paintSplats.length === 0) return;

        const last = lastWipePosRef.current;
        lastWipePosRef.current = { x: clientX, y: clientY };

        if (!last) return;
        const moveStep = Math.hypot(clientX - last.x, clientY - last.y);
        // Если палец стоит на месте — краска не стирается
        if (moveStep < 3) return;

        // Урон кляксе за один шаг движения ограничен (нужно интенсивно тереть)
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
        sfx.playRotate();
        setPieces((prev) =>
            prev.map((p) => {
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
            })
        );
    };

    const handleStartDrag = (piece: PlacedShape, e: React.PointerEvent) => {
        if (roundResults || paintSplats.length > 0) return;
        (e.target as HTMLElement).setPointerCapture(e.pointerId);

        const shapeRows = piece.matrix.length;
        const shapeCols = piece.matrix[0].length;

        setGrabOffset({
            x: (shapeCols * STEP) / 2,
            y: (shapeRows * STEP) / 2
        });

        setDraggedId(piece.id);
        setDragPos({ x: e.clientX, y: e.clientY });
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (paintSplats.length > 0) {
            wipePaintAt(e.clientX, e.clientY);
        }

        if (!draggedId || roundResults) return;
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

    const handlePointerUp = () => {
        lastWipePosRef.current = null;

        if (!draggedPiece || roundResults) {
            setDraggedId(null);
            setDragPos(null);
            return;
        }

        if (snapTarget && snapTarget.isValid) {
            sfx.playSnap();
            if (navigator.vibrate) navigator.vibrate(25);

            const updated = pieces.map((p) =>
                p.id === draggedPiece.id ? { ...p, row: snapTarget.row, col: snapTarget.col } : p
            );
            setPieces(updated);
            updateTotalProgress(updated);
        } else {
            sfx.playReturn();
            const updated = pieces.map((p) =>
                p.id === draggedPiece.id ? { ...p, row: null, col: null } : p
            );
            setPieces(updated);
            updateTotalProgress(updated);
        }

        setDraggedId(null);
        setDragPos(null);
    };

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
        socket.emit('update_progress', { code: roomCode, progress });

        if (progress === 100) {
            socket.emit('round_finished', { code: roomCode });
        }
    };

    const getDisplayColor = (originalColor: string) => {
        return activeEvent === 'MONOCHROME' ? MONO_COLOR : originalColor;
    };

    const boardCells: { color: string | null; shape: PlacedShape | null }[][] = Array.from(
        { length: level.gridHeight },
        () => Array(level.gridWidth).fill({ color: null, shape: null })
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

    const trayPieces = pieces.filter((p) => p.row === null && p.id !== draggedId);

    return (
        <div
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
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
      `}</style>

            {/* 1. Верхняя панель: выход, звук, таймер ивентов и соперники */}
            <div style={{ width: '100%', maxWidth: 440, flex: '0 0 auto' }}>
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 6
                    }}
                >
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
                            gap: 5
                        }}
                    >
                        🚪 В лобби
                    </button>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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

                {/* Баннер случайного события каждые 10 секунд */}
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
                    border: '2px solid #334155',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                    margin: 'auto 0',
                    flex: '0 0 auto',
                    transform: activeEvent === 'FLIP' ? 'rotate(180deg)' : 'none',
                    animation: activeEvent === 'EARTHQUAKE' ? 'chaosShake 0.25s infinite' : 'none',
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
                                    opacity: isGhostCell ? (isGhostValid ? 0.45 : 0.65) : 1,
                                    border: isGhostCell
                                        ? isGhostValid
                                            ? `2px solid ${ghostColor}`
                                            : '2px solid #ef4444'
                                        : cell.color
                                            ? 'none'
                                            : '1px dashed #334155',
                                    cursor: cell.shape ? 'grab' : 'default',
                                    transition: 'background 0.05s ease'
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
                    return (
                        <div
                            key={piece.id}
                            onPointerDown={(e) => handleStartDrag(piece, e)}
                            style={{
                                padding: '6px 8px',
                                borderRadius: 10,
                                background: '#1e293b',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                cursor: 'grab',
                                touchAction: 'none',
                                border: '1px solid #334155'
                            }}
                        >
                            <div
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: `repeat(${piece.matrix[0].length}, ${PREVIEW_CELL}px)`,
                                    gridTemplateRows: `repeat(${piece.matrix.length}, ${PREVIEW_CELL}px)`,
                                    gap: `${PREVIEW_GAP}px`,
                                    marginBottom: 5,
                                    transform: activeEvent === 'FLIP' ? 'rotate(180deg)' : 'none',
                                    transition: 'transform 0.3s ease'
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
                                                background: val ? pieceColor : 'transparent'
                                            }}
                                        />
                                    ))
                                )}
                            </div>
                            <button
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={(e) => handleRotate(piece.id, e)}
                                style={{
                                    fontSize: 10,
                                    padding: '3px 8px',
                                    background: '#334155',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: 5,
                                    cursor: 'pointer'
                                }}
                            >
                                ↻ Повернуть
                            </button>
                        </div>
                    );
                })}
            </div>

            {/* 4. Слой густых клякс краски (требуют интенсивного трения пальцем) */}
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
                        🧽 Интенсивно три кляксы пальцем ({paintSplats.length} шт.)!
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

            {/* 5. Летающая фигура под пальцем */}
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
                                    opacity: val ? 0.95 : 0
                                }}
                            />
                        ))
                    )}
                </div>
            )}

            {/* 6. Модальное окно подтверждения выхода */}
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

            {/* 7. Экран победы раунда */}
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
                        padding: 20
                    }}
                >
                    <div style={{ width: '100%', maxWidth: 380, textAlign: 'center' }}>
                        <div style={{ fontSize: 44, marginBottom: 6 }}>
                            {roundWinner.id === myId ? '🏆' : '⚡'}
                        </div>

                        <h1
                            style={{
                                fontSize: 26,
                                fontWeight: 900,
                                color: roundWinner.id === myId ? '#38bdf8' : '#f59e0b',
                                marginBottom: 4
                            }}
                        >
                            {roundWinner.id === myId ? 'ВЫ ПОБЕДИЛИ!' : `${roundWinner.name} собрал быстрее всех!`}
                        </h1>

                        <p style={{ color: '#94a3b8', fontSize: 13, marginBottom: 20 }}>
                            Счет серии (число побед)
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
                            {roundResults.map((player, index) => {
                                const medals = ['🥇', '🥈', '🥉'];
                                const isRoundWinner = player.id === roundWinner.id;

                                return (
                                    <div
                                        key={player.id}
                                        style={{
                                            background: isRoundWinner ? 'rgba(56, 189, 248, 0.15)' : player.id === myId ? '#1e293b' : '#0f172a',
                                            border: isRoundWinner ? '2px solid #38bdf8' : '1px solid #334155',
                                            borderRadius: 10,
                                            padding: '10px 14px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between'
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <span style={{ fontSize: 18 }}>{medals[index] || `#${index + 1}`}</span>
                                            <span style={{ fontWeight: 600, fontSize: 15 }}>
                                                {player.name} {player.id === myId ? '(Вы)' : ''}
                                            </span>
                                        </div>
                                        <div>
                                            <span style={{ fontWeight: 900, fontSize: 18, color: '#38bdf8' }}>
                                                {player.score || 0}
                                            </span>
                                            <span style={{ fontSize: 11, color: '#64748b', marginLeft: 4 }}>
                                                {(player.score || 0) === 1 ? 'победа' : (player.score || 0) >= 2 && (player.score || 0) <= 4 ? 'победы' : 'побед'}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {isHost ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
                                <button
                                    onClick={() =>
                                        socket.emit('start_game', {
                                            code: roomCode,
                                            width: level.gridWidth,
                                            height: level.gridHeight
                                        })
                                    }
                                    style={{
                                        padding: 14,
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
                                        padding: 12,
                                        borderRadius: 12,
                                        background: '#1e293b',
                                        color: '#38bdf8',
                                        border: '1px solid #38bdf8',
                                        fontWeight: 'bold',
                                        fontSize: 14,
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