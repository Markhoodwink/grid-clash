import React, { useState, useEffect } from 'react';
import { socket } from './socket';
import { Lobby } from './components/Lobby';
import { GameScreen } from './components/GameScreen';

// Получаем или генерируем постоянный ID устройства
const getStoredUserId = (): string => {
    let uid = localStorage.getItem('gc_user_id');
    if (!uid) {
        uid = 'u_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
        localStorage.setItem('gc_user_id', uid);
    }
    return uid;
};

export function App() {
    const [room, setRoom] = useState<any>(null);
    const [level, setLevel] = useState<any>(null);
    const [myId, setMyId] = useState<string>('');

    const userId = getStoredUserId();

    // Функция автоматического восстановления при разворачивании вкладки
    const attemptReconnect = () => {
        const savedRoomCode = localStorage.getItem('gc_active_room');
        if (savedRoomCode && socket.connected) {
            socket.emit('reconnect_session', { code: savedRoomCode, userId });
        }
    };

    useEffect(() => {
        const onConnect = () => {
            setMyId(socket.id || '');
            attemptReconnect();
        };

        const onRoomJoined = (updatedRoom: any) => {
            setRoom(updatedRoom);
            setLevel(null);
            localStorage.setItem('gc_active_room', updatedRoom.code);
        };

        const onRoomUpdated = (updatedRoom: any) => {
            setRoom(updatedRoom);
        };

        const onGameStarted = ({ level: newLevel, players }: any) => {
            setLevel(newLevel);
            if (players) {
                setRoom((prev: any) => (prev ? { ...prev, players, status: 'PLAYING' } : prev));
            }
        };

        // Событие успешного восстановления сессии после сворачивания
        const onSessionRestored = ({ room: restoredRoom, level: restoredLevel, myId: newMyId }: any) => {
            setMyId(newMyId);
            setRoom(restoredRoom);
            if (restoredLevel) {
                setLevel(restoredLevel);
            }
        };

        const onSessionExpired = () => {
            localStorage.removeItem('gc_active_room');
            setRoom(null);
            setLevel(null);
        };

        const onReturnedToLobby = (updatedRoom: any) => {
            setLevel(null);
            setRoom(updatedRoom);
        };

        socket.on('connect', onConnect);
        socket.on('room_joined', onRoomJoined);
        socket.on('room_updated', onRoomUpdated);
        socket.on('game_started', onGameStarted);
        socket.on('session_restored', onSessionRestored);
        socket.on('session_expired', onSessionExpired);
        socket.on('returned_to_lobby', onReturnedToLobby);

        // Следим за возвратом вкладки из сна
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                if (!socket.connected) {
                    socket.connect();
                } else {
                    attemptReconnect();
                }
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('focus', attemptReconnect);

        return () => {
            socket.off('connect', onConnect);
            socket.off('room_joined', onRoomJoined);
            socket.off('room_updated', onRoomUpdated);
            socket.off('game_started', onGameStarted);
            socket.off('session_restored', onSessionRestored);
            socket.off('session_expired', onSessionExpired);
            socket.off('returned_to_lobby', onReturnedToLobby);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('focus', attemptReconnect);
        };
    }, []);

    const handleStartGame = (width: number, height: number) => {
        if (room) {
            socket.emit('start_game', { code: room.code, width, height });
        }
    };

    return (
        <div style={{ minHeight: '100vh', background: '#0f172a', color: '#f8fafc' }}>
            {!level ? (
                <Lobby
                    room={room}
                    myId={myId}
                    onStartGame={(w, h, noEvents) => {
                        socket.emit('start_game', { code: room.code, width: w, height: h, noEvents });
                    }}
                />
            ) : (
                <GameScreen
                    key={level.pieces?.[0]?.id || 'active-round'}
                    level={level}
                    roomCode={room?.code || ''}
                    players={room?.players || {}}
                    myId={myId || socket.id || ''}
                />
            )}
        </div>
    );
}

export default App;