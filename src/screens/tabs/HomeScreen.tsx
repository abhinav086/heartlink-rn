import React, { useState, useCallback, useRef, useImperativeHandle, useEffect } from "react";
import { View, StyleSheet, FlatList, RefreshControl, Alert, ActivityIndicator, Text, BackHandler } from "react-native";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';

import { Header, SearchBar } from "../../components/Home/Header";
import Stories from "../../components/Home/Stories";
import Post from "../../components/Home/Post";
import BASE_URL from '../../config/config';

type Props = {}; 

const HomeScreen = React.forwardRef<any, Props>((props: Props, ref) => {
  const navigation = useNavigation();

  const [posts, setPosts] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMorePosts, setHasMorePosts] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshCount, setRefreshCount] = useState(0); // Track refresh count
  const flatListRef = useRef(null);

  // Handle hardware back button press
  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        // Exit the app when back is pressed on Home screen
        BackHandler.exitApp();
        return true;
      }
    );

    return () => backHandler.remove();
  }, []);

  // ADDED: Shuffle algorithms
  const smartWeightedShuffle = (posts) => {
    console.log('🔀 Starting smart weighted shuffle for', posts.length, 'posts');
    
    if (posts.length <= 1) return posts;
    
    // Sort by creation date first (newest first)
    const sortedPosts = [...posts].sort((a, b) => {
      const dateA = new Date(a.createdAt || a.updatedAt || 0);
      const dateB = new Date(b.createdAt || b.updatedAt || 0);
      return dateB - dateA;
    });

    const now = Date.now();
    const result = [];
    const remaining = [...sortedPosts];

    while (remaining.length > 0) {
      const weights = remaining.map((post, index) => {
        const postTime = new Date(post.createdAt || post.updatedAt || 0);
        const hoursAgo = (now - postTime) / (1000 * 60 * 60);
        
        // Recent posts (0-6 hours) get highest weight
        let recencyWeight = 100;
        if (hoursAgo <= 6) {
          recencyWeight = 200;
        } else if (hoursAgo <= 24) {
          recencyWeight = 150;
        } else if (hoursAgo <= 72) {
          recencyWeight = 100;
        } else {
          recencyWeight = 50;
        }
        
        // Position weight (earlier in remaining array = higher weight)
        const positionWeight = Math.max(10, remaining.length - index);
        
        // Engagement weight (likes + comments)
        const engagementWeight = 1 + (post.likeCount || 0) * 0.1 + (post.commentCount || 0) * 0.2;
        
        // Random factor for variability
        const randomFactor = Math.random() * 50 + 25; // 25-75
        
        return recencyWeight * positionWeight * engagementWeight * randomFactor;
      });

      // Select based on weight
      const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
      let random = Math.random() * totalWeight;
      let selectedIndex = 0;

      for (let i = 0; i < weights.length; i++) {
        random -= weights[i];
        if (random <= 0) {
          selectedIndex = i;
          break;
        }
      }

      result.push(remaining[selectedIndex]);
      remaining.splice(selectedIndex, 1);
    }

    console.log('✅ Shuffle complete. First 3 results:', result.slice(0, 3).map(p => ({
      id: p._id,
      timeAgo: formatTimeAgo(p.createdAt),
      likes: p.likeCount || 0
    })));

    return result;
  };

  const recencyBasedShuffle = (posts) => {
    console.log('📊 Using recency-based shuffle for', posts.length, 'posts');
    
    if (posts.length <= 1) return posts;
    
    const now = Date.now();
    
    // Group posts by time periods
    const groups = {
      veryRecent: [], // 0-6 hours
      recent: [],     // 6-24 hours  
      older: [],      // 24+ hours
    };
    
    posts.forEach(post => {
      const postTime = new Date(post.createdAt || post.updatedAt || 0);
      const hoursAgo = (now - postTime) / (1000 * 60 * 60);
      
      if (hoursAgo <= 6) {
        groups.veryRecent.push(post);
      } else if (hoursAgo <= 24) {
        groups.recent.push(post);
      } else {
        groups.older.push(post);
      }
    });
    
    console.log('📈 Groups:', {
      veryRecent: groups.veryRecent.length,
      recent: groups.recent.length,
      older: groups.older.length
    });
    
    // Shuffle each group
    const shuffleArray = (arr) => {
      const shuffled = [...arr];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled;
    };
    
    // Interleave the groups with bias toward recent
    const result = [];
    const shuffledGroups = {
      veryRecent: shuffleArray(groups.veryRecent),
      recent: shuffleArray(groups.recent),
      older: shuffleArray(groups.older)
    };
    
    // Distribution: 60% very recent, 30% recent, 10% older (approximately)
    let vIdx = 0, rIdx = 0, oIdx = 0;
    
    while (vIdx < shuffledGroups.veryRecent.length || 
           rIdx < shuffledGroups.recent.length || 
           oIdx < shuffledGroups.older.length) {
      
      const rand = Math.random();
      
      if (rand < 0.6 && vIdx < shuffledGroups.veryRecent.length) {
        result.push(shuffledGroups.veryRecent[vIdx++]);
      } else if (rand < 0.9 && rIdx < shuffledGroups.recent.length) {
        result.push(shuffledGroups.recent[rIdx++]);
      } else if (oIdx < shuffledGroups.older.length) {
        result.push(shuffledGroups.older[oIdx++]);
      } else if (rIdx < shuffledGroups.recent.length) {
        result.push(shuffledGroups.recent[rIdx++]);
      } else if (vIdx < shuffledGroups.veryRecent.length) {
        result.push(shuffledGroups.veryRecent[vIdx++]);
      }
    }
    
    console.log('✅ Recency shuffle complete. First 3:', result.slice(0, 3).map(p => ({
      id: p._id,
      timeAgo: formatTimeAgo(p.createdAt)
    })));
    
    return result;
  };

  // ADDED: Apply shuffle to posts
  const applyShuffleToFeed = (posts, shuffleMode = "smart") => {
    if (!posts || posts.length <= 1) return posts;
    
    console.log(`🎯 Applying ${shuffleMode} shuffle to ${posts.length} posts`);
    
    switch (shuffleMode) {
      case "smart":
        return smartWeightedShuffle(posts);
      case "recency":
        return recencyBasedShuffle(posts);
      default:
        return smartWeightedShuffle(posts);
    }
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
      '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
      '#F8C471', '#82E0AA', '#F1948A', '#85C1E9', '#D2B4DE'
    ];
    
    if (!name) return colors[0];
    const charCodeSum = name.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
    return colors[charCodeSum % colors.length];
  };

  const getUserImageUrl = (author) => {
    if (!author || typeof author !== 'object') {
      return '';
    }
    
    return author?.photoUrl || 
           author?.photo || 
           author?.profilePicture || 
           author?.avatar || 
           author?.image || 
           author?.userimg ||
           author?.profilePic ||
           '';
  };

  const getPostImageUrl = (apiPost) => {
    if (!apiPost || typeof apiPost !== 'object') {
      return 'https://via.placeholder.com/400   ';
    }
    
    const images = Array.isArray(apiPost.images) ? apiPost.images : [];
    if (images.length > 0) {
      return images[0]?.url || images[0]?.uri || images[0] || 'https://via.placeholder.com/400   ';
    }
    
    return apiPost?.image || apiPost?.imageUrl || 'https://via.placeholder.com/400   ';
  };

  const getAuthorName = (author) => {
    if (!author || typeof author !== 'object') {
      return 'Unknown User';
    }
    
    return author?.fullName || author?.name || 'Unknown User';
  };

  const getAuthorUsername = (author) => {
    if (!author || typeof author !== 'object') {
      return 'unknown';
    }
    
    const fullName = getAuthorName(author);
    return author?.username || 
           (typeof fullName === 'string' ? fullName.toLowerCase().replace(/\s+/g, '') : 'unknown');
  };

  const getAuthorId = (author) => {
    if (!author || typeof author !== 'object') {
      return 'unknown';
    }
    
    return author?._id || author?.id || author || 'unknown';
  };

  useEffect(() => {
    const initializeScreen = async () => {
      const tokenValid = await checkToken();
      if (tokenValid) {
        await fetchPosts(1, true);
      }
    };
    initializeScreen();
  }, []);

  const checkToken = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        Alert.alert('Error', 'Please log in to continue.');
        navigation.navigate('Login');
        return false;
      }
      return true;
    } catch (error) {
      console.error('AsyncStorage Error:', error);
      Alert.alert('Error', 'Failed to verify login status. Please log in again.');
      navigation.navigate('Login');
      return false;
    }
  };

  // UPDATED: fetchPosts with shuffling support
  const fetchPosts = async (pageNum = 1, isInitial = false, shouldShuffle = false) => {
    try {
      if (isInitial) {
        setLoading(true);
        setError(null);
      } else {
        setLoadingMore(true);
      }

      const token = await AsyncStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      // UPDATED: Fetch more posts when shuffling to have better variety
      const fetchLimit = shouldShuffle ? 30 : 10; // Fetch more posts for better shuffling

      const response = await fetch(
        `${BASE_URL}/api/v1/posts?page=${pageNum}&limit=${fetchLimit}&type=post`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `HTTP error! status: ${response.status}`);
      }

      if (data.success && data.data) {
        let newPosts = data.data.posts || [];
        const postsOnly = newPosts.filter(post => post.type !== 'reel');
        const pagination = data.data.pagination || {};

        // ADDED: Apply shuffling if requested
        if (shouldShuffle && postsOnly.length > 0) {
          console.log(`🔀 REFRESH #${refreshCount + 1} - Shuffling ${postsOnly.length} posts`);
          const shuffledPosts = applyShuffleToFeed(postsOnly, "smart");
          
          // Take only the first 10 posts after shuffling for display
          if (isInitial || pageNum === 1) {
            setPosts(shuffledPosts.slice(0, 10));
          } else {
            setPosts(prevPosts => [...prevPosts, ...shuffledPosts.slice(0, 10)]);
          }
        } else {
          // Normal flow without shuffling
          if (isInitial || pageNum === 1) {
            setPosts(postsOnly);
          } else {
            setPosts(prevPosts => [...prevPosts, ...postsOnly]);
          }
        }

        setHasMorePosts(pagination.hasNextPage || false);
        setPage(pageNum);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (error) {
      console.error('Error fetching posts:', error);
      setError(error.message);
      if (isInitial) {
        Alert.alert('Error', `Failed to load posts: ${error.message}`);
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // UPDATED: onRefresh with shuffling
  const onRefresh = useCallback(async () => {
    console.log(`🔄 REFRESH TRIGGERED #${refreshCount + 1}`);
    setRefreshing(true);
    setError(null);
    
    // Always shuffle on refresh
    await fetchPosts(1, true, true); // true = shouldShuffle
    
    setRefreshCount(prev => prev + 1);
    setRefreshing(false);
    
    console.log('✅ Refresh complete with shuffling');
  }, [refreshCount]);

  // UPDATED: loadMorePosts (no shuffling for pagination)
  const loadMorePosts = useCallback(async () => {
    if (hasMorePosts && !loadingMore && posts.length > 0) {
      await fetchPosts(page + 1, false, false); // false = no shuffle for pagination
    }
  }, [loadingMore, hasMorePosts, page, posts.length]);

  const scrollToTopAndRefresh = useCallback(() => {
    if (flatListRef.current) {
      flatListRef.current.scrollToOffset({ offset: 0, animated: true });
    }
    onRefresh();
  }, [onRefresh]);

  useImperativeHandle(ref, () => ({
    scrollToTopAndRefresh,
  }));

  const handleLikePress = async (postId) => {
    try {
      const token = await AsyncStorage.getItem('token');
      
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

      if (data.success) {
        setPosts(prevPosts =>
          prevPosts.map(post =>
            post._id === postId
              ? {
                  ...post,
                  isLikedByUser: data.data.isLiked,
                  likeCount: data.data.likeCount,
                  likes: data.data.post?.likes || post.likes,
                }
              : post
          )
        );
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      Alert.alert('Error', 'Failed to update like. Please try again.');
    }
  };

  const handleCommentPress = (postId) => {
    console.log('Comment pressed for post:', postId);
  };

  const handleSharePress = (post) => {
    console.log('Share post:', post._id);
  };

  const handleProfilePress = (userId) => {
    try {
      if (!userId || userId === 'unknown') {
        console.warn('Invalid userId provided to handleProfilePress:', userId);
        return;
      }
      navigation.navigate('UserProfile', {
        userId: userId,
        fromFeed: true,
      });
    } catch (error) {
      console.error('Error in handleProfilePress:', error); 
    }
  };

  const formatTimeAgo = (dateString) => {
    if (!dateString) return 'Just now';
    
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

      if (diffInHours < 1) return 'Just now';
      if (diffInHours < 24) return `${diffInHours}h`;
      if (diffInHours < 48) return '1d';
      
      const diffInDays = Math.floor(diffInHours / 24);
      if (diffInDays < 7) return `${diffInDays}d`;
      
      const diffInWeeks = Math.floor(diffInDays / 7);
      if (diffInWeeks < 4) return `${diffInWeeks}w`;
      
      return date.toLocaleDateString();
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Just now';
    }
  };

  const transformPostData = (apiPost) => {
    try {
      if (!apiPost || typeof apiPost !== 'object') {
        console.warn('Invalid post data received:', apiPost);
        return createFallbackPost();
      }

      const author = apiPost.author || {};
      const authorId = getAuthorId(author);
      const authorName = getAuthorName(author);
      const authorUsername = getAuthorUsername(author);
      const userImage = getUserImageUrl(author);
      const postImageUrl = getPostImageUrl(apiPost);

      return {
        id: apiPost._id || apiPost.id || `post-${Date.now()}`,
        _id: apiPost._id || apiPost.id || `post-${Date.now()}`,
        userImg: userImage ? { uri: userImage } : { uri: 'https://via.placeholder.com/50/333333/ffffff?text=User' },
        username: authorName,
        postImg: postImageUrl ? { uri: postImageUrl } : { uri: '   https://via.placeholder.com/400/333333/ffffff?text=No+Image' },
        caption: apiPost.content || apiPost.caption || '',
        userInitials: getInitials(authorName),
        avatarColor: getAvatarColor(authorName),
        hasProfilePic: !!userImage,
        user: {
          id: authorId,
          _id: authorId,
          image: userImage,
          userimg: userImage,
          photo: userImage,
          photoUrl: userImage,
          profilePic: userImage,
          profilePicture: userImage,
          avatar: userImage,
          name: authorName,
          fullName: authorName,
          username: authorUsername,
        },
        imageUri: postImageUrl,
        images: Array.isArray(apiPost.images) ? apiPost.images : [],
        likes: apiPost.likeCount || 
               (Array.isArray(apiPost.likes) ? apiPost.likes.length : 0),
        isLiked: Boolean(apiPost.isLikedByUser),
        comments: apiPost.commentCount || 
                 (Array.isArray(apiPost.comments) ? apiPost.comments.length : 0),
        timeAgo: formatTimeAgo(apiPost.createdAt),
        type: apiPost.type || 'post',
        video: apiPost.video || null,
        location: apiPost.location || null,
        // Pass original API data for shuffling
        createdAt: apiPost.createdAt,
        likeCount: apiPost.likeCount || 0,
        commentCount: apiPost.commentCount || 0,
        onLikePress: () => handleLikePress(apiPost._id || apiPost.id),
        onCommentPress: () => handleCommentPress(apiPost._id || apiPost.id),
        onSharePress: () => handleSharePress(apiPost),
        onProfilePress: () => handleProfilePress(authorId),
      };
    } catch (error) {
      console.error('Error transforming post data:', error, apiPost);
      return createFallbackPost();
    }
  };

  const createFallbackPost = () => {
    const fallbackImage = '   https://via.placeholder.com/50/333333/ffffff?text=User';
    const fallbackPostImage = '   https://via.placeholder.com/400/333333/ffffff?text=No+Image';
    const fallbackName = 'Unknown User';
    
    return {
      id: `fallback-${Date.now()}`,
      _id: `fallback-${Date.now()}`,
      userImg: { uri: fallbackImage },
      username: fallbackName,
      postImg: { uri: fallbackPostImage },
      caption: 'Content unavailable',
      userInitials: getInitials(fallbackName),
      avatarColor: getAvatarColor(fallbackName),
      hasProfilePic: false,
      user: {
        id: 'unknown',
        _id: 'unknown',
        image: fallbackImage,
        userimg: fallbackImage,
        photo: fallbackImage,
        photoUrl: fallbackImage,
        profilePic: fallbackImage,
        profilePicture: fallbackImage,
        avatar: fallbackImage,
        name: fallbackName,
        fullName: fallbackName,
        username: 'unknown',
      },
      imageUri: fallbackPostImage,
      images: [],
      likes: 0,
      isLiked: false,
      comments: 0,
      timeAgo: 'Just now',
      type: 'post',
      video: null,
      location: null,
      createdAt: new Date().toISOString(),
      likeCount: 0,
      commentCount: 0,
      onLikePress: () => console.log('Like disabled for fallback post'),
      onCommentPress: () => console.log('Comment disabled for fallback post'),
      onSharePress: () => console.log('Share disabled for fallback post'),
      onProfilePress: () => console.log('Profile disabled for fallback post'),
    };
  };

  const ListHeader = () => (
    <>
      <Header navigation={navigation} />
      <SearchBar />
      <Stories />
    </>
  );

  const ListFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color="#ffffff" />
        <Text style={styles.footerText}>Loading more posts...</Text>
      </View>
    );
  };

  const EmptyComponent = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>
        {error ? 'Failed to load posts' : 'No posts available'}
      </Text>
      <Text style={styles.emptySubtext}>
        {error ? 'Pull down to refresh and try again.' : 'Be the first to share something!'}
      </Text>
      {error && (
        <Text style={styles.errorText}>Error: {error}</Text>
      )}
    </View>
  );

  const renderPost = ({ item, index }) => {
    try {
      if (!item || typeof item !== 'object') {
        console.warn('Received invalid item at index:', index, item);
        return null;
      }

      const transformedPost = transformPostData(item);
      
      return (
        <Post
          key={`${transformedPost.id}-${refreshCount}`} // UPDATED: Include refresh count for re-render
          data={transformedPost}
          navigation={navigation}
        />
      );
    } catch (error) {
      console.error('Error rendering post at index', index, ':', error);
      return null;
    }
  };

  const validPosts = Array.isArray(posts) ? posts.filter(post => post != null) : [];

  if (loading && validPosts.length === 0) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ListHeader />
        <View style={styles.centerLoader}>
          <ActivityIndicator size="large" color="#ffffff" />
          <Text style={styles.loadingText}>Loading posts...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={validPosts}
        keyExtractor={(item, index) => {
          // UPDATED: Include refresh count for proper re-rendering
          return item?._id ? `${item._id}-${refreshCount}` : `post-${index}-${refreshCount}`;
        }}
        renderItem={renderPost}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={EmptyComponent}
        ListFooterComponent={ListFooter}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#ffffff']}
            tintColor="#ffffff"
          />
        }
        onEndReached={loadMorePosts}
        onEndReachedThreshold={0.5}
        accessible
        accessibilityLabel="Posts feed"
        accessibilityHint="List of posts with stories and search bar"
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        windowSize={10}
        initialNumToRender={5}
        // ADDED: Force re-render when refresh count changes
        extraData={refreshCount}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: 'black' 
  },
  loadingContainer: {
    justifyContent: 'flex-start',
  },
  centerLoader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#ffffff',
    marginTop: 16,
    fontSize: 16,
  },
  footerLoader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },
  footerText: {
    color: '#ffffff',
    marginLeft: 8,
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    color: '#666666',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: 12,
    textAlign: 'center',
    fontFamily: 'monospace',
  },
});

export default HomeScreen;