// App.js - ENHANCED GLOBAL CALL RECEPTION

import 'react-native-gesture-handler';
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { PermissionsAndroid, Platform, Alert, AppState } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { SocketProvider, useSocket } from './src/context/SocketContext';
import { CallProvider, useCall } from './src/context/CallManager';
import AppNavigator from './src/navigation/AppNavigator';
import SplashScreen from './src/screens/auth/SplashScreen';
import IncomingCallModal from './src/components/IncomingCallModal';
import enhancedGlobalWebRTCService from './src/services/EnhancedGlobalWebRTCService';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

const AppContent = () => {
  const { user, isLoading, isAuthenticated, checkOnboardingStatus } = useAuth();
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
  
  const navigationRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);
  const incomingCallTimeoutRef = useRef(null);

  useEffect(() => {
    const initializeApp = async () => {
      await requestPermissions();
      await new Promise((resolve) => setTimeout(resolve, 2000));
      setShowSplash(false);
    };
    initializeApp();
  }, []);

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

  // Get auth token when user changes
  useEffect(() => {
    const getAuthToken = async () => {
      if (user && isAuthenticated) {
        try {
          let token = await AsyncStorage.getItem('authToken');
          if (!token && user.token) token = user.token;
          if (!token && user.authToken) token = user.authToken;
          
          if (token) {
            setAuthToken(token);
            console.log('🔐 Auth token retrieved for WebRTC initialization');
          } else {
            console.warn('⚠️ No auth token found');
          }
        } catch (error) {
          console.error('❌ Error retrieving auth token:', error);
        }
      } else {
        setAuthToken(null);
        setWebrtcInitialized(false);
        setCallbacksRegistered(false);
      }
    };
    getAuthToken();
  }, [user, isAuthenticated]);

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
      socket.on('incoming_call', (callData) => {
        console.log('📞 Incoming call via SOCKET:', JSON.stringify(callData, null, 2));
        handleIncomingCall(callData);
      });

      socket.on('call_ended', (callData) => {
        console.log('📴 Call ended via socket:', callData);
        handleCallStateChange('ended', callData);
      });

      socket.on('call_declined', (callData) => {
        console.log('❌ Call declined via socket:', callData);
        handleCallStateChange('declined', callData);
      });

      socket.on('call_missed', (callData) => {
        console.log('📞❌ Call missed via socket:', callData);
        handleCallStateChange('missed', callData);
      });

      // Cleanup socket listeners
      return () => {
        socket.off('incoming_call');
        socket.off('call_ended');
        socket.off('call_declined');
        socket.off('call_missed');
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
      console.error('❌ No caller information in call data:', callData);
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

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (incomingCallTimeoutRef.current) {
        clearTimeout(incomingCallTimeoutRef.current);
      }
    };
  }, []);

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

  const onNavigationReady = () => {
    setNavigationRef(navigationRef.current);
    console.log('🚀 Navigation ready, ref set');
  };

  if (showSplash || isLoading || !initialRoute) {
    return <SplashScreen />;
  }

  return (
    <>
      <NavigationContainer 
        ref={navigationRef}
        onReady={onNavigationReady}
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