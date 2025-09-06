// src/App.js
import 'react-native-gesture-handler';
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { PermissionsAndroid, Platform, Alert, AppState, BackHandler } from 'react-native'; // Removed TouchableOpacity, Text, Linking
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { SocketProvider, useSocket } from './src/context/SocketContext';
import { CallProvider, useCall } from './src/context/CallManager';
import AppNavigator from './src/navigation/AppNavigator';
import SplashScreen from './src/screens/auth/SplashScreen';
import IncomingCallModal from './src/components/IncomingCallModal';
import enhancedGlobalWebRTCService from './src/services/EnhancedGlobalWebRTCService';
import AsyncStorage from '@react-native-async-storage/async-storage';
// Import your Firebase Service - this handles all Firebase Messaging logic
import FirebaseService from './src/services/FirebaseService';
// DO NOT import messaging directly here for initialization logic anymore
// import messaging from '@react-native-firebase/messaging'; // <- Remove direct import for init

const requestPermissions = async () => {
  try {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES,
        PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO,
        PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
        PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
        PermissionsAndroid.PERMISSIONS.CAMERA,
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        PermissionsAndroid.PERMISSIONS.MODIFY_AUDIO_SETTINGS,
      ]);
    }
  } catch (err) {
    console.error('Permission request error:', err);
  }
};

// Enhanced navigation theme to prevent gesture exit
const navigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
  },
};

