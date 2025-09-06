// src/screens/tabs/PhotoViewerScreen.js
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
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  PanResponder,
} from 'react-native';
import Video from 'react-native-video';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useAuth } from '../../context/AuthContext';
import BASE_URL from '../../config/config';

const { width, height } = Dimensions.get('window');
const imageWidth = width - 20;
const imageHeight = 500;

// EditCaptionModal component (unchanged)
const EditCaptionModal = ({ isVisible, initialCaption, onSave, onClose, isUpdating, editingItem }) => {
  const [textInputValue, setTextInputValue] = useState(initialCaption || '');
  const textInputRef = useRef(null);

  useEffect(() => {
     if (isVisible) {
        setTextInputValue(initialCaption || '');
     }
  }, [isVisible, initialCaption]);

  const handleSave = () => {
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
              disabled={isUpdating || textInputValue.trim() === (initialCaption || '')}
            >
              {isUpdating ? (
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
              value={textInputValue}
              onChangeText={setTextInputValue}
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

const PhotoViewerScreen = ({ navigation, route }) => {
  const { posts, initialIndex = 0, username } = route.params;
  const { token, user, refreshToken, isAuthenticated } = useAuth();
  const [currentPosts, setCurrentPosts] = useState(posts || []);
  const [loading, setLoading] = useState(false);
  const flatListRef = useRef(null);
  
  // Edit modal state
  const [editingItem, setEditingItem] = useState(null);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [updatingCaption, setUpdatingCaption] = useState(false);
  const [menuVisible, setMenuVisible] = useState({});

  useEffect(() => {
    if (initialIndex > 0 && flatListRef.current) {
      setTimeout(() => {
        flatListRef.current.scrollToIndex({
          index: initialIndex,
          animated: false,
        });
      }, 100);
    }
  }, [initialIndex]);

  // Menu visibility functions
  const showMenu = (itemId) => {
    setMenuVisible(prev => ({ ...prev, [itemId]: true }));
  };
  
  const hideMenu = (itemId) => {
    setMenuVisible(prev => ({ ...prev, [itemId]: false }));
  };

  // Edit modal functions
  const closeEditModal = () => {
    Keyboard.dismiss();
    setTimeout(() => {
      setIsEditModalVisible(false);
      setEditingItem(null);
      setUpdatingCaption(false);
    }, 50);
  };

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

  const handleEditPost = (item) => {
    if (item.author?._id !== user?._id && item.user?._id !== user?._id) {
      Alert.alert('Permission Denied', 'You can only edit your own posts.');
      return;
    }
    hideMenu(item._id);
    setEditingItem(item);
    setIsEditModalVisible(true);
  };

  const executeCaptionUpdate = async (newCaptionText) => {
    if (!editingItem) return;
    setUpdatingCaption(true);
    try {
      const trimmedCaption = newCaptionText.trim();
      await updatePostCaption(editingItem._id, trimmedCaption);
      setCurrentPosts(prev => prev.map(p =>
        p._id === editingItem._id
          ? { ...p, content: trimmedCaption, caption: trimmedCaption }
          : p
      ));
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

  // Utility functions
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
        setCurrentPosts(prevPosts =>
          prevPosts.map(post =>
            post._id === postId
              ? {
                  ...post,
                  isLikedByUser: !currentlyLiked,
                  likeCount: data.data?.likeCount !== undefined ? data.data.likeCount : (currentlyLiked ? (post.likeCount || 1) - 1 : (post.likeCount || 0) + 1),
                }
              : post
          )
        );
        return {
          success: true,
          data: data.data
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

  const sanitizeImageUrl = (url) => {
    if (!url || typeof url !== 'string') {
      return null;
    }
    let cleanUrl = url.replace(/^https?:\/\/https?:\/\//, 'https://');
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = 'https://' + cleanUrl;
    }
    return cleanUrl;
  };

  // PostItem component with PanResponder-based zoom
  const PostItem = ({ item, index }) => {
    const isVideo = item.type === 'reel';
    const authorName = item.author?.fullName || username;
    const authorPhoto = item.author?.photoUrl;
    const isMenuVisible = menuVisible[item._id] || false;
    const isOwnPost = item.author?._id === user?._id || item.user?._id === user?._id;

    // Zoom state for this PostItem
    const [isZoomed, setIsZoomed] = useState(false);
    const [isZooming, setIsZooming] = useState(false);
    const zoomScale = useRef(new Animated.Value(1)).current;
    const zoomTranslateX = useRef(new Animated.Value(0)).current;
    const zoomTranslateY = useRef(new Animated.Value(0)).current;

    // Double tap detection refs (integrated with PanResponder)
    const lastTapRef = useRef(null);
    const tapTimeoutRef = useRef(null);

    // Like and comment state
    const [likesCount, setLikesCount] = useState(() => {
        const possibleCount = item?.likeCount || item?.likes || item?.realTimeLikes || 0;
        return possibleCount;
    });
    const [isLiked, setIsLiked] = useState(item.isLikedByUser || false);
    const [commentsCount, setCommentsCount] = useState(() => {
        const possibleCount = item?.commentsCount || item?.commentCount || item?.comments || item?.totalComments || item?.comment_count || item?.numberOfComments || 0;
        return possibleCount;
    });
    const [likeOperationInProgress, setLikeOperationInProgress] = useState(false);
    
    // Carousel state
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const scrollViewRef = useRef(null);

    // Animation refs
    const heartScaleAnim = useRef(new Animated.Value(1)).current;
    const centerHeartAnim = useRef(new Animated.Value(0)).current;
    const centerHeartOpacity = useRef(new Animated.Value(0)).current;
    const heartFillAnim = useRef(new Animated.Value(isLiked ? 1 : 0)).current;

    // Cleanup timeout on unmount
    useEffect(() => {
      return () => {
        if (tapTimeoutRef.current) {
          clearTimeout(tapTimeoutRef.current);
        }
      };
    }, []);

    // Update states when item props change
    useEffect(() => {
        const newLikesCount = item?.likeCount || item?.likes || item?.realTimeLikes || 0;
        if (newLikesCount !== likesCount) {
            setLikesCount(newLikesCount);
        }
    }, [item?.likeCount, item?.likes, item?.realTimeLikes]);

    useEffect(() => {
        const newCommentsCount = item?.commentsCount || item?.commentCount || item?.comments || item?.totalComments || item?.comment_count || item?.numberOfComments || 0;
        if (newCommentsCount !== commentsCount) {
            setCommentsCount(newCommentsCount);
        }
    }, [item?.commentsCount, item?.commentCount, item?.comments, item?.totalComments, item?.comment_count, item?.numberOfComments]);

    // Fetch comments count
    useEffect(() => {
        const postId = item?._id;
        if (postId && token && isAuthenticated) {
            fetchCommentsCount(postId);
        }
    }, [item?._id, token, isAuthenticated]);

    const fetchCommentsCount = async (postId) => {
        try {
            if (!token || !isAuthenticated) {
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
                    if (actualCount !== commentsCount || commentsCount === 0) {
                        setCommentsCount(actualCount);
                    }
                }
            } else if (response.status === 401) {
                 const refreshSuccess = await refreshToken();
                 if (refreshSuccess) {
                     fetchCommentsCount(postId);
                 }
            }
        } catch (error) {
            console.log('Could not fetch comments count:', error.message);
        }
    };

    // PanResponder creation (adapted from Post.js)
    const createZoomPanResponder = () => {
      let initialDistance = 0;
      let initialScale = 1;
      let lastScale = 1;
      let lastTranslateX = 0;
      let lastTranslateY = 0;
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
        if (touches.length < 2) return { x: imageWidth / 2, y: 250 };
        const [touch1, touch2] = touches;
        const centerX = (touch1.locationX + touch2.locationX) / 2;
        const centerY = (touch1.locationY + touch2.locationY) / 2;
        return { x: centerX, y: centerY };
      };

      const getBounds = (scale) => {
        const scaledWidth = imageWidth * scale;
        const scaledHeight = imageHeight * scale;
        const maxTranslateX = Math.max(0, (scaledWidth - imageWidth) / 2);
        const maxTranslateY = Math.max(0, (scaledHeight - imageHeight) / 2);
        return { maxTranslateX, maxTranslateY };
      };

      const clampTranslate = (translateX, translateY, scale) => {
        const { maxTranslateX, maxTranslateY } = getBounds(scale);
        return {
          x: Math.max(-maxTranslateX, Math.min(maxTranslateX, translateX)),
          y: Math.max(-maxTranslateY, Math.min(maxTranslateY, translateY)),
        };
      };

      return PanResponder.create({
        onStartShouldSetPanResponder: (evt) => {
          const touches = evt.nativeEvent.touches;

          // Double Tap Detection Logic for Liking (integrated from Post.js)
          if (touches.length === 1) {
            const now = Date.now();
            const DOUBLE_TAP_DELAY = 300;

            if (lastTapRef.current && (now - lastTapRef.current) < DOUBLE_TAP_DELAY) {
              // Double tap detected!
              console.log('Double tap for LIKE detected!');

              if (tapTimeoutRef.current) {
                clearTimeout(tapTimeoutRef.current);
                tapTimeoutRef.current = null;
              }

              // Trigger like action
              handleImageDoubleTap();
              lastTapRef.current = null;
              return false; // Prevent PanResponder from activating for zoom/pan
            } else {
              lastTapRef.current = now;
            }
          }

          // Allow PanResponder to activate for multi-touch (pinch to zoom) or if already zoomed (for panning)
          return touches.length >= 2 || isZoomed;
        },

        onMoveShouldSetPanResponder: (evt, gestureState) => {
          return evt.nativeEvent.touches.length >= 2 ||
                 (isZoomed && (Math.abs(gestureState.dx) > 10 || Math.abs(gestureState.dy) > 10));
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
              const imageCenterY = imageHeight / 2;
              const adjustedTranslateX = initialTranslateX - (scaleChange * (pinchFocalX - imageCenterX));
              const adjustedTranslateY = initialTranslateY - (scaleChange * (pinchFocalY - imageCenterY));
              const clamped = clampTranslate(adjustedTranslateX, adjustedTranslateY, newScale);
              zoomScale.setValue(newScale);
              zoomTranslateX.setValue(clamped.x);
              zoomTranslateY.setValue(clamped.y);
            }
          } else if (touches.length === 1 && isZoomed) {
            // Allow dragging when zoomed with one finger
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
            setIsZoomed(currentScale > 1);

            // Handle Single Tap Confirmation for Double-Tap Sequence
            if (evt.nativeEvent.changedTouches.length === 1 &&
                Math.abs(gestureState.dx) < 10 &&
                Math.abs(gestureState.dy) < 10) {

              if (tapTimeoutRef.current) {
                clearTimeout(tapTimeoutRef.current);
              }
              tapTimeoutRef.current = setTimeout(() => {
                console.log('Single tap confirmed');
                tapTimeoutRef.current = null;
                lastTapRef.current = null;
              }, 300);
            }
          }
        },

        onPanResponderTerminate: () => {
          zoomScale.flattenOffset();
          zoomTranslateX.flattenOffset();
          zoomTranslateY.flattenOffset();
          if (tapTimeoutRef.current) {
            clearTimeout(tapTimeoutRef.current);
            tapTimeoutRef.current = null;
          }
          lastTapRef.current = null;
        },
      });
    };

    const zoomPanResponder = createZoomPanResponder();

    // Image processing (unchanged)
    const processImages = () => {
      if (isVideo && item.video?.url) {
        const videoUri = sanitizeImageUrl(item.video.url);
        return [{ uri: videoUri, id: 0, isVideo: true }];
      }
      if (item.images && Array.isArray(item.images) && item.images.length > 0) {
        const processedImages = item.images.map((img, index) => {
          let imageUri = null;
          if (typeof img === 'string') {
            imageUri = sanitizeImageUrl(img);
          } else if (img && typeof img === 'object') {
            const rawUri = img.url || img.uri;
            imageUri = sanitizeImageUrl(rawUri);
          }
          if (!imageUri) {
            return { uri: 'https://via.placeholder.com/400/333333/ffffff?text=No+Image', id: index };
          }
          return {
            uri: imageUri,
            id: index,
            isVideo: false
          };
        }).filter(img => img.uri);
        return processedImages;
      }
      return [{ uri: 'https://via.placeholder.com/400/333333/ffffff?text=No+Image', id: 0, isVideo: false }];
    };

    const postImages = processImages();
    const isMultiImage = postImages.length > 1;

    // Handle image scroll for carousel
    const handleImageScroll = (event) => {
      if (isZoomed) return;
      const contentOffset = event.nativeEvent.contentOffset;
      const currentIndex = Math.round(contentOffset.x / imageWidth);
      if (currentIndex !== currentImageIndex && currentIndex >= 0 && currentIndex < postImages.length) {
        setCurrentImageIndex(currentIndex);
      }
    };

    // Animation functions
    const animateHeartButton = (isLiking) => {
      Animated.parallel([
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
        Animated.timing(heartFillAnim, {
          toValue: isLiking ? 1 : 0,
          duration: 300,
          easing: Easing.out(Easing.quad),
          useNativeDriver: false,
        }),
      ]).start();
    };

    const animateCenterHeart = () => {
      centerHeartAnim.setValue(0);
      centerHeartOpacity.setValue(0);
      Animated.parallel([
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

    // Double tap handler (called from PanResponder)
    const handleImageDoubleTap = () => {
      console.log('Double tap detected on image - attempting to like');
      if (!likeOperationInProgress) {
        if (!isLiked) {
          handleLikePress();
        } else {
          animateCenterHeart();
        }
      }
    };

    // Enhanced like handler
    const handleLikePress = async () => {
      if (likeOperationInProgress) {
        return;
      }
      try {
        setLikeOperationInProgress(true);
        const newLikedState = !isLiked;
        const originalLikedState = isLiked;
        const originalLikesCount = likesCount;
        const newLikesCount = newLikedState ? likesCount + 1 : Math.max(0, likesCount - 1);

        setIsLiked(newLikedState);
        setLikesCount(newLikesCount);
        animateHeartButton(newLikedState);
        if (newLikedState) {
          animateCenterHeart();
        }

        const result = await handleLike(item._id, originalLikedState);
        if (result.success) {
          const serverLikeCount = result.data?.likeCount !== undefined ? result.data.likeCount : result.data?.realTimeLikes || newLikesCount;
          const serverIsLiked = result.data?.isLiked !== undefined ? result.data.isLiked : newLikedState;
          setIsLiked(serverIsLiked);
          setLikesCount(Math.max(0, serverLikeCount));
          if (serverIsLiked !== newLikedState) {
            animateHeartButton(serverIsLiked);
          }
        } else {
          setIsLiked(originalLikedState);
          setLikesCount(originalLikesCount);
          animateHeartButton(originalLikedState);
        }
      } catch (error) {
        console.error('Like operation error:', error);
        setIsLiked(item.isLikedByUser || false);
        setLikesCount(item.likeCount || item.likes || 0);
        animateHeartButton(item.isLikedByUser || false);
        Alert.alert('Error', 'Failed to update like. Please try again.');
      } finally {
        setLikeOperationInProgress(false);
      }
    };

    // Navigation handlers
    const handleCommentPress = () => {
      if (!navigation) {
        Alert.alert('Error', 'Navigation not available');
        return;
      }
      try {
        navigation.navigate('CommentScreen', {
          postId: item._id,
          postData: {
            ...item,
            commentsCount: commentsCount,
            likesCount: likesCount,
          },
          onCommentUpdate: (newCount, realTimeComments) => {
            const finalCount = realTimeComments !== undefined ? realTimeComments : newCount;
            setCommentsCount(finalCount);
          }
        });
      } catch (navigationError) {
        console.error('Navigation error:', navigationError);
        Alert.alert('Error', 'Unable to open comments at this time');
      }
    };

    const handleLikesPress = () => {
      if (likesCount > 0 && navigation) {
        try {
          navigation.navigate('LikeScreen', {
            postId: item._id,
            initialLikeCount: likesCount,
          });
        } catch (error) {
          console.error('Error navigating to LikeScreen:', error);
          Alert.alert('Error', 'Unable to view likes at this time');
        }
      } else if (likesCount === 0) {
        Alert.alert('No Likes', 'This post has no likes yet');
      }
    };

    const handleProfilePress = () => {
      try {
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

    // Render pagination dots
    const renderPaginationDots = () => {
      if (!isMultiImage) return null;
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

    // Render zoomable image with PanResponder
    const renderZoomableImage = (image, index) => {
      if (!image?.uri) {
        return null;
      }
      
      if (image.isVideo) {
        return (
          <View key={image.id || index} style={styles.carouselImageContainer}>
            <Video
              source={{ uri: image.uri }}
              style={styles.postImage}
              controls={true}
              resizeMode="cover"
              paused={true}
              onError={(error) => {
                console.log('Video error:', error);
              }}
            />
          </View>
        );
      }

      return (
        <Animated.View
          key={image.id || index}
          style={[
            styles.carouselImageContainer,
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
            source={{ uri: image.uri }}
            style={styles.postImage}
            onError={(error) => {
              console.log('Image error:', error?.nativeEvent?.error);
            }}
          />
        </Animated.View>
      );
    };

    // Render image content
    const renderImageContent = () => {
      if (!postImages || postImages.length === 0 || !postImages[0]?.uri) {
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
              scrollEnabled={!isZoomed}
            >
              {postImages.map((image, index) => renderZoomableImage(image, index))}
            </ScrollView>
            <Animated.View
              style={[
                styles.centerHeartContainer,
                { opacity: centerHeartOpacity, transform: [{ scale: centerHeartAnim }] }
              ]}
              pointerEvents="none"
            >
              <View style={styles.centerHeartWrapper}>
                <Ionicons name="heart" size={100} color="#E93A7A" style={styles.centerHeart} />
              </View>
            </Animated.View>
            {!isZoomed && renderPaginationDots()}
            {!isZoomed && (
              <View style={styles.imageCounterContainer}>
                <Text style={styles.imageCounterText}>
                  {currentImageIndex + 1}/{postImages.length}
                </Text>
              </View>
            )}
          </View>
        );
      } else {
        return (
          <View style={styles.imageContainer}>
            <Animated.View
              style={[
                styles.postImageContainer,
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
              {postImages[0].isVideo ? (
                <Video
                  source={{ uri: postImages[0].uri }}
                  style={styles.postImage}
                  controls={true}
                  resizeMode="cover"
                  paused={true}
                />
              ) : (
                <Image
                  source={{ uri: postImages[0].uri }}
                  style={styles.postImage}
                />
              )}
              <Animated.View
                style={[
                  styles.centerHeartContainer,
                  { opacity: centerHeartOpacity, transform: [{ scale: centerHeartAnim }] }
                ]}
                pointerEvents="none"
              >
                <View style={styles.centerHeartWrapper}>
                  <Ionicons name="heart" size={100} color="#E93A7A" style={styles.centerHeart} />
                </View>
              </Animated.View>
            </Animated.View>
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
          
          {/* Edit menu (only for own posts) */}
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

        {/* Enhanced image content with PanResponder zoom and double tap */}
        {renderImageContent()}

        {/* Action buttons below post */}
        <View style={styles.postFooterContainer}>
          <View style={styles.leftContent}>
            <Text style={styles.caption}>
              <Text style={{ fontWeight: "bold" }}>{authorName}</Text>
              {(item.content || item.caption) && (item.content || item.caption).trim().length > 0 && (
                <Text> {item.content || item.caption}</Text>
              )}
            </Text>
            {likesCount > 0 && (
              <TouchableOpacity onPress={handleLikesPress} activeOpacity={0.8}>
                <Text style={styles.likesText}>
                  {likesCount} {likesCount === 1 ? 'like' : 'likes'}
                </Text>
              </TouchableOpacity>
            )}
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

  const initialCaptionForModal = editingItem ? (editingItem.content || editingItem.caption || '') : '';

  return (
    <SafeAreaView style={styles.screenContainer}>
      <StatusBar barStyle="light-content" backgroundColor="black" />
      <EditCaptionModal
        isVisible={isEditModalVisible}
        initialCaption={initialCaptionForModal}
        onSave={executeCaptionUpdate}
        onClose={closeEditModal}
        isUpdating={updatingCaption}
        editingItem={editingItem}
      />
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Posts</Text>
        <View style={styles.headerSpacer} />
      </View>
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
    overflow: 'hidden',
  },
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
  postImage: {
    width: "100%",
    height: imageHeight,
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
  editModalFullscreen: {
    flex: 1,
    backgroundColor: 'black',
  },
  editModalContentFixed: {
    flex: 1,
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
    paddingTop: Platform.OS === 'ios' ? 50 : 12,
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