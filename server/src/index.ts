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
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

const roomManager = new RoomManager();

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    socket.on('create_room', ({ playerName, userId, avatarUrl }) => {
        const room = roomManager.createRoom({
            id: socket.id,
            userId: userId || socket.id,
            name: playerName,
            avatarUrl: avatarUrl || null
        } as any);
        (room as any).settings = { width: 4, height: 4, noEvents: false };
        socket.join(room.code);
        socket.emit('room_joined', room);
    });

    socket.on('join_room', ({ code, playerName, userId, avatarUrl }) => {
        const room = roomManager.joinRoom(code, {
            id: socket.id,
            userId: userId || socket.id,
            name: playerName,
            avatarUrl: avatarUrl || null
        } as any);
        if (!room) {
            socket.emit('error_message', 'Комната не найдена');
            return;
        }
        socket.join(room.code);
        io.to(room.code).emit('room_updated', room);
        socket.emit('room_joined', room);
    });

    // Синхронизация выбора настроек хоста в реальном времени
    socket.on('update_room_settings', ({ code, width, height, noEvents }) => {
        const room = roomManager.getRoom(code);
        if (room && room.players[socket.id]?.isHost) {
            (room as any).settings = {
                width: Number(width) || 4,
                height: Number(height) || 4,
                noEvents: Boolean(noEvents)
            };
            socket.to(code).emit('room_settings_updated', (room as any).settings);
        }
    });

    socket.on('start_game', ({ code, width, height, noEvents }) => {
        const room = roomManager.getRoom(code);

        if (room && room.players[socket.id]?.isHost) {
            room.status = 'PLAYING';
            room.endRoundVotes = [];

            // 1. Создаем ОДИН уровень и крепим флаг режима
            const level = generateLevel(width || 4, height || 4);
            (level as any).noEvents = Boolean(noEvents);
            room.currentLevel = level;

            // 2. Раздаем игрокам детали именно этого уровня
            Object.values(room.players).forEach((p: any) => {
                p.progress = 0;
                p.pieces = level.pieces.map((piece) => ({
                    ...piece,
                    row: null,
                    col: null
                }));
            });

            // 3. Отправляем уровень всем в комнате
            io.to(code).emit('game_started', { level });
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

    // Синхронизация хаос-ивентов (одиночных и комбо) + Свап досок
    socket.on('host_chaos_event', ({ code, events, luckyOverrides }: { code: string; events: any[]; luckyOverrides?: Record<string, any[]> }) => {
        const room = roomManager.getRoom(code);
        if (!room || room.status !== 'PLAYING' || !room.players[socket.id]?.isHost) return;

        const currentEvents: string[] = events || (event ? [event] : ['NONE']);

        if (currentEvents.includes('SWAP')) {
            const playerIds = Object.keys(room.players);
            if (playerIds.length >= 2) {
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

        io.to(code).emit('chaos_event_triggered', { events, luckyOverrides });
    });

    // Быстрые эмодзи-реакции
    socket.on('send_reaction', ({ code, emoji, playerId }) => {
        io.to(code).emit('player_reaction', { emoji, playerId: playerId || socket.id });
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
        if (room && room.status === 'PLAYING') {
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
            room.currentLevel = null; // Обнуляем уровень, чтобы он не воскресал
            room.endRoundVotes = [];

            Object.values(room.players).forEach((p: any) => {
                p.progress = 0;
                p.pieces = [];
            });

            // Отправляем оба события для 100% синхронизации с клиентом
            io.to(code).emit('returned_to_lobby', room);
            io.to(code).emit('back_to_lobby', room);
            io.to(code).emit('room_updated', room);
        }
    });

    socket.on('disconnect', () => {
        // Находим комнату через добавленный метод
        const room = roomManager.getRoomByPlayerId(socket.id);
        if (room) {
            const player = room.players[socket.id];
            if (player) {
                // Если идет матч — помечаем время обрыва и даем 60 сек на возврат
                if (room.status === 'PLAYING') {
                    player.disconnectedAt = Date.now();
                    setTimeout(() => {
                        // Если за 60 секунд игрок так и не вернулся — удаляем
                        if (player.disconnectedAt && Date.now() - player.disconnectedAt >= 55000) {
                            roomManager.removePlayer(player.id);
                            io.to(room.code).emit('room_updated', room);
                        }
                    }, 60000);
                } else {
                    roomManager.removePlayer(socket.id);
                    io.to(room.code).emit('room_updated', room);
                }
            }
        }
    });

    // Бесшовное переподключение после сна браузера
    socket.on('reconnect_session', ({ code, userId }) => {
        const room = roomManager.getRoom(code);
        if (!room) {
            socket.emit('session_expired');
            return;
        }

        // Ищем игрока по его постоянному userId (а не по старому сокету)
        const existingPlayer = Object.values(room.players).find(p => p.userId === userId);

        if (existingPlayer) {
            const oldSocketId = existingPlayer.id;

            if (oldSocketId !== socket.id) {
                delete room.players[oldSocketId];
                existingPlayer.id = socket.id;
                existingPlayer.disconnectedAt = null;
                room.players[socket.id] = existingPlayer;
            }

            socket.join(room.code);

            // Отправляем уровень ТОЛЬКО если прямо сейчас идет игра
            const activeLevel = room.status === 'PLAYING' ? room.currentLevel : null;

            socket.emit('session_restored', {
                room,
                level: activeLevel,
                myId: socket.id
            });

            // Уведомляем остальных, что игрок вернулся
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

