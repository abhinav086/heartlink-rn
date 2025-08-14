import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Image,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  Alert,
  Animated,
  ActionSheetIOS,
  Platform
} from 'react-native';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import BASE_URL from '../../config/config';
// import Video from 'react-native-video';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';

const { width, height } = Dimensions.get('window');
const ITEM_SIZE = (width - 4) / 3;

// --- Type Definitions for TypeScript ---
interface User {
  _id: string;
  fullName: string;
  photoUrl?: string;
  bio?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  logout?: () => void;
}

interface ImageData {
  url: string;
  _id?: string;
}

interface VideoData {
  url: string;
  thumbnail?: {
    url: string;
  };
  _id?: string;
}

interface PostItem {
  _id: string;
  type: 'post' | 'reel';
  images?: ImageData[];
  image?: ImageData;
  video?: VideoData;
  caption?: string;
  createdAt: string;
  user: User;
}

interface ApiResponse {
  success: boolean;
  message?: string;
  data?: {
    posts: PostItem[];
  };
}

type RootStackParamList = {
  ReelsViewerScreen: {
    reels: PostItem[];
    initialIndex: number;
    username: string;
  };
  PhotoViewerScreen: {
    posts: PostItem[];
    initialIndex: number;
    username: string;
  };
};

type ProfileTabsNavigationProp = NavigationProp<RootStackParamList>;

interface ProfileTabsProps {
  userId?: string;
  isOwnProfile?: boolean;
  username?: string;
}

