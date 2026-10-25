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

// Домино и тримино для заполнения нестандартных площадей
const SMALL_POLY: number[][][] = [
    [[1, 1]],
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

function flip(m: number[][]): number[][] {
    return m.map((row) => [...row].reverse());
}

function getAllOrientations(base: number[][]): number[][][] {
    const list: number[][][] = [];
    const signatures = new Set<string>();
    let curr = base;
    for (let f = 0; f < 2; f++) {
        for (let r = 0; r < 4; r++) {
            const sig = JSON.stringify(curr);
            if (!signatures.has(sig)) {
                signatures.add(sig);
                list.push(curr);
            }
            curr = rotate(curr);
        }
        curr = flip(base);
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

export function generateLevel(width: number = 4, height: number = 4): LevelData {
    // Ограничиваем размеры для комфортной игры
    const w = Math.max(3, Math.min(10, Math.round(width)));
    const h = Math.max(3, Math.min(10, Math.round(height)));
    const totalCells = w * h;

    // Формируем пул фигур в зависимости от размера поля
    let baseShapes = totalCells <= 16 ? TETROMINOES : totalCells <= 30 ? PENTAMINOES : [...TETROMINOES, ...PENTAMINOES];
    if (totalCells % 4 !== 0 && totalCells % 5 !== 0) {
        baseShapes = [...baseShapes, ...SMALL_POLY];
    }

    const allOrientations = baseShapes.flatMap(getAllOrientations);

    function trySolve(): { matrix: number[][] }[] | null {
        const board = Array.from({ length: h }, () => Array(w).fill(0));
        const placed: { matrix: number[][] }[] = [];
        let iterations = 0;

        function solve(): boolean {
            if (++iterations > 2500) return false;

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

                for (let sr = 0; sr < sRows; sr++) {
                    for (let sc = 0; sc < sCols; sc++) {
                        if (shape[sr][sc] === 1) {
                            const startR = emptyR - sr;
                            const startC = emptyC - sc;

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
                                    placed.push({ matrix: shape });

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
                    }
                }
            }
            return false;
        }

        return solve() ? placed : null;
    }

    // Делаем несколько быстрых попыток
    let result = trySolve();
    for (let attempt = 0; attempt < 5 && !result; attempt++) {
        result = trySolve();
    }

    // Гарантированный фоллбэк при сложной геометрии
    const placedShapes = result || [{ matrix: [[1, 1], [1, 1]] }];
    const shuffledColors = shuffle(COLORS);

    const pieces: Shape[] = shuffle(placedShapes).map((item, idx) => {
        let m = item.matrix;
        const randomRotations = Math.floor(Math.random() * 4);
        for (let i = 0; i < randomRotations; i++) m = rotate(m);
        if (Math.random() > 0.5) m = flip(m);

        return {
            id: `p_${idx}_${Date.now()}_${Math.random()}`,
            matrix: m,
            color: shuffledColors[idx % shuffledColors.length]
        };
    });

    return {
        gridWidth: w,
        gridHeight: h,
        targetCellsCount: totalCells,
        pieces
    };
}