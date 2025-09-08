// src/components/CreateLiveStream.jsx - CLEANED VERSION
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  Dimensions,
  Platform
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import BASE_URL from '../../config/config';
import { RTCView } from 'react-native-webrtc';
import enhancedGlobalWebRTCService from '../../services/EnhancedGlobalWebRTCService';

// Get device dimensions
const { width, height } = Dimensions.get('window');
const isSmallScreen = width < 375;
const isTablet = width >= 768;

const CreateLiveStream = ({ navigation }) => {
  const { user, token } = useAuth();
  const { socket, isConnected } = useSocket();

  // Stream management state
  const [streamId, setStreamId] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [isWebRTCConnected, setIsWebRTCConnected] = useState(false);
  const [connectedViewers, setConnectedViewers] = useState(new Set());
  const [webRTCError, setWebRTCError] = useState('');

  // Form state
  const [description, setDescription] = useState('');
  const [settings, setSettings] = useState({
    allowChat: true,
    allowReactions: true,
    maxViewers: 1000,
    recordStream: false,
    autoSaveRecording: false,
    videoQuality: '720p',
    maxBitrate: 2500,
  });

  // UI state
  const [streamStatus, setStreamStatus] = useState('IDLE');
  const [apiError, setApiError] = useState('');
  const [currentStreams, setCurrentStreams] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [checkingStreams, setCheckingStreams] = useState(true);
  const [endingAll, setEndingAll] = useState(false);
  const [videoEnabled, setVideoEnabled] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const displayError = apiError || webRTCError;
  const hasActiveStreams = useMemo(() => currentStreams.length > 0, [currentStreams]);

  // ============ SERVICE INITIALIZATION ============
  useEffect(() => {
    const initializeService = async () => {
      try {
        if (!socket || !isConnected) {
          setWebRTCError('Connecting to server...');
          return;
        }
        
        enhancedGlobalWebRTCService.setExternalSocket(socket);
        await enhancedGlobalWebRTCService.initialize(token);
        
        enhancedGlobalWebRTCService.setCallbacks({
          onLocalStream: handleLocalStream,
          onStreamStateChange: handleStreamStateChange,
          onError: handleWebRTCError,
          onViewerCount: handleViewerCount,
        });
        
        setWebRTCError('');
      } catch (error) {
        setWebRTCError(`Service initialization failed: ${error.message}`);
      }
    };

    if (token && user && socket && isConnected) {
      initializeService();
    }
  }, [token, user, socket, isConnected]);

  // ============ WEBRTC CALLBACKS ============
  const handleLocalStream = (stream) => {
    setLocalStream(stream);
    
    if (stream) {
      const videoTracks = stream.getVideoTracks();
      const audioTracks = stream.getAudioTracks();
      setVideoEnabled(videoTracks.length > 0 && videoTracks[0].enabled);
      setAudioEnabled(audioTracks.length > 0 && audioTracks[0].enabled);
    }
    
    setWebRTCError('');
  };

  const handleStreamStateChange = (state, data) => {
    switch (state) {
      case 'created':
        setStreamStatus('WAITING');
        enhancedGlobalWebRTCService.streamId = data.streamId;
        enhancedGlobalWebRTCService.streamRole = 'broadcaster';
        enhancedGlobalWebRTCService.streamState = 'waiting';
        break;
      case 'broadcasting':
        setStreamStatus('LIVE');
        setIsWebRTCConnected(true);
        enhancedGlobalWebRTCService.streamState = 'broadcasting';
        enhancedGlobalWebRTCService.isBroadcasting = true;
        setIsFullscreen(true);
        break;
      case 'ended':
        setStreamStatus('IDLE');
        setIsWebRTCConnected(false);
        setStreamId(null);
        setLocalStream(null);
        setConnectedViewers(new Set());
        setVideoEnabled(false);
        setAudioEnabled(false);
        setIsFullscreen(false);
        break;
    }
  };

  const handleWebRTCError = (errorData) => {
    setWebRTCError(errorData.message || 'WebRTC error occurred');
  };

  const handleViewerCount = (data) => {
    setConnectedViewers(new Set(Array.from({ length: data.count || 0 }, (_, i) => `viewer_${i}`)));
  };

  // ============ SOCKET CONNECTION CHECK ============
  useEffect(() => {
    if (!isConnected) {
      setApiError('Socket connection lost. Please check your internet.');
    } else {
      setApiError('');
    }
  }, [isConnected]);

  // ============ VIEWER JOIN HANDLING ============
  useEffect(() => {
    if (socket && isConnected && streamStatus === 'LIVE' && streamId) {
      const handleViewerJoin = async (data) => {
        const { streamId: eventStreamId, viewer, currentViewerCount } = data;
        
        if (eventStreamId === streamId) {
          setConnectedViewers(new Set(Array.from({ length: currentViewerCount || 0 }, (_, i) => `viewer_${i}`)));
          
          if (localStream) {
            const videoTracks = localStream.getVideoTracks();
            const audioTracks = localStream.getAudioTracks();
            
            videoTracks.forEach(track => {
              track.enabled = true;
            });
            audioTracks.forEach(track => {
              track.enabled = true;
            });
            
            setVideoEnabled(videoTracks.length > 0 && videoTracks[0].enabled);
            setAudioEnabled(audioTracks.length > 0 && audioTracks[0].enabled);
          }
          
          const serviceState = enhancedGlobalWebRTCService.getStreamState();
          
          if (!serviceState.hasLocalStream) {
            enhancedGlobalWebRTCService.localStream = localStream;
          }
        }
      };
      
      socket.on('stream_viewer_joined', handleViewerJoin);
      
      return () => {
        socket.off('stream_viewer_joined', handleViewerJoin);
      };
    }
  }, [socket, isConnected, streamStatus, streamId, localStream]);

  useEffect(() => {
    fetchCurrentStreams("component_mount_or_token_change");
  }, [token]);

  // ============ STREAM MANAGEMENT ============
  const fetchCurrentStreams = useCallback(async (source = "unknown") => {
    setCheckingStreams(true);
    if (!token) {
      setCurrentStreams([]);
      setCheckingStreams(false);
      return;
    }
    try {
      const response = await fetch(`${BASE_URL}/api/v1/live/active`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          setCurrentStreams([]);
          setCheckingStreams(false);
          return;
        } else {
          const errorText = await response.text();
          throw new Error(`Failed to fetch streams: ${response.status} ${response.statusText}`);
        }
      }
      const data = await response.json();
      let streamsArray = [];
      if (data.streams && Array.isArray(data.streams)) {
        streamsArray = data.streams;
      } else if (data.data && Array.isArray(data.data.streams)) {
        streamsArray = data.data.streams;
      } else if (Array.isArray(data)) {
        streamsArray = data;
      }
      setCurrentStreams(streamsArray);
      setApiError('');
    } catch (err) {
      setApiError(`Failed to fetch live streams: ${err.message}`);
      setCurrentStreams([]);
    } finally {
      setCheckingStreams(false);
    }
  }, [token]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchCurrentStreams("pull_to_refresh").finally(() => {
      setRefreshing(false);
    });
  }, [fetchCurrentStreams]);

  // End all active streams
  const endAllStreams = async () => {
    if (currentStreams.length === 0) {
      Alert.alert('Info', 'No active streams to end.');
      return;
    }
    if (!token) {
      Alert.alert('Error', 'Authentication required.');
      return;
    }
    setEndingAll(true);
    setApiError('');
    try {
      const endPromises = currentStreams.map(async (stream) => {
        const id = stream.streamId;
        if (!id) {
          return { streamId: 'unknown', success: false, error: 'No ID' };
        }
        try {
          const response = await fetch(`${BASE_URL}/api/v1/live/${id}/end`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });
          if (!response.ok) {
            const errorText = await response.text();
            return { streamId: id, success: false, error: `${response.status} - ${errorText}` };
          }
          const data = await response.json();
          return { streamId: id, success: true, data };
        } catch (apiErr) {
          return { streamId: id, success: false, error: apiErr.message };
        }
      });
      await Promise.allSettled(endPromises);

      if (streamId) {
        enhancedGlobalWebRTCService.cleanupStreaming();
        setStreamStatus('IDLE');
        setStreamId(null);
        setLocalStream(null);
        setDescription('');
        setVideoEnabled(false);
        setAudioEnabled(false);
        setIsFullscreen(false);
      }
      Alert.alert('Streams Ended', 'All your active streams have been ended. You can now create a new one.');
      await new Promise(resolve => setTimeout(resolve, 2000));
      await fetchCurrentStreams("endAllStreams");
    } catch (err) {
      setApiError('Failed to end one or more streams.');
      Alert.alert('Error', 'Failed to end one or more streams.');
    } finally {
      setEndingAll(false);
    }
  };

  // Create stream
  const createStream = async () => {
    if (hasActiveStreams) {
      Alert.alert(
        'Active Stream Found',
        'You already have active stream(s). Please end them first or use "End All & Create New".',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'End All & Create New', onPress: endAllStreams }
        ]
      );
      return;
    }
    if (!token) {
      Alert.alert('Authentication Error', 'You are not logged in.');
      return;
    }
    setStreamStatus('CREATING');
    setApiError('');
    try {
      const requestBody = {
        title: "Live",
        description: description.trim(),
        visibility: 'PUBLIC',
        category: 'OTHER',
        settings: {
          allowChat: settings.allowChat,
          allowReactions: settings.allowReactions,
          maxViewers: Number(settings.maxViewers) || 1000,
          recordStream: settings.recordStream,
          autoSaveRecording: settings.autoSaveRecording,
          videoQuality: settings.videoQuality,
          maxBitrate: Number(settings.maxBitrate) || 2500,
        }
      };

      const response = await fetch(`${BASE_URL}/api/v1/live/create`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (response.ok && data.success !== false) {
        const newStreamId = data.data?.streamId || data.streamId;
        if (!newStreamId) {
          throw new Error('Stream ID not found in successful response');
        }
        setStreamId(newStreamId);
        setStreamStatus('WAITING');
        enhancedGlobalWebRTCService.streamId = newStreamId;
        enhancedGlobalWebRTCService.streamRole = 'broadcaster';
        enhancedGlobalWebRTCService.streamState = 'waiting';
        Alert.alert('Success', 'Stream created! Ready to start broadcasting.');
        await initializeCamera();
      } else {
        let errorMessage = 'Failed to create stream.';
        if (data && data.message) {
          errorMessage = data.message;
        } else if (!response.ok) {
          errorMessage = `HTTP Error ${response.status}: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }
    } catch (err) {
      const displayMessage = err.message || 'An unexpected error occurred.';
      setApiError(displayMessage);
      setStreamStatus('ERROR');
      Alert.alert('Error', displayMessage);
    }
  };

  // Initialize camera
  const initializeCamera = async () => {
    try {
      const mediaConstraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: {
          facingMode: 'user',
          width: { min: 320, ideal: 640, max: 1280 },
          height: { min: 240, ideal: 480, max: 720 },
          frameRate: { min: 15, ideal: 24, max: 30 }
        }
      };
      
      const stream = await enhancedGlobalWebRTCService.getUserMedia(mediaConstraints);
      
      if (stream) {
        const audioTracks = stream.getAudioTracks();
        const videoTracks = stream.getVideoTracks();
        
        if (videoTracks.length === 0) {
          throw new Error('No video tracks available - camera access denied or not available');
        }
        
        videoTracks.forEach((track, index) => {
          track.enabled = true;
        });
        
        if (audioTracks.length === 0) {
          Alert.alert('Audio Warning', 'No microphone detected. Audio will not be available.');
        } else {
          audioTracks.forEach((track, index) => {
            track.enabled = true;
          });
        }
        
        enhancedGlobalWebRTCService.localStream = stream;
        
        setLocalStream(stream);
        setVideoEnabled(videoTracks.length > 0 && videoTracks[0].enabled);
        setAudioEnabled(audioTracks.length > 0 && audioTracks[0].enabled);
        setStreamStatus('WAITING');
        
        return true;
      } else {
        throw new Error('Failed to get local stream');
      }
    } catch (error) {
      setStreamStatus('ERROR');
      setWebRTCError(`Camera initialization failed: ${error.message}`);
      Alert.alert('Media Error', `Failed to access camera/microphone: ${error.message}`);
      return false;
    }
  };

  // Start stream
  const startStream = async () => {
    if (streamStatus !== 'WAITING' || !streamId || !token) {
      Alert.alert('Error', 'Stream is not ready to start.');
      return;
    }
    
    if (!localStream) {
      Alert.alert('Error', 'Camera is not ready. Please wait or restart the stream.');
      return;
    }
    
    const videoTracks = localStream.getVideoTracks();
    const audioTracks = localStream.getAudioTracks();
    
    if (videoTracks.length === 0) {
      Alert.alert('Error', 'No video available. Please check camera permissions.');
      return;
    }
    
    if (!socket || !isConnected) {
      Alert.alert('Error', 'Socket connection not ready. Please check your internet.');
      return;
    }
    
    setStreamStatus('STARTING');
    
    try {
      enhancedGlobalWebRTCService.localStream = localStream;
      
      const response = await fetch(`${BASE_URL}/api/v1/live/${streamId}/start`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Failed to start stream: ${response.status} ${response.statusText}`);
      }
      
      await response.json();
      
      enhancedGlobalWebRTCService.streamId = streamId;
      enhancedGlobalWebRTCService.streamRole = 'broadcaster';
      enhancedGlobalWebRTCService.streamState = 'broadcasting';
      enhancedGlobalWebRTCService.isBroadcasting = true;
      
      socket.emit('broadcaster_ready', {
        streamId: streamId,
        hasLocalStream: true,
        hasVideo: videoTracks.length > 0,
        hasAudio: audioTracks.length > 0,
        settings: settings
      });
      
      setStreamStatus('LIVE');
      setIsWebRTCConnected(true);
      Alert.alert('Broadcasting', 'Your stream is now live!');
      
    } catch (err) {
      setStreamStatus('WAITING');
      setWebRTCError(err.message);
      Alert.alert('Error', `Failed to start stream: ${err.message}`);
    }
  };

  // End stream
  const endStream = async (id) => {
    if (!id) {
      Alert.alert('Error', 'Invalid stream ID.');
      return;
    }
    if (!token) {
      Alert.alert('Error', 'Authentication required.');
      return;
    }
    if (id === streamId) {
      setStreamStatus('ENDING');
    }
    try {
      const response = await fetch(`${BASE_URL}/api/v1/live/${id}/end`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Failed to end stream via API: ${response.status} ${response.statusText}`);
      }
      await response.json();

      if (id === streamId && enhancedGlobalWebRTCService.streamRole === 'broadcaster') {
        socket.emit('stream_end', { streamId: id });
      }

      if (id === streamId) {
        enhancedGlobalWebRTCService.cleanupStreaming();
        setStreamStatus('IDLE');
        setStreamId(null);
        setLocalStream(null);
        setDescription('');
        setVideoEnabled(false);
        setAudioEnabled(false);
        setIsFullscreen(false);
        Alert.alert('Stream Ended', 'Your live stream has finished.');
      } else {
        Alert.alert('Stream Ended', 'The selected live stream has finished.');
      }
      await new Promise(resolve => setTimeout(resolve, 1500));
      await fetchCurrentStreams("endStream");
    } catch (err) {
      if (id === streamId) {
        setStreamStatus('LIVE');
      }
      Alert.alert('Error', `Failed to end stream: ${err.message}`);
    }
  };

  const handleStartBroadcast = () => {
    if (streamStatus === 'WAITING') {
      startStream();
    } else if (streamStatus === 'LIVE') {
      Alert.alert('Already Live', 'The stream is currently broadcasting.');
    } else {
      Alert.alert('Not Ready', 'Please create a stream first.');
    }
  };

  const handleEndStream = (id) => {
    const streamIdToUse = id || streamId;
    if (!streamIdToUse) {
      Alert.alert('No Active Stream', 'There is no stream currently running to end.');
      return;
    }
    Alert.alert(
      'End Stream',
      'Are you sure you want to end this live stream?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'End Stream', onPress: () => endStream(streamIdToUse), style: 'destructive' },
      ]
    );
  };

  const exitFullscreen = () => {
    setIsFullscreen(false);
  };

  if (checkingStreams) {
    return (
      <View style={styles.centeredContainer}>
        <ActivityIndicator size="large" color="#FF6B6B" />
        <Text style={styles.loadingText}>Checking for active streams...</Text>
      </View>
    );
  }

  const isCreateButtonDisabled = !token || hasActiveStreams || streamStatus !== 'IDLE';

  // Fullscreen preview component
  if (isFullscreen && localStream) {
    return (
      <View style={styles.fullscreenContainer}>
        <RTCView 
          streamURL={localStream.toURL()} 
          style={styles.fullscreenVideo}
          objectFit="cover"
          mirror={true}
          zOrder={0}
        />
        
        <View style={styles.fullscreenTopBar}>
          <TouchableOpacity 
            style={styles.liveButton}
            onPress={() => {}}
          >
            <Text style={styles.liveButtonText}>● LIVE</Text>
          </TouchableOpacity>
          
          <Text style={styles.viewerCount}>
            {connectedViewers.size} {connectedViewers.size === 1 ? 'viewer' : 'viewers'}
          </Text>
        </View>
        
        <TouchableOpacity 
          style={styles.fullscreenEndButton}
          onPress={() => handleEndStream(streamId)}
        >
          <Text style={styles.fullscreenEndButtonText}>End Stream</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.exitFullscreenButton}
          onPress={exitFullscreen}
        >
          <Text style={styles.exitFullscreenText}>×</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#FF6B6B"
          colors={['#FF6B6B']}
        />
      }
    >
      <Text style={styles.header}>Go Live</Text>
      
      {displayError ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{displayError}</Text>
        </View>
      ) : null}

      <View style={styles.formContainer}>
       

        <View style={styles.buttonContainer}>
          {streamStatus === 'IDLE' && (
            <TouchableOpacity
              style={[
                styles.button,
                styles.createButton,
                isCreateButtonDisabled && styles.buttonDisabled
              ]}
              onPress={createStream}
              disabled={isCreateButtonDisabled}
            >
              <Text style={styles.buttonText}>Create Stream</Text>
            </TouchableOpacity>
          )}

          {streamStatus === 'WAITING' && (
            <TouchableOpacity
              style={[styles.button, styles.startButton]}
              onPress={handleStartBroadcast}
              disabled={!isConnected || !localStream}
            >
              <Text style={styles.buttonText}>Start Broadcasting</Text>
            </TouchableOpacity>
          )}

          {streamStatus === 'LIVE' && (
            <TouchableOpacity
              style={[styles.button, styles.liveStatusButton]}
              onPress={() => Alert.alert('Broadcasting', 'Your stream is live!')}
            >
              <Text style={styles.buttonText}>● LIVE</Text>
            </TouchableOpacity>
          )}

          {(streamStatus === 'WAITING' || streamStatus === 'LIVE') && (
            <TouchableOpacity
              style={[styles.button, styles.endButton]}
              onPress={() => handleEndStream(streamId)}
            >
              <Text style={styles.buttonText}>End Stream</Text>
            </TouchableOpacity>
          )}

          {(streamStatus === 'CREATING' || streamStatus === 'STARTING' || streamStatus === 'ENDING') && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#FF6B6B" />
              <Text style={styles.loadingText}>
                {streamStatus === 'CREATING' ? 'Creating stream...' : 
                 streamStatus === 'STARTING' ? 'Starting stream...' : 'Ending stream...'}
              </Text>
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#0A0A0A',
    minHeight: height,
  },
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0A0A0A',
    padding: 20,
  },
  header: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 30,
    textAlign: 'center',
    color: '#FFFFFF',
    marginTop: 20,
  },
  errorContainer: {
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    borderWidth: 1,
    borderColor: '#FF6B6B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  errorText: {
    color: '#FF6B6B',
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '500',
  },
  formContainer: {
    flex: 1,
    marginTop: 20,
  },
  formGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#FFFFFF',
  },
  input: {
    borderWidth: 1,
    borderColor: '#333333',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    backgroundColor: '#1A1A1A',
    color: '#FFFFFF',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  buttonContainer: {
    marginVertical: 30,
    gap: 16,
  },
  button: {
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  createButton: {
    backgroundColor: '#4CAF50',
    borderWidth: 1,
    borderColor: '#66BB6A',
  },
  startButton: {
    backgroundColor: '#FF6B6B',
    borderWidth: 1,
    borderColor: '#FF8A80',
  },
  liveStatusButton: {
    backgroundColor: '#E53E3E',
    borderWidth: 1,
    borderColor: '#FC8181',
  },
  endButton: {
    backgroundColor: '#2D3748',
    borderWidth: 1,
    borderColor: '#4A5568',
  },
  buttonDisabled: {
    backgroundColor: '#4A5568',
    borderColor: '#2D3748',
    opacity: 0.6,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  loadingText: {
    color: '#FFFFFF',
    marginTop: 16,
    fontSize: 16,
    fontWeight: '500',
  },
  
  // Fullscreen styles
  fullscreenContainer: {
    flex: 1,
    backgroundColor: '#000000',
    position: 'relative',
  },
  fullscreenVideo: {
    width: '100%',
    height: '100%',
  },
  fullscreenTopBar: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    zIndex: 10,
  },
  liveButton: {
    backgroundColor: '#E53E3E',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  liveButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
  viewerCount: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  fullscreenEndButton: {
    position: 'absolute',
    bottom: 100,
    alignSelf: 'center',
    backgroundColor: '#E53E3E',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    zIndex: 10,
  },
  fullscreenEndButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
  },
  exitFullscreenButton: {
    position: 'absolute',
    bottom: 30,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  exitFullscreenText: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '300',
  },
});

export default CreateLiveStream;