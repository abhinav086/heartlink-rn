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
  TextInput, // Add TextInput for comment
  ActivityIndicator // Add ActivityIndicator for reporting state
} from "react-native";
import Ionicons from 'react-native-vector-icons/Ionicons';
import Modal from 'react-native-modal'; // Add Modal for report UI
import { useAuth } from '../../context/AuthContext'; // Import useAuth hook

// Get screen dimensions for image sizing
const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const imageWidth = screenWidth - 20; // Account for container padding

// Use the correct API base URL
const BASE_URL = "https://backendforheartlink.in";

const Post = ({ data, navigation, onLikeUpdate }) => {
  // Get auth context
  const { token, user, refreshToken, isAuthenticated } = useAuth();
  
  // State for like functionality
  const [isLiked, setIsLiked] = useState(data?.isLiked || false);
  const [likesCount, setLikesCount] = useState(data?.likes || 0);
  
  // State for comments functionality
  const [commentsCount, setCommentsCount] = useState(data?.commentsCount || data?.comments || 0);
  
  // State for follow functionality
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  
  // State for like operation
  const [likeOperationInProgress, setLikeOperationInProgress] = useState(false);
  
  // State for image carousel
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const scrollViewRef = useRef(null);

  // NEW: State for Report functionality
  const [isReportModalVisible, setReportModalVisible] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportComment, setReportComment] = useState('');
  const [isReporting, setIsReporting] = useState(false);

  // NEW: Zoom functionality state
  const [isZoomed, setIsZoomed] = useState(false);
  const [isZooming, setIsZooming] = useState(false);
  const zoomScale = useRef(new Animated.Value(1)).current;
  const zoomTranslateX = useRef(new Animated.Value(0)).current;
  const zoomTranslateY = useRef(new Animated.Value(0)).current;
  
  // Animation refs for effects
  const heartScaleAnim = useRef(new Animated.Value(1)).current;
  const centerHeartAnim = useRef(new Animated.Value(0)).current;
  const centerHeartOpacity = useRef(new Animated.Value(0)).current;
  const heartFillAnim = useRef(new Animated.Value(isLiked ? 1 : 0)).current;
  
  // Safe property access
  const safeGet = (obj, property, fallback = '') => {
    try {
      return obj && obj[property] !== undefined ? obj[property] : fallback;
    } catch (error) {
      console.error('Error accessing property:', property, error);
      return fallback;
    }
  };
  
  // Validate data input
  if (!data || typeof data !== 'object') {
    console.warn('Post component received invalid data:', data);
    return null;
  }
  
  // Check if user is authenticated
  if (!isAuthenticated || !token) {
    return (
      <View style={[styles.container, { paddingVertical: 20 }]}>
        <Text style={{ color: 'white', textAlign: 'center' }}>
          Please log in to view posts
        </Text>
      </View>
    );
  }
  
  // FIXED: Consistent post ID extraction - use this EVERYWHERE in the component
  const getConsistentPostId = () => {
    const possibleIds = [
      data?.id,
      data?._id, 
      data?.postId,
      data?.post?.id,
      data?.post?._id
    ];
    const validId = possibleIds.find(id => id && typeof id === 'string' && id.length > 0);
    console.log('📍 Post ID extraction:', {
      'data.id': data?.id,
      'data._id': data?._id,
      'data.postId': data?.postId,
      'data.post?.id': data?.post?.id,
      'data.post?._id': data?.post?._id,
      'selected': validId
    });
    return validId;
  };
  
  // Use this SINGLE postId throughout the component
  const postId = getConsistentPostId();
  
  // Add validation for postId
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
  console.log('✅ Post component using consistent postId:', postId);

  // Get user ID for follow and report functionality
  const userId = data?.user?._id || data?.user?.id || data?.userId || data?.authorId;
  // UPDATED: Check if this is the current user's post
  const isOwnPost = userId && user && (userId === user.id || userId === user._id);
  const shouldShowFollowButton = userId && userId !== 'unknown' && !isOwnPost;
  // NEW: Determine if we should show the report button (not own post)
  const shouldShowReportButton = userId && userId !== 'unknown' && !isOwnPost;
  
  // NEW: URL sanitization function to fix double protocols
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
    console.log('🧹 URL sanitized:', { original: url, cleaned: cleanUrl });
    return cleanUrl;
  };
  
  // FIXED: Enhanced image processing with URL sanitization
  const processImages = () => {
    console.log('🔍 Processing images for post:', postId);
    console.log('🔍 Available image data:', {
      'data.images': data.images,
      'data.postImg': data.postImg,
      'data.image': data.image,
      'data.photo': data.photo
    });
    
    // Check for multi-image array first (new API format)
    if (data.images && Array.isArray(data.images) && data.images.length > 1) {
      console.log('📷 TRUE Multi-image post detected:', data.images.length, 'images');
      const processedImages = data.images.map((img, index) => {
        let imageUri = null;
        // Handle different image object formats
        if (typeof img === 'string') {
          imageUri = sanitizeImageUrl(img);
          console.log(`📷 Image ${index + 1}: string format -`, imageUri);
        } else if (img && typeof img === 'object') {
          // Prioritize cdnUrl for optimized images, fallback to url, then uri
          const rawUri = img.cdnUrl || img.url || img.uri;
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
          size: img?.size,
          key: img?.key,
          compressed: img?.compressed
        };
      }).filter(img => img.uri); // Remove any images without valid URIs
      
      console.log('📷 Processed multi-images:', processedImages);
      return processedImages;
    }
    
    // Single image logic - PRESERVE ORIGINAL WORKING LOGIC with URL sanitization
    let singleImageUri = null;
    
    // Try data.images[0] first if it exists (some APIs return single image in array)
    if (data.images && Array.isArray(data.images) && data.images.length === 1) {
      const img = data.images[0];
      let rawUri = null;
      if (typeof img === 'string') {
        rawUri = img;
      } else if (img && typeof img === 'object') {
        rawUri = img.cdnUrl || img.url || img.uri;
      }
      singleImageUri = sanitizeImageUrl(rawUri);
      console.log('📷 Single image from array:', singleImageUri);
    }
    
    // Fallback to original postImg logic (PRESERVE ORIGINAL)
    if (!singleImageUri) {
      const postImg = safeGet(data, 'postImg', null);
      if (postImg) {
        const rawUri = typeof postImg === 'string' ? postImg : postImg.uri;
        singleImageUri = sanitizeImageUrl(rawUri);
        console.log('📷 Single image from postImg:', singleImageUri);
      }
    }
    
    // Additional fallbacks
    if (!singleImageUri) {
      const imageData = data.image || data.photo;
      if (imageData) {
        const rawUri = typeof imageData === 'string' ? imageData : imageData.uri;
        singleImageUri = sanitizeImageUrl(rawUri);
        console.log('📷 Single image from image/photo:', singleImageUri);
      }
    }
    
    if (singleImageUri) {
      console.log('📷 Final single image URI:', singleImageUri);
      return [{ uri: singleImageUri, id: 0 }];
    }
    
    // No images found - return placeholder
    console.log('📷 No valid images found, using placeholder');
    return [{ uri: 'https://via.placeholder.com/400/333333/ffffff?text=No+Image', id: 0 }];
  };
  
  const postImages = processImages();
  const isMultiImage = postImages.length > 1;
  
  console.log('📷 Final processed images:', {
    count: postImages.length,
    isMultiImage,
    firstImageUri: postImages[0]?.uri,
    allImages: postImages
  });
  
  // Safe data extraction with fallbacks
  const userImg = safeGet(data, 'userImg', { uri: 'https://via.placeholder.com/50/333333/ffffff?text=User' });
  const username = safeGet(data, 'username', 'Unknown User');
  const caption = safeGet(data, 'caption', '');
  
  // Avatar data
  const userInitials = safeGet(data, 'userInitials', '?');
  const avatarColor = safeGet(data, 'avatarColor', '#FF6B6B');
  const hasProfilePic = safeGet(data, 'hasProfilePic', false);
  
  // Ensure image objects have proper structure
  const safeUserImg = typeof userImg === 'string' ? { uri: userImg } : userImg;
  
  console.log('Follow button logic:', {
    userId,
    currentUserId: user?.id || user?._id,
    isOwnPost,
    shouldShowFollowButton
  });
  
  // NEW: Zoom functionality
  const resetZoom = () => {
    Animated.parallel([
      Animated.timing(zoomScale, {
        toValue: 1,
        duration: 300,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(zoomTranslateX, {
        toValue: 0,
        duration: 300,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(zoomTranslateY, {
        toValue: 0,
        duration: 300,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setIsZoomed(false);
      setIsZooming(false);
    });
  };
  
  const zoomToPoint = (scale, x = 0, y = 0) => {
    setIsZooming(true);
    Animated.parallel([
      Animated.timing(zoomScale, {
        toValue: scale,
        duration: 300,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(zoomTranslateX, {
        toValue: x,
        duration: 300,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(zoomTranslateY, {
        toValue: y,
        duration: 300,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setIsZoomed(scale > 1);
      setIsZooming(false);
    });
  };
  
  // NEW: Create PanResponder for zoom functionality
  const createZoomPanResponder = () => {
    // [MODIFIED]
    let initialDistance = 0;
    let initialScale = 1;
    let lastScale = 1;
    let lastTranslateX = 0;
    let lastTranslateY = 0;
    let lastTapTime = 0;
    let tapCount = 0;
    
    // NEW: Pinch-to-zoom focal point tracking
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
    
    // [MODIFIED]
    const getCenter = (touches) => {
      if (touches.length < 2) return { x: imageWidth / 2, y: 250 }; // Default to image center
      const [touch1, touch2] = touches;
      // Use locationX/Y for coordinates relative to the image component
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
      onStartShouldSetPanResponder: (evt) => {
        // Always handle if we have 2+ touches (pinch) or if already zoomed
        return evt.nativeEvent.touches.length >= 2 || isZoomed;
      },
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // Handle if we have 2+ touches or if already zoomed and moving
        return evt.nativeEvent.touches.length >= 2 || 
               (isZoomed && (Math.abs(gestureState.dx) > 10 || Math.abs(gestureState.dy) > 10));
      },
      onPanResponderGrant: (evt) => {
        const touches = evt.nativeEvent.touches;
        // [MODIFIED]
        if (touches.length >= 2) {
          // Pinch gesture started
          initialDistance = getDistance(touches);
          initialScale = lastScale;
          // Calculate focal point (center between two fingers)
          const focalPoint = getCenter(touches);
          pinchFocalX = focalPoint.x;
          pinchFocalY = focalPoint.y;
          // Store initial translation values
          initialTranslateX = lastTranslateX;
          initialTranslateY = lastTranslateY;
          zoomScale.setOffset(lastScale - 1);
          zoomScale.setValue(1);
          zoomTranslateX.setOffset(lastTranslateX);
          zoomTranslateX.setValue(0);
          zoomTranslateY.setOffset(lastTranslateY);
          zoomTranslateY.setValue(0);
        } else if (touches.length === 1) {
          // Single touch - check for double tap or pan when zoomed
          const now = Date.now();
          const timeDiff = now - lastTapTime;
          if (timeDiff < 300) {
            tapCount += 1;
          } else {
            tapCount = 1;
          }
          lastTapTime = now;
          if (isZoomed) {
            // Pan gesture when zoomed
            zoomTranslateX.setOffset(lastTranslateX);
            zoomTranslateX.setValue(0);
            zoomTranslateY.setOffset(lastTranslateY);
            zoomTranslateY.setValue(0);
          }
        }
      },
      onPanResponderMove: (evt, gestureState) => {
        const touches = evt.nativeEvent.touches;
        // [MODIFIED]
        if (touches.length >= 2) {
          // Pinch to zoom with focal point adjustment
          const distance = getDistance(touches);
          if (initialDistance > 0) {
            const newScale = Math.max(1, Math.min(3, (distance / initialDistance) * initialScale));
            // Calculate how much the scale has changed from initial
            const scaleChange = newScale - initialScale;
            // Calculate translation adjustment to keep focal point stable
            // Formula: translate = initialTranslate - (scaleChange * (focalPoint - imageCenter))
            const imageHeight = 500;
            const imageCenterX = imageWidth / 2;
            const imageCenterY = imageHeight / 2;
            const adjustedTranslateX = initialTranslateX - (scaleChange * (pinchFocalX - imageCenterX));
            const adjustedTranslateY = initialTranslateY - (scaleChange * (pinchFocalY - imageCenterY));
            // Apply bounds clamping
            const clamped = clampTranslate(adjustedTranslateX, adjustedTranslateY, newScale);
            zoomScale.setValue(newScale);
            // We set the value directly, not the offset, as we are calculating the final position
            zoomTranslateX.setValue(clamped.x);
            zoomTranslateY.setValue(clamped.y);
          }
        } else if (touches.length === 1 && isZoomed) {
          // Pan when zoomed
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
          // All fingers lifted
          zoomScale.flattenOffset();
          zoomTranslateX.flattenOffset();
          zoomTranslateY.flattenOffset();
          // [MODIFIED]
          // Get current values and update state
          const currentScale = lastScale = zoomScale._value;
          lastTranslateX = zoomTranslateX._value;
          lastTranslateY = zoomTranslateY._value;
          // Reset pinch focal point tracking
          pinchFocalX = 0;
          pinchFocalY = 0;
          initialTranslateX = 0;
          initialTranslateY = 0;
          // Clamp translation within bounds
          const clamped = clampTranslate(lastTranslateX, lastTranslateY, currentScale);
          if (clamped.x !== lastTranslateX || clamped.y !== lastTranslateY) {
            lastTranslateX = clamped.x;
            lastTranslateY = clamped.y;
            Animated.parallel([
              Animated.timing(zoomTranslateX, {
                toValue: clamped.x,
                duration: 200,
                useNativeDriver: true,
              }),
              Animated.timing(zoomTranslateY, {
                toValue: clamped.y,
                duration: 200,
                useNativeDriver: true,
              }),
            ]).start();
          }
          // Check for double tap to zoom
          if (tapCount === 2 && gestureState.dx < 10 && gestureState.dy < 10) {
            tapCount = 0;
            if (isZoomed) {
              // Zoom out
              resetZoom();
              lastScale = 1;
              lastTranslateX = 0;
              lastTranslateY = 0;
            } else {
              // Zoom in to 2x at tap location
              const tapX = evt.nativeEvent.locationX;
              const tapY = evt.nativeEvent.locationY;
              const imageHeight = 500;
              const zoomScaleVal = 2;
              const translateX = -(zoomScaleVal - 1) * (tapX - imageWidth / 2);
              const translateY = -(zoomScaleVal - 1) * (tapY - imageHeight / 2);
              const clampedZoom = clampTranslate(translateX, translateY, zoomScaleVal);
              zoomToPoint(zoomScaleVal, clampedZoom.x, clampedZoom.y);
              lastScale = zoomScaleVal;
              lastTranslateX = clampedZoom.x;
              lastTranslateY = clampedZoom.y;
            }
          } else if (tapCount === 1 && !isZoomed && gestureState.dx < 10 && gestureState.dy < 10) {
            // Single tap when not zoomed - keep existing double tap to like functionality
            setTimeout(() => {
              if (tapCount === 1) {
                // This was a single tap, trigger existing double tap handler for like
                handleDoubleTap();
                tapCount = 0;
              }
            }, 300);
          }
          // Update zoom state
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
  
  const zoomPanResponder = createZoomPanResponder();
  
  // FIXED: Enhanced auth token getter with refresh capability
  const getValidAuthToken = async () => {
    try {
      console.log('🔑 Getting auth token...');
      console.log('Current token exists:', !!token);
      console.log('User authenticated:', isAuthenticated);
      if (!token || !isAuthenticated) {
        console.error('❌ No token or not authenticated');
        return null;
      }
      // Return current token - AuthContext handles token refresh automatically
      return token;
    } catch (error) {
      console.error('❌ Error getting auth token:', error);
      return null;
    }
  };
  
  // Enhanced API call with retry logic for 401 errors
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
    console.log('🌐 Making authenticated request:', {
      url,
      method: requestOptions.method || 'GET',
      hasToken: !!authToken
    });
    let response = await fetch(url, requestOptions);
    // If we get 401, try to refresh token once
    if (response.status === 401) {
      console.log('🔄 Got 401, attempting token refresh...');
      const refreshSuccess = await refreshToken();
      if (refreshSuccess) {
        // Get the new token and retry the request
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

  // NEW: Handle reporting the post
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

      const requestBody = {
        reason: reportReason,
      };
      if (reportComment.trim()) {
        requestBody.comment = reportComment.trim();
      }

      console.log(`.Reporting post ${postId} with reason: ${reportReason}`);
      const response = await fetch(`${BASE_URL}/api/v1/posts/${postId}/report`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        console.log('Post reported successfully:', result);
        Alert.alert('Success', 'Post reported successfully. Thank you for helping keep the community safe.');
        setReportModalVisible(false); // Close the modal
        // Reset form fields
        setReportReason('');
        setReportComment('');
      } else {
        let errorMessage = result.message || 'Failed to report post.';
        if (response.status === 400) {
          errorMessage = result.message || 'Invalid report data.';
        } else if (response.status === 404) {
          errorMessage = 'Post not found.';
        } else if (response.status === 401) {
          errorMessage = 'Authentication failed. Please log in again.';
        } else if (response.status === 403) {
            errorMessage = 'You cannot report your own post.';
        }
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

  // NEW: Function to open the report modal
  const openReportModal = () => {
    if (isOwnPost) {
      Alert.alert('Error', 'You cannot report your own post.');
      return;
    }
    setReportModalVisible(true);
  };

  // NEW: Function to close the report modal
  const closeReportModal = () => {
    setReportModalVisible(false);
    // Reset form fields when closing
    setReportReason('');
    setReportComment('');
  };

  // Check follow status on component mount
  useEffect(() => {
    if (userId && userId !== 'unknown' && !isOwnPost) {
      checkFollowStatus();
    }
  }, [userId, isOwnPost]);
  
  // API call to check current follow status
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
  
  // Handle follow/unfollow action
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
      const response = await makeAuthenticatedRequest(`${BASE_URL}${endpoint}`, {
        method: 'POST'
      });
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setIsFollowing(!isFollowing);
          // Show success message
          const action = isFollowing ? 'Unfollowed' : 'Followed';
          console.log(`${action} ${username} successfully`);
          // Optional: Call parent callback to update user stats
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
  
  // Handle image scroll for carousel
  const handleImageScroll = (event) => {
    if (isZoomed) return; // Don't change images when zoomed
    const contentOffset = event.nativeEvent.contentOffset;
    const currentIndex = Math.round(contentOffset.x / imageWidth);
    if (currentIndex !== currentImageIndex && currentIndex >= 0 && currentIndex < postImages.length) {
      setCurrentImageIndex(currentIndex);
      console.log('📷 Image carousel scrolled to index:', currentIndex);
    }
  };
  
  // Heart button animation with fill effect
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
  
  // Enhanced center heart animation with bounce effect
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
      // Scale animation with bounce
      Animated.sequence([
        Animated.timing(centerHeartAnim, {
          toValue: 1.3,
          duration: 200,
          easing: Easing.out(Easing.back(2)),
          useNativeDriver: true,
        }),
        Animated.spring(centerHeartAnim, {
          toValue: 1,
          tension: 100,
          friction: 8,
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
  
  // FIXED: Enhanced like handler with proper auth token management
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
      console.log('Post ID:', postId);
      console.log('Current state:', { isLiked, likesCount });
      console.log('New state:', { isLiked: newLikedState, likesCount: newLikesCount });
      console.log('Auth token exists:', !!token);
      console.log('User authenticated:', isAuthenticated);
      
      // Optimistic update - update UI immediately
      setIsLiked(newLikedState);
      setLikesCount(newLikesCount);
      
      // Trigger animations
      animateHeartButton(newLikedState);
      if (newLikedState) {
        animateCenterHeart();
      }
      
      console.log('Making API request to:', `${BASE_URL}/api/v1/posts/${postId}/like`);
      const response = await makeAuthenticatedRequest(`${BASE_URL}/api/v1/posts/${postId}/like`, {
        method: 'PATCH'
      });
      
      const result = await response.json();
      console.log('API Response:', {
        status: response.status,
        success: result.success,
        data: result.data
      });
      
      if (response.ok && result.success) {
        // Success - update with server response
        const serverLikeCount = result.data?.likeCount || result.data?.realTimeLikes || newLikesCount;
        const serverIsLiked = result.data?.isLiked !== undefined ? result.data.isLiked : newLikedState;
        console.log('Server response:', { serverIsLiked, serverLikeCount });
        setIsLiked(serverIsLiked);
        setLikesCount(Math.max(0, serverLikeCount));
        // Ensure animations match final state
        if (serverIsLiked !== newLikedState) {
          animateHeartButton(serverIsLiked);
        }
        console.log('✅ Like operation completed successfully');
        // Call parent callback if provided
        if (onLikeUpdate && typeof onLikeUpdate === 'function') {
          try {
            onLikeUpdate(postId, serverIsLiked, serverLikeCount);
          } catch (callbackError) {
            console.error('onLikeUpdate callback error:', callbackError);
          }
        }
      } else {
        // API call failed - revert optimistic update
        console.error('❌ Like API call failed:', {
          status: response.status,
          message: result.message,
          error: result.error
        });
        setIsLiked(originalLikedState);
        setLikesCount(originalLikesCount);
        animateHeartButton(originalLikedState);
        // Show specific error message
        let errorMessage = 'Failed to update like';
        if (response.status === 401) {
          errorMessage = 'Authentication failed. Please log in again.';
        } else if (response.status === 404) {
          errorMessage = 'Post not found';
        } else if (response.status === 500) {
          errorMessage = 'Server error. Please try again.';
        } else if (result.message) {
          errorMessage = result.message;
        }
        Alert.alert('Error', errorMessage);
      }
    } catch (error) {
      console.error('❌ Like operation error:', error);
      // Revert to original state on error
      setIsLiked(data?.isLiked || false);
      setLikesCount(data?.likes || 0);
      animateHeartButton(data?.isLiked || false);
      // Show appropriate error message
      let errorMessage = 'Failed to update like. Please try again.';
      if (error.message.includes('Network request failed')) {
        errorMessage = 'Please check your internet connection and try again';
      } else if (error.message.includes('authentication') || error.message.includes('Token')) {
        errorMessage = 'Please log in again to like posts';
      } else if (error.message.includes('Post ID')) {
        errorMessage = 'Unable to like this post. Post information is missing.';
      }
      Alert.alert('Error', errorMessage);
    } finally {
      setLikeOperationInProgress(false);
    }
  };
  
  // FIXED: Enhanced comment button press with better error handling
  const handleCommentPress = () => {
    console.log('=== COMMENT BUTTON PRESSED ===');
    console.log('Using consistent Post ID:', postId);
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
          commentsCount: commentsCount,
          likesCount: likesCount,
        },
        onCommentUpdate: (newCount) => {
          console.log('📝 Comment count updated from:', commentsCount, 'to:', newCount);
          setCommentsCount(newCount);
        }
      });
    } catch (navigationError) {
      console.error('❌ Navigation error:', navigationError);
      Alert.alert('Error', 'Unable to open comments at this time');
    }
  };
  
  // FIXED: Handle likes press to navigate to LikeScreen with consistent postId
  const handleLikesPress = () => {
    console.log('=== LIKES NAVIGATION DEBUG ===');
    console.log('Likes count:', likesCount);
    console.log('Using consistent Post ID:', postId);
    console.log('Navigation available:', !!navigation);
    if (likesCount > 0 && navigation) {
      try {
        console.log('✅ Navigating to LikeScreen with postId:', postId);
        navigation.navigate('LikeScreen', {
          postId: postId, // Use the consistent postId
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
  
  // Enhanced double tap to like functionality
  let lastTap = null;
  const handleDoubleTap = () => {
    const now = Date.now();
    const DOUBLE_PRESS_DELAY = 300;
    if (lastTap && (now - lastTap) < DOUBLE_PRESS_DELAY) {
      // Only like if not already liked and not in progress
      if (!isLiked && !likeOperationInProgress) {
        console.log('💖 Double tap detected - liking post');
        handleLikePress();
      } else if (isLiked) {
        console.log('💖 Double tap detected but post already liked');
      } else {
        console.log('💖 Double tap detected but like operation in progress');
      }
    } else {
      lastTap = now;
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
        if (!navigation) {
          console.error('Navigation prop not passed to Post component');
        }
        if (!userId || userId === 'unknown') {
          console.error('User ID not available in post data');
        }
      }
    } catch (error) {
      console.error('Error handling profile press:', error);
    }
  };
  
  // Render pagination dots for multi-image posts
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
  
  // NEW: Render zoomable image with gesture handling
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
  
  // NEW: Enhanced image content rendering with zoom support
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
      // Multi-image carousel with zoom support
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
            scrollEnabled={!isZoomed} // Disable scrolling when zoomed
          >
            {postImages.map((image, index) => renderZoomableImage(image, index))}
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
          {!isZoomed && renderPaginationDots()}
          {/* Image counter for multi-image posts */}
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
      // Single image with zoom support
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
        {/* Follow Button - Only show if not own post */}
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
        {/* NEW: Report Button (Three Dots) - Only show if not own post */}
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
      
      {/* NEW: Enhanced image content with zoom support */}
      {renderImageContent()}
      
      {/* Action buttons below post*/}
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
          {commentsCount > 0 && (
            <TouchableOpacity onPress={handleCommentPress} activeOpacity={0.8}>
              <Text style={styles.commentsText}>
                View all {commentsCount} {commentsCount === 1 ? 'comment' : 'comments'}
              </Text>
            </TouchableOpacity>
          )}
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

      {/* NEW: Report Post Modal */}
      <Modal
        isVisible={isReportModalVisible}
        onBackdropPress={closeReportModal}
        onBackButtonPress={closeReportModal}
        backdropOpacity={0.7}
        style={styles.modalContainer}
        avoidKeyboard={true} // Adjust for keyboard
      >
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Report Post</Text>
          <Text style={styles.modalSubtitle}>Why are you reporting this post?</Text>

          {/* Report Reason Options */}
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

          {/* Optional Comment Input */}
          <TextInput
            style={styles.commentInput}
            placeholder="Add a comment (optional, max 500 chars)"
            placeholderTextColor="#888"
            value={reportComment}
            onChangeText={setReportComment}
            multiline
            numberOfLines={3}
            maxLength={500}
            editable={!isReporting} // Disable while reporting
          />

          {/* Action Buttons */}
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
    marginRight: 10, // Add margin to separate from menu button
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
  // NEW: Menu Button Styles (Three Dots)
  menuButton: {
    padding: 8, // Add padding for easier tapping
    // marginRight: -8, // Adjust margin if needed, or rely on default spacing
  },
  imageContainer: {
    position: "relative",
    overflow: 'hidden', // NEW: Important for zoom functionality
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
  },
  commentsText: {
    color: '#888',
    fontSize: 12,
    marginBottom: 4,
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
  // NEW STYLES FOR REPORT MODAL
  modalContainer: {
    justifyContent: 'center',
    margin: 20,
  },
  modalContent: {
    backgroundColor: 'black', // Match your theme
    borderColor: '#333',
    borderWidth: 1,
    borderRadius: 10,
    padding: 20,
    alignItems: 'stretch',
    maxHeight: '80%', // Prevent modal from being too tall
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
    backgroundColor: '#333', // Highlight selected option
  },
  reasonText: {
    fontSize: 16,
    color: '#ddd',
  },
  selectedReasonText: {
    color: '#E93A7A', // Highlight selected text
    fontWeight: '600',
  },
  commentInput: {
    backgroundColor: '#222',
    borderRadius: 8,
    padding: 10,
    marginTop: 15,
    color: 'white',
    fontSize: 14,
    textAlignVertical: 'top', // For multiline
    minHeight: 60, // Minimum height
    maxHeight: 100, // Maximum height
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
    backgroundColor: '#E93A7A', // Use your theme color
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
