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
}

const SecurityContext = createContext<SecurityContextType | undefined>(undefined);

const BIOMETRIC_KEY = 'security_biometric_enabled';
const PASSCODE_ENABLED_KEY = 'security_passcode_enabled';
const PASSCODE_VALUE_KEY = 'security_app_passcode';

export const SecurityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isBiometricEnabled, setIsBiometricEnabled] = useState(false);
  const [isPasscodeEnabled, setIsPasscodeEnabled] = useState(false);
  const [appPasscode, setAppPasscode] = useState<string | null>(null);
  const [isAppLocked, setIsAppLocked] = useState(true);
  const [hasHardware, setHasHardware] = useState(false);

  useEffect(() => {
    const initSecurity = async () => {
      try {
        const hardware = await LocalAuthentication.hasHardwareAsync();
        setHasHardware(hardware);

        const biometricStored = await SecureStore.getItemAsync(BIOMETRIC_KEY);
        const passcodeEnabledStored = await SecureStore.getItemAsync(PASSCODE_ENABLED_KEY);
        const passcodeStored = await SecureStore.getItemAsync(PASSCODE_VALUE_KEY);

        setIsBiometricEnabled(biometricStored === 'true');
        setIsPasscodeEnabled(passcodeEnabledStored === 'true');
        setAppPasscode(passcodeStored);

        // If no security enabled, start unlocked
        if (biometricStored !== 'true' && passcodeEnabledStored !== 'true') {
          setIsAppLocked(false);
        }
      } catch (e) {
        console.error('Security init failed', e);
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

  return (
    <SecurityContext.Provider value={{ 
      isBiometricEnabled, 
      isPasscodeEnabled, 
      appPasscode, 
      toggleBiometrics, 
      setPasscode,
      isAppLocked,
      setIsAppLocked,
      hasHardware
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
