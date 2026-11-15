import { useEffect } from 'react';
import { io } from 'socket.io-client';
import useAppStore from '../store/useAppStore';

export function useSocket() {
  const { authToken, setSocketConnected, setIncomingPing, setActiveChat } = useAppStore();

  useEffect(() => {
    if (!authToken) {
      setSocketConnected(false);
      return undefined;
    }

    const socketUrl = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001/api').replace(/\/api$/, '');
    const socket = io(socketUrl, {
      transports: ['websocket'],
      autoConnect: true,
      auth: { token: authToken },
    });

    socket.on('connect', () => {
      setSocketConnected(true);
      console.log('Socket connected');
    });

    socket.on('disconnect', () => {
      setSocketConnected(false);
    });

    socket.on('ping:incoming', (payload) => {
      setIncomingPing(payload);
    });

    socket.on('ping:accepted', (payload) => {
      setActiveChat(payload);
    });

    socket.on('chat:message', (payload) => {
      console.log('Incoming message', payload);
    });

    return () => socket.disconnect();
  }, [authToken, setActiveChat, setIncomingPing, setSocketConnected]);
}
