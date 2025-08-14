import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  FlatList,
  RefreshControl,
  Alert,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from 'react-native-linear-gradient';
import { useAuth } from '../../context/AuthContext';
import BASE_URL from '../../config/config';

interface DateRequest {
  _id: string;
  requester: {
    _id: string;
    fullName: string;
    username: string;
    photoUrl: string;
    bio: string;
  };
  recipient: {
    _id: string;
    fullName: string;
    username: string;
    photoUrl: string;
    bio: string;
  };
  dateType: string;
  customDateType?: string;
  budget: number;
  formattedBudget: string;
  message: string;
  preferredDate: string;
  location: {
    city: string;
    area: string;
    landmark: string;
  };
  status: 'pending' | 'accepted' | 'rejected' | 'paid' | 'completed' | 'cancelled' | 'expired' | 'refunded';
  timeRemaining?: string;
  createdAt: string;
  isRequester: boolean;
  otherUser: any;
  dateTypeDisplay: string;
  response?: {
    responseMessage: string;
    respondedAt: string;
  };
}

const DateRequestsScreen: React.FC = () => {
  const navigation = useNavigation();
  const { token, user } = useAuth();
  
  const [activeTab, setActiveTab] = useState<'received' | 'sent'>('received');
  const [dateRequests, setDateRequests] = useState<DateRequest[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [stats, setStats] = useState<any>(null);

  const fetchDateRequests = async (type: string, refresh = false) => {
    try {
      if (!refresh) setLoading(true);
      
      const response = await fetch(`${BASE_URL}/api/v1/dating/?type=${type}&page=1&limit=50`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();
      
      if (response.ok && result.success) {
        setDateRequests(result.data.requests);
      } else {
        Alert.alert('Error', result.message || 'Failed to fetch date requests');
      }
    } catch (error) {
      console.error('Error fetching date requests:', error);
      Alert.alert('Error', 'Failed to fetch date requests');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch(`${BASE_URL}/api/v1/dating/stats`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();
      
      if (response.ok && result.success) {
        setStats(result.data.stats);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchDateRequests(activeTab);
      fetchStats();
    }, [activeTab])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchDateRequests(activeTab, true);
    fetchStats();
  };

  const handleTabChange = (tab: 'received' | 'sent') => {
    setActiveTab(tab);
    fetchDateRequests(tab);
  };

  const handleRequestPress = (request: DateRequest) => {
    // FIXED: Add safety checks before navigation
    if (!request || !request._id) {
      Alert.alert('Error', 'Invalid request data');
      return;
    }
    
    // Determine navigation based on user role and request status
    const isRequester = user._id === request.requester._id;
    const isRecipient = user._id === request.recipient._id;
    
    if (isRecipient && request.status === 'pending') {
      // Recipient seeing pending request - show detail screen for accept/reject
      navigation.navigate('DateRequestDetail', { 
        requestId: request._id,
        request: request
      });
    } else if (isRequester && request.status === 'accepted') {
      // Requester seeing accepted request - show payment screen
      navigation.navigate('PaymentScreen', { 
        requestId: request._id,
        request: request
      });
    } else {
      // All other cases - show status screen
      navigation.navigate('DateRequestStatus', { 
        requestId: request._id,
        request: request
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#FFA500';
      case 'accepted': return '#4CAF50';
      case 'rejected': return '#F44336';
      case 'paid': return '#2196F3';
      case 'completed': return '#8BC34A';
      case 'cancelled': return '#9E9E9E';
      case 'expired': return '#795548';
      case 'refunded': return '#FF9800';
      default: return '#9E9E9E';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return 'hourglass-empty';
      case 'accepted': return 'check-circle';
      case 'rejected': return 'cancel';
      case 'paid': return 'payment';
      case 'completed': return 'verified';
      case 'cancelled': return 'close';
      case 'expired': return 'schedule';
      case 'refunded': return 'money-off';
      default: return 'help';
    }
  };

  const getDateEmoji = (dateType: string): string => {
    switch (dateType) {
      case 'dinner': return '🍽️';
      case 'lunch': return '🥗';
      case 'coffee': return '☕';
      case 'movie': return '🎬';
      case 'park_walk': return '🌳';
      case 'beach': return '🏖️';
      case 'adventure': return '⛰️';
      case 'shopping': return '🛍️';
      case 'party': return '🎉';
      case 'cultural_event': return '🎨';
      case 'sports': return '⚽';
      default: return '💕';
    }
  };

  const formatDate = (dateString: string) => {
    try {
      if (!dateString) return 'Unknown date';
      
      const date = new Date(dateString);
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        return 'Invalid date';
      }
      
      return date.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Unknown date';
    }
  };

  const getActionLabel = (request: DateRequest) => {
    if (!request || !user) {
      return 'Unknown';
    }
    
    const isRequester = user._id === request.requester?._id;
    
    if (isRequester) {
      // For requests sent by current user
      switch (request.status) {
        case 'pending': return 'Waiting for response...';
        case 'accepted': return 'PAY NOW';
        case 'paid': return 'Date confirmed';
        case 'completed': return 'Completed';
        case 'rejected': return 'Declined';
        case 'cancelled': return 'Cancelled';
        case 'expired': return 'Expired';
        case 'refunded': return 'Refunded';
        default: return request.status || 'Unknown';
      }
    } else {
      // For requests received by current user
      switch (request.status) {
        case 'pending': return 'RESPOND';
        case 'accepted': return 'Waiting for payment...';
        case 'paid': return 'Date confirmed';
        case 'completed': return 'Completed';
        case 'rejected': return 'You declined';
        case 'cancelled': return 'Cancelled';
        case 'expired': return 'Expired';
        case 'refunded': return 'Refunded';
        default: return request.status || 'Unknown';
      }
    }
  };

  const renderDateRequest = ({ item }: { item: DateRequest }) => {
    // Safety check for item data
    if (!item || !item._id) {
      return null;
    }
    
    const otherUser = activeTab === 'received' ? item.requester : item.recipient;
    
    // Safety check for other user data
    if (!otherUser) {
      return null;
    }
    
    const isUrgent = item.status === 'pending' && item.timeRemaining && !item.timeRemaining.includes('Expired');
    const isRequester = user._id === item.requester?._id;
    const actionLabel = getActionLabel(item);
    
    // Determine if this needs immediate action
    const needsPayment = isRequester && item.status === 'accepted';
    const needsResponse = !isRequester && item.status === 'pending';

    return (
      <TouchableOpacity 
        style={[
          styles.requestCard, 
          isUrgent && styles.urgentCard,
          needsPayment && styles.paymentNeededCard
        ]} 
        onPress={() => handleRequestPress(item)}
      >
        <View style={styles.userInfo}>
          <Image 
            source={{ uri: otherUser.photoUrl || 'https://via.placeholder.com/50' }} 
            style={styles.userPhoto} 
          />
          <View style={styles.userDetails}>
            <Text style={styles.userName}>{otherUser.fullName || 'Unknown User'}</Text>
            <Text style={styles.username}>@{otherUser.username || 'unknown'}</Text>
            <View style={styles.dateInfo}>
              <Icon name="favorite" size={14} color="#ed167e" />
              <Text style={styles.dateType}>{item.dateTypeDisplay || item.dateType || 'Date'}</Text>
              <Text style={styles.budget}>{item.formattedBudget || `₹${item.budget || 0}`}</Text>
            </View>
          </View>
        </View>

        <View style={styles.requestDetails}>
          <View style={styles.locationInfo}>
            <Icon name="location-on" size={14} color="#666" />
            <Text style={styles.locationText}>
              {item.location?.city || 'Unknown location'}{item.location?.area && `, ${item.location.area}`}
            </Text>
          </View>
          
          <View style={styles.dateTimeInfo}>
            <Icon name="calendar-today" size={14} color="#666" />
            <Text style={styles.dateTimeText}>
              {formatDate(item.preferredDate)}
            </Text>
          </View>

          {item.message && (
            <View style={styles.customMessageContainer}>
              <Text style={styles.customMessageLabel}>Additional message:</Text>
              <Text style={styles.messageText} numberOfLines={2}>
                "{item.message}"
              </Text>
            </View>
          )}
        </View>

        <View style={styles.statusSection}>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
            <Icon name={getStatusIcon(item.status)} size={14} color="#fff" />
            <Text style={styles.statusText}>{item.status.toUpperCase()}</Text>
          </View>
          
          {item.timeRemaining && item.status === 'pending' && (
            <Text style={[styles.timeRemaining, isUrgent && styles.urgentTime]}>
              {item.timeRemaining}
            </Text>
          )}
        </View>

        <View style={styles.requestMeta}>
          <Text style={styles.requestTime}>{formatDate(item.createdAt)}</Text>
          
          {/* Action Button */}
          <View style={styles.actionContainer}>
            {needsPayment && (
              <TouchableOpacity 
                style={styles.payNowButton}
                onPress={() => handleRequestPress(item)}
              >
                <LinearGradient
                  colors={['#4CAF50', '#45a049']}
                  style={styles.payNowGradient}
                >
                  <Icon name="payment" size={16} color="#fff" />
                  <Text style={styles.payNowText}>PAY NOW</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
            
            {needsResponse && (
              <View style={styles.actionButtons}>
                <TouchableOpacity 
                  style={styles.quickRejectBtn}
                  onPress={() => handleQuickReject(item)}
                >
                  <Icon name="close" size={16} color="#F44336" />
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.quickAcceptBtn}
                  onPress={() => handleQuickAccept(item)}
                >
                  <Icon name="check" size={16} color="#4CAF50" />
                </TouchableOpacity>
              </View>
            )}
            
            {!needsPayment && !needsResponse && (
              <Text style={[
                styles.actionLabel,
                needsPayment && styles.paymentNeededLabel,
                needsResponse && styles.responseNeededLabel
              ]}>
                {actionLabel}
              </Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const handleQuickAccept = (request: DateRequest) => {
    if (!request || !request._id || !request.requester) {
      Alert.alert('Error', 'Invalid request data');
      return;
    }
    
    Alert.alert(
      'Accept Date Request',
      `Accept the ${request.dateTypeDisplay?.toLowerCase() || 'date'} with @${request.requester.username}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Accept', 
          onPress: () => respondToRequest(request._id, 'accept'),
          style: 'default'
        }
      ]
    );
  };

  const handleQuickReject = (request: DateRequest) => {
    if (!request || !request._id || !request.requester) {
      Alert.alert('Error', 'Invalid request data');
      return;
    }
    
    Alert.alert(
      'Reject Date Request',
      `Reject the ${request.dateTypeDisplay?.toLowerCase() || 'date'} with @${request.requester.username}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Reject', 
          onPress: () => respondToRequest(request._id, 'reject'),
          style: 'destructive'
        }
      ]
    );
  };

  const generateResponseMessage = (dateType: string, action: 'accept' | 'reject') => {
    if (action === 'accept') {
      const dateEmoji = getDateEmoji(dateType);
      const dateTypeName = dateType?.toLowerCase() || 'date';
      
      return `Hii! 👋\n\nI'd love to go on this ${dateTypeName} with you! ${dateEmoji}\n\nLooking forward to it! 💕`;
    } else {
      return `Hi! 👋\n\nThank you for the invitation, but I won't be able to make it this time. 😔\n\nWishing you the best! 🌟`;
    }
  };

  const respondToRequest = async (requestId: string, action: 'accept' | 'reject') => {
    try {
      // Find the request to get date type for response message
      const request = dateRequests.find(req => req._id === requestId);
      const responseMessage = request ? generateResponseMessage(request.dateType, action) : '';

      const response = await fetch(`${BASE_URL}/api/v1/dating/${requestId}/respond`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          action,
          responseMessage
        }),
      });

      const result = await response.json();
      
      if (response.ok && result.success) {
        Alert.alert('Success', `Date request ${action}ed successfully`);
        fetchDateRequests(activeTab);
        fetchStats();
      } else {
        Alert.alert('Error', result.message || `Failed to ${action} request`);
      }
    } catch (error) {
      console.error(`Error ${action}ing request:`, error);
      Alert.alert('Error', `Failed to ${action} request`);
    }
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Icon name="favorite-border" size={80} color="#333" />
      <Text style={styles.emptyTitle}>
        {activeTab === 'received' ? 'No Date Requests' : 'No Sent Requests'}
      </Text>
      <Text style={styles.emptyDescription}>
        {activeTab === 'received' 
          ? 'You haven\'t received any date requests yet' 
          : 'You haven\'t sent any date requests yet'
        }
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0a" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Date Requests</Text>
        <TouchableOpacity 
          onPress={() => navigation.navigate('PendingDateRequests')}
          style={styles.notificationButton}
        >
          <Icon name="notifications" size={24} color="#fff" />
          {stats && stats.pending > 0 && (
            <View style={styles.notificationBadge}>
              <Text style={styles.notificationCount}>{stats.pending}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'received' && styles.activeTab]}
          onPress={() => handleTabChange('received')}
        >
          <Text style={[styles.tabText, activeTab === 'received' && styles.activeTabText]}>
            Received
          </Text>
          {stats && stats.pending > 0 && activeTab !== 'received' && (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>{stats.pending}</Text>
            </View>
          )}
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tab, activeTab === 'sent' && styles.activeTab]}
          onPress={() => handleTabChange('sent')}
        >
          <Text style={[styles.tabText, activeTab === 'sent' && styles.activeTabText]}>
            Sent
          </Text>
        </TouchableOpacity>
      </View>

      {/* Date Requests List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#ed167e" />
          <Text style={styles.loadingText}>Loading date requests...</Text>
        </View>
      ) : (
        <FlatList
          data={dateRequests}
          renderItem={renderDateRequest}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#ed167e']}
              tintColor="#ed167e"
            />
          }
          ListEmptyComponent={renderEmptyState}
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
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#2e2e2e',
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  notificationButton: {
    padding: 5,
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#ed167e',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationCount: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    marginHorizontal: 20,
    marginBottom: 16,
    marginTop : 20 ,
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  activeTab: {
    backgroundColor: '#ed167e',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#999',
  },
  activeTabText: {
    color: '#fff',
  },
  tabBadge: {
    backgroundColor: '#ed167e',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  tabBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  requestCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  urgentCard: {
    borderColor: '#ed167e',
    borderWidth: 2,
  },
  paymentNeededCard: {
    borderColor: '#4CAF50',
    borderWidth: 2,
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  // Message Section Styles
  messageSection: {
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#ed167e',
  },
  senderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  senderAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 8,
  },
  senderInfo: {
    flex: 1,
  },
  senderName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  messageTime: {
    fontSize: 11,
    color: '#666',
  },
  messageContent: {
    marginLeft: 38,
  },
  greetingText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  requestMessageText: {
    fontSize: 14,
    color: '#ccc',
    lineHeight: 18,
    marginBottom: 4,
  },
  recipientMention: {
    fontSize: 13,
    color: '#ed167e',
    fontWeight: '600',
  },
  // Response Message Styles
  responseMessageSection: {
    backgroundColor: '#0d2818',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#4CAF50',
  },
  rejectedMessageSection: {
    backgroundColor: '#2a0d0d',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#F44336',
  },
  responseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  responseAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 8,
  },
  responseInfo: {
    flex: 1,
  },
  responseName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  responseTime: {
    fontSize: 11,
    color: '#666',
  },
  acceptedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  acceptedText: {
    fontSize: 10,
    color: '#4CAF50',
    fontWeight: '600',
  },
  rejectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(244, 67, 54, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  rejectedText: {
    fontSize: 10,
    color: '#F44336',
    fontWeight: '600',
  },
  responseContent: {
    marginLeft: 38,
  },
  responseMessageText: {
    fontSize: 14,
    color: '#ccc',
    lineHeight: 18,
  },
  paymentReminder: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 8,
  },
  paymentReminderText: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '600',
    flex: 1,
  },
  paymentConfirmation: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 8,
  },
  paymentConfirmationText: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '700',
    flex: 1,
  },
  // Existing styles
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  userPhoto: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  username: {
    fontSize: 14,
    color: '#999',
    marginTop: 2,
  },
  dateInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 8,
  },
  dateType: {
    fontSize: 14,
    color: '#ed167e',
    fontWeight: '500',
  },
  budget: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '600',
  },
  requestDetails: {
    marginBottom: 12,
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  locationText: {
    fontSize: 14,
    color: '#ccc',
    marginLeft: 6,
  },
  dateTimeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  dateTimeText: {
    fontSize: 14,
    color: '#ccc',
    marginLeft: 6,
  },
  customMessageContainer: {
    marginTop: 8,
    backgroundColor: '#222',
    borderRadius: 8,
    padding: 10,
  },
  customMessageLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 14,
    color: '#aaa',
    fontStyle: 'italic',
  },
  statusSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  statusText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
  },
  timeRemaining: {
    fontSize: 12,
    color: '#FFA500',
    fontWeight: '500',
  },
  urgentTime: {
    color: '#ed167e',
    fontWeight: '600',
  },
  requestMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  requestTime: {
    fontSize: 12,
    color: '#666',
  },
  actionContainer: {
    alignItems: 'flex-end',
  },
  actionLabel: {
    fontSize: 12,
    color: '#999',
    fontWeight: '500',
  },
  paymentNeededLabel: {
    color: '#4CAF50',
    fontWeight: '700',
  },
  responseNeededLabel: {
    color: '#ed167e',
    fontWeight: '700',
  },
  payNowButton: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  payNowGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 6,
  },
  payNowText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  quickRejectBtn: {
    backgroundColor: '#2e2e2e',
    borderRadius: 20,
    padding: 8,
    borderWidth: 1,
    borderColor: '#F44336',
  },
  quickAcceptBtn: {
    backgroundColor: '#2e2e2e',
    borderRadius: 20,
    padding: 8,
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#999',
    marginTop: 10,
    fontSize: 16,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#fff',
    marginTop: 20,
    marginBottom: 10,
  },
  emptyDescription: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});

export default DateRequestsScreen;