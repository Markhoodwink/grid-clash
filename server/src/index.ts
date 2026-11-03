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

app.use(express.static(clientDist, {
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('index.html')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
        }
    }
}));

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

const roomManager = new RoomManager();

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    socket.on('create_room', ({ playerName }) => {
        const room = roomManager.createRoom({ id: socket.id, name: playerName });
        socket.join(room.code);
        socket.emit('room_joined', room); // ✅ Исправлено на строчную j
    });

    socket.on('join_room', ({ code, playerName }) => {
        const room = roomManager.joinRoom(code, { id: socket.id, name: playerName });
        if (!room) {
            socket.emit('error_message', 'Комната не найдена или игра уже началась');
            return;
        }
        socket.join(room.code);
        io.to(room.code).emit('room_updated', room);
        socket.emit('room_joined', room); // ✅ Исправлено на строчную j
    });

    socket.on('start_game', ({ code, width, height }) => {
        const room = roomManager.getRoom(code);
        if (room && room.players[socket.id]?.isHost) {
            room.status = 'PLAYING';
            room.endRoundVotes = [];
            room.currentLevel = generateLevel(width || 4, height || 4);

            Object.values(room.players).forEach((p) => {
                p.progress = 0;
                p.pieces = room.currentLevel!.pieces.map((piece) => ({
                    ...piece,
                    row: null,
                    col: null
                }));
            });

            io.to(room.code).emit('game_started', {
                level: room.currentLevel,
                players: room.players
            });
        }
    });

    // Сохраняем и прогресс, и текущую раскладку фигур игрока для возможного свапа
    socket.on('update_progress', ({ code, progress, pieces }) => {
        const room = roomManager.getRoom(code);
        if (room && room.players[socket.id]) {
            room.players[socket.id].progress = progress;
            if (pieces) {
                room.players[socket.id].pieces = pieces;
            }
            socket.to(room.code).emit('player_progress_changed', {
                playerId: socket.id,
                progress
            });
        }
    });

    // Синхронизация хаос-ивента от хоста + обработка СВАПА ДОСОК
    socket.on('host_chaos_event', ({ code, event }) => {
        const room = roomManager.getRoom(code);
        if (!room || room.status !== 'PLAYING' || !room.players[socket.id]?.isHost) return;

        if (event === 'SWAP') {
            const playerIds = Object.keys(room.players);
            if (playerIds.length >= 2) {
                // Перемешиваем игроков и сдвигаем их доски по кругу (каждый получает чужую доску)
                const shuffled = [...playerIds].sort(() => Math.random() - 0.5);
                const snapshots = shuffled.map((id) => ({
                    id,
                    name: room.players[id].name,
                    progress: room.players[id].progress || 0,
                    pieces: room.players[id].pieces
                        ? JSON.parse(JSON.stringify(room.players[id].pieces))
                        : room.currentLevel!.pieces.map((p) => ({ ...p, row: null, col: null }))
                }));

                for (let i = 0; i < shuffled.length; i++) {
                    const targetId = shuffled[i];
                    const sourceSnapshot = snapshots[(i + 1) % shuffled.length];

                    room.players[targetId].pieces = sourceSnapshot.pieces;
                    room.players[targetId].progress = sourceSnapshot.progress;

                    io.to(targetId).emit('board_swapped', {
                        pieces: sourceSnapshot.pieces,
                        progress: sourceSnapshot.progress,
                        fromPlayerName: sourceSnapshot.name
                    });

                    io.to(room.code).emit('player_progress_changed', {
                        playerId: targetId,
                        progress: sourceSnapshot.progress
                    });
                }
            }
        }

        io.to(room.code).emit('chaos_event_triggered', { event });
    });

    // Голосование за досрочное завершение раунда
    socket.on('vote_end_round', ({ code }) => {
        const room = roomManager.getRoom(code);
        if (!room || room.status !== 'PLAYING' || !room.players[socket.id]) return;

        if (!room.endRoundVotes) {
            room.endRoundVotes = [];
        }

        // Начать голосование может только хост (если список голосов ещё пуст)
        if (room.endRoundVotes.length === 0 && !room.players[socket.id].isHost) {
            return;
        }

        if (!room.endRoundVotes.includes(socket.id)) {
            room.endRoundVotes.push(socket.id);
        }

        const totalPlayers = Object.keys(room.players).length;
        io.to(room.code).emit('end_round_vote_updated', {
            votes: room.endRoundVotes,
            total: totalPlayers
        });

        // Если проголосовали ВСЕ игроки — завершаем раунд без победителя
        if (room.endRoundVotes.length >= totalPlayers) {
            room.status = 'LOBBY';
            room.endRoundVotes = [];
            const leaderboard = Object.values(room.players).sort((a, b) => b.score - a.score);

            io.to(room.code).emit('round_ended', {
                winnerId: null,
                winnerName: null,
                isAborted: true,
                leaderboard
            });
        }
    });

    socket.on('round_finished', ({ code }) => {
        const room = roomManager.getRoom(code);
        if (room && room.status === 'PLAYING' && room.players[socket.id]) {
            room.status = 'LOBBY';
            room.endRoundVotes = [];
            const winner = room.players[socket.id];
            winner.progress = 100;
            winner.score = (winner.score || 0) + 1;

            const leaderboard = Object.values(room.players).sort((a, b) => b.score - a.score);

            io.to(room.code).emit('round_ended', {
                winnerId: socket.id,
                winnerName: winner.name,
                isAborted: false,
                leaderboard
            });
        }
    });

    socket.on('back_to_lobby', ({ code }) => {
        const room = roomManager.getRoom(code);
        if (room) {
            room.status = 'LOBBY';
            room.endRoundVotes = [];
            Object.values(room.players).forEach((p) => {
                p.progress = 0;
            });
            io.to(room.code).emit('returned_to_lobby', room);
        }
    });

    socket.on('disconnect', () => {
        const room = roomManager.removePlayer(socket.id);
        if (room) {
            if (room.endRoundVotes) {
                room.endRoundVotes = room.endRoundVotes.filter((id) => id !== socket.id);
            }
            io.to(room.code).emit('room_updated', room);
        }
    });
});

app.get('/{*splat}', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.sendFile(path.join(clientDist, 'index.html'));
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});