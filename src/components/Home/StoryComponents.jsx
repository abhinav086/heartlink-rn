import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Image,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet
} from 'react-native';
import Modal from 'react-native-modal';
import Ionicons from 'react-native-vector-icons/Ionicons';
import BASE_URL from '../../config/config';
import { useAuth } from '../../context/AuthContext';

// =============================================
// SIMPLE AVATAR PROCESSING - DIRECT API APPROACH
// =============================================

export const safeGet = (obj, property, fallback = '') => {
  try {
    return obj && obj[property] !== undefined ? obj[property] : fallback;
  } catch (error) {
    console.error('Error accessing property:', property, error);
    return fallback;
  }
};

// SIMPLE - ONLY FOCUS ON photoUrl FROM YOUR API
export const getAvatarSource = (user) => {
  console.log('🚀 SIMPLE Avatar Debug - Raw user:', user);
  console.log('🚀 User keys:', user ? Object.keys(user) : 'NO USER');
  console.log('🚀 photoUrl value:', user?.photoUrl);
  console.log('🚀 photoUrl type:', typeof user?.photoUrl);
  
  // Direct check for photoUrl from your API response
  if (user && user.photoUrl && typeof user.photoUrl === 'string') {
    const cleanUrl = user.photoUrl.trim(); // Simple whitespace fix
    
    console.log('🚀 Raw photoUrl:', `"${user.photoUrl}"`);
    console.log('🚀 Cleaned photoUrl:', `"${cleanUrl}"`);
    
    if (cleanUrl && cleanUrl.length > 0) {
      console.log('✅ USING PHOTO URL:', cleanUrl);
      return { uri: cleanUrl };
    }
  }
  
  console.log('❌ No photoUrl found, using initials');
  return null;
};

export const getInitials = (name) => {
  if (!name || typeof name !== 'string' || name === 'Unknown User') return '?';
  const names = name.trim().split(' ');
  if (names.length === 1) {
    return names[0].charAt(0).toUpperCase();
  }
  return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase();
};

export const getAvatarColor = (name) => {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
    '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
  ];

  if (!name || typeof name !== 'string') return colors[0];
  const charCodeSum = name.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return colors[charCodeSum % colors.length];
};

export const getTimeAgo = (createdAt) => {
  if (!createdAt) return '';

  const now = new Date();
  const storyTime = new Date(createdAt);
  const diffInMs = now - storyTime;
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60));

  if (diffInMinutes < 1) {
    return 'now';
  } else if (diffInHours < 1) {
    return `${diffInMinutes}m`;
  } else if (diffInHours < 24) {
    return `${diffInHours}h`;
  } else {
    return `${Math.floor(diffInHours / 24)}d`;
  }
};

export const getValidMediaUrl = (mediaUrl) => {
  if (!mediaUrl || typeof mediaUrl !== 'string') return null;

  const trimmedUrl = mediaUrl.trim();
  if (trimmedUrl === '') return null;

  if (trimmedUrl.startsWith('http')) {
    return trimmedUrl;
  } else if (trimmedUrl.startsWith('/')) {
    return `${BASE_URL}${trimmedUrl}`;
  } else {
    return trimmedUrl;
  }
};

// =============================================
// AUTH HEADER UTILITY
// =============================================

export const useAuthHeaders = () => {
  const { token } = useAuth();

  const getAuthHeaders = async () => {
    if (!token) {
      throw new Error('No authentication token available');
    }

    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
  };

  return { getAuthHeaders };
};

// =============================================
// API FUNCTIONS - USING YOUR EXACT ENDPOINT
// =============================================

