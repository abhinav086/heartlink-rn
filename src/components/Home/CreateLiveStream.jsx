// src/components/CreateLiveStream.jsx - UPDATED: Using Enhanced Global WebRTC Service
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
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import BASE_URL from '../../config/config';
import { RTCView } from 'react-native-webrtc';
import enhancedGlobalWebRTCService from '../../services/EnhancedGlobalWebRTCService';

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
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState('PUBLIC');
  const [category, setCategory] = useState('OTHER');
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
  const [streamStatus, setStreamStatus] = useState('IDLE'); // IDLE, CREATING, WAITING, STARTING, LIVE, ENDING
  const [apiError, setApiError] = useState('');
  const [currentStreams, setCurrentStreams] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [checkingStreams, setCheckingStreams] = useState(true);
  const [endingAll, setEndingAll] = useState(false);

  const visibilities = ['PUBLIC', 'FOLLOWERS_ONLY', 'PRIVATE'];
  const categories = ['GAMING', 'MUSIC', 'TALK_SHOW', 'EDUCATION', 'SPORTS', 'OTHER'];
  const displayError = apiError || webRTCError;
  const hasActiveStreams = useMemo(() => currentStreams.length > 0, [currentStreams]);

  // ============ REPLACE YOUR ENTIRE SERVICE INITIALIZATION useEffect ============
  useEffect(() => {
    const initializeService = async () => {
      try {
        console.log('🚀 Initializing Enhanced WebRTC Service for Broadcasting');
        console.log('🔌 Socket status:', {
          socketExists: !!socket,
          isConnected: isConnected,
          socketId: socket?.id
        });

        // CRITICAL: Check socket connection first
        if (!socket || !isConnected) {
          console.warn('⚠️ Socket not ready, waiting...');
          setWebRTCError('Connecting to server...');
          return;
        }

        // 🔥 CRITICAL FIX 1: SET EXTERNAL SOCKET
        console.log('🔌 Setting external socket for WebRTC service');
        enhancedGlobalWebRTCService.setExternalSocket(socket);

        // Initialize the service
        await enhancedGlobalWebRTCService.initialize(token);

        // Set up callbacks for broadcasting
        enhancedGlobalWebRTCService.setCallbacks({
          onLocalStream: handleLocalStream,
          onStreamStateChange: handleStreamStateChange,
          onError: handleWebRTCError,
          onViewerCount: handleViewerCount,
        });

        console.log('✅ Enhanced WebRTC Service initialized for broadcasting');
        setWebRTCError(''); // Clear any connection errors

      } catch (error) {
        console.error('❌ Failed to initialize service:', error);
        setWebRTCError(`Service initialization failed: ${error.message}`);
      }
    };

    if (token && user && socket && isConnected) {
      initializeService();
    }
  }, [token, user, socket, isConnected]); // Added socket dependencies

  // ============ WEBRTC CALLBACKS ============
  const handleLocalStream = (stream) => {
    console.log('📹 Local stream received:', stream?.id);
    setLocalStream(stream);
    setWebRTCError('');
  };

  const handleStreamStateChange = (state, data) => {
    console.log('🔄 Stream state changed:', state, data);
    switch (state) {
      case 'created':
        setStreamStatus('WAITING');
        break;
      case 'broadcasting':
        setStreamStatus('LIVE');
        setIsWebRTCConnected(true);
        break;
      case 'ended':
        setStreamStatus('IDLE');
        setIsWebRTCConnected(false);
        setStreamId(null);
        setLocalStream(null);
        setConnectedViewers(new Set());
        break;
    }
  };

  const handleWebRTCError = (errorData) => {
    console.error('❌ WebRTC error:', errorData);
    setWebRTCError(errorData.message || 'WebRTC error occurred');
  };

  const handleViewerCount = (data) => {
    console.log('👥 Viewer count update:', data);
    // Update connected viewers count - this is just for display
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

  // ============ ADD THIS NEW useEffect FOR VIEWER JOIN HANDLING ============
  // Add this AFTER your existing useEffect blocks:
  useEffect(() => {
    // 🔥 CRITICAL FIX 2: BROADCASTER VIEWER JOIN LISTENER
    if (socket && isConnected && streamStatus === 'LIVE' && streamId) {
      console.log('🎥 🎧 Setting up BROADCASTER viewer join listener...');
      console.log('🎥 Current stream ID:', streamId);
      console.log('🎥 Current stream status:', streamStatus);

      const handleViewerJoin = (data) => {
        console.log('🎥 🎉 🔥 BROADCASTER: stream_viewer_joined event received!', data);

        const { streamId: eventStreamId, viewer, currentViewerCount } = data;
        const viewerId = viewer?.userId;

        console.log('🎥 📊 Event details:', {
          eventStreamId,
          viewerId,
          myStreamId: streamId,
          viewerName: viewer?.fullName,
          currentViewerCount
        });

        // Verify this is for our stream
        if (eventStreamId === streamId) {
          console.log('✅ Event is for our stream - processing...');

          // Update UI viewer count
          setConnectedViewers(new Set(Array.from({ length: currentViewerCount || 0 }, (_, i) => `viewer_${i}`)));

          // Log WebRTC service state
          console.log('🎥 📊 WebRTC Service State:', {
            streamRole: enhancedGlobalWebRTCService.streamRole,
            streamState: enhancedGlobalWebRTCService.streamState,
            isBroadcasting: enhancedGlobalWebRTCService.isBroadcasting,
            viewerConnectionsSize: enhancedGlobalWebRTCService.viewerConnections.size
          });

          // Verify offer creation after a delay
          setTimeout(() => {
            const connectionsAfter = enhancedGlobalWebRTCService.viewerConnections.size;
            console.log('🎥 🔍 Viewer connections after 2 seconds:', connectionsAfter);

            if (connectionsAfter === 0 && viewerId) {
              console.error('🎥 ❌ NO VIEWER CONNECTIONS CREATED! WebRTC service issue.');
              console.error('🎥 🐛 Debug info:', {
                hasSocket: !!enhancedGlobalWebRTCService.socket,
                socketConnected: enhancedGlobalWebRTCService.socket?.connected,
                streamRole: enhancedGlobalWebRTCService.streamRole,
                streamState: enhancedGlobalWebRTCService.streamState,
                streamId: enhancedGlobalWebRTCService.streamId
              });
              setWebRTCError('Failed to establish viewer connection - WebRTC service issue');
            } else {
              console.log('✅ Viewer connection established successfully');
              setWebRTCError(''); // Clear any errors
            }
          }, 2000);

        } else {
          console.log('⚠️ Event not for our stream - ignoring');
        }
      };

      // Add the listener
      console.log('🎥 🎧 Adding stream_viewer_joined listener to socket');
      socket.on('stream_viewer_joined', handleViewerJoin);

      // Cleanup function
      return () => {
        console.log('🎥 🧹 Removing stream_viewer_joined listener');
        socket.off('stream_viewer_joined', handleViewerJoin);
      };
    } else {
      console.log('🎥 ⚠️ Not setting up viewer listener:', {
        hasSocket: !!socket,
        isConnected,
        streamStatus,
        streamId
      });
    }
  }, [socket, isConnected, streamStatus, streamId]); // Watch these dependencies

  useEffect(() => {
    fetchCurrentStreams("component_mount_or_token_change");
  }, [token]);

  // ============ STREAM MANAGEMENT ============
  const fetchCurrentStreams = useCallback(async (source = "unknown") => {
    console.log(`[fetchCurrentStreams] Called from: ${source}`);
    setCheckingStreams(true);
    if (!token) {
      console.log("[fetchCurrentStreams] No token available.");
      setCurrentStreams([]);
      setCheckingStreams(false);
      return;
    }
    try {
      console.log("[fetchCurrentStreams] Fetching active streams...");
      const response = await fetch(`${BASE_URL}/api/v1/live/active`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      console.log(`[fetchCurrentStreams] API Response Status: ${response.status}`);
      if (!response.ok) {
        if (response.status === 404) {
          console.log("[fetchCurrentStreams] API returned 404 - No active streams.");
          setCurrentStreams([]);
          setCheckingStreams(false);
          return;
        } else {
          const errorText = await response.text();
          console.error(`[fetchCurrentStreams] HTTP Error ${response.status}: ${errorText}`);
          throw new Error(`Failed to fetch streams: ${response.status} ${response.statusText}`);
        }
      }
      const data = await response.json();
      console.log("[fetchCurrentStreams] Raw API Response Data:", JSON.stringify(data, null, 2));
      if (data.success !== false) {
        let streamsArray = [];
        if (data.streams && Array.isArray(data.streams)) {
          streamsArray = data.streams;
        } else if (data.data && Array.isArray(data.data.streams)) {
          streamsArray = data.data.streams;
        } else if (Array.isArray(data)) {
          streamsArray = data;
        }
        console.log(`[fetchCurrentStreams] Successfully parsed ${streamsArray.length} stream(s).`);
        setCurrentStreams(streamsArray);
        setApiError('');
      } else {
        console.error("[fetchCurrentStreams] API returned success=false:", data.message);
        throw new Error(data.message || 'API reported failure while fetching streams.');
      }
    } catch (err) {
      console.error('[fetchCurrentStreams] Error occurred:', err);
      setApiError(`Failed to fetch live streams: ${err.message}`);
      setCurrentStreams([]);
    } finally {
      console.log("[fetchCurrentStreams] Completed.");
      setCheckingStreams(false);
    }
  }, [token]);

  const onRefresh = useCallback(() => {
    console.log("[onRefresh] Pull-to-refresh initiated.");
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
      console.log(`[endAllStreams] Attempting to end ${currentStreams.length} stream(s) via REST API.`);
      const endPromises = currentStreams.map(async (stream) => {
        const id = stream.streamId;
        if (!id) {
          console.warn('[endAllStreams] Skipping stream, no ID found:', stream);
          return { streamId: 'unknown', success: false, error: 'No ID' };
        }
        try {
          console.log(`[endAllStreams] Calling REST API to end streamId: ${id}`);
          const response = await fetch(`${BASE_URL}/api/v1/live/${id}/end`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });
          if (!response.ok) {
            const errorText = await response.text();
            console.error(`[endAllStreams] REST API Error for ${id}: ${response.status} - ${errorText}`);
            return { streamId: id, success: false, error: `${response.status} - ${errorText}` };
          }
          const data = await response.json();
          console.log(`[endAllStreams] REST API Success for ${id}:`, data);
          return { streamId: id, success: true, data };
        } catch (apiErr) {
          console.error(`[endAllStreams] Network/Other Error for ${id}:`, apiErr);
          return { streamId: id, success: false, error: apiErr.message };
        }
      });
      const results = await Promise.allSettled(endPromises);
      console.log('[endAllStreams] End stream API calls completed. Results:', results);
      // Cleanup local state if current stream was ended
      if (streamId) {
        enhancedGlobalWebRTCService.cleanupStreaming();
        setStreamStatus('IDLE');
        setStreamId(null);
        setLocalStream(null);
        setTitle('');
        setDescription('');
      }
      Alert.alert('Streams Ended', 'All your active streams have been ended. You can now create a new one.');
      console.log("[endAllStreams] Waiting before refreshing stream list...");
      await new Promise(resolve => setTimeout(resolve, 2000));
      console.log("[endAllStreams] Refreshing stream list...");
      await fetchCurrentStreams("endAllStreams");
    } catch (err) {
      console.error('[endAllStreams] Unexpected Error:', err);
      setApiError('Failed to end one or more streams.');
      Alert.alert('Error', 'Failed to end one or more streams.');
    } finally {
      setEndingAll(false);
    }
  };

  // Create stream using backend API
  const createStream = async () => {
    console.log("[createStream] Attempting to create a new stream.");
    if (hasActiveStreams) {
      console.log("[createStream] Prevented creation because hasActiveStreams is true.");
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
    if (!title.trim()) {
      Alert.alert('Validation Error', 'Please enter a stream title.');
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
        title: title.trim(),
        description: description.trim(),
        visibility: visibility,
        category: category,
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
      console.log('[createStream] Sending create stream request:', JSON.stringify(requestBody, null, 2));
      const response = await fetch(`${BASE_URL}/api/v1/live/create`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
      console.log(`[createStream] Create Stream Response Status: ${response.status}`);
      const data = await response.json();
      console.log('[createStream] Parsed Create Stream Response Data:', data);
      if (response.ok && data.success !== false) {
        const newStreamId = data.data?.streamId || data.streamId;
        if (!newStreamId) {
          const errorMsg = 'Stream ID not found in successful response';
          console.error(`[createStream] ${errorMsg}`, 'Full response:', JSON.stringify(data, null, 2));
          throw new Error(errorMsg);
        }
        console.log('[createStream] Stream created successfully:', newStreamId);
        setStreamId(newStreamId);
        setStreamStatus('WAITING');
        Alert.alert('Success', 'Stream created! Initializing camera...');
        // Initialize local stream for broadcasting
        await initializeCamera();
      } else {
        let errorMessage = 'Failed to create stream.';
        if (data && data.message) {
          errorMessage = data.message;
        } else if (!response.ok) {
          errorMessage = `HTTP Error ${response.status}: ${response.statusText}`;
        }
        console.error('[createStream] Stream creation failed:', errorMessage, data);
        throw new Error(errorMessage);
      }
    } catch (err) {
      console.error('[createStream] Error (catch block):', err);
      const displayMessage = err.message || 'An unexpected error occurred.';
      setApiError(displayMessage);
      setStreamStatus('ERROR');
      Alert.alert('Error', displayMessage);
    }
  };

  // Initialize camera
  const initializeCamera = async () => {
    try {
      console.log('[initializeCamera] Initializing local stream...');
      const stream = await enhancedGlobalWebRTCService.getLocalStream(true);
      if (stream) {
        setLocalStream(stream);
        setStreamStatus('WAITING');
        console.log('[initializeCamera] Camera initialized successfully');
        return true;
      } else {
        throw new Error('Failed to get local stream');
      }
    } catch (error) {
      console.error('[initializeCamera] Failed to initialize camera:', error);
      setStreamStatus('ERROR');
      setWebRTCError('Failed to initialize camera. Please check permissions.');
      Alert.alert('Camera Error', 'Failed to initialize camera. Please check permissions and try again.');
      return false;
    }
  };

  // ============ UPDATE startStream FUNCTION ============
  // Replace your existing startStream function with this enhanced version:
  const startStream = async () => {
    if (streamStatus !== 'WAITING' || !streamId || !token) {
      Alert.alert('Error', 'Stream is not ready to start.');
      return;
    }
    if (!localStream) {
      Alert.alert('Error', 'Camera is not ready. Please wait or restart the stream.');
      return;
    }
    // 🔥 VERIFY SOCKET CONNECTION BEFORE STARTING
    if (!socket || !isConnected) {
      Alert.alert('Error', 'Socket connection not ready. Please check your internet.');
      return;
    }
    setStreamStatus('STARTING');
    try {
      console.log(`[startStream] Starting stream via REST API: ${streamId}`);
      // Call REST API to start stream
      const response = await fetch(`${BASE_URL}/api/v1/live/${streamId}/start`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) {
        const errorData = await response.text();
        console.error(`[startStream] Start stream API error: ${response.status} - ${errorData}`);
        throw new Error(`Failed to start stream: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      console.log('[startStream] Start stream API success:', data);
      // 🔥 ENSURE WEBRTC SERVICE IS PROPERLY CONFIGURED
      console.log('🎥 Verifying WebRTC service before creating stream...');
      const serviceReady = enhancedGlobalWebRTCService.isReady();
      const socketStatus = enhancedGlobalWebRTCService.getSocketStatus();
      console.log('🎥 Service ready:', serviceReady);
      console.log('🎥 Socket status:', socketStatus);
      if (!serviceReady || !socketStatus.socketConnected) {
        throw new Error('WebRTC service not properly initialized');
      }
      // Create stream via WebRTC service
      console.log('🎥 Creating WebRTC stream...');
      const createSuccess = await enhancedGlobalWebRTCService.createStream({
        streamId: streamId,
        title: title,
        description: description,
        settings: settings
      });
      if (!createSuccess) {
        throw new Error('Failed to create WebRTC stream');
      }
      console.log('🎥 Starting WebRTC broadcasting...');
      // Start broadcasting
      const broadcastSuccess = await enhancedGlobalWebRTCService.startBroadcasting(streamId);
      if (broadcastSuccess) {
        setStreamStatus('LIVE');
        Alert.alert('Broadcasting', 'Your stream is now live and ready for viewers!');
        console.log(`[startStream] Successfully started broadcasting: ${streamId}`);
        // 🔥 VERIFY FINAL STATE
        setTimeout(() => {
          const finalState = enhancedGlobalWebRTCService.getStreamState();
          console.log('🎥 📊 Final broadcaster state:', finalState);
          if (finalState.streamRole !== 'broadcaster' || finalState.streamState !== 'broadcasting') {
            console.error('🎥 ❌ Broadcaster not in correct state:', finalState);
            setWebRTCError('Broadcaster not in correct state');
          }
        }, 1000);
      } else {
        console.log(`[startStream] Failed to start broadcasting: ${streamId}`);
        setStreamStatus('WAITING');
        Alert.alert('Error', 'Failed to start broadcasting. Check your camera and internet connection.');
      }
    } catch (err) {
      console.error('[startStream] Error:', err);
      setStreamStatus('WAITING');
      setWebRTCError(err.message);
      Alert.alert('Error', `Failed to start stream: ${err.message}`);
    }
  };

  // End a single stream using REST API
  const endStream = async (id) => {
    console.log(`[endStream] Attempting to end stream with ID: ${id}`);
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
      console.log(`[endStream] Calling REST API to end streamId: ${id}`);
      const response = await fetch(`${BASE_URL}/api/v1/live/${id}/end`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      console.log(`[endStream] REST API Response Status: ${response.status}`);
      if (!response.ok) {
        const errorData = await response.text();
        console.error(`[endStream] REST API Error ${response.status}: ${errorData}`);
        throw new Error(`Failed to end stream via API: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      console.log('[endStream] REST API Success Response:', data);
      // Cleanup local state if it was our stream
      if (id === streamId) {
        enhancedGlobalWebRTCService.endStream();
        setStreamStatus('IDLE');
        setStreamId(null);
        setLocalStream(null);
        setTitle('');
        setDescription('');
        Alert.alert('Stream Ended', 'Your live stream has finished.');
        console.log(`[endStream] Local stream state cleared for streamId: ${id}`);
      } else {
        Alert.alert('Stream Ended', 'The selected live stream has finished.');
      }
      console.log("[endStream] Waiting before refreshing stream list...");
      await new Promise(resolve => setTimeout(resolve, 1500));
      console.log("[endStream] Refreshing stream list...");
      await fetchCurrentStreams("endStream");
    } catch (err) {
      console.error('[endStream] Error:', err);
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
    console.log('[retryCamera] Retrying camera initialization...');
    setStreamStatus('WAITING');
    setApiError('');
    setWebRTCError('');
    const success = await initializeCamera();
    if (success) {
      console.log('[retryCamera] Camera initialized successfully');
      Alert.alert('Success', 'Camera is now ready!');
    } else {
      setStreamStatus('ERROR');
      console.error('[retryCamera] Failed to initialize camera');
      Alert.alert('Camera Error', 'Still unable to access camera. Please check permissions.');
    }
  };

  const handleStartBroadcast = () => {
    if (streamStatus === 'WAITING') {
      startStream(); // Use the fixed startStream function
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

  // ============ ADD VERIFICATION FUNCTION ============
  // Add this function in your component:
  const verifyBroadcasterStatus = () => {
    console.log('🎥 ===== BROADCASTER VERIFICATION =====');

    const socketStatus = enhancedGlobalWebRTCService.getSocketStatus();
    // const streamDebugInfo = enhancedGlobalWebRTCService.getStreamingDebugInfo(); // Assuming this exists or is removed

    const checks = {
      serviceReady: enhancedGlobalWebRTCService.isReady(),
      hasSocket: !!enhancedGlobalWebRTCService.socket,
      socketConnected: enhancedGlobalWebRTCService.socket?.connected,
      isUsingExternalSocket: socketStatus.isUsingExternalSocket,
      hasLocalStream: !!enhancedGlobalWebRTCService.localStream,
      localStreamActive: enhancedGlobalWebRTCService.localStream?.active,
      streamRole: enhancedGlobalWebRTCService.streamRole,
      streamState: enhancedGlobalWebRTCService.streamState,
      isBroadcasting: enhancedGlobalWebRTCService.isBroadcasting,
      streamId: enhancedGlobalWebRTCService.streamId,
      viewerConnectionsSize: enhancedGlobalWebRTCService.viewerConnections.size,
      socketEventListeners: socket ? Object.keys(socket._callbacks || {}).length : 0
    };

    console.log('🎥 ✅ Service Ready:', checks.serviceReady);
    console.log('🎥 ✅ Has Socket:', checks.hasSocket);
    console.log('🎥 ✅ Socket Connected:', checks.socketConnected);
    console.log('🎥 🔥 Using External Socket:', checks.isUsingExternalSocket);
    console.log('🎥 ✅ Has Local Stream:', checks.hasLocalStream);
    console.log('🎥 ✅ Local Stream Active:', checks.localStreamActive);
    console.log('🎥 ✅ Stream Role:', checks.streamRole);
    console.log('🎥 ✅ Stream State:', checks.streamState);
    console.log('🎥 ✅ Is Broadcasting:', checks.isBroadcasting);
    console.log('🎥 ✅ Stream ID:', checks.streamId);
    console.log('🎥 📊 Viewer Connections:', checks.viewerConnectionsSize);
    console.log('🎥 🎧 Socket Event Listeners:', checks.socketEventListeners);

    // Test socket listener (Optional, commented out to avoid unintended side effects)
    // if (socket) {
    //   console.log('🧪 Testing socket listener...');
    //   const testData = {
    //     streamId: checks.streamId,
    //     viewer: { userId: 'test_123', fullName: 'Test User' },
    //     currentViewerCount: 1
    //   };
    //   console.log('🧪 Emitting test stream_viewer_joined event...');
    //   socket.emit('test_event', testData); // Don't use real event for test
    // }

    const isReady = checks.serviceReady &&
      checks.hasSocket &&
      checks.socketConnected &&
      checks.isUsingExternalSocket &&
      checks.hasLocalStream &&
      checks.localStreamActive &&
      checks.streamRole === 'broadcaster' &&
      checks.streamState === 'broadcasting' &&
      checks.isBroadcasting &&
      checks.streamId;

    const status = isReady ? '✅ READY FOR VIEWERS' : '❌ NOT READY';
    console.log('🎥 🎯 OVERALL STATUS:', status);

    Alert.alert('Broadcaster Status', status + '\n\nCheck console for details');

    return isReady;
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
      <Text style={styles.header}>Create Live Stream</Text>
      {displayError ? <Text style={styles.errorText}>{displayError}</Text> : null}

      {/* Debug Info */}
      {__DEV__ && (
        <View style={styles.debugContainer}>
          <Text style={styles.debugText}>🔍 Debug Info:</Text>
          <Text style={styles.debugText}>StreamId: {streamId || 'null'}</Text>
          <Text style={styles.debugText}>Status: {streamStatus}</Text>
          <Text style={styles.debugText}>Service Ready: {enhancedGlobalWebRTCService.isReady()}</Text>
          <Text style={styles.debugText}>Socket Connected: {socket?.connected ? '✅' : '❌'}</Text>
          <Text style={styles.debugText}>Using External Socket: {enhancedGlobalWebRTCService.getSocketStatus().isUsingExternalSocket ? '✅' : '❌'}</Text>
          <Text style={styles.debugText}>Viewer Connections: {enhancedGlobalWebRTCService.viewerConnections.size}</Text>

          {/* ADD THIS VERIFICATION BUTTON */}
          <TouchableOpacity
            style={styles.debugButton}
            onPress={verifyBroadcasterStatus}
          >
            <Text style={styles.debugButtonText}>🔍 Verify Broadcaster Status</Text>
          </TouchableOpacity>
        </View>
      )}

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
                  <Text style={styles.streamStatus}>Status: {stream.status}</Text>
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
          <Text style={styles.label}>Title *</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Enter stream title"
            editable={!hasActiveStreams && streamStatus === 'IDLE'}
          />
        </View>
        <View style={styles.formGroup}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Enter stream description"
            multiline
            editable={!hasActiveStreams && streamStatus === 'IDLE'}
          />
        </View>
        <View style={styles.formGroup}>
          <Text style={styles.label}>Visibility</Text>
          <View style={styles.pickerContainer}>
            {visibilities.map((vis) => (
              <TouchableOpacity
                key={vis}
                style={[
                  styles.pickerButton,
                  visibility === vis && styles.pickerButtonSelected,
                ]}
                onPress={() => setVisibility(vis)}
                disabled={hasActiveStreams || streamStatus !== 'IDLE'}
              >
                <Text style={styles.pickerButtonText}>{vis.replace('_', ' ')}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        <View style={styles.formGroup}>
          <Text style={styles.label}>Category</Text>
          <View style={styles.pickerContainer}>
            {categories.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.pickerButton,
                  category === cat && styles.pickerButtonSelected,
                ]}
                onPress={() => setCategory(cat)}
                disabled={hasActiveStreams || streamStatus !== 'IDLE'}
              >
                <Text style={styles.pickerButtonText}>{cat.replace('_', ' ')}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        {streamId && (
          <View style={styles.statusContainer}>
            <Text style={styles.statusText}>Stream ID: {streamId}</Text>
            <Text style={styles.statusText}>Status: {streamStatus}</Text>
            <Text style={styles.statusText}>
              Camera: {localStream ? '✅ Ready' : '❌ Not Ready'}
            </Text>
            <Text style={styles.statusText}>
              Socket: {isConnected ? '✅ Connected' : '❌ Disconnected'}
            </Text>
            {isWebRTCConnected && <Text style={styles.statusText}>WebRTC: Broadcasting</Text>}
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
        <View style={styles.previewContainer}>
          {localStream ? (
            <>
              <RTCView streamURL={localStream.toURL()} style={styles.rtcView} objectFit="cover" />
              <Text style={styles.previewText}>Your Camera Preview</Text>
            </>
          ) : (
            <Text style={styles.previewText}>
              {streamStatus === 'WAITING' ? 'Initializing Camera...' :
                streamStatus === 'ERROR' ? 'Camera Error - Tap "Retry Camera"' :
                  'Preview will appear here'}
            </Text>
          )}
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#000',
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#fff',
  },
  errorText: {
    color: '#ff4444',
    marginBottom: 10,
    textAlign: 'center',
    backgroundColor: 'rgba(255, 68, 68, 0.1)',
    padding: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#ff4444',
  },
  debugContainer: {
    backgroundColor: '#111',
    padding: 10,
    marginBottom: 15,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#333',
  },
  debugText: {
    color: '#888',
    fontSize: 12,
    marginBottom: 2,
  },
  // ============ ADD THESE STYLES ============
  debugButton: {
    backgroundColor: '#333',
    padding: 8,
    marginTop: 5,
    borderRadius: 4,
    alignItems: 'center',
  },
  debugButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  formGroup: {
    marginBottom: 15,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 5,
    color: '#fff',
  },
  input: {
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 5,
    padding: 10,
    fontSize: 16,
    backgroundColor: '#111',
    color: '#fff',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  pickerContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  pickerButton: {
    padding: 10,
    margin: 5,
    backgroundColor: '#222',
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#333',
  },
  pickerButtonSelected: {
    backgroundColor: '#cc0000',
    borderColor: '#ff0000',
  },
  pickerButtonText: {
    color: '#fff',
  },
  statusContainer: {
    padding: 10,
    backgroundColor: '#111',
    borderRadius: 5,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#333',
  },
  statusText: {
    fontSize: 14,
    color: '#fff',
    marginBottom: 2,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 20,
    flexWrap: 'wrap',
  },
  button: {
    flex: 1,
    margin: 5,
    padding: 15,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 120,
    borderWidth: 1,
    borderColor: '#333',
    flexDirection: 'row',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
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
    margin: 5,
    padding: 15,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    color: '#fff',
    marginTop: 10,
  },
  previewContainer: {
    height: 250,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 5,
    overflow: 'hidden',
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#333',
  },
  rtcView: {
    width: '100%',
    height: '100%',
  },
  previewText: {
    position: 'absolute',
    color: '#fff',
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 5,
    borderRadius: 3,
  },
  currentStreamsContainer: {
    marginTop: 10,
    paddingTop: 10,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  refreshText: {
    color: '#ff0000',
    fontWeight: '600',
  },
  noStreamsText: {
    color: '#888',
    textAlign: 'center',
    padding: 20,
  },
  streamItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#111',
    borderRadius: 5,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#333',
  },
  streamInfo: {
    flex: 1,
    marginRight: 10,
  },
  streamTitle: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  streamId: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },
  streamStatus: {
    color: '#aaa',
    fontSize: 12,
    marginTop: 2,
  },
  streamViewers: {
    color: '#00ff00',
    fontSize: 12,
    marginTop: 2,
  },
  endStreamButton: {
    backgroundColor: '#cc0000',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#ff0000',
  },
  endStreamButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
    padding: 20,
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
