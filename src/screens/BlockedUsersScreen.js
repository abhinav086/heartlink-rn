import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Animated,
  Image,
  TextInput,
  Modal,
  TouchableWithoutFeedback,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../context/AuthContext';
import { useNavigation, useRoute } from '@react-navigation/native';
import BASE_URL from '../config/config';

// Define the pink theme color
const PINK_THEME_COLOR = '#ed167e';

const BlockedUsersScreen = () => {
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [blockedUsersList, setBlockedUsersList] = useState([]);
  const [filteredBlockedUsers, setFilteredBlockedUsers] = useState([]);
  const [unblockingUser, setUnblockingUser] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [unblockModalVisible, setUnblockModalVisible] = useState(false);
  const [animatedValue] = useState(new Animated.Value(0));
  const [modalAnimation] = useState(new Animated.Value(0));

  const { user: currentUser, token } = useAuth();
  const navigation = useNavigation();
  const route = useRoute();
  
  // Get parameters from navigation (keeping for compatibility but not using for local data)
  const { 
    setBlockedUsers, 
    onUnblockUser 
  } = route.params || {};

  // Animate screen on mount
  useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, []);

  // Filter blocked users based on search query
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredBlockedUsers(blockedUsersList);
    } else {
      const filtered = blockedUsersList.filter(user => {
        const fullName = user.fullName || '';
        const username = user.username || '';
        const email = user.email || '';
        
        return (
          fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          username.toLowerCase().includes(searchQuery.toLowerCase()) ||
          email.toLowerCase().includes(searchQuery.toLowerCase())
        );
      });
      setFilteredBlockedUsers(filtered);
    }
  }, [searchQuery, blockedUsersList]);

  // Fetch blocked users from server API only
  const fetchBlockedUsers = async () => {
    try {
      if (!token) {
        console.log('No token available');
        return;
      }

      console.log('Fetching blocked users list from server...');
      const response = await fetch(`${BASE_URL}/api/v1/heartlink/restricted-users`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      console.log('Blocked users response from server:', data);

      if (response.ok && data.success) {
        const users = data.data.blockedUsers || [];
        setBlockedUsersList(users);
        console.log('Successfully loaded blocked users from server:', users.length);
      } else {
        console.error('Error fetching blocked users from server:', data.message);
        Alert.alert('Error', data.message || 'Failed to load blocked users');
        setBlockedUsersList([]);
      }
    } catch (error) {
      console.error('Network error fetching blocked users from server:', error);
      Alert.alert('Error', 'Network error occurred while fetching blocked users');
      setBlockedUsersList([]);
    }
  };

  // Load data on screen focus
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    console.log('Starting to load blocked users data...');
    await fetchBlockedUsers();
    setLoading(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    console.log('Refreshing blocked users data...');
    await fetchBlockedUsers();
    setRefreshing(false);
  };

  // Unblock user function - API only
  const handleUnblockUser = async (userId) => {
    try {
      setUnblockingUser(userId);
      console.log('Unblocking user:', userId);
      
      const response = await fetch(`${BASE_URL}/api/v1/heartlink/user/${userId}/unrestrict`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      console.log('Unblock response:', data);

      if (response.ok && data.success) {
        // Update local state to remove unblocked user
        setBlockedUsersList(prev => prev.filter(user => user._id !== userId));
        
        // Update parent component's blocked users set if callback provided
        if (setBlockedUsers) {
          setBlockedUsers(prev => {
            const newSet = new Set(prev);
            newSet.delete(userId);
            return newSet;
          });
        }
        
        // Call parent callback if provided
        if (onUnblockUser) {
          onUnblockUser(userId);
        }
        
        Alert.alert('Success', 'User unblocked successfully');
      } else {
        throw new Error(data.message || 'Failed to unblock user');
      }
    } catch (error) {
      console.error('Error unblocking user:', error);
      Alert.alert('Error', error.message || 'Failed to unblock user');
    } finally {
      setUnblockingUser(null);
    }
  };

  // Unblock modal functions
  const showUnblockModal = (user) => {
    setSelectedUser(user);
    setUnblockModalVisible(true);
    
    Animated.spring(modalAnimation, {
      toValue: 1,
      useNativeDriver: true,
      tension: 50,
      friction: 8,
    }).start();
  };

  const hideUnblockModal = () => {
    Animated.spring(modalAnimation, {
      toValue: 0,
      useNativeDriver: true,
      tension: 50,
      friction: 8,
    }).start(() => {
      setUnblockModalVisible(false);
      setSelectedUser(null);
    });
  };

  const confirmUnblock = async () => {
    if (selectedUser) {
      hideUnblockModal();
      await handleUnblockUser(selectedUser._id);
    }
  };

  // Utility functions
  const getProfileImageUrl = (user) => {
    // Check all possible fields for profile picture
    const profilePic = user.photoUrl || user.profilePic || user.avatar || user.photo || '';

    if (profilePic && typeof profilePic === 'string' && profilePic.trim() !== '') {
      const trimmedPic = profilePic.trim();

      // Handle different URL formats
      if (trimmedPic.startsWith('http://') || trimmedPic.startsWith('https://')) {
        return trimmedPic;
      } else if (trimmedPic.startsWith('/')) {
        // Construct full URL if it's a relative path
        return `${BASE_URL}${trimmedPic}`;
      } else {
        // Assume it's a filename and construct full URL
        return `${BASE_URL}/${trimmedPic}`;
      }
    }
    return null;
  };

  const getInitials = (fullName) => {
    if (!fullName || typeof fullName !== 'string') return '?';
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
    const safeName = typeof name === 'string' ? name : '';
    const charCodeSum = safeName.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
    return colors[charCodeSum % colors.length];
  };

  const formatTime = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    
    const now = new Date();
    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) return 'Today';
    if (diffInDays === 1) return 'Yesterday';
    if (diffInDays < 7) return `${diffInDays} days ago`;
    if (diffInDays < 30) return `${Math.floor(diffInDays / 7)} weeks ago`;
    if (diffInDays < 365) return `${Math.floor(diffInDays / 30)} months ago`;
    return `${Math.floor(diffInDays / 365)} years ago`;
  };

  // Render avatar
  const renderAvatar = (user) => {
    const profileImageUrl = getProfileImageUrl(user);
    const safeFullName = user.fullName && typeof user.fullName === 'string' ? user.fullName : 'User';

    return (
      <View style={styles.avatarContainer}>
        <View
          style={[
            styles.avatar,
            { backgroundColor: getAvatarColor(safeFullName) }
          ]}
        >
          {profileImageUrl ? (
            <Image
              source={{ uri: profileImageUrl }}
              style={styles.avatarImage}
              onError={() => console.log('Error loading avatar for:', user._id, 'URL:', profileImageUrl)}
            />
          ) : (
            <Text style={styles.avatarText}>
              {getInitials(safeFullName)}
            </Text>
          )}
        </View>
        
        {/* Blocked indicator */}
        <View style={styles.blockedIndicator}>
          <Icon name="ban" size={16} color="#ef4444" />
        </View>
      </View>
    );
  };

  // Render unblock modal
  const renderUnblockModal = () => {
    if (!selectedUser) return null;

    return (
      <Modal
        visible={unblockModalVisible}
        transparent={true}
        animationType="none"
        onRequestClose={hideUnblockModal}
      >
        <TouchableWithoutFeedback onPress={hideUnblockModal}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <Animated.View
                style={[
                  styles.unblockModal,
                  {
                    transform: [
                      {
                        scale: modalAnimation.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.8, 1],
                        }),
                      },
                    ],
                    opacity: modalAnimation,
                  },
                ]}
              >
                <View style={styles.modalHeader}>
                  <View style={styles.modalUserInfo}>
                    {renderAvatar(selectedUser)}
                    <View style={styles.modalUserDetails}>
                      <Text style={styles.modalUserName} numberOfLines={1}>
                        {selectedUser.fullName || 'Unknown User'}
                      </Text>
                      <Text style={styles.modalUserUsername} numberOfLines={1}>
                        @{selectedUser.username || 'user'}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.modalContent}>
                  <Icon name="checkmark-circle" size={48} color="#10b981" style={styles.modalIcon} />
                  <Text style={styles.modalTitle}>Unblock User?</Text>
                  <Text style={styles.modalDescription}>
                    {selectedUser.fullName} will be able to message you and see your content again.
                  </Text>
                </View>

                <View style={styles.modalActions}>
                  <TouchableOpacity style={styles.modalCancelButton} onPress={hideUnblockModal}>
                    <Text style={styles.modalCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity style={styles.modalConfirmButton} onPress={confirmUnblock}>
                    <Icon name="checkmark" size={18} color="#fff" style={styles.modalButtonIcon} />
                    <Text style={styles.modalConfirmText}>Unblock</Text>
                  </TouchableOpacity>
                </View>
              </Animated.View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    );
  };

  // Render blocked user item
  const renderBlockedUserItem = ({ item, index }) => {
    const isUnblocking = unblockingUser === item._id;
    
    console.log('Rendering blocked user item:', {
      id: item._id,
      fullName: item.fullName,
      username: item.username,
    });

    return (
      <View style={styles.userContainer}>
        <View style={styles.userContent}>
          <View style={styles.userLeft}>
            {renderAvatar(item)}
            <View style={styles.userInfo}>
              <Text style={styles.userName} numberOfLines={1}>
                {item.fullName || 'Unknown User'}
              </Text>
              <Text style={styles.userUsername} numberOfLines={1}>
                @{item.username || 'user'}
              </Text>
              <Text style={styles.blockedTime}>
                Blocked {formatTime(item.blockedAt)}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.unblockButton, isUnblocking && styles.unblockButtonDisabled]}
            onPress={() => showUnblockModal(item)}
            disabled={isUnblocking}
          >
            {isUnblocking ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Icon name="checkmark" size={16} color="#fff" />
                <Text style={styles.unblockButtonText}>Unblock</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // Render empty state
  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconContainer}>
        <Icon name="ban" size={80} color="#374151" />
      </View>
      <Text style={styles.emptyTitle}>No Blocked Users</Text>
      <Text style={styles.emptySubtitle}>
        Users you block will appear here. You can unblock them anytime.
      </Text>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Icon name="arrow-back" size={24} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Blocked Users</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={PINK_THEME_COLOR} />
          <Text style={styles.loadingText}>Loading blocked users...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <Animated.View 
        style={[
          styles.header,
          {
            opacity: animatedValue,
            transform: [{
              translateY: animatedValue.interpolate({
                inputRange: [0, 1],
                outputRange: [-50, 0],
              }),
            }],
          }
        ]}
      >
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Blocked Users</Text>
          <Text style={styles.headerSubtitle}>
            {filteredBlockedUsers.length} {filteredBlockedUsers.length === 1 ? 'user' : 'users'} blocked
          </Text>
        </View>

        <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
          <Icon name="refresh" size={20} color={PINK_THEME_COLOR} />
        </TouchableOpacity>
      </Animated.View>

      {/* Search Bar */}
      {blockedUsersList.length > 0 && (
        <View style={styles.searchContainer}>
          <View style={styles.searchWrapper}>
            <Icon name="search" size={20} color="#9ca3af" style={styles.searchIcon} />
            <TextInput
              placeholder="Search blocked users..."
              placeholderTextColor="#9ca3af"
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
                <Icon name="close-circle" size={20} color="#9ca3af" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Blocked Users List */}
      <FlatList
        data={filteredBlockedUsers}
        keyExtractor={(item) => item._id}
        renderItem={renderBlockedUserItem}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[PINK_THEME_COLOR]}
            tintColor={PINK_THEME_COLOR}
          />
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />

      {/* Unblock Modal */}
      {renderUnblockModal()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f0f',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#111111',
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
  },
  backButton: {
    marginRight: 16,
    padding: 8,
  },
  headerCenter: {
    flex: 1,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: '#9ca3af',
    fontSize: 14,
    fontWeight: '500',
    marginTop: 2,
  },
  refreshButton: {
    padding: 8,
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#111111',
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f2937',
    borderRadius: 20,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#374151',
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    color: '#ffffff',
    paddingVertical: 14,
    fontSize: 16,
    fontWeight: '500',
  },
  clearButton: {
    padding: 4,
  },
  listContent: {
    paddingBottom: 20,
    flexGrow: 1,
  },
  userContainer: {
    backgroundColor: '#111111',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
  },
  userContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 70,
  },
  userLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 16,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 16,
    width: 50,
    height: 50,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#374151',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 25,
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  blockedIndicator: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    padding: 2,
    borderWidth: 2,
    borderColor: '#111111',
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userInfo: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 4,
  },
  userName: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
    lineHeight: 20,
  },
  userUsername: {
    color: '#9ca3af',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
    lineHeight: 18,
  },
  blockedTime: {
    color: '#6b7280',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
  unblockButton: {
    backgroundColor: '#10b981',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    gap: 6,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
    minWidth: 100,
    justifyContent: 'center',
  },
  unblockButtonDisabled: {
    opacity: 0.6,
  },
  unblockButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  separator: {
    height: 1,
    backgroundColor: '#1f2937',
    marginLeft: 86,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    color: '#9ca3af',
    fontSize: 16,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 60,
    backgroundColor: '#0f0f0f',
  },
  emptyIconContainer: {
    marginBottom: 24,
    opacity: 0.6,
  },
  emptyTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtitle: {
    color: '#9ca3af',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  unblockModal: {
    backgroundColor: '#1f2937',
    borderRadius: 24,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 1,
    borderColor: '#374151',
  },
  modalHeader: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  modalUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalUserDetails: {
    marginLeft: 16,
    flex: 1,
  },
  modalUserName: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  modalUserUsername: {
    color: '#9ca3af',
    fontSize: 14,
    fontWeight: '500',
  },
  modalContent: {
    paddingHorizontal: 24,
    paddingVertical: 24,
    alignItems: 'center',
  },
  modalIcon: {
    marginBottom: 16,
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  modalDescription: {
    color: '#9ca3af',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  modalActions: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingBottom: 24,
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: '#374151',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalConfirmButton: {
    flex: 1,
    backgroundColor: '#10b981',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalButtonIcon: {
    marginRight: 8,
  },
  modalConfirmText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default BlockedUsersScreen;