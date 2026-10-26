import { LevelData, Shape } from './types';

const COLORS = [
    '#ef4444', '#f97316', '#f59e0b', '#10b981',
    '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6',
    '#ec4899', '#14b8a6', '#d946ef', '#84cc16'
];

// Тримино (3 клетки)
const TROMINOES: number[][][] = [
    [[1, 1, 1]],
    [[1, 1], [1, 0]]
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

function rotate(m: number[][]): number[][] {
    const rows = m.length;
    const cols = m[0].length;
    const res = Array.from({ length: cols }, () => Array(rows).fill(0));
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            res[c][rows - 1 - r] = m[r][c];
        }
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

// Проверка, не осталось ли на поле изолированных пустых дырок по 1–2 клетки
function hasInvalidPockets(board: number[][], h: number, w: number): boolean {
    const visited = Array.from({ length: h }, () => Array(w).fill(false));
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];

    for (let r = 0; r < h; r++) {
        for (let c = 0; c < w; c++) {
            if (board[r][c] === 0 && !visited[r][c]) {
                let count = 0;
                const queue: [number, number][] = [[r, c]];
                visited[r][c] = true;

                while (queue.length > 0) {
                    const [cr, cc] = queue.pop()!;
                    count++;
                    for (const [dr, dc] of dirs) {
                        const nr = cr + dr;
                        const nc = cc + dc;
                        if (nr >= 0 && nr < h && nc >= 0 && nc < w && board[nr][nc] === 0 && !visited[nr][nc]) {
                            visited[nr][nc] = true;
                            queue.push([nr, nc]);
                        }
                    }
                }

                // Так как минимальная фигура состоит из 3 клеток, пустота из 1 или 2 клеток — тупик
                if (count < 3) return true;
            }
        }
    }
    return false;
}

// Безотказный алгоритм прямой нарезки поля на связные полимино (фоллбэк со 100% гарантией)
function carveBoardGuaranteed(w: number, h: number): { matrix: number[][] }[] {
    const grid = Array.from({ length: h }, () => Array(w).fill(-1));
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    let regionId = 0;

    for (let r = 0; r < h; r++) {
        for (let c = 0; c < w; c++) {
            if (grid[r][c] !== -1) continue;

            const targetSize = 3 + Math.floor(Math.random() * 3); // 3, 4 или 5 клеток
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

    // Если остались мелкие кусочки из 1–2 клеток, присоединяем их к соседней фигуре
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
                for (const [cr, cc] of cells) {
                    grid[cr][cc] = neighborId;
                }
            }
        }
    }

    // Извлекаем матрицы фигур
    const shapes: { matrix: number[][] }[] = [];
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
            shapes.push({ matrix: mat });
        }
    }

    return shapes;
}

export function generateLevel(width: number = 4, height: number = 4): LevelData {
    const w = Math.max(3, Math.min(10, Math.round(width)));
    const h = Math.max(3, Math.min(10, Math.round(height)));
    const totalCells = w * h;

    // Комбинируем фигуры 3, 4 и 5 клеток для быстрой и интересной раскладки
    const baseShapes =
        totalCells <= 12
            ? [...TROMINOES, ...TETROMINOES]
            : [...TROMINOES, ...TETROMINOES, ...PENTAMINOES];

    const allOrientations = baseShapes.flatMap(getAllOrientations);

    function trySolve(): { matrix: number[][] }[] | null {
        const board = Array.from({ length: h }, () => Array(w).fill(0));
        const placed: { matrix: number[][] }[] = [];
        let iterations = 0;

        function solve(): boolean {
            if (++iterations > 4000) return false;

            // Ищем первую свободную клетку сверху вниз, слева направо
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

            if (emptyR === -1) return true; // Все поле успешно заполнено!

            const candidates = shuffle(allOrientations);
            for (const shape of candidates) {
                const sRows = shape.length;
                const sCols = shape[0].length;

                // Первая единица в верхней строке фигуры обязана накрыть (emptyR, emptyC)
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

                        // Если не создали тупиковых одиночных дырок — идем глубже
                        if (!hasInvalidPockets(board, h, w)) {
                            placed.push({ matrix: shape });
                            if (solve()) return true;
                            placed.pop();
                        }

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
    for (let attempt = 0; attempt < 5 && !result; attempt++) {
        result = trySolve();
    }

    // Если солвер не уложился в лимит, нарезаем поле гарантированным методом
    const placedShapes = result || carveBoardGuaranteed(w, h);
    const shuffledColors = shuffle(COLORS);

    // ВАЖНО: только поворачиваем фигуры (rotate), БЕЗ зеркального отражения (flip)!
    const pieces: Shape[] = shuffle(placedShapes).map((item, idx) => {
        let m = item.matrix;
        const randomRotations = Math.floor(Math.random() * 4);
        for (let i = 0; i < randomRotations; i++) {
            m = rotate(m);
        }

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