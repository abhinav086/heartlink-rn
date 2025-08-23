// src/screens/profile/FollowingList.js
import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  ActivityIndicator, 
  StyleSheet, 
  TouchableOpacity,
  SafeAreaView,
  Image,
  Alert,
  RefreshControl
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import BASE_URL from '../../config/config';

const FollowingList = ({ route, navigation }) => {
  const { userId, username: profileUsername } = route.params; // The user whose following we are listing
  const { token, user: currentUser } = useAuth();

  const [following, setFollowing] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchFollowing(true);
  }, [userId, token]); // Re-fetch if userId or token changes

  const fetchFollowing = async (isRefresh = false) => {
    if (!token || !userId) {
      setError("Authentication or User ID required.");
      setLoading(false);
      return;
    }

    if (!isRefresh && !hasMore) return; // No more data to load

    isRefresh ? setRefreshing(true) : setLoading(true);
    setError(null);

    const currentPage = isRefresh ? 1 : page;

    try {
      const response = await fetch(`${BASE_URL}/api/v1/users/following/${userId}?page=${currentPage}&limit=20`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (response.ok && data.success && Array.isArray(data.data?.following)) {
        // Deduplicate following by _id to prevent duplicate keys
        const uniqueFollowing = isRefresh
          ? [...new Map(data.data.following.map(item => [item._id, item])).values()]
          : [...new Map([...following, ...data.data.following].map(item => [item._id, item])).values()];

        setFollowing(uniqueFollowing);
        setHasMore(data.data.pagination.hasNext);
        setPage(currentPage + 1);
      } else {
        throw new Error(data.message || 'Failed to fetch following.');
      }
    } catch (e) {
      console.error('Error fetching following:', e);
      setError(e.message || "Failed to load following. Please try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setFollowing([]);       // Clear current list
    setPage(1);             // Reset page to 1
    setHasMore(true);       // Allow loading more
    fetchFollowing(true);   // Fetch fresh data
  };

  const handleEndReached = () => {
    if (!loading && hasMore) {
      fetchFollowing();
    }
  };

  const handleUserPress = (user) => {
    navigation.push('UserProfile', { userId: user._id });
  };

  const getInitials = (fullName) => {
    if (!fullName || typeof fullName !== 'string') return '?';
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
    
    if (!name || typeof name !== 'string') return colors[0];
    const charCodeSum = name.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
    return colors[charCodeSum % colors.length];
  };

  const renderItem = ({ item }) => {
    return (
      <TouchableOpacity style={styles.userItem} onPress={() => handleUserPress(item)}>
        <View style={[styles.userAvatar, { backgroundColor: getAvatarColor(item.fullName) }]}>
          {item.photoUrl ? (
            <Image 
              source={{ uri: item.photoUrl }} 
              style={styles.avatarImage}
            />
          ) : (
            <Text style={styles.avatarText}>
              {getInitials(item.fullName)}
            </Text>
          )}
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{item.fullName || 'Unknown User'}</Text>
          {item.username && <Text style={styles.userHandle}>@{item.username}</Text>}
          {item.bio && <Text style={styles.userBio} numberOfLines={2}>{item.bio}</Text>}
        </View>
      </TouchableOpacity>
    );
  };

  // Safe key extractor with deduplication
  const keyExtractor = (item) => {
    if (!item._id) {
      // Generate a unique key if _id is missing
      return `missing-id-${Math.random().toString(36).substr(2, 9)}`;
    }
    return item._id.toString();
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{profileUsername}'s Following</Text>
        <View style={styles.headerSpacer} />
      </View>

      {error ? (
        <View style={styles.messageContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : following.length === 0 && !loading && !refreshing ? (
        <View style={styles.messageContainer}>
          <Text style={styles.emptyText}>No users found in following list.</Text>
        </View>
      ) : (
        <FlatList
          data={following}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.5}
          ListFooterComponent={() => loading && hasMore && <ActivityIndicator size="small" color="#ed167e" style={{ marginVertical: 20 }} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={['#ed167e']}
              tintColor="#ed167e"
            />
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2e2e2e',
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
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  messageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: '#ff4757',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
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
  emptyText: {
    color: '#999',
    fontSize: 16,
    textAlign: 'center',
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  userAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 15,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 25,
  },
  avatarText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  userHandle: {
    color: '#999',
    fontSize: 14,
  },
  userBio: {
    color: '#ccc',
    fontSize: 12,
    marginTop: 4,
  },
});

export default FollowingList;