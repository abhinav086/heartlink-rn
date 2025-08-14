// LikeScreen.js - Enhanced Modal Version with React Navigation support

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  RefreshControl,
  SafeAreaView,
} from 'react-native';
import Modal from 'react-native-modal';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useRoute } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import BASE_URL from '../../config/config';

const LikeScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { postId, initialLikeCount } = route.params || {};

  // State management
  const [isVisible, setIsVisible] = useState(true);
  const [likedUsers, setLikedUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [followingStates, setFollowingStates] = useState({});
  const [followLoadingStates, setFollowLoadingStates] = useState({});
  const [debugInfo, setDebugInfo] = useState('');

  // Helper functions
  const getInitials = (fullName) => {
    if (!fullName || fullName === 'Deleted User') return '?';
    
    const names = fullName.trim().split(' ');
    if (names.length === 1) {
      return names[0].charAt(0).toUpperCase();
    }
    
    return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase();
  };

  const getAvatarColor = (name) => {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
      '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
      '#F8C471', '#82E0AA', '#F1948A', '#85C1E9', '#D2B4DE'
    ];
    
    if (!name) return colors[0];
    const charCodeSum = name.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
    return colors[charCodeSum % colors.length];
  };

  const getUserImageUrl = (user) => {
    if (!user || typeof user !== 'object') return '';
    return user?.photoUrl || user?.profilePicture || user?.avatar || '';
  };

  const getUserName = (user) => {
    return user?.fullName || user?.name || user?.username || 'Unknown User';
  };

  const getUserId = (user) => {
    return user?._id || user?.id || 'unknown';
  };

  // Get auth token
  const getAuthToken = async () => {
    try {
      return await AsyncStorage.getItem('token');
    } catch (error) {
      console.error('Error getting auth token:', error);
      return null;
    }
  };

  // Handle modal close
  const handleClose = () => {
    setIsVisible(false);
    // Small delay to let the animation complete before going back
    setTimeout(() => {
      navigation.goBack();
    }, 300);
  };

  // ENHANCED: Fetch users who liked the post with better debugging
  const fetchLikedUsers = async () => {
    console.log('🚀 === FETCH LIKED USERS START ===');
    
    if (!postId) {
      console.error('❌ Post ID is missing:', postId);
      setError('Post ID is required');
      setLoading(false);
      return;
    }

    try {
      setError(null);
      setDebugInfo('Getting auth token...');
      const token = await getAuthToken();
      
      if (!token) {
        console.error('❌ No auth token available');
        throw new Error('Authentication required');
      }

      const apiUrl = `${BASE_URL}/api/v1/posts/${postId}/likes`;
      console.log('📡 Full API URL:', apiUrl);
      setDebugInfo(`Fetching from: ${apiUrl}`);

      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
      });

      console.log('📊 Response status:', response.status);
      setDebugInfo(`Response status: ${response.status}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ API Error Response:', errorText);
        
        let errorMessage = `API Error ${response.status}`;
        if (response.status === 404) {
          errorMessage = 'Post not found or no likes available';
        } else if (response.status === 403) {
          errorMessage = 'Access denied to view likes for this post';
        } else if (response.status === 401) {
          errorMessage = 'Please log in again to view likes';
        } else {
          errorMessage = `Failed to fetch likes: ${response.status}`;
        }
        
        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log('✅ === FULL API RESPONSE ===');
      console.log('Response keys:', Object.keys(result));
      console.log('Success:', result.success);
      
      if (result.data) {
        console.log('Data keys:', Object.keys(result.data));
        if (result.data.users) {
          console.log('Users array length:', result.data.users.length);
          console.log('First user sample:', result.data.users[0]);
        }
        if (result.data.pagination) {
          console.log('Pagination:', result.data.pagination);
        }
      }
      
      // ENHANCED: Better response structure handling
      if (result.success) {
        const data = result.data || {};
        
        if (data.users && Array.isArray(data.users)) {
          console.log(`👥 Found ${data.users.length} users who liked this post`);
          
          // ENHANCED: Validate and clean user data
          const validUsers = data.users.filter(user => {
            const isValid = user && (user._id || user.id) && (user.fullName || user.username);
            if (!isValid) {
              console.warn('⚠️ Invalid user data:', user);
            }
            return isValid;
          });

          console.log(`✅ Valid users after filtering: ${validUsers.length}`);
          setLikedUsers(validUsers);
          setDebugInfo(`Loaded ${validUsers.length} users successfully`);
          
          // Initialize follow states
          const followStates = {};
          validUsers.forEach(user => {
            const userId = getUserId(user);
            followStates[userId] = user.isFollowedByCurrentUser || false;
          });
          setFollowingStates(followStates);

          // ENHANCED: Show user names in debug
          console.log('User names:', validUsers.map(u => u.fullName || u.username).join(', '));
          
        } else {
          console.log('⚠ No users array found or empty array');
          console.log('Available data keys:', Object.keys(data));
          setLikedUsers([]);
          setDebugInfo('No users found in response');
        }
      } else {
        console.log('❌ API response unsuccessful');
        console.log('Error message:', result.message);
        throw new Error(result.message || 'Failed to fetch likes');
      }

    } catch (error) {
      console.error('❌ === FETCH ERROR ===', error);
      setError(error.message);
      setLikedUsers([]);
      setDebugInfo(`Error: ${error.message}`);
    } finally {
      setLoading(false);
      setRefreshing(false);
      console.log('🏁 === FETCH LIKED USERS END ===');
    }
  };

  // ENHANCED: Get user details using the new endpoint
  const fetchUserDetails = async (userId) => {
    try {
      const token = await getAuthToken();
      if (!token) return null;

      const response = await fetch(`${BASE_URL}/api/v1/posts/users/user/${userId}`, {
        method: 'GET',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data?.user) {
          return result.data.user;
        }
      }
      return null;
    } catch (error) {
      console.error('Error fetching user details:', error);
      return null;
    }
  };

  // Handle follow/unfollow
  const handleFollowPress = async (userId) => {
    if (!userId || userId === 'unknown' || followLoadingStates[userId]) return;

    try {
      setFollowLoadingStates(prev => ({ ...prev, [userId]: true }));
      const token = await getAuthToken();
      
      if (!token) {
        Alert.alert('Error', 'Please log in to follow users');
        return;
      }

      const isFollowing = followingStates[userId];
      const endpoint = isFollowing ? 'unfollow' : 'follow';
      
      const response = await fetch(`${BASE_URL}/api/v1/users/${endpoint}/${userId}`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setFollowingStates(prev => ({ ...prev, [userId]: !isFollowing }));
        } else {
          throw new Error(result.message || 'Follow action failed');
        }
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Follow action failed');
      }
    } catch (error) {
      console.error('❌ Follow error:', error);
      Alert.alert('Error', error.message);
    } finally {
      setFollowLoadingStates(prev => ({ ...prev, [userId]: false }));
    }
  };

  // Handle profile navigation
  const handleProfilePress = async (userId) => {
    if (userId && userId !== 'unknown') {
      // Close modal first
      handleClose();
      
      // Small delay to ensure modal closes before navigation
      setTimeout(async () => {
        // Optionally fetch fresh user details before navigation
        const userDetails = await fetchUserDetails(userId);
        navigation.navigate('UserProfile', { 
          userId, 
          userDetails: userDetails || undefined 
        });
      }, 500);
    }
  };

  // Refresh handler
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchLikedUsers();
  }, [postId]);

  // Initialize when component mounts
  useEffect(() => {
    if (postId) {
      fetchLikedUsers();
    } else {
      setError('Post ID is missing');
      setLoading(false);
    }
  }, [postId]);

  // ENHANCED: Render user item with better handling of deleted users
  const renderUserItem = ({ item, index }) => {
    const userId = getUserId(item);
    const userName = getUserName(item);
    const userImage = getUserImageUrl(item);
    const hasProfilePic = !!userImage;
    const isFollowing = followingStates[userId] || false;
    const isFollowLoading = followLoadingStates[userId] || false;
    const isDeleted = item.isDeleted || item.fullName === 'Deleted User';
    const isInactive = item.isUserActive === false;

    return (
      <View style={[
        styles.userItem,
        (isDeleted || isInactive) && styles.inactiveUser
      ]}>
        <TouchableOpacity 
          onPress={() => !isDeleted && handleProfilePress(userId)} 
          style={styles.userInfo}
          activeOpacity={isDeleted ? 1 : 0.8}
          disabled={isDeleted}
        >
          <View style={[
            styles.avatar, 
            { backgroundColor: getAvatarColor(userName) },
            isDeleted && styles.deletedAvatar
          ]}>
            {hasProfilePic && !isDeleted ? (
              <Image 
                source={{ uri: userImage }} 
                style={styles.profileImage}
                onError={() => console.log('Image failed to load')}
              />
            ) : (
              <Text style={[
                styles.avatarText,
                isDeleted && styles.deletedText
              ]}>
                {getInitials(userName)}
              </Text>
            )}
          </View>
          
          <View style={styles.userDetails}>
            <Text style={[
              styles.userName,
              isDeleted && styles.deletedText
            ]}>
              {userName}
              {isDeleted && ' (Deleted)'}
              {isInactive && !isDeleted && ' (Inactive)'}
            </Text>
            {item.username && item.username !== userName && !isDeleted && (
              <Text style={styles.userHandle}>@{item.username}</Text>
            )}
            {item.bio && !isDeleted && (
              <Text style={styles.userBio} numberOfLines={1}>{item.bio}</Text>
            )}
            {item.likedAt && (
              <Text style={styles.likeTime}>
                Liked on {new Date(item.likedAt).toLocaleDateString()}
              </Text>
            )}
          </View>
        </TouchableOpacity>

        {userId !== 'unknown' && !isDeleted && (
          <TouchableOpacity 
            style={[
              styles.followButton,
              isFollowing ? styles.followingButton : styles.followNotFollowingButton
            ]}
            onPress={() => handleFollowPress(userId)}
            disabled={isFollowLoading}
          >
            <Text style={[
              styles.followButtonText,
              isFollowing ? styles.followingText : styles.notFollowingText
            ]}>
              {isFollowLoading ? '...' : (isFollowing ? 'Following' : 'Follow')}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // ENHANCED: Empty component with debug info
  const renderEmptyComponent = () => (
    <View style={styles.emptyContainer}>
      <Ionicons 
        name={error ? "alert-circle-outline" : "heart-outline"} 
        size={60} 
        color={error ? "#FF6B6B" : "#666"} 
      />
      <Text style={styles.emptyText}>
        {error ? 'Failed to load likes' : 'No likes yet'}
      </Text>
      <Text style={styles.emptySubtext}>
        {error ? error : 'Be the first to like this post!'}
      </Text>
      
      {/* Debug info */}
      {__DEV__ && debugInfo && (
        <Text style={styles.debugText}>
          Debug: {debugInfo}
        </Text>
      )}
      
      {error && (
        <TouchableOpacity 
          style={styles.retryButton} 
          onPress={() => {
            setError(null);
            setLoading(true);
            fetchLikedUsers();
          }}
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  // Header component
  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
        <Ionicons name="close" size={24} color="#FFF" />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>
        {loading ? 'Loading...' : `${likedUsers.length} ${likedUsers.length === 1 ? 'Like' : 'Likes'}`}
      </Text>
      <View style={styles.headerSpacer} />
    </View>
  );

  // Modal content
  const renderModalContent = () => {
    if (loading && !refreshing) {
      return (
        <SafeAreaView style={styles.modalContainer}>
          {renderHeader()}
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#1DA1F2" />
            <Text style={styles.loadingText}>Loading likes...</Text>
            {__DEV__ && debugInfo && (
              <Text style={styles.debugText}>{debugInfo}</Text>
            )}
          </View>
        </SafeAreaView>
      );
    }

    return (
      <SafeAreaView style={styles.modalContainer}>
        {renderHeader()}
        <FlatList
          data={likedUsers}
          keyExtractor={(item, index) => `${getUserId(item)}-${index}`}
          renderItem={renderUserItem}
          ListEmptyComponent={renderEmptyComponent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#1DA1F2"
              colors={['#1DA1F2']}
            />
          }
          contentContainerStyle={likedUsers.length === 0 ? styles.emptyListContainer : styles.listContainer}
          showsVerticalScrollIndicator={false}
          getItemLayout={(data, index) => ({
            length: 70,
            offset: 70 * index,
            index,
          })}
        />
      </SafeAreaView>
    );
  };

  return (
    <View style={styles.screenContainer}>
      <Modal
        isVisible={isVisible}
        onBackdropPress={handleClose}
        onBackButtonPress={handleClose}
        onSwipeComplete={handleClose}
        swipeDirection={['down']}
        style={styles.modal}
        propagateSwipe={true}
        avoidKeyboard={true}
        useNativeDriverForBackdrop={true}
        animationIn="slideInUp"
        animationOut="slideOutDown"
        animationInTiming={300}
        animationOutTiming={300}
        backdropTransitionInTiming={300}
        backdropTransitionOutTiming={300}
      >
        {renderModalContent()}
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  modal: {
    justifyContent: 'flex-end',
    margin: 0,
  },
  modalContainer: {
    backgroundColor: '#000',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    minHeight: '60%',
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    padding: 15,
    paddingTop: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#2C2C2C',
    alignItems: 'center',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  closeButton: {
    padding: 5,
    marginRight: 10,
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
  },
  headerSpacer: {
    width: 34,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#666',
    marginTop: 10,
    fontSize: 16,
  },
  debugText: {
    color: '#888',
    fontSize: 12,
    marginTop: 10,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  listContainer: {
    paddingBottom: 20,
  },
  emptyListContainer: {
    flexGrow: 1,
  },
  userItem: {
    flexDirection: 'row',
    padding: 15,
    alignItems: 'center',
    borderBottomWidth: 0.5,
    borderBottomColor: '#2C2C2C',
    minHeight: 70,
  },
  inactiveUser: {
    opacity: 0.6,
  },
  userInfo: {
    flexDirection: 'row',
    flex: 1,
    alignItems: 'center',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  deletedAvatar: {
    backgroundColor: '#444',
  },
  avatarText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 18,
  },
  deletedText: {
    color: '#888',
  },
  profileImage: {
    width: '100%',
    height: '100%',
    borderRadius: 25,
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 16,
    marginBottom: 2,
  },
  userHandle: {
    color: '#888',
    fontSize: 14,
    marginBottom: 2,
  },
  userBio: {
    color: '#666',
    fontSize: 13,
    marginBottom: 2,
  },
  likeTime: {
    color: '#555',
    fontSize: 12,
  },
  followButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    minWidth: 80,
    alignItems: 'center',
  },
  followNotFollowingButton: {
    backgroundColor: '#1DA1F2',
  },
  followingButton: {
    borderWidth: 1,
    borderColor: '#666',
    backgroundColor: 'transparent',
  },
  followButtonText: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  notFollowingText: {
    color: '#FFF',
  },
  followingText: {
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 10,
    textAlign: 'center',
  },
  emptySubtext: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 20,
  },
  retryButton: {
    backgroundColor: '#1DA1F2',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 10,
  },
  retryButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default LikeScreen;