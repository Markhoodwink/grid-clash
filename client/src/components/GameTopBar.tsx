import React, { useState } from 'react';
import { ChaosEvent } from '../utils/soundFX';

export interface Player {
    id: string;
    name: string;
    progress: number;
    score: number;
    isHost?: boolean;
}

const EVENT_INFO: Record<ChaosEvent, { title: string; short: string; color: string }> = {
    NONE: { title: '⏳ Приготовьтесь...', short: '⏳ Спокойствие', color: '#38bdf8' },
    PAINT: { title: '🎨 КРАСКА! Быстро три кляксы пальцем!', short: '🎨 Кляксы', color: '#ec4899' },
    CAROUSEL: { title: '🎠 МЕГАКАРУСЕЛЬ! Поле дрейфует, лоток движется!', short: '🎠 Мегакарусель', color: '#f59e0b' },
    MONOCHROME: { title: '🎭 ХАМЕЛЕОН! Все фигуры одного цвета!', short: '🎭 Хамелеон', color: '#a855f7' },
    EARTHQUAKE: { title: '🌋 ЗЕМЛЕТРЯСЕНИЕ! Фигуры срываются от тряски!', short: '🌋 Землетрясение', color: '#ef4444' },
    FLASHLIGHT: { title: '🔦 ТЬМА! Подсвечивай поле пальцем!', short: '🔦 Тьма', color: '#eab308' },
    ICE: { title: '🧊 ЗАМОРОЗКА! Тапай по льду, чтобы разбить!', short: '🧊 Заморозка', color: '#06b6d4' },
    GHOST: { title: '👀 ПРИЗРАКИ! У фигур виден только легкий контур!', short: '👀 Призраки', color: '#94a3b8' },
    SWAP: { title: '🌀 СВАП ДОСОК! Обмен полями с соперником!', short: '🌀 Свап досок', color: '#10b981' },
    INVERT_X: { title: '🪞 ЗЕРКАЛО! Палец по горизонтали инвертирован!', short: '🪞 Зеркало X', color: '#f43f5e' },
    FOG: { title: '🌫️ ТУМАН ВОЙНЫ! Фигуры скрыты в лотке!', short: '🌫️ Туман войны', color: '#64748b' },
    TOTEM: { title: '🛡️ ТОТЕМ БЕССМЕРТИЯ! Вы защищены от хаоса!', short: '🛡️ Тотем', color: '#10b981' },
    XRAY: { title: '🔬 РЕНТГЕН! На поле проявился чертёж сборки!', short: '🔬 Рентген', color: '#06b6d4' },
    JOKER: { title: '⭐ ДЖОКЕР! Деталь находит свое место сама!', short: '⭐ Джокер', color: '#f59e0b' }
};

interface GameTopBarProps {
    roomCode: string;
    isHost?: boolean;
    isMuted: boolean;
    onToggleMute: () => void;
    onExitClick: () => void;
    endRoundVotes: string[];
    totalRoomPlayers: number;
    hasVotedEndRound: boolean;
    onVoteEndRound: () => void;
    activeEvents: ChaosEvent[];
    eventCountdown: number;
    cycleCount: number;
    opponents: Player[];
    luckyOverrides?: Record<string, ChaosEvent[]>;
    playerReactions: Record<string, { emoji: string; ts: number }>;
    onSendReaction: (emoji: string) => void;
    onForceEvent?: (event: ChaosEvent) => void;
}



