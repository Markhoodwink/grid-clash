// Поворот матрицы фигуры на 90 градусов по часовой стрелке
export function rotateMatrix(matrix: number[][]): number[][] {
    const rows = matrix.length;
    const cols = matrix[0].length;
    const result: number[][] = Array.from({ length: cols }, () => Array(rows).fill(0));

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            result[c][rows - 1 - r] = matrix[r][c];
        }
    }
    return result;
}

// Зеркальное отражение по горизонтали
export function flipMatrix(matrix: number[][]): number[][] {
    return matrix.map(row => [...row].reverse());
}