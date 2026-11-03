import { LevelData, Shape } from './types';

const COLORS = [
    '#ef4444', '#f97316', '#f59e0b', '#10b981',
    '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6',
    '#ec4899', '#14b8a6', '#d946ef', '#84cc16'
];

// Тетрамино (4 клетки)
const TETROMINOES: number[][][] = [
    [[1, 1, 1, 1]],
    [[1, 1], [1, 1]],
    [[1, 1, 1], [0, 1, 0]],
    [[1, 0], [1, 0], [1, 1]],
    [[0, 1], [0, 1], [1, 1]],
    [[0, 1, 1], [1, 1, 0]],
    [[1, 1, 0], [0, 1, 1]]
];

// Пентамино (5 клеток)
const PENTAMINOES: number[][][] = [
    [[1, 1, 1, 1, 1]],
    [[0, 1, 0], [1, 1, 1], [0, 1, 0]],
    [[1, 1, 1], [0, 1, 0], [0, 1, 0]],
    [[1, 0, 1], [1, 1, 1]],
    [[1, 0, 0], [1, 0, 0], [1, 1, 1]],
    [[1, 0, 0], [1, 1, 0], [0, 1, 1]],
    [[1, 1], [1, 1], [1, 0]],
    [[1, 0], [1, 0], [1, 0], [1, 1]],
    [[1, 0], [1, 1], [1, 0], [1, 0]],
    [[0, 1, 1], [1, 1, 0], [0, 1, 0]],
    [[1, 1, 0], [0, 1, 0], [0, 1, 1]],
    [[1, 1, 0, 0], [0, 1, 1, 1]]
];

const TROMINOES: number[][][] = [
    [[1, 1, 1]],
    [[1, 1], [1, 0]]
];

function rotate(m: number[][]): number[][] {
    const rows = m.length;
    const cols = m[0].length;
    const res = Array.from({ length: cols }, () => Array(rows).fill(0));
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) res[c][rows - 1 - r] = m[r][c];
    }
    return res;
}

// Поворот только на 90/180/270 без зеркальных отражений
function getAllOrientations(base: number[][]): number[][][] {
    const list: number[][][] = [];
    const signatures = new Set<string>();
    let curr = base;
    for (let r = 0; r < 4; r++) {
        const sig = JSON.stringify(curr);
        if (!signatures.has(sig)) {
            signatures.add(sig);
            list.push(curr);
        }
        curr = rotate(curr);
    }
    return list;
}

function shuffle<T>(arr: T[]): T[] {
    const res = [...arr];
    for (let i = res.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [res[i], res[j]] = [res[j], res[i]];
    }
    return res;
}

interface PlacedResult {
    matrix: number[][];
    row: number;
    col: number;
}

function carveBoardGuaranteed(w: number, h: number): PlacedResult[] {
    const grid = Array.from({ length: h }, () => Array(w).fill(-1));
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    let regionId = 0;

    for (let r = 0; r < h; r++) {
        for (let c = 0; c < w; c++) {
            if (grid[r][c] !== -1) continue;

            const targetSize = 3 + Math.floor(Math.random() * 3);
            const cells: [number, number][] = [[r, c]];
            grid[r][c] = regionId;

            while (cells.length < targetSize) {
                const candidates: [number, number][] = [];
                for (const [cr, cc] of cells) {
                    for (const [dr, dc] of dirs) {
                        const nr = cr + dr;
                        const nc = cc + dc;
                        if (nr >= 0 && nr < h && nc >= 0 && nc < w && grid[nr][nc] === -1) {
                            candidates.push([nr, nc]);
                        }
                    }
                }
                if (candidates.length === 0) break;
                const [nextR, nextC] = candidates[Math.floor(Math.random() * candidates.length)];
                grid[nextR][nextC] = regionId;
                cells.push([nextR, nextC]);
            }
            regionId++;
        }
    }

    // Склеиваем мелкие остатки
    for (let id = 0; id < regionId; id++) {
        const cells: [number, number][] = [];
        for (let r = 0; r < h; r++) {
            for (let c = 0; c < w; c++) {
                if (grid[r][c] === id) cells.push([r, c]);
            }
        }
        if (cells.length > 0 && cells.length < 3) {
            let neighborId = -1;
            for (const [cr, cc] of cells) {
                for (const [dr, dc] of dirs) {
                    const nr = cr + dr;
                    const nc = cc + dc;
                    if (nr >= 0 && nr < h && nc >= 0 && nc < w && grid[nr][nc] !== id) {
                        neighborId = grid[nr][nc];
                        break;
                    }
                }
                if (neighborId !== -1) break;
            }
            if (neighborId !== -1) {
                for (const [cr, cc] of cells) grid[cr][cc] = neighborId;
            }
        }
    }

    const shapes: PlacedResult[] = [];
    for (let id = 0; id < regionId; id++) {
        let minR = h, maxR = -1, minC = w, maxC = -1;
        for (let r = 0; r < h; r++) {
            for (let c = 0; c < w; c++) {
                if (grid[r][c] === id) {
                    if (r < minR) minR = r;
                    if (r > maxR) maxR = r;
                    if (c < minC) minC = c;
                    if (c > maxC) maxC = c;
                }
            }
        }
        if (maxR !== -1) {
            const mat = Array.from({ length: maxR - minR + 1 }, (_, r) =>
                Array.from({ length: maxC - minC + 1 }, (__, c) =>
                    grid[minR + r][minC + c] === id ? 1 : 0
                )
            );
            shapes.push({ matrix: mat, row: minR, col: minC });
        }
    }
    return shapes;
}

