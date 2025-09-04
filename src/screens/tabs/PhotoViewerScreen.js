import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  StatusBar,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  ScrollView,
  Modal, // Keep standard Modal
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Keyboard, // Added Keyboard import
  PanResponder, // Import PanResponder for zoom
  TouchableWithoutFeedback // ✅ NEW: Added for double tap detection
} from 'react-native';
import Video from 'react-native-video';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useAuth } from '../../context/AuthContext'; // Ensure path is correct
import BASE_URL from '../../config/config'; // Ensure path is correct
const { width, height } = Dimensions.get('window');
const imageWidth = width - 20; // Account for container padding
const imageHeight = 500; // Define image height for zoom calculations
// --- NEW: Define EditCaptionModal as a separate component ---
const EditCaptionModal = ({ isVisible, initialCaption, onSave, onClose, isUpdating, editingItem }) => {
  // Local state for the TextInput within the Modal
  const [textInputValue, setTextInputValue] = useState(initialCaption || '');
  const textInputRef = useRef(null);
  // Ensure TextInput value updates if initialCaption changes (e.g., different post)
  useEffect(() => {
     if (isVisible) {
        setTextInputValue(initialCaption || '');
     }
  }, [isVisible, initialCaption]);
  const handleSave = () => {
    // Call the parent's save function with the current text input value
    onSave(textInputValue);
  };
  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      onRequestClose={onClose}
      onShow={() => {
        setTimeout(() => {
          if (textInputRef.current) {
            textInputRef.current.focus();
          }
        }, 100);
      }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.editModalFullscreen}
        keyboardVerticalOffset={0}
      >
        <View style={styles.editModalContentFixed}>
          <View style={styles.editModalHeaderFixed}>
            <TouchableOpacity onPress={onClose} style={styles.editModalBackButton}>
              <Ionicons name="arrow-back" size={24} color="white" />
            </TouchableOpacity>
            <Text style={styles.editModalTitleFixed}>Edit Caption</Text>
            <TouchableOpacity
              onPress={handleSave}
              style={styles.editModalSaveHeaderButton}
              disabled={isUpdating || textInputValue.trim() === (initialCaption || '')} // Use local value and initial caption
            >
              {isUpdating ? ( // Use prop for updating state
                <ActivityIndicator size="small" color="#ed167e" />
              ) : (
                <Text style={styles.editModalSaveHeaderText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>
          <View style={styles.editModalBodyFixed}>
            <TextInput
              ref={textInputRef}
              style={styles.captionInputFixed}
              value={textInputValue} // Use local state
              onChangeText={setTextInputValue} // Update local state
              placeholder="Write a caption..."
              placeholderTextColor="#aaaaaa"
              multiline
              textAlignVertical="top"
              autoFocus={false}
              blurOnSubmit={false}
              returnKeyType="default"
              scrollEnabled={true}
              autoCorrect={true}
              autoCapitalize="sentences"
              keyboardType="default"
                enablesReturnKeyAutomatically={false}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};
// --- END: New EditCaptionModal Component ---
const PhotoViewerScreen = ({ navigation, route }) => {
  const { posts, initialIndex = 0, username } = route.params;
  // ✅ FIX: Destructure refreshToken and isAuthenticated from context
  const { token, user, refreshToken, isAuthenticated } = useAuth();
  const [currentPosts, setCurrentPosts] = useState(posts || []);
  const [loading, setLoading] = useState(false);
  const flatListRef = useRef(null);
  // --- Modified State for Edit Caption Functionality ---
  const [editingItem, setEditingItem] = useState(null);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [updatingCaption, setUpdatingCaption] = useState(false);
  const [menuVisible, setMenuVisible] = useState({});
  useEffect(() => {
    // Scroll to initial post
    if (initialIndex > 0 && flatListRef.current) {
      setTimeout(() => {
        flatListRef.current.scrollToIndex({
          index: initialIndex,
          animated: false,
        });
      }, 100);
    }
  }, [initialIndex]);
  // --- New: Menu Visibility Functions ---
  const showMenu = (itemId) => {
    setMenuVisible(prev => ({ ...prev, [itemId]: true }));
  };
  const hideMenu = (itemId) => {
    setMenuVisible(prev => ({ ...prev, [itemId]: false }));
  };
  // --- NEW: Updated closeEditModal function ---
  const closeEditModal = () => {
    // Dismiss keyboard first
    Keyboard.dismiss();
    // Small delay to ensure keyboard dismissal completes
    setTimeout(() => {
      setIsEditModalVisible(false);
      setEditingItem(null);
      setUpdatingCaption(false);
    }, 50); // Reduced delay
  };
  // --- New: Update Caption API Function ---
  const updatePostCaption = async (postId, newCaption) => {
    try {
      const response = await fetch(`${BASE_URL}/api/v1/posts/${postId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: newCaption }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to update post caption (Status: ${response.status})`);
      }
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message || 'Failed to update post caption');
      }
      return data;
    } catch (error) {
      console.error('Error updating post caption:', error);
      throw error;
    }
  };
  // --- New: Handle Edit Post ---
  const handleEditPost = (item) => {
    // Check if user owns the post
    if (item.author?._id !== user?._id && item.user?._id !== user?._id) {
      Alert.alert('Permission Denied', 'You can only edit your own posts.');
      return;
    }
    // Hide the menu first
    hideMenu(item._id);
    // Set the item to edit and initialize caption
    setEditingItem(item);
    // Show modal
    setIsEditModalVisible(true);
  };
  // --- Modified: Execute Caption Update (accepts caption as argument) ---
  const executeCaptionUpdate = async (newCaptionText) => { // <-- Accept argument
    if (!editingItem) return;
    setUpdatingCaption(true);
    try {
      // Use the caption passed from the modal
      const trimmedCaption = newCaptionText.trim(); // <-- Use argument
      await updatePostCaption(editingItem._id, trimmedCaption);
      // Update local state to reflect the new caption
      setCurrentPosts(prev => prev.map(p =>
        p._id === editingItem._id
          ? { ...p, content: trimmedCaption, caption: trimmedCaption }
          : p
      ));
      // Close modal and show success
      closeEditModal();
      setTimeout(() => {
        Alert.alert('Success', 'Caption updated successfully');
      }, 200);
    } catch (error) {
      console.error('Error updating post caption:', error);
      Alert.alert('Error', error.message || 'Failed to update caption');
    } finally {
      setUpdatingCaption(false);
    }
  };
  // Safe property access following Post.js pattern
  const safeGet = (obj, property, fallback = '') => {
    try {
      return obj && obj[property] !== undefined ? obj[property] : fallback;
    } catch (error) {
      console.error('Error accessing property:', property, error);
      return fallback;
    }
  };
  const handleLike = async (postId, currentlyLiked) => {
    try {
      const response = await fetch(
        `${BASE_URL}/api/v1/posts/${postId}/like`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      const data = await response.json();
      if (response.ok) {
        // Update the post in local state
        setCurrentPosts(prevPosts =>
          prevPosts.map(post =>
            post._id === postId
              ? {
                  ...post,
                  isLikedByUser: !currentlyLiked,
                  // ✅ FIX: Use more robust like count update logic
                  likeCount: data.data?.likeCount !== undefined ? data.data.likeCount : (currentlyLiked ? (post.likeCount || 1) - 1 : (post.likeCount || 0) + 1),
                }
              : post
          )
        );
        return {
          success: true,
          data: data.data // Pass back the full data object
        };
      } else {
        Alert.alert('Error', data.message || 'Failed to update like');
        return { success: false };
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      Alert.alert('Error', 'Failed to update like');
      return { success: false };
    }
  };
  const handleBack = () => {
    navigation.goBack();
  };
  const getInitials = (fullName) => {
    if (!fullName) return '?';
    const names = fullName.trim().split(' ');
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
    if (!name) return colors[0];
    const charCodeSum = name.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
    return colors[charCodeSum % colors.length];
  };
  const formatTimeAgo = (dateString) => {
    const now = new Date();
    const postDate = new Date(dateString);
    const diffInSeconds = Math.floor((now - postDate) / 1000);
    if (diffInSeconds < 60) return 'now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d`;
    return `${Math.floor(diffInSeconds / 604800)}w`;
  };
  // URL sanitization function from Post.js
  const sanitizeImageUrl = (url) => {
    if (!url || typeof url !== 'string') {
      return null;
    }
    // Remove any double protocols
    let cleanUrl = url.replace(/^https?:\/\/https?:\/\//, 'https://');
    // Ensure single protocol
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = 'https://' + cleanUrl;
    }
    console.log('🖼️ URL sanitized:', { original: url, cleaned: cleanUrl });
    return cleanUrl;
  };

  // --- NEW: Helper function to create a PanResponder for zooming ---
  const createZoomPanResponder = (zoomScale, zoomTranslateX, zoomTranslateY, setIsZoomed, setIsZooming) => {
    let initialDistance = 0;
    let initialScale = 1;
    let lastScale = 1;
    let lastTranslateX = 0;
    let lastTranslateY = 0;
    let lastTapTime = 0;
    let tapCount = 0;
    let pinchFocalX = 0;
    let pinchFocalY = 0;
    let initialTranslateX = 0;
    let initialTranslateY = 0;
    const getDistance = (touches) => {
      if (touches.length < 2) return 0;
      const [touch1, touch2] = touches;
      const dx = touch1.pageX - touch2.pageX;
      const dy = touch1.pageY - touch2.pageY;
      return Math.sqrt(dx * dx + dy * dy);
    };
    const getCenter = (touches) => {
      if (touches.length < 2) return { x: imageWidth / 2, y: imageHeight / 2 }; // Use defined height
      const [touch1, touch2] = touches;
      const centerX = (touch1.locationX + touch2.locationX) / 2;
      const centerY = (touch1.locationY + touch2.locationY) / 2;
      return { x: centerX, y: centerY };
    };
    const getBounds = (scale) => {
      const scaledWidth = imageWidth * scale;
      const scaledHeight = imageHeight * scale; // Use defined height
      const maxTranslateX = Math.max(0, (scaledWidth - imageWidth) / 2);
      const maxTranslateY = Math.max(0, (scaledHeight - imageHeight) / 2); // Use defined height
      return { maxTranslateX, maxTranslateY };
    };
    const clampTranslate = (translateX, translateY, scale) => {
      const { maxTranslateX, maxTranslateY } = getBounds(scale);
      return {
        x: Math.max(-maxTranslateX, Math.min(maxTranslateX, translateX)),
        y: Math.max(-maxTranslateY, Math.min(maxTranslateY, translateY)),
      };
    };
    const resetZoom = () => {
        Animated.parallel([
          Animated.timing(zoomScale, { toValue: 1, duration: 300, easing: Easing.out(Easing.quad), useNativeDriver: true, }),
          Animated.timing(zoomTranslateX, { toValue: 0, duration: 300, easing: Easing.out(Easing.quad), useNativeDriver: true, }),
          Animated.timing(zoomTranslateY, { toValue: 0, duration: 300, easing: Easing.out(Easing.quad), useNativeDriver: true, }),
        ]).start(() => {
          setIsZoomed(false);
          setIsZooming(false);
        });
      };
    const zoomToPoint = (scale, x = 0, y = 0) => {
        setIsZooming(true);
        Animated.parallel([
          Animated.timing(zoomScale, { toValue: scale, duration: 300, easing: Easing.out(Easing.quad), useNativeDriver: true, }),
          Animated.timing(zoomTranslateX, { toValue: x, duration: 300, easing: Easing.out(Easing.quad), useNativeDriver: true, }),
          Animated.timing(zoomTranslateY, { toValue: y, duration: 300, easing: Easing.out(Easing.quad), useNativeDriver: true, }),
        ]).start(() => {
          setIsZoomed(scale > 1);
          setIsZooming(false);
        });
      };
    return PanResponder.create({
      onStartShouldSetPanResponder: (evt) => {
        return evt.nativeEvent.touches.length >= 2 || zoomScale._value > 1; // Check scale value
      },
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        return evt.nativeEvent.touches.length >= 2 ||
               (zoomScale._value > 1 && (Math.abs(gestureState.dx) > 10 || Math.abs(gestureState.dy) > 10)); // Check scale value
      },
      onPanResponderGrant: (evt) => {
        const touches = evt.nativeEvent.touches;
        if (touches.length >= 2) {
          initialDistance = getDistance(touches);
          initialScale = lastScale;
          const focalPoint = getCenter(touches);
          pinchFocalX = focalPoint.x;
          pinchFocalY = focalPoint.y;
          initialTranslateX = lastTranslateX;
          initialTranslateY = lastTranslateY;
          zoomScale.setOffset(lastScale - 1);
          zoomScale.setValue(1);
          zoomTranslateX.setOffset(lastTranslateX);
          zoomTranslateX.setValue(0);
          zoomTranslateY.setOffset(lastTranslateY);
          zoomTranslateY.setValue(0);
        } else if (touches.length === 1) {
          const now = Date.now();
          const timeDiff = now - lastTapTime;
          if (timeDiff < 300) {
            tapCount += 1;
          } else {
            tapCount = 1;
          }
          lastTapTime = now;
          if (zoomScale._value > 1) { // Check scale value
            zoomTranslateX.setOffset(lastTranslateX);
            zoomTranslateX.setValue(0);
            zoomTranslateY.setOffset(lastTranslateY);
            zoomTranslateY.setValue(0);
          }
        }
      },
      onPanResponderMove: (evt, gestureState) => {
        const touches = evt.nativeEvent.touches;
        if (touches.length >= 2) {
          const distance = getDistance(touches);
          if (initialDistance > 0) {
            const newScale = Math.max(1, Math.min(3, (distance / initialDistance) * initialScale));
            const scaleChange = newScale - initialScale;
            const imageCenterX = imageWidth / 2;
            const imageCenterY = imageHeight / 2; // Use defined height
            const adjustedTranslateX = initialTranslateX - (scaleChange * (pinchFocalX - imageCenterX));
            const adjustedTranslateY = initialTranslateY - (scaleChange * (pinchFocalY - imageCenterY));
            const clamped = clampTranslate(adjustedTranslateX, adjustedTranslateY, newScale);
            zoomScale.setValue(newScale);
            zoomTranslateX.setValue(clamped.x);
            zoomTranslateY.setValue(clamped.y);
          }
        } else if (touches.length === 1 && zoomScale._value > 1) { // Check scale value
          const newTranslateX = lastTranslateX + gestureState.dx;
          const newTranslateY = lastTranslateY + gestureState.dy;
          const clamped = clampTranslate(newTranslateX, newTranslateY, lastScale);
          zoomTranslateX.setValue(clamped.x);
          zoomTranslateY.setValue(clamped.y);
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        const touches = evt.nativeEvent.touches;
        if (touches.length === 0) {
          zoomScale.flattenOffset();
          zoomTranslateX.flattenOffset();
          zoomTranslateY.flattenOffset();
          const currentScale = lastScale = zoomScale._value;
          lastTranslateX = zoomTranslateX._value;
          lastTranslateY = zoomTranslateY._value;
          pinchFocalX = 0;
          pinchFocalY = 0;
          initialTranslateX = 0;
          initialTranslateY = 0;
          const clamped = clampTranslate(lastTranslateX, lastTranslateY, currentScale);
          if (clamped.x !== lastTranslateX || clamped.y !== lastTranslateY) {
            lastTranslateX = clamped.x;
            lastTranslateY = clamped.y;
            Animated.parallel([
              Animated.timing(zoomTranslateX, { toValue: clamped.x, duration: 200, useNativeDriver: true, }),
              Animated.timing(zoomTranslateY, { toValue: clamped.y, duration: 200, useNativeDriver: true, }),
            ]).start();
          }
          if (tapCount === 2 && gestureState.dx < 10 && gestureState.dy < 10) {
            tapCount = 0;
            if (zoomScale._value > 1) { // Check scale value
              resetZoom();
              lastScale = 1;
              lastTranslateX = 0;
              lastTranslateY = 0;
            } else {
              const tapX = evt.nativeEvent.locationX;
              const tapY = evt.nativeEvent.locationY;
              const zoomScaleVal = 2;
              const translateX = -(zoomScaleVal - 1) * (tapX - imageWidth / 2);
              const translateY = -(zoomScaleVal - 1) * (tapY - imageHeight / 2); // Use defined height
              const clampedZoom = clampTranslate(translateX, translateY, zoomScaleVal);
              zoomToPoint(zoomScaleVal, clampedZoom.x, clampedZoom.y);
              lastScale = zoomScaleVal;
              lastTranslateX = clampedZoom.x;
              lastTranslateY = clampedZoom.y;
            }
          } 
          setIsZoomed(currentScale > 1);
        }
      },
      onPanResponderTerminate: () => {
        zoomScale.flattenOffset();
        zoomTranslateX.flattenOffset();
        zoomTranslateY.flattenOffset();
      },
    });
  };
  // Post component with animations and carousel support - adapted from Post.js
  const PostItem = ({ item, index }) => {
    const isVideo = item.type === 'reel';
    const authorName = item.author?.fullName || username;
    const authorPhoto = item.author?.photoUrl;
    const isMenuVisible = menuVisible[item._id] || false;
    // Check if current user owns this post
    const isOwnPost = item.author?._id === user?._id || item.user?._id === user?._id;

    // --- ✅ FIX: Enhanced initialization for likesCount (similar to Post.js FIX 1 for comments) ---
    const [likesCount, setLikesCount] = useState(() => {
        // Check all possible field names for likes count
        const possibleCount =
            item?.likeCount ||
            item?.likes ||
            item?.realTimeLikes || // Add any other potential field names here if they exist in your API
            0;
        console.log('📊 Initial likes count setup for PostItem:', {
            postId: item?._id,
            likeCount: item?.likeCount,
            likes: item?.likes,
            realTimeLikes: item?.realTimeLikes,
            finalCount: possibleCount
        });
        return possibleCount;
    });
    const [isLiked, setIsLiked] = useState(item.isLikedByUser || false);

    // --- ✅ FIX: Enhanced initialization for commentsCount (similar to Post.js FIX 1) ---
    const [commentsCount, setCommentsCount] = useState(() => {
        // Check all possible field names for comments count
        const possibleCount =
            item?.commentsCount ||
            item?.commentCount ||
            item?.comments ||
            item?.totalComments ||
            item?.comment_count ||
            item?.numberOfComments ||
            0;
        console.log('📊 Initial comments count setup for PostItem:', {
            postId: item?._id,
            commentsCount: item?.commentsCount,
            commentCount: item?.commentCount,
            comments: item?.comments,
            totalComments: item?.totalComments,
            finalCount: possibleCount
        });
        return possibleCount;
    });
    const [likeOperationInProgress, setLikeOperationInProgress] = useState(false);
    // NEW: State for image carousel
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const scrollViewRef = useRef(null);
    // --- NEW: Zoom state for each PostItem ---
    const [isZoomed, setIsZoomed] = useState(false);
    const [isZooming, setIsZooming] = useState(false);
    const zoomScale = useRef(new Animated.Value(1)).current;
    const zoomTranslateX = useRef(new Animated.Value(0)).current;
    const zoomTranslateY = useRef(new Animated.Value(0)).current;
    const zoomPanResponder = useRef(createZoomPanResponder(zoomScale, zoomTranslateX, zoomTranslateY, setIsZoomed, setIsZooming)).current;
    // --- END: Zoom state ---

    // ✅ NEW: Enhanced double tap detection refs (like in Post.js)
    const lastTapRef = useRef(null);
    const tapTimeoutRef = useRef(null);

    // Animation refs - same as Post.js
    const heartScaleAnim = useRef(new Animated.Value(1)).current;
    const centerHeartAnim = useRef(new Animated.Value(0)).current;
    const centerHeartOpacity = useRef(new Animated.Value(0)).current;
    const heartFillAnim = useRef(new Animated.Value(isLiked ? 1 : 0)).current;

    // --- ✅ FIX: Enhanced effect to sync likes count with more field checks ---
    useEffect(() => {
        const newLikesCount =
            item?.likeCount ||
            item?.likes ||
            item?.realTimeLikes || // Add any other potential field names here if they exist in your API
            0;
        if (newLikesCount !== likesCount) {
            console.log('❤️ Updating likes count from item prop change in PostItem:', likesCount, '->', newLikesCount);
            setLikesCount(newLikesCount);
        }
    }, [
        item?.likeCount,
        item?.likes,
        item?.realTimeLikes // Add dependencies for other potential fields
    ]);

    // --- ✅ FIX: Enhanced effect to sync comments count with more field checks ---
    useEffect(() => {
        const newCommentsCount =
            item?.commentsCount ||
            item?.commentCount ||
            item?.comments ||
            item?.totalComments ||
            item?.comment_count ||
            item?.numberOfComments ||
            0;
        if (newCommentsCount !== commentsCount) {
            console.log('📝 Updating comments count from item prop change in PostItem:', commentsCount, '->', newCommentsCount);
            setCommentsCount(newCommentsCount);
        }
    }, [
        item?.commentsCount,
        item?.commentCount,
        item?.comments,
        item?.totalComments,
        item?.comment_count,
        item?.numberOfComments
    ]);

    // --- ✅ FIX: Add effect to fetch actual comments count if it's missing AND fetch on load ---
    useEffect(() => {
        // Only fetch if we have a valid post ID and the user is authenticated
        const postId = item?._id;
        if (postId && token && isAuthenticated) { // Check isAuthenticated and token
            fetchCommentsCount(postId);
        }
    }, [item?._id, token, isAuthenticated]); // Dependency on item ID, token, and isAuthenticated

    // Cleanup timeout on unmount
    useEffect(() => {
      return () => {
        if (tapTimeoutRef.current) {
          clearTimeout(tapTimeoutRef.current);
        }
      };
    }, []);

    // --- ✅ FIX: New function to fetch comments count from API (Adapted for PhotoViewerScreen context) ---
    const fetchCommentsCount = async (postId) => {
        try {
            console.log('🔄 Fetching actual comments count for post in PostItem:', postId);
            // Use the token from context
            if (!token || !isAuthenticated) {
                console.warn('⚠️ Not authenticated or token missing, skipping fetchCommentsCount');
                return;
            }
            const response = await fetch(
                `${BASE_URL}/api/v1/posts/${postId}/comments?page=1&limit=1`,
                {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                }
            );
            if (response.ok) {
                const result = await response.json();
                if (result.success && result.data?.pagination?.totalComments !== undefined) {
                    const actualCount = result.data.pagination.totalComments;
                    console.log('✅ Fetched actual comments count for PostItem:', actualCount);
                    // Only update if the fetched count is different or if local count was 0
                    // This prevents overwriting a potentially fresher count passed in props
                    if (actualCount !== commentsCount || commentsCount === 0) {
                        setCommentsCount(actualCount);
                    }
                }
            } else if (response.status === 401) {
                 console.log('🔄 Got 401 in PostItem, attempting token refresh...');
                 const refreshSuccess = await refreshToken();
                 if (refreshSuccess) {
                     // Retry the fetch after successful refresh
                     console.log('🔄 Retrying fetchCommentsCount after token refresh...');
                     fetchCommentsCount(postId); // Recursive call
                 } else {
                     console.error('❌ Token refresh failed during fetchCommentsCount');
                 }
            }
        } catch (error) {
            console.log('⚠️ Could not fetch comments count in PostItem:', error.message);
            // Don't show error to user as this is a background operation
        }
    };

    // Enhanced image processing with URL sanitization and carousel support
    const processImages = () => {
      console.log('📸 Processing images for post:', item._id);
      console.log('📸 Available image data:', {
        'item.images': item.images,
        'item.video': item.video,
        'isVideo': isVideo
      });
      // Handle video content
      if (isVideo && item.video?.url) {
        console.log('🎬 Video post detected:', item.video.url);
        const videoUri = sanitizeImageUrl(item.video.url);
        return [{ uri: videoUri, id: 0, isVideo: true }];
      }
      // Handle image content
      if (item.images && Array.isArray(item.images) && item.images.length > 0) {
        console.log('📷 Image post detected:', item.images.length, 'images');
        const processedImages = item.images.map((img, index) => {
          let imageUri = null;
          // Handle different image object formats
          if (typeof img === 'string') {
            imageUri = sanitizeImageUrl(img);
            console.log(`📷 Image ${index + 1}: string format -`, imageUri);
          } else if (img && typeof img === 'object') {
            // Prioritize url, then uri
            const rawUri = img.url || img.uri;
            imageUri = sanitizeImageUrl(rawUri);
            console.log(`📷 Image ${index + 1}: object format -`, imageUri);
          }
          if (!imageUri) {
            console.log(`📷 Image ${index + 1}: invalid format, using placeholder`);
            return { uri: 'https://via.placeholder.com/400/333333/ffffff?text=No+Image', id: index };
          }
          return {
            uri: imageUri,
            id: index,
            isVideo: false
          };
        }).filter(img => img.uri); // Remove any images without valid URIs
        console.log('📷 Processed images:', processedImages);
        return processedImages;
      }
      // No valid media found - return placeholder
      console.log('📷 No valid media found, using placeholder');
      return [{ uri: 'https://via.placeholder.com/400/333333/ffffff?text=No+Image', id: 0, isVideo: false }];
    };
    const postImages = processImages();
    const isMultiImage = postImages.length > 1;
    console.log('📷 Final processed images:', {
      count: postImages.length,
      isMultiImage,
      firstImageUri: postImages[0]?.uri,
      allImages: postImages
    });
    // Handle image scroll for carousel
    const handleImageScroll = (event) => {
      // Prevent scrolling if zoomed
      if (isZoomed) return;
      const contentOffset = event.nativeEvent.contentOffset;
      const currentIndex = Math.round(contentOffset.x / imageWidth);
      if (currentIndex !== currentImageIndex && currentIndex >= 0 && currentIndex < postImages.length) {
        setCurrentImageIndex(currentIndex);
        console.log('📷 Image carousel scrolled to index:', currentIndex);
      }
    };
    // Heart button animation with fill effect - from Post.js
    const animateHeartButton = (isLiking) => {
      Animated.parallel([
        // Scale animation
        Animated.sequence([
          Animated.timing(heartScaleAnim, {
            toValue: 1.4,
            duration: 150,
            easing: Easing.out(Easing.back(1.5)),
            useNativeDriver: true,
          }),
          Animated.timing(heartScaleAnim, {
            toValue: 1,
            duration: 150,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
        // Fill animation
        Animated.timing(heartFillAnim, {
          toValue: isLiking ? 1 : 0,
          duration: 300,
          easing: Easing.out(Easing.quad),
          useNativeDriver: false,
        }),
      ]).start();
    };
    // Enhanced center heart animation with bounce effect - FIXED
    const animateCenterHeart = () => {
      // Reset animations
      centerHeartAnim.setValue(0);
      centerHeartOpacity.setValue(0);
      Animated.parallel([
        // Opacity animation
        Animated.sequence([
          Animated.timing(centerHeartOpacity, {
            toValue: 1,
            duration: 150,
            useNativeDriver: true,
          }),
          Animated.timing(centerHeartOpacity, {
            toValue: 0,
            duration: 1000,
            delay: 300,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
        // Scale animation with bounce - FIXED
        Animated.sequence([
          Animated.timing(centerHeartAnim, {
            toValue: 1.3,
            duration: 200,
            easing: Easing.out(Easing.back(2)),
            useNativeDriver: true,
          }),
          Animated.timing(centerHeartAnim, {
            toValue: 1,
            duration: 150,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(centerHeartAnim, {
            toValue: 0.7,
            duration: 800,
            delay: 100,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    };

    // ✅ NEW: Enhanced double tap handler specifically for liking (like in Post.js)
    const handleImageDoubleTap = () => {
      console.log('💖 Double tap detected on image - attempting to like');
      
      // Always trigger like on double tap, regardless of current state
      if (!likeOperationInProgress) {
        // If already liked, we could either do nothing or unlike
        // For Instagram-like behavior, double tap should always like (not toggle)
        if (!isLiked) {
          console.log('💖 Post not liked - liking now');
          handleLikePress();
        } else {
          console.log('💖 Post already liked - showing heart animation anyway');
          // Show the heart animation even if already liked
          animateCenterHeart();
        }
      } else {
        console.log('💖 Like operation in progress - ignoring double tap');
      }
    };

    // ✅ NEW: Improved double tap detection for images (like in Post.js)
    const handleImagePress = () => {
      const now = Date.now();
      const DOUBLE_TAP_DELAY = 300;

      if (tapTimeoutRef.current) {
        clearTimeout(tapTimeoutRef.current);
      }

      if (lastTapRef.current && (now - lastTapRef.current) < DOUBLE_TAP_DELAY) {
        // Double tap detected
        console.log('🔥 Double tap detected!');
        lastTapRef.current = null; // Reset to prevent triple tap issues
        handleImageDoubleTap();
      } else {
        // Single tap - wait to see if another tap comes
        lastTapRef.current = now;
        tapTimeoutRef.current = setTimeout(() => {
          // Single tap confirmed (no second tap within delay)
          console.log('👆 Single tap confirmed');
          lastTapRef.current = null;
          // You could add single tap behavior here if needed
        }, DOUBLE_TAP_DELAY);
      }
    };

    // --- ✅ FIX: Enhanced like handler with proper error handling and state updates (similar to Post.js) ---
    const handleLikePress = async () => {
      // Prevent multiple simultaneous like operations
      if (likeOperationInProgress) {
        console.log('Like operation already in progress, ignoring');
        return;
      }
      try {
        setLikeOperationInProgress(true);
        const newLikedState = !isLiked;
        const originalLikedState = isLiked;
        const originalLikesCount = likesCount;
        const newLikesCount = newLikedState ? likesCount + 1 : Math.max(0, likesCount - 1);
        console.log('=== LIKE OPERATION START ===');
        console.log('Post ID:', item._id);
        console.log('Current state:', { isLiked, likesCount });
        console.log('New state:', { isLiked: newLikedState, likesCount: newLikesCount });
        // Optimistic update - update UI immediately
        setIsLiked(newLikedState);
        setLikesCount(newLikesCount);
        // Trigger animations
        animateHeartButton(newLikedState);
        if (newLikedState) {
          animateCenterHeart();
        }
        // Call API
        const result = await handleLike(item._id, originalLikedState);
        if (result.success) {
          // Success - update with server response
          const serverLikeCount = result.data?.likeCount !== undefined ? result.data.likeCount : result.data?.realTimeLikes || newLikesCount;
          const serverIsLiked = result.data?.isLiked !== undefined ? result.data.isLiked : newLikedState;
          console.log('Server response:', { serverIsLiked, serverLikeCount });
          setIsLiked(serverIsLiked);
          setLikesCount(Math.max(0, serverLikeCount));
          // Ensure animations match final state
          if (serverIsLiked !== newLikedState) {
            animateHeartButton(serverIsLiked);
          }
          console.log('✅ Like operation completed successfully');
        } else {
          // API call failed - revert optimistic update
          console.error('❌ Like API call failed');
          setIsLiked(originalLikedState);
          setLikesCount(originalLikesCount);
          animateHeartButton(originalLikedState);
        }
      } catch (error) {
        console.error('❌ Like operation error:', error);
        // Revert to original state on error
        setIsLiked(item.isLikedByUser || false);
        setLikesCount(item.likeCount || item.likes || 0); // Revert to original prop values
        animateHeartButton(item.isLikedByUser || false);
        Alert.alert('Error', 'Failed to update like. Please try again.');
      } finally {
        setLikeOperationInProgress(false);
      }
    };

    // Comment button press handler - from Post.js (Updated to match new logic)
    const handleCommentPress = () => {
      console.log('=== COMMENT BUTTON PRESSED ===');
      console.log('Using Post ID:', item._id);
      console.log('Current comments count:', commentsCount);
      if (!navigation) {
        console.error('❌ Navigation prop not available');
        Alert.alert('Error', 'Navigation not available');
        return;
      }
      try {
        console.log('✅ Navigating to CommentScreen with postId:', item._id);
        navigation.navigate('CommentScreen', {
          postId: item._id,
          postData: {
            ...item,
            commentsCount: commentsCount, // Pass current count
            likesCount: likesCount,
          },
          // ✅ Enhanced callback to properly update count (Similar to Post.js FIX 6)
          onCommentUpdate: (newCount, realTimeComments) => {
            console.log('📝 Comment count updated from CommentScreen in PostItem:');
            console.log('  - New count:', newCount);
            console.log('  - Real-time comments:', realTimeComments);
            console.log('  - Previous count:', commentsCount);
            // Use the real-time comments if available, otherwise use newCount
            const finalCount = realTimeComments !== undefined ? realTimeComments : newCount;
            console.log('  - Final count to set:', finalCount);
            setCommentsCount(finalCount);
          }
        });
      } catch (navigationError) {
        console.error('❌ Navigation error:', navigationError);
        Alert.alert('Error', 'Unable to open comments at this time');
      }
    };
    // Handle likes press to navigate to LikeScreen - from Post.js
    const handleLikesPress = () => {
      console.log('=== LIKES NAVIGATION DEBUG ===');
      console.log('Likes count:', likesCount);
      console.log('Using Post ID:', item._id);
      console.log('Navigation available:', !!navigation);
      if (likesCount > 0 && navigation) {
        try {
          console.log('✅ Navigating to LikeScreen with postId:', item._id);
          navigation.navigate('LikeScreen', {
            postId: item._id,
            initialLikeCount: likesCount,
          });
        } catch (error) {
          console.error('❌ Error navigating to LikeScreen:', error);
          Alert.alert('Error', 'Unable to view likes at this time');
        }
      } else if (likesCount === 0) {
        Alert.alert('No Likes', 'This post has no likes yet');
      } else {
        console.error('❌ Navigation not available');
        Alert.alert('Error', 'Navigation not available');
      }
    };

    const handleProfilePress = () => {
      try {
        console.log('Profile press triggered for:', authorName);
        if (navigation && item.author?._id) {
          navigation.navigate('UserProfile', {
            userId: item.author._id,
            fromFeed: true
          });
        }
      } catch (error) {
        console.error('Error handling profile press:', error);
      }
    };
    // Render pagination dots for multi-image posts
    const renderPaginationDots = () => {
      if (!isMultiImage || isZoomed) return null; // Don't show dots if zoomed
      return (
        <View style={styles.paginationContainer}>
          {postImages.map((_, index) => (
            <View
              key={index}
              style={[
                styles.paginationDot,
                index === currentImageIndex ? styles.activePaginationDot : styles.inactivePaginationDot
              ]}
            />
          ))}
        </View>
      );
    };

    // --- ✅ ENHANCED: Function to render a zoomable image view with double tap support ---
    const renderZoomableImageView = (imageUri, imageId, isVideoType = false) => {
        if (isVideoType) {
            return (
                <Video
                    source={{ uri: imageUri }}
                    style={styles.postImage}
                    controls={true}
                    resizeMode="cover"
                    paused={true}
                    onError={(error) => {
                        console.log(`🎬 Video error:`, error);
                        console.log(`🎬 Failed video URI:`, imageUri);
                    }}
                />
            );
        }
        return (
            <TouchableWithoutFeedback onPress={handleImagePress}>
              <Animated.View
                  style={[
                      styles.zoomableImageContainer, // New style for the container
                      {
                          transform: [
                              { scale: zoomScale },
                              { translateX: zoomTranslateX },
                              { translateY: zoomTranslateY },
                          ],
                      },
                  ]}
                  {...zoomPanResponder.panHandlers}
              >
                  <Image
                      source={{ uri: imageUri }}
                      style={styles.postImage}
                      onError={(error) => {
                          console.log(`📸 Zoomable Image error:`, error?.nativeEvent?.error);
                          console.log(`📸 Failed image URI:`, imageUri);
                      }}
                      onLoad={() => {
                          console.log(`📸 Zoomable Image loaded successfully:`, imageUri);
                      }}
                  />
              </Animated.View>
            </TouchableWithoutFeedback>
        );
    };
    // --- END: renderZoomableImageView ---
    // Render image carousel or single image
    const renderImageContent = () => {
      // Safety check - ensure we have valid images
      if (!postImages || postImages.length === 0 || !postImages[0]?.uri) {
        console.log('❌ No valid images to render');
        return (
          <View style={styles.imageContainer}>
            <View style={styles.postImageContainer}>
              <View style={[styles.postImage, styles.placeholderImage]}>
                <Text style={styles.placeholderText}>No Image Available</Text>
              </View>
            </View>
          </View>
        );
      }
      if (isMultiImage) {
        // Multi-image carousel
        return (
          <View style={styles.imageContainer}>
            <ScrollView
              ref={scrollViewRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={handleImageScroll}
              scrollEventThrottle={16}
              style={styles.imageScrollView}
              scrollEnabled={!isZoomed} // Disable scroll when zoomed
            >
              {postImages.map((image, index) => {
                // Skip images without valid URIs
                if (!image?.uri) {
                  console.log(`⚠️ Skipping image ${index + 1} - no valid URI`);
                  return null;
                }
                return (
                  <View // Use View instead of TouchableOpacity for better PanResponder handling
                    key={image.id || index}
                    style={styles.carouselImageContainer}
                  >
                    {/* Render zoomable image view with double tap support */}
                    {renderZoomableImageView(image.uri, image.id, image.isVideo)}
                  </View>
                );
              })}
            </ScrollView>
            {/* Center heart animation overlay - positioned over current image */}
            <Animated.View
              style={[
                styles.centerHeartContainer,
                {
                  opacity: centerHeartOpacity,
                  transform: [{ scale: centerHeartAnim }]
                }
              ]}
              pointerEvents="none"
            >
              <View style={styles.centerHeartWrapper}>
                <Ionicons
                  name="heart"
                  size={100}
                  color="#E93A7A"
                  style={styles.centerHeart}
                />
              </View>
            </Animated.View>
            {/* Pagination dots */}
            {!isZoomed && renderPaginationDots()} {/* Hide dots when zoomed */}
            {/* Image counter for multi-image posts */}
            {!isZoomed && ( // Hide counter when zoomed
                <View style={styles.imageCounterContainer}>
                <Text style={styles.imageCounterText}>
                    {currentImageIndex + 1}/{postImages.length}
                </Text>
                </View>
            )}
          </View>
        );
      } else {
        // Single image or video
        return (
          <View style={styles.imageContainer}>
            {/* Use View instead of TouchableOpacity for better PanResponder handling */}
            <View style={styles.postImageContainer}>
              {/* Render zoomable image view with double tap support */}
              {renderZoomableImageView(postImages[0].uri, postImages[0].id, postImages[0].isVideo)}
              {/* Center heart animation overlay */}
              <Animated.View
                style={[
                  styles.centerHeartContainer,
                  {
                    opacity: centerHeartOpacity,
                    transform: [{ scale: centerHeartAnim }]
                  }
                ]}
                pointerEvents="none"
              >
                <View style={styles.centerHeartWrapper}>
                  <Ionicons
                    name="heart"
                    size={100}
                    color="#E93A7A"
                    style={styles.centerHeart}
                  />
                </View>
              </Animated.View>
            </View>
          </View>
        );
      }
    };
    return (
      <View style={styles.container}>
        <View style={styles.userInfo}>
          <TouchableOpacity onPress={handleProfilePress} activeOpacity={0.8}>
            <View style={styles.dpContainer}>
              <View
                style={[
                  styles.avatar,
                  { backgroundColor: getAvatarColor(authorName) }
                ]}
              >
                {authorPhoto ? (
                  <Image
                    source={{ uri: authorPhoto }}
                    style={styles.profileImage}
                    onError={(error) => {
                      console.log('Profile image error:', error?.nativeEvent?.error);
                    }}
                  />
                ) : (
                  <Text style={styles.avatarText}>
                    {getInitials(authorName)}
                  </Text>
                )}
              </View>
            </View>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleProfilePress} activeOpacity={0.8} style={styles.usernameContainer}>
            <Text style={styles.username}>{authorName}</Text>
          </TouchableOpacity>
          {/* --- NEW: Three Dot Menu (Only for own posts) --- */}
          {isOwnPost && (
            <View style={styles.menuContainer}>
              {isMenuVisible && (
                <View style={styles.menuOverlay}>
                  <TouchableOpacity
                    style={styles.menuButton}
                    onPress={() => handleEditPost(item)}
                  >
                    <MaterialIcons name="edit" size={20} color="white" />
                    <Text style={styles.menuButtonText}>Edit Caption</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.closeMenuButton}
                    onPress={() => hideMenu(item._id)}
                  >
                    <Ionicons name="close" size={20} color="white" />
                    <Text style={styles.menuButtonText}>Close</Text>
                  </TouchableOpacity>
                </View>
              )}
              <TouchableOpacity
                style={styles.threeDotButton}
                onPress={() => showMenu(item._id)}
              >
                <MaterialIcons name="more-vert" size={24} color="white" />
              </TouchableOpacity>
            </View>
          )}
        </View>
        {/* Enhanced image content with zoom support and double tap */}
        {renderImageContent()}
        {/* Action buttons below post*/}
        <View style={styles.postFooterContainer}>
          <View style={styles.leftContent}>
            <Text style={styles.caption}>
              <Text style={{ fontWeight: "bold" }}>{authorName}</Text>
              {(item.content || item.caption) && (item.content || item.caption).trim().length > 0 && (
                <Text> {item.content || item.caption}</Text>
              )}
            </Text>
            {/* Clickable likes count */}
            {likesCount > 0 && (
              <TouchableOpacity onPress={handleLikesPress} activeOpacity={0.8}>
                <Text style={styles.likesText}>
                  {likesCount} {likesCount === 1 ? 'like' : 'likes'}
                </Text>
              </TouchableOpacity>
            )}
            {/* ✅ FIX 7: Always show comments, with dynamic text based on count */}
            <TouchableOpacity onPress={handleCommentPress} activeOpacity={0.8}>
              <Text style={styles.commentsText}>
                {commentsCount > 0
                  ? `View all ${commentsCount} ${commentsCount === 1 ? 'comment' : 'comments'}`
                  : 'Add a comment...'
                }
              </Text>
            </TouchableOpacity>
            {item.createdAt && (
              <Text style={styles.timeText}>{formatTimeAgo(item.createdAt)}</Text>
            )}
          </View>
          <View style={styles.actionButtons}>
            <TouchableOpacity style={[styles.commentButton, styles.heartContainer]} onPress={handleCommentPress}>
              <Ionicons
                name="chatbubble-outline"
                size={24}
                color="white"
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.likeButton, styles.heartContainer]}
              onPress={handleLikePress}
              disabled={likeOperationInProgress}
            >
              <Animated.View style={{ transform: [{ scale: heartScaleAnim }] }}>
                <Ionicons
                  name={isLiked ? "heart" : "heart-outline"}
                  size={28}
                  color={isLiked ? "#E93A7A" : "white"}
                />
              </Animated.View>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };
  const onScrollToIndexFailed = (info) => {
    const wait = new Promise(resolve => setTimeout(resolve, 500));
    wait.then(() => {
      flatListRef.current?.scrollToIndex({ index: info.index, animated: true });
    });
  };
  if (!currentPosts || currentPosts.length === 0) {
    return (
      <SafeAreaView style={styles.screenContainer}>
        <StatusBar barStyle="light-content" backgroundColor="black" />
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Posts</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No posts to display</Text>
        </View>
      </SafeAreaView>
    );
  }
  // --- Modified: Prepare props for EditCaptionModal ---
  const initialCaptionForModal = editingItem ? (editingItem.content || editingItem.caption || '') : '';
  // --- REMOVED: The inline EditCaptionModal definition ---
  return (
    <SafeAreaView style={styles.screenContainer}>
      <StatusBar barStyle="light-content" backgroundColor="black" />
      {/* Pass props to the separate Modal component */}
      <EditCaptionModal
        isVisible={isEditModalVisible}
        initialCaption={initialCaptionForModal}
        onSave={executeCaptionUpdate} // Pass the function to handle saving
        onClose={closeEditModal}
        isUpdating={updatingCaption} // Pass updating state if needed inside modal
        editingItem={editingItem} // Pass item for potential ID checks
      />
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Posts</Text>
        <View style={styles.headerSpacer} />
      </View>
      {/* Posts List */}
      <FlatList
        ref={flatListRef}
        data={currentPosts}
        renderItem={({ item, index }) => <PostItem item={item} index={index} />}
        keyExtractor={(item) => item._id}
        showsVerticalScrollIndicator={false}
        onScrollToIndexFailed={onScrollToIndexFailed}
        initialScrollIndex={initialIndex}
        removeClippedSubviews={true}
        initialNumToRender={3}
        maxToRenderPerBatch={5}
        windowSize={10}
      />
    </SafeAreaView>
  );
};
const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: 'black',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#333',
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    color: '#ed167e',
    fontSize: 24,
    fontWeight: '600',
  },
  headerTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  headerSpacer: {
    width: 40,
  },
  container: {
    backgroundColor: "black",
    padding: 10,
  },
  userInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  dpContainer: {
    position: 'relative',
    marginRight: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
  profileImage: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
  },
  usernameContainer: {
    flex: 1,
  },
  username: {
    color: "white",
    fontSize: 14,
    fontWeight: '600',
  },
  // --- NEW: Menu Styles ---
  menuContainer: {
    position: 'relative',
  },
  threeDotButton: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuOverlay: {
    position: 'absolute',
    top: 40,
    right: 0,
    backgroundColor: '#1e1e1e',
    borderRadius: 8,
    padding: 4,
    zIndex: 20,
    borderWidth: 1,
    borderColor: '#333',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    minWidth: 140,
  },
  menuButton: {
    padding: 12,
    alignItems: 'center',
    flexDirection: 'row',
  },
  menuButtonText: {
    color: 'white',
    fontSize: 14,
    marginLeft: 8,
  },
  closeMenuButton: {
    padding: 12,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#333',
    flexDirection: 'row',
  },
  imageContainer: {
    position: "relative",
    overflow: 'hidden', // Important for clipping zoomed content
  },
  // Multi-image carousel styles
  imageScrollView: {
    width: '100%',
  },
  carouselImageContainer: {
    width: imageWidth,
    position: 'relative',
  },
  postImageContainer: {
    position: 'relative',
  },
  // --- NEW: Style for the zoomable Animated.View container ---
  zoomableImageContainer: {
    width: "100%", // Ensure it takes the full width
    height: imageHeight, // Explicit height for proper zoom calculations
    zIndex: 2,
  },
  postImage: {
    width: "100%",
    height: imageHeight, // Use defined constant
    borderRadius: 10,
    zIndex: 2,
  },
  centerHeartContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 3,
  },
  centerHeartWrapper: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerHeart: {
    // Vector icon styling handled by the component itself
  },
  // Pagination styles
  paginationContainer: {
    position: 'absolute',
    bottom: 15,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 4,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 3,
  },
  activePaginationDot: {
    backgroundColor: '#E93A7A',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
  inactivePaginationDot: {
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  // Image counter styles
  imageCounterContainer: {
    position: 'absolute',
    top: 15,
    right: 15,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    zIndex: 4,
  },
  imageCounterText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  postFooterContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 8,
  },
  leftContent: {
    flex: 1,
    flexDirection: 'column',
    marginRight: 10,
  },
  caption: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 8,
  },
  likesText: {
    color: '#888',
    fontSize: 12,
    marginBottom: 4,
    fontWeight: '600',
  },
  commentsText: {
    color: '#888',
    fontSize: 12,
    marginBottom: 4,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
  timeText: {
    color: '#666',
    fontSize: 12,
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  likeButton: {
    marginRight: 2,
  },
  commentButton: {
    marginRight: 2,
  },
  heartContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 44,
    height: 44,
  },
  // Placeholder image styles
  placeholderImage: {
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#888',
    fontSize: 16,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: '#888',
    fontSize: 16,
    textAlign: 'center',
  },
  // --- COMPLETELY FIXED: Edit Caption Modal Styles ---
  editModalFullscreen: {
    flex: 1,
    backgroundColor: 'black',
  },
  // editModalOverlay: { /* Removed redundant overlay style */ },
  editModalContentFixed: {
    flex: 1, // Takes full height within KeyboardAvoidingView
    backgroundColor: '#000',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    minHeight: '50%',
  },
  editModalHeaderFixed: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: Platform.OS === 'ios' ? 50 : 12, // Account for status bar
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    backgroundColor: '#1e1e1e',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  editModalBackButton: {
    padding: 8,
  },
  editModalTitleFixed: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  editModalSaveHeaderButton: {
    padding: 8,
    minWidth: 50,
  },
  editModalSaveHeaderText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ed167e',
  },
  editModalBodyFixed: {
    flex: 1,
    padding: 16,
  },
  captionInputFixed: {
    backgroundColor: '#1e1e1e',
    color: 'white',
    fontSize: 16,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
    minHeight: 150,
    maxHeight: 400,
    textAlignVertical: 'top',
  },
});
export default PhotoViewerScreen;