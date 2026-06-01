import React, { createContext, useContext, useState, useEffect } from 'react';
import { Alert } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { usePushNotifications } from '../hooks/usePushNotifications';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://172.17.0.1:3000';

interface Profile {
  id: string;
  username: string;
  avatarSeed?: string;
}

interface AuthContextType {
  user: Profile | null;
  profile: Profile | null;
  token: string | null;
  signOut: () => Promise<void>;
  signInAnonymously: (username: string, avatarSeed?: string) => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const CODENAME_KEY = 'agent_codename';
const TOKEN_KEY = 'agent_token';
const USER_ID_KEY = 'agent_user_id';
const AVATAR_SEED_KEY = 'agent_avatar_seed';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<Profile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { expoPushToken } = usePushNotifications();

  useEffect(() => {
    const registerToken = async () => {
      if (user && expoPushToken) {
        try {
          await axios.post(`${API_URL}/api/users/push-token`, {
            pushToken: expoPushToken
          });
        } catch (error: any) {
          // If this fails in the APK, it might be due to API_URL issues or network
          Alert.alert('Push Registration Failed', `Could not save notification token on server: ${error.message}`);
        }
      }
    };

    registerToken();
  }, [user, expoPushToken]);

  useEffect(() => {
    const initAuth = async () => {
      try {
        const storedToken = await SecureStore.getItemAsync(TOKEN_KEY);
        const storedCodename = await SecureStore.getItemAsync(CODENAME_KEY);
        const storedId = await SecureStore.getItemAsync(USER_ID_KEY);
        const storedAvatarSeed = await SecureStore.getItemAsync(AVATAR_SEED_KEY);

        if (storedToken && storedId && storedCodename) {
          setToken(storedToken);
          const userData = { id: storedId, username: storedCodename, avatarSeed: storedAvatarSeed || storedCodename };
          setUser(userData);
          axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;

          // Verify with backend
          try {
            const response = await axios.post(`${API_URL}/api/auth/anonymous`, {
              username: storedCodename,
              userId: storedId,
              avatarSeed: storedAvatarSeed
            });
            const { token: newToken, user: updatedUser } = response.data;
            setToken(newToken);
            setUser(updatedUser);
            axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
            await SecureStore.setItemAsync(TOKEN_KEY, newToken);
            if (updatedUser.avatarSeed) {
              await SecureStore.setItemAsync(AVATAR_SEED_KEY, updatedUser.avatarSeed);
            }
          } catch (error: any) {
            if (axios.isAxiosError(error) && error.response?.status === 401) {
              await signOut();
            }
          }
        }
      } catch (error: any) {
      } finally {
        setIsLoading(false);
      }
      };

    initAuth();
  }, []);

  const signInAnonymously = async (username: string, avatarSeed?: string) => {
    try {
      const storedId = await SecureStore.getItemAsync(USER_ID_KEY);
      const response = await axios.post(`${API_URL}/api/auth/anonymous`, {
        username,
        userId: storedId,
        avatarSeed
      });

      const { token: newToken, user: userData } = response.data;
      
      setToken(newToken);
      setUser(userData);
      axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
      
      await SecureStore.setItemAsync(TOKEN_KEY, newToken);
      await SecureStore.setItemAsync(CODENAME_KEY, userData.username);
      await SecureStore.setItemAsync(USER_ID_KEY, userData.id);
      if (userData.avatarSeed) {
        await SecureStore.setItemAsync(AVATAR_SEED_KEY, userData.avatarSeed);
      }
    } catch (error: any) {
      throw error;
    }
  };

  const signOut = async () => {
    await SecureStore.deleteItemAsync(CODENAME_KEY);
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(USER_ID_KEY);
    await SecureStore.deleteItemAsync(AVATAR_SEED_KEY);
    setToken(null);
    setUser(null);
    delete axios.defaults.headers.common['Authorization'];
  };

  return (
    <AuthContext.Provider value={{ user, profile: user, token, signOut, signInAnonymously, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
