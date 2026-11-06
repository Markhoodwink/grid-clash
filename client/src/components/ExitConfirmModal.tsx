import React from 'react';

interface ExitConfirmModalProps {
    onCancel: () => void;
    onConfirm: () => void;
}

export const ExitConfirmModal: React.FC<ExitConfirmModalProps> = ({ onCancel, onConfirm }) => {
    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(15, 23, 42, 0.85)',
                backdropFilter: 'blur(5px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10002,
                padding: 20
            }}
        >
            <div
                style={{
                    background: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: 16,
                    padding: 20,
                    maxWidth: 320,
                    width: '100%',
                    textAlign: 'center',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
                }}
            >
                <div style={{ fontSize: 36, marginBottom: 8 }}>🚪</div>
                <h3 style={{ fontSize: 18, color: '#f8fafc', marginBottom: 6, fontWeight: 700 }}>
                    Покинуть матч?
                </h3>
                <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 18, lineHeight: 1.4 }}>
                    Текущий прогресс раунда будет сброшен, и комната вернется в лобби ожидания.
                </p>
                <div style={{ display: 'flex', gap: 10 }}>
                    <button
                        onClick={onCancel}
                        style={{
                            flex: 1,
                            padding: 12,
                            borderRadius: 10,
                            background: '#334155',
                            color: '#fff',
                            border: 'none',
                            fontSize: 14,
                            fontWeight: 600,
                            cursor: 'pointer'
                        }}
                    >
                        Отмена
                    </button>
                    <button
                        onClick={onConfirm}
                        style={{
                            flex: 1,
                            padding: 12,
                            borderRadius: 10,
                            background: '#e11d48',
                            color: '#fff',
                            border: 'none',
                            fontSize: 14,
                            fontWeight: 600,
                            cursor: 'pointer'
                        }}
                    >
                        Да, выйти
                    </button>
                </div>
            </div>
        </div>
    );
};