export function generateLevel(width: number = 4, height: number = 4): LevelData {
    const w = Math.max(3, Math.min(10, Math.round(width)));
    const h = Math.max(3, Math.min(10, Math.round(height)));
    const totalCells = w * h;

    const baseShapes =
        totalCells <= 12
            ? [...TROMINOES, ...TETROMINOES]
            : [...TROMINOES, ...TETROMINOES, ...PENTAMINOES];

    const allOrientations = baseShapes.flatMap(getAllOrientations);

    function trySolve(): PlacedResult[] | null {
        const board = Array.from({ length: h }, () => Array(w).fill(0));
        const placed: PlacedResult[] = [];
        let iterations = 0;

        function solve(): boolean {
            if (++iterations > 3500) return false;

            let emptyR = -1;
            let emptyC = -1;
            for (let r = 0; r < h; r++) {
                for (let c = 0; c < w; c++) {
                    if (board[r][c] === 0) {
                        emptyR = r;
                        emptyC = c;
                        break;
                    }
                }
                if (emptyR !== -1) break;
            }

            if (emptyR === -1) return true;

            const candidates = shuffle(allOrientations);
            for (const shape of candidates) {
                const sRows = shape.length;
                const sCols = shape[0].length;
                const firstCol = shape[0].indexOf(1);
                if (firstCol === -1) continue;

                const startR = emptyR;
                const startC = emptyC - firstCol;

                if (startR >= 0 && startC >= 0 && startR + sRows <= h && startC + sCols <= w) {
                    let canPlace = true;
                    for (let r = 0; r < sRows; r++) {
                        for (let c = 0; c < sCols; c++) {
                            if (shape[r][c] === 1 && board[startR + r][startC + c] !== 0) {
                                canPlace = false;
                                break;
                            }
                        }
                        if (!canPlace) break;
                    }

                    if (canPlace) {
                        for (let r = 0; r < sRows; r++) {
                            for (let c = 0; c < sCols; c++) {
                                if (shape[r][c] === 1) board[startR + r][startC + c] = 1;
                            }
                        }

                        placed.push({ matrix: shape, row: startR, col: startC });
                        if (solve()) return true;
                        placed.pop();

                        for (let r = 0; r < sRows; r++) {
                            for (let c = 0; c < sCols; c++) {
                                if (shape[r][c] === 1) board[startR + r][startC + c] = 0;
                            }
                        }
                    }
                }
            }
            return false;
        }

        return solve() ? placed : null;
    }

    let result = trySolve();
    for (let attempt = 0; attempt < 4 && !result; attempt++) {
        result = trySolve();
    }

    const placedShapes: PlacedResult[] = result || carveBoardGuaranteed(w, h);
    const shuffledColors = shuffle(COLORS);

    // Каждой фигуре задаем цвет и ID
    const placedWithColors = placedShapes.map((item, idx) => ({
        ...item,
        color: shuffledColors[idx % shuffledColors.length],
        id: `p_${idx}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
    }));

    // Строим точную сетку решения
    const solutionGrid: string[][] = Array.from({ length: h }, () => Array(w).fill('#1e293b'));
    placedWithColors.forEach((item) => {
        for (let r = 0; r < item.matrix.length; r++) {
            for (let c = 0; c < item.matrix[0].length; c++) {
                if (item.matrix[r][c] === 1 && item.row + r < h && item.col + c < w) {
                    solutionGrid[item.row + r][item.col + c] = item.color;
                }
            }
        }
    });

    // Перемешиваем фигуры для выдачи игрокам (только вращение!)
    const pieces: Shape[] = shuffle(placedWithColors).map((item) => {
        let m = item.matrix;
        const randomRotations = Math.floor(Math.random() * 4);
        for (let i = 0; i < randomRotations; i++) m = rotate(m);

        return {
            id: item.id,
            matrix: m,
            color: item.color
        };
    });

    return {
        gridWidth: w,
        gridHeight: h,
        targetCellsCount: totalCells,
        pieces,
        solutionGrid
    };
}