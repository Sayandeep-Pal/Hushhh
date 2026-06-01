import React, { useMemo, useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as LocalAuthentication from 'expo-local-authentication';
import { useSecurity } from '../../context/SecurityContext';
import { useTheme } from '../../hooks/useTheme';
import { Avatar } from '../../components/Avatar';

export default function VaultScreen() {
  const { vault, isBiometricEnabled, isPasscodeEnabled } = useSecurity();
  const router = useRouter();
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const isSecurityEnabled = isBiometricEnabled || isPasscodeEnabled;

  const authenticate = async () => {
    if (!isSecurityEnabled) return;
    
    setIsAuthenticating(true);
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock Secret Vault',
        fallbackLabel: 'Use App Passcode',
      });

      if (result.success) {
        setIsAuthenticated(true);
      }
    } catch (error) {
      Alert.alert('Authentication Error', 'Could not verify identity.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  useEffect(() => {
    if (isSecurityEnabled) {
      authenticate();
    }
  }, [isSecurityEnabled]);

  const copyToClipboard = async (code: string, id: string) => {
    await Clipboard.setStringAsync(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const vaultEntries = Object.entries(vault).sort((a, b) => b[1].updatedAt - a[1].updatedAt);

  if (!isSecurityEnabled) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.replace('/(main)')} style={styles.backButton}>
            <Ionicons name="chevron-back" size={28} color={theme.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Secret Vault</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.lockedContainer}>
          <Ionicons name="shield-outline" size={80} color={theme.primary} />
          <Text style={styles.lockedTitle}>Vault Insecure</Text>
          <Text style={styles.lockedText}>
            To protect your secret keys, you must enable Biometric Lock or an App Passcode in Settings.
          </Text>
          <TouchableOpacity 
            style={styles.settingsButton}
            onPress={() => router.push('/(main)/(tabs)/settings')}
          >
            <Text style={styles.settingsButtonText}>Go to Settings</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.replace('/(main)')} style={styles.backButton}>
            <Ionicons name="chevron-back" size={28} color={theme.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Secret Vault</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.lockedContainer}>
          <Ionicons name="lock-closed-outline" size={80} color={theme.textTertiary} />
          <Text style={styles.lockedTitle}>Vault Locked</Text>
          <Text style={styles.lockedText}>
            Identity verification is required to access your encryption keys.
          </Text>
          <TouchableOpacity 
            style={styles.unlockButton}
            onPress={authenticate}
            disabled={isAuthenticating}
          >
            <Text style={styles.unlockButtonText}>
              {isAuthenticating ? 'Verifying...' : 'Unlock Vault'}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => {
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace('/(main)');
          }
        }} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Secret Vault</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.warningBox}>
          <Ionicons name="shield-checkmark" size={24} color={theme.secondary} />
          <Text style={styles.warningText}>
            These codes are stored only on this device. They are required to decrypt your conversations.
          </Text>
        </View>

        {vaultEntries.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="key-outline" size={80} color={theme.textTertiary} />
            <Text style={styles.emptyTitle}>Vault is Empty</Text>
            <Text style={styles.emptyText}>Codes will appear here once you unlock a chat.</Text>
          </View>
        ) : (
          vaultEntries.map(([roomId, data]) => (
            <View key={roomId} style={styles.vaultCard}>
              <View style={styles.cardHeader}>
                <Avatar name={data.name} size={40} />
                <View style={styles.contactInfo}>
                  <Text style={styles.contactName}>{data.name}</Text>
                  <Text style={styles.updatedAt}>Updated {new Date(data.updatedAt).toLocaleDateString()}</Text>
                </View>
              </View>
              
              <View style={styles.codeContainer}>
                <Text style={styles.codeLabel}>Active Secret Code:</Text>
                <View style={styles.codeRow}>
                  <Text style={styles.codeText}>{data.code}</Text>
                  <TouchableOpacity 
                    style={[styles.copyButton, copiedId === roomId && { backgroundColor: theme.secondary }]} 
                    onPress={() => copyToClipboard(data.code, roomId)}
                  >
                    <Ionicons 
                      name={copiedId === roomId ? "checkmark" : "copy-outline"} 
                      size={20} 
                      color="#FFF" 
                    />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: theme.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: theme.text,
  },
  lockedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  lockedTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: theme.text,
    marginTop: 20,
    marginBottom: 12,
  },
  lockedText: {
    fontSize: 16,
    color: theme.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 30,
    fontWeight: '500',
  },
  settingsButton: {
    backgroundColor: theme.primary,
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 18,
  },
  settingsButtonText: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 16,
  },
  unlockButton: {
    backgroundColor: theme.accent,
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 18,
  },
  unlockButtonText: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 16,
  },
  scrollContent: {
    padding: 20,
  },
  warningBox: {
    flexDirection: 'row',
    backgroundColor: theme.surface,
    padding: 20,
    borderRadius: 20,
    marginBottom: 30,
    alignItems: 'center',
    gap: 15,
    borderWidth: 1,
    borderColor: theme.border,
  },
  warningText: {
    flex: 1,
    color: theme.textSecondary,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 60,
    opacity: 0.5,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.text,
    marginTop: 20,
  },
  emptyText: {
    fontSize: 14,
    color: theme.textSecondary,
    marginTop: 8,
    textAlign: 'center',
  },
  vaultCard: {
    backgroundColor: theme.surface,
    borderRadius: 25,
    padding: 20,
    marginBottom: 20,
    shadowColor: theme.cardShadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 15,
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.text,
  },
  updatedAt: {
    fontSize: 12,
    color: theme.textTertiary,
    marginTop: 2,
  },
  codeContainer: {
    backgroundColor: theme.background,
    padding: 15,
    borderRadius: 15,
  },
  codeLabel: {
    fontSize: 12,
    color: theme.textSecondary,
    fontWeight: '700',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  codeText: {
    fontSize: 20,
    fontWeight: '900',
    color: theme.primary,
    letterSpacing: 1,
  },
  copyButton: {
    backgroundColor: theme.primary,
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