// --- Component Implementation ---
const ProfileTabs: React.FC<ProfileTabsProps> = ({ 
  userId, 
  isOwnProfile = false, 
  username 
}) => {
  const navigation = useNavigation<ProfileTabsNavigationProp>();
  const [activeTab, setActiveTab] = useState<'posts' | 'reels'>('posts');
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [reels, setReels] = useState<PostItem[]>([]);
  const [combinedPosts, setCombinedPosts] = useState<PostItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [deletingItems, setDeletingItems] = useState<Set<string>>(new Set());
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState<boolean>(false);
  const [recentlyDeleted, setRecentlyDeleted] = useState<PostItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [zoomedItem, setZoomedItem] = useState<PostItem | null>(null);
  const [zoomPosition, setZoomPosition] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const authContext = useAuth() as AuthContextType | null;
  const { token, user, logout } = authContext || {};
  
  const zoomAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if ((userId || user?._id) && token) {
      fetchData();
    } else {
      const timer = setTimeout(() => {
        if ((userId || user?._id) && token) {
          fetchData();
        } else {
          setError('Authentication required. Please log in again.');
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [activeTab, userId, token, user?._id]);

  // Zoom animation handler
  const handleZoom = (item: PostItem, position: {x: number, y: number, width: number, height: number}) => {
    if (!isOwnProfile) return;
    
    setZoomPosition(position);
    setZoomedItem(item);
    Animated.spring(zoomAnim, {
      toValue: 1,
      friction: 5,
      useNativeDriver: true,
    }).start();
  };

  const closeZoom = () => {
    Animated.timing(zoomAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => setZoomedItem(null));
  };

  const handleDeleteZoomedItem = () => {
    if (zoomedItem) {
      handleDeletePost(zoomedItem);
      closeZoom();
    }
  };

  const getTokenFromStorage = async (): Promise<string | null> => {
    try {
      return await AsyncStorage.getItem('token');
    } catch (e) {
      console.error('Error getting token from storage:', e);
      return null;
    }
  };
  
  // --- Helper Functions to get Media URLs ---
  const getThumbnailUrl = (item: PostItem): string | null => {
    return item?.video?.thumbnail?.url || item?.images?.[0]?.url || null;
  };

  const getVideoUrl = (item: PostItem): string | null => {
    return item?.video?.url || null;
  };

  const getPostImageUrl = (item: PostItem): string | null => {
    return item?.images?.[0]?.url || item?.image?.url || null;
  };

  // --- Filter Posts by Type ---
  const filterPostsByType = (posts: PostItem[], type: 'post' | 'reel'): PostItem[] => {
    return posts.filter(post => {
      if (type === 'reel') {
        return post.type === 'reel' || !!(post.video && post.video.url);
      } else {
        return post.type === 'post' || (!post.video && (post.images || post.image));
      }
    });
  };

  // --- Enhanced Delete Functions ---
  const deletePost = async (postId: string): Promise<void> => {
    const authToken = token || await getTokenFromStorage();
    if (!authToken) {
      throw new Error('Authentication required');
    }

    const response = await fetch(`${BASE_URL}/api/v1/posts/${postId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Failed to delete post (Status: ${response.status})`);
    }
  };

  const handleDeletePost = (item: PostItem): void => {
    if (!isOwnProfile) {
      Alert.alert('Permission Denied', 'You can only delete your own posts.');
      return;
    }

    const itemType = (item.type === 'reel' || !!(item.video && item.video.url)) ? 'reel' : 'post';
    
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', `Delete ${itemType}`, 'Select Multiple'],
          destructiveButtonIndex: 1,
          cancelButtonIndex: 0,
          title: `What would you like to do with this ${itemType}?`,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            confirmSingleDelete(item, itemType);
          } else if (buttonIndex === 2) {
            enterSelectionMode(item._id);
          }
        }
      );
    } else {
      Alert.alert(
        `${itemType.charAt(0).toUpperCase() + itemType.slice(1)} Options`,
        `What would you like to do with this ${itemType}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Select Multiple', onPress: () => enterSelectionMode(item._id) },
          { text: `Delete ${itemType}`, style: 'destructive', onPress: () => confirmSingleDelete(item, itemType) },
        ]
      );
    }
  };

  const confirmSingleDelete = (item: PostItem, itemType: string): void => {
    Alert.alert(
      'Delete Confirmation',
      `Are you sure you want to delete this ${itemType}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => executeSingleDelete(item, itemType),
        },
      ]
    );
  };

  const executeSingleDelete = async (item: PostItem, itemType: string): Promise<void> => {
    setDeletingItems(prev => new Set(prev).add(item._id));
    
    try {
      await deletePost(item._id);
      
      setRecentlyDeleted(prev => [item, ...prev.slice(0, 4)]);
      removeItemFromState(item._id);
      
      Alert.alert(
        'Success', 
        `${itemType.charAt(0).toUpperCase() + itemType.slice(1)} deleted successfully`,
        [
          { text: 'OK', style: 'default' },
          { text: 'Undo', onPress: () => undoDelete(item) }
        ]
      );
    } catch (error: any) {
      console.error('Error deleting post:', error);
      Alert.alert('Error', error.message || 'Failed to delete post');
    } finally {
      setDeletingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(item._id);
        return newSet;
      });
    }
  };

  // --- Bulk Delete Functions ---
  const enterSelectionMode = (initialItemId?: string): void => {
    setSelectionMode(true);
    if (initialItemId) {
      setSelectedItems(new Set([initialItemId]));
    }
  };

  const exitSelectionMode = (): void => {
    setSelectionMode(false);
    setSelectedItems(new Set());
  };

  const toggleItemSelection = (itemId: string): void => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  const selectAllItems = (): void => {
    const currentData = activeTab === 'posts' ? combinedPosts : reels;
    setSelectedItems(new Set(currentData.map(item => item._id)));
  };

  const deselectAllItems = (): void => {
    setSelectedItems(new Set());
  };

  const handleBulkDelete = (): void => {
    if (selectedItems.size === 0) {
      Alert.alert('No Selection', 'Please select items to delete');
      return;
    }

    const itemCount = selectedItems.size;
    const itemText = itemCount === 1 ? 'item' : 'items';
    
    Alert.alert(
      'Bulk Delete Confirmation',
      `Are you sure you want to delete ${itemCount} ${itemText}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: `Delete ${itemCount} ${itemText}`,
          style: 'destructive',
          onPress: executeBulkDelete,
        },
      ]
    );
  };

  const executeBulkDelete = async (): Promise<void> => {
    const itemsToDelete = Array.from(selectedItems);
    const totalItems = itemsToDelete.length;
    let deletedCount = 0;
    let failedCount = 0;

    setDeletingItems(prev => new Set([...prev, ...itemsToDelete]));

    try {
      for (const itemId of itemsToDelete) {
        try {
          await deletePost(itemId);
          removeItemFromState(itemId);
          deletedCount++;
        } catch (error) {
          console.error(`Failed to delete item ${itemId}:`, error);
          failedCount++;
        }
      }

      if (failedCount === 0) {
        Alert.alert('Success', `Successfully deleted ${deletedCount} ${deletedCount === 1 ? 'item' : 'items'}`);
      } else if (deletedCount === 0) {
        Alert.alert('Error', `Failed to delete ${failedCount} ${failedCount === 1 ? 'item' : 'items'}`);
      } else {
        Alert.alert(
          'Partial Success', 
          `Deleted ${deletedCount} ${deletedCount === 1 ? 'item' : 'items'}, failed to delete ${failedCount}`
        );
      }

      exitSelectionMode();
    } finally {
      setDeletingItems(prev => {
        const newSet = new Set(prev);
        itemsToDelete.forEach(id => newSet.delete(id));
        return newSet;
      });
    }
  };

  // --- Undo Functionality ---
  const undoDelete = (item: PostItem): void => {
    Alert.alert(
      'Undo Not Available',
      'Items are permanently deleted from the server. Undo is not available for deleted content.',
      [{ text: 'OK' }]
    );
  };

  // --- Utility Functions ---
  const removeItemFromState = (itemId: string): void => {
    setPosts(prev => prev.filter(p => p._id !== itemId));
    setReels(prev => prev.filter(r => r._id !== itemId));
    setCombinedPosts(prev => prev.filter(p => p._id !== itemId));
  };

  // --- Data Fetching Logic ---
  const fetchData = async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      if (activeTab === 'posts') {
        await fetchPosts();
      } else if (activeTab === 'reels') {
        await fetchReels();
      }
    } catch (error: any) {
      setError(error.message || 'Failed to fetch data');
      if (!error.message?.includes('Authentication')) {
        Alert.alert('Error', error.message || 'Failed to fetch data');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchPosts = async (): Promise<void> => {
    const targetUserId = userId || user?._id;
    let authToken = token || await getTokenFromStorage();

    if (!targetUserId || !authToken) {
      throw new Error('Authentication required. Please log in again.');
    }
    
    try {
      const response = await fetch(`${BASE_URL}/api/v1/posts/user/${targetUserId}?limit=50`, {
        headers: { 'Authorization': `Bearer ${authToken}` },
      });
      const data: ApiResponse = await response.json();

      if (response.ok && data.success && data.data?.posts) {
        const allPosts = data.data.posts;
        
        const filteredPosts = filterPostsByType(allPosts, 'post');
        const filteredReels = filterPostsByType(allPosts, 'reel');
        
        const combined = [...allPosts].sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        
        setPosts(filteredPosts);
        setReels(filteredReels);
        setCombinedPosts(combined);
      } else if (response.status === 401) {
        throw new Error('Authentication expired. Please log in again.');
      } else {
        throw new Error(data.message || `Failed to fetch posts (Status: ${response.status})`);
      }
    } catch (error: any) {
        if (error.message?.includes('Authentication')) {
            Alert.alert('Authentication Required', 'Please log in again to view posts.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Login', onPress: () => logout && logout() }
            ]);
        }
        throw error;
    }
  };

  const fetchReels = async (): Promise<void> => {
    const targetUserId = userId || user?._id;
    let authToken = token || await getTokenFromStorage();

    if (!targetUserId || !authToken) {
        throw new Error('Authentication required. Please log in again.');
    }

    try {
      const response = await fetch(`${BASE_URL}/api/v1/posts/user/${targetUserId}?type=reel&limit=50`, {
          headers: { 'Authorization': `Bearer ${authToken}` },
      });
      const data: ApiResponse = await response.json();

      if (response.ok && data.success && data.data?.posts) {
          const filteredReels = filterPostsByType(data.data.posts, 'reel');
          setReels(filteredReels);
      } else if (response.status === 401) {
          throw new Error('Authentication expired. Please log in again.');
      } else {
          throw new Error(data.message || `Failed to fetch reels (Status: ${response.status})`);
      }
    } catch (error: any) {
        if (error.message?.includes('Authentication')) {
            Alert.alert('Authentication Required', 'Please log in again to view reels.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Login', onPress: () => logout && logout() }
            ]);
        }
        throw error;
    }
  };

  const onRefresh = async (): Promise<void> => {
    setRefreshing(true);
    await fetchData().catch(e => console.error('Error on refresh:', e));
    setRefreshing(false);
  };

  const handlePostPress = (index: number): void => {
    if (selectionMode) return;
    
    try {
      const currentData = activeTab === 'posts' ? combinedPosts : reels;
      if (!currentData?.[index]) return;

      const clickedItem = currentData[index];
      const safeUsername = username || user?.fullName || 'User';

      const isReel = clickedItem.type === 'reel' || !!(clickedItem.video && clickedItem.video.url);

      if (activeTab === 'posts') {
        if (isReel) {
          const reelIndex = reels.findIndex(reel => reel._id === clickedItem._id);
          navigation.navigate('ReelsViewerScreen', { 
            reels: reels, 
            initialIndex: reelIndex >= 0 ? reelIndex : 0, 
            username: safeUsername 
          });
        } else {
          const postIndex = posts.findIndex(post => post._id === clickedItem._id);
          navigation.navigate('PhotoViewerScreen', { 
            posts: posts, 
            initialIndex: postIndex >= 0 ? postIndex : 0, 
            username: safeUsername 
          });
        }
      } else {
        navigation.navigate('ReelsViewerScreen', { reels: currentData, initialIndex: index, username: safeUsername });
      }
    } catch (error) {
      console.error('Error in handlePostPress:', error);
      Alert.alert('Error', 'Failed to open media viewer');
    }
  };
  
  // --- Child Components for Rendering ---
  interface VideoPreviewProps { item: PostItem; index: number; }
  const VideoPreview: React.FC<VideoPreviewProps> = ({ item, index }) => {
    const [thumbnailError, setThumbnailError] = useState<boolean>(false);
    const [isLoadingThumbnail, setIsLoadingThumbnail] = useState<boolean>(true);
    const thumbnailUrl = getThumbnailUrl(item);

    if (!thumbnailUrl) {
      return (
        <View style={[styles.postImage, styles.placeholderContainer]}>
          <Ionicons name="videocam" size={28} color="#fff" style={{ opacity: 0.7 }} />
          <Text style={styles.placeholderSubtext}>Media unavailable</Text>
        </View>
      );
    }
    
    return (
      <View style={styles.videoContainer}>
        <Image
          source={{ uri: thumbnailUrl, cache: 'force-cache' }}
          style={styles.postImage}
          resizeMode="cover"
          onLoadEnd={() => setIsLoadingThumbnail(false)}
          onError={() => setThumbnailError(true)}
        />
        <View style={styles.playButtonOverlay}>
            <View style={styles.playButton}>
                <Ionicons name="play" size={16} color="#fff" />
            </View>
        </View>
        {isLoadingThumbnail && (
            <View style={styles.loadingOverlay}>
                <ActivityIndicator size="small" color="#fff" />
            </View>
        )}
        {thumbnailError && (
          <View style={[styles.postImage, styles.placeholderContainer]}>
            <Ionicons name="videocam" size={28} color="#fff" style={{ opacity: 0.7 }} />
            <Text style={styles.placeholderSubtext}>Media unavailable</Text>
          </View>
        )}
      </View>
    );
  };

  interface RenderPostProps { item: PostItem; index: number; }
  const renderPost = ({ item, index }: RenderPostProps) => {
    if (!item) {
      return <View style={styles.postContainer} />;
    }
    
    const isDeleting = deletingItems.has(item._id);
    const isSelected = selectedItems.has(item._id);
    const isVideo = item.type === 'reel' || !!(item.video && item.video.url);

    return (
      <TouchableOpacity 
        style={[
          styles.postContainer, 
          isDeleting && styles.deletingContainer,
          isSelected && styles.selectedContainer
        ]} 
        onPress={() => selectionMode ? toggleItemSelection(item._id) : handlePostPress(index)}
        onLongPress={(event) => {
          if (!isOwnProfile || selectionMode) return;
          
          // Measure position for zoom animation
          event.target.measure((x, y, width, height, pageX, pageY) => {
            handleZoom(item, {
              x: pageX,
              y: pageY,
              width,
              height
            });
          });
        }}
        activeOpacity={0.8}
        disabled={isDeleting}
      >
        {selectionMode && (
          <View style={styles.selectionOverlay}>
            <View style={[styles.selectionIndicator, isSelected && styles.selectedIndicator]}>
              {isSelected && <Ionicons name="checkmark" size={16} color="#fff" />}
            </View>
          </View>
        )}

        {isDeleting && (
          <View style={styles.deletingOverlay}>
            <ActivityIndicator size="small" color="#fff" />
            <Text style={styles.deletingText}>Deleting...</Text>
          </View>
        )}

        {isVideo ? (
          <VideoPreview item={item} index={index} />
        ) : (
          <View style={styles.imageContainer}>
            <Image
              source={{ uri: getPostImageUrl(item) }}
              style={styles.postImage}
              resizeMode="cover"
            />
            {Array.isArray(item.images) && item.images.length > 1 && (
              <View style={styles.multipleIndicator}>
                <MaterialIcons name="collections" size={10} color="#fff" />
              </View>
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  // --- Selection Mode Header ---
  const renderSelectionHeader = () => {
    if (!selectionMode) return null;

    const selectedCount = selectedItems.size;
    const currentData = activeTab === 'posts' ? combinedPosts : reels;
    const totalCount = currentData.length;

    return (
      <View style={styles.selectionHeader}>
        <TouchableOpacity onPress={exitSelectionMode} style={styles.selectionHeaderButton}>
          <Ionicons name="close" size={20} color="#ed167e" />
          <Text style={styles.selectionHeaderText}>Cancel</Text>
        </TouchableOpacity>
        
        <View style={styles.selectionInfo}>
          <Text style={styles.selectionCountText}>{selectedCount} selected</Text>
        </View>

        <View style={styles.selectionActions}>
          {selectedCount === 0 ? (
            <TouchableOpacity onPress={selectAllItems} style={styles.selectionHeaderButton}>
              <Text style={styles.selectionHeaderText}>Select All</Text>
            </TouchableOpacity>
          ) : (
            <>
              {selectedCount === totalCount ? (
                <TouchableOpacity onPress={deselectAllItems} style={styles.selectionHeaderButton}>
                  <Text style={styles.selectionHeaderText}>Deselect All</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={selectAllItems} style={styles.selectionHeaderButton}>
                  <Text style={styles.selectionHeaderText}>Select All</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={handleBulkDelete} style={[styles.selectionHeaderButton, styles.deleteButton]}>
                <Ionicons name="trash" size={16} color="#fff" />
                <Text style={[styles.selectionHeaderText, { color: '#fff' }]}>Delete</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    );
  };

  // --- Zoom Preview Component ---
  const renderZoomPreview = () => {
    if (!zoomedItem) return null;
    
    const imageUrl = getPostImageUrl(zoomedItem) || getThumbnailUrl(zoomedItem);
    if (!imageUrl) return null;

    const inputRange = [0, 1];
    
    // Animation transforms
    const scale = zoomAnim.interpolate({
      inputRange,
      outputRange: [1, 2]
    });
    
    const translateX = zoomAnim.interpolate({
      inputRange,
      outputRange: [
        zoomPosition.x + zoomPosition.width / 2 - (width / 2),
        0
      ]
    });
    
    const translateY = zoomAnim.interpolate({
      inputRange,
      outputRange: [
        zoomPosition.y - (height * 0.15),
        -height * 0.2
      ]
    });
    
    const opacity = zoomAnim.interpolate({
      inputRange: [0, 0.5, 1],
      outputRange: [0, 0.8, 1]
    });

    return (
      <Animated.View style={[styles.zoomOverlay, { opacity }]}>
        <TouchableOpacity 
          style={styles.zoomBackground} 
          activeOpacity={1}
          onPress={closeZoom}
        >
          <Animated.View style={[styles.zoomContainer, { transform: [{ translateX }, { translateY }, { scale }] }]}>
            <Image 
              source={{ uri: imageUrl }}
              style={styles.zoomedImage}
              resizeMode="contain"
            />
          </Animated.View>
          
          <TouchableOpacity 
            style={styles.zoomDeleteButton}
            onPress={handleDeleteZoomedItem}
          >
            <Ionicons name="trash" size={24} color="#fff" />
          </TouchableOpacity>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  // --- Main Content Rendering ---
  const renderContent = () => {
    if (error?.includes('Authentication')) {
      return (
        <View style={styles.errorContainer}>
          <MaterialIcons name="lock" size={48} color="#fff" style={{ opacity: 0.7, marginBottom: 16 }} />
          <Text style={styles.errorTitle}>Authentication Required</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => logout && logout()} style={styles.retryButton}>
            <Text style={styles.retryText}>Login Again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    if (loading && !refreshing) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#ed167e" />
          <Text style={styles.loadingText}>Loading {activeTab}...</Text>
        </View>
      );
    }
    if (error) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={fetchData} style={styles.retryButton}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    const data = activeTab === 'posts' ? combinedPosts : reels;
    if (data.length === 0) {
      const tabType = activeTab === 'posts' ? 'Posts' : 'Reels';
      return (
        <View style={styles.emptyContainer}>
          <MaterialIcons name={activeTab === 'posts' ? 'photo-camera' : 'videocam'} size={48} color="#fff" style={{ opacity: 0.5, marginBottom: 16 }} />
          <Text style={styles.emptyTitle}>{`No ${tabType} Yet`}</Text>
          {isOwnProfile ? (
            <>
              <Text style={styles.emptySubtitle}>{activeTab === 'posts' ? 'Share your first photo or video' : 'Create your first reel to get started'}</Text>
            </>
          ) : (
            <Text style={styles.emptySubtitle}>{`${username || 'This user'} hasn't shared any ${tabType.toLowerCase()} yet`}</Text>
          )}
        </View>
      );
    }

    return (
      <FlatList
        data={data}
        renderItem={renderPost}
        keyExtractor={(item: PostItem) => item._id}
        numColumns={3}
        style={styles.grid}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#ed167e']} tintColor="#ed167e" />}
        showsVerticalScrollIndicator={false}
      />
    );
  };
  
  // --- JSX Return ---
  return (
    <View style={styles.container}>
      {/* Selection Header */}
      {renderSelectionHeader()}

      {/* Tab Container */}
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'posts' && styles.activeTab]} 
          onPress={() => {
            if (selectionMode) exitSelectionMode();
            setActiveTab('posts');
          }}
        >
          <MaterialIcons name="grid-on" size={24} color={activeTab === 'posts' ? '#ed167e' : '#888'} />
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'reels' && styles.activeTab]} 
          onPress={() => {
            if (selectionMode) exitSelectionMode();
            setActiveTab('reels');
          }}
        >
          <Ionicons name="videocam" size={24} color={activeTab === 'reels' ? '#ed167e' : '#888'} />
        </TouchableOpacity>
      </View>

      {/* Zoom Preview */}
      {renderZoomPreview()}

      {/* Content */}
      {renderContent()}

      {/* Hints */}
      {isOwnProfile && !selectionMode && (
        <View style={styles.hintContainer}>
          <Text style={styles.hintText}>Hold any post to zoom • Tap to view</Text>
        </View>
      )}
    </View>
  );
};

