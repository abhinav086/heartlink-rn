// src/screens/tabs/ReelScreen.tsx
import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  FlatList,
  Dimensions,
  ActivityIndicator,
  Text,
  View,
  Alert,
  TouchableOpacity,
  Image,
  Animated,
  AppState,
  TouchableWithoutFeedback,
  Platform,
} from 'react-native';
import Video from 'react-native-video';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useIsFocused } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import { MMKVLoader, MMKVInstance } from 'react-native-mmkv-storage';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

// Initialize MMKV storage with proper typing
let MMKV: MMKVInstance;
try {
  MMKV = new MMKVLoader().initialize();
} catch (error) {
  console.error('Failed to initialize MMKV:', error);
  // Fallback to a mock implementation if MMKV fails
  MMKV = {
    getString: () => null,
    setString: () => {},
    removeItem: () => {},
  } as unknown as MMKVInstance;
}

const REELS_CACHE_KEY = 'cached_reels';
const REELS_CACHE_TIMESTAMP_KEY = 'cached_reels_timestamp';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache

const ReelsScreen = ({ navigation }: any) => {
  const [reels, setReels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [videoBuffering, setVideoBuffering] = useState<{[key: number]: boolean}>({});
  const [appState, setAppState] = useState(AppState.currentState);
  const [isAppActive, setIsAppActive] = useState(true);
  const [manualPaused, setManualPaused] = useState<{[key: string]: boolean}>({});
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [viewCounted, setViewCounted] = useState<Set<string>>(new Set());
  const [viewCountAnimations, setViewCountAnimations] = useState<{[key: string]: any}>({});
  const [viewRegistrationInProgress, setViewRegistrationInProgress] = useState<Set<string>>(new Set());
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  
  const flatListRef = useRef<FlatList>(null);
  const [preloadedVideos, setPreloadedVideos] = useState<{[key: number]: string}>({});
  const isFocused = useIsFocused();
  const [likeAnimations, setLikeAnimations] = useState<any[]>([]);
  const animationId = useRef(0);
  const [likeQueue, setLikeQueue] = useState<any[]>([]);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);
  const queueRef = useRef<any[]>([]);
  const processingRef = useRef(false);
  const viewStartTime = useRef<{[key: string]: number}>({});
  const viewTimers = useRef<{[key: string]: NodeJS.Timeout}>({});
  const sessionId = useRef(Math.random().toString(36).substring(2, 15));

  const BASE_URL = 'https://backendforheartlink.in';
  const LIMIT = 20; // Number of reels per page

  // --- START: Functions from ReelsViewerScreen for consistency ---
  const calculateDummyViews = useCallback((createdAt: string) => {
    if (!createdAt) return Math.floor(Math.random() * 31) + 20;
    try {
      const now = new Date();
      const createdDate = new Date(createdAt);
      const diffInHours = Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60));
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

  const formatViewCount = useCallback((count: number) => {
    if (count < 1000) return count.toString();
    if (count < 1000000) return `${(count / 1000).toFixed(1)}K`;
    return `${(count / 1000000).toFixed(1)}M`;
  }, []);

  const getRealViewCount = useCallback((reel: any) => {
    if (!reel) return 0;
    const safeNumber = (value: any, fallback: number = 0) => {
      const num = Number(value);
      return isNaN(num) ? fallback : num;
    };
    return safeNumber(reel.viewCount) || safeNumber(reel.realTimeViews) || safeNumber(reel.views) || 0;
  }, []);
  // --- END: Functions from ReelsViewerScreen ---

  const getAuthHeaders = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token available');
      }
      return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      };
    } catch (error) {
      console.error('Error getting auth headers:', error);
      throw error;
    }
  };

  const getCurrentUser = async () => {
    try {
      const userJson = await AsyncStorage.getItem('user');
      if (userJson) {
        const user = JSON.parse(userJson);
        setCurrentUser(user);
        return user;
      } else {
        const altUserJson =
          (await AsyncStorage.getItem('userData')) ||
          (await AsyncStorage.getItem('currentUser')) ||
          (await AsyncStorage.getItem('userInfo'));
        if (altUserJson) {
          const user = JSON.parse(altUserJson);
          setCurrentUser(user);
          return user;
        }
      }
    } catch (error) {
      console.error('Error getting current user:', error);
    }
    return null;
  };

  const processLikeQueue = useCallback(async () => {
    if (processingRef.current || queueRef.current.length === 0) {
      return;
    }
    processingRef.current = true;
    setIsProcessingQueue(true);
    while (queueRef.current.length > 0) {
      const likeAction = queueRef.current.shift();
      try {
        console.log('=== PROCESSING LIKE QUEUE (MAIN SCREEN) ===');
        console.log('Reel ID:', likeAction.reelId);
        console.log('Action:', likeAction.action);
        const headers = await getAuthHeaders();
        const response = await fetch(`${BASE_URL}/api/v1/posts/${likeAction.reelId}/like`, {
          method: 'PATCH',
          headers,
        });
        if (!response.ok) {
          const errorData = await response.json();
          console.error('Like queue processing error:', errorData.message);
          continue;
        }
        const updatedData = await response.json();
        console.log('Like queue success:', updatedData);
        if (updatedData.success && updatedData.data) {
          setReels((prevReels) =>
            prevReels.map((reel) =>
              reel._id === likeAction.reelId
                ? {
                    ...reel,
                    likes: updatedData.data.reel?.likes || reel.likes || [],
                  }
                : reel
            )
          );
        }
      } catch (error) {
        console.error('Error processing like queue:', error);
        continue;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    processingRef.current = false;
    setIsProcessingQueue(false);
  }, [BASE_URL]);

  const addToLikeQueue = useCallback(
    (reelId: string, action: string) => {
      const likeAction = {
        reelId,
        action,
        timestamp: Date.now(),
      };
      queueRef.current = queueRef.current.filter((item) => item.reelId !== reelId);
      queueRef.current.push(likeAction);
      setLikeQueue((prev) => {
        const filtered = prev.filter((item) => item.reelId !== reelId);
        return [...filtered, likeAction];
      });
      processLikeQueue();
    },
    [processLikeQueue]
  );

  const handleProfilePress = useCallback(
    (authorData: any) => {
      try {
        console.log('Profile press triggered for:', authorData?.fullName || authorData?.username);
        console.log('Navigation object:', !!navigation);
        console.log('Author ', authorData);
        const userId = authorData?._id;
        const authorName = authorData?.fullName || authorData?.username;
        if (!navigation) {
          console.error('Navigation prop not passed to ReelsScreen component');
          Alert.alert('Error', 'Navigation not available');
          return;
        }
        if (!userId || userId === 'unknown') {
          console.error('User ID not available in author data');
          Alert.alert('Error', 'Unable to view profile');
          return;
        }
        const isOwnProfile = currentUser && (userId === currentUser._id || userId === currentUser.id);
        if (isOwnProfile) {
          console.log('Navigating to own profile');
          navigation.navigate('UserProfile', {
            userId: userId,
            fromReels: true,
            isOwnProfile: true,
          });
        } else {
          console.log('Navigating to UserProfile with userId:', userId);
          navigation.navigate('UserProfile', {
            userId: userId,
            fromReels: true,
            authorName: authorName,
          });
        }
      } catch (error) {
        console.error('Error handling profile press:', error);
        Alert.alert('Error', 'Unable to view profile at this time');
      }
    },
    [navigation, currentUser]
  );

  // Clear reels cache
  const clearReelsCache = useCallback(() => {
    try {
      MMKV.removeItem(REELS_CACHE_KEY);
      MMKV.removeItem(REELS_CACHE_TIMESTAMP_KEY);
    } catch (error) {
      console.error('Error clearing reels cache:', error);
    }
  }, []);

  const fetchReels = useCallback(async (pageNum = 1, isRefresh = false) => {
    try {
      if (pageNum === 1) {
        if (!isRefresh) {
          setError(null);
          setLoading(true);
        } else {
          setRefreshing(true);
        }
      } else {
        setLoadingMore(true);
      }
      
      // Try to get cached data for first page only
      if (pageNum === 1 && !isRefresh) {
        try {
          const cachedReelsString = MMKV.getString(REELS_CACHE_KEY);
          const cacheTimestampString = MMKV.getString(REELS_CACHE_TIMESTAMP_KEY);
          
          if (cachedReelsString && cacheTimestampString) {
            const cachedReels = JSON.parse(cachedReelsString);
            const cacheTimestamp = parseInt(cacheTimestampString, 10);
            const now = Date.now();
            
            // If we have recent cache, use it
            if ((now - cacheTimestamp) < CACHE_DURATION) {
              console.log('Using cached reels data');
              const optimizedReels = cachedReels.map((post: any) => ({
                ...post,
                likes: post.likes || [],
                comments: post.comments || [],
                viewCount: post.realTimeViews !== undefined ? post.realTimeViews : (post.views || 0),
              }));
              
              setReels(optimizedReels);
              setViewCounted(new Set());
              setHasMore(true);
              setPage(1);
              
              // Preload first video
              if (optimizedReels[0]?.video?.url) {
                setPreloadedVideos((prev) => ({
                  ...prev,
                  0: optimizedReels[0].video.url,
                }));
              }
              
              // Don't return yet - still fetch fresh data in background
            }
          }
        } catch (cacheError) {
          console.warn('Cache reading failed, continuing with fresh fetch:', cacheError);
        }
      }
      
      // Fetch fresh data
      const headers = await getAuthHeaders();
      const response = await fetch(`${BASE_URL}/api/v1/posts?type=reel&page=${pageNum}&limit=${LIMIT}`, {
        method: 'GET',
        headers,
      });
      const data = await response.json();
      
      if (response.ok && data.success && Array.isArray(data.data?.posts)) {
        const currentUserData = await getCurrentUser();
        const userId = currentUserData?._id || currentUserData?.id;

        const optimizedReels = data.data.posts.map((post: any) => {
          const isLiked = post.likes?.some((like: any) =>
            (typeof like === 'object' ? like.user || like._id : like) === userId
          ) || false;

          return {
            _id: post._id,
            content: post.content,
            createdAt: post.createdAt,
            video: post.video
              ? {
                  url: post.video.url || post.video.cdnUrl,
                  thumbnail: post.video.thumbnail,
                }
              : null,
            images: post.images,
            author: {
              _id: post.author?._id,
              fullName: post.author?.fullName,
              username: post.author?.username,
              photoUrl: post.author?.photoUrl,
            },
            likes: post.likes || [],
            comments: post.comments || [],
            viewCount: post.realTimeViews !== undefined ? post.realTimeViews : (post.views || 0),
            commentCount: post.commentCount || post.realTimeComments || post.comments?.length || 0,
            type: post.type,
            isLiked: isLiked,
          };
        });

        // For first page or refresh, replace reels
        if (pageNum === 1 || isRefresh) {
          setReels(optimizedReels);
          setPage(1);
          setHasMore(optimizedReels.length === LIMIT);
          
          // Cache the fresh data for first page
          if (pageNum === 1) {
            try {
              MMKV.setString(REELS_CACHE_KEY, JSON.stringify(optimizedReels));
              MMKV.setString(REELS_CACHE_TIMESTAMP_KEY, Date.now().toString());
            } catch (cacheError) {
              console.warn('Failed to cache reels data:', cacheError);
            }
          }
        } else {
          // For subsequent pages, append to existing reels
          setReels(prevReels => [...prevReels, ...optimizedReels]);
          setPage(pageNum);
          setHasMore(optimizedReels.length === LIMIT);
        }

        setViewCounted(new Set());
        
        // Preload first video if it's the first page
        if ((pageNum === 1 || isRefresh) && optimizedReels[0]?.video?.url) {
          setPreloadedVideos((prev) => ({
            ...prev,
            0: optimizedReels[0].video.url,
          }));
        }
      } else {
        throw new Error(data.message || 'Failed to fetch reels');
      }
    } catch (err: any) {
      console.error('Error fetching reels:', err);
      setError(err.message || 'Failed to load reels');
      
      // If we have cached data and it's the first page, use it as fallback
      if (pageNum === 1) {
        try {
          const cachedReelsString = MMKV.getString(REELS_CACHE_KEY);
          if (cachedReelsString) {
            const cachedReels = JSON.parse(cachedReelsString);
            if (cachedReels && cachedReels.length > 0) {
              console.log('Using cached reels as fallback');
              setReels(cachedReels);
              setHasMore(true);
              setPage(1);
            }
          }
        } catch (cacheError) {
          console.warn('Failed to use cache as fallback:', cacheError);
        }
      }
    } finally {
      if (pageNum === 1) {
        if (!isRefresh) {
          setLoading(false);
        } else {
          setRefreshing(false);
        }
      } else {
        setLoadingMore(false);
      }
    }
  }, [BASE_URL]);

  // Enhanced view registration with analytics and session tracking
  const registerReelView = useCallback(
    async (reelId: string, analyticsData = {}) => {
      // Prevent duplicate registrations
      if (viewRegistrationInProgress.has(reelId) || viewCounted.has(reelId)) {
        console.log(`View already registered/in progress for reel ${reelId}`);
        return;
      }

      try {
        setViewRegistrationInProgress(prev => new Set(prev).add(reelId));
        
        const headers = await getAuthHeaders();
        
        // Enhanced payload with analytics
        const payload = {
          sessionId: sessionId.current,
          watchDuration: analyticsData.watchDuration || 0,
          watchPercentage: analyticsData.watchPercentage || 0,
          deviceInfo: {
            userAgent: 'React Native',
            platform: Platform.OS,
            version: Platform.Version
          },
          ...analyticsData
        };
        
        // Use the enhanced view endpoint
        const response = await fetch(
          `${BASE_URL}/api/v1/posts/reels/${reelId}/view`,
          {
            method: 'POST',
            headers,
            body: JSON.stringify(payload)
          }
        );

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
    [viewCounted, BASE_URL, viewRegistrationInProgress]
  );

  // Show view count animation (optional visual feedback)
  const showViewCountAnimation = useCallback((reelId: string, newCount: number) => {
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

  // Enhanced view tracking with watch time analytics
  const startViewTracking = useCallback((reelId: string) => {
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

  // Enhanced view tracking completion with full analytics
  const stopViewTracking = useCallback((reelId: string) => {
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

  useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
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

  useEffect(() => {
    const initializeScreen = async () => {
      await getCurrentUser();
      await fetchReels(1);
    };
    initializeScreen();
    
    // Cleanup function to clear cache when component unmounts
    return () => {
      clearReelsCache();
    };
  }, [fetchReels, clearReelsCache]);

  useEffect(() => {
    const nextIndex = currentIndex + 1;
    if (reels[nextIndex]?.video?.url && !preloadedVideos[nextIndex]) {
      setPreloadedVideos((prev) => ({
        ...prev,
        [nextIndex]: reels[nextIndex].video.url,
      }));
    }
  }, [currentIndex, reels, preloadedVideos]);

  // Effect to register view when the current reel changes
  useEffect(() => {
    const currentReel = reels[currentIndex];
    if (currentReel && currentReel._id) {
      startViewTracking(currentReel._id);
      return () => {
        stopViewTracking(currentReel._id);
      };
    }
  }, [currentIndex, reels, startViewTracking, stopViewTracking]);

  const onRefresh = useCallback(async () => {
    clearReelsCache(); // Clear cache before refreshing
    await fetchReels(1, true);
  }, [fetchReels, clearReelsCache]);

  const handleViewableItemsChanged = useCallback(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      const firstVisibleItem = viewableItems[0];
      if (firstVisibleItem && typeof firstVisibleItem.index === 'number') {
        setCurrentIndex(firstVisibleItem.index);
      }
    }
  }, []);

  const viewabilityConfig = {
    itemVisiblePercentThreshold: 80,
    waitForInteraction: false,
  };

  const createLikeAnimation = useCallback(() => {
    const id = animationId.current++;
    const animation = {
      id,
      scale: new Animated.Value(0),
      opacity: new Animated.Value(1),
      translateY: new Animated.Value(0),
    };
    setLikeAnimations((prev) => [...prev, animation]);
    Animated.sequence([
      Animated.parallel([
        Animated.spring(animation.scale, {
          toValue: 1.2,
          useNativeDriver: true,
          tension: 150,
          friction: 3,
        }),
        Animated.timing(animation.translateY, {
          toValue: -50,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(animation.opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setLikeAnimations((prev) => prev.filter((anim) => anim.id !== id));
    });
  }, []);

  const handleLike = useCallback(
    async (reelId: string) => {
      if (!reelId || !currentUser) {
        Alert.alert('Error', 'Unable to like reel');
        return;
      }
      try {
        console.log('=== INSTANT LIKE REEL (MAIN SCREEN) ===');
        console.log('Reel ID:', reelId);
        console.log('User ID:', currentUser._id || currentUser.id);
        const currentReel = reels.find((reel) => reel._id === reelId);
        if (!currentReel) {
          console.error('Reel not found');
          return;
        }
        const wasLiked = currentReel.isLiked;
        const userId = currentUser._id || currentUser.id;

        setReels((prevReels) =>
          prevReels.map((reel) => {
            if (reel._id === reelId) {
              const newLikes = wasLiked
                ? reel.likes?.filter(
                    (like) => (typeof like === 'object' ? like.user || like._id : like) !== userId
                  ) || []
                : [...(reel.likes || []), { user: userId, _id: Date.now().toString() }];

              return {
                ...reel,
                isLiked: !wasLiked,
                likes: newLikes,
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
    },
    [currentUser, reels, createLikeAnimation, addToLikeQueue]
  );

  const openComments = useCallback(
    (reel: any) => {
      if (!navigation) {
        console.error('Navigation prop not available');
        return;
      }
      navigation.navigate('CommentScreen', {
        reelId: reel._id,
        reelData: reel,
        contentType: 'reel',
        onCommentUpdate: (newCommentCount: number, realTimeComments: any[]) => {
          setReels((prevReels) =>
            prevReels.map((r) =>
              r._id === reel._id
                ? {
                    ...r,
                    commentCount: newCommentCount,
                    comments: realTimeComments || r.comments || [],
                    realTimeComments: realTimeComments,
                  }
                : r
            )
          );
        },
      });
    },
    [navigation]
  );

  const formatTimeAgo = useCallback((dateString: string) => {
    if (!dateString) return 'Recently';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Recently';
      const now = new Date();
      const diffInSecs = Math.floor((now.getTime() - date.getTime()) / 1000);
      if (diffInSecs < 60) return 'Just now';
      if (diffInSecs < 3600) return `${Math.floor(diffInSecs / 60)}m`;
      if (diffInSecs < 86400) return `${Math.floor(diffInSecs / 3600)}h`;
      if (diffInSecs < 604800) return `${Math.floor(diffInSecs / 86400)}d`;
      return `${Math.floor(diffInSecs / 604800)}w`;
    } catch (error) {
      return 'Recently';
    }
  }, []);

  const getInitials = useCallback((name: string) => {
    if (!name) return '?';
    const names = name.trim().split(/\s+/);
    if (names.length === 0) return '?';
    if (names.length === 1) return names[0][0].toUpperCase();
    return (names[0][0] + (names[names.length - 1][0] || '')).toUpperCase();
  }, []);

  const getMediaSource = useCallback((item: any) => {
    if (item?.video?.thumbnail?.url) return item.video.thumbnail.url;
    if (item?.video?.thumbnail?.cdnUrl) return item.video.thumbnail.cdnUrl;
    if (item?.video?.url) return item.video.url;
    if (item?.images?.[0]?.url) return item.images[0].url;
    return null;
  }, []);

  const toggleMute = useCallback(() => setIsMuted((prev) => !prev), []);

  const handleBuffer = useCallback((index: number, isBuffering: boolean) => {
    setVideoBuffering((prev) => ({ ...prev, [index]: isBuffering }));
  }, []);

  const togglePauseForReel = useCallback((reelId: string) => {
    setManualPaused((prev) => ({
      ...prev,
      [reelId]: !prev[reelId],
    }));
  }, []);

  const LikeAnimations = () => (
    <View style={styles.likeAnimationContainer}>
      {likeAnimations.map((animation) => (
        <Animated.View
          key={animation.id}
          style={[
            styles.likeAnimation,
            {
              transform: [{ scale: animation.scale }, { translateY: animation.translateY }],
              opacity: animation.opacity,
            },
          ]}
        >
          <Icon name="heart" size={80} color="#ed167e" />
        </Animated.View>
      ))}
    </View>
  );

  const renderReelItem = useCallback(
    ({ item, index }: { item: any; index: number }) => {
      const isActive = index === currentIndex && isAppActive;
      const mediaSource = getMediaSource(item);
      const isVideo = !!item.video?.url;
      const isLiked = item.isLiked;
      const isPaused = manualPaused[item._id] || !isActive || !isFocused;
      const likeCount = item.likes?.length || 0;
      const commentCount = item.commentCount || item.comments?.length || 0;
      const viewCount = getRealViewCount(item);
      const viewAnimation = viewCountAnimations[item._id];
      const displayViewCount = String(formatViewCount(viewCount));

      return (
        <View style={styles.reelContainer}>
          <View style={styles.mediaContainer}>
            {isVideo ? (
              <View style={styles.videoWrapper}>
                <Video
                  source={{ uri: item.video.url }}
                  style={styles.media}
                  resizeMode="cover"
                  paused={isPaused}
                  repeat={true}
                  muted={isMuted}
                  playInBackground={false}
                  playWhenInactive={false}
                  ignoreSilentSwitch="ignore"
                  poster={mediaSource}
                  posterResizeMode="cover"
                  onBuffer={({ isBuffering }: { isBuffering: boolean }) => handleBuffer(index, isBuffering)}
                  onError={(error: any) => console.log('Video error:', error)}
                />
                {videoBuffering[index] && (
                  <View style={styles.bufferingOverlay}>
                    <ActivityIndicator size="large" color="#ed167e" />
                  </View>
                )}
              </View>
            ) : mediaSource ? (
              <Image source={{ uri: mediaSource }} style={styles.media} resizeMode="cover" />
            ) : (
              <View style={styles.placeholderContainer}>
                <Text style={styles.placeholderText}>🎥</Text>
                <Text style={styles.placeholderSubtext}>Reel</Text>
              </View>
            )}
          </View>
          {index === currentIndex && <LikeAnimations />}
          <View style={styles.bottomLeftInfo}>
            <TouchableOpacity onPress={() => handleProfilePress(item.author)} activeOpacity={0.8}>
              <Text style={styles.authorName}>
                {item.author?.fullName || item.author?.username || 'Unknown User'}
              </Text>
            </TouchableOpacity>
            <Text style={styles.timeAgo}>{formatTimeAgo(item.createdAt)}</Text>
            {item.content ? (
              <Text style={styles.caption} numberOfLines={2}>
                {item.content}
              </Text>
            ) : null}
          </View>
          <View style={styles.bottomRightActions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleLike(item._id)}
              activeOpacity={0.7}
            >
              <Icon
                name={isLiked ? 'heart' : 'heart-outline'}
                size={28}
                color={isLiked ? '#ed167e' : '#fff'}
                style={styles.actionIcon}
              />
              <Text style={styles.actionCount}>{likeCount}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => openComments(item)}
              activeOpacity={0.7}
            >
              <Icon name="chatbubble-outline" size={26} color="#fff" style={styles.actionIcon} />
              <Text style={styles.actionCount}>{commentCount}</Text>
            </TouchableOpacity>
            {/* <TouchableOpacity style={styles.actionButton} activeOpacity={0.7}>
              <Icon name="eye-outline" size={26} color="#fff" style={styles.actionIcon} />
              <Text style={styles.actionCount}>{displayViewCount}</Text>
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
            </TouchableOpacity> */}
            <TouchableOpacity
              style={styles.authorAvatar}
              onPress={() => handleProfilePress(item.author)}
              activeOpacity={0.8}
            >
              {item.author?.photoUrl ? (
                <Image
                  source={{
                    uri: item.author.photoUrl.url || item.author.photoUrl,
                  }}
                  style={styles.authorAvatarImage}
                />
              ) : (
                <View style={styles.authorAvatarPlaceholder}>
                  <Text style={styles.authorAvatarText}>
                    {getInitials(item.author?.fullName || item.author?.username)}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
          {/* Play/Pause button for current reel - Always visible */}
          {index === currentIndex && (
            <TouchableOpacity
              style={styles.playPauseButton}
              onPress={() => togglePauseForReel(item._id)}
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
    },
    [
      currentIndex,
      isAppActive,
      isMuted,
      videoBuffering,
      getMediaSource,
      formatTimeAgo,
      getInitials,
      handleLike,
      currentUser,
      preloadedVideos,
      likeAnimations,
      isFocused,
      manualPaused,
      togglePauseForReel,
      openComments,
      handleProfilePress,
      getRealViewCount,
      formatViewCount,
      viewCountAnimations,
    ]
  );

  const keyExtractor = useCallback((item: any) => item._id, []);

  const getItemLayout = useCallback(
    (_: any, index: number) => ({
      length: SCREEN_HEIGHT,
      offset: SCREEN_HEIGHT * index,
      index,
    }),
    []
  );

  // Handle loading more reels when reaching the end
  const handleEndReached = useCallback(() => {
    if (!loadingMore && hasMore && reels.length > 0) {
      fetchReels(page + 1);
    }
  }, [loadingMore, hasMore, page, reels.length, fetchReels]);

  // Render footer for loading indicator
  const renderFooter = useCallback(() => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="large" color="#ed167e" />
      </View>
    );
  }, [loadingMore]);

  if (loading && !refreshing && reels.length === 0) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ed167e" />
      </SafeAreaView>
    );
  }

  if (error && reels.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => fetchReels(1)} style={styles.retryButton}>
            <Text style={styles.retryText}>Tap to retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!reels.length && !loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>🎥</Text>
          <Text style={styles.emptyTitle}>No Reels Found</Text>
          <TouchableOpacity onPress={() => fetchReels(1)} style={styles.retryButton}>
            <Text style={styles.retryText}>Refresh</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
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
        onRefresh={onRefresh}
        refreshing={refreshing}
        initialNumToRender={1}
        maxToRenderPerBatch={1}
        windowSize={3}
        removeClippedSubviews
        updateCellsBatchingPeriod={100}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        ListFooterComponent={renderFooter}
      />
      <TouchableOpacity style={styles.muteIndicator} onPress={toggleMute} activeOpacity={0.7}>
        <Icon name={isMuted ? 'volume-mute' : 'volume-high'} size={22} color="#fff" />
      </TouchableOpacity>
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  errorText: {
    color: '#ff4757',
    fontSize: 16,
    textAlign: 'center',
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
    textAlign: 'center',
  },
  reelContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    backgroundColor: 'black',
    position: 'relative',
  },
  videoWrapper: {
    flex: 1,
  },
  mediaContainer: {
    flex: 1,
  },
  media: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
  },
  placeholderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
  },
  placeholderText: {
    fontSize: 64,
    marginBottom: 10,
  },
  placeholderSubtext: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
  },
  bufferingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  likeAnimationContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    pointerEvents: 'none',
  },
  likeAnimation: {
    position: 'absolute',
  },
  muteIndicator: {
    position: 'absolute',
    top: 60,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  playPauseButton: {
    position: 'absolute',
    top: 110, // Positioned below mute button (60 + 40 + 10 spacing)
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
    elevation: 10, // For Android
  },
  queueIndicator: {
    position: 'absolute',
    top: 60,
    left: 16,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  queueText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  bottomLeftInfo: {
    position: 'absolute',
    bottom: 100,
    left: 16,
    maxWidth: SCREEN_WIDTH * 0.7,
  },
  bottomRightActions: {
    position: 'absolute',
    bottom: 100,
    right: 16,
    alignItems: 'center',
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

export default ReelsScreen;