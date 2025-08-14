import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from 'react-native-linear-gradient';
import { useAuth } from '../../context/AuthContext';
import BASE_URL from '../../config/config';

interface RouteParams {
  requestId: string;
  request: any;
}

const DateRequestDetailScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  
  // Fix: Add safety check for route.params
  const params = route.params as RouteParams | undefined;
  
  if (!params || !params.requestId) {
    // Handle missing params by going back
    React.useEffect(() => {
      Alert.alert('Error', 'Request details not found', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    }, []);
    
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#0a0a0a" />
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }
  
  const { requestId, request: initialRequest } = params;
  const { token, user } = useAuth();

  const [request, setRequest] = useState(initialRequest);
  const [isResponding, setIsResponding] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!initialRequest) {
      fetchRequestDetails();
    }
  }, []);
  
  // Additional safety check for request data
  useEffect(() => {
    if (!request && !loading) {
      Alert.alert('Error', 'Request data not available', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    }
  }, [request, loading]);

  const fetchRequestDetails = async () => {
    try {
      setLoading(true);
      // Note: You might want to add a specific endpoint to get single request details
      // For now, we'll use the existing request data
    } catch (error) {
      console.error('Error fetching request details:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDateEmoji = (dateType: string): string => {
    switch (dateType?.toLowerCase()) {
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

  const generateResponseMessage = (action: 'accept' | 'reject') => {
    if (action === 'accept') {
      const dateEmoji = getDateEmoji(request?.dateType || '');
      const dateType = request?.dateTypeDisplay?.toLowerCase() || request?.dateType?.toLowerCase() || 'date';
      
      return `Hii! 👋\n\nI'd love to go on this ${dateType} with you! ${dateEmoji}\n\nLooking forward to it! 💕`;
    } else {
      return `Hi! 👋\n\nThank you for the invitation, but I won't be able to make it this time. 😔\n\nWishing you the best! 🌟`;
    }
  };

  const handleResponse = async (action: 'accept' | 'reject') => {
    if (isResponding || !request) return;

    const actionEmoji = action === 'accept' ? '💕' : '😔';
    const confirmMessage = action === 'accept' 
      ? `${actionEmoji} Accept this ${request?.dateTypeDisplay?.toLowerCase() || 'date'} with @${request?.requester?.username || 'user'} for ${request?.formattedBudget || 'the offered amount'}?\n\nThey will need to complete payment to confirm the date.`
      : `${actionEmoji} Decline this ${request?.dateTypeDisplay?.toLowerCase() || 'date'} with @${request?.requester?.username || 'user'}?`;

    Alert.alert(
      action === 'accept' ? 'Accept Date Request' : 'Decline Date Request',
      confirmMessage,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: action === 'accept' ? 'Accept' : 'Decline',
          onPress: () => submitResponse(action),
          style: action === 'accept' ? 'default' : 'destructive'
        }
      ]
    );
  };

  const submitResponse = async (action: 'accept' | 'reject') => {
    try {
      setIsResponding(true);

      // Generate the response message with "Hii" greeting
      const responseMessage = generateResponseMessage(action);

      const response = await fetch(`${BASE_URL}/api/v1/dating/${requestId}/respond`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          action,
          responseMessage: responseMessage // Send the "Hii" message with response
        }),
      });

      const result = await response.json();
      
      if (response.ok && result.success) {
        const successMessage = action === 'accept' 
          ? `Date request accepted! 🎉\n\n@${request?.requester?.username || 'They'} will be notified and needs to complete payment to confirm the date.\n\nYour response has been sent along with the acceptance.`
          : 'Date request declined successfully.\n\nYour polite response has been sent.';

        Alert.alert(
          'Success',
          successMessage,
          [{ 
            text: 'OK', 
            onPress: () => navigation.goBack()
          }]
        );
      } else {
        Alert.alert('Error', result.message || `Failed to ${action} request`);
      }
    } catch (error) {
      console.error(`Error ${action}ing request:`, error);
      Alert.alert('Error', `Failed to ${action} request`);
    } finally {
      setIsResponding(false);
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
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Unknown date';
    }
  };

  const getDateIcon = (dateType: string) => {
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

  const isExpired = request?.timeRemaining === 'Expired' || (request?.expiresAt && new Date() > new Date(request.expiresAt));
  const canRespond = request?.status === 'pending' && !isExpired;
  
  // FIXED: Determine if current user is the requester or recipient with safety checks
  const isRequester = user?._id && request?.requester?._id && user._id === request.requester._id;
  const isRecipient = user?._id && request?.recipient?._id && user._id === request.recipient._id;
  
  // Show contact info only if payment is completed and user is the requester
  const showContactInfo = isRequester && (request?.status === 'paid' || request?.status === 'completed');

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#0a0a0a" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#ed167e" />
          <Text style={styles.loadingText}>Loading request details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Additional safety check - if no request data is available
  if (!request) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#0a0a0a" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#ed167e" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0a" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Date Request</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* User Profile Section */}
        <View style={styles.profileSection}>
          <Image 
            source={{ uri: request?.requester?.photoUrl || 'https://via.placeholder.com/100' }} 
            style={styles.profilePhoto} 
          />
          <Text style={styles.profileName}>{request?.requester?.fullName || 'Unknown User'}</Text>
          <Text style={styles.profileUsername}>@{request?.requester?.username || 'unknown'}</Text>
          {request?.requester?.bio && (
            <Text style={styles.profileBio}>{request.requester.bio}</Text>
          )}
        </View>

        {/* Date Details Card */}
        <View style={styles.dateCard}>
          <LinearGradient
            colors={['#ed167e', '#FF69B4']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.dateCardGradient}
          >
            <View style={styles.dateCardContent}>
              <Icon name={getDateIcon(request?.dateType || '')} size={40} color="#fff" />
              <Text style={styles.dateTypeTitle}>{request?.dateTypeDisplay || request?.dateType || 'Date'}</Text>
              <Text style={styles.budgetText}>{request?.formattedBudget || `₹${request?.budget || 0}`}</Text>
              <Text style={styles.budgetLabel}>Budget Offered</Text>
            </View>
          </LinearGradient>
        </View>

        {/* Contact Information - Show after payment for requester */}
        {showContactInfo && request?.recipient?.phoneNumber && (
          <View style={styles.contactCard}>
            <LinearGradient
              colors={['#4CAF50', '#45a049']}
              style={styles.contactGradient}
            >
              <Icon name="phone" size={40} color="#fff" />
              <Text style={styles.contactTitle}>📞 Contact Details</Text>
              <Text style={styles.contactSubtitle}>
                You can now contact {request.recipient.fullName || 'them'}
              </Text>
              
              <View style={styles.phoneNumberContainer}>
                <Icon name="phone" size={20} color="#fff" />
                <Text style={styles.phoneNumber}>{request.recipient.phoneNumber}</Text>
              </View>
              
              <Text style={styles.contactNote}>
                Plan your date and have a wonderful time! 💕
              </Text>
            </LinearGradient>
          </View>
        )}

        {/* Response Preview Card - Show what message will be sent */}
        {isRecipient && canRespond && (
          <View style={styles.responsePreviewCard}>
            <View style={styles.responsePreviewHeader}>
              <Icon name="preview" size={20} color="#ed167e" />
              <Text style={styles.responsePreviewTitle}>Your Response Preview</Text>
            </View>
            
            <View style={styles.responseMessageContainer}>
              <View style={styles.responseAcceptPreview}>
                <Text style={styles.responseActionLabel}>If you Accept:</Text>
                <View style={styles.messagePreview}>
                  <Text style={styles.previewMessageText}>
                    {generateResponseMessage('accept')}
                  </Text>
                </View>
              </View>
              
              <View style={styles.responseRejectPreview}>
                <Text style={styles.responseActionLabel}>If you Decline:</Text>
                <View style={styles.messagePreview}>
                  <Text style={styles.previewMessageText}>
                    {generateResponseMessage('reject')}
                  </Text>
                </View>
              </View>
            </View>
            
            <Text style={styles.responseNote}>
              Your response will be sent along with your decision 💌
            </Text>
          </View>
        )}

        {/* Request Details */}
        <View style={styles.detailsContainer}>
          {/* Date & Time */}
          <View style={styles.detailItem}>
            <View style={styles.detailIcon}>
              <Icon name="calendar-today" size={20} color="#ed167e" />
            </View>
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Preferred Date & Time</Text>
              <Text style={styles.detailValue}>{formatDate(request?.preferredDate || '')}</Text>
            </View>
          </View>

          {/* Location */}
          <View style={styles.detailItem}>
            <View style={styles.detailIcon}>
              <Icon name="location-on" size={20} color="#ed167e" />
            </View>
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Location</Text>
              <Text style={styles.detailValue}>
                {request?.location?.city || 'Unknown location'}
                {request?.location?.area && `, ${request.location.area}`}
                {request?.location?.landmark && `\n📍 ${request.location.landmark}`}
              </Text>
            </View>
          </View>

          {/* Message */}
          {request?.message && (
            <View style={styles.detailItem}>
              <View style={styles.detailIcon}>
                <Icon name="message" size={20} color="#ed167e" />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Personal Message</Text>
                <Text style={styles.messageText}>"{request.message}"</Text>
              </View>
            </View>
          )}

          {/* Status & Time */}
          <View style={styles.detailItem}>
            <View style={styles.detailIcon}>
              <Icon name="info" size={20} color="#ed167e" />
            </View>
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Status</Text>
              <View style={styles.statusInfo}>
                <Text style={[styles.statusText, { color: isExpired ? '#F44336' : getStatusColor(request?.status || 'unknown') }]}>
                  {isExpired ? 'EXPIRED' : (request?.status || 'UNKNOWN').toUpperCase()}
                </Text>
                {request?.timeRemaining && !isExpired && (
                  <Text style={styles.timeRemainingText}>
                    {request.timeRemaining}
                  </Text>
                )}
              </View>
            </View>
          </View>
        </View>

        {/* Payment Info Notice - FIXED: Only show to recipient when explaining what happens after accept */}
        {isRecipient && canRespond && (
          <View style={styles.paymentInfoCard}>
            <Icon name="info" size={24} color="#2196F3" />
            <View style={styles.paymentInfoContent}>
              <Text style={styles.paymentInfoTitle}>About Payment</Text>
              <Text style={styles.paymentInfoText}>
                If you accept, they'll need to complete payment to confirm the date. 
                You'll receive the money after you both confirm the date completion.
              </Text>
            </View>
          </View>
        )}

        {/* Waiting for Payment Notice - Show to recipient after accepting */}
        {isRecipient && request?.status === 'accepted' && (
          <View style={styles.waitingPaymentCard}>
            <Icon name="hourglass-empty" size={24} color="#FFA500" />
            <View style={styles.waitingPaymentContent}>
              <Text style={styles.waitingPaymentTitle}>Waiting for Payment ⏳</Text>
              <Text style={styles.waitingPaymentText}>
                You accepted the request! Now waiting for {request?.requester?.fullName || 'them'} to complete payment.
                You'll be notified once the payment is confirmed.
              </Text>
            </View>
          </View>
        )}

        {/* Payment Completed Notice - Show to recipient after payment */}
        {isRecipient && (request?.status === 'paid' || request?.status === 'completed') && (
          <View style={styles.paidNoticeCard}>
            <Icon name="check-circle" size={24} color="#4CAF50" />
            <View style={styles.paidNoticeContent}>
              <Text style={styles.paidNoticeTitle}>Payment Completed! 🎉</Text>
              <Text style={styles.paidNoticeText}>
                {request?.requester?.fullName || 'They'} has completed the payment. Your date is confirmed!
                Enjoy your time together and don't forget to confirm completion afterward.
              </Text>
            </View>
          </View>
        )}

        {/* Action Buttons - FIXED: Only show Accept/Reject to recipient */}
        {isRecipient && canRespond && (
          <View style={styles.actionContainer}>
            <TouchableOpacity 
              style={[styles.actionButton, styles.rejectButton]}
              onPress={() => handleResponse('reject')}
              disabled={isResponding}
            >
              {isResponding ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Icon name="close" size={24} color="#fff" />
                  <Text style={styles.actionButtonText}>Decline</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.actionButton, styles.acceptButton]}
              onPress={() => handleResponse('accept')}
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
                    <Icon name="favorite" size={24} color="#fff" />
                    <Text style={styles.acceptButtonText}>
                      Accept {request.formattedBudget}
                    </Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        {/* Expired Notice */}
        {isExpired && (
          <View style={styles.expiredNotice}>
            <Icon name="schedule" size={24} color="#F44336" />
            <Text style={styles.expiredText}>This request has expired</Text>
          </View>
        )}

        {/* Already Responded Notice */}
        {request?.status !== 'pending' && !isExpired && (
          <View style={styles.respondedNotice}>
            <Icon name="check-circle" size={24} color="#4CAF50" />
            <Text style={styles.respondedText}>
              {isRecipient ? `You have ${request?.status || 'responded to'} this request` : `Request status: ${request?.status || 'unknown'}`}
            </Text>
            {request?.response?.responseMessage && (
              <Text style={styles.previousResponse}>
                Response: "{request.response.responseMessage}"
              </Text>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
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
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  placeholder: {
    width: 34,
  },
  scrollContainer: {
    flex: 1,
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
  profileSection: {
    alignItems: 'center',
    paddingVertical: 30,
    paddingHorizontal: 20,
  },
  profilePhoto: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 15,
    borderWidth: 3,
    borderColor: '#ed167e',
  },
  profileName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 5,
  },
  profileUsername: {
    fontSize: 16,
    color: '#999',
    marginBottom: 10,
  },
  profileBio: {
    fontSize: 14,
    color: '#ccc',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  dateCard: {
    marginHorizontal: 20,
    marginBottom: 30,
    borderRadius: 20,
    overflow: 'hidden',
  },
  dateCardGradient: {
    padding: 25,
  },
  dateCardContent: {
    alignItems: 'center',
  },
  dateTypeTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    marginVertical: 15,
  },
  budgetText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 5,
  },
  budgetLabel: {
    fontSize: 16,
    color: '#fff',
    opacity: 0.9,
  },
  contactCard: {
    marginHorizontal: 20,
    marginBottom: 30,
    borderRadius: 16,
    overflow: 'hidden',
  },
  contactGradient: {
    padding: 20,
    alignItems: 'center',
  },
  contactTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginTop: 10,
    marginBottom: 5,
  },
  contactSubtitle: {
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
    marginBottom: 15,
  },
  phoneNumberContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 25,
    marginBottom: 15,
    gap: 8,
  },
  phoneNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 1,
  },
  contactNote: {
    fontSize: 14,
    color: '#fff',
    textAlign: 'center',
    opacity: 0.9,
  },
  // New Response Preview Styles
  responsePreviewCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 30,
    borderWidth: 1,
    borderColor: '#333',
  },
  responsePreviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    gap: 8,
  },
  responsePreviewTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ed167e',
  },
  responseMessageContainer: {
    gap: 15,
  },
  responseAcceptPreview: {
    marginBottom: 10,
  },
  responseRejectPreview: {
    marginBottom: 10,
  },
  responseActionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  messagePreview: {
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#ed167e',
  },
  previewMessageText: {
    fontSize: 14,
    color: '#ccc',
    lineHeight: 18,
  },
  responseNote: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginTop: 10,
    fontStyle: 'italic',
  },
  // Existing styles continue...
  detailsContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  detailItem: {
    flexDirection: 'row',
    marginBottom: 20,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
  },
  detailIcon: {
    marginRight: 15,
    marginTop: 2,
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 14,
    color: '#999',
    marginBottom: 5,
  },
  detailValue: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '500',
  },
  messageText: {
    fontSize: 16,
    color: '#fff',
    fontStyle: 'italic',
    fontWeight: '500',
  },
  statusInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '700',
  },
  timeRemainingText: {
    fontSize: 14,
    color: '#FFA500',
    fontWeight: '500',
  },
  paymentInfoCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 30,
    flexDirection: 'row',
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  paymentInfoContent: {
    marginLeft: 15,
    flex: 1,
  },
  paymentInfoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2196F3',
    marginBottom: 8,
  },
  paymentInfoText: {
    fontSize: 14,
    color: '#ccc',
    lineHeight: 20,
  },
  waitingPaymentCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 30,
    flexDirection: 'row',
    borderLeftWidth: 4,
    borderLeftColor: '#FFA500',
  },
  waitingPaymentContent: {
    marginLeft: 15,
    flex: 1,
  },
  waitingPaymentTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFA500',
    marginBottom: 8,
  },
  waitingPaymentText: {
    fontSize: 14,
    color: '#ccc',
    lineHeight: 20,
  },
  paidNoticeCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 30,
    flexDirection: 'row',
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  paidNoticeContent: {
    marginLeft: 15,
    flex: 1,
  },
  paidNoticeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4CAF50',
    marginBottom: 8,
  },
  paidNoticeText: {
    fontSize: 14,
    color: '#ccc',
    lineHeight: 20,
  },
  actionContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 15,
    marginBottom: 30,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    minHeight: 56,
  },
  rejectButton: {
    backgroundColor: '#F44336',
  },
  acceptButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  acceptButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
    flex: 1,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  acceptButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  expiredNotice: {
    alignItems: 'center',
    paddingVertical: 30,
    paddingHorizontal: 20,
  },
  expiredText: {
    fontSize: 16,
    color: '#F44336',
    marginTop: 10,
    textAlign: 'center',
  },
  respondedNotice: {
    alignItems: 'center',
    paddingVertical: 30,
    paddingHorizontal: 20,
  },
  respondedText: {
    fontSize: 16,
    color: '#4CAF50',
    marginTop: 10,
    textAlign: 'center',
    fontWeight: '600',
  },
  previousResponse: {
    fontSize: 14,
    color: '#ccc',
    marginTop: 10,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default DateRequestDetailScreen;