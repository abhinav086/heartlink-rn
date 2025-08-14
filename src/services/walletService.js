// services/walletService.js
import BASE_URL from '../config/config';

export const walletService = {
  // Get wallet summary (balance, total earned, etc.)
  getWalletSummary: async (token) => {
    try {
      const response = await fetch(`${BASE_URL}/api/v1/wallet/summary`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to fetch wallet summary');
      }
      return data;
    } catch (error) {
      console.error('Wallet summary service error:', error);
      throw error;
    }
  },

  // Get detailed wallet information
  getWalletDetails: async (token) => {
    try {
      const response = await fetch(`${BASE_URL}/api/v1/wallet/details`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to fetch wallet details');
      }
      return data;
    } catch (error) {
      console.error('Wallet details service error:', error);
      throw error;
    }
  },

  // Get transaction history with pagination and filters
  getTransactionHistory: async (token, { page = 1, limit = 20, type = null, source = null } = {}) => {
    try {
      let url = `${BASE_URL}/api/v1/wallet/transactions?page=${page}&limit=${limit}`;
      if (type) url += `&type=${type}`;
      if (source) url += `&source=${source}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to fetch transaction history');
      }
      return data;
    } catch (error) {
      console.error('Transaction history service error:', error);
      throw error;
    }
  },

  // ✅ ADDED: Function to get subscription payment history
  getSubscriptionHistory: async (token, { page = 1, limit = 50 } = {}) => {
    try {
      const url = `${BASE_URL}/api/v1/subscription/history?page=${page}&limit=${limit}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to fetch subscription history');
      }

      return data;
    } catch (error) {
      console.error('Subscription history service error:', error);
      throw error;
    }
  },

  // Get monthly statistics
  getMonthlyStats: async (token) => {
    try {
      const response = await fetch(`${BASE_URL}/api/v1/wallet/monthly-stats`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to fetch monthly stats');
      }
      return data;
    } catch (error) {
      console.error('Monthly stats service error:', error);
      throw error;
    }
  },

  // Get content creation limits
  getContentLimits: async (token) => {
    try {
      const response = await fetch(`${BASE_URL}/api/v1/posts/limits`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to fetch content limits');
      }
      return data;
    } catch (error) {
      console.error('Content limits service error:', error);
      throw error;
    }
  },

  // Get subscription status
  getSubscriptionStatus: async (token) => {
    try {
      const response = await fetch(`${BASE_URL}/api/v1/subscription/status`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to fetch subscription status');
      }
      return data;
    } catch (error) {
      console.error('Subscription status service error:', error);
      throw error;
    }
  },
};

export default walletService;