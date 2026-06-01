import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, TextInput, ActivityIndicator, Modal, Share, Alert, Image, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../context/AuthContext';
import axios from 'axios';
import * as Linking from 'expo-linking';
import QRCode from 'react-native-qrcode-svg';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://172.17.0.1:3000';

import { handleError, getErrorMessage } from '../../../utils/error-handler';
import { useSocket } from '@/context/SocketContext';
import { useTheme } from '../../../hooks/useTheme';
import { Avatar } from '../../../components/Avatar';

export default function ChatListScreen() {
  const { user, profile, signOut, token } = useAuth();
  const { isConnected, socket } = useSocket();
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [recentChats, setRecentChats] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showIdentityModal, setShowIdentityModal] = useState(false);
  const [shareSecretCode, setShareSecretCode] = useState('');
  const router = useRouter();
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const fetchData = async () => {
    if (!token) return;
    try {
      const recentRes = await axios.get(`${API_URL}/api/users/recent`);
      setRecentChats(recentRes.data);
    } catch (error: any) {
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [token])
  );

  useEffect(() => {
    fetchData();
  }, [token]);

  useEffect(() => {
    if (socket) {
      const handleStatusChange = () => {
        fetchData();
      };

      const handleMessage = (data: any) => {
        // Add a small delay to ensure the backend has finished saving to DB 
        // before we fetch the updated list
        setTimeout(() => {
          fetchData();
        }, 500);
      };

      const handleRead = () => {
        fetchData();
      };

      socket.on('user_status_change', handleStatusChange);
      socket.on('receive_message', handleMessage);
      socket.on('messages_read', handleRead);

      return () => {
        socket.off('user_status_change', handleStatusChange);
        socket.off('receive_message', handleMessage);
        socket.off('messages_read', handleRead);
      };
    }
  }, [socket]);

  const connectToUser = async (targetId: string, targetName?: string, sharedCode?: string) => {
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
        params: { 
          id: roomId, 
          name: name || 'Secret Agent',
          sharedCode: sharedCode || ''
        } 
      });
    } catch (error: any) {
      handleError(error, 'Connection Failed');
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
    } catch (error: any) {
    } finally {
      setIsLoading(false);
    }
  };

  const shareMyIdentity = async () => {
    const trimmedCode = shareSecretCode.trim();
    if (!trimmedCode) {
      Alert.alert('Security Required', 'Please set a Secret Code to encrypt your identity before sharing.');
      return;
    }

    const finalUrl = Linking.createURL('connect', {
      queryParams: { 
        id: user?.id, 
        name: profile?.username,
        code: trimmedCode
      },
    });
    
    try {
      await Share.share({
        message: `Connect with me on Hushhh! My codename is ${profile?.username}. I've set a secure code for our chat. Scan my QR or click: ${finalUrl}`,
        url: finalUrl,
      });
    } catch (e) {
    }
  };

  const formatLastSeenCompact = (isOnline: boolean, lastSeen?: string) => {
    if (isOnline) return 'Online';
    if (!lastSeen) return '';
    
    const date = new Date(lastSeen);
    const now = new Date();
    const diffInSecs = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSecs < 60) return 'now';
    if (diffInSecs < 3600) return `${Math.floor(diffInSecs / 60)}m`;
    if (diffInSecs < 86400) return `${Math.floor(diffInSecs / 3600)}h`;
    return `${Math.floor(diffInSecs / 86400)}d`;
  };

  const renderUserItem = ({ item }: { item: any }) => {
    const [base, disc] = item.username.split('#');
    const status = formatLastSeenCompact(item.isOnline, item.lastSeen);
    
    return (
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
        <View style={styles.avatarWrapper}>
          <Avatar name={item.username} seed={item.avatarSeed} size={50} />
          {item.isOnline && <View style={styles.onlineBadge} />}
        </View>
        <View style={styles.chatInfo}>
          <Text style={styles.chatName}>
            {base}
            {disc && <Text style={styles.discriminator}>#{disc}</Text>}
          </Text>
          <Text style={styles.lastEmoji} numberOfLines={1}>
            <Text style={{ color: item.isOnline ? theme.secondary : theme.textTertiary, fontWeight: '700' }}>
              {status}{status ? ' • ' : ''}
            </Text>
            {item.lastMessage || 'No records yet'}
          </Text>
        </View>
        <View style={styles.chatMeta}>
          <View style={styles.badgeRow}>
            {Number(item.unreadCount) > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadCountText}>
                  {Number(item.unreadCount) > 9 ? '9+' : item.unreadCount}
                </Text>
              </View>
            )}
            <Ionicons name="finger-print-outline" size={20} color={item.isOnline ? theme.secondary : theme.accent} />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const connectUrl = Linking.createURL('connect', {
    queryParams: { 
      id: user?.id, 
      name: profile?.username,
      code: shareSecretCode || undefined 
    },
  });

  const displayData = search.length > 2 ? searchResults : recentChats;
  const [profileBase, profileDisc] = (profile?.username || 'Anonymous').split('#');

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={[styles.statusDot, { backgroundColor: isConnected ? theme.secondary : theme.primary }]} />
            <Text style={styles.greeting}>{isConnected ? 'Agent active' : 'Offline'}</Text>
          </View>
          <Text style={styles.headerTitle}>Chats</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => setShowIdentityModal(true)} style={styles.actionButton}>
            <Ionicons name="qr-code-outline" size={24} color={theme.accent} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={theme.textTertiary} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search via Codenames"
          placeholderTextColor={theme.textTertiary}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <FlatList
        data={displayData}
        renderItem={renderUserItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <>
            {search.length > 2 ? (
              <Text style={styles.sectionTitle}>Search Results</Text>
            ) : (
              recentChats.length > 0 ? (
                <Text style={styles.sectionTitle}>Recent Encounters</Text>
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
            )}
          </>
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
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalKeyboardAvoiding}
          >
            <View style={styles.modalContent}>
              <TouchableOpacity 
                style={styles.closeModal} 
                onPress={() => setShowIdentityModal(false)}
              >
                <Ionicons name="close" size={28} color={theme.accent} />
              </TouchableOpacity>
              
              <ScrollView 
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.modalScrollContent}
              >
                <Text style={styles.modalTitle}>Your Secret Identity</Text>
                <Text style={styles.modalSubtitle}>Share this QR or link with trusted allies only.</Text>
                
                <View style={styles.modalAvatarWrapper}>
                  <Avatar name={profile?.username || 'Anonymous'} seed={profile?.avatarSeed} size={80} />
                </View>

                <View style={styles.shareCodeInputContainer}>
                  <Text style={styles.shareCodeLabel}>Step 1: Set a Secret Code</Text>
                  <TextInput
                    style={styles.shareCodeInput}
                    placeholder="e.g. MySecret123"
                    placeholderTextColor={theme.textTertiary}
                    value={shareSecretCode}
                    onChangeText={setShareSecretCode}
                    autoCapitalize="none"
                  />
                  <Text style={styles.shareCodeHint}>This code is required to generate your secure QR identity.</Text>
                </View>

                {shareSecretCode ? (
                  <View style={styles.qrContainer}>
                    <QRCode
                      value={connectUrl}
                      size={200}
                      color={theme.qrForeground}
                      backgroundColor={theme.qrBackground}
                    />
                  </View>
                ) : (
                  <View style={[styles.qrContainer, { backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }]}>
                    <Ionicons name="lock-closed" size={60} color={theme.textTertiary} />
                    <Text style={{ color: theme.textTertiary, marginTop: 10, fontWeight: '700', textAlign: 'center' }}>
                      Enter a code above{"\n"}to unlock your QR
                    </Text>
                  </View>
                )}
                
                <Text style={styles.codenameText}>
                  {profileBase}
                  {profileDisc && <Text style={styles.modalDiscriminator}>#{profileDisc}</Text>}
                </Text>
                
                <TouchableOpacity 
                  style={[styles.shareButton, !shareSecretCode && { opacity: 0.5 }]} 
                  onPress={shareMyIdentity}
                  disabled={!shareSecretCode}
                >
                  <Ionicons name="share-social-outline" size={20} color="#FFF" />
                  <Text style={styles.shareButtonText}>
                    {shareSecretCode ? 'Share Connection Link' : 'Locked'}
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
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
  headerDiscriminator: {
    fontSize: 16,
    color: theme.textTertiary,
    fontWeight: '500',
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
  avatarWrapper: {
    marginRight: 16,
    position: 'relative',
  },
  chatInfo: {
    flex: 1,
  },
  chatMeta: {
    justifyContent: 'center',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  unreadBadge: {
    backgroundColor: theme.primary,
    minWidth: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    shadowColor: theme.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  unreadCountText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '900',
  },
  chatName: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.text,
  },
  discriminator: {
    fontSize: 13,
    color: theme.textTertiary,
    fontWeight: '500',
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
    padding: 20,
  },
  modalKeyboardAvoiding: {
    width: '100%',
    maxHeight: '90%',
  },
  modalContent: {
    width: '100%',
    backgroundColor: theme.surface,
    borderRadius: 35,
    padding: 20,
    paddingTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  modalScrollContent: {
    alignItems: 'center',
    paddingBottom: 20,
  },
  closeModal: {
    alignSelf: 'flex-end',
    padding: 10,
  },
  modalTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: theme.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
    fontWeight: '500',
    paddingHorizontal: 10,
  },
  modalAvatarWrapper: {
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  shareCodeInputContainer: {
    width: '100%',
    marginBottom: 20,
  },
  shareCodeLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.text,
    marginBottom: 8,
  },
  shareCodeInput: {
    height: 55,
    backgroundColor: theme.background,
    borderRadius: 15,
    paddingHorizontal: 15,
    fontSize: 16,
    color: theme.text,
    borderWidth: 1,
    borderColor: theme.border,
  },
  shareCodeHint: {
    fontSize: 11,
    color: theme.textTertiary,
    marginTop: 6,
    fontStyle: 'italic',
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
    width: 240,
    height: 240,
    justifyContent: 'center',
    alignItems: 'center',
  },
  codenameText: {
    fontSize: 22,
    fontWeight: '900',
    color: theme.text,
    marginBottom: 30,
    letterSpacing: 2,
    textAlign: 'center',
  },
  modalDiscriminator: {
    fontSize: 14,
    color: theme.textTertiary,
    fontWeight: '500',
    letterSpacing: 0,
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
