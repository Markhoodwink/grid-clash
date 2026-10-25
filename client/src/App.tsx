import { useEffect, useState } from 'react';
import { socket } from './socket';
import { Lobby } from './components/Lobby';
import { GameScreen } from './components/GameScreen';

export default function App() {
    const [room, setRoom] = useState<any | null>(null);
    const [myId, setMyId] = useState<string>('');
    const [levelData, setLevelData] = useState<any | null>(null);

    useEffect(() => {
        socket.on('connect', () => {
            setMyId(socket.id || '');
        });

        socket.on('room_joined', ({ room, myId }) => {
            setRoom(room);
            setMyId(myId);
        });

        socket.on('room_updated', (updatedRoom) => {
            setRoom(updatedRoom);
        });

        socket.on('game_started', ({ level }) => {
            setLevelData(level);
        });

        socket.on('back_to_lobby', () => {
            setLevelData(null);
        });

        socket.on('error_message', (msg: string) => {
            alert(msg);
        });

        // Автоподстановка кода комнаты из URL-ссылки ?room=XXXX
        const urlParams = new URLSearchParams(window.location.search);
        const roomCodeFromUrl = urlParams.get('room');
        if (roomCodeFromUrl) {
            window.history.replaceState({}, document.title, window.location.pathname);
        }

        return () => {
            socket.off('connect');
            socket.off('room_joined');
            socket.off('room_updated');
            socket.off('game_started');
            socket.off('back_to_lobby');
            socket.off('error_message');
        };
    }, []);

    const handleStartGame = (width: number, height: number) => {
        if (room) {
            socket.emit('start_game', { code: room.code, width, height });
        }
    };

    return (
        <div>
            {!levelData ? (
                <Lobby room={room} myId={myId} onStartGame={handleStartGame} />
            ) : (
                <GameScreen
                    // Ключ заставляет компонент полностью обнулиться при начале нового раунда
                    key={`${levelData.gridWidth}x${levelData.gridHeight}-${levelData.pieces.map((p: any) => p.id).join('-')}`}
                    level={levelData}
                    roomCode={room?.code}
                    players={room?.players}
                    myId={myId}
                />
            )}
        </div>
    );
}