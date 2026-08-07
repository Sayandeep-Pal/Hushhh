import { useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { Alert, View, ActivityIndicator } from 'react-native';
import { useTheme } from '../hooks/useTheme';
import axios from 'axios';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://172.17.0.1:3000';

export default function Connect() {
  const { invite } = useLocalSearchParams<{ invite?: string }>();
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const theme = useTheme();

  useEffect(() => {
    if (isLoading) return;

    if (!user || !invite) {
      router.replace('/(auth)/login');
      return;
    }
    const acceptInvite = async () => {
      try {
        const response = await axios.post(`${API_URL}/api/invites/accept`, { token: invite });
        const conversation = response.data.conversation;
        router.replace({
          pathname: '/(main)/chat/[id]',
          params: { id: conversation.id, name: conversation.participant?.username || 'Secure Chat' },
        });
      } catch {
        Alert.alert('Invite unavailable', 'This connection invite is invalid, expired, or has already been used.');
        router.replace('/(main)/(tabs)');
      }
    };
    acceptInvite();
  }, [invite, user, isLoading, router]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" color={theme.accent} />
    </View>
  );
}
