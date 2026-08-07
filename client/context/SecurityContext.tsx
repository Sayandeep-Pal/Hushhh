import React, { createContext, useContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Crypto from 'expo-crypto';
import CryptoJS from 'crypto-js';

interface AutoUnlockConfig {
  enabled: boolean;
  duration: number; // in minutes, -1 for always
  lastUnlockedAt?: number;
}

interface SecurityContextType {
  isBiometricEnabled: boolean;
  isPasscodeEnabled: boolean;
  toggleBiometrics: (enabled: boolean) => Promise<void>;
  setPasscode: (passcode: string | null) => Promise<void>;
  verifyPasscode: (passcode: string) => Promise<boolean>;
  isAppLocked: boolean;
  setIsAppLocked: (locked: boolean) => void;
  hasHardware: boolean;
  // Vault Logic
  saveSecretCode: (roomId: string, code: string, contactName: string) => Promise<void>;
  getSecretCode: (roomId: string) => Promise<string | null>;
  vault: Record<string, { code: string, name: string, updatedAt: number }>;
  unlockVault: () => Promise<void>;
  lockVault: () => void;
  // Auto-Unlock Logic
  autoUnlockGlobal: boolean;
  autoUnlockConfig: Record<string, AutoUnlockConfig>;
  toggleAutoUnlockGlobal: (enabled: boolean) => Promise<void>;
  updateContactAutoUnlock: (roomId: string, enabled: boolean, duration: number) => Promise<void>;
  recordAutoUnlock: (roomId: string) => Promise<void>;
}

const SecurityContext = createContext<SecurityContextType | undefined>(undefined);

const BIOMETRIC_KEY = 'security_biometric_enabled';
const PASSCODE_ENABLED_KEY = 'security_passcode_enabled';
const PASSCODE_HASH_KEY = 'security_app_passcode_hash';
const PASSCODE_SALT_KEY = 'security_app_passcode_salt';
const VAULT_KEY = 'security_secret_vault';
const AUTO_UNLOCK_GLOBAL_KEY = 'security_auto_unlock_global';
const AUTO_UNLOCK_CONFIG_KEY = 'security_auto_unlock_config';

export const SecurityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isBiometricEnabled, setIsBiometricEnabled] = useState(false);
  const [isPasscodeEnabled, setIsPasscodeEnabled] = useState(false);
  const [isAppLocked, setIsAppLocked] = useState(true);
  const [hasHardware, setHasHardware] = useState(false);
  const [vault, setVault] = useState<Record<string, { code: string, name: string, updatedAt: number }>>({});
  
  const [autoUnlockGlobal, setAutoUnlockGlobal] = useState(false);
  const [autoUnlockConfig, setAutoUnlockConfig] = useState<Record<string, AutoUnlockConfig>>({});

  const secureOptions = isBiometricEnabled ? { requireAuthentication: true } : undefined;
  const derivePasscodeHash = (passcode: string, salt: string) => CryptoJS.PBKDF2(passcode, salt, {
    keySize: 256 / 32,
    iterations: 310000,
    hasher: CryptoJS.algo.SHA256,
  }).toString();
  const equalStrings = (left: string, right: string) => {
    if (left.length !== right.length) return false;
    let difference = 0;
    for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
    return difference === 0;
  };
  const readVault = async () => {
    const stored = await SecureStore.getItemAsync(VAULT_KEY, secureOptions);
    return stored ? JSON.parse(stored) : {};
  };

  useEffect(() => {
    const initSecurity = async () => {
      try {
        const hardware = await LocalAuthentication.hasHardwareAsync();
        setHasHardware(hardware);

        const biometricStored = await SecureStore.getItemAsync(BIOMETRIC_KEY);
        const passcodeEnabledStored = await SecureStore.getItemAsync(PASSCODE_ENABLED_KEY);
        const passcodeHashStored = await SecureStore.getItemAsync(PASSCODE_HASH_KEY);
        const autoUnlockGlobalStored = await SecureStore.getItemAsync(AUTO_UNLOCK_GLOBAL_KEY);
        const autoUnlockConfigStored = await SecureStore.getItemAsync(AUTO_UNLOCK_CONFIG_KEY);

        setIsBiometricEnabled(biometricStored === 'true');
        setIsPasscodeEnabled(passcodeEnabledStored === 'true' && Boolean(passcodeHashStored));
        setAutoUnlockGlobal(autoUnlockGlobalStored === 'true');
        
        if (autoUnlockConfigStored) {
          setAutoUnlockConfig(JSON.parse(autoUnlockConfigStored));
        }

        // If no security enabled, start unlocked
        if (biometricStored !== 'true' && passcodeEnabledStored !== 'true') {
          const loadedVault = await readVault();
          setVault(loadedVault);
          setIsAppLocked(false);
        }
      } catch (error: any) {
        setIsAppLocked(false);
      }
      };

    initSecurity();
  }, []);

  const toggleBiometrics = async (enabled: boolean) => {
    if (enabled && !hasHardware) throw new Error('Biometrics are not available on this device');
    await SecureStore.setItemAsync(BIOMETRIC_KEY, enabled.toString());
    setIsBiometricEnabled(enabled);
    if (Object.keys(vault).length > 0) {
      await SecureStore.setItemAsync(VAULT_KEY, JSON.stringify(vault), enabled ? { requireAuthentication: true } : undefined);
    }
  };

  const setPasscode = async (passcode: string | null) => {
    if (passcode) {
      if (!/^\d{6,}$/.test(passcode)) throw new Error('Passcode must contain at least 6 digits');
      const salt = Array.from(Crypto.getRandomBytes(16)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
      const hash = derivePasscodeHash(passcode, salt);
      await SecureStore.setItemAsync(PASSCODE_ENABLED_KEY, 'true');
      await SecureStore.setItemAsync(PASSCODE_SALT_KEY, salt);
      await SecureStore.setItemAsync(PASSCODE_HASH_KEY, hash);
      setIsPasscodeEnabled(true);
    } else {
      await SecureStore.setItemAsync(PASSCODE_ENABLED_KEY, 'false');
      await SecureStore.deleteItemAsync(PASSCODE_SALT_KEY);
      await SecureStore.deleteItemAsync(PASSCODE_HASH_KEY);
      setIsPasscodeEnabled(false);
    }
  };

  const verifyPasscode = async (passcode: string) => {
    const [salt, storedHash] = await Promise.all([
      SecureStore.getItemAsync(PASSCODE_SALT_KEY),
      SecureStore.getItemAsync(PASSCODE_HASH_KEY),
    ]);
    return Boolean(salt && storedHash && equalStrings(derivePasscodeHash(passcode, salt), storedHash));
  };

  const unlockVault = async () => {
    const loadedVault = await readVault();
    setVault(loadedVault);
  };

  const lockVault = () => setVault({});

  const saveSecretCode = async (roomId: string, code: string, contactName: string) => {
    if (!isBiometricEnabled && !isPasscodeEnabled) throw new Error('Enable app protection before storing a Secret Code');
    const newVault = {
      ...vault, 
      [roomId]: { code, name: contactName, updatedAt: Date.now() } 
    };
    await SecureStore.setItemAsync(VAULT_KEY, JSON.stringify(newVault), secureOptions);
    setVault(newVault);
  };

  const getSecretCode = async (roomId: string) => {
    return vault[roomId]?.code || null;
  };

  const toggleAutoUnlockGlobal = async (enabled: boolean) => {
    await SecureStore.setItemAsync(AUTO_UNLOCK_GLOBAL_KEY, enabled.toString());
    setAutoUnlockGlobal(enabled);
  };

  const updateContactAutoUnlock = async (roomId: string, enabled: boolean, duration: number) => {
    const newConfig = {
      ...autoUnlockConfig,
      [roomId]: { 
        ...autoUnlockConfig[roomId],
        enabled, 
        duration 
      }
    };
    await SecureStore.setItemAsync(AUTO_UNLOCK_CONFIG_KEY, JSON.stringify(newConfig));
    setAutoUnlockConfig(newConfig);
  };

  const recordAutoUnlock = async (roomId: string) => {
    if (!autoUnlockConfig[roomId]) return;
    
    const newConfig = {
      ...autoUnlockConfig,
      [roomId]: {
        ...autoUnlockConfig[roomId],
        lastUnlockedAt: Date.now()
      }
    };
    await SecureStore.setItemAsync(AUTO_UNLOCK_CONFIG_KEY, JSON.stringify(newConfig));
    setAutoUnlockConfig(newConfig);
  };

  return (
    <SecurityContext.Provider value={{ 
      isBiometricEnabled, 
      isPasscodeEnabled, 
      toggleBiometrics, 
      setPasscode,
      verifyPasscode,
      isAppLocked,
      setIsAppLocked,
      hasHardware,
      saveSecretCode,
      getSecretCode,
      vault,
      unlockVault,
      lockVault,
      autoUnlockGlobal,
      autoUnlockConfig,
      toggleAutoUnlockGlobal,
      updateContactAutoUnlock,
      recordAutoUnlock
    }}>
      {children}
    </SecurityContext.Provider>
  );
};

export const useSecurity = () => {
  const context = useContext(SecurityContext);
  if (context === undefined) {
    throw new Error('useSecurity must be used within a SecurityProvider');
  }
  return context;
};
