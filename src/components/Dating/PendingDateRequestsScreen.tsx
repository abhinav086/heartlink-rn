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

interface PendingRequest {
  _id: string;
  requester: {
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
  timeRemaining?: string;
  createdAt: string;
  dateTypeDisplay: string;
}

const PendingDateRequestsScreen: React.FC = () => {
  const navigation = useNavigation();
  const { token, user } = useAuth();
  
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [respondingTo, setRespondingTo] = useState<string | null>(null);

  const fetchPendingRequests = async (refresh = false) => {
    try {
      if (!refresh) setLoading(true);
      
      const response = await fetch(`${BASE_URL}/api/v1/dating/pending`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();
      
      if (response.ok && result.success) {
        setPendingRequests(result.data.requests);
      } else {
        Alert.alert('Error', result.message || 'Failed to fetch pending requests');
      }
    } catch (error) {
      console.error('Error fetching pending requests:', error);
      Alert.alert('Error', 'Failed to fetch pending requests');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchPendingRequests();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchPendingRequests(true);
  };

  const respondToRequest = async (requestId: string, action: 'accept' | 'reject') => {
    try {
      setRespondingTo(requestId);

      const response = await fetch(`${BASE_URL}/api/v1/dating/${requestId}/respond`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          action,
          responseMessage: '' // No message before payment
        }),
      });

      const result = await response.json();
      
      if (response.ok && result.success) {
        const successMessage = action === 'accept' 
          ? 'Date request accepted! 🎉\n\nThey will be notified and need to complete payment to confirm the date.'
          : 'Date request declined successfully.';
        
        Alert.alert('Success', successMessage);
        fetchPendingRequests();
      } else {
        Alert.alert('Error', result.message || `Failed to ${action} request`);
      }
    } catch (error) {
      console.error(`Error ${action}ing request:`, error);
      Alert.alert('Error', `Failed to ${action} request`);
    } finally {
      setRespondingTo(null);
    }
  };

