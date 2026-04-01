import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { API_BASE } from '../config';

export const useSocket = (userId) => {
  const [connected, setConnected] = useState(false);
  const socketRef = useRef(null);

  useEffect(() => {
    if (!userId) return;

    socketRef.current = io(API_BASE, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      autoConnect: true,
      auth: { userId }
    });

    socketRef.current.on('connect', () => {
      console.log('[Socket] Connected');
      setConnected(true);
    });

    socketRef.current.on('disconnect', () => {
      console.log('[Socket] Disconnected');
      setConnected(false);
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [userId]);

  return { socket: socketRef.current, connected };
};
