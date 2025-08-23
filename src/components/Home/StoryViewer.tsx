// StoryViewer.js - Complete Single File with All Logic
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Image,
  Text,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  ActivityIndicator,
  Alert,
  Animated,
  TextInput,
  ScrollView,
  FlatList,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Video from 'react-native-video';
import Modal from 'react-native-modal';
import { useNavigation, useRoute } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import BASE_URL from '../../config/config';
import { useAuth } from '../../context/AuthContext';

const { width, height } = Dimensions.get('window');

// =============================================
// SIMPLIFIED UTILITY FUNCTIONS
// =============================================

const getInitials = (name) => {
  if (!name || typeof name !== 'string' || name === 'Unknown User') return '?';
  const names = name.trim().split(' ');
  if (names.length === 1) {
    return names[0].charAt(0).toUpperCase();
  }
  return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase();
};

const getAvatarColor = (name) => {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
    '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
  ];
  if (!name || typeof name !== 'string') return colors[0];
  const charCodeSum = name.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return colors[charCodeSum % colors.length];
};

const getTimeAgo = (createdAt) => {
  if (!createdAt) return '';
  const now = new Date();
  const storyTime = new Date(createdAt);
  const diffInMs = now - storyTime;
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60));

  if (diffInMinutes < 1) return 'now';
  else if (diffInHours < 1) return `${diffInMinutes}m`;
  else if (diffInHours < 24) return `${diffInHours}h`;
  else return `${Math.floor(diffInHours / 24)}d`;
};

const getValidMediaUrl = (mediaUrl) => {
  if (!mediaUrl || typeof mediaUrl !== 'string') return null;
  const trimmedUrl = mediaUrl.trim();
  if (trimmedUrl === '') return null;
  if (trimmedUrl.startsWith('http')) return trimmedUrl;
  else if (trimmedUrl.startsWith('/')) return `${BASE_URL}${trimmedUrl}`;
  else return trimmedUrl;
};

// =============================================
// MAIN STORYVIEWER COMPONENT
// =============================================

