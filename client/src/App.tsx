import React, { useState, useEffect } from 'react';
import { socket } from './socket';
import { Lobby } from './components/Lobby';
import { GameScreen } from './components/GameScreen';

export function App() {
    const [room, setRoom] = useState<any>(null);
    const [level, setLevel] = useState<any>(null);
    const [myId, setMyId] = useState<string>('');

    useEffect(() => {
        if (socket.id) {
            setMyId(socket.id);
        }

        const onConnect = () => {
            setMyId(socket.id || '');
        };

        const onRoomJoined = (updatedRoom: any) => {
            console.log('Room joined:', updatedRoom);
            setRoom(updatedRoom);
            setLevel(null);
        };

        const onRoomUpdated = (updatedRoom: any) => {
            setRoom(updatedRoom);
        };

        const onGameStarted = ({ level: newLevel, players }: any) => {
            console.log('Game started received:', newLevel);
            setLevel(newLevel);
            if (players) {
                setRoom((prev: any) => (prev ? { ...prev, players, status: 'PLAYING' } : prev));
            }
        };

        const onReturnedToLobby = (updatedRoom: any) => {
            setLevel(null);
            setRoom(updatedRoom);
        };

        socket.on('connect', onConnect);
        socket.on('room_joined', onRoomJoined);
        socket.on('room_updated', onRoomUpdated);
        socket.on('game_started', onGameStarted);
        socket.on('returned_to_lobby', onReturnedToLobby);

        return () => {
            socket.off('connect', onConnect);
            socket.off('room_joined', onRoomJoined);
            socket.off('room_updated', onRoomUpdated);
            socket.off('game_started', onGameStarted);
            socket.off('returned_to_lobby', onReturnedToLobby);
        };
    }, []);

    const handleStartGame = (width: number, height: number) => {
        if (room) {
            console.log('Отправляем start_game на сервер:', { code: room.code, width, height });
            socket.emit('start_game', { code: room.code, width, height });
        }
    };

    return (
        <div style={{ minHeight: '100vh', background: '#0f172a', color: '#f8fafc' }}>
            {!level ? (
                <Lobby
                    room={room}
                    myId={myId || socket.id || ''}
                    onStartGame={handleStartGame}
                />
            ) : (
                <GameScreen
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