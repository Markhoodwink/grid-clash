import React, { useState } from 'react';
import { socket } from '../socket';

interface Player {
    id: string;
    name: string;
    isHost: boolean;
    score?: number;
}

interface Room {
    code: string;
    players: Record<string, Player>;
    status: string;
}

interface LobbyProps {
    room: Room | null;
    myId: string;
    onStartGame: (width: number, height: number) => void;
}

export const Lobby: React.FC<LobbyProps> = ({ room, myId, onStartGame }) => {
    const [name, setName] = useState('');
    const [code, setCode] = useState('');
    const [copied, setCopied] = useState(false);

    // Выбор размера поля
    const [mode, setMode] = useState<'4x4' | '5x5' | '6x6' | 'custom'>('4x4');
    const [customWidth, setCustomWidth] = useState(5);
    const [customHeight, setCustomHeight] = useState(4);

    const handleCreate = () => {
        if (!name.trim()) return alert('Введите имя');
        socket.emit('create_room', { name });
    };

    const handleJoin = () => {
        if (!name.trim()) return alert('Введите имя');
        if (!code.trim()) return alert('Введите код комнаты');
        socket.emit('join_room', { code: code.toUpperCase(), name });
    };

    const handleCopyLink = () => {
        const url = `${window.location.origin}?room=${room?.code}`;
        navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleStart = () => {
        let w = 4;
        let h = 4;
        if (mode === '5x5') { w = 5; h = 5; }
        else if (mode === '6x6') { w = 6; h = 6; }
        else if (mode === 'custom') { w = customWidth; h = customHeight; }

        onStartGame(w, h);
    };

    // 1. Форма входа
    if (!room) {
        return (
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 16,
                    padding: 24,
                    maxWidth: 360,
                    margin: '60px auto',
                    boxSizing: 'border-box'
                }}
            >
                <h1 style={{ textAlign: 'center', fontSize: 32, fontWeight: 900, color: '#38bdf8' }}>
                    Grid Clash
                </h1>

                <input
                    type="text"
                    placeholder="Твой никнейм"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={12}
                    style={{
                        padding: 14,
                        borderRadius: 10,
                        border: '1px solid #334155',
                        background: '#1e293b',
                        color: '#fff',
                        fontSize: 16,
                        outline: 'none'
                    }}
                />

                <button
                    onClick={handleCreate}
                    style={{
                        padding: 14,
                        borderRadius: 10,
                        background: '#2563eb',
                        color: '#fff',
                        border: 'none',
                        fontWeight: 'bold',
                        fontSize: 16,
                        cursor: 'pointer'
                    }}
                >
                    Создать комнату
                </button>

                <div style={{ textAlign: 'center', color: '#64748b', fontSize: 14 }}>— ИЛИ —</div>

                <input
                    type="text"
                    placeholder="4-значный код"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    maxLength={4}
                    style={{
                        padding: 14,
                        borderRadius: 10,
                        border: '1px solid #334155',
                        background: '#1e293b',
                        color: '#fff',
                        textAlign: 'center',
                        fontSize: 20,
                        letterSpacing: 4,
                        outline: 'none'
                    }}
                />

                <button
                    onClick={handleJoin}
                    style={{
                        padding: 14,
                        borderRadius: 10,
                        background: '#059669',
                        color: '#fff',
                        border: 'none',
                        fontWeight: 'bold',
                        fontSize: 16,
                        cursor: 'pointer'
                    }}
                >
                    Войти по коду
                </button>
            </div>
        );
    }

    const isHost = room.players[myId]?.isHost;
    const playerList = Object.values(room.players).sort((a, b) => (b.score || 0) - (a.score || 0));

    // 2. Экран лобби ожидания
    return (
        <div
            style={{
                padding: 20,
                maxWidth: 420,
                margin: '20px auto',
                textAlign: 'center',
                boxSizing: 'border-box'
            }}
        >
            <p style={{ color: '#94a3b8', fontSize: 13 }}>Код для подключения:</p>
            <h2 style={{ fontSize: 44, letterSpacing: 6, color: '#38bdf8', margin: '4px 0 12px' }}>
                {room.code}
            </h2>

            <button
                onClick={handleCopyLink}
                style={{
                    padding: '8px 16px',
                    borderRadius: 8,
                    background: copied ? '#059669' : '#1e293b',
                    color: copied ? '#fff' : '#94a3b8',
                    border: '1px solid #334155',
                    fontSize: 13,
                    cursor: 'pointer',
                    marginBottom: 20,
                    transition: 'all 0.2s ease'
                }}
            >
                {copied ? '✓ Ссылка скопирована!' : '🔗 Скопировать ссылку для друзей'}
            </button>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <h3 style={{ fontSize: 15, color: '#cbd5e1' }}>Игроки в комнате ({playerList.length}):</h3>
                <span style={{ fontSize: 12, color: '#64748b' }}>Вход открыт</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
                {playerList.map((p, idx) => (
                    <div
                        key={p.id}
                        style={{
                            padding: '10px 12px',
                            borderRadius: 8,
                            background: '#1e293b',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            border: '1px solid #334155'
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ color: '#64748b', fontSize: 13 }}>#{idx + 1}</span>
                            <span style={{ fontWeight: 600 }}>
                                {p.name} {p.id === myId ? '(Вы)' : ''}
                            </span>
                            {p.isHost && (
                                <span
                                    style={{
                                        color: '#f59e0b',
                                        fontSize: 10,
                                        fontWeight: 'bold',
                                        background: 'rgba(245, 158, 11, 0.15)',
                                        padding: '2px 6px',
                                        borderRadius: 4
                                    }}
                                >
                                    ХОСТ
                                </span>
                            )}
                        </div>
                        <div style={{ fontWeight: 'bold', color: '#38bdf8', fontSize: 14 }}>
                            {p.score || 0}{' '}
                            <span style={{ fontSize: 11, color: '#64748b' }}>
                                {(p.score || 0) === 1 ? 'победа' : (p.score || 0) >= 2 && (p.score || 0) <= 4 ? 'победы' : 'побед'}
                            </span>
                        </div>
                    </div>
                ))}
            </div>

            {isHost ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ textAlign: 'left' }}>
                        <label style={{ fontSize: 13, color: '#94a3b8', marginBottom: 6, display: 'block' }}>
                            Размер поля для следующего раунда:
                        </label>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                            {[
                                { id: '4x4', label: '4×4' },
                                { id: '5x5', label: '5×5' },
                                { id: '6x6', label: '6×6' },
                                { id: 'custom', label: 'Свой' }
                            ].map((b) => (
                                <button
                                    key={b.id}
                                    type="button"
                                    onClick={() => setMode(b.id as any)}
                                    style={{
                                        padding: '8px 4px',
                                        borderRadius: 8,
                                        border: mode === b.id ? '2px solid #38bdf8' : '1px solid #334155',
                                        background: mode === b.id ? '#1e293b' : '#0f172a',
                                        color: '#fff',
                                        fontWeight: 'bold',
                                        fontSize: 13,
                                        cursor: 'pointer'
                                    }}
                                >
                                    {b.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {mode === 'custom' && (
                        <div
                            style={{
                                background: '#1e293b',
                                padding: 12,
                                borderRadius: 10,
                                border: '1px solid #334155',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 10
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: 13, color: '#cbd5e1' }}>Ширина (колонок):</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <button
                                        onClick={() => setCustomWidth(Math.max(3, customWidth - 1))}
                                        style={{ width: 30, height: 30, borderRadius: 6, background: '#334155', color: '#fff', border: 'none', fontSize: 16, cursor: 'pointer' }}
                                    >
                                        -
                                    </button>
                                    <span style={{ fontSize: 16, fontWeight: 900, minWidth: 20, textAlign: 'center' }}>
                                        {customWidth}
                                    </span>
                                    <button
                                        onClick={() => setCustomWidth(Math.min(9, customWidth + 1))}
                                        style={{ width: 30, height: 30, borderRadius: 6, background: '#334155', color: '#fff', border: 'none', fontSize: 16, cursor: 'pointer' }}
                                    >
                                        +
                                    </button>
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: 13, color: '#cbd5e1' }}>Высота (строк):</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <button
                                        onClick={() => setCustomHeight(Math.max(3, customHeight - 1))}
                                        style={{ width: 30, height: 30, borderRadius: 6, background: '#334155', color: '#fff', border: 'none', fontSize: 16, cursor: 'pointer' }}
                                    >
                                        -
                                    </button>
                                    <span style={{ fontSize: 16, fontWeight: 900, minWidth: 20, textAlign: 'center' }}>
                                        {customHeight}
                                    </span>
                                    <button
                                        onClick={() => setCustomHeight(Math.min(9, customHeight + 1))}
                                        style={{ width: 30, height: 30, borderRadius: 6, background: '#334155', color: '#fff', border: 'none', fontSize: 16, cursor: 'pointer' }}
                                    >
                                        +
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    <button
                        onClick={handleStart}
                        style={{
                            width: '100%',
                            padding: 15,
                            borderRadius: 12,
                            background: '#e11d48',
                            color: '#fff',
                            border: 'none',
                            fontWeight: 'bold',
                            fontSize: 17,
                            cursor: 'pointer'
                        }}
                    >
                        Начать битву!
                    </button>
                </div>
            ) : (
                <p style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: 14, marginTop: 12 }}>
                    Ждем, пока создатель настроит раунд и запустит игру...
                </p>
            )}
        </div>
    );
};