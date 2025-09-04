// CommentScreen.js - Enhanced Modal Version with React Navigation support
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  SafeAreaView,
} from 'react-native';
import Modal from 'react-native-modal';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useRoute } from '@react-navigation/native'; // Corrected import
import Ionicons from 'react-native-vector-icons/Ionicons';

const CommentScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { postId, postData, onCommentUpdate, reelId, reelData, contentType } = route.params || {};

  // Determine if this is a reel or post
  const isReel = contentType === 'reel' || !!reelId || postData?.type === 'reel';
  const actualId = isReel ? (reelId || postId) : postId;
  const actualData = isReel ? (reelData || postData) : postData;

  // Modal state
  const [isVisible, setIsVisible] = useState(true);

  // State management
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  // ✅ IMPROVED: Better initialization of comments count
  const [commentsCount, setCommentsCount] = useState(() => {
    return actualData?.commentsCount || actualData?.commentCount || actualData?.comments || 0;
  });
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalComments: 0,
    hasNextPage: false,
    hasPrevPage: false,
    commentsOnPage: 0
  });

  // Refs
  const textInputRef = useRef(null);
  const scrollViewRef = useRef(null);

  // Character limit for comments
  const MAX_COMMENT_LENGTH = 500;

  // API Base URL - Fixed trailing space
  const BASE_URL = 'https://backendforheartlink.in';

  // ✅ ENHANCED: Better modal close handling
  const handleClose = () => {
    setIsVisible(false);
    // Small delay to let the animation complete before going back
    setTimeout(() => {
      navigation.goBack();
    }, 300);
  };

  // Get auth headers with proper token validation
  const getAuthHeaders = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token available');
      }

      return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      };
    } catch (error) {
      console.error('Error getting auth headers:', error);
      throw error;
    }
  };

  // Get auth token (legacy support)
  const getAuthToken = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        console.warn('No auth token found in AsyncStorage');
        return null;
      }
      console.log('Retrieved token:', token.substring(0, 20) + '...');
      return token;
    } catch (error) {
      console.error('Error getting auth token:', error);
      return null;
    }
  };

  const getCurrentUser = async () => {
    try {
      const userJson = await AsyncStorage.getItem('user');
      if (userJson) {
        const user = JSON.parse(userJson);
        console.log('Current user loaded:', {
          id: user._id || user.id,
          username: user.username || user.name,
          email: user.email
        });
        setCurrentUser(user);
        return user;
      } else {
        console.warn('No user data found in AsyncStorage');
        // Try alternative storage keys
        const altUserJson = await AsyncStorage.getItem('userData') ||
          await AsyncStorage.getItem('currentUser') ||
          await AsyncStorage.getItem('userInfo');
        if (altUserJson) {
          const user = JSON.parse(altUserJson);
          console.log('User found in alternative storage:', user);
          setCurrentUser(user);
          return user;
        }
      }
    } catch (error) {
      console.error('Error getting current user:', error);
    }
    return null;
  };

  // Safe property access
  const safeGet = (obj, property, fallback = '') => {
    try {
      return obj && obj[property] !== undefined ? obj[property] : fallback;
    } catch (error) {
      console.error('Error accessing property:', property, error);
      return fallback;
    }
  };

  // Load current user and comments on component mount
  useEffect(() => {
    if (isVisible) {
      initializeScreen();
    }
  }, [isVisible]);

  const initializeScreen = async () => {
    await getCurrentUser();
    await loadComments();
    // Initialize with existing comment count from data
    const initialCount = actualData?.commentsCount || actualData?.commentCount || actualData?.comments || 0;
    setCommentsCount(initialCount);
    console.log(`CommentScreen initialized for ${isReel ? 'reel' : 'post'}Id:`, actualId, 'with', initialCount, 'comments');
  };

  // Enhanced debugging and error handling for loadComments function
  const loadComments = async (page = 1, limit = 10) => {
    try {
      setLoading(page === 1);

      // Enhanced debugging
      console.log('=== LOADING COMMENTS DEBUG ===');
      console.log('Content Type:', contentType);
      console.log('PostId:', postId);
      console.log('ReelId:', reelId);
      console.log('PostData:', postData);
      console.log('ReelData:', reelData);
      console.log('Is Reel:', isReel);
      console.log('Actual ID:', actualId);
      console.log('Page:', page, 'Limit:', limit);

      // Validate required data
      if (!actualId) {
        console.error('❌ No actualId found');
        Alert.alert('Error', 'Content ID is missing');
        return;
      }

      const headers = await getAuthHeaders();
      console.log('✅ Auth headers prepared');

      const apiUrl = isReel
        ? `${BASE_URL}/api/v1/posts/reels/${actualId}/comments?page=${page}&limit=${limit}`
        : `${BASE_URL}/api/v1/posts/${actualId}/comments?page=${page}&limit=${limit}`;

      console.log('🔗 API URL:', apiUrl);
      console.log('📋 Request headers:', JSON.stringify(headers, null, 2));

      const response = await fetch(apiUrl, {
        method: 'GET',
        headers,
      });

      console.log('📡 Response status:', response.status);
      console.log('📡 Response headers:', JSON.stringify([...response.headers.entries()], null, 2));

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Full API response:', JSON.stringify(result, null, 2));

        if (result.success && result.data) {
          const commentsData = result.data.comments || [];
          console.log('📝 Comments data:', commentsData.length, 'comments found');
          console.log('📊 Pagination data:', result.data.pagination);

          if (page === 1) {
            setComments(commentsData);
          } else {
            setComments(prevComments => [...prevComments, ...commentsData]);
          }

          if (result.data.pagination) {
            setPagination(result.data.pagination);
            setCommentsCount(result.data.pagination.totalComments);
            console.log('📊 Set comments count to:', result.data.pagination.totalComments);
          } else {
            setCommentsCount(commentsData.length);
            console.log('📊 Set comments count to (fallback):', commentsData.length);
          }

          // ✅ ENHANCED: Better parent component update with more robust callback
          if (onCommentUpdate && result.data[isReel ? 'reel' : 'post']) {
            const contentData = result.data[isReel ? 'reel' : 'post'];
            console.log('🔄 Updating parent with content data:', contentData);
            const finalCommentCount = contentData.commentCount || result.data.pagination?.totalComments || commentsData.length;
            const realTimeComments = contentData.realTimeComments || finalCommentCount;
            console.log('🔄 Calling onCommentUpdate with:', { finalCommentCount, realTimeComments });
            onCommentUpdate(finalCommentCount, realTimeComments);
          } else {
            console.log('⚠️ No onCommentUpdate callback or content data missing');
            console.log('onCommentUpdate exists:', !!onCommentUpdate);
            console.log('Content data exists:', !!result.data[isReel ? 'reel' : 'post']);

            // ✅ FALLBACK: Still try to update parent with available data
            if (onCommentUpdate) {
              const fallbackCount = result.data.pagination?.totalComments || commentsData.length;
              console.log('🔄 Calling onCommentUpdate with fallback count:', fallbackCount);
              onCommentUpdate(fallbackCount, fallbackCount);
            }
          }
        } else {
          console.log('❌ Response not successful or no data:', result);
          setComments([]);
          setCommentsCount(0);
          // ✅ UPDATE: Still call parent callback even when no comments
          if (onCommentUpdate) {
            onCommentUpdate(0, 0);
          }
        }
      } else {
        const errorText = await response.text();
        console.error('❌ API Error Response:', errorText);

        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch (e) {
          errorData = { message: errorText };
        }

        if (response.status === 404) {
          console.log('📭 Content not found or no comments');
          setComments([]);
          setCommentsCount(0);
          // ✅ UPDATE: Call parent callback even when content not found
          if (onCommentUpdate) {
            onCommentUpdate(0, 0);
          }
        } else if (response.status === 401 || response.status === 403) {
          console.error('🔒 Authentication/Authorization error');
          Alert.alert('Authentication Error', 'Please log in again to view comments');
        } else {
          console.error('💥 API Error:', errorData);
          Alert.alert('Error', errorData.message || `Failed to load comments (${response.status})`);
        }
      }

    } catch (error) {
      console.error('💥 Load comments error:', error);
      console.error('Error stack:', error.stack);

      let errorMessage = 'Failed to load comments. Please try again.';

      if (error.message.includes('Network request failed')) {
        errorMessage = 'Please check your internet connection and try again';
      } else if (error.message.includes('No authentication token')) {
        errorMessage = 'Please log in again to view comments';
      } else if (error.message) {
        errorMessage = error.message;
      }

      Alert.alert('Error', errorMessage);
      setComments([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
      console.log('=== END LOADING COMMENTS DEBUG ===');
    }
  };

  // Handle refresh
  const onRefresh = () => {
    setRefreshing(true);
    loadComments(1, 10);
  };

  // ✅ ENHANCED: Better comment submission with improved error handling
  const addComment = async () => {
    const trimmedComment = commentText.trim();

    // Validation
    if (!trimmedComment) {
      Alert.alert('Error', 'Comment cannot be empty');
      return;
    }

    if (trimmedComment.length > MAX_COMMENT_LENGTH) {
      Alert.alert('Error', `Comment cannot be longer than ${MAX_COMMENT_LENGTH} characters`);
      return;
    }

    if (!actualId) {
      Alert.alert('Error', `${isReel ? 'Reel' : 'Post'} ID is missing`);
      return;
    }

    if (!currentUser) {
      Alert.alert('Error', 'User information not available. Please log in again.');
      return;
    }

    try {
      setSubmitting(true);
      console.log('=== COMMENT SUBMISSION DEBUG ===');
      console.log(`${isReel ? 'Reel' : 'Post'} ID:`, actualId);
      console.log('Comment text:', trimmedComment);
      console.log('Current user:', {
        id: currentUser._id || currentUser.id,
        username: currentUser.username || currentUser.name,
        email: currentUser.email
      });

      const headers = await getAuthHeaders();
      console.log('Using headers with token');

      // Use consistent /api/v1/posts base URL for both posts and reels
      const apiUrl = isReel
        ? `${BASE_URL}/api/v1/posts/reels/${actualId}/comment`
        : `${BASE_URL}/api/v1/posts/${actualId}/comment`;

      console.log('Making request to:', apiUrl);

      const requestBody = {
        content: trimmedComment,
      };
      console.log('Request body:', requestBody);

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      });

      console.log('Response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to add comment: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('Response data:', result);

      if (result.success) {
        // SUCCESS: Handle response following API guide format
        console.log('Comment created successfully!');

        // Get the new comment from the response
        const newComment = result.data?.comment;
        const updatedCommentCount = result.data?.commentCount || commentsCount + 1;
        const realTimeComments = result.data?.realTimeComments || updatedCommentCount;

        console.log('New comment from API:', newComment);
        console.log('Updated comment count:', updatedCommentCount);

        // Create proper comment object with API response data
        const commentToAdd = newComment || {
          _id: Date.now().toString(),
          content: trimmedComment,
          user: {
            _id: currentUser._id || currentUser.id,
            fullName: currentUser.fullName || currentUser.username || currentUser.name || 'You',
            username: currentUser.username || currentUser.name || 'You',
            photoUrl: currentUser.photoUrl || currentUser.profilePicture || currentUser.avatar || null,
            isVerified: currentUser.isVerified || false,
          },
          createdAt: new Date().toISOString(),
          timeAgo: 'Just now',
          isCommentByCurrentUser: true,
          canEdit: true,
          canDelete: true
        };

        console.log('Comment to add to UI:', commentToAdd);

        // Add new comment to the top of the list (like social media apps)
        setComments(prevComments => [commentToAdd, ...prevComments]);
        setCommentsCount(updatedCommentCount);

        // Update pagination
        setPagination(prev => ({
          ...prev,
          totalComments: updatedCommentCount,
          commentsOnPage: prev.commentsOnPage + 1
        }));

        // Clear input
        setCommentText('');

        // ✅ ENHANCED: Better parent component update
        if (onCommentUpdate) {
          console.log('🔄 Updating parent component with:', { updatedCommentCount, realTimeComments });
          onCommentUpdate(updatedCommentCount, realTimeComments);
        }

        // Scroll to top to show new comment
        setTimeout(() => {
          scrollViewRef.current?.scrollTo({ y: 0, animated: true });
        }, 100);

        // Blur text input
        textInputRef.current?.blur();

        // Show success message from API or default
        console.log(result.message || 'Comment posted successfully!');

      } else {
        throw new Error(result.message || 'Failed to post comment');
      }
    } catch (error) {
      console.error('Error adding comment:', error);

      let errorMessage = 'Failed to post comment. Please try again.';

      if (error.message.includes('401') || error.message.includes('authentication')) {
        errorMessage = 'Please log in again to comment';
      } else if (error.message.includes('404')) {
        errorMessage = `${isReel ? 'Reel' : 'Post'} not found or no longer available`;
      } else if (error.message.includes('Network request failed')) {
        errorMessage = 'Please check your internet connection and try again';
      } else if (error.message.includes('empty') || error.message.includes('content')) {
        errorMessage = 'Comment cannot be empty';
      } else if (error.message.includes('500') || error.message.includes('long')) {
        errorMessage = 'Comment is too long (max 500 characters)';
      } else if (error.message) {
        errorMessage = error.message;
      }

      Alert.alert('Error', errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  // Enhanced render individual comment with proper user data handling
  const renderComment = (comment, index) => {
    const user = comment.user || comment.author || {};
    const username = safeGet(user, 'fullName', safeGet(user, 'username', safeGet(user, 'name', 'Unknown User')));
    const userImg = safeGet(user, 'photoUrl', safeGet(user, 'profilePicture', safeGet(user, 'avatar', null)));
    const userInitials = username.charAt(0).toUpperCase();
    const avatarColor = '#FF6B6B';
    const hasProfilePic = userImg && userImg.trim() !== '';
    const commentContent = safeGet(comment, 'content', safeGet(comment, 'text', ''));
    const isVerified = safeGet(user, 'isVerified', false);

    // Format time - prioritize timeAgo from API
    let timeAgo = '';
    if (comment.timeAgo) {
      timeAgo = comment.timeAgo;
    } else if (comment.createdAt) {
      const commentDate = new Date(comment.createdAt);
      const now = new Date();
      const diffMs = now - commentDate;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) {
        timeAgo = 'just now';
      } else if (diffMins < 60) {
        timeAgo = `${diffMins}m`;
      } else if (diffHours < 24) {
        timeAgo = `${diffHours}h`;
      } else {
        timeAgo = `${diffDays}d`;
      }
    }

    // Check if this comment is from current user
    const isOwnComment = comment.isCommentByCurrentUser || (currentUser && (
      user._id === currentUser._id ||
      user.id === currentUser.id ||
      user._id === currentUser.id ||
      user.id === currentUser._id
    ));

    return (
      <View key={comment._id || comment.id || index} style={styles.commentItem}>
        <View style={styles.commentAvatar}>
          <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
            {hasProfilePic ? (
              <Image
                source={{ uri: userImg }}
                style={styles.profileImage}
                onError={(error) => {
                  console.log('Comment user image error:', error?.nativeEvent?.error);
                }}
              />
            ) : (
              <Text style={styles.avatarText}>
                {userInitials}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.commentContent}>
          <View style={styles.commentBubble}>
            <View style={styles.commentHeader}>
              <Text style={styles.commentUsername}>{username}</Text>
              {isVerified && (
                <Ionicons name="checkmark-circle" size={14} color="#1DA1F2" style={styles.verifiedIcon} />
              )}
            </View>
            <Text style={styles.commentText}>{commentContent}</Text>
          </View>
          {timeAgo && (
            <Text style={styles.commentTime}>{timeAgo}</Text>
          )}
        </View>

        {isOwnComment && (
          <View style={styles.commentActions}>
            <Text style={styles.ownCommentIndicator}>•</Text>
          </View>
        )}
      </View>
    );
  };

  // Header component
  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
        <Ionicons name="close" size={24} color="white" />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>
        Comments {commentsCount > 0 && `(${commentsCount})`}
      </Text>
      <View style={styles.headerRight} />
    </View>
  );

  // --- ENHANCED ScrollView Props for Better Scrolling ---
  // Comments List
  const renderCommentsList = () => (
    <ScrollView
      ref={scrollViewRef}
      style={styles.commentsContainer}
      contentContainerStyle={styles.commentsContentContainer} // Add this style
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#fff"
        />
      }
      // --- KEY SCROLL IMPROVEMENTS ---
      scrollEnabled={true} // Explicitly enable scrolling
      bounces={true}       // Enable bouncing for better UX
      nestedScrollEnabled={true} // Allow nested scrolling if needed
      keyboardShouldPersistTaps="handled" // Prevent keyboard from interfering with scroll taps
    >
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1DA1F2" />
          <Text style={styles.loadingText}>Loading comments...</Text>
        </View>
      ) : comments.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="chatbubble-outline" size={50} color="#666" />
          <Text style={styles.emptyText}>No comments yet</Text>
          <Text style={styles.emptySubtext}>Be the first to comment!</Text>
        </View>
      ) : (
        <View style={styles.commentsList}>
          {comments.map((comment, index) => renderComment(comment, index))}
        </View>
      )}
    </ScrollView>
  );

  // Modal content - Updated to use the new renderCommentsList function
  const renderModalContent = () => (
    <SafeAreaView style={styles.modalContainer}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {/* Header */}
        {renderHeader()}

        {/* Comments List - Updated */}
        {renderCommentsList()}

        {/* Comment Input */}
        <View style={styles.inputContainer}>
          <View style={styles.currentUserAvatar}>
            {currentUser && (
              <View style={[styles.avatar, { backgroundColor: '#1DA1F2' }]}>
                {currentUser.photoUrl || currentUser.profilePicture ? (
                  <Image
                    source={{ uri: currentUser.photoUrl || currentUser.profilePicture }}
                    style={styles.profileImage}
                  />
                ) : (
                  <Text style={styles.avatarText}>
                    {(currentUser.fullName || currentUser.username || currentUser.name || 'U').charAt(0).toUpperCase()}
                  </Text>
                )}
              </View>
            )}
          </View>

          <View style={styles.inputWrapper}>
            <TextInput
              ref={textInputRef}
              style={styles.textInput}
              placeholder={`Comment as ${currentUser?.fullName || currentUser?.username || currentUser?.name || 'User'}...`}
              placeholderTextColor="#666"
              value={commentText}
              onChangeText={setCommentText}
              multiline
              maxLength={MAX_COMMENT_LENGTH}
              returnKeyType="send"
              onSubmitEditing={addComment}
              editable={!submitting}
            />
            <Text style={styles.characterCount}>
              {commentText.length}/{MAX_COMMENT_LENGTH}
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.sendButton,
              (!commentText.trim() || submitting) && styles.sendButtonDisabled
            ]}
            onPress={addComment}
            disabled={!commentText.trim() || submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="send" size={20} color="white" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );

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