const StoryViewer = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { stories: initialStories, currentIndex = 0, userName, userAvatar, userId, isOwnStory = false } = route.params;
  const { user: currentUser, token } = useAuth();

  // Story States
  const [stories, setStories] = useState(initialStories);
  const [currentStoryIndex, setCurrentStoryIndex] = useState(currentIndex);
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const [paused, setPaused] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [mediaError, setMediaError] = useState(false);

  // Comment Modal States
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [refreshingComments, setRefreshingComments] = useState(false);

  // Story Interaction States
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [repliesCount, setRepliesCount] = useState(0);
  const [liking, setLiking] = useState(false);

  // Inline Reply States
  const [inlineReplyText, setInlineReplyText] = useState('');
  const [sendingInlineReply, setSendingInlineReply] = useState(false);

  // Views Tracking States
  const [viewsCount, setViewsCount] = useState(0);
  const [viewers, setViewers] = useState([]);
  const [showViewersModal, setShowViewersModal] = useState(false);
  const [loadingViewers, setLoadingViewers] = useState(false);

  // Refs
  const progressRef = useRef(new Animated.Value(0)).current;
  const intervalRef = useRef(null);
  const videoRef = useRef(null);
  const commentInputRef = useRef(null);
  const inlineInputRef = useRef(null);

  // Constants
  const storyDuration = 5000;
  const MAX_COMMENT_LENGTH = 500;

  // Auth Headers Helper
  const getAuthHeaders = () => ({
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  });

  // =============================================
  // EFFECTS
  // =============================================

  useEffect(() => {
    StatusBar.setHidden(true);
    return () => StatusBar.setHidden(false);
  }, []);

  useEffect(() => {
    if (stories && stories.length > 0) {
      setMediaError(false);
      startStoryProgress();
      markStoryAsViewed(stories[currentStoryIndex]);
      const currentStory = stories[currentStoryIndex];
      if (currentStory) {
        setIsLiked(!!currentStory.isLiked || !!currentStory.liked || false);
        setLikesCount(currentStory.likesCount || currentStory.likes?.length || 0);
        setRepliesCount(currentStory.repliesCount || currentStory.replies?.length || 0);
        setViewsCount(currentStory.viewsCount || currentStory.views?.length || 0);
      }
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [currentStoryIndex, stories]);

  // =============================================
  // STORY PROGRESS FUNCTIONS
  // =============================================

  const startStoryProgress = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (showCommentModal || showViewersModal) return;
    
    progressRef.setValue(0);
    setProgress(0);
    const progressStep = 100 / (storyDuration / 50);
    
    intervalRef.current = setInterval(() => {
      if (!paused && !mediaError && !showCommentModal && !showViewersModal) {
        setProgress(prev => {
          const newProgress = prev + progressStep;
          if (newProgress >= 100) {
            handleNextStory();
            return 0;
          }
          return newProgress;
        });
      }
    }, 50);
  };

  const handleNextStory = () => {
    if (currentStoryIndex < stories.length - 1) {
      setCurrentStoryIndex(prev => prev + 1);
    } else {
      navigation.goBack();
    }
  };

  const handlePreviousStory = () => {
    if (currentStoryIndex > 0) {
      setCurrentStoryIndex(prev => prev - 1);
    } else {
      navigation.goBack();
    }
  };

  // =============================================
  // API FUNCTIONS
  // =============================================

  const markStoryAsViewed = async (story) => {
    if (!story || isOwnStory) return;
    try {
      await fetch(`${BASE_URL}/api/v1/stories/stories/${story._id}/view`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
    } catch (error) {
      console.error('Error marking story as viewed:', error);
    }
  };

  const loadComments = async () => {
    const currentStory = stories[currentStoryIndex];
    if (!currentStory) return;

    try {
      setLoadingComments(true);
      console.log('💬 Loading comments for story:', currentStory._id);
      console.log('💬 API URL:', `${BASE_URL}/api/v1/stories/${currentStory._id}/replies`);
      
      const response = await fetch(`${BASE_URL}/api/v1/stories/${currentStory._id}/replies`, {
        method: 'GET',
        headers: getAuthHeaders(),
      });

      console.log('💬 Comments API response status:', response.status);

      if (response.ok) {
        const result = await response.json();
        console.log('💬 RAW API RESPONSE:', JSON.stringify(result, null, 2));
        
        if (result.success && result.data) {
          const replies = result.data.replies || [];
          console.log('💬 REPLIES ARRAY LENGTH:', replies.length);
          
          // COMPREHENSIVE DEBUG LOG FOR EACH REPLY
          replies.forEach((reply, index) => {
            console.log(`👤 REPLY ${index + 1} COMPLETE DATA:`, {
              replyId: reply._id,
              text: reply.text?.substring(0, 20) + '...',
              user: reply.user,
              userExists: !!reply.user,
              userId: reply.user?._id,
              username: reply.user?.username,
              fullName: reply.user?.fullName,
              photoUrl: reply.user?.photoUrl,
              photoUrlType: typeof reply.user?.photoUrl,
              photoUrlLength: reply.user?.photoUrl?.length,
              hasPhotoUrl: !!reply.user?.photoUrl,
              userKeys: reply.user ? Object.keys(reply.user) : []
            });
          });
          
          setComments(replies);
          setRepliesCount(result.data.totalReplies || replies.length);
        } else {
          console.error('❌ Comments API returned success=false:', result);
        }
      } else {
        console.error('❌ Comments API failed with status:', response.status);
        const errorText = await response.text();
        console.error('❌ Comments API error response:', errorText);
      }
    } catch (error) {
      console.error('❌ Error loading comments:', error);
    } finally {
      setLoadingComments(false);
      setRefreshingComments(false);
    }
  };

  const addComment = async () => {
    const trimmedComment = commentText.trim();
    const currentStory = stories[currentStoryIndex];
    
    if (!trimmedComment || !currentStory || !currentUser) return;

    try {
      setSubmittingComment(true);
      const response = await fetch(`${BASE_URL}/api/v1/stories/${currentStory._id}/reply`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ text: trimmedComment }),
      });

      if (response.ok) {
        const newComment = {
          _id: Date.now().toString(),
          text: trimmedComment,
          user: {
            _id: currentUser._id,
            username: currentUser.username,
            fullName: currentUser.fullName || currentUser.username,
            photoUrl: currentUser.photoUrl,
          },
          repliedAt: new Date().toISOString(),
        };
        
        setComments(prev => [newComment, ...prev]);
        setRepliesCount(prev => prev + 1);
        setCommentText('');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to add comment');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleLikeStory = async () => {
    if (liking || isOwnStory) return;
    const currentStory = stories[currentStoryIndex];
    if (!currentStory) return;

    try {
      setLiking(true);
      const wasLiked = isLiked;
      setIsLiked(!wasLiked);
      setLikesCount(prev => wasLiked ? Math.max(0, prev - 1) : prev + 1);

      const method = wasLiked ? 'DELETE' : 'POST';
      const response = await fetch(`${BASE_URL}/api/v1/stories/${currentStory._id}/like`, {
        method,
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.data) {
          setIsLiked(result.data.isLiked ?? !wasLiked);
          setLikesCount(result.data.likesCount ?? likesCount);
        }
      }
    } catch (error) {
      console.error('Error updating like:', error);
      setIsLiked(isLiked);
      setLikesCount(likesCount);
    } finally {
      setLiking(false);
    }
  };

  const addInlineReply = async () => {
    const trimmedReply = inlineReplyText.trim();
    const currentStory = stories[currentStoryIndex];
    
    if (!trimmedReply || !currentStory || !currentUser) return;

    try {
      setSendingInlineReply(true);
      const response = await fetch(`${BASE_URL}/api/v1/stories/${currentStory._id}/reply`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ text: trimmedReply }),
      });

      if (response.ok) {
        setRepliesCount(prev => prev + 1);
        setInlineReplyText('');
        inlineInputRef.current?.blur();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to send reply');
    } finally {
      setSendingInlineReply(false);
    }
  };

  const loadViewers = async () => {
    const currentStory = stories[currentStoryIndex];
    if (!currentStory || !isOwnStory) return;

    try {
      setLoadingViewers(true);
      console.log('🔍 Loading viewers for story:', currentStory._id);
      
      const response = await fetch(`${BASE_URL}/api/v1/stories/stories/${currentStory._id}/viewers`, {
        method: 'GET',
        headers: getAuthHeaders(),
      });

      console.log('👥 Viewers API response status:', response.status);

      if (response.ok) {
        const result = await response.json();
        console.log('👥 Viewers API full response:', result);
        
        if (result.success && result.data) {
          const viewersData = result.data.viewers || [];
          console.log('👥 Processed viewers data:', viewersData);
          
          // Log each viewer's structure
          viewersData.forEach((viewer, index) => {
            console.log(`👤 Viewer ${index}:`, {
              id: viewer._id || viewer.user?._id,
              user: viewer.user,
              directFields: {
                fullName: viewer.fullName,
                username: viewer.username, 
                photoUrl: viewer.photoUrl
              },
              userFields: {
                fullName: viewer.user?.fullName,
                username: viewer.user?.username,
                photoUrl: viewer.user?.photoUrl
              }
            });
          });
          
          setViewers(viewersData);
          setViewsCount(result.data.pagination?.totalViewers || viewersData.length || 0);
        } else {
          console.error('❌ Viewers API returned success=false:', result);
        }
      } else {
        console.error('❌ Viewers API failed with status:', response.status);
        const errorText = await response.text();
        console.error('❌ Viewers API error response:', errorText);
      }
    } catch (error) {
      console.error('❌ Error loading viewers:', error);
    } finally {
      setLoadingViewers(false);
    }
  };

  // =============================================
  // MODALS
  // =============================================

  const openCommentsModal = () => {
    setShowCommentModal(true);
    setPaused(true);
    loadComments();
  };

  const closeCommentsModal = () => {
    setShowCommentModal(false);
    setPaused(false);
    startStoryProgress();
  };

  const openViewersModal = () => {
    if (!isOwnStory) return;
    setShowViewersModal(true);
    setPaused(true);
    loadViewers();
  };

  const closeViewersModal = () => {
    setShowViewersModal(false);
    setPaused(false);
    startStoryProgress();
  };

  // =============================================
  // RENDER FUNCTIONS
  // =============================================

  const renderComment = ({ item: comment }) => {
    const user = comment.user || {};
    const username = user.fullName || user.username || 'Unknown User';
    const userInitials = getInitials(username);
    const avatarColor = getAvatarColor(username);
    const isOwnComment = currentUser && (user._id === currentUser._id);

    // ULTRA COMPREHENSIVE DEBUG FOR EACH RENDER
    console.log(`🖼️ RENDERING COMMENT AVATAR:`, {
      commentId: comment._id,
      userId: user._id,
      username: username,
      rawPhotoUrl: user.photoUrl,
      photoUrlExists: !!user.photoUrl,
      photoUrlType: typeof user.photoUrl,
      photoUrlValue: JSON.stringify(user.photoUrl),
      userObject: JSON.stringify(user),
      willShowImage: !!user.photoUrl,
      fallbackInitials: userInitials,
      fallbackColor: avatarColor
    });

    return (
      <View style={styles.commentItem}>
        <View style={styles.commentAvatar}>
          <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
            {user.photoUrl ? (
              <Image
                source={{ 
                  uri: user.photoUrl,
                  cache: 'reload' // FORCE RELOAD EVERY TIME
                }}
                style={styles.avatarImage}
                onError={(error) => {
                  console.log('❌ COMMENT IMAGE FAILED:', {
                    username,
                    photoUrl: user.photoUrl,
                    error: error.nativeEvent?.error,
                    errorMessage: error.nativeEvent?.message
                  });
                }}
                onLoad={() => {
                  console.log('✅ COMMENT IMAGE SUCCESS:', {
                    username,
                    photoUrl: user.photoUrl
                  });
                }}
                onLoadStart={() => {
                  console.log('🔄 COMMENT IMAGE LOADING STARTED:', user.photoUrl);
                }}
                onLoadEnd={() => {
                  console.log('🏁 COMMENT IMAGE LOADING ENDED:', user.photoUrl);
                }}
              />
            ) : (
              <Text style={styles.avatarText}>{userInitials}</Text>
            )}
          </View>
        </View>

        <View style={styles.commentContent}>
          <View style={styles.commentBubble}>
            <View style={styles.commentHeader}>
              <Text style={styles.commentUsername}>{username}</Text>
              {user.isVerified && (
                <Ionicons name="checkmark-circle" size={14} color="#1DA1F2" style={styles.verifiedIcon} />
              )}
            </View>
            <Text style={styles.commentText}>{comment.text}</Text>
          </View>
          <Text style={styles.commentTime}>{getTimeAgo(comment.repliedAt)}</Text>
        </View>

        {isOwnComment && (
          <View style={styles.commentActions}>
            <Text style={styles.ownCommentIndicator}>•</Text>
          </View>
        )}
      </View>
    );
  };

  const renderViewer = ({ item: viewer }) => {
    const user = viewer.user || viewer || {}; // Handle both viewer.user and direct viewer object
    const username = user.fullName || user.username || 'Unknown User';
    const userInitials = getInitials(username);
    const avatarColor = getAvatarColor(username);

    // Debug logging for viewer data structure
    console.log('🔍 Rendering viewer:', {
      viewerId: user._id,
      username: username,
      photoUrl: user.photoUrl,
      hasPhotoUrl: !!user.photoUrl,
      viewerStructure: viewer
    });

    return (
      <View style={styles.viewerItem}>
        <View style={styles.viewerAvatar}>
          <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
            {user.photoUrl ? (
              <Image 
                source={{ 
                  uri: user.photoUrl,
                  cache: 'force-cache'
                }} 
                style={styles.avatarImage}
                onError={(error) => {
                  console.log('❌ Viewer image load error:', user.photoUrl, error.nativeEvent?.error);
                }}
                onLoad={() => {
                  console.log('✅ Viewer image loaded successfully:', user.photoUrl);
                }}
                onLoadStart={() => {
                  console.log('🔄 Viewer image load started:', user.photoUrl);
                }}
              />
            ) : (
              <Text style={styles.avatarText}>{userInitials}</Text>
            )}
          </View>
        </View>

        <View style={styles.viewerInfo}>
          <View style={styles.viewerNameContainer}>
            <Text style={styles.viewerName}>{username}</Text>
            {user.isVerified && (
              <Ionicons name="checkmark-circle" size={16} color="#1DA1F2" style={styles.verifiedIcon} />
            )}
          </View>
          <Text style={styles.viewerTime}>{viewer.timeAgo || 'Recently'}</Text>
        </View>
      </View>
    );
  };

  const renderProgressBar = () => (
    <View style={styles.progressContainer}>
      {stories.map((_, index) => (
        <View key={index} style={styles.progressBarBackground}>
          <Animated.View
            style={[
              styles.progressBarFill,
              {
                width: index === currentStoryIndex
                  ? `${progress}%`
                  : index < currentStoryIndex
                    ? '100%'
                    : '0%'
              }
            ]}
          />
        </View>
      ))}
    </View>
  );

  const renderUserHeader = () => {
    const currentStory = stories[currentStoryIndex];
    
    return (
      <View style={styles.userHeader}>
        <View style={styles.userInfo}>
          <View style={[styles.userAvatarContainer, { backgroundColor: getAvatarColor(userName) }]}>
            {userAvatar ? (
              <Image 
                source={{ 
                  uri: userAvatar,
                  cache: 'force-cache'
                }} 
                style={styles.userAvatar}
                onError={(error) => {
                  console.log('❌ Story user avatar load error:', userAvatar, error.nativeEvent?.error);
                }}
                onLoad={() => {
                  console.log('✅ Story user avatar loaded successfully:', userAvatar);
                }}
              />
            ) : (
              <Text style={styles.avatarText}>{getInitials(userName)}</Text>
            )}
          </View>
          <Text style={styles.userName}>{userName || 'Unknown User'}</Text>
          <Text style={styles.storyTime}>{getTimeAgo(currentStory?.createdAt)}</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeButton}>
          <Ionicons name="close" size={28} color="white" />
        </TouchableOpacity>
      </View>
    );
  };

  const renderStoryContent = () => {
    const currentStory = stories[currentStoryIndex];
    if (!currentStory) return null;

    const validMediaUrl = getValidMediaUrl(currentStory.mediaUrl);
    if (!validMediaUrl || mediaError) {
      return (
        <View style={styles.errorContainer}>
          <Ionicons name="image-outline" size={80} color="#666" />
          <Text style={styles.errorText}>Media not available</Text>
        </View>
      );
    }

    if (currentStory.mediaType === 'video') {
      return (
        <Video
          ref={videoRef}
          source={{ uri: validMediaUrl }}
          style={styles.media}
          paused={paused}
          repeat={false}
          resizeMode="cover"
          onLoad={() => setLoading(false)}
          onLoadStart={() => setLoading(true)}
          onError={() => setMediaError(true)}
        />
      );
    }

    return (
      <Image
        source={{ uri: validMediaUrl }}
        style={styles.media}
        resizeMode="cover"
        onLoadStart={() => setLoading(true)}
        onLoad={() => setLoading(false)}
        onError={() => setMediaError(true)}
      />
    );
  };

  const handlePress = (event) => {
    if (showCommentModal || showViewersModal) return;
    const { locationX } = event.nativeEvent;
    if (locationX < width / 2) {
      handlePreviousStory();
    } else {
      handleNextStory();
    }
  };

  // =============================================
  // MAIN RENDER
  // =============================================

  if (!stories || stories.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>No stories available</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.overlay}
        onPress={handlePress}
        onLongPress={() => setPaused(true)}
        onPressOut={() => setPaused(false)}
        activeOpacity={1}
      >
        {renderStoryContent()}
        
        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="white" />
          </View>
        )}

        <View style={styles.topOverlay}>
          {renderProgressBar()}
          {renderUserHeader()}
        </View>

        {/* Views Indicator */}
        {isOwnStory && (
          <TouchableOpacity onPress={openViewersModal} style={styles.viewsIndicator}>
            <Ionicons name="eye" size={20} color="white" />
            <Text style={styles.viewsCount}>{viewsCount}</Text>
          </TouchableOpacity>
        )}

        {/* Bottom Actions */}
        <View style={styles.bottomActions}>
          <TouchableOpacity onPress={openCommentsModal} style={styles.actionButton}>
            <Ionicons name="chatbubble-outline" size={26} color="white" />
          </TouchableOpacity>

          <View style={styles.replyInputContainer}>
            <TextInput
              ref={inlineInputRef}
              style={styles.replyTextInput}
              placeholder="Send message"
              placeholderTextColor="rgba(255,255,255,0.6)"
              value={inlineReplyText}
              onChangeText={setInlineReplyText}
              returnKeyType="send"
              onSubmitEditing={addInlineReply}
              onFocus={() => setPaused(true)}
              onBlur={() => {
                setPaused(false);
                startStoryProgress();
              }}
            />
            {inlineReplyText.trim() && (
              <TouchableOpacity onPress={addInlineReply} style={styles.inlineSendButton}>
                {sendingInlineReply ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Ionicons name="send" size={18} color="white" />
                )}
              </TouchableOpacity>
            )}
          </View>

          {!isOwnStory && (
            <TouchableOpacity onPress={handleLikeStory} style={styles.actionButton}>
              {liking ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Ionicons
                  name={isLiked ? "heart" : "heart-outline"}
                  size={26}
                  color={isLiked ? "#ff3040" : "white"}
                />
              )}
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>

      {/* Comments Modal */}
      <Modal
        isVisible={showCommentModal}
        onBackdropPress={closeCommentsModal}
        onBackButtonPress={closeCommentsModal}
        onSwipeComplete={closeCommentsModal}
        swipeDirection={['down']}
        style={styles.modal}
        propagateSwipe={true}
        avoidKeyboard={true}
      >
        <View style={styles.modalContainer}>
          <KeyboardAvoidingView
            style={styles.keyboardContainer}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={closeCommentsModal}>
                <Ionicons name="close" size={24} color="white" />
              </TouchableOpacity>
              <Text style={styles.modalHeaderTitle}>Replies</Text>
              <View style={{ width: 24 }} />
            </View>

            <FlatList
              data={comments}
              renderItem={renderComment}
              keyExtractor={(item) => item._id}
              style={styles.commentsContainer}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={refreshingComments}
                  onRefresh={loadComments}
                  tintColor="#fff"
                />
              }
              ListEmptyComponent={
                loadingComments ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#1DA1F2" />
                  </View>
                ) : (
                  <View style={styles.emptyContainer}>
                    <Ionicons name="chatbubble-outline" size={50} color="#666" />
                    <Text style={styles.emptyText}>No replies yet</Text>
                  </View>
                )
              }
            
            />

            <View style={styles.inputContainer}>
              <View style={styles.currentUserAvatar}>
                {currentUser && (
                  <View style={[styles.avatar, { backgroundColor: getAvatarColor(currentUser.fullName || currentUser.username) }]}>
                    {currentUser.photoUrl ? (
                      <Image 
                        source={{ 
                          uri: currentUser.photoUrl,
                          cache: 'force-cache'
                        }} 
                        style={styles.avatarImage}
                        onError={(error) => {
                          console.log('❌ Current user avatar load error:', currentUser.photoUrl, error.nativeEvent?.error);
                        }}
                        onLoad={() => {
                          console.log('✅ Current user avatar loaded successfully:', currentUser.photoUrl);
                        }}
                      />
                    ) : (
                      <Text style={styles.avatarText}>
                        {getInitials(currentUser.fullName || currentUser.username)}
                      </Text>
                    )}
                  </View>
                )}
              </View>

              <View style={styles.inputWrapper}>
                <TextInput
                  ref={commentInputRef}
                  style={styles.textInput}
                  placeholder="Add a reply..."
                  placeholderTextColor="#666"
                  value={commentText}
                  onChangeText={setCommentText}
                  multiline
                  maxLength={MAX_COMMENT_LENGTH}
                />
                <Text style={styles.characterCount}>
                  {commentText.length}/{MAX_COMMENT_LENGTH}
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.sendButton, (!commentText.trim() || submittingComment) && styles.sendButtonDisabled]}
                onPress={addComment}
                disabled={!commentText.trim() || submittingComment}
              >
                {submittingComment ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="send" size={20} color="white" />
                )}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Views Modal */}
      <Modal
        isVisible={showViewersModal}
        onBackdropPress={closeViewersModal}
        onBackButtonPress={closeViewersModal}
        onSwipeComplete={closeViewersModal}
        swipeDirection={['down']}
        style={styles.modal}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={closeViewersModal}>
              <Ionicons name="close" size={24} color="white" />
            </TouchableOpacity>
            <Text style={styles.modalHeaderTitle}>{viewsCount} Views</Text>
            <View style={{ width: 24 }} />
          </View>

          <FlatList
            data={viewers}
            renderItem={renderViewer}
            keyExtractor={(item) => item._id}
            style={styles.viewersContainer}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              loadingViewers ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#1DA1F2" />
                </View>
              ) : (
                <View style={styles.emptyContainer}>
                  <Ionicons name="eye-outline" size={50} color="#666" />
                  <Text style={styles.emptyText}>No views yet</Text>
                </View>
              )
            }
          />
        </View>
      </Modal>
    </View>
  );
};

