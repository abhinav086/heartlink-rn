//  src/context/AuthContext.tsx
import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import BASE_URL from '../config/config';

export interface User {
  _id: string;
  email: string;
  fullName: string;
  username?: string; 
  phoneNumber?: string;
  role: string;
  gender?: string;
  hobbies?: string[];
  giftPreferences?: string[];
  dateSpots?: string[];
  onboardingCompleted: boolean;
  createdAt: string;
  updatedAt: string;

  profilePic?: string;
  photoUrl?: string;
  avatar?: string;
  photo?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  googleLogin: (idToken: string) => Promise<{ success: boolean; message?: string }>;
  register: (userData: RegisterData) => Promise<{ success: boolean; message?: string }>;
  logout: () => Promise<void>;
  updateUser: (userData: Partial<User>) => void;
  checkOnboardingStatus: () => Promise<{ completed: boolean; hasGender: boolean; hasPreferences: boolean }>;
  refreshToken: () => Promise<boolean>;
}

interface RegisterData {
  email: string;
  password: string;
  fullName: string;
  phoneNumber?: string;
  role?: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = !!token && !!user;

  // Initialize auth state from AsyncStorage
  useEffect(() => {
    initializeAuth();
  }, []);

  const initializeAuth = async () => {
    try {
      setIsLoading(true);
      const storedToken = await AsyncStorage.getItem('token');
      const storedUser = await AsyncStorage.getItem('user');

      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
        
        // Verify token is still valid by checking onboarding status
        const isValid = await verifyToken(storedToken);
        if (!isValid) {
          await clearAuthData();
        }
      }
    } catch (error) {
      console.error('Error initializing auth:', error);
      await clearAuthData();
    } finally {
      setIsLoading(false);
    }
  };

  const verifyToken = async (authToken: string): Promise<boolean> => {
    try {
      const response = await fetch(`${BASE_URL}/api/v1/users/onboarding/my-status`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      return response.ok;
    } catch (error) {
      console.error('Token verification failed:', error);
      return false;
    }
  };

  const clearAuthData = async () => {
    try {
      await AsyncStorage.multiRemove(['token', 'user', 'onboardingCompleted']);
      setToken(null);
      setUser(null);
    } catch (error) {
      console.error('Error clearing auth data:', error);
    }
  };

  const storeAuthData = async (authToken: string, userData: User) => {
    try {
      await AsyncStorage.setItem('token', authToken);
      await AsyncStorage.setItem('user', JSON.stringify(userData));
      await AsyncStorage.setItem('onboardingCompleted', userData.onboardingCompleted.toString());
      setToken(authToken);
      setUser(userData);
    } catch (error) {
      console.error('Error storing auth data:', error);
      throw new Error('Failed to store authentication data');
    }
  };

  const login = async (email: string, password: string): Promise<{ success: boolean; message?: string }> => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      console.log('🔄 Starting email/password login...');

      const response = await fetch(`${BASE_URL}/api/v1/users/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const data = await response.json();

      console.log('📡 Login response:', {
        status: response.status,
        ok: response.ok,
        hasToken: !!data.data?.accessToken,
        hasUser: !!data.data?.user
      });

      if (response.ok) {
        if (!data.data?.accessToken || !data.data?.user?._id) {
          throw new Error('Invalid response: Token or User ID missing');
        }

        await storeAuthData(data.data.accessToken, data.data.user);
        console.log('✅ Email/password login successful');
        return { success: true };
      } else {
        return { success: false, message: data.message || 'Login failed' };
      }
    } catch (error: any) {
      console.error('❌ Login Error:', error);
      let errorMessage = 'Something went wrong';
      
      if (error.name === 'AbortError') {
        errorMessage = 'Request timed out. Please check your connection.';
      } else if (error.message.includes('JSON')) {
        errorMessage = 'Invalid server response.';
      } else {
        errorMessage = error.message || 'Unknown error';
      }
      
      return { success: false, message: errorMessage };
    }
  };

  const googleLogin = async (idToken: string): Promise<{ success: boolean; message?: string }> => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      console.log('🔄 Starting Google login with ID token...');

      const response = await fetch(`${BASE_URL}/api/v1/users/google-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const data = await response.json();

      console.log('📡 Google login response:', {
        status: response.status,
        ok: response.ok,
        hasToken: !!data.data?.accessToken,
        hasUser: !!data.data?.user,
        message: data.message
      });

      if (response.ok) {
        if (!data.data?.accessToken || !data.data?.user?._id) {
          throw new Error('Invalid response: Token or User ID missing');
        }

        await storeAuthData(data.data.accessToken, data.data.user);
        console.log('✅ Google login successful');
        return { success: true };
      } else {
        console.log('❌ Google login failed:', data.message);
        return { success: false, message: data.message || 'Google login failed' };
      }
    } catch (error: any) {
      console.error('❌ Google Login Error:', error);
      let errorMessage = 'Google login failed';
      
      if (error.name === 'AbortError') {
        errorMessage = 'Request timed out. Please check your connection.';
      } else if (error.message.includes('JSON')) {
        errorMessage = 'Invalid server response.';
      } else {
        errorMessage = error.message || 'Unknown error';
      }
      
      return { success: false, message: errorMessage };
    }
  };

  const register = async (userData: RegisterData): Promise<{ success: boolean; message?: string }> => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      console.log('🔄 Starting registration...');

      const response = await fetch(`${BASE_URL}/api/v1/users/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const data = await response.json();

      console.log('📡 Registration response:', {
        status: response.status,
        ok: response.ok,
        hasToken: !!data.data?.accessToken,
        hasUser: !!data.data?.user
      });

      if (response.ok) {
        if (!data.data?.accessToken || !data.data?.user?._id) {
          throw new Error('Invalid response: Token or User ID missing');
        }

        await storeAuthData(data.data.accessToken, data.data.user);
        console.log('✅ Registration successful');
        return { success: true };
      } else {
        return { success: false, message: data.message || 'Registration failed' };
      }
    } catch (error: any) {
      console.error('❌ Registration Error:', error);
      let errorMessage = 'Something went wrong';
      
      if (error.name === 'AbortError') {
        errorMessage = 'Request timed out. Please check your connection.';
      } else if (error.message.includes('JSON')) {
        errorMessage = 'Invalid server response.';
      } else {
        errorMessage = error.message || 'Unknown error';
      }
      
      return { success: false, message: errorMessage };
    }
  };

  const logout = async (): Promise<void> => {
    try {
      console.log('🔄 Starting logout...');
      
      if (token) {
        // Call logout endpoint to invalidate refresh token
        await fetch(`${BASE_URL}/api/v1/users/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
      }
      
      console.log('✅ Logout successful');
    } catch (error) {
      console.error('❌ Logout API call failed:', error);
    } finally {
      await clearAuthData();
    }
  };

  const updateUser = (userData: Partial<User>) => {
    if (user) {
      const updatedUser = { ...user, ...userData };
      setUser(updatedUser);
      AsyncStorage.setItem('user', JSON.stringify(updatedUser));
      
      // Update onboarding status in AsyncStorage if it changed
      if (userData.onboardingCompleted !== undefined) {
        AsyncStorage.setItem('onboardingCompleted', userData.onboardingCompleted.toString());
      }
      
      console.log('✅ User updated:', Object.keys(userData));
    }
  };

  const checkOnboardingStatus = async (): Promise<{ completed: boolean; hasGender: boolean; hasPreferences: boolean }> => {
    try {
      if (!token) {
        throw new Error('No authentication token');
      }

      console.log('🔄 Checking onboarding status...');

      const response = await fetch(`${BASE_URL}/api/v1/users/onboarding/my-status`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        const status = {
          completed: data.data.onboardingCompleted || false,
          hasGender: data.data.hasGender || false,
          hasPreferences: data.data.hasPreferences || false,
        };
        
        console.log('✅ Onboarding status:', status);
        return status;
      } else {
        throw new Error('Failed to fetch onboarding status');
      }
    } catch (error) {
      console.error('❌ Error checking onboarding status:', error);
      return { completed: false, hasGender: false, hasPreferences: false };
    }
  };

  const refreshToken = async (): Promise<boolean> => {
    try {
      console.log('🔄 Refreshing token...');
      
      const response = await fetch(`${BASE_URL}/api/v1/users/refresh-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.data?.accessToken) {
          setToken(data.data.accessToken);
          await AsyncStorage.setItem('token', data.data.accessToken);
          console.log('✅ Token refresh successful');
          return true;
        }
      }
      
      // If refresh fails, clear auth data
      console.log('❌ Token refresh failed, clearing auth data');
      await clearAuthData();
      return false;
    } catch (error) {
      console.error('❌ Token refresh failed:', error);
      await clearAuthData();
      return false;
    }
  };

  const value: AuthContextType = {
    user,
    token,
    isLoading,
    isAuthenticated,
    login,
    googleLogin,
    register,
    logout,
    updateUser,
    checkOnboardingStatus,
    refreshToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};