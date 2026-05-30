import React, { createContext, useContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';

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
}

const SecurityContext = createContext<SecurityContextType | undefined>(undefined);

const BIOMETRIC_KEY = 'security_biometric_enabled';
const PASSCODE_ENABLED_KEY = 'security_passcode_enabled';
const PASSCODE_VALUE_KEY = 'security_app_passcode';
const VAULT_KEY = 'security_secret_vault';

export const SecurityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isBiometricEnabled, setIsBiometricEnabled] = useState(false);
  const [isPasscodeEnabled, setIsPasscodeEnabled] = useState(false);
  const [appPasscode, setAppPasscode] = useState<string | null>(null);
  const [isAppLocked, setIsAppLocked] = useState(true);
  const [hasHardware, setHasHardware] = useState(false);
  const [vault, setVault] = useState<Record<string, { code: string, name: string, updatedAt: number }>>({});

  useEffect(() => {
    const initSecurity = async () => {
      try {
        const hardware = await LocalAuthentication.hasHardwareAsync();
        setHasHardware(hardware);

        const biometricStored = await SecureStore.getItemAsync(BIOMETRIC_KEY);
        const passcodeEnabledStored = await SecureStore.getItemAsync(PASSCODE_ENABLED_KEY);
        const passcodeStored = await SecureStore.getItemAsync(PASSCODE_VALUE_KEY);
        const vaultStored = await SecureStore.getItemAsync(VAULT_KEY);

        setIsBiometricEnabled(biometricStored === 'true');
        setIsPasscodeEnabled(passcodeEnabledStored === 'true');
        setAppPasscode(passcodeStored);
        
        if (vaultStored) {
          setVault(JSON.parse(vaultStored));
        }

        // If no security enabled, start unlocked
        if (biometricStored !== 'true' && passcodeEnabledStored !== 'true') {
          setIsAppLocked(false);
        }
      } catch (error: any) {
        console.log("ERROR", error);
        console.log("RESPONSE", error?.response?.data);
        console.log("MESSAGE", error?.message);
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
      vault
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
