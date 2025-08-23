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
  Platform,
  Modal,
  TextInput, // Added for caption editing
  KeyboardAvoidingView, // Added for better keyboard handling on mobile
  TouchableWithoutFeedback, // Added to close modal on background tap
  Keyboard // Added to dismiss keyboard
} from 'react-native';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import BASE_URL from '../../config/config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
const { width, height } = Dimensions.get('window');
const ITEM_SIZE = (width - 4) / 3;
const DARK_PINK = '#ed167e';
const DARK_BG = '#121212';
const DARK_CARD = '#1e1e1e';
const DARK_TEXT = '#ffffff';
const DARK_TEXT_SECONDARY = '#aaaaaa';
// --- Type Definitions ---
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
  views?: number; // Add views field
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
interface AlertAction {
  text: string;
  onPress: () => void;
  style?: 'default' | 'destructive' | 'cancel';
}
interface AlertModalState {
  visible: boolean;
  title: string;
  message: string;
  actions: AlertAction[];
  destructiveAction: boolean;
}
// --- Utility Functions ---
const formatViewCount = (count: number): string => {
  if (!count || count === 0) return '0';
  if (count < 1000) {
    return count.toString();
  } else if (count < 1000000) {
    return (count / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  } else if (count < 1000000000) {
    return (count / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  } else {
    return (count / 1000000000).toFixed(1).replace(/\.0$/, '') + 'B';
  }
};
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
  const [menuVisible, setMenuVisible] = useState<{[key: string]: boolean}>({});
  const [alertModal, setAlertModal] = useState<AlertModalState>({
    visible: false,
    title: '',
    message: '',
    actions: [],
    destructiveAction: false
  });

  // --- New State for Editing ---
  const [editingItem, setEditingItem] = useState<PostItem | null>(null);
  const [editCaption, setEditCaption] = useState<string>('');
  const [isEditModalVisible, setIsEditModalVisible] = useState<boolean>(false);
  const [updatingCaption, setUpdatingCaption] = useState<boolean>(false); // To show loading during update

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

  // --- New: Close Edit Modal ---
  const closeEditModal = () => {
    setIsEditModalVisible(false);
    setEditingItem(null);
    setEditCaption('');
    setUpdatingCaption(false); // Reset loading state if modal is closed
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
  // --- Alert Modal Functions ---
  const showAlert = (title: string, message: string, actions: AlertAction[], destructive = false) => {
    setAlertModal({
      visible: true,
      title,
      message,
      actions,
      destructiveAction: destructive
    });
  };
  const hideAlert = () => {
    setAlertModal({
      visible: false,
      title: '',
      message: '',
      actions: [],
      destructiveAction: false
    });
  };
  // --- Menu Visibility Functions ---
  const showMenu = (itemId: string) => {
    setMenuVisible({ [itemId]: true });
  };
  const hideMenu = (itemId: string) => {
    setMenuVisible({ [itemId]: false });
  };


  // --- Enhanced Update Caption Function (NEW) ---
  const updatePostCaption = async (postId: string, newCaption: string): Promise<void> => {
    const authToken = token || await getTokenFromStorage();
    if (!authToken) {
      throw new Error('Authentication required');
    }

    const response = await fetch(`${BASE_URL}/api/v1/posts/${postId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content: newCaption }), // Send the new caption in the request body
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Failed to update post caption (Status: ${response.status})`);
    }

    // If successful, optionally parse the response if needed, though the backend might just return success
    const data = await response.json();
    if (!data.success) {
       throw new Error(data.message || 'Failed to update post caption');
    }
    // Update successful
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
      showAlert('Permission Denied', 'You can only delete your own posts.', [
        { text: 'OK', onPress: hideAlert, style: 'cancel' }
      ]);
      return;
    }
    const itemType = (item.type === 'reel' || !!(item.video && item.video.url)) ? 'reel' : 'post';
    showAlert(
      `${itemType.charAt(0).toUpperCase() + itemType.slice(1)} Options`,
      `What would you like to do with this ${itemType}?`,
      [
        { text: 'Cancel', onPress: hideAlert, style: 'cancel' },
          { text: `Delete ${itemType}`, onPress: () => { hideAlert(); confirmSingleDelete(item, itemType); }, style: 'destructive' },
      ]
    );
  };

  // --- New: Handle Edit Post ---
  const handleEditPost = (item: PostItem): void => {
    if (!isOwnProfile) {
      showAlert('Permission Denied', 'You can only edit your own posts.', [
        { text: 'OK', onPress: hideAlert, style: 'cancel' }
      ]);
      return;
    }
    // Hide the menu first
    hideMenu(item._id);
    // Set the item to edit and initialize caption
    setEditingItem(item);
    setEditCaption(item.caption || ''); // Initialize with existing caption or empty string
    setIsEditModalVisible(true); // Show the edit modal
  };

  const confirmSingleDelete = (item: PostItem, itemType: string): void => {
    showAlert(
      'Delete Confirmation',
      `Are you sure you want to delete this ${itemType}? This action cannot be undone.`,
      [
        { text: 'Cancel', onPress: hideAlert, style: 'cancel' },
        {
          text: 'Delete',
          onPress: () => { hideAlert(); executeSingleDelete(item, itemType); },
          style: 'destructive'
        },
      ],
      true
    );
  };

  // --- New: Execute Caption Update ---
  const executeCaptionUpdate = async (): Promise<void> => {
    if (!editingItem) return;

    setUpdatingCaption(true);
    try {
      await updatePostCaption(editingItem._id, editCaption.trim());

      // Update local state to reflect the new caption
      setPosts(prev => prev.map(p => p._id === editingItem._id ? { ...p, caption: editCaption.trim() } : p));
      setReels(prev => prev.map(r => r._id === editingItem._id ? { ...r, caption: editCaption.trim() } : r));
      setCombinedPosts(prev => prev.map(p => p._id === editingItem._id ? { ...p, caption: editCaption.trim() } : p));

      closeEditModal();
      showAlert('Success', 'Caption updated successfully', [
        { text: 'OK', onPress: hideAlert, style: 'default' }
      ]);

    } catch (error: any) {
      console.error('Error updating post caption:', error);
      showAlert('Error', error.message || 'Failed to update caption', [
        { text: 'OK', onPress: hideAlert, style: 'cancel' }
      ]);
    } finally {
      setUpdatingCaption(false);
    }
  };


  const executeSingleDelete = async (item: PostItem, itemType: string): Promise<void> => {
    setDeletingItems(prev => new Set(prev).add(item._id));
    try {
      await deletePost(item._id);
      setRecentlyDeleted(prev => [item, ...prev.slice(0, 4)]);
      removeItemFromState(item._id);
      showAlert(
        'Success',
        `${itemType.charAt(0).toUpperCase() + itemType.slice(1)} deleted successfully`,
        [
          { text: 'OK', onPress: hideAlert, style: 'default' },
          { text: 'Undo', onPress: () => { hideAlert(); undoDelete(item); }, style: 'default' }
        ]
      );
    } catch (error: any) {
      console.error('Error deleting post:', error);
      showAlert('Error', error.message || 'Failed to delete post', [
        { text: 'OK', onPress: hideAlert, style: 'cancel' }
      ]);
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
      showAlert('No Selection', 'Please select items to delete', [
        { text: 'OK', onPress: hideAlert, style: 'cancel' }
      ]);
      return;
    }
    const itemCount = selectedItems.size;
    const itemText = itemCount === 1 ? 'item' : 'items';
    showAlert(
      'Bulk Delete Confirmation',
      `Are you sure you want to delete ${itemCount} ${itemText}? This action cannot be undone.`,
      [
        { text: 'Cancel', onPress: hideAlert, style: 'cancel' },
        {
          text: `Delete ${itemCount} ${itemText}`,
          onPress: () => { hideAlert(); executeBulkDelete(); },
          style: 'destructive'
        },
      ],
      true
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
        showAlert('Success', `Successfully deleted ${deletedCount} ${deletedCount === 1 ? 'item' : 'items'}`, [
          { text: 'OK', onPress: hideAlert, style: 'default' }
        ]);
      } else if (deletedCount === 0) {
        showAlert('Error', `Failed to delete ${failedCount} ${failedCount === 1 ? 'item' : 'items'}`, [
          { text: 'OK', onPress: hideAlert, style: 'cancel' }
        ]);
      } else {
        showAlert(
          'Partial Success',
          `Deleted ${deletedCount} ${deletedCount === 1 ? 'item' : 'items'}, failed to delete ${failedCount}`,
          [{ text: 'OK', onPress: hideAlert, style: 'default' }]
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
    showAlert(
      'Undo Not Available',
      'Items are permanently deleted from the server. Undo is not available for deleted content.',
      [{ text: 'OK', onPress: hideAlert, style: 'cancel' }]
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
        showAlert('Error', error.message || 'Failed to fetch data', [
          { text: 'OK', onPress: hideAlert, style: 'cancel' }
        ]);
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
            showAlert('Authentication Required', 'Please log in again to view posts.', [
                { text: 'Cancel', onPress: hideAlert, style: 'cancel' },
                { text: 'Login', onPress: () => logout && logout(), style: 'destructive' }
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
            showAlert('Authentication Required', 'Please log in again to view reels.', [
                { text: 'Cancel', onPress: hideAlert, style: 'cancel' },
                { text: 'Login', onPress: () => logout && logout(), style: 'destructive' }
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
      showAlert('Error', 'Failed to open media viewer', [
        { text: 'OK', onPress: hideAlert, style: 'cancel' }
      ]);
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
        {/* Views Counter - Bottom Right */}
        {item.views !== undefined && item.views > 0 && (
          <View style={styles.viewCountContainer}>
            <Ionicons name="eye" size={12} color="#fff" />
            <Text style={styles.viewCountText}>{formatViewCount(item.views)}</Text>
          </View>
        )}
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
    const isMenuVisible = menuVisible[item._id] || false;
    return (
      <TouchableOpacity
        style={[
          styles.postContainer,
          isDeleting && styles.deletingContainer,
          isSelected && styles.selectedContainer
        ]}
        onPress={() => selectionMode ? toggleItemSelection(item._id) : handlePostPress(index)}
        onLongPress={() => {
          if (!isOwnProfile || selectionMode) return;
          showMenu(item._id);
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
        {/* Three Dot Menu */}
        {isMenuVisible && (
          <View style={styles.menuOverlay}>
            <TouchableOpacity
              style={styles.menuButton}
              onPress={() => {
                hideMenu(item._id);
                // Measure position for zoom animation
                setTimeout(() => {
                  handleZoom(item, {
                    x: 0,
                    y: 0,
                    width: ITEM_SIZE,
                    height: ITEM_SIZE
                  });
                }, 100);
              }}
            >
              <MaterialIcons name="zoom-in" size={20} color="#fff" />
              <Text style={styles.menuButtonText}>Zoom</Text>
            </TouchableOpacity>
            {/* --- NEW: Edit Menu Option --- */}
            <TouchableOpacity
              style={styles.menuButton}
              onPress={() => handleEditPost(item)} // Call the edit handler
            >
              <MaterialIcons name="edit" size={20} color="#fff" />
              <Text style={styles.menuButtonText}>Edit</Text>
            </TouchableOpacity>
            {/* --- END NEW --- */}
            <TouchableOpacity
              style={styles.menuButton}
              onPress={() => {
                hideMenu(item._id);
                handleDeletePost(item);
              }}
            >
              <Ionicons name="trash" size={20} color="#fff" />
              <Text style={styles.menuButtonText}>Delete</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.closeMenuButton}
              onPress={() => hideMenu(item._id)}
            >
              <Ionicons name="close" size={20} color="#fff" />
              <Text style={styles.menuButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        )}
        {/* Three Dot Icon */}
        {!isMenuVisible && isOwnProfile && (
          <TouchableOpacity
            style={styles.threeDotButton}
            onPress={() => showMenu(item._id)}
          >
            <MaterialIcons name="more-vert" size={20} color="#fff" />
          </TouchableOpacity>
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
          <Ionicons name="close" size={20} color={DARK_PINK} />
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

  // --- NEW: Edit Caption Modal Component ---
  const EditCaptionModal = () => (
    <Modal
      visible={isEditModalVisible}
      transparent
      animationType="slide"
      onRequestClose={closeEditModal} // Handle back button on Android
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.editModalContainer}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.editModalContent}>
            <View style={styles.editModalHeader}>
              <Text style={styles.editModalTitle}>Edit Caption</Text>
              <TouchableOpacity onPress={closeEditModal} style={styles.editModalCloseButton}>
                <Ionicons name="close" size={24} color={DARK_TEXT_SECONDARY} />
              </TouchableOpacity>
            </View>
            <View style={styles.editModalBody}>
              <TextInput
                style={styles.captionInput}
                value={editCaption}
                onChangeText={setEditCaption}
                placeholder="Write a caption..."
                placeholderTextColor={DARK_TEXT_SECONDARY}
                multiline
                textAlignVertical="top" // Android specific
                autoFocus
              />
            </View>
            <View style={styles.editModalActions}>
              <TouchableOpacity
                style={[styles.editModalButton, styles.editModalCancelButton]}
                onPress={closeEditModal}
                disabled={updatingCaption}
              >
                <Text style={styles.editModalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.editModalButton, styles.editModalSaveButton]}
                onPress={executeCaptionUpdate}
                disabled={updatingCaption || editCaption.trim() === (editingItem?.caption || '')} // Disable if unchanged or loading
              >
                {updatingCaption ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.editModalButtonText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Modal>
  );


  // --- Alert Modal Component ---
  const CustomAlertModal = () => (
    <Modal
      visible={alertModal.visible}
      transparent
      animationType="fade"
      onRequestClose={hideAlert}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{alertModal.title}</Text>
          </View>
          <View style={styles.modalBody}>
            <Text style={styles.modalMessage}>{alertModal.message}</Text>
          </View>
          <View style={styles.modalActions}>
            {alertModal.actions.map((action, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.modalButton,
                  action.style === 'destructive' && styles.destructiveButton,
                  action.style === 'cancel' && styles.cancelButton
                ]}
                onPress={action.onPress}
              >
                <Text style={[
                  styles.modalButtonText,
                  action.style === 'destructive' && styles.destructiveButtonText,
                  action.style === 'cancel' && styles.cancelButtonText
                ]}>
                  {action.text}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
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
          <ActivityIndicator size="large" color={DARK_PINK} />
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[DARK_PINK]} tintColor={DARK_PINK} />}
        showsVerticalScrollIndicator={false}
      />
    );
  };
  // --- JSX Return ---
  return (
    <View style={styles.container}>
      {/* Custom Alert Modal */}
      <CustomAlertModal />
      {/* New Edit Caption Modal */}
      <EditCaptionModal />
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
          <MaterialIcons name="grid-on" size={24} color={activeTab === 'posts' ? DARK_PINK : '#888'} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'reels' && styles.activeTab]}
          onPress={() => {
            if (selectionMode) exitSelectionMode();
            setActiveTab('reels');
          }}
        >
          <Ionicons name="videocam" size={24} color={activeTab === 'reels' ? DARK_PINK : '#888'} />
        </TouchableOpacity>
      </View>
      {/* Zoom Preview */}
      {renderZoomPreview()}
      {/* Content */}
      {renderContent()}
      {/* Hints */}
      {isOwnProfile && !selectionMode && (
        <View style={styles.hintContainer}>
          <Text style={styles.hintText}>Hold any post to show menu • Tap to view</Text>
        </View>
      )}
    </View>
  );
};
// --- Enhanced Stylesheet ---
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: DARK_BG },
  // Selection Header Styles
  selectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: DARK_CARD,
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
    color: DARK_PINK,
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 4,
  },
  selectionInfo: {
    flex: 1,
    alignItems: 'center',
  },
  selectionCountText: {
    color: DARK_TEXT,
    fontSize: 16,
    fontWeight: '600',
  },
  selectionActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deleteButton: {
    backgroundColor: DARK_PINK,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginLeft: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  // Tab Styles
  tabContainer: { flexDirection: 'row', borderBottomWidth: 1, borderColor: '#333' },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  activeTab: { borderBottomWidth: 2, borderColor: DARK_PINK },
  // Grid Styles
  grid: { flex: 1 },
  postContainer: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    margin: 1,
    backgroundColor: DARK_CARD,
    position: 'relative'
  },
  deletingContainer: { opacity: 0.5 },
  selectedContainer: {
    borderWidth: 3,
    borderColor: DARK_PINK,
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
    backgroundColor: DARK_PINK,
    borderColor: DARK_PINK,
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
  placeholderContainer: { justifyContent: 'center', alignItems: 'center', backgroundColor: DARK_CARD },
  placeholderSubtext: { fontSize: 11, color: DARK_TEXT_SECONDARY, textAlign: 'center' },
  multipleIndicator: { position: 'absolute', top: 6, left: 6, backgroundColor: 'rgba(0, 0, 0, 0.7)', borderRadius: 12, paddingHorizontal: 6, paddingVertical: 2 },
  // NEW: View Count Styles
  viewCountContainer: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 5,
  },
  viewCountText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 2,
  },
  // Menu Styles
  menuOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: DARK_CARD,
    borderRadius: 8,
    padding: 4,
    zIndex: 20,
    borderWidth: 1,
    borderColor: '#333',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  menuButton: {
    padding: 12,
    alignItems: 'center',
    flexDirection: 'row',
  },
  menuButtonText: {
    color: DARK_TEXT,
    fontSize: 14,
    marginLeft: 8,
  },
  closeMenuButton: {
    padding: 12,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#333',
    flexDirection: 'row',
  },
  threeDotButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    padding: 4,
    zIndex: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 12,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: DARK_CARD,
    borderRadius: 12,
    width: '100%',
    maxWidth: 350,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#333',
  },
  modalHeader: {
    padding: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: DARK_TEXT,
    textAlign: 'center',
  },
  modalBody: {
    padding: 20,
    paddingTop: 15,
    paddingBottom: 15,
  },
  modalMessage: {
    fontSize: 16,
    color: DARK_TEXT_SECONDARY,
    textAlign: 'center',
    lineHeight: 22,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 15,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  modalButton: {
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginLeft: 10,
    borderRadius: 8,
    backgroundColor: 'transparent',
    minWidth: 70,
    alignItems: 'center',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: DARK_PINK,
  },
  destructiveButton: {
    backgroundColor: 'rgba(237, 22, 126, 0.15)',
  },
  destructiveButtonText: {
    color: DARK_PINK,
    fontWeight: '600',
  },
  cancelButton: {
    backgroundColor: 'transparent',
  },
  cancelButtonText: {
    color: DARK_TEXT_SECONDARY,
  },
  // State Styles
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 50 },
  loadingText: { color: DARK_TEXT, fontSize: 16, marginTop: 10 },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 50, paddingHorizontal: 20 },
  errorTitle: { color: DARK_TEXT, fontSize: 18, fontWeight: '600', marginBottom: 8, textAlign: 'center' },
  errorText: { color: DARK_TEXT, fontSize: 16, marginBottom: 16, textAlign: 'center' },
  retryButton: { backgroundColor: DARK_PINK, paddingHorizontal: 20, paddingVertical: 8, borderRadius: 4 },
  retryText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 50, paddingHorizontal: 20 },
  emptyTitle: { color: DARK_TEXT, fontSize: 18, fontWeight: '600', textAlign: 'center', marginBottom: 8 },
  emptySubtitle: { color: DARK_TEXT_SECONDARY, fontSize: 14, textAlign: 'center', marginBottom: 20 },
  uploadButton: { backgroundColor: DARK_PINK, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
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
  hintText: { color: DARK_TEXT_SECONDARY, fontSize: 12, textAlign: 'center' },
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
  // --- NEW: Edit Caption Modal Styles ---
  editModalContainer: {
    flex: 1,
    justifyContent: 'flex-end', // Modal appears from the bottom
    backgroundColor: 'rgba(0, 0, 0, 0.5)', // Semi-transparent background
  },
  editModalContent: {
    backgroundColor: DARK_CARD,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    maxHeight: '70%', // Limit height
  },
  editModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    paddingBottom: 10,
  },
  editModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: DARK_TEXT,
  },
  editModalCloseButton: {
    padding: 4,
  },
  editModalBody: {
    flex: 1,
    marginBottom: 16,
  },
  captionInput: {
    backgroundColor: DARK_BG,
    color: DARK_TEXT,
    fontSize: 16,
    padding: 12,
    borderRadius: 8,
    minHeight: 100, // Minimum height for text input
    maxHeight: 200, // Maximum height before scrolling
    textAlignVertical: 'top', // iOS specific
  },
  editModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10, // Space between buttons
  },
  editModalButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center', // Center content vertically
  },
  editModalCancelButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: DARK_TEXT_SECONDARY,
  },
  editModalSaveButton: {
    backgroundColor: DARK_PINK,
  },
  editModalButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: DARK_TEXT,
  },

});
export default ProfileTabs;
