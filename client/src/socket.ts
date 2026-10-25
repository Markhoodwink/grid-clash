import { io } from 'socket.io-client';

// В облаке сокет цепляется к текущему адресу сайта
export const socket = io();