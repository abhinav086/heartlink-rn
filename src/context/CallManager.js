// src/context/CallManager.js - COMPLETE FIXED VERSION
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Alert, AppState, Platform } from 'react-native';
import { useAuth } from './AuthContext';
import { useSocket } from './SocketContext';
import enhancedGlobalWebRTCService from '../services/EnhancedGlobalWebRTCService';
import BASE_URL from '../config/config';
import InCallManager from 'react-native-incall-manager';

const CallContext = createContext();

// ============ AUDIO STATE MACHINE ============
/**
 * Audio states for deterministic audio session management
 * This ensures we never have conflicting audio states
 */
const AudioState = {
  IDLE: 'IDLE',
  RINGING_INCOMING: 'RINGING_INCOMING',
  RINGING_OUTGOING: 'RINGING_OUTGOING',
  CONNECTING: 'CONNECTING',
  IN_CALL: 'IN_CALL',
  ENDING: 'ENDING'
};

/**
 * Enhanced Audio Session Manager with ringtone tracking
 * Prevents race conditions and ensures proper cleanup
 */
class AudioSessionManager {
  constructor() {
    this.currentState = AudioState.IDLE;
    this.audioLock = false;
    this.transitionPromise = null;
    this.ringtoneTimer = null;
    this.speakerCheckTimer = null;
    
    // Enhanced tracking for debugging ringtone issues
    this.ringtoneStartCount = 0;
    this.ringtoneStopCount = 0;
    this.lastRingtoneAction = null;
    this.ringtoneActive = false;
  }

