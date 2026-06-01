import React, { createContext, useContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';

interface AutoUnlockConfig {
  enabled: boolean;
  duration: number; // in minutes, -1 for always
  lastUnlockedAt?: number;
}

interface SecurityContextType {
  isBiometricEnabled: boolean;
  isPasscodeEnabled: boolean;
  appPasscode: string | null;
  toggleBiometrics: (enabled: boolean) => Promise<void>;
  setPasscode: (passcode: string | null) => Promise<void>;
  isAppLocked: boolean;
  setIsAppLocked: (locked: boolean) => void;
  hasHardware: boolean;
  // Vault Logic
  saveSecretCode: (roomId: string, code: string, contactName: string) => Promise<void>;
  getSecretCode: (roomId: string) => Promise<string | null>;
  vault: Record<string, { code: string, name: string, updatedAt: number }>;
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
const PASSCODE_VALUE_KEY = 'security_app_passcode';
const VAULT_KEY = 'security_secret_vault';
const AUTO_UNLOCK_GLOBAL_KEY = 'security_auto_unlock_global';
const AUTO_UNLOCK_CONFIG_KEY = 'security_auto_unlock_config';

export const SecurityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isBiometricEnabled, setIsBiometricEnabled] = useState(false);
  const [isPasscodeEnabled, setIsPasscodeEnabled] = useState(false);
  const [appPasscode, setAppPasscode] = useState<string | null>(null);
  const [isAppLocked, setIsAppLocked] = useState(true);
  const [hasHardware, setHasHardware] = useState(false);
  const [vault, setVault] = useState<Record<string, { code: string, name: string, updatedAt: number }>>({});
  
  const [autoUnlockGlobal, setAutoUnlockGlobal] = useState(false);
  const [autoUnlockConfig, setAutoUnlockConfig] = useState<Record<string, AutoUnlockConfig>>({});

  useEffect(() => {
    const initSecurity = async () => {
      try {
        const hardware = await LocalAuthentication.hasHardwareAsync();
        setHasHardware(hardware);

        const biometricStored = await SecureStore.getItemAsync(BIOMETRIC_KEY);
        const passcodeEnabledStored = await SecureStore.getItemAsync(PASSCODE_ENABLED_KEY);
        const passcodeStored = await SecureStore.getItemAsync(PASSCODE_VALUE_KEY);
        const vaultStored = await SecureStore.getItemAsync(VAULT_KEY);
        const autoUnlockGlobalStored = await SecureStore.getItemAsync(AUTO_UNLOCK_GLOBAL_KEY);
        const autoUnlockConfigStored = await SecureStore.getItemAsync(AUTO_UNLOCK_CONFIG_KEY);

        setIsBiometricEnabled(biometricStored === 'true');
        setIsPasscodeEnabled(passcodeEnabledStored === 'true');
        setAppPasscode(passcodeStored);
        setAutoUnlockGlobal(autoUnlockGlobalStored === 'true');
        
        if (vaultStored) {
          setVault(JSON.parse(vaultStored));
        }

        if (autoUnlockConfigStored) {
          setAutoUnlockConfig(JSON.parse(autoUnlockConfigStored));
        }

        // If no security enabled, start unlocked
        if (biometricStored !== 'true' && passcodeEnabledStored !== 'true') {
          setIsAppLocked(false);
        }
      } catch (error: any) {
        setIsAppLocked(false);
      }
      };

    initSecurity();
  }, []);

  const toggleBiometrics = async (enabled: boolean) => {
    await SecureStore.setItemAsync(BIOMETRIC_KEY, enabled.toString());
    setIsBiometricEnabled(enabled);
  };

  const setPasscode = async (passcode: string | null) => {
    if (passcode) {
      await SecureStore.setItemAsync(PASSCODE_ENABLED_KEY, 'true');
      await SecureStore.setItemAsync(PASSCODE_VALUE_KEY, passcode);
      setIsPasscodeEnabled(true);
      setAppPasscode(passcode);
    } else {
      await SecureStore.setItemAsync(PASSCODE_ENABLED_KEY, 'false');
      await SecureStore.deleteItemAsync(PASSCODE_VALUE_KEY);
      setIsPasscodeEnabled(false);
      setAppPasscode(null);
    }
  };

  const saveSecretCode = async (roomId: string, code: string, contactName: string) => {
    const newVault = { 
      ...vault, 
      [roomId]: { code, name: contactName, updatedAt: Date.now() } 
    };
    await SecureStore.setItemAsync(VAULT_KEY, JSON.stringify(newVault));
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
      appPasscode, 
      toggleBiometrics, 
      setPasscode,
      isAppLocked,
      setIsAppLocked,
      hasHardware,
      saveSecretCode,
      getSecretCode,
      vault,
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
