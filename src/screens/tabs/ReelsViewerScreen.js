import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  FlatList,
  ActivityIndicator,
  Alert,
  Image,
  Animated,
  AppState,
  Platform,
} from 'react-native';
import Video from 'react-native-video';
import { useAuth } from '../../context/AuthContext';
import BASE_URL from '../../config/config';
import { useIsFocused } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const ReelsViewerScreen = ({ navigation, route }) => {
  const { reels: initialReels = [], initialIndex = 0, username = 'User' } = route.params || {};
  const { token, user } = useAuth() || {};
  const [reels, setReels] = useState(initialReels);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [loading, setLoading] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [videoBuffering, setVideoBuffering] = useState({});
  const [appState, setAppState] = useState(AppState.currentState);
  const [isAppActive, setIsAppActive] = useState(true);
  const [manualPaused, setManualPaused] = useState({}); // Added for manual play/pause
  const flatListRef = useRef(null);
  const isFocused = useIsFocused();
  const [viewCounted, setViewCounted] = useState(new Set());
  const [viewCountAnimations, setViewCountAnimations] = useState({});
  const [viewRegistrationInProgress, setViewRegistrationInProgress] = useState(new Set());
  const [preloadedVideos, setPreloadedVideos] = useState({});

  // Real-time view tracking
  const [viewTracking, setViewTracking] = useState({});
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  const viewStartTimes = useRef({});
  const viewTracked = useRef(new Set());
  const viewTimers = useRef({}); // Added for delayed view registration
  const viewStartTime = useRef({}); // Added for tracking start time

  // Like animation states
  const [likeAnimations, setLikeAnimations] = useState([]);
  const animationId = useRef(0);

  // Queue system for like operations
  const [likeQueue, setLikeQueue] = useState([]);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);
  const queueRef = useRef([]);
  const processingRef = useRef(false);

  // --- Robust data validation utilities ---
  const safeString = useCallback((value, fallback = '') => {
    if (value === null || value === undefined) return fallback;
    return String(value);
  }, []);

  const safeNumber = useCallback((value, fallback = 0) => {
    const num = Number(value);
    return isNaN(num) ? fallback : num;
  }, []);

  const safeArray = useCallback((value, fallback = []) => {
    return Array.isArray(value) ? value : fallback;
  }, []);

  const safeObject = useCallback((value, fallback = {}) => {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : fallback;
  }, []);

  // --- START: Functions from ReelsScreen for consistency ---
  const calculateDummyViews = useCallback((createdAt) => {
    if (!createdAt) return Math.floor(Math.random() * 31) + 20;
    try {
      const now = new Date();
      const createdDate = new Date(createdAt);
      const diffInHours = Math.floor((now - createdDate) / (1000 * 60 * 60));
      const diffInDays = Math.floor(diffInHours / 24);
      let baseViews;
      let randomRange;
      if (diffInHours < 24) {
        baseViews = 20;
        randomRange = 30;
      } else if (diffInDays <= 7) {
        baseViews = 50;
        randomRange = 50;
      } else if (diffInDays <= 30) {
        baseViews = 100;
        randomRange = 30;
      } else {
        baseViews = 120;
        randomRange = 30;
      }
      const randomViews = Math.floor(Math.random() * randomRange);
      const finalViews = baseViews + randomViews;
      return Math.min(Math.max(finalViews, 20), 150);
    } catch (error) {
      console.error('Error calculating views:', error);
      return Math.floor(Math.random() * 31) + 20;
    }
  }, []);

  // --- END: Functions from ReelsScreen ---

  // Enhanced view registration with analytics and session tracking (from ReelsScreen)
  const registerReelView = useCallback(
    async (reelId, analyticsData = {}) => {
      // Prevent duplicate registrations
      if (viewRegistrationInProgress.has(reelId) || viewCounted.has(reelId)) {
        console.log(`View already registered/in progress for reel ${reelId}`);
        return;
      }
      try {
        setViewRegistrationInProgress(prev => new Set(prev).add(reelId));
        // Enhanced payload with analytics
        const payload = {
          sessionId: sessionId,
          watchDuration: analyticsData.watchDuration || 0,
          watchPercentage: analyticsData.watchPercentage || 0,
          deviceInfo: {
            userAgent: 'React Native',
            platform: Platform.OS,
            version: Platform.Version
          },
          ...analyticsData
        };

        const response = await fetch(`${BASE_URL}/api/v1/posts/reels/${reelId}/view`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload)
        });

        const data = await response.json();
        if (response.ok && data.success) {
          const { viewResult, analytics } = data.data;
          // Update reel with enhanced view data
          setReels(prevReels =>
            prevReels.map(reel =>
              reel._id === reelId
                ? {
                    ...reel,
                    viewCount: viewResult.viewCount,
                    // Add analytics data for rich display
                    viewAnalytics: {
                      totalViews: analytics.totalViews,
                      uniqueViewers: analytics.uniqueViewers,
                      engagement: analytics.engagement,
                      lastUpdated: Date.now()
                    },
                    // Track view quality
                    viewQuality: data.data.metadata?.quality || 'unknown'
                  }
                : reel
            )
          );
          // Mark as viewed only if actually counted
          if (viewResult.counted) {
            setViewCounted(prev => new Set(prev).add(reelId));
            console.log(`✅ View registered for reel ${reelId}: ${viewResult.viewCount} views (${viewResult.source})`);
            // Optional: Show view count animation
            if (viewResult.uniqueView) {
              showViewCountAnimation(reelId, viewResult.viewCount);
            }
          } else {
            console.log(`ℹ️ View not counted for reel ${reelId}: ${viewResult.reason}`);
          }
        }
      } catch (error) {
        console.error('Error registering enhanced view:', error);
      } finally {
        setViewRegistrationInProgress(prev => {
          const newSet = new Set(prev);
          newSet.delete(reelId);
          return newSet;
        });
      }
    },
    [viewCounted, token, sessionId, viewRegistrationInProgress, BASE_URL]
  );

  // Show view count animation (optional visual feedback) (from ReelsScreen)
  const showViewCountAnimation = useCallback((reelId, newCount) => {
    // Create a brief animation to show view count increase
    setViewCountAnimations(prev => ({
      ...prev,
      [reelId]: {
        count: newCount,
        timestamp: Date.now()
      }
    }));
    // Remove animation after 2 seconds
    setTimeout(() => {
      setViewCountAnimations(prev => {
        const newAnimations = { ...prev };
        delete newAnimations[reelId];
        return newAnimations;
      });
    }, 2000);
  }, []);

  // Enhanced view tracking with watch time analytics (from ReelsScreen)
  const startViewTracking = useCallback((reelId) => {
    if (!reelId) return;
    viewStartTime.current[reelId] = Date.now();
    // Register view after 3 seconds with initial analytics
    viewTimers.current[reelId] = setTimeout(() => {
      const watchDuration = Date.now() - viewStartTime.current[reelId];
      registerReelView(reelId, {
        watchDuration,
        watchPercentage: Math.min(30, (watchDuration / 10000) * 100),
        isComplete: false,
        trigger: 'auto_3s'
      });
    }, 3000);
  }, [registerReelView]);

  // Enhanced view tracking completion with full analytics (from ReelsScreen)
  const stopViewTracking = useCallback((reelId) => {
    if (!reelId) return;
    if (viewTimers.current[reelId]) {
      clearTimeout(viewTimers.current[reelId]);
      delete viewTimers.current[reelId];
    }
    if (viewStartTime.current[reelId]) {
      const watchDuration = Date.now() - viewStartTime.current[reelId];
      delete viewStartTime.current[reelId];
      // Send comprehensive analytics if watched for meaningful duration
      if (watchDuration > 1000) {
        const watchPercentage = Math.min(100, (watchDuration / 15000) * 100);
        registerReelView(reelId, {
          watchDuration,
          watchPercentage,
          isComplete: watchPercentage >= 90,
          trigger: 'view_end',
          quality: watchPercentage >= 80 ? 'high' : watchPercentage >= 50 ? 'medium' : 'low'
        });
      }
    }
  }, [registerReelView]);

  // Format views count (e.g., 1.2K, 1M) - Enhanced with better validation
  const formatViewCount = useCallback((count) => {
    const numCount = safeNumber(count, 0);
    if (numCount < 1000) return numCount.toString();
    if (numCount < 1000000) return `${(numCount / 1000).toFixed(1).replace(/\.0$/, '')}K`;
    return `${(numCount / 1000000).toFixed(1).replace(/\.0$/, '')}M`;
  }, [safeNumber]);

  // Get real view count from reel data - Enhanced validation
  const getRealViewCount = useCallback((reel) => {
    if (!reel) return 0;
    // Priority order: viewCount -> realTimeViews -> views -> 0
    return safeNumber(reel.viewCount) || safeNumber(reel.realTimeViews) || safeNumber(reel.views) || 0;
  }, [safeNumber]);

  // Process like queue in background (from ReelsScreen)
  const processLikeQueue = useCallback(async () => {
    if (processingRef.current || queueRef.current.length === 0 || !token) {
      return;
    }
    processingRef.current = true;
    setIsProcessingQueue(true);
    while (queueRef.current.length > 0) {
      const likeAction = queueRef.current.shift();
      try {
        console.log('=== PROCESSING LIKE QUEUE (VIEWER) ===');
        console.log('Reel ID:', likeAction.reelId);
        console.log('Action:', likeAction.action);
        const response = await fetch(`${BASE_URL}/api/v1/posts/${likeAction.reelId}/like`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        if (!response.ok) {
          const errorData = await response.json();
          console.error('Like queue processing error:', errorData.message);
          continue;
        }
        const updatedData = await response.json();
        console.log('Like queue success:', updatedData);
        if (updatedData.success && updatedData.data) {
          setReels(prevReels =>
            prevReels.map(reel =>
              reel._id === likeAction.reelId
                ? {
                    ...reel,
                    likes: updatedData.data.reel?.likes || reel.likes || [],
                    realTimeLikes: updatedData.data.realTimeLikes || reel.realTimeLikes
                  }
                : reel
            )
          );
        }
      } catch (error) {
        console.error('Error processing like queue:', error);
        continue;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    processingRef.current = false;
    setIsProcessingQueue(false);
  }, [token, BASE_URL]);

  // Add like action to queue (from ReelsScreen)
  const addToLikeQueue = useCallback((reelId, action) => {
    if (!reelId) return;
    const likeAction = {
      reelId,
      action,
      timestamp: Date.now()
    };
    queueRef.current = queueRef.current.filter(item => item.reelId !== reelId);
    queueRef.current.push(likeAction);
    setLikeQueue(prev => {
      const filtered = prev.filter(item => item.reelId !== reelId);
      return [...filtered, likeAction];
    });
    processLikeQueue();
  }, [processLikeQueue]);

  // Profile press handler (from ReelsScreen)
  const handleProfilePress = useCallback((authorData) => {
    try {
      const safeAuthor = safeObject(authorData);
      const authorName = safeString(safeAuthor.fullName || safeAuthor.username, 'User');
      console.log('Profile press triggered for:', authorName);
      const userId = safeString(safeAuthor._id || safeAuthor.id);
      
      if (!navigation) {
        console.error('Navigation prop not passed to ReelsViewerScreen component');
        Alert.alert('Error', 'Navigation not available');
        return;
      }
      if (!userId || userId === 'unknown' || userId === '') {
        console.error('User ID not available in author data');
        Alert.alert('Error', 'Unable to view profile');
        return;
      }
      const isOwnProfile = user && (userId === user._id || userId === user.id);
      if (isOwnProfile) {
        console.log('Navigating to own profile');
        navigation.navigate('UserProfile', {
          userId: userId,
          fromReelsViewer: true,
          isOwnProfile: true
        });
      } else {
        console.log('Navigating to UserProfile with userId:', userId);
        navigation.navigate('UserProfile', {
          userId: userId,
          fromReelsViewer: true,
          authorName: authorName
        });
      }
    } catch (error) {
      console.error('Error handling profile press:', error);
      Alert.alert('Error', 'Unable to view profile at this time');
    }
  }, [navigation, user, safeObject, safeString]);

  // App state handler (from ReelsScreen)
  useEffect(() => {
    const handleAppStateChange = (nextAppState) => {
      if (appState.match(/inactive|background/) && nextAppState === 'active') {
        setIsAppActive(true);
      } else if (nextAppState.match(/inactive|background/)) {
        setIsAppActive(false);
      }
      setAppState(nextAppState);
    };
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      if (subscription?.remove) {
        subscription.remove();
      } else {
        AppState.removeEventListener('change', handleAppStateChange);
      }
    };
  }, [appState]);

  // Scroll to initial index on mount
  useEffect(() => {
    if (flatListRef.current && initialIndex > 0 && reels.length > initialIndex) {
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({ index: initialIndex, animated: false });
      }, 100);
    }
  }, [initialIndex, reels.length]);

  // Preload next video (from ReelsScreen)
  useEffect(() => {
    const nextIndex = currentIndex + 1;
    if (reels[nextIndex]?.video?.url && !preloadedVideos[nextIndex]) {
      setPreloadedVideos((prev) => ({
        ...prev,
        [nextIndex]: reels[nextIndex].video.url,
      }));
    }
  }, [currentIndex, reels, preloadedVideos]);

  // Effect to register view when the current reel changes (from ReelsScreen)
  useEffect(() => {
    const currentReel = reels[currentIndex];
    if (currentReel && currentReel._id) {
      startViewTracking(currentReel._id);
      return () => {
        stopViewTracking(currentReel._id);
      };
    }
  }, [currentIndex, reels, startViewTracking, stopViewTracking]);

  // Process initial reels with real view data - Enhanced validation
  useEffect(() => {
    if (user && initialReels.length > 0) {
      const userId = safeString(user._id || user.id);
      const reelsWithLikes = safeArray(initialReels).map(reel => {
        const safeReel = safeObject(reel);
        const likes = safeArray(safeReel.likes);
        return {
          ...safeReel,
          _id: safeString(safeReel._id, `reel-${Date.now()}-${Math.random()}`),
          isLiked: likes.some(like =>
            safeString(typeof like === 'object' ? like.user || like._id : like) === userId
          ) || false
        };
      });
      setReels(reelsWithLikes);
    } else if (initialReels.length > 0) {
      const reelsWithLikes = safeArray(initialReels).map(reel => {
        const safeReel = safeObject(reel);
        return {
          ...safeReel,
          _id: safeString(safeReel._id, `reel-${Date.now()}-${Math.random()}`),
          isLiked: false
        };
      });
      setReels(reelsWithLikes);
    }
  }, [user, initialReels, safeString, safeArray, safeObject]);

  const handleBack = () => {
    // End view tracking for current reel before leaving
    const currentReel = reels[currentIndex];
    if (currentReel) {
      stopViewTracking(currentReel._id);
    }
    navigation.goBack();
  };

  const handleViewableItemsChanged = useCallback(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      const newIndex = viewableItems[0].index;
      const oldIndex = currentIndex;
      // End tracking for previous reel
      if (oldIndex !== newIndex && reels[oldIndex]) {
        stopViewTracking(reels[oldIndex]._id);
      }
      // Start tracking for new reel
      if (reels[newIndex]) {
        startViewTracking(reels[newIndex]._id);
      }
      setCurrentIndex(newIndex);
    }
  }, [currentIndex, reels, stopViewTracking, startViewTracking]);

  // Start tracking when first reel becomes visible (from ReelsScreen logic)
  useEffect(() => {
    if (reels.length > 0 && currentIndex >= 0 && reels[currentIndex] && isAppActive && isFocused) {
      startViewTracking(reels[currentIndex]._id);
    }
  }, [reels, currentIndex, isAppActive, isFocused, startViewTracking]);

  const viewabilityConfig = { itemVisiblePercentThreshold: 80 };

  const createLikeAnimation = useCallback(() => {
    const id = animationId.current++;
    const animation = {
      id,
      scale: new Animated.Value(0),
      opacity: new Animated.Value(1),
      translateY: new Animated.Value(0),
    };
    setLikeAnimations(prev => [...prev, animation]);
    Animated.sequence([
      Animated.parallel([
        Animated.spring(animation.scale, { toValue: 1.2, useNativeDriver: true, tension: 150, friction: 3 }),
        Animated.timing(animation.translateY, { toValue: -50, duration: 1000, useNativeDriver: true }),
      ]),
      Animated.timing(animation.opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => setLikeAnimations(prev => prev.filter(anim => anim.id !== id)));
  }, []);

  // Instant like functionality with queue processing - Enhanced validation
  const handleLikePress = useCallback(async (reelId) => {
    if (!reelId || !token || !user) {
      Alert.alert('Error', 'Unable to like reel');
      return;
    }
    try {
      console.log('=== INSTANT LIKE REEL (VIEWER) ===');
      console.log('Reel ID:', reelId);
      console.log('User ID:', user._id || user.id);
      const currentReel = reels.find(reel => reel._id === reelId);
      if (!currentReel) {
        console.error('Reel not found');
        return;
      }
      const wasLiked = currentReel.isLiked;
      const userId = safeString(user._id || user.id);
      // INSTANT UI UPDATE
      setReels(prevReels =>
        prevReels.map(reel => {
          if (reel._id === reelId) {
            const currentLikes = safeArray(reel.likes);
            const newLikes = wasLiked
              ? currentLikes.filter(like => safeString(typeof like === 'object' ? like.user || like._id : like) !== userId)
              : [...currentLikes, { user: userId, _id: Date.now().toString() }];
            return {
              ...reel,
              isLiked: !wasLiked,
              likes: newLikes
            };
          }
          return reel;
        })
      );
      if (!wasLiked) {
        createLikeAnimation();
      }
      const action = wasLiked ? 'unlike' : 'like';
      addToLikeQueue(reelId, action);
      console.log(`✅ Reel ${action} updated instantly, queued for processing`);
    } catch (error) {
      console.error('Error in instant like:', error);
    }
  }, [token, user, reels, createLikeAnimation, addToLikeQueue, safeArray, safeString]);

  // Navigate to comments screen (from ReelsScreen)
  const openComments = useCallback((reel) => {
    if (!navigation) {
      console.error('Navigation prop not available');
      return;
    }
    const safeReel = safeObject(reel);
    navigation.navigate('CommentScreen', {
      reelId: safeReel._id,
      reelData: safeReel,
      contentType: 'reel',
      onCommentUpdate: (newCommentCount, realTimeComments) => {
        setReels(prevReels =>
          prevReels.map(r =>
            r._id === safeReel._id
              ? {
                  ...r,
                  commentCount: newCommentCount,
                  comments: realTimeComments || r.comments || [],
                  realTimeComments: realTimeComments
                }
              : r
          )
        );
      }
    });
  }, [navigation, safeObject]);

  const formatTimeAgo = useCallback((dateString) => {
    const safeDateString = safeString(dateString);
    if (!safeDateString) return 'Recently';
    try {
      const date = new Date(safeDateString);
      if (isNaN(date.getTime())) return 'Recently';
      const now = new Date();
      const diffInSecs = Math.floor((now - date) / 1000);
      if (diffInSecs < 60) return 'Just now';
      if (diffInSecs < 3600) return `${Math.floor(diffInSecs / 60)}m`;
      if (diffInSecs < 86400) return `${Math.floor(diffInSecs / 3600)}h`;
      if (diffInSecs < 604800) return `${Math.floor(diffInSecs / 86400)}d`;
      return `${Math.floor(diffInSecs / 604800)}w`;
    } catch {
      return 'Recently';
    }
  }, [safeString]);

  const getInitials = useCallback((name) => {
    const safeName = safeString(name);
    if (!safeName) return '?';
    const names = safeName.trim().split(/\s+/);
    if (names.length === 0) return '?';
    if (names.length === 1) return (names[0][0] || '?').toUpperCase();
    return ((names[0][0] || '') + (names[names.length - 1][0] || '')).toUpperCase() || '?';
  }, [safeString]);

  const toggleMute = useCallback(() => setIsMuted(prev => !prev), []);

  const handleBuffer = useCallback((index, isBuffering) => setVideoBuffering(prev => ({ ...prev, [index]: isBuffering })), []);

  // Added from ReelsScreen: Toggle pause for a specific reel
  const togglePauseForReel = useCallback((reelId) => {
    if (!reelId) return;
    setManualPaused((prev) => ({
      ...prev,
      [reelId]: !prev[reelId],
    }));
  }, []);

  const LikeAnimations = () => (
    <View style={styles.likeAnimationContainer}>
      {likeAnimations.map(animation => (
        <Animated.View key={animation.id} style={[styles.likeAnimation, { transform: [{ scale: animation.scale }, { translateY: animation.translateY }], opacity: animation.opacity }]}>
          <Icon name="heart" size={80} color="#ed167e" />
        </Animated.View>
      ))}
    </View>
  );

  const renderReelItem = useCallback(({ item, index }) => {
    // Enhanced item validation
    const safeItem = safeObject(item);
    if (!safeItem || !safeItem._id) {
      return <View style={styles.reelContainer} />;
    }

    // Updated logic for isPaused (from ReelsScreen)
    const isActive = index === currentIndex && isAppActive;
    const isPaused = manualPaused[safeItem._id] || !isActive || !isFocused;
    const isVideo = !!(safeItem.video?.url);
    
    // Enhanced author data validation
    const author = safeObject(safeItem.author || safeItem.user);
    const authorName = safeString(author.fullName || author.username || username, 'User');
    const isLiked = Boolean(safeItem.isLiked);
    
    // Ensure all counts are numbers and convert to strings for display
    const likes = safeArray(safeItem.likes);
    const likeCount = safeNumber(likes.length, 0);
    const commentCount = safeNumber(safeItem.commentCount || safeArray(safeItem.comments).length, 0);
    
    // Get real view count from the reel data
    const viewCount = getRealViewCount(safeItem);
    const viewAnimation = viewCountAnimations[safeItem._id];
    
    // Safe media source extraction
    const mediaSource = safeString(safeItem.video?.thumbnail?.url || safeItem.video?.url || safeItem.images?.[0]?.url);

    return (
      <View style={styles.reelContainer}>
        <View style={styles.mediaContainer}>
          {isVideo && safeItem.video?.url ? (
            <View style={styles.videoWrapper}>
              <Video
                source={{ uri: safeItem.video.url }}
                style={styles.media}
                resizeMode="cover"
                paused={isPaused}
                repeat={true}
                muted={isMuted}
                playInBackground={false}
                playWhenInactive={false}
                ignoreSilentSwitch="ignore"
                poster={mediaSource || undefined}
                posterResizeMode="cover"
                onBuffer={({ isBuffering }) => handleBuffer(index, isBuffering)}
                onError={(error) => console.log('Video error:', error)}
              />
              {videoBuffering[index] && (
                <View style={styles.bufferingOverlay}>
                  <ActivityIndicator size="large" color="#ed167e" />
                </View>
              )}
            </View>
          ) : mediaSource ? (
            <Image 
              source={{ uri: mediaSource }} 
              style={styles.media} 
              resizeMode="cover"
              onError={() => console.log('Image load error for:', mediaSource)}
            />
          ) : (
            <View style={styles.placeholderContainer}>
              <Text style={styles.placeholderText}>🎥</Text>
            </View>
          )}
        </View>
        {index === currentIndex && <LikeAnimations />}
        <View style={styles.bottomLeftInfo}>
          <TouchableOpacity
            onPress={() => handleProfilePress(author)}
            activeOpacity={0.8}
          >
            <Text style={styles.authorName}>{authorName}</Text>
          </TouchableOpacity>
          <Text style={styles.timeAgo}>{formatTimeAgo(safeItem.createdAt)}</Text>
          {safeItem.content && (
            <Text style={styles.caption} numberOfLines={2}>
              {safeString(safeItem.content)}
            </Text>
          )}
        </View>
        <View style={styles.bottomRightActions}>
          {/* Like Button */}
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleLikePress(safeItem._id)}
            activeOpacity={0.7}
          >
            <Icon
              name={isLiked ? "heart" : "heart-outline"}
              size={28}
              color={isLiked ? "#ed167e" : "#fff"}
              style={styles.actionIcon}
            />
            <Text style={styles.actionCount}>{likeCount.toString()}</Text>
          </TouchableOpacity>
          {/* Comment Button */}
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => openComments(safeItem)}
            activeOpacity={0.7}
          >
            <Icon
              name="chatbubble-outline"
              size={26}
              color="#fff"
              style={styles.actionIcon}
            />
            <Text style={styles.actionCount}>{commentCount.toString()}</Text>
          </TouchableOpacity>
          {/* Real Views Button */}
          <TouchableOpacity
            style={styles.actionButton}
            activeOpacity={0.7}
          >
            <Icon
              name="eye-outline"
              size={26}
              color="#fff"
              style={styles.actionIcon}
            />
            <Text style={[styles.actionCount, styles.viewCount]}>
              {formatViewCount(viewCount)}
            </Text>
            {viewAnimation && (
              <Animated.View
                style={[
                  styles.viewCountAnimation,
                  {
                    opacity: viewAnimation.timestamp ? 1 : 0,
                    transform: [
                      {
                        translateY: viewAnimation.timestamp ? 0 : -20,
                      },
                    ],
                  },
                ]}
              >
                <Text style={styles.viewCountText}>+1</Text>
              </Animated.View>
            )}
          </TouchableOpacity>
          {/* Author Avatar */}
          <TouchableOpacity
            style={styles.authorAvatar}
            onPress={() => handleProfilePress(author)}
            activeOpacity={0.8}
          >
            {author.photoUrl ? (
              <Image
                source={{ uri: safeString(author.photoUrl.url || author.photoUrl) }}
                style={styles.authorAvatarImage}
                onError={() => console.log('Avatar load error')}
              />
            ) : (
              <View style={styles.authorAvatarPlaceholder}>
                <Text style={styles.authorAvatarText}>
                  {getInitials(authorName)}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
        {/* Play/Pause button for current reel */}
        {index === currentIndex && (
          <TouchableOpacity
            style={styles.playPauseButton}
            onPress={() => togglePauseForReel(safeItem._id)}
            activeOpacity={0.7}
          >
            <Icon
              name={isPaused ? 'play' : 'pause'}
              size={22}
              color="#fff"
            />
          </TouchableOpacity>
        )}
      </View>
    );
  }, [
    currentIndex,
    isAppActive,
    isMuted,
    videoBuffering,
    handleLikePress,
    user,
    likeAnimations,
    isFocused,
    username,
    handleProfilePress,
    openComments,
    formatViewCount,
    getRealViewCount,
    manualPaused,
    togglePauseForReel,
    viewCountAnimations,
    safeObject,
    safeString,
    safeNumber,
    safeArray,
  ]);

  const keyExtractor = useCallback((item, index) => {
    const safeItem = safeObject(item);
    return safeString(safeItem._id, `reel-${index}`);
  }, [safeObject, safeString]);

  const getItemLayout = useCallback((_, index) => ({ length: SCREEN_HEIGHT, offset: SCREEN_HEIGHT * index, index }), []);

  if (loading && !reels.length) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ed167e" />
      </SafeAreaView>
    );
  }

  if (!reels.length) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>🎥</Text>
          <Text style={styles.emptyTitle}>No Reels to Show</Text>
          <TouchableOpacity onPress={handleBack} style={styles.retryButton}>
            <Text style={styles.retryText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="black" />
      <FlatList
        ref={flatListRef}
        data={reels}
        renderItem={renderReelItem}
        keyExtractor={keyExtractor}
        snapToInterval={SCREEN_HEIGHT}
        snapToAlignment="start"
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        pagingEnabled
        onViewableItemsChanged={handleViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        getItemLayout={getItemLayout}
        initialScrollIndex={initialIndex}
        onScrollToIndexFailed={() => { }}
        initialNumToRender={1}
        maxToRenderPerBatch={1}
        windowSize={3}
        removeClippedSubviews={true}
      />
      {/* Back Button */}
      <TouchableOpacity onPress={handleBack} style={styles.backButton} activeOpacity={0.7}>
        <Icon name="arrow-back" size={24} color="#fff" />
      </TouchableOpacity>
      {/* Mute Button */}
      <TouchableOpacity style={styles.muteIndicator} onPress={toggleMute} activeOpacity={0.7}>
        <Icon name={isMuted ? 'volume-mute' : 'volume-high'} size={22} color="#fff" />
      </TouchableOpacity>
      {/* Real-time Status Indicators */}
      {isProcessingQueue && (
        <View style={styles.queueIndicator}>
          <Text style={styles.queueText}>Syncing...</Text>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'black',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 20,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#ed167e',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  reelContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    backgroundColor: 'black',
  },
  videoWrapper: {
    flex: 1,
  },
  mediaContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  media: {
    width: '100%',
    height: '100%',
  },
  placeholderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
  },
  placeholderText: {
    fontSize: 64,
  },
  bufferingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  likeAnimationContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    pointerEvents: 'none',
  },
  likeAnimation: {
    position: 'absolute',
  },
  backButton: {
    position: 'absolute',
    top: 60,
    left: 16,
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  muteIndicator: {
    position: 'absolute',
    top: 60,
    right: 16,
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playPauseButton: {
    position: 'absolute',
    top: 110,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
    elevation: 10,
  },
  queueIndicator: {
    position: 'absolute',
    top: 110,
    left: 16,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    zIndex: 10,
  },
  queueText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  bottomLeftInfo: {
    position: 'absolute',
    bottom: 100,
    left: 16,
    right: 100,
    zIndex: 1,
  },
  bottomRightActions: {
    position: 'absolute',
    bottom: 100,
    right: 16,
    alignItems: 'center',
    zIndex: 1,
  },
  actionButton: {
    alignItems: 'center',
    marginBottom: 20,
    position: 'relative',
  },
  actionIcon: {
    marginBottom: 4,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  actionCount: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  viewCount: {
    color: '#00ff88',
    fontWeight: '700',
  },
  viewCountAnimation: {
    position: 'absolute',
    top: -20,
    alignItems: 'center',
  },
  viewCountText: {
    color: '#4CAF50',
    fontSize: 12,
    fontWeight: 'bold',
  },
  authorAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#fff',
    overflow: 'hidden',
    marginTop: 10,
  },
  authorAvatarImage: {
    width: '100%',
    height: '100%',
  },
  authorAvatarPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#ed167e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  authorAvatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  authorName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
    textDecorationLine: 'underline',
  },
  timeAgo: {
    color: '#e0e0e0',
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 8,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  caption: {
    color: '#fff',
    fontSize: 16,
    lineHeight: 22,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
});

export default ReelsViewerScreen;