  /**
   * Acquire audio lock to prevent concurrent operations
   */
  async acquireLock(timeout = 5000) {
    const startTime = Date.now();
    while (this.audioLock) {
      if (Date.now() - startTime > timeout) {
        console.warn('⚠️ Audio lock timeout, forcing unlock');
        this.audioLock = false;
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    this.audioLock = true;
  }

  releaseLock() {
    this.audioLock = false;
  }

  /**
   * Transition to a new audio state with proper cleanup
   * This is the ONLY way audio state should change
   */
  async transitionTo(newState, options = {}) {
    console.log(`🔊 Audio State Transition: ${this.currentState} → ${newState}`);
    
    // Prevent concurrent transitions
    if (this.transitionPromise) {
      console.log('⏳ Waiting for previous transition to complete...');
      await this.transitionPromise;
    }

    this.transitionPromise = this._performTransition(newState, options);
    const result = await this.transitionPromise;
    this.transitionPromise = null;
    return result;
  }

  async _performTransition(newState, options) {
    try {
      await this.acquireLock();

      // Cleanup previous state
      await this._cleanupCurrentState();

      // Apply new state
      this.currentState = newState;
      await this._applyNewState(newState, options);

      return true;
    } catch (error) {
      console.error('❌ Audio state transition failed:', error);
      return false;
    } finally {
      this.releaseLock();
    }
  }

  /**
   * Enhanced cleanup with ringtone tracking
   */
  async _cleanupCurrentState() {
    console.log(`🧹 Cleaning up audio state: ${this.currentState}`);
    
    // Clear any active timers
    if (this.ringtoneTimer) {
      clearInterval(this.ringtoneTimer);
      this.ringtoneTimer = null;
    }
    if (this.speakerCheckTimer) {
      clearInterval(this.speakerCheckTimer);
      this.speakerCheckTimer = null;
    }

    switch (this.currentState) {
      case AudioState.RINGING_INCOMING:
        // Enhanced ringtone stopping with tracking
        await this._stopRingtoneWithTracking();
        break;
        
      case AudioState.RINGING_OUTGOING:
        await this._stopRingbackWithTracking();
        break;
        
      case AudioState.IN_CALL:
        // Don't stop InCallManager here, just prepare for transition
        break;
        
      case AudioState.CONNECTING:
        // Stop any ringtones that might still be playing
        await this._stopAllRingtonesWithTracking();
        break;
    }

    // Small delay to ensure native module processes the cleanup
    await this._delay(100);
  }

  /**
   * Apply new audio state configuration
   * This sets up the audio session for the new state
   */
  async _applyNewState(state, options = {}) {
    console.log(`🎵 Applying audio state: ${state}`, options);

    switch (state) {
      case AudioState.RINGING_INCOMING:
        await this._startIncomingRingtone();
        break;
        
      case AudioState.RINGING_OUTGOING:
        await this._startOutgoingRingback();
        break;
        
      case AudioState.CONNECTING:
        // Transitional state - ensure ringtones are stopped
        await this._stopAllRingtonesWithTracking();
        // Start audio session but don't activate speaker yet
        InCallManager.start({ media: 'audio', auto: false });
        break;
        
      case AudioState.IN_CALL:
        await this._startCallAudio(options.isVideo);
        break;
        
      case AudioState.ENDING:
        await this._stopAllAudio();
        break;
        
      case AudioState.IDLE:
        await this._resetAudioSession();
        break;
    }
  }

  /**
   * Enhanced ringtone start with validation
   */
  async _startIncomingRingtone() {
    console.log('🔔 Starting incoming ringtone with enhanced tracking');
    
    // Track ringtone start
    this.ringtoneStartCount++;
    this.lastRingtoneAction = 'start';
    this.ringtoneActive = true;
    console.log(`🔔 Ringtone start count: ${this.ringtoneStartCount}`);
    
    // Stop any existing ringtone first (defensive programming)
    InCallManager.stopRingtone();
    await this._delay(50);
    
    // CRITICAL: Start audio session first with proper configuration
    InCallManager.start({
      media: 'audio',
      auto: false,
      ringback: false
    });
    
    await this._delay(100);
    
    // Set speaker BEFORE starting ringtone
    InCallManager.setForceSpeakerphoneOn(true);
    
    // Start ringtone
    InCallManager.startRingtone('_BUNDLE_');
    
    // Enhanced speaker enforcement with validation
    this.speakerCheckTimer = setInterval(() => {
      if (this.currentState === AudioState.RINGING_INCOMING && this.ringtoneActive) {
        InCallManager.setForceSpeakerphoneOn(true);
      } else {
        // State changed or ringtone inactive, stop the timer
        clearInterval(this.speakerCheckTimer);
        this.speakerCheckTimer = null;
      }
    }, 500);
    
    // SAFETY: Force stop ringtone after 60 seconds
    this.ringtoneTimer = setTimeout(() => {
      if (this.currentState === AudioState.RINGING_INCOMING) {
        console.log('⏰ Ringtone safety timeout reached');
        this.transitionTo(AudioState.IDLE);
      }
    }, 60000);
  }

  /**
   * Start outgoing ringback with speaker
   */
  async _startOutgoingRingback() {
    console.log('🔔 Starting outgoing ringback');
    
    this.ringtoneActive = true;
    
    // Start audio session
    InCallManager.start({
      media: 'audio',
      auto: false,
      ringback: true
    });
    
    await this._delay(100);
    
    // Set speaker for ringback
    InCallManager.setForceSpeakerphoneOn(true);
    
    // Start ringback tone
    InCallManager.startRingback('_BUNDLE_');
    
    // Enforce speaker mode
    this.speakerCheckTimer = setInterval(() => {
      if (this.currentState === AudioState.RINGING_OUTGOING && this.ringtoneActive) {
        InCallManager.setForceSpeakerphoneOn(true);
      } else {
        clearInterval(this.speakerCheckTimer);
        this.speakerCheckTimer = null;
      }
    }, 500);
    
    // Safety timeout for ringback (30 seconds)
    this.ringtoneTimer = setTimeout(() => {
      if (this.currentState === AudioState.RINGING_OUTGOING) {
        console.log('⏰ Ringback safety timeout reached');
        this.transitionTo(AudioState.IDLE);
      }
    }, 30000);
  }

  /**
   * Enhanced ringtone stopping with tracking
   */
  async _stopRingtoneWithTracking() {
    console.log('🛑 Stopping ringtone with tracking');
    this.ringtoneStopCount++;
    this.lastRingtoneAction = 'stop';
    this.ringtoneActive = false;
    
    // Multiple stop attempts to ensure it stops
    for (let i = 0; i < 5; i++) {
      InCallManager.stopRingtone();
      await this._delay(20);
    }
    
    console.log(`🛑 Ringtone stop count: ${this.ringtoneStopCount}`);
  }

  /**
   * Enhanced ringback stopping with tracking
   */
  async _stopRingbackWithTracking() {
    console.log('🛑 Stopping ringback with tracking');
    this.ringtoneActive = false;
    
    for (let i = 0; i < 5; i++) {
      InCallManager.stopRingback();
      await this._delay(20);
    }
  }

  /**
   * Stop all ringtones with enhanced tracking
   */
  async _stopAllRingtonesWithTracking() {
    console.log('🛑 Stopping all ringtones');
    this.ringtoneActive = false;
    this.lastRingtoneAction = 'stop_all';
    
    // Stop everything multiple times
    for (let i = 0; i < 5; i++) {
      InCallManager.stopRingtone();
      InCallManager.stopRingback();
      await this._delay(20);
    }
  }

  /**
   * Start in-call audio session
   */
  async _startCallAudio(isVideo = false) {
    console.log('📞 Starting in-call audio session');
    
    // CRITICAL: Ensure ringtones are completely stopped
    await this._stopAllRingtonesWithTracking();
    
    await this._delay(100);
    
    // Start call audio session
    InCallManager.start({
      media: isVideo ? 'video' : 'audio',
      auto: true // Allow auto-routing based on proximity sensor
    });
    
    // For video calls, default to speaker
    if (isVideo) {
      InCallManager.setForceSpeakerphoneOn(true);
    } else {
      // For audio calls, use normal routing (earpiece/bluetooth/speaker)
      InCallManager.setForceSpeakerphoneOn(false);
    }
  }

  /**
   * Stop all audio and cleanup
   */
  async _stopAllAudio() {
    console.log('🛑 Stopping all audio');
    
    // Reset tracking
    this.ringtoneActive = false;
    this.lastRingtoneAction = 'stop_all';
    
    // Stop everything multiple times to ensure completion
    for (let i = 0; i < 5; i++) {
      InCallManager.stopRingtone();
      InCallManager.stopRingback();
      await this._delay(50);
    }
    
    // Stop the audio session
    InCallManager.stop();
  }

  /**
   * Reset audio session to idle state
   */
  async _resetAudioSession() {
    console.log('🔄 Resetting audio session to idle');
    
    // Final cleanup
    await this._stopAllRingtonesWithTracking();
    InCallManager.stop();
    
    // Reset speaker to default
    InCallManager.setForceSpeakerphoneOn(false);
    
    // Clear all timers
    if (this.ringtoneTimer) {
      clearTimeout(this.ringtoneTimer);
      this.ringtoneTimer = null;
    }
    if (this.speakerCheckTimer) {
      clearInterval(this.speakerCheckTimer);
      this.speakerCheckTimer = null;
    }
    
    // Reset tracking
    this.ringtoneActive = false;
    console.log(`📊 Ringtone stats - Starts: ${this.ringtoneStartCount}, Stops: ${this.ringtoneStopCount}`);
  }

  /**
   * Utility: Delay helper
   */
  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Force stop all audio (emergency use)
   */
  async forceStopAll() {
    console.log('🚨 Force stopping all audio');
    this.currentState = AudioState.IDLE;
    this.ringtoneActive = false;
    await this._resetAudioSession();
  }

  /**
   * Get current audio state for debugging
   */
  getDebugInfo() {
    return {
      currentState: this.currentState,
      ringtoneActive: this.ringtoneActive,
      ringtoneStartCount: this.ringtoneStartCount,
      ringtoneStopCount: this.ringtoneStopCount,
      lastRingtoneAction: this.lastRingtoneAction,
      audioLock: this.audioLock,
      hasRingtoneTimer: !!this.ringtoneTimer,
      hasSpeakerTimer: !!this.speakerCheckTimer
    };
  }
}

// ============ CALL MANAGER COMPONENT ============
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
  const audioManager = useRef(new AudioSessionManager());

  // ============ WEBRTC SERVICE INITIALIZATION ============
  useEffect(() => {
    const initializeWebRTCService = async () => {
      if (token && !enhancedGlobalWebRTCService.isReady()) {
        try {
          console.log('🔧 Initializing Enhanced WebRTC Service...');
          await enhancedGlobalWebRTCService.initialize(token);
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
  const setNavigationRef = (navRef) => {
    navigationRef.current = navRef;
    console.log('🎯 Navigation ref set in CallManager');
  };

  // ============ WEBRTC EVENT HANDLERS ============
  const handleWebRTCIncomingCall = async (data) => {
    console.log('📞 WebRTC incoming call received:', data);

    if (isInCall) {
      console.log('⚠️ Already in call, auto-declining incoming call');
      enhancedGlobalWebRTCService.declineCall();
      return;
    }

    // Set incoming call state
    setIncomingCall(data);
    setShowIncomingCallModal(true);

    // Use audio manager for deterministic ringtone control
    await audioManager.current.transitionTo(AudioState.RINGING_INCOMING);
  };

  const handleWebRTCStateChange = async (type, data) => {
    console.log('🔄 WebRTC state change:', type, data);
    
    switch (type) {
      case 'accepted':
        console.log('✅ Call accepted, transitioning to connecting state');
        // Transition through CONNECTING state to ensure ringtone stops
        await audioManager.current.transitionTo(AudioState.CONNECTING);
        break;
        
      case 'answering':
        console.log('📞 Call is being answered...');
        // Ensure we're in connecting state
        await audioManager.current.transitionTo(AudioState.CONNECTING);
        break;
        
      case 'declined':
        console.log('❌ Call declined');
        await audioManager.current.transitionTo(AudioState.IDLE);
        Alert.alert('Call Declined', 'The user declined your call');
        endCall(currentCall?.callId, 0, 'declined');
        break;
        
      case 'ended':
        console.log('🔚 Call ended remotely');
        await audioManager.current.transitionTo(AudioState.ENDING);
        await audioManager.current.transitionTo(AudioState.IDLE);
        endCall(currentCall?.callId, data.duration || 0, 'remote_end');
        break;
        
      case 'connection':
        if (data.state === 'connected') {
          console.log('🎉 WebRTC connection established successfully!');
          // Properly transition to in-call audio state
          const isVideo = currentCall?.callType === 'video';
          await audioManager.current.transitionTo(AudioState.IN_CALL, { isVideo });
        }
        break;
    }
  };

  const handleWebRTCError = async (error) => {
    console.error('❌ WebRTC error:', error);
    
    // Ensure audio is cleaned up on error
    await audioManager.current.transitionTo(AudioState.IDLE);
    
    Alert.alert('Call Error', error.message || 'An error occurred during the call');
    
    if (currentCall) {
      endCall(currentCall.callId, 0, 'error');
    }
  };

  // ============ CORE CALL FUNCTIONS ============
  /**
   * Initiate a call to another user
   */
  const initiateCall = async (receiverId, callType = 'audio', receiverData = {}) => {
    try {
      console.log('📞 Initiating call...', { receiverId, callType, receiverData });
      
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
        // Start WebRTC call
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

        // Navigate to CallScreen
        console.log('🎯 Navigating to CallScreen...');
        navigationRef.current.navigate('CallScreen', {
          callType: enhancedCallData.callType,
          isIncoming: false,
          calleeData: receiverData,
          callerData: enhancedCallData.callerData,
          authToken: token,
          callData: enhancedCallData,
        });

        // Start outgoing ringback with proper audio state
        await audioManager.current.transitionTo(AudioState.RINGING_OUTGOING);

        // Set call timeout (30 seconds for ringing)
        callTimeoutRef.current = setTimeout(async () => {
          console.log('⏰ Call timeout reached');
          await audioManager.current.transitionTo(AudioState.IDLE);
          endCall(enhancedCallData.callId, 0, 'timeout');
        }, 30000);

        return true;
      } catch (webrtcError) {
        console.error('❌ WebRTC call initiation failed:', webrtcError);
        await audioManager.current.transitionTo(AudioState.IDLE);
        throw webrtcError;
      }
    } catch (error) {
      console.error('❌ Call initiation error:', error);
      Alert.alert('Call Failed', 'Unable to start call. Please try again.');
      setIsInCall(false);
      setCurrentCall(null);
      await audioManager.current.transitionTo(AudioState.IDLE);
      return false;
    }
  };

  /**
   * Answer an incoming call - ENHANCED with guaranteed ringtone stop
   */
  const answerCall = async (callId) => {
    try {
      console.log('📞 Answering call:', callId);
      
      // CRITICAL FIX: Immediately transition to CONNECTING state
      // This ensures ringtone stops BEFORE any other operations
      await audioManager.current.transitionTo(AudioState.CONNECTING);
      
      // Validate incoming call
      if (!incomingCall || incomingCall.callId !== callId) {
        console.error('❌ No matching incoming call found');
        await audioManager.current.transitionTo(AudioState.IDLE);
        return false;
      }
      
      if (!navigationRef.current) {
        console.error('❌ Navigation ref not available');
        await audioManager.current.transitionTo(AudioState.IDLE);
        return false;
      }

      // Clear incoming call modal IMMEDIATELY
      setShowIncomingCallModal(false);
      
      // Small delay to ensure modal is hidden
      await new Promise(resolve => setTimeout(resolve, 50));

      try {
        // Accept call via WebRTC
        console.log('🚀 Starting WebRTC call acceptance...');
        const callData = await enhancedGlobalWebRTCService.acceptCall();
        console.log('✅ WebRTC call acceptance successful:', callData);

        // Set call state
        setIsInCall(true);

        // Create enhanced call data
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

        // Clear incoming call
        setIncomingCall(null);
        
        // Transition to in-call audio (will happen via WebRTC state change)
        // But set a fallback just in case
        setTimeout(async () => {
          if (audioManager.current.currentState === AudioState.CONNECTING) {
            const isVideo = enhancedCallData.callType === 'video';
            await audioManager.current.transitionTo(AudioState.IN_CALL, { isVideo });
          }
        }, 2000);
        
        return true;
      } catch (webrtcError) {
        console.error('❌ WebRTC call acceptance failed:', webrtcError);
        await audioManager.current.transitionTo(AudioState.IDLE);
        setShowIncomingCallModal(false);
        setIncomingCall(null);
        throw webrtcError;
      }
    } catch (error) {
      console.error('❌ Answer call error:', error);
      Alert.alert('Error', 'Failed to accept call');
      await audioManager.current.transitionTo(AudioState.IDLE);
      setShowIncomingCallModal(false);
      setIncomingCall(null);
      return false;
    }
  };

  /**
   * Reject an incoming call
   */
  const rejectCall = async (callId) => {
    try {
      console.log('📞 Rejecting call:', callId);
      
      // Stop ringtone immediately
      await audioManager.current.transitionTo(AudioState.IDLE);
      
      // Clear incoming call modal
      setShowIncomingCallModal(false);
      setIncomingCall(null);

      // Decline via WebRTC
      await enhancedGlobalWebRTCService.declineCall();
      console.log('✅ WebRTC call rejection successful');

      return true;
    } catch (error) {
      console.error('❌ Reject call error:', error);
      return false;
    }
  };

  /**
   * End the current call
   */
  const endCall = async (callId, duration = 0, reason = 'user_end') => {
    try {
      console.log('📞 Ending call:', { callId, duration, reason });
      
      // Transition audio to ending state
      await audioManager.current.transitionTo(AudioState.ENDING);
      
      // Clear timeout
      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
        callTimeoutRef.current = null;
      }

      // Reset state
      setIsInCall(false);
      setCurrentCall(null);
      setIncomingCall(null);
      setShowIncomingCallModal(false);

      // End via WebRTC
      if (callId) {
        await enhancedGlobalWebRTCService.endCall(duration);
        console.log('✅ WebRTC call end successful');
      }
      
      // Final audio cleanup
      await audioManager.current.transitionTo(AudioState.IDLE);
      
      return true;
    } catch (error) {
      console.error('❌ End call error:', error);
      // Force cleanup even on error
      await audioManager.current.forceStopAll();
      return true;
    }
  };

  // ============ SOCKET EVENT HANDLERS ============
  useEffect(() => {
    if (!socket || !user) return;

    const handleCallAccepted = (data) => {
      console.log('📞 Call accepted (socket):', data);
      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
        callTimeoutRef.current = null;
      }
    };

    const handleCallDeclined = async (data) => {
      console.log('📞 Call declined (socket):', data);
      await audioManager.current.transitionTo(AudioState.IDLE);
      Alert.alert('Call Declined', 'The user declined your call.');
      endCall(data.callId, 0, 'declined');
    };

    const handleCallEnded = async (data) => {
      console.log('📞 Call ended (socket):', data);
      await audioManager.current.transitionTo(AudioState.ENDING);
      endCall(data.callId, data.duration || 0, 'remote_end');
    };

    socket.on('call_accepted', handleCallAccepted);
    socket.on('call_declined', handleCallDeclined);
    socket.on('call_ended', handleCallEnded);

    return () => {
      socket.off('call_accepted', handleCallAccepted);
      socket.off('call_declined', handleCallDeclined);
      socket.off('call_ended', handleCallEnded);
      
      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
      }
    };
  }, [socket, user, isInCall]);

  // ============ APP STATE HANDLER ============
  useEffect(() => {
    const handleAppStateChange = async (nextAppState) => {
      if (nextAppState === 'background') {
        console.log('📱 App going to background');
        
        // If ringtone is playing and app goes to background, ensure it stops
        const audioDebug = audioManager.current.getDebugInfo();
        if (audioDebug.ringtoneActive && !isInCall) {
          console.log('⚠️ Stopping ringtone due to background state');
          await audioManager.current.forceStopAll();
        }
      } else if (nextAppState === 'active') {
        console.log('📱 App coming to foreground');
        
        // Re-apply audio settings if in call
        if (isInCall && currentCall) {
          const audioDebug = audioManager.current.getDebugInfo();
          if (audioDebug.currentState === AudioState.IN_CALL) {
            const isVideo = currentCall?.callType === 'video';
            InCallManager.start({
              media: isVideo ? 'video' : 'audio',
              auto: true
            });
          }
        }
      }
    };
    
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [isInCall, currentCall]);

  // ============ CLEANUP ON UNMOUNT ============
  useEffect(() => {
    return () => {
      // Ensure audio is cleaned up when component unmounts
      audioManager.current.forceStopAll();
    };
  }, []);

  // ============ DEBUG FUNCTIONS ============
  const testWebRTCConnection = async () => {
    try {
      console.log('🧪 Testing Enhanced WebRTC connection...');
      if (!enhancedGlobalWebRTCService.isReady()) {
        Alert.alert('WebRTC Test', 'WebRTC service not ready. Please wait and try again.');
        return;
      }
      
      const callState = enhancedGlobalWebRTCService.getCallState();
      const audioState = audioManager.current.currentState;
      const audioDebug = audioManager.current.getDebugInfo();
      
      Alert.alert(
        'WebRTC & Audio Test',
        `Service Ready: ${enhancedGlobalWebRTCService.isReady()}\n` +
        `Socket Connected: ${enhancedGlobalWebRTCService.socket?.connected || false}\n` +
        `In Call: ${callState.isInCall}\n` +
        `Peer Connection: ${callState.peerConnectionState}\n` +
        `Audio State: ${audioState}\n` +
        `Ringtone Active: ${audioDebug.ringtoneActive}\n` +
        `Ringtone Starts: ${audioDebug.ringtoneStartCount}\n` +
        `Ringtone Stops: ${audioDebug.ringtoneStopCount}\n` +
        `Local Stream: ${callState.hasLocalStream}\n` +
        `Remote Stream: ${callState.hasRemoteStream}`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('❌ WebRTC test error:', error);
      Alert.alert('WebRTC Test Failed', error.message);
    }
  };

  const getCallStatus = () => {
    const webrtcState = enhancedGlobalWebRTCService.getCallState();
    const audioDebug = audioManager.current.getDebugInfo();
    
    return {
      isInCall,
      currentCall,
      incomingCall,
      showIncomingCallModal,
      webrtcState,
      audioState: audioManager.current.currentState,
      audioDebug,
    };
  };

  const forceCleanup = async () => {
    console.log('🧹 Force cleanup called');
    setIsInCall(false);
    setCurrentCall(null);
    setIncomingCall(null);
    setShowIncomingCallModal(false);
    
    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = null;
    }
    
    await audioManager.current.forceStopAll();
    enhancedGlobalWebRTCService.cleanup();
  };

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
    // WebRTC service access
    webrtcService: enhancedGlobalWebRTCService,
    // Audio manager access (for advanced debugging)
    audioManager: audioManager.current,
  };

  return (
    <CallContext.Provider value={contextValue}>
      {children}
    </CallContext.Provider>
  );
};