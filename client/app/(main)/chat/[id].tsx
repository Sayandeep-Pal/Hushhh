import React, { useState, useEffect, useRef, useMemo } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, Modal, Alert, Image, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../context/AuthContext';
import { useSocket } from '../../../context/SocketContext';
import { useSecurity } from '../../../context/SecurityContext';
import { encryptMessage, decryptMessage, deriveKey } from '../../../utils/security';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { useTheme } from '../../../hooks/useTheme';
import { Avatar } from '../../../components/Avatar';

interface Message {
  id: string;
  senderId: string;
  payload: string; // Icon string with hidden data
  text?: string;   // Decrypted text (local only)
  isOldKey?: boolean;
  timestamp: string;
}

import { handleError, getErrorMessage } from '../../../utils/error-handler';

export default function ChatRoomScreen() {
  const { id, name, sharedCode } = useLocalSearchParams<{ id: string, name: string, sharedCode?: string }>();
  const { user } = useAuth();
  const { socket, isConnected, setActiveRoomId } = useSocket();
  const { 
    saveSecretCode, 
    vault, 
    autoUnlockGlobal, 
    autoUnlockConfig, 
    recordAutoUnlock 
  } = useSecurity();
  const router = useRouter();
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  
  const [targetProfile, setTargetProfile] = useState<any>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [secretCode, setSecretCode] = useState('');
  const [isLocked, setIsLocked] = useState(!sharedCode);
  const [encryptionKey, setEncryptionKey] = useState<string | null>(null);
  const [previousKey, setPreviousKey] = useState<string | null>(null);
  const [candidateKey, setCandidateKey] = useState<string | null>(null);
  const [candidateSecretCode, setCandidateSecretCode] = useState<string | null>(null);
  const [isWaitingForApproval, setIsWaitingForApproval] = useState(false);
  const [showCodeModal, setShowCodeModal] = useState(!sharedCode);
  const [showKeyRequest, setShowKeyRequest] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [pendingKeyRequest, setPendingKeyRequest] = useState<any>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRespondingToHandshake, setIsRespondingToHandshake] = useState(false);
  
  // Selection state
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [showActionMenu, setShowActionMenu] = useState(false);
  
  // Presence and Typing states
  const [isOtherUserOnline, setIsOtherUserOnline] = useState(false);
  const [isOtherUserTyping, setIsOtherUserTyping] = useState(false);
  const [isMeTyping, setIsMeTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const flatListRef = useRef<FlatList>(null);

  // Keep track if we have EVER had a key this session
  const [hasDerivedKeyOnce, setHasDerivedKeyOnce] = useState(false);

  // Auto-unlock logic based on user preferences and timer
  useEffect(() => {
    if (id && vault[id] && !encryptionKey && isLocked && !sharedCode && autoUnlockGlobal) {
      const config = autoUnlockConfig[id];
      if (config && config.enabled) {
        let shouldAutoUnlock = false;
        
        if (config.duration === -1) {
          // Always auto-unlock
          shouldAutoUnlock = true;
        } else if (config.lastUnlockedAt) {
          // Check if timer has expired
          const now = Date.now();
          const expiryTime = config.lastUnlockedAt + (config.duration * 60 * 1000);
          if (now < expiryTime) {
            shouldAutoUnlock = true;
          }
        }

        if (shouldAutoUnlock) {
          try {
            const storedCode = vault[id].code;
            const salt = 'funchat_secret_salt';
            const key = deriveKey(storedCode, salt);
            setEncryptionKey(key);
            setIsLocked(false);
            setShowCodeModal(false);
            setHasDerivedKeyOnce(true);
          } catch (e) {}
        }
      }
    }
  }, [id, vault, sharedCode, autoUnlockGlobal, autoUnlockConfig]);

  // Auto-apply shared code if provided
  useEffect(() => {
    if (sharedCode && !encryptionKey && isLocked) {
      try {
        const salt = 'funchat_secret_salt';
        const key = deriveKey(sharedCode, salt);
        setEncryptionKey(key);
        setIsLocked(false);
        setShowCodeModal(false);
        setHasDerivedKeyOnce(true);
        
        // Add a system message to inform about the shared code
        const systemMsg: Message = {
          id: 'shared-code-init-' + Date.now(),
          senderId: 'SYSTEM',
          payload: '🛡️',
          text: `Secure channel established using a shared code.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setMessages(prev => [systemMsg, ...prev]);
      } catch (e) {
      }
    }
  }, [sharedCode]);

  const otherUserId = useMemo(() => {
    if (!id || !user?.id) return null;
    return id.split('_').find(uId => uId !== user.id);
  }, [id, user?.id]);

  useEffect(() => {
    const fetchTargetProfile = async () => {
      if (!otherUserId) return;
      try {
        const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://172.17.0.1:3000';
        const response = await axios.get(`${API_URL}/api/users/${otherUserId}`);
        setTargetProfile(response.data);
        setIsOtherUserOnline(response.data.isOnline);
      } catch (error: any) {
      }
      };
      fetchTargetProfile();
      }, [otherUserId]);

  useEffect(() => {
    if (id) {
      setActiveRoomId(id);
      markMessagesAsRead();
      return () => setActiveRoomId(null);
    }
  }, [id]);

  const markMessagesAsRead = async () => {
    try {
      const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://172.17.0.1:3000';
      const response = await axios.post(`${API_URL}/api/messages/read/${id}`);
    } catch (error: any) {
    }
  };

  useEffect(() => {
    if (id) {
      fetchMessageHistory();
    }
  }, [id, encryptionKey, previousKey]);

  const fetchMessageHistory = async () => {
    setIsRefreshing(true);
    try {
      const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://172.17.0.1:3000';
      const response = await axios.get(`${API_URL}/api/messages/${id}`);
      
      const decryptedMessages = response.data.map((msg: any) => {
        let decryptedText = undefined;
        let isOldKey = false;
        
        if (encryptionKey) {
          try {
            decryptedText = decryptMessage(msg.payload, encryptionKey);
          } catch (e) {}
        }

        if ((!decryptedText || decryptedText === 'FINGERPRINT_MISMATCH') && previousKey) {
          try {
            const oldDecrypted = decryptMessage(msg.payload, previousKey);
            if (oldDecrypted && oldDecrypted !== 'FINGERPRINT_MISMATCH' && !oldDecrypted.startsWith('(－‸－)')) {
              decryptedText = oldDecrypted;
              isOldKey = true;
            }
          } catch (e) {}
        }

        return {
          id: msg.id,
          senderId: msg.senderId,
          payload: msg.payload,
          text: decryptedText,
          isOldKey,
          timestamp: new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
      });
      
      setMessages(decryptedMessages);
    } catch (error: any) {
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (socket) {
      socket.emit('join_room', id);

      const handleStatusChange = (data: any) => {
        if (data.userId === otherUserId) {
          setIsOtherUserOnline(data.status === 'online');
        }
      };

      const handleTyping = (data: any) => {
        if (data.userId !== user?.id && data.roomId === id) {
          setIsOtherUserTyping(true);
        }
      };

      const handleStopTyping = (data: any) => {
        if (data.userId !== user?.id && data.roomId === id) {
          setIsOtherUserTyping(false);
        }
      };

      const handleMsg = (data: any) => {
        if (data.type === 'KEY_CHANGE_REQUEST') {
          if (data.senderId === user?.id) return; // Don't show request banner to self
          setPendingKeyRequest(data);
          setShowKeyRequest(true);
        } else if (data.type === 'KEY_CHANGE_ACCEPTED') {
          if (data.senderId !== user?.id && isWaitingForApproval) {
            // The other person accepted my request
            setPreviousKey(encryptionKey);
            setEncryptionKey(candidateKey);
            
            // Save newly accepted code to vault
            if (id && name && candidateSecretCode) {
              saveSecretCode(id, candidateSecretCode, name);
            }
            
            setCandidateKey(null);
            setCandidateSecretCode(null);
            setIsWaitingForApproval(false);
          }
          
          const systemMsg: Message = {
            id: Date.now().toString(),
            senderId: 'SYSTEM',
            payload: '✅',
            text: `${data.senderName} has accepted the new Secret Code.`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          };
          setMessages(prev => [...prev, systemMsg]);
        } else if (data.type === 'KEY_CHANGE_REJECTED') {
          if (isWaitingForApproval) {
            setCandidateKey(null);
            setIsWaitingForApproval(false);
            Alert.alert('Key Change Rejected', `${data.senderName} declined the key update. Continuing with previous key.`);
          }
          
          const systemMsg: Message = {
            id: Date.now().toString(),
            senderId: 'SYSTEM',
            payload: '❌',
            text: `${data.senderName} rejected the key change request.`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          };
          setMessages(prev => [...prev, systemMsg]);
        } else {
          handleIncomingMessage(data);
          // If we are in the room, mark new incoming messages as read
          markMessagesAsRead();
        }
      };

      const handleDeleted = (data: { messageId: string }) => {
        setMessages(prev => prev.filter(m => m.id !== data.messageId));
      };

      socket.on('user_status_change', handleStatusChange);
      socket.on('user_typing', handleTyping);
      socket.on('user_stop_typing', handleStopTyping);
      socket.on('receive_message', handleMsg);
      socket.on('message_deleted', handleDeleted);

      return () => {
        socket.off('user_status_change', handleStatusChange);
        socket.off('user_typing', handleTyping);
        socket.off('user_stop_typing', handleStopTyping);
        socket.off('receive_message', handleMsg);
        socket.off('message_deleted', handleDeleted);
      };
    }
  }, [socket, encryptionKey, previousKey, candidateKey, isWaitingForApproval, id, otherUserId]);

  const handleCopyMessage = async () => {
    if (selectedMessage?.text) {
      await Clipboard.setStringAsync(selectedMessage.text);
      setShowActionMenu(false);
      setSelectedMessage(null);
    }
  };

  const handleDeleteForMe = () => {
    if (selectedMessage) {
      setMessages(prev => prev.filter(m => m.id !== selectedMessage.id));
      setShowActionMenu(false);
      setSelectedMessage(null);
    }
  };

  const handleDeleteForEveryone = () => {
    if (selectedMessage && socket) {
      socket.emit('delete_message', { 
        messageId: selectedMessage.id, 
        roomId: id 
      });
      setShowActionMenu(false);
      setSelectedMessage(null);
    }
  };

  const handleIncomingMessage = (data: any) => {
    if (data.senderId === user?.id) return;

    try {
      let decryptedText = undefined;
      let isOldKey = false;
      
      if (encryptionKey) {
        try {
          decryptedText = decryptMessage(data.payload, encryptionKey);
        } catch (e) {}
      }

      if ((!decryptedText || decryptedText === 'FINGERPRINT_MISMATCH') && previousKey) {
        try {
          const oldDecrypted = decryptMessage(data.payload, previousKey);
          if (oldDecrypted && oldDecrypted !== 'FINGERPRINT_MISMATCH' && !oldDecrypted.startsWith('(－‸－)')) {
            decryptedText = oldDecrypted;
            isOldKey = true;
          }
        } catch (e) {}
      }

      const newMessage: Message = {
        id: data.id || Date.now().toString(),
        senderId: data.senderId,
        payload: data.payload,
        text: decryptedText,
        isOldKey,
        timestamp: data.createdAt ? new Date(data.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, newMessage]);
    } catch (error: any) {
    }
  };

  const handleAcceptKeyChange = () => {
    try {
      setPreviousKey(encryptionKey);
      setEncryptionKey(null);
      setSecretCode('');
      setShowKeyRequest(false);
      setIsRespondingToHandshake(true);
      setShowCodeModal(true);
      
      socket?.emit('send_message', {
        roomId: id,
        senderId: user?.id,
        senderName: user?.username,
        type: 'KEY_CHANGE_ACCEPTED',
        payload: '🤝'
      });
    } catch (error: any) {
    }
  };

  const handleRejectKeyChange = () => {
    try {
      setShowKeyRequest(false);
      setPendingKeyRequest(null);
      
      socket?.emit('send_message', {
        roomId: id,
        senderId: user?.id,
        senderName: user?.username,
        type: 'KEY_CHANGE_REJECTED',
        payload: '🚫'
      });
    } catch (error: any) {
    }
  };

  const handleUnlock = () => {
    if (!secretCode) return;
    
    try {
      const salt = 'funchat_secret_salt'; 
      const key = deriveKey(secretCode, salt);
      
      if (!hasDerivedKeyOnce || isRespondingToHandshake) {
        // Initial unlock OR responding to an accepted handshake
        setEncryptionKey(key);
        setIsLocked(false);
        setShowCodeModal(false);
        setHasDerivedKeyOnce(true);
        setIsRespondingToHandshake(false);

        // Save to local vault
        if (id && name) {
          saveSecretCode(id, secretCode, name);
          recordAutoUnlock(id);
        }
      } else {
        // This is a NEW key change request (voluntary)
        
        // If the key is the same, just close the modal and do nothing
        if (key === encryptionKey) {
          setShowCodeModal(false);
          setSecretCode('');
          return;
        }

        setCandidateKey(key);
        setCandidateSecretCode(secretCode);
        setIsWaitingForApproval(true);
        setShowCodeModal(false);
        
        socket?.emit('send_message', {
          roomId: id,
          senderId: user?.id,
          senderName: user?.username,
          type: 'KEY_CHANGE_REQUEST',
          payload: '🔑'
        });
      }
    } catch (error: any) {
      Alert.alert('Handshake Error', 'Secure key derivation failed. Try a different code.');
    }
  };

  const handleTyping = (text: string) => {
    setInputText(text);

    if (socket && isConnected) {
      if (!isMeTyping) {
        setIsMeTyping(true);
        socket.emit('typing', { roomId: id });
      }

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      typingTimeoutRef.current = setTimeout(() => {
        socket.emit('stop_typing', { roomId: id });
        setIsMeTyping(false);
      }, 3000); 
    }
  };

  const sendMessage = () => {
    if (!inputText || !encryptionKey) return;
    
    if (!socket || !isConnected) {
      Alert.alert('Connection Lost', 'You are currently offline. Please wait for reconnection.');
      return;
    }

    try {
      const securePayload = encryptMessage(inputText, encryptionKey);
      const messageData = {
        roomId: id,
        senderId: user?.id,
        payload: securePayload
      };

      socket.emit('send_message', messageData);
      
      const newMessage: Message = {
        id: Date.now().toString(),
        senderId: user?.id!,
        payload: securePayload,
        text: inputText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, newMessage]);
      setInputText('');
    } catch (error: any) {
      handleError(error, 'Transmission Failed');
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
    const isMismatch = item.text === 'FINGERPRINT_MISMATCH';
    
    return (
      <View style={[styles.messageWrapper, isMe ? styles.myMessageWrapper : styles.theirMessageWrapper]}>
        <Pressable 
          onLongPress={() => {
            setSelectedMessage(item);
            setShowActionMenu(true);
          }}
          style={({ pressed }) => [
            styles.messageBubble, 
            isMe ? styles.myBubble : styles.theirBubble, 
            isMismatch && styles.mismatchBubble,
            pressed && { opacity: 0.7 }
          ]}
        >
          <Text style={[styles.messageText, isMe ? styles.myMessageText : styles.theirMessageText, isMismatch && styles.mismatchText]}>
            {isMismatch ? '(－‸－) Key Mismatch - Check your code' : (item.text || item.payload)}
          </Text>
          {item.text && !isMismatch ? (
            <Text style={[styles.maskIndicator, isMe ? {color: 'rgba(255,255,255,0.7)'} : {color: theme.textTertiary}]}>
              {item.isOldKey ? '⚠️ Decrypted with old key' : '✨ Decrypted'}
            </Text>
          ) : (
            <Text style={[styles.maskIndicator, {color: theme.textTertiary}]}>
              {isMismatch ? '⚠️ Mismatch' : '(✯‿✯) Secure Message'}
            </Text>
          )}
        </Pressable>
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
          <TouchableOpacity onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/(main)');
            }
          }}>
            <Ionicons name="chevron-back" size={28} color={theme.accent} />
          </TouchableOpacity>

          <View style={styles.headerAvatarWrapper}>
            <Avatar name={name || 'Agent'} seed={targetProfile?.avatarSeed} size={40} />
          </View>

          <View style={styles.headerInfo}>
            <Text style={styles.headerName}>
              {name?.split('#')[0]}
              {name?.includes('#') && <Text style={styles.headerDiscriminator}>#{name.split('#')[1]}</Text>}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={[styles.statusDot, { backgroundColor: isOtherUserOnline ? theme.secondary : theme.textTertiary }]} />
              <Text style={styles.headerStatus}>
                {isOtherUserTyping ? 'Typing...' : (isOtherUserOnline ? 'Online' : 'Offline')}
              </Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => {
            // Just open the modal to change code, don't clear the key yet!
            // Handshake logic will handle the transition.
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

        {/* Key Change Request Banner */}
        {showKeyRequest && (
          <View style={[styles.requestBanner, { backgroundColor: theme.surface, borderTopWidth: 4, borderTopColor: theme.secondary }]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.requestTitle}>Key Change Requested 🔑</Text>
              <Text style={styles.requestSubtitle}>{pendingKeyRequest?.senderName} wants to update the Secret Code.</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity style={styles.rejectButton} onPress={handleRejectKeyChange}>
                <Text style={styles.rejectButtonText}>Reject</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.acceptButton} onPress={handleAcceptKeyChange}>
                <Text style={styles.acceptButtonText}>Accept</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Waiting for Approval Banner */}
        {isWaitingForApproval && (
          <View style={[styles.requestBanner, { backgroundColor: theme.surface, borderTopWidth: 4, borderTopColor: theme.primary }]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.requestTitle}>Waiting for Approval... ⏳</Text>
              <Text style={styles.requestSubtitle}>Sent request to {name?.split('#')[0]}.</Text>
            </View>
            <TouchableOpacity onPress={() => {
              setIsWaitingForApproval(false);
              setCandidateKey(null);
            }}>
              <Ionicons name="close-circle" size={28} color={theme.primary} />
            </TouchableOpacity>
          </View>
        )}

        {/* InputArea */}
        {!isLocked && (
          <View style={styles.inputArea}>
            <TextInput
              style={styles.input}
              placeholder="Type a message..."
              placeholderTextColor={theme.textTertiary}
              value={inputText}
              onChangeText={handleTyping}
              multiline
            />
            <TouchableOpacity style={styles.sendButton} onPress={sendMessage}>
              <Ionicons name="send" size={24} color="#FFF" />
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>

      {/* Action Menu Modal */}
      <Modal visible={showActionMenu} transparent animationType="fade">
        <Pressable 
          style={styles.modalOverlay} 
          onPress={() => {
            setShowActionMenu(false);
            setSelectedMessage(null);
          }}
        >
          <View style={styles.actionMenuContent}>
            <Text style={styles.actionMenuTitle} numberOfLines={1}>
              {selectedMessage?.text || 'Message Actions'}
            </Text>
            
            {selectedMessage?.text && (
              <TouchableOpacity style={styles.actionItem} onPress={handleCopyMessage}>
                <Ionicons name="copy-outline" size={22} color={theme.text} />
                <Text style={styles.actionItemText}>Copy Message</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.actionItem} onPress={handleDeleteForMe}>
              <Ionicons name="trash-outline" size={22} color={theme.text} />
              <Text style={styles.actionItemText}>Delete for me</Text>
            </TouchableOpacity>

            {selectedMessage?.senderId === user?.id && (
              <TouchableOpacity style={[styles.actionItem, styles.deleteAction]} onPress={handleDeleteForEveryone}>
                <Ionicons name="trash" size={22} color={theme.primary} />
                <Text style={[styles.actionItemText, { color: theme.primary }]}>Delete for everyone</Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity 
              style={[styles.actionItem, { borderBottomWidth: 0, marginTop: 10 }]} 
              onPress={() => {
                setShowActionMenu(false);
                setSelectedMessage(null);
              }}
            >
              <Text style={[styles.actionItemText, { textAlign: 'center', width: '100%', color: theme.textTertiary }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Secret Code Modal */}
      <Modal visible={showCodeModal} transparent animationType="slide">
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <TouchableOpacity 
              style={styles.closeModal} 
              onPress={() => setShowCodeModal(false)}
            >
              <Ionicons name="close" size={28} color={theme.accent} />
            </TouchableOpacity>

            <Text style={styles.modalEmoji}>(✯‿✯)</Text>
            <Text style={styles.modalTitle}>Enter Secret Code</Text>
            <Text style={styles.modalSubtitle}>
              Both you and {name?.split('#')[0]} must use the same code to unlock this chat.
            </Text>
            <View style={styles.modalInputWrapper}>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. BlueDragon2026"
                placeholderTextColor={theme.textTertiary}
                value={secretCode}
                onChangeText={setSecretCode}
                secureTextEntry={!showSecret}
                autoFocus
                onSubmitEditing={handleUnlock}
              />
              <TouchableOpacity 
                style={styles.eyeButton} 
                onPress={() => setShowSecret(!showSecret)}
              >
                <Ionicons 
                  name={showSecret ? "eye-off" : "eye"} 
                  size={22} 
                  color={theme.textTertiary} 
                />
              </TouchableOpacity>
            </View>
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
    marginLeft: 12,
  },
  headerAvatarWrapper: {
    marginLeft: 10,
  },
  headerName: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.text,
  },
  headerDiscriminator: {
    fontSize: 12,
    color: theme.textTertiary,
    fontWeight: '500',
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
  mismatchBubble: {
    backgroundColor: theme.background,
    borderWidth: 1,
    borderColor: theme.primary,
    borderStyle: 'dashed',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  mismatchText: {
    color: theme.primary,
    fontStyle: 'italic',
    fontSize: 14,
  },
  myMessageText: {
    color: '#FFF',
  },
  theirMessageText: {
    color: theme.text,
  },
  requestBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    padding: 15,
    marginHorizontal: 20,
    marginBottom: 10,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: theme.secondary,
    shadowColor: theme.cardShadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  requestTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.text,
  },
  requestSubtitle: {
    fontSize: 12,
    color: theme.textSecondary,
  },
  acceptButton: {
    backgroundColor: theme.secondary,
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 10,
  },
  acceptButtonText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 12,
  },
  rejectButton: {
    backgroundColor: 'transparent',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.primary,
  },
  rejectButtonText: {
    color: theme.primary,
    fontWeight: '700',
    fontSize: 12,
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
  closeModal: {
    alignSelf: 'flex-end',
    marginBottom: -10,
    marginTop: -10,
    marginRight: -10,
  },
  modalEmoji: {
    fontSize: 48,
    marginBottom: 15,
    textAlign: 'center',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  modalInputWrapper: {
    width: '100%',
    position: 'relative',
    justifyContent: 'center',
    marginBottom: 20,
  },
  modalInput: {
    width: '100%',
    height: 60,
    backgroundColor: theme.background,
    borderRadius: 15,
    paddingLeft: 20,
    paddingRight: 50,
    fontSize: 16,
    borderWidth: 1,
    borderColor: theme.border,
    color: theme.text,
  },
  eyeButton: {
    position: 'absolute',
    right: 15,
    height: '100%',
    justifyContent: 'center',
    paddingHorizontal: 5,
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
  actionMenuContent: {
    width: '90%',
    backgroundColor: theme.surface,
    borderRadius: 25,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  actionMenuTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.textSecondary,
    marginBottom: 20,
    paddingHorizontal: 10,
    textAlign: 'center',
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    gap: 12,
  },
  actionItemText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
  },
  deleteAction: {
    borderBottomWidth: 0,
  },
});
