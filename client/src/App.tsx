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

        const onLeftRoom = () => {
            localStorage.removeItem('gc_active_room');
            setRoom(null);
        };

        socket.on('left_room', onLeftRoom);

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
            if (restoredRoom?.status === 'LOBBY') {
                setLevel(null);
            } else if (restoredLevel) {
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
        socket.on('returned_to_lobby', onReturnedToLobby);
        socket.on('back_to_lobby', onReturnedToLobby);
        socket.on('room_joined', onRoomJoined);
        socket.on('room_Joined', onRoomJoined);

        // Следим за возвратом вкладки из сна ТОЛЬКО если сокет реально оборвался
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && !socket.connected) {
                socket.connect();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            socket.off('connect', onConnect);
            socket.off('room_Joined', onRoomJoined);
            socket.off('room_joined', onRoomJoined);
            socket.off('room_updated', onRoomUpdated);
            socket.off('game_started', onGameStarted);
            socket.off('left_room', onLeftRoom);
            socket.off('session_restored', onSessionRestored);
            socket.off('session_expired', onSessionExpired);
            socket.off('returned_to_lobby', onReturnedToLobby);
            socket.off('back_to_lobby', onReturnedToLobby);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, []);

    const handleLeaveRoom = () => {
        if (room?.code) {
            socket.emit('leave_room', { code: room.code });
        }
        localStorage.removeItem('gc_active_room');
        setRoom(null);
        // Очищаем ?room= из URL, если был вход по прямой ссылке
        window.history.replaceState({}, document.title, window.location.pathname);
    };

    const handleStartGame = (width: number, height: number, noEvents?: boolean) => {
        if (room) {
            socket.emit('start_game', {
                code: room.code,
                width,
                height,
                noEvents: Boolean(noEvents)
            });
        }
    };

    return (
        <div style={{ minHeight: '100vh', background: '#0f172a', color: '#f8fafc' }}>
            {!level ? (
                <Lobby
                    room={room}
                    myId={myId || socket.id || ''}
                    onStartGame={handleStartGame}
                    onLeaveRoom={handleLeaveRoom}
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