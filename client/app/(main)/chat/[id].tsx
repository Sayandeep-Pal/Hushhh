import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, Modal, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../context/AuthContext';
import { useSocket } from '../../../context/SocketContext';
import { encryptMessage, decryptMessage, deriveKey } from '../../../utils/security';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';

interface Message {
  id: string;
  senderId: string;
  payload: string; // Emoji string
  text?: string;   // Decrypted text (local only)
  timestamp: string;
}

export default function ChatRoomScreen() {
  const { id, name } = useLocalSearchParams<{ id: string, name: string }>();
  const { user } = useAuth();
  const { socket } = useSocket();
  const router = useRouter();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [secretCode, setSecretCode] = useState('');
  const [isLocked, setIsLocked] = useState(true);
  const [encryptionKey, setEncryptionKey] = useState<string | null>(null);
  const [showCodeModal, setShowCodeModal] = useState(true);

  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (id) {
      fetchMessageHistory();
    }
  }, [id, encryptionKey]);

  const fetchMessageHistory = async () => {
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
      // Use a simple string salt for CryptoJS
      const salt = 'funchat_secret_salt'; 
      const key = deriveKey(secretCode, salt);
      
      setEncryptionKey(key);
      setIsLocked(false);
      setShowCodeModal(false);

      // Notify the other user if we explicitly clicked "Change Code" (isLocked was false)
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
    let decryptedText = undefined;
    if (encryptionKey) {
      try {
        decryptedText = decryptMessage(data.payload, encryptionKey);
      } catch (e) {
        // Fail silently, show emojis
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
    if (!inputText || !encryptionKey || !socket) return;

    const emojiPayload = encryptMessage(inputText, encryptionKey);
    const messageData = {
      roomId: id,
      senderId: user?.id,
      payload: emojiPayload
    };

    socket.emit('send_message', messageData);
    
    // Add locally
    const newMessage: Message = {
      id: Date.now().toString(),
      senderId: user?.id!,
      payload: emojiPayload,
      text: inputText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setMessages(prev => [...prev, newMessage]);
    setInputText('');
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
            <Text style={[styles.maskIndicator, isMe ? {color: 'rgba(255,255,255,0.7)'} : {color: '#999'}]}>
              ✨ Decrypted
            </Text>
          ) : (
            <Text style={[styles.maskIndicator, {color: '#999'}]}>
              🔒 Encrypted Emojis
            </Text>
          )}
        </View>
        <Text style={styles.messageTime}>{item.timestamp}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={28} color="#1A1A1A" />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerName}>{name}</Text>
          <Text style={styles.headerStatus}>{isLocked ? '🔒 Content Encrypted' : '🛡️ Secure Connection'}</Text>
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
            color={isLocked ? "#FF6B6B" : "#4ECDC4"} 
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
      />

      {/* Input */}
      {!isLocked && (
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          <View style={styles.inputArea}>
            <TextInput
              style={styles.input}
              placeholder="Type a message..."
              value={inputText}
              onChangeText={setInputText}
              multiline
            />
            <TouchableOpacity style={styles.sendButton} onPress={sendMessage}>
              <Ionicons name="send" size={24} color="#FFF" />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}

      {/* Secret Code Modal */}
      <Modal visible={showCodeModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalEmoji}>🔒</Text>
            <Text style={styles.modalTitle}>Enter Secret Code</Text>
            <Text style={styles.modalSubtitle}>
              Both you and {name} must use the same code to unlock this chat.
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. BlueDragon2026"
              value={secretCode}
              onChangeText={setSecretCode}
              secureTextEntry
              autoFocus
            />
            <TouchableOpacity style={styles.unlockButton} onPress={handleUnlock}>
              <Text style={styles.unlockButtonText}>Unlock Chat</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FE',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  headerInfo: {
    flex: 1,
    marginLeft: 15,
  },
  headerName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  headerStatus: {
    fontSize: 12,
    color: '#666',
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
    backgroundColor: '#FF6B6B',
    borderBottomRightRadius: 4,
  },
  theirBubble: {
    backgroundColor: '#FFF',
    borderBottomLeftRadius: 4,
    shadowColor: '#000',
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
    color: '#1A1A1A',
  },
  maskIndicator: {
    fontSize: 10,
    marginTop: 4,
    opacity: 0.7,
    fontStyle: 'italic',
    color: 'inherit',
  },
  messageTime: {
    fontSize: 10,
    color: '#999',
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  inputArea: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  input: {
    flex: 1,
    backgroundColor: '#F8F9FE',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    fontSize: 16,
    maxHeight: 100,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FF6B6B',
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
    backgroundColor: '#FFF0F0',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFDADA',
  },
  systemMessageText: {
    fontSize: 12,
    color: '#FF6B6B',
    fontWeight: '700',
    textAlign: 'center',
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
    backgroundColor: '#FFF',
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
    color: '#1A1A1A',
    marginBottom: 10,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  modalInput: {
    width: '100%',
    height: 60,
    backgroundColor: '#F8F9FE',
    borderRadius: 15,
    paddingHorizontal: 20,
    fontSize: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#EEE',
  },
  unlockButton: {
    width: '100%',
    height: 60,
    backgroundColor: '#FF6B6B',
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF6B6B',
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
