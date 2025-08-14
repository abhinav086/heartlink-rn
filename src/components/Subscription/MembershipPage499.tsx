// screens/MembershipPage499.tsx

import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import RazorpayCheckout from 'react-native-razorpay';

// 1. Import your Auth context to get the token and user info
import { useAuth } from '../../context/AuthContext';
import { icons } from '../../constants';

// Your public Razorpay Key ID from environment variables is best practice
const RAZORPAY_KEY_ID = process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID || 'rzp_test_OlyfdB3oCc0K71';

// API base URL from environment variables is best practice
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://backendforheartlink.in/api/v1';

// A small helper component for the feature list items
const FeatureItem: React.FC<{ text: string }> = ({ text }) => (
  <View style={styles.featureItem}>
    <Image source={icons.check} style={styles.featureIcon} />
    <Text style={styles.featureText}>{text}</Text>
  </View>
);

const MembershipPage499 = () => {
  // 2. Get token, user data, and navigation from hooks
  const { token, user } = useAuth();
  const navigation = useNavigation();
  const [loading, setLoading] = useState(false);

  // 3. API helper to create an order, now using the real token
  const createSubscriptionOrder = useCallback(async () => {
    if (!token) {
      throw new Error('Authentication token not found. Please log in again.');
    }
    const response = await fetch(`${API_BASE_URL}/subscription/create-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`, // Use the real token
      },
      body: JSON.stringify({
        planId: 'premium' // Key difference: 'premium' plan for ₹499
      }),
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.message || 'Failed to create payment order.');
    }
    return data.data;
  }, [token]);

  // 4. API helper to verify the payment, now using the real token
  const verifyPayment = useCallback(async (paymentData: object) => {
    if (!token) {
      throw new Error('Authentication token not found. Please log in again.');
    }
    const response = await fetch(`${API_BASE_URL}/subscription/verify-payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`, // Use the real token
      },
      body: JSON.stringify(paymentData),
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.message || 'Payment verification failed.');
    }
    return data.data;
  }, [token]);

  // 5. Main payment handler function, wrapped in useCallback
  const handlePayment = useCallback(async () => {
    if (loading) return;
    setLoading(true);

    try {
      // Step 1: Create order on your backend
      const orderData = await createSubscriptionOrder();

      // Step 2: Prepare Razorpay options with real user data
      const options = {
        description: 'HeartLink Premium Membership',
        image: 'https://your-app-logo.com/logo.png', // Replace with your app's logo URL
        currency: 'INR',
        key: RAZORPAY_KEY_ID,
        amount: orderData.amount * 100,
        order_id: orderData.orderId,
        name: 'HeartLink',
        prefill: {
          email: user?.email || '',
          contact: user?.phone || '',
          name: user?.fullName || 'Valued User',
        },
        theme: { color: '#F52684' },
      };

      // Step 3: Open Razorpay checkout
      const paymentResult = await RazorpayCheckout.open(options);
      
      // Step 4: Verify payment on your backend
      const verificationResult = await verifyPayment({
        razorpay_order_id: paymentResult.razorpay_order_id,
        razorpay_payment_id: paymentResult.razorpay_payment_id,
        razorpay_signature: paymentResult.razorpay_signature,
      });

      // Step 5: Show success message and navigate
      Alert.alert(
        '🎉 Subscription Activated!',
        `Welcome to Premium! Your plan is now active and will expire on ${new Date(verificationResult.subscription.expiresAt).toLocaleDateString()}.`,
        [{
          text: 'Awesome!',
          onPress: () => navigation.goBack(), // Navigate back after success
        }]
      );

    } catch (error: any) {
      console.error('Payment process error:', error);
      if (error.code === 1) { // Code 1: Payment Cancelled by user
        Alert.alert('Payment Cancelled', 'You can try again anytime from the membership page.');
      } else {
        Alert.alert('Payment Failed', error.message || 'An unknown error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [loading, user, createSubscriptionOrder, verifyPayment, navigation]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                 <Image source={icons.left} style={styles.backIcon} />
            </TouchableOpacity>
            <Text style={styles.headerText}>Premium Plan</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            Upgrade to{'\n'}Premium – just{' '}
            <Text style={styles.priceText}>₹499</Text>
          </Text>
          {/* <View>
            <FeatureItem text="Unlimited posts & reels" />
            <FeatureItem text="Advanced post analytics" />
            <FeatureItem text="Priority in search results" />
            <FeatureItem text="Custom branding options" />
            <FeatureItem text="Priority support" />
            <FeatureItem text="API Access" />
          </View> */}
          <Text style={styles.descriptionText}>
            Monthly premium access. No hidden charges.{'\n'}
            Just ₹499 – Cancel anytime
          </Text>
        </View>

        <TouchableOpacity 
          style={[styles.button, loading && styles.buttonDisabled]} 
          onPress={handlePayment}
          disabled={loading}
        >
          {loading ? (
            <>
              <ActivityIndicator size="small" color={COLORS.text} />
              <Text style={[styles.buttonText, { marginLeft: 10 }]}>Processing...</Text>
            </>
          ) : (
            <Text style={styles.buttonText}>Get Premium Now</Text>
          )}
        </TouchableOpacity>

        <View style={styles.infoContainer}>
          {/* <Text style={styles.infoText}>
            • 30-day money back guarantee{'\n'}
            • Secure payments powered by Razorpay{'\n'}
            • Cancel anytime from your profile
          </Text> */}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const COLORS = {
  background: '#000000', cardBackground: '#1E1E1E', primary: '#F52684',
  text: '#FFFFFF', cardBorder: 'rgba(245, 38, 132, 0.4)', textSecondary: '#999999',
};

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: COLORS.background },
    container: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 30 },
    header: { flexDirection: 'row', alignItems: 'center', marginBottom: 40, marginTop: 10, },
    backButton: { marginRight: 15 },
    backIcon: { width: 24, height: 24, tintColor: COLORS.text },
    headerText: { color: COLORS.text, fontSize: 30, fontWeight: 'bold' },
    card: { backgroundColor: COLORS.cardBackground, borderRadius: 20, paddingVertical: 30, paddingHorizontal: 25, borderWidth: 1.5, borderColor: COLORS.cardBorder, },
    cardTitle: { color: COLORS.text, fontSize: 38, fontWeight: 'bold', marginBottom: 35, lineHeight: 46, },
    priceText: { color: COLORS.primary },
    featureItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
    featureIcon: { width: 22, height: 22, tintColor: COLORS.primary },
    featureText: { color: COLORS.text, fontSize: 18, marginLeft: 15 },
    descriptionText: { color: COLORS.text, fontSize: 16, lineHeight: 24, marginTop: 20 },
    button: { backgroundColor: COLORS.primary, paddingVertical: 18, borderRadius: 30, alignItems: 'center', marginTop: 50, flexDirection: 'row', justifyContent: 'center' },
    buttonDisabled: { backgroundColor: 'rgba(245, 38, 132, 0.6)' },
    buttonText: { color: COLORS.text, fontSize: 20, fontWeight: 'bold' },
    infoContainer: { marginTop: 30, paddingHorizontal: 10 },
    infoText: { color: COLORS.textSecondary, fontSize: 14, lineHeight: 22, textAlign: 'center' },
});

export default MembershipPage499;