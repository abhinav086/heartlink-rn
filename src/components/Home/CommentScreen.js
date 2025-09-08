// CommentScreen.js - Complete Fixed Version with Proper Delete Permissions
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
import { useNavigation, useRoute } from '@react-navigation/native';
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

  // DELETE COMMENT STATE
  const [deletingCommentId, setDeletingCommentId] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [commentToDelete, setCommentToDelete] = useState(null);

  // ENHANCED: Store content author info separately for better permission checking
  const [contentAuthor, setContentAuthor] = useState(null);

  // Refs
  const textInputRef = useRef(null);
  const scrollViewRef = useRef(null);

  // Character limit for comments
  const MAX_COMMENT_LENGTH = 500;

  // API Base URL
  const BASE_URL = 'https://backendforheartlink.in';

  // Enhanced modal close handling
  const handleClose = () => {
    setIsVisible(false);
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

  // Get current user
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

  // ENHANCED: Extract content author info properly
  const extractContentAuthor = () => {
    console.log('=== EXTRACTING CONTENT AUTHOR ===');
    console.log('Actual Data:', JSON.stringify(actualData, null, 2));
    
    let author = null;
    
    // Try multiple ways to get author info
    if (actualData?.author) {
      if (typeof actualData.author === 'object') {
        author = actualData.author;
      } else if (typeof actualData.author === 'string') {
        // If author is just an ID string, create minimal author object
        author = { _id: actualData.author, id: actualData.author };
      }
    } else if (actualData?.authorId) {
      author = { _id: actualData.authorId, id: actualData.authorId };
    } else if (actualData?.user) {
      // Sometimes author might be stored as 'user'
      author = actualData.user;
    }

    console.log('Extracted author:', author);
    console.log('=== END EXTRACTING CONTENT AUTHOR ===');
    
    setContentAuthor(author);
    return author;
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
    extractContentAuthor(); // Extract author info
    await loadComments();
    const initialCount = actualData?.commentsCount || actualData?.commentCount || actualData?.comments || 0;
    setCommentsCount(initialCount);
    console.log(`CommentScreen initialized for ${isReel ? 'reel' : 'post'}Id:`, actualId, 'with', initialCount, 'comments');
  };

  // Load comments function
  const loadComments = async (page = 1, limit = 10) => {
    try {
      setLoading(page === 1);
      console.log('=== LOADING COMMENTS DEBUG ===');
      console.log('Content Type:', contentType);
      console.log('PostId:', postId);
      console.log('ReelId:', reelId);
      console.log('Is Reel:', isReel);
      console.log('Actual ID:', actualId);
      console.log('Page:', page, 'Limit:', limit);

      if (!actualId) {
        console.error('No actualId found');
        Alert.alert('Error', 'Content ID is missing');
        return;
      }

      const headers = await getAuthHeaders();
      console.log('Auth headers prepared');

      const apiUrl = isReel
        ? `${BASE_URL}/api/v1/posts/reels/${actualId}/comments?page=${page}&limit=${limit}`
        : `${BASE_URL}/api/v1/posts/${actualId}/comments?page=${page}&limit=${limit}`;

      console.log('API URL:', apiUrl);

      const response = await fetch(apiUrl, {
        method: 'GET',
        headers,
      });

      console.log('Response status:', response.status);

      if (response.ok) {
        const result = await response.json();
        console.log('Full API response:', JSON.stringify(result, null, 2));

        if (result.success && result.data) {
          const commentsData = result.data.comments || [];
          console.log('Comments data:', commentsData.length, 'comments found');

          if (page === 1) {
            setComments(commentsData);
          } else {
            setComments(prevComments => [...prevComments, ...commentsData]);
          }

          if (result.data.pagination) {
            setPagination(result.data.pagination);
            setCommentsCount(result.data.pagination.totalComments);
            console.log('Set comments count to:', result.data.pagination.totalComments);
          } else {
            setCommentsCount(commentsData.length);
            console.log('Set comments count to (fallback):', commentsData.length);
          }

          // ENHANCED: Also extract content author from API response if not already set
          if (!contentAuthor && result.data[isReel ? 'reel' : 'post']) {
            const contentData = result.data[isReel ? 'reel' : 'post'];
            if (contentData.author) {
              console.log('Setting content author from API response:', contentData.author);
              setContentAuthor(contentData.author);
            }
          }

          if (onCommentUpdate && result.data[isReel ? 'reel' : 'post']) {
            const contentData = result.data[isReel ? 'reel' : 'post'];
            console.log('Updating parent with content data:', contentData);
            const finalCommentCount = contentData.commentCount || result.data.pagination?.totalComments || commentsData.length;
            const realTimeComments = contentData.realTimeComments || finalCommentCount;
            console.log('Calling onCommentUpdate with:', { finalCommentCount, realTimeComments });
            onCommentUpdate(finalCommentCount, realTimeComments);
          } else {
            console.log('No onCommentUpdate callback or content data missing');
            if (onCommentUpdate) {
              const fallbackCount = result.data.pagination?.totalComments || commentsData.length;
              console.log('Calling onCommentUpdate with fallback count:', fallbackCount);
              onCommentUpdate(fallbackCount, fallbackCount);
            }
          }
        } else {
          console.log('Response not successful or no data:', result);
          setComments([]);
          setCommentsCount(0);
          if (onCommentUpdate) {
            onCommentUpdate(0, 0);
          }
        }
      } else {
        const errorText = await response.text();
        console.error('API Error Response:', errorText);
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch (e) {
          errorData = { message: errorText };
        }

        if (response.status === 404) {
          console.log('Content not found or no comments');
          setComments([]);
          setCommentsCount(0);
          if (onCommentUpdate) {
            onCommentUpdate(0, 0);
          }
        } else if (response.status === 401 || response.status === 403) {
          console.error('Authentication/Authorization error');
          Alert.alert('Authentication Error', 'Please log in again to view comments');
        } else {
          console.error('API Error:', errorData);
          Alert.alert('Error', errorData.message || `Failed to load comments (${response.status})`);
        }
      }
    } catch (error) {
      console.error('Load comments error:', error);
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

  // Add comment function
  const addComment = async () => {
    const trimmedComment = commentText.trim();
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

      const headers = await getAuthHeaders();
      console.log('Using headers with token');

      const apiUrl = isReel
        ? `${BASE_URL}/api/v1/posts/reels/${actualId}/comment`
        : `${BASE_URL}/api/v1/posts/${actualId}/comment`;

      console.log('Making request to:', apiUrl);

      const requestBody = {
        content: trimmedComment,
      };

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
        console.log('Comment created successfully!');
        const newComment = result.data?.comment;
        const updatedCommentCount = result.data?.commentCount || commentsCount + 1;
        const realTimeComments = result.data?.realTimeComments || updatedCommentCount;

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

        setComments(prevComments => [commentToAdd, ...prevComments]);
        setCommentsCount(updatedCommentCount);
        setPagination(prev => ({
          ...prev,
          totalComments: updatedCommentCount,
          commentsOnPage: prev.commentsOnPage + 1
        }));

        setCommentText('');
        if (onCommentUpdate) {
          console.log('Updating parent component with:', { updatedCommentCount, realTimeComments });
          onCommentUpdate(updatedCommentCount, realTimeComments);
        }

        setTimeout(() => {
          scrollViewRef.current?.scrollTo({ y: 0, animated: true });
        }, 100);

        textInputRef.current?.blur();

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

  // DELETE COMMENT FUNCTIONALITY
  const handleDeleteComment = (comment) => {
    setCommentToDelete(comment);
    setShowDeleteModal(true);
  };

  const confirmDeleteComment = async () => {
    if (!commentToDelete) return;

    try {
      setDeletingCommentId(commentToDelete._id);
      setShowDeleteModal(false);

      console.log('=== DELETE COMMENT DEBUG ===');
      console.log('Deleting comment:', commentToDelete._id);
      console.log('From:', isReel ? 'reel' : 'post', actualId);

      const headers = await getAuthHeaders();

      // Use the correct API endpoints from backend
      const apiUrl = isReel
        ? `${BASE_URL}/api/v1/posts/reels/${actualId}/comments/${commentToDelete._id}`
        : `${BASE_URL}/api/v1/posts/${actualId}/comments/${commentToDelete._id}`;

      console.log('Delete API URL:', apiUrl);

      const response = await fetch(apiUrl, {
        method: 'DELETE',
        headers,
      });

      console.log('Delete response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to delete comment: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('Delete response data:', result);

      if (result.success) {
        console.log('Comment deleted successfully!');
        // Get updated counts from response
        const updatedCommentCount = result.data?.commentCount || Math.max(0, commentsCount - 1);
        const realTimeComments = result.data?.realTimeComments || updatedCommentCount;

        // Remove comment from local state
        setComments(prevComments =>
          prevComments.filter(comment => comment._id !== commentToDelete._id)
        );

        setCommentsCount(updatedCommentCount);

        // Update pagination
        setPagination(prev => ({
          ...prev,
          totalComments: updatedCommentCount,
          commentsOnPage: Math.max(0, prev.commentsOnPage - 1)
        }));

        // Update parent component
        if (onCommentUpdate) {
          console.log('Updating parent after deletion:', { updatedCommentCount, realTimeComments });
          onCommentUpdate(updatedCommentCount, realTimeComments);
        }

        // Show success message
        Alert.alert('Success', 'Comment deleted successfully');
      } else {
        throw new Error(result.message || 'Failed to delete comment');
      }
    } catch (error) {
      console.error('Error deleting comment:', error);
      let errorMessage = 'Failed to delete comment. Please try again.';
      if (error.message.includes('401') || error.message.includes('403')) {
        errorMessage = 'You do not have permission to delete this comment';
      } else if (error.message.includes('404')) {
        errorMessage = 'Comment not found or already deleted';
      } else if (error.message.includes('Network request failed')) {
        errorMessage = 'Please check your internet connection and try again';
      } else if (error.message) {
        errorMessage = error.message;
      }
      Alert.alert('Error', errorMessage);
    } finally {
      setDeletingCommentId(null);
      setCommentToDelete(null);
    }
  };

  const cancelDeleteComment = () => {
    setShowDeleteModal(false);
    setCommentToDelete(null);
  };

  // ENHANCED: Improved permission checking
  const canDeleteComment = (comment) => {
    if (!currentUser || !comment?.user) {
      console.log('❌ Delete check failed: Missing user data');
      return false;
    }

    const currentUserId = currentUser._id || currentUser.id;
    const commentUserId = comment.user._id || comment.user.id;

    // Check if user is the comment author
    const isCommentAuthor = commentUserId === currentUserId;

    // Check if user is the content owner
    let isContentOwner = false;
    
    if (contentAuthor) {
      const contentAuthorId = contentAuthor._id || contentAuthor.id;
      isContentOwner = contentAuthorId === currentUserId;
    } else {
      // Fallback: try to get author from actualData
      let contentAuthorId = null;
      if (actualData?.author?._id) {
        contentAuthorId = actualData.author._id;
      } else if (actualData?.author?.id) {
        contentAuthorId = actualData.author.id;
      } else if (actualData?.author && typeof actualData.author === 'string') {
        contentAuthorId = actualData.author;
      } else if (actualData?.authorId) {
        contentAuthorId = actualData.authorId;
      }
      
      if (contentAuthorId) {
        isContentOwner = contentAuthorId === currentUserId;
      }
    }

    console.log('=== DELETE PERMISSION CHECK ===');
    console.log('Current User ID:', currentUserId);
    console.log('Comment User ID:', commentUserId);
    console.log('Content Author:', contentAuthor);
    console.log('Is Comment Author:', isCommentAuthor);
    console.log('Is Content Owner:', isContentOwner);
    console.log('Can Delete:', isCommentAuthor || isContentOwner);
    console.log('=== END DELETE PERMISSION CHECK ===');

    return isCommentAuthor || isContentOwner;
  };

  // Enhanced render individual comment with delete functionality
  const renderComment = (comment, index) => {
    const user = comment.user || comment.author || {};
    const username = safeGet(user, 'fullName', safeGet(user, 'username', safeGet(user, 'name', 'Unknown User')));
    const userImg = safeGet(user, 'photoUrl', safeGet(user, 'profilePicture', safeGet(user, 'avatar', null)));
    const userInitials = username.charAt(0).toUpperCase();
    const avatarColor = '#FF6B6B';
    const hasProfilePic = userImg && userImg.trim() !== '';
    const commentContent = safeGet(comment, 'content', safeGet(comment, 'text', ''));
    const isVerified = safeGet(user, 'isVerified', false);

    // Format time
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

    // Check delete permissions
    const canDelete = canDeleteComment(comment);
    const isDeleting = deletingCommentId === comment._id;

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

        <View style={styles.commentActions}>
          {isOwnComment && (
            <Text style={styles.ownCommentIndicator}>•</Text>
          )}
          
          {/* DELETE BUTTON - Only show if user can delete */}
          {canDelete && (
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => handleDeleteComment(comment)}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <ActivityIndicator size="small" color="#FF6B6B" />
              ) : (
                <Ionicons name="trash-outline" size={16} color="#FF6B6B" />
              )}
            </TouchableOpacity>
          )}
        </View>
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

  // Comments List
  const renderCommentsList = () => (
    <ScrollView
      ref={scrollViewRef}
      style={styles.commentsContainer}
      contentContainerStyle={styles.commentsContentContainer}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#fff"
        />
      }
      scrollEnabled={true}
      bounces={true}
      nestedScrollEnabled={true}
      keyboardShouldPersistTaps="handled"
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

  // Delete confirmation modal
  const renderDeleteModal = () => (
    <Modal
      isVisible={showDeleteModal}
      onBackdropPress={cancelDeleteComment}
      onBackButtonPress={cancelDeleteComment}
      style={styles.deleteModal}
      animationIn="slideInUp"
      animationOut="slideOutDown"
    >
      <View style={styles.deleteModalContent}>
        <Text style={styles.deleteModalTitle}>Delete Comment</Text>
        <Text style={styles.deleteModalText}>
          Are you sure you want to delete this comment? This action cannot be undone.
        </Text>
        <View style={styles.deleteModalButtons}>
          <TouchableOpacity
            style={styles.deleteModalCancelButton}
            onPress={cancelDeleteComment}
          >
            <Text style={styles.deleteModalCancelText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.deleteModalConfirmButton}
            onPress={confirmDeleteComment}
          >
            <Text style={styles.deleteModalConfirmText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  // Modal content
  const renderModalContent = () => (
    <SafeAreaView style={styles.modalContainer}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {/* Header */}
        {renderHeader()}

        {/* Comments List */}
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
      
      {/* Delete Confirmation Modal */}
      {renderDeleteModal()}
    </View>
  );
};

// Complete styles for the enhanced comment screen
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
    flex: 1,
  },
  keyboardContainer: {
    flex: 1,
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
    width: 34,
  },
  commentsContainer: {
    flex: 1,
  },
  commentsContentContainer: {
    paddingHorizontal: 15,
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
    marginRight: 10,
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
    alignItems: 'center',
  },
  ownCommentIndicator: {
    color: '#1DA1F2',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  deleteButton: {
    padding: 8,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
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
  // DELETE MODAL STYLES
  deleteModal: {
    justifyContent: 'center',
    alignItems: 'center',
    margin: 20,
  },
  deleteModalContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 15,
    padding: 20,
    width: '100%',
    maxWidth: 300,
  },
  deleteModalTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 10,
  },
  deleteModalText: {
    color: '#ccc',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  deleteModalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  deleteModalCancelButton: {
    flex: 1,
    paddingVertical: 12,
    marginRight: 10,
    backgroundColor: '#333',
    borderRadius: 8,
    alignItems: 'center',
  },
  deleteModalCancelText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  deleteModalConfirmButton: {
    flex: 1,
    paddingVertical: 12,
    marginLeft: 10,
    backgroundColor: '#FF6B6B',
    borderRadius: 8,
    alignItems: 'center',
  },
  deleteModalConfirmText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default CommentScreen;