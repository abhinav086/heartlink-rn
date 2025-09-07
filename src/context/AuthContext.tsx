//  src/context/AuthContext.tsx
import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import DeviceInfo from 'react-native-device-info';
import BASE_URL from '../config/config';
import FirebaseService from '../services/FirebaseService';

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
  // FCM Debug Methods
  checkUserFCMStatus: () => Promise<any>;
  manualFCMTokenRegistration: () => Promise<{ success: boolean; message?: string }>;
  debugFCMTokens: () => Promise<any>;
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
        } else {
          // For existing logged-in users, check FCM token status
          console.log('🔄 Checking FCM token status for existing user...');
          setTimeout(() => {
            checkAndHandleFCMTokens(storedToken);
          }, 2000); // Give Firebase time to initialize
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
      await AsyncStorage.multiRemove(['token', 'user', 'onboardingCompleted', 'fcm_popup_shown_session']);
      setToken(null);
      setUser(null);
    } catch (error) {
      console.error('Error clearing auth data:', error);
    }
  };

  // Enhanced FCM token checking for existing users
  const checkAndHandleFCMTokens = async (authToken: string) => {
    try {
      console.log('🔍 Checking FCM token status for existing user...');
      
      // Check if user already has FCM tokens
      const fcmStatus = await checkUserFCMTokenStatus(authToken);
      
      if (!fcmStatus.hasActiveTokens) {
        console.log('⚠️ Existing user has no active FCM tokens. Attempting registration...');
        
        // Initialize Firebase if not already done
        await FirebaseService.initialize(authToken);
        
        // Try to register FCM token
        const registrationResult = await performFCMTokenRegistration(authToken);
        
        if (registrationResult.success) {
          console.log('✅ FCM token registered for existing user');
          FirebaseService.showTokenValidPopup();
          await AsyncStorage.setItem('fcm_popup_shown_session', 'true');
        } else {
          console.log('❌ Failed to register FCM token for existing user:', registrationResult.error);
        }
      } else {
        console.log('✅ Existing user already has active FCM tokens');
      }
    } catch (error) {
      console.error('❌ Error checking FCM tokens for existing user:', error);
    }
  };

  // Check user's FCM token status with backend
  const checkUserFCMTokenStatus = async (authToken: string) => {
    try {
      const response = await fetch(`${BASE_URL}/api/v1/fcm/debug-user-tokens`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        return data.data;
      } else {
        console.error('Failed to check FCM token status:', response.status);
        return { hasActiveTokens: false, totalTokens: 0 };
      }
    } catch (error) {
      console.error('Error checking FCM token status:', error);
      return { hasActiveTokens: false, totalTokens: 0 };
    }
  };

  // Perform FCM token registration
  const performFCMTokenRegistration = async (authToken: string) => {
    try {
      // Get FCM token from Firebase
      const fcmToken = await FirebaseService.getFCMToken();
      if (!fcmToken) {
        return { success: false, error: 'Failed to get FCM token from Firebase' };
      }

      // Get device info
      const deviceId = await DeviceInfo.getUniqueId();
      const deviceType = Platform.OS;

      // Register with backend
      const response = await fetch(`${BASE_URL}/api/v1/fcm/register-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          fcmToken: fcmToken,
          deviceType: deviceType,
          deviceId: deviceId,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ FCM token registered successfully:', data.message);
        return { success: true, data: data.data };
      } else {
        const errorData = await response.json();
        console.error('❌ Failed to register FCM token:', errorData.message);
        return { success: false, error: errorData.message };
      }
    } catch (error) {
      console.error('❌ Error registering FCM token:', error);
      return { success: false, error: error.message };
    }
  };

  // FCM Token validation flow for new logins
  const checkAndRefreshFCMToken = async (authToken: string) => {
    try {
      console.log('🔍 Starting FCM token validation flow...');

      // Check if we already showed the popup for this session
      const popupShown = await AsyncStorage.getItem('fcm_popup_shown_session');
      if (popupShown === 'true') {
        console.log('⏭️ FCM popup already shown this session, skipping...');
        return;
      }

      // Check if current FCM token is valid
      const isTokenValid = await FirebaseService.checkFCMTokenValidity(authToken);
      
      if (!isTokenValid) {
        console.log('🔄 FCM token invalid, refreshing...');
        
        // Refresh FCM token
        const refreshSuccess = await FirebaseService.refreshFCMTokenIfNeeded(authToken);
        
        if (refreshSuccess) {
          console.log('✅ FCM token refreshed successfully, showing popup');
          
          // Show popup using FirebaseService
          FirebaseService.showTokenValidPopup();
          
          // Mark popup as shown for this session
          await AsyncStorage.setItem('fcm_popup_shown_session', 'true');
        } else {
          console.log('❌ Failed to refresh FCM token');
        }
      } else {
        console.log('✅ FCM token is already valid');
        
        // Still show popup to confirm token is valid
        FirebaseService.showTokenValidPopup();
        await AsyncStorage.setItem('fcm_popup_shown_session', 'true');
      }
    } catch (error) {
      console.error('❌ Error in FCM token validation flow:', error);
    }
  };

  const storeAuthData = async (authToken: string, userData: User) => {
    try {
      await AsyncStorage.setItem('token', authToken);
      await AsyncStorage.setItem('user', JSON.stringify(userData));
      await AsyncStorage.setItem('onboardingCompleted', userData.onboardingCompleted.toString());
      setToken(authToken);
      setUser(userData);

      // Clear previous session's popup flag on new login
      await AsyncStorage.removeItem('fcm_popup_shown_session');
      
      // Initialize Firebase and check FCM token
      await FirebaseService.initialize(authToken);
      
      // Check and refresh FCM token if needed (with small delay to ensure Firebase is ready)
      setTimeout(() => {
        checkAndRefreshFCMToken(authToken);
      }, 1000);
      
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

        // Clean up Firebase
        await FirebaseService.cleanup(token);
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

  // FCM Debug Methods
  const checkUserFCMStatus = async () => {
    try {
      if (!token) {
        throw new Error('No authentication token');
      }

      console.log('🔍 Checking user FCM status...');
      const fcmStatus = await checkUserFCMTokenStatus(token);
      console.log('📊 FCM Status:', fcmStatus);
      return fcmStatus;
    } catch (error) {
      console.error('❌ Error checking FCM status:', error);
      return { hasActiveTokens: false, totalTokens: 0, error: error.message };
    }
  };

  const manualFCMTokenRegistration = async (): Promise<{ success: boolean; message?: string }> => {
    try {
      if (!token) {
        throw new Error('No authentication token');
      }

      console.log('🔧 Starting manual FCM token registration...');
      
      // Initialize Firebase if needed
      await FirebaseService.initialize(token);
      
      // Register FCM token
      const result = await performFCMTokenRegistration(token);
      
      if (result.success) {
        console.log('✅ Manual FCM token registration successful');
        FirebaseService.showTokenValidPopup();
        return { success: true, message: 'FCM token registered successfully' };
      } else {
        console.log('❌ Manual FCM token registration failed:', result.error);
        return { success: false, message: result.error };
      }
    } catch (error) {
      console.error('❌ Error in manual FCM registration:', error);
      return { success: false, message: error.message };
    }
  };

  const debugFCMTokens = async () => {
    try {
      if (!token) {
        throw new Error('No authentication token');
      }

      console.log('🔧 Debug: Full FCM token information...');
      
      // Get FCM status
      const fcmStatus = await checkUserFCMStatus();
      
      // Get Firebase service status
      const firebaseStatus = FirebaseService.getStatus();
      
      const debugInfo = {
        authToken: !!token,
        user: user ? { id: user._id, fullName: user.fullName } : null,
        fcmStatus,
        firebaseStatus,
        deviceInfo: {
          platform: Platform.OS,
          deviceId: await DeviceInfo.getUniqueId().catch(() => 'unknown'),
        },
        asyncStorageFlags: {
          fcmPopupShown: await AsyncStorage.getItem('fcm_popup_shown_session'),
          tokenRegistered: await AsyncStorage.getItem('fcm_token_registered'),
        }
      };
      
      console.log('🔧 Complete FCM Debug Info:', debugInfo);
      return debugInfo;
    } catch (error) {
      console.error('❌ Error in FCM debug:', error);
      return { error: error.message };
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
    // FCM Debug Methods
    checkUserFCMStatus,
    manualFCMTokenRegistration,
    debugFCMTokens,
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