// ExploreScreen.jsx
import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Text,
  TouchableOpacity,
  SafeAreaView,
  Image,
  Modal,
  Dimensions,
  PanResponder,
  Animated,
  TextInput
} from "react-native";
import Video from 'react-native-video'; // Not directly used here anymore, but kept for potential future use or other components
import { useNavigation } from '@react-navigation/native';
import { useAuth } from "../../context/AuthContext";
import BASE_URL from "../../config/config";
import Icon from 'react-native-vector-icons/Ionicons';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const ExploreScreen = () => {
  const navigation = useNavigation();
  const { token } = useAuth();
  const [allImages, setAllImages] = useState([]);
  const [displayedImages, setDisplayedImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hasInitialLoad, setHasInitialLoad] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  // Zoom modal states
  const [zoomModalVisible, setZoomModalVisible] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);

  // Animation values for zoom
  const scale = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  const API_LIMIT = 20;

  // Function to normalize URLs and fix double protocol issues
  const normalizeImageUrl = (url) => {
    if (!url || typeof url !== 'string') return null;

    let cleanUrl = url.trim();

    // Handle common double protocol issues
    if (cleanUrl.includes('https://http://')) {
      cleanUrl = cleanUrl.replace('https://http://', 'https://');
    } else if (cleanUrl.includes('https://https://')) {
      cleanUrl = cleanUrl.replace('https://https://', 'https://');
    } else if (cleanUrl.includes('http://https://')) {
      cleanUrl = cleanUrl.replace('http://https://', 'https://');
    } else if (cleanUrl.includes('http://http://')) {
      cleanUrl = cleanUrl.replace('http://http://', 'http://');
    }

    // Ensure it starts with a protocol
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      if (cleanUrl.startsWith('//')) {
        cleanUrl = 'https:' + cleanUrl;
      } else if (cleanUrl.startsWith('/')) {
        // Relative URL, cannot be used directly
        return null;
      } else {
        // Assume https if no protocol
        cleanUrl = 'https://' + cleanUrl;
      }
    }

    return cleanUrl;
  };

  // Function to extract video URL from post
  const extractVideoUrl = (post) => {
    let videoUrl = null;

    try {
      if (post.type === 'reel' && post.video) {
        videoUrl = post.video.cdnUrl || post.video.url || post.video.key;
      } else if (post.media && post.media.length > 0) {
        const videoMedia = post.media.find(media => media.type === 'video');
        if (videoMedia) {
          videoUrl = videoMedia.cdnUrl || videoMedia.url || videoMedia.key;
        }
      }

      videoUrl = normalizeImageUrl(videoUrl);

    } catch (error) {
      console.error('Error extracting video URL for post:', post._id, error);
    }

    return videoUrl;
  };

  // Function to extract image URL from different post structures
  const extractImageUrl = (post) => {
    let imageUrl = null;

    try {
      if (post.type === 'post' && post.images && post.images.length > 0) {
        const firstImage = post.images[0];
        imageUrl = firstImage.cdnUrl || firstImage.url || firstImage.key;
      } else if (post.type === 'reel' && post.video) {
        // Try to get thumbnail from video object
        if (post.video.thumbnail) {
          imageUrl = post.video.thumbnail.cdnUrl || post.video.thumbnail.url;
        } else if (post.video.thumbnails) {
          // Fallback to largest available thumbnail
          const thumbnails = post.video.thumbnails;
          const thumbnail = thumbnails.large || thumbnails.medium || thumbnails.small;
          if (thumbnail) {
            imageUrl = thumbnail.cdnUrl || thumbnail.url;
          }
        }
        // Final fallback to post.thumbnail
        if (!imageUrl && post.thumbnail) {
          imageUrl = post.thumbnail.cdnUrl || post.thumbnail.url;
        }
      } else if (post.image) {
        imageUrl = post.image.cdnUrl || post.image.url || post.image;
      } else if (post.thumbnail) {
        imageUrl = post.thumbnail.cdnUrl || post.thumbnail.url || post.thumbnail;
      } else if (post.media && post.media.length > 0) {
        const firstMedia = post.media[0];
        // Prefer image type, fallback to thumbnail if it's a video
        imageUrl = firstMedia.cdnUrl || firstMedia.url || firstMedia.thumbnail;
      }

      imageUrl = normalizeImageUrl(imageUrl);

    } catch (error) {
      console.error('Error extracting image URL for post:', post._id, error);
    }

    return imageUrl;
  };


  // Shuffle array function
  const shuffleArray = (array) => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  // Function to get 10 random images from all available images
  const getRandomImages = (allImagesArray) => {
    if (allImagesArray.length <= 10) {
      return shuffleArray(allImagesArray);
    }
    const shuffled = shuffleArray(allImagesArray);
    return shuffled.slice(0, 10);
  };

  // Fetch images only once
  const fetchInitialImages = useCallback(async () => {
    if (!token || hasInitialLoad) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        limit: API_LIMIT.toString(),
        offset: '0',
        type: 'all',
        seed: Math.random().toString(36).substring(7) // Add randomness to seed
      });

      const url = `${BASE_URL}/api/v1/posts/explore?${params.toString()}`;
      console.log('Fetching initial explore content from:', url);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('Response status:', response.status);

      if (response.status === 429) {
        setError("Too many requests. Please try again later.");
        return;
      }

      const result = await response.json();
      console.log('API Response:', result);

      if (response.ok && result.success && result.data) {
        const posts = result.data.posts || [];
        console.log(`Raw posts received: ${posts.length}`);

        const newExploreItems = posts.map(post => {
          const mainImage = extractImageUrl(post);
          const videoUrl = extractVideoUrl(post);

          let imageCount = 0;
          if (post.type === 'post' && post.images) {
            imageCount = post.images.length;
          } else if (post.type === 'reel') {
            imageCount = 1; // Reels have one video, but we show a thumbnail
          } else if (post.media) {
            imageCount = post.media.length;
          } else {
            imageCount = mainImage ? 1 : 0;
          }

          return {
            id: post._id,
            imageUrl: mainImage, // Used for display thumbnail
            videoUrl: videoUrl,  // Used for video source (if applicable)
            imageCount: imageCount,
            isLikedByCurrentUser: post.isLikedByUser || false,
            userSimilarityScore: post.exploreScore || 0,
            author: post.author || {},
            type: post.type || 'post',
            likeCount: post.realTimeLikes || post.likeCount || 0,
            commentCount: post.realTimeComments || post.commentCount || 0,
            viewCount: post.realTimeViews || post.views || 0,
            caption: post.caption || '',
            createdAt: post.createdAt,
            tags: post.tags || [],
            originalPost: post // Keep original for potential future use
          };
        });

        // Filter valid items: must have a valid image or video URL
        const validItems = newExploreItems.filter(item => {
          const hasValidImage = item.imageUrl &&
            typeof item.imageUrl === 'string' &&
            item.imageUrl.length > 0 &&
            (item.imageUrl.startsWith('http://') || item.imageUrl.startsWith('https://'));

          const hasValidVideo = item.videoUrl &&
            typeof item.videoUrl === 'string' &&
            item.videoUrl.length > 0 &&
            (item.videoUrl.startsWith('http://') || item.videoUrl.startsWith('https://'));

          return hasValidImage || hasValidVideo;
        });

        console.log(`Processed ${validItems.length} valid items from ${newExploreItems.length} total posts`);

        if (validItems.length === 0) {
          setError("No content could be loaded from the posts.");
        } else {
          setAllImages(validItems);
          setDisplayedImages(getRandomImages(validItems));
          setHasInitialLoad(true);
        }

      } else {
        const errorMessage = result.message || result.error || 'Failed to fetch explore content.';
        setError(errorMessage);
      }
    } catch (e) {
      console.error('Network error fetching explore content:', e);
      setError("Failed to load content. Please check your internet connection and try again.");
    } finally {
      setLoading(false);
    }
  }, [token, hasInitialLoad]);

  // Search users function
  const searchUsers = async (query) => {
    if (!query.trim() || !token) return;

    setSearching(true);
    try {
      const response = await fetch(
        `${BASE_URL}/api/v1/users/users/search?q=${encodeURIComponent(query)}&limit=10`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const result = await response.json();
      if (response.ok && result.success) {
        setSearchResults(result.data.results);
      }
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setSearching(false);
    }
  };

  // Debounce search
  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      if (searchQuery.trim()) {
        searchUsers(searchQuery);
      } else {
        setSearchResults([]);
      }
    }, 500);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

  // Initial load when component mounts
  useEffect(() => {
    if (token && !hasInitialLoad) {
      console.log('Starting initial fetch...');
      fetchInitialImages();
    }
  }, [token, hasInitialLoad, fetchInitialImages]);

  // Shuffle displayed images
  const shuffleDisplayedImages = useCallback(() => {
    if (allImages.length > 0) {
      console.log('Shuffling displayed images...');
      const newDisplayed = getRandomImages(allImages);
      setDisplayedImages(newDisplayed);
    }
  }, [allImages]);

  // Function to refresh the feed
  const handleRefresh = useCallback(() => {
    if (allImages.length > 0) {
      console.log('Refreshing feed by shuffling...');
      shuffleDisplayedImages();
    } else {
      fetchInitialImages();
    }
  }, [allImages.length, shuffleDisplayedImages, fetchInitialImages]);

  // Function to load more images
  const loadMore = useCallback(() => {
    if (allImages.length > 0) {
      console.log('Loading more by shuffling...');
      shuffleDisplayedImages();
    }
  }, [allImages.length, shuffleDisplayedImages]);


  // --- MODIFIED: handleVideoPress now formats data for ReelsViewerScreen ---
  const handleVideoPress = (item) => {
    if (item.videoUrl && item.type === 'reel') {
      // Format the item to match ReelsViewerScreen's expected structure
      const formattedReel = {
        _id: item.id, // Use _id as ReelsViewerScreen expects
        video: {
          url: item.videoUrl, // Direct MP4 URL
          thumbnail: {
            url: item.imageUrl, // Thumbnail image URL
          },
        },
        author: item.author,
        content: item.caption || '',
        caption: item.caption || '',
        likeCount: item.likeCount,
        commentCount: item.commentCount,
        viewCount: item.viewCount,
        createdAt: item.createdAt,
        tags: item.tags || [],
        isLikedByCurrentUser: item.isLikedByCurrentUser || false,
        likes: [], // ReelsViewerScreen might populate this or fetch it
        comments: [],
        // Add any other specific fields ReelsViewerScreen might need directly from item.originalPost if necessary
      };

      // Navigate to ReelsViewerScreen with the correctly formatted data
      navigation.navigate('ReelsViewerScreen', {
        reels: [formattedReel], // Pass as an array with one item
        initialIndex: 0,       // Start at index 0
        username: item.author?.username || item.author?.fullName || 'User'
      });
    }
  };


  // Handle image long press (zoom)
  const handleImageLongPress = (item) => {
    if (item.imageUrl && item.type !== 'reel') {
      setSelectedImage(item);
      setZoomModalVisible(true);
      // Reset animation values
      scale.setValue(1);
      translateX.setValue(0);
      translateY.setValue(0);
    }
  };

  // Handle user press from search
  const handleUserPress = (userId) => {
    setSearchQuery('');
    setSearchResults([]);
    navigation.navigate('UserProfile', { userId });
  };

  // Pan responder for zoom functionality
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderGrant: () => {
        scale.setOffset(scale._value);
        translateX.setOffset(translateX._value);
        translateY.setOffset(translateY._value);
      },
      onPanResponderMove: (evt, gestureState) => {
        // Handle pinch to zoom (basic implementation)
        if (evt.nativeEvent.touches.length === 2) {
          const touch1 = evt.nativeEvent.touches[0];
          const touch2 = evt.nativeEvent.touches[1];
          const distance = Math.sqrt(
            Math.pow(touch2.pageX - touch1.pageX, 2) +
            Math.pow(touch2.pageY - touch1.pageY, 2)
          );
          const newScale = Math.max(1, Math.min(3, distance / 200)); // Min 1x, Max 3x
          scale.setValue(newScale);
        } else {
          // Handle pan
          translateX.setValue(gestureState.dx);
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderTerminationRequest: () => true,
      onPanResponderRelease: () => {
        scale.flattenOffset();
        translateX.flattenOffset();
        translateY.flattenOffset();
      },
    })
  ).current;

  // Close zoom modal
  const closeZoomModal = () => {
    setZoomModalVisible(false);
    setSelectedImage(null);
  };


  // Uniform Grid Item Component
  const UniformGridItem = ({ item, index, onPress, onLongPress }) => {
    const isReel = item.type === 'reel';
    return (
      <TouchableOpacity
        style={styles.gridItem}
        onPress={() => {
          if (isReel && item.videoUrl) {
             // If it's a reel with a video, navigate to ReelsViewerScreen
            handleVideoPress(item);
          } else {
            // Handle press for images or non-video reels (currently logs)
            onPress && onPress(item, index);
          }
        }}
        onLongPress={() => onLongPress && onLongPress(item)}
        activeOpacity={0.8}
      >
        <Image
          source={{ uri: item.imageUrl }}
          style={styles.uniformImage}
          resizeMode="cover"
        />

        {/* Overlay for additional info */}
        <View style={styles.overlay}>
          {/* Image count indicator for multiple images */}
          {item.imageCount > 1 && (
            <View style={styles.imageCountBadge}>
              <Text style={styles.imageCountText}>{item.imageCount}</Text>
            </View>
          )}

          {/* Video indicator for reels */}
          {isReel && (
            <View style={styles.videoBadge}>
              <Text style={styles.videoBadgeText}>▶</Text>
            </View>
          )}

          {/* Like count */}
          {item.likeCount > 0 && (
            <View style={styles.statsContainer}>
              <Text style={styles.statsText}>{item.likeCount} ♥</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // Render individual item
  const renderItem = useCallback(({ item, index }) => {
    return (
      <UniformGridItem
        item={item}
        index={index}
        onPress={(selectedItem) => {
          console.log('Content pressed:', {
            id: selectedItem.id,
            type: selectedItem.type,
            hasImage: !!selectedItem.imageUrl,
            hasVideo: !!selectedItem.videoUrl
          });
          // Add navigation to a detail screen for images/posts if needed here
        }}
        onLongPress={handleImageLongPress}
      />
    );
  }, [handleImageLongPress]);

  // Render search result item
  const renderSearchResult = ({ item }) => (
    <TouchableOpacity
      style={styles.searchResultItem}
      onPress={() => handleUserPress(item._id)}
    >
      <Image
        source={{ uri: item.photoUrl?.trim() || 'https://via.placeholder.com/40' }}
        style={styles.searchResultAvatar}
      />
      <View style={styles.searchResultText}>
        <Text style={styles.searchResultName}>{item.fullName}</Text>
        <Text style={styles.searchResultUsername}>@{item.username}</Text>
      </View>
    </TouchableOpacity>
  );

  // Show full-screen loader for initial load
  if (loading && !hasInitialLoad) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#ed167e" />
        <Text style={styles.loadingText}>Loading explore feed...</Text>
      </SafeAreaView>
    );
  }

  // Show error state
  if (error && displayedImages.length === 0) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchInitialImages}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // Show empty state
  if (!loading && displayedImages.length === 0 && !error) {
    return (
      <View style={styles.container}>
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Text style={styles.exploreText}>EXPLORE</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search users..."
              placeholderTextColor="#aaa"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
            />
            <Icon name="search" size={20} color="#ed167e" style={styles.searchIcon} />
          </View>
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No explore content available at the moment.</Text>
          <Text style={styles.emptySubText}>Check back later for fresh content!</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchInitialImages}>
            <Text style={styles.retryButtonText}>Refresh Feed</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Main content display
  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Text style={styles.exploreText}>EXPLORE</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search users..."
            placeholderTextColor="#aaa"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
          />
          <Icon name="search" size={20} color="#ed167e" style={styles.searchIcon} />
        </View>

        {/* Search Results Dropdown */}
        {searchQuery.length > 0 && (
          <View style={styles.searchResultsContainer}>
            {searching ? (
              <View style={styles.searchLoading}>
                <ActivityIndicator size="small" color="#ed167e" />
              </View>
            ) : (
              <FlatList
                data={searchResults}
                renderItem={renderSearchResult}
                keyExtractor={(item) => item._id}
                style={styles.searchResultsList}
                keyboardShouldPersistTaps="always"
              />
            )}
          </View>
        )}
      </View>

      {/* Content Grid */}
      <FlatList
        data={displayedImages}
        keyExtractor={(item, index) => `${item.id}-${index}`}
        renderItem={renderItem}
        numColumns={2}
        columnWrapperStyle={styles.row}
        showsVerticalScrollIndicator={false}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        onRefresh={handleRefresh}
        refreshing={false}
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={100}
        windowSize={5}
        initialNumToRender={10}
        contentContainerStyle={styles.contentContainer}
        ListHeaderComponent={<View style={{ height: 16 }} />} // Spacer for search bar
      />

      {/* Show shuffle indicator */}
      <View style={styles.shuffleIndicator}>
        <Text style={styles.shuffleText}>
          {`• Pull to shuffle • Hold to zoom`}
        </Text>
      </View>


      {/* Zoom Modal */}
      <Modal
        visible={zoomModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={closeZoomModal}
      >
        <View style={styles.modalContainer}>
          <TouchableOpacity
            style={styles.modalOverlay}
            onPress={closeZoomModal}
            activeOpacity={1}
          >
            <View style={styles.zoomContainer} {...panResponder.panHandlers}>
              {selectedImage && (
                <Animated.Image
                  source={{ uri: selectedImage.imageUrl }}
                  style={[
                    styles.zoomedImage,
                    {
                      transform: [
                        { scale: scale },
                        { translateX: translateX },
                        { translateY: translateY }
                      ]
                    }
                  ]}
                  resizeMode="contain"
                />
              )}
            </View>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Show error message overlay if there's an error but we still have images */}
      {error && displayedImages.length > 0 && (
        <View style={styles.errorOverlay}>
          <Text style={styles.errorOverlayText}>{error}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "black",
  },
  center: {
    justifyContent: "center",
    alignItems: "center",
  },
  searchContainer: {
    backgroundColor: '#000',
    paddingHorizontal: 16,
    paddingVertical: 12,
    zIndex: 100, // Ensure it stays on top
  },
  searchBar: {
    backgroundColor: '#1a1a1a',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  exploreText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
    marginRight: 10,
  },
  searchInput: {
    color: 'white',
    fontSize: 16,
    flex: 1,
  },
  searchIcon: {
    marginLeft: 10,
  },
  searchResultsContainer: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    marginTop: 8,
    maxHeight: 300,
    zIndex: 1000, // Ensure dropdown is above content
  },
  searchResultsList: {
    maxHeight: 300,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  searchResultAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  searchResultText: {
    flex: 1,
  },
  searchResultName: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  searchResultUsername: {
    color: '#aaa',
    fontSize: 14,
  },
  searchLoading: {
    padding: 16,
    alignItems: 'center',
  },
  contentContainer: {
    paddingBottom: 60, // Space for shuffle indicator
    paddingHorizontal: 5,
  },
  row: {
    justifyContent: 'space-between',
    paddingHorizontal: 5,
  },
  gridItem: {
    width: '48%',
    height: 200,
    marginBottom: 10,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
  },
  uniformImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
    padding: 8,
  },
  imageCountBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  imageCountText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  videoBadge: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -15 }, { translateY: -15 }], // Center the badge
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoBadgeText: {
    color: 'white',
    fontSize: 12,
    marginLeft: 2, // Adjust for triangle shape if needed
  },
  statsContainer: {
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  statsText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '500',
  },
  shuffleIndicator: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.8)',
    padding: 10,
    borderRadius: 20,
    alignItems: 'center',
    zIndex: 10, // Ensure it's above the FlatList content
  },
  shuffleText: {
    color: '#999',
    fontSize: 12,
    textAlign: 'center',
  },
  loadingText: {
    color: '#999',
    fontSize: 16,
    marginTop: 16,
  },
  errorText: {
    color: '#ff4757',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  retryButton: {
    backgroundColor: '#ed167e',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    color: '#999',
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 10,
  },
  emptySubText: {
    color: '#777',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  errorOverlay: {
    position: 'absolute',
    top: 100,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.8)',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    zIndex: 1000, // Ensure it's on top
  },
  errorOverlayText: {
    color: '#ff4757',
    fontSize: 14,
    textAlign: 'center',
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomContainer: {
    width: screenWidth,
    height: screenHeight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomedImage: {
    width: screenWidth,
    height: screenHeight * 0.8,
  },
  // Removed video modal styles as they are no longer used
});

export default ExploreScreen;