export const loadStoryReplies = async (storyId, authHeaders) => {
  console.log('📡 Loading replies for story:', storyId);
  console.log('📡 Using endpoint: http://localhost:8000/api/v1/stories/' + storyId + '/replies');
  
  try {
    const response = await fetch(`http://localhost:8000/api/v1/stories/${storyId}/replies`, {
      method: 'GET',
      headers: authHeaders,
    });

    console.log('📡 Response status:', response.status);

    if (response.ok) {
      const result = await response.json();
      
      console.log('📥 FULL API RESPONSE:', JSON.stringify(result, null, 2));
      
      if (result.success && result.data) {
        const replies = result.data.replies || [];
        
        console.log('💬 Total replies:', replies.length);
        
        // LOG EACH REPLY TO SEE EXACT STRUCTURE
        replies.forEach((reply, index) => {
          console.log(`💬 REPLY ${index + 1}:`, {
            id: reply._id,
            text: reply.text,
            user: reply.user,
            hasPhotoUrl: !!reply.user?.photoUrl,
            photoUrl: reply.user?.photoUrl
          });
        });
        
        return {
          success: true,
          replies: replies,
          totalReplies: result.data.totalReplies || replies.length
        };
      }
    } else {
      console.error('❌ API Error:', response.status, response.statusText);
      return { success: false, error: 'Failed to load replies' };
    }
  } catch (error) {
    console.error('❌ Network Error:', error);
    return { success: false, error: error.message };
  }
};

// =============================================
// VIEWS INDICATOR COMPONENT
// =============================================

export const ViewsIndicator = ({
  isOwnStory,
  viewsCount,
  openViewersModal
}) => {
  if (!isOwnStory) return null;

  return (
    <TouchableOpacity
      style={componentStyles.viewsIndicator}
      onPress={openViewersModal}
      activeOpacity={0.8}
    >
      <View style={componentStyles.viewsIconContainer}>
        <Ionicons name="eye" size={20} color="white" />
        <Text style={componentStyles.viewsCount}>{viewsCount || 0}</Text>
      </View>
    </TouchableOpacity>
  );
};

// =============================================
// BOTTOM ACTIONS COMPONENT
// =============================================

export const BottomActions = ({
  isOwnStory,
  openCommentsModal,
  inlineReplyText,
  setInlineReplyText,
  addInlineReply,
  sendingInlineReply,
  handleLikeStory,
  liking,
  isLiked,
  inlineInputRef,
  setPaused,
  startStoryProgress,
  MAX_COMMENT_LENGTH
}) => {
  if (isOwnStory) return null;

  return (
    <View style={componentStyles.bottomActions}>
      <TouchableOpacity
        style={componentStyles.actionButton}
        onPress={openCommentsModal}
        activeOpacity={0.7}
      >
        <Ionicons name="chatbubble-outline" size={26} color="white" />
      </TouchableOpacity>

      <View style={componentStyles.replyInputContainer}>
        <TextInput
          ref={inlineInputRef}
          style={componentStyles.replyTextInput}
          placeholder="Send message"
          placeholderTextColor="rgba(255,255,255,0.6)"
          value={inlineReplyText}
          onChangeText={setInlineReplyText}
          returnKeyType="send"
          onSubmitEditing={addInlineReply}
          editable={!sendingInlineReply}
          maxLength={MAX_COMMENT_LENGTH}
          onFocus={() => setPaused(true)}
          onBlur={() => {
            setPaused(false);
            startStoryProgress();
          }}
        />
        {inlineReplyText.trim() && (
          <TouchableOpacity
            style={componentStyles.inlineSendButton}
            onPress={addInlineReply}
            disabled={sendingInlineReply}
          >
            {sendingInlineReply ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Ionicons name="send" size={18} color="white" />
            )}
          </TouchableOpacity>
        )}
      </View>

      <TouchableOpacity
        style={componentStyles.actionButton}
        onPress={handleLikeStory}
        disabled={liking}
        activeOpacity={0.7}
      >
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
    </View>
  );
};

// =============================================
// ENHANCED COMMENTS MODAL WITH DIRECT API INTEGRATION
// =============================================

