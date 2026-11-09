import { io } from 'socket.io-client';

export const socket = io({
    transports: ['polling', 'websocket'],
    autoConnect: true
});

socket.on('connect_error', (err) => {
    console.error('Socket connect error:', err.message);
    alert('Socket connect error: ' + err.message);
});