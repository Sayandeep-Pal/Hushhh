import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import axios, { InternalAxiosRequestConfig } from 'axios';
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

interface SessionPayload {
  token: string;
  refreshToken: string;
  user: Profile;
}

type RetriableRequest = InternalAxiosRequestConfig & {
  _hushhhRetried?: boolean;
  skipHushhhRefresh?: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const CODENAME_KEY = 'agent_codename';
const TOKEN_KEY = 'agent_token';
const REFRESH_TOKEN_KEY = 'identity_refresh_token_v1';
const USER_ID_KEY = 'agent_user_id';
const AVATAR_SEED_KEY = 'agent_avatar_seed';
const DEVICE_SECRET_KEY = 'identity_device_secret_v1';
const DEVICE_ID_KEY = 'identity_device_id_v1';

const randomHex256 = () => Array.from(Crypto.getRandomBytes(32))
  .map((byte) => byte.toString(16).padStart(2, '0'))
  .join('');

const saveSession = async (session: SessionPayload, deviceSecret?: string, deviceId?: string) => {
  axios.defaults.headers.common.Authorization = `Bearer ${session.token}`;
  await Promise.all([
    SecureStore.setItemAsync(TOKEN_KEY, session.token),
    SecureStore.setItemAsync(REFRESH_TOKEN_KEY, session.refreshToken),
    SecureStore.setItemAsync(CODENAME_KEY, session.user.username),
    SecureStore.setItemAsync(USER_ID_KEY, session.user.id),
    SecureStore.setItemAsync(AVATAR_SEED_KEY, session.user.avatarSeed || session.user.username),
    deviceSecret ? SecureStore.setItemAsync(DEVICE_SECRET_KEY, deviceSecret) : Promise.resolve(),
    deviceId ? SecureStore.setItemAsync(DEVICE_ID_KEY, deviceId) : Promise.resolve(),
  ]);
};

const clearLocalSession = async () => {
  await Promise.all([
    SecureStore.deleteItemAsync(CODENAME_KEY),
    SecureStore.deleteItemAsync(TOKEN_KEY),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
    SecureStore.deleteItemAsync(USER_ID_KEY),
    SecureStore.deleteItemAsync(AVATAR_SEED_KEY),
    SecureStore.deleteItemAsync(DEVICE_SECRET_KEY),
    SecureStore.deleteItemAsync(DEVICE_ID_KEY),
  ]);
  delete axios.defaults.headers.common.Authorization;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<Profile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const tokenRef = useRef<string | null>(null);
  const refreshInFlight = useRef<Promise<SessionPayload | null> | null>(null);
  const { expoPushToken } = usePushNotifications();

  const applySession = async (session: SessionPayload, deviceSecret?: string, deviceId?: string) => {
    await saveSession(session, deviceSecret, deviceId);
    tokenRef.current = session.token;
    setToken(session.token);
    setUser(session.user);
  };

  const refreshAccessToken = async (): Promise<SessionPayload | null> => {
    if (refreshInFlight.current) return refreshInFlight.current;
    refreshInFlight.current = (async () => {
      const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
      if (!refreshToken) return null;
      try {
        const response = await axios.post<SessionPayload>(
          `${API_URL}/api/auth/refresh`,
          { refreshToken },
          { skipHushhhRefresh: true } as RetriableRequest,
        );
        await applySession(response.data);
        return response.data;
      } catch {
        await clearLocalSession();
        tokenRef.current = null;
        setToken(null);
        setUser(null);
        return null;
      } finally {
        refreshInFlight.current = null;
      }
    })();
    return refreshInFlight.current;
  };

  useEffect(() => {
    const interceptor = axios.interceptors.response.use(undefined, async (error) => {
      const request = error.config as RetriableRequest | undefined;
      const requestUrl = request?.url || '';
      if (
        error.response?.status !== 401
        || !request
        || request._hushhhRetried
        || request.skipHushhhRefresh
        || requestUrl.includes('/api/auth/')
      ) {
        return Promise.reject(error);
      }

      request._hushhhRetried = true;
      const session = await refreshAccessToken();
      if (!session) return Promise.reject(error);
      request.headers.Authorization = `Bearer ${session.token}`;
      return axios(request);
    });
    return () => axios.interceptors.response.eject(interceptor);
  }, []);

  useEffect(() => {
    if (!user || !expoPushToken || !token) return;
    axios.post(`${API_URL}/api/users/push-token`, { pushToken: expoPushToken }).catch(() => {
      // Push registration is optional and must not disrupt an authenticated session.
    });
  }, [user, expoPushToken, token]);

  useEffect(() => {
    const restoreSession = async () => {
      try {
        const storedRefreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
        if (storedRefreshToken) {
          const session = await refreshAccessToken();
          if (session) return;
        }

        // One-time migration path for devices that predate refresh sessions.
        const [storedId, deviceSecret, storedDeviceId] = await Promise.all([
          SecureStore.getItemAsync(USER_ID_KEY),
          SecureStore.getItemAsync(DEVICE_SECRET_KEY),
          SecureStore.getItemAsync(DEVICE_ID_KEY),
        ]);
        if (!storedId || !deviceSecret) return;
        const deviceId = storedDeviceId || randomHex256();
        const response = await axios.post<SessionPayload>(
          `${API_URL}/api/auth/session`,
          { userId: storedId, deviceSecret, deviceId },
          { skipHushhhRefresh: true } as RetriableRequest,
        );
        await applySession(response.data, undefined, deviceId);
      } catch {
        await clearLocalSession();
      } finally {
        setIsLoading(false);
      }
    };
    restoreSession();
  }, []);

  const signInAnonymously = async (username: string, avatarSeed?: string) => {
    const [storedId, deviceSecret, storedDeviceId] = await Promise.all([
      SecureStore.getItemAsync(USER_ID_KEY),
      SecureStore.getItemAsync(DEVICE_SECRET_KEY),
      SecureStore.getItemAsync(DEVICE_ID_KEY),
    ]);

    if (storedId && deviceSecret) {
      const deviceId = storedDeviceId || randomHex256();
      let currentToken = tokenRef.current;
      if (!currentToken) {
        const response = await axios.post<SessionPayload>(
          `${API_URL}/api/auth/session`,
          { userId: storedId, deviceSecret, deviceId },
          { skipHushhhRefresh: true } as RetriableRequest,
        );
        await applySession(response.data, undefined, deviceId);
        currentToken = response.data.token;
      }
      const response = await axios.patch<{ user: Profile }>(
        `${API_URL}/api/auth/profile`,
        { username, avatarSeed },
        { headers: { Authorization: `Bearer ${currentToken}` } },
      );
      const currentRefreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
      if (!currentRefreshToken) throw new Error('Your identity session has expired. Please restart the app.');
      const refreshedSession: SessionPayload = {
        token: currentToken,
        refreshToken: currentRefreshToken,
        user: response.data.user,
      };
      await applySession(refreshedSession, undefined, deviceId);
      return;
    }

    const nextDeviceSecret = randomHex256();
    const nextDeviceId = randomHex256();
    const response = await axios.post<SessionPayload>(
      `${API_URL}/api/auth/register`,
      { username, avatarSeed, deviceSecret: nextDeviceSecret, deviceId: nextDeviceId },
      { skipHushhhRefresh: true } as RetriableRequest,
    );
    await applySession(response.data, nextDeviceSecret, nextDeviceId);
  };

  const signOut = async () => {
    try {
      let refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
      try {
        if (tokenRef.current && refreshToken) {
          await axios.post(`${API_URL}/api/auth/sign-out`, { refreshToken }, { skipHushhhRefresh: true } as RetriableRequest);
        }
      } catch {
        // This endpoint intentionally bypasses the retry interceptor. Refresh
        // first so a sign-out after the 15-minute access expiry still revokes
        // the device's long-lived credential.
        const session = await refreshAccessToken();
        refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
        if (session && refreshToken) {
          await axios.post(`${API_URL}/api/auth/sign-out`, { refreshToken }, { skipHushhhRefresh: true } as RetriableRequest);
        }
      }
    } catch {
      // Local credential removal is still required when the network is unavailable.
    }
    await clearLocalSession();
    tokenRef.current = null;
    setToken(null);
    setUser(null);
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
