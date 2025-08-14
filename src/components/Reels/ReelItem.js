import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import BASE_URL from '../../config/config';

const { width, height } = Dimensions.get('window');

const ReelItem = ({ data, isActive = true }) => {
  const { token, user } = useAuth() || {};
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);

  // Extract data safely with proper fallbacks
  const video = data?.video || {};
  const videoUrl = video.url || '';
  const thumbnailUrl = video.thumbnail || videoUrl || '';
  const author = data?.author || {};
  const authorName = author.fullName || author.username || 'Unknown User';
  const authorPhoto = author.photoUrl || '';
  const content = data?.content || '';
  const likes = Array.isArray(data?.likes) ? data.likes : [];
  const comments = Array.isArray(data?.comments) ? data.comments : [];
  const createdAt = data?.createdAt || '';
  const reelId = data?._id || '';

  useEffect(() => {
    // Initialize like state
    if (user?._id) {
      const userHasLiked = likes.some(like => like?.user === user._id);
      setLiked(userHasLiked);
    }
    setLikeCount(likes.length);
  }, [data, user]);

  const formatTimeAgo = (dateString) => {
    if (!dateString || typeof dateString !== 'string') {
      return 'Recently';
    }
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return 'Recently';
      }

      const now = new Date();
      const diffInMs = now.getTime() - date.getTime();
      const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
      
      if (diffInDays === 0) {
        const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
        if (diffInHours === 0) {
          const diffInMins = Math.floor(diffInMs / (1000 * 60));
          return diffInMins <= 1 ? 'Just now' : `${diffInMins}m`;
        }
        return `${diffInHours}h`;
      } else if (diffInDays === 1) {
        return '1d';
      } else if (diffInDays < 7) {
        return `${diffInDays}d`;
      } else {
        const diffInWeeks = Math.floor(diffInDays / 7);
        return diffInWeeks === 1 ? '1w' : `${diffInWeeks}w`;
      }
    } catch (error) {
      console.error('Date formatting error:', error);
      return 'Recently';
    }
  };

  const handleLike = async () => {
    if (!reelId || !token) {
      Alert.alert('Error', 'Unable to like reel');
      return;
    }

    try {
      // Optimistic update
      setLiked(!liked);
      setLikeCount(prev => liked ? prev - 1 : prev + 1);

      const response = await fetch(`${BASE_URL}/api/v1/posts/${reelId}/like`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        // Revert on error
        setLiked(liked);
        setLikeCount(prev => liked ? prev + 1 : prev - 1);
        throw new Error('Failed to like reel');
      }
    } catch (error) {
      console.error('Error liking reel:', error);
      Alert.alert('Error', 'Failed to like reel');
    }
  };

  const handleComment = () => {
    Alert.alert('Comments', 'Comments feature coming soon!');
  };

  const handleShare = () => {
    Alert.alert('Share', 'Share feature coming soon!');
  };

  const getInitials = (name) => {
    if (!name || typeof name !== 'string') return '?';
    
    try {
      const names = name.trim().split(' ');
      if (names.length === 1) {
        return names[0].charAt(0).toUpperCase();
      }
      return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase();
    } catch (error) {
      return '?';
    }
  };

  return (
    <View style={styles.container}>
      {/* Media Container */}
      <TouchableOpacity 
        style={styles.mediaContainer}
        activeOpacity={0.9}
        onPress={() => Alert.alert('Video', 'Video playback feature coming soon!')}
      >
        {thumbnailUrl && typeof thumbnailUrl === 'string' ? (
          <Image
            source={{ uri: thumbnailUrl }}
            style={styles.media}
            resizeMode="cover"
            onError={(error) => {
              console.log('Image error:', error?.nativeEvent?.error || 'Unknown error');
            }}
          />
        ) : (
          <View style={styles.placeholderContainer}>
            <Text style={styles.placeholderText}>🎥</Text>
            <Text style={styles.placeholderSubtext}>Reel</Text>
          </View>
        )}

        {/* Play Overlay */}
        <View style={styles.playOverlay}>
          <View style={styles.playButton}>
            <Text style={styles.playButtonText}>▶️</Text>
          </View>
        </View>
      </TouchableOpacity>

      {/* Content Overlay */}
      <View style={styles.contentOverlay}>
        {/* Bottom Info */}
        <View style={styles.bottomInfo}>
          <View style={styles.authorInfo}>
            <Text style={styles.authorName}>{authorName}</Text>
            <Text style={styles.timeAgo}>{formatTimeAgo(createdAt)}</Text>
          </View>
          
          {content && typeof content === 'string' ? (
            <Text style={styles.caption} numberOfLines={3}>
              {content}
            </Text>
          ) : null}
        </View>

        {/* Side Actions */}
        <View style={styles.sideActions}>
          {/* Author Avatar */}
          <View style={styles.authorAvatar}>
            {authorPhoto && typeof authorPhoto === 'string' ? (
              <Image 
                source={{ uri: authorPhoto }} 
                style={styles.authorAvatarImage}
                onError={() => console.log('Author avatar error')}
              />
            ) : (
              <View style={styles.authorAvatarPlaceholder}>
                <Text style={styles.authorAvatarText}>
                  {getInitials(authorName)}
                </Text>
              </View>
            )}
          </View>

          {/* Like Button */}
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={handleLike}
          >
            <Text style={[styles.actionIcon, liked && styles.likedIcon]}>
              {liked ? '❤️' : '🤍'}
            </Text>
            <Text style={styles.actionCount}>{likeCount}</Text>
          </TouchableOpacity>
          
          {/* Comment Button */}
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={handleComment}
          >
            <Text style={styles.actionIcon}>💬</Text>
            <Text style={styles.actionCount}>{comments.length}</Text>
          </TouchableOpacity>
          
          {/* Share Button */}
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={handleShare}
          >
            <Text style={styles.actionIcon}>📤</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: width,
    height: height,
    backgroundColor: 'black',
    position: 'relative',
  },
  mediaContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  media: {
    flex: 1,
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
    marginBottom: 10,
  },
  placeholderSubtext: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
  },
  playOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -40 }, { translateY: -40 }],
  },
  playButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButtonText: {
    fontSize: 30,
    marginLeft: 5,
  },
  contentOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 50,
    paddingTop: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  bottomInfo: {
    flex: 1,
    marginRight: 16,
  },
  authorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  authorName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 12,
  },
  timeAgo: {
    color: '#ccc',
    fontSize: 14,
  },
  caption: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 20,
  },
  sideActions: {
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  authorAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#fff',
    overflow: 'hidden',
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
  actionButton: {
    alignItems: 'center',
    marginBottom: 20,
    padding: 8,
  },
  actionIcon: {
    fontSize: 28,
    marginBottom: 4,
  },
  likedIcon: {
    transform: [{ scale: 1.1 }],
  },
  actionCount: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});

export default ReelItem;