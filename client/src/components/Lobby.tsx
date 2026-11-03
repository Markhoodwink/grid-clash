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

    // ЭКРАН 1: ВХОД / СОЗДАНИЕ
    if (!room) {
        return (
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: '100vh',
                    padding: 20
                }}
            >
                <div
                    style={{
                        background: '#1e293b',
                        padding: 30,
                        borderRadius: 20,
                        maxWidth: 360,
                        width: '100%',
                        boxShadow: '0 10px 25px rgba(0,0,0,0.4)',
                        border: '1px solid #334155'
                    }}
                >
                    <h1
                        style={{
                            fontSize: 28,
                            fontWeight: 900,
                            textAlign: 'center',
                            marginBottom: 4,
                            color: '#38bdf8',
                            letterSpacing: 1
                        }}
                    >
                        GRID CLASH
                    </h1>
                    <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: 13, marginBottom: 20 }}>
                        Собирай фигуры быстрее соперников
                    </p>

                    {error && (
                        <div
                            style={{
                                background: 'rgba(239, 68, 68, 0.2)',
                                color: '#f87171',
                                padding: '8px 12px',
                                borderRadius: 8,
                                fontSize: 13,
                                marginBottom: 16,
                                textAlign: 'center',
                                border: '1px solid rgba(239, 68, 68, 0.4)'
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
                                padding: 12,
                                borderRadius: 10,
                                border: '1px solid #334155',
                                background: '#0f172a',
                                color: '#fff',
                                fontSize: 16,
                                outline: 'none'
                            }}
                        />

                        <button
                            type="button"
                            onClick={handleCreateRoom}
                            style={{
                                padding: 13,
                                borderRadius: 10,
                                background: '#0284c7',
                                color: '#fff',
                                border: 'none',
                                fontWeight: 700,
                                fontSize: 15,
                                cursor: 'pointer'
                            }}
                        >
                            👑 Создать комнату
                        </button>

                        <div style={{ textAlign: 'center', color: '#64748b', fontSize: 13 }}>— ИЛИ —</div>

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
                                    width: '50%',
                                    padding: 12,
                                    borderRadius: 10,
                                    border: '1px solid #334155',
                                    background: '#0f172a',
                                    color: '#fff',
                                    textAlign: 'center',
                                    fontSize: 18,
                                    fontWeight: 'bold',
                                    letterSpacing: 2,
                                    outline: 'none'
                                }}
                            />
                            <button
                                type="button"
                                onClick={handleJoinRoom}
                                style={{
                                    width: '50%',
                                    padding: 12,
                                    borderRadius: 10,
                                    background: '#334155',
                                    color: '#fff',
                                    border: 'none',
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
            </div>
        );
    }

    // ЭКРАН 2: ЛОББИ ОЖИДАНИЯ
    const playersList = Object.values(room.players || {});
    const isHost = room.players?.[myId]?.isHost;
    const totalCells = gridWidth * gridHeight;

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '100vh',
                padding: 20
            }}
        >
            <div
                style={{
                    background: '#1e293b',
                    padding: 24,
                    borderRadius: 20,
                    maxWidth: 380,
                    width: '100%',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.4)',
                    border: '1px solid #334155'
                }}
            >
                <div style={{ textAlign: 'center', marginBottom: 16 }}>
                    <span style={{ fontSize: 12, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1 }}>
                        Код комнаты
                    </span>
                    <div
                        style={{
                            fontSize: 34,
                            fontWeight: 900,
                            color: '#38bdf8',
                            letterSpacing: 4,
                            marginTop: 2
                        }}
                    >
                        {room.code}
                    </div>
                </div>

                {/* Настройка размера поля для создателя комнаты */}
                {isHost && (
                    <div
                        style={{
                            marginBottom: 18,
                            background: '#0f172a',
                            padding: 12,
                            borderRadius: 12,
                            border: '1px solid #334155'
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>Быстрые пресеты:</span>
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
                                            border: isActive ? '2px solid #38bdf8' : '1px solid #334155',
                                            background: isActive ? '#0369a1' : '#1e293b',
                                            color: '#fff',
                                            fontWeight: 700,
                                            fontSize: 12,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {size}×{size}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Тонкая настройка ширины и высоты (3 - 10) */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {/* Ширина */}
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

                            {/* Высота */}
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

                {/* Список игроков */}
                <div style={{ marginBottom: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>
                        <span>Игроки в комнате:</span>
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
                                    background: p.id === myId ? '#0f172a' : '#182234',
                                    padding: '9px 12px',
                                    borderRadius: 10,
                                    border: '1px solid #334155'
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
                        onClick={() => onStartGame(gridWidth, gridHeight)}
                        style={{
                            width: '100%',
                            padding: 14,
                            borderRadius: 12,
                            background: '#e11d48',
                            color: '#fff',
                            border: 'none',
                            fontWeight: 800,
                            fontSize: 16,
                            cursor: 'pointer',
                            boxShadow: '0 4px 15px rgba(225, 29, 72, 0.4)'
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
        </div>
    );
};