import React, { useState, useEffect, useRef } from 'react';
import { socket } from '../socket';

interface Player {
    id: string;
    name: string;
    score: number;
    isHost?: boolean;
}

interface Room {
    code: string;
    status: string;
    players: Record<string, Player>;
}

interface LobbyProps {
    room: Room | null;
    myId: string;
    onStartGame: (width: number, height: number) => void;
}

// Формы фигур полимино для летающего фона
const BG_SHAPES = [
    { matrix: [[1, 1], [1, 1]], color: '#38bdf8' },               // O (лазурный)
    { matrix: [[1, 1, 1, 1]], color: '#ec4899' },                 // I (розовый)
    { matrix: [[1, 1, 1], [0, 1, 0]], color: '#a855f7' },         // T (фиолетовый)
    { matrix: [[1, 1, 0], [0, 1, 1]], color: '#10b981' },         // Z (изумрудный)
    { matrix: [[0, 1], [0, 1], [1, 1]], color: '#f59e0b' },         // L (янтарный)
    { matrix: [[0, 1, 0], [1, 1, 1], [0, 1, 0]], color: '#06b6d4' }, // Крест
    { matrix: [[1, 1, 1], [1, 0, 0]], color: '#ef4444' }          // J (коралловый)
];

// Автономный фоновый холст Canvas (гарантированные 60 FPS на любом телефоне)
const SpaceCanvasBackground: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animId: number;
        let width = (canvas.width = window.innerWidth);
        let height = (canvas.height = window.innerHeight);

        const handleResize = () => {
            if (!canvas) return;
            width = canvas.width = window.innerWidth;
            height = canvas.height = window.innerHeight;
        };
        window.addEventListener('resize', handleResize);

        // 14 фигур, сразу распределенных по всей площади экрана
        const items = Array.from({ length: 14 }, (_, i) => {
            const shape = BG_SHAPES[i % BG_SHAPES.length];
            const cellSize = 22 + Math.floor(Math.random() * 8); // 22-30px
            return {
                shape,
                cellSize,
                x: Math.random() * width,
                y: Math.random() * height, // Сразу видны на экране при открытии!
                speedY: 0.5 + Math.random() * 0.7,
                speedX: (Math.random() - 0.5) * 0.25,
                rot: Math.random() * Math.PI * 2,
                rotSpeed: (Math.random() - 0.5) * 0.012,
                opacity: 0.45 + Math.random() * 0.25
            };
        });

        const drawRoundedRect = (x: number, y: number, s: number, r: number) => {
            ctx.beginPath();
            ctx.moveTo(x + r, y);
            ctx.lineTo(x + s - r, y);
            ctx.arcTo(x + s, y, x + s, y + s, r);
            ctx.lineTo(x + s, y + s - r);
            ctx.arcTo(x + s, y + s, x, y + s, r);
            ctx.lineTo(x + r, y + s);
            ctx.arcTo(x, y + s, x, y, r);
            ctx.lineTo(x, y + r);
            ctx.arcTo(x, y, x + s, y, r);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        };

        const render = () => {
            ctx.clearRect(0, 0, width, height);

            // Фоновые мягкие неоновые туманности (Ambient Glow)
            const grad1 = ctx.createRadialGradient(width * 0.2, height * 0.2, 10, width * 0.2, height * 0.2, 300);
            grad1.addColorStop(0, 'rgba(56, 189, 248, 0.20)');
            grad1.addColorStop(1, 'transparent');
            ctx.fillStyle = grad1;
            ctx.fillRect(0, 0, width, height);

            const grad2 = ctx.createRadialGradient(width * 0.8, height * 0.8, 10, width * 0.8, height * 0.8, 320);
            grad2.addColorStop(0, 'rgba(168, 85, 247, 0.18)');
            grad2.addColorStop(1, 'transparent');
            ctx.fillStyle = grad2;
            ctx.fillRect(0, 0, width, height);

            // Отрисовка парящих фигур
            items.forEach((item) => {
                item.y -= item.speedY;
                item.x += item.speedX;
                item.rot += item.rotSpeed;

                if (item.y < -120) {
                    item.y = height + 100;
                    item.x = Math.random() * width;
                }
                if (item.x < -80) item.x = width + 80;
                if (item.x > width + 80) item.x = -80;

                const { matrix, color } = item.shape;
                const s = item.cellSize;
                const gap = 3;
                const rows = matrix.length;
                const cols = matrix[0].length;
                const totalW = cols * s + (cols - 1) * gap;
                const totalH = rows * s + (rows - 1) * gap;

                ctx.save();
                ctx.translate(item.x, item.y);
                ctx.rotate(item.rot);
                ctx.globalAlpha = item.opacity;

                ctx.shadowColor = color;
                ctx.shadowBlur = 12;
                ctx.fillStyle = color;
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
                ctx.lineWidth = 1.5;

                const startX = -totalW / 2;
                const startY = -totalH / 2;

                for (let r = 0; r < rows; r++) {
                    for (let c = 0; c < cols; c++) {
                        if (matrix[r][c] === 1) {
                            const cellX = startX + c * (s + gap);
                            const cellY = startY + r * (s + gap);
                            drawRoundedRect(cellX, cellY, s, 5);
                        }
                    }
                }

                ctx.restore();
            });

            animId = requestAnimationFrame(render);
        };

        render();

        return () => {
            cancelAnimationFrame(animId);
            window.removeEventListener('resize', handleResize);
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                zIndex: 1
            }}
        />
    );
};

