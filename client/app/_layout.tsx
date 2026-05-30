import { Stack, useRouter, useSegments } from "expo-router";
import { AuthProvider, useAuth } from "../context/AuthContext";
import { SocketProvider } from "../context/SocketContext";
import { SecurityProvider, useSecurity } from "../context/SecurityContext";
import { ThemeProvider, DarkTheme, DefaultTheme } from "@react-navigation/native";
import { useColorScheme, View, Text, TouchableOpacity, AppState, TextInput, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState, useRef } from "react";
import * as Notifications from 'expo-notifications';
import * as LocalAuthentication from 'expo-local-authentication';
import { Ionicons } from "@expo/vector-icons";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function LockScreen() {
  const { isBiometricEnabled, isPasscodeEnabled, appPasscode, setIsAppLocked } = useSecurity();
  const [passcodeInput, setPasscodeInput] = useState('');
  const [error, setError] = useState(false);

  const authenticateBiometrics = async () => {
    if (!isBiometricEnabled) return;
    
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock Hush',
      fallbackLabel: 'Use App Passcode',
    });

    if (result.success) {
      setIsAppLocked(false);
    }
  };

  const handlePasscodeSubmit = () => {
    if (passcodeInput === appPasscode) {
      setIsAppLocked(false);
    } else {
      setError(true);
      setPasscodeInput('');
      setTimeout(() => setError(false), 2000);
    }
  };

  useEffect(() => {
    if (isBiometricEnabled) {
      authenticateBiometrics();
    }
  }, [isBiometricEnabled]);

  return (
    <View style={styles.lockContainer}>
      <Ionicons name="shield-lock" size={80} color="#FF6B6B" />
      <Text style={styles.lockTitle}>Hush Locked</Text>
      
      {isPasscodeEnabled && (
        <View style={styles.passcodeSection}>
          <Text style={styles.passcodeLabel}>Enter App Passcode</Text>
          <TextInput
            style={[styles.passcodeInput, error && { borderColor: '#FF6B6B' }]}
            value={passcodeInput}
            onChangeText={setPasscodeInput}
            secureTextEntry
            keyboardType="number-pad"
            maxLength={6}
            onSubmitEditing={handlePasscodeSubmit}
            placeholder="••••••"
            placeholderTextColor="#707070"
          />
          <TouchableOpacity onPress={handlePasscodeSubmit} style={styles.unlockButton}>
            <Text style={styles.unlockButtonText}>Unlock</Text>
          </TouchableOpacity>
        </View>
      )}

      {isBiometricEnabled && (
        <TouchableOpacity 
          onPress={authenticateBiometrics}
          style={styles.bioButton}
        >
          <Ionicons name="finger-print" size={24} color="#FFF" />
          <Text style={styles.bioButtonText}>Use Biometrics</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function NavigationGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const { isAppLocked, setIsAppLocked, isBiometricEnabled, isPasscodeEnabled } = useSecurity();
  const segments = useSegments();
  const router = useRouter();
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        if (isBiometricEnabled || isPasscodeEnabled) {
          setIsAppLocked(true);
        }
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [isBiometricEnabled, isPasscodeEnabled]);

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === "(auth)";

    if (!user && !inAuthGroup) {
      router.replace("/(auth)/login");
    } else if (user && inAuthGroup) {
      router.replace("/(main)");
    }
  }, [user, isLoading, segments]);

  if (isAppLocked && (isBiometricEnabled || isPasscodeEnabled)) {
    return <LockScreen />;
  }

  return <>{children}</>;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <AuthProvider>
      <SecurityProvider>
        <SocketProvider>
          <NavigationGuard>
            <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
              <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="index" options={{ headerShown: false }} />
                <Stack.Screen name="(auth)" options={{ headerShown: false }} />
                <Stack.Screen name="(main)" options={{ headerShown: false }} />
              </Stack>
            </ThemeProvider>
          </NavigationGuard>
        </SocketProvider>
      </SecurityProvider>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  lockContainer: {
    flex: 1,
    backgroundColor: '#0F0F12',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  lockTitle: {
    color: '#FFF',
    fontSize: 28,
    fontWeight: '900',
    marginTop: 20,
    marginBottom: 40,
  },
  passcodeSection: {
    width: '100%',
    alignItems: 'center',
  },
  passcodeLabel: {
    color: '#A0A0A0',
    marginBottom: 15,
    fontSize: 16,
    fontWeight: '600',
  },
  passcodeInput: {
    width: '80%',
    height: 60,
    backgroundColor: '#1C1C21',
    borderRadius: 15,
    textAlign: 'center',
    color: '#FFF',
    fontSize: 24,
    letterSpacing: 10,
    borderWidth: 1,
    borderColor: '#2A2A30',
    marginBottom: 20,
  },
  unlockButton: {
    backgroundColor: '#FF6B6B',
    paddingHorizontal: 40,
    paddingVertical: 15,
    borderRadius: 20,
    width: '80%',
    alignItems: 'center',
  },
  unlockButtonText: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 18,
  },
  bioButton: {
    marginTop: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bioButtonText: {
    color: '#FF6B6B',
    fontWeight: '700',
    fontSize: 16,
  }
});