export const CommentsModal = ({
  showCommentModal,
  closeCommentsModal,
  storyId, // Pass storyId directly
  commentText,
  setCommentText,
  commentInputRef,
  commentScrollRef,
  MAX_COMMENT_LENGTH
}) => {
  const { user: currentUser } = useAuth();
  const { getAuthHeaders } = useAuthHeaders();

  // Local state for comments
  const [comments, setComments] = React.useState([]);
  const [loadingComments, setLoadingComments] = React.useState(false);
  const [refreshingComments, setRefreshingComments] = React.useState(false);
  const [submittingComment, setSubmittingComment] = React.useState(false);

  // Load comments when modal opens
  React.useEffect(() => {
    if (showCommentModal && storyId) {
      loadComments();
    }
  }, [showCommentModal, storyId]);

  const loadComments = async () => {
    if (!storyId) return;
    
    try {
      setLoadingComments(true);
      const headers = await getAuthHeaders();
      
      console.log('🔄 Loading comments from API...');
      const result = await loadStoryReplies(storyId, headers);
      
      if (result.success) {
        console.log('✅ Comments loaded successfully:', result.replies.length);
        setComments(result.replies); // Use API data DIRECTLY
      } else {
        console.error('❌ Failed to load comments:', result.error);
      }
    } catch (error) {
      console.error('❌ Error loading comments:', error);
    } finally {
      setLoadingComments(false);
      setRefreshingComments(false);
    }
  };

  const onRefreshComments = () => {
    setRefreshingComments(true);
    loadComments();
  };

  const addComment = async () => {
    const trimmedComment = commentText.trim();
    if (!trimmedComment || trimmedComment.length > MAX_COMMENT_LENGTH || !storyId || !currentUser) {
      return;
    }

    try {
      setSubmittingComment(true);
      const headers = await getAuthHeaders();
      
      const response = await fetch(`http://localhost:8000/api/v1/stories/${storyId}/reply`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ text: trimmedComment }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Comment added successfully');
        
        // Add new comment to local state immediately
        const newComment = {
          _id: Date.now().toString(),
          text: trimmedComment,
          user: {
            _id: currentUser._id,
            username: currentUser.username || currentUser.fullName,
            fullName: currentUser.fullName || currentUser.username,
            photoUrl: currentUser.photoUrl, // Make sure this exists
          },
          repliedAt: new Date().toISOString(),
          isOwn: true,
        };
        
        console.log('➕ Adding new comment:', newComment);
        setComments(prev => [newComment, ...prev]);
        setCommentText('');
        
        // Scroll to top to show new comment
        setTimeout(() => {
          if (commentScrollRef.current) {
            commentScrollRef.current.scrollTo({ y: 0, animated: true });
          }
        }, 100);
      } else {
        const errorData = await response.json();
        console.error('❌ Failed to add comment:', errorData);
      }
    } catch (error) {
      console.error('❌ Error adding comment:', error);
    } finally {
      setSubmittingComment(false);
    }
  };

  // SIMPLE comment renderer - DIRECT FROM API
  const renderComment = (comment, index) => {
    console.log('=== COMMENT RENDER DEBUG ===');
    console.log('Comment index:', index);
    console.log('Full comment:', comment);
    console.log('Comment user:', comment.user);
    console.log('User photoUrl:', comment.user?.photoUrl);
    
    const user = comment.user;
    const username = user?.fullName || user?.username || 'Unknown User';
    
    // DIRECT avatar check using your API data
    const avatarSource = getAvatarSource(user);
    const hasAvatar = avatarSource && avatarSource.uri;
    
    console.log('Avatar decision:', {
      hasAvatar,
      avatarSource,
      willShowImage: hasAvatar
    });

    const isVerified = user?.isVerified || false;
    const timeAgo = getTimeAgo(comment.repliedAt);

    // Check if this is the current user's comment
    const isOwnComment = comment.isOwn || (currentUser && user?._id === currentUser._id);

    return (
      <View key={comment._id || index} style={componentStyles.commentItem}>
        <View style={componentStyles.commentAvatar}>
          <View style={[componentStyles.avatar, { backgroundColor: getAvatarColor(username) }]}>
            {hasAvatar ? (
              <Image
                source={avatarSource}
                style={componentStyles.profileImage}
                onLoad={() => {
                  console.log('✅ COMMENT IMAGE LOADED:', avatarSource.uri);
                }}
                onError={(error) => {
                  console.error('❌ COMMENT IMAGE ERROR:', {
                    error: error?.nativeEvent?.error,
                    url: avatarSource.uri,
                    username
                  });
                }}
              />
            ) : (
              <Text style={componentStyles.avatarText}>
                {getInitials(username)}
              </Text>
            )}
          </View>
        </View>

        <View style={componentStyles.commentContent}>
          <View style={componentStyles.commentBubble}>
            <View style={componentStyles.commentHeader}>
              <Text style={componentStyles.commentUsername}>{username}</Text>
              {isVerified && (
                <Ionicons name="checkmark-circle" size={14} color="#1DA1F2" style={componentStyles.verifiedIcon} />
              )}
            </View>
            <Text style={componentStyles.commentText}>{comment.text}</Text>
          </View>
          {timeAgo && (
            <Text style={componentStyles.commentTime}>{timeAgo}</Text>
          )}
        </View>

        {isOwnComment && (
          <View style={componentStyles.commentActions}>
            <Text style={componentStyles.ownCommentIndicator}>•</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <Modal
      isVisible={showCommentModal}
      onBackdropPress={closeCommentsModal}
      onBackButtonPress={closeCommentsModal}
      onSwipeComplete={closeCommentsModal}
      swipeDirection={['down']}
      style={componentStyles.modal}
      propagateSwipe={true}
      avoidKeyboard={true}
      useNativeDriverForBackdrop={true}
      animationIn="slideInUp"
      animationOut="slideOutDown"
      animationInTiming={300}
      animationOutTiming={300}
    >
      <View style={componentStyles.modalContainer}>
        <KeyboardAvoidingView
          style={componentStyles.keyboardContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={componentStyles.modalHeader}>
            <TouchableOpacity onPress={closeCommentsModal} style={componentStyles.modalCloseButton}>
              <Ionicons name="close" size={24} color="white" />
            </TouchableOpacity>
            <Text style={componentStyles.modalHeaderTitle}>
              Replies ({comments.length})
            </Text>
            <View style={componentStyles.modalHeaderRight} />
          </View>

          <ScrollView
            ref={commentScrollRef}
            style={componentStyles.commentsContainer}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshingComments}
                onRefresh={onRefreshComments}
                tintColor="#fff"
              />
            }
          >
            {loadingComments ? (
              <View style={componentStyles.loadingContainer}>
                <ActivityIndicator size="large" color="#1DA1F2" />
                <Text style={componentStyles.loadingText}>Loading replies...</Text>
              </View>
            ) : comments.length === 0 ? (
              <View style={componentStyles.emptyContainer}>
                <Ionicons name="chatbubble-outline" size={50} color="#666" />
                <Text style={componentStyles.emptyText}>No replies yet</Text>
                <Text style={componentStyles.emptySubtext}>Be the first to reply!</Text>
              </View>
            ) : (
              <View style={componentStyles.commentsList}>
                {comments.map((comment, index) => {
                  return renderComment(comment, index);
                })}
              </View>
            )}
          </ScrollView>

          <View style={componentStyles.inputContainer}>
            <View style={componentStyles.currentUserAvatar}>
              {currentUser && (
                <View style={[componentStyles.avatar, { backgroundColor: getAvatarColor(currentUser.fullName || currentUser.username || 'U') }]}>
                  {(() => {
                    console.log('=== CURRENT USER AVATAR DEBUG ===');
                    console.log('Current user:', currentUser);
                    console.log('Current user photoUrl:', currentUser.photoUrl);

                    const avatarSource = getAvatarSource(currentUser);
                    const hasCurrentUserAvatar = avatarSource && avatarSource.uri;

                    console.log('Current user avatar result:', {
                      avatarSource,
                      hasCurrentUserAvatar
                    });

                    if (hasCurrentUserAvatar) {
                      return (
                        <Image
                          source={avatarSource}
                          style={componentStyles.profileImage}
                          onError={(error) => {
                            console.error('❌ Current user avatar error:', {
                              uri: avatarSource.uri,
                              error: error?.nativeEvent?.error
                            });
                          }}
                          onLoad={() => {
                            console.log('✅ Current user avatar loaded:', avatarSource.uri);
                          }}
                        />
                      );
                    } else {
                      const initials = getInitials(currentUser.fullName || currentUser.username || 'U');
                      return (
                        <Text style={componentStyles.avatarText}>
                          {initials}
                        </Text>
                      );
                    }
                  })()}
                </View>
              )}
            </View>

            <View style={componentStyles.inputWrapper}>
              <TextInput
                ref={commentInputRef}
                style={componentStyles.textInput}
                placeholder={`Reply as ${currentUser?.fullName || currentUser?.username || 'User'}...`}
                placeholderTextColor="#666"
                value={commentText}
                onChangeText={setCommentText}
                multiline
                maxLength={MAX_COMMENT_LENGTH}
                returnKeyType="send"
                onSubmitEditing={addComment}
                editable={!submittingComment}
              />
              <Text style={componentStyles.characterCount}>
                {commentText.length}/{MAX_COMMENT_LENGTH}
              </Text>
            </View>

            <TouchableOpacity
              style={[
                componentStyles.sendButton,
                (!commentText.trim() || submittingComment) && componentStyles.sendButtonDisabled
              ]}
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
  );
};

// =============================================
// VIEWS MODAL COMPONENT
// =============================================

export const ViewsModal = ({
  showViewersModal,
  closeViewersModal,
  viewsCount,
  viewers,
  loadingViewers,
  refreshingViewers,
  onRefreshViewers,
  loadMoreViewers,
  loadingMoreViewers
}) => {
  const renderViewerItem = ({ item }) => {
    const user = item.user || {};
    const username = safeGet(user, 'fullName', safeGet(user, 'username', 'Unknown User'));

    const avatarSource = getAvatarSource(user);
    const userInitials = getInitials(username);
    const avatarColor = getAvatarColor(username);
    const isVerified = safeGet(user, 'isVerified', false);
    const hasViewerAvatar = avatarSource && avatarSource.uri;

    return (
      <View style={componentStyles.viewerItem}>
        <View style={componentStyles.viewerAvatar}>
          <View style={[componentStyles.avatar, { backgroundColor: avatarColor }]}>
            {hasViewerAvatar ? (
              <Image
                source={avatarSource}
                style={componentStyles.profileImage}
                onError={(error) => {
                  console.error('❌ Viewer avatar error:', {
                    username,
                    uri: avatarSource.uri,
                    error: error?.nativeEvent?.error
                  });
                }}
                onLoad={() => {
                  console.log('✅ Viewer avatar loaded:', {
                    username,
                    uri: avatarSource.uri
                  });
                }}
              />
            ) : (
              <Text style={componentStyles.avatarText}>{userInitials}</Text>
            )}
          </View>
        </View>

        <View style={componentStyles.viewerInfo}>
          <View style={componentStyles.viewerNameContainer}>
            <Text style={componentStyles.viewerName}>{username}</Text>
            {isVerified && (
              <Ionicons name="checkmark-circle" size={16} color="#1DA1F2" style={componentStyles.verifiedIcon} />
            )}
          </View>
          <Text style={componentStyles.viewerTime}>{item.timeAgo || 'Recently'}</Text>
        </View>

        <View style={componentStyles.viewerStats}>
          <Text style={componentStyles.viewDuration}>
            {item.viewDuration ? `${Math.round(item.viewDuration / 1000)}s` : ''}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <Modal
      isVisible={showViewersModal}
      onBackdropPress={closeViewersModal}
      onBackButtonPress={closeViewersModal}
      onSwipeComplete={closeViewersModal}
      swipeDirection={['down']}
      style={componentStyles.modal}
      propagateSwipe={true}
      useNativeDriverForBackdrop={true}
      animationIn="slideInUp"
      animationOut="slideOutDown"
      animationInTiming={300}
      animationOutTiming={300}
    >
      <View style={componentStyles.modalContainer}>
        <View style={componentStyles.modalHeader}>
          <TouchableOpacity onPress={closeViewersModal} style={componentStyles.modalCloseButton}>
            <Ionicons name="close" size={24} color="white" />
          </TouchableOpacity>
          <Text style={componentStyles.modalHeaderTitle}>
            {viewsCount} {viewsCount === 1 ? 'View' : 'Views'}
          </Text>
          <View style={componentStyles.modalHeaderRight} />
        </View>

        <FlatList
          data={viewers}
          renderItem={renderViewerItem}
          keyExtractor={(item, index) => item._id || index.toString()}
          style={componentStyles.viewersContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshingViewers}
              onRefresh={onRefreshViewers}
              tintColor="#fff"
            />
          }
          onEndReached={loadMoreViewers}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={() => (
            loadingViewers ? (
              <View style={componentStyles.loadingContainer}>
                <ActivityIndicator size="large" color="#1DA1F2" />
                <Text style={componentStyles.loadingText}>Loading viewers...</Text>
              </View>
            ) : (
              <View style={componentStyles.emptyContainer}>
                <Ionicons name="eye-outline" size={50} color="#666" />
                <Text style={componentStyles.emptyText}>No views yet</Text>
                <Text style={componentStyles.emptySubtext}>Share your story to get views!</Text>
              </View>
            )
          )}
          ListFooterComponent={() => (
            loadingMoreViewers && viewers.length > 0 ? (
              <View style={componentStyles.loadingMoreContainer}>
                <ActivityIndicator size="small" color="#1DA1F2" />
                <Text style={componentStyles.loadingMoreText}>Loading more...</Text>
              </View>
            ) : null
          )}
        />
      </View>
    </Modal>
  );
};

// =============================================
// TESTING FUNCTION
// =============================================

export const testAvatarProcessing = (testUser) => {
  console.log('🧪 Testing avatar processing with user:', testUser);
  const result = getAvatarSource(testUser);
  console.log('🧪 Test result:', result);
  return result;
};

// TEST WITH YOUR EXACT API DATA
export const runAPITest = () => {
  console.log('🚨 RUNNING API TEST:');
  
  // Your exact API user object
  const testUser = {
    "_id": "6895ef844b102e8290d70e8e",
    "username": "abhi06",
    "photoUrl": "https://finalheartlink.s3.ap-south-1.amazonaws.com/profile-photos/1755949918151_hd75w.jpg",
    "fullName": "abhi"
  };
  
  console.log('🧪 TESTING WITH YOUR API DATA:');
  const result = getAvatarSource(testUser);
  console.log('🧪 Result:', result);
  
  // Should output: ✅ USING PHOTO URL: https://finalheartlink.s3.ap-south-1.amazonaws.com/profile-photos/1755949918151_hd75w.jpg
  
  return result;
};

// Call immediately to test
runAPITest();

// =============================================
// COMPONENT STYLES
// =============================================

const componentStyles = StyleSheet.create({
  // Views Indicator Styles
  viewsIndicator: {
    position: 'absolute',
    left: 16,
    bottom: 50,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  viewsIconContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewsCount: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },

  // Bottom Actions Styles
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
    marginBottom: 5,
    backgroundColor: '#000000',
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  actionButton: {
    alignItems: 'center',
    justifyContent: 'center',
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
    minHeight: 44,
  },
  replyTextInput: {
    flex: 1,
    color: 'white',
    fontSize: 15,
    paddingRight: 8,
    fontWeight: '400',
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

  // Modal Styles (shared between comments and views)
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
    flex: 1,
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
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  modalCloseButton: {
    padding: 5,
  },
  modalHeaderTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  modalHeaderRight: {
    width: 34,
  },

  // Comments Modal Styles
  commentsContainer: {
    flex: 1,
    paddingHorizontal: 15,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
  },
  loadingText: {
    color: 'white',
    fontSize: 16,
    marginTop: 10,
    fontWeight: '500',
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
  profileImage: {
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
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 15,
    paddingVertical: 10,
    paddingBottom: 45,
    marginBottom: 10,
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

  // Views Modal Styles
  viewersContainer: {
    flex: 1,
    paddingHorizontal: 15,
  },
  viewerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 5,
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
  viewerStats: {
    alignItems: 'flex-end',
  },
  viewDuration: {
    color: '#888',
    fontSize: 12,
    fontStyle: 'italic',
  },
  loadingMoreContainer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  loadingMoreText: {
    color: '#666',
    fontSize: 14,
    marginTop: 5,
  },
});