// --- Enhanced Stylesheet ---
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  
  // Selection Header Styles
  selectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  selectionHeaderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  selectionHeaderText: {
    color: '#ed167e',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 4,
  },
  selectionInfo: {
    flex: 1,
    alignItems: 'center',
  },
  selectionCountText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  selectionActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deleteButton: {
    backgroundColor: '#e74c3c',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginLeft: 8,
  },

  // Tab Styles
  tabContainer: { flexDirection: 'row', borderBottomWidth: 1, borderColor: '#333' },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  activeTab: { borderBottomWidth: 2, borderColor: '#ed167e' },
  
  // Grid Styles
  grid: { flex: 1 },
  postContainer: { 
    width: ITEM_SIZE, 
    height: ITEM_SIZE, 
    margin: 1, 
    backgroundColor: '#1a1a1a', 
    position: 'relative' 
  },
  deletingContainer: { opacity: 0.5 },
  selectedContainer: { 
    borderWidth: 3, 
    borderColor: '#ed167e',
    opacity: 0.8
  },

  // Selection Styles
  selectionOverlay: {
    position: 'absolute',
    top: 8,
    left: 8,
    zIndex: 10,
  },
  selectionIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#fff',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedIndicator: {
    backgroundColor: '#ed167e',
    borderColor: '#ed167e',
  },

  // Content Styles
  postImage: { width: '100%', height: '100%', backgroundColor: '#333' },
  videoContainer: { position: 'relative', width: '100%', height: '100%' },
  imageContainer: { position: 'relative', width: '100%', height: '100%' },
  playButtonOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' },
  playButton: { backgroundColor: 'rgba(0, 0, 0, 0.6)', borderRadius: 20, width: 40, height: 40, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.5)' },
  loadingOverlay: { position: 'absolute', ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
  deletingOverlay: { 
    position: 'absolute', 
    ...StyleSheet.absoluteFillObject, 
    backgroundColor: 'rgba(0, 0, 0, 0.8)', 
    justifyContent: 'center', 
    alignItems: 'center', 
    zIndex: 10 
  },
  deletingText: { color: '#fff', fontSize: 10, marginTop: 4, textAlign: 'center' },
  placeholderContainer: { justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a1a1a' },
  placeholderSubtext: { fontSize: 11, color: '#aaa', textAlign: 'center' },
  multipleIndicator: { position: 'absolute', top: 6, left: 6, backgroundColor: 'rgba(0, 0, 0, 0.7)', borderRadius: 12, paddingHorizontal: 6, paddingVertical: 2 },

  // State Styles
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 50 },
  loadingText: { color: '#fff', fontSize: 16, marginTop: 10 },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 50, paddingHorizontal: 20 },
  errorTitle: { color: '#fff', fontSize: 18, fontWeight: '600', marginBottom: 8, textAlign: 'center' },
  errorText: { color: '#fff', fontSize: 16, marginBottom: 16, textAlign: 'center' },
  retryButton: { backgroundColor: '#ed167e', paddingHorizontal: 20, paddingVertical: 8, borderRadius: 4 },
  retryText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 50, paddingHorizontal: 20 },
  emptyTitle: { color: '#fff', fontSize: 18, fontWeight: '600', textAlign: 'center', marginBottom: 8 },
  emptySubtitle: { color: '#888', fontSize: 14, textAlign: 'center', marginBottom: 20 },
  uploadButton: { backgroundColor: '#ed167e', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  uploadButtonText: { color: 'white', fontSize: 16, fontWeight: '600' },
  hintContainer: { 
    position: 'absolute', 
    bottom: 20, 
    left: 0, 
    right: 0, 
    alignItems: 'center', 
    backgroundColor: 'rgba(0, 0, 0, 0.7)', 
    paddingVertical: 8, 
    paddingHorizontal: 16 
  },
  hintText: { color: '#888', fontSize: 12, textAlign: 'center' },
  
  // Zoom Preview Styles
  zoomOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.9)',
    zIndex: 100,
  },
  zoomBackground: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomContainer: {
    width: ITEM_SIZE * 2,
    height: ITEM_SIZE * 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomedImage: {
    width: '100%',
    height: '100%',
  },
  zoomDeleteButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    backgroundColor: 'rgba(231, 76, 60, 0.7)',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
export default ProfileTabs;