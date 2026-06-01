const { Expo } = require('expo-server-sdk');
const User = require('../models/User');

const expo = new Expo();

const sendPushNotification = async (userId, senderUsername, roomId) => {
  try {
    const user = await User.findById(userId);
    if (!user || !user.pushToken) return;

    if (!Expo.isExpoPushToken(user.pushToken)) {
      console.error(`Push token ${user.pushToken} is not a valid Expo push token`);
      return;
    }

    const messages = [{
      to: user.pushToken,
      sound: 'default',
      title: 'New Secure Message (✯‿✯)',
      body: `${senderUsername} sent you a message`,
      data: { senderUsername, roomId },
      priority: 'high',
      badge: 1,
    }];

    const chunks = expo.chunkPushNotifications(messages);
    for (let chunk of chunks) {
      try {
        await expo.sendPushNotificationsAsync(chunk);
      } catch (error) {
        console.error('Error sending push notification chunk:', error);
      }
    }
  } catch (e) {
    console.error('Push notification error:', e);
  }
};

module.exports = { sendPushNotification };
