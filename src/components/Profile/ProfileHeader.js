import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  Dimensions,
  TouchableWithoutFeedback
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import BASE_URL from '../../config/config';
import LinearGradient from 'react-native-linear-gradient';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const ProfileHeader = ({
  userId,
  username = '',
  profilePic = '',
  bio = '',
  isOwnProfile = false,
  followersCount = 0,
  followingCount = 0
}) => {
  const navigation = useNavigation();
  const authContext = useAuth();
  const { user, token } = authContext || {};

  // State definitions
  const [postsCount, setPostsCount] = useState(0);
  const [postsLoading, setPostsLoading] = useState(true);
  const [photoZoomed, setPhotoZoomed] = useState(false);

  const [followStatus, setFollowStatus] = useState({
    isFollowing: false,
    isFollowedBy: false,
    relationship: 'none',
    loading: true
  });

  const [followActionLoading, setFollowActionLoading] = useState(false);
  const [impressionStatus, setImpressionStatus] = useState({ 
    isImpressed: false, 
    loading: true 
  });
  const [impressionLoading, setImpressionLoading] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState(null);

  // State for fetched follower counts to handle the 0,0 issue
  const [fetchedCounts, setFetchedCounts] = useState({
    followers: null,
    following: null,
    loading: true
  });

  // Determine the correct user ID to fetch data for
  const targetUserId = userId || user?._id;

  // Safe data extraction with fallbacks - ensure all are strings
  const safeUsername = username ? String(username) : 'User';
  const safeProfilePic = profilePic ? String(profilePic) : '';
  const safeBio = bio ? String(bio) : '';

  useEffect(() => {
    // Reset state when the profile being viewed changes
    setPostsCount(0);
    setPostsLoading(true);
    setPhotoZoomed(false);
    setFollowStatus({ isFollowing: false, isFollowedBy: false, relationship: 'none', loading: true });
    setImpressionStatus({ isImpressed: false, loading: true });
    setFollowActionLoading(false);
    setImpressionLoading(false);
    setFetchedCounts({ followers: null, following: null, loading: true });

    if (token && targetUserId) {
      fetchPostsCount();
      fetchSubscriptionStatus();
      fetchUserCounts();
      if (!isOwnProfile) {
        fetchFollowStatus();
        fetchImpressionStatus();
      } else {
        // For own profile, set default states
        setFollowStatus({ isFollowing: false, isFollowedBy: false, relationship: 'self', loading: false });
        setImpressionStatus({ isImpressed: false, loading: false });
      }
    } else {
      // Handle case where token or targetUserId is not available
      setPostsCount(0);
      setPostsLoading(false);
      setFollowStatus({ isFollowing: false, isFollowedBy: false, relationship: 'none', loading: false });
      setImpressionStatus({ isImpressed: false, loading: false });
      setFetchedCounts({ followers: followersCount, following: followingCount, loading: false });
    }
  }, [targetUserId, token, isOwnProfile]);

  const fetchUserCounts = async () => {
    if (!token || !targetUserId) {
      setFetchedCounts({ followers: followersCount, following: followingCount, loading: false });
      return;
    }
    
    try {
      const response = await fetch(`${BASE_URL}/api/v1/users/profile/${targetUserId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await response.json();
      if (response.ok && data?.success && data.data) {
        setFetchedCounts({
          followers: data.data.followersCount || data.data.followers?.length || followersCount || 0,
          following: data.data.followingCount || data.data.following?.length || followingCount || 0,
          loading: false
        });
      } else {
        setFetchedCounts({ followers: followersCount, following: followingCount, loading: false });
      }
    } catch (error) {
      console.error('Error fetching user counts:', error);
      setFetchedCounts({ followers: followersCount, following: followingCount, loading: false });
    }
  };

  const fetchPostsCount = async () => {
    if (!token || !targetUserId) {
      setPostsCount(0);
      setPostsLoading(false);
      return;
    }
    setPostsLoading(true);
    try {
      const response = await fetch(`${BASE_URL}/api/v1/posts/user/${targetUserId}?type=post`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await response.json();
      if (response.ok && data?.success) {
        const count = data.data?.totalPosts || data.data?.totalCount || data.data?.posts?.length || 0;
        setPostsCount(Number(count));
      } else {
        setPostsCount(0);
      }
    } catch (error) {
      console.error('Error fetching posts count:', error);
      setPostsCount(0);
    } finally {
      setPostsLoading(false);
    }
  };

  const fetchFollowStatus = async () => {
    if (!token || !targetUserId || isOwnProfile) {
      setFollowStatus({ isFollowing: false, isFollowedBy: false, relationship: 'none', loading: false });
      return;
    }
    try {
      const response = await fetch(`${BASE_URL}/api/v1/users/follow-status/${targetUserId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await response.json();
      if (response.ok && data?.success) {
        setFollowStatus({
          isFollowing: Boolean(data.data?.isFollowing),
          isFollowedBy: Boolean(data.data?.isFollowedBy),
          relationship: data.data?.relationship || 'none',
          loading: false
        });
      } else {
        throw new Error(data.message || 'Failed to fetch follow status');
      }
    } catch (error) {
      console.error('Error fetching follow status:', error);
      setFollowStatus({ isFollowing: false, isFollowedBy: false, relationship: 'none', loading: false });
    }
  };

  const handleFollow = async () => {
    if (!token || !targetUserId || isOwnProfile || followActionLoading) return;
    setFollowActionLoading(true);
    try {
      const endpoint = followStatus.isFollowing ? 'unfollow' : 'follow';
      const response = await fetch(`${BASE_URL}/api/v1/users/${endpoint}/${targetUserId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await response.json();

      if (response.ok && data?.success) {
        // Update the follow button status immediately
        const newIsFollowing = !followStatus.isFollowing;
        setFollowStatus(prev => ({
          ...prev,
          isFollowing: newIsFollowing,
          relationship: newIsFollowing ? (prev.isFollowedBy ? 'mutual' : 'following') : (prev.isFollowedBy ? 'follower' : 'none'),
        }));
        
        // Update follower count
        setFetchedCounts(prev => ({
          ...prev,
          followers: newIsFollowing ? (prev.followers + 1) : Math.max(0, prev.followers - 1)
        }));
      } else {
        Alert.alert('Error', data.message || `Failed to ${endpoint} user.`);
      }
    } catch (error) {
      console.error(`Error during ${followStatus.isFollowing ? 'unfollow' : 'follow'} action:`, error);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setFollowActionLoading(false);
    }
  };

  const fetchSubscriptionStatus = async () => {
    if (!token) return;
    try {
      const response = await fetch(`${BASE_URL}/api/v1/subscription/status`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await response.json();
      if (response.ok && data?.success) {
        setSubscriptionStatus(data.data?.subscription || null);
      }
    } catch (error) {
      console.error('Error fetching subscription status:', error);
    }
  };

  const fetchImpressionStatus = async () => {
    if (!token || !targetUserId || isOwnProfile) {
      setImpressionStatus({ isImpressed: false, loading: false });
      return;
    }
    try {
      const response = await fetch(`${BASE_URL}/api/v1/users/impression-status/${targetUserId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await response.json();
      if (response.ok && data?.success) {
        setImpressionStatus({
          isImpressed: Boolean(data.data?.isImpressed),
          loading: false
        });
      } else {
        setImpressionStatus({ isImpressed: false, loading: false });
      }
    } catch (error) {
      console.error('Error fetching impression status:', error);
      setImpressionStatus({ isImpressed: false, loading: false });
    }
  };

  const checkPremiumAndExecute = (callback, featureName) => {
    if (!subscriptionStatus) {
      Alert.alert('Error', 'Unable to check subscription status. Please try again.');
      return;
    }

    if (subscriptionStatus.currentPlan === 'free') {
      Alert.alert(
        'Premium Feature',
        `${featureName} feature is only available for premium users. Would you like to upgrade your subscription?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Upgrade', onPress: () => navigation.navigate('Memberships') }
        ]
      );
      return;
    }

    // Execute the callback if user is premium
    callback();
  };

  const handleImpress = async () => {
    if (!token || !targetUserId || isOwnProfile || impressionLoading) return;

    checkPremiumAndExecute(async () => {
      setImpressionLoading(true);
      try {
        const endpoint = impressionStatus.isImpressed ? 'unimpress' : 'impress';
        const response = await fetch(`${BASE_URL}/api/v1/users/${endpoint}/${targetUserId}`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
        });
        const data = await response.json();
        if (response.ok && data?.success) {
          setImpressionStatus({ isImpressed: !impressionStatus.isImpressed, loading: false });
          Alert.alert('Success', data.message || 'Impression status updated!');
        } else {
          Alert.alert('Error', data.message || `Failed to ${endpoint} user`);
        }
      } catch (error) {
        Alert.alert('Error', 'Failed to update impression. Please try again.');
      } finally {
        setImpressionLoading(false);
      }
    }, 'Impression');
  };

  const handleFollowersPress = () => {
    if (navigation?.navigate && targetUserId) {
      navigation.navigate('FollowersList', { userId: targetUserId, username: safeUsername });
    }
  };

  const handleFollowingPress = () => {
    if (navigation?.navigate && targetUserId) {
      navigation.navigate('FollowingList', { userId: targetUserId, username: safeUsername });
    }
  };

  const handleInvite = () => {
    checkPremiumAndExecute(() => {
      // Premium invite functionality here
      console.log('Executing invite functionality for premium user');
      // You can add your invite logic here
      // For now, just navigate to memberships as placeholder
      navigation.navigate('Memberships');
    }, 'Invite');
  };

  const handleTakeOnDate = () => {
    checkPremiumAndExecute(() => {
      // Premium take on date functionality here
      console.log('Executing take on date functionality for premium user');
      // You can add your take on date logic here
      // For now, just navigate to memberships as placeholder
      navigation.navigate('Memberships');
    }, 'Take on Date');
  };

  const handlePostsPress = () => console.log('Posts count pressed.');

  const handlePhotoLongPress = () => {
    if (safeProfilePic) {
      setPhotoZoomed(true);
    }
  };

  const handleCloseZoom = () => {
    setPhotoZoomed(false);
  };

  const getInitials = (fullName) => {
    if (!fullName || typeof fullName !== 'string') return '?';
    const names = String(fullName).trim().split(' ').filter(Boolean);
    if (names.length === 0) return '?';
    if (names.length === 1) return names[0].charAt(0).toUpperCase();
    return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase();
  };

  const getAvatarColor = (name) => {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'];
    if (!name || typeof name !== 'string') return colors[0];
    const charCodeSum = String(name).split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
    return colors[charCodeSum % colors.length];
  };

  const getFollowButtonText = () => {
    if (followActionLoading || followStatus.loading) return 'Loading...';
    if (followStatus.isFollowing) return 'Unfollow';
    if (followStatus.isFollowedBy) return 'Follow Back';
    return 'Follow';
  };

  const getImpressionButtonText = () => {
    if (impressionLoading || impressionStatus.loading) return 'Loading...';
    return impressionStatus.isImpressed ? 'Impressed' : 'Impress';
  };

  const formatNumber = (num) => {
    const numValue = Number(num) || 0;
    if (numValue >= 1000000) return (numValue / 1000000).toFixed(1) + 'M';
    if (numValue >= 1000) return (numValue / 1000).toFixed(1) + 'k';
    return String(numValue);
  };

  // Use fetched counts if available, otherwise use props
  const displayFollowersCount = fetchedCounts.loading ? 
    (Number(followersCount) || 0) : 
    (Number(fetchedCounts.followers) || 0);
  
  const displayFollowingCount = fetchedCounts.loading ? 
    (Number(followingCount) || 0) : 
    (Number(fetchedCounts.following) || 0);

  const safePostsCount = Number(postsCount) || 0;

  return (
    <View style={styles.container}>
      <View style={styles.profileSection}>
        <TouchableOpacity 
          onLongPress={handlePhotoLongPress}
          activeOpacity={0.8}
          style={[styles.profilePic, { backgroundColor: getAvatarColor(safeUsername) }]}
        >
          {safeProfilePic ? (
            <Image source={{ uri: safeProfilePic }} style={styles.profileImage} />
          ) : (
            <Text style={styles.profilePicText}>
              {getInitials(user?.fullName || safeUsername)}
            </Text>
          )}
        </TouchableOpacity>
        
        <Text style={styles.username}>
          @{safeUsername}
        </Text>
        
        <View style={styles.bioContainer}>
          {safeBio ? (
            <Text style={styles.bio}>{safeBio}</Text>
          ) : (
            <View style={styles.emptyBioSpace} />
          )}
        </View>
        
        <View style={styles.statsContainer}>
          <TouchableOpacity style={styles.statItem} onPress={handlePostsPress}>
            {postsLoading ? (
              <ActivityIndicator size="small" color="#ed167e" />
            ) : (
              <Text style={styles.statNumber}>
                {formatNumber(safePostsCount)}
              </Text>
            )}
            <Text style={styles.statLabel}>Posts</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.statItem} onPress={handleFollowersPress}>
            <Text style={styles.statNumber}>
              {formatNumber(displayFollowersCount)}
            </Text>
            <Text style={styles.statLabel}>Followers</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.statItem} onPress={handleFollowingPress}>
            <Text style={styles.statNumber}>
              {formatNumber(displayFollowingCount)}
            </Text>
            <Text style={styles.statLabel}>Following</Text>
          </TouchableOpacity>
        </View>
      </View>

      {!isOwnProfile && (
        <View style={styles.actionButtonsContainer}>
          <View style={styles.buttonRow}>
            <TouchableOpacity 
              style={[styles.actionButton, styles.followButton, followStatus.isFollowing && styles.followingButton]} 
              onPress={handleFollow} 
              disabled={followActionLoading || followStatus.loading}>
              {followActionLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={[styles.actionButtonText, followStatus.isFollowing && styles.followingButtonText]}>
                  {getFollowButtonText()}
                </Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.actionButton, styles.impressButton, impressionStatus.isImpressed && styles.impressedButton]} 
              onPress={handleImpress}
              disabled={impressionLoading || impressionStatus.loading}>
              {impressionLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={[styles.actionButtonText, impressionStatus.isImpressed && styles.impressedButtonText]}>
                  {getImpressionButtonText()}
                </Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionButton, styles.inviteButton]} onPress={handleInvite}>
              <Text style={styles.actionButtonText}>Invite</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.buttonRowCentered}>
            <TouchableOpacity style={styles.dateButtonContainer} onPress={handleTakeOnDate}>
              <LinearGradient colors={['#FF69B4', '#4169E1']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.dateButtonGradient}>
                <Text style={styles.dateButtonText}>Take on Date</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Photo Zoom Modal */}
      <Modal
        visible={photoZoomed}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCloseZoom}
      >
        <TouchableWithoutFeedback onPress={handleCloseZoom}>
          <View style={styles.zoomModalBackground}>
            <TouchableWithoutFeedback>
              <View style={styles.zoomModalContent}>
                <TouchableOpacity 
                  style={styles.closeButton}
                  onPress={handleCloseZoom}
                >
                  <Text style={styles.closeButtonText}>✕</Text>
                </TouchableOpacity>
                <Image 
                  source={{ uri: safeProfilePic }} 
                  style={styles.zoomedImage}
                />
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { backgroundColor: '#0a0a0a' },
  profileSection: { alignItems: 'center', paddingHorizontal: 20, paddingVertical: 20 },
  profilePic: { 
    width: 120, 
    height: 120, 
    borderRadius: 60, 
    justifyContent: 'center', 
    alignItems: 'center', 
    borderWidth: 3, 
    borderColor: '#2e2e2e', 
    marginBottom: 10, 
    overflow: 'hidden' 
  },
  profileImage: { width: '100%', height: '100%' },
  profilePicText: { color: 'white', fontSize: 45, fontWeight: '700' },
  username: { fontSize: 24, fontWeight: '700', color: '#fff', marginBottom: 8, textAlign: 'center' },
  bioContainer: { width: '100%', minHeight: 15, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  bio: { fontSize: 16, color: '#ccc', textAlign: 'center', lineHeight: 22, paddingHorizontal: 10 },
  emptyBioSpace: { height: 15 },
  statsContainer: { flexDirection: 'row', marginBottom: 8, justifyContent: 'center', alignItems: 'center' },
  statItem: { alignItems: 'center', paddingHorizontal: 25, paddingVertical: 6 },
  statNumber: { fontSize: 20, fontWeight: '700', color: '#fff' },
  statLabel: { fontSize: 14, color: '#999', marginTop: 2 },
  actionButtonsContainer: { paddingHorizontal: 20, paddingBottom: 20, gap: 8 },
  buttonRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  buttonRowCentered: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  actionButton: { flex: 1, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 22, alignItems: 'center', justifyContent: 'center', minHeight: 44, borderWidth: 1 },
  followButton: { backgroundColor: 'transparent', borderColor: '#ed167e' },
  followingButton: { backgroundColor: '#2e2e2e', borderColor: '#ed167e' },
  impressButton: { backgroundColor: 'transparent', borderColor: '#ed167e' },
  impressedButton: { backgroundColor: '#2e2e2e', borderColor: '#ed167e' },
  inviteButton: { backgroundColor: 'transparent', borderColor: '#ed167e' },
  dateButtonContainer: { width: 180, borderRadius: 22, overflow: 'hidden', marginTop: 8 },
  dateButtonGradient: { flex: 1, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', minHeight: 44 },
  actionButtonText: { color: '#ed167e', fontSize: 15, fontWeight: '600' },
  followingButtonText: { color: '#ed167e' },
  impressedButtonText: { color: '#ed167e' },
  dateButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  
  // Zoom Modal Styles
  zoomModalBackground: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomModalContent: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    top: screenHeight * 0.15,
    right: screenWidth * 0.1,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  zoomedImage: {
    width: screenWidth * 0.7,
    height: screenWidth * 0.7,
    borderRadius: (screenWidth * 0.7) / 2,
    resizeMode: 'cover',
  },
});

export default ProfileHeader;