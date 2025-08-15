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
  Animated
} from "react-native";
import Video from 'react-native-video';
import ExploreHeader from "../../components/Explore/ExploreHeader";
import { useAuth } from "../../context/AuthContext";
import BASE_URL from "../../config/config";

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const ExploreScreen = () => {
  const { token } = useAuth();
  const [allImages, setAllImages] = useState([]);
  const [displayedImages, setDisplayedImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hasInitialLoad, setHasInitialLoad] = useState(false);
  
  // Video modal states
  const [videoModalVisible, setVideoModalVisible] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [videoLoading, setVideoLoading] = useState(false);
  
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
    
    if (cleanUrl.includes('https://http://')) {
      cleanUrl = cleanUrl.replace('https://http://', 'https://');
    } else if (cleanUrl.includes('https://https://')) {
      cleanUrl = cleanUrl.replace('https://https://', 'https://');
    } else if (cleanUrl.includes('http://https://')) {
      cleanUrl = cleanUrl.replace('http://https://', 'https://');
    } else if (cleanUrl.includes('http://http://')) {
      cleanUrl = cleanUrl.replace('http://http://', 'http://');
    }
    
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      if (cleanUrl.startsWith('//')) {
        cleanUrl = 'https:' + cleanUrl;
      } else if (cleanUrl.startsWith('/')) {
        return null;
      } else {
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
        if (post.video.thumbnail) {
          imageUrl = post.video.thumbnail.cdnUrl || post.video.thumbnail.url;
        } else if (post.video.thumbnails) {
          const thumbnails = post.video.thumbnails;
          const thumbnail = thumbnails.large || thumbnails.medium || thumbnails.small;
          if (thumbnail) {
            imageUrl = thumbnail.cdnUrl || thumbnail.url;
          }
        }
        if (!imageUrl && post.thumbnail) {
          imageUrl = post.thumbnail.cdnUrl || post.thumbnail.url;
        }
      } else if (post.image) {
        imageUrl = post.image.cdnUrl || post.image.url || post.image;
      } else if (post.thumbnail) {
        imageUrl = post.thumbnail.cdnUrl || post.thumbnail.url || post.thumbnail;
      } else if (post.media && post.media.length > 0) {
        const firstMedia = post.media[0];
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
        seed: Math.random().toString(36).substring(7)
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
            imageCount = 1;
          } else if (post.media) {
            imageCount = post.media.length;
          } else {
            imageCount = mainImage ? 1 : 0;
          }

          return {
            id: post._id,
            imageUrl: mainImage,
            videoUrl: videoUrl,
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
            originalPost: post
          };
        });

        // Filter valid items
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

  // Handle video press
  const handleVideoPress = (item) => {
    if (item.videoUrl) {
      setSelectedVideo(item);
      setVideoModalVisible(true);
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
        // Handle pinch to zoom
        if (evt.nativeEvent.touches.length === 2) {
          const touch1 = evt.nativeEvent.touches[0];
          const touch2 = evt.nativeEvent.touches[1];
          const distance = Math.sqrt(
            Math.pow(touch2.pageX - touch1.pageX, 2) + 
            Math.pow(touch2.pageY - touch1.pageY, 2)
          );
          const newScale = Math.max(1, Math.min(3, distance / 200));
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

  // Close video modal
  const closeVideoModal = () => {
    setVideoModalVisible(false);
    setSelectedVideo(null);
  };

  // Uniform Grid Item Component
  const UniformGridItem = ({ item, index, onPress, onLongPress, onVideoPress }) => {
    return (
      <TouchableOpacity 
        style={styles.gridItem} 
        onPress={() => {
          if (item.type === 'reel' && item.videoUrl) {
            onVideoPress && onVideoPress(item);
          } else {
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
          {item.type === 'reel' && (
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
        }}
        onLongPress={handleImageLongPress}
        onVideoPress={handleVideoPress}
      />
    );
  }, []);

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
        <ExploreHeader />
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
      <ExploreHeader />
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
      />

      {/* Show shuffle indicator */}
      <View style={styles.shuffleIndicator}>
        <Text style={styles.shuffleText}>
          {`• Pull to shuffle • Hold to zoom`}
        </Text>
      </View>

      {/* Video Modal */}
      <Modal
        visible={videoModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={closeVideoModal}
      >
        <View style={styles.modalContainer}>
          <TouchableOpacity 
            style={styles.modalOverlay} 
            onPress={closeVideoModal}
            activeOpacity={1}
          >
            <View style={styles.videoContainer}>
              {selectedVideo && (
                <>
                  <TouchableOpacity 
                    style={styles.closeButton} 
                    onPress={closeVideoModal}
                  >
                    <Text style={styles.closeButtonText}>✕</Text>
                  </TouchableOpacity>
                  
                  {videoLoading && (
                    <View style={styles.videoLoadingContainer}>
                      <ActivityIndicator size="large" color="#ed167e" />
                    </View>
                  )}
                  
                  <Video
                    source={{ uri: selectedVideo.videoUrl }}
                    style={styles.fullScreenVideo}
                    controls={true}
                    resizeMode="contain"
                    onLoadStart={() => setVideoLoading(true)}
                    onLoad={() => setVideoLoading(false)}
                    onError={(error) => {
                      console.error('Video error:', error);
                      setVideoLoading(false);
                    }}
                  />
                </>
              )}
            </View>
          </TouchableOpacity>
        </View>
      </Modal>

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
  contentContainer: {
    paddingBottom: 60,
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
    transform: [{ translateX: -15 }, { translateY: -15 }],
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
    marginLeft: 2,
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
    zIndex: 1000,
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
  videoContainer: {
    width: screenWidth,
    height: screenHeight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenVideo: {
    width: screenWidth,
    height: screenHeight * 0.7,
  },
  videoLoadingContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -25 }, { translateY: -25 }],
    zIndex: 1000,
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
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  closeButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default ExploreScreen;