export const Lobby: React.FC<LobbyProps> = ({ room, myId, onStartGame }) => {
    const [name, setName] = useState(localStorage.getItem('gc_name') || '');
    const [code, setCode] = useState('');
    const [error, setError] = useState('');
    const [gridWidth, setGridWidth] = useState<number>(4);
    const [gridHeight, setGridHeight] = useState<number>(4);

    const handleCreateRoom = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) {
            setError('Введите имя');
            return;
        }
        setError('');
        localStorage.setItem('gc_name', name.trim());
        socket.emit('create_room', { playerName: name.trim() });
    };

    const handleJoinRoom = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) {
            setError('Введите имя');
            return;
        }
        if (code.length !== 4) {
            setError('Код должен состоять из 4 цифр');
            return;
        }
        setError('');
        localStorage.setItem('gc_name', name.trim());
        socket.emit('join_room', { code, playerName: name.trim() });
    };

    const setPreset = (size: number) => {
        setGridWidth(size);
        setGridHeight(size);
    };

    const changeWidth = (delta: number) => {
        setGridWidth((prev) => Math.max(3, Math.min(10, prev + delta)));
    };

    const changeHeight = (delta: number) => {
        setGridHeight((prev) => Math.max(3, Math.min(10, prev + delta)));
    };

    const playersList = Object.values(room?.players || {});
    const isHost = room?.players?.[myId]?.isHost;
    const totalCells = gridWidth * gridHeight;

    return (
        <div
            style={{
                position: 'relative',
                minHeight: '100vh',
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 16,
                boxSizing: 'border-box',
                overflow: 'hidden',
                background: 'radial-gradient(ellipse at 50% 25%, #1e1b4b 0%, #090d1a 60%, #030712 100%)'
            }}
        >
            <style>{`
        .primary-btn {
          transition: transform 0.15s ease, filter 0.15s ease;
        }
        .primary-btn:active {
          transform: scale(0.97);
        }
      `}</style>

            {/* 1. Безотказный Canvas-фон с фигурами */}
            <SpaceCanvasBackground />

            {/* 2. Карточка меню со стеклянным эффектом */}
            <div
                style={{
                    position: 'relative',
                    zIndex: 2,
                    background: 'rgba(15, 23, 42, 0.62)',
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)',
                    padding: room ? 20 : 28,
                    borderRadius: 24,
                    maxWidth: 390,
                    width: '100%',
                    boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5), 0 0 30px rgba(56, 189, 248, 0.15)',
                    border: '1px solid rgba(255, 255, 255, 0.14)'
                }}
            >
                {!room ? (
                    <div>
                        <div style={{ textAlign: 'center', marginBottom: 22 }}>
                            <h1
                                style={{
                                    fontSize: 34,
                                    fontWeight: 900,
                                    margin: '0 0 6px 0',
                                    letterSpacing: 2,
                                    background: 'linear-gradient(135deg, #38bdf8 0%, #818cf8 50%, #c084fc 100%)',
                                    WebkitBackgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent',
                                    filter: 'drop-shadow(0 2px 16px rgba(56, 189, 248, 0.5))'
                                }}
                            >
                                GRID CLASH
                            </h1>
                            <p style={{ margin: 0, color: '#94a3b8', fontSize: 13, fontWeight: 500 }}>
                                Собирай фигуры быстрее соперников 🧩
                            </p>
                        </div>

                        {error && (
                            <div
                                style={{
                                    background: 'rgba(239, 68, 68, 0.25)',
                                    color: '#fca5a5',
                                    padding: '9px 12px',
                                    borderRadius: 10,
                                    fontSize: 13,
                                    marginBottom: 16,
                                    textAlign: 'center',
                                    border: '1px solid rgba(239, 68, 68, 0.45)'
                                }}
                            >
                                {error}
                            </div>
                        )}

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <input
                                type="text"
                                placeholder="Ваш никнейм"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                maxLength={12}
                                style={{
                                    padding: 13,
                                    borderRadius: 12,
                                    border: '1px solid rgba(255, 255, 255, 0.15)',
                                    background: 'rgba(2, 6, 23, 0.7)',
                                    color: '#fff',
                                    fontSize: 16,
                                    outline: 'none',
                                    boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.4)'
                                }}
                            />

                            <button
                                type="button"
                                className="primary-btn"
                                onClick={handleCreateRoom}
                                style={{
                                    padding: 14,
                                    borderRadius: 12,
                                    background: 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)',
                                    color: '#fff',
                                    border: 'none',
                                    fontWeight: 800,
                                    fontSize: 15,
                                    cursor: 'pointer',
                                    boxShadow: '0 6px 22px rgba(2, 132, 199, 0.45)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 6
                                }}
                            >
                                <span>👑</span> Создать комнату
                            </button>

                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 10,
                                    margin: '4px 0',
                                    color: '#64748b',
                                    fontSize: 12,
                                    fontWeight: 600
                                }}
                            >
                                <div style={{ flex: 1, height: 1, background: 'rgba(255, 255, 255, 0.1)' }} />
                                <span>ИЛИ</span>
                                <div style={{ flex: 1, height: 1, background: 'rgba(255, 255, 255, 0.1)' }} />
                            </div>

                            <div style={{ display: 'flex', gap: 8 }}>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    maxLength={4}
                                    placeholder="4 цифры"
                                    value={code}
                                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                                    style={{
                                        width: '48%',
                                        padding: 12,
                                        borderRadius: 12,
                                        border: '1px solid rgba(255, 255, 255, 0.15)',
                                        background: 'rgba(2, 6, 23, 0.7)',
                                        color: '#fff',
                                        textAlign: 'center',
                                        fontSize: 20,
                                        fontWeight: 'bold',
                                        letterSpacing: 3,
                                        outline: 'none',
                                        boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.4)'
                                    }}
                                />
                                <button
                                    type="button"
                                    className="primary-btn"
                                    onClick={handleJoinRoom}
                                    style={{
                                        width: '52%',
                                        padding: 12,
                                        borderRadius: 12,
                                        background: 'rgba(51, 65, 85, 0.85)',
                                        color: '#f8fafc',
                                        border: '1px solid rgba(255, 255, 255, 0.14)',
                                        fontWeight: 700,
                                        fontSize: 14,
                                        cursor: 'pointer'
                                    }}
                                >
                                    Войти по коду
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div>
                        <div style={{ textAlign: 'center', marginBottom: 18 }}>
                            <span
                                style={{
                                    fontSize: 11,
                                    color: '#94a3b8',
                                    textTransform: 'uppercase',
                                    letterSpacing: 2,
                                    fontWeight: 700
                                }}
                            >
                                Код комнаты
                            </span>
                            <div
                                style={{
                                    fontSize: 38,
                                    fontWeight: 900,
                                    color: '#38bdf8',
                                    letterSpacing: 6,
                                    marginTop: 2,
                                    filter: 'drop-shadow(0 0 14px rgba(56, 189, 248, 0.6))'
                                }}
                            >
                                {room.code}
                            </div>
                        </div>

                        {isHost && (
                            <div
                                style={{
                                    marginBottom: 18,
                                    background: 'rgba(2, 6, 23, 0.6)',
                                    padding: 12,
                                    borderRadius: 14,
                                    border: '1px solid rgba(255, 255, 255, 0.08)'
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                    <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>Пресеты поля:</span>
                                    <span style={{ fontSize: 11, color: '#38bdf8', fontWeight: 700 }}>{totalCells} клеток</span>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 12 }}>
                                    {[3, 4, 5, 6].map((size) => {
                                        const isActive = gridWidth === size && gridHeight === size;
                                        return (
                                            <button
                                                key={size}
                                                type="button"
                                                onClick={() => setPreset(size)}
                                                style={{
                                                    padding: '7px 0',
                                                    borderRadius: 8,
                                                    border: isActive ? '2px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.08)',
                                                    background: isActive ? '#0284c7' : 'rgba(30, 41, 59, 0.7)',
                                                    color: '#fff',
                                                    fontWeight: 700,
                                                    fontSize: 12,
                                                    cursor: 'pointer',
                                                    boxShadow: isActive ? '0 0 12px rgba(56, 189, 248, 0.4)' : 'none'
                                                }}
                                            >
                                                {size}×{size}
                                            </button>
                                        );
                                    })}
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontSize: 13, color: '#e2e8f0' }}>Ширина:</span>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <button
                                                type="button"
                                                onClick={() => changeWidth(-1)}
                                                disabled={gridWidth <= 3}
                                                style={{
                                                    width: 28,
                                                    height: 28,
                                                    borderRadius: 6,
                                                    background: gridWidth <= 3 ? '#1e293b' : '#334155',
                                                    color: '#fff',
                                                    border: 'none',
                                                    fontSize: 16,
                                                    fontWeight: 700
                                                }}
                                            >
                                                −
                                            </button>
                                            <span style={{ minWidth: 20, textAlign: 'center', fontWeight: 800, fontSize: 14 }}>
                                                {gridWidth}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => changeWidth(1)}
                                                disabled={gridWidth >= 10}
                                                style={{
                                                    width: 28,
                                                    height: 28,
                                                    borderRadius: 6,
                                                    background: gridWidth >= 10 ? '#1e293b' : '#334155',
                                                    color: '#fff',
                                                    border: 'none',
                                                    fontSize: 16,
                                                    fontWeight: 700
                                                }}
                                            >
                                                +
                                            </button>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontSize: 13, color: '#e2e8f0' }}>Высота:</span>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <button
                                                type="button"
                                                onClick={() => changeHeight(-1)}
                                                disabled={gridHeight <= 3}
                                                style={{
                                                    width: 28,
                                                    height: 28,
                                                    borderRadius: 6,
                                                    background: gridHeight <= 3 ? '#1e293b' : '#334155',
                                                    color: '#fff',
                                                    border: 'none',
                                                    fontSize: 16,
                                                    fontWeight: 700
                                                }}
                                            >
                                                −
                                            </button>
                                            <span style={{ minWidth: 20, textAlign: 'center', fontWeight: 800, fontSize: 14 }}>
                                                {gridHeight}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => changeHeight(1)}
                                                disabled={gridHeight >= 10}
                                                style={{
                                                    width: 28,
                                                    height: 28,
                                                    borderRadius: 6,
                                                    background: gridHeight >= 10 ? '#1e293b' : '#334155',
                                                    color: '#fff',
                                                    border: 'none',
                                                    fontSize: 16,
                                                    fontWeight: 700
                                                }}
                                            >
                                                +
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div style={{ marginBottom: 20 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>
                                <span>Игроки в лобби:</span>
                                <span>{playersList.length} чел.</span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {playersList.map((p) => (
                                    <div
                                        key={p.id}
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            background: p.id === myId ? 'rgba(2, 6, 23, 0.7)' : 'rgba(30, 41, 59, 0.45)',
                                            padding: '9px 12px',
                                            borderRadius: 10,
                                            border: p.id === myId ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid rgba(255, 255, 255, 0.06)'
                                        }}
                                    >
                                        <span style={{ fontWeight: 600, fontSize: 14 }}>
                                            {p.name} {p.isHost ? '👑' : ''} {p.id === myId ? '(Вы)' : ''}
                                        </span>
                                        <span style={{ color: '#38bdf8', fontSize: 13, fontWeight: 700 }}>
                                            {p.score || 0} побед
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {isHost ? (
                            <button
                                type="button"
                                className="primary-btn"
                                onClick={() => onStartGame(gridWidth, gridHeight)}
                                style={{
                                    width: '100%',
                                    padding: 14,
                                    borderRadius: 12,
                                    background: 'linear-gradient(135deg, #e11d48 0%, #be123c 100%)',
                                    color: '#fff',
                                    border: 'none',
                                    fontWeight: 800,
                                    fontSize: 16,
                                    cursor: 'pointer',
                                    boxShadow: '0 6px 22px rgba(225, 29, 72, 0.5)'
                                }}
                            >
                                🚀 Начать игру ({gridWidth}×{gridHeight})
                            </button>
                        ) : (
                            <div
                                style={{
                                    textAlign: 'center',
                                    color: '#94a3b8',
                                    fontStyle: 'italic',
                                    fontSize: 13,
                                    padding: 8
                                }}
                            >
                                ⏳ Ожидаем, пока создатель запустит игру...
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};