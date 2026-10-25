import { Room, Player } from './types';

export class RoomManager {
    private rooms: Map<string, Room> = new Map();

    // Генерация короткого понятного кода без похожих символов (O, 0, I, 1)
    private generateCode(): string {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        do {
            code = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
        } while (this.rooms.has(code));
        return code;
    }

    createRoom(hostPlayer: Omit<Player, 'isHost' | 'progress' | 'score'>): Room {
        const code = this.generateCode();
        const room: Room = {
            code,
            status: 'LOBBY',
            players: {
                [hostPlayer.id]: { ...hostPlayer, isHost: true, progress: 0, score: 0 }
            },
            currentLevel: null
        };
        this.rooms.set(code, room);
        return room;
    }

    joinRoom(code: string, player: Omit<Player, 'isHost' | 'progress' | 'score'>): Room | null {
        const room = this.rooms.get(code.toUpperCase());
        if (!room || room.status !== 'LOBBY') return null;

        room.players[player.id] = { ...player, isHost: false, progress: 0, score: 0 };
        return room;
    }

    getRoom(code: string): Room | undefined {
        return this.rooms.get(code.toUpperCase());
    }

    removePlayer(socketId: string): Room | null {
        for (const [code, room] of this.rooms.entries()) {
            if (room.players[socketId]) {
                delete room.players[socketId];
                if (Object.keys(room.players).length === 0) {
                    this.rooms.delete(code);
                }
                return room;
            }
        }
        return null;
    }
}