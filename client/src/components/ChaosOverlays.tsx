import React from 'react';
import { ChaosEvent } from '../utils/soundFX';

export interface PaintSplat {
    id: number;
    x: number;
    y: number;
    size: number;
    color: string;
    hp: number;
}

interface ChaosOverlaysProps {
    hasEvent: (ev: ChaosEvent) => boolean;
    roundFinished: boolean;
    lightPos: { x: number; y: number };
    swapBanner: { fromName: string } | null;
    paintSplats: PaintSplat[];
    onWipePaint: (clientX: number, clientY: number) => void;
    recentReaction: { emoji: string; name: string } | null;
}

export const ChaosOverlays: React.FC<ChaosOverlaysProps> = ({
    hasEvent,
    roundFinished,
    lightPos,
    swapBanner,
    paintSplats,
    onWipePaint,
    recentReaction
}) => {
    return (
        <>
            {/* 1. Всплывающее эмодзи по центру */}
            {recentReaction && (
                <div
                    style={{
                        position: 'fixed',
                        top: '18%',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        zIndex: 10005,
                        pointerEvents: 'none',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        animation: 'floatReaction 2s ease-out forwards'
                    }}
                >
                    <span style={{ fontSize: 52, filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.5))' }}>
                        {recentReaction.emoji}
                    </span>
                    <span style={{ fontSize: 11, color: '#38bdf8', fontWeight: 700, background: 'rgba(15, 23, 42, 0.85)', padding: '2px 8px', borderRadius: 8, marginTop: 2 }}>
                        {recentReaction.name}
                    </span>
                </div>
            )}

            {/* 2. Фонарик в темноте */}
            {hasEvent('FLASHLIGHT') && !roundFinished && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 7000,
                        pointerEvents: 'none',
                        background: `radial-gradient(circle 115px at ${lightPos.x}px ${lightPos.y}px, rgba(15, 23, 42, 0) 0%, rgba(15, 23, 42, 0.15) 55%, rgba(6, 10, 20, 0.93) 100%)`
                    }}
                />
            )}

            {/* 3. Портал свапа досок */}
            {swapBanner && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 9500,
                        pointerEvents: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'radial-gradient(circle, rgba(16, 185, 129, 0.28) 0%, rgba(15, 23, 42, 0.7) 70%)'
                    }}
                >
                    <div
                        style={{
                            position: 'absolute',
                            left: '50%',
                            top: '50%',
                            width: 220,
                            height: 220,
                            borderRadius: '50%',
                            border: '4px solid #10b981',
                            animation: 'swapPortalPulse 1.1s ease-out infinite'
                        }}
                    />
                    <div
                        style={{
                            background: 'rgba(15, 23, 42, 0.95)',
                            border: '2px solid #10b981',
                            borderRadius: 20,
                            padding: '16px 24px',
                            textAlign: 'center',
                            boxShadow: '0 0 40px rgba(16, 185, 129, 0.6)',
                            transform: 'scale(1.05)'
                        }}
                    >
                        <div style={{ fontSize: 38, marginBottom: 4 }}>🌀</div>
                        <div style={{ fontSize: 20, fontWeight: 900, color: '#10b981', letterSpacing: 1 }}>
                            СВАП ДОСОК!
                        </div>
                        <div style={{ fontSize: 13, color: '#e2e8f0', marginTop: 4, fontWeight: 600 }}>
                            Вы получили поле игрока <span style={{ color: '#38bdf8' }}>«{swapBanner.fromName}»</span>!
                        </div>
                    </div>
                </div>
            )}

            {/* 4. Кляксы краски */}
            {paintSplats.length > 0 && (
                <div
                    onPointerMove={(e) => onWipePaint(e.clientX, e.clientY)}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 8000,
                        touchAction: 'none',
                        cursor: 'crosshair'
                    }}
                >
                    <div
                        style={{
                            position: 'fixed',
                            top: '18%',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            background: 'rgba(15, 23, 42, 0.92)',
                            color: '#ec4899',
                            padding: '7px 16px',
                            borderRadius: 20,
                            fontWeight: 800,
                            fontSize: 13,
                            border: '1px solid #ec4899',
                            pointerEvents: 'none',
                            whiteSpace: 'nowrap',
                            boxShadow: '0 4px 15px rgba(0,0,0,0.4)'
                        }}
                    >
                        🧽 Три кляксы пальцем ({paintSplats.length} шт.)!
                    </div>

                    {paintSplats.map((splat) => (
                        <div
                            key={splat.id}
                            style={{
                                position: 'fixed',
                                left: splat.x,
                                top: splat.y,
                                width: splat.size,
                                height: splat.size,
                                transform: `translate(-50%, -50%) scale(${0.35 + (splat.hp / 100) * 0.65})`,
                                opacity: Math.max(0.4, splat.hp / 100),
                                pointerEvents: 'none',
                                filter: 'drop-shadow(0 6px 14px rgba(0,0,0,0.5))',
                                transition: 'transform 0.08s ease-out, opacity 0.08s ease-out'
                            }}
                        >
                            <svg viewBox="0 0 100 100" width="100%" height="100%">
                                <path
                                    d="M 50,15 C 68,12 85,28 82,46 C 88,62 76,82 58,84 C 42,86 26,78 18,65 C 10,48 18,28 32,20 C 38,16 44,18 50,15 Z"
                                    fill={splat.color}
                                />
                                <circle cx="86" cy="24" r="5" fill={splat.color} />
                                <circle cx="16" cy="26" r="4.5" fill={splat.color} />
                                <circle cx="14" cy="74" r="6" fill={splat.color} />
                                <circle cx="78" cy="78" r="5.5" fill={splat.color} />
                                <circle cx="52" cy="92" r="4" fill={splat.color} />
                                <circle cx="48" cy="8" r="3.5" fill={splat.color} />
                                <path
                                    d="M 34,28 C 42,24 54,24 62,30 C 58,35 46,33 36,36 Z"
                                    fill="rgba(255, 255, 255, 0.42)"
                                />
                            </svg>
                        </div>
                    ))}
                </div>
            )}
        </>
    );
};