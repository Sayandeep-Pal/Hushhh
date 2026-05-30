import React, { useState, useMemo } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';

export default function OnboardingScreen() {
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const { signInAnonymously } = useAuth();
  const router = useRouter();
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const handleStart = async () => {
    if (!username || username.length < 3) {
      Alert.alert('Invalid Username', 'Please choose a username with at least 3 characters.');
      return;
    }
    
    setLoading(true);
    try {
      await signInAnonymously(username);
      router.replace('/(main)');
    } catch (e: any) {
      console.error('Onboarding Error:', e);
      Alert.alert('Identity Error', e.message || 'Could not create your secret identity.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Text style={styles.logoText}>🕵️‍♂️</Text>
          </View>
          <Text style={styles.title}>VeilChat</Text>
          <Text style={styles.subtitle}>
            Enter your codename to start chatting securely. No passwords, no emails.
          </Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <Ionicons name="terminal-outline" size={20} color={theme.textSecondary} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="e.g. Agent_Shadow"
              placeholderTextColor={theme.textTertiary}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              editable={!loading}
              maxLength={20}
            />
          </View>

          <TouchableOpacity 
            style={[styles.button, loading && { opacity: 0.7 }]} 
            onPress={handleStart}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={theme.surface} />
            ) : (
              <Text style={styles.buttonText}>Enter The Chat</Text>
            )}
          </TouchableOpacity>

          <View style={styles.privacyNote}>
            <Ionicons name="shield-checkmark-outline" size={14} color={theme.textTertiary} />
            <Text style={styles.privacyText}>
              Your identity is stored securely on this device.
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoContainer: {
    width: 90,
    height: 90,
    borderRadius: 30,
    backgroundColor: theme.surface,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: theme.cardShadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 5,
    marginBottom: 20,
  },
  logoText: {
    fontSize: 45,
  },
  title: {
    fontSize: 36,
    fontWeight: '900',
    color: theme.text,
    letterSpacing: -1,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: theme.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  form: {
    width: '100%',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderRadius: 20,
    marginBottom: 20,
    paddingHorizontal: 20,
    height: 70,
    shadowColor: theme.cardShadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
    borderWidth: 1,
    borderColor: theme.borderLight,
  },
  inputIcon: {
    marginRight: 15,
  },
  input: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: theme.text,
  },
  button: {
    backgroundColor: theme.accent,
    height: 70,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: theme.cardShadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 5,
  },
  buttonText: {
    color: theme.surface,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  privacyNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    gap: 6,
  },
  privacyText: {
    color: theme.textTertiary,
    fontSize: 12,
    fontWeight: '500',
  },
});
