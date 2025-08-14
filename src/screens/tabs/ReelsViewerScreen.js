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
  
  const flatListRef = useRef(null);
  const isFocused = useIsFocused();

  // Like animation states
  const [likeAnimations, setLikeAnimations] = useState([]);
  const animationId = useRef(0);

  // Queue system for like operations
  const [likeQueue, setLikeQueue] = useState([]);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);
  const queueRef = useRef([]);
  const processingRef = useRef(false);

  // Calculate dummy views based on video age
  const calculateDummyViews = useCallback((createdAt) => {
    if (!createdAt) return Math.floor(Math.random() * 31) + 20; // 20-50 for unknown dates
    
    try {
      const now = new Date();
      const createdDate = new Date(createdAt);
      const diffInHours = Math.floor((now - createdDate) / (1000 * 60 * 60));
      const diffInDays = Math.floor(diffInHours / 24);
      
      let baseViews;
      let randomRange;
      
      if (diffInHours < 24) {
        // Less than 1 day: 20-50 views
        baseViews = 20;
        randomRange = 30;
      } else if (diffInDays <= 7) {
        // 1-7 days: 50-100 views
        baseViews = 50;
        randomRange = 50;
      } else if (diffInDays <= 30) {
        // 1-30 days: 100-130 views
        baseViews = 100;
        randomRange = 30;
      } else {
        // More than 30 days: 120-150 views
        baseViews = 120;
        randomRange = 30;
      }
      
      // Add some randomization and account for engagement
      const randomViews = Math.floor(Math.random() * randomRange);
      const finalViews = baseViews + randomViews;
      
      return Math.min(Math.max(finalViews, 20), 150); // Ensure it's between 20-150
    } catch (error) {
      console.error('Error calculating views:', error);
      return Math.floor(Math.random() * 31) + 20; // Default to 20-50
    }
  }, []);

  // Format views count (e.g., 1.2K, 1M)
  const formatViewCount = useCallback((count) => {
    if (count < 1000) return count.toString();
    if (count < 1000000) return `${(count / 1000).toFixed(1)}K`;
    return `${(count / 1000000).toFixed(1)}M`;
  }, []);

  // Process like queue in background
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
          // Don't revert UI since user already saw the change
          // Just log the error and continue processing
          continue;
        }

        const updatedData = await response.json();
        console.log('Like queue success:', updatedData);
        
        // Optionally update with server response for accuracy
        if (updatedData.success && updatedData.data) {
          setReels(prevReels => 
            prevReels.map(reel => 
              reel._id === likeAction.reelId 
                ? { 
                    ...reel, 
                    likes: updatedData.data.reel?.likes || reel.likes || []
                  }
                : reel
            )
          );
        }

      } catch (error) {
        console.error('Error processing like queue:', error);
        // Continue processing other items in queue
        continue;
      }

      // Small delay to prevent overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    processingRef.current = false;
    setIsProcessingQueue(false);
  }, [token]);

  // Add like action to queue
  const addToLikeQueue = useCallback((reelId, action) => {
    const likeAction = {
      reelId,
      action, // 'like' or 'unlike'
      timestamp: Date.now()
    };

    // Remove any existing action for this reel to avoid duplicates
    queueRef.current = queueRef.current.filter(item => item.reelId !== reelId);
    
    // Add new action
    queueRef.current.push(likeAction);
    
    setLikeQueue(prev => {
      const filtered = prev.filter(item => item.reelId !== reelId);
      return [...filtered, likeAction];
    });

    // Start processing queue
    processLikeQueue();
  }, [processLikeQueue]);

  // Profile press handler (similar to ReelsScreen)
  const handleProfilePress = useCallback((authorData) => {
    try {
      console.log('Profile press triggered for:', authorData?.fullName || authorData?.username);
      console.log('Navigation object:', !!navigation);
      console.log('Author data:', authorData);

      const userId = authorData?._id || authorData?.id;
      const authorName = authorData?.fullName || authorData?.username;

      if (!navigation) {
        console.error('Navigation prop not passed to ReelsViewerScreen component');
        Alert.alert('Error', 'Navigation not available');
        return;
      }

      if (!userId || userId === 'unknown') {
        console.error('User ID not available in author data');
        Alert.alert('Error', 'Unable to view profile');
        return;
      }

      // Check if it's the current user's profile
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
  }, [navigation, user]);

  // App state handler
  useEffect(() => {
    const handleAppStateChange = (nextAppState) => {
      setIsAppActive(nextAppState === 'active');
      setAppState(nextAppState);
    };
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, []);

  // Scroll to initial index on mount
  useEffect(() => {
    if (flatListRef.current && initialIndex > 0 && reels.length > initialIndex) {
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({ index: initialIndex, animated: false });
      }, 100);
    }
  }, [initialIndex, reels.length]);

  // Calculate isLiked for each reel and add dummy views on mount
  useEffect(() => {
    if (user && initialReels.length > 0) {
      const userId = user._id || user.id;
      const reelsWithViewsAndLikes = initialReels.map(reel => {
        const dummyViews = calculateDummyViews(reel.createdAt);
        return {
          ...reel,
          viewCount: dummyViews, // Add dummy views based on age
          isLiked: reel.likes?.some(like => 
            (typeof like === 'object' ? like.user || like._id : like) === userId
          ) || false
        };
      });
      setReels(reelsWithViewsAndLikes);
    } else if (initialReels.length > 0) {
      // Add views even if no user
      const reelsWithViews = initialReels.map(reel => ({
        ...reel,
        viewCount: calculateDummyViews(reel.createdAt),
        isLiked: false
      }));
      setReels(reelsWithViews);
    }
  }, [user, initialReels, calculateDummyViews]);

  const handleBack = () => navigation.goBack();

  const handleViewableItemsChanged = useCallback(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index);
    }
  }, []);

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

  // Instant like functionality with queue processing
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
      const userId = user._id || user.id;
      
      // INSTANT UI UPDATE - No loading, no waiting
      setReels(prevReels => 
        prevReels.map(reel => {
          if (reel._id === reelId) {
            const newLikes = wasLiked 
              ? reel.likes?.filter(like => (typeof like === 'object' ? like.user || like._id : like) !== userId) || []
              : [...(reel.likes || []), { user: userId, _id: Date.now().toString() }];
            
            return { 
              ...reel, 
              isLiked: !wasLiked,
              likes: newLikes
            };
          }
          return reel;
        })
      );

      // Show animation only when liking (not unliking)
      if (!wasLiked) {
        createLikeAnimation();
      }

      // Add to queue for background processing
      const action = wasLiked ? 'unlike' : 'like';
      addToLikeQueue(reelId, action);
      
      console.log(`✅ Reel ${action} updated instantly, queued for processing`);

    } catch (error) {
      console.error('Error in instant like:', error);
      // Even if there's an error, we don't revert the UI
      // The queue will handle the API call
    }
  }, [token, user, reels, createLikeAnimation, addToLikeQueue]);

  // Navigate to comments screen (matching ReelsScreen)
  const openComments = useCallback((reel) => {
    if (!navigation) {
      console.error('Navigation prop not available');
      return;
    }

    navigation.navigate('CommentScreen', {
      reelId: reel._id,
      reelData: reel,
      contentType: 'reel',
      onCommentUpdate: (newCommentCount, realTimeComments) => {
        // Update comment count in reels list
        setReels(prevReels =>
          prevReels.map(r =>
            r._id === reel._id
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
  }, [navigation]);

  const formatTimeAgo = useCallback((dateString) => {
    if (!dateString) return 'Recently';
    try {
      const date = new Date(dateString);
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
  }, []);

  const getInitials = useCallback((name) => {
    if (!name) return '?';
    const names = name.trim().split(/\s+/);
    if (names.length === 1) return names[0][0].toUpperCase();
    return (names[0][0] + (names[names.length - 1][0] || '')).toUpperCase();
  }, []);

  const toggleMute = useCallback(() => setIsMuted(prev => !prev), []);
  const handleBuffer = useCallback((index, isBuffering) => setVideoBuffering(prev => ({ ...prev, [index]: isBuffering })), []);

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
    if (!item) return <View style={styles.reelContainer} />;

    const isActive = index === currentIndex;
    const isPaused = !isActive || !isAppActive || !isFocused;
    
    const isVideo = !!item.video?.url;
    const author = item.author || {};
    const authorName = author.fullName || author.username || username;
    const isLiked = item.isLiked;
    const likeCount = item.likes?.length || 0;
    const commentCount = item.commentCount || item.comments?.length || 0;
    const viewCount = item.viewCount || 0;
    const mediaSource = item.video?.thumbnail?.url || item.video?.url || item.images?.[0]?.url;

    return (
      <View style={styles.reelContainer}>
        {/* Simplified media container, no tap-to-pause */}
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
            <Image source={{ uri: mediaSource }} style={styles.media} resizeMode="cover" />
          ) : (
            <View style={styles.placeholderContainer}>
              <Text style={styles.placeholderText}>🎥</Text>
            </View>
          )}
        </View>

        {isActive && <LikeAnimations />}

        <View style={styles.bottomLeftInfo}>
          {/* Made author name touchable */}
          <TouchableOpacity 
            onPress={() => handleProfilePress(author)} 
            activeOpacity={0.8}
          >
            <Text style={styles.authorName}>{authorName}</Text>
          </TouchableOpacity>
          <Text style={styles.timeAgo}>{formatTimeAgo(item.createdAt)}</Text>
          {item.content ? <Text style={styles.caption} numberOfLines={2}>{item.content}</Text> : null}
        </View>

        <View style={styles.bottomRightActions}>
          {/* Like Button with Vector Icon - NO LOADING STATE */}
          <TouchableOpacity 
            style={styles.actionButton} 
            onPress={() => handleLikePress(item._id)} 
            activeOpacity={0.7}
          >
            <Icon 
              name={isLiked ? "heart" : "heart-outline"} 
              size={28} 
              color={isLiked ? "#ed167e" : "#fff"} 
              style={styles.actionIcon}
            />
            <Text style={styles.actionCount}>{likeCount}</Text>
          </TouchableOpacity>

          {/* Comment Button */}
          <TouchableOpacity 
            style={styles.actionButton} 
            onPress={() => openComments(item)} 
            activeOpacity={0.7}
          >
            <Icon 
              name="chatbubble-outline" 
              size={26} 
              color="#fff" 
              style={styles.actionIcon}
            />
            <Text style={styles.actionCount}>{commentCount}</Text>
          </TouchableOpacity>

          {/* Views Button */}
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
            <Text style={styles.actionCount}>{formatViewCount(viewCount)}</Text>
          </TouchableOpacity>

          {/* Made Author Avatar touchable */}
          <TouchableOpacity 
            style={styles.authorAvatar}
            onPress={() => handleProfilePress(author)} 
            activeOpacity={0.8}
          >
            {author.photoUrl ? (
              <Image 
                source={{ uri: author.photoUrl.url || author.photoUrl }} 
                style={styles.authorAvatarImage} 
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
    formatViewCount
  ]);

  const keyExtractor = useCallback((item, index) => item?._id || `reel-${index}`, []);
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
        onScrollToIndexFailed={() => {}} // Handle potential errors gracefully
        initialNumToRender={1}
        maxToRenderPerBatch={1}
        windowSize={3}
      />

      {/* Overlays */}
      <TouchableOpacity onPress={handleBack} style={styles.backButton} activeOpacity={0.7}>
        <Icon name="arrow-back" size={24} color="#fff" />
      </TouchableOpacity>

      {/* MUTE BUTTON */}
      <TouchableOpacity style={styles.muteIndicator} onPress={toggleMute} activeOpacity={0.7}>
        <Icon name={isMuted ? 'volume-mute' : 'volume-high'} size={22} color="#fff" />
      </TouchableOpacity>

      {/* Optional: Debug indicator for queue processing (remove in production) */}
      {isProcessingQueue && (
        <View style={styles.queueIndicator}>
          <Text style={styles.queueText}>Syncing...</Text>
        </View>
      )}
    </SafeAreaView>
  );
};

// --- STYLES: ENHANCED to match ReelsScreen UI ---
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
  queueIndicator: {
    position: 'absolute',
    top: 110,
    right: 16,
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
    right: 100, // Prevent overlap with actions
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
    textDecorationLine: 'underline', // Added to indicate it's clickable
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