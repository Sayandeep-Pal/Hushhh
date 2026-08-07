import React, { createContext, useContext, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import {
  createVaultKey,
  decryptVault,
  encryptVault,
  unwrapVaultKey,
  wrapVaultKey,
} from '../utils/vault-crypto';

interface AutoUnlockConfig {
  enabled: boolean;
  duration: number;
  lastUnlockedAt?: number;
}

type Vault = Record<string, { code: string; name: string; updatedAt: number }>;

interface SecurityContextType {
  isBiometricEnabled: boolean;
  isPasscodeEnabled: boolean;
  toggleBiometrics: (enabled: boolean) => Promise<void>;
  setPasscode: (passcode: string | null) => Promise<void>;
  unlockVaultWithPasscode: (passcode: string) => Promise<boolean>;
  unlockVaultWithBiometrics: () => Promise<void>;
  isAppLocked: boolean;
  setIsAppLocked: (locked: boolean) => void;
  hasHardware: boolean;
  saveSecretCode: (roomId: string, code: string, contactName: string) => Promise<void>;
  getSecretCode: (roomId: string) => Promise<string | null>;
  vault: Vault;
  lockVault: () => void;
  autoUnlockGlobal: boolean;
  autoUnlockConfig: Record<string, AutoUnlockConfig>;
  toggleAutoUnlockGlobal: (enabled: boolean) => Promise<void>;
  updateContactAutoUnlock: (roomId: string, enabled: boolean, duration: number) => Promise<void>;
  recordAutoUnlock: (roomId: string) => Promise<void>;
}

const SecurityContext = createContext<SecurityContextType | undefined>(undefined);

const BIOMETRIC_ENABLED_KEY = 'security_biometric_enabled';
const PASSCODE_ENABLED_KEY = 'security_passcode_enabled';
const PASSCODE_WRAPPED_VAULT_KEY = 'security_wrapped_vault_key_v2';
const BIOMETRIC_VAULT_KEY = 'security_biometric_vault_key_v2';
const ENCRYPTED_VAULT_KEY = 'security_secret_vault_v2';
const LEGACY_VAULT_KEY = 'security_secret_vault';
const AUTO_UNLOCK_GLOBAL_KEY = 'security_auto_unlock_global';
const AUTO_UNLOCK_CONFIG_KEY = 'security_auto_unlock_config';

const biometricOptions = { requireAuthentication: true };

export const SecurityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isBiometricEnabled, setIsBiometricEnabled] = useState(false);
  const [isPasscodeEnabled, setIsPasscodeEnabled] = useState(false);
  const [isAppLocked, setIsAppLocked] = useState(true);
  const [hasHardware, setHasHardware] = useState(false);
  const [vault, setVault] = useState<Vault>({});
  const [vaultKey, setVaultKey] = useState<string | null>(null);
  const [autoUnlockGlobal, setAutoUnlockGlobal] = useState(false);
  const [autoUnlockConfig, setAutoUnlockConfig] = useState<Record<string, AutoUnlockConfig>>({});

  const persistVault = async (nextVault: Vault, key: string) => {
    await SecureStore.setItemAsync(ENCRYPTED_VAULT_KEY, encryptVault(nextVault, key));
  };

  const loadVaultWithKey = async (key: string) => {
    const encrypted = await SecureStore.getItemAsync(ENCRYPTED_VAULT_KEY);
    if (encrypted) {
      const loaded = decryptVault<Vault>(encrypted, key);
      setVault(loaded);
      setVaultKey(key);
      return loaded;
    }

    // One-time, recoverable migration from the previous plaintext SecureStore entry.
    const legacy = await SecureStore.getItemAsync(LEGACY_VAULT_KEY, isBiometricEnabled ? biometricOptions : undefined);
    const loaded = legacy ? JSON.parse(legacy) as Vault : {};
    await persistVault(loaded, key);
    if (legacy) await SecureStore.deleteItemAsync(LEGACY_VAULT_KEY);
    setVault(loaded);
    setVaultKey(key);
    return loaded;
  };

  const createAndLoadVaultKey = async () => {
    const key = createVaultKey();
    await loadVaultWithKey(key);
    return key;
  };

  useEffect(() => {
    const initSecurity = async () => {
      try {
        const [hardware, biometricStored, passcodeStored, wrappedKey, autoUnlockGlobalStored, autoUnlockConfigStored] = await Promise.all([
          LocalAuthentication.hasHardwareAsync(),
          SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY),
          SecureStore.getItemAsync(PASSCODE_ENABLED_KEY),
          SecureStore.getItemAsync(PASSCODE_WRAPPED_VAULT_KEY),
          SecureStore.getItemAsync(AUTO_UNLOCK_GLOBAL_KEY),
          SecureStore.getItemAsync(AUTO_UNLOCK_CONFIG_KEY),
        ]);
        const biometrics = biometricStored === 'true';
        const passcode = passcodeStored === 'true' && Boolean(wrappedKey);
        setHasHardware(hardware);
        setIsBiometricEnabled(biometrics);
        setIsPasscodeEnabled(passcode);
        setAutoUnlockGlobal(autoUnlockGlobalStored === 'true');
        if (autoUnlockConfigStored) setAutoUnlockConfig(JSON.parse(autoUnlockConfigStored));

        // An unprotected development vault is loaded only for legacy/dev compatibility.
        if (!biometrics && !passcode) {
          const legacy = await SecureStore.getItemAsync(LEGACY_VAULT_KEY);
          if (legacy) setVault(JSON.parse(legacy));
          setIsAppLocked(false);
        }
      } catch {
        setIsAppLocked(false);
      }
    };
    initSecurity();
  }, []);

  const unlockVaultWithPasscode = async (passcode: string) => {
    const wrappedKey = await SecureStore.getItemAsync(PASSCODE_WRAPPED_VAULT_KEY);
    if (!wrappedKey) return false;
    try {
      const key = unwrapVaultKey(wrappedKey, passcode);
      await loadVaultWithKey(key);
      return true;
    } catch {
      return false;
    }
  };

  const unlockVaultWithBiometrics = async () => {
    let key = await SecureStore.getItemAsync(BIOMETRIC_VAULT_KEY, biometricOptions);
    if (!key) {
      // Upgrade the preceding protected-but-unwrapped vault layout after native authentication.
      key = createVaultKey();
      await SecureStore.setItemAsync(BIOMETRIC_VAULT_KEY, key, biometricOptions);
    }
    await loadVaultWithKey(key);
  };

  const toggleBiometrics = async (enabled: boolean) => {
    if (enabled && !hasHardware) throw new Error('Biometrics are not available on this device');
    if (!enabled && !isPasscodeEnabled) throw new Error('Enable a passcode before disabling biometric protection');
    const key = vaultKey || await createAndLoadVaultKey();
    if (enabled) {
      await SecureStore.setItemAsync(BIOMETRIC_VAULT_KEY, key, biometricOptions);
    } else {
      await SecureStore.deleteItemAsync(BIOMETRIC_VAULT_KEY);
    }
    await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, enabled.toString());
    setIsBiometricEnabled(enabled);
  };

  const setPasscode = async (passcode: string | null) => {
    if (!passcode) {
      if (!isBiometricEnabled) throw new Error('Enable biometric protection before disabling the passcode');
      await Promise.all([
        SecureStore.setItemAsync(PASSCODE_ENABLED_KEY, 'false'),
        SecureStore.deleteItemAsync(PASSCODE_WRAPPED_VAULT_KEY),
      ]);
      setIsPasscodeEnabled(false);
      return;
    }
    if (!/^\d{6,}$/.test(passcode)) throw new Error('Passcode must contain at least 6 digits');
    const key = vaultKey || await createAndLoadVaultKey();
    await Promise.all([
      SecureStore.setItemAsync(PASSCODE_ENABLED_KEY, 'true'),
      SecureStore.setItemAsync(PASSCODE_WRAPPED_VAULT_KEY, wrapVaultKey(key, passcode)),
    ]);
    setIsPasscodeEnabled(true);
  };

  const lockVault = () => {
    setVault({});
    setVaultKey(null);
  };

  const saveSecretCode = async (roomId: string, code: string, contactName: string) => {
    if (!vaultKey) throw new Error('Unlock the vault before storing a Secret Code');
    const nextVault = { ...vault, [roomId]: { code, name: contactName, updatedAt: Date.now() } };
    await persistVault(nextVault, vaultKey);
    setVault(nextVault);
  };

  const getSecretCode = async (roomId: string) => vault[roomId]?.code || null;

  const toggleAutoUnlockGlobal = async (enabled: boolean) => {
    await SecureStore.setItemAsync(AUTO_UNLOCK_GLOBAL_KEY, enabled.toString());
    setAutoUnlockGlobal(enabled);
  };

  const updateContactAutoUnlock = async (roomId: string, enabled: boolean, duration: number) => {
    const nextConfig = { ...autoUnlockConfig, [roomId]: { ...autoUnlockConfig[roomId], enabled, duration } };
    await SecureStore.setItemAsync(AUTO_UNLOCK_CONFIG_KEY, JSON.stringify(nextConfig));
    setAutoUnlockConfig(nextConfig);
  };

  const recordAutoUnlock = async (roomId: string) => {
    if (!autoUnlockConfig[roomId]) return;
    const nextConfig = { ...autoUnlockConfig, [roomId]: { ...autoUnlockConfig[roomId], lastUnlockedAt: Date.now() } };
    await SecureStore.setItemAsync(AUTO_UNLOCK_CONFIG_KEY, JSON.stringify(nextConfig));
    setAutoUnlockConfig(nextConfig);
  };

  return (
    <SecurityContext.Provider value={{
      isBiometricEnabled,
      isPasscodeEnabled,
      toggleBiometrics,
      setPasscode,
      unlockVaultWithPasscode,
      unlockVaultWithBiometrics,
      isAppLocked,
      setIsAppLocked,
      hasHardware,
      saveSecretCode,
      getSecretCode,
      vault,
      lockVault,
      autoUnlockGlobal,
      autoUnlockConfig,
      toggleAutoUnlockGlobal,
      updateContactAutoUnlock,
      recordAutoUnlock,
    }}>
      {children}
    </SecurityContext.Provider>
  );
};

export const useSecurity = () => {
  const context = useContext(SecurityContext);
  if (!context) throw new Error('useSecurity must be used within a SecurityProvider');
  return context;
};