  const handleQuickResponse = (request: PendingRequest, action: 'accept' | 'reject') => {
    const actionText = action === 'accept' ? 'accept' : 'decline';
    const emoji = action === 'accept' ? '💕' : '😔';
    
    const confirmMessage = action === 'accept'
      ? `${emoji} Accept the ${request.dateTypeDisplay || 'date'} with @${request.requester.username} for ${request.formattedBudget}?\n\nThey will need to complete payment to confirm the date.`
      : `${emoji} Decline the ${request.dateTypeDisplay || 'date'} with @${request.requester.username}?`;
    
    Alert.alert(
      action === 'accept' ? 'Accept Date Request' : 'Decline Date Request',
      confirmMessage,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: action === 'accept' ? 'Accept' : 'Decline',
          onPress: () => respondToRequest(request._id, action),
          style: action === 'accept' ? 'default' : 'destructive'
        }
      ]
    );
  };

  const handleViewDetails = (request: PendingRequest) => {
    navigation.navigate('DateRequestDetail', { 
      requestId: request._id,
      request: request
    });
  };

  const formatDate = (dateString: string) => {
    try {
      if (!dateString) return 'Date not specified';
      
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Invalid date';
      
      return date.toLocaleDateString('en-IN', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      console.error('Date formatting error:', error);
      return 'Date error';
    }
  };

  const getUrgencyLevel = (timeRemaining: string | undefined) => {
    if (!timeRemaining || timeRemaining === 'Expired') return 'expired';
    
    if (timeRemaining.includes('m') && !timeRemaining.includes('h')) {
      const minutes = parseInt(timeRemaining);
      if (!isNaN(minutes) && minutes < 60) return 'critical';
    }
    if (timeRemaining.includes('h')) {
      const hours = parseInt(timeRemaining);
      if (!isNaN(hours)) {
        if (hours < 3) return 'high';
        if (hours < 12) return 'medium';
      }
    }
    return 'low';
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'critical': return '#FF0000';
      case 'high': return '#FF6B35';
      case 'medium': return '#FFA500';
      case 'low': return '#4CAF50';
      case 'expired': return '#9E9E9E';
      default: return '#FFA500';
    }
  };

  const getDateIcon = (dateType: string) => {
    if (!dateType) return 'favorite';
    
    switch (dateType.toLowerCase()) {
      case 'coffee': return 'local-cafe';
      case 'movie': return 'movie';
      case 'shopping': return 'shopping-bag';
      case 'dinner': return 'restaurant';
      case 'lunch': return 'lunch-dining';
      case 'park_walk': return 'park';
      case 'beach': return 'beach-access';
      case 'adventure': return 'terrain';
      case 'party': return 'celebration';
      case 'cultural_event': return 'museum';
      case 'sports': return 'sports-tennis';
      default: return 'favorite';
    }
  };

  const renderPendingRequest = ({ item }: { item: PendingRequest }) => {
    const urgency = getUrgencyLevel(item.timeRemaining || '');
    const urgencyColor = getUrgencyColor(urgency);
    const isExpired = urgency === 'expired';
    const isResponding = respondingTo === item._id;

    return (
      <View style={[styles.requestCard, { borderLeftColor: urgencyColor }]}>
        {/* Urgency Indicator */}
        <View style={[styles.urgencyIndicator, { backgroundColor: urgencyColor }]}>
          <Text style={styles.urgencyText}>
            {urgency === 'critical' ? '🚨' : 
             urgency === 'high' ? '⚡' : 
             urgency === 'medium' ? '⏰' : 
             urgency === 'expired' ? '⏹️' : '🕐'}
          </Text>
        </View>

        {/* User Info */}
        <TouchableOpacity 
          style={styles.userSection}
          onPress={() => handleViewDetails(item)}
          disabled={isExpired}
        >
          <Image 
            source={{ uri: item.requester.photoUrl || 'https://via.placeholder.com/60' }} 
            style={styles.userPhoto} 
          />
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{item.requester.fullName}</Text>
            <Text style={styles.username}>@{item.requester.username}</Text>
            <View style={styles.dateTypeRow}>
              <Icon name={getDateIcon(item.dateType)} size={16} color="#ed167e" />
              <Text style={styles.dateTypeText}>{item.dateTypeDisplay || 'Date'}</Text>
            </View>
          </View>
          <View style={styles.budgetContainer}>
            <Text style={styles.budgetText}>{item.formattedBudget || `₹${item.budget}`}</Text>
            <Text style={styles.budgetLabel}>Offering</Text>
          </View>
        </TouchableOpacity>

        {/* Request Details */}
        <View style={styles.requestDetails}>
          {/* Amount Highlight */}
          <View style={styles.amountHighlight}>
            <LinearGradient
              colors={['#4CAF50', '#45a049']}
              style={styles.amountGradient}
            >
              <Icon name="account-balance-wallet" size={20} color="#fff" />
              <Text style={styles.amountText}>
                {item.formattedBudget || `₹${item.budget?.toLocaleString('en-IN') || '0'}`}
              </Text>
              <Text style={styles.amountLabel}>they're offering</Text>
            </LinearGradient>
          </View>
          
          <View style={styles.detailRow}>
            <Icon name="calendar-today" size={14} color="#666" />
            <Text style={styles.detailText}>{formatDate(item.preferredDate)}</Text>
          </View>
          <View style={styles.detailRow}>
            <Icon name="location-on" size={14} color="#666" />
            <Text style={styles.detailText}>
              {item.location.city}{item.location.area && `, ${item.location.area}`}
            </Text>
          </View>
          {item.message && (
            <View style={styles.messageContainer}>
              <Text style={styles.messageText} numberOfLines={2}>
                💌 "{item.message}"
              </Text>
            </View>
          )}
        </View>

        {/* Time Remaining */}
        <View style={styles.timeSection}>
          <Text style={[styles.timeRemaining, { color: urgencyColor }]}>
            {item.timeRemaining || 'No time limit'}
          </Text>
        </View>

        {/* Action Buttons */}
        {!isExpired && (
          <>
            <View style={styles.actionButtons}>
              <TouchableOpacity 
                style={[styles.actionButton, styles.declineButton]}
                onPress={() => handleQuickResponse(item, 'reject')}
                disabled={isResponding}
              >
                {isResponding ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Icon name="close" size={18} color="#fff" />
                    <Text style={styles.actionButtonText}>Decline</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.actionButton, styles.acceptButton]}
                onPress={() => handleQuickResponse(item, 'accept')}
                disabled={isResponding}
              >
                <LinearGradient
                  colors={['#4CAF50', '#45a049']}
                  style={styles.acceptButtonGradient}
                >
                  {isResponding ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Icon name="favorite" size={18} color="#fff" />
                      <Text style={styles.acceptButtonText}>
                        Accept {item.formattedBudget || `₹${item.budget?.toLocaleString('en-IN') || '0'}`}
                      </Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.actionButton, styles.detailsButton]}
                onPress={() => handleViewDetails(item)}
              >
                <Icon name="visibility" size={18} color="#fff" />
                <Text style={styles.actionButtonText}>View</Text>
              </TouchableOpacity>
            </View>

            {/* Payment Note */}
            <View style={styles.paymentNote}>
              <Icon name="info" size={14} color="#2196F3" />
              <Text style={styles.paymentNoteText}>
                If accepted, they'll pay to confirm the date
              </Text>
            </View>
          </>
        )}

        {/* Expired Notice */}
        {isExpired && (
          <View style={styles.expiredNotice}>
            <Icon name="schedule" size={16} color="#9E9E9E" />
            <Text style={styles.expiredText}>This request has expired</Text>
          </View>
        )}
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <LinearGradient
        colors={['#ed167e', '#FF69B4']}
        style={styles.emptyIconContainer}
      >
        <Icon name="notifications-none" size={60} color="#fff" />
      </LinearGradient>
      <Text style={styles.emptyTitle}>No Pending Requests</Text>
      <Text style={styles.emptyDescription}>
        You're all caught up! No date requests need your attention right now.
      </Text>
    </View>
  );

  const renderHeader = () => (
    <View style={styles.headerInfo}>
      <Text style={styles.headerInfoText}>
        💕 People want to take you on dates!
      </Text>
      <Text style={styles.headerSubText}>
        Accept requests you're interested in - they'll pay to confirm
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
        <Text style={styles.headerTitle}>Pending Requests</Text>
        <View style={styles.requestCount}>
          <Text style={styles.requestCountText}>{pendingRequests.length}</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#ed167e" />
          <Text style={styles.loadingText}>Loading pending requests...</Text>
        </View>
      ) : (
        <FlatList
          data={pendingRequests}
          renderItem={renderPendingRequest}
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
          ListHeaderComponent={pendingRequests.length > 0 ? renderHeader : null}
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
  requestCount: {
    backgroundColor: '#ed167e',
    borderRadius: 15,
    minWidth: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  requestCountText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  headerInfo: {
    backgroundColor: '#1a1a1a',
    padding: 16,
    marginHorizontal: 20,
    marginVertical: 10,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#ed167e',
  },
  headerInfoText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  headerSubText: {
    color: '#999',
    fontSize: 14,
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
    borderLeftWidth: 4,
    position: 'relative',
  },
  urgencyIndicator: {
    position: 'absolute',
    top: 16,
    right: 16,
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  urgencyText: {
    fontSize: 16,
  },
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    marginRight: 40,
  },
  userPhoto: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 12,
    borderWidth: 2,
    borderColor: '#ed167e',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  username: {
    fontSize: 14,
    color: '#999',
    marginBottom: 4,
  },
  dateTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateTypeText: {
    fontSize: 14,
    color: '#ed167e',
    fontWeight: '500',
  },
  budgetContainer: {
    alignItems: 'flex-end',
  },
  budgetText: {
    fontSize: 18,
    color: '#4CAF50',
    fontWeight: '700',
  },
  budgetLabel: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  requestDetails: {
    marginBottom: 12,
  },
  amountHighlight: {
    borderRadius: 8,
    marginBottom: 12,
    overflow: 'hidden',
  },
  amountGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  amountText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '700',
  },
  amountLabel: {
    fontSize: 12,
    color: '#fff',
    opacity: 0.9,
    flex: 1,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#ccc',
  },
  messageContainer: {
    marginTop: 8,
    padding: 12,
    backgroundColor: '#2e2e2e',
    borderRadius: 8,
  },
  messageText: {
    fontSize: 14,
    color: '#fff',
    fontStyle: 'italic',
  },
  timeSection: {
    alignItems: 'center',
    marginBottom: 16,
  },
  timeRemaining: {
    fontSize: 14,
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    gap: 4,
    minHeight: 44,
  },
  declineButton: {
    backgroundColor: '#F44336',
    flex: 1,
  },
  acceptButton: {
    flex: 2,
    borderRadius: 8,
    overflow: 'hidden',
  },
  acceptButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 4,
    flex: 1,
  },
  detailsButton: {
    backgroundColor: '#2196F3',
    flex: 1,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  acceptButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  paymentNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1e2a3a',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    gap: 6,
  },
  paymentNoteText: {
    color: '#2196F3',
    fontSize: 12,
    fontWeight: '500',
  },
  expiredNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
  },
  expiredText: {
    color: '#9E9E9E',
    fontSize: 14,
    fontWeight: '500',
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
    paddingVertical: 80,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 10,
  },
  emptyDescription: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});

export default PendingDateRequestsScreen;