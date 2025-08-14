// utils/subscriptionUtils.ts
// Helper functions for subscription management

import AsyncStorage from '@react-native-async-storage/async-storage';

// Types
export interface SubscriptionPlan {
  id: string;
  name: string;
  amount: number;
  duration: number;
  description: string;
  features: string[];
  contentLimit: number | string;
  storageLimit: string;
}

export interface UserSubscription {
  currentPlan: string;
  planDetails: SubscriptionPlan | null;
  expiresAt: string | null;
  isActive: boolean;
  isExpired: boolean;
  isCancelled: boolean;
  daysRemaining: number;
}

export interface PaymentData {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

// Configuration
export const SUBSCRIPTION_CONFIG = {
  API_BASE_URL: 'https://your-backend-url.com/api', // Update this!
  RAZORPAY_KEY_ID: 'rzp_test_OlyfdB3oCc0K71', // Update this!
  JWT_TOKEN_KEY: 'userToken',
  USER_DATA_KEY: 'userData',
  SUBSCRIPTION_DATA_KEY: 'subscriptionData',
};

// Storage helpers
export const getStoredToken = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem(SUBSCRIPTION_CONFIG.JWT_TOKEN_KEY);
  } catch (error) {
    console.error('Error getting stored token:', error);
    return null;
  }
};

export const getStoredUserData = async (): Promise<any | null> => {
  try {
    const userData = await AsyncStorage.getItem(SUBSCRIPTION_CONFIG.USER_DATA_KEY);
    return userData ? JSON.parse(userData) : null;
  } catch (error) {
    console.error('Error getting stored user data:', error);
    return null;
  }
};

export const storeSubscriptionData = async (subscriptionData: UserSubscription): Promise<void> => {
  try {
    await AsyncStorage.setItem(
      SUBSCRIPTION_CONFIG.SUBSCRIPTION_DATA_KEY, 
      JSON.stringify(subscriptionData)
    );
  } catch (error) {
    console.error('Error storing subscription data:', error);
  }
};

// API Service Class
export class SubscriptionService {
  private baseURL: string;
  private token: string | null = null;

  constructor() {
    this.baseURL = SUBSCRIPTION_CONFIG.API_BASE_URL;
    this.initializeToken();
  }

  private async initializeToken(): Promise<void> {
    this.token = await getStoredToken();
  }

