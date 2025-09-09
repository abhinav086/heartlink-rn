// src/components/Dating/PaymentScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Alert,
  ActivityIndicator,
  BackHandler,
  ScrollView,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from 'react-native-linear-gradient';
import RazorpayCheckout from 'react-native-razorpay';
import { useAuth } from '../../context/AuthContext';
import BASE_URL from '../../config/config';

const PaymentScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { requestId, request } = route.params;
  const { token, user } = useAuth();

  const [loading, setLoading] = useState(false);
  const [orderData, setOrderData] = useState(null);
  const [paymentStep, setPaymentStep] = useState('ready'); // ready, processing, success, failed

  useEffect(() => {
    // Create payment order when screen loads
    if (requestId && !orderData) {
      createPaymentOrder();
    }
  }, [requestId]);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (paymentStep === 'processing') {
        Alert.alert(
          'Payment in Progress',
          'Please wait for the payment to complete.',
          [{ text: 'OK' }]
        );
        return true;
      }
      return false;
    });

    return () => backHandler.remove();
  }, [paymentStep]);

  const createPaymentOrder = async () => {
    try {
      setLoading(true);
      console.log('Creating payment order for request:', requestId);

      const response = await fetch(`${BASE_URL}/api/v1/dating/${requestId}/payment/create-order`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('Response status:', response.status);

      if (!response.ok) {
        let errorMessage = 'Failed to create payment order';
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
          console.log('Error response:', errorData);
        } catch {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log('Payment order response:', result);

      if (result.success && result.data) {
        setOrderData(result.data);
        return result.data;
      } else {
        throw new Error(result.message || 'Failed to create payment order');
      }
    } catch (error) {
      console.error('Create payment order error:', error);
      
      let errorMessage = 'Failed to create payment order.';
      if (error.message.includes('Network request failed')) {
        errorMessage = 'Network error. Please check your internet connection.';
      } else if (error.message.includes('401')) {
        errorMessage = 'Authentication failed. Please login again.';
      } else if (error.message.includes('403')) {
        errorMessage = 'You are not authorized to make this payment.';
      } else if (error.message.includes('404')) {
        errorMessage = 'Date request not found or not accepted yet.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      Alert.alert('Error', errorMessage, [
        { text: 'Go Back', onPress: () => navigation.goBack() }
      ]);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const verifyPayment = async (paymentData) => {
    try {
      console.log('Verifying payment:', paymentData);
      setPaymentStep('processing');

      const verificationPayload = {
        razorpayOrderId: paymentData.razorpay_order_id,
        razorpayPaymentId: paymentData.razorpay_payment_id,
        razorpaySignature: paymentData.razorpay_signature,
        dateRequestId: requestId,
      };

      console.log('Verification payload:', verificationPayload);

      const response = await fetch(`${BASE_URL}/api/v1/dating/payment/verify`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(verificationPayload),
      });

      console.log('Verification response status:', response.status);

      if (!response.ok) {
        let errorMessage = 'Payment verification failed';
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
          console.log('Verification error:', errorData);
        } catch {
          errorMessage = `Verification failed: HTTP ${response.status}`;
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log('Payment verification response:', result);

      if (result.success) {
        setPaymentStep('success');
        // Navigate to success screen after a short delay
        setTimeout(() => {
          navigation.replace('DateConfirmed', { 
            requestId, 
            request: result.data 
          });
        }, 2000);
      } else {
        throw new Error(result.message || 'Payment verification failed');
      }
    } catch (error) {
      console.error('Payment verification error:', error);
      setPaymentStep('failed');
      Alert.alert(
        'Payment Verification Failed', 
        error.message || 'Payment verification failed. Please contact support.',
        [
          { text: 'Try Again', onPress: () => setPaymentStep('ready') },
          { text: 'Go Back', onPress: () => navigation.goBack() }
        ]
      );
    }
  };

  const handlePayment = async () => {
    try {
      setPaymentStep('processing');
      
      if (!orderData || !orderData.orderId) {
        throw new Error('Payment order not ready. Please try again.');
      }

      console.log('Opening Razorpay with order:', orderData);

      const options = {
        description: `${orderData.dateRequest?.dateTypeDisplay || 'Date'} with ${orderData.dateRequest?.recipient?.fullName || 'someone special'}`,
        currency: orderData.currency || 'INR',
        key: orderData.razorpayKeyId,
        amount: orderData.amount,
        order_id: orderData.orderId,
        name: 'HeartLink Dating',
        prefill: {
          email: user.email || '',
          contact: user.phoneNumber || '',
          name: user.fullName || '',
        },
        theme: { color: '#ed167e' },
        modal: {
          ondismiss: () => {
            console.log('Payment modal dismissed by user');
            setPaymentStep('ready');
          }
        }
      };

      console.log('Razorpay options:', options);

      RazorpayCheckout.open(options)
        .then((data) => {
          console.log('Payment successful:', data);
          verifyPayment(data);
        })
        .catch((error) => {
          console.log('Payment error:', error);
          
          if (error.code === 'PAYMENT_CANCELLED') {
            setPaymentStep('ready');
            Alert.alert('Payment Cancelled', 'You cancelled the payment. You can try again.');
          } else if (error.code === 'NETWORK_ERROR') {
            setPaymentStep('failed');
            Alert.alert('Network Error', 'Please check your internet connection and try again.');
          } else if (error.description && error.description !== 'Payment was cancelled by user') {
            setPaymentStep('failed');
            Alert.alert('Payment Failed', error.description);
          } else {
            setPaymentStep('ready');
          }
        });

    } catch (error) {
      console.error('Payment initiation error:', error);
      setPaymentStep('failed');
      Alert.alert('Error', error.message || 'Failed to initiate payment');
    }
  };

  const formatDate = (dateString) => {
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

  const getDateIcon = (dateType) => {
    const type = dateType?.toLowerCase();
    switch (type) {
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

  const renderPaymentStep = () => {
    switch (paymentStep) {
      case 'processing':
        return (
          <View style={styles.stepContainer}>
            <ActivityIndicator size="large" color="#ed167e" />
            <Text style={styles.stepTitle}>Processing Payment...</Text>
            <Text style={styles.stepDescription}>Please don't close the app</Text>
          </View>
        );

      case 'success':
        return (
          <View style={styles.stepContainer}>
            <Icon name="check-circle" size={80} color="#4CAF50" />
            <Text style={styles.stepTitle}>Payment Successful! 🎉</Text>
            <Text style={styles.stepDescription}>Your date is now confirmed</Text>
            <Text style={styles.stepSubtext}>Redirecting...</Text>

            {/* Show only the "With" detail */}
            {orderData && orderData.dateRequest?.recipient?.fullName && (
              <View style={styles.successDetailCard}>
                <Icon name="person" size={20} color="#fff" />
                <Text style={styles.successDetailText}>
                  With {orderData.dateRequest.recipient.fullName}
                </Text>
              </View>
            )}
          </View>
        );

      case 'failed':
        return (
          <View style={styles.stepContainer}>
            <Icon name="error" size={80} color="#F44336" />
            <Text style={styles.stepTitle}>Payment Failed</Text>
            <Text style={styles.stepDescription}>Please try again</Text>
            <TouchableOpacity 
              style={styles.retryButton}
              onPress={() => setPaymentStep('ready')}
            >
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        );

      default:
        return (
          <ScrollView style={styles.paymentContent} showsVerticalScrollIndicator={false}>
            {/* Loading State for Order Creation */}
            {loading && !orderData && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#ed167e" />
                <Text style={styles.loadingText}>Preparing payment...</Text>
              </View>
            )}

            {/* Payment Content */}
            {orderData && (
              <>
                {/* Date Summary */}
                <View style={styles.summaryCard}>
                  <LinearGradient
                    colors={['#ed167e', '#FF69B4']}
                    style={styles.summaryGradient}
                  >
                    <Icon name={getDateIcon(orderData.dateRequest?.dateType)} size={50} color="#fff" />
                    <Text style={styles.summaryTitle}>
                      {orderData.dateRequest?.dateTypeDisplay || 'Date'}
                    </Text>
                    <Text style={styles.summaryBudget}>
                      {orderData.dateRequest?.formattedBudget || `₹${orderData.dateRequest?.budget || Math.floor(orderData.amount / 100)}`}
                    </Text>
                  </LinearGradient>
                </View>

                {/* Date Details */}
                <View style={styles.detailsContainer}>
                  <Text style={styles.detailsTitle}>Date Details</Text>
                  
                  <View style={styles.detailRow}>
                    <Icon name="person" size={20} color="#ed167e" />
                    <Text style={styles.detailText}>
                      With {orderData.dateRequest?.recipient?.fullName || 'Someone Special'}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Icon name="calendar-today" size={20} color="#ed167e" />
                    <Text style={styles.detailText}>
                      {formatDate(orderData.dateRequest?.preferredDate || new Date())}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Icon name="location-on" size={20} color="#ed167e" />
                    <Text style={styles.detailText}>
                      {orderData.dateRequest?.location?.city}
                      {orderData.dateRequest?.location?.area && `, ${orderData.dateRequest.location.area}`}
                    </Text>
                  </View>

                  {orderData.dateRequest?.message && (
                    <View style={styles.detailRow}>
                      <Icon name="message" size={20} color="#ed167e" />
                      <Text style={styles.detailText}>"{orderData.dateRequest.message}"</Text>
                    </View>
                  )}
                </View>

                {/* Payment Breakdown */}
                <View style={styles.breakdownCard}>
                  <Text style={styles.breakdownTitle}>Payment Breakdown</Text>
                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabel}>Date Budget</Text>
                    <Text style={styles.breakdownValue}>
                      ₹{Math.floor(orderData.amount / 100).toLocaleString('en-IN')}
                    </Text>
                  </View>
                  {orderData.feeBreakdown && (
                    <>
                      <View style={styles.breakdownRow}>
                        <Text style={styles.breakdownLabel}>Platform Fee (20%)</Text>
                        <Text style={styles.breakdownValue}>
                          ₹{orderData.feeBreakdown.platformFee.toLocaleString('en-IN')}
                        </Text>
                      </View>
                      <View style={styles.breakdownRow}>
                        <Text style={styles.breakdownLabel}>Amount to Date</Text>
                        <Text style={styles.breakdownValue}>
                          ₹{orderData.feeBreakdown.recipientAmount.toLocaleString('en-IN')}
                        </Text>
                      </View>
                    </>
                  )}
                  <View style={styles.breakdownDivider} />
                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownTotal}>Total Amount</Text>
                    <Text style={styles.breakdownTotalValue}>
                      ₹{Math.floor(orderData.amount / 100).toLocaleString('en-IN')}
                    </Text>
                  </View>
                </View>

                {/* Payment Button */}
                <TouchableOpacity
                  style={[styles.payButton, loading && styles.payButtonDisabled]}
                  onPress={handlePayment}
                  disabled={loading}
                >
                  <LinearGradient
                    colors={loading ? ['#999', '#666'] : ['#4CAF50', '#45a049']}
                    style={styles.payButtonGradient}
                  >
                    {loading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Icon name="payment" size={24} color="#fff" />
                        <Text style={styles.payButtonText}>
                          Pay ₹{Math.floor(orderData.amount / 100).toLocaleString('en-IN')}
                        </Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                {/* Security Note */}
                <View style={styles.securityNote}>
                  <Icon name="security" size={16} color="#4CAF50" />
                  <Text style={styles.securityText}>
                    Secure payment powered by Razorpay
                  </Text>
                </View>
              </>
            )}
          </ScrollView>
        );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0a" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()} 
          style={styles.backButton}
          disabled={paymentStep === 'processing'}
        >
          <Icon name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Complete Payment</Text>
        <View style={styles.placeholder} />
      </View>

      {renderPaymentStep()}
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
  placeholder: {
    width: 34,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
  },
  loadingText: {
    fontSize: 16,
    color: '#999',
    marginTop: 15,
  },
  stepContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
  stepDescription: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
  },
  stepSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 10,
  },
  retryButton: {
    backgroundColor: '#ed167e',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
    marginTop: 20,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  paymentContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  summaryCard: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 30,
  },
  summaryGradient: {
    padding: 30,
    alignItems: 'center',
  },
  summaryTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginTop: 15,
    marginBottom: 10,
  },
  summaryBudget: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
  },
  detailsContainer: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  detailsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 20,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  detailText: {
    fontSize: 16,
    color: '#ccc',
    marginLeft: 15,
    flex: 1,
  },
  breakdownCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 20,
    marginBottom: 30,
  },
  breakdownTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 15,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  breakdownLabel: {
    fontSize: 16,
    color: '#ccc',
  },
  breakdownValue: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '500',
  },
  breakdownDivider: {
    height: 1,
    backgroundColor: '#333',
    marginVertical: 15,
  },
  breakdownTotal: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  breakdownTotalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4CAF50',
  },
  payButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20,
  },
  payButtonDisabled: {
    opacity: 0.7,
  },
  payButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 10,
  },
  payButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 20,
  },
  securityText: {
    fontSize: 14,
    color: '#4CAF50',
  },
  // New styles for success detail card
  successDetailCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
  },
  successDetailText: {
    fontSize: 16,
    color: '#fff',
    marginLeft: 10,
  },
});

export default PaymentScreen;