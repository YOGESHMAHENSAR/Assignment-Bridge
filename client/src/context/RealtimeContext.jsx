import { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useToast } from './ToastContext';
import { TOKEN_KEY } from '../api';
import { useAuth } from './AuthContext';

const RealtimeContext = createContext({ socket: null, connected: false });

const socketOrigin = () => {
  if (import.meta.env.VITE_SOCKET_URL) return import.meta.env.VITE_SOCKET_URL;
  const apiUrl = import.meta.env.VITE_API_URL;
  return apiUrl ? new URL(apiUrl, window.location.origin).origin : window.location.origin;
};

export function RealtimeProvider({ children }) {
  const { user } = useAuth();
  const toast = useToast();
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!user || !token) {
      setSocket(null);
      setConnected(false);
      return undefined;
    }

    const connection = io(socketOrigin(), { auth: { token } });
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onNotification = (notification) => toast.info(notification.body || notification.title);

    connection.on('connect', onConnect);
    connection.on('disconnect', onDisconnect);
    connection.on('notification:new', onNotification);
    connection.on('connect_error', (error) => console.error('Realtime connection failed', error.message));
    setSocket(connection);

    return () => {
      connection.disconnect();
      setSocket(null);
      setConnected(false);
    };
  }, [user?._id, toast]);

  return <RealtimeContext.Provider value={{ socket, connected }}>{children}</RealtimeContext.Provider>;
}

export const useRealtime = () => useContext(RealtimeContext);
