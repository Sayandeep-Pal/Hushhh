import React, { useState, useEffect, useRef, useMemo } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, Modal, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../context/AuthContext';
import { useSocket } from '../../../context/SocketContext';
import { encryptMessage, decryptMessage, deriveKey } from '../../../utils/security';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { useTheme } from '../../../hooks/useTheme';

interface Message {
  id: string;
  senderId: string;
  payload: string; // Emoji string
  text?: string;   // Decrypted text (local only)
  timestamp: string;
}

import { handleError, getErrorMessage } from '../../../utils/error-handler';

export default function ChatRoomScreen() {
  const { id, name } = useLocalSearchParams<{ id: string, name: string }>();
  const { user } = useAuth();
  const { socket, isConnected, setActiveRoomId } = useSocket();
  const router = useRouter();
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [secretCode, setSecretCode] = useState('');
  const [isLocked, setIsLocked] = useState(true);
  const [encryptionKey, setEncryptionKey] = useState<string | null>(null);
  const [showCodeModal, setShowCodeModal] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (id) {
      setActiveRoomId(id);
      return () => setActiveRoomId(null);
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      fetchMessageHistory();
    }
  }, [id, encryptionKey]);

  const fetchMessageHistory = async () => {
    setIsRefreshing(true);
    try {
      const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://172.17.0.1:3000';
      const response = await axios.get(`${API_URL}/api/messages/${id}`);
      
      const decryptedMessages = response.data.map((msg: any) => {
        let decryptedText = undefined;
        if (encryptionKey) {
          try {
            decryptedText = decryptMessage(msg.payload, encryptionKey);
          } catch (e) {
            // Decryption failed with current key
          }
        }

        return {
          id: msg.id,
          senderId: msg.senderId,
          payload: msg.payload,
          text: decryptedText,
          timestamp: new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
      });
      
      setMessages(decryptedMessages);
    } catch (e) {
      console.error('Failed to fetch messages', e);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (socket) {
      socket.emit('join_room', id);

      const handleMsg = (data: any) => {
        if (data.type === 'KEY_CHANGE') {
          handleKeyChangeEvent(data);
        } else {
          handleIncomingMessage(data);
        }
      };

      socket.on('receive_message', handleMsg);

      return () => {
        socket.off('receive_message', handleMsg);
      };
    }
  }, [socket, encryptionKey, id]);

  const handleKeyChangeEvent = (data: any) => {
    const newMessage: Message = {
      id: Date.now().toString(),
      senderId: 'SYSTEM',
      payload: '⚠️',
      text: `Alert: ${data.senderName} has updated the Secret Code. You must update yours to continue reading.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setMessages(prev => [...prev, newMessage]);
    setIsLocked(true);
    setEncryptionKey(null);
    setShowCodeModal(true);
  };

  const handleUnlock = () => {
    if (!secretCode) return;
    
    try {
      const salt = 'funchat_secret_salt'; 
      const key = deriveKey(secretCode, salt);
      
      setEncryptionKey(key);
      setIsLocked(false);
      setShowCodeModal(false);

      if (!isLocked) {
        socket?.emit('send_message', {
          roomId: id,
          senderId: user?.id,
          senderName: user?.username,
          type: 'KEY_CHANGE',
          payload: '🔑'
        });
      }
    } catch (e) {
      console.error('Handshake failed:', e);
      Alert.alert('Handshake Error', 'Secure key derivation failed. Try a different code.');
    }
  };

  const handleIncomingMessage = (data: any) => {
    // Prevent double message for sender (don't add if it's from me)
    if (data.senderId === user?.id) return;

    let decryptedText = undefined;
    if (encryptionKey) {
      try {
        decryptedText = decryptMessage(data.payload, encryptionKey);
      } catch (e) {
        // Fail silently
      }
    }

    const newMessage: Message = {
      id: data.id || Date.now().toString(),
      senderId: data.senderId,
      payload: data.payload,
      text: decryptedText,
      timestamp: data.createdAt ? new Date(data.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setMessages(prev => [...prev, newMessage]);
  };

  const sendMessage = () => {
    if (!inputText || !encryptionKey) return;
    
    if (!socket || !isConnected) {
      Alert.alert('Connection Lost', 'You are currently offline. Please wait for reconnection.');
      return;
    }

    try {
      const emojiPayload = encryptMessage(inputText, encryptionKey);
      const messageData = {
        roomId: id,
        senderId: user?.id,
        payload: emojiPayload
      };

      socket.emit('send_message', messageData);
      
      const newMessage: Message = {
        id: Date.now().toString(),
        senderId: user?.id!,
        payload: emojiPayload,
        text: inputText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, newMessage]);
      setInputText('');
    } catch (e) {
      handleError(e, 'Transmission Failed');
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    if (item.senderId === 'SYSTEM') {
      return (
        <View style={styles.systemMessageContainer}>
          <View style={styles.systemMessageBadge}>
            <Text style={styles.systemMessageText}>{item.text}</Text>
          </View>
        </View>
      );
    }

    const isMe = item.senderId === user?.id;
    return (
      <View style={[styles.messageWrapper, isMe ? styles.myMessageWrapper : styles.theirMessageWrapper]}>
        <View style={[styles.messageBubble, isMe ? styles.myBubble : styles.theirBubble]}>
          <Text style={[styles.messageText, isMe ? styles.myMessageText : styles.theirMessageText]}>
            {item.text || item.payload}
          </Text>
          {item.text ? (
            <Text style={[styles.maskIndicator, isMe ? {color: 'rgba(255,255,255,0.7)'} : {color: theme.textTertiary}]}>
              ✨ Decrypted
            </Text>
          ) : (
            <Text style={[styles.maskIndicator, {color: theme.textTertiary}]}>
              🔒 Encrypted Emojis
            </Text>
          )}
        </View>
        <Text style={styles.messageTime}>{item.timestamp}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={28} color={theme.accent} />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.headerName}>{name}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={[styles.statusDot, { backgroundColor: isConnected ? theme.secondary : theme.primary }]} />
              <Text style={styles.headerStatus}>
                {isConnected ? (isLocked ? 'Content Encrypted' : 'Secure Connection') : 'Connecting...'}
              </Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => {
            if (!isLocked) {
              // Relock or change code
              setIsLocked(true);
              setEncryptionKey(null);
              setSecretCode('');
            }
            setShowCodeModal(true);
          }}>
            <Ionicons 
              name={isLocked ? "lock-closed" : "shield-checkmark"} 
              size={24} 
              color={isLocked ? theme.primary : theme.secondary} 
            />
          </TouchableOpacity>
        </View>

        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
          onLayout={() => flatListRef.current?.scrollToEnd()}
        />

        {/* InputArea */}
        {!isLocked && (
          <View style={styles.inputArea}>
            <TextInput
              style={styles.input}
              placeholder="Type a message..."
              placeholderTextColor={theme.textTertiary}
              value={inputText}
              onChangeText={setInputText}
              multiline
            />
            <TouchableOpacity style={styles.sendButton} onPress={sendMessage}>
              <Ionicons name="send" size={24} color="#FFF" />
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>

      {/* Secret Code Modal */}
      <Modal visible={showCodeModal} transparent animationType="slide">
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalEmoji}>🔒</Text>
            <Text style={styles.modalTitle}>Enter Secret Code</Text>
            <Text style={styles.modalSubtitle}>
              Both you and {name} must use the same code to unlock this chat.
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. BlueDragon2026"
              placeholderTextColor={theme.textTertiary}
              value={secretCode}
              onChangeText={setSecretCode}
              secureTextEntry
              autoFocus
            />
            <TouchableOpacity style={styles.unlockButton} onPress={handleUnlock}>
              <Text style={styles.unlockButtonText}>Unlock Chat</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
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
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: theme.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  headerInfo: {
    flex: 1,
    marginLeft: 15,
  },
  headerName: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.text,
  },
  headerStatus: {
    fontSize: 12,
    color: theme.textSecondary,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  messageList: {
    padding: 20,
    paddingBottom: 40,
  },
  messageWrapper: {
    marginBottom: 16,
    maxWidth: '80%',
  },
  myMessageWrapper: {
    alignSelf: 'flex-end',
  },
  theirMessageWrapper: {
    alignSelf: 'flex-start',
  },
  messageBubble: {
    padding: 12,
    borderRadius: 18,
  },
  myBubble: {
    backgroundColor: theme.primary,
    borderBottomRightRadius: 4,
  },
  theirBubble: {
    backgroundColor: theme.surface,
    borderBottomLeftRadius: 4,
    shadowColor: theme.cardShadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  myMessageText: {
    color: '#FFF',
  },
  theirMessageText: {
    color: theme.text,
  },
  maskIndicator: {
    fontSize: 10,
    marginTop: 4,
    opacity: 0.7,
    fontStyle: 'italic',
  },
  messageTime: {
    fontSize: 10,
    color: theme.textTertiary,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  inputArea: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: theme.surface,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  input: {
    flex: 1,
    backgroundColor: theme.background,
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    fontSize: 16,
    maxHeight: 100,
    color: theme.text,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  systemMessageContainer: {
    alignItems: 'center',
    marginVertical: 20,
    paddingHorizontal: 20,
  },
  systemMessageBadge: {
    backgroundColor: theme.background,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
  },
  systemMessageText: {
    fontSize: 12,
    color: theme.primary,
    fontWeight: '700',
    textAlign: 'center',
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
    borderRadius: 30,
    padding: 30,
    alignItems: 'center',
  },
  modalEmoji: {
    fontSize: 60,
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: theme.text,
    marginBottom: 10,
  },
  modalSubtitle: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  modalInput: {
    width: '100%',
    height: 60,
    backgroundColor: theme.background,
    borderRadius: 15,
    paddingHorizontal: 20,
    fontSize: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: theme.border,
    color: theme.text,
  },
  unlockButton: {
    width: '100%',
    height: 60,
    backgroundColor: theme.primary,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: theme.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  unlockButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
  },
});