  private async getHeaders(): Promise<HeadersInit> {
    if (!this.token) {
      this.token = await getStoredToken();
    }

    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.token}`,
    };
  }

  private async handleResponse(response: Response): Promise<any> {
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json();
  }

  // Get available subscription plans
  async getPlans(): Promise<{ basic: SubscriptionPlan; premium: SubscriptionPlan }> {
    try {
      const response = await fetch(`${this.baseURL}/subscriptions/plans`);
      const data = await this.handleResponse(response);
      return data.data.plans;
    } catch (error) {
      console.error('Get plans error:', error);
      throw error;
    }
  }

  // Get current subscription status
  async getSubscriptionStatus(): Promise<UserSubscription> {
    try {
      const headers = await this.getHeaders();
      const response = await fetch(`${this.baseURL}/subscriptions/status`, {
        headers,
      });
      const data = await this.handleResponse(response);
      
      // Store subscription data locally
      await storeSubscriptionData(data.data.subscription);
      
      return data.data.subscription;
    } catch (error) {
      console.error('Get subscription status error:', error);
      throw error;
    }
  }

  // Create subscription order
  async createOrder(planId: 'basic' | 'premium'): Promise<any> {
    try {
      const headers = await this.getHeaders();
      const response = await fetch(`${this.baseURL}/subscriptions/create-order`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ planId }),
      });
      const data = await this.handleResponse(response);
      return data.data;
    } catch (error) {
      console.error('Create order error:', error);
      throw error;
    }
  }

  // Verify payment
  async verifyPayment(paymentData: PaymentData): Promise<any> {
    try {
      const headers = await this.getHeaders();
      const response = await fetch(`${this.baseURL}/subscriptions/verify-payment`, {
        method: 'POST',
        headers,
        body: JSON.stringify(paymentData),
      });
      const data = await this.handleResponse(response);
      
      // Update stored subscription data
      if (data.data.subscription) {
        await storeSubscriptionData(data.data.subscription);
      }
      
      return data.data;
    } catch (error) {
      console.error('Verify payment error:', error);
      throw error;
    }
  }

  // Cancel subscription
  async cancelSubscription(): Promise<any> {
    try {
      const headers = await this.getHeaders();
      const response = await fetch(`${this.baseURL}/subscriptions/cancel`, {
        method: 'PATCH',
        headers,
      });
      const data = await this.handleResponse(response);
      return data.data;
    } catch (error) {
      console.error('Cancel subscription error:', error);
      throw error;
    }
  }

  // Reactivate subscription
  async reactivateSubscription(): Promise<any> {
    try {
      const headers = await this.getHeaders();
      const response = await fetch(`${this.baseURL}/subscriptions/reactivate`, {
        method: 'PATCH',
        headers,
      });
      const data = await this.handleResponse(response);
      return data.data;
    } catch (error) {
      console.error('Reactivate subscription error:', error);
      throw error;
    }
  }

  // Get subscription history
  async getSubscriptionHistory(page: number = 1, limit: number = 10): Promise<any> {
    try {
      const headers = await this.getHeaders();
      const response = await fetch(
        `${this.baseURL}/subscriptions/history?page=${page}&limit=${limit}`,
        { headers }
      );
      const data = await this.handleResponse(response);
      return data.data;
    } catch (error) {
      console.error('Get subscription history error:', error);
      throw error;
    }
  }
}

// Custom hook for subscription management
import { useState, useEffect, useCallback } from 'react';

export const useSubscription = () => {
  const [subscriptionService] = useState(() => new SubscriptionService());
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSubscriptionStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const status = await subscriptionService.getSubscriptionStatus();
      setSubscription(status);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch subscription status');
      console.error('Fetch subscription status error:', err);
    } finally {
      setLoading(false);
    }
  }, [subscriptionService]);

  const createOrder = useCallback(async (planId: 'basic' | 'premium') => {
    setLoading(true);
    setError(null);
    try {
      return await subscriptionService.createOrder(planId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create order');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [subscriptionService]);

  const verifyPayment = useCallback(async (paymentData: PaymentData) => {
    setLoading(true);
    setError(null);
    try {
      const result = await subscriptionService.verifyPayment(paymentData);
      // Refresh subscription status after successful payment
      await fetchSubscriptionStatus();
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment verification failed');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [subscriptionService, fetchSubscriptionStatus]);

  useEffect(() => {
    fetchSubscriptionStatus();
  }, [fetchSubscriptionStatus]);

  return {
    subscription,
    loading,
    error,
    subscriptionService,
    fetchSubscriptionStatus,
    createOrder,
    verifyPayment,
    isBasic: subscription?.currentPlan === 'basic',
    isPremium: subscription?.currentPlan === 'premium',
    isFree: subscription?.currentPlan === 'free',
    isActive: subscription?.isActive || false,
  };
};

// Error handling utilities
export const handleSubscriptionError = (error: any, showAlert?: (title: string, message: string) => void) => {
  console.error('Subscription error:', error);
  
  const errorMessage = error?.message || 'Something went wrong';
  
  if (error?.code === 'payment_cancelled') {
    showAlert?.('Payment Cancelled', 'You cancelled the payment. You can try again anytime.');
  } else if (error?.code === 'payment_failed') {
    showAlert?.('Payment Failed', `Payment failed: ${error.description || 'Please try again'}`);
  } else if (errorMessage.includes('already have')) {
    showAlert?.('Already Subscribed', errorMessage);
  } else if (errorMessage.includes('expired')) {
    showAlert?.('Subscription Expired', errorMessage);
  } else {
    showAlert?.('Error', errorMessage);
  }
};

// Format currency
export const formatCurrency = (amount: number, currency: string = '₹'): string => {
  return `${currency}${amount.toLocaleString('en-IN')}`;
};

// Calculate days remaining
export const calculateDaysRemaining = (expiresAt: string | null): number => {
  if (!expiresAt) return 0;
  const expiry = new Date(expiresAt);
  const now = new Date();
  const diffTime = expiry.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
};

/*
=== SETUP INSTRUCTIONS ===

1. Install Required Dependencies:
   npm install @react-native-async-storage/async-storage
   npm install react-native-razorpay

2. Update Configuration:
   - Replace API_BASE_URL with your actual backend URL
   - Replace RAZORPAY_KEY_ID with your actual Razorpay key
   - Ensure your JWT token is properly stored and retrieved

3. Update MembershipPage499.tsx:
   - Import and use the SubscriptionService or useSubscription hook
   - Replace hardcoded values with dynamic configuration

4. Example Usage in Component:

import { useSubscription, handleSubscriptionError } from './utils/subscriptionUtils';
import RazorpayCheckout from 'react-native-razorpay';

const MembershipPage = () => {
  const { createOrder, verifyPayment, loading } = useSubscription();

  const handlePayment = async () => {
    try {
      // Create order
      const orderData = await createOrder('premium');
      
      // Open Razorpay
      const paymentResult = await RazorpayCheckout.open({
        ...options,
        order_id: orderData.orderId,
      });
      
      // Verify payment
      await verifyPayment({
        razorpay_order_id: paymentResult.razorpay_order_id,
        razorpay_payment_id: paymentResult.razorpay_payment_id,
        razorpay_signature: paymentResult.razorpay_signature,
      });
      
    } catch (error) {
      handleSubscriptionError(error, Alert.alert);
    }
  };
};

5. Environment Variables:
   Create a .env file or config file with:
   - RAZORPAY_KEY_ID=your_razorpay_key
   - API_BASE_URL=your_backend_url

6. Testing:
   - Use your backend's simulate-payment endpoint for testing
   - Test with different scenarios (success, failure, cancellation)
   - Verify subscription status updates correctly

7. Production Checklist:
   - Switch to production Razorpay keys
   - Update API URLs to production
   - Test payment flows thoroughly
   - Implement proper error tracking
   - Add analytics for subscription events
*/