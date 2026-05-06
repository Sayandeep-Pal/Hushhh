import React, { createContext, useContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://172.17.0.1:3000';

interface Profile {
  id: string;
  username: string;
}

interface AuthContextType {
  user: Profile | null;
  profile: Profile | null;
  token: string | null;
  signOut: () => Promise<void>;
  signInAnonymously: (username: string) => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const CODENAME_KEY = 'agent_codename';
const TOKEN_KEY = 'agent_token';
const USER_ID_KEY = 'agent_user_id';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<Profile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      try {
        const storedToken = await SecureStore.getItemAsync(TOKEN_KEY);
        const storedCodename = await SecureStore.getItemAsync(CODENAME_KEY);
        const storedId = await SecureStore.getItemAsync(USER_ID_KEY);

        if (storedToken && storedId && storedCodename) {
          setToken(storedToken);
          const userData = { id: storedId, username: storedCodename };
          setUser(userData);
          axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
          
          // Verify with backend
          try {
            const response = await axios.post(`${API_URL}/api/auth/anonymous`, {
              username: storedCodename,
              userId: storedId
            });
            const { token: newToken, user: updatedUser } = response.data;
            setToken(newToken);
            setUser(updatedUser);
            axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
            await SecureStore.setItemAsync(TOKEN_KEY, newToken);
          } catch (e) {
            console.error('Token verification failed', e);
            // If verification fails, we don't necessarily logout, just keep local
          }
        }
      } catch (e) {
        console.error('Auth initialization failed', e);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  const signInAnonymously = async (username: string) => {
    try {
      const storedId = await SecureStore.getItemAsync(USER_ID_KEY);
      const response = await axios.post(`${API_URL}/api/auth/anonymous`, {
        username,
        userId: storedId
      });

      const { token: newToken, user: userData } = response.data;
      
      setToken(newToken);
      setUser(userData);
      axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
      
      await SecureStore.setItemAsync(TOKEN_KEY, newToken);
      await SecureStore.setItemAsync(CODENAME_KEY, userData.username);
      await SecureStore.setItemAsync(USER_ID_KEY, userData.id);
    } catch (e) {
      console.error('Anonymous sign in failed', e);
      throw e;
    }
  };

  const signOut = async () => {
    await SecureStore.deleteItemAsync(CODENAME_KEY);
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(USER_ID_KEY);
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
