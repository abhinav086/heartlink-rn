// screens/CallScreen.js - FIXED VERSION WITH STABLE STREAM HANDLING
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Dimensions,
  StatusBar,
  SafeAreaView,
  Image,
  BackHandler,
  ActivityIndicator
} from 'react-native';
import { RTCView } from 'react-native-webrtc';
import Ionicons from 'react-native-vector-icons/Ionicons';
import InCallManager from 'react-native-incall-manager';
import enhancedGlobalWebRTCService from '../services/EnhancedGlobalWebRTCService';
import BASE_URL from '../config/config';

const { width, height } = Dimensions.get('window');

const CallScreen = ({ route, navigation }) => {
  const { callType, isIncoming, callerData, calleeData, authToken, callData } = route.params;

  // ============ STATE ============
  const [callState, setCallState] = useState(isIncoming ? 'incoming' : 'initiating');
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(callType === 'video');
  const [isSpeakerOn, setIsSpeakerOn] = useState(callType === 'video'); // Video default speaker ON, audio OFF
  const [callDuration, setCallDuration] = useState(0);
  const [connectionState, setConnectionState] = useState('new');
  const [isConnected, setIsConnected] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  // FIX: Use stable stream URLs instead of tracking IDs
  const [localStreamUrl, setLocalStreamUrl] = useState(null);
  const [remoteStreamUrl, setRemoteStreamUrl] = useState(null);

  // ============ REFS ============
  const callTimer = useRef(null);
  const callStartTime = useRef(null);
  const isComponentMounted = useRef(true);
  const streamUrlsRef = useRef({ local: null, remote: null });

  // ============ EFFECTS ============
  useEffect(() => {
    initializeCallScreen();
    setupInCallManager();
    const backHandler = BackHandler.addEventListener('hardwareBackPress', handleBackPress);
    return () => {
      console.log('🧹 CallScreen cleanup');
      isComponentMounted.current = false;
      cleanup();
      backHandler.remove();
    };
  }, []);

  // ============ IN-CALL MANAGER SETUP ============
  const setupInCallManager = () => {
    try {
      console.log('📞 Setting up InCallManager...');
      if (callType === 'video') {
        // Start InCallManager for video call
        InCallManager.start({ media: 'video' });
        // Video calls typically use speaker by default
        InCallManager.setSpeakerphoneOn(true);
      } else {
        // Start InCallManager for audio call
        InCallManager.start({ media: 'audio' });
        // For audio calls, use speaker based on user preference (initially off based on state)
        InCallManager.setSpeakerphoneOn(isSpeakerOn); // Use component state
      }
      InCallManager.setKeepScreenOn(true);
      console.log('✅ InCallManager setup complete');
    } catch (error) {
      console.error('❌ InCallManager setup failed:', error);
    }
  };

  // ============ INITIALIZATION ============
  const initializeCallScreen = async () => {
    try {
      console.log('📺 Initializing CallScreen...', { callType, isIncoming });
      
      // Set screen-specific callbacks FIRST
      enhancedGlobalWebRTCService.setScreenCallbacks({
        onLocalStream: handleLocalStream,
        onRemoteStream: handleRemoteStream,
        onCallStateChange: handleCallStateChange,
        onError: handleError,
      });

      // CRITICAL FIX: Ensure local stream for outgoing calls
      if (!isIncoming) {
        console.log('🎥 Outgoing call - ensuring local stream...');
        try {
          // Force get a fresh stream
          const stream = await enhancedGlobalWebRTCService.setupMedia(callType);
          if (stream && isStreamValid(stream)) {
            console.log('✅ Got fresh local stream for outgoing call');
            handleLocalStream(stream);
          } else {
            // Fallback: try getUserMedia directly
            console.log('⚠️ Retrying with getUserMedia...');
            const fallbackStream = await enhancedGlobalWebRTCService.getUserMedia({
              video: callType === 'video' ? {
                width: { ideal: 1280, max: 1920 },
                height: { ideal: 720, max: 1080 },
                frameRate: { ideal: 30 },
                facingMode: 'user'
              } : false,
              audio: true
            });
            if (fallbackStream) {
              handleLocalStream(fallbackStream);
            }
          }
        } catch (error) {
          console.error('❌ Failed to setup media for outgoing call:', error);
          // Continue anyway - audio might still work
        }
      }

      // For incoming calls or after outgoing setup
      const currentLocalStream = enhancedGlobalWebRTCService.localStream;
      const currentRemoteStream = enhancedGlobalWebRTCService.remoteStream;
      
      // Validate and set existing streams
      if (currentLocalStream && isStreamValid(currentLocalStream)) {
        console.log('📹 Setting existing local stream');
        handleLocalStream(currentLocalStream);
      } else if (!isIncoming) {
        // For outgoing calls, retry if still no stream
        console.log('⚠️ No valid local stream, retrying...');
        setTimeout(async () => {
          const retryStream = await enhancedGlobalWebRTCService.getLocalStream(true);
          if (retryStream && isStreamValid(retryStream)) {
            handleLocalStream(retryStream);
          }
        }, 500);
      }
      
      if (currentRemoteStream && isStreamValid(currentRemoteStream)) {
        console.log('📺 Setting existing remote stream');
        handleRemoteStream(currentRemoteStream);
      }

      // Get current WebRTC state
      const webrtcState = enhancedGlobalWebRTCService.getCallState();
      console.log('📊 Current WebRTC state:', webrtcState);

      // Update connection state
      if (webrtcState.peerConnectionState) {
        setConnectionState(webrtcState.peerConnectionState);
        if (webrtcState.peerConnectionState === 'connected' && !isConnected) {
          setCallState('connected');
          setIsConnected(true);
          startCallTimer();
        }
      }

      // Mark initialization complete
      setTimeout(() => {
        if (isComponentMounted.current) {
          setIsInitializing(false);
        }
      }, 300);

      console.log('✅ CallScreen initialized');
    } catch (error) {
      console.error('❌ CallScreen initialization failed:', error);
      setIsInitializing(false);
      Alert.alert('Call Error', 'Failed to initialize call screen');
      navigation.goBack();
    }
  };

  // ============ STREAM VALIDATION ============
  const isStreamValid = (stream) => {
    if (!stream) return false;
    try {
      // Check if stream is active
      if (!stream.active) {
        console.log('⚠️ Stream is not active');
        return false;
      }
      // Check if stream has tracks
      const tracks = stream.getTracks();
      if (tracks.length === 0) {
        console.log('⚠️ Stream has no tracks');
        return false;
      }
      // Check if at least one track is not ended
      const hasLiveTrack = tracks.some(track => track.readyState === 'live');
      if (!hasLiveTrack) {
        console.log('⚠️ Stream has no live tracks');
        return false;
      }
      return true;
    } catch (error) {
      console.error('❌ Error validating stream:', error);
      return false;
    }
  };

  // ============ WEBRTC EVENT HANDLERS ============
  const handleLocalStream = (stream) => {
    if (!isComponentMounted.current) return;
    console.log('📹 Local stream received in CallScreen');
    
    if (!isStreamValid(stream)) {
      console.warn('⚠️ Received invalid local stream');
      // Retry after a delay
      setTimeout(async () => {
        const retryStream = await enhancedGlobalWebRTCService.getLocalStream();
        if (retryStream && isStreamValid(retryStream)) {
          handleLocalStream(retryStream);
        }
      }, 1000);
      return;
    }
    
    // Generate stable URL with retry
    let newUrl = null;
    try {
      newUrl = stream.toURL();
    } catch (e) {
      console.error('❌ Failed to generate stream URL:', e);
      // Retry once
      setTimeout(() => {
        try {
          const retryUrl = stream.toURL();
          if (retryUrl && retryUrl !== streamUrlsRef.current.local) {
            streamUrlsRef.current.local = retryUrl;
            setLocalStreamUrl(retryUrl);
          }
        } catch (retryError) {
          console.error('❌ Retry failed:', retryError);
        }
      }, 500);
      return;
    }
    
    // Only update if URL has actually changed and is valid
    if (newUrl && newUrl !== streamUrlsRef.current.local) {
      console.log('📹 Updating local stream URL');
      streamUrlsRef.current.local = newUrl;
      setLocalStreamUrl(newUrl);
      setLocalStream(stream);
      
      // Ensure video track state matches UI state
      if (callType === 'video') {
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack && videoTrack.enabled !== isVideoEnabled) {
          videoTrack.enabled = isVideoEnabled;
        }
      }
    }
    
    setIsInitializing(false);
    // Update call state if needed
    if (callState === 'initiating' || callState === 'incoming') {
      setCallState(isIncoming ? 'answering' : 'calling');
    }
  };

  const handleRemoteStream = (stream) => {
    if (!isComponentMounted.current) return;
    console.log('📺 Remote stream received in CallScreen - CONNECTION ESTABLISHED!');
    
    if (!isStreamValid(stream)) {
      console.warn('⚠️ Received invalid remote stream');
      // Retry after a delay
      setTimeout(async () => {
        const currentRemoteStream = enhancedGlobalWebRTCService.remoteStream;
        if (currentRemoteStream && isStreamValid(currentRemoteStream)) {
          handleRemoteStream(currentRemoteStream);
        }
      }, 1000);
      return;
    }
    
    // Generate stable URL with retry
    let newUrl = null;
    try {
      newUrl = stream.toURL();
    } catch (e) {
      console.error('❌ Failed to generate remote stream URL:', e);
      // Retry once
      setTimeout(() => {
        try {
          const retryUrl = stream.toURL();
          if (retryUrl && retryUrl !== streamUrlsRef.current.remote) {
            streamUrlsRef.current.remote = retryUrl;
            setRemoteStreamUrl(retryUrl);
          }
        } catch (retryError) {
          console.error('❌ Remote stream URL retry failed:', retryError);
        }
      }, 500);
      return;
    }
    
    // Only update if URL has actually changed and is valid
    if (newUrl && newUrl !== streamUrlsRef.current.remote) {
      console.log('📺 Updating remote stream URL');
      streamUrlsRef.current.remote = newUrl;
      setRemoteStreamUrl(newUrl);
      setRemoteStream(stream);
    }
    
    // Call is connected when we have remote stream
    if (!isConnected) {
      console.log('🎉 Call connection established, starting timer');
      setCallState('connected');
      setIsConnected(true);
      startCallTimer();
    }
  };

  const handleCallStateChange = (type, data) => {
    if (!isComponentMounted.current) return;
    console.log('🔄 Call state change in CallScreen:', type, data);
    switch (type) {
      case 'accepted':
        setCallState('connecting');
        break;
      case 'declined':
        Alert.alert('Call Declined', 'The user declined your call', [
          { text: 'OK', onPress: () => navigation.goBack() }
        ]);
        break;
      case 'ended':
        const duration = data.duration || callDuration;
        Alert.alert(
          'Call Ended',
          `Call duration: ${formatDuration(duration)}`,
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
        break;
      case 'connection':
        setConnectionState(data.state);
        if (data.state === 'connected' && !isConnected) {
          setCallState('connected');
          setIsConnected(true);
          startCallTimer();
        } else if (data.state === 'disconnected' || data.state === 'failed') {
          setCallState('reconnecting');
        }
        break;
    }
  };

  const handleError = (error) => {
    if (!isComponentMounted.current) return;
    console.error('❌ WebRTC error in CallScreen:', error);
    Alert.alert(
      'Call Error',
      error.message || 'An error occurred during the call',
      [
        { text: 'End Call', onPress: endCall, style: 'destructive' },
        { text: 'Continue', style: 'cancel' }
      ]
    );
  };

  // ============ CALL CONTROL FUNCTIONS ============
  const startCallTimer = () => {
    if (callTimer.current) return;
    console.log('⏰ Starting call timer');
    callStartTime.current = Date.now();
    callTimer.current = setInterval(() => {
      if (isComponentMounted.current) {
        const elapsed = Math.floor((Date.now() - callStartTime.current) / 1000);
        setCallDuration(elapsed);
      }
    }, 1000);
  };

  const endCall = async () => {
    try {
      console.log('🔚 User ending call');
      const duration = callStartTime.current ?
        Math.floor((Date.now() - callStartTime.current) / 1000) : 0;
      InCallManager.stop();
      await enhancedGlobalWebRTCService.endCall(duration);
      navigation.goBack();
    } catch (error) {
      console.error('❌ Failed to end call:', error);
      navigation.goBack();
    }
  };

  const toggleMute = async () => {
    try {
      const enabled = await enhancedGlobalWebRTCService.toggleMicrophone();
      setIsMuted(!enabled);
    } catch (error) {
      console.error('❌ Failed to toggle microphone:', error);
      Alert.alert('Error', 'Failed to toggle microphone');
    }
  };

  const toggleVideo = async () => {
    try {
      console.log('🎥 Toggling video, current state:', isVideoEnabled);
      const enabled = await enhancedGlobalWebRTCService.toggleCamera();
      setIsVideoEnabled(enabled);
      // Force re-render of local video by updating stream URL
      if (localStream) {
        const newUrl = localStream.toURL();
        setLocalStreamUrl(newUrl);
      }
      console.log('🎥 Video toggled to:', enabled);
    } catch (error) {
      console.error('❌ Failed to toggle camera:', error);
      Alert.alert('Error', 'Failed to toggle camera');
    }
  };

  const toggleSpeaker = () => {
    try {
      const newSpeakerState = !isSpeakerOn;
      // Toggle speakerphone via InCallManager
      InCallManager.setSpeakerphoneOn(newSpeakerState);
      setIsSpeakerOn(newSpeakerState);
      console.log(`🔊 Speaker ${newSpeakerState ? 'ON' : 'OFF'}`);
    } catch (error) {
      console.error('❌ Failed to toggle speaker:', error);
      Alert.alert('Error', 'Failed to toggle speaker');
    }
  };

  const switchCamera = async () => {
    try {
      await enhancedGlobalWebRTCService.switchCamera();
      // Update local stream URL to force RTCView refresh
      if (localStream) {
        const newUrl = localStream.toURL();
        setLocalStreamUrl(newUrl);
      }
    } catch (error) {
      console.error('❌ Failed to switch camera:', error);
      Alert.alert('Error', 'Failed to switch camera');
    }
  };

  // ============ UTILITY FUNCTIONS ============
  const handleBackPress = () => {
    Alert.alert(
      'End Call',
      'Are you sure you want to end this call?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'End Call', style: 'destructive', onPress: endCall }
      ]
    );
    return true;
  };

  const cleanup = () => {
    console.log('🧹 Cleaning up CallScreen');
    if (callTimer.current) {
      clearInterval(callTimer.current);
      callTimer.current = null;
    }
    try {
      // Stop InCallManager session
      InCallManager.stop();
    } catch (error) {
      console.error('❌ Error stopping InCallManager:', error);
    }
    // Clear screen-specific callbacks
    enhancedGlobalWebRTCService.clearScreenCallbacks();
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getProfileImageUrl = (user) => {
    if (!user) return null;
    if (user.photoUrl && typeof user.photoUrl === 'string') {
      return user.photoUrl;
    }
    if (user.profilePicture && typeof user.profilePicture === 'string') {
      return user.profilePicture;
    }
    if (user.profilePic && typeof user.profilePic === 'string') {
      if (user.profilePic.startsWith('http://') || user.profilePic.startsWith('https://')) {
        return user.profilePic;
      }
      const cleanPath = user.profilePic.startsWith('/') ? user.profilePic.substring(1) : user.profilePic;
      return `${BASE_URL}/${cleanPath}`;
    }
    return null;
  };

  const getInitials = (name) => {
    if (!name) return '?';
    const names = name.trim().split(' ');
    if (names.length === 1) {
      return names[0].charAt(0).toUpperCase();
    }
    return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase();
  };

  // ============ RENDER FUNCTIONS ============
  const renderCallStatus = () => {
    const participant = isIncoming ? callerData : calleeData;
    const participantName = participant?.fullName || participant?.name || 'Unknown';
    let statusText = '';
    let statusColor = '#ffffff';
    switch (callState) {
      case 'incoming':
        statusText = 'Incoming call...';
        statusColor = '#4CAF50';
        break;
      case 'initiating':
      case 'calling':
        statusText = 'Calling...';
        statusColor = '#2196F3';
        break;
      case 'answering':
        statusText = 'Answering...';
        statusColor = '#4CAF50';
        break;
      case 'connecting':
        statusText = 'Connecting...';
        statusColor = '#FF9800';
        break;
      case 'connected':
        statusText = formatDuration(callDuration);
        statusColor = '#4CAF50';
        break;
      case 'reconnecting':
        statusText = 'Reconnecting...';
        statusColor = '#FF9800';
        break;
      default:
        statusText = 'Loading...';
        statusColor = '#999';
    }
    return (
      <View style={styles.statusContainer}>
        <Text style={styles.participantName}>{participantName}</Text>
        <View style={styles.statusRow}>
          <Text style={[styles.statusText, { color: statusColor }]}>{statusText}</Text>
          {(callState === 'connecting' || callState === 'reconnecting') && (
            <ActivityIndicator
              size="small"
              color={statusColor}
              style={styles.statusIndicator}
            />
          )}
        </View>
      </View>
    );
  };

  const renderVideoViews = () => {
    const participant = isIncoming ? callerData : calleeData;
    const participantName = participant?.fullName || participant?.name || 'Unknown';
    const profileImageUrl = getProfileImageUrl(participant);
    if (callType === 'audio') {
      return (
        <View style={styles.audioCallContainer}>
          <View style={styles.avatarContainer}>
            {profileImageUrl ? (
              <Image
                source={{ uri: profileImageUrl }}
                style={styles.avatarImage}
                onError={() => console.log('Failed to load participant image')}
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>
                  {getInitials(participantName)}
                </Text>
              </View>
            )}
          </View>
        </View>
      );
    }
    // Video call rendering with stable URLs
    return (
      <View style={styles.videoContainer}>
        {/* Remote video (full screen) */}
        {remoteStreamUrl ? (
          <RTCView
            streamURL={remoteStreamUrl}
            style={styles.remoteVideo}
            objectFit="cover"
            mirror={false}
            zOrder={0}
          />
        ) : (
          <View style={styles.waitingForVideoContainer}>
            {profileImageUrl ? (
              <Image
                source={{ uri: profileImageUrl }}
                style={styles.waitingAvatar}
                onError={() => console.log('Failed to load participant image')}
              />
            ) : (
              <View style={styles.waitingAvatarPlaceholder}>
                <Text style={styles.waitingAvatarText}>
                  {getInitials(participantName)}
                </Text>
              </View>
            )}
            <Text style={styles.waitingText}>
              {isConnected ? 'Camera is off' : 'Connecting...'}
            </Text>
          </View>
        )}
        {/* Local video preview */}
        {localStreamUrl && isVideoEnabled ? (
          <View style={styles.localVideoContainer}>
            <RTCView
              streamURL={localStreamUrl}
              style={styles.localVideo}
              objectFit="cover"
              mirror={true}
              zOrder={1}
            />
            <TouchableOpacity
              style={styles.switchCameraButton}
              onPress={switchCamera}
            >
              <Ionicons name="camera-reverse" size={16} color="white" />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.localVideoOffContainer}>
            <Ionicons
              name={!isVideoEnabled ? "videocam-off" : "videocam"}
              size={24}
              color={!isVideoEnabled ? "#ff9800" : "#ccc"}
            />
            <Text style={styles.localVideoOffText}>
              {!isVideoEnabled ? 'Camera Off' : 'Starting...'}
            </Text>
          </View>
        )}
      </View>
    );
  };

  const renderCallControls = () => {
    return (
      <View style={styles.controlsContainer}>
        <View style={styles.callControls}>
          {/* Mute button */}
          <TouchableOpacity
            style={[styles.controlButton, isMuted && styles.mutedButton]}
            onPress={toggleMute}
            activeOpacity={0.7}
          >
            <Ionicons
              name={isMuted ? "mic-off" : "mic"}
              size={24}
              color="white"
            />
          </TouchableOpacity>
          {/* Speaker button */}
          <TouchableOpacity
            style={[styles.controlButton, isSpeakerOn && styles.speakerOnButton]}
            onPress={toggleSpeaker}
            activeOpacity={0.7}
          >
            <Ionicons
              name={isSpeakerOn ? "volume-high" : "volume-low"}
              size={24}
              color="white"
            />
          </TouchableOpacity>
          {/* Video toggle button (only for video calls) */}
          {callType === 'video' && (
            <TouchableOpacity
              style={[styles.controlButton, !isVideoEnabled && styles.videoOffButton]}
              onPress={toggleVideo}
              activeOpacity={0.7}
            >
              <Ionicons
                name={isVideoEnabled ? "videocam" : "videocam-off"}
                size={24}
                color="white"
              />
            </TouchableOpacity>
          )}
          {/* End call button */}
          <TouchableOpacity
            style={styles.endCallButton}
            onPress={endCall}
            activeOpacity={0.7}
          >
            <Ionicons
              name="call"
              size={28}
              color="white"
              style={{ transform: [{ rotate: '135deg' }] }}
            />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // ============ LOADING STATE ============
  if (isInitializing && callType === 'video') {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar backgroundColor="#000" barStyle="light-content" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>Preparing video call...</Text>
          <Text style={styles.loadingSubText}>Setting up camera...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ============ MAIN RENDER ============
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#000" barStyle="light-content" />
      {/* Video/Audio views */}
      {renderVideoViews()}
      {/* Call status overlay */}
      <View style={styles.overlay}>
        {renderCallStatus()}
      </View>
      {/* Call controls */}
      {renderCallControls()}
    </SafeAreaView>
  );
};

// ============ STYLES (same as before) ============
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
  },
  loadingText: {
    color: 'white',
    fontSize: 16,
    marginTop: 16,
  },
  loadingSubText: {
    color: '#ccc',
    fontSize: 14,
    marginTop: 8,
  },
  videoContainer: {
    flex: 1,
    position: 'relative',
  },
  remoteVideo: {
    flex: 1,
    backgroundColor: '#000',
    width: '100%',
    height: '100%',
  },
  localVideoContainer: {
    position: 'absolute',
    top: 80,
    right: 20,
    width: 120,
    height: 180,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#333',
    borderWidth: 2,
    borderColor: 'rgba(76, 175, 80, 0.8)',
    zIndex: 999,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.5,
    shadowRadius: 6,
  },
  localVideo: {
    width: '100%',
    height: '100%',
    backgroundColor: '#222',
  },
  localVideoOffContainer: {
    position: 'absolute',
    top: 80,
    right: 20,
    width: 120,
    height: 180,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderWidth: 2,
    borderColor: 'rgba(255, 152, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.5,
    shadowRadius: 6,
  },
  localVideoOffText: {
    color: '#ccc',
    fontSize: 10,
    marginTop: 4,
    textAlign: 'center',
  },
  switchCameraButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  audioCallContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
  },
  avatarContainer: {
    alignItems: 'center',
  },
  avatarImage: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#333',
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  avatarPlaceholder: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  avatarText: {
    fontSize: 64,
    color: 'white',
    fontWeight: 'bold',
  },
  waitingForVideoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
  },
  waitingAvatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#333',
    marginBottom: 16,
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  waitingAvatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  waitingAvatarText: {
    fontSize: 36,
    color: 'white',
    fontWeight: 'bold',
  },
  waitingText: {
    color: '#ccc',
    fontSize: 16,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 60,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    zIndex: 5,
  },
  statusContainer: {
    alignItems: 'center',
  },
  participantName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusText: {
    fontSize: 18,
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10
  },
  statusIndicator: {
    marginLeft: 8,
  },
  controlsContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 60,
    paddingHorizontal: 40,
    zIndex: 5,
  },
  callControls: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    paddingVertical: 20,
    borderRadius: 25,
  },
  controlButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  mutedButton: {
    backgroundColor: '#f44336',
  },
  speakerOnButton: {
    backgroundColor: '#2196F3',
  },
  videoOffButton: {
    backgroundColor: '#ff9800',
  },
  endCallButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#f44336',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
});

export default CallScreen;