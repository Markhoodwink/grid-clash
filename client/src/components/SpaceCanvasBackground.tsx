import React, { useRef, useEffect } from 'react';

const BG_SHAPES = [
    { matrix: [[1, 1], [1, 1]], color: '#38bdf8' },
    { matrix: [[1, 1, 1, 1]], color: '#ec4899' },
    { matrix: [[1, 1, 1], [0, 1, 0]], color: '#a855f7' },
    { matrix: [[1, 1, 0], [0, 1, 1]], color: '#10b981' },
    { matrix: [[0, 1], [0, 1], [1, 1]], color: '#f59e0b' },
    { matrix: [[0, 1, 0], [1, 1, 1], [0, 1, 0]], color: '#06b6d4' },
    { matrix: [[1, 1, 1], [1, 0, 0]], color: '#ef4444' }
];

export const SpaceCanvasBackground: React.FC<{ celebrate?: boolean }> = ({ celebrate }) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animId: number;
        let width = (canvas.width = window.innerWidth);
        let height = (canvas.height = window.innerHeight);

        const handleResize = () => {
            if (!canvas) return;
            width = canvas.width = window.innerWidth;
            height = canvas.height = window.innerHeight;
        };
        window.addEventListener('resize', handleResize);

        const items = Array.from({ length: 14 }, (_, i) => {
            const shape = BG_SHAPES[i % BG_SHAPES.length];
            const cellSize = 20 + Math.floor(Math.random() * 8);
            return {
                shape,
                cellSize,
                x: Math.random() * width,
                y: Math.random() * height,
                speedY: 0.45 + Math.random() * 0.55,
                speedX: (Math.random() - 0.5) * 0.25,
                rot: Math.random() * Math.PI * 2,
                rotSpeed: (Math.random() - 0.5) * 0.01,
                opacity: 0.35 + Math.random() * 0.25
            };
        });

        let fireworks: Array<{
            x: number;
            y: number;
            vx: number;
            vy: number;
            rot: number;
            vRot: number;
            size: number;
            color: string;
            alpha: number;
        }> = [];

        if (celebrate) {
            const colors = ['#38bdf8', '#ec4899', '#a855f7', '#10b981', '#f59e0b', '#facc15'];
            for (let i = 0; i < 75; i++) {
                const angle = Math.random() * Math.PI * 2;
                const speed = 4 + Math.random() * 14;
                fireworks.push({
                    x: width / 2,
                    y: height * 0.45,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed - 3,
                    rot: Math.random() * Math.PI * 2,
                    vRot: (Math.random() - 0.5) * 0.25,
                    size: 8 + Math.floor(Math.random() * 8),
                    color: colors[i % colors.length],
                    alpha: 1
                });
            }
        }

        const drawRoundedRect = (x: number, y: number, s: number, r: number) => {
            ctx.beginPath();
            ctx.moveTo(x + r, y);
            ctx.lineTo(x + s - r, y);
            ctx.arcTo(x + s, y, x + s, y + s, r);
            ctx.lineTo(x + s, y + s - r);
            ctx.arcTo(x + s, y + s, x, y + s, r);
            ctx.lineTo(x + r, y + s);
            ctx.arcTo(x, y + s, x, y, r);
            ctx.lineTo(x, y + r);
            ctx.arcTo(x, y, x + s, y, r);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        };

        const render = () => {
            ctx.clearRect(0, 0, width, height);

            const grad1 = ctx.createRadialGradient(width * 0.2, height * 0.2, 10, width * 0.2, height * 0.2, 300);
            grad1.addColorStop(0, 'rgba(56, 189, 248, 0.16)');
            grad1.addColorStop(1, 'transparent');
            ctx.fillStyle = grad1;
            ctx.fillRect(0, 0, width, height);

            const grad2 = ctx.createRadialGradient(width * 0.8, height * 0.8, 10, width * 0.8, height * 0.8, 320);
            grad2.addColorStop(0, 'rgba(168, 85, 247, 0.14)');
            grad2.addColorStop(1, 'transparent');
            ctx.fillStyle = grad2;
            ctx.fillRect(0, 0, width, height);

            items.forEach((item) => {
                item.y -= item.speedY;
                item.x += item.speedX;
                item.rot += item.rotSpeed;

                if (item.y < -120) {
                    item.y = height + 100;
                    item.x = Math.random() * width;
                }
                if (item.x < -80) item.x = width + 80;
                if (item.x > width + 80) item.x = -80;

                const { matrix, color } = item.shape;
                const s = item.cellSize;
                const gap = 3;
                const rows = matrix.length;
                const cols = matrix[0].length;
                const totalW = cols * s + (cols - 1) * gap;
                const totalH = rows * s + (rows - 1) * gap;

                ctx.save();
                ctx.translate(item.x, item.y);
                ctx.rotate(item.rot);
                ctx.globalAlpha = item.opacity;

                ctx.shadowColor = color;
                ctx.shadowBlur = 12;
                ctx.fillStyle = color;
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
                ctx.lineWidth = 1.2;

                const startX = -totalW / 2;
                const startY = -totalH / 2;

                for (let r = 0; r < rows; r++) {
                    for (let c = 0; c < cols; c++) {
                        if (matrix[r][c] === 1) {
                            const cellX = startX + c * (s + gap);
                            const cellY = startY + r * (s + gap);
                            drawRoundedRect(cellX, cellY, s, 4);
                        }
                    }
                }
                ctx.restore();
            });

            if (fireworks.length > 0) {
                fireworks.forEach((p) => {
                    p.x += p.vx;
                    p.y += p.vy;
                    p.vy += 0.38;
                    p.rot += p.vRot;
                    p.alpha = Math.max(0, p.alpha - 0.012);

                    ctx.save();
                    ctx.translate(p.x, p.y);
                    ctx.rotate(p.rot);
                    ctx.globalAlpha = p.alpha;
                    ctx.fillStyle = p.color;
                    ctx.shadowColor = p.color;
                    ctx.shadowBlur = 10;
                    ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
                    ctx.restore();
                });
                fireworks = fireworks.filter((p) => p.alpha > 0);
            }

            animId = requestAnimationFrame(render);
        };

        render();

        return () => {
            cancelAnimationFrame(animId);
            window.removeEventListener('resize', handleResize);
        };
    }, [celebrate]);

    return (
        <canvas
            ref={canvasRef}
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                zIndex: 1
            }}
        />
    );
};