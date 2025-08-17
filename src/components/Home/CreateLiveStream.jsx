// src/components/CreateLiveStream.jsx - FULL UPDATED VERSION WITH VIDEO FIXES
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

  const displayError = apiError || webRTCError;
  const hasActiveStreams = useMemo(() => currentStreams.length > 0, [currentStreams]);

  // ============ SERVICE INITIALIZATION ============
  useEffect(() => {
    const initializeService = async () => {
      try {
        // CRITICAL: Check socket connection first
        if (!socket || !isConnected) {
          setWebRTCError('Connecting to server...');
          return;
        }
        
        console.log('🚀 Initializing WebRTC service with external socket');
        enhancedGlobalWebRTCService.setExternalSocket(socket);
        await enhancedGlobalWebRTCService.initialize(token);
        
        enhancedGlobalWebRTCService.setCallbacks({
          onLocalStream: handleLocalStream,
          onStreamStateChange: handleStreamStateChange,
          onError: handleWebRTCError,
          onViewerCount: handleViewerCount,
        });
        
        setWebRTCError('');
        console.log('✅ WebRTC service initialized successfully');
      } catch (error) {
        console.error('❌ Service initialization failed:', error);
        setWebRTCError(`Service initialization failed: ${error.message}`);
      }
    };

    if (token && user && socket && isConnected) {
      initializeService();
    }
  }, [token, user, socket, isConnected]);

  // ============ WEBRTC CALLBACKS ============
  const handleLocalStream = (stream) => {
    console.log('📹 Local stream received in component');
    setLocalStream(stream);
    
    // Check stream tracks
    if (stream) {
      const videoTracks = stream.getVideoTracks();
      const audioTracks = stream.getAudioTracks();
      setVideoEnabled(videoTracks.length > 0 && videoTracks[0].enabled);
      setAudioEnabled(audioTracks.length > 0 && audioTracks[0].enabled);
    }
    
    setWebRTCError('');
  };

  const handleStreamStateChange = (state, data) => {
    console.log('🔄 Stream state changed:', state, data);
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
        break;
      case 'ended':
        setStreamStatus('IDLE');
        setIsWebRTCConnected(false);
        setStreamId(null);
        setLocalStream(null);
        setConnectedViewers(new Set());
        setVideoEnabled(false);
        setAudioEnabled(false);
        break;
    }
  };

  const handleWebRTCError = (errorData) => {
    console.error('❌ WebRTC error:', errorData);
    setWebRTCError(errorData.message || 'WebRTC error occurred');
  };

  const handleViewerCount = (data) => {
    console.log('👥 Viewer count update:', data);
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

  // ============ VIEWER JOIN HANDLING WITH VIDEO VERIFICATION ============
  useEffect(() => {
    if (socket && isConnected && streamStatus === 'LIVE' && streamId) {
      const handleViewerJoin = async (data) => {
        const { streamId: eventStreamId, viewer, currentViewerCount } = data;
        
        if (eventStreamId === streamId) {
          console.log('👁 New viewer joined:', viewer);
          
          // Update viewer count
          setConnectedViewers(new Set(Array.from({ length: currentViewerCount || 0 }, (_, i) => `viewer_${i}`)));
          
          // Verify local stream has video
          if (localStream) {
            const videoTracks = localStream.getVideoTracks();
            const audioTracks = localStream.getAudioTracks();
            
            console.log('📡 Broadcaster stream status:', {
              hasVideo: videoTracks.length > 0,
              hasAudio: audioTracks.length > 0,
              videoEnabled: videoTracks[0]?.enabled,
              audioEnabled: audioTracks[0]?.enabled
            });
            
            // Ensure tracks are enabled
            videoTracks.forEach(track => {
              track.enabled = true;
              console.log('📹 Ensuring video track enabled:', track.id);
            });
            audioTracks.forEach(track => {
              track.enabled = true;
              console.log('🎵 Ensuring audio track enabled:', track.id);
            });
            
            // Update state
            setVideoEnabled(videoTracks.length > 0 && videoTracks[0].enabled);
            setAudioEnabled(audioTracks.length > 0 && audioTracks[0].enabled);
          }
          
          // Verify WebRTC service state
          const serviceState = enhancedGlobalWebRTCService.getStreamState();
          console.log('🔍 WebRTC service state:', serviceState);
          
          if (!serviceState.hasLocalStream) {
            console.error('❌ WebRTC service missing local stream!');
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

  // End all active streams using REST API
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

      // Cleanup local state if current stream was ended
      if (streamId) {
        enhancedGlobalWebRTCService.cleanupStreaming();
        setStreamStatus('IDLE');
        setStreamId(null);
        setLocalStream(null);
        setDescription('');
        setVideoEnabled(false);
        setAudioEnabled(false);
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

  // Create stream using backend API
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
        title: "Live", // Fixed title
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
        Alert.alert('Success', 'Stream created! Initializing camera...');
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

  // ✅ ENHANCED CAMERA INITIALIZATION WITH VIDEO VERIFICATION
  const initializeCamera = async () => {
    try {
      console.log('📹 Starting camera initialization...');
      
      // Ensure we request both audio and video explicitly
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
      
      // Get stream with explicit constraints
      const stream = await enhancedGlobalWebRTCService.getUserMedia(mediaConstraints);
      
      if (stream) {
        const audioTracks = stream.getAudioTracks();
        const videoTracks = stream.getVideoTracks();
        
        console.log('🎵 Audio tracks:', audioTracks.length);
        console.log('📹 Video tracks:', videoTracks.length);
        
        // ✅ CRITICAL: Verify and enable video tracks
        if (videoTracks.length === 0) {
          throw new Error('No video tracks available - camera access denied or not available');
        }
        
        // Enable all tracks explicitly
        videoTracks.forEach((track, index) => {
          track.enabled = true;
          console.log(`📹 Video track ${index}:`, {
            id: track.id,
            enabled: track.enabled,
            muted: track.muted,
            readyState: track.readyState,
            label: track.label
          });
        });
        
        if (audioTracks.length === 0) {
          console.warn('⚠️ No audio tracks found!');
          Alert.alert('Audio Warning', 'No microphone detected. Audio will not be available.');
        } else {
          audioTracks.forEach((track, index) => {
            track.enabled = true;
            console.log(`🎵 Audio track ${index}:`, {
              id: track.id,
              enabled: track.enabled,
              muted: track.muted,
              readyState: track.readyState
            });
          });
        }
        
        // ✅ CRITICAL: Set the local stream in the WebRTC service
        enhancedGlobalWebRTCService.localStream = stream;
        
        setLocalStream(stream);
        setVideoEnabled(videoTracks.length > 0 && videoTracks[0].enabled);
        setAudioEnabled(audioTracks.length > 0 && audioTracks[0].enabled);
        setStreamStatus('WAITING');
        
        console.log('✅ Camera initialized successfully with video and audio');
        return true;
      } else {
        throw new Error('Failed to get local stream');
      }
    } catch (error) {
      console.error('❌ Camera/Audio initialization error:', error);
      setStreamStatus('ERROR');
      setWebRTCError(`Camera initialization failed: ${error.message}`);
      Alert.alert('Media Error', `Failed to access camera/microphone: ${error.message}`);
      return false;
    }
  };

  // ✅ ENHANCED START STREAM WITH VIDEO VERIFICATION
  const startStream = async () => {
    if (streamStatus !== 'WAITING' || !streamId || !token) {
      Alert.alert('Error', 'Stream is not ready to start.');
      return;
    }
    
    if (!localStream) {
      Alert.alert('Error', 'Camera is not ready. Please wait or restart the stream.');
      return;
    }
    
    // ✅ CRITICAL: Verify video tracks before starting
    const videoTracks = localStream.getVideoTracks();
    const audioTracks = localStream.getAudioTracks();
    
    if (videoTracks.length === 0) {
      Alert.alert('Error', 'No video available. Please check camera permissions.');
      return;
    }
    
    console.log('📡 Starting stream with:', {
      videoTracks: videoTracks.length,
      audioTracks: audioTracks.length,
      videoEnabled: videoTracks[0]?.enabled,
      audioEnabled: audioTracks[0]?.enabled
    });
    
    if (!socket || !isConnected) {
      Alert.alert('Error', 'Socket connection not ready. Please check your internet.');
      return;
    }
    
    setStreamStatus('STARTING');
    
    try {
      // First, ensure the local stream is set in the service
      enhancedGlobalWebRTCService.localStream = localStream;
      
      // Start the broadcast via API
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
      
      // Set proper state in WebRTC service
      enhancedGlobalWebRTCService.streamId = streamId;
      enhancedGlobalWebRTCService.streamRole = 'broadcaster';
      enhancedGlobalWebRTCService.streamState = 'broadcasting';
      enhancedGlobalWebRTCService.isBroadcasting = true;
      
      // ✅ CRITICAL: Emit broadcaster_ready with video confirmation
      socket.emit('broadcaster_ready', {
        streamId: streamId,
        hasLocalStream: true,
        hasVideo: videoTracks.length > 0,
        hasAudio: audioTracks.length > 0,
        settings: settings
      });
      
      setStreamStatus('LIVE');
      setIsWebRTCConnected(true);
      Alert.alert('Broadcasting', 'Your stream is now live with video and audio!');
      
      // Log stream details for debugging
      console.log('✅ Stream started successfully:', {
        streamId,
        videoTracks: videoTracks.length,
        audioTracks: audioTracks.length,
        videoEnabled: videoTracks[0]?.enabled,
        audioEnabled: audioTracks[0]?.enabled,
        serviceState: enhancedGlobalWebRTCService.getStreamState()
      });
      
    } catch (err) {
      setStreamStatus('WAITING');
      setWebRTCError(err.message);
      Alert.alert('Error', `Failed to start stream: ${err.message}`);
    }
  };

  // End a single stream using REST API
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

      // Cleanup local state if it was our stream
      if (id === streamId) {
        enhancedGlobalWebRTCService.cleanupStreaming();
        setStreamStatus('IDLE');
        setStreamId(null);
        setLocalStream(null);
        setDescription('');
        setVideoEnabled(false);
        setAudioEnabled(false);
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

  const retryCamera = async () => {
    if (!streamId) {
      Alert.alert('Error', 'No active stream to retry camera for.');
      return;
    }
    setStreamStatus('WAITING');
    setApiError('');
    setWebRTCError('');
    const success = await initializeCamera();
    if (success) {
      Alert.alert('Success', 'Camera is now ready!');
    } else {
      setStreamStatus('ERROR');
      Alert.alert('Camera Error', 'Still unable to access camera. Please check permissions.');
    }
  };

  const handleStartBroadcast = () => {
    if (streamStatus === 'WAITING') {
      startStream();
    } else if (streamStatus === 'LIVE') {
      Alert.alert('Already Live', 'The stream is currently broadcasting.');
    } else {
      Alert.alert('Not Ready', 'Please create a stream and wait for camera.');
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
      id === streamId
        ? 'Are you sure you want to end this live stream?'
        : 'Are you sure you want to end this stream?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'End Stream', onPress: () => endStream(streamIdToUse), style: 'destructive' },
      ]
    );
  };

  if (checkingStreams) {
    return (
      <View style={styles.centeredContainer}>
        <ActivityIndicator size="large" color="#ff0000" />
        <Text style={styles.loadingText}>Checking for active streams...</Text>
      </View>
    );
  }

  const isCreateButtonDisabled = !token || hasActiveStreams || streamStatus !== 'IDLE';

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#ff0000"
          colors={['#ff0000']}
        />
      }
    >
      <Text style={styles.header}>Go Live</Text>
      {displayError ? <Text style={styles.errorText}>{displayError}</Text> : null}

      {/* Active Streams Section */}
      <View style={styles.currentStreamsContainer}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Your Active Streams</Text>
          <TouchableOpacity onPress={() => fetchCurrentStreams("manual_refresh_button")}>
            <Text style={styles.refreshText}>Refresh</Text>
          </TouchableOpacity>
        </View>
        {currentStreams.length === 0 ? (
          <Text style={styles.noStreamsText}>No active streams found.</Text>
        ) : (
          <>
            {currentStreams.map((stream) => (
              <View key={stream.streamId} style={styles.streamItem}>
                <View style={styles.streamInfo}>
                  <Text style={styles.streamTitle} numberOfLines={1}>{stream.title}</Text>
                  <Text style={styles.streamId}>ID: {stream.streamId}</Text>
                  <Text style={styles.streamStatus}>Status: {stream.status || 'LIVE'}</Text>
                  {connectedViewers.size > 0 && stream.streamId === streamId && (
                    <Text style={styles.streamViewers}>Connected Viewers: {connectedViewers.size}</Text>
                  )}
                </View>
                <TouchableOpacity
                  style={styles.endStreamButton}
                  onPress={() => handleEndStream(stream.streamId)}
                >
                  <Text style={styles.endStreamButtonText}>End</Text>
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity
              style={[styles.button, styles.buttonEndAll, endingAll && styles.buttonDisabled]}
              onPress={endAllStreams}
              disabled={endingAll}
            >
              {endingAll ? (
                <>
                  <ActivityIndicator size="small" color="#fff" />
                  <Text style={styles.buttonText}> Ending...</Text>
                </>
              ) : (
                <Text style={styles.buttonText}>End All & Create New</Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Stream Creation Form */}
      <View style={hasActiveStreams ? styles.disabledForm : null}>
        <View style={styles.formGroup}>
          <Text style={styles.label}>Description (Optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Add a description..."
            placeholderTextColor="#666"
            multiline
            editable={!hasActiveStreams && streamStatus === 'IDLE'}
          />
        </View>

        {streamId && (
          <View style={styles.statusContainer}>
            <Text style={styles.statusText}>Stream ID: {streamId}</Text>
            <Text style={styles.statusText}>Status: {streamStatus}</Text>
            <Text style={styles.statusText}>
              Camera: {localStream ? '✅ Ready' : '❌ Not Ready'}
            </Text>
            <Text style={styles.statusText}>
              Video: {videoEnabled ? '✅ Enabled' : '❌ Disabled'}
            </Text>
            <Text style={styles.statusText}>
              Audio: {audioEnabled ? '✅ Enabled' : '❌ Disabled'}
            </Text>
            <Text style={styles.statusText}>
              Socket: {isConnected ? '✅ Connected' : '❌ Disconnected'}
            </Text>
            {isWebRTCConnected && <Text style={styles.statusText}>WebRTC: ✅ Broadcasting</Text>}
            {connectedViewers.size > 0 && (
              <Text style={styles.statusText}>Connected Viewers: {connectedViewers.size}</Text>
            )}
          </View>
        )}

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[
              styles.button,
              styles.buttonCreate,
              isCreateButtonDisabled && styles.buttonDisabled,
              hasActiveStreams && styles.buttonCreateDisabledWithStreams
            ]}
            onPress={createStream}
            disabled={isCreateButtonDisabled}
          >
            <Text style={styles.buttonText}>Create Stream</Text>
          </TouchableOpacity>

          {(streamStatus === 'WAITING' || streamStatus === 'LIVE') && (
            <TouchableOpacity
              style={[
                styles.button,
                streamStatus === 'WAITING' ? styles.buttonStart : styles.buttonLive,
                streamStatus === 'STARTING' && styles.buttonDisabled
              ]}
              onPress={handleStartBroadcast}
              disabled={!isConnected || !localStream || streamStatus === 'STARTING'}
            >
              <Text style={styles.buttonText}>
                {streamStatus === 'WAITING' ? 'Start Broadcasting' :
                  streamStatus === 'STARTING' ? 'Starting...' : 'Live - Broadcasting'}
              </Text>
            </TouchableOpacity>
          )}

          {streamStatus === 'ERROR' && (
            <TouchableOpacity
              style={[styles.button, styles.buttonStart]}
              onPress={retryCamera}
            >
              <Text style={styles.buttonText}>Retry Camera</Text>
            </TouchableOpacity>
          )}

          {(streamStatus === 'WAITING' || streamStatus === 'LIVE') && !localStream && (
            <TouchableOpacity
              style={[styles.button, styles.buttonStart]}
              onPress={retryCamera}
            >
              <Text style={styles.buttonText}>Retry Camera</Text>
            </TouchableOpacity>
          )}

          {(streamStatus === 'WAITING' || streamStatus === 'LIVE') && (
            <TouchableOpacity
              style={[styles.button, styles.buttonEnd]}
              onPress={() => handleEndStream(streamId)}
            >
              <Text style={styles.buttonText}>End Stream</Text>
            </TouchableOpacity>
          )}

          {(streamStatus === 'CREATING' || streamStatus === 'STARTING') && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#ff0000" />
              <Text style={styles.loadingText}>
                {streamStatus === 'CREATING' ? 'Creating stream...' : 'Starting stream...'}
              </Text>
            </View>
          )}

          {streamStatus === 'ENDING' && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#ff0000" />
              <Text style={styles.loadingText}>Ending stream...</Text>
            </View>
          )}
        </View>

        {/* Enhanced Preview Container */}
        <View style={styles.previewContainer}>
          {localStream ? (
            <>
              <RTCView 
                streamURL={localStream.toURL()} 
                style={styles.rtcView} 
                objectFit="cover"
                mirror={true}
                zOrder={0}
              />
              <View style={styles.previewOverlay}>
                <Text style={styles.previewText}>Your Camera Preview</Text>
                <View style={styles.streamStats}>
                  <Text style={styles.statsText}>
                    📹 {videoEnabled ? '✅' : '❌'}
                  </Text>
                  <Text style={styles.statsText}>
                    🎵 {audioEnabled ? '✅' : '❌'}
                  </Text>
                </View>
              </View>
              {streamStatus === 'LIVE' && (
                <View style={styles.liveIndicator}>
                  <Text style={styles.liveText}>● LIVE</Text>
                </View>
              )}
            </>
          ) : (
            <View style={styles.previewPlaceholder}>
              <Text style={styles.previewText}>
                {streamStatus === 'WAITING' ? 'Initializing Camera...' :
                  streamStatus === 'ERROR' ? 'Camera Error - Tap "Retry Camera"' :
                    'Preview will appear here'}
              </Text>
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  );
};

// Responsive Styles
const styles = StyleSheet.create({
  container: {
    padding: isSmallScreen ? 12 : 20,
    backgroundColor: '#000',
    minHeight: height,
  },
  header: {
    fontSize: isSmallScreen ? 20 : 24,
    fontWeight: 'bold',
    marginBottom: isSmallScreen ? 15 : 20,
    textAlign: 'center',
    color: '#fff',
    marginTop: isSmallScreen ? 10 : 20,
  },
  errorText: {
    color: '#ff4444',
    marginBottom: 10,
    textAlign: 'center',
    backgroundColor: 'rgba(255, 68, 68, 0.1)',
    padding: isSmallScreen ? 8 : 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#ff4444',
    fontSize: isSmallScreen ? 14 : 16,
  },
  formGroup: {
    marginBottom: isSmallScreen ? 10 : 15,
  },
  label: {
    fontSize: isSmallScreen ? 14 : 16,
    fontWeight: '600',
    marginBottom: 5,
    color: '#fff',
  },
  input: {
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 5,
    padding: isSmallScreen ? 8 : 10,
    fontSize: isSmallScreen ? 14 : 16,
    backgroundColor: '#111',
    color: '#fff',
  },
  textArea: {
    height: isSmallScreen ? 60 : 80,
    textAlignVertical: 'top',
  },
  statusContainer: {
    padding: isSmallScreen ? 8 : 10,
    backgroundColor: '#111',
    borderRadius: 5,
    marginBottom: isSmallScreen ? 10 : 15,
    borderWidth: 1,
    borderColor: '#333',
  },
  statusText: {
    fontSize: isSmallScreen ? 12 : 14,
    color: '#fff',
    marginBottom: 2,
  },
  buttonContainer: {
    flexDirection: isTablet ? 'row' : 'column',
    justifyContent: 'space-between',
    marginVertical: isSmallScreen ? 10 : 20,
    gap: isSmallScreen ? 8 : 10,
  },
  button: {
    padding: isSmallScreen ? 12 : 15,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#333',
    flexDirection: 'row',
    minHeight: isSmallScreen ? 40 : 50,
    width: isTablet ? 'auto' : '100%',
  },
  buttonText: {
    color: '#fff',
    fontSize: isSmallScreen ? 14 : 16,
    fontWeight: 'bold',
  },
  buttonCreate: {
    backgroundColor: '#007700',
    borderColor: '#00aa00',
  },
  buttonCreateDisabledWithStreams: {
    backgroundColor: '#555',
    borderColor: '#444',
  },
  buttonStart: {
    backgroundColor: '#007700',
    borderColor: '#00aa00',
  },
  buttonLive: {
    backgroundColor: '#cc0000',
    borderColor: '#ff0000',
  },
  buttonEnd: {
    backgroundColor: '#333',
    borderColor: '#ff0000',
  },
  buttonEndAll: {
    backgroundColor: '#8B0000',
    borderColor: '#A52A2A',
    padding: isSmallScreen ? 12 : 15,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    width: '100%',
    marginTop: 10,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: isSmallScreen ? 15 : 20,
    width: '100%',
  },
  loadingText: {
    color: '#fff',
    marginTop: 10,
    fontSize: isSmallScreen ? 14 : 16,
  },
  previewContainer: {
    height: isSmallScreen ? 200 : 300,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 5,
    overflow: 'hidden',
    marginTop: isSmallScreen ? 15 : 20,
    borderWidth: 1,
    borderColor: '#333',
    position: 'relative',
  },
  rtcView: {
    width: '100%',
    height: '100%',
  },
  previewOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    padding: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  previewPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewText: {
    color: '#fff',
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: isSmallScreen ? 4 : 5,
    borderRadius: 3,
    fontSize: isSmallScreen ? 12 : 14,
  },
  streamStats: {
    flexDirection: 'row',
    gap: 10,
  },
  statsText: {
    color: '#fff',
    fontSize: 12,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 4,
    borderRadius: 4,
  },
  liveIndicator: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    backgroundColor: 'rgba(255,0,0,0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  liveText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  currentStreamsContainer: {
    marginTop: isSmallScreen ? 8 : 10,
    paddingTop: isSmallScreen ? 8 : 10,
    paddingBottom: isSmallScreen ? 15 : 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: isSmallScreen ? 10 : 15,
  },
  sectionTitle: {
    fontSize: isSmallScreen ? 16 : 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  refreshText: {
    color: '#ff0000',
    fontWeight: '600',
    fontSize: isSmallScreen ? 14 : 16,
  },
  noStreamsText: {
    color: '#888',
    textAlign: 'center',
    padding: isSmallScreen ? 15 : 20,
    fontSize: isSmallScreen ? 14 : 16,
  },
  streamItem: {
    flexDirection: isSmallScreen ? 'column' : 'row',
    justifyContent: 'space-between',
    alignItems: isSmallScreen ? 'flex-start' : 'center',
    padding: isSmallScreen ? 10 : 15,
    backgroundColor: '#111',
    borderRadius: 5,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#333',
  },
  streamInfo: {
    flex: 1,
    marginRight: isSmallScreen ? 0 : 10,
    marginBottom: isSmallScreen ? 10 : 0,
    width: '100%',
  },
  streamTitle: {
    color: '#fff',
    fontWeight: '600',
    fontSize: isSmallScreen ? 14 : 16,
    marginBottom: isSmallScreen ? 2 : 0,
  },
  streamId: {
    color: '#888',
    fontSize: isSmallScreen ? 10 : 12,
    marginTop: isSmallScreen ? 2 : 2,
  },
  streamStatus: {
    color: '#aaa',
    fontSize: isSmallScreen ? 10 : 12,
    marginTop: isSmallScreen ? 2 : 2,
  },
  streamViewers: {
    color: '#00ff00',
    fontSize: isSmallScreen ? 10 : 12,
    marginTop: isSmallScreen ? 2 : 2,
  },
  endStreamButton: {
    backgroundColor: '#cc0000',
    paddingHorizontal: isSmallScreen ? 12 : 15,
    paddingVertical: isSmallScreen ? 6 : 8,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#ff0000',
    alignSelf: isSmallScreen ? 'flex-end' : 'auto',
  },
  endStreamButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: isSmallScreen ? 12 : 14,
  },
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
    padding: isSmallScreen ? 15 : 20,
  },
  disabledForm: {
    opacity: 0.5,
  },
  buttonDisabled: {
    backgroundColor: '#555',
    borderColor: '#444',
    opacity: 0.7,
  },
});

export default CreateLiveStream;