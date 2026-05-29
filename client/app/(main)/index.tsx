import React, { useState, useEffect, useMemo } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, TextInput, ActivityIndicator, Modal, Share, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import * as Linking from 'expo-linking';
import QRCode from 'react-native-qrcode-svg';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://172.17.0.1:3000';

import { handleError, getErrorMessage } from '../../utils/error-handler';
import { useSocket } from '@/context/SocketContext';
import { useTheme } from '../../hooks/useTheme';

export default function ChatListScreen() {
  const { user, profile, signOut } = useAuth();
  const { isConnected } = useSocket();
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showIdentityModal, setShowIdentityModal] = useState(false);
  const router = useRouter();
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  // Handle Deep Links
  useEffect(() => {
    const handleDeepLink = async (event: { url: string }) => {
      const { path, queryParams } = Linking.parse(event.url);
      console.log('Deep link received:', path, queryParams);
      
      if (path === 'connect' && queryParams?.id) {
        connectToUser(queryParams.id as string, queryParams.name as string);
      }
    };

    const sub = Linking.addEventListener('url', handleDeepLink);
    
    // Check if app was opened via link
    Linking.getInitialURL().then(url => {
      if (url) handleDeepLink({ url });
    });

    return () => sub.remove();
  }, []);

  const connectToUser = async (targetId: string, targetName?: string) => {
    if (targetId === user?.id) {
      Alert.alert('Mirror Reality', "You can't chat with yourself... yet.");
      return;
    }

    try {
      let name = targetName;
      if (!name) {
        // Use the new dedicated endpoint to fetch the secret agent's name
        const response = await axios.get(`${API_URL}/api/users/${targetId}`);
        name = response.data.username;
      }

      const roomId = [user?.id, targetId].sort().join('_');
      router.push({ 
        pathname: '/(main)/chat/[id]', 
        params: { id: roomId, name: name || 'Secret Agent' } 
      });
    } catch (e) {
      console.error('Failed to connect via link', e);
      handleError(e, 'Connection Failed');
    }
  };

  useEffect(() => {
    if (search.length > 2) {
      const delayDebounceFn = setTimeout(() => {
        performSearch();
      }, 500);

      return () => clearTimeout(delayDebounceFn);
    } else {
      setSearchResults([]);
    }
  }, [search]);

  const performSearch = async () => {
    if (!search || search.length <= 2) return;
    setIsLoading(true);
    try {
      const response = await axios.get(`${API_URL}/api/users/search?query=${search}`);
      // Filter out the current user by ID to avoid chatting with yourself in search results
      const filtered = response.data.filter((u: any) => u.id !== user?.id);
      setSearchResults(filtered);
    } catch (e) {
      console.error('Search failed', e);
      // Fail silently to avoid interrupting user input
    } finally {
      setIsLoading(false);
    }
  };

  const shareMyIdentity = async () => {
    const connectUrl = Linking.createURL('connect', {
      queryParams: { id: user?.id, name: profile?.username },
    });
    
    try {
      await Share.share({
        message: `Connect with me on Fun Chat! My codename is ${profile?.username}. Scan my QR or click here: ${connectUrl}`,
        url: connectUrl, // iOS only
      });
    } catch (e) {
      console.error('Sharing failed', e);
    }
  };

  const renderUserItem = ({ item }: { item: any }) => (
    <TouchableOpacity 
      style={styles.chatCard}
      onPress={() => {
        const roomId = [user?.id, item.id].sort().join('_');
        router.push({ 
          pathname: '/(main)/chat/[id]', 
          params: { id: roomId, name: item.username } 
        });
      }}
    >
      <View style={[styles.avatar, { backgroundColor: theme.accent }]}>
        <Text style={styles.avatarText}>{item.username[0].toUpperCase()}</Text>
      </View>
      <View style={styles.chatInfo}>
        <Text style={styles.chatName}>{item.username}</Text>
        <Text style={styles.lastEmoji}>Found via Global Search</Text>
      </View>
      <Ionicons name="finger-print-outline" size={20} color={theme.accent} />
    </TouchableOpacity>
  );

  const connectUrl = Linking.createURL('connect', {
    queryParams: { id: user?.id, name: profile?.username },
  });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={[styles.statusDot, { backgroundColor: isConnected ? theme.secondary : theme.primary }]} />
            <Text style={styles.greeting}>{isConnected ? 'Agent active' : 'Offline'}</Text>
          </View>
          <Text style={styles.headerTitle}>{profile?.username || 'Anonymous'}</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => setShowIdentityModal(true)} style={styles.actionButton}>
            <Ionicons name="qr-code-outline" size={24} color={theme.accent} />
          </TouchableOpacity>
          <TouchableOpacity onPress={signOut} style={styles.actionButton}>
            <Ionicons name="log-out-outline" size={24} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={theme.textTertiary} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Global Search (Codenames)"
          placeholderTextColor={theme.textTertiary}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <FlatList
        data={searchResults}
        renderItem={renderUserItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          search.length > 2 ? (
            <Text style={styles.sectionTitle}>Global Intelligence Results</Text>
          ) : (
            <View style={styles.welcomeContainer}>
              <View style={styles.secretBriefing}>
                <Text style={styles.briefingTitle}>Mission Briefing 📂</Text>
                <Text style={styles.briefingText}>
                  1. Search for codenames to find allies.{"\n"}
                  2. Share your QR to connect privately.{"\n"}
                  3. Use a Secret Code inside chats to unlock encryption.
                </Text>
              </View>
            </View>
          )
        }
        ListEmptyComponent={
          search.length > 2 && !isLoading ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>🕵️‍♂️</Text>
              <Text style={styles.emptyText}>Target not found in registry.</Text>
            </View>
          ) : null
        }
        ListFooterComponent={isLoading ? <ActivityIndicator color={theme.accent} style={{ marginTop: 20 }} /> : null}
      />

      {/* Identity Modal */}
      <Modal visible={showIdentityModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <TouchableOpacity 
              style={styles.closeModal} 
              onPress={() => setShowIdentityModal(false)}
            >
              <Ionicons name="close" size={28} color={theme.accent} />
            </TouchableOpacity>
            
            <Text style={styles.modalTitle}>Your Secret Identity</Text>
            <Text style={styles.modalSubtitle}>Share this QR or link with trusted allies only.</Text>
            
            <View style={styles.qrContainer}>
              <QRCode
                value={connectUrl}
                size={200}
                color={theme.qrForeground}
                backgroundColor={theme.qrBackground}
              />
            </View>
            
            <Text style={styles.codenameText}>{profile?.username}</Text>
            
            <TouchableOpacity style={styles.shareButton} onPress={shareMyIdentity}>
              <Ionicons name="share-social-outline" size={20} color="#FFF" />
              <Text style={styles.shareButtonText}>Share Connection Link</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  greeting: {
    fontSize: 12,
    color: theme.text,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 2,
    opacity: 0.5,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: theme.text,
    letterSpacing: -1,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    width: 50,
    height: 50,
    borderRadius: 18,
    backgroundColor: theme.surface,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: theme.cardShadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    marginHorizontal: 24,
    paddingHorizontal: 16,
    height: 60,
    borderRadius: 20,
    marginBottom: 24,
    shadowColor: theme.cardShadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
    borderWidth: 1,
    borderColor: theme.borderLight,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.text,
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  welcomeContainer: {
    marginTop: 20,
  },
  secretBriefing: {
    backgroundColor: theme.surface,
    padding: 24,
    borderRadius: 25,
    borderLeftWidth: 8,
    borderLeftColor: theme.accent,
    shadowColor: theme.cardShadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  briefingTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: theme.text,
    marginBottom: 12,
  },
  briefingText: {
    fontSize: 15,
    color: theme.textSecondary,
    lineHeight: 24,
    fontWeight: '500',
  },
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  chatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    padding: 16,
    borderRadius: 22,
    marginBottom: 16,
    shadowColor: theme.cardShadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    borderWidth: 1,
    borderColor: theme.border,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
  },
  chatInfo: {
    flex: 1,
  },
  chatName: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.text,
  },
  lastEmoji: {
    fontSize: 13,
    color: theme.textTertiary,
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 60,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    color: theme.textTertiary,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: theme.modalOverlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    backgroundColor: theme.surface,
    borderRadius: 35,
    padding: 30,
    alignItems: 'center',
  },
  closeModal: {
    alignSelf: 'flex-end',
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: theme.text,
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
    marginBottom: 30,
    fontWeight: '500',
  },
  qrContainer: {
    padding: 20,
    backgroundColor: '#FFF',
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 5,
    marginBottom: 20,
  },
  codenameText: {
    fontSize: 22,
    fontWeight: '900',
    color: theme.text,
    marginBottom: 30,
    letterSpacing: 2,
  },
  shareButton: {
    flexDirection: 'row',
    width: '100%',
    height: 65,
    backgroundColor: theme.accent,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  shareButtonText: {
    color: theme.surface,
    fontSize: 16,
    fontWeight: '800',
  },
});
