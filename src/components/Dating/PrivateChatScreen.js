import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  RefreshControl,
  Alert,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../../context/AuthContext.tsx';
import BASE_URL from '../../config/config.js';

const UsersWhoMessagedList = () => {
  const navigation = useNavigation();
  const { user, token } = useAuth();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    hasNextPage: false,
  });

  // Fetch received messages and group by sender
  const fetchUsersWhoMessaged = async (page = 1, isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else if (page === 1) {
        setLoading(true);
      }

      console.log('Fetching messages from:', `${BASE_URL}/api/v1/private-messages/received?page=${page}&limit=50`);

      const response = await fetch(
        `${BASE_URL}/api/v1/private-messages/received?page=${page}&limit=50`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log('API Response:', JSON.stringify(data, null, 2));
        
        if (data.success) {
          const messages = data.data.messages || [];
          console.log('Messages received:', messages.length);
          
          // Log first message to see structure
          if (messages.length > 0) {
            console.log('First message structure:', JSON.stringify(messages[0], null, 2));
          }
          
          // Group messages by sender to get unique users
          const userMap = new Map();
          
          messages.forEach(message => {
            const senderId = message.sender._id;
            console.log('Processing message from sender:', message.sender);
            
            if (!userMap.has(senderId)) {
              userMap.set(senderId, {
                user: message.sender,
                lastMessage: message,
                unreadCount: message.isRead ? 0 : 1,
                totalMessages: 1,
              });
            } else {
              const existing = userMap.get(senderId);
              // Update with latest message if this one is newer
              if (new Date(message.createdAt) > new Date(existing.lastMessage.createdAt)) {
                existing.lastMessage = message;
              }
              existing.totalMessages += 1;
              if (!message.isRead) {
                existing.unreadCount += 1;
              }
            }
          });

          // Convert map to array and sort by latest message time
          const uniqueUsers = Array.from(userMap.values()).sort(
            (a, b) => new Date(b.lastMessage.createdAt) - new Date(a.lastMessage.createdAt)
          );

          console.log('Unique users processed:', uniqueUsers.length);
          if (uniqueUsers.length > 0) {
            console.log('First user data:', JSON.stringify(uniqueUsers[0].user, null, 2));
          }

          if (page === 1 || isRefresh) {
            setUsers(uniqueUsers);
          } else {
            setUsers(prev => [...prev, ...uniqueUsers]);
          }
          
          setPagination(data.data.pagination || {});
        }
      } else {
        console.error('Failed to fetch users:', response.status);
        Alert.alert('Error', 'Failed to load messages. Please try again.');
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      Alert.alert('Error', 'Failed to load messages. Please check your connection.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Refresh data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (token) {
        fetchUsersWhoMessaged(1, true);
      }
    }, [token])
  );

  // Navigate to messaging page - FIXED: Handle both photoUrl and avatar
  const navigateToMessagingPage = (userData) => {
    const profilePic = userData.user.photoUrl || userData.user.avatar || null;
    console.log('Navigating with profilePic:', profilePic);
    
    navigation.navigate('PrivateTakeOnDate', {
      userId: userData.user._id,
      username: userData.user.username,
      profilePic: profilePic,
    });
  };

  // Format time for display
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      const minutes = Math.floor((now - date) / (1000 * 60));
      return minutes <= 1 ? 'Just now' : `${minutes}m ago`;
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`;
    } else if (diffInHours < 48) {
      return 'Yesterday';
    } else {
      const days = Math.floor(diffInHours / 24);
      return `${days}d ago`;
    }
  };

  // Get user initials for avatar fallback - IMPROVED: Handle both fullName and username
  const getInitials = (userData) => {
    const name = userData.fullName || userData.username;
    if (!name) return '?';
    
    const names = name.split(' ').filter(Boolean);
    if (names.length === 1) return names[0].charAt(0).toUpperCase();
    return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase();
  };

  // Get avatar color based on username
  const getAvatarColor = (userData) => {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98FB98', '#F0E68C'];
    const name = userData.username || userData.fullName;
    if (!name) return colors[0];
    const charCodeSum = name.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
    return colors[charCodeSum % colors.length];
  };

  // Get user display name - NEW: Show fullName if available, otherwise username
  const getDisplayName = (userData) => {
    if (userData.fullName && userData.fullName.trim()) {
      return userData.fullName;
    }
    return userData.username || 'Unknown User';
  };

  // Refresh function
  const onRefresh = useCallback(() => {
    fetchUsersWhoMessaged(1, true);
  }, []);

  // Load more users (if pagination is needed)
  const loadMoreUsers = () => {
    if (pagination.hasNextPage && !loading) {
      fetchUsersWhoMessaged(pagination.currentPage + 1);
    }
  };

  // Render individual user item
  const renderUserItem = ({ item }) => {
    const { user: userData, lastMessage, unreadCount, totalMessages } = item;
    
    // Get the image URL - handle both photoUrl and avatar fields
    const imageUrl = userData.photoUrl || userData.avatar;
    
    console.log('Rendering user:', userData.username, 'Image URL:', imageUrl);
    
    return (
      <TouchableOpacity
        style={styles.userItem}
        onPress={() => navigateToMessagingPage(item)}
        activeOpacity={0.7}
      >
        <View style={styles.userItemContent}>
          {/* Avatar - FIXED: Handle both photoUrl and avatar */}
          <View style={styles.avatarContainer}>
            {imageUrl ? (
              <>
                <Image 
                  source={{ uri: imageUrl }} 
                  style={styles.avatar}
                  onError={(error) => {
                    console.log('Image load error for user:', userData.username, error.nativeEvent.error);
                  }}
                  onLoad={() => {
                    console.log('Image loaded successfully for user:', userData.username);
                  }}
                />
                {/* Fallback overlay in case image fails to load */}
                <View style={styles.imageOverlay} />
              </>
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: getAvatarColor(userData) }]}>
                <Text style={styles.avatarText}>{getInitials(userData)}</Text>
              </View>
            )}
            {userData.isVerified && (
              <View style={styles.verifiedBadge}>
                <Icon name="checkmark" size={12} color="white" />
              </View>
            )}
          </View>

          {/* User Info - ENHANCED: Show both full name and username */}
          <View style={styles.userInfo}>
            <View style={styles.userHeader}>
              <View style={styles.nameContainer}>
                <Text style={styles.displayName}>{getDisplayName(userData)}</Text>
                {userData.fullName && userData.username && (
                  <Text style={styles.username}>@{userData.username}</Text>
                )}
              </View>
              <Text style={styles.messageTime}>{formatTime(lastMessage.createdAt)}</Text>
            </View>
            
            <View style={styles.messageInfo}>
              <Text style={styles.lastMessage}>{lastMessage.messageContent}</Text>
              {unreadCount > 0 && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadCount}>{unreadCount}</Text>
                </View>
              )}
            </View>
            
            <Text style={styles.messageStats}>
              {totalMessages} message{totalMessages !== 1 ? 's' : ''}
            </Text>
          </View>

          {/* Arrow Icon */}
          <View style={styles.arrowContainer}>
            <Icon name="chevron-forward" size={20} color="#666" />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // Empty state component
  const renderEmptyState = () => (
    <View style={styles.emptyStateContainer}>
      <Icon name="mail-outline" size={64} color="#666" />
      <Text style={styles.emptyStateText}>No messages in inbox</Text>
      <Text style={styles.emptyStateSubtext}>
        When someone sends you a Hi or Hello message, they'll appear here.
        Tap to view your conversation.
      </Text>
    </View>
  );

  if (loading && users.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Icon name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Inbox</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#ed167e" />
          <Text style={styles.loadingText}>Loading messages...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Messages</Text>
        <View style={styles.headerRight}>
          <Text style={styles.messageCount}>{users.length} users</Text>
        </View>
      </View>

      {/* Users List */}
      <FlatList
        data={users}
        keyExtractor={(item) => item.user._id}
        renderItem={renderUserItem}
        style={styles.usersList}
        contentContainerStyle={users.length === 0 ? styles.emptyContainer : styles.usersContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#ed167e"
          />
        }
        ListEmptyComponent={renderEmptyState}
        onEndReached={loadMoreUsers}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          pagination.hasNextPage && !loading ? (
            <View style={styles.loadingFooter}>
              <ActivityIndicator size="small" color="#ed167e" />
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    backgroundColor: 'black',
  },
  backButton: {
    padding: 5,
    marginRight: 15,
  },
  headerTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: '600',
    fontFamily: 'Montserrat-Regular',
    flex: 1,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  messageCount: {
    color: '#999',
    fontSize: 14,
    fontFamily: 'Montserrat-Regular',
  },
  usersList: {
    flex: 1,
    backgroundColor: 'black',
  },
  usersContainer: {
    paddingVertical: 10,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyStateContainer: {
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyStateText: {
    color: 'white',
    fontSize: 20,
    fontWeight: '600',
    fontFamily: 'Montserrat-Regular',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    color: '#999',
    fontSize: 16,
    fontFamily: 'Montserrat-Regular',
    textAlign: 'center',
    lineHeight: 22,
  },
  userItem: {
    backgroundColor: '#111',
    marginHorizontal: 15,
    marginVertical: 5,
    borderRadius: 12,
    overflow: 'hidden',
  },
  userItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 15,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#333', // Fallback background
  },
  // NEW: Overlay to handle image loading issues
  imageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 25,
    backgroundColor: 'transparent',
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: 'Montserrat-Regular',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#ed167e',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'black',
  },
  userInfo: {
    flex: 1,
  },
  userHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  // NEW: Container for name and username
  nameContainer: {
    flex: 1,
    marginRight: 10,
  },
  // NEW: Main display name (fullName if available)
  displayName: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Montserrat-Regular',
  },
  // UPDATED: Username style (smaller, secondary)
  username: {
    color: '#999',
    fontSize: 14,
    fontFamily: 'Montserrat-Regular',
    marginTop: 2,
  },
  messageTime: {
    color: '#999',
    fontSize: 12,
    fontFamily: 'Montserrat-Regular',
  },
  messageInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  lastMessage: {
    color: '#ccc',
    fontSize: 14,
    fontFamily: 'Montserrat-Regular',
    flex: 1,
  },
  unreadBadge: {
    backgroundColor: '#ed167e',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    paddingHorizontal: 6,
  },
  unreadCount: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'Montserrat-Regular',
  },
  messageStats: {
    color: '#666',
    fontSize: 12,
    fontFamily: 'Montserrat-Regular',
  },
  arrowContainer: {
    marginLeft: 10,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#999',
    fontSize: 16,
    fontFamily: 'Montserrat-Regular',
    marginTop: 12,
  },
  loadingFooter: {
    paddingVertical: 20,
    alignItems: 'center',
  },
});

export default UsersWhoMessagedList;