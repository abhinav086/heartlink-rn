import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Image,
  Text,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  ActivityIndicator,
  Alert,
  PanGestureHandler,
  Animated
} from 'react-native';
import Video from 'react-native-video';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useRoute } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import BASE_URL from '../../config/config';

const { width, height } = Dimensions.get('window');

const StoryViewer = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { stories: initialStories, currentIndex = 0, userName, userAvatar, userId, isOwnStory = false } = route.params;

  const [stories, setStories] = useState(initialStories);
  const [currentStoryIndex, setCurrentStoryIndex] = useState(currentIndex);
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const [paused, setPaused] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [mediaError, setMediaError] = useState(false);
  
  const progressRef = useRef(new Animated.Value(0)).current;
  const intervalRef = useRef(null);
  const videoRef = useRef(null);
  const storyDuration = 5000; // 5 seconds per story

  useEffect(() => {
    StatusBar.setHidden(true);
    return () => StatusBar.setHidden(false);
  }, []);

  useEffect(() => {
    if (stories && stories.length > 0) {
      setMediaError(false); // Reset media error for new story
      startStoryProgress();
      markStoryAsViewed(stories[currentStoryIndex]);
      checkStoryExpiration(stories[currentStoryIndex]);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [currentStoryIndex, stories]);

  // Enhanced avatar handling matching AllStories component
  const getInitials = (name) => {
    if (!name || typeof name !== 'string' || name === 'Unknown User') return '?';
    const names = name.trim().split(' ');
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
    
    if (!name || typeof name !== 'string') return colors[0];
    const charCodeSum = name.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
    return colors[charCodeSum % colors.length];
  };

  // Enhanced media URL validation
  const getValidMediaUrl = (mediaUrl) => {
    if (!mediaUrl || typeof mediaUrl !== 'string') return null;
    
    const trimmedUrl = mediaUrl.trim();
    if (trimmedUrl === '') return null;
    
    // Handle relative URLs by making them absolute if needed
    if (trimmedUrl.startsWith('http')) {
      return trimmedUrl;
    } else if (trimmedUrl.startsWith('/')) {
      return `${BASE_URL}${trimmedUrl}`;
    } else {
      return trimmedUrl;
    }
  };

  // Enhanced avatar URL validation
  const getValidAvatarUrl = (avatarUrl) => {
    if (!avatarUrl || typeof avatarUrl !== 'string') return null;
    
    const trimmedUrl = avatarUrl.trim();
    if (trimmedUrl === '') return null;
    
    // Handle relative URLs by making them absolute if needed
    if (trimmedUrl.startsWith('http')) {
      return trimmedUrl;
    } else if (trimmedUrl.startsWith('/')) {
      return `${BASE_URL}${trimmedUrl}`;
    } else {
      return trimmedUrl;
    }
  };

  const checkStoryExpiration = (story) => {
    if (!story || !isOwnStory) return;

    const now = new Date();
    const storyTime = new Date(story.createdAt);
    const diffInHours = (now - storyTime) / (1000 * 60 * 60);

    // Auto-delete stories older than 24 hours
    if (diffInHours >= 24) {
      console.log('Story expired, auto-deleting:', story._id);
      handleDeleteStory(story._id, true); // true for silent deletion
    }
  };

  const startStoryProgress = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    progressRef.setValue(0);
    setProgress(0);

    const progressStep = 100 / (storyDuration / 50); // Update every 50ms

    intervalRef.current = setInterval(() => {
      if (!paused && !mediaError) {
        setProgress(prev => {
          const newProgress = prev + progressStep;
          if (newProgress >= 100) {
            handleNextStory();
            return 0; // Reset progress for the next story
          }
          return newProgress;
        });
      }
    }, 50);
  };

  const markStoryAsViewed = async (story) => {
    if (!story || isOwnStory) return;

    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        console.warn('No token found for marking story as viewed.');
        return;
      }

      const response = await fetch(`${BASE_URL}/api/v1/stories/stories/${story._id}/view`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        console.log('Story marked as viewed:', story._id);
      } else {
        const errorData = await response.json();
        console.error('Failed to mark story as viewed:', response.status, errorData);
      }
    } catch (error) {
      console.error('Error marking story as viewed:', error);
    }
  };

  const handleDeleteStory = async (storyId, silent = false) => {
    try {
      setDeleting(true);
      const token = await AsyncStorage.getItem('token');
      
      if (!token) {
        if (!silent) {
          Alert.alert('Error', 'Authentication token not found');
        }
        return;
      }

      const response = await fetch(`${BASE_URL}/api/v1/stories/stories/${storyId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const responseData = await response.json();
        console.log('Story deleted successfully:', responseData);

        // Remove the deleted story from the current stories array
        const updatedStories = stories.filter(story => story._id !== storyId);
        setStories(updatedStories);

        if (!silent) {
          Alert.alert('Success', 'Story deleted successfully');
        }

        // If no more stories, go back
        if (updatedStories.length === 0) {
          navigation.goBack();
          return;
        }

        // Adjust current index if necessary
        if (currentStoryIndex >= updatedStories.length) {
          setCurrentStoryIndex(updatedStories.length - 1);
        } else if (currentStoryIndex > 0 && currentStoryIndex >= updatedStories.length) {
          handlePreviousStory();
        } else {
          // Restart progress for the current story
          startStoryProgress();
        }

      } else {
        const errorData = await response.json();
        console.error('Failed to delete story:', response.status, errorData);
        
        if (!silent) {
          Alert.alert(
            'Error', 
            errorData.message || 'Failed to delete story. Please try again.'
          );
        }
      }
    } catch (error) {
      console.error('Error deleting story:', error);
      if (!silent) {
        Alert.alert('Error', 'Network error. Please check your connection and try again.');
      }
    } finally {
      setDeleting(false);
    }
  };

  const confirmDeleteStory = () => {
    const currentStory = stories[currentStoryIndex];
    if (!currentStory) return;

    Alert.alert(
      'Delete Story',
      'Are you sure you want to delete this story? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => handleDeleteStory(currentStory._id),
        },
      ]
    );
  };

  const handleNextStory = () => {
    if (currentStoryIndex < stories.length - 1) {
      setCurrentStoryIndex(prev => prev + 1);
    } else {
      navigation.goBack();
    }
  };

  const handlePreviousStory = () => {
    if (currentStoryIndex > 0) {
      setCurrentStoryIndex(prev => prev - 1);
    } else {
      navigation.goBack();
    }
  };

  const handlePress = (event) => {
    const { locationX } = event.nativeEvent;
    const screenWidth = width;
    
    if (locationX < screenWidth / 2) {
      handlePreviousStory();
    } else {
      handleNextStory();
    }
  };

  const handleLongPress = () => {
    setPaused(true);
  };

  const handlePressOut = () => {
    setPaused(false);
  };

  const handleClose = () => {
    navigation.goBack();
  };

  const handleMediaError = (error, mediaType) => {
    console.error(`${mediaType} load error:`, error);
    setMediaError(true);
    setLoading(false);
    
    // Don't show alert for every media error, just log it
    console.warn(`Could not load ${mediaType.toLowerCase()}`);
  };

  const renderProgressBar = () => {
    return (
      <View style={styles.progressContainer}>
        {stories.map((_, index) => (
          <View key={index} style={styles.progressBarBackground}>
            <Animated.View
              style={[
                styles.progressBarFill,
                {
                  width: index === currentStoryIndex 
                    ? `${progress}%` 
                    : index < currentStoryIndex 
                    ? '100%' 
                    : '0%'
                }
              ]}
            />
          </View>
        ))}
      </View>
    );
  };

  const renderUserHeader = () => {
    const currentStory = stories[currentStoryIndex];
    const validAvatarUrl = getValidAvatarUrl(userAvatar);

    return (
      <View style={styles.userHeader}>
        <View style={styles.userInfo}>
          {validAvatarUrl ? (
            <Image 
              source={{ uri: validAvatarUrl }} 
              style={styles.userAvatar}
              onError={(error) => {
                console.log('Avatar load error for user:', userName, error.nativeEvent.error);
              }}
            />
          ) : (
            <View style={[
              styles.userAvatar, 
              styles.placeholderAvatar,
              { backgroundColor: getAvatarColor(userName) }
            ]}>
              <Text style={styles.avatarText}>
                {getInitials(userName)}
              </Text>
            </View>
          )}
          <Text style={styles.userName}>{userName || 'Unknown User'}</Text>
          <Text style={styles.storyTime}>
            {getTimeAgo(currentStory?.createdAt)}
          </Text>
        </View>
        
        <View style={styles.headerActions}>
          {/* Delete button - only show for own stories */}
          {isOwnStory && (
            <TouchableOpacity 
              onPress={confirmDeleteStory} 
              style={styles.deleteButton}
              disabled={deleting}
            >
              {deleting ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Ionicons name="trash-outline" size={24} color="white" />
              )}
            </TouchableOpacity>
          )}
          
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Ionicons name="close" size={28} color="white" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const getTimeAgo = (createdAt) => {
    if (!createdAt) return '';
    
    const now = new Date();
    const storyTime = new Date(createdAt);
    const diffInMs = now - storyTime;
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    
    if (diffInMinutes < 1) {
      return 'now';
    } else if (diffInHours < 1) {
      return `${diffInMinutes}m`;
    } else if (diffInHours < 24) {
      return `${diffInHours}h`;
    } else {
      return `${Math.floor(diffInHours / 24)}d`;
    }
  };

  const renderStoryContent = () => {
    const currentStory = stories[currentStoryIndex];
    
    if (!currentStory) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Story not found</Text>
        </View>
      );
    }

    const validMediaUrl = getValidMediaUrl(currentStory.mediaUrl);
    
    if (!validMediaUrl) {
      return (
        <View style={styles.errorContainer}>
          <Ionicons name="image-outline" size={80} color="#666" />
          <Text style={styles.errorText}>Media not available</Text>
        </View>
      );
    }

    if (mediaError) {
      return (
        <View style={styles.errorContainer}>
          <Ionicons name="warning-outline" size={80} color="#666" />
          <Text style={styles.errorText}>Failed to load media</Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={() => {
              setMediaError(false);
              setLoading(true);
            }}
          >
            <Text style={styles.retryText}>Tap to retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (currentStory.mediaType === 'video') {
      return (
        <Video
          ref={videoRef}
          source={{ uri: validMediaUrl }}
          style={styles.media}
          paused={paused}
          repeat={false}
          resizeMode="cover"
          onLoad={() => {
            setLoading(false);
            setMediaError(false);
          }}
          onLoadStart={() => setLoading(true)}
          onError={(error) => handleMediaError(error, 'Video')}
          onBuffer={({ isBuffering }) => setLoading(isBuffering)}
        />
      );
    } else {
      return (
        <Image
          source={{ uri: validMediaUrl }}
          style={styles.media}
          resizeMode="cover"
          onLoadStart={() => setLoading(true)}
          onLoad={() => {
            setLoading(false);
            setMediaError(false);
          }}
          onError={(error) => handleMediaError(error.nativeEvent.error, 'Image')}
        />
      );
    }
  };

  if (!stories || stories.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="albums-outline" size={80} color="#666" />
          <Text style={styles.errorText}>No stories available</Text>
        </View>
        <TouchableOpacity onPress={handleClose} style={styles.closeButtonCenter}>
          <Ionicons name="close" size={32} color="white" />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.overlay}
        onPress={handlePress}
        onLongPress={handleLongPress}
        onPressOut={handlePressOut}
        activeOpacity={1}
      >
        {renderStoryContent()}
        
        {loading && !mediaError && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="white" />
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        )}
        
        <View style={styles.topOverlay}>
          {renderProgressBar()}
          {renderUserHeader()}
        </View>
        
        {paused && !loading && !mediaError && (
          <View style={styles.pausedIndicator}>
            <Ionicons name="pause" size={50} color="white" />
          </View>
        )}

        {deleting && (
          <View style={styles.deletingOverlay}>
            <ActivityIndicator size="large" color="white" />
            <Text style={styles.deletingText}>Deleting story...</Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  overlay: {
    flex: 1,
    position: 'relative',
  },
  media: {
    width: width,
    height: height,
  },
  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 40,
    paddingHorizontal: 15,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  progressContainer: {
    flexDirection: 'row',
    marginBottom: 15,
    paddingHorizontal: 5,
  },
  progressBarBackground: {
    flex: 1,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginHorizontal: 1,
    borderRadius: 1.5,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: 'white',
    borderRadius: 1.5,
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  userAvatar: {
    width: 35,
    height: 35,
    borderRadius: 17.5,
    marginRight: 10,
  },
  placeholderAvatar: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  userName: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 10,
  },
  storyTime: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deleteButton: {
    padding: 5,
    marginRight: 10,
    backgroundColor: 'rgba(255, 0, 0, 0.2)',
    borderRadius: 20,
    width: 38,
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    padding: 5,
  },
  closeButtonCenter: {
    position: 'absolute',
    top: 50,
    right: 20,
    padding: 10,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  loadingText: {
    color: 'white',
    fontSize: 16,
    marginTop: 10,
    fontWeight: '500',
  },
  pausedIndicator: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -25 }, { translateY: -25 }],
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 25,
    padding: 10,
  },
  deletingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  deletingText: {
    color: 'white',
    fontSize: 16,
    marginTop: 10,
    fontWeight: '500',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  errorText: {
    color: 'white',
    fontSize: 18,
    textAlign: 'center',
    marginTop: 15,
  },
  retryButton: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
  },
  retryText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
});

export default StoryViewer;