// Enhanced styles for modal
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
    // Removed maxHeight/minHeight here, rely on flex
    flex: 1, // Take up available space within the modal
  },
  keyboardContainer: {
    flex: 1, // Ensure it takes full height
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  closeButton: {
    padding: 5,
  },
  headerTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  headerRight: {
    width: 34, // Same as close button to center title
  },
  commentsContainer: {
    // paddingHorizontal: 15, // Move padding inside contentContainer if needed
    flex: 1, // Crucial: Take up remaining space
  },
  // Add this new style for content container padding
  commentsContentContainer: {
    paddingHorizontal: 15, // Apply horizontal padding here
    // paddingVertical can also go here if needed
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
  },
  loadingText: {
    color: '#666',
    marginTop: 10,
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
  },
  emptyText: {
    color: '#666',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 5,
    marginTop: 15,
  },
  emptySubtext: {
    color: '#888',
    fontSize: 14,
    marginBottom: 10,
  },
  commentsList: {
    paddingVertical: 15,
  },
  commentItem: {
    flexDirection: 'row',
    marginBottom: 15,
    alignItems: 'flex-start',
  },
  commentAvatar: {
    marginRight: 5,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '700',
  },
  profileImage: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
  },
  commentContent: {
    flex: 1,
  },
  commentBubble: {
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 15,
    marginBottom: 4,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  commentUsername: {
    color: 'white',
    fontSize: 13,
    fontWeight: '600',
  },
  verifiedIcon: {
    marginLeft: 4,
  },
  commentText: {
    color: 'white',
    fontSize: 14,
    lineHeight: 18,
  },
  commentTime: {
    color: '#666',
    fontSize: 12,
    marginLeft: 12,
  },
  commentActions: {
    marginLeft: 10,
    justifyContent: 'center',
  },
  ownCommentIndicator: {
    color: '#1DA1F2',
    fontSize: 16,
    fontWeight: 'bold',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 15,
    paddingVertical: 10,
    paddingBottom: 15,
    borderTopWidth: 1,
    borderTopColor: '#333',
    backgroundColor: '#000',
  },
  currentUserAvatar: {
    marginRight: 10,
    alignSelf: 'flex-end',
    marginBottom: 28,
  },
  inputWrapper: {
    flex: 1,
    marginRight: 10,
  },
  textInput: {
    backgroundColor: '#1a1a1a',
    color: 'white',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    fontSize: 16,
    maxHeight: 100,
    minHeight: 40,
  },
  characterCount: {
    color: '#666',
    fontSize: 12,
    textAlign: 'right',
    marginTop: 5,
    marginRight: 5,
  },
  sendButton: {
    backgroundColor: '#1DA1F2',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'flex-end',
    marginBottom: 22,
  },
  sendButtonDisabled: {
    backgroundColor: '#333',
  },
});

export default CommentScreen;
