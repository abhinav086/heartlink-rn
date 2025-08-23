import React, { useState, useEffect, useCallback } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Keyboard,
  Animated,
  Dimensions,
  Image,
  Modal,
  TouchableWithoutFeedback,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import BASE_URL from '../../config/config';
import AllStories from '../../components/Home/Stories'; // Import AllStories component
const { width } = Dimensions.get('window');
// Define the new pinkish color
const PINK_THEME_COLOR = '#ed167e'; // Color #ed167e
const REPORT_TYPES = [
  { label: 'User', value: 'user' },
  { label: 'Post', value: 'post' },
  { label: 'Comment', value: 'comment' },
];
const REASONS = [
  { label: 'Violence/Threats', value: 'violence_threats' },
  { label: 'Harassment', value: 'harassment' },
  { label: 'Hate Speech', value: 'hate_speech' },
  { label: 'Inappropriate Content', value: 'inappropriate_content' },
  { label: 'Impersonation', value: 'impersonation' },
  { label: 'Spam', value: 'spam' },
  { label: 'Other', value: 'other' },
];
const CATEGORIES = [
  { label: 'Content', value: 'content' },
  { label: 'Behavior', value: 'behavior' },
  { label: 'Technical', value: 'technical' },
  { label: 'Legal', value: 'legal' },
  { label: 'Safety', value: 'safety' },
];
const SEVERITIES = [
  { label: 'Low', value: 'low' },
  { label: 'Medium', value: 'medium' },
  { label: 'High', value: 'high' },
  { label: 'Urgent', value: 'urgent' },
  { label: 'Critical', value: 'critical' },
];
const WChatScreen = () => {
  const [conversations, setConversations] = useState([]);
  const [users, setUsers] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showingUsers, setShowingUsers] = useState(false);
  const [creatingChat, setCreatingChat] = useState(null);
  const [animatedValue] = useState(new Animated.Value(0));
  // ✅ EXISTING: Story-related state
  const [stories, setStories] = useState([]);
  const [userStories, setUserStories] = useState({});
  const [currentUserStories, setCurrentUserStories] = useState([]);
  // ✅ UPDATED: Block-related state (API-only)
  const [blockedUsers, setBlockedUsers] = useState(new Set());
  const [blockModalVisible, setBlockModalVisible] = useState(false);
  const [selectedUserForBlock, setSelectedUserForBlock] = useState(null);
  const [blockingUser, setBlockingUser] = useState(null);
  const [blockModalAnimation] = useState(new Animated.Value(0));
  // ✅ NEW: Report user state
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [selectedUserForReport, setSelectedUserForReport] = useState(null);
  const [reportStep, setReportStep] = useState(1);
  const [reportType, setReportType] = useState('user');
  const [reason, setReason] = useState('');
  const [category, setCategory] = useState('behavior');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState('medium');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [submittingReport, setSubmittingReport] = useState(false);
  // State for auto-search debounce
  const [searchDebounceTimer, setSearchDebounceTimer] = useState(null);
  const { user: currentUser, token } = useAuth();
  const { 
    onlineUsers, 
    onlineUserIds, 
    isConnected, 
    socket,
    isUserOnline: socketIsUserOnline,
    getOnlineStatus 
  } = useSocket();
  const navigation = useNavigation();
  // Enhanced online status tracking with local state for immediate updates
  const [localOnlineUsers, setLocalOnlineUsers] = useState(new Set());
  const [lastOnlineUpdate, setLastOnlineUpdate] = useState(Date.now());
  // Enhanced function to check if a user is online
  const isUserOnline = useCallback((userId) => {
    if (!isConnected || !userId) {
      console.log('⚠ Cannot check online status: socket not connected or no userId');
      return false;
    }
    // Check both socket state and local state for most up-to-date info
    const socketOnline = socketIsUserOnline(userId);
    const localOnline = localOnlineUsers.has(userId);
    const isOnline = socketOnline || localOnline;
    // Debug logging (remove in production)
    console.log(`👤 Online check for ${userId}:`, {
      socketOnline,
      localOnline,
      finalResult: isOnline,
      totalSocketOnline: onlineUsers.length,
      totalLocalOnline: localOnlineUsers.size,
      socketConnected: isConnected
    });
    return isOnline;
  }, [isConnected, socketIsUserOnline, localOnlineUsers, onlineUsers.length]);
  // Add socket listeners for real-time online status updates
  useEffect(() => {
    if (!socket || !isConnected) {
      console.log('⚠ Socket not available for online status listeners');
      return;
    }
    console.log('🔌 Setting up online status listeners in WChatScreen');
    const handleUserOnline = (userData) => {
      console.log('✅ WChatScreen: User came online:', userData);
      const userId = userData.userId || userData.user?._id || userData._id;
      if (userId) {
        setLocalOnlineUsers(prev => new Set([...prev, userId]));
        setLastOnlineUpdate(Date.now());
        // Force re-render of conversations and users
        setConversations(prev => [...prev]);
        setUsers(prev => [...prev]);
      }
    };
    const handleUserOffline = (userData) => {
      console.log('❌ WChatScreen: User went offline:', userData);
      const userId = userData.userId || userData.user?._id || userData._id;
      if (userId) {
        setLocalOnlineUsers(prev => {
          const newSet = new Set(prev);
          newSet.delete(userId);
          return newSet;
        });
        setLastOnlineUpdate(Date.now());
        // Force re-render of conversations and users
        setConversations(prev => [...prev]);
        setUsers(prev => [...prev]);
      }
    };
    const handleAllOnlineUsers = (users) => {
      console.log('👥 WChatScreen: Received all online users:', users);
      let userIds = new Set();
      if (Array.isArray(users)) {
        userIds = new Set(users.map(user => {
          if (typeof user === 'string') return user;
          return user._id || user.id || user.userId;
        }).filter(Boolean));
      } else if (users && Array.isArray(users.users)) {
        userIds = new Set(users.users.map(user => user._id || user.id).filter(Boolean));
      }
      console.log('👥 WChatScreen: Processed online user IDs:', Array.from(userIds));
      setLocalOnlineUsers(userIds);
      setLastOnlineUpdate(Date.now());
      // Force re-render
      setConversations(prev => [...prev]);
      setUsers(prev => [...prev]);
    };
    const handleConnect = () => {
      console.log('🔌 WChatScreen: Socket connected, requesting online users');
      setTimeout(() => {
        socket.emit('getAllOnlineUsers');
      }, 1000);
    };
    const handleDisconnect = () => {
      console.log('🔌 WChatScreen: Socket disconnected, clearing local online users');
      setLocalOnlineUsers(new Set());
    };
    // Register listeners
    socket.on('userOnline', handleUserOnline);
    socket.on('userOffline', handleUserOffline);
    socket.on('allOnlineUsers', handleAllOnlineUsers);
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    // Request current online users
    socket.emit('getAllOnlineUsers');
    // Cleanup
    return () => {
      console.log('🧹 WChatScreen: Cleaning up online status listeners');
      socket.off('userOnline', handleUserOnline);
      socket.off('userOffline', handleUserOffline);
      socket.off('allOnlineUsers', handleAllOnlineUsers);
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
    };
  }, [socket, isConnected]);
  // Sync local state with socket state when socket state changes
  useEffect(() => {
    if (onlineUserIds && onlineUserIds.size > 0) {
      console.log('🔄 Syncing local online users with socket state:', onlineUserIds.size);
      setLocalOnlineUsers(new Set(onlineUserIds));
      setLastOnlineUpdate(Date.now());
    }
  }, [onlineUserIds]);
  // Periodic refresh of online status (fallback)
  useEffect(() => {
    const refreshInterval = setInterval(() => {
      if (socket && isConnected) {
        console.log('🔄 Periodic refresh: requesting online users');
        socket.emit('getAllOnlineUsers');
      }
    }, 30000); // Every 30 seconds
    return () => clearInterval(refreshInterval);
  }, [socket, isConnected]);
  // Add dependency on lastOnlineUpdate to force re-renders when online status changes
  useEffect(() => {
    // This effect doesn't do anything but triggers re-renders when online status changes
    console.log('🔄 Online status update detected, last update:', new Date(lastOnlineUpdate).toISOString());
  }, [lastOnlineUpdate]);
  // Function to validate if the search query is a valid mobile number (10-14 digits for international)
  const isValidMobileNumber = (query) => {
    const mobileRegex = /^\d{10,14}$/;
    return mobileRegex.test(query.trim());
  };
  // Function to get profile image URL - matching UpdateProfileScreen pattern
  const getProfileImageUrl = (user) => {
    // First check for photoUrl (as used in UpdateProfileScreen)
    if (user.photoUrl && typeof user.photoUrl === 'string') {
      return user.photoUrl;
    }
    // Check for alternative field names that might be used
    if (user.profilePicture && typeof user.profilePicture === 'string') {
      return user.profilePicture;
    }
    // Fallback to profilePic field
    if (user.profilePic && typeof user.profilePic === 'string') {
      // If it's already a complete URL (starts with http/https), return as is
      if (user.profilePic.startsWith('http://') || user.profilePic.startsWith('https://')) {
        return user.profilePic;
      }
      // If it's a relative path or filename, construct the full URL
      const cleanPath = user.profilePic.startsWith('/') ? user.profilePic.substring(1) : user.profilePic;
      return `${BASE_URL}/${cleanPath}`;
    }
    // Check for avatar field
    if (user.avatar && typeof user.avatar === 'string') {
      if (user.avatar.startsWith('http://') || user.avatar.startsWith('https://')) {
        return user.avatar;
      }
      const cleanPath = user.avatar.startsWith('/') ? user.avatar.substring(1) : user.avatar;
      return `${BASE_URL}/${cleanPath}`;
    }
    return null;
  };
  // ✅ EXISTING: Story utility functions (from AllStories component)
  const getSafeProfilePic = (userData) => {
    if (!userData) {
      console.log('getSafeProfilePic: No userData provided');
      return '';
    }
    console.log('getSafeProfilePic input:', userData);
    // Check all possible fields for profile picture (same as UpdateProfileScreen)
    const profilePic = userData.photoUrl || userData.profilePic || userData.avatar || userData.photo || '';
    console.log('getSafeProfilePic found:', profilePic);
    if (profilePic && typeof profilePic === 'string' && profilePic.trim() !== '') {
      const trimmedPic = profilePic.trim();
      // Handle different URL formats
      if (trimmedPic.startsWith('http://') || trimmedPic.startsWith('https://')) {
        console.log('getSafeProfilePic returning absolute URL:', trimmedPic);
        return trimmedPic;
      } else if (trimmedPic.startsWith('/')) {
        const fullUrl = `${BASE_URL}${trimmedPic}`;
        console.log('getSafeProfilePic returning relative URL converted:', fullUrl);
        return fullUrl;
      } else {
        console.log('getSafeProfilePic returning as-is:', trimmedPic);
        return trimmedPic;
      }
    }
    console.log('getSafeProfilePic returning empty string');
    return '';
  };
  const getSafeUsername = (userData) => {
    if (!userData) {
      console.log('getSafeUsername: No userData provided');
      return 'Unknown User';
    }
    // Check all possible fields for user name (same as UpdateProfileScreen)
    const username = userData.fullName || userData.username || userData.displayName || userData.name || '';
    const result = username && typeof username === 'string' && username.trim() !== '' ? username.trim() : 'Unknown User';
    console.log('getSafeUsername input:', userData);
    console.log('getSafeUsername result:', result);
    return result;
  };
  // ✅ UPDATED: Block API function
  const blockUser = async (userId) => {
    try {
      console.log('Blocking user via API:', userId);
      const response = await fetch(`${BASE_URL}/api/v1/heartlink/user/${userId}/restrict`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await response.json();
      console.log('Block user API response:', data);
      if (response.ok && data.success) {
        setBlockedUsers(prev => new Set([...prev, userId]));
        // Remove user from current conversations and users list immediately
        setConversations(prev => prev.filter(conv => {
          const otherParticipant = getOtherParticipant(conv);
          return otherParticipant._id !== userId;
        }));
        setUsers(prev => prev.filter(user => user._id !== userId));
        // Update filtered data immediately
        setFilteredData(prev => {
          if (showingUsers) {
            return prev.filter(user => user._id !== userId);
          } else {
            return prev.filter(conv => {
              const otherParticipant = getOtherParticipant(conv);
              return otherParticipant._id !== userId;
            });
          }
        });
        Alert.alert('Success', data.message || 'User blocked successfully.');
        return true;
      } else {
        throw new Error(data.message || 'Failed to block user.');
      }
    } catch (error) {
      console.error('Error during block user API call:', error);
      Alert.alert('Error', error.message || 'Failed to block user. Please try again.');
      return false;
    }
  };
  const fetchBlockedUsers = async () => {
    try {
      if (!token) return;
      console.log('Attempting to fetch blocked users...');
      const response = await fetch(`${BASE_URL}/api/v1/block/blocked-users`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (response.status === 404) {
        console.log('Blocked users endpoint not yet implemented on backend (404). Proceeding without server-synced blocked list.');
        return;
      }
      const data = await response.json();
      console.log('Blocked users API response:', data);
      if (response.ok && data.success) {
        const blockedUserIds = (data.data.blockedUsers || []).map(user => user._id);
        setBlockedUsers(new Set(blockedUserIds));
        console.log('Successfully loaded blocked users from API:', blockedUserIds.length);
      } else {
        console.log('Error fetching blocked users (non-critical, non-404 error):', data.message || 'Unknown error');
      }
    } catch (error) {
      console.error('Network error or other issue fetching blocked users (non-critical):', error.message);
    }
  };
  // ✅ Block modal functions
  const showBlockModal = (user) => {
    // Don't show modal for already blocked users or self
    if (blockedUsers.has(user._id) || user._id === currentUser._id) {
      return;
    }
    setSelectedUserForBlock(user);
    setBlockModalVisible(true);
    // Animate modal in
    Animated.spring(blockModalAnimation, {
      toValue: 1,
      useNativeDriver: true,
      tension: 50,
      friction: 8,
    }).start();
  };
  const hideBlockModal = () => {
    // Animate modal out
    Animated.spring(blockModalAnimation, {
      toValue: 0,
      useNativeDriver: true,
      tension: 50,
      friction: 8,
    }).start(() => {
      setBlockModalVisible(false);
      setSelectedUserForBlock(null);
    });
  };
  const handleBlockConfirm = async () => {
    if (!selectedUserForBlock) return;
    setBlockingUser(selectedUserForBlock._id);
    hideBlockModal();
    await blockUser(selectedUserForBlock._id);
    setBlockingUser(null);
  };
  // ✅ NEW: Report user functions
  const showReportModal = (user) => {
    // Don't show modal for already blocked users or self
    if (blockedUsers.has(user._id) || user._id === currentUser._id) {
      return;
    }
    setSelectedUserForReport(user);
    setReportModalVisible(true);
    // Reset form
    setReportStep(1);
    setReportType('user');
    setReason('');
    setCategory('behavior');
    setDescription('');
    setSeverity('medium');
    setIsAnonymous(false);
    setSubmittingReport(false);
  };
  const hideReportModal = () => {
    setReportModalVisible(false);
    setSelectedUserForReport(null);
  };
  const handleReportSubmit = async () => {
    if (!description.trim() || description.trim().length < 10) {
      Alert.alert('Error', 'Please provide a detailed description (minimum 10 characters).');
      return;
    }
    setSubmittingReport(true);
    try {
      const response = await fetch(`${BASE_URL}/api/v1/user-handling/report`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reportedUserId: selectedUserForReport._id,
          reportType,
          reason,
          category,
          description: description.trim(),
          severity,
          isAnonymous,
        }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        Alert.alert('Success', 'Your report has been submitted successfully.');
        hideReportModal();
      } else {
        throw new Error(data.message || 'Failed to submit report');
      }
    } catch (error) {
      console.error('Report submission error:', error);
      Alert.alert('Error', error.message || 'Failed to submit report. Please try again.');
    } finally {
      setSubmittingReport(false);
    }
  };
  // ✅ Long press handler
  const handleLongPress = (item) => {
    const targetUser = showingUsers ? item : getOtherParticipant(item);
    if (!targetUser || !targetUser._id || targetUser._id === currentUser._id) {
      return;
    }
    showBlockModal(targetUser);
  };
  // ✅ EXISTING: Story-related functions
  const fetchStoriesData = async () => {
    try {
      if (!token || !currentUser) {
        console.log('No token or current user found for stories');
        return;
      }
      console.log('Fetching stories data...');
      // Fetch stories from backend
      const storiesResponse = await fetch(`${BASE_URL}/api/v1/stories/stories`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (!storiesResponse.ok) {
        throw new Error(`HTTP ${storiesResponse.status}: ${storiesResponse.statusText}`);
      }
      const storiesData = await storiesResponse.json();
      console.log('Stories API Response:', storiesData);
      if (!storiesData.success) {
        throw new Error(storiesData.message || 'Failed to fetch stories');
      }
      const fetchedStories = storiesData.data?.stories || [];
      console.log('Fetched stories count:', fetchedStories.length);
      // Process the stories data into a map for easy lookup
      const storyMap = {};
      let currentUserStoriesData = [];
      fetchedStories.forEach(userStoryData => {
        const userId = userStoryData.user._id;
        const userStoriesList = userStoryData.stories || [];
        if (userId === currentUser._id) {
          currentUserStoriesData = userStoriesList;
        }
        // Determine if user has viewed all stories
        const hasViewedAllStories = userStoriesList.every(story => story.hasViewed === true);
        storyMap[userId] = {
          stories: userStoriesList,
          hasStory: userStoriesList.length > 0,
          hasViewed: hasViewedAllStories,
          storyCount: userStoriesList.length,
          user: userStoryData.user
        };
      });
      setUserStories(storyMap);
      setCurrentUserStories(currentUserStoriesData);
      console.log('Stories data processed. Users with stories:', Object.keys(storyMap).length);
    } catch (error) {
      console.error('Error fetching stories:', error);
    }
  };
  // ✅ EXISTING: Get story status for a user
  const getUserStoryStatus = (userId) => {
    const userStoryData = userStories[userId];
    if (!userStoryData || !userStoryData.hasStory) {
      return { hasStory: false, hasViewed: true, storyCount: 0 };
    }
    return {
      hasStory: true,
      hasViewed: userStoryData.hasViewed,
      storyCount: userStoryData.storyCount,
      stories: userStoryData.stories
    };
  };
  // Animate header on mount
  useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, []);
  useFocusEffect(
    React.useCallback(() => {
      fetchData();
      setSearchQuery('');
      setShowingUsers(false);
    }, [])
  );
  // Auto-search useEffect
  useEffect(() => {
    // Only auto-search when showing users and the query looks like a potential mobile number
    if (showingUsers && searchQuery.trim().length >= 10 && searchQuery.trim().length <= 14) {
      // Clear the previous timer if the user is still typing
      if (searchDebounceTimer) {
        clearTimeout(searchDebounceTimer);
      }
      // Set a new timer
      const timer = setTimeout(() => {
        console.log('Auto-search triggered for query:', searchQuery);
        fetchSearchedUsers(); // Call the existing search function
      }, 500); // 500ms debounce delay
      // Save the timer ID to clear it on the next keystroke or component unmount
      setSearchDebounceTimer(timer);
    }
    // Cleanup function to clear the timer if the component unmounts or dependencies change
    return () => {
      if (searchDebounceTimer) {
        clearTimeout(searchDebounceTimer);
      }
    };
  }, [searchQuery, showingUsers]); // Re-run when searchQuery or showingUsers changes
  useEffect(() => {
    if (showingUsers) {
      if (searchQuery.trim().length === 0) {
        fetchAllOnboardedUsers();
      } else if (!isValidMobileNumber(searchQuery)) {
        setUsers([]);
      }
    } else {
      if (!Array.isArray(conversations)) {
        setFilteredData([]);
        return;
      }
      const filteredConvs = conversations.filter(item => {
        if (!item) return false;
        const otherParticipant = getOtherParticipant(item);
        // ✅ Filter out blocked users
        if (blockedUsers.has(otherParticipant._id)) {
          return false;
        }
        const lastMessageContent = item.lastMessage?.content || '';
        const fullName = otherParticipant?.fullName || '';
        const username = otherParticipant?.username || '';
        return (
          (typeof fullName === 'string' && fullName.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (typeof username === 'string' && username.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (typeof lastMessageContent === 'string' && lastMessageContent.toLowerCase().includes(searchQuery.toLowerCase()))
        );
      });
      setFilteredData(filteredConvs);
    }
  }, [searchQuery, showingUsers, conversations, blockedUsers]);
  useEffect(() => {
    if (showingUsers) {
      const filteredUsers = users.filter(user => !blockedUsers.has(user._id));
      setFilteredData(filteredUsers);
    }
  }, [users, showingUsers, blockedUsers]);
  const fetchData = async () => {
    setLoading(true);
    await Promise.all([
      fetchConversations(),
      fetchAllOnboardedUsers(),
      fetchStoriesData(),
      fetchBlockedUsers(),
    ]);
    setLoading(false);
  };
  const fetchConversations = async () => {
    try {
      if (!token) return;
      const response = await fetch(`${BASE_URL}/api/v1/chat/conversations`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await response.json();
      if (response.ok && data.success) {
        const convs = data.data || [];
        const validConversations = convs.filter(conv => {
          if (!conv || !conv._id) {
            console.warn('Invalid conversation structure:', conv);
            return false;
          }
          if (!Array.isArray(conv.participants)) {
            console.warn('Conversation missing participants array:', conv._id);
            conv.participants = [];
          }
          return true;
        });
        console.log('Fetched conversations:', validConversations.length);
        if (validConversations.length > 0 && validConversations[0].participants?.length > 0) {
          console.log('Sample conversation participant:', validConversations[0].participants[0]?.user);
        }
        setConversations(validConversations);
        if (validConversations.length === 0 && !showingUsers && !searchQuery.trim()) {
          setShowingUsers(true);
        } else if (!showingUsers && !searchQuery.trim()) {
          setFilteredData(validConversations);
        }
      } else {
        console.error('Error fetching conversations:', data.message || 'Unknown error');
        setConversations([]);
      }
    } catch (error) {
      console.error('Network error fetching conversations:', error);
      Alert.alert('Error', 'Failed to load conversations.');
      setConversations([]);
    }
  };
  const fetchAllOnboardedUsers = async () => {
    try {
      if (!token) return;
      const response = await fetch(`${BASE_URL}/api/v1/users/users`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await response.json();
      if (response.ok && data.success) {
        const otherUsers = (data.data.users || []).filter(user =>
          user._id !== currentUser?._id && user.onboardingCompleted
        );
        console.log('Fetched users:', otherUsers.length);
        if (otherUsers.length > 0) {
          console.log('Sample user data:', {
            id: otherUsers[0]._id,
            fullName: otherUsers[0].fullName,
            photoUrl: otherUsers[0].photoUrl,
            profilePic: otherUsers[0].profilePic,
            profilePicture: otherUsers[0].profilePicture
          });
        }
        setUsers(otherUsers);
      } else {
        console.error('Error fetching all onboarded users:', data.message || 'Unknown error');
        setUsers([]);
      }
    } catch (error) {
      console.error('Network error fetching all onboarded users:', error);
      Alert.alert('Error', 'Failed to load users.');
    }
  };
  const fetchSearchedUsers = async () => {
    if (!isValidMobileNumber(searchQuery)) {
      return;
    }
    setSearchLoading(true);
    try {
      if (!token) return;
      const response = await fetch(`${BASE_URL}/api/v1/users/users/search?q=${searchQuery.trim()}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setUsers(data.data.results || []);
      } else {
        console.error('Error searching users:', data.message || 'Unknown error');
        setUsers([]);
      }
    } catch (error) {
      console.error('Network error searching users:', error);
      Alert.alert('Error', 'Failed to perform user search.');
      setUsers([]);
    } finally {
      setSearchLoading(false);
    }
  };
  const handleSearchPress = () => {
    // Although auto-search handles it, this can act as a manual trigger if needed
    // e.g., if user pastes a number and doesn't trigger the useEffect correctly
    // or wants to force a search regardless of debounce.
    if (isValidMobileNumber(searchQuery)) {
      // Clear any pending auto-search to avoid duplicate calls
      if (searchDebounceTimer) {
        clearTimeout(searchDebounceTimer);
        setSearchDebounceTimer(null);
      }
      fetchSearchedUsers();
    }
  };
  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };
  const createOrGetConversation = async (receiverId) => {
    try {
      setCreatingChat(receiverId);
      console.log('Creating conversation with user:', receiverId);
      const response = await fetch(`${BASE_URL}/api/v1/chat/conversation`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          receiverId: receiverId
        }),
      });
      const data = await response.json();
      console.log('Create conversation response:', data);
      if (response.ok && data.success) {
        console.log('Conversation created successfully:', data.data);
        return data.data;
      } else {
        console.error('Server error creating conversation:', data);
        throw new Error(data.message || 'Failed to create conversation');
      }
    } catch (error) {
      console.error('Error creating conversation:', error);
      Alert.alert('Error', error.message || 'Could not start chat.');
      throw error;
    } finally {
      setCreatingChat(null);
    }
  };
  const getOtherParticipant = (conversation) => {
    if (!conversation || !conversation.participants || !Array.isArray(conversation.participants)) {
      console.warn('Invalid conversation data:', conversation);
      return {};
    }
    const otherParticipant = conversation.participants.find(
      p => p?.user?._id && p.user._id !== currentUser?._id
    );
    return otherParticipant?.user || conversation.participants[0]?.user || {};
  };
  const getUnreadCount = (conversation) => {
    if (!conversation || !conversation.participants || !Array.isArray(conversation.participants)) {
      return 0;
    }
    const participant = conversation.participants.find(
      p => p?.user?._id && p.user._id === currentUser?._id
    );
    return participant?.unreadCount || 0;
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
    const safeName = typeof name === 'string' ? name : '';
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
      '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
      '#F8C471', '#82E0AA', '#F1948A', '#85C1E9', '#D2B4DE'
    ];
    const charCodeSum = safeName.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
    return colors[charCodeSum % colors.length];
  };
  const formatTime = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    if (diffInHours < 1) return 'now';
    if (diffInHours < 24) return `${diffInHours}h`;
    if (diffInHours < 48) return '1d';
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };
  const getLastMessagePreview = (conversation) => {
    if (!conversation.lastMessage) return 'Start a conversation';
    const { lastMessage } = conversation;
    const isOwnMessage = lastMessage.sender === currentUser?._id;
    const prefix = isOwnMessage ? 'You: ' : '';
    if (lastMessage.messageType === 'text') {
      return `${prefix}${typeof lastMessage.content === 'string' ? lastMessage.content : ''}`;
    } else {
      return `${prefix}📎 ${lastMessage.messageType}`;
    }
  };
  // ✅ EXISTING: Profile picture click -> Navigate to stories or create story
  const handleProfilePress = async (item) => {
    const targetUser = showingUsers ? item : getOtherParticipant(item);
    if (!targetUser || !targetUser._id) {
      Alert.alert("Error", "Could not find user details.");
      return;
    }
    // If it's the current user, handle own story creation/viewing
    if (targetUser._id === currentUser._id) {
      if (currentUserStories.length > 0) {
        // Navigate to view own stories
        navigation.navigate('StoryViewer', {
          stories: currentUserStories,
          currentIndex: 0,
          userName: 'Your Story',
          userAvatar: getSafeProfilePic(currentUser),
          userId: currentUser._id,
          isOwnStory: true
        });
      } else {
        // Navigate to create story
        navigation.navigate('CreateStory');
      }
      return;
    }
    // For other users, check if they have stories
    const storyStatus = getUserStoryStatus(targetUser._id);
    if (storyStatus.hasStory && storyStatus.stories) {
      try {
        // Mark story as viewed by calling the view API
        if (token && storyStatus.stories.length > 0) {
          const firstStoryId = storyStatus.stories[0]._id;
          await fetch(`${BASE_URL}/api/v1/stories/stories/${firstStoryId}/view`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });
        }
      } catch (error) {
        console.error('Error marking story as viewed:', error);
      }
      // Navigate to story viewer
      navigation.navigate('StoryViewer', {
        stories: storyStatus.stories,
        currentIndex: 0,
        userName: getSafeUsername(targetUser),
        userAvatar: getSafeProfilePic(targetUser),
        userId: targetUser._id,
        isOwnStory: false
      });
    } else {
      // No stories, navigate to user profile
      navigation.navigate('UserProfile', {
        userId: targetUser._id,
        fromChat: !showingUsers,
        conversationId: showingUsers ? null : item._id,
      });
    }
  };
  // EXISTING: Updated handleNamePress function with better error handling and state management
  const handleNamePress = async (item) => {
    if (showingUsers) {
      // For user list, create conversation and navigate to chat
      if (creatingChat === item._id) return;
      Keyboard.dismiss();
      try {
        console.log('Starting conversation creation process for user:', item._id);
        const conversation = await createOrGetConversation(item._id);
        if (!conversation || !conversation._id) {
          throw new Error('Invalid conversation data received');
        }
        console.log('Conversation created/found, navigating to chat:', conversation._id);
        // Navigate to chat detail
        navigation.navigate('ChatDetail', {
          conversationId: conversation._id,
          receiverId: item._id,
          receiverName: item.fullName,
          receiverOnline: isUserOnline(item._id),
        });
        // Update local state - switch back to conversations view and refresh
        setShowingUsers(false);
        setSearchQuery('');
        // Refresh conversations list to include the new conversation
        setTimeout(() => {
          fetchConversations();
        }, 500);
      } catch (error) {
        console.error('Failed to create conversation and navigate:', error);
        Alert.alert(
          'Error', 
          error.message || 'Failed to start conversation. Please try again.',
          [{ text: 'OK' }]
        );
      }
    } else {
      // For conversation list, navigate to chat
      const otherParticipant = getOtherParticipant(item);
      if (otherParticipant && otherParticipant._id) {
        navigation.navigate('ChatDetail', {
          conversationId: item._id,
          receiverId: otherParticipant._id,
          receiverName: otherParticipant.fullName,
          receiverOnline: isUserOnline(otherParticipant._id),
        });
      } else {
        Alert.alert("Error", "Could not find participant details.");
      }
    }
  };
  const handleComposePress = () => {
    setShowingUsers(true);
    setSearchQuery('');
  };
  const toggleView = () => {
    setShowingUsers(prev => !prev);
    setSearchQuery('');
    Keyboard.dismiss();
  };
  const handleBlockedUsersPress = () => {
    navigation.navigate('BlockedUsersScreen', {
      setBlockedUsers: setBlockedUsers,
      onUnblockUser: (userId) => {
        // ONLY refresh the lists - don't call any unblock API
        // BlockedUsersScreen already handles the actual unblocking
        setBlockedUsers(prev => {
          const newSet = new Set(prev);
          newSet.delete(userId);
          return newSet;
        });
        fetchConversations();
        fetchAllOnboardedUsers();
      }
    });
  };
  // ✅ ENHANCED: Avatar rendering function with integrated story indicators and online status
  const renderAvatar = (user, hasUnread = false) => {
    const safeFullName = user.fullName && typeof user.fullName === 'string' ? user.fullName : 'User';
    const profileImageUrl = getProfileImageUrl(user);
    // Enhanced online status check with logging
    const isOnline = isUserOnline(user._id);
    console.log(`🎨 Rendering avatar for ${user.fullName} (${user._id}): online=${isOnline}`);
    // Get story status for this user
    const isCurrentUserAvatar = user._id === currentUser._id;
    const storyStatus = isCurrentUserAvatar 
      ? { hasStory: currentUserStories.length > 0, hasViewed: true, storyCount: currentUserStories.length }
      : getUserStoryStatus(user._id);
    // Determine border color based on story status
    let borderColor = "#374151"; // Default gray
    let borderWidth = 2;
    if (isCurrentUserAvatar) {
      if (storyStatus.hasStory) {
        borderColor = PINK_THEME_COLOR; // Pink for own story
        borderWidth = 3;
      } else {
        borderColor = "#374151"; // Gray for no story
        borderWidth = 2;
      }
    } else if (storyStatus.hasStory) {
      if (!storyStatus.hasViewed) {
        borderColor = PINK_THEME_COLOR; // Pink for unviewed stories
        borderWidth = 3;
      } else {
        borderColor = "#6b7280"; // Gray for viewed stories
        borderWidth = 2;
      }
    }
    // Add unread border if there are unread messages and no story
    if (hasUnread && !storyStatus.hasStory) {
      borderColor = PINK_THEME_COLOR;
      borderWidth = 3;
    }
    return (
      <View style={styles.avatarContainer}>
        <View
          style={[
            styles.avatar,
            {
              backgroundColor: getAvatarColor(safeFullName),
              borderColor: borderColor,
              borderWidth: borderWidth
            }
          ]}
        >
          {profileImageUrl ? (
            <Image
              source={{ uri: profileImageUrl }}
              style={styles.avatarImage}
              onError={(error) => {
                console.log('Profile image error for user:', user._id, 'URL:', profileImageUrl, 'Error:', error?.nativeEvent?.error || 'Unknown profile image error');
              }}
            />
          ) : (
            <Text style={styles.avatarText}>
              {getInitials(safeFullName)}
            </Text>
          )}
        </View>
        {/* Enhanced online indicator with better visibility */}
        {isOnline && (
          <View style={[styles.onlineIndicator, { 
            borderWidth: 2,
            borderColor: '#111111',
            backgroundColor: '#111111',
          }]}>
            <View style={[styles.onlineDot, {
              backgroundColor: '#10b981', // Green color
              width: 14, // Slightly larger
              height: 14,
              borderRadius: 7,
            }]} />
          </View>
        )}
        {/* Story count indicator */}
        {storyStatus.storyCount > 1 && (
          <View style={styles.storyCountBadge}>
            <Text style={styles.storyCountText}>{storyStatus.storyCount}</Text>
          </View>
        )}
        {/* Add story button for current user */}
        {isCurrentUserAvatar && (
          <View style={styles.addStoryButton}>
            <Text style={styles.addStoryIcon}>+</Text>
          </View>
        )}
        {/* Blocking indicator */}
        {blockingUser === user._id && (
          <View style={styles.blockingIndicator}>
            <ActivityIndicator size="small" color="#fff" />
          </View>
        )}
      </View>
    );
  };
  // ✅ Block Modal Component
  const renderBlockModal = () => {
    if (!selectedUserForBlock) return null;
    return (
      <Modal
        visible={blockModalVisible}
        transparent={true}
        animationType="none"
        onRequestClose={hideBlockModal}
      >
        <TouchableWithoutFeedback onPress={hideBlockModal}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <Animated.View
                style={[
                  styles.blockModal,
                  {
                    transform: [
                      {
                        scale: blockModalAnimation.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.8, 1],
                        }),
                      },
                    ],
                    opacity: blockModalAnimation,
                  },
                ]}
              >
                <View style={styles.modalHeader}>
                  <View style={styles.modalUserInfo}>
                    {renderAvatar(selectedUserForBlock)}
                    <View style={styles.modalUserDetails}>
                      <Text style={styles.modalUserName} numberOfLines={1}>
                        {selectedUserForBlock.fullName || 'Unknown User'}
                      </Text>
                      <Text style={styles.modalUserUsername} numberOfLines={1}>
                        @{selectedUserForBlock.username || 'user'}
                      </Text>
                    </View>
                  </View>
                </View>
                <View style={styles.modalContent}>
                  <Icon 
                    name="ban" 
                    size={48} 
                    color="#ef4444" 
                    style={styles.modalIcon}
                  />
                  <Text style={styles.modalTitle}>Block User?</Text>
                  <Text style={styles.modalDescription}>
                    {`${selectedUserForBlock.fullName} won't be able to message you or see your content.`}
                  </Text>
                </View>
                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.modalCancelButton}
                    onPress={hideBlockModal}
                  >
                    <Text style={styles.modalCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  {/* ✅ NEW: Report button added to block modal */}
                  <TouchableOpacity
                    style={styles.modalReportButton}
                    onPress={() => {
                      hideBlockModal();
                      setTimeout(() => {
                        showReportModal(selectedUserForBlock);
                      }, 300);
                    }}
                  >
                    <Icon 
                      name="alert" 
                      size={18} 
                      color="#f59e0b" 
                      style={styles.modalButtonIcon}
                    />
                    <Text style={styles.modalReportText}>Report</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.modalConfirmButton,
                      { backgroundColor: "#ef4444" }
                    ]}
                    onPress={handleBlockConfirm}
                    disabled={blockingUser === selectedUserForBlock._id}
                  >
                    {blockingUser === selectedUserForBlock._id ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Icon 
                        name="ban" 
                        size={18} 
                        color="#fff" 
                        style={styles.modalButtonIcon}
                      />
                    )}
                    <Text style={styles.modalConfirmText}>Block</Text>
                  </TouchableOpacity>
                </View>
              </Animated.View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    );
  };
  // ✅ NEW: Report User Modal Component
  const renderReportModal = () => {
    if (!selectedUserForReport) return null;
    return (
      <Modal
        visible={reportModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={hideReportModal}
      >
        <TouchableWithoutFeedback onPress={hideReportModal}>
          <View style={styles.overlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalContainer}>
                <View style={styles.header}>
                  <Text style={styles.title}>Report User</Text>
                  <TouchableOpacity onPress={hideReportModal}>
                    <Icon name="close" size={24} color="#fff" />
                  </TouchableOpacity>
                </View>
                <View style={styles.userHeader}>
                  <View style={styles.avatarPlaceholder} />
                  <View>
                    <Text style={styles.userName}>{selectedUserForReport?.fullName || 'Unknown User'}</Text>
                    <Text style={styles.userHandle}>@{selectedUserForReport?.username || 'username'}</Text>
                  </View>
                </View>
                {reportStep === 1 ? (
                  <View style={styles.stepContainer}>
                    <Text style={styles.sectionTitle}>Report Type</Text>
                    <View style={styles.optionsContainer}>
                      {REPORT_TYPES.map((type) => (
                        <TouchableOpacity
                          key={type.value}
                          style={[
                            styles.optionButton,
                            reportType === type.value && styles.selectedOption
                          ]}
                          onPress={() => setReportType(type.value)}
                        >
                          <Text style={[
                            styles.optionText,
                            reportType === type.value && styles.selectedOptionText
                          ]}>
                            {type.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <Text style={styles.sectionTitle}>Reason</Text>
                    <View style={styles.optionsContainer}>
                      {REASONS.map((r) => (
                        <TouchableOpacity
                          key={r.value}
                          style={[
                            styles.optionButton,
                            reason === r.value && styles.selectedOption
                          ]}
                          onPress={() => setReason(r.value)}
                        >
                          <Text style={[
                            styles.optionText,
                            reason === r.value && styles.selectedOptionText
                          ]}>
                            {r.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <Text style={styles.sectionTitle}>Category</Text>
                    <View style={styles.optionsContainer}>
                      {CATEGORIES.map((cat) => (
                        <TouchableOpacity
                          key={cat.value}
                          style={[
                            styles.optionButton,
                            category === cat.value && styles.selectedOption
                          ]}
                          onPress={() => setCategory(cat.value)}
                        >
                          <Text style={[
                            styles.optionText,
                            category === cat.value && styles.selectedOptionText
                          ]}>
                            {cat.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <View style={styles.navigationButtons}>
                      <TouchableOpacity 
                        style={[styles.navButton, styles.cancelButton]} 
                        onPress={hideReportModal}
                      >
                        <Text style={styles.navButtonText}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={[styles.navButton, styles.nextButton]} 
                        onPress={() => setReportStep(2)}
                        disabled={!reason}
                      >
                        <Text style={styles.navButtonText}>Next</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <View style={styles.stepContainer}>
                    <Text style={styles.sectionTitle}>Severity</Text>
                    <View style={styles.optionsContainer}>
                      {SEVERITIES.map((s) => (
                        <TouchableOpacity
                          key={s.value}
                          style={[
                            styles.optionButton,
                            severity === s.value && styles.selectedOption
                          ]}
                          onPress={() => setSeverity(s.value)}
                        >
                          <Text style={[
                            styles.optionText,
                            severity === s.value && styles.selectedOptionText
                          ]}>
                            {s.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <Text style={styles.sectionTitle}>Description</Text>
                    <View style={styles.textInputContainer}>
                      <TextInput
                        style={styles.textInput}
                        placeholder="Please provide detailed information about the issue (minimum 10 characters)"
                        placeholderTextColor="#9ca3af"
                        multiline
                        numberOfLines={4}
                        value={description}
                        onChangeText={setDescription}
                        maxLength={500}
                      />
                      <Text style={styles.charCount}>{description.length}/500</Text>
                    </View>
                    <View style={styles.checkboxContainer}>
                      <TouchableOpacity 
                        style={styles.checkbox} 
                        onPress={() => setIsAnonymous(!isAnonymous)}
                      >
                        {isAnonymous && <Icon name="checkmark" size={16} color="#fff" />}
                      </TouchableOpacity>
                      <Text style={styles.checkboxLabel}>Submit anonymously</Text>
                    </View>
                    <View style={styles.navigationButtons}>
                      <TouchableOpacity 
                        style={[styles.navButton, styles.cancelButton]} 
                        onPress={() => setReportStep(1)}
                      >
                        <Text style={styles.navButtonText}>Back</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={[styles.navButton, styles.nextButton]} 
                        onPress={handleReportSubmit}
                        disabled={submittingReport || !description.trim() || description.trim().length < 10}
                      >
                        {submittingReport ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Text style={styles.navButtonText}>Submit Report</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    );
  };
  const renderConversationItem = ({ item, index }) => {
    if (!item || !item._id) {
      console.warn('Invalid conversation item:', item);
      return null;
    }
    const otherParticipant = getOtherParticipant(item);
    const unreadCount = getUnreadCount(item);
    const hasUnread = unreadCount > 0;
    // Do not render conversation if the other participant is blocked
    if (blockedUsers.has(otherParticipant._id)) {
      return null;
    }
    return (
      <Animated.View
        style={[
          styles.chatContainer,
          {
            opacity: animatedValue,
            transform: [{
              translateY: animatedValue.interpolate({
                inputRange: [0, 1],
                outputRange: [50, 0],
              }),
            }],
          }
        ]}
      >
        <TouchableOpacity
          style={styles.profileSection}
          onPress={() => handleProfilePress(item)}
          onLongPress={() => handleLongPress(item)}
          activeOpacity={0.8}
        >
          {renderAvatar(otherParticipant, hasUnread)}
          {hasUnread && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadCount}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.chatContent}
          onPress={() => handleNamePress(item)}
          onLongPress={() => handleLongPress(item)}
          activeOpacity={0.8}
        >
          <View style={styles.chatHeader}>
            <Text style={[styles.userName, hasUnread && styles.userNameUnread]} numberOfLines={1}>
              {otherParticipant?.fullName || 'Unknown User'}
            </Text>
            <View style={styles.timeContainer}>
              <Text style={styles.timeText}>
                {formatTime(item.lastMessageAt)}
              </Text>
            </View>
          </View>
          <View style={styles.messageContainer}>
            <Text
              style={[
                styles.messageText,
                hasUnread ? styles.messageTextUnread : styles.messageTextRead,
              ]}
              numberOfLines={2}
            >
              {getLastMessagePreview(item)}
            </Text>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };
  const renderUserItem = ({ item, index }) => {
    // Do not render user if they are blocked
    if (blockedUsers.has(item._id)) {
      return null;
    }
    const isCreatingChatWithThisUser = creatingChat === item._id;
    const isOnline = isUserOnline(item._id);
    return (
      <Animated.View
        style={[
          styles.userContainer,
          isCreatingChatWithThisUser && styles.userContainerLoading,
          {
            opacity: animatedValue,
            transform: [{
              translateY: animatedValue.interpolate({
                inputRange: [0, 1],
                outputRange: [30, 0],
              }),
            }],
          }
        ]}
      >
        <TouchableOpacity
          style={styles.profileSection}
          onPress={() => handleProfilePress(item)}
          onLongPress={() => handleLongPress(item)}
          activeOpacity={0.8}
        >
          {renderAvatar(item)}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.userContent}
          onPress={() => handleNamePress(item)}
          onLongPress={() => handleLongPress(item)}
          activeOpacity={0.8}
          disabled={isCreatingChatWithThisUser}
        >
          <View style={styles.userHeader}>
            <View style={styles.userNameContainer}>
              <Text style={styles.userFullName} numberOfLines={1}>
                {item.fullName || 'Unknown User'}
              </Text>
              {item.username && (
                <Text style={styles.userUsername} numberOfLines={1}>
                  @{String(item.username)}
                </Text>
              )}
            </View>
            <Text style={styles.userStatus}>
              {isOnline ? 'Online' : formatTime(item.lastSeen || item.createdAt)}
            </Text>
          </View>
          {/* Removed bio and tags as per request */}
          {isCreatingChatWithThisUser && (
            <View style={styles.creatingChatOverlay}>
              <ActivityIndicator size="small" color={PINK_THEME_COLOR} />
              <Text style={styles.creatingChatText}>Starting chat...</Text>
            </View>
          )}
        </TouchableOpacity>
      </Animated.View>
    );
  };
  const renderItem = ({ item, index }) => {
    if (showingUsers) {
      return renderUserItem({ item, index });
    } else {
      return renderConversationItem({ item, index });
    }
  };
  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconContainer}>
        <Icon 
          name={searchQuery ? "search" : showingUsers ? "people" : "chatbubbles"} 
          size={80} 
          color="#374151" 
        />
      </View>
      <Text style={styles.emptyTitle}>
        {searchQuery
          ? `No ${showingUsers ? 'users' : 'chats'} found`
          : showingUsers
            ? 'Discover new connections'
            : 'No conversations yet'
        }
      </Text>
      <Text style={styles.emptySubtitle}>
        {searchQuery
          ? showingUsers 
            ? 'Enter a valid mobile number (10-14 digits) and press search'
            : 'Try adjusting your search'
          : showingUsers
            ? 'Connect with people using their mobile number'
            : 'Start meaningful conversations today'
        }
      </Text>
      {!searchQuery && !showingUsers && conversations.length === 0 && (
        <TouchableOpacity style={styles.primaryButton} onPress={handleComposePress}>
          <Icon name="add" size={20} color="#fff" style={styles.buttonIcon} />
          <Text style={styles.primaryButtonText}>Start Chatting</Text>
        </TouchableOpacity>
      )}
    </View>
  );
  if (loading || (showingUsers && searchLoading)) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Chats</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={PINK_THEME_COLOR} />
          <Text style={styles.loadingText}>
            {showingUsers && searchLoading ? 'Finding users...' : 'Loading conversations...'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }
  return (
    <SafeAreaView style={styles.container}>
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
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>
            {showingUsers ? 'Discover' : 'AI chats'}
          </Text>
          <Text style={styles.headerSubtitle}>
            {showingUsers ? 'Find new connections' : `${filteredData.filter(item => {
              if (!showingUsers) {
                const otherParticipant = getOtherParticipant(item);
                return !blockedUsers.has(otherParticipant._id);
              }
              return true;
            }).length} conversations`}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={toggleView} style={styles.toggleButton}>
            <Icon 
              name={showingUsers ? 'chatbubbles' : 'people'} 
              size={24} 
              color={PINK_THEME_COLOR} 
            />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleBlockedUsersPress} style={styles.blockedButton}>
            <Icon name="ban" size={22} color="#ef4444" />
            {blockedUsers.size > 0 && (
              <View style={styles.blockedBadge}>
                <Text style={styles.blockedBadgeText}>
                  {blockedUsers.size > 99 ? '99+' : blockedUsers.size}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={handleComposePress} style={styles.composeButton}>
            <Icon name="add" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </Animated.View>
      {/* ✅ NEW: Stories Ribbon - Added here above search bar */}
      <Animated.View
        style={[
          styles.storiesContainer,
          {
            opacity: animatedValue,
            transform: [{
              translateY: animatedValue.interpolate({
                inputRange: [0, 1],
                outputRange: [30, 0],
              }),
            }],
          }
        ]}
      >
        <AllStories />
      </Animated.View>
      <View style={styles.searchContainer}>
        <View style={styles.searchWrapper}>
          <Icon name="search" size={20} color="#9ca3af" style={styles.searchIcon} />
          <TextInput
            placeholder={showingUsers ? 'Search by mobile number (10-14 digits)...' : 'Search conversations...'}
            placeholderTextColor="#9ca3af"
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            keyboardType={showingUsers ? 'numeric' : 'default'}
          />
          {searchQuery.length > 0 && !showingUsers && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
              <Icon name="close-circle" size={20} color="#9ca3af" />
            </TouchableOpacity>
          )}
          {showingUsers && isValidMobileNumber(searchQuery) && (
            <TouchableOpacity 
              onPress={handleSearchPress} 
              style={styles.searchButton}
              disabled={searchLoading}
            >
              {searchLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Icon name="search" size={18} color="#fff" />
              )}
            </TouchableOpacity>
          )}
          {showingUsers && searchQuery.length > 0 && !isValidMobileNumber(searchQuery) && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
              <Icon name="close-circle" size={20} color="#9ca3af" />
            </TouchableOpacity>
          )}
        </View>
        {showingUsers && searchQuery.length > 0 && !isValidMobileNumber(searchQuery) && (
          <Text style={styles.searchHint}>
            Please enter a valid mobile number (10-14 digits)
          </Text>
        )}
      </View>
      <FlatList
        data={filteredData}
        keyExtractor={(item) => item._id}
        renderItem={renderItem}
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
      {renderBlockModal()}
      {renderReportModal()}
    </SafeAreaView>
  );
};
// Updated StyleSheet with stories container styles and new report modal styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f0f',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#111111',
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    color: '#9ca3af',
    fontSize: 14,
    fontWeight: '500',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  toggleButton: {
    backgroundColor: '#1f2937',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#374151',
  },
  composeButton: {
    backgroundColor: PINK_THEME_COLOR,
    padding: 12,
    borderRadius: 16,
    shadowColor: PINK_THEME_COLOR,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  // ✅ NEW: Stories container styles
  storiesContainer: {
    backgroundColor: '#111111',
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
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
  searchButton: {
    backgroundColor: PINK_THEME_COLOR,
    padding: 8,
    borderRadius: 12,
    marginLeft: 8,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 36,
    shadowColor: PINK_THEME_COLOR,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  searchHint: {
    color: '#ef4444',
    fontSize: 12,
    marginTop: 8,
    marginLeft: 16,
    fontWeight: '500',
  },
  listContent: {
    paddingBottom: 100,
  },
  separator: {
    height: 1,
    backgroundColor: '#1f2937',
    marginLeft: 88,
  },
  chatContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#111111',
  },
  userContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#111111',
    position: 'relative',
  },
  userContainerLoading: {
    opacity: 0.6,
  },
  profileSection: {
    marginRight: 16,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#374151',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 28,
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
  },
  storyCountBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#1f2937',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#374151',
    minWidth: 20,
    alignItems: 'center',
  },
  storyCountText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  addStoryButton: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: PINK_THEME_COLOR,
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#111111',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  addStoryIcon: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
    lineHeight: 18,
  },
  blockingIndicator: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: '#111111',
    borderRadius: 10,
    padding: 2,
  },
  onlineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10b981',
  },
  unreadBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#ef4444',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#111111',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 4,
  },
  unreadCount: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  chatContent: {
    flex: 1,
    justifyContent: 'center',
  },
  userContent: {
    flex: 1,
    paddingTop: 4,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  userHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center', // Changed to center for horizontal alignment
    marginBottom: 6,
  },
  userNameContainer: {
    flex: 1,
    marginRight: 8,
    flexDirection: 'row', // Added for horizontal alignment
    alignItems: 'center', // Added for vertical centering
  },
  userName: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  userNameUnread: {
    color: PINK_THEME_COLOR,
    fontWeight: '700',
  },
  userFullName: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8, // Added margin to separate from username
  },
  userUsername: {
    color: '#9ca3af',
    fontSize: 14,
    fontWeight: '500',
  },
  timeContainer: {
    alignItems: 'flex-end',
  },
  timeText: {
    color: '#6b7280',
    fontSize: 12,
    fontWeight: '500',
  },
  userStatus: {
    color: '#6b7280',
    fontSize: 12,
    fontWeight: '500',
  },
  messageContainer: {
    marginTop: 2,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  messageTextUnread: {
    color: '#e5e7eb',
    fontWeight: '500',
  },
  messageTextRead: {
    color: '#9ca3af',
  },
  // Removed userBio, userTags, userTag, influencerTag, userTagText, influencerText styles
  creatingChatOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    borderRadius: 8,
  },
  creatingChatText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
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
    marginBottom: 32,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PINK_THEME_COLOR,
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 20,
    gap: 8,
    shadowColor: PINK_THEME_COLOR,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  buttonIcon: {
    marginRight: 4,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  // ✅ Block Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  blockModal: {
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
  // ✅ NEW: Report button styles
  modalReportButton: {
    flex: 1,
    backgroundColor: '#374151',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  modalReportText: {
    color: '#f59e0b',
    fontSize: 16,
    fontWeight: '600',
  },
  modalConfirmButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    shadowColor: '#000',
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
  blockedButton: {
    backgroundColor: '#1f2937',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#374151',
    position: 'relative',
  },
  blockedBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#111111',
  },
  blockedBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  // ✅ NEW: Report Modal Styles
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#1f2937',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#374151',
    marginRight: 15,
  },
  userName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  userHandle: {
    color: '#9ca3af',
    fontSize: 14,
  },
  stepContainer: {
    padding: 20,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    marginTop: 15,
  },
  optionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  optionButton: {
    backgroundColor: '#374151',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
  },
  selectedOption: {
    backgroundColor: '#ed167e',
  },
  optionText: {
    color: '#e5e7eb',
    fontSize: 14,
  },
  selectedOptionText: {
    color: '#fff',
    fontWeight: '600',
  },
  textInputContainer: {
    backgroundColor: '#374151',
    borderRadius: 10,
    padding: 15,
    marginTop: 10,
  },
  textInput: {
    color: '#fff',
    fontSize: 16,
    textAlignVertical: 'top',
    height: 100,
  },
  charCount: {
    color: '#9ca3af',
    fontSize: 12,
    textAlign: 'right',
    marginTop: 5,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 1,
    borderColor: '#9ca3af',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  checkboxLabel: {
    color: '#e5e7eb',
    fontSize: 16,
  },
  navigationButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  navButton: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  cancelButton: {
    backgroundColor: '#374151',
  },
  nextButton: {
    backgroundColor: '#ed167e',
  },
  navButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
export default WChatScreen;
