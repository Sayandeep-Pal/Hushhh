import { useState, useEffect, useRef } from 'react';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform, Alert } from 'react-native';
import { useRouter } from 'expo-router';

export interface PushNotificationState {
  expoPushToken?: string;
  notification?: Notifications.Notification;
}

export const usePushNotifications = (): PushNotificationState => {
  const [expoPushToken, setExpoPushToken] = useState<string | undefined>();
  const [notification, setNotification] = useState<Notifications.Notification | undefined>();
  const router = useRouter();

  const notificationListener = useRef<Notifications.Subscription>(null);
  const responseListener = useRef<Notifications.Subscription>(null);

  async function registerForPushNotificationsAsync() {
    let token;
    
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF6B6B',
      });
    }

    try {
      if (Device.isDevice) {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        if (finalStatus !== 'granted') {
          return;
        }
        
        const projectId = Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId;
        
        if (!projectId) {
          return;
        }
        
        token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
      }
    } catch (error: any) {
      if (error.message?.includes('FirebaseApp is not initialized')) {
        Alert.alert('Configuration Required', 'Firebase is not initialized. Notifications may not work in this build.');
      } else {
        Alert.alert('Notification Error', `Failed to register for notifications: ${error.message}`);
      }
    }

    return token;
  }

  useEffect(() => {
    registerForPushNotificationsAsync().then(token => setExpoPushToken(token));

    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      setNotification(notification);
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      const { roomId, senderUsername } = response.notification.request.content.data;
      if (roomId) {
        router.push({
          pathname: '/(main)/chat/[id]' as any,
          params: { id: roomId as string, name: (senderUsername as string) || 'Secure Chat' }
        });
      }
    });

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, []);

  return {
    expoPushToken,
    notification,
  };
};
