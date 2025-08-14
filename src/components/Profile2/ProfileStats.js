import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

const ProfileStats = ({ 
  posts = 0, 
  followers = 0, 
  following = 0,
  onPostsPress,
  onFollowersPress,
  onFollowingPress 
}) => {
  const formatNumber = (num) => {
    if (!num || num === 0) return '0';
    
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity 
        style={styles.statItem} 
        onPress={onPostsPress}
        activeOpacity={0.7}
      >
        <Text style={styles.statNumber}>{formatNumber(posts)}</Text>
        <Text style={styles.statLabel}>Posts</Text>
      </TouchableOpacity>
      
      <View style={styles.separator} />
      
      <TouchableOpacity 
        style={styles.statItem} 
        onPress={onFollowersPress}
        activeOpacity={0.7}
      >
        <Text style={styles.statNumber}>{formatNumber(followers)}</Text>
        <Text style={styles.statLabel}>Followers</Text>
      </TouchableOpacity>
      
      <View style={styles.separator} />
      
      <TouchableOpacity 
        style={styles.statItem} 
        onPress={onFollowingPress}
        activeOpacity={0.7}
      >
        <Text style={styles.statNumber}>{formatNumber(following)}</Text>
        <Text style={styles.statLabel}>Following</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
    backgroundColor: '#000',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  statNumber: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    color: '#888',
    fontSize: 14,
    fontWeight: '500',
  },
  separator: {
    width: 1,
    height: 40,
    backgroundColor: '#333',
    marginHorizontal: 8,
  },
});

export default ProfileStats;