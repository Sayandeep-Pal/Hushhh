import React, { createContext, useContext, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
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
const DEVICE_SECRET_KEY = 'identity_device_secret_v1';

const secretFromRandomBytes = () => Array.from(Crypto.getRandomBytes(32))
  .map((byte) => byte.toString(16).padStart(2, '0'))
  .join('');

const saveSession = async (token: string, profile: Profile, deviceSecret?: string) => {
  axios.defaults.headers.common.Authorization = `Bearer ${token}`;
  await Promise.all([
    SecureStore.setItemAsync(TOKEN_KEY, token),
    SecureStore.setItemAsync(CODENAME_KEY, profile.username),
    SecureStore.setItemAsync(USER_ID_KEY, profile.id),
    SecureStore.setItemAsync(AVATAR_SEED_KEY, profile.avatarSeed || profile.username),
    deviceSecret ? SecureStore.setItemAsync(DEVICE_SECRET_KEY, deviceSecret) : Promise.resolve(),
  ]);
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<Profile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { expoPushToken } = usePushNotifications();

  useEffect(() => {
    if (!user || !expoPushToken || !token) return;
    axios.post(`${API_URL}/api/users/push-token`, { pushToken: expoPushToken }).catch(() => {
      // Push registration is optional and must not disrupt an authenticated session.
    });
  }, [user, expoPushToken, token]);

  useEffect(() => {
    const restoreSession = async () => {
      try {
        const [storedId, deviceSecret] = await Promise.all([
          SecureStore.getItemAsync(USER_ID_KEY),
          SecureStore.getItemAsync(DEVICE_SECRET_KEY),
        ]);
        if (!storedId || !deviceSecret) return;
        const response = await axios.post(`${API_URL}/api/auth/session`, { userId: storedId, deviceSecret });
        const nextToken: string = response.data.token;
        const nextUser: Profile = response.data.user;
        await saveSession(nextToken, nextUser);
        setToken(nextToken);
        setUser(nextUser);
      } catch {
        await Promise.all([
          SecureStore.deleteItemAsync(TOKEN_KEY),
          SecureStore.deleteItemAsync(CODENAME_KEY),
          SecureStore.deleteItemAsync(USER_ID_KEY),
          SecureStore.deleteItemAsync(AVATAR_SEED_KEY),
          SecureStore.deleteItemAsync(DEVICE_SECRET_KEY),
        ]);
        delete axios.defaults.headers.common.Authorization;
      } finally {
        setIsLoading(false);
      }
    };
    restoreSession();
  }, []);

  const signInAnonymously = async (username: string, avatarSeed?: string) => {
    const [storedId, deviceSecret] = await Promise.all([
      SecureStore.getItemAsync(USER_ID_KEY),
      SecureStore.getItemAsync(DEVICE_SECRET_KEY),
    ]);

    let response;
    let secretToPersist = deviceSecret;
    if (storedId && deviceSecret) {
      response = await axios.patch(`${API_URL}/api/auth/profile`, { username, avatarSeed });
      const currentToken = token;
      if (!currentToken) throw new Error('Your identity session has expired. Please restart the app.');
      response = { data: { token: currentToken, user: response.data.user } };
    } else {
      secretToPersist = secretFromRandomBytes();
      response = await axios.post(`${API_URL}/api/auth/register`, { username, avatarSeed, deviceSecret: secretToPersist });
    }

    const nextToken: string = response.data.token;
    const nextUser: Profile = response.data.user;
    await saveSession(nextToken, nextUser, secretToPersist || undefined);
    setToken(nextToken);
    setUser(nextUser);
  };

  const signOut = async () => {
    try {
      if (token) await axios.post(`${API_URL}/api/auth/sign-out-everywhere`);
    } catch {
      // Local credential removal is still required when the network is unavailable.
    }
    await Promise.all([
      SecureStore.deleteItemAsync(CODENAME_KEY),
      SecureStore.deleteItemAsync(TOKEN_KEY),
      SecureStore.deleteItemAsync(USER_ID_KEY),
      SecureStore.deleteItemAsync(AVATAR_SEED_KEY),
      SecureStore.deleteItemAsync(DEVICE_SECRET_KEY),
    ]);
    setToken(null);
    setUser(null);
    delete axios.defaults.headers.common.Authorization;
  };

  return (
    <AuthContext.Provider value={{ user, profile: user, token, signOut, signInAnonymously, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