export const GameTopBar: React.FC<GameTopBarProps> = ({
    roomCode,
    isHost,
    isMuted,
    onToggleMute,
    onExitClick,
    endRoundVotes,
    totalRoomPlayers,
    hasVotedEndRound,
    onVoteEndRound,
    activeEvents,
    eventCountdown,
    cycleCount,
    opponents,
    luckyOverrides = {},
    playerReactions,
    onSendReaction,
    onForceEvent
}) => {
    const [codeClicks, setCodeClicks] = useState(0);
    const [showPassInput, setShowPassInput] = useState(false);
    const [adminPass, setAdminPass] = useState('');
    const [isAdmin, setIsAdmin] = useState(false);
    const [adminError, setAdminError] = useState(false);

    const handleCodeClick = () => {
        if (isAdmin) return;
        setCodeClicks((prev) => {
            const next = prev + 1;
            if (next >= 3) {
                setShowPassInput(true);
                return 0;
            }
            return next;
        });
    };

    const handleVerifyPass = (e: React.FormEvent) => {
        e.preventDefault();
        if (adminPass.trim() === 'Kunka') {
            setIsAdmin(true);
            setShowPassInput(false);
            setAdminPass('');
            setAdminError(false);
        } else {
            setAdminError(true);
        }
    };
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);

    const bannerTitle =
        activeEvents.length > 1
            ? `⚡ КОМБО: ${EVENT_INFO[activeEvents[0]]?.short} + ${EVENT_INFO[activeEvents[1]]?.short}!`
            : EVENT_INFO[activeEvents[0]]?.title || 'Спокойствие...';

    const bannerColor =
        activeEvents.length > 1
            ? '#f43f5e'
            : EVENT_INFO[activeEvents[0]]?.color || '#38bdf8';

    const initialDuration = activeEvents[0] === 'NONE' && cycleCount === 0 ? 3 : 10;

    return (
        <div style={{ width: '100%', maxWidth: 440, flex: '0 0 auto', position: 'relative', zIndex: 7500 }}>
            {/* Верхние кнопки управления */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button
                        onClick={onExitClick}
                        style={{
                            background: 'rgba(30, 41, 59, 0.9)',
                            border: '1px solid #334155',
                            color: '#94a3b8',
                            padding: '5px 10px',
                            borderRadius: 8,
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4
                        }}
                    >
                        🚪 В лобби
                    </button>

                    {isHost && endRoundVotes.length === 0 && (
                        <button
                            onClick={onVoteEndRound}
                            style={{
                                background: 'rgba(245, 158, 11, 0.15)',
                                border: '1px solid #f59e0b',
                                color: '#fbbf24',
                                padding: '5px 10px',
                                borderRadius: 8,
                                fontSize: 12,
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4
                            }}
                        >
                            🏳️ Скип раунда
                        </button>
                    )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6, position: 'relative' }}>
                    <span
                        onClick={handleCodeClick}
                        style={{ fontSize: 12, color: '#64748b', cursor: 'pointer', userSelect: 'none' }}
                        title="3 клика для панели создателя"
                    >
                        Код: <b style={{ color: '#38bdf8' }}>{roomCode}</b>
                    </span>

                    {/* Поле ввода пароля админа */}
                    {showPassInput && !isAdmin && (
                        <form onSubmit={handleVerifyPass} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                            <input
                                type="password"
                                placeholder="Пароль..."
                                autoFocus
                                value={adminPass}
                                onChange={(e) => setAdminPass(e.target.value)}
                                style={{
                                    width: 72,
                                    padding: '2px 6px',
                                    fontSize: 11,
                                    borderRadius: 6,
                                    border: adminError ? '1px solid #ef4444' : '1px solid #38bdf8',
                                    background: '#0f172a',
                                    color: '#fff',
                                    outline: 'none'
                                }}
                            />
                            <button
                                type="submit"
                                style={{
                                    padding: '2px 7px',
                                    fontSize: 10,
                                    background: '#0284c7',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: 6,
                                    fontWeight: 800,
                                    cursor: 'pointer'
                                }}
                            >
                                OK
                            </button>
                        </form>
                    )}

                    {/* Панель выбора любого ивента для тестов */}
                    {isAdmin && onForceEvent && (
                        <select
                            onChange={(e) => {
                                const ev = e.target.value as ChaosEvent;
                                if (ev) {
                                    onForceEvent(ev);
                                    e.target.value = '';
                                }
                            }}
                            defaultValue=""
                            style={{
                                background: 'linear-gradient(135deg, #e11d48 0%, #be123c 100%)',
                                color: '#fff',
                                border: '1px solid #fda4af',
                                borderRadius: 6,
                                fontSize: 11,
                                fontWeight: 800,
                                padding: '2px 4px',
                                cursor: 'pointer',
                                outline: 'none',
                                boxShadow: '0 0 10px rgba(225, 29, 72, 0.5)'
                            }}
                        >
                            <option value="" disabled>⚡ Тест ивента...</option>
                            <option value="NONE">⏳ Спокойствие</option>
                            <option value="PAINT">🎨 Кляксы</option>
                            <option value="CAROUSEL">🎠 Мегакарусель</option>
                            <option value="EARTHQUAKE">🌋 Землетрясение</option>
                            <option value="ICE">🧊 Заморозка</option>
                            <option value="GHOST">👀 Призраки</option>
                            <option value="INVERT_X">🪞 Зеркало X</option>
                            <option value="FOG">🌫️ Туман</option>
                            <option value="FLASHLIGHT">🔦 Тьма</option>
                            <option value="MONOCHROME">🎭 Хамелеон</option>
                            <option value="SWAP">🌀 Свап досок</option>
                            <option value="TOTEM">🛡️ Тотем (Бафф)</option>
                            <option value="XRAY">🔬 Рентген (Бафф)</option>
                            <option value="JOKER">⭐ Джокер (Бафф)</option>
                        </select>
                    )}

                    <button
                        onClick={() => setShowEmojiPicker((prev) => !prev)}
                        style={{
                            background: showEmojiPicker ? '#3b82f6' : '#1e293b',
                            border: '1px solid #334155',
                            borderRadius: 8,
                            padding: '4px 7px',
                            fontSize: 13,
                            cursor: 'pointer',
                            color: '#f8fafc'
                        }}
                        title="Отправить реакцию"
                    >
                        💬
                    </button>

                    {showEmojiPicker && (
                        <div
                            style={{
                                position: 'absolute',
                                top: 36,
                                right: 32,
                                background: 'rgba(15, 23, 42, 0.95)',
                                border: '1px solid #38bdf8',
                                borderRadius: 12,
                                padding: '4px 6px',
                                display: 'flex',
                                gap: 6,
                                boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
                                zIndex: 10000
                            }}
                        >
                            {['😱', '🚀', '🧊', '💀'].map((em) => (
                                <button
                                    key={em}
                                    onClick={() => {
                                        onSendReaction(em);
                                        setShowEmojiPicker(false);
                                    }}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        fontSize: 20,
                                        cursor: 'pointer',
                                        padding: 4
                                    }}
                                >
                                    {em}
                                </button>
                            ))}
                        </div>
                    )}

                    <button
                        onClick={onToggleMute}
                        style={{
                            background: '#1e293b',
                            border: '1px solid #334155',
                            borderRadius: 8,
                            padding: '4px 8px',
                            fontSize: 13,
                            cursor: 'pointer',
                            color: '#f8fafc'
                        }}
                        title="Звук Вкл/Выкл"
                    >
                        {isMuted ? '🔇' : '🔊'}
                    </button>
                </div>
            </div>

            {/* Завершение раунда по голосованию */}
            {endRoundVotes.length > 0 && (
                <div
                    style={{
                        background: 'rgba(30, 41, 59, 0.96)',
                        border: '1px solid #f59e0b',
                        borderRadius: 10,
                        padding: '6px 10px',
                        marginBottom: 6,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        boxShadow: '0 4px 14px rgba(245, 158, 11, 0.25)'
                    }}
                >
                    <span style={{ fontSize: 12, color: '#fde68a', fontWeight: 600 }}>
                        🏳️ Завершить раунд? ({endRoundVotes.length}/{totalRoomPlayers})
                    </span>

                    {!hasVotedEndRound ? (
                        <button
                            onClick={onVoteEndRound}
                            style={{
                                background: '#f59e0b',
                                color: '#0f172a',
                                border: 'none',
                                borderRadius: 6,
                                padding: '4px 10px',
                                fontSize: 12,
                                fontWeight: 800,
                                cursor: 'pointer'
                            }}
                        >
                            ✓ Завершить
                        </button>
                    ) : (
                        <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>
                            ⏳ Ждем остальных...
                        </span>
                    )}
                </div>
            )}

            {/* Баннер текущего ивента / баффа */}
            <div
                style={{
                    background: '#1e293b',
                    border: `1px solid ${bannerColor}`,
                    borderRadius: 10,
                    padding: '6px 10px',
                    marginBottom: 6,
                    boxShadow: `0 0 12px ${bannerColor}33`
                }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, color: bannerColor }}>{bannerTitle}</span>
                    <span style={{ fontWeight: 800, color: '#cbd5e1', fontSize: 11 }}>{eventCountdown}с</span>
                </div>
                <div style={{ width: '100%', height: 4, background: '#0f172a', borderRadius: 2, overflow: 'hidden' }}>
                    <div
                        style={{
                            width: `${(eventCountdown / initialDuration) * 100}%`,
                            height: '100%',
                            background: bannerColor,
                            transition: 'width 0.95s linear'
                        }}
                    />
                </div>
            </div>

            {/* Список соперников с бейджами баффов */}
            {opponents.length > 0 && (
                <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
                    {opponents.map((opp) => {
                        const reaction = playerReactions[opp.id];
                        const isRecentReaction = reaction && Date.now() - reaction.ts < 2200;

                        return (
                            <div
                                key={opp.id}
                                style={{
                                    position: 'relative',
                                    flex: 1,
                                    minWidth: 80,
                                    background: '#1e293b',
                                    padding: '4px 7px',
                                    borderRadius: 8,
                                    border: '1px solid #334155'
                                }}
                            >
                                {isRecentReaction && (
                                    <div
                                        style={{
                                            position: 'absolute',
                                            top: -24,
                                            left: '50%',
                                            fontSize: 20,
                                            pointerEvents: 'none',
                                            animation: 'floatReaction 2.2s ease-out forwards'
                                        }}
                                    >
                                        {reaction.emoji}
                                    </div>
                                )}

                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2 }}>
                                    <span style={{ fontWeight: 600, color: '#e2e8f0', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4 }}>
                                        {opp.name}
                                        {luckyOverrides[opp.id]?.includes('TOTEM') && <span>🛡️</span>}
                                        {luckyOverrides[opp.id]?.includes('XRAY') && <span>🔬</span>}
                                        {luckyOverrides[opp.id]?.includes('JOKER') && <span>⭐</span>}
                                    </span>
                                    <span style={{ color: '#38bdf8' }}>{opp.progress || 0}%</span>
                                </div>
                                <div style={{ width: '100%', height: 3, background: '#0f172a', borderRadius: 2, overflow: 'hidden' }}>
                                    <div
                                        style={{
                                            width: `${opp.progress || 0}%`,
                                            height: '100%',
                                            background: '#38bdf8',
                                            transition: 'width 0.2s ease'
                                        }}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};