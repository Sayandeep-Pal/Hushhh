import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import * as Notifications from 'expo-notifications';
import { Audio } from 'expo-av';

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
  const [sound, setSound] = useState<Audio.Sound | null>(null);

  useEffect(() => {
    activeRoomRef.current = activeRoomId;
  }, [activeRoomId]);

  async function playNotificationSound() {
    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri: 'https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3' }
      );
      setSound(sound);
      await sound.playAsync();
    } catch (error: any) {
      console.log("ERROR", error);
      console.log("RESPONSE", error?.response?.data);
      console.log("MESSAGE", error?.message);
    }
  }

  useEffect(() => {
    return sound
      ? () => {
          sound.unloadAsync();
        }
      : undefined;
  }, [sound]);

  useEffect(() => {
    if (token) {
      const newSocket = io(SOCKET_URL, {
        auth: { token }
      });

      newSocket.on('connect', () => setIsConnected(true));
      newSocket.on('disconnect', () => setIsConnected(false));

      // Global message listener for local notifications and sound
      newSocket.on('receive_message', async (data) => {
        // Skip if message is from self
        if (data.senderId === user?.id) return;

        // Only play sound if we ARE in that specific room
        if (data.roomId === activeRoomRef.current) {
          await playNotificationSound();
        }

        // Only show local notification if we are NOT in that room
        if (data.roomId !== activeRoomRef.current) {
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
