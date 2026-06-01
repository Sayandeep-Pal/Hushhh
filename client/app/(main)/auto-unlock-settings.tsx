import { StyleSheet, Text, View, Switch, TouchableOpacity, TextInput, ScrollView, Alert, Platform, Modal, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSecurity } from '../../context/SecurityContext';
import { useTheme } from '../../hooks/useTheme';
import { useMemo, useState } from 'react';

export default function AutoUnlockSettingsScreen() {
  const { 
    vault,
    autoUnlockGlobal,
    autoUnlockConfig,
    toggleAutoUnlockGlobal,
    updateContactAutoUnlock
  } = useSecurity();
  
  const router = useRouter();
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [showAutoUnlockModal, setShowAutoUnlockModal] = useState(false);

  const durations = [
    { label: '5 Minutes', value: 5 },
    { label: '30 Minutes', value: 30 },
    { label: '1 Hour', value: 60 },
    { label: '24 Hours', value: 1440 },
    { label: 'Always', value: -1 },
  ];

  const filteredContacts = useMemo(() => {
    return Object.keys(vault).filter(roomId => 
      vault[roomId].name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [vault, searchQuery]);

  const openAutoUnlockSettings = (roomId: string) => {
    setSelectedRoomId(roomId);
    setShowAutoUnlockModal(true);
  };

  const handleToggleContactAutoUnlock = (roomId: string, value: boolean) => {
    const current = autoUnlockConfig[roomId] || { enabled: false, duration: 60 };
    updateContactAutoUnlock(roomId, value, current.duration);
  };

  const handleSetDuration = (duration: number) => {
    if (selectedRoomId) {
      const current = autoUnlockConfig[selectedRoomId] || { enabled: true, duration: 60 };
      updateContactAutoUnlock(selectedRoomId, current.enabled, duration);
      setShowAutoUnlockModal(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Auto-Unlock</Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={styles.content}>
        <View style={styles.section}>
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Ionicons name="flash-outline" size={24} color={theme.text} />
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingLabel}>Master Auto-Unlock</Text>
                <Text style={styles.settingDescription}>Enable or disable the feature for all contacts.</Text>
              </View>
            </View>
            <Switch
              value={autoUnlockGlobal}
              onValueChange={toggleAutoUnlockGlobal}
              trackColor={{ false: theme.border, true: theme.primary }}
              thumbColor={Platform.OS === 'ios' ? undefined : theme.surface}
            />
          </View>
        </View>

        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={20} color={theme.textTertiary} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search contacts..."
            placeholderTextColor={theme.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
          />
        </View>

        <FlatList
          data={filteredContacts}
          keyExtractor={item => item}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              {searchQuery ? 'No matching contacts found.' : 'No contacts in your vault yet.'}
            </Text>
          }
          renderItem={({ item: roomId }) => {
            const config = autoUnlockConfig[roomId] || { enabled: false, duration: 60 };
            const durationLabel = durations.find(d => d.value === config.duration)?.label || '1 Hour';
            
            return (
              <View style={styles.contactItem}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.contactName}>{vault[roomId].name}</Text>
                  <TouchableOpacity 
                    onPress={() => openAutoUnlockSettings(roomId)}
                    disabled={!autoUnlockGlobal}
                    style={{ opacity: autoUnlockGlobal ? 1 : 0.5 }}
                  >
                    <Text style={styles.contactDuration}>
                      {config.enabled ? `Timer: ${durationLabel}` : 'Tap to set timer'}
                    </Text>
                  </TouchableOpacity>
                </View>
                <Switch
                  value={config.enabled}
                  disabled={!autoUnlockGlobal}
                  onValueChange={(value) => handleToggleContactAutoUnlock(roomId, value)}
                  trackColor={{ false: theme.border, true: theme.secondary }}
                  thumbColor={Platform.OS === 'ios' ? undefined : theme.surface}
                />
              </View>
            );
          }}
        />
      </View>

      {/* Auto-Unlock Duration Modal */}
      {showAutoUnlockModal && (
        <Modal transparent animationType="fade" visible={showAutoUnlockModal}>
          <TouchableOpacity 
            style={styles.modalOverlay} 
            activeOpacity={1} 
            onPress={() => setShowAutoUnlockModal(false)}
          >
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Auto-Unlock Timer</Text>
              <Text style={styles.modalSubtitle}>Stay unlocked for this contact after manual entry.</Text>
              
              {durations.map((d) => (
                <TouchableOpacity 
                  key={d.value} 
                  style={styles.durationOption}
                  onPress={() => handleSetDuration(d.value)}
                >
                  <Text style={[
                    styles.durationOptionText,
                    autoUnlockConfig[selectedRoomId!]?.duration === d.value && { color: theme.primary, fontWeight: '800' }
                  ]}>
                    {d.label}
                  </Text>
                  {autoUnlockConfig[selectedRoomId!]?.duration === d.value && (
                    <Ionicons name="checkmark-circle" size={20} color={theme.primary} />
                  )}
                </TouchableOpacity>
              ))}
              
              <TouchableOpacity 
                style={styles.closeBtn}
                onPress={() => setShowAutoUnlockModal(false)}
              >
                <Text style={styles.closeBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      )}
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
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: theme.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.text,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    backgroundColor: theme.surface,
    borderRadius: 20,
    padding: 15,
    marginVertical: 15,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  settingTextContainer: {
    marginLeft: 12,
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderRadius: 15,
    paddingHorizontal: 15,
    height: 50,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: theme.border,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: theme.text,
    fontWeight: '500',
  },
  listContent: {
    paddingBottom: 20,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 15,
    backgroundColor: theme.surface,
    borderRadius: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.border,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.text,
  },
  contactDuration: {
    fontSize: 12,
    color: theme.primary,
    fontWeight: '600',
    marginTop: 2,
  },
  emptyText: {
    color: theme.textTertiary,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 40,
    fontStyle: 'italic',
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
  closeBtn: {
    backgroundColor: theme.background,
    width: '100%',
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 15,
  },
  closeBtnText: {
    color: theme.text,
    fontWeight: '700',
    fontSize: 15,
  },
});
