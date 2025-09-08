// src/App.js
import 'react-native-gesture-handler';
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { PermissionsAndroid, Platform, Alert, AppState, BackHandler } from 'react-native';
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
import FirebaseService from './src/services/FirebaseService';

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

// Define root screens for exit behavior
const ROOT_SCREENS = [
  'HomeScreen',
  'Login', 
  'Splash',
  'Gender',
  'Questions', 
  'ProfileSetup',
  'Memberships'
];

const AppContent = () => {
  const { user, isLoading, isAuthenticated, checkOnboardingStatus, token } = useAuth();
  const { socket, isConnected } = useSocket();
  const { setNavigationRef } = useCall();

  // ENHANCED: Global call state management
  const [incomingCallData, setIncomingCallData] = useState(null);
  const [showIncomingCall, setShowIncomingCall] = useState(false);
  const [authToken, setAuthToken] = useState(null);
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
  const firebaseForegroundListenerRef = useRef(null);

  useEffect(() => {
    const initializeApp = async () => {
      await requestPermissions();

      console.log('🚀 Initializing Firebase via FirebaseService (no auth token for backend)...');
      await FirebaseService.initialize();

      await new Promise((resolve) => setTimeout(resolve, 2000));
      setShowSplash(false);
    };
    initializeApp();

    return () => {
       if (incomingCallTimeoutRef.current) {
         clearTimeout(incomingCallTimeoutRef.current);
       }
    };
  }, []);

  useEffect(() => {
    const handleAppStateChange = (nextAppState) => {
      console.log(`📱 App state changed: ${appStateRef.current} -> ${nextAppState}`);

      if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
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

  useEffect(() => {
     setAuthToken(token);
  }, [token]);

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

  useEffect(() => {
    registerGlobalCallCallbacks();
  }, [registerGlobalCallCallbacks]);

  useEffect(() => {
    if (socket && isConnected) {
      console.log('🔗 Setting up socket call event listeners...');

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

      return () => {
        socket.off('incoming_call', handleIncomingCallSocket);
        socket.off('call_ended', handleCallEndedSocket);
        socket.off('call_declined', handleCallDeclinedSocket);
        socket.off('call_missed', handleCallMissedSocket);
      };
    }
  }, [socket, isConnected]);

  const handleIncomingCall = useCallback((callData) => {
    console.log('📞 PROCESSING INCOMING CALL:', JSON.stringify(callData, null, 2));

    if (!callData) {
      console.error('❌ No call data provided');
      return;
    }

    if (!callData.caller && !callData.from) {
      console.error('❌ No caller information in call ', callData);
      return;
    }

    const normalizedCallData = {
      callId: callData.callId || callData.id,
      caller: callData.caller || callData.from,
      callee: callData.callee || callData.to || { id: user?._id, fullName: user?.fullName },
      callType: callData.callType || callData.type || 'video',
      timestamp: callData.timestamp || Date.now(),
      ...callData
    };

    if (showIncomingCall) {
      console.log('⚠️ Already showing incoming call, ignoring new call');
      return;
    }

    console.log('📞 Setting incoming call data and showing modal');
    setIncomingCallData(normalizedCallData);
    setShowIncomingCall(true);

    if (incomingCallTimeoutRef.current) {
      clearTimeout(incomingCallTimeoutRef.current);
    }

    incomingCallTimeoutRef.current = setTimeout(() => {
      console.log('⏰ Incoming call timeout - auto dismissing');
      handleMissedCall();
    }, 30000);

  }, [showIncomingCall, user]);

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

  const handleWebRTCError = useCallback((error) => {
    console.error('❌ WebRTC error in App.js:', error);
    setShowIncomingCall(false);
    setIncomingCallData(null);

    if (incomingCallTimeoutRef.current) {
      clearTimeout(incomingCallTimeoutRef.current);
      incomingCallTimeoutRef.current = null;
    }
  }, []);

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
        if (incomingCallTimeoutRef.current) {
          clearTimeout(incomingCallTimeoutRef.current);
          incomingCallTimeoutRef.current = null;
        }
        break;
    }
  }, []);

  const handleAcceptCall = useCallback(async () => {
    try {
      console.log('✅ Accepting incoming call...');

      if (incomingCallTimeoutRef.current) {
        clearTimeout(incomingCallTimeoutRef.current);
        incomingCallTimeoutRef.current = null;
      }

      setShowIncomingCall(false);

      await enhancedGlobalWebRTCService.acceptCall();

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

  const handleDeclineCall = useCallback(async () => {
    try {
      console.log('❌ Declining incoming call...');

      if (incomingCallTimeoutRef.current) {
        clearTimeout(incomingCallTimeoutRef.current);
        incomingCallTimeoutRef.current = null;
      }

      await enhancedGlobalWebRTCService.declineCall();

    } catch (error) {
      console.error('❌ Failed to decline call:', error);
    } finally {
      setShowIncomingCall(false);
      setIncomingCallData(null);
    }
  }, []);

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

  // Helper function to get current route name
  const getCurrentRouteName = (navigationState) => {
    if (!navigationState) return null;
    
    const route = navigationState.routes[navigationState.index];
    if (route.state) {
      return getCurrentRouteName(route.state);
    }
    return route.name;
  };

  // ENHANCED NAVIGATION STATE TRACKING
  const handleNavigationStateChange = useCallback((state) => {
    if (state && navigationRef.current) {
      setNavigationState(state);
      const currentRouteName = getCurrentRouteName(state);
      const canGoBackNow = navigationRef.current.canGoBack();
      setCanGoBack(canGoBackNow);
      console.log('📍 Navigation state changed, current route:', currentRouteName, 'canGoBack:', canGoBackNow);
    }
  }, []);

  // FIXED BACK NAVIGATION HANDLING
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
        return true;
      } else {
        // Check if we're on a root screen
        const currentRoute = navigationRef.current.getCurrentRoute();
        const isOnRootScreen = ROOT_SCREENS.includes(currentRoute?.name);
        
        if (isOnRootScreen) {
          // Double-tap to exit functionality when on root screen
          const currentTime = Date.now();
          const timeDifference = currentTime - lastBackPressTime.current;

          if (timeDifference < 2000) {
            console.log('🚪 Double tap detected, exiting app');
            BackHandler.exitApp();
            return true;
          } else {
            console.log('⚠️ Single tap detected, showing exit message');
            lastBackPressTime.current = currentTime;

            Alert.alert(
              'Exit App',
              'Press back again to exit',
              [{ text: 'OK', style: 'cancel' }]
            );

            return true;
          }
        } else {
          // Navigate to home screen if not on root screen
          console.log('🏠 Navigating to home screen');
          navigationRef.current.reset({
            index: 0,
            routes: [{ name: 'HomeScreen' }],
          });
          return true;
        }
      }
    } catch (error) {
      console.error('❌ Error in back press handler:', error);
      return false;
    }
  }, [canGoBack, navigationReady]);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', handleBackPress);
    return () => backHandler.remove();
  }, [handleBackPress]);

  const onNavigationReady = useCallback(() => {
    console.log('🚀 Navigation container ready');
    setNavigationReady(true);
    setNavigationRef(navigationRef.current);

    if (navigationRef.current) {
      FirebaseService.setNavigationRef(navigationRef.current);
      console.log('🧭 Navigation ref also set for FirebaseService');
    }

    if (navigationRef.current) {
      const initialCanGoBack = navigationRef.current.canGoBack();
      setCanGoBack(initialCanGoBack);
      console.log('📍 Initial navigation state - canGoBack:', initialCanGoBack);
    }
  }, [setNavigationRef]);

  if (showSplash || isLoading || !initialRoute) {
    return <SplashScreen />;
  }

  return (
    <>
      <NavigationContainer
        ref={navigationRef}
        theme={navigationTheme}
        onReady={onNavigationReady}
        onStateChange={handleNavigationStateChange}
        screenOptions={{
          gestureEnabled: true,
          gestureDirection: 'horizontal',
        }}
      >
        <AppNavigator initialRouteName={initialRoute} />
      </NavigationContainer>

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
    <GestureHandlerRootView style={{ flex: 1 }}>
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