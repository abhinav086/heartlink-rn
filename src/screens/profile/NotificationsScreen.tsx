import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../../context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

const NotificationsScreen = () => {
  const navigation = useNavigation();
  const { token } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pagination, setPagination] = useState({});
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    fetchNotifications();
  }, [activeTab]);

  // ✅ NEW FUNCTION: Validate FCM Token
  const validateFCMToken = async () => {
    try {
      const fcmToken = await AsyncStorage.getItem('fcm_token');
      if (!fcmToken) {
        Alert.alert('Error', 'No FCM token found. Please restart the app.');
        return;
      }

      Alert.alert('Validating...', 'Please wait while we validate your FCM token.');

      const response = await fetch('https://backendforheartlink.in/api/v1/fcm/validate-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fcmToken }),
      });

      const result = await response.json();

      if (result.statusCode === 200) {
        Alert.alert(
          '✅ Validation Result',
          `Token: ${result.data.token}\nStatus: ${result.data.isValid ? 'VALID' : 'INVALID'}\nMessage: ${result.message}`
        );
      } else {
        Alert.alert('❌ Validation Failed', result.message || 'Unknown error');
      }
    } catch (error) {
      console.error('Validation error:', error);
      Alert.alert('❌ Error', 'Failed to validate token. Check logs for details.');
    }
  };

  // ✅ NEW FUNCTION: Force Register FCM Token
  const forceRegisterFCMToken = async () => {
    try {
      const fcmToken = await AsyncStorage.getItem('fcm_token');
      if (!fcmToken) {
        Alert.alert('Error', 'No FCM token found. Please restart the app to generate one.');
        return;
      }

      Alert.alert('Force Registering...', 'Please wait while we register your FCM token.');

      const response = await fetch('https://backendforheartlink.in/api/v1/fcm/force-register-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ fcmToken }),
      });

      const result = await response.json();

      if (result.statusCode === 200) {
        Alert.alert(
          '✅ Force Register Result',
          `${result.message}\nAction: ${result.data.action}\n\n${result.data.instructions ? Object.values(result.data.instructions).join('\n') : ''}`
        );
      } else {
        Alert.alert('❌ Registration Failed', result.message || 'Unknown error');
      }
    } catch (error) {
      console.error('Force register error:', error);
      Alert.alert('❌ Error', 'Failed to force register token. Check logs for details.');
    }
  };

  const fetchNotifications = async (page = 1) => {
    try {
      setLoading(true);
      // Map activeTab to API type parameter
      let typeParam = '';
      switch (activeTab) {
        case 'impressions':
          typeParam = 'impression';
          break;
        case 'follows':
          typeParam = 'follow';
          break;
        case 'likes':
          typeParam = 'like';
          break;
        default:
          typeParam = 'all';
      }

      // Build query parameters
      const params = new URLSearchParams({
        page,
        limit: 20,
        ...(typeParam !== 'all' && { type: typeParam })
      });
      
      console.log('Fetching notifications with params:', params.toString());
      
      const response = await fetch(
        `https://backendforheartlink.in/api/v1/notifications?${params}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();
      console.log('API Response:', data);
      
      if (data.statusCode === 200) {
        // Transform API response to app format with proper null handling
        const transformedData = data.data.notifications.map(item => {
          // FIXED: Handle null sender case
          if (!item.sender || !item.sender._id) {
            console.warn('Found notification with null/invalid sender:', item._id);
            // Skip notifications with invalid senders or provide default values
            return {
              _id: item._id,
              type: item.type || 'system',
              user: {
                _id: 'deleted-user',
                fullName: 'Deleted User',
                username: 'deleted',
                photoUrl: null,
                isOnline: false
              },
              message: item.message || 'This notification is from a deleted user',
              icon: 'person-remove-outline',
              color: '#9E9E9E',
              timeAgo: item.timeAgo || 'Unknown time',
              isRead: item.isRead || false
            };
          }
          
          // Determine icon and color based on type
          let icon, color;
          switch (item.type) {
            case 'impression':
              icon = 'eye-outline';
              color = '#4A90E2';
              break;
            case 'follow':
              icon = 'person-add-outline';
              color = '#34A853';
              break;
            case 'like':
              icon = 'heart-outline';
              color = '#EA4335';
              break;
            default:
              icon = 'notifications-outline';
              color = '#9E9E9E';
          }

          return {
            _id: item._id,
            type: item.type,
            user: {
              _id: item.sender._id,
              fullName: item.sender.fullName || 'Unknown User',
              username: item.sender.username || 'unknown',
              photoUrl: item.sender.photoUrl,
              isOnline: item.sender.isOnline || false
            },
            message: item.message || 'No message',
            icon,
            color,
            timeAgo: item.timeAgo || 'Unknown time',
            isRead: item.isRead || false,
            // For like notifications, add post preview
            ...(item.type === 'like' && item.metadata?.postContent && {
              post: {
                _id: item.relatedContent?.contentId,
                content: item.metadata.postContent || ''
              }
            })
          };
        }).filter(Boolean); // Filter out any null/undefined items
        
        console.log('Transformed notifications:', transformedData.length);
        setNotifications(transformedData);
        setPagination(data.data.pagination);
      } else {
        console.error('API Error:', data.message);
        Alert.alert('Error', data.message || 'Failed to fetch notifications');
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
      Alert.alert('Error', 'Network error. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchNotifications();
  };

  const handleUserPress = (userId) => {
    // Don't navigate if user is deleted
    if (userId === 'deleted-user') {
      Alert.alert('User Not Available', 'This user is no longer available.');
      return;
    }
    navigation.navigate('UserProfile', { userId });
  };

  const handlePostPress = (postId) => {
    if (!postId) {
      Alert.alert('Post Not Available', 'This post is no longer available.');
      return;
    }
    navigation.navigate('PostDetail', { postId });
  };

  const markAsRead = async (notificationId) => {
    try {
      const response = await fetch(
        `https://backendforheartlink.in/api/v1/notifications/${notificationId}/read`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
        }
      );
      
      if (response.ok) {
        // Update local state to mark as read
        setNotifications(prev => prev.map(notif => 
          notif._id === notificationId ? {...notif, isRead: true} : notif
        ));
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const renderNotificationItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.notificationItem}
      onPress={() => {
        if (item.type === 'like' && item.post) {
          handlePostPress(item.post._id);
        } else {
          handleUserPress(item.user._id);
        }
        if (!item.isRead) {
          markAsRead(item._id);
        }
      }}
    >
      <View style={styles.leftContainer}>
        <View style={[styles.iconContainer, { backgroundColor: item.color }]}>
          <Icon name={item.icon} size={20} color="white" />
        </View>
      </View>
      
      <View style={styles.middleContainer}>
        <View style={styles.userInfo}>
          {item.user.photoUrl ? (
            <Image source={{ uri: item.user.photoUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.defaultAvatar}>
              <Text style={styles.avatarText}>
                {item.user.fullName?.charAt(0)?.toUpperCase() || 'U'}
              </Text>
            </View>
          )}
          
          <Text style={styles.userName} numberOfLines={1}>
            {item.user.fullName || 'Unknown User'}
          </Text>
        </View>
        
        <Text style={styles.messageText}>
          {item.message}
          {item.type === 'like' && ':'}
        </Text>
        
        {item.type === 'like' && item.post?.content && (
          <Text style={styles.postPreview} numberOfLines={1}>
            "{item.post.content.substring(0, 30)}..."
          </Text>
        )}
        
        <Text style={styles.timeAgo}>{item.timeAgo}</Text>
      </View>
      
      {!item.isRead && (
        <View style={styles.unreadIndicator} />
      )}
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Icon name="notifications-off-outline" size={64} color="#666" style={styles.emptyIcon} />
      <Text style={styles.emptyTitle}>No notifications yet</Text>
      <Text style={styles.emptySubtitle}>
        {activeTab === 'impressions' 
          ? 'When someone views your profile, you\'ll see it here' 
          : activeTab === 'follows'
          ? 'When someone follows you, you\'ll see it here'
          : activeTab === 'likes'
          ? 'When someone likes your post, you\'ll see it here'
          : 'Your recent activities will appear here'}
      </Text>
    </View>
  );

  const renderTabButton = (tabName, iconName, label) => (
    <TouchableOpacity
      style={[styles.tabButton, activeTab === tabName && styles.activeTab]}
      onPress={() => setActiveTab(tabName)}
    >
      <Icon 
        name={iconName} 
        size={20} 
        color={activeTab === tabName ? '#007AFF' : '#666'} 
      />
      <Text style={[styles.tabText, activeTab === tabName && styles.activeTabText]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
        <Icon name="arrow-back" size={24} color="white" />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Notifications</Text>
      <View style={styles.headerRight}>
        <TouchableOpacity onPress={handleRefresh} style={styles.headerButton}>
          <Icon name="refresh" size={24} color="white" />
        </TouchableOpacity>
        {/* ✅ ADD VALIDATE TOKEN BUTTON */}
        <TouchableOpacity onPress={validateFCMToken} style={[styles.headerButton, { marginLeft: 8 }]}>
          <Text style={styles.validateButtonText}>Validate</Text>
        </TouchableOpacity>
        {/* ✅ ADD FORCE REGISTER TOKEN BUTTON */}
        <TouchableOpacity onPress={forceRegisterFCMToken} style={[styles.headerButton, { marginLeft: 8 }]}>
          <Text style={styles.validateButtonText}>Force Register</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        {renderHeader()}
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading notifications...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {renderHeader()}
      
      {/* Tab Bar */}
      <View style={styles.tabBar}>
        {renderTabButton('all', 'notifications-outline', 'All')}
        {/* {renderTabButton('impressions', 'eye-outline', 'Views')} */}
        {renderTabButton('follows', 'person-add-outline', 'Follows')}
        {renderTabButton('likes', 'heart-outline', 'Likes')}
      </View>
      
      <FlatList
        data={notifications}
        renderItem={renderNotificationItem}
        keyExtractor={(item) => item._id}
        style={styles.list}
        contentContainerStyle={notifications.length === 0 ? styles.emptyList : null}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#007AFF"
          />
        }
        ListEmptyComponent={renderEmptyState}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    paddingTop: 50,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    padding: 8,
  },
  validateButtonText: {
    color: '#007AFF',
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#007AFF',
    borderRadius: 12,
  },
  tabBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    backgroundColor: '#111',
  },
  tabButton: {
    alignItems: 'center',
    padding: 8,
    borderRadius: 20,
    flexDirection: 'row',
  },
  activeTab: {
    backgroundColor: '#1a1a1a',
  },
  tabText: {
    marginLeft: 6,
    color: '#666',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#007AFF',
  },
  list: {
    flex: 1,
  },
  emptyList: {
    flex: 1,
  },
  notificationItem: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
    position: 'relative',
  },
  leftContainer: {
    marginRight: 15,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  middleContainer: {
    flex: 1,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 10,
  },
  defaultAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  avatarText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
    maxWidth: '70%',
  },
  messageText: {
    fontSize: 14,
    color: '#aaa',
    marginBottom: 3,
  },
  postPreview: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    marginBottom: 5,
  },
  timeAgo: {
    fontSize: 12,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIcon: {
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: 'white',
    marginTop: 16,
    fontSize: 16,
  },
  unreadIndicator: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#007AFF',
  },
});

export default NotificationsScreen;