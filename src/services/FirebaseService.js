// services/FirebaseService.ts
import messaging from '@react-native-firebase/messaging';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, Alert, PermissionsAndroid } from 'react-native';
import BASE_URL from '../config/config';

class FirebaseService {
  private navigationRef: any = null;
  private onTokenRefreshListener: (() => void) | null = null;
  private onMessageListener: (() => void) | null = null;
  private onNotificationOpenedListener: (() => void) | null = null;

  // Initialize Firebase messaging
  async initialize(authToken?: string): Promise<string | null> {
    try {
      console.log('🔥 Initializing Firebase messaging...');

      // Check if Firebase is supported
      if (!messaging().isDeviceRegisteredForRemoteMessages) {
        await messaging().registerDeviceForRemoteMessages();
      }

      // Request permissions
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        console.log('❌ Push notification permission denied');
        return null;
      }

      // Get FCM token
      const token = await this.getFCMToken();
      console.log('🔑 FCM Token obtained:', token ? 'Success' : 'Failed');

      // Send token to backend if auth token is available
      if (token && authToken) {
        await this.sendTokenToBackend(token, authToken);
      }

      // Setup message handlers
      this.setupMessageHandlers();
      
      console.log('✅ Firebase messaging initialized successfully');
      return token;
    } catch (error) {
      console.error('❌ Firebase initialization error:', error);
      return null;
    }
  }

  // Request notification permissions
  async requestPermissions(): Promise<boolean> {
    try {
      if (Platform.OS === 'ios') {
        const authStatus = await messaging().requestPermission();
        const enabled =
          authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
          authStatus === messaging.AuthorizationStatus.PROVISIONAL;

        if (!enabled) {
          console.log('📱 iOS push notification permission denied');
        }
        
        return enabled;
      } else {
        // Android 13+ requires POST_NOTIFICATIONS permission
        if (Platform.Version >= 33) {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
          );
          const hasPermission = granted === PermissionsAndroid.RESULTS.GRANTED;
          
          if (!hasPermission) {
            console.log('📱 Android push notification permission denied');
          }
          
          return hasPermission;
        }
        return true;
      }
    } catch (error) {
      console.error('❌ Error requesting permissions:', error);
      return false;
    }
  }

  // Get FCM token
  async getFCMToken(): Promise<string | null> {
    try {
      let token = await AsyncStorage.getItem('fcm_token');
      
      if (!token) {
        token = await messaging().getToken();
        if (token) {
          await AsyncStorage.setItem('fcm_token', token);
        }
      }
      
      return token;
    } catch (error) {
      console.error('❌ Error getting FCM token:', error);
      return null;
    }
  }

  // Send token to backend
  async sendTokenToBackend(token: string, authToken: string): Promise<void> {
    try {
      console.log('📤 Sending FCM token to backend...');
      
      const response = await fetch(`${BASE_URL}/api/v1/users/fcm-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({ fcmToken: token }),
      });

      const data = await response.json();
      
      if (response.ok) {
        console.log('✅ FCM token sent to backend successfully');
      } else {
        console.error('❌ Failed to send FCM token to backend:', data.message);
      }
    } catch (error) {
      console.error('❌ Error sending FCM token to backend:', error);
    }
  }

  // Remove token from backend
  async removeTokenFromBackend(authToken: string): Promise<void> {
    try {
      console.log('🗑️ Removing FCM token from backend...');
      
      const response = await fetch(`${BASE_URL}/api/v1/users/fcm-token`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
      });

      if (response.ok) {
        console.log('✅ FCM token removed from backend successfully');
      } else {
        console.error('❌ Failed to remove FCM token from backend');
      }
    } catch (error) {
      console.error('❌ Error removing FCM token from backend:', error);
    }
  }

  // Setup message handlers
  setupMessageHandlers(): void {
    // Handle background/quit state messages
    messaging().setBackgroundMessageHandler(async remoteMessage => {
      console.log('📱 Message handled in background:', remoteMessage.notification?.title);
      this.handleNotification(remoteMessage);
    });

    // Handle foreground messages
    this.onMessageListener = messaging().onMessage(async remoteMessage => {
      console.log('📱 FCM message received in foreground:', remoteMessage.notification?.title);
      this.handleForegroundNotification(remoteMessage);
    });

    // Handle notification opened from quit state
    messaging()
      .getInitialNotification()
      .then(remoteMessage => {
        if (remoteMessage) {
          console.log('📱 Notification caused app to open from quit state:', remoteMessage.notification?.title);
          this.handleNotificationOpen(remoteMessage);
        }
      });

    // Handle notification opened from background state
    this.onNotificationOpenedListener = messaging().onNotificationOpenedApp(
      remoteMessage => {
        console.log('📱 Notification caused app to open from background:', remoteMessage.notification?.title);
        this.handleNotificationOpen(remoteMessage);
      }
    );

    // Handle token refresh
    this.onTokenRefreshListener = messaging().onTokenRefresh(async token => {
      console.log('🔄 FCM token refreshed');
      await AsyncStorage.setItem('fcm_token', token);
      
      // Get auth token and send new FCM token to backend
      const authToken = await AsyncStorage.getItem('token');
      if (authToken) {
        await this.sendTokenToBackend(token, authToken);
      }
    });
  }

  // Handle foreground notifications
  handleForegroundNotification(remoteMessage: any): void {
    const { notification, data } = remoteMessage;
    
    // Show alert for foreground notifications
    Alert.alert(
      notification?.title || 'New Notification',
      notification?.body || 'You have a new notification',
      [
        { text: 'Dismiss', style: 'cancel' },
        { 
          text: 'View', 
          onPress: () => this.handleNotificationOpen(remoteMessage) 
        },
      ]
    );
  }

  // Handle notification data storage
  handleNotification(remoteMessage: any): void {
    const { data } = remoteMessage;
    console.log('💾 Storing notification data:', data);
    
    // Store notification data for later processing
    if (data) {
      AsyncStorage.setItem('pending_notification', JSON.stringify(data));
    }
  }

  // Handle notification open/tap
  handleNotificationOpen(remoteMessage: any): void {
    const { data } = remoteMessage;
    
    if (data) {
      console.log('🔗 Navigating based on notification:', data.type);
      this.navigateBasedOnNotification(data);
    }
  }

  // Navigate based on notification data
  navigateBasedOnNotification(data: any): void {
    const { type, userId, postId, dateRequestId, callId } = data;
    
    if (!this.navigationRef) {
      console.log('⚠️ Navigation ref not available, storing for later');
      AsyncStorage.setItem('pending_notification', JSON.stringify(data));
      return;
    }

    try {
      switch (type) {
        case 'follow':
        case 'impression':
          if (userId) {
            this.navigationRef.navigate('UserProfile', { userId });
          } else {
            this.navigationRef.navigate('NotificationsScreen');
          }
          break;
          
        case 'like':
        case 'comment':
          if (postId) {
            this.navigationRef.navigate('PhotoViewerScreen', { postId });
          } else {
            this.navigationRef.navigate('NotificationsScreen');
          }
          break;
          
        case 'date_request':
        case 'date_accepted':
        case 'date_declined':
          if (dateRequestId) {
            this.navigationRef.navigate('DateRequestDetail', { requestId: dateRequestId });
          } else {
            this.navigationRef.navigate('DateRequests');
          }
          break;
          
        case 'incoming_call':
          if (callId && userId) {
            this.navigationRef.navigate('CallPage', { callId, userId });
          }
          break;
          
        case 'chat_message':
          if (userId) {
            this.navigationRef.navigate('ChatDetail', { userId });
          } else {
            this.navigationRef.navigate('UsersListScreen');
          }
          break;
          
        default:
          this.navigationRef.navigate('NotificationsScreen');
      }
    } catch (error) {
      console.error('❌ Navigation error:', error);
      this.navigationRef.navigate('NotificationsScreen');
    }
  }

  // Set navigation reference
  setNavigationRef(navigationRef: any): void {
    this.navigationRef = navigationRef;
    console.log('🧭 Navigation reference set');
    
    // Check for pending notifications
    this.checkPendingNotifications();
  }

  // Check for pending notifications when navigation becomes available
  async checkPendingNotifications(): Promise<void> {
    try {
      const pendingNotification = await AsyncStorage.getItem('pending_notification');
      if (pendingNotification) {
        const data = JSON.parse(pendingNotification);
        console.log('🔄 Processing pending notification:', data.type);
        
        // Add delay to ensure navigation is ready
        setTimeout(() => {
          this.navigateBasedOnNotification(data);
        }, 1000);
        
        await AsyncStorage.removeItem('pending_notification');
      }
    } catch (error) {
      console.error('❌ Error checking pending notifications:', error);
    }
  }

  // Get message listener for components
  getMessageListener() {
    return messaging().onMessage;
  }

  // Cleanup listeners
  cleanup(): void {
    console.log('🧹 Cleaning up Firebase listeners');
    
    if (this.onTokenRefreshListener) {
      this.onTokenRefreshListener();
      this.onTokenRefreshListener = null;
    }
    if (this.onMessageListener) {
      this.onMessageListener();
      this.onMessageListener = null;
    }
    if (this.onNotificationOpenedListener) {
      this.onNotificationOpenedListener();
      this.onNotificationOpenedListener = null;
    }
  }
}

export default new FirebaseService();