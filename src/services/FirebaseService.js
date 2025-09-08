// services/FirebaseService.js - Full updated version with rich media support
import messaging from '@react-native-firebase/messaging';
import AsyncStorage from '@react-native-async-storage/async-storage';
import notifee, { AndroidStyle, EventType } from '@notifee/react-native';
import { Platform, Alert } from 'react-native';
import DeviceInfo from 'react-native-device-info';

const BASE_URL = 'https://backendforheartlink.in';

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
      console.log('🔥 Initializing Firebase messaging with rich media support...');

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
        await this.setupNotificationActionHandlers(); // NEW
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

  async checkFCMTokenValidity(authToken) {
    try {
      console.log('🔍 Checking FCM token validity with backend...');
      
      const response = await fetch(`${BASE_URL}/api/v1/users/onboarding/my-status`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('📡 FCM token validity response:', {
        status: response.status,
        ok: response.ok
      });

      if (response.status === 401 || response.status === 403) {
        console.log('❌ FCM token appears to be invalid (401/403 response)');
        return false;
      }

      if (response.ok) {
        console.log('✅ FCM token appears to be valid');
        return true;
      }

      console.log('⚠ Uncertain FCM token validity, assuming invalid');
      return false;
    } catch (error) {
      console.error('❌ Error checking FCM token validity:', error);
      return false;
    }
  }

  async refreshFCMTokenIfNeeded(authToken) {
    try {
      console.log('🔄 Refreshing FCM token if needed...');
      
      const newToken = await this.getFCMToken();
      if (!newToken) {
        throw new Error('Failed to generate new FCM token');
      }

      const success = await this.sendTokenToBackend(newToken, authToken);
      if (!success) {
        throw new Error('Failed to send new FCM token to backend');
      }

      console.log('✅ FCM token refreshed and sent to backend successfully');
      return true;
    } catch (error) {
      console.error('❌ Error refreshing FCM token:', error);
      return false;
    }
  }

  showTokenValidPopup() {
    console.log('📱 Showing Token Valid popup...');
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
        console.log('🔑 Full FCM Token:', token);
      } else {
        console.warn('⚠ No FCM token returned');
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

          const getSenderName = (data) => {
            if (data?.senderName) return data.senderName;
            if (data?.commenterName) return data.commenterName;
            if (data?.likerName) return data.likerName;
            if (data?.impressorName) return data.impressorName;
            if (data?.followerName) return data.followerName;
            if (data?.streamerName) return data.streamerName;
            return 'Someone';
          };

          const getSenderPhoto = (data) => {
            if (data?.senderPhoto) return data.senderPhoto;
            if (data?.commenterPhoto) return data.commenterPhoto;
            if (data?.likerPhoto) return data.likerPhoto;
            if (data?.impressorPhoto) return data.impressorPhoto;
            if (data?.followerPhoto) return data.followerPhoto;
            if (data?.streamerPhoto) return data.streamerPhoto;
            return null;
          };

          const getPreviewImage = (notification, data) => {
            if (notification?.imageUrl) return notification.imageUrl;
            if (data?.previewImageUrl) return data.previewImageUrl;
            if (data?.postImageUrl) return data.postImageUrl;
            if (data?.postThumbnailUrl) return data.postThumbnailUrl;
            if (data?.reelThumbnail) return data.reelThumbnail;
            if (data?.streamThumbnail) return data.streamThumbnail;
            return null;
          };

          const senderName = getSenderName(data);
          const senderPhoto = getSenderPhoto(data);
          const previewImage = getPreviewImage(notification, data);

          console.log('🔍 FCM Debug - Extracted info:', {
            senderName,
            senderPhoto: senderPhoto ? 'Present' : 'Missing',
            previewImage: previewImage ? 'Present' : 'Missing',
            notificationType: data?.type,
            postType: data?.postType || data?.contentType
          });

          await this.displayRichNotification({
            title: notification?.title || 'New Message',
            body: notification?.body || 'You have a new message',
            senderName,
            senderPhoto,
            previewImage,
            data: data || {},
            notificationType: data?.type
          });

          console.log('✅ Rich notification displayed');
        } catch (error) {
          console.error('❌ Error displaying foreground notification:', error);
          await this.displaySimpleNotification(remoteMessage);
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

  async displayRichNotification({ title, body, senderName, senderPhoto, previewImage, data, notificationType }) {
    try {
      const hasPreviewImage = !!previewImage;
      const hasSenderPhoto = !!senderPhoto;

      console.log('🎨 Building rich notification:', {
        hasPreviewImage,
        hasSenderPhoto,
        notificationType
      });

      let androidStyle;

      if (hasPreviewImage && (notificationType === 'post_like' || notificationType === 'post_comment')) {
        androidStyle = {
          type: AndroidStyle.BIGPICTURE,
          picture: previewImage,
          title: title,
          summary: body,
          ...(hasSenderPhoto && {
            largeIcon: senderPhoto
          })
        };
      } else if (hasSenderPhoto) {
        androidStyle = {
          type: AndroidStyle.MESSAGING,
          person: {
            name: senderName,
            icon: senderPhoto,
          },
          messages: [{
            text: body,
            timestamp: Date.now(),
          }],
        };
      } else {
        androidStyle = {
          type: AndroidStyle.BIGTEXT,
          text: body,
        };
      }

      const notificationConfig = {
        title,
        body,
        data,
        android: {
          channelId: 'chat_messages',
          pressAction: { id: 'default' },
          smallIcon: 'ic_launcher',
          color: '#BB8FCE',
          style: androidStyle,
          ...(notificationType === 'post_like' || notificationType === 'post_comment') && {
            actions: [
              {
                title: 'View Post',
                pressAction: { id: 'view_post' },
                icon: 'https://my-cdn.com/icons/view.png',
              },
              {
                title: 'Reply',
                pressAction: { id: 'reply' },
                icon: 'https://my-cdn.com/icons/reply.png',
              }
            ]
          }
        },
        ios: {
          sound: 'default',
          badgeCount: 1,
          ...(hasPreviewImage && {
            attachments: [{
              url: previewImage,
              typeHint: 'public.jpeg'
            }]
          })
        },
      };

      await notifee.displayNotification(notificationConfig);
    } catch (error) {
      console.error('❌ Error in displayRichNotification:', error);
      throw error;
    }
  }

  async displaySimpleNotification(remoteMessage) {
    try {
      await notifee.displayNotification({
        title: remoteMessage.notification?.title || 'New Message',
        body: remoteMessage.notification?.body || 'You have a new message',
        android: {
          channelId: 'chat_messages',
          pressAction: { id: 'default' },
          smallIcon: 'ic_launcher',
          color: '#BB8FCE',
        },
        ios: {
          sound: 'default',
          badgeCount: 1,
        }
      });
      console.log('✅ Fallback notification displayed');
    } catch (fallbackError) {
      console.error('❌ Fallback notification failed:', fallbackError);
    }
  }

  async setupNotificationActionHandlers() {
    notifee.onForegroundEvent(({ type, detail }) => {
      switch (type) {
        case EventType.ACTION_PRESS:
          if (detail.pressAction.id === 'view_post') {
            const data = detail.notification.data;
            this.navigateBasedOnNotification(data);
          } else if (detail.pressAction.id === 'reply') {
            const data = detail.notification.data;
            if (data.postId) {
              this.navigationRef.navigate('PostDetail', { 
                postId: data.postId,
                openComments: true,
                autoFocusReply: true
              });
            }
          }
          break;
        case EventType.PRESS:
          const data = detail.notification.data;
          this.navigateBasedOnNotification(data);
          break;
      }
    });

    notifee.onBackgroundEvent(async ({ type, detail }) => {
      if (type === EventType.ACTION_PRESS) {
        await AsyncStorage.setItem('pending_notification_action', JSON.stringify({
          action: detail.pressAction.id,
          data: detail.notification.data
        }));
      }
    });
  }

  handleNotificationOpen(remoteMessage) {
    const { data } = remoteMessage;

    if (data) {
      console.log('🔗 Navigating based on notification:', data.type);
      this.navigateBasedOnNotification(data);
    }
  }

  navigateBasedOnNotification(data) {
    const { type, conversationId, senderId, messageId, postId, postType } = data;

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

        case 'post_like':
        case 'post_comment':
          if (postId) {
            if (postType === 'reel') {
              this.navigationRef.navigate('ReelDetail', { 
                reelId: postId,
                openComments: type === 'post_comment'
              });
            } else {
              this.navigationRef.navigate('PostDetail', { 
                postId: postId,
                openComments: type === 'post_comment'
              });
            }
          } else if (senderId) {
            this.navigationRef.navigate('UserProfile', { userId: senderId });
          }
          break;

        case 'follow':
        case 'impression':
          if (senderId) {
            this.navigationRef.navigate('UserProfile', { userId: senderId });
          }
          break;

        case 'live_stream':
          if (data.streamId && data.streamerId) {
            this.navigationRef.navigate('LiveStream', { 
              streamId: data.streamId,
              streamerId: data.streamerId 
            });
          }
          break;

        default:
          console.log(`Unknown notification type: ${type}`);
          this.navigationRef.navigate('Home');
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