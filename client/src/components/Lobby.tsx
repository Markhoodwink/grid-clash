import React, { useState, useEffect, useRef } from 'react';
import { socket } from '../socket';
import { SpaceCanvasBackground } from './SpaceCanvasBackground';

interface Player {
    id: string;
    name: string;
    score: number;
    avatarUrl?: string | null;
    isHost?: boolean;
}

interface Room {
    code: string;
    status: string;
    players: Record<string, Player>;
    settings?: {
        width: number;
        height: number;
        noEvents: boolean;
    };
}

interface LobbyProps {
    room: Room | null;
    myId: string;
    onStartGame: (width: number, height: number, noEvents?: boolean) => void;
    onLeaveRoom: () => void;
}

export const Lobby: React.FC<LobbyProps> = ({ room, myId, onStartGame, onLeaveRoom }) => {
    const tgUser = (window as any).Telegram?.WebApp?.initDataUnsafe?.user;

    const [name, setName] = useState(() => {
        if (tgUser?.first_name) {
            const fullName = [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ');
            return fullName.slice(0, 12);
        }
        return localStorage.getItem('gc_name') || '';
    });

    const [avatarUrl] = useState<string>(() => tgUser?.photo_url || '');
    const [noEvents, setNoEvents] = useState<boolean>(() => Boolean(room?.settings?.noEvents));
    const [code, setCode] = useState('');
    const [error, setError] = useState('');
    const [gridWidth, setGridWidth] = useState<number>(() => room?.settings?.width || 4);
    const [gridHeight, setGridHeight] = useState<number>(() => room?.settings?.height || 4);
    const [showGuide, setShowGuide] = useState<boolean>(false);
    const [copiedInvite, setCopiedInvite] = useState(false);

    const hasAutoJoinedRef = useRef(false);
    const playersList = Object.values(room?.players || {});
    const isHost = room?.players?.[myId]?.isHost;
    const totalCells = gridWidth * gridHeight;
    const [isConnected, setIsConnected] = useState(() => socket.connected);

    useEffect(() => {
        const tg = (window as any).Telegram?.WebApp;
        if (tg) {
            tg.ready();
            tg.expand();
            tg.setHeaderColor?.('#090d1a');
            tg.setBackgroundColor?.('#090d1a');

            // Автоматический вход по реферальной инвайт-ссылке (startapp=1234)
            const startParam = tg.initDataUnsafe?.start_param;
            if (startParam && /^\d{4}$/.test(startParam) && !hasAutoJoinedRef.current && !room) {
                hasAutoJoinedRef.current = true;
                const uid = localStorage.getItem('gc_user_id') || '';
                const playerName = name.trim() || tgUser?.first_name || 'Игрок';
                localStorage.setItem('gc_name', playerName);
                socket.emit('join_room', { code: startParam, playerName, userId: uid, avatarUrl });
            }
        }

        // 👇 Добавьте сюда: подхват кода из ссылки обычного браузера (?room=1234)
        const params = new URLSearchParams(window.location.search);
        const roomParam = params.get('room');
        if (roomParam && /^\d{4}$/.test(roomParam)) {
            setCode(roomParam);
        }
    }, [name, avatarUrl, room]);

    useEffect(() => {
        if (room?.settings) {
            setGridWidth(room.settings.width || 4);
            setGridHeight(room.settings.height || 4);
            setNoEvents(Boolean(room.settings.noEvents));
        }
    }, [room?.settings]);

    useEffect(() => {
        const handleSettingsUpdated = ({ width, height, noEvents: incomingNoEvents }: { width: number; height: number; noEvents: boolean }) => {
            setGridWidth(width);
            setGridHeight(height);
            setNoEvents(incomingNoEvents);
        };

        socket.on('room_settings_updated', handleSettingsUpdated);
        return () => {
            socket.off('room_settings_updated', handleSettingsUpdated);
        };
    }, []);

    useEffect(() => {
        const onConnect = () => setIsConnected(true);
        const onDisconnect = () => setIsConnected(false);

        socket.on('connect', onConnect);
        socket.on('disconnect', onDisconnect);

        return () => {
            socket.off('connect', onConnect);
            socket.off('disconnect', onDisconnect);
        };
    }, []);

    const emitSettings = (w: number, h: number, ne: boolean) => {
        if (isHost && room?.code) {
            socket.emit('update_room_settings', {
                code: room.code,
                width: w,
                height: h,
                noEvents: ne
            });
        }
    };

    const handleCreateRoom = (e: React.FormEvent) => {
        e.preventDefault();

        alert(`Клик! Сокет онлайн: ${socket.connected} | ID: ${socket.id || 'нет'}`);

        if (!socket.connected) {
            alert('❌ Нет соединения с сервером Socket.io! (сокет оффлайн)');
            return;
        }

        if (!name.trim()) {
            setError('Введите имя');
            return;
        }
        setError('');
        const uid = localStorage.getItem('gc_user_id') || '';
        localStorage.setItem('gc_name', name.trim());
        socket.emit('create_room', { playerName: name.trim(), userId: uid, avatarUrl });
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
        const uid = localStorage.getItem('gc_user_id') || '';
        localStorage.setItem('gc_name', name.trim());
        socket.emit('join_room', { code, playerName: name.trim(), userId: uid, avatarUrl });
    };

    // Нативный шеринг инвайта через Telegram
    // Проверяем, запущены ли мы РЕАЛЬНО внутри Telegram-клиента
    const isInsideTelegram = Boolean((window as any).Telegram?.WebApp?.initData);

    const handleShareInvite = () => {
        if (!room?.code) return;

        if (isInsideTelegram) {
            // Внутри Telegram: делимся через бота
            const inviteUrl = `https://t.me/grid_clash_battle_bot/game?startapp=${room.code}`;
            const text = encodeURIComponent(`Залетай в битву Grid Clash! 🧩 Код комнаты: ${room.code}`);
            (window as any).Telegram?.WebApp?.openTelegramLink(`https://t.me/share/url?url=${inviteUrl}&text=${text}`);
        } else {
            // В обычном браузере: копируем прямую ссылку на сайт
            const webUrl = `${window.location.origin}?room=${room.code}`;
            navigator.clipboard?.writeText(webUrl).then(() => {
                setCopiedInvite(true);
                setTimeout(() => setCopiedInvite(false), 2000);
            }).catch(() => {
                const input = document.createElement('input');
                input.value = webUrl;
                document.body.appendChild(input);
                input.select();
                document.execCommand('copy');
                document.body.removeChild(input);
                setCopiedInvite(true);
                setTimeout(() => setCopiedInvite(false), 2000);
            });
        }
    };

    const handleSetNoEvents = (val: boolean) => {
        setNoEvents(val);
        emitSettings(gridWidth, gridHeight, val);
    };

    const handleSetPreset = (size: number) => {
        setGridWidth(size);
        setGridHeight(size);
        emitSettings(size, size, noEvents);
    };

    const handleChangeWidth = (delta: number) => {
        const newW = Math.max(3, Math.min(10, gridWidth + delta));
        setGridWidth(newW);
        emitSettings(newW, gridHeight, noEvents);
    };

    const handleChangeHeight = (delta: number) => {
        const newH = Math.max(3, Math.min(10, gridHeight + delta));
        setGridHeight(newH);
        emitSettings(gridWidth, newH, noEvents);
    };

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
        .guide-btn:active {
          transform: scale(0.95);
        }
      `}</style>

            <SpaceCanvasBackground />

            <div
                style={{
                    position: 'fixed',
                    top: 'max(14px, env(safe-area-inset-top, 14px))',
                    right: 16,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    zIndex: 999
                }}
            >
                <span
                    style={{
                        fontSize: 11,
                        fontWeight: 800,
                        color: '#38bdf8',
                        background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.9), rgba(30, 58, 138, 0.8))',
                        padding: '5px 10px',
                        borderRadius: 10,
                        border: '1px solid rgba(56, 189, 248, 0.5)',
                        letterSpacing: 0.8,
                        boxShadow: '0 4px 15px rgba(56, 189, 248, 0.25), inset 0 1px 1px rgba(255, 255, 255, 0.2)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4
                    }}
                >
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#38bdf8', boxShadow: '0 0 8px #38bdf8', display: 'inline-block' }}></span>
                    v3.3 ⚡
                </span>

                <button
                    type="button"
                    className="guide-btn"
                    onClick={() => setShowGuide(true)}
                    style={{
                        background: 'rgba(30, 41, 59, 0.85)',
                        border: '1px solid rgba(255, 255, 255, 0.18)',
                        color: '#cbd5e1',
                        borderRadius: 10,
                        padding: '5px 10px',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        boxShadow: '0 2px 10px rgba(0,0,0,0.4)'
                    }}
                >
                    <span>📖</span> Гайд
                </button>
            </div>

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
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                {avatarUrl && (
                                    <img
                                        src={avatarUrl}
                                        alt=""
                                        style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', border: '2px solid #38bdf8' }}
                                    />
                                )}
                                <input
                                    type="text"
                                    placeholder="Ваш никнейм"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    maxLength={12}
                                    style={{
                                        flex: 1,
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
                            </div>

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
                        <div style={{ textAlign: 'center', marginBottom: 14 }}>
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

                            {/* Кнопка "Позвать друга" */}
                            <button
                                type="button"
                                className="primary-btn"
                                onClick={handleShareInvite}
                                style={{
                                    marginTop: 10,
                                    background: 'rgba(56, 189, 248, 0.16)',
                                    border: '1px solid #38bdf8',
                                    color: '#38bdf8',
                                    padding: '7px 16px',
                                    borderRadius: 10,
                                    fontSize: 13,
                                    fontWeight: 800,
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 6
                                }}
                            >
                                <span>📢</span> {copiedInvite ? 'Ссылка скопирована!' : isInsideTelegram ? 'Позвать друга' : 'Скопировать ссылку'}
                            </button>
                        </div>

                        {isHost ? (
                            <div
                                style={{
                                    marginBottom: 16,
                                    background: 'rgba(2, 6, 23, 0.6)',
                                    padding: 12,
                                    borderRadius: 14,
                                    border: '1px solid rgba(255, 255, 255, 0.08)'
                                }}
                            >
                                <div style={{ marginBottom: 12 }}>
                                    <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, marginBottom: 6 }}>
                                        Режим раунда:
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                                        <button
                                            type="button"
                                            onClick={() => handleSetNoEvents(false)}
                                            style={{
                                                padding: '8px 10px',
                                                borderRadius: 8,
                                                border: !noEvents ? '2px solid #ec4899' : '1px solid rgba(255, 255, 255, 0.08)',
                                                background: !noEvents ? 'rgba(236, 72, 153, 0.25)' : 'rgba(30, 41, 59, 0.7)',
                                                color: !noEvents ? '#f472b6' : '#94a3b8',
                                                fontWeight: 700,
                                                fontSize: 12,
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: 6,
                                                boxShadow: !noEvents ? '0 0 12px rgba(236, 72, 153, 0.35)' : 'none'
                                            }}
                                        >
                                            <span>🌪️</span> Хаос
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => handleSetNoEvents(true)}
                                            style={{
                                                padding: '8px 10px',
                                                borderRadius: 8,
                                                border: noEvents ? '2px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.08)',
                                                background: noEvents ? 'rgba(56, 189, 248, 0.25)' : 'rgba(30, 41, 59, 0.7)',
                                                color: noEvents ? '#38bdf8' : '#94a3b8',
                                                fontWeight: 700,
                                                fontSize: 12,
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: 6,
                                                boxShadow: noEvents ? '0 0 12px rgba(56, 189, 248, 0.35)' : 'none'
                                            }}
                                        >
                                            <span>🧘</span> Без ивентов
                                        </button>
                                    </div>
                                </div>

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
                                                onClick={() => handleSetPreset(size)}
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
                                                onClick={() => handleChangeWidth(-1)}
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
                                                onClick={() => handleChangeWidth(1)}
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
                                                onClick={() => handleChangeHeight(-1)}
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
                                                onClick={() => handleChangeHeight(1)}
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
                        ) : (
                            <div
                                style={{
                                    marginBottom: 16,
                                    background: 'rgba(2, 6, 23, 0.6)',
                                    padding: '14px 16px',
                                    borderRadius: 14,
                                    border: '1px solid rgba(255, 255, 255, 0.08)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 10
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>Выбор создателя:</span>
                                    <span style={{ fontSize: 11, color: '#38bdf8', fontWeight: 700 }}>{totalCells} клеток</span>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                    <div
                                        style={{
                                            background: !noEvents ? 'rgba(236, 72, 153, 0.15)' : 'rgba(56, 189, 248, 0.15)',
                                            border: !noEvents ? '1px solid rgba(236, 72, 153, 0.4)' : '1px solid rgba(56, 189, 248, 0.4)',
                                            padding: '8px 10px',
                                            borderRadius: 10,
                                            textAlign: 'center',
                                            transition: 'all 0.25s ease'
                                        }}
                                    >
                                        <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 2 }}>Режим</div>
                                        <div style={{ fontSize: 13, fontWeight: 800, color: !noEvents ? '#f472b6' : '#38bdf8' }}>
                                            {!noEvents ? '🌪️ Хаос' : '🧘 Без ивентов'}
                                        </div>
                                    </div>

                                    <div
                                        style={{
                                            background: 'rgba(30, 41, 59, 0.6)',
                                            border: '1px solid rgba(255, 255, 255, 0.1)',
                                            padding: '8px 10px',
                                            borderRadius: 10,
                                            textAlign: 'center',
                                            transition: 'all 0.25s ease'
                                        }}
                                    >
                                        <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 2 }}>Размер поля</div>
                                        <div style={{ fontSize: 13, fontWeight: 800, color: '#f8fafc' }}>
                                            {gridWidth} × {gridHeight}
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
                                            padding: '8px 12px',
                                            borderRadius: 10,
                                            border: p.id === myId ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid rgba(255, 255, 255, 0.06)'
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            {p.avatarUrl ? (
                                                <img
                                                    src={p.avatarUrl}
                                                    alt=""
                                                    style={{ width: 26, height: 26, borderRadius: '50%', objectFit: 'cover', border: '1px solid rgba(56, 189, 248, 0.5)' }}
                                                />
                                            ) : (
                                                <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>
                                                    👤
                                                </div>
                                            )}
                                            <span style={{ fontWeight: 600, fontSize: 14 }}>
                                                {p.name} {p.isHost ? '👑' : ''} {p.id === myId ? '(Вы)' : ''}
                                            </span>
                                        </div>
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
                                onClick={() => onStartGame(gridWidth, gridHeight, noEvents)}
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
                                ⏳ Ожидаем, пока создатель запустит {gridWidth}×{gridHeight} ({!noEvents ? 'Хаос' : 'Классика'})...
                            </div>
                        )}

                        <button
                            type="button"
                            className="primary-btn"
                            onClick={onLeaveRoom}
                            style={{
                                width: '100%',
                                marginTop: 10,
                                padding: '12px',
                                borderRadius: 12,
                                background: 'rgba(51, 65, 85, 0.5)',
                                color: '#94a3b8',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                fontWeight: 700,
                                fontSize: 14,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 6
                            }}
                        >
                            <span>🚪</span> Выйти в главное меню
                        </button>
                    </div>
                )}
            </div>

            {showGuide && (
                <div
                    onClick={() => setShowGuide(false)}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(3, 7, 18, 0.85)',
                        backdropFilter: 'blur(10px)',
                        WebkitBackdropFilter: 'blur(10px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 10000,
                        padding: 16
                    }}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            background: 'rgba(15, 23, 42, 0.96)',
                            border: '1px solid rgba(56, 189, 248, 0.35)',
                            borderRadius: 22,
                            padding: '22px 24px',
                            maxWidth: 700,
                            width: '100%',
                            maxHeight: '86vh',
                            display: 'flex',
                            flexDirection: 'column',
                            boxShadow: '0 25px 60px rgba(0, 0, 0, 0.7), 0 0 35px rgba(56, 189, 248, 0.2)',
                            boxSizing: 'border-box'
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontSize: 24 }}>📖</span>
                                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: '#f8fafc' }}>
                                    Гайд по игре
                                </h2>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowGuide(false)}
                                style={{
                                    background: 'rgba(51, 65, 85, 0.6)',
                                    border: 'none',
                                    color: '#94a3b8',
                                    width: 30,
                                    height: 30,
                                    borderRadius: '50%',
                                    fontSize: 16,
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                            >
                                ✕
                            </button>
                        </div>

                        <div
                            style={{
                                overflowY: 'auto',
                                paddingRight: 6,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 12,
                                fontSize: 13,
                                color: '#cbd5e1',
                                lineHeight: 1.5
                            }}
                        >
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
                                <div style={{ background: 'rgba(2, 6, 23, 0.6)', padding: 14, borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
                                    <div style={{ fontWeight: 800, color: '#38bdf8', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
                                        <span>🧩</span> Суть игры
                                    </div>
                                    Заполните поле фигурами быстрее соперников на 100%. Фигуры не должны накладываться друг на друга или выходить за границы доски.
                                </div>

                                <div style={{ background: 'rgba(2, 6, 23, 0.6)', padding: 14, borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
                                    <div style={{ fontWeight: 800, color: '#f59e0b', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
                                        <span>🎮</span> Управление
                                    </div>
                                    <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                        <li><b>Зажать и тянуть:</b> перетаскивание фигуры на поле.</li>
                                        <li><b>↻ Повернуть:</b> вращение фигуры по часовой стрелке.</li>
                                        <li><b>Снять фигуру:</b> потяните установленную деталь вниз в лоток.</li>
                                        <li><b>⭐ Джокер:</b> нажмите «Поставить в паз», чтобы фигура автоматически нашла свое место.</li>
                                    </ul>
                                </div>
                            </div>

                            <div style={{ background: 'rgba(2, 6, 23, 0.6)', padding: 14, borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
                                <div style={{ fontWeight: 800, color: '#ec4899', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
                                    <span>🌪️</span> Хаос-ивенты (каждые 10с)
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '8px 16px', fontSize: 12 }}>
                                    <div>🎨 <b>Кляксы:</b> плотные пятна — трите быстрыми свайпами.</div>
                                    <div>🎠 <b>Мегакарусель:</b> доска дрейфует, лоток сдвигается раз в 2.5с.</div>
                                    <div>🌋 <b>Землетрясение:</b> доска трясется, сбрасывая фигуру в лоток на 2-й и 8-й секунде!</div>
                                    <div>👀 <b>Призраки:</b> фигуры обесцвечиваются — виден только лёгкий пунктирный контур!</div>
                                    <div>🪞 <b>Зеркало X:</b> палец по горизонтали тянет фигуру в обратную сторону.</div>
                                    <div>🌫️ <b>Туман войны:</b> фигуры в лотке спрятаны под «❓» до касания.</div>
                                    <div>🧊 <b>Заморозка:</b> стучите по льду (3 удара), чтобы освободить деталь.</div>
                                    <div>🔦 <b>Тьма:</b> поле скрыто тьмой, палец работает фонариком.</div>
                                    <div>🎭 <b>Хамелеон:</b> все детали на время окрашиваются в один цвет.</div>
                                    <div>🌀 <b>Свап досок:</b> редкий супер-ивент — моментальный обмен полями!</div>
                                </div>
                            </div>

                            <div style={{ background: 'rgba(2, 6, 23, 0.6)', padding: 14, borderRadius: 12, border: '1px solid rgba(56, 189, 248, 0.3)' }}>
                                <div style={{ fontWeight: 800, color: '#38bdf8', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
                                    <span>✨</span> Подарки судьбы (Баффы вместо хаоса)
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '8px 16px', fontSize: 12 }}>
                                    <div>🛡️ <b>Тотем:</b> полная неуязвимость — пока у всех бушует хаос, вы спокойно собираете в тишине.</div>
                                    <div>🔬 <b>Рентген:</b> сетка дважды мигает точным чертежом идеальной сборки уровня.</div>
                                    <div>⭐ <b>Джокер:</b> дает кнопку авто-посадки — фигура встает на свое место золотым сиянием (1 раз).</div>
                                </div>
                                <div style={{ marginTop: 8, fontSize: 11, color: '#94a3b8' }}>
                                    💡 <i>Баффы выпадают персонально случайным игрокам взамен плохого ивента. В списке игроков сверху виден значок удачи!</i>
                                </div>
                            </div>

                            <div style={{ background: 'rgba(2, 6, 23, 0.6)', padding: 14, borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
                                <div style={{ fontWeight: 800, color: '#f43f5e', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
                                    <span>⚡</span> Умные комбо (33% шанс)
                                </div>
                                Со 2-го цикла раунда игра может запустить 2 события одновременно (например, <i>Заморозка + Зеркало X</i> или <i>Мегакарусель + Туман</i>).
                            </div>
                        </div>

                        <button
                            type="button"
                            className="primary-btn"
                            onClick={() => setShowGuide(false)}
                            style={{
                                marginTop: 16,
                                padding: 13,
                                borderRadius: 12,
                                background: 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)',
                                color: '#fff',
                                border: 'none',
                                fontWeight: 800,
                                fontSize: 15,
                                cursor: 'pointer',
                                boxShadow: '0 4px 16px rgba(2, 132, 199, 0.4)'
                            }}
                        >
                            Всё понятно, в игру! 🚀
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};