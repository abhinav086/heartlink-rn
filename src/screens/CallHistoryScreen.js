// src/screens/CallHistoryScreen.js - Complete Call History Interface
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useCall } from '../context/CallManager';
import { useAuth } from '../context/AuthContext';
import BASE_URL from '../config/config';

// Import React Native Vector Icons
import Ionicons from 'react-native-vector-icons/Ionicons';

const CallHistoryScreen = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { callHistory, getCallHistory, clearCallHistory, initiateCall, isInCall } = useCall();
  const { user: currentUser } = useAuth();
  const navigation = useNavigation();

  useEffect(() => {
    loadCallHistory();
  }, []);

  const loadCallHistory = async () => {
    setLoading(true);
    try {
      await getCallHistory();
    } catch (error) {
      console.error('Error loading call history:', error);
      Alert.alert('Error', 'Failed to load call history');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadCallHistory();
    setRefreshing(false);
  };

  const handleClearHistory = () => {
    Alert.alert(
      'Clear Call History',
      'Are you sure you want to clear all call history? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            clearCallHistory();
            Alert.alert('Success', 'Call history cleared');
          },
        },
      ]
    );
  };

  const handleCallBack = async (call) => {
    if (isInCall) {
      Alert.alert('Error', 'You are already in a call');
      return;
    }

    const receiverId = call.direction === 'outgoing' ? call.callee?._id : call.caller?._id;
    const receiverData = call.direction === 'outgoing' ? call.callee : call.caller;

    if (!receiverId) {
      Alert.alert('Error', 'Cannot call back: Contact information is missing');
      return;
    }

    const success = await initiateCall(receiverId, call.callType, receiverData);
    if (!success) {
      Alert.alert('Call Failed', 'Unable to call back. Please try again.');
    }
  };

  const getProfileImageUrl = (user) => {
    if (!user) return null;
    
    if (user.photoUrl && typeof user.photoUrl === 'string') {
      return user.photoUrl;
    }
    
    if (user.profilePicture && typeof user.profilePicture === 'string') {
      return user.profilePicture;
    }
    
    if (user.profilePic && typeof user.profilePic === 'string') {
      if (user.profilePic.startsWith('http://') || user.profilePic.startsWith('https://')) {
        return user.profilePic;
      }
      const cleanPath = user.profilePic.startsWith('/') ? user.profilePic.substring(1) : user.profilePic;
      return `${BASE_URL}/${cleanPath}`;
    }
    
    if (user.avatar && typeof user.avatar === 'string') {
      if (user.avatar.startsWith('http://') || user.avatar.startsWith('https://')) {
        return user.avatar;
      }
      const cleanPath = user.avatar.startsWith('/') ? user.avatar.substring(1) : user.avatar;
      return `${BASE_URL}/${cleanPath}`;
    }
    
    return null;
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
      '#FF6B9D', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
      '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
    ];
    const charCodeSum = name.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
    return colors[charCodeSum % colors.length];
  };

  const formatDateTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      return 'Today ' + date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
    } else if (diffDays === 2) {
      return 'Yesterday ' + date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
    } else if (diffDays <= 7) {
      return date.toLocaleDateString('en-US', { weekday: 'short' }) + ' ' +
        date.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        });
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      }) + ' ' + date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
    }
  };

  const formatDuration = (seconds) => {
    if (!seconds || seconds === 0) return '0s';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${remainingSeconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    } else {
      return `${remainingSeconds}s`;
    }
  };

  const getCallStatusIcon = (call) => {
    const isOutgoing = call.direction === 'outgoing';
    
    switch (call.status) {
      case 'completed':
        return {
          name: isOutgoing ? 'call-outline' : 'call-outline',
          color: '#4CAF50'
        };
      case 'missed':
        return {
          name: 'call-outline',
          color: '#F44336'
        };
      case 'declined':
        return {
          name: 'call-outline',
          color: '#FF9800'
        };
      case 'initiated':
      default:
        return {
          name: isOutgoing ? 'call-outline' : 'call-outline',
          color: '#FF6B9D'
        };
    }
  };

  const renderCallItem = ({ item: call }) => {
    const isOutgoing = call.direction === 'outgoing';
    const contactData = isOutgoing ? call.callee : call.caller;
    const contactName = contactData?.fullName || contactData?.name || 'Unknown';
    const profileImageUrl = getProfileImageUrl(contactData);
    const statusIcon = getCallStatusIcon(call);

    return (
      <TouchableOpacity 
        style={styles.callItem} 
        onPress={() => handleCallBack(call)}
        activeOpacity={0.7}
      >
        <View style={styles.callItemLeft}>
          {/* Contact Avatar */}
          <View style={[
            styles.avatar,
            { backgroundColor: getAvatarColor(contactName) }
          ]}>
            {profileImageUrl ? (
              <Image
                source={{ uri: profileImageUrl }}
                style={styles.avatarImage}
                onError={(error) => {
                  console.log('Profile image error:', error?.nativeEvent?.error || 'Unknown error');
                }}
              />
            ) : (
              <Text style={styles.avatarText}>
                {getInitials(contactName)}
              </Text>
            )}
          </View>

          {/* Call Info */}
          <View style={styles.callInfo}>
            <Text style={styles.contactName}>{contactName}</Text>
            <View style={styles.callDetails}>
              <Ionicons 
                name={statusIcon.name} 
                size={12} 
                color={statusIcon.color} 
                style={styles.statusIcon}
              />
              <Text style={[styles.callMeta, { color: statusIcon.color }]}>
                {call.status === 'missed' ? 'Missed' : 
                 call.status === 'declined' ? 'Declined' :
                 call.status === 'completed' ? `${formatDuration(call.duration)}` :
                 'Attempted'}
              </Text>
              <Text style={styles.separator}>•</Text>
              <Text style={styles.callTime}>
                {formatDateTime(call.timestamp)}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.callItemRight}>
          {/* Call Type Icon */}
          <Ionicons 
            name={call.callType === 'video' ? 'videocam-outline' : 'call-outline'}
            size={20} 
            color="#FF6B9D" 
          />
          
          {/* Direction Indicator */}
          <Ionicons 
            name={isOutgoing ? 'arrow-up-outline' : 'arrow-down-outline'}
            size={16} 
            color={isOutgoing ? '#4CAF50' : '#2196F3'}
            style={styles.directionIcon}
          />
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="call-outline" size={64} color="#666" />
      <Text style={styles.emptyTitle}>No Call History</Text>
      <Text style={styles.emptySubtitle}>Your call history will appear here</Text>
    </View>
  );

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.headerContent}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back-outline" size={28} color="#FF6B9D" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Call History</Text>

        {callHistory.length > 0 && (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={handleClearHistory}
          >
            <Ionicons name="trash-outline" size={24} color="#F44336" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#1C1C1E" />
        {renderHeader()}
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF6B9D" />
          <Text style={styles.loadingText}>Loading call history...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1C1C1E" />
      
      {renderHeader()}
      
      <FlatList
        data={callHistory}
        keyExtractor={(item) => item.id || item.callId}
        renderItem={renderCallItem}
        style={styles.callList}
        contentContainerStyle={styles.callListContent}
        ListEmptyComponent={renderEmptyState}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#FF6B9D']}
            tintColor="#FF6B9D"
          />
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    backgroundColor: '#1C1C1E',
    borderBottomWidth: 1,
    borderBottomColor: '#2C2C2E',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
    marginRight: 40, // Balance the back button
  },
  clearButton: {
    padding: 8,
  },
  callList: {
    flex: 1,
  },
  callListContent: {
    paddingVertical: 8,
    flexGrow: 1,
  },
  callItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2C2C2E',
    backgroundColor: '#1C1C1E',
  },
  callItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 24,
  },
  avatarText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  callInfo: {
    flex: 1,
  },
  contactName: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  callDetails: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIcon: {
    marginRight: 4,
  },
  callMeta: {
    fontSize: 12,
    fontWeight: '500',
  },
  separator: {
    color: '#666',
    fontSize: 12,
    marginHorizontal: 6,
  },
  callTime: {
    color: '#666',
    fontSize: 12,
  },
  callItemRight: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  directionIcon: {
    marginTop: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#666',
    fontSize: 16,
    marginTop: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    color: '#999',
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
  },
});

export default CallHistoryScreen;