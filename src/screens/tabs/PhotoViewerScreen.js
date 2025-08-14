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
} from 'react-native';
import Video from 'react-native-video';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../../context/AuthContext';
import BASE_URL from '../../config/config';

const { width, height } = Dimensions.get('window');
const imageWidth = width - 20; // Account for container padding

const PhotoViewerScreen = ({ navigation, route }) => {
  const { posts, initialIndex = 0, username } = route.params;
  const { token, user } = useAuth();
  const [currentPosts, setCurrentPosts] = useState(posts || []);
  const [loading, setLoading] = useState(false);
  const flatListRef = useRef(null);

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
                  likeCount: data.data.likeCount,
                }
              : post
          )
        );
        return { success: true, data: data.data };
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
    
    console.log('🧹 URL sanitized:', { original: url, cleaned: cleanUrl });
    return cleanUrl;
  };

  // Post component with animations and carousel support - adapted from Post.js
  const PostItem = ({ item, index }) => {
    const isVideo = item.type === 'reel';
    const authorName = item.author?.fullName || username;
    const authorPhoto = item.author?.photoUrl;

    // Animation states for each post
    const [isLiked, setIsLiked] = useState(item.isLikedByUser || false);
    const [likesCount, setLikesCount] = useState(item.likeCount || 0);
    const [commentsCount, setCommentsCount] = useState(item.commentsCount || item.comments || 0);
    const [likeOperationInProgress, setLikeOperationInProgress] = useState(false);
    
    // NEW: State for image carousel
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const scrollViewRef = useRef(null);
    
    // Animation refs - same as Post.js
    const heartScaleAnim = useRef(new Animated.Value(1)).current;
    const centerHeartAnim = useRef(new Animated.Value(0)).current;
    const centerHeartOpacity = useRef(new Animated.Value(0)).current;
    const heartFillAnim = useRef(new Animated.Value(isLiked ? 1 : 0)).current;

    // Enhanced image processing with URL sanitization and carousel support
    const processImages = () => {
      console.log('🔍 Processing images for post:', item._id);
      console.log('🔍 Available image data:', {
        'item.images': item.images,
        'item.video': item.video,
        'isVideo': isVideo
      });

      // Handle video content
      if (isVideo && item.video?.url) {
        console.log('📹 Video post detected:', item.video.url);
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

    // Enhanced center heart animation with bounce effect - from Post.js
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

    // Enhanced like handler with proper error handling - from Post.js
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
        setLikesCount(item.likeCount || 0);
        animateHeartButton(item.isLikedByUser || false);
        
        Alert.alert('Error', 'Failed to update like. Please try again.');
      } finally {
        setLikeOperationInProgress(false);
      }
    };

    // Comment button press handler - from Post.js
    const handleCommentPress = () => {
      console.log('=== COMMENT BUTTON PRESSED ===');
      console.log('Using Post ID:', item._id);

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

    // Double tap to like functionality
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
            >
              {postImages.map((image, index) => {
                // Skip images without valid URIs
                if (!image?.uri) {
                  console.log(`⚠️ Skipping image ${index + 1} - no valid URI`);
                  return null;
                }
                
                return (
                  <TouchableOpacity 
                    key={image.id || index}
                    onPress={handleDoubleTap} 
                    activeOpacity={1}
                    style={styles.carouselImageContainer}
                  >
                    {image.isVideo ? (
                      <Video
                        source={{ uri: image.uri }}
                        style={styles.postImage}
                        controls={true}
                        resizeMode="cover"
                        paused={true}
                        onError={(error) => {
                          console.log(`❌ Video ${index + 1} error:`, error);
                          console.log(`❌ Failed video URI:`, image.uri);
                        }}
                      />
                    ) : (
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
                    )}
                  </TouchableOpacity>
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
            {renderPaginationDots()}
            
            {/* Image counter for multi-image posts */}
            <View style={styles.imageCounterContainer}>
              <Text style={styles.imageCounterText}>
                {currentImageIndex + 1}/{postImages.length}
              </Text>
            </View>
          </View>
        );
      } else {
        // Single image or video
        return (
          <View style={styles.imageContainer}>
            <TouchableOpacity 
              onPress={handleDoubleTap} 
              activeOpacity={1}
              style={styles.postImageContainer}
            >
              {postImages[0].isVideo ? (
                <Video
                  source={{ uri: postImages[0].uri }}
                  style={styles.postImage}
                  controls={true}
                  resizeMode="cover"
                  paused={true}
                  onError={(error) => {
                    console.log('❌ Single video error:', error);
                    console.log('❌ Failed video URI:', postImages[0].uri);
                  }}
                />
              ) : (
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
              )}
              
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
            </TouchableOpacity>
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
          
          <TouchableOpacity onPress={handleProfilePress} activeOpacity={0.8}>
            <Text style={styles.username}>{authorName}</Text>
          </TouchableOpacity>
        </View>

        {/* Enhanced image content with carousel support */}
        {renderImageContent()}

        {/* Action buttons below post*/}
        <View style={styles.postFooterContainer}>
          <View style={styles.leftContent}>
            <Text style={styles.caption}>
              <Text style={{ fontWeight: "bold" }}>{authorName}</Text>
              {item.content && item.content.trim().length > 0 && (
                <Text> {item.content}</Text>
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
            {/* Clickable comments count */}
            {commentsCount > 0 && (
              <TouchableOpacity onPress={handleCommentPress} activeOpacity={0.8}>
                <Text style={styles.commentsText}>
                  View all {commentsCount} {commentsCount === 1 ? 'comment' : 'comments'}
                </Text>
              </TouchableOpacity>
            )}
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

  return (
    <SafeAreaView style={styles.screenContainer}>
      <StatusBar barStyle="light-content" backgroundColor="black" />
      
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
  username: {
    color: "white",
    fontSize: 14,
    fontWeight: '600',
  },
  imageContainer: {
    position: "relative",
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
});

export default PhotoViewerScreen;