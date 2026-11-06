import React from 'react';
import { Player } from './GameTopBar';

interface GameOverModalProps {
    roundWinner: { id: string | null; name: string | null; isAborted?: boolean };
    roundResults: Player[];
    myId: string;
    isHost?: boolean;
    solutionGrid?: string[][];
    gridWidth: number;
    gridHeight: number;
    solCellSize: number;
    onNextRound: () => void;
    onBackToLobby: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
    roundWinner,
    roundResults,
    myId,
    isHost,
    solutionGrid,
    gridWidth,
    gridHeight,
    solCellSize,
    onNextRound,
    onBackToLobby
}) => {
    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(15, 23, 42, 0.96)',
                backdropFilter: 'blur(8px)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10001,
                padding: 16,
                overflowY: 'auto'
            }}
        >
            <div style={{ width: '100%', maxWidth: 380, textAlign: 'center', margin: 'auto' }}>
                <div style={{ fontSize: 38, marginBottom: 4 }}>
                    {roundWinner.isAborted ? '🏳️' : roundWinner.id === myId ? '🏆' : '⚡'}
                </div>

                <h1
                    style={{
                        fontSize: 22,
                        fontWeight: 900,
                        color: roundWinner.isAborted
                            ? '#cbd5e1'
                            : roundWinner.id === myId
                                ? '#38bdf8'
                                : '#f59e0b',
                        marginBottom: 2
                    }}
                >
                    {roundWinner.isAborted
                        ? 'РАУНД ЗАВЕРШЕН ДОСРОЧНО'
                        : roundWinner.id === myId
                            ? 'ВЫ ПОБЕДИЛИ!'
                            : `${roundWinner.name} собрал быстрее всех!`}
                </h1>

                <p style={{ color: '#94a3b8', fontSize: 12, marginBottom: 14 }}>
                    {roundWinner.isAborted
                        ? 'Все игроки проголосовали за пропуск — без начисления очков'
                        : 'Счет серии (число побед)'}
                </p>

                {/* Мини-сетка решения */}
                {solutionGrid && (
                    <div
                        style={{
                            background: '#0b1329',
                            border: '1px solid #334155',
                            borderRadius: 12,
                            padding: '10px 14px',
                            marginBottom: 14,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            boxShadow: '0 4px 16px rgba(0,0,0,0.3)'
                        }}
                    >
                        <div
                            style={{
                                fontSize: 12,
                                fontWeight: 700,
                                color: '#94a3b8',
                                marginBottom: 8,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6
                            }}
                        >
                            <span>🧩</span> Как надо было собрать:
                        </div>

                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns: `repeat(${gridWidth}, ${solCellSize}px)`,
                                gridTemplateRows: `repeat(${gridHeight}, ${solCellSize}px)`,
                                gap: '3px',
                                background: '#1e293b',
                                padding: 6,
                                borderRadius: 10,
                                border: '1px solid #334155'
                            }}
                        >
                            {solutionGrid.map((row, r) =>
                                row.map((cellColor, c) => (
                                    <div
                                        key={`${r}-${c}`}
                                        style={{
                                            width: solCellSize,
                                            height: solCellSize,
                                            borderRadius: 4,
                                            background: cellColor || '#0f172a',
                                            boxShadow: 'inset 0 0 4px rgba(0,0,0,0.4)',
                                            border: '1px solid rgba(255,255,255,0.06)'
                                        }}
                                    />
                                ))
                            )}
                        </div>
                    </div>
                )}

                {/* Лидерборд с очками */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                    {roundResults.map((player, index) => {
                        const medals = ['🥇', '🥈', '🥉'];
                        const isRoundWinner = !roundWinner.isAborted && player.id === roundWinner.id;

                        return (
                            <div
                                key={player.id}
                                style={{
                                    background: isRoundWinner
                                        ? 'rgba(56, 189, 248, 0.15)'
                                        : player.id === myId
                                            ? '#1e293b'
                                            : '#0f172a',
                                    border: isRoundWinner ? '2px solid #38bdf8' : '1px solid #334155',
                                    borderRadius: 10,
                                    padding: '8px 12px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between'
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ fontSize: 16 }}>{medals[index] || `#${index + 1}`}</span>
                                    <span style={{ fontWeight: 600, fontSize: 14 }}>
                                        {player.name} {player.id === myId ? '(Вы)' : ''}
                                    </span>
                                </div>
                                <div>
                                    <span style={{ fontWeight: 900, fontSize: 16, color: '#38bdf8' }}>
                                        {player.score || 0}
                                    </span>
                                    <span style={{ fontSize: 11, color: '#64748b', marginLeft: 4 }}>
                                        {(player.score || 0) === 1
                                            ? 'победа'
                                            : (player.score || 0) >= 2 && (player.score || 0) <= 4
                                                ? 'победы'
                                                : 'побед'}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {isHost ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
                        <button
                            onClick={onNextRound}
                            style={{
                                padding: 12,
                                borderRadius: 12,
                                background: '#e11d48',
                                color: '#fff',
                                border: 'none',
                                fontWeight: 'bold',
                                fontSize: 15,
                                cursor: 'pointer'
                            }}
                        >
                            Следующий раунд ({gridWidth}×{gridHeight}) →
                        </button>

                        <button
                            onClick={onBackToLobby}
                            style={{
                                padding: 10,
                                borderRadius: 12,
                                background: '#1e293b',
                                color: '#38bdf8',
                                border: '1px solid #38bdf8',
                                fontWeight: 'bold',
                                fontSize: 13,
                                cursor: 'pointer'
                            }}
                        >
                            В лобби (настройки / позвать друзей) 👥
                        </button>
                    </div>
                ) : (
                    <p style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: 13 }}>
                        Ожидаем решение создателя комнаты...
                    </p>
                )}
            </div>
        </div>
    );
};