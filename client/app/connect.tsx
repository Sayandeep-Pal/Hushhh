import { useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { Alert, View, ActivityIndicator } from 'react-native';
import { useTheme } from '../hooks/useTheme';

export default function Connect() {
  const { id, name, code } = useLocalSearchParams<{ id: string, name?: string, code?: string }>();
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const theme = useTheme();

  useEffect(() => {
    if (isLoading) return;

    if (!user) {
      // If not logged in, the NavigationGuard will redirect to login.
      // But we should probably redirect back here after login.
      // For now, let's just go to main.
      router.replace('/(main)');
      return;
    }

    if (id) {
      if (id === user.id) {
        Alert.alert('Mirror Reality', "You can't chat with yourself.");
        router.replace('/(main)');
        return;
      }

      const roomId = [user.id, id].sort().join('_');
      
      // Redirect to the chat room with the provided parameters
      router.replace({
        pathname: '/(main)/chat/[id]',
        params: {
          id: roomId,
          name: name || 'Secret Agent',
          sharedCode: code || ''
        }
      });
    } else {
      router.replace('/(main)');
    }
  }, [id, user, isLoading]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" color={theme.accent} />
    </View>
  );
}
