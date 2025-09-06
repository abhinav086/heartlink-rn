/**
 * @format
 */

import { AppRegistry, Platform } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import notifee from '@notifee/react-native';
import App from './App';
import { name as appName } from './app.json';

// Background Message Handler
messaging().setBackgroundMessageHandler(async remoteMessage => {
  console.log('🔔 BACKGROUND MESSAGE RECEIVED:', JSON.stringify(remoteMessage, null, 2));

  const { notification, data } = remoteMessage;

  try {
    // Ensure the chat_messages channel exists
    if (Platform.OS === 'android') {
      await notifee.createChannel({
        id: 'chat_messages',
        name: 'Chat Messages',
        importance: 4,
        sound: 'default',
      });
    }

    // Handle notification messages
    if (notification) {
      await notifee.displayNotification({
        title: notification?.title || 'New Message',
        body: notification?.body || 'You have a new message',
        data: data || {},
        android: {
          channelId: 'chat_messages',
          pressAction: { id: 'default' },
          smallIcon: 'ic_launcher',
          color: '#BB8FCE',
        },
        ios: {
          sound: 'default',
          badgeCount: 1,
        },
      });
      console.log('🔔 Background notification displayed via Notifee');
    } 
    // Handle data-only messages
    else if (data) {
      console.log('⚠️ Background data-only message received');
      
      // Display notification based on data content
      const notificationTitle = data.title || 'New Notification';
      const notificationBody = data.body || 'You have a new message';
      
      await notifee.displayNotification({
        title: notificationTitle,
        body: notificationBody,
        data: data,
        android: {
          channelId: 'chat_messages',
          pressAction: { id: 'default' },
          smallIcon: 'ic_launcher',
          color: '#BB8FCE',
        },
        ios: {
          sound: 'default',
          badgeCount: 1,
        },
      });
      console.log('🔔 Data-only message notification displayed');
    }

  } catch (notifeeError) {
    console.error('❌ Error displaying notification with Notifee:', notifeeError);
  }

  console.log('✅ Background message processing finished.');
  return Promise.resolve();
});

AppRegistry.registerComponent(appName, () => App);