import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { RoomManager } from './roomManager';
import { generateLevel } from './levelGenerator';
import path from 'path';

const app = express();
app.use(cors());

const clientDist = path.resolve(__dirname, '../../client/dist');
app.use(express.static(clientDist));


const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: '*' }
});

const roomManager = new RoomManager();

io.on('connection', (socket) => {
    // 1. Создание лобби
    socket.on('create_room', ({ name }) => {
        const room = roomManager.createRoom({ id: socket.id, name });
        socket.join(room.code);
        socket.emit('room_joined', { room, myId: socket.id });
    });

    // 2. Вход по коду
    socket.on('join_room', ({ code, name }) => {
        const room = roomManager.joinRoom(code, { id: socket.id, name });
        if (!room) {
            socket.emit('error_message', 'Комната не найдена или игра уже идет');
            return;
        }
        socket.join(room.code);
        io.to(room.code).emit('room_updated', room);
        socket.emit('room_joined', { room, myId: socket.id });
    });

    // 3. Старт игры / нового раунда
    socket.on('start_game', ({ code, width, height }) => {
        const room = roomManager.getRoom(code);
        if (!room) return;

        room.status = 'PLAYING';
        room.currentLevel = generateLevel(width || 4, height || 4);
        Object.values(room.players).forEach((p) => (p.progress = 0));

        io.to(code).emit('game_started', {
            level: room.currentLevel
        });
    });

    // 4. Синхронизация полоски прогресса
    socket.on('update_progress', ({ code, progress }) => {
        const room = roomManager.getRoom(code);
        if (room && room.players[socket.id]) {
            room.players[socket.id].progress = progress;
            socket.to(code).emit('player_progress_changed', {
                playerId: socket.id,
                progress
            });
        }
    });

    // 5. МГНОВЕННЫЙ ФИНИШ: первый собрал 100% — раунд закончен!
    socket.on('round_finished', ({ code }) => {
        const room = roomManager.getRoom(code);
        if (!room || room.status !== 'PLAYING') return;

        room.status = 'ENDED';

        // Победитель получает +1 победу к счету
        const winner = room.players[socket.id];
        if (winner) {
            winner.score = (winner.score || 0) + 1;
        }

        const leaderboard = Object.values(room.players).sort(
            (a, b) => (b.score || 0) - (a.score || 0)
        );

        // Моментально рассылаем всем экран итогов с именем победителя
        io.to(code).emit('round_ended', {
            winnerId: socket.id,
            winnerName: winner?.name || 'Победитель',
            leaderboard,
            players: room.players
        });
    });

    // 6. Хост возвращает всех в лобби
    socket.on('back_to_lobby', ({ code }) => {
        const room = roomManager.getRoom(code);
        if (!room) return;

        room.status = 'LOBBY';
        room.currentLevel = null;
        Object.values(room.players).forEach((p) => (p.progress = 0));
        io.to(code).emit('back_to_lobby');
        io.to(code).emit('room_updated', room);
    });

    // 7. Отключение
    socket.on('disconnect', () => {
        const room = roomManager.removePlayer(socket.id);
        if (room) {
            io.to(room.code).emit('room_updated', room);
        }
    });
});

app.get('/{*splat}', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});