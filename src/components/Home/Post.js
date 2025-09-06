// src/components/Home/Post.js
import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Image,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
  Alert,
  ScrollView,
  Dimensions,
  PanResponder,
  TextInput,
  ActivityIndicator
} from "react-native";
import Ionicons from 'react-native-vector-icons/Ionicons';
import Modal from 'react-native-modal';
import { useAuth } from '../../context/AuthContext'; // Ensure path is correct

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const imageWidth = screenWidth - 20;
const BASE_URL = "https://backendforheartlink.in"; // Ensure this matches your config

const Post = ({ data, navigation, onLikeUpdate }) => {
  const { token, user, refreshToken, isAuthenticated } = useAuth();
  const [isLiked, setIsLiked] = useState(data?.isLiked || false);
  const [likesCount, setLikesCount] = useState(data?.likes || 0);
  // ✅ FIX 1: Better initialization with all possible field names and proper logging
  const [commentsCount, setCommentsCount] = useState(() => {
    // Check all possible field names for comments count
    const possibleCount =
      data?.commentsCount ||
      data?.commentCount ||
      data?.comments ||
      data?.totalComments ||
      data?.comment_count ||
      data?.numberOfComments ||
      0;
    console.log('📊 Initial comments count setup:', {
      postId: data?._id || data?.id,
      commentsCount: data?.commentsCount,
      commentCount: data?.commentCount,
      comments: data?.comments,
      totalComments: data?.totalComments,
      finalCount: possibleCount
    });
    return possibleCount;
  });
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [likeOperationInProgress, setLikeOperationInProgress] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const scrollViewRef = useRef(null);
  const [isReportModalVisible, setReportModalVisible] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportComment, setReportComment] = useState('');
  const [isReporting, setIsReporting] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const [isZooming, setIsZooming] = useState(false);
  const zoomScale = useRef(new Animated.Value(1)).current;
  const zoomTranslateX = useRef(new Animated.Value(0)).current;
  const zoomTranslateY = useRef(new Animated.Value(0)).current;

  // --- NEW: Enhanced double tap detection refs (like in PhotoViewerScreen.js) ---
  const lastTapRef = useRef(null);
  const tapTimeoutRef = useRef(null);
  // --- END: New double tap refs ---

  const heartScaleAnim = useRef(new Animated.Value(1)).current;
  const centerHeartAnim = useRef(new Animated.Value(0)).current;
  const centerHeartOpacity = useRef(new Animated.Value(0)).current;
  const heartFillAnim = useRef(new Animated.Value(isLiked ? 1 : 0)).current;

  const safeGet = (obj, property, fallback = '') => {
    try {
      return obj && obj[property] !== undefined ? obj[property] : fallback;
    } catch (error) {
      console.error('Error accessing property:', property, error);
      return fallback;
    }
  };

  // --- NEW: Cleanup timeout on unmount (like in PhotoViewerScreen.js) ---
  useEffect(() => {
    return () => {
      if (tapTimeoutRef.current) {
        clearTimeout(tapTimeoutRef.current);
      }
    };
  }, []);
  // --- END: Cleanup timeout ---

  // ✅ FIX 2: Enhanced effect to sync comments count with more field checks
  useEffect(() => {
    const newCommentsCount =
      data?.commentsCount ||
      data?.commentCount ||
      data?.comments ||
      data?.totalComments ||
      data?.comment_count ||
      data?.numberOfComments ||
      0;
    if (newCommentsCount !== commentsCount) {
      console.log('📝 Updating comments count from data prop change:', commentsCount, '->', newCommentsCount);
      setCommentsCount(newCommentsCount);
    }
  }, [
    data?.commentsCount,
    data?.commentCount,
    data?.comments,
    data?.totalComments,
    data?.comment_count,
    data?.numberOfComments
  ]);

  // ✅ FIX 3: Add effect to fetch actual comments count if it's missing
  useEffect(() => {
    // Only fetch if we have a valid post ID and the count seems to be missing or 0
    const postId = data?._id || data?.id;
    if (postId && commentsCount === 0 && token && isAuthenticated) {
      fetchCommentsCount(postId);
    }
  }, [data?._id, data?.id]);

  // ✅ FIX 4: New function to fetch comments count from API
  const fetchCommentsCount = async (postId) => {
    try {
      console.log('🔄 Fetching actual comments count for post:', postId);
      const response = await makeAuthenticatedRequest(
        `${BASE_URL}/api/v1/posts/${postId}/comments?page=1&limit=1`
      );
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data?.pagination?.totalComments !== undefined) {
          const actualCount = result.data.pagination.totalComments;
          console.log('✅ Fetched actual comments count:', actualCount);
          setCommentsCount(actualCount);
        }
      }
    } catch (error) {
      console.log('⚠️ Could not fetch comments count:', error.message);
      // Don't show error to user as this is a background operation
    }
  };

  if (!data || typeof data !== 'object') {
    console.warn('Post component received invalid data:', data);
    return null;
  }
  if (!isAuthenticated || !token) {
    return (
      <View style={[styles.container, { paddingVertical: 20 }]}>
        <Text style={{ color: 'white', textAlign: 'center' }}>
          Please log in to view posts
        </Text>
      </View>
    );
  }
  // Use the post ID directly from the transformed data
  const postId = data._id || data.id;
  if (!postId) {
    console.warn('⚠ No valid post ID found in data:', data);
    return (
      <View style={[styles.container, { paddingVertical: 20 }]}>
        <Text style={{ color: 'white', textAlign: 'center' }}>
          Invalid post data - missing post ID
        </Text>
      </View>
    );
  }
  console.log('✅ Post component using postId:', postId);
  const userId = data?.user?._id || data?.user?.id || data?.userId || data?.authorId;
  const isOwnPost = userId && user && (userId === user.id || userId === user._id);
  const shouldShowFollowButton = userId && userId !== 'unknown' && !isOwnPost;
  const shouldShowReportButton = userId && userId !== 'unknown' && !isOwnPost;

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

  const processImages = () => {
    console.log('🔍 Processing images for post:', postId);
    if (data.images && Array.isArray(data.images) && data.images.length > 1) {
      console.log('📷 TRUE Multi-image post detected:', data.images.length, 'images');
      const processedImages = data.images.map((img, index) => {
        let imageUri = null;
        if (typeof img === 'string') {
          imageUri = sanitizeImageUrl(img);
        } else if (img && typeof img === 'object') {
          const rawUri = img.cdnUrl || img.url || img.uri;
          imageUri = sanitizeImageUrl(rawUri);
        }
        if (!imageUri) {
          return { uri: 'https://via.placeholder.com/400/333333/ffffff?text=No+Image', id: index };
        }
        return {
          uri: imageUri,
          id: index,
          size: img?.size,
          key: img?.key,
          compressed: img?.compressed
        };
      }).filter(img => img.uri);
      return processedImages;
    }
    let singleImageUri = null;
    if (data.images && Array.isArray(data.images) && data.images.length === 1) {
      const img = data.images[0];
      let rawUri = null;
      if (typeof img === 'string') {
        rawUri = img;
      } else if (img && typeof img === 'object') {
        rawUri = img.cdnUrl || img.url || img.uri;
      }
      singleImageUri = sanitizeImageUrl(rawUri);
    }
    if (!singleImageUri) {
      const postImg = safeGet(data, 'postImg', null);
      if (postImg) {
        const rawUri = typeof postImg === 'string' ? postImg : postImg.uri;
        singleImageUri = sanitizeImageUrl(rawUri);
      }
    }
    if (!singleImageUri) {
      const imageData = data.image || data.photo;
      if (imageData) {
        const rawUri = typeof imageData === 'string' ? imageData : imageData.uri;
        singleImageUri = sanitizeImageUrl(rawUri);
      }
    }
    if (singleImageUri) {
      return [{ uri: singleImageUri, id: 0 }];
    }
    return [{ uri: 'https://via.placeholder.com/400/333333/ffffff?text=No+Image', id: 0 }];
  };

  const postImages = processImages();
  const isMultiImage = postImages.length > 1;
  const userImg = safeGet(data, 'userImg', { uri: 'https://via.placeholder.com/50/333333/ffffff?text=User' });
  const username = safeGet(data, 'username', 'Unknown User');
  const caption = safeGet(data, 'caption', '');
  const userInitials = safeGet(data, 'userInitials', '?');
  const avatarColor = safeGet(data, 'avatarColor', '#FF6B6B');
  const hasProfilePic = safeGet(data, 'hasProfilePic', false);
  const safeUserImg = typeof userImg === 'string' ? { uri: userImg } : userImg;

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

  const createZoomPanResponder = () => {
    let initialDistance = 0;
    let initialScale = 1;
    let lastScale = 1;
    let lastTranslateX = 0;
    let lastTranslateY = 0;
    // --- NEW: Variables for double-tap detection ---
    const DOUBLE_PRESS_DELAY = 300;
    // --- END: New variables ---
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
      const imageHeight = 500;
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
      // --- MODIFIED: onStartShouldSetPanResponder ---
      onStartShouldSetPanResponder: (evt) => {
        const touches = evt.nativeEvent.touches;
        console.log(`Touches started: ${touches.length}`);

        // --- NEW/UPDATED: Double Tap Detection Logic for Liking ---
        if (touches.length === 1) { // Only check for double tap on single touch start
          const now = Date.now();
          const DOUBLE_TAP_DELAY = 300;

          if (lastTapRef.current && (now - lastTapRef.current) < DOUBLE_TAP_DELAY) {
            // Double tap detected!
            console.log('🔥 Double tap for LIKE detected in onStartShouldSetPanResponder!');

            // Clear any pending single tap timeout to prevent conflicting actions
            if (tapTimeoutRef.current) {
              clearTimeout(tapTimeoutRef.current);
              tapTimeoutRef.current = null;
            }

            // Immediately trigger the like action
            handleImageDoubleTap(); // This calls handleLikePress internally

            lastTapRef.current = null; // Reset double tap tracking
            return false; // Crucially, prevent the PanResponder from activating for zoom/pan
          } else {
            // First tap of a potential double tap sequence
            lastTapRef.current = now;
            // Do not return true here yet, let onMove or onPanResponderRelease decide
            // based on movement or release.
          }
        }
        // --- END: Double Tap Detection ---

        // Allow PanResponder to activate for multi-touch (pinch to zoom) or if already zoomed (for panning)
        return touches.length >= 2 || isZoomed;
      },
      // Respond to multi-touch moves or dragging when zoomed and moved significantly
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
        // No specific action needed for single touch grant in this setup
      },
      onPanResponderMove: (evt, gestureState) => {
        const touches = evt.nativeEvent.touches;
        if (touches.length >= 2) {
          const distance = getDistance(touches);
          if (initialDistance > 0) {
            const newScale = Math.max(1, Math.min(3, (distance / initialDistance) * initialScale));
            const scaleChange = newScale - initialScale;
            const imageHeight = 500;
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
      // --- MODIFIED: onPanResponderRelease ---
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

          // --- NEW/UPDATED: Handle Single Tap Confirmation for Double-Tap Sequence ---
          // Check if this release was from a single tap (only one touch released and minimal movement)
          if (evt.nativeEvent.changedTouches.length === 1 &&
              Math.abs(gestureState.dx) < 10 &&
              Math.abs(gestureState.dy) < 10) {

            // This looks like a single tap release. Set a timeout.
            // If a second tap comes quickly, the onStartShouldSetPanResponder logic will catch it,
            // clear this timeout, and perform the like.
            // If no second tap comes, this timeout executes (you can add single tap actions here if needed).
            if (tapTimeoutRef.current) {
              clearTimeout(tapTimeoutRef.current); // Clear any existing timeout
            }
            // Set timeout for potential single tap action or just to finalize the double-tap check cycle
            tapTimeoutRef.current = setTimeout(() => {
              console.log('👆 Single tap confirmed (from PanResponder release)');
              // Perform single tap action here if needed (e.g., hide/show UI elements)
              // Currently, we just use it to complete the double-tap detection cycle cleanly.
              tapTimeoutRef.current = null;
              // Ensure lastTapRef is cleared if it wasn't already (e.g., if timeout wasn't cleared by a second tap)
              // This handles cases where the second tap might not have been fast enough or was missed slightly.
              lastTapRef.current = null;
            }, 300); // Use the same delay as DOUBLE_TAP_DELAY
          }
          // --- END: Handle Single Tap ---
        }
      },
      onPanResponderTerminate: () => {
        zoomScale.flattenOffset();
        zoomTranslateX.flattenOffset();
        zoomTranslateY.flattenOffset();
        // Clear any pending double tap timeouts if gesture is terminated
        if (tapTimeoutRef.current) {
          clearTimeout(tapTimeoutRef.current);
          tapTimeoutRef.current = null;
        }
        lastTapRef.current = null;
      },
    });
  };

  const zoomPanResponder = createZoomPanResponder();

  const getValidAuthToken = async () => {
    try {
      console.log('🔑 Getting auth token...');
      if (!token || !isAuthenticated) {
        console.error('❌ No token or not authenticated');
        return null;
      }
      return token;
    } catch (error) {
      console.error('❌ Error getting auth token:', error);
      return null;
    }
  };

  const makeAuthenticatedRequest = async (url, options = {}) => {
    let authToken = await getValidAuthToken();
    if (!authToken) {
      throw new Error('No valid authentication token available');
    }
    const requestOptions = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
        ...options.headers,
      },
    };
    console.log('🌐 Making authenticated request:', { url, method: requestOptions.method || 'GET' });
    let response = await fetch(url, requestOptions);
    if (response.status === 401) {
      console.log('🔄 Got 401, attempting token refresh...');
      const refreshSuccess = await refreshToken();
      if (refreshSuccess) {
        authToken = await getValidAuthToken();
        if (authToken) {
          requestOptions.headers.Authorization = `Bearer ${authToken}`;
          console.log('🔄 Retrying request with new token...');
          response = await fetch(url, requestOptions);
        } else {
          throw new Error('Failed to get new token after refresh');
        }
      } else {
        throw new Error('Token refresh failed - please log in again');
      }
    }
    return response;
  };

  // --- ✅ NEW: Enhanced double tap handler specifically for liking (like in PhotoViewerScreen.js) ---
  const handleImageDoubleTap = () => {
    console.log('💖 Double tap detected on image - attempting to like');
    // Always trigger like on double tap, regardless of current state
    if (!likeOperationInProgress) {
      // If already liked, we could either do nothing or unlike
      // For Instagram-like behavior, double tap should always like (not toggle)
      if (!isLiked) {
        console.log('💖 Post not liked - liking now');
        handleLikePress(); // Call your existing like handler
      } else {
        console.log('💖 Post already liked - showing heart animation anyway');
        // Show the heart animation even if already liked
        animateCenterHeart(); // Call your existing animation
      }
    } else {
      console.log('💖 Like operation in progress - ignoring double tap');
    }
  };

  // --- ✅ NEW: Improved double tap detection for images (like in PhotoViewerScreen.js) ---
  // This function is now primarily used for the double-tap to like logic triggered by the PanResponder
  const handleImagePress = () => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300; // Milliseconds
    if (tapTimeoutRef.current) {
      clearTimeout(tapTimeoutRef.current);
    }
    if (lastTapRef.current && (now - lastTapRef.current) < DOUBLE_TAP_DELAY) {
      // Double tap detected
      console.log('🔥 Double tap detected (via handleImagePress)!');
      lastTapRef.current = null; // Reset to prevent issues
      handleImageDoubleTap(); // Execute the double tap action for liking
    } else {
      // Single tap - wait to see if another tap comes
      lastTapRef.current = now;
      tapTimeoutRef.current = setTimeout(() => {
        // Single tap confirmed (no second tap within delay)
        console.log('👆 Single tap confirmed (via handleImagePress)');
        lastTapRef.current = null;
        // You could add single tap behavior here if needed (e.g., hide/show UI)
        // Note: This path might not be reached if PanResponder handles it first.
      }, DOUBLE_TAP_DELAY);
    }
  };
  // --- END: New double tap handlers ---

  const handleReportPost = async () => {
    if (!postId) {
      Alert.alert('Error', 'Post ID is missing.');
      return;
    }
    if (!reportReason) {
      Alert.alert('Error', 'Please select a reason for reporting.');
      return;
    }
    if (reportComment.length > 500) {
      Alert.alert('Error', 'Comment must be less than 500 characters.');
      return;
    }
    setIsReporting(true);
    try {
      const authToken = await getValidAuthToken();
      if (!authToken) {
        throw new Error('No valid authentication token available');
      }
      const requestBody = { reason: reportReason };
      if (reportComment.trim()) {
        requestBody.comment = reportComment.trim();
      }
      console.log(`Reporting post ${postId} with reason: ${reportReason}`);
      const response = await fetch(`${BASE_URL}/api/v1/posts/${postId}/report`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json', },
        body: JSON.stringify(requestBody),
      });
      const result = await response.json();
      if (response.ok && result.success) {
        console.log('Post reported successfully:', result);
        Alert.alert('Success', 'Post reported successfully. Thank you for helping keep the community safe.');
        setReportModalVisible(false);
        setReportReason('');
        setReportComment('');
      } else {
        let errorMessage = result.message || 'Failed to report post.';
        if (response.status === 400) errorMessage = result.message || 'Invalid report data.';
        else if (response.status === 404) errorMessage = 'Post not found.';
        else if (response.status === 401) errorMessage = 'Authentication failed. Please log in again.';
        else if (response.status === 403) errorMessage = 'You cannot report your own post.';
        console.error('Error reporting post:', errorMessage, result);
        Alert.alert('Error', errorMessage);
      }
    } catch (error) {
      console.error('Network or unexpected error reporting post:', error);
      Alert.alert('Error', 'Failed to report post. Please check your connection and try again.');
    } finally {
      setIsReporting(false);
    }
  };

  const openReportModal = () => {
    if (isOwnPost) {
      Alert.alert('Error', 'You cannot report your own post.');
      return;
    }
    setReportModalVisible(true);
  };

  const closeReportModal = () => {
    setReportModalVisible(false);
    setReportReason('');
    setReportComment('');
  };

  useEffect(() => {
    if (userId && userId !== 'unknown' && !isOwnPost) {
      checkFollowStatus();
    }
  }, [userId, isOwnPost]);

  const checkFollowStatus = async () => {
    try {
      const response = await makeAuthenticatedRequest(`${BASE_URL}/api/v1/users/follow-status/${userId}`);
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          setIsFollowing(result.data.isFollowing || false);
        }
      } else {
        const errorData = await response.json();
        console.warn('Follow status check failed:', errorData.message);
      }
    } catch (error) {
      console.error('Error checking follow status:', error);
    }
  };

  const handleFollowPress = async () => {
    if (!userId || userId === 'unknown') {
      Alert.alert('Error', 'Unable to follow this user');
      return;
    }
    if (followLoading) return;
    try {
      setFollowLoading(true);
      const endpoint = isFollowing
        ? `/api/v1/users/unfollow/${userId}`
        : `/api/v1/users/follow/${userId}`;
      const response = await makeAuthenticatedRequest(`${BASE_URL}${endpoint}`, { method: 'POST' });
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setIsFollowing(!isFollowing);
          const action = isFollowing ? 'Unfollowed' : 'Followed';
          console.log(`${action} ${username} successfully`);
          if (data.onFollowUpdate && typeof data.onFollowUpdate === 'function') {
            data.onFollowUpdate(userId, !isFollowing, result.data);
          }
        } else {
          throw new Error(result.message || 'Failed to update follow status');
        }
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update follow status');
      }
    } catch (error) {
      console.error('Error updating follow status:', error);
      Alert.alert('Error', error.message || 'Failed to update follow status');
    } finally {
      setFollowLoading(false);
    }
  };

  const handleImageScroll = (event) => {
    if (isZoomed) return;
    const contentOffset = event.nativeEvent.contentOffset;
    const currentIndex = Math.round(contentOffset.x / imageWidth);
    if (currentIndex !== currentImageIndex && currentIndex >= 0 && currentIndex < postImages.length) {
      setCurrentImageIndex(currentIndex);
    }
  };

  const animateHeartButton = (isLiking) => {
    Animated.parallel([
      Animated.sequence([
        Animated.timing(heartScaleAnim, { toValue: 1.4, duration: 150, easing: Easing.out(Easing.back(1.5)), useNativeDriver: true, }),
        Animated.timing(heartScaleAnim, { toValue: 1, duration: 150, easing: Easing.out(Easing.quad), useNativeDriver: true, }),
      ]),
      Animated.timing(heartFillAnim, { toValue: isLiking ? 1 : 0, duration: 300, easing: Easing.out(Easing.quad), useNativeDriver: false, }),
    ]).start();
  };

  const animateCenterHeart = () => {
    centerHeartAnim.setValue(0);
    centerHeartOpacity.setValue(0);
    Animated.parallel([
      Animated.sequence([
        Animated.timing(centerHeartOpacity, { toValue: 1, duration: 150, useNativeDriver: true, }),
        Animated.timing(centerHeartOpacity, { toValue: 0, duration: 1000, delay: 300, easing: Easing.out(Easing.quad), useNativeDriver: true, }),
      ]),
      Animated.sequence([
        Animated.timing(centerHeartAnim, { toValue: 1.3, duration: 200, easing: Easing.out(Easing.back(2)), useNativeDriver: true, }),
        Animated.spring(centerHeartAnim, { toValue: 1, tension: 100, friction: 8, useNativeDriver: true, }),
        Animated.timing(centerHeartAnim, { toValue: 0.7, duration: 800, delay: 100, easing: Easing.out(Easing.quad), useNativeDriver: true, }),
      ]),
    ]).start();
  };

  // Enhanced like handler with proper callback
  const handleLikePress = async () => {
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
      console.log('Post ID:', postId);
      console.log('Current state:', { isLiked, likesCount });
      console.log('New state:', { isLiked: newLikedState, likesCount: newLikesCount });
      setIsLiked(newLikedState);
      setLikesCount(newLikesCount);
      animateHeartButton(newLikedState);
      if (newLikedState) {
        animateCenterHeart();
      }
      console.log('Making API request to:', `${BASE_URL}/api/v1/posts/${postId}/like`);
      const response = await makeAuthenticatedRequest(`${BASE_URL}/api/v1/posts/${postId}/like`, { method: 'PATCH' });
      const result = await response.json();
      console.log('API Response:', { status: response.status, success: result.success, data: result.data });
      if (response.ok && result.success) {
        const serverLikeCount = result.data?.likeCount || result.data?.realTimeLikes || newLikesCount;
        const serverIsLiked = result.data?.isLiked !== undefined ? result.data.isLiked : newLikedState;
        console.log('Server response:', { serverIsLiked, serverLikeCount });
        setIsLiked(serverIsLiked);
        setLikesCount(Math.max(0, serverLikeCount));
        if (serverIsLiked !== newLikedState) {
          animateHeartButton(serverIsLiked);
        }
        console.log('✅ Like operation completed successfully');
        if (onLikeUpdate && typeof onLikeUpdate === 'function') {
          try {
            onLikeUpdate(postId, serverIsLiked, serverLikeCount);
          } catch (callbackError) {
            console.error('onLikeUpdate callback error:', callbackError);
          }
        }
      } else {
        console.error('❌ Like API call failed:', { status: response.status, message: result.message, error: result.error });
        setIsLiked(originalLikedState);
        setLikesCount(originalLikesCount);
        animateHeartButton(originalLikedState);
        let errorMessage = 'Failed to update like';
        if (response.status === 401) errorMessage = 'Authentication failed. Please log in again.';
        else if (response.status === 404) errorMessage = 'Post not found';
        else if (response.status === 500) errorMessage = 'Server error. Please try again.';
        else if (result.message) errorMessage = result.message;
        Alert.alert('Error', errorMessage);
      }
    } catch (error) {
      console.error('❌ Like operation error:', error);
      setIsLiked(data?.isLiked || false);
      setLikesCount(data?.likes || 0);
      animateHeartButton(data?.isLiked || false);
      let errorMessage = 'Failed to update like. Please try again.';
      if (error.message.includes('Network request failed')) errorMessage = 'Please check your internet connection and try again';
      else if (error.message.includes('authentication') || error.message.includes('Token')) errorMessage = 'Please log in again to like posts';
      else if (error.message.includes('Post ID')) errorMessage = 'Unable to like this post. Post information is missing.';
      Alert.alert('Error', errorMessage);
    } finally {
      setLikeOperationInProgress(false);
    }
  };

  // ✅ FIX 5: Enhanced comment handler with better state management
  const handleCommentPress = () => {
    console.log('=== COMMENT BUTTON PRESSED ===');
    console.log('Using Post ID:', postId);
    console.log('Current comments count:', commentsCount);
    if (!navigation) {
      console.error('❌ Navigation prop not available');
      Alert.alert('Error', 'Navigation not available');
      return;
    }
    try {
      console.log('✅ Navigating to CommentScreen with postId:', postId);
      navigation.navigate('CommentScreen', {
        postId: postId,
        postData: {
          ...data,
          commentsCount: commentsCount, // Pass current count
          likesCount: likesCount,
        },
        // ✅ FIX 6: Enhanced callback to properly update count
        onCommentUpdate: (newCount, realTimeComments) => {
          console.log('📝 Comment count updated from CommentScreen:');
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

  const handleLikesPress = () => {
    console.log('=== LIKES NAVIGATION DEBUG ===');
    console.log('Likes count:', likesCount);
    console.log('Using Post ID:', postId);
    console.log('Navigation available:', !!navigation);
    if (likesCount > 0 && navigation) {
      try {
        console.log('✅ Navigating to LikeScreen with postId:', postId);
        navigation.navigate('LikeScreen', {
          postId: postId,
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
      console.log('Profile press triggered for:', username);
      console.log('Navigation object:', !!navigation);
      console.log('User data:', data.user);
      if (data.onProfilePress && typeof data.onProfilePress === 'function') {
        console.log('Using custom onProfilePress handler');
        data.onProfilePress();
      } else if (navigation && userId && userId !== 'unknown') {
        console.log('Navigating to UserProfile with userId:', userId);
        navigation.navigate('UserProfile', {
          userId: userId,
          fromFeed: true
        });
      } else {
        console.warn('Navigation failed - missing navigation or user ID');
        if (!navigation) console.error('Navigation prop not passed to Post component');
        if (!userId || userId === 'unknown') console.error('User ID not available in post data');
      }
    } catch (error) {
      console.error('Error handling profile press:', error);
    }
  };

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

  const renderZoomableImage = (image, index) => {
    if (!image?.uri) {
      console.log(`⚠️ Skipping image ${index + 1} - no valid URI`);
      return null;
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
            console.log(`❌ Post image ${index + 1} error:`, error?.nativeEvent?.error);
            console.log(`❌ Failed image URI:`, image.uri);
          }}
          onLoad={() => {
            console.log(`✅ Post image ${index + 1} loaded successfully:`, image.uri);
          }}
        />
      </Animated.View>
    );
  };

  const renderImageContent = () => {
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
            <Image
              source={{ uri: postImages[0].uri }}
              style={styles.postImage}
              onError={(error) => {
                console.log('❌ Single post image error:', error?.nativeEvent?.error);
                console.log('❌ Failed image URI:', postImages[0].uri);
              }}
              onLoad={() => {
                console.log('✅ Single post image loaded successfully:', postImages[0].uri);
              }}
            />
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
                { backgroundColor: avatarColor }
              ]}
            >
              {hasProfilePic ? (
                <Image
                  source={safeUserImg}
                  style={styles.profileImage}
                  onError={(error) => {
                    console.log('Profile image error:', error?.nativeEvent?.error);
                  }}
                />
              ) : (
                <Text style={styles.avatarText}>
                  {userInitials}
                </Text>
              )}
            </View>
          </View>
        </TouchableOpacity>
        <View style={styles.userInfoContent}>
          <TouchableOpacity onPress={handleProfilePress} activeOpacity={0.8}>
            <Text style={styles.username}>{username}</Text>
          </TouchableOpacity>
        </View>
        {shouldShowFollowButton && (
          <TouchableOpacity
            style={[
              styles.followButton,
              isFollowing ? styles.followingButton : styles.followNotFollowingButton
            ]}
            onPress={handleFollowPress}
            disabled={followLoading}
            activeOpacity={0.8}
          >
            <Text style={[
              styles.followButtonText,
              isFollowing ? styles.followingButtonText : styles.followNotFollowingButtonText
            ]}>
              {followLoading ? 'Loading...' : (isFollowing ? 'Following' : 'Follow')}
            </Text>
          </TouchableOpacity>
        )}
        {shouldShowReportButton && (
          <TouchableOpacity
            style={styles.menuButton}
            onPress={openReportModal}
            activeOpacity={0.7}
          >
            <Ionicons name="ellipsis-horizontal" size={20} color="white" />
          </TouchableOpacity>
        )}
      </View>
      {renderImageContent()}
      <View style={styles.postFooterContainer}>
        <View style={styles.leftContent}>
          <Text style={styles.caption}>
            <Text style={{ fontWeight: 'bold' }}>{username}</Text>
            {caption.trim().length > 0 && <Text> {caption}</Text>}
          </Text>
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
          {data.timeAgo && (
            <Text style={styles.timeText}>{data.timeAgo}</Text>
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
      <Modal
        isVisible={isReportModalVisible}
        onBackdropPress={closeReportModal}
        onBackButtonPress={closeReportModal}
        backdropOpacity={0.7}
        style={styles.modalContainer}
        avoidKeyboard={true}
      >
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Report Post</Text>
          <Text style={styles.modalSubtitle}>Why are you reporting this post?</Text>
          {['spam', 'inappropriate', 'harassment', 'misinformation', 'other'].map((reason) => (
            <TouchableOpacity
              key={reason}
              style={[
                styles.reasonOption,
                reportReason === reason && styles.selectedReasonOption
              ]}
              onPress={() => setReportReason(reason)}
            >
              <Text
                style={[
                  styles.reasonText,
                  reportReason === reason && styles.selectedReasonText
                ]}
              >
                {reason.charAt(0).toUpperCase() + reason.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
          <TextInput
            style={styles.commentInput}
            placeholder="Add a comment (optional, max 500 chars)"
            placeholderTextColor="#888"
            value={reportComment}
            onChangeText={setReportComment}
            multiline
            numberOfLines={3}
            maxLength={500}
            editable={!isReporting}
          />
          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.modalButton, styles.cancelButton]}
              onPress={closeReportModal}
              disabled={isReporting}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, styles.reportButton]}
              onPress={handleReportPost}
              disabled={isReporting || !reportReason}
            >
              {isReporting ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text style={styles.reportButtonText}>Report</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// [Styles remain the same as in original file]
const styles = StyleSheet.create({
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
  userInfoContent: {
    flex: 1,
  },
  username: {
    color: "white",
    fontSize: 14,
    fontWeight: '600',
  },
  // Follow Button Styles
  followButton: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 10,
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  followNotFollowingButton: {
    backgroundColor: '#E93A7A',
    borderWidth: 1,
    borderColor: '#E93A7A',
  },
  followingButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#666',
  },
  followButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  followNotFollowingButtonText: {
    color: 'white',
  },
  followingButtonText: {
    color: '#666',
  },
  menuButton: {
    padding: 8,
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
    height: 500,
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
  // Report Modal Styles
  modalContainer: {
    justifyContent: 'center',
    margin: 20,
  },
  modalContent: {
    backgroundColor: 'black',
    borderColor: '#333',
    borderWidth: 1,
    borderRadius: 10,
    padding: 20,
    alignItems: 'stretch',
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 5,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#ccc',
    marginBottom: 15,
    textAlign: 'center',
  },
  reasonOption: {
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  selectedReasonOption: {
    backgroundColor: '#333',
  },
  reasonText: {
    fontSize: 16,
    color: '#ddd',
  },
  selectedReasonText: {
    color: '#E93A7A',
    fontWeight: '600',
  },
  commentInput: {
    backgroundColor: '#222',
    borderRadius: 8,
    padding: 10,
    marginTop: 15,
    color: 'white',
    fontSize: 14,
    textAlignVertical: 'top',
    minHeight: 60,
    maxHeight: 100,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  cancelButton: {
    backgroundColor: '#333',
    borderWidth: 1,
    borderColor: '#555',
  },
  reportButton: {
    backgroundColor: '#E93A7A',
  },
  cancelButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  reportButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default Post;