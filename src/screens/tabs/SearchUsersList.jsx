// src/screens/tabs/SearchUsersList.jsx
import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TextInput,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  Image,
  Text,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import BASE_URL from '../../config/config';
import { useAuth } from '../../context/AuthContext';

const SearchUsersList = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigation = useNavigation();
  const { token } = useAuth();

  // Debounce search (to avoid spamming API)
  useEffect(() => {
    if (searchQuery.length < 2) {
      setUsers([]);
      return;
    }

    const delayDebounce = setTimeout(() => {
      fetchUsers();
    }, 500);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

  const fetchUsers = async () => {
    if (!token || !searchQuery.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${BASE_URL}/api/v1/users/users/search?q=${encodeURIComponent(searchQuery)}&limit=10`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const result = await response.json();

      if (response.ok && result.success) {
        setUsers(result.data.results);
      } else {
        setError(result.message || 'Failed to load users.');
      }
    } catch (err) {
      console.error('Error fetching users:', err);
      setError('Network error. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleUserPress = (userId) => {
    navigation.navigate('UserProfile', { userId });
  };

  const renderUserItem = ({ item }) => (
    <TouchableOpacity
      style={styles.userItem}
      onPress={() => handleUserPress(item._id)}
    >
      <View style={styles.userAvatarContainer}>
        <Image
          source={{
            uri: item.photoUrl ? item.photoUrl.trim() : 'https://via.placeholder.com/40',
          }}
          style={styles.userAvatar}
          resizeMode="cover"
        />
      </View>
      <View style={styles.userInfo}>
        <Text style={styles.userName}>{item.fullName}</Text>
        <Text style={styles.userUsername}>@{item.username}</Text>
        <Text style={styles.userStats}>
          {item.followersCount} followers • {item.followingCount} following
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchBarContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search..."
          placeholderTextColor="#d33682"
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          returnKeyType="search"
          onSubmitEditing={fetchUsers}
        />
        <TouchableOpacity
          style={styles.searchIcon}
          onPress={fetchUsers}
          disabled={!searchQuery.trim()}
        >
          <Text style={styles.iconText}>🔍</Text>
        </TouchableOpacity>
      </View>

      {/* Results List */}
      {loading && searchQuery.length >= 2 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#ed167e" />
          <Text style={styles.loadingText}>Searching...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={users}
          renderItem={renderUserItem}
          keyExtractor={(item) => item._id}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                {searchQuery.length >= 2 ? 'No users found.' : 'Start typing to search...'}
              </Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContainer}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    borderRadius: 24,
    backgroundColor: '#1a1a1a',
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: 'white',
    paddingLeft: 12,
  },
  searchIcon: {
    padding: 8,
    marginLeft: 8,
  },
  iconText: {
    color: '#ed167e',
    fontSize: 18,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  userAvatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
  },
  userAvatar: {
    width: '100%',
    height: '100%',
  },
  userInfo: {
    marginLeft: 12,
    flex: 1,
  },
  userName: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  userUsername: {
    color: '#aaa',
    fontSize: 14,
  },
  userStats: {
    color: '#999',
    fontSize: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#999',
    marginTop: 8,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: '#ff4757',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    color: '#999',
    textAlign: 'center',
  },
  listContainer: {
    paddingBottom: 60,
  },
});

export default SearchUsersList;