export interface Shape {
    id: string;
    matrix: number[][];
    color: string;
}

export interface PlacedShape extends Shape {
    row: number | null;
    col: number | null;
}

export interface LevelData {
    gridWidth: number;
    gridHeight: number;
    targetCellsCount: number;
    pieces: Shape[];
    solutionGrid?: string[][];
}

export interface Player {
    id: string;
    name: string;
    isHost: boolean;
    progress: number;
    score: number;
    pieces?: PlacedShape[];
}

export interface Room {
    code: string;
    status: 'LOBBY' | 'PLAYING';
    players: Record<string, Player>;
    currentLevel: LevelData | null;
    endRoundVotes?: string[];
}