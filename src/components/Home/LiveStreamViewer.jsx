// src/screens/LiveStreamViewer.js - UPDATED WITH LOUDSPEAKER AUDIO
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  TextInput,
  Dimensions,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import enhancedGlobalWebRTCService from '../../services/EnhancedGlobalWebRTCService';
import BASE_URL from '../../config/config';
import { RTCView } from 'react-native-webrtc';
import InCallManager from 'react-native-incall-manager';

// Responsive utilities
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const scale = (size) => (SCREEN_WIDTH / 375) * size;
const verticalScale = (size) => (SCREEN_HEIGHT / 812) * size;
const moderateScale = (size, factor = 0.5) => size + (scale(size) - size) * factor;

const LiveStreamViewer = ({ navigation, route }) => {
  const { user, token } = useAuth();
  const { socket, isConnected } = useSocket();
  const initialStreamId = route?.params?.streamId;
  
  // State management
  const [activeStreams, setActiveStreams] = useState([]);
  const [loadingStreams, setLoadingStreams] = useState(false);
  const [currentStreamId, setCurrentStreamId] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [currentViewerCount, setCurrentViewerCount] = useState(0);
  const [streamTitle, setStreamTitle] = useState('');
  const [streamerName, setStreamerName] = useState('');
  const [streamStatus, setStreamStatus] = useState('');
  const [hasAutoJoined, setHasAutoJoined] = useState(false);
  const [offerTimeout, setOfferTimeout] = useState(null);
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  
  // WebRTC States
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isWebRTCConnected, setIsWebRTCConnected] = useState(false);
  const [connectionQuality, setConnectionQuality] = useState('unknown');
  const [streamState, setStreamState] = useState('idle');
  const [broadcasterStatus, setBroadcasterStatus] = useState('unknown');
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [speakerEnabled, setSpeakerEnabled] = useState(true); // Track speaker state
  
  const flatListRef = useRef();

  // ============ AUDIO MANAGEMENT FUNCTIONS ============
  const enableLoudspeaker = () => {
    try {
      console.log('🔊 Enabling loudspeaker audio routing...');
      
      // Start InCallManager with speaker on (no ringtone)
      InCallManager.start({ 
        media: 'video', 
        auto: false
      });
      
      // Force speaker on
      InCallManager.setForceSpeakerphoneOn(true);
      
      // Enable speaker
      InCallManager.setSpeakerphoneOn(true);
      
      console.log('✅ Loudspeaker enabled');
      setSpeakerEnabled(true);
    } catch (error) {
      console.error('❌ Error enabling loudspeaker:', error);
    }
  };

  const disableLoudspeaker = () => {
    try {
      console.log('🔇 Disabling loudspeaker...');
      
      // Stop forcing speakerphone
      InCallManager.setForceSpeakerphoneOn(false);
      InCallManager.setSpeakerphoneOn(false);
      InCallManager.stop();
      
      console.log('✅ Loudspeaker disabled');
      setSpeakerEnabled(false);
    } catch (error) {
      console.error('❌ Error disabling loudspeaker:', error);
    }
  };

  // ============ SERVICE INITIALIZATION ============
  useEffect(() => {
    const initializeService = async () => {
      try {
        console.log('🚀 Initializing Enhanced WebRTC Service for Live Streaming');
        
        if (!socket || !isConnected) {
          console.warn('⚠ Socket not ready, waiting...');
          setError('Connecting to server...');
          return;
        }

        console.log('🔌 Setting external socket for WebRTC service');
        enhancedGlobalWebRTCService.setExternalSocket(socket);
        
        await enhancedGlobalWebRTCService.initialize(token);
        
        enhancedGlobalWebRTCService.setCallbacks({
          onLocalStream: handleLocalStream,
          onRemoteStream: handleRemoteStream,
          onStreamStateChange: handleStreamStateChange,
          onError: handleError,
          onViewerCount: handleViewerCount,
          onConnectionQuality: handleConnectionQuality,
          onChatMessage: handleChatMessage,
          onReaction: handleReaction,
          onStreamEnded: handleStreamEnded,
        });
        
        console.log('✅ Enhanced WebRTC Service initialized for live streaming');
        setError('');
        
        if (initialStreamId && !hasAutoJoined) {
          console.log('🎯 Auto-joining stream:', initialStreamId);
          setTimeout(() => {
            joinStream(initialStreamId);
            setHasAutoJoined(true);
          }, 1000);
        }
      } catch (error) {
        console.error('❌ Failed to initialize service:', error);
        setError(`Initialization failed: ${error.message}`);
      }
    };

    if (token && user) {
      initializeService();
    }

    return () => {
      console.log('🧹 LiveStreamViewer component unmounting');
      
      // Clean up audio routing
      disableLoudspeaker();
      
      if (offerTimeout) {
        clearTimeout(offerTimeout);
      }
      if (currentStreamId) {
        console.log('🧹 Cleaning up stream:', currentStreamId);
        enhancedGlobalWebRTCService.leaveStream();
      }
    };
  }, [token, user, socket, isConnected, initialStreamId]);

  // ============ SERVICE CALLBACKS ============
  const handleLocalStream = (stream) => {
    console.log('📹 Local stream received:', stream?.id);
    setLocalStream(stream);
  };

  // Enhanced remote stream handling with loudspeaker audio
  const handleRemoteStream = (stream) => {
    console.log('📺 Processing remote stream:', stream?.id);
    console.log('📺 Stream active:', stream?.active);
    console.log('📺 Stream tracks:', stream?.getTracks().length);
    
    if (stream) {
      const audioTracks = stream.getAudioTracks();
      const videoTracks = stream.getVideoTracks();
      
      console.log('📺 Remote audio tracks:', audioTracks.length);
      console.log('📺 Remote video tracks:', videoTracks.length);
      
      // ✅ ENABLE AUDIO BY DEFAULT WITH MAX VOLUME
      audioTracks.forEach((track, index) => {
        track.enabled = true; // Ensure audio is enabled
        console.log(`🎵 Audio track ${index} enabled:`, {
          id: track.id,
          enabled: track.enabled,
          muted: track.muted,
          readyState: track.readyState
        });
      });
      
      // Enable video tracks as well
      videoTracks.forEach((track, index) => {
        track.enabled = true;
        console.log(`📹 Video track ${index} enabled:`, {
          id: track.id,
          enabled: track.enabled,
          readyState: track.readyState
        });
      });
      
      if (audioTracks.length === 0) {
        console.warn('⚠️ No audio tracks in remote stream!');
      } else {
        // ✅ ENABLE LOUDSPEAKER WHEN STREAM STARTS
        enableLoudspeaker();
        // Note: Volume can be controlled using device volume buttons
      }
    }
    
    setRemoteStream(stream);
    setIsWebRTCConnected(true);
    setError('');
    setBroadcasterStatus('streaming');
    
    if (offerTimeout) {
      clearTimeout(offerTimeout);
      setOfferTimeout(null);
    }
    setConnectionAttempts(0);
  };

  const handleStreamStateChange = (state, data) => {
    console.log('🔄 Stream state changed:', state, data);
    setStreamState(state);
    
    switch (state) {
      case 'joining':
        setIsConnecting(true);
        setError('');
        setBroadcasterStatus('checking');
        break;
        
      case 'viewing':
        setIsConnecting(false);
        if (data) {
          setStreamTitle(data.title || 'Live Stream');
          setStreamerName(data.streamer?.fullName || 'Streamer');
          setCurrentViewerCount(data.currentViewerCount || 0);
        }
        startOfferTimeout();
        break;
        
      case 'connected':
        setIsConnecting(false);
        setIsWebRTCConnected(true);
        setBroadcasterStatus('connected');
        // ✅ ENSURE LOUDSPEAKER IS ON WHEN CONNECTED
        enableLoudspeaker();
        break;
        
      case 'video_connected':
        setIsConnecting(false);
        setIsWebRTCConnected(true);
        setBroadcasterStatus('streaming');
        // ✅ ENSURE LOUDSPEAKER IS ON WHEN VIDEO CONNECTED
        enableLoudspeaker();
        console.log('✅ Video connection established with loudspeaker!');
        break;
        
      case 'ended':
        handleStreamEnd();
        break;
        
      case 'error':
        setError(data?.message || 'Stream error occurred');
        setBroadcasterStatus('error');
        break;
        
      default:
        console.log('🔄 Stream state changed to unhandled state:', state);
    }
  };

  const handleError = (errorData) => {
    console.error('❌ Service error:', errorData);
    setError(errorData.message || 'An error occurred');
    setIsConnecting(false);
    setBroadcasterStatus('error');
  };

  const handleViewerCount = (data) => {
    console.log('👥 Viewer count update:', data);
    setCurrentViewerCount(data.count || data.currentViewerCount || 0);
  };

  const handleConnectionQuality = ({ quality, stats }) => {
    console.log('📊 Connection quality:', quality);
    setConnectionQuality(quality);
  };

  const handleChatMessage = (data) => {
    console.log('💬 Chat message received:', data);
    setChatMessages(prev => [...prev, {
      id: data.id || `${Date.now()}_${Math.random()}`,
      user: data.user || { username: data.username },
      message: data.message,
      timestamp: data.timestamp || Date.now(),
    }]);
    
    setTimeout(() => {
      if (flatListRef.current) {
        flatListRef.current.scrollToEnd({ animated: true });
      }
    }, 100);
  };

  const handleReaction = (data) => {
    console.log('❤ Reaction received:', data);
  };

  const handleStreamEnded = (data) => {
    console.log('🔚 Stream ended:', data);
    handleStreamEnd();
    Alert.alert('Stream Ended', data.reason || 'The stream has ended.');
  };

  const handleStreamEnd = () => {
    setStreamState('ended');
    setIsWebRTCConnected(false);
    setCurrentStreamId(null);
    setRemoteStream(null);
    setChatMessages([]);
    setCurrentViewerCount(0);
    setBroadcasterStatus('offline');
    
    // ✅ DISABLE LOUDSPEAKER WHEN STREAM ENDS
    disableLoudspeaker();
    
    if (offerTimeout) {
      clearTimeout(offerTimeout);
      setOfferTimeout(null);
    }
    setConnectionAttempts(0);
  };

  // ============ WEBRTC OFFER TIMEOUT HANDLING ============
  const startOfferTimeout = () => {
    console.log('⏰ Starting offer timeout (10 seconds)...');
    const timeout = setTimeout(() => {
      if (!isWebRTCConnected && currentStreamId) {
        console.warn('⚠ No WebRTC offer received after 10 seconds');
        setBroadcasterStatus('not_ready');
        setConnectionAttempts(prev => prev + 1);
        
        if (connectionAttempts < 3) {
          console.log('🔄 Attempting to request offer manually (attempt', connectionAttempts + 1, ')');
          startOfferTimeout();
        } else {
          setError('Broadcaster is not sending video. They may need to start their camera.');
          setBroadcasterStatus('no_video');
        }
      }
    }, 10000);
    
    setOfferTimeout(timeout);
  };

  // ============ AUDIO CONTROL (MUTE/UNMUTE) ============
  const toggleAudio = () => {
    if (remoteStream) {
      const audioTracks = remoteStream.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = !audioEnabled;
      });
      setAudioEnabled(!audioEnabled);
      
      // If unmuting, ensure speaker is on
      if (!audioEnabled) {
        enableLoudspeaker();
      }
    }
  };

  // ============ SPEAKER CONTROL ============
  const toggleSpeaker = () => {
    if (speakerEnabled) {
      // Switch to earpiece
      InCallManager.setForceSpeakerphoneOn(false);
      InCallManager.setSpeakerphoneOn(false);
      setSpeakerEnabled(false);
      console.log('📞 Switched to earpiece');
    } else {
      // Switch to loudspeaker
      enableLoudspeaker();
      console.log('🔊 Switched to loudspeaker');
    }
  };

  // ============ STREAM MANAGEMENT ============
  const fetchActiveStreams = async () => {
    if (!token) return;
    
    setLoadingStreams(true);
    setError('');
    
    try {
      const response = await fetch(`${BASE_URL}/api/v1/live/active`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('📊 Active streams response:', data);

      let streams = [];
      if (data.streams && Array.isArray(data.streams)) {
        streams = data.streams;
      } else if (data.data && Array.isArray(data.data.streams)) {
        streams = data.data.streams;
      } else if (Array.isArray(data)) {
        streams = data;
      }

      setActiveStreams(streams);
      console.log(`✅ Fetched ${streams.length} active streams`);
    } catch (err) {
      console.error('❌ Error fetching streams:', err);
      setError(err.message || 'Could not load streams.');
    } finally {
      setLoadingStreams(false);
    }
  };

  const joinStream = async (streamId) => {
    try {
      console.log('🎥 🎯 Starting join stream process:', streamId);
      
      if (!socket || !isConnected) {
        throw new Error('Socket connection not ready');
      }
      
      if (!enhancedGlobalWebRTCService.isReady()) {
        throw new Error('WebRTC service not ready');
      }

      setCurrentStreamId(streamId);
      setIsConnecting(true);
      setError('');
      setChatMessages([]);
      setStreamState('joining');
      setBroadcasterStatus('checking');
      setConnectionAttempts(0);
      setAudioEnabled(true); // Enable audio by default
      setSpeakerEnabled(true); // Enable speaker by default

      // ✅ ENABLE LOUDSPEAKER WHEN JOINING STREAM
      enableLoudspeaker();
      // Note: Use device volume buttons to control volume level

      const stream = activeStreams.find(s => s.streamId === streamId);
      if (stream) {
        setStreamTitle(stream.title || 'Live Stream');
        setStreamerName(stream.streamer?.fullName || stream.streamer?.username || 'Streamer');
        setStreamStatus(stream.status || 'LIVE');
        setCurrentViewerCount(stream.currentViewerCount || 0);
      }

      console.log('🎯 Calling enhancedGlobalWebRTCService.joinStreamAsViewer...');
      const success = await enhancedGlobalWebRTCService.joinStreamAsViewer(streamId);
      
      if (!success) {
        throw new Error('Failed to join stream');
      }

      console.log('✅ Service join initiated successfully with loudspeaker enabled');
    } catch (error) {
      console.error('❌ Error joining stream:', error);
      setError(error.message || 'Failed to join stream');
      setIsConnecting(false);
      setCurrentStreamId(null);
      setStreamState('idle');
      setBroadcasterStatus('error');
      disableLoudspeaker(); // Disable speaker on error
      Alert.alert('Error', error.message || 'Failed to join the stream.');
    }
  };

  const leaveStream = async () => {
    console.log('🎥 Leaving stream');
    try {
      if (currentStreamId) {
        await enhancedGlobalWebRTCService.leaveStream();
      }
    } catch (error) {
      console.error('❌ Error leaving stream:', error);
    }

    // ✅ DISABLE LOUDSPEAKER WHEN LEAVING STREAM
    disableLoudspeaker();

    setCurrentStreamId(null);
    setIsConnecting(false);
    setIsWebRTCConnected(false);
    setRemoteStream(null);
    setLocalStream(null);
    setChatMessages([]);
    setCurrentViewerCount(0);
    setStreamTitle('');
    setStreamerName('');
    setStreamStatus('');
    setError('');
    setStreamState('idle');
    setConnectionQuality('unknown');
    setBroadcasterStatus('unknown');
    setAudioEnabled(true);
    setSpeakerEnabled(true);
    
    if (offerTimeout) {
      clearTimeout(offerTimeout);
      setOfferTimeout(null);
    }
    setConnectionAttempts(0);
  };

  // ============ CHAT & REACTIONS ============
  const sendChatMessage = () => {
    const messageToSend = newMessage.trim();
    if (!messageToSend || !currentStreamId) return;

    const success = enhancedGlobalWebRTCService.sendChatMessage(messageToSend);
    if (success) {
      console.log(`💬 Sent chat message: ${messageToSend}`);
      setNewMessage('');
    } else {
      Alert.alert('Error', 'Could not send message.');
    }
  };

  const sendReaction = (reaction) => {
    if (!currentStreamId) return;

    const success = enhancedGlobalWebRTCService.sendReaction(reaction);
    if (success) {
      console.log(`❤ Sent reaction: ${reaction}`);
    }
  };

  // ============ LIFECYCLE EFFECTS ============
  useEffect(() => {
    if (token && socket && isConnected) {
      fetchActiveStreams();
    }
  }, [token, socket, isConnected]);

  // ============ RENDER FUNCTIONS ============
  const renderStreamItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.streamItem}
      onPress={() => joinStream(item.streamId)}
      disabled={!!currentStreamId || isConnecting}
      activeOpacity={0.8}
    >
      <View style={styles.streamItemHeader}>
        <View style={styles.liveTag}>
          <Text style={styles.liveTagText}>LIVE</Text>
        </View>
        <Text style={styles.viewerCountBadge}>{item.currentViewerCount || 0} viewers</Text>
      </View>
      
      <Text style={styles.streamTitle} numberOfLines={2}>{item.title}</Text>
      
      <View style={styles.streamerInfo}>
        <Text style={styles.streamerName}>
          {item.streamer?.fullName || item.streamer?.username || 'Unknown'}
        </Text>
        <Text style={styles.streamCategory}>{item.category || 'General'}</Text>
      </View>
      
      <View style={styles.joinButtonContainer}>
        <TouchableOpacity
          style={[
            styles.joinButton,
            (isConnecting && currentStreamId === item.streamId) && styles.joiningButton,
            !!currentStreamId && styles.disabledButton
          ]}
          onPress={() => joinStream(item.streamId)}
          disabled={!!currentStreamId || isConnecting}
        >
          <Text style={styles.joinButtonText}>
            {(isConnecting && currentStreamId === item.streamId) ? 'Joining...' :
             currentStreamId ? 'In Stream' : 'Join Stream'}
          </Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  const renderReactionButtons = () => (
    <View style={styles.reactionContainer}>
      {['❤️', '👍', '😍', '🔥', '👏'].map((reaction) => (
        <TouchableOpacity
          key={reaction}
          style={styles.reactionButton}
          onPress={() => sendReaction(reaction)}
          activeOpacity={0.7}
        >
          <Text style={styles.reactionText}>{reaction}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const getBroadcasterStatusMessage = () => {
    switch (broadcasterStatus) {
      case 'checking':
        return 'Connecting...';
      case 'not_ready':
        return 'Waiting for broadcaster...';
      case 'no_video':
        return 'Broadcaster camera offline';
      case 'connected':
        return 'Connected';
      case 'streaming':
        return 'Live';
      case 'offline':
        return 'Offline';
      case 'error':
        return 'Connection error';
      default:
        return 'Connecting...';
    }
  };

  // ============ MAIN RENDER ============
  return (
    <View style={styles.container}>
      {/* Connection Status */}
      {!socket || !isConnected ? (
        <View style={styles.connectionWarning}>
          <ActivityIndicator size="small" color="#fff" style={styles.connectionLoader} />
          <Text style={styles.connectionWarningText}>Connecting to server...</Text>
        </View>
      ) : null}
      
      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {/* Stream List */}
      {!currentStreamId && (
        <View style={styles.streamListContainer}>
          <View style={styles.headerRow}>
            <Text style={styles.header}>Live Streams</Text>
            <TouchableOpacity 
              onPress={fetchActiveStreams} 
              disabled={loadingStreams}
              style={styles.refreshButton}
            >
              <Text style={styles.refreshText}>
                {loadingStreams ? 'Loading...' : 'Refresh'}
              </Text>
            </TouchableOpacity>
          </View>

          {loadingStreams ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#ed167e" />
              <Text style={styles.loadingText}>Loading streams...</Text>
            </View>
          ) : activeStreams.length === 0 ? (
            <View style={styles.noStreamsContainer}>
              <Text style={styles.noStreamsText}>No live streams available</Text>
              <TouchableOpacity onPress={fetchActiveStreams} style={styles.retryButton}>
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={activeStreams}
              renderItem={renderStreamItem}
              keyExtractor={(item) => item.streamId}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>
      )}

      {/* Stream Viewer */}
      {currentStreamId && (
        <View style={styles.viewerContainer}>
          {/* Stream Header */}
          <View style={styles.streamHeader}>
            <TouchableOpacity onPress={leaveStream} style={styles.leaveButton}>
              <Text style={styles.leaveButtonText}>✕</Text>
            </TouchableOpacity>
            
            <View style={styles.streamInfoHeader}>
              <Text style={styles.streamTitleHeader} numberOfLines={1}>
                {streamTitle || 'Live Stream'}
              </Text>
              <Text style={styles.streamerNameHeader}>{streamerName || 'Streamer'}</Text>
            </View>
            
            <View style={styles.streamStatsContainer}>
              <View style={styles.viewerCountContainer}>
                <Text style={styles.viewerCountText}>{currentViewerCount}</Text>
                <Text style={styles.viewerLabel}>viewers</Text>
              </View>
              <View style={styles.audioControls}>
                {/* <TouchableOpacity 
                  onPress={toggleAudio} 
                  style={[
                    styles.audioButton,
                    { backgroundColor: audioEnabled ? '#4CAF50' : '#666' }
                  ]}
                >
                  <Text style={styles.audioButtonText}>
                    {audioEnabled ? '🔊' : '🔇'}
                  </Text>
                </TouchableOpacity> */}
                <TouchableOpacity 
                  onPress={toggleSpeaker} 
                  style={[
                    styles.audioButton,
                    { backgroundColor: speakerEnabled ? '#2196F3' : '#666' }
                  ]}
                >
                  <Text style={styles.audioButtonText}>
                    {speakerEnabled ? '📢' : '📞'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Video Stream Container */}
          <View style={styles.videoContainer}>
            {isConnecting && !remoteStream && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#ed167e" />
                <Text style={styles.loadingText}>Connecting to stream...</Text>
                <Text style={styles.loadingSubText}>🔊 Loudspeaker enabled</Text>
              </View>
            )}

            {remoteStream && remoteStream.active ? (
              <View style={styles.videoWrapper}>
                <RTCView
                  streamURL={remoteStream.toURL()}
                  style={styles.rtcView}
                  objectFit="cover"
                />
                <View style={styles.videoOverlay}>
                  <View style={styles.liveIndicator}>
                    <Text style={styles.liveText}>● LIVE</Text>
                  </View>
                  {connectionQuality !== 'unknown' && (
                    <View style={styles.qualityIndicator}>
                      <Text style={styles.qualityText}>{connectionQuality.toUpperCase()}</Text>
                    </View>
                  )}
                  {speakerEnabled && (
                    <View style={styles.speakerIndicator}>
                      <Text style={styles.speakerText}>📢 Speaker</Text>
                    </View>
                  )}
                </View>
              </View>
            ) : currentStreamId && !isConnecting ? (
              <View style={styles.videoPlaceholder}>
                <Text style={styles.videoPlaceholderText}>
                  {broadcasterStatus === 'no_video' ?
                    '📹 Camera is off' :
                    '📡 Connecting...'}
                </Text>
                <Text style={styles.videoSubText}>
                  {getBroadcasterStatusMessage()}
                </Text>
                {connectionAttempts > 0 && connectionAttempts < 3 && (
                  <TouchableOpacity
                    style={styles.retryVideoButton}
                    onPress={() => {
                      setConnectionAttempts(prev => prev + 1);
                      startOfferTimeout();
                    }}
                  >
                    <Text style={styles.retryVideoText}>Retry</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : null}
          </View>

          {/* Reactions */}
          {currentStreamId && renderReactionButtons()}

          {/* Chat Section */}
          <View style={styles.chatContainer}>
            <View style={styles.chatHeader}>
              <Text style={styles.chatHeaderText}>Live Chat</Text>
              <Text style={styles.chatStatus}>
                {getBroadcasterStatusMessage()}
              </Text>
            </View>
            
            <FlatList
              ref={flatListRef}
              data={chatMessages}
              keyExtractor={(item) => item.id?.toString()}
              renderItem={({ item }) => (
                <View style={styles.messageContainer}>
                  <Text style={styles.messageUser}>
                    {item.user?.fullName || item.user?.username || 'User'}
                  </Text>
                  <Text style={styles.messageText}>{item.message}</Text>
                </View>
              )}
              contentContainerStyle={styles.chatList}
              showsVerticalScrollIndicator={false}
            />
            
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.chatInput}
                value={newMessage}
                onChangeText={setNewMessage}
                placeholder="Type a message..."
                placeholderTextColor="#999"
                editable={!!currentStreamId}
                onSubmitEditing={sendChatMessage}
                multiline={false}
              />
              <TouchableOpacity
                style={[
                  styles.sendButton,
                  (!newMessage.trim() || !currentStreamId) && styles.sendButtonDisabled
                ]}
                onPress={sendChatMessage}
                disabled={!newMessage.trim() || !currentStreamId}
              >
                <Text style={styles.sendButtonText}>Send</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  connectionWarning: {
    backgroundColor: '#ff9500',
    padding: moderateScale(12),
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  connectionLoader: {
    marginRight: moderateScale(8),
  },
  connectionWarningText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: moderateScale(14),
  },
  errorContainer: {
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.3)',
    margin: moderateScale(10),
    borderRadius: moderateScale(8),
  },
  errorText: {
    color: '#ff6b6b',
    padding: moderateScale(12),
    textAlign: 'center',
    fontSize: moderateScale(14),
  },
  streamListContainer: {
    flex: 1,
    padding: moderateScale(16),
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: moderateScale(20),
  },
  header: {
    fontSize: moderateScale(28),
    fontWeight: 'bold',
    color: '#fff',
  },
  refreshButton: {
    paddingHorizontal: moderateScale(12),
    paddingVertical: moderateScale(6),
    borderRadius: moderateScale(6),
    backgroundColor: 'rgba(237, 22, 126, 0.1)',
    borderWidth: 1,
    borderColor: '#ed167e',
  },
  refreshText: {
    color: '#ed167e',
    fontSize: moderateScale(14),
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    marginTop: moderateScale(12),
    fontSize: moderateScale(16),
    fontWeight: '500',
  },
  loadingSubText: {
    color: '#4CAF50',
    marginTop: moderateScale(8),
    fontSize: moderateScale(14),
    fontWeight: '500',
  },
  noStreamsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: moderateScale(20),
  },
  noStreamsText: {
    color: '#666',
    fontSize: moderateScale(18),
    textAlign: 'center',
    marginBottom: moderateScale(24),
    fontWeight: '500',
  },
  retryButton: {
    backgroundColor: '#ed167e',
    paddingHorizontal: moderateScale(24),
    paddingVertical: moderateScale(12),
    borderRadius: moderateScale(8),
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: moderateScale(16),
  },
  listContent: {
    paddingBottom: moderateScale(20),
  },
  streamItem: {
    backgroundColor: '#1a1a1a',
    marginBottom: moderateScale(16),
    borderRadius: moderateScale(12),
    borderWidth: 1,
    borderColor: '#333',
    overflow: 'hidden',
  },
  streamItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: moderateScale(12),
    paddingBottom: moderateScale(8),
  },
  liveTag: {
    backgroundColor: '#ff4757',
    paddingHorizontal: moderateScale(8),
    paddingVertical: moderateScale(4),
    borderRadius: moderateScale(4),
  },
  liveTagText: {
    color: '#fff',
    fontSize: moderateScale(10),
    fontWeight: 'bold',
  },
  viewerCountBadge: {
    color: '#999',
    fontSize: moderateScale(12),
    fontWeight: '500',
  },
  streamTitle: {
    fontSize: moderateScale(18),
    fontWeight: 'bold',
    color: '#fff',
    paddingHorizontal: moderateScale(12),
    marginBottom: moderateScale(8),
  },
  streamerInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: moderateScale(12),
    marginBottom: moderateScale(12),
  },
  streamerName: {
    fontSize: moderateScale(14),
    color: '#ed167e',
    fontWeight: '600',
  },
  streamCategory: {
    fontSize: moderateScale(12),
    color: '#999',
  },
  joinButtonContainer: {
    padding: moderateScale(12),
    paddingTop: 0,
  },
  joinButton: {
    padding: moderateScale(14),
    backgroundColor: '#ed167e',
    borderRadius: moderateScale(8),
    alignItems: 'center',
  },
  joiningButton: {
    backgroundColor: '#666',
  },
  disabledButton: {
    backgroundColor: '#444',
  },
  joinButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: moderateScale(16),
  },
  viewerContainer: {
    flex: 1,
  },
  streamHeader: {
    flexDirection: 'row',
    padding: moderateScale(16),
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  leaveButton: {
    width: moderateScale(36),
    height: moderateScale(36),
    backgroundColor: '#ff4757',
    borderRadius: moderateScale(18),
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: moderateScale(12),
  },
  leaveButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: moderateScale(18),
  },
  streamInfoHeader: {
    flex: 1,
  },
  streamTitleHeader: {
    fontSize: moderateScale(18),
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: moderateScale(2),
  },
  streamerNameHeader: {
    fontSize: moderateScale(14),
    color: '#ed167e',
    fontWeight: '600',
  },
  streamStatsContainer: {
    alignItems: 'center',
  },
  viewerCountContainer: {
    alignItems: 'center',
    marginBottom: moderateScale(8),
  },
  viewerCountText: {
    fontSize: moderateScale(16),
    fontWeight: 'bold',
    color: '#fff',
  },
  viewerLabel: {
    fontSize: moderateScale(11),
    color: '#999',
  },
  audioControls: {
    flexDirection: 'row',
    gap: moderateScale(8),
  },
  audioButton: {
    width: moderateScale(32),
    height: moderateScale(32),
    borderRadius: moderateScale(16),
    justifyContent: 'center',
    alignItems: 'center',
  },
  audioButtonText: {
    fontSize: moderateScale(16),
  },
  videoContainer: {
    flex: 2,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoWrapper: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  rtcView: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
  },
  videoOverlay: {
    position: 'absolute',
    top: moderateScale(12),
    left: moderateScale(12),
    right: moderateScale(12),
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  liveIndicator: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: moderateScale(6),
    paddingHorizontal: moderateScale(8),
    paddingVertical: moderateScale(4),
  },
  liveText: {
    color: '#ff4757',
    fontSize: moderateScale(12),
    fontWeight: 'bold',
  },
  qualityIndicator: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: moderateScale(6),
    paddingHorizontal: moderateScale(8),
    paddingVertical: moderateScale(4),
  },
  qualityText: {
    color: '#4CAF50',
    fontSize: moderateScale(10),
    fontWeight: 'bold',
  },
  speakerIndicator: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: moderateScale(6),
    paddingHorizontal: moderateScale(8),
    paddingVertical: moderateScale(4),
    position: 'absolute',
    right: 0,
    top: moderateScale(30),
  },
  speakerText: {
    color: '#2196F3',
    fontSize: moderateScale(10),
    fontWeight: 'bold',
  },
  videoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: moderateScale(20),
    width: '100%',
  },
  videoPlaceholderText: {
    color: '#fff',
    fontSize: moderateScale(18),
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: moderateScale(8),
  },
  videoSubText: {
    color: '#999',
    fontSize: moderateScale(14),
    textAlign: 'center',
    marginBottom: moderateScale(12),
  },
  retryVideoButton: {
    backgroundColor: '#ed167e',
    paddingHorizontal: moderateScale(20),
    paddingVertical: moderateScale(10),
    borderRadius: moderateScale(8),
  },
  retryVideoText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: moderateScale(14),
  },
  reactionContainer: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    padding: moderateScale(12),
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  reactionButton: {
    width: moderateScale(44),
    height: moderateScale(44),
    backgroundColor: '#333',
    borderRadius: moderateScale(22),
    justifyContent: 'center',
    alignItems: 'center',
  },
  reactionText: {
    fontSize: moderateScale(20),
  },
  chatContainer: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: moderateScale(12),
    backgroundColor: '#2a2a2a',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  chatHeaderText: {
    fontWeight: 'bold',
    color: '#fff',
    fontSize: moderateScale(16),
  },
  chatStatus: {
    fontSize: moderateScale(12),
    color: '#4CAF50',
    fontWeight: '500',
  },
  chatList: {
    padding: moderateScale(12),
    flexGrow: 1,
  },
  messageContainer: {
    marginBottom: moderateScale(10),
  },
  messageUser: {
    fontWeight: 'bold',
    color: '#ed167e',
    fontSize: moderateScale(14),
    marginBottom: moderateScale(2),
  },
  messageText: {
    color: '#fff',
    fontSize: moderateScale(14),
    lineHeight: moderateScale(20),
  },
  inputContainer: {
    flexDirection: 'row',
    padding: moderateScale(12),
    borderTopWidth: 1,
    borderTopColor: '#333',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
  },
  chatInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#555',
    borderRadius: moderateScale(20),
    paddingHorizontal: moderateScale(16),
    paddingVertical: moderateScale(10),
    marginRight: moderateScale(12),
    color: '#fff',
    backgroundColor: '#333',
    fontSize: moderateScale(14),
  },
  sendButton: {
    paddingHorizontal: moderateScale(20),
    paddingVertical: moderateScale(10),
    backgroundColor: '#ed167e',
    borderRadius: moderateScale(20),
  },
  sendButtonDisabled: {
    backgroundColor: '#666',
  },
  sendButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: moderateScale(14),
  },
});

export default LiveStreamViewer;