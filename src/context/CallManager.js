// src/context/CallManager.js - FIXED: Proper WebRTC connection establishment with Ringtone Effects (FULL UPDATED)
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Alert, AppState } from 'react-native';
import { useAuth } from './AuthContext';
import { useSocket } from './SocketContext';
import enhancedGlobalWebRTCService from '../services/EnhancedGlobalWebRTCService';
import BASE_URL from '../config/config';
import InCallManager from 'react-native-incall-manager';

const CallContext = createContext();

export const useCall = () => {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error('useCall must be used within a CallProvider');
  }
  return context;
};

export const CallProvider = ({ children }) => {
  // ============ STATE ============
  const [isInCall, setIsInCall] = useState(false);
  const [currentCall, setCurrentCall] = useState(null);
  const [incomingCall, setIncomingCall] = useState(null);
  const [showIncomingCallModal, setShowIncomingCallModal] = useState(false);

  // ============ HOOKS ============
  const { user, token } = useAuth();
  const { socket } = useSocket();
  
  // ============ REFS ============
  const navigationRef = useRef(null);
  const callTimeoutRef = useRef(null);

  // ============ WEBRTC SERVICE INITIALIZATION ============
  useEffect(() => {
    const initializeWebRTCService = async () => {
      if (token && !enhancedGlobalWebRTCService.isReady()) {
        try {
          console.log('🔧 Initializing Enhanced WebRTC Service...');
          await enhancedGlobalWebRTCService.initialize(token);
          
          // Set global callbacks for incoming calls
          enhancedGlobalWebRTCService.setGlobalCallbacks({
            onIncomingCall: handleWebRTCIncomingCall,
            onCallStateChange: handleWebRTCStateChange,
            onError: handleWebRTCError,
          });
          
          console.log('✅ Enhanced WebRTC Service initialized successfully');
        } catch (error) {
          console.error('❌ Failed to initialize Enhanced WebRTC Service:', error);
        }
      }
    };

    initializeWebRTCService();
  }, [token]);

  // ============ HELPER FUNCTIONS ============
  
  // Store navigation reference for use in context
  const setNavigationRef = (navRef) => {
    navigationRef.current = navRef;
    console.log('🎯 Navigation ref set in CallManager');
  };

  // ============ WEBRTC EVENT HANDLERS ============
  
  const handleWebRTCIncomingCall = (data) => {
    console.log('📞 WebRTC incoming call received:', data);
    console.log(`🔔 Starting ringtone for ${data.callType || 'unknown'} call...`); // 👈 ENHANCED LOGGING

    if (isInCall) {
      console.log('⚠️ Already in call, auto-declining incoming call');
      enhancedGlobalWebRTCService.declineCall();
      return;
    }

    // Set incoming call state
    setIncomingCall(data);
    setShowIncomingCallModal(true);
    
    // 🔔 START INCOMING RINGTONE — WORKS FOR BOTH AUDIO & VIDEO
    InCallManager.startRingtone('_BUNDLE_');
  };

  const handleWebRTCStateChange = (type, data) => {
    console.log('🔄 WebRTC state change:', type, data);
    
    switch (type) {
      case 'accepted':
        console.log('✅ Call accepted, connection should start automatically');
        // 🔕 STOP OUTGOING RINGTONE
        InCallManager.stopRingback();
        break;
      case 'declined':
        console.log('❌ Call declined');
        // 🔕 STOP OUTGOING RINGTONE
        InCallManager.stopRingback();
        Alert.alert('Call Declined', 'The user declined your call');
        endCall(currentCall?.callId, 0, 'declined');
        break;
      case 'ended':
        console.log('🔚 Call ended remotely');
        // 🔕 STOP ALL RINGTONES
        InCallManager.stopRingtone();
        InCallManager.stopRingback();
        endCall(currentCall?.callId, data.duration || 0, 'remote_end');
        break;
      case 'connection':
        if (data.state === 'connected') {
          console.log('🎉 WebRTC connection established successfully!');
          // 🔕 STOP ALL RINGTONES WHEN CONNECTED
          InCallManager.stopRingtone();
          InCallManager.stopRingback();
        }
        break;
    }
  };

  const handleWebRTCError = (error) => {
    console.error('❌ WebRTC error:', error);
    Alert.alert('Call Error', error.message || 'An error occurred during the call');
    
    // 🔕 STOP ALL RINGTONES ON ERROR — 👈 ENHANCED
    InCallManager.stopRingtone();
    InCallManager.stopRingback();

    // Clean up on error
    if (currentCall) {
      endCall(currentCall.callId, 0, 'error');
    }
  };

  // ============ CORE CALL FUNCTIONS ============

  /**
   * Initiate a call to another user - FIXED: Proper WebRTC integration
   */
  const initiateCall = async (receiverId, callType = 'audio', receiverData = {}) => {
    try {
      console.log('📞 Initiating call with enhanced WebRTC...', { receiverId, callType, receiverData });

      if (isInCall) {
        console.warn('⚠️ Already in a call');
        Alert.alert('Error', 'You are already in a call');
        return false;
      }

      if (!receiverId) {
        console.error('❌ No receiver ID provided');
        Alert.alert('Error', 'Invalid receiver ID');
        return false;
      }

      if (!navigationRef.current) {
        console.error('❌ Navigation ref not available');
        Alert.alert('Error', 'Navigation not ready. Please try again.');
        return false;
      }

      // Set call state immediately
      setIsInCall(true);

      try {
        // ✅ FIXED: Use WebRTC service to initiate call (this handles both API and WebRTC setup)
        console.log('🚀 Starting WebRTC call initiation...');
        const callData = await enhancedGlobalWebRTCService.initiateCall(receiverId, callType);
        
        console.log('✅ WebRTC call initiation successful:', callData);

        // Create enhanced call data
        const enhancedCallData = {
          callId: callData.callId,
          channelName: callData.channelName || callData.signalingRoom,
          token: callData.token,
          uid: callData.uid || user._id,
          appId: callData.appId,
          callType: callData.callType || callType,
          receiverId,
          receiverData,
          callerData: callData.caller || user,
          isIncoming: false,
          caller: callData.caller || user,
          callee: callData.callee || receiverData,
          expiresAt: callData.expiresAt,
          createdAt: new Date().toISOString(),
          signalingRoom: callData.signalingRoom,
          rtcConfiguration: callData.rtcConfiguration,
        };

        setCurrentCall(enhancedCallData);

        // **CRITICAL: Navigate to CallScreen IMMEDIATELY**
        console.log('🎯 Navigating to CallScreen...');
        navigationRef.current.navigate('CallScreen', {
          callType: enhancedCallData.callType,
          isIncoming: false,
          calleeData: receiverData,
          callerData: enhancedCallData.callerData,
          authToken: token,
          callData: enhancedCallData,
        });
        console.log('✅ Navigation completed successfully');
        
        // 🔔 START OUTGOING RINGTONE
        InCallManager.startRingback('_BUNDLE_');

        // Set call timeout (30 seconds for ringing)
        callTimeoutRef.current = setTimeout(() => {
          console.log('⏰ Call timeout reached');
          endCall(enhancedCallData.callId, 0, 'timeout');
        }, 30000);

        return true;

      } catch (webrtcError) {
        console.error('❌ WebRTC call initiation failed:', webrtcError);
        // 🔕 STOP RINGTONE ON ERROR
        InCallManager.stopRingtone();
        InCallManager.stopRingback();
        throw webrtcError;
      }

    } catch (error) {
      console.error('❌ Call initiation error:', error);
      Alert.alert('Call Failed', 'Unable to start call. Please try again.');
      
      // Reset state on error
      setIsInCall(false);
      setCurrentCall(null);
      // 🔕 STOP RINGTONE ON ERROR
      InCallManager.stopRingtone();
      InCallManager.stopRingback();
      return false;
    }
  };

  /**
   * Answer an incoming call - FIXED: Proper WebRTC integration
   */
  const answerCall = async (callId) => {
    try {
      // 🔕 STOP RINGTONE
      InCallManager.stopRingtone();
      
      console.log('📞 Answering call with enhanced WebRTC:', callId);

      if (!incomingCall || incomingCall.callId !== callId) {
        console.error('❌ No matching incoming call found');
        return false;
      }

      if (!navigationRef.current) {
        console.error('❌ Navigation ref not available for answer');
        return false;
      }

      // Clear incoming call modal FIRST
      setShowIncomingCallModal(false);

      try {
        // ✅ FIXED: Use WebRTC service to accept call (this handles both API and WebRTC setup)
        console.log('🚀 Starting WebRTC call acceptance...');
        const callData = await enhancedGlobalWebRTCService.acceptCall();
        
        console.log('✅ WebRTC call acceptance successful:', callData);

        // Set call state
        setIsInCall(true);
        
        // Create enhanced call data from incoming call and response
        const enhancedCallData = {
          ...incomingCall,
          ...callData,
          isIncoming: true,
        };

        setCurrentCall(enhancedCallData);

        // Navigate to CallScreen
        navigationRef.current.navigate('CallScreen', {
          callType: enhancedCallData.callType,
          isIncoming: true,
          callerData: enhancedCallData.caller,
          calleeData: user,
          authToken: token,
          callData: enhancedCallData,
        });
        console.log('🎯 Navigated to CallScreen for incoming call');

        // Clear incoming call
        setIncomingCall(null);
        
        return true;

      } catch (webrtcError) {
        console.error('❌ WebRTC call acceptance failed:', webrtcError);
        throw webrtcError;
      }

    } catch (error) {
      console.error('❌ Answer call error:', error);
      Alert.alert('Error', 'Failed to accept call');
      
      // Reset state on error
      setShowIncomingCallModal(false);
      setIncomingCall(null);
      return false;
    }
  };

  /**
   * Reject an incoming call - FIXED: Proper WebRTC integration
   */
  const rejectCall = async (callId) => {
    try {
      // 🔕 STOP RINGTONE
      InCallManager.stopRingtone();
      
      console.log('📞 Rejecting call with enhanced WebRTC:', callId);

      // Clear incoming call modal immediately
      setShowIncomingCallModal(false);
      setIncomingCall(null);

      // Use WebRTC service to decline
      await enhancedGlobalWebRTCService.declineCall();
      console.log('✅ WebRTC call rejection successful');
      
      return true;
    } catch (error) {
      console.error('❌ Reject call error:', error);
      // Don't show error to user, rejection should always appear to work
      return false;
    }
  };

  /**
   * End the current call - FIXED: Proper WebRTC integration
   */
  const endCall = async (callId, duration = 0, reason = 'user_end') => {
    try {
      // 🔕 STOP ALL RINGTONES
      InCallManager.stopRingtone();
      InCallManager.stopRingback();
      
      console.log('📞 Ending call with enhanced WebRTC:', { callId, duration, reason });

      // Clear timeout
      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
        callTimeoutRef.current = null;
      }

      // Reset state immediately
      setIsInCall(false);
      setCurrentCall(null);
      setIncomingCall(null);
      setShowIncomingCallModal(false);

      // Use WebRTC service to end call
      if (callId) {
        await enhancedGlobalWebRTCService.endCall(duration);
        console.log('✅ WebRTC call end successful');
      }

      return true;
    } catch (error) {
      console.error('❌ End call error:', error);
      // Always return true for local cleanup, even if backend fails
      return true;
    }
  };

  // ============ SOCKET EVENT HANDLERS (Backup for WebRTC Service) ============
  
  useEffect(() => {
    if (!socket || !user) return;

    // These are backup handlers in case WebRTC service doesn't catch everything
    // The main handlers are in the WebRTC service itself

    const handleCallAccepted = (data) => {
      console.log('📞 Call accepted (backup handler):', data);
      
      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
        callTimeoutRef.current = null;
      }
    };

    const handleCallDeclined = (data) => {
      console.log('📞 Call declined (backup handler):', data);
      Alert.alert('Call Declined', 'The user declined your call.');
      endCall(data.callId, 0, 'declined');
    };

    const handleCallEnded = (data) => {
      console.log('📞 Call ended (backup handler):', data);
      endCall(data.callId, data.duration || 0, 'remote_end');
    };

    // Register backup socket listeners
    socket.on('call_accepted', handleCallAccepted);
    socket.on('call_declined', handleCallDeclined);
    socket.on('call_ended', handleCallEnded);

    return () => {
      socket.off('call_accepted', handleCallAccepted);
      socket.off('call_declined', handleCallDeclined);
      socket.off('call_ended', handleCallEnded);
    };
  }, [socket, user, isInCall]);

  // ============ DEBUG FUNCTIONS ============
  
  // Test WebRTC connectivity
  const testWebRTCConnection = async () => {
    try {
      console.log('🧪 Testing Enhanced WebRTC connection...');
      
      if (!enhancedGlobalWebRTCService.isReady()) {
        Alert.alert('WebRTC Test', 'WebRTC service not ready. Please wait and try again.');
        return;
      }

      const callState = enhancedGlobalWebRTCService.getCallState();
      
      Alert.alert(
        'WebRTC Test Result',
        `Service Ready: ${enhancedGlobalWebRTCService.isReady()}\n` +
        `Socket Connected: ${enhancedGlobalWebRTCService.socket?.connected || false}\n` +
        `In Call: ${callState.isInCall}\n` +
        `Peer Connection: ${callState.peerConnectionState}\n` +
        `Local Stream: ${callState.hasLocalStream}\n` +
        `Remote Stream: ${callState.hasRemoteStream}`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('❌ WebRTC test error:', error);
      Alert.alert('WebRTC Test Failed', error.message);
    }
  };

  // ============ UTILITY FUNCTIONS ============
  
  // Get current call status
  const getCallStatus = () => {
    const webrtcState = enhancedGlobalWebRTCService.getCallState();
    
    return {
      isInCall,
      currentCall,
      incomingCall,
      showIncomingCallModal,
      webrtcState,
    };
  };

  // Force cleanup (useful for debugging)
  const forceCleanup = () => {
    console.log('🧹 Force cleanup called');
    setIsInCall(false);
    setCurrentCall(null);
    setIncomingCall(null);
    setShowIncomingCallModal(false);
    
    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = null;
    }
    
    // Also cleanup WebRTC service and stop any ringtones
    InCallManager.stopRingtone();
    InCallManager.stopRingback(); // 👈 SAFETY STOP
    enhancedGlobalWebRTCService.cleanup();
  };

  // ============ APP STATE HANDLER ============
  
  useEffect(() => {
    const handleAppStateChange = (nextAppState) => {
      if (nextAppState === 'background' && isInCall && currentCall) {
        console.log('📱 App backgrounded during call');
        // Keep call active in background
      } else if (nextAppState === 'active' && isInCall && currentCall) {
        console.log('📱 App foregrounded during call');
        // Resume call UI if needed
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [isInCall, currentCall]);

  // ============ CONTEXT VALUE ============
  
  const contextValue = {
    // State
    isInCall,
    currentCall,
    incomingCall,
    showIncomingCallModal,
    
    // Actions
    initiateCall,
    answerCall,
    rejectCall,
    endCall,
    setNavigationRef,
    
    // Debug functions
    testWebRTCConnection,
    getCallStatus,
    forceCleanup,
    
    // Utils
    setShowIncomingCallModal,
    
    // WebRTC service access (for advanced usage)
    webrtcService: enhancedGlobalWebRTCService,
  };

  return (
    <CallContext.Provider value={contextValue}>
      {children}
    </CallContext.Provider>
  );
};