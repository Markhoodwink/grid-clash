import React, { useState } from 'react';
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

// Формы фигур для летающего фона
const BG_SHAPES = [
    { matrix: [[1, 1], [1, 1]], color: '#38bdf8' },               // O (голубой)
    { matrix: [[1, 1, 1, 1]], color: '#ec4899' },                 // I (розовый)
    { matrix: [[1, 1, 1], [0, 1, 0]], color: '#a855f7' },         // T (фиолетовый)
    { matrix: [[1, 1, 0], [0, 1, 1]], color: '#10b981' },         // Z (изумрудный)
    { matrix: [[0, 1], [0, 1], [1, 1]], color: '#f59e0b' },         // L (янтарный)
    { matrix: [[0, 1, 0], [1, 1, 1], [0, 1, 0]], color: '#06b6d4' }, // Клик / Плюс
    { matrix: [[1, 1, 1], [1, 0, 0]], color: '#ef4444' }          // J (коралловый)
];

// 12 фигур, равномерно парящих по всей ширине и высоте экрана
const FLOATING_ITEMS = [
    { shapeIdx: 0, left: 4, size: 32, dur: 22, delay: -3, rot: 180, opacity: 0.55 },
    { shapeIdx: 1, left: 16, size: 28, dur: 26, delay: -15, rot: 360, opacity: 0.50 },
    { shapeIdx: 2, left: 28, size: 30, dur: 20, delay: -8, rot: -240, opacity: 0.60 },
    { shapeIdx: 3, left: 42, size: 26, dur: 24, delay: -18, rot: 270, opacity: 0.48 },
    { shapeIdx: 4, left: 52, size: 34, dur: 23, delay: -5, rot: -180, opacity: 0.52 },
    { shapeIdx: 5, left: 63, size: 28, dur: 28, delay: -12, rot: 360, opacity: 0.50 },
    { shapeIdx: 6, left: 74, size: 32, dur: 21, delay: -2, rot: -300, opacity: 0.58 },
    { shapeIdx: 1, left: 84, size: 30, dur: 27, delay: -16, rot: 240, opacity: 0.52 },
    { shapeIdx: 0, left: 93, size: 34, dur: 19, delay: -9, rot: -270, opacity: 0.60 },
    { shapeIdx: 2, left: 10, size: 28, dur: 25, delay: -21, rot: 180, opacity: 0.48 },
    { shapeIdx: 4, left: 48, size: 30, dur: 22, delay: -14, rot: 320, opacity: 0.50 },
    { shapeIdx: 3, left: 88, size: 32, dur: 24, delay: -6, rot: -190, opacity: 0.54 }
];

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
                padding: 20,
                boxSizing: 'border-box',
                overflow: 'hidden',
                background: 'radial-gradient(ellipse at 50% 25%, #1e1b4b 0%, #090d1a 60%, #030712 100%)'
            }}
        >
            <style>{`
        /* Полный сквозной полет снизу до самого верха экрана */
        @keyframes fullScreenFloat {
          0% {
            transform: translateY(108vh) rotate(0deg);
          }
          100% {
            transform: translateY(-25vh) rotate(var(--item-rot, 360deg));
          }
        }

        @keyframes ambientPulse {
          0%, 100% { transform: scale(1); opacity: 0.35; }
          50% { transform: scale(1.2); opacity: 0.6; }
        }

        .primary-btn {
          transition: transform 0.15s ease, filter 0.15s ease, box-shadow 0.15s ease;
        }
        .primary-btn:hover {
          transform: translateY(-1px);
          filter: brightness(1.1);
        }
        .primary-btn:active {
          transform: scale(0.97);
        }
      `}</style>

            {/* 1. Объемное фоновое свечение */}
            <div
                style={{
                    position: 'fixed',
                    top: '10%',
                    left: '15%',
                    width: 400,
                    height: 400,
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(56, 189, 248, 0.22) 0%, transparent 70%)',
                    filter: 'blur(70px)',
                    pointerEvents: 'none',
                    animation: 'ambientPulse 8s ease-in-out infinite'
                }}
            />
            <div
                style={{
                    position: 'fixed',
                    bottom: '10%',
                    right: '10%',
                    width: 440,
                    height: 440,
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(168, 85, 247, 0.2) 0%, transparent 70%)',
                    filter: 'blur(80px)',
                    pointerEvents: 'none',
                    animation: 'ambientPulse 11s ease-in-out infinite reverse'
                }}
            />

            {/* 2. Летающие фигуры на весь экран */}
            <div
                style={{
                    position: 'fixed',
                    inset: 0,
                    pointerEvents: 'none',
                    overflow: 'hidden',
                    zIndex: 1
                }}
            >
                {FLOATING_ITEMS.map((item, idx) => {
                    const shape = BG_SHAPES[item.shapeIdx];
                    const cellSize = item.size;
                    const gap = 3;

                    return (
                        <div
                            key={idx}
                            style={{
                                position: 'absolute',
                                left: `${item.left}%`,
                                top: 0,
                                opacity: item.opacity,
                                // @ts-ignore
                                '--item-rot': `${item.rot}deg`,
                                animation: `fullScreenFloat ${item.dur}s linear infinite`,
                                animationDelay: `${item.delay}s`,
                                display: 'grid',
                                gridTemplateColumns: `repeat(${shape.matrix[0].length}, ${cellSize}px)`,
                                gap: `${gap}px`,
                                filter: `drop-shadow(0 0 16px ${shape.color})`
                            }}
                        >
                            {shape.matrix.map((row, r) =>
                                row.map((val, c) => (
                                    <div
                                        key={`${r}-${c}`}
                                        style={{
                                            width: cellSize,
                                            height: cellSize,
                                            borderRadius: 6,
                                            background: val ? shape.color : 'transparent',
                                            boxShadow: val
                                                ? `0 0 12px ${shape.color}aa, inset 0 0 8px rgba(255,255,255,0.45)`
                                                : 'none',
                                            border: val ? '1px solid rgba(255,255,255,0.3)' : 'none'
                                        }}
                                    />
                                ))
                            )}
                        </div>
                    );
                })}
            </div>

            {/* 3. Карточка лобби (полупрозрачное матовое стекло) */}
            <div
                style={{
                    position: 'relative',
                    zIndex: 2,
                    background: 'rgba(15, 23, 42, 0.62)',
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)',
                    padding: room ? 24 : 32,
                    borderRadius: 24,
                    maxWidth: 390,
                    width: '100%',
                    boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5), 0 0 30px rgba(56, 189, 248, 0.15)',
                    border: '1px solid rgba(255, 255, 255, 0.14)'
                }}
            >
                {!room ? (
                    /* ЭКРАН 1: ВХОД / СОЗДАНИЕ */
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
                                    border: '1px solid rgba(239, 68, 68, 0.45)',
                                    backdropFilter: 'blur(10px)'
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
                                    boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.4)',
                                    transition: 'border 0.2s ease'
                                }}
                                onFocus={(e) => (e.target.style.borderColor = '#38bdf8')}
                                onBlur={(e) => (e.target.style.borderColor = 'rgba(255, 255, 255, 0.15)')}
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
                                    onFocus={(e) => (e.target.style.borderColor = '#38bdf8')}
                                    onBlur={(e) => (e.target.style.borderColor = 'rgba(255, 255, 255, 0.15)')}
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
                    /* ЭКРАН 2: ЛОББИ ОЖИДАНИЯ */
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

                        {/* Настройки поля */}
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
                                                    boxShadow: isActive ? '0 0 12px rgba(56, 189, 248, 0.4)' : 'none',
                                                    transition: 'all 0.15s ease'
                                                }}
                                            >
                                                {size}×{size}
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Точные размеры */}
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
                                                    fontWeight: 700,
                                                    cursor: gridWidth <= 3 ? 'not-allowed' : 'pointer'
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
                                                    fontWeight: 700,
                                                    cursor: gridWidth >= 10 ? 'not-allowed' : 'pointer'
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
                                                    fontWeight: 700,
                                                    cursor: gridHeight <= 3 ? 'not-allowed' : 'pointer'
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
                                                    fontWeight: 700,
                                                    cursor: gridHeight >= 10 ? 'not-allowed' : 'pointer'
                                                }}
                                            >
                                                +
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Игроки */}
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

                        {/* Кнопка запуска */}
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