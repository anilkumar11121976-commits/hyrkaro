'use client';
import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import api from '@/lib/api';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5000';
const SocketContext = createContext({
  socket: null,
  connected: false,
  unread: 0,
  notifUnread: 0,
  onlineUsers: {},
  refreshUnread: () => {},
  refreshNotifications: () => {},
});

export function SocketProvider({ children }) {
  const { token, user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [unread, setUnread] = useState(0);
  const [notifUnread, setNotifUnread] = useState(0);
  const [onlineUsers, setOnlineUsers] = useState({});
  const timer = useRef(null);

  const refreshUnread = useCallback(async () => {
    if (!token) return setUnread(0);
    try {
      const { data } = await api.get('/conversations');
      setUnread(data.totalUnread || 0);
    } catch {
      /* ignore */
    }
  }, [token]);

  const refreshNotifications = useCallback(async () => {
    if (!token) return setNotifUnread(0);
    try {
      const { data } = await api.get('/notifications', { params: { limit: 1 } });
      setNotifUnread(data.unread || 0);
    } catch {
      /* ignore */
    }
  }, [token]);

  useEffect(() => {
    if (!token || !user) {
      setSocket(null);
      setConnected(false);
      setUnread(0);
      setNotifUnread(0);
      setOnlineUsers({});
      return undefined;
    }
    const s = io(SOCKET_URL, { auth: { token }, transports: ['websocket', 'polling'], reconnectionDelayMax: 10000 });
    s.on('connect', () => setConnected(true));
    s.on('disconnect', () => setConnected(false));

    const bump = () => {
      clearTimeout(timer.current);
      timer.current = setTimeout(refreshUnread, 400);
    };
    s.on('message:new', bump);
    s.on('conversation:read', bump);
    s.on('notification:new', () => setNotifUnread((n) => n + 1));
    // Presence is now scoped to the people you chat with (report H2).
    s.on('presence', ({ userId, online }) => setOnlineUsers((m) => ({ ...m, [userId]: online })));

    setSocket(s);
    refreshUnread();
    refreshNotifications();
    return () => {
      clearTimeout(timer.current);
      s.disconnect();
    };
  }, [token, user, refreshUnread, refreshNotifications]);

  return (
    <SocketContext.Provider
      value={{ socket, connected, unread, notifUnread, onlineUsers, refreshUnread, refreshNotifications }}
    >
      {children}
    </SocketContext.Provider>
  );
}

export const useSocket = () => useContext(SocketContext);

/** Subscribe to a socket event for the lifetime of a component. */
export function useSocketEvent(event, handler) {
  const { socket } = useSocket();
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    if (!socket) return undefined;
    const fn = (...args) => ref.current(...args);
    socket.on(event, fn);
    return () => socket.off(event, fn);
  }, [socket, event]);
}