const AppContent = () => {
  const { user, isLoading, isAuthenticated, checkOnboardingStatus, token } = useAuth(); // Get token directly from AuthContext
  const { socket, isConnected } = useSocket();
  const { setNavigationRef } = useCall();

  // ENHANCED: Global call state management
  const [incomingCallData, setIncomingCallData] = useState(null);
  const [showIncomingCall, setShowIncomingCall] = useState(false);
  const [authToken, setAuthToken] = useState(null); // Will sync with useAuth.token
  const [webrtcInitialized, setWebrtcInitialized] = useState(false);
  const [callbacksRegistered, setCallbacksRegistered] = useState(false);

  const [initialRoute, setInitialRoute] = useState(null);
  const [showSplash, setShowSplash] = useState(true);
  const [navigationReady, setNavigationReady] = useState(false);

  // Enhanced navigation state tracking
  const [navigationState, setNavigationState] = useState(null);
  const [canGoBack, setCanGoBack] = useState(false);

  const navigationRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);
  const incomingCallTimeoutRef = useRef(null);
  const lastBackPressTime = useRef(0);
  // Ref for the foreground message listener from FirebaseService (if needed for direct management)
  const firebaseForegroundListenerRef = useRef(null);

  useEffect(() => {
    const initializeApp = async () => {
      await requestPermissions();

      // --- DELEGATE FIREBASE INIT TO THE SERVICE ---
      console.log('🚀 Initializing Firebase via FirebaseService (no auth token for backend)...');
      // Pass NO parameters to the service initialize method
      await FirebaseService.initialize(); // Simplified call
      // --- END DELEGATION ---

      await new Promise((resolve) => setTimeout(resolve, 2000)); // Keep splash if needed
      setShowSplash(false);
    };
    initializeApp();

    // Cleanup on unmount
    return () => {
       if (incomingCallTimeoutRef.current) {
         clearTimeout(incomingCallTimeoutRef.current);
       }
       // If you stored the foreground listener from FirebaseService, unsubscribe here
       // if (firebaseForegroundListenerRef.current) {
       //    firebaseForegroundListenerRef.current(); // Call the unsubscribe function
       //    firebaseForegroundListenerRef.current = null;
       // }
       // Note: FirebaseService likely manages its own listener lifecycle via setupMessageHandlers/cleanup
    };
  }, []); // Remove token dependency if it was there and is no longer used for Firebase init

  // Monitor app state changes for call handling
  useEffect(() => {
    const handleAppStateChange = (nextAppState) => {
      console.log(`📱 App state changed: ${appStateRef.current} -> ${nextAppState}`);

      if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
        // App came to foreground - ensure WebRTC is active
        if (webrtcInitialized && !callbacksRegistered) {
          console.log('🔄 App became active, re-registering call callbacks');
          registerGlobalCallCallbacks();
        }
      }
      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [webrtcInitialized, callbacksRegistered]);

  // Sync authToken state with useAuth.token (redundant now, but kept for clarity)
  useEffect(() => {
     setAuthToken(token);
     // FirebaseService should handle token sending internally when token changes
     // via its own useEffect or logic within initialize/sendTokenToBackend calls
  }, [token]); // Depend only on token from useAuth

  // ENHANCED: Initialize WebRTC service with better error handling
  useEffect(() => {
    const initializeWebRTC = async () => {
      if (isAuthenticated && user && authToken && !webrtcInitialized) {
        try {
          console.log('🚀 Initializing WebRTC service...');
          await enhancedGlobalWebRTCService.initialize(authToken);
          setWebrtcInitialized(true);
          console.log('✅ WebRTC service initialized successfully');
        } catch (error) {
          console.error('❌ Failed to initialize WebRTC service:', error);
          Alert.alert('WebRTC Error', 'Failed to initialize calling service. Calls may not work properly.');
        }
      } else if (!isAuthenticated || !user || !authToken) {
        // Clean up WebRTC when user logs out
        if (webrtcInitialized) {
          try {
            enhancedGlobalWebRTCService.disconnect();
            setWebrtcInitialized(false);
            setCallbacksRegistered(false);
            console.log('🧹 WebRTC service cleaned up');
          } catch (error) {
            console.error('❌ Error cleaning up WebRTC:', error);
          }
        }
      }
    };

    initializeWebRTC();
  }, [isAuthenticated, user, authToken, webrtcInitialized]);

  // ENHANCED: Register global call callbacks separately for better reliability
  const registerGlobalCallCallbacks = useCallback(() => {
    if (webrtcInitialized && !callbacksRegistered) {
      try {
        console.log('📞 Registering global call callbacks...');
        enhancedGlobalWebRTCService.setGlobalCallbacks({
          onIncomingCall: handleIncomingCall,
          onError: handleWebRTCError,
          onCallStateChange: handleCallStateChange,
        });
        setCallbacksRegistered(true);
        console.log('✅ Global call callbacks registered successfully');
      } catch (error) {
        console.error('❌ Failed to register call callbacks:', error);
      }
    }
  }, [webrtcInitialized, callbacksRegistered]);

  // Register callbacks when WebRTC is initialized
  useEffect(() => {
    registerGlobalCallCallbacks();
  }, [registerGlobalCallCallbacks]);

  // ENHANCED: Listen for socket call events as backup
  useEffect(() => {
    if (socket && isConnected) {
      console.log('🔗 Setting up socket call event listeners...');

      // Primary incoming call handler via socket
      const handleIncomingCallSocket = (callData) => {
        console.log('📞 Incoming call via SOCKET:', JSON.stringify(callData, null, 2));
        handleIncomingCall(callData);
      };

      const handleCallEndedSocket = (callData) => {
        console.log('📴 Call ended via socket:', callData);
        handleCallStateChange('ended', callData);
      };

      const handleCallDeclinedSocket = (callData) => {
        console.log('❌ Call declined via socket:', callData);
        handleCallStateChange('declined', callData);
      };

      const handleCallMissedSocket = (callData) => {
        console.log('📞❌ Call missed via socket:', callData);
        handleCallStateChange('missed', callData);
      };

      socket.on('incoming_call', handleIncomingCallSocket);
      socket.on('call_ended', handleCallEndedSocket);
      socket.on('call_declined', handleCallDeclinedSocket);
      socket.on('call_missed', handleCallMissedSocket);

      // Cleanup socket listeners
      return () => {
        socket.off('incoming_call', handleIncomingCallSocket);
        socket.off('call_ended', handleCallEndedSocket);
        socket.off('call_declined', handleCallDeclinedSocket);
        socket.off('call_missed', handleCallMissedSocket);
      };
    }
  }, [socket, isConnected]);

  // ENHANCED: Handle incoming call with timeout and better validation
  const handleIncomingCall = useCallback((callData) => {
    console.log('📞 PROCESSING INCOMING CALL:', JSON.stringify(callData, null, 2));

    // Validate incoming call data
    if (!callData) {
      console.error('❌ No call data provided');
      return;
    }

    if (!callData.caller && !callData.from) {
      console.error('❌ No caller information in call ', callData);
      return;
    }

    // Normalize call data structure
    const normalizedCallData = {
      callId: callData.callId || callData.id,
      caller: callData.caller || callData.from,
      callee: callData.callee || callData.to || { id: user?._id, fullName: user?.fullName },
      callType: callData.callType || callData.type || 'video',
      timestamp: callData.timestamp || Date.now(),
      ...callData
    };

    // Don't show modal if already showing a call
    if (showIncomingCall) {
      console.log('⚠️ Already showing incoming call, ignoring new call');
      return;
    }

    console.log('📞 Setting incoming call data and showing modal');
    setIncomingCallData(normalizedCallData);
    setShowIncomingCall(true);

    // Set timeout to auto-dismiss call after 30 seconds
    if (incomingCallTimeoutRef.current) {
      clearTimeout(incomingCallTimeoutRef.current);
    }

    incomingCallTimeoutRef.current = setTimeout(() => {
      console.log('⏰ Incoming call timeout - auto dismissing');
      handleMissedCall();
    }, 30000);

  }, [showIncomingCall, user]);

  // Handle missed call (timeout)
  const handleMissedCall = useCallback(() => {
    if (incomingCallData) {
      try {
        enhancedGlobalWebRTCService.missedCall();
      } catch (error) {
        console.error('❌ Error handling missed call:', error);
      }
    }

    setShowIncomingCall(false);
    setIncomingCallData(null);

    if (incomingCallTimeoutRef.current) {
      clearTimeout(incomingCallTimeoutRef.current);
      incomingCallTimeoutRef.current = null;
    }
  }, [incomingCallData]);

  // Handle WebRTC errors
  const handleWebRTCError = useCallback((error) => {
    console.error('❌ WebRTC error in App.js:', error);
    setShowIncomingCall(false);
    setIncomingCallData(null);

    if (incomingCallTimeoutRef.current) {
      clearTimeout(incomingCallTimeoutRef.current);
      incomingCallTimeoutRef.current = null;
    }
  }, []);

  // Handle call state changes
  const handleCallStateChange = useCallback((type, data) => {
    console.log('🔄 Call state change in App.js:', type, data);

    switch (type) {
      case 'ended':
      case 'declined':
      case 'missed':
      case 'failed':
        setShowIncomingCall(false);
        setIncomingCallData(null);

        if (incomingCallTimeoutRef.current) {
          clearTimeout(incomingCallTimeoutRef.current);
          incomingCallTimeoutRef.current = null;
        }
        break;

      case 'accepted':
        // Call accepted, modal should already be hidden
        if (incomingCallTimeoutRef.current) {
          clearTimeout(incomingCallTimeoutRef.current);
          incomingCallTimeoutRef.current = null;
        }
        break;
    }
  }, []);

  // ENHANCED: Handle accept call with better error handling and navigation
  const handleAcceptCall = useCallback(async () => {
    try {
      console.log('✅ Accepting incoming call...');

      // Clear timeout
      if (incomingCallTimeoutRef.current) {
        clearTimeout(incomingCallTimeoutRef.current);
        incomingCallTimeoutRef.current = null;
      }

      // Hide the modal first
      setShowIncomingCall(false);

      // Accept the call through WebRTC service
      await enhancedGlobalWebRTCService.acceptCall();

      // Navigate to call screen with proper params
      if (navigationRef.current && incomingCallData) {
        console.log('🚀 Navigating to CallScreen with data:', {
          callType: incomingCallData.callType,
          callerData: incomingCallData.caller
        });

        navigationRef.current.navigate('CallScreen', {
          callType: incomingCallData.callType || 'video',
          isIncoming: true,
          callerData: incomingCallData.caller,
          calleeData: incomingCallData.callee || { id: user._id, fullName: user.fullName },
          callId: incomingCallData.callId,
          authToken: authToken,
          webrtcService: enhancedGlobalWebRTCService
        });
      } else {
        console.error('❌ Navigation ref or call data missing');
        throw new Error('Navigation failed');
      }

    } catch (error) {
      console.error('❌ Failed to accept call:', error);
      Alert.alert('Call Error', 'Failed to accept the call');
      setShowIncomingCall(false);
      setIncomingCallData(null);
    }
  }, [incomingCallData, user, authToken]);

  // ENHANCED: Handle decline call
  const handleDeclineCall = useCallback(async () => {
    try {
      console.log('❌ Declining incoming call...');

      // Clear timeout
      if (incomingCallTimeoutRef.current) {
        clearTimeout(incomingCallTimeoutRef.current);
        incomingCallTimeoutRef.current = null;
      }

      // Decline the call through WebRTC service
      await enhancedGlobalWebRTCService.declineCall();

    } catch (error) {
      console.error('❌ Failed to decline call:', error);
    } finally {
      setShowIncomingCall(false);
      setIncomingCallData(null);
    }
  }, []);

  // Handle dismiss call (same as decline)
  const handleDismissCall = useCallback(() => {
    console.log('🚫 Dismissing incoming call...');
    handleDeclineCall();
  }, [handleDeclineCall]);


  useEffect(() => {
    const determineInitialRoute = async () => {
      if (!isLoading) {
        if (isAuthenticated && user) {
          const onboardingStatus = await checkOnboardingStatus();

          if (onboardingStatus.completed) {
            setInitialRoute('HomeScreen');
          } else {
            setInitialRoute('Gender');
          }
        } else {
          setInitialRoute('Login');
        }
      }
    };
    determineInitialRoute();
  }, [isLoading, isAuthenticated, user, checkOnboardingStatus]);

  // ENHANCED NAVIGATION STATE TRACKING
  const handleNavigationStateChange = useCallback((state) => {
    if (state && navigationRef.current) {
      setNavigationState(state);
      const canGoBackNow = navigationRef.current.canGoBack();
      setCanGoBack(canGoBackNow);
      console.log('📍 Navigation state changed, canGoBack:', canGoBackNow);
    }
  }, []);

  // ENHANCED BACK NAVIGATION HANDLING - Covers both hardware and gesture navigation
  const handleBackPress = useCallback(() => {
    console.log('🔙 Back press detected, canGoBack:', canGoBack, 'navigationReady:', navigationReady);

    if (!navigationReady || !navigationRef.current) {
      console.log('⚠️ Navigation not ready, allowing default behavior');
      return false;
    }

    try {
      // If we can go back in the navigation stack
      if (canGoBack && navigationRef.current.canGoBack()) {
        console.log('📱 Going back in navigation stack');
        navigationRef.current.goBack();
        return true; // Prevent default behavior (exit app)
      } else {
        // Double-tap to exit functionality for better UX
        const currentTime = Date.now();
        const timeDifference = currentTime - lastBackPressTime.current;

        if (timeDifference < 2000) {
          console.log('🚪 Double tap detected, exiting app');
          BackHandler.exitApp();
          return true;
        } else {
          console.log('⚠️ Single tap detected, showing toast message');
          lastBackPressTime.current = currentTime;

          // You can replace this with a toast message
          Alert.alert(
            'Exit App',
            'Press back again to exit',
            [{ text: 'OK', style: 'cancel' }],
            { cancelable: true }
          );

          return true; // Prevent exit
        }
      }
    } catch (error) {
      console.error('❌ Error in back press handler:', error);
      return false; // Allow default behavior
    }
  }, [canGoBack, navigationReady]);

  // ENHANCED: Handle hardware back button AND gesture navigation
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', handleBackPress);
    return () => backHandler.remove();
  }, [handleBackPress]);

  // Enhanced navigation ready handler - CRUCIAL for FirebaseService
  const onNavigationReady = useCallback(() => {
    console.log('🚀 Navigation container ready');
    setNavigationReady(true);
    setNavigationRef(navigationRef.current); // Your existing call manager ref

    // --- SET NAVIGATION REF FOR FIREBASE SERVICE ---
    // This is essential for FirebaseService to handle notification taps
    if (navigationRef.current) {
      FirebaseService.setNavigationRef(navigationRef.current);
      console.log('🧭 Navigation ref also set for FirebaseService');
    }
    // --- END SETTING REF ---

    // Initial state update
    if (navigationRef.current) {
      const initialCanGoBack = navigationRef.current.canGoBack();
      setCanGoBack(initialCanGoBack);
      console.log('📍 Initial navigation state - canGoBack:', initialCanGoBack);
    }
  }, [setNavigationRef]); // Add setNavigationRef to deps if it's stable

  if (showSplash || isLoading || !initialRoute) {
    return <SplashScreen />;
  }

  return (
    <>
      {/* FCM TOKEN BUTTON REMOVED */}
      {/* <TouchableOpacity
        onPress={showFCMToken}
        style={{
          position: 'absolute',
          top: 60,
          right: 20,
          backgroundColor: '#007AFF',
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 20,
          zIndex: 9999,
          elevation: 5,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 3.84,
        }}
      >
        <Text style={{ color: 'white', fontSize: 12, fontWeight: 'bold' }}>
          FCM Token
        </Text>
      </TouchableOpacity> */}

      <NavigationContainer
        ref={navigationRef}
        theme={navigationTheme}
        onReady={onNavigationReady} // This triggers setting the nav ref for FirebaseService
        onStateChange={handleNavigationStateChange}
        // Additional navigation options to prevent gesture exit
        screenOptions={{
          gestureEnabled: true,
          gestureDirection: 'horizontal',
        }}
      >
        <AppNavigator initialRouteName={initialRoute} />
      </NavigationContainer>

      {/* ENHANCED: Global incoming call modal - always rendered for global coverage */}
      <IncomingCallModal
        visible={showIncomingCall}
        callerData={incomingCallData?.caller}
        callType={incomingCallData?.callType || 'video'}
        onAccept={handleAcceptCall}
        onDecline={handleDeclineCall}
        onDismiss={handleDismissCall}
      />
    </>
  );
};

const App = () => {
  return (
    <GestureHandlerRootView
      style={{ flex: 1 }}
      // Enhanced gesture handler configuration
    >
      <AuthProvider>
        <SocketProvider>
          <CallProvider>
            <AppContent />
          </CallProvider>
        </SocketProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
};

export default App;