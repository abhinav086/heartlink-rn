// src/components/LiveStreamViewer.jsx - FIXED TO MATCH BACKEND
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
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import BASE_URL from '../../config/config';

const LiveStreamViewer = ({ navigation, route }) => {
  const { user, token } = useAuth();
  const { 
    socket, 
    isConnected, 
    registerStreamHandlers,
    emitJoinLiveStream,
    emitLeaveLiveStream,
    emitLiveStreamChat,
    emitLiveStreamReaction
  } = useSocket();

  // Get streamId from navigation params if provided
  const initialStreamId = route?.params?.streamId;

  const [activeStreams, setActiveStreams] = useState([]);
  const [loadingStreams, setLoadingStreams] = useState(false);
  const [joiningStreamId, setJoiningStreamId] = useState(null);
  const [currentStreamId, setCurrentStreamId] = useState(initialStreamId || null);
  const [error, setError] = useState('');
  const [remoteStream, setRemoteStream] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [currentViewerCount, setCurrentViewerCount] = useState(0);
  const [streamTitle, setStreamTitle] = useState('');
  const [streamerName, setStreamerName] = useState('');
  const [streamStatus, setStreamStatus] = useState('');
  const [streamSettings, setStreamSettings] = useState({});

  const peerConnectionRef = useRef(null);
  const flatListRef = useRef();

  // ============ SOCKET EVENT HANDLERS ============
  
  useEffect(() => {
    if (!socket || !isConnected) return;

    console.log('🎥 Registering stream event handlers');

    // Register stream handlers with the socket context
    registerStreamHandlers({
      onJoinedLiveStream: handleJoinedLiveStream,
      onLeftLiveStream: handleLeftLiveStream,
      onViewerJoinedStream: handleViewerJoinedStream,
      onViewerLeftStream: handleViewerLeftStream,
      onStreamStatusUpdated: handleStreamStatusUpdated,
      onStreamEnded: handleStreamEnded,
      onLiveStreamChat: handleLiveStreamChat,
      onLiveStreamReaction: handleLiveStreamReaction,
      onStreamWebRTCSignal: handleStreamWebRTCSignal,
      onUserWentLive: handleUserWentLive,
    });

    return () => {
      console.log('🧹 Cleaning up stream handlers');
    };
  }, [socket, isConnected]);

  // ============ SOCKET EVENT HANDLER FUNCTIONS ============
  
  const handleJoinedLiveStream = (data) => {
    console.log('🎥 Successfully joined stream:', data);
    
    if (data.streamId === joiningStreamId) {
      setJoiningStreamId(null);
      setCurrentStreamId(data.streamId);
      setCurrentViewerCount(data.viewersCount || 0);
      setStreamTitle(data.streamTitle || 'Live Stream');
      setStreamerName(data.streamer?.fullName || data.streamer?.username || 'Streamer');
      setStreamStatus(data.status || 'LIVE');
      setStreamSettings(data.settings || {});
      
      // Handle WebRTC configuration if provided
      if (data.rtcConfig) {
        console.log('📡 WebRTC config received:', data.rtcConfig);
        // TODO: Set up WebRTC peer connection here
        setupWebRTCConnection(data.rtcConfig);
      }
      
      Alert.alert('Joined Stream', `You are now watching ${data.streamTitle}`);
    }
  };

  const handleLeftLiveStream = (data) => {
    console.log('🎥 Left stream:', data);
    cleanupStream();
  };

  const handleViewerJoinedStream = (data) => {
    console.log('👁️ Viewer joined:', data);
    setCurrentViewerCount(data.viewersCount || 0);
  };

  const handleViewerLeftStream = (data) => {
    console.log('👁️ Viewer left:', data);
    setCurrentViewerCount(data.viewersCount || 0);
  };

  const handleStreamStatusUpdated = (data) => {
    console.log('📊 Stream status updated:', data);
    setStreamStatus(data.status);
    
    if (data.status === 'ENDED' && currentStreamId === data.streamId) {
      Alert.alert('Stream Ended', 'The stream has ended.');
      cleanupStream();
    }
  };

  const handleStreamEnded = (data) => {
    console.log('🔚 Stream ended:', data);
    
    if (currentStreamId === data.streamId) {
      Alert.alert('Stream Ended', data.reason || 'The stream has ended.');
      cleanupStream();
    }
    
    // Remove from active streams list
    setActiveStreams(prev => prev.filter(s => s.streamId !== data.streamId));
  };

  const handleLiveStreamChat = (data) => {
    console.log('💬 Chat message received:', data);
    setChatMessages(prev => [...prev, data]);
    
    // Scroll to bottom
    setTimeout(() => {
      if (flatListRef.current) {
        flatListRef.current.scrollToEnd({ animated: true });
      }
    }, 100);
  };

  const handleLiveStreamReaction = (data) => {
    console.log('❤️ Reaction received:', data);
    // Handle reactions - you can show floating reactions here
  };

  const handleStreamWebRTCSignal = (data) => {
    console.log('📡 WebRTC signal received:', data.type);
    // Handle WebRTC signaling for stream
    handleWebRTCSignalingMessage(data);
  };

  const handleUserWentLive = (data) => {
    console.log('📢 User went live:', data);
    // Refresh streams list to show new live stream
    fetchActiveStreams();
  };

  // ============ API FUNCTIONS ============
  
  const fetchActiveStreams = async (page = 1, limit = 20, category = '', search = '') => {
    if (!token) return;
    
    setLoadingStreams(true);
    setError('');

    try {
      // Construct query string - FIXED: Using correct backend endpoint
      const queryParams = new URLSearchParams({ 
        page: page.toString(), 
        limit: limit.toString() 
      });
      
      if (category) queryParams.append('category', category);
      if (search) queryParams.append('search', search);
      
      const url = `${BASE_URL}/api/v1/live/active?${queryParams.toString()}`;
      console.log('🌐 Fetching active streams from:', url);

      const response = await fetch(url, {
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

      if (data.success) {
        const streams = data.data?.streams || [];
        setActiveStreams(streams);
        console.log(`✅ Fetched ${streams.length} active streams`);
      } else {
        throw new Error(data.message || 'Failed to fetch streams');
      }
    } catch (err) {
      console.error('❌ Error fetching streams:', err);
      setError(err.message || 'Could not load streams.');
      
      // Show user-friendly error
      if (err.message.includes('Failed to fetch') || err.message.includes('Network')) {
        Alert.alert('Network Error', 'Please check your internet connection and try again.');
      } else {
        Alert.alert('Error', err.message || 'Failed to load live streams.');
      }
    } finally {
      setLoadingStreams(false);
    }
  };

  // ============ STREAM ACTIONS ============
  
  const joinStream = async (streamId) => {
    if (!socket || !isConnected) {
      Alert.alert('Connection Error', 'Please check your internet connection.');
      return;
    }
    
    if (joiningStreamId) {
      Alert.alert('Busy', 'Already trying to join a stream.');
      return;
    }

    console.log(`🎥 Joining stream: ${streamId}`);
    setJoiningStreamId(streamId);
    setError('');
    setChatMessages([]);
    setCurrentViewerCount(0);
    setRemoteStream(null);

    try {
      // FIXED: Using correct socket event that matches backend
      const success = emitJoinLiveStream({
        streamId: streamId,
        role: 'viewer'
      });

      if (!success) {
        throw new Error('Failed to emit join stream event');
      }

      console.log(`📡 Emitted join_live_stream for: ${streamId}`);

      // Find stream details for UI
      const stream = activeStreams.find(s => s.streamId === streamId);
      if (stream) {
        setStreamTitle(stream.title || 'Live Stream');
        setStreamerName(stream.streamer?.fullName || stream.streamer?.username || 'Streamer');
      }

    } catch (err) {
      console.error('❌ Error joining stream:', err);
      setJoiningStreamId(null);
      setError(err.message || 'Could not join the stream.');
      Alert.alert('Error', err.message || 'Failed to join the stream.');
    }
  };

  const leaveStream = () => {
    console.log(`🎥 Leaving stream: ${currentStreamId}`);
    
    if (currentStreamId && socket && isConnected) {
      // FIXED: Using correct socket event that matches backend
      emitLeaveLiveStream({
        streamId: currentStreamId
      });
    }
    
    cleanupStream();
  };

  const cleanupStream = () => {
    // Stop remote stream tracks
    if (remoteStream) {
      try {
        remoteStream.getTracks().forEach(track => track.stop());
      } catch (error) {
        console.warn('Error stopping remote stream tracks:', error);
      }
      setRemoteStream(null);
    }
    
    // Close peer connection
    if (peerConnectionRef.current) {
      try {
        peerConnectionRef.current.close();
      } catch (error) {
        console.warn('Error closing peer connection:', error);
      }
      peerConnectionRef.current = null;
    }

    // Reset state
    setJoiningStreamId(null);
    setCurrentStreamId(null);
    setChatMessages([]);
    setCurrentViewerCount(0);
    setStreamTitle('');
    setStreamerName('');
    setStreamStatus('');
    setStreamSettings({});
    setNewMessage('');
  };

  // ============ CHAT FUNCTIONS ============
  
  const sendChatMessage = () => {
    const messageToSend = newMessage.trim();
    if (!messageToSend || !socket || !isConnected || !currentStreamId) return;

    try {
      // FIXED: Using correct socket event that matches backend
      const success = emitLiveStreamChat({
        streamId: currentStreamId,
        message: messageToSend,
        messageType: 'text'
      });

      if (success) {
        console.log(`💬 Sent chat message: ${messageToSend}`);
        setNewMessage('');
      } else {
        throw new Error('Failed to send message');
      }
    } catch (err) {
      console.error('❌ Error sending chat message:', err);
      Alert.alert('Error', 'Could not send message.');
    }
  };

  const sendReaction = (reaction) => {
    if (!socket || !isConnected || !currentStreamId) return;

    try {
      // FIXED: Using correct socket event that matches backend
      const success = emitLiveStreamReaction({
        streamId: currentStreamId,
        reaction: reaction,
        intensity: 1
      });

      if (success) {
        console.log(`❤️ Sent reaction: ${reaction}`);
      }
    } catch (err) {
      console.error('❌ Error sending reaction:', err);
    }
  };

  // ============ WEBRTC FUNCTIONS ============
  
  const setupWebRTCConnection = (rtcConfig) => {
    try {
      console.log('📡 Setting up WebRTC connection with config:', rtcConfig);
      
      const configuration = {
        iceServers: rtcConfig.iceServers || [
          { urls: 'stun:stun.l.google.com:19302' }
        ]
      };
      
      const pc = new RTCPeerConnection(configuration);
      
      pc.ontrack = (event) => {
        console.log('📺 Received remote track');
        if (event.streams && event.streams[0]) {
          setRemoteStream(event.streams[0]);
        }
      };
      
      pc.onicecandidate = (event) => {
        if (event.candidate && socket && currentStreamId) {
          // Send ICE candidate through socket
          socket.emit('stream_webrtc_signal', {
            streamId: currentStreamId,
            type: 'ice-candidate',
            data: {
              candidate: event.candidate
            }
          });
        }
      };
      
      pc.onconnectionstatechange = () => {
        console.log('📡 WebRTC connection state:', pc.connectionState);
      };
      
      peerConnectionRef.current = pc;
      
    } catch (error) {
      console.error('❌ Error setting up WebRTC:', error);
      Alert.alert('WebRTC Error', 'Could not set up stream connection.');
    }
  };

  const handleWebRTCSignalingMessage = async (data) => {
    const pc = peerConnectionRef.current;
    if (!pc) return;

    try {
      switch (data.type) {
        case 'offer':
          console.log('📡 Handling WebRTC offer');
          await pc.setRemoteDescription(new RTCSessionDescription(data.data));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          
          // Send answer back through socket
          if (socket && currentStreamId) {
            socket.emit('stream_webrtc_signal', {
              streamId: currentStreamId,
              type: 'answer',
              data: answer
            });
          }
          break;
          
        case 'ice-candidate':
          console.log('📡 Handling ICE candidate');
          await pc.addIceCandidate(new RTCIceCandidate(data.data.candidate));
          break;
          
        default:
          console.log('📡 Unknown WebRTC signal type:', data.type);
      }
    } catch (error) {
      console.error('❌ Error handling WebRTC signal:', error);
    }
  };

  // ============ LIFECYCLE EFFECTS ============
  
  useEffect(() => {
    fetchActiveStreams();
  }, [token]);

  useEffect(() => {
    if (!isConnected) {
      setError('Socket connection lost.');
      setRemoteStream(null);
      setChatMessages([]);
      setCurrentViewerCount(0);
    } else {
      setError('');
    }
  }, [isConnected]);

  // Auto-join stream if streamId provided via navigation
  useEffect(() => {
    if (initialStreamId && isConnected && socket && !currentStreamId && !joiningStreamId) {
      console.log('🎥 Auto-joining stream from navigation:', initialStreamId);
      // Wait a bit for the component to fully mount
      setTimeout(() => {
        joinStream(initialStreamId);
      }, 1000);
    }
  }, [initialStreamId, isConnected, socket, currentStreamId, joiningStreamId]);

  // ============ RENDER FUNCTIONS ============
  
  const renderStreamItem = ({ item }) => (
    <View style={styles.streamItem}>
      <Text style={styles.streamTitle}>{item.title}</Text>
      <Text style={styles.streamInfo}>
        Streamer: {item.streamer?.fullName || item.streamer?.username || 'Unknown'}
      </Text>
      <Text style={styles.streamInfo}>Category: {item.category || 'General'}</Text>
      <Text style={styles.streamInfo}>Viewers: {item.currentViewers || 0}</Text>
      <Text style={styles.streamInfo}>Status: {item.status || 'LIVE'}</Text>
      <TouchableOpacity
        style={[
          styles.joinButton,
          (joiningStreamId === item.streamId) && styles.joiningButton
        ]}
        onPress={() => joinStream(item.streamId)}
        disabled={!!joiningStreamId || !!currentStreamId}
      >
        <Text style={styles.joinButtonText}>
          {joiningStreamId === item.streamId ? 'Joining...' : 
           currentStreamId ? 'In Stream' : 'Join Stream'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderReactionButtons = () => (
    <View style={styles.reactionContainer}>
      {['❤️', '👍', '😍', '🔥', '👏'].map((reaction) => (
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

  // ============ MAIN RENDER ============
  
  return (
    <View style={styles.container}>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {/* Stream List */}
      {!currentStreamId && !joiningStreamId && (
        <View style={styles.streamListContainer}>
          <View style={styles.headerRow}>
            <Text style={styles.header}>Active Live Streams</Text>
            <TouchableOpacity onPress={() => fetchActiveStreams()} disabled={loadingStreams}>
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
              <TouchableOpacity onPress={() => fetchActiveStreams()} style={styles.retryButton}>
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
      {(currentStreamId || joiningStreamId) && (
        <View style={styles.viewerContainer}>
          {/* Stream Header */}
          <View style={styles.streamHeader}>
            <TouchableOpacity onPress={leaveStream} style={styles.leaveButton}>
              <Text style={styles.leaveButtonText}>Leave</Text>
            </TouchableOpacity>
            <View style={styles.streamInfoHeader}>
              <Text style={styles.streamTitleHeader}>{streamTitle || 'Live Stream'}</Text>
              <Text style={styles.streamerName}>{streamerName || 'Streamer'}</Text>
              <Text style={styles.viewerCount}>👁️ {currentViewerCount} • {streamStatus}</Text>
            </View>
          </View>

          {/* Video Stream Container */}
          <View style={styles.videoContainer}>
            {joiningStreamId && !remoteStream && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#ed167e" />
                <Text style={styles.loadingText}>Connecting to stream...</Text>
              </View>
            )}
            {remoteStream && (
              <View style={styles.videoPlaceholder}>
                <Text style={styles.videoPlaceholderText}>
                  🎥 Live Video Stream
                </Text>
                <Text style={styles.videoInfo}>
                  Stream ID: {remoteStream.id}
                </Text>
                {/* TODO: Integrate actual video component here */}
                {/* <RTCView streamURL={remoteStream.toURL()} style={styles.video} /> */}
              </View>
            )}
            {!joiningStreamId && !remoteStream && currentStreamId && (
              <View style={styles.videoPlaceholder}>
                <Text style={styles.videoPlaceholderText}>
                  📡 Setting up video connection...
                </Text>
              </View>
            )}
          </View>

          {/* Reactions */}
          {currentStreamId && renderReactionButtons()}

          {/* Chat Section */}
          <View style={styles.chatContainer}>
            <Text style={styles.chatHeader}>Live Chat</Text>
            <FlatList
              ref={flatListRef}
              data={chatMessages}
              keyExtractor={(item) => item.id?.toString() || `${item.timestamp}_${Math.random()}`}
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
                editable={isConnected && !!currentStreamId && streamSettings.allowComments !== false}
                onSubmitEditing={sendChatMessage}
                multiline={false}
              />
              <TouchableOpacity 
                style={[
                  styles.sendButton,
                  (!isConnected || !newMessage.trim() || !currentStreamId) && styles.sendButtonDisabled
                ]} 
                onPress={sendChatMessage} 
                disabled={!isConnected || !newMessage.trim() || !currentStreamId}
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
  errorText: {
    color: '#ff6b6b',
    padding: 10,
    textAlign: 'center',
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
  },
  streamListContainer: {
    flex: 1,
    padding: 15,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  header: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
  },
  refreshText: {
    color: '#ed167e',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    marginTop: 10,
    fontSize: 16,
  },
  noStreamsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noStreamsText: {
    color: '#666',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#ed167e',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  listContent: {
    paddingBottom: 20,
  },
  streamItem: {
    backgroundColor: '#1a1a1a',
    padding: 15,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  streamTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  streamInfo: {
    fontSize: 14,
    color: '#ccc',
    marginBottom: 4,
  },
  joinButton: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#ed167e',
    borderRadius: 8,
    alignItems: 'center',
  },
  joiningButton: {
    backgroundColor: '#666',
  },
  joinButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  viewerContainer: {
    flex: 1,
  },
  streamHeader: {
    flexDirection: 'row',
    padding: 15,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  leaveButton: {
    padding: 10,
    backgroundColor: '#ff4757',
    borderRadius: 8,
    marginRight: 15,
  },
  leaveButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  streamInfoHeader: {
    flex: 1,
  },
  streamTitleHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  streamerName: {
    fontSize: 14,
    color: '#ed167e',
    fontWeight: '600',
  },
  viewerCount: {
    fontSize: 12,
    color: '#999',
  },
  videoContainer: {
    flex: 2,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  videoPlaceholder: {
    alignItems: 'center',
  },
  videoPlaceholderText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  videoInfo: {
    color: '#666',
    fontSize: 12,
    marginTop: 5,
  },
  reactionContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 10,
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  reactionButton: {
    padding: 8,
    backgroundColor: '#333',
    borderRadius: 20,
    minWidth: 40,
    alignItems: 'center',
  },
  reactionText: {
    fontSize: 18,
  },
  chatContainer: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  chatHeader: {
    padding: 12,
    fontWeight: 'bold',
    backgroundColor: '#2a2a2a',
    color: '#fff',
    fontSize: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  chatList: {
    padding: 10,
    flexGrow: 1,
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  messageUser: {
    fontWeight: 'bold',
    color: '#ed167e',
    marginRight: 5,
  },
  messageText: {
    flex: 1,
    color: '#fff',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: '#333',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
  },
  chatInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#555',
    borderRadius: 8,
    padding: 10,
    marginRight: 10,
    color: '#fff',
    backgroundColor: '#333',
  },
  sendButton: {
    padding: 10,
    backgroundColor: '#ed167e',
    borderRadius: 8,
    minWidth: 60,
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#666',
  },
  sendButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});


export default LiveStreamViewer;