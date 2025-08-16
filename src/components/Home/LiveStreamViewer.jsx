// src/screens/LiveStreamViewer.js - FIXED & RESPONSIVE VERSION WITH SHARED SOCKET
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
  ScrollView,
  Dimensions, // Import Dimensions
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import enhancedGlobalWebRTCService from '../../services/EnhancedGlobalWebRTCService';
import BASE_URL from '../../config/config';
import { RTCView } from 'react-native-webrtc';

// Responsive utilities
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const scale = (size) => (SCREEN_WIDTH / 375) * size; // Base iPhone X width
const verticalScale = (size) => (SCREEN_HEIGHT / 812) * size; // Base iPhone X height
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
  const [socketDebugInfo, setSocketDebugInfo] = useState('');
  
  const flatListRef = useRef();

  // ============ SERVICE INITIALIZATION ============
  useEffect(() => {
    const initializeService = async () => {
      try {
        console.log('🚀 Initializing Enhanced WebRTC Service for Live Streaming');
        console.log('🔌 Socket status:', { 
          socketExists: !!socket, 
          isConnected: isConnected,
          socketId: socket?.id 
        });
        
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
      if (offerTimeout) {
        clearTimeout(offerTimeout);
      }
      if (currentStreamId) {
        console.log('🧹 Cleaning up stream:', currentStreamId);
        enhancedGlobalWebRTCService.leaveStream();
      }
    };
  }, [token, user, socket, isConnected, initialStreamId]);

  // ============ SOCKET STATUS MONITORING ============
  useEffect(() => {
    const updateSocketDebugInfo = () => {
      const debugInfo = {
        socketExists: !!socket,
        socketConnected: isConnected,
        socketId: socket?.id || 'none',
        serviceReady: enhancedGlobalWebRTCService.isReady(),
        serviceSocketStatus: enhancedGlobalWebRTCService.getSocketStatus(),
      };
      setSocketDebugInfo(JSON.stringify(debugInfo, null, 2));
    };

    updateSocketDebugInfo();
    const interval = setInterval(updateSocketDebugInfo, 2000);
    return () => clearInterval(interval);
  }, [socket, isConnected]);

  // ============ SERVICE CALLBACKS ============
  const handleLocalStream = (stream) => {
    console.log('📹 Local stream received:', stream?.id);
    setLocalStream(stream);
  };

  // In LiveStreamViewer.js - Enhanced remote stream handling
const handleRemoteStream = (stream) => {
  console.log('📺 Processing remote stream:', stream?.id);
  console.log('📺 Stream active:', stream?.active);
  console.log('📺 Stream tracks:', stream?.getTracks().length);
  
  // ✅ CHECK AUDIO TRACKS IN REMOTE STREAM
  if (stream) {
    const audioTracks = stream.getAudioTracks();
    const videoTracks = stream.getVideoTracks();
    
    console.log('📺 Remote audio tracks:', audioTracks.length);
    console.log('📺 Remote video tracks:', videoTracks.length);
    
    audioTracks.forEach((track, index) => {
      console.log(`🎵 Remote audio track ${index}:`, {
        id: track.id,
        enabled: track.enabled,
        muted: track.muted,
        readyState: track.readyState
      });
    });
    
    if (audioTracks.length === 0) {
      console.warn('⚠️ No audio tracks in remote stream!');
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
        break;
        
      case 'video_connected':
        setIsConnecting(false);
        setIsWebRTCConnected(true);
        setBroadcasterStatus('streaming');
        console.log('✅ Video connection established!');
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

      console.log('✅ Service join initiated successfully');
    } catch (error) {
      console.error('❌ Error joining stream:', error);
      setError(error.message || 'Failed to join stream');
      setIsConnecting(false);
      setCurrentStreamId(null);
      setStreamState('idle');
      setBroadcasterStatus('error');
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

  // ============ DEBUG INFO ============
  const getDebugInfo = () => {
    const debugInfo = enhancedGlobalWebRTCService.getStreamingDebugInfo();
    return `
🔍 ENHANCED LIVE STREAM DEBUG:
- Stream State: ${streamState}
- Broadcaster Status: ${broadcasterStatus}
- Connection Attempts: ${connectionAttempts}/3
- WebRTC Connected: ${isWebRTCConnected}
- Has Remote Stream: ${!!remoteStream}
- Remote Stream Active: ${remoteStream?.active || false}
- Current Viewers: ${currentViewerCount}
- Connection Quality: ${connectionQuality}

🔌 SOCKET DEBUG:
${socketDebugInfo}

🎥 SERVICE DEBUG:
- Service Ready: ${enhancedGlobalWebRTCService.isReady()}
- Stream ID: ${debugInfo.streamId || 'none'}
- Stream Role: ${debugInfo.streamRole || 'none'}
- Has Broadcaster Connection: ${debugInfo.hasBroadcasterConnection}
- Broadcaster Connection State: ${debugInfo.broadcasterConnectionState}
    `.trim();
  };

  // ============ MANUAL DEBUGGING ============
  const testSocketConnection = () => {
    console.log('🧪 Testing socket connection manually...');
    const socketOk = enhancedGlobalWebRTCService.testSocketConnection();
    Alert.alert('Socket Test', socketOk ? 'Socket OK' : 'Socket Failed');
  };

  // ============ RENDER FUNCTIONS ============
  const renderStreamItem = ({ item }) => (
    <View style={styles.streamItem}>
      <Text style={styles.streamTitle}>{item.title}</Text>
      <Text style={styles.streamInfo}>
        Streamer: {item.streamer?.fullName || item.streamer?.username || 'Unknown'}
      </Text>
      <Text style={styles.streamInfo}>Category: {item.category || 'General'}</Text>
      <Text style={styles.streamInfo}>Viewers: {item.currentViewerCount || 0}</Text>
      <Text style={styles.streamInfo}>Status: {item.status || 'LIVE'}</Text>
      <TouchableOpacity
        style={[
          styles.joinButton,
          (isConnecting && currentStreamId === item.streamId) && styles.joiningButton
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
  );

  const renderReactionButtons = () => (
    <View style={styles.reactionContainer}>
      {['❤', '👍', '😍', '🔥', '👏'].map((reaction) => (
        <TouchableOpacity
          key={reaction}
          style={styles.reactionButton}
          onPress={() => sendReaction(reaction)}
        >
          <Text style={styles.reactionText}>{reaction}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const getBroadcasterStatusMessage = () => {
    switch (broadcasterStatus) {
      case 'checking':
        return 'Checking broadcaster status...';
      case 'not_ready':
        return 'Waiting for broadcaster to start video...';
      case 'no_video':
        return 'Broadcaster camera is not active. Please wait...';
      case 'connected':
        return 'Connected, waiting for video...';
      case 'streaming':
        return 'Streaming';
      case 'offline':
        return 'Broadcaster is offline';
      case 'error':
        return 'Connection error';
      default:
        return 'Establishing connection...';
    }
  };

  // ============ MAIN RENDER ============
  return (
    <View style={styles.container}>
      {/* Connection Status */}
      {!socket || !isConnected ? (
        <View style={styles.connectionWarning}>
          <Text style={styles.connectionWarningText}>
            🔌 Connecting to server...
          </Text>
        </View>
      ) : null}
      
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {/* DEBUG INFO */}
      {__DEV__ && (
        <ScrollView style={styles.debugContainer}>
          <Text style={styles.debugText}>{getDebugInfo()}</Text>
          <TouchableOpacity style={styles.debugButton} onPress={testSocketConnection}>
            <Text style={styles.debugButtonText}>Test Socket</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* Stream List */}
      {!currentStreamId && (
        <View style={styles.streamListContainer}>
          <View style={styles.headerRow}>
            <Text style={styles.header}>Active Live Streams</Text>
            <TouchableOpacity onPress={fetchActiveStreams} disabled={loadingStreams}>
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
              <Text style={styles.leaveButtonText}>Leave</Text>
            </TouchableOpacity>
            <View style={styles.streamInfoHeader}>
              <Text style={styles.streamTitleHeader}>{streamTitle || 'Live Stream'}</Text>
              <Text style={styles.streamerName}>{streamerName || 'Streamer'}</Text>
              <Text style={styles.viewerCount}>👁 {currentViewerCount} • {streamStatus}</Text>
              <Text style={styles.connectionStatus}>
                Status: {getBroadcasterStatusMessage()}
              </Text>
              {connectionAttempts > 0 && (
                <Text style={styles.connectionAttempts}>
                  Connection attempt: {connectionAttempts}/3
                </Text>
              )}
            </View>
          </View>

          {/* Video Stream Container */}
          <View style={styles.videoContainer}>
            {isConnecting && !remoteStream && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#ed167e" />
                <Text style={styles.loadingText}>Connecting to stream...</Text>
                <Text style={styles.loadingSubText}>Please wait...</Text>
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
                  <Text style={styles.liveIndicator}>🔴 LIVE</Text>
                  {connectionQuality !== 'unknown' && (
                    <Text style={styles.qualityIndicator}>{connectionQuality.toUpperCase()}</Text>
                  )}
                </View>
              </View>
            ) : currentStreamId && !isConnecting ? (
              <View style={styles.videoPlaceholder}>
                <Text style={styles.videoPlaceholderText}>
                  {broadcasterStatus === 'no_video' ?
                    '📹 Broadcaster camera is off' :
                    '📡 Waiting for video stream...'}
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
                    <Text style={styles.retryVideoText}>Retry Connection</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : null}
          </View>

          {/* Reactions */}
          {currentStreamId && renderReactionButtons()}

          {/* Chat Section */}
          <View style={styles.chatContainer}>
            <Text style={styles.chatHeader}>Live Chat</Text>
            <FlatList
              ref={flatListRef}
              data={chatMessages}
              keyExtractor={(item) => item.id?.toString()}
              renderItem={({ item }) => (
                <View style={styles.messageContainer}>
                  <Text style={styles.messageUser}>
                    {item.user?.fullName || item.user?.username || 'User'}:{' '}
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
    padding: moderateScale(8),
    alignItems: 'center',
  },
  connectionWarningText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: moderateScale(12),
  },
  errorText: {
    color: '#ff6b6b',
    padding: moderateScale(10),
    textAlign: 'center',
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    fontSize: moderateScale(14),
  },
  debugContainer: {
    backgroundColor: '#111',
    padding: moderateScale(10),
    marginBottom: moderateScale(10),
    maxHeight: verticalScale(200),
  },
  debugText: {
    color: '#00ff00',
    fontSize: moderateScale(10),
    fontFamily: 'monospace',
  },
  debugButton: {
    backgroundColor: '#333',
    padding: moderateScale(8),
    marginTop: moderateScale(5),
    borderRadius: moderateScale(4),
    alignItems: 'center',
  },
  debugButtonText: {
    color: '#fff',
    fontSize: moderateScale(10),
    fontWeight: 'bold',
  },
  streamListContainer: {
    flex: 1,
    padding: moderateScale(15),
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: moderateScale(15),
  },
  header: {
    fontSize: moderateScale(22),
    fontWeight: 'bold',
    color: '#fff',
  },
  refreshText: {
    color: '#ed167e',
    fontSize: moderateScale(16),
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    marginTop: moderateScale(10),
    fontSize: moderateScale(16),
  },
  loadingSubText: {
    color: '#666',
    marginTop: moderateScale(5),
    fontSize: moderateScale(12),
  },
  noStreamsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: moderateScale(20),
  },
  noStreamsText: {
    color: '#666',
    fontSize: moderateScale(16),
    textAlign: 'center',
    marginBottom: moderateScale(20),
  },
  retryButton: {
    backgroundColor: '#ed167e',
    paddingHorizontal: moderateScale(20),
    paddingVertical: moderateScale(10),
    borderRadius: moderateScale(8),
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: moderateScale(14),
  },
  listContent: {
    paddingBottom: moderateScale(20),
  },
  streamItem: {
    backgroundColor: '#1a1a1a',
    padding: moderateScale(15),
    marginBottom: moderateScale(12),
    borderRadius: moderateScale(12),
    borderWidth: 1,
    borderColor: '#333',
  },
  streamTitle: {
    fontSize: moderateScale(18),
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: moderateScale(8),
  },
  streamInfo: {
    fontSize: moderateScale(14),
    color: '#ccc',
    marginBottom: moderateScale(4),
  },
  joinButton: {
    marginTop: moderateScale(12),
    padding: moderateScale(12),
    backgroundColor: '#ed167e',
    borderRadius: moderateScale(8),
    alignItems: 'center',
  },
  joiningButton: {
    backgroundColor: '#666',
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
    padding: moderateScale(15),
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  leaveButton: {
    padding: moderateScale(10),
    backgroundColor: '#ff4757',
    borderRadius: moderateScale(8),
    marginRight: moderateScale(15),
  },
  leaveButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: moderateScale(14),
  },
  streamInfoHeader: {
    flex: 1,
  },
  streamTitleHeader: {
    fontSize: moderateScale(18),
    fontWeight: 'bold',
    color: '#fff',
  },
  streamerName: {
    fontSize: moderateScale(14),
    color: '#ed167e',
    fontWeight: '600',
  },
  viewerCount: {
    fontSize: moderateScale(12),
    color: '#999',
  },
  connectionStatus: {
    fontSize: moderateScale(11),
    color: '#00ff00',
    marginTop: moderateScale(2),
  },
  connectionAttempts: {
    fontSize: moderateScale(10),
    color: '#ff9900',
    marginTop: moderateScale(2),
  },
  videoContainer: {
    flex: 2,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
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
    top: moderateScale(10),
    left: moderateScale(10),
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: moderateScale(5),
    paddingHorizontal: moderateScale(8),
    paddingVertical: moderateScale(4),
  },
  liveIndicator: {
    color: '#fff',
    fontSize: moderateScale(12),
    fontWeight: 'bold',
  },
  qualityIndicator: {
    color: '#00ff00',
    fontSize: moderateScale(10),
    marginTop: moderateScale(2),
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
  },
  videoSubText: {
    color: '#666',
    fontSize: moderateScale(12),
    marginTop: moderateScale(5),
    textAlign: 'center',
  },
  retryVideoButton: {
    marginTop: moderateScale(15),
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
    justifyContent: 'space-around',
    padding: moderateScale(10),
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  reactionButton: {
    padding: moderateScale(8),
    backgroundColor: '#333',
    borderRadius: moderateScale(20),
    minWidth: moderateScale(40),
    alignItems: 'center',
  },
  reactionText: {
    fontSize: moderateScale(18),
  },
  chatContainer: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  chatHeader: {
    padding: moderateScale(12),
    fontWeight: 'bold',
    backgroundColor: '#2a2a2a',
    color: '#fff',
    fontSize: moderateScale(16),
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  chatList: {
    padding: moderateScale(10),
    flexGrow: 1,
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: moderateScale(8),
    flexWrap: 'wrap',
  },
  messageUser: {
    fontWeight: 'bold',
    color: '#ed167e',
    marginRight: moderateScale(5),
    fontSize: moderateScale(14),
  },
  messageText: {
    flex: 1,
    color: '#fff',
    fontSize: moderateScale(14),
  },
  inputContainer: {
    flexDirection: 'row',
    padding: moderateScale(10),
    borderTopWidth: 1,
    borderTopColor: '#333',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
  },
  chatInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#555',
    borderRadius: moderateScale(8),
    padding: moderateScale(10),
    marginRight: moderateScale(10),
    color: '#fff',
    backgroundColor: '#333',
    fontSize: moderateScale(14),
  },
  sendButton: {
    padding: moderateScale(10),
    backgroundColor: '#ed167e',
    borderRadius: moderateScale(8),
    minWidth: moderateScale(60),
    alignItems: 'center',
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