// =============================================
// STYLES
// =============================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  overlay: {
    flex: 1,
    position: 'relative',
  },
  media: {
    width: width,
    height: height,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: 'white',
    fontSize: 18,
    marginTop: 15,
  },
  
  // Top Section
  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 40,
    paddingHorizontal: 15,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  progressContainer: {
    flexDirection: 'row',
    marginBottom: 15,
    paddingHorizontal: 5,
  },
  progressBarBackground: {
    flex: 1,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginHorizontal: 1,
    borderRadius: 1.5,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: 'white',
    borderRadius: 1.5,
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  userAvatarContainer: {
    width: 35,
    height: 35,
    borderRadius: 17.5,
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userAvatar: {
    width: '100%',
    height: '100%',
    borderRadius: 17.5,
  },
  userName: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 10,
  },
  storyTime: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
  },
  closeButton: {
    padding: 5,
  },

  // Views Indicator
  viewsIndicator: {
    position: 'absolute',
    left: 16,
    bottom: 100,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewsCount: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },

  // Bottom Actions
  bottomActions: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingBottom: 35,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  actionButton: {
    padding: 8,
    minWidth: 50,
  },
  replyInputContainer: {
    flex: 1,
    marginHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 25,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  replyTextInput: {
    flex: 1,
    color: 'white',
    fontSize: 15,
    paddingRight: 8,
  },
  inlineSendButton: {
    padding: 6,
    borderRadius: 15,
    backgroundColor: '#1DA1F2',
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Modal Styles
  modal: {
    justifyContent: 'flex-end',
    margin: 0,
  },
  modalContainer: {
    backgroundColor: '#000',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    minHeight: '60%',
  },
  keyboardContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  modalHeaderTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },

  // Comments/Viewers Container
  commentsContainer: {
    flex: 1,
    paddingHorizontal: 15,
  },
  viewersContainer: {
    flex: 1,
    paddingHorizontal: 15,
  },
  loadingContainer: {
    paddingVertical: 50,
    alignItems: 'center',
  },
  emptyContainer: {
    paddingVertical: 50,
    alignItems: 'center',
  },
  emptyText: {
    color: '#666',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 15,
  },

  // Comment Item
  commentItem: {
    flexDirection: 'row',
    marginBottom: 15,
    paddingVertical: 5,
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
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
  },
  avatarText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
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

  // Viewer Item
  viewerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  viewerAvatar: {
    marginRight: 12,
  },
  viewerInfo: {
    flex: 1,
  },
  viewerNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  viewerName: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  viewerTime: {
    color: '#666',
    fontSize: 14,
  },

  // Input Container
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 15,
    paddingVertical: 10,
    paddingBottom: 45,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  currentUserAvatar: {
    marginRight: 10,
    marginBottom: 5,
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
    marginBottom: 5,
  },
  sendButtonDisabled: {
    backgroundColor: '#333',
  },
});

export default StoryViewer;