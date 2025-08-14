// screens/MembershipPage99.tsx

import React, { useState, useCallback, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
  BackHandler
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import RazorpayCheckout from 'react-native-razorpay';

// Import your Auth context to get the token and user info
import { useAuth } from '../../context/AuthContext';
import { icons } from '../../constants';

// Configuration constants
const RAZORPAY_KEY_ID = 'rzp_test_OlyfdB3oCc0K71';
const API_BASE_URL = 'https://backendforheartlink.in/api/v1';

// Color constants
const COLORS = {
  background: '#000000',
  cardBackground: '#1E1E1E',
  primary: '#F52684',
  text: '#FFFFFF',
  cardBorder: 'rgba(245, 38, 132, 0.4)',
  textSecondary: '#999999',
  success: '#4CAF50',
  warning: '#FF9800',
  error: '#F44336'
};

// Feature item component
const FeatureItem: React.FC<{ text: string }> = ({ text }) => (
  <View style={styles.featureItem}>
    <Image source={icons.check} style={styles.featureIcon} />
    <Text style={styles.featureText}>{text}</Text>
  </View>
);

// Loading overlay component
const LoadingOverlay: React.FC<{ visible: boolean; message: string }> = ({ visible, message }) => {
  if (!visible) return null;
  
  return (
    <View style={styles.loadingOverlay}>
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>{message}</Text>
      </View>
    </View>
  );
};

const MembershipPage99 = () => {
  const { token, user, refreshUserData } = useAuth();
  const navigation = useNavigation();
  
  // State management
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [currentSubscription, setCurrentSubscription] = useState(null);
  const [isCheckingStatus, setIsCheckingStatus] = useState(true);

  // Check current subscription status on component mount
  const checkSubscriptionStatus = useCallback(async () => {
    if (!token) return;
    
    try {
      setIsCheckingStatus(true);
      const response = await fetch(`${API_BASE_URL}/subscription/status`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      if (data.success) {
        setCurrentSubscription(data.data.subscription);
        
        // If user already has active basic subscription, show message
        if (data.data.subscription.currentPlan === 'basic' && data.data.subscription.isActive) {
          Alert.alert(
            'Active Subscription',
            `You already have an active Basic subscription that expires on ${new Date(data.data.subscription.expiresAt).toLocaleDateString()}.`,
            [
              { text: 'View Details', onPress: () => {/* Navigate to subscription details */} },
              { text: 'OK', onPress: () => navigation.goBack() }
            ]
          );
        }
      }
    } catch (error) {
      console.error('Error checking subscription status:', error);
    } finally {
      setIsCheckingStatus(false);
    }
  }, [token, navigation]);

  // Focus effect to check subscription status
  useFocusEffect(
    useCallback(() => {
      checkSubscriptionStatus();
    }, [checkSubscriptionStatus])
  );

  // Handle back button
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        if (loading) {
          Alert.alert(
            'Payment in Progress',
            'Please wait for the payment to complete before going back.',
            [{ text: 'OK' }]
          );
          return true;
        }
        return false;
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [loading])
  );

  // API helper to create subscription order
  const createSubscriptionOrder = useCallback(async () => {
    if (!token) {
      throw new Error('Authentication required. Please log in again.');
    }

    console.log('Creating subscription order for basic plan...');
    
    const response = await fetch(`${API_BASE_URL}/subscription/create-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        planId: 'basic'
      }),
    });

    const data = await response.json();
    
    console.log('Create order response:', data);
    
    if (!response.ok) {
      throw new Error(data.message || `Server error: ${response.status}`);
    }
    
    if (!data.success) {
      throw new Error(data.message || 'Failed to create payment order');
    }

    return data.data;
  }, [token]);

  // API helper to verify payment and activate subscription
  const verifyPaymentAndActivateSubscription = useCallback(async (paymentData: any) => {
    if (!token) {
      throw new Error('Authentication required. Please log in again.');
    }

    console.log('Verifying payment:', paymentData);
    
    const response = await fetch(`${API_BASE_URL}/subscription/verify-payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(paymentData),
    });

    const data = await response.json();
    
    console.log('Verify payment response:', data);
    
    if (!response.ok) {
      throw new Error(data.message || `Verification failed: ${response.status}`);
    }
    
    if (!data.success) {
      throw new Error(data.message || 'Payment verification failed');
    }

    return data.data;
  }, [token]);

  // Main payment handler
  const handlePayment = useCallback(async () => {
    if (loading) return;
    
    // Validate prerequisites
    if (!token) {
      Alert.alert('Authentication Error', 'Please log in again to continue.');
      return;
    }

    if (!user) {
      Alert.alert('User Error', 'User information not available. Please refresh and try again.');
      return;
    }

    try {
      setLoading(true);
      setLoadingMessage('Creating order...');

      // Step 1: Create order on backend
      const orderData = await createSubscriptionOrder();
      console.log('Order created successfully:', orderData);

      setLoadingMessage('Opening payment gateway...');

      // Step 2: Prepare Razorpay options
      const options = {
        description: 'HeartLink Basic Membership - ₹99/month',
        image: 'https://your-app-logo.com/logo.png', // Replace with your actual logo URL
        currency: 'INR',
        key: RAZORPAY_KEY_ID,
        amount: orderData.amount * 100, // Convert to paise
        order_id: orderData.orderId,
        name: 'HeartLink',
        prefill: {
          email: user?.email || '',
          contact: user?.phoneNumber || user?.phone || '',
          name: user?.fullName || 'Valued User',
        },
        theme: { 
          color: COLORS.primary,
          backdrop_color: '#000000'
        },
        modal: {
          backdropclose: false,
          escape: false,
          handleback: false
        },
        retry: {
          enabled: true,
          max_count: 3
        },
        timeout: 300, // 5 minutes timeout
        remember_customer: true
      };

      console.log('Opening Razorpay with options:', options);

      // Step 3: Open Razorpay checkout
      const paymentResult = await RazorpayCheckout.open(options);
      console.log('Payment successful:', paymentResult);

      setLoadingMessage('Verifying payment...');

      // Step 4: Verify payment and activate subscription
      const verificationResult = await verifyPaymentAndActivateSubscription({
        razorpay_order_id: paymentResult.razorpay_order_id,
        razorpay_payment_id: paymentResult.razorpay_payment_id,
        razorpay_signature: paymentResult.razorpay_signature,
      });

      console.log('Payment verified successfully:', verificationResult);

      // Step 5: Refresh user data to get updated subscription info
      if (refreshUserData) {
        await refreshUserData();
      }

      // Step 6: Show success message
      Alert.alert(
        '🎉 Subscription Activated!',
        `Welcome to Basic! Your subscription is now active and will expire on ${new Date(verificationResult.subscription.expiresAt).toLocaleDateString('en-IN')}.\n\nYou can now enjoy:\n• 5 posts per day\n• 90 posts per month\n• Basic analytics\n• Custom themes`,
        [
          {
            text: 'Awesome!',
            onPress: () => {
              // Navigate back or to a success page
              navigation.goBack();
            },
          }
        ]
      );

    } catch (error: any) {
      console.error('Payment process error:', error);
      
      // Handle different types of errors
      if (error.code === 1) {
        // Payment cancelled by user
        Alert.alert(
          'Payment Cancelled',
          'You can try again anytime from the membership page.',
          [{ text: 'OK' }]
        );
      } else if (error.code === 2) {
        // Network error
        Alert.alert(
          'Network Error',
          'Please check your internet connection and try again.',
          [{ text: 'OK' }]
        );
      } else if (error.message?.includes('already have an active')) {
        // Already has active subscription
        Alert.alert(
          'Active Subscription Found',
          error.message,
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      } else if (error.message?.includes('Authentication') || error.message?.includes('token')) {
        // Authentication error
        Alert.alert(
          'Authentication Error',
          'Please log in again to continue.',
          [{ text: 'OK', onPress: () => {/* Navigate to login */} }]
        );
      } else {
        // General error
        Alert.alert(
          'Payment Failed',
          error.message || 'An unexpected error occurred. Please try again or contact support.',
          [{ text: 'OK' }]
        );
      }
    } finally {
      setLoading(false);
      setLoadingMessage('');
    }
  }, [loading, user, token, createSubscriptionOrder, verifyPaymentAndActivateSubscription, navigation, refreshUserData]);

  // Show loading if checking subscription status
  if (isCheckingStatus) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Checking subscription status...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView 
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            onPress={() => navigation.goBack()} 
            style={styles.backButton}
            disabled={loading}
          >
            <Image source={icons.left} style={styles.backIcon} />
          </TouchableOpacity>
          <Text style={styles.headerText}>Basic Plan</Text>
        </View>

        {/* Subscription Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            Get Started with{'\n'}Basic – just{' '}
            <Text style={styles.priceText}>₹99</Text>
          </Text>
          
          {/* <View style={styles.featuresContainer}>
            <FeatureItem text="5 posts per day (150+ per month)" />
            <FeatureItem text="Basic post analytics" />
            <FeatureItem text="Email support" />
            <FeatureItem text="All custom themes" />
            <FeatureItem text="1GB storage space" />
          </View> */}
          
          <Text style={styles.descriptionText}>
            Monthly basic access. No hidden charges.{'\n'}
            Just ₹99 per month – Cancel anytime
          </Text>
        </View>

        {/* Current Subscription Status */}
        {currentSubscription?.isActive && (
          <View style={styles.statusCard}>
            <Text style={styles.statusTitle}>Current Subscription</Text>
            <Text style={styles.statusText}>
              {currentSubscription.currentPlan.toUpperCase()} Plan
              {currentSubscription.expiresAt && 
                ` • Expires ${new Date(currentSubscription.expiresAt).toLocaleDateString('en-IN')}`
              }
            </Text>
          </View>
        )}

        {/* Purchase Button */}
        <TouchableOpacity 
          style={[
            styles.button, 
            loading && styles.buttonDisabled,
            currentSubscription?.currentPlan === 'basic' && currentSubscription?.isActive && styles.buttonDisabled
          ]} 
          onPress={handlePayment}
          disabled={loading || (currentSubscription?.currentPlan === 'basic' && currentSubscription?.isActive)}
        >
          {loading ? (
            <>
              <ActivityIndicator size="small" color={COLORS.text} />
              <Text style={[styles.buttonText, { marginLeft: 10 }]}>Processing...</Text>
            </>
          ) : currentSubscription?.currentPlan === 'basic' && currentSubscription?.isActive ? (
            <Text style={styles.buttonText}>Already Subscribed</Text>
          ) : (
            <Text style={styles.buttonText}>Get Basic Now - ₹99</Text>
          )}
        </TouchableOpacity>

        {/* Info Section */}
        <View style={styles.infoContainer}>
          {/* <Text style={styles.infoText}>
            • 30-day money back guarantee{'\n'}
            • Secure payments powered by Razorpay{'\n'}
            • Cancel anytime from your profile{'\n'}
            • Instant activation after payment
          </Text> */}
        </View>

        {/* Security Notice */}
        <View style={styles.securityNotice}>
          <Text style={styles.securityText}>
            🔒 Your payment information is secure and encrypted
          </Text>
        </View>
      </ScrollView>

      {/* Loading Overlay */}
      <LoadingOverlay visible={loading} message={loadingMessage} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 30,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 40,
    marginTop: 10,
  },
  backButton: {
    marginRight: 15,
    padding: 8,
  },
  backIcon: {
    width: 24,
    height: 24,
    tintColor: COLORS.text,
  },
  headerText: {
    color: COLORS.text,
    fontSize: 30,
    fontWeight: 'bold',
  },
  card: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 20,
    paddingVertical: 30,
    paddingHorizontal: 25,
    borderWidth: 1.5,
    borderColor: COLORS.cardBorder,
    marginBottom: 20,
  },
  cardTitle: {
    color: COLORS.text,
    fontSize: 38,
    fontWeight: 'bold',
    marginBottom: 35,
    lineHeight: 46,
  },
  priceText: {
    color: COLORS.primary,
  },
  featuresContainer: {
    marginBottom: 20,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  featureIcon: {
    width: 22,
    height: 22,
    tintColor: COLORS.primary,
  },
  featureText: {
    color: COLORS.text,
    fontSize: 18,
    marginLeft: 15,
    flex: 1,
  },
  descriptionText: {
    color: COLORS.text,
    fontSize: 16,
    lineHeight: 24,
    marginTop: 20,
  },
  statusCard: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.success,
  },
  statusTitle: {
    color: COLORS.success,
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  statusText: {
    color: COLORS.text,
    fontSize: 14,
  },
  button: {
    backgroundColor: COLORS.primary,
    paddingVertical: 18,
    borderRadius: 30,
    alignItems: 'center',
    marginTop: 30,
    flexDirection: 'row',
    justifyContent: 'center',
    elevation: 5,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  buttonDisabled: {
    backgroundColor: 'rgba(245, 38, 132, 0.6)',
    elevation: 0,
    shadowOpacity: 0,
  },
  buttonText: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: 'bold',
  },
  infoContainer: {
    marginTop: 30,
    paddingHorizontal: 10,
  },
  infoText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
  },
  securityNotice: {
    marginTop: 20,
    alignItems: 'center',
  },
  securityText: {
    color: COLORS.success,
    fontSize: 12,
    textAlign: 'center',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  loadingContainer: {
    backgroundColor: COLORS.cardBackground,
    padding: 30,
    borderRadius: 20,
    alignItems: 'center',
    minWidth: 200,
  },
  loadingText: {
    color: COLORS.text,
    fontSize: 16,
    marginTop: 15,
    textAlign: 'center',
  },
});

export default MembershipPage99;