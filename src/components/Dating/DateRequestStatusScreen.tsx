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
  Linking,
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

const DateRequestStatusScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { requestId, request: initialRequest } = route.params as RouteParams;
  const { token, user } = useAuth();

  const [request, setRequest] = useState(initialRequest);
  const [loading, setLoading] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const refreshRequestStatus = async () => {
    try {
      setLoading(true);
      // In a real app, you'd have an endpoint to get single request details
      // For now, we'll work with the existing data
    } catch (error) {
      console.error('Error refreshing status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCallPress = () => {
    if (request.recipient?.phoneNumber) {
      Alert.alert(
        'Call ' + request.recipient.fullName,
        `Do you want to call ${request.recipient.phoneNumber}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Call', 
            onPress: () => {
              const phoneUrl = `tel:${request.recipient.phoneNumber}`;
              Linking.canOpenURL(phoneUrl)
                .then(supported => {
                  if (supported) {
                    Linking.openURL(phoneUrl);
                  } else {
                    Alert.alert('Error', 'Phone calls are not supported on this device');
                  }
                })
                .catch(err => console.error('Error opening phone:', err));
            }
          }
        ]
      );
    }
  };

  const handleCancelRequest = () => {
    if (request.status === 'paid') {
      Alert.alert(
        'Cancel Paid Request',
        'This request has been paid for. Cancelling will process a refund. Are you sure you want to continue?',
        [
          { text: 'No, Keep Request', style: 'cancel' },
          { 
            text: 'Yes, Cancel & Refund', 
            onPress: () => cancelRequest(),
            style: 'destructive'
          }
        ]
      );
    } else {
      Alert.alert(
        'Cancel Date Request',
        'Are you sure you want to cancel this date request?',
        [
          { text: 'No', style: 'cancel' },
          { 
            text: 'Yes, Cancel', 
            onPress: () => cancelRequest(),
            style: 'destructive'
          }
        ]
      );
    }
  };

  const cancelRequest = async () => {
    try {
      setCancelling(true);

      const response = await fetch(`${BASE_URL}/api/v1/dating/${requestId}/cancel`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          reason: 'Cancelled by user'
        }),
      });

      const result = await response.json();
      
      if (response.ok && result.success) {
        Alert.alert(
          'Request Cancelled',
          result.message || 'Date request cancelled successfully',
          [{ 
            text: 'OK', 
            onPress: () => navigation.goBack()
          }]
        );
      } else {
        Alert.alert('Error', result.message || 'Failed to cancel request');
      }
    } catch (error) {
      console.error('Error cancelling request:', error);
      Alert.alert('Error', 'Failed to cancel request');
    } finally {
      setCancelling(false);
    }
  };

  const handlePaymentPress = () => {
    if (request.status === 'accepted') {
      navigation.navigate('PaymentScreen', { 
        requestId: request._id,
        request: request
      });
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'pending':
        return {
          color: '#FFA500',
          icon: 'hourglass-empty',
          title: 'Pending Response',
          description: 'Waiting for response from recipient',
          actionText: 'You can cancel this request while it\'s pending',
          nextStep: 'Wait for response or cancel request'
        };
      case 'accepted':
        return {
          color: '#4CAF50',
          icon: 'check-circle',
          title: 'Request Accepted! 🎉',
          description: 'Great news! Your date request has been accepted',
          actionText: 'Complete payment to confirm your date',
          nextStep: 'Pay to confirm the date'
        };
      case 'rejected':
        return {
          color: '#F44336',
          icon: 'cancel',
          title: 'Request Declined',
          description: 'Unfortunately, your request was declined',
          actionText: 'Don\'t worry! Try sending another request',
          nextStep: 'Send new requests to other users'
        };
      case 'paid':
        return {
          color: '#2196F3',
          icon: 'payment',
          title: 'Payment Completed ✅',
          description: 'Payment successful! Your date is confirmed',
          actionText: 'Enjoy your date! Remember to confirm completion afterwards',
          nextStep: 'Go on your date and confirm completion'
        };
      case 'completed':
        return {
          color: '#8BC34A',
          icon: 'verified',
          title: 'Date Completed! 💕',
          description: 'Your date has been successfully completed',
          actionText: 'Hope you had a wonderful time!',
          nextStep: 'Send more date requests or leave a review'
        };
      case 'cancelled':
        return {
          color: '#9E9E9E',
          icon: 'close',
          title: 'Request Cancelled',
          description: 'This date request has been cancelled',
          actionText: 'You can send new requests anytime',
          nextStep: 'Send new date requests'
        };
      case 'expired':
        return {
          color: '#795548',
          icon: 'schedule',
          title: 'Request Expired',
          description: 'This request expired due to no response',
          actionText: 'Try sending a new request',
          nextStep: 'Send a new date request'
        };
      case 'refunded':
        return {
          color: '#FF9800',
          icon: 'money-off',
          title: 'Request Refunded',
          description: 'This request was cancelled and refunded',
          actionText: 'Your refund has been processed',
          nextStep: 'Check your wallet for the refund'
        };
      default:
        return {
          color: '#9E9E9E',
          icon: 'help',
          title: 'Unknown Status',
          description: 'Status unknown',
          actionText: '',
          nextStep: ''
        };
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

  const statusInfo = getStatusInfo(request.status);
  const canCancel = ['pending', 'accepted', 'paid'].includes(request.status);
  const canPay = request.status === 'accepted';
  const isPaid = request.status === 'paid' || request.status === 'completed';

  // CRITICAL FIX: Determine user role correctly
  const currentUserId = user._id;
  const isCurrentUserRequester = currentUserId === request.requester._id;
  const isCurrentUserRecipient = currentUserId === request.recipient._id;
  
  // FIXED: Only requester should see payment button when accepted
  const shouldShowPayButton = isCurrentUserRequester && request.status === 'accepted';
  
  // FIXED: Only requester should see contact info after payment
  const shouldShowContactInfo = isCurrentUserRequester && isPaid;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0a" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Request Status</Text>
        <TouchableOpacity onPress={refreshRequestStatus} style={styles.refreshButton}>
          <Icon name="refresh" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* Status Card */}
        {/* <View style={styles.statusCard}>
          <LinearGradient
            colors={[statusInfo.color, statusInfo.color + '80']}
            style={styles.statusGradient}
          >
            <Icon name={statusInfo.icon} size={60} color="#fff" />
            <Text style={styles.statusTitle}>{statusInfo.title}</Text>
            <Text style={styles.statusDescription}>{statusInfo.description}</Text>
          </LinearGradient>
        </View> */}

        {/* Payment Required Notice - Prominent for accepted status - ONLY for requester */}
        {shouldShowPayButton && (
          <View style={styles.paymentNoticeCard}>
            <LinearGradient
              colors={['#FF6B35', '#F7931E']}
              style={styles.paymentNoticeGradient}
            >
              <Icon name="celebration" size={40} color="#fff" />
              <Text style={styles.paymentNoticeTitle}>🎉 They Said Yes!</Text>
              <Text style={styles.paymentNoticeSubtitle}>
                {request.recipient?.fullName} accepted your date request
              </Text>
              <Text style={styles.paymentRequiredText}>
                Complete payment to secure your date
              </Text>
              <View style={styles.urgencyIndicator}>
                <Icon name="schedule" size={16} color="#fff" />
                <Text style={styles.urgencyText}>Don't wait - confirm now!</Text>
              </View>
            </LinearGradient>
          </View>
        )}

        {/* Waiting for Payment Notice - Show to recipient after accepting */}
        {isCurrentUserRecipient && request.status === 'accepted' && (
          <View style={styles.paymentNoticeCard}>
            <LinearGradient
              colors={['#4CAF50', '#45a049']}
              style={styles.paymentNoticeGradient}
            >
              <Icon name="check-circle" size={40} color="#fff" />
              <Text style={styles.paymentNoticeTitle}>✅ Request Accepted!</Text>
              <Text style={styles.paymentNoticeSubtitle}>
                You accepted {request.requester?.fullName}'s date request
              </Text>
              <Text style={styles.paymentRequiredText}>
                Waiting for them to complete payment
              </Text>
              <View style={styles.urgencyIndicator}>
                <Icon name="hourglass-empty" size={16} color="#fff" />
                <Text style={styles.urgencyText}>You'll be notified when paid</Text>
              </View>
            </LinearGradient>
          </View>
        )}

        {/* Contact Info Card - Show for paid/completed status ONLY for requester */}
        {shouldShowContactInfo && request.recipient?.phoneNumber && (
          <View style={styles.contactCard}>
            <LinearGradient
              colors={['#4CAF50', '#45a049']}
              style={styles.contactGradient}
            >
              <Icon name="phone" size={40} color="#fff" />
              <Text style={styles.contactTitle}>📞 Contact Details Available!</Text>
              <Text style={styles.contactSubtitle}>
                You can now contact {request.recipient.fullName}
              </Text>
              
              <View style={styles.phoneNumberContainer}>
                <Icon name="phone" size={20} color="#fff" />
                <Text style={styles.phoneNumber}>{request.recipient.phoneNumber}</Text>
              </View>
              
              <TouchableOpacity 
                style={styles.callButton}
                onPress={handleCallPress}
              >
                <Icon name="call" size={18} color="#4CAF50" />
                <Text style={styles.callButtonText}>Call Now</Text>
              </TouchableOpacity>
            </LinearGradient>
          </View>
        )}

        {/* Recipient Info */}
        <View style={styles.recipientSection}>
          <Text style={styles.sectionTitle}>Date Request To:</Text>
          <View style={styles.recipientCard}>
            <Image 
              source={{ uri: request.recipient.photoUrl || 'https://via.placeholder.com/60' }} 
              style={styles.recipientPhoto} 
            />
            <View style={styles.recipientInfo}>
              <Text style={styles.recipientName}>{request.recipient.fullName}</Text>
              <Text style={styles.recipientUsername}>@{request.recipient.username}</Text>
              {shouldShowContactInfo && request.recipient?.phoneNumber && (
                <TouchableOpacity 
                  style={styles.quickCallButton}
                  onPress={handleCallPress}
                >
                  <Icon name="phone" size={14} color="#4CAF50" />
                  <Text style={styles.quickCallText}>{request.recipient.phoneNumber}</Text>
                </TouchableOpacity>
              )}
            </View>
            {canPay && isCurrentUserRecipient && (
              <View style={styles.acceptedBadge}>
                <Icon name="check-circle" size={16} color="#4CAF50" />
                <Text style={styles.acceptedText}>Accepted</Text>
              </View>
            )}
            {isPaid && (
              <View style={styles.paidBadge}>
                <Icon name="verified" size={16} color="#2196F3" />
                <Text style={styles.paidText}>Paid</Text>
              </View>
            )}
          </View>
        </View>

        {/* Date Details */}
        <View style={styles.detailsSection}>
          <Text style={styles.sectionTitle}>Date Details</Text>
          <View style={styles.detailsCard}>
            {/* Date Type */}
            <View style={styles.detailItem}>
              <Icon name={getDateIcon(request.dateType)} size={24} color="#ed167e" />
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Date Type</Text>
                <Text style={styles.detailValue}>{request.dateTypeDisplay}</Text>
              </View>
            </View>

            {/* Budget */}
            <View style={styles.detailItem}>
              <Icon name="attach-money" size={24} color="#4CAF50" />
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Budget</Text>
                <Text style={styles.detailValue}>{request.formattedBudget}</Text>
              </View>
            </View>

            {/* Date & Time */}
            <View style={styles.detailItem}>
              <Icon name="calendar-today" size={24} color="#2196F3" />
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Preferred Date</Text>
                <Text style={styles.detailValue}>{formatDate(request.preferredDate)}</Text>
              </View>
            </View>

            {/* Location */}
            <View style={styles.detailItem}>
              <Icon name="location-on" size={24} color="#FF9800" />
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Location</Text>
                <Text style={styles.detailValue}>
                  {request.location.city}
                  {request.location.area && `, ${request.location.area}`}
                  {request.location.landmark && `\n📍 ${request.location.landmark}`}
                </Text>
              </View>
            </View>

            {/* Message */}
            {request.message && (
              <View style={styles.detailItem}>
                <Icon name="message" size={24} color="#9C27B0" />
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>Your Message</Text>
                  <Text style={styles.messageValue}>"{request.message}"</Text>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Timeline */}
        <View style={styles.timelineSection}>
          <Text style={styles.sectionTitle}>Request Timeline</Text>
          <View style={styles.timelineCard}>
            <View style={styles.timelineItem}>
              <View style={styles.timelineDot} />
              <View style={styles.timelineContent}>
                <Text style={styles.timelineTitle}>Request Sent</Text>
                <Text style={styles.timelineTime}>{formatDate(request.createdAt)}</Text>
              </View>
            </View>

            {request.response?.respondedAt && (
              <View style={styles.timelineItem}>
                <View style={[styles.timelineDot, { backgroundColor: statusInfo.color }]} />
                <View style={styles.timelineContent}>
                  <Text style={styles.timelineTitle}>
                    {request.status === 'accepted' ? 'Request Accepted' : 'Request Declined'}
                  </Text>
                  <Text style={styles.timelineTime}>{formatDate(request.response.respondedAt)}</Text>
                  {request.response.responseMessage && (
                    <Text style={styles.responseMessage}>"{request.response.responseMessage}"</Text>
                  )}
                </View>
              </View>
            )}

            {request.payment?.paidAt && (
              <View style={styles.timelineItem}>
                <View style={[styles.timelineDot, { backgroundColor: '#4CAF50' }]} />
                <View style={styles.timelineContent}>
                  <Text style={styles.timelineTitle}>Payment Completed</Text>
                  <Text style={styles.timelineTime}>{formatDate(request.payment.paidAt)}</Text>
                  <Text style={styles.responseMessage}>
                    {isCurrentUserRequester 
                      ? "Contact details now available" 
                      : "Payment received - date confirmed"
                    }
                  </Text>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Action Section */}
        <View style={styles.actionSection}>
          {!shouldShowPayButton && !shouldShowContactInfo && (
            <>
              <Text style={styles.actionText}>{statusInfo.actionText}</Text>
              <Text style={styles.nextStepText}>Next: {statusInfo.nextStep}</Text>
            </>
          )}

          {/* Message for recipient after accepting */}
          {isCurrentUserRecipient && request.status === 'accepted' && (
            <View style={styles.paidActionSection}>
              <Text style={styles.paidActionTitle}>Request Accepted! ✅</Text>
              <Text style={styles.paidActionText}>
                Waiting for {request.requester.fullName} to complete payment to confirm the date.
              </Text>
            </View>
          )}

          {/* Message for recipient after payment */}
          {isCurrentUserRecipient && isPaid && (
            <View style={styles.paidActionSection}>
              <Text style={styles.paidActionTitle}>Payment Received! 🎉</Text>
              <Text style={styles.paidActionText}>
                {request.requester.fullName} has completed payment. Your date is confirmed!
                Enjoy your time together.
              </Text>
            </View>
          )}

          {/* Message for requester after payment */}
          {shouldShowContactInfo && (
            <View style={styles.paidActionSection}>
              <Text style={styles.paidActionTitle}>Your date is confirmed! 🎉</Text>
              <Text style={styles.paidActionText}>
                Contact {request.recipient.fullName} to plan your date details
              </Text>
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            {/* FIXED: Only show payment button to requester when accepted */}
            {shouldShowPayButton && (
              <TouchableOpacity 
                style={[styles.actionButton, styles.payButton]}
                onPress={handlePaymentPress}
              >
                <LinearGradient
                  colors={['#ed167e', '#FF69B4']}
                  style={styles.buttonGradient}
                >
                  <Icon name="payment" size={24} color="#fff" />
                  <Text style={styles.payButtonText}>
                    Pay {request.formattedBudget} • Confirm Date
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            )}

            {/* Contact button for requester after payment */}
            {shouldShowContactInfo && request.recipient?.phoneNumber && (
              <TouchableOpacity 
                style={[styles.actionButton, styles.contactButton]}
                onPress={handleCallPress}
              >
                <LinearGradient
                  colors={['#4CAF50', '#45a049']}
                  style={styles.buttonGradient}
                >
                  <Icon name="call" size={24} color="#fff" />
                  <Text style={styles.contactButtonText}>
                    Call {request.recipient.fullName}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            )}

            {/* Cancel button - available for both users */}
            {canCancel && (
              <TouchableOpacity 
                style={[styles.actionButton, styles.cancelButton]}
                onPress={handleCancelRequest}
                disabled={cancelling}
              >
                {cancelling ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Icon name="cancel" size={20} color="#fff" />
                    <Text style={styles.actionButtonText}>
                      {request.status === 'paid' ? 'Cancel & Refund' : 'Cancel Request'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Time Remaining */}
        {request.timeRemaining && request.status === 'pending' && (
          <View style={styles.timeRemainingSection}>
            <Text style={styles.timeRemainingText}>
              ⏰ {request.timeRemaining}
            </Text>
          </View>
        )}
      </ScrollView>
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
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  refreshButton: {
    padding: 5,
  },
  scrollContainer: {
    flex: 1,
  },
  statusCard: {
    marginHorizontal: 20,
    marginVertical: 20,
    borderRadius: 20,
    overflow: 'hidden',
  },
  statusGradient: {
    padding: 30,
    alignItems: 'center',
  },
  statusTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginTop: 15,
    marginBottom: 5,
    textAlign: 'center',
  },
  statusDescription: {
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
    opacity: 0.9,
  },
  paymentNoticeCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 16,
    overflow: 'hidden',
  },
  paymentNoticeGradient: {
    padding: 20,
    alignItems: 'center',
  },
  paymentNoticeTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    marginTop: 10,
    marginBottom: 5,
  },
  paymentNoticeSubtitle: {
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
    marginBottom: 10,
  },
  paymentRequiredText: {
    fontSize: 18,
    color: '#fff',
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 15,
  },
  urgencyIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 5,
  },
  urgencyText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  contactCard: {
    marginHorizontal: 20,
    marginBottom: 20,
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
    textAlign: 'center',
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
  callButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 25,
    gap: 8,
  },
  callButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4CAF50',
  },
  recipientSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 15,
  },
  recipientCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  recipientPhoto: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 15,
    borderWidth: 2,
    borderColor: '#ed167e',
  },
  recipientInfo: {
    flex: 1,
  },
  recipientName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  recipientUsername: {
    fontSize: 14,
    color: '#999',
    marginBottom: 4,
  },
  quickCallButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  quickCallText: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '600',
  },
  acceptedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  acceptedText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  paidBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2196F3',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  paidText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  detailsSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  detailsCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  detailContent: {
    flex: 1,
    marginLeft: 15,
  },
  detailLabel: {
    fontSize: 14,
    color: '#999',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '500',
  },
  messageValue: {
    fontSize: 16,
    color: '#fff',
    fontStyle: 'italic',
    fontWeight: '500',
  },
  timelineSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  timelineCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 15,
    alignItems: 'flex-start',
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#ed167e',
    marginTop: 4,
    marginRight: 15,
  },
  timelineContent: {
    flex: 1,
  },
  timelineTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  timelineTime: {
    fontSize: 14,
    color: '#999',
  },
  responseMessage: {
    fontSize: 14,
    color: '#ccc',
    fontStyle: 'italic',
    marginTop: 4,
  },
  actionSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  actionText: {
    fontSize: 16,
    color: '#ccc',
    textAlign: 'center',
    marginBottom: 8,
  },
  nextStepText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginBottom: 20,
  },
  paidActionSection: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    alignItems: 'center',
  },
  paidActionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4CAF50',
    marginBottom: 8,
    textAlign: 'center',
  },
  paidActionText: {
    fontSize: 16,
    color: '#ccc',
    textAlign: 'center',
  },
  actionButtons: {
    gap: 15,
  },
  actionButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  payButton: {
    // Specific styles for pay button if needed
  },
  contactButton: {
    // Specific styles for contact button if needed
  },
  cancelButton: {
    backgroundColor: '#F44336',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 10,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  payButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  contactButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  timeRemainingSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
    alignItems: 'center',
  },
  timeRemainingText: {
    fontSize: 16,
    color: '#FFA500',
    fontWeight: '600',
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
});

export default DateRequestStatusScreen;