import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import * as Notifications from 'expo-notifications';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  activeRoomId: string | null;
  setActiveRoomId: (id: string | null) => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

const SOCKET_URL = process.env.EXPO_PUBLIC_API_URL || 'http://172.17.0.1:3000';

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const activeRoomRef = useRef<string | null>(null);

  useEffect(() => {
    activeRoomRef.current = activeRoomId;
  }, [activeRoomId]);

  useEffect(() => {
    if (token) {
      const newSocket = io(SOCKET_URL, {
        auth: { token }
      });

      newSocket.on('connect', () => setIsConnected(true));
      newSocket.on('disconnect', () => setIsConnected(false));

      // Global message listener for local notifications
      newSocket.on('receive_message', async (data) => {
        // Only notify if message is from someone else AND we are not in that room
        if (data.senderId !== user?.id && data.roomId !== activeRoomRef.current) {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: 'New Secure Message 🔒',
              body: `${data.senderUsername || 'Someone'} sent you a message`,
              data: { roomId: data.roomId, senderUsername: data.senderUsername },
              sound: true,
              priority: Notifications.AndroidNotificationPriority.MAX,
            },
            trigger: null, // trigger immediately
          });
        }
      });

      setSocket(newSocket);

      return () => {
        newSocket.off('receive_message');
        newSocket.close();
      };
    } else {
      setSocket(null);
      setIsConnected(false);
    }
  }, [token, user?.id]);

  return (
    <SocketContext.Provider value={{ socket, isConnected, activeRoomId, setActiveRoomId }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};
