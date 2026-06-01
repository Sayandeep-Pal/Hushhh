import { StyleSheet, Text, View, Switch, TouchableOpacity, TextInput, ScrollView, Alert, KeyboardAvoidingView, Platform, ActivityIndicator, Image, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSecurity } from '../../../context/SecurityContext';
import { useAuth } from '../../../context/AuthContext';
import { useTheme } from '../../../hooks/useTheme';
import { Avatar } from '../../../components/Avatar';
import { useMemo, useState } from 'react';

export default function SettingsScreen() {
  const { 
    isBiometricEnabled, 
    isPasscodeEnabled, 
    appPasscode, 
    toggleBiometrics, 
    setPasscode,
    hasHardware
  } = useSecurity();
  const { profile, signInAnonymously, signOut } = useAuth();
  
  const router = useRouter();
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [isPasscodeModalVisible, setIsPasscodeModalVisible] = useState(false);
  const [newPasscode, setNewPasscode] = useState('');
  const [confirmPasscode, setConfirmPasscode] = useState('');

  const [newCodename, setNewCodename] = useState(profile?.username.split('#')[0] || '');
  const [currentAvatarSeed, setCurrentAvatarSeed] = useState(profile?.avatarSeed || profile?.username || '');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  const handleShuffleAvatar = () => {
    const newSeed = Math.random().toString(36).substring(7);
    setCurrentAvatarSeed(newSeed);
  };

  const handleUpdateProfile = async () => {
    if (!newCodename || newCodename.length < 3) {
      Alert.alert('Invalid Codename', 'Please enter at least 3 characters.');
      return;
    }

    setIsUpdatingProfile(true);
    try {
      await signInAnonymously(newCodename, currentAvatarSeed);
      Alert.alert('Success', 'Your identity has been updated.');
    } catch (error: any) {
      Alert.alert('Update Failed', error.message || 'Could not update your profile.');
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handlePasscodeToggle = async (value: boolean) => {
    if (value) {
      setIsPasscodeModalVisible(true);
    } else {
      Alert.alert(
        'Disable Passcode',
        'Are you sure you want to disable the app passcode?',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Disable', 
            style: 'destructive', 
            onPress: () => setPasscode(null) 
          }
        ]
      );
    }
  };

  const saveNewPasscode = async () => {
    if (newPasscode.length < 4) {
      Alert.alert('Invalid Passcode', 'Passcode must be at least 4 digits.');
      return;
    }
    if (newPasscode !== confirmPasscode) {
      Alert.alert('Mismatch', 'Passcodes do not match.');
      return;
    }

    try {
      await setPasscode(newPasscode);
      setIsPasscodeModalVisible(false);
      setNewPasscode('');
      setConfirmPasscode('');
      Alert.alert('Success', 'App passcode has been set.');
    } catch (error: any) {
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
        <TouchableOpacity onPress={signOut} style={styles.logoutButton}>
          <Ionicons name="log-out-outline" size={24} color={theme.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Agent Profile</Text>
          
          <View style={styles.avatarSection}>
            <View style={styles.largeAvatarWrapper}>
              <Avatar name={profile?.username || 'Agent'} seed={currentAvatarSeed} size={100} />
            </View>
            <TouchableOpacity style={styles.shuffleButton} onPress={handleShuffleAvatar}>
              <Ionicons name="refresh" size={20} color="#FFF" />
              <Text style={styles.shuffleButtonText}>Shuffle Avatar</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.warningBox}>
            <Ionicons name="warning-outline" size={20} color="#FF6B6B" />
            <Text style={styles.warningText}>
              IMPORTANT: Your Secret Codes and messages are stored LOCALLY on this device. If you clear app data or uninstall, they will be PERMANENTLY lost.
            </Text>
          </View>
          <View style={styles.profileInputContainer}>
            <View style={styles.inputWrapper}>
              <Ionicons name="person-outline" size={20} color={theme.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.profileInput}
                value={newCodename}
                onChangeText={setNewCodename}
                placeholder="Edit Codename"
                placeholderTextColor={theme.textTertiary}
                autoCapitalize="none"
              />
              <Text style={styles.discriminatorDisplay}>#{profile?.username.split('#')[1]}</Text>
            </View>
            <TouchableOpacity 
              style={[styles.saveProfileButton, isUpdatingProfile && { opacity: 0.7 }]} 
              onPress={handleUpdateProfile}
              disabled={isUpdatingProfile}
            >
              {isUpdatingProfile ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <Text style={styles.saveProfileButtonText}>Save Changes</Text>
              )}
            </TouchableOpacity>
          </View>
          <Text style={styles.profileNote}>Your unique ID stays the same when you change your name.</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferences</Text>
          
          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => router.push('/(main)/auto-unlock-settings')}
          >
            <View style={styles.settingInfo}>
              <Ionicons name="flash-outline" size={24} color={theme.text} />
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingLabel}>Auto-Unlock Chat</Text>
                <Text style={styles.settingDescription}>Manage automatic decryption and timers.</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.textTertiary} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => router.push('/(main)/vault')}
          >
            <View style={styles.settingInfo}>
              <Ionicons name="key-outline" size={24} color={theme.text} />
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingLabel}>Secret Code Vault</Text>
                <Text style={styles.settingDescription}>View and manage all your conversation keys.</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.textTertiary} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.menuItem, { borderBottomWidth: 0 }]}
            onPress={() => router.push('/(main)/how-to-use')}
          >
            <View style={styles.settingInfo}>
              <Ionicons name="help-circle-outline" size={24} color={theme.text} />
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingLabel}>How to use Hush</Text>
                <Text style={styles.settingDescription}>Guide to identity, E2EE, and stealth mode.</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.textTertiary} />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>App Lock</Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Ionicons name="finger-print-outline" size={24} color={theme.text} />
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingLabel}>Biometric Lock</Text>
                <Text style={styles.settingDescription}>
                  {hasHardware ? 'Use Fingerprint or FaceID to unlock.' : 'Not supported on this device.'}
                </Text>
              </View>
            </View>
            <Switch
              value={isBiometricEnabled}
              onValueChange={toggleBiometrics}
              disabled={!hasHardware}
              trackColor={{ false: theme.border, true: theme.secondary }}
              thumbColor={Platform.OS === 'ios' ? undefined : theme.surface}
            />
          </View>

          <View style={[styles.settingItem, { borderBottomWidth: 0 }]}>
            <View style={styles.settingInfo}>
              <Ionicons name="keypad-outline" size={24} color={theme.text} />
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingLabel}>App Passcode</Text>
                <Text style={styles.settingDescription}>
                  Require a numeric code to open the app.
                </Text>
              </View>
            </View>
            <Switch
              value={isPasscodeEnabled}
              onValueChange={handlePasscodeToggle}
              trackColor={{ false: theme.border, true: theme.secondary }}
              thumbColor={Platform.OS === 'ios' ? undefined : theme.surface}
            />
          </View>
        </View>

        {isPasscodeModalVisible && (
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.passcodeForm}
          >
            <Text style={styles.formTitle}>Set App Passcode</Text>
            <TextInput
              style={styles.input}
              placeholder="New Passcode (4-6 digits)"
              placeholderTextColor={theme.textTertiary}
              value={newPasscode}
              onChangeText={setNewPasscode}
              keyboardType="number-pad"
              maxLength={6}
              secureTextEntry
            />
            <TextInput
              style={styles.input}
              placeholder="Confirm Passcode"
              placeholderTextColor={theme.textTertiary}
              value={confirmPasscode}
              onChangeText={setConfirmPasscode}
              keyboardType="number-pad"
              maxLength={6}
              secureTextEntry
            />
            <View style={styles.formButtons}>
              <TouchableOpacity 
                style={[styles.formButton, { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }]}
                onPress={() => setIsPasscodeModalVisible(false)}
              >
                <Text style={[styles.formButtonText, { color: theme.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.formButton, { backgroundColor: theme.primary }]}
                onPress={saveNewPasscode}
              >
                <Text style={styles.formButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
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
    paddingHorizontal: 24,
    paddingTop: 20,
    marginBottom: 20,
  },
  logoutButton: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: theme.surface,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: theme.cardShadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: theme.text,
  },
  scrollContent: {
    padding: 20,
  },
  section: {
    backgroundColor: theme.surface,
    borderRadius: 25,
    padding: 20,
    marginBottom: 25,
    shadowColor: theme.cardShadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 20,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 25,
  },
  profileInputContainer: {
    gap: 15,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.background,
    borderRadius: 15,
    paddingHorizontal: 15,
    height: 60,
    borderWidth: 1,
    borderColor: theme.border,
  },
  inputIcon: {
    marginRight: 10,
  },
  profileInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
  },
  discriminatorDisplay: {
    fontSize: 14,
    color: theme.textTertiary,
    fontWeight: '700',
    marginLeft: 5,
  },
  saveProfileButton: {
    backgroundColor: theme.secondary,
    height: 55,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: theme.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  saveProfileButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
  },
  profileNote: {
    fontSize: 12,
    color: theme.textTertiary,
    marginTop: 15,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  settingItem: {
    alignItems: 'center',
    marginBottom: 25,
  },
  largeAvatarWrapper: {
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  shuffleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 8,
  },
  shuffleButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  warningBox: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    padding: 15,
    borderRadius: 15,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.3)',
    gap: 12,
  },
  warningText: {
    flex: 1,
    color: '#FF6B6B',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
  },
  vaultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  vaultContact: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.text,
  },
  vaultCode: {
    fontSize: 14,
    color: theme.primary,
    fontWeight: '700',
    marginTop: 2,
  },
  vaultDate: {
    fontSize: 11,
    color: theme.textTertiary,
    fontWeight: '500',
  },
  emptyVaultText: {
    color: theme.textTertiary,
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
    paddingVertical: 10,
  },
  contactRuleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  contactRuleName: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.text,
  },
  contactRuleDuration: {
    fontSize: 12,
    color: theme.primary,
    fontWeight: '600',
    marginTop: 2,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  settingTextContainer: {
    marginLeft: 15,
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.text,
  },
  settingDescription: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 2,
  },
  passcodeForm: {
    backgroundColor: theme.surface,
    borderRadius: 25,
    padding: 25,
    marginTop: 10,
    shadowColor: theme.cardShadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 5,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.text,
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    height: 60,
    backgroundColor: theme.background,
    borderRadius: 15,
    paddingHorizontal: 20,
    fontSize: 16,
    color: theme.text,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: theme.border,
  },
  formButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
  },
  formButton: {
    flex: 1,
    height: 55,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  formButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    backgroundColor: theme.surface,
    borderRadius: 25,
    padding: 25,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.text,
    marginBottom: 10,
  },
  modalSubtitle: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
  },
  durationOption: {
    width: '100%',
    paddingVertical: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  durationOptionText: {
    fontSize: 16,
    color: theme.text,
    fontWeight: '600',
  },
});
