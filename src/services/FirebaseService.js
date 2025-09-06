// services/FirebaseService.js - Fixed version with proper Android icon handling
import messaging from '@react-native-firebase/messaging';
import AsyncStorage from '@react-native-async-storage/async-storage';
import notifee, { AndroidStyle } from '@notifee/react-native';
import { Platform, Alert } from 'react-native';
import DeviceInfo from 'react-native-device-info';

// Import your API config
import { BASE_URL } from '../config/config';


class FirebaseService {
  constructor() {
    this.navigationRef = null;
    this.onTokenRefreshListener = null;
    this.onMessageListener = null;
    this.isInitialized = false;
    this.initialNotificationChecked = false;
    this.currentToken = null;
  }

  async initialize(authToken) {
    try {
      console.log('🔥 Initializing Firebase messaging with backend integration...');

      // Notifee initialization
      await notifee.requestPermission();
      if (Platform.OS === 'android') {
        await notifee.createChannel({
          id: 'chat_messages',
          name: 'Chat Messages',
          importance: 4,
          sound: 'default',
        });
        console.log('🔊 Notifee chat channel created');
      }

      if (messaging().isDeviceRegisteredForRemoteMessages !== undefined && !messaging().isDeviceRegisteredForRemoteMessages) {
        await messaging().registerDeviceForRemoteMessages();
      }

      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        console.log('❌ Push notification permission denied');
        return null;
      }

      const token = await this.getFCMToken();
      if (token && authToken) {
        await this.sendTokenToBackend(token, authToken);
      }

      if (!this.isInitialized) {
        this.setupMessageHandlers(authToken);
        this.isInitialized = true;
      }

      if (this.navigationRef && !this.initialNotificationChecked) {
        this.checkInitialNotification();
      }

      return token;
    } catch (error) {
      console.error('❌ FirebaseService initialization error:', error);
      return null;
    }
  }

  async sendTokenToBackend(token, authToken) {
    try {
      console.log('📤 Sending FCM token to backend...');
      
      const deviceId = await DeviceInfo.getUniqueId();
      const deviceType = Platform.OS;

      const response = await fetch(`${BASE_URL}/api/v1/fcm/register-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          fcmToken: token,
          deviceType: deviceType,
          deviceId: deviceId,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ FCM token sent to backend successfully:', result.message);
        await AsyncStorage.setItem('fcm_token_registered', 'true');
        return true;
      } else {
        const error = await response.json();
        console.error('❌ Failed to send FCM token to backend:', error.message);
        return false;
      }
    } catch (error) {
      console.error('❌ Error sending FCM token to backend:', error);
      return false;
    }
  }

  async removeTokenFromBackend(authToken) {
    try {
      console.log('📤 Removing FCM token from backend...');
      
      const deviceId = await DeviceInfo.getUniqueId();

      const response = await fetch(`${BASE_URL}/api/v1/fcm/remove-token`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          deviceId: deviceId,
        }),
      });

      if (response.ok) {
        console.log('✅ FCM token removed from backend successfully');
        await AsyncStorage.removeItem('fcm_token_registered');
        return true;
      } else {
        console.error('❌ Failed to remove FCM token from backend');
        return false;
      }
    } catch (error) {
      console.error('❌ Error removing FCM token from backend:', error);
      return false;
    }
  }

  async requestPermissions() {
    try {
      if (Platform.OS === 'ios') {
        const authStatus = await messaging().requestPermission();
        const enabled =
          authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
          authStatus === messaging.AuthorizationStatus.PROVISIONAL;
        return enabled;
      } else {
        if (Platform.Version >= 33) {
          const { PermissionsAndroid } = require('react-native');
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
          );
          return granted === PermissionsAndroid.RESULTS.GRANTED;
        }
        return true;
      }
    } catch (error) {
      console.error('❌ Error requesting notification permissions:', error);
      return false;
    }
  }

    async getFCMToken() {
    try {
      const token = await messaging().getToken();
      if (token) {
        await AsyncStorage.setItem('fcm_token', token);
        this.currentToken = token;

        // Log full token
        console.log('🔑 Full FCM Token:', token);

        // Also show alert for easy copy (optional)
        // Alert.alert('Your FCM Token', token);
      } else {
        console.warn('⚠️ No FCM token returned');
      }
      return token;
    } catch (error) {
      console.error('❌ Error getting FCM token:', error);
      return null;
    }
  }

  setupMessageHandlers(authToken) {
    if (!this.onMessageListener) {
      this.onMessageListener = messaging().onMessage(async remoteMessage => {
        console.log('📱 FCM foreground message:', remoteMessage.notification?.title);
        
        try {
          const { notification, data } = remoteMessage;

          // Build Android-specific notification config
          const androidConfig = {
            channelId: 'chat_messages',
            pressAction: { id: 'default' },
            // Use ic_launcher as fallback, or omit smallIcon to use default
            ...(Platform.OS === 'android' && {
              smallIcon: 'ic_launcher', // Use the app's launcher icon
              color: '#BB8FCE', // Your app's accent color
            }),
            style: {
              type: AndroidStyle.MESSAGING,
              person: {
                name: data?.senderName || 'Someone',
                // Only set icon if we have a valid URL
                ...(data?.senderPhoto && { icon: data.senderPhoto }),
              },
              messages: [{
                text: notification?.body || 'New message',
                timestamp: Date.now(),
              }],
            },
          };

          await notifee.displayNotification({
            title: notification?.title || 'New Message',
            body: notification?.body || 'You have a new message',
            data: data || {},
            android: androidConfig,
            ios: {
              sound: 'default',
              badgeCount: 1,
            },
          });

          console.log('✅ Foreground notification displayed successfully');
        } catch (error) {
          console.error('❌ Error displaying foreground notification:', error);
          
          // Fallback: try with minimal notification
          try {
            await notifee.displayNotification({
              title: remoteMessage.notification?.title || 'New Message',
              body: remoteMessage.notification?.body || 'You have a new message',
              android: {
                channelId: 'chat_messages',
                pressAction: { id: 'default' },
                // Don't specify smallIcon to use default
              },
            });
            console.log('✅ Fallback notification displayed');
          } catch (fallbackError) {
            console.error('❌ Fallback notification also failed:', fallbackError);
          }
        }
      });
    }

    if (!this.onTokenRefreshListener) {
      this.onTokenRefreshListener = messaging().onTokenRefresh(async refreshedToken => {
        console.log('🔄 FCM token refreshed');
        this.currentToken = refreshedToken;
        await AsyncStorage.setItem('fcm_token', refreshedToken);
        
        if (authToken) {
          await this.sendTokenToBackend(refreshedToken, authToken);
        }
      });
    }
  }

  handleNotificationOpen(remoteMessage) {
    const { data } = remoteMessage;

    if (data) {
      console.log('🔗 Navigating based on notification:', data.type);
      this.navigateBasedOnNotification(data);
    }
  }

  navigateBasedOnNotification(data) {
    const { type, conversationId, senderId, messageId } = data;

    if (!this.navigationRef) {
      AsyncStorage.setItem('pending_notification', JSON.stringify(data));
      return;
    }

    try {
      switch (type) {
        case 'message':
          if (conversationId && senderId) {
            this.navigationRef.navigate('ChatDetail', { 
              conversationId, 
              userId: senderId 
            });
          } else if (senderId) {
            this.navigationRef.navigate('UserProfile', { userId: senderId });
          }
          break;

        case 'story_reply':
          if (senderId) {
            this.navigationRef.navigate('ChatDetail', { userId: senderId });
          }
          break;

        case 'follow':
        case 'impression':
          if (senderId) {
            this.navigationRef.navigate('UserProfile', { userId: senderId });
          }
          break;

        default:
          console.log(`Unknown notification type: ${type}`);
          this.navigationRef.navigate('Chat');
      }
    } catch (error) {
      console.error('❌ Navigation error:', error);
    }
  }

  setNavigationRef(navigationRef) {
    this.navigationRef = navigationRef;
    console.log('🧭 Navigation reference set');
    
    if (navigationRef) {
      this.checkPendingNotifications();
      if (!this.initialNotificationChecked) {
        this.checkInitialNotification();
      }
    }
  }

  async checkPendingNotifications() {
    try {
      const pendingNotification = await AsyncStorage.getItem('pending_notification');
      if (pendingNotification) {
        const data = JSON.parse(pendingNotification);
        setTimeout(() => {
          this.navigateBasedOnNotification(data);
        }, 500);
        await AsyncStorage.removeItem('pending_notification');
      }
    } catch (error) {
      console.error('❌ Error checking pending notifications:', error);
    }
  }

  async checkInitialNotification() {
    if (this.initialNotificationChecked) return;
    
    try {
      const remoteMessage = await messaging().getInitialNotification();
      if (remoteMessage) {
        console.log('📱 App opened by notification tap');
        this.handleNotificationOpen(remoteMessage);
      }
    } catch (error) {
      console.error('❌ Error checking initial notification:', error);
    } finally {
      this.initialNotificationChecked = true;
    }
  }

  async cleanup(authToken) {
    console.log('🧹 Cleaning up Firebase listeners...');
    
    if (authToken) {
      await this.removeTokenFromBackend(authToken);
    }

    if (this.onTokenRefreshListener) {
      this.onTokenRefreshListener();
      this.onTokenRefreshListener = null;
    }
    if (this.onMessageListener) {
      this.onMessageListener();
      this.onMessageListener = null;
    }
    
    this.isInitialized = false;
    this.initialNotificationChecked = false;
    this.currentToken = null;
  }

  async testNotification(authToken) {
    try {
      const response = await fetch(`${BASE_URL}/api/v1/fcm/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          message: 'Test notification from app'
        }),
      });

      if (response.ok) {
        Alert.alert('Success', 'Test notification sent!');
      } else {
        Alert.alert('Error', 'Failed to send test notification');
      }
    } catch (error) {
      console.error('❌ Test notification error:', error);
      Alert.alert('Error', 'Network error');
    }
  }
}

export default new FirebaseService();