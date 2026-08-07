import React, { useMemo } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';

export default function HowToUseScreen() {
  const router = useRouter();
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const steps = [
    {
      icon: 'finger-print-outline',
      title: 'Secure Identity',
      description: 'Your codename is your public face. Your discriminator (#XXXXXX) makes you unique. Share your QR code or link with trusted allies only.'
    },
    {
      icon: 'lock-closed-outline',
      title: 'Secret Codes (E2EE)',
      description: 'Every chat needs a "Secret Code". Both you and your partner must enter the EXACT SAME code to unlock messages. These codes never touch our servers.'
    },
    {
      icon: 'eye-off-outline',
      title: 'Stealth Mode',
      description: 'Messages are hidden inside unique carrier icons using invisible steganography. Even if someone sees your screen, they only see these icons unless the chat is unlocked.'
    },
    {
      icon: 'key-outline',
      title: 'The Vault',
      description: 'The app remembers the codes you set for each ally and stores them in your local Secure Vault. If you clear app data, these keys are lost forever.'
    },
    {
      icon: 'shield-checkmark-outline',
      title: 'App Lock',
      description: 'Enable Biometrics or a Passcode in Settings to prevent unauthorized physical access to your messages.'
    }
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => {
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace('/(main)/(tabs)');
          }
        }} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.title}>How to use Hush</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.introCard}>
          <Text style={styles.introEmoji}>🤫</Text>
          <Text style={styles.introText}>
            Welcome to Hush. You are entering a zone of absolute privacy. Here is how to maintain your cover.
          </Text>
        </View>

        {steps.map((step, index) => (
          <View key={index} style={styles.stepItem}>
            <View style={[styles.iconContainer, { backgroundColor: theme.accent + '20' }]}>
              <Ionicons name={step.icon as any} size={24} color={theme.accent} />
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>{step.title}</Text>
              <Text style={styles.stepDescription}>{step.description}</Text>
            </View>
          </View>
        ))}

        <View style={styles.warningBox}>
          <Ionicons name="warning-outline" size={20} color="#FF6B6B" />
          <Text style={styles.warningText}>
            Hush does not have a &quot;Forgot Password&quot; feature. Your Secret Codes are yours alone. If you lose them, your messages cannot be recovered.
          </Text>
        </View>
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
  scrollContent: {
    padding: 20,
  },
  introCard: {
    backgroundColor: theme.surface,
    borderRadius: 25,
    padding: 25,
    alignItems: 'center',
    marginBottom: 30,
    shadowColor: theme.cardShadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  introEmoji: {
    fontSize: 40,
    marginBottom: 15,
  },
  introText: {
    fontSize: 16,
    color: theme.text,
    textAlign: 'center',
    lineHeight: 24,
    fontWeight: '600',
  },
  stepItem: {
    flexDirection: 'row',
    marginBottom: 25,
    gap: 15,
  },
  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.text,
    marginBottom: 5,
  },
  stepDescription: {
    fontSize: 14,
    color: theme.textSecondary,
    lineHeight: 20,
  },
  warningBox: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    padding: 20,
    borderRadius: 20,
    marginTop: 10,
    marginBottom: 30,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.3)',
    gap: 15,
  },
  warningText: {
    flex: 1,
    color: '#FF6B6B',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 20,
  },
});
