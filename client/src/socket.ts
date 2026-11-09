import { io } from 'socket.io-client';

// На localhost подключаемся к порту 3001, а на сервере (mark-kun.ru) — 
// автоматически через wss:// по стандартному порту 443 без блокировок Safari
const SERVER_URL = typeof window !== 'undefined' && window.location.hostname === 'localhost'
    ? 'http://localhost:3001'
    : undefined;

export const socket = io(SERVER_URL, {
    transports: ['websocket', 'polling'],
    autoConnect: true
});