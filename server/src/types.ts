export interface Player {
    id: string;
    name: string;
    isHost: boolean;
    progress: number; // 0..100%
    score: number;
}

export interface Shape {
    id: string;
    matrix: number[][]; // e.g. [[1,1], [0,1]]
    color: string;
}

export interface LevelData {
    gridWidth: number;
    gridHeight: number;
    targetCellsCount: number;
    pieces: Shape[];
}

export interface Room {
    code: string;
    status: 'LOBBY' | 'PLAYING' | 'ENDED';
    players: Record<string, Player>;
    currentLevel: LevelData | null;
}