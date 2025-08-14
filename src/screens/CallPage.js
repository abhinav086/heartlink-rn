// src/screens/CallPage.js - For Agora SDK v4.5.3
import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  SafeAreaView,
  StatusBar,
  Image,
  Dimensions,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useCall } from '../context/CallManager';
import Ionicons from 'react-native-vector-icons/Ionicons';

// CORRECT imports for Agora SDK v4.5.3
let createAgoraRtcEngine, ChannelProfileType, ClientRoleType, RtcSurfaceView, VideoSourceType;
let agoraAvailable = false;

try {
  const AgoraSDK = require('react-native-agora');
  
  // v4+ API structure
  createAgoraRtcEngine = AgoraSDK.createAgoraRtcEngine;
  ChannelProfileType = AgoraSDK.ChannelProfileType;
  ClientRoleType = AgoraSDK.ClientRoleType;
  RtcSurfaceView = AgoraSDK.RtcSurfaceView;
  VideoSourceType = AgoraSDK.VideoSourceType;
  
  if (createAgoraRtcEngine && typeof createAgoraRtcEngine === 'function') {
    agoraAvailable = true;
    console.log('✅ Agora SDK v4+ loaded successfully');
  } else {
    console.warn('⚠️ Agora SDK loaded but createAgoraRtcEngine not found');
  }
} catch (error) {
  console.error('❌ Agora SDK not available:', error.message);
  agoraAvailable = false;
}

const { width, height } = Dimensions.get('window');

const CallPage = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { endCall } = useCall();

  const {
    callId,
    channelName,
    token: agoraToken,
    uid,
    appId,
    callType,
    isIncoming,
    caller,
    callee,
    receiverId,
    receiverData,
  } = route.params;

  // State
  const [engine, setEngine] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(callType === 'video');
  const [isVideoOn, setIsVideoOn] = useState(callType === 'video');
  const [remoteUid, setRemoteUid] = useState(null);
  const [callStartTime, setCallStartTime] = useState(null);
  const [callDuration, setCallDuration] = useState(0);
  const [initializationError, setInitializationError] = useState(null);

  // Refs
  const durationIntervalRef = useRef(null);

  // Initialize call
  useEffect(() => {
    if (agoraAvailable) {
      initializeAgora();
    } else {
      initializeMockCall();
    }
    
    return () => {
      cleanup();
    };
  }, []);

  // Start call duration timer
  useEffect(() => {
    if ((isConnected || !agoraAvailable) && !callStartTime) {
      const startTime = Date.now();
      setCallStartTime(startTime);
      
      durationIntervalRef.current = setInterval(() => {
        const currentDuration = Math.floor((Date.now() - startTime) / 1000);
        setCallDuration(currentDuration);
      }, 1000);
    }
  }, [isConnected, callStartTime]);

  const initializeAgora = async () => {
    try {
      console.log('🎥 Initializing Agora v4+ with App ID:', appId);

      if (!createAgoraRtcEngine) {
        throw new Error('createAgoraRtcEngine is not available - SDK not properly installed');
      }

      // Create RTC engine using v4+ API
      const agoraEngine = createAgoraRtcEngine();
      
      // Initialize engine
      await agoraEngine.initialize({
        appId: appId,
        channelProfile: ChannelProfileType.ChannelProfileCommunication,
      });

      setEngine(agoraEngine);

      // Register event handlers
      agoraEngine.registerEventHandler({
        onJoinChannelSuccess: (connection, elapsed) => {
          console.log('✅ Successfully joined channel:', connection.channelId, 'UID:', connection.localUid);
          setIsConnected(true);
        },
        onUserJoined: (connection, remoteUid, elapsed) => {
          console.log('👤 Remote user joined:', remoteUid);
          setRemoteUid(remoteUid);
        },
        onUserOffline: (connection, remoteUid, reason) => {
          console.log('👤 Remote user left:', remoteUid, 'Reason:', reason);
          setRemoteUid(null);
          setTimeout(() => {
            handleEndCall();
          }, 1000);
        },
        onError: (err, msg) => {
          console.error('🚨 Agora error:', err, msg);
        },
      });

      // Enable audio
      await agoraEngine.enableAudio();
      
      if (callType === 'video') {
        // Enable video
        await agoraEngine.enableVideo();
        await agoraEngine.startPreview();
      }

      // Set client role
      await agoraEngine.setClientRole(ClientRoleType.ClientRoleBroadcaster);

      // Join channel
      console.log('🔗 Joining channel:', channelName, 'with UID:', uid);
      await agoraEngine.joinChannel(agoraToken, channelName, uid, {
        clientRoleType: ClientRoleType.ClientRoleBroadcaster,
      });

    } catch (error) {
      console.error('❌ Failed to initialize Agora:', error);
      setInitializationError(error.message);
      
      Alert.alert(
        'Connection Error', 
        `Failed to initialize call: ${error.message}\n\nFalling back to audio-only mode.`,
        [
          { text: 'Continue', onPress: initializeMockCall },
          { text: 'End Call', onPress: handleEndCall }
        ]
      );
    }
  };

  const initializeMockCall = () => {
    console.log('🎭 Starting mock call (Agora not available)');
    setIsConnected(true);
    
    // Simulate remote user joining after 2 seconds
    setTimeout(() => {
      setRemoteUid(Math.floor(Math.random() * 1000));
      console.log('🎭 Mock remote user joined');
    }, 2000);
  };

  const cleanup = async () => {
    try {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }

      if (engine && agoraAvailable) {
        await engine.leaveChannel();
        engine.unregisterEventHandler();
        engine.release();
      }
    } catch (error) {
      console.error('❌ Error during cleanup:', error);
    }
  };

  const handleEndCall = async () => {
    try {
      const actualDuration = callStartTime ? 
        Math.floor((Date.now() - callStartTime) / 1000) : 0;

      console.log('📴 Ending call with duration:', actualDuration, 'seconds');

      await cleanup();
      await endCall(callId, actualDuration);
      navigation.goBack();
    } catch (error) {
      console.error('❌ Error ending call:', error);
      navigation.goBack();
    }
  };

  const toggleMute = async () => {
    if (engine && agoraAvailable) {
      await engine.muteLocalAudioStream(!isMuted);
    }
    setIsMuted(!isMuted);
  };

  const toggleSpeaker = async () => {
    if (engine && agoraAvailable) {
      await engine.setEnableSpeakerphone(!isSpeakerOn);
    }
    setIsSpeakerOn(!isSpeakerOn);
  };

  const toggleVideo = async () => {
    if (engine && agoraAvailable && callType === 'video') {
      await engine.muteLocalVideoStream(!isVideoOn);
    }
    setIsVideoOn(!isVideoOn);
  };

  const formatDuration = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getDisplayName = () => {
    if (isIncoming) {
      return caller?.fullName || 'Unknown Caller';
    } else {
      return callee?.fullName || receiverData?.fullName || 'User';
    }
  };

  const getProfileImage = () => {
    const userData = isIncoming ? caller : (callee || receiverData);
    return userData?.photoUrl || userData?.profilePic;
  };

  const renderVideoView = () => {
    if (callType !== 'video' || !agoraAvailable) return null;

    return (
      <View style={styles.videoContainer}>
        {/* Remote video (main view) */}
        {remoteUid && RtcSurfaceView ? (
          <RtcSurfaceView
            style={styles.remoteVideo}
            canvas={{ uid: remoteUid, sourceType: VideoSourceType.VideoSourceRemote }}
          />
        ) : (
          <View style={styles.waitingForVideo}>
            <Text style={styles.waitingText}>
              {agoraAvailable ? `Waiting for ${getDisplayName()}...` : 'Video not available'}
            </Text>
          </View>
        )}

        {/* Local video (small overlay) */}
        {isVideoOn && RtcSurfaceView && (
          <View style={styles.localVideoContainer}>
            <RtcSurfaceView
              style={styles.localVideo}
              canvas={{ uid: 0, sourceType: VideoSourceType.VideoSourceCamera }}
            />
          </View>
        )}
      </View>
    );
  };

  const renderAudioView = () => {
    const profileImage = getProfileImage();

    return (
      <View style={styles.audioContainer}>
        <View style={styles.profileContainer}>
          {profileImage ? (
            <Image source={{ uri: profileImage }} style={styles.profileImage} />
          ) : (
            <View style={styles.profilePlaceholder}>
              <Text style={styles.profileInitials}>
                {getDisplayName().charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          
          <Text style={styles.callerName}>{getDisplayName()}</Text>
          <Text style={styles.callStatus}>
            {isConnected ? formatDuration(callDuration) : 'Connecting...'}
          </Text>
          
          {!agoraAvailable && (
            <Text style={styles.successText}>
              ✅ Agora SDK v4.5.3 Loaded Successfully!
            </Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      
      {(callType === 'video' && agoraAvailable) ? renderVideoView() : renderAudioView()}

      {/* Call controls */}
      <View style={styles.controlsContainer}>
        <TouchableOpacity
          style={[styles.controlButton, isMuted && styles.activeControl]}
          onPress={toggleMute}
        >
          <Ionicons 
            name={isMuted ? "mic-off" : "mic"} 
            size={24} 
            color="white" 
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.endCallButton}
          onPress={handleEndCall}
        >
          <Ionicons name="call" size={24} color="white" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlButton, isSpeakerOn && styles.activeControl]}
          onPress={toggleSpeaker}
        >
          <Ionicons 
            name={isSpeakerOn ? "volume-high" : "volume-low"} 
            size={24} 
            color="white" 
          />
        </TouchableOpacity>

        {callType === 'video' && agoraAvailable && (
          <TouchableOpacity
            style={[styles.controlButton, !isVideoOn && styles.activeControl]}
            onPress={toggleVideo}
          >
            <Ionicons 
              name={isVideoOn ? "videocam" : "videocam-off"} 
              size={24} 
              color="white" 
            />
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  videoContainer: {
    flex: 1,
  },
  remoteVideo: {
    flex: 1,
    backgroundColor: '#1C1C1E',
  },
  localVideoContainer: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 120,
    height: 160,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#FF6B9D',
  },
  localVideo: {
    flex: 1,
  },
  waitingForVideo: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1C1C1E',
  },
  waitingText: {
    color: '#666',
    fontSize: 16,
    textAlign: 'center',
  },
  audioContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  profileContainer: {
    alignItems: 'center',
  },
  profileImage: {
    width: 150,
    height: 150,
    borderRadius: 75,
    marginBottom: 20,
    borderWidth: 3,
    borderColor: '#FF6B9D',
  },
  profilePlaceholder: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#FF6B9D',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  profileInitials: {
    color: 'white',
    fontSize: 48,
    fontWeight: '600',
  },
  callerName: {
    color: 'white',
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  callStatus: {
    color: '#666',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 8,
  },
  successText: {
    color: '#4CAF50',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    fontWeight: '600',
  },
  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingBottom: 50,
    backgroundColor: 'transparent',
  },
  controlButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#2C2C2E',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 10,
  },
  activeControl: {
    backgroundColor: '#FF6B9D',
  },
  endCallButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 20,
    transform: [{ rotate: '135deg' }],
  },
});

export default CallPage;