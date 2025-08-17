// services/EnhancedGlobalWebRTCService.js - COMPLETE FIXED VERSION
import {
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
  mediaDevices,
} from 'react-native-webrtc';
import io from 'socket.io-client';
import BASE_URL from '../config/config';
class EnhancedGlobalWebRTCService {
  constructor() {
    // ============ EXISTING CALL PROPERTIES ============
    this.socket = null;
    this.externalSocket = null; // Track external socket
    this.isUsingExternalSocket = false; // Flag to track socket source
    this.peerConnection = null;
    this.localStream = null;
    this.remoteStream = null;
    this.iceCandidatesQueue = [];
    this.isInitiator = false;
    this.callId = null;
    this.roomId = null;
    this.signalingRoom = null;
    this.authToken = null;
    this.serverUrl = BASE_URL;
    this.callStartTime = null;
    this.connectionQuality = 'unknown';
    this.statsInterval = null;
    this.processingOffer = false;
    this.currentOfferConnectionId = null;
    this.offerProcessed = new Set(); // Track processed offers
    // ============ NEW LIVE STREAMING PROPERTIES ============
    this.streamId = null;
    this.streamRole = null; // 'broadcaster' or 'viewer'
    this.streamState = 'idle'; // 'idle', 'creating', 'waiting', 'broadcasting', 'viewing', 'ended'
    this.connectedViewers = new Map(); // viewerId -> viewerData
    this.viewerConnections = new Map(); // viewerId -> peerConnection
    this.broadcasterConnection = null; // For viewers: connection to broadcaster
    this.streamViewerCount = 0;
    this.streamTitle = '';
    this.streamDescription = '';
    this.isBroadcasting = false;
    this.isViewing = false;
    // ============ UNIFIED CALLBACK SYSTEM ============
    this.callbacks = {
      // Existing call callbacks
      onLocalStream: null,
      onRemoteStream: null,
      onCallStateChange: null,
      onError: null,
      onIncomingCall: null,
      onConnectionQuality: null,
      // New live streaming callbacks
      onStreamStateChange: null,
      onViewerCount: null,
      onChatMessage: null,
      onReaction: null,
      onStreamEnded: null,
    };
    // ============ EXISTING STATE MANAGEMENT ============
    this.callState = 'idle';
    this.signalingState = 'closed';
    this.peerConnectionReady = false;
    this.localMediaReady = false;
    this.remoteDescriptionSet = false;
    this.localDescriptionSet = false;
    this.isProcessingOffer = false;
    this.isProcessingAnswer = false;
    // ============ EXISTING RTC CONFIGURATION ============
    this.rtcConfiguration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        {
          urls: 'turn:openrelay.metered.ca:80',
          username: 'openrelayproject',
          credential: 'openrelayproject'
        },
        {
          urls: 'turn:openrelay.metered.ca:443',
          username: 'openrelayproject',
          credential: 'openrelayproject'
        }
      ],
      iceCandidatePoolSize: 10,
      iceTransportPolicy: 'all'
    };
    this.mediaConstraints = {
      video: {
        width: { ideal: 1280, max: 1920 },
    height: { ideal: 720, max: 1080 },
    frameRate: { ideal: 30, max: 60 },
    facingMode: 'user'
      },
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    };
    this.isInitialized = false;
    this.initializationPromise = null;
  }
  // ============ NEW: EXTERNAL SOCKET MANAGEMENT ============
  setExternalSocket(socket) {
    console.log('🔌 Setting external socket for WebRTC service');
    console.log('🔌 External socket ID:', socket?.id);
    console.log('🔌 External socket connected:', socket?.connected);
    if (!socket) {
      console.error('❌ Cannot set null/undefined external socket');
      return false;
    }
    // Store reference to external socket
    this.externalSocket = socket;
    this.socket = socket;
    this.isUsingExternalSocket = true;
    console.log('✅ External socket set successfully');
    // Setup listeners immediately if socket is connected
    if (socket.connected) {
      this.setupSocketListeners();
      console.log('✅ Socket listeners setup on external socket');
    } else {
      console.warn('⚠️ External socket not connected, listeners will be setup when connected');
    }
    return true;
  }
  // ============ ENHANCED INITIALIZATION ============
  async initialize(authToken) {
    if (this.isInitialized) {
      console.log('✅ WebRTC service already initialized');
      return;
    }
    if (this.initializationPromise) {
      console.log('⏳ Waiting for existing initialization');
      return await this.initializationPromise;
    }
    this.initializationPromise = this._performInitialization(authToken);
    return await this.initializationPromise;
  }
  async _performInitialization(authToken) {
    try {
      console.log('🚀 Initializing Enhanced WebRTC service...');
      this.authToken = authToken;
      // ENHANCED: Only initialize socket if not using external one
      if (!this.isUsingExternalSocket) {
        console.log('🔌 No external socket provided, creating own socket connection');
        await this.initializeSocket(authToken);
      } else {
        console.log('🔌 Using external socket, skipping socket initialization');
        // Verify external socket is ready
        if (!this.socket || !this.socket.connected) {
          throw new Error('External socket not connected');
        }
      }
      await this.getWebRTCConfig();
      this.isInitialized = true;
      console.log('✅ Enhanced WebRTC service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize WebRTC service:', error);
      this.initializationPromise = null;
      throw error;
    }
  }
  // ============ CALLBACK MANAGEMENT (EXISTING) ============
  setGlobalCallbacks(callbacks) {
    this.callbacks = { ...this.callbacks, ...callbacks };
    console.log('📱 Global callbacks set');
  }
  setScreenCallbacks(callbacks) {
    this.callbacks = { ...this.callbacks, ...callbacks };
    console.log('📺 Screen callbacks set');
  }
  clearScreenCallbacks() {
    console.log('🧹 Screen callbacks cleared');
  }
  setCallbacks(callbacks) {
    this.callbacks = { ...this.callbacks, ...callbacks };
    console.log('📱 Callbacks updated');
  }
  triggerCallback(callbackName, ...args) {
    const callback = this.callbacks[callbackName];
    if (callback && typeof callback === 'function') {
      try {
        callback(...args);
        console.log(`✅ Callback executed: ${callbackName}`);
      } catch (error) {
        console.error(`❌ Callback error (${callbackName}):`, error);
      }
    }
  }
  // ============ ENHANCED SOCKET INITIALIZATION ============
  async initializeSocket(authToken) {
    // ENHANCED: Check if we should use external socket
    if (this.isUsingExternalSocket && this.externalSocket) {
      console.log('✅ Using external socket, skipping socket creation');
      this.socket = this.externalSocket;
      if (this.socket.connected) {
        this.setupSocketListeners();
        return this.socket.id;
      } else {
        throw new Error('External socket not connected');
      }
    }
    // Original socket creation logic for fallback
    if (this.socket && this.socket.connected) {
      console.log('✅ Socket already connected');
      return this.socket.id;
    }
    return new Promise((resolve, reject) => {
      try {
        this.socket = io(this.serverUrl, {
          transports: ['websocket', 'polling'],
          auth: { token: authToken.replace('Bearer ', '') },
          timeout: 15000,
          reconnection: true,
          reconnectionAttempts: 3,
          reconnectionDelay: 1000,
        });
        const timeout = setTimeout(() => {
          reject(new Error('Socket connection timeout'));
        }, 15000);
        this.socket.on('connect', () => {
          clearTimeout(timeout);
          console.log('✅ Socket connected:', this.socket.id);
          this.setupSocketListeners();
          resolve(this.socket.id);
        });
        this.socket.on('connect_error', (error) => {
          clearTimeout(timeout);
          console.error('❌ Socket connection failed:', error);
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }
  setupSocketListeners() {
    if (!this.socket) {
      console.warn('⚠️ No socket available for setting up listeners');
      return;
    }
    console.log('🎧 Setting up socket listeners on socket:', this.socket.id);
    // ========== EXISTING CALL LISTENERS ============
    this.socket.on('incoming_call', (data) => {
      console.log('📞 Incoming call received:', data);
      this.callId = data.callId;
      this.roomId = data.roomId;
      this.signalingRoom = data.signalingRoom;
      this.isInitiator = false;
      this.callState = 'ringing';
      this.incomingCallData = data;
      this.triggerCallback('onIncomingCall', data);
    });
    this.socket.on('call_accepted', (data) => {
      console.log('✅ Call accepted:', data);
      this.callState = 'connecting';
      this.triggerCallback('onCallStateChange', 'accepted', data);
      this.startSignaling();
    });
    this.socket.on('call_declined', (data) => {
      console.log('❌ Call declined:', data);
      this.callState = 'ended';
      this.cleanup();
      this.triggerCallback('onCallStateChange', 'declined', data);
    });
    this.socket.on('call_ended', (data) => {
      console.log('🔚 Call ended:', data);
      this.callState = 'ended';
      this.cleanup();
      this.triggerCallback('onCallStateChange', 'ended', data);
    });
    this.socket.on('broadcaster_ready_confirmed', (data) => {
      console.log('✅ Broadcaster ready confirmed:', data);
      if (this.streamRole === 'broadcaster') {
        this.streamState = 'broadcasting';
        this.isBroadcasting = true;
        this.triggerCallback('onStreamStateChange', 'broadcasting', data);
      }
    });
    this.socket.on('broadcaster_status_update', (data) => {
      console.log('📡 Broadcaster status update:', data);
      if (this.streamRole === 'viewer') {
        if (data.broadcasterReady) {
          console.log('✅ Broadcaster is ready, connection should establish soon');
          this.triggerCallback('onStreamStateChange', 'broadcaster_ready', data);
        } else {
          console.log('⚠️ Broadcaster disconnected, waiting...');
          this.triggerCallback('onStreamStateChange', 'broadcaster_disconnected', data);
        }
      }
    });
    this.socket.on('webrtc_signal', async (data) => {
      console.log(`🔄 WebRTC signal received: ${data.type}`);
      try {
        await this.handleSignaling(data);
      } catch (error) {
        console.error('❌ Failed to handle signaling:', error);
        this.triggerCallback('onError', {
          type: 'signaling_error',
          message: `Signaling failed: ${error.message}`
        });
      }
    });
    this.socket.on('signaling_room_joined', (data) => {
      console.log('📡 Signaling room joined:', data.signalingRoom);
      this.signalingState = 'ready';
      this.triggerCallback('onCallStateChange', 'signaling_ready', data);
      if (this.isInitiator && this.callState === 'connecting') {
        setTimeout(() => this.createOffer(), 1500);
      }
    });
    // ========== NEW LIVE STREAMING LISTENERS ============
    // Stream creation confirmation
    this.socket.on('stream_created', (data) => {
      console.log('🎥 Stream created:', data);
      this.streamId = data.streamId;
      this.streamRole = 'broadcaster';
      this.streamState = 'waiting';
      this.triggerCallback('onStreamStateChange', 'created', data);
    });
    // Broadcast started
    this.socket.on('stream_broadcast_started', (data) => {
      console.log('📡 Broadcast started:', data);
      this.streamState = 'broadcasting';
      this.isBroadcasting = true;
      this.triggerCallback('onStreamStateChange', 'broadcasting', data);
    });
    // Viewer joined stream
    this.socket.on('stream_joined_as_viewer', (data) => {
      console.log('👁 ✅ RECEIVED stream_joined_as_viewer event:', data);
      console.log('👁 Full event data:', JSON.stringify(data, null, 2));
      // Update state immediately
      this.streamId = data.streamId;
      this.streamRole = 'viewer';
      this.streamState = 'viewing';
      this.isViewing = true;
      // Use empty strings as fallback if title/description are not present
      this.streamTitle = data.title || '';
      this.streamDescription = data.description || '';
      console.log('👁 Updated viewer state successfully');
      console.log('👁 Now waiting for WebRTC offer from broadcaster...');
      // Trigger callback
      this.triggerCallback('onStreamStateChange', 'viewing', data);
      // Create broadcaster connection preemptively
      if (!this.broadcasterConnection) {
        console.log('👁 Creating broadcaster peer connection preemptively...');
        this.createBroadcasterPeerConnection().then(() => {
          console.log('👁 ✅ Broadcaster peer connection ready');
        }).catch(err => {
          console.error('👁 ❌ Failed to create broadcaster connection:', err);
        });
      }
    });
    // WebRTC offer from broadcaster to viewer - UPDATED METHOD
    this.socket.on('stream_webrtc_offer', async (data) => {
      console.log('📡 ✅ Received WebRTC offer from broadcaster:', data);
      console.log('📡 Current stream role:', this.streamRole);
      console.log('📡 Current stream ID:', this.streamId);
      if (this.streamRole === 'viewer') {
        console.log('📡 Processing offer as viewer...');
        await this.handleStreamOffer(data);
      } else {
        console.warn('⚠️ Received offer but not a viewer, role:', this.streamRole);
      }
    });
    // WebRTC answer from viewer to broadcaster
    this.socket.on('stream_webrtc_answer', async (data) => {
      console.log('📡 ✅ Received WebRTC answer from viewer:', data);
      console.log('📡 Current stream role:', this.streamRole);
      if (this.streamRole === 'broadcaster') {
        console.log('📡 Processing answer as broadcaster...');
        await this.handleStreamAnswer(data);
      } else {
        console.warn('⚠️ Received answer but not a broadcaster, role:', this.streamRole);
      }
    });
    // ICE candidates for streaming
    this.socket.on('stream_webrtc_ice_candidate', async (data) => {
      console.log('🧊 ✅ Received stream ICE candidate:', data);
      console.log('🧊 Current stream role:', this.streamRole);
      await this.handleStreamIceCandidate(data);
    });
    // Viewer count updates
    this.socket.on('stream_viewer_count_updated', (data) => {
      console.log('👥 Viewer count updated:', data);
      this.streamViewerCount = data.currentViewerCount;
      this.triggerCallback('onViewerCount', { count: data.currentViewerCount });
    });
    // New viewer joined (for broadcaster) - FIXED VERSION
   // Fixed stream_viewer_joined handler in EnhancedGlobalWebRTCService.js
// Replace the existing handler in setupSocketListeners() method with this:
this.socket.on('stream_viewer_joined', async (data) => {
  console.log('👥 Viewer joined stream (Broadcaster side):', data);
  const { streamId, viewer, currentViewerCount } = data;
  const viewerId = viewer?.userId;
  if (!viewerId) {
    console.error('❌ No viewerId found in stream_viewer_joined event');
    return;
  }
  console.log(`📍 stream_viewer_joined: streamId: ${streamId}, viewerId: ${viewerId}`);
  console.log(`📍 My streamId: ${this.streamId}, My role: ${this.streamRole}`);
  // CRITICAL: Only process if we're the broadcaster for THIS stream
  if (streamId !== this.streamId || this.streamRole !== 'broadcaster') {
    console.warn(`⚠️ Ignoring viewer join - not my stream or not broadcaster`);
    return;
  }
  console.log(`✅ Processing viewer join for: ${viewerId}`);
  try {
    // CRITICAL: Check if local stream exists
    if (!this.localStream || !this.localStream.active) {
      console.error('❌ No local stream available for broadcaster!');
      throw new Error('Broadcaster has no active stream');
    }
    // Log local stream status
    const videoTracks = this.localStream.getVideoTracks();
    const audioTracks = this.localStream.getAudioTracks();
    console.log(`📹 Broadcaster stream status:`, {
      hasVideo: videoTracks.length > 0,
      hasAudio: audioTracks.length > 0,
      videoEnabled: videoTracks[0]?.enabled,
      audioEnabled: audioTracks[0]?.enabled
    });
    // Check if we already have a connection for this viewer
    let peerConnection = this.viewerConnections.get(viewerId);
    if (peerConnection && peerConnection.connectionState !== 'closed') {
      console.log(`♻️ Reusing existing connection for viewer ${viewerId}`);
      console.log(`📊 Connection state: ${peerConnection.connectionState}`);
    } else {
      // Create new peer connection for this viewer
      console.log(`🆕 Creating new PeerConnection for viewer ${viewerId}...`);
      // CRITICAL: Await the connection creation properly
      try {
        peerConnection = await this.createViewerPeerConnection(viewerId);
        console.log(`✅ PeerConnection created for viewer ${viewerId}`);
      } catch (createError) {
        console.error(`❌ Failed to create peer connection for viewer ${viewerId}:`, createError);
        throw createError;
      }
      // CRITICAL: Verify it was stored properly
      const storedConnection = this.viewerConnections.get(viewerId);
      if (!storedConnection) {
        console.error(`❌ Connection not found in map after creation!`);
        console.log(`📊 Current map keys:`, Array.from(this.viewerConnections.keys()));
        throw new Error(`Failed to store connection for viewer ${viewerId}`);
      }
      console.log(`✅ PeerConnection verified in map for viewer ${viewerId}`);
      peerConnection = storedConnection; // Use the stored reference
    }
    // Small delay to ensure connection is stable
    await new Promise(resolve => setTimeout(resolve, 100));
    // Create and send offer
    if (peerConnection && peerConnection.connectionState !== 'closed') {
      console.log(`🎬 Creating offer for viewer ${viewerId}...`);
      try {
        await this.createOfferForViewer(viewerId);
        console.log(`✅ Offer created and sent to viewer ${viewerId}`);
      } catch (offerError) {
        console.error(`❌ Failed to create offer for viewer ${viewerId}:`, offerError);
        throw offerError;
      }
    } else {
      throw new Error(`Invalid peer connection state for viewer ${viewerId}`);
    }
    // Update viewer count
    this.streamViewerCount = currentViewerCount;
    this.triggerCallback('onViewerCount', { count: currentViewerCount });
    console.log(`✅ Successfully handled viewer ${viewerId} joining`);
    console.log(`📊 Total connections in map:`, this.viewerConnections.size);
    console.log(`📊 Map keys:`, Array.from(this.viewerConnections.keys()));
  } catch (err) {
    console.error(`❌ Error handling viewer ${viewerId} joining:`, err);
    console.error(`❌ Error stack:`, err.stack);
    // Clean up failed connection
    this.cleanupViewerConnection(viewerId);
    this.triggerCallback('onError', {
      type: 'viewer_join_failed',
      message: `Failed to establish connection with viewer: ${err.message}`,
      viewerId: viewerId,
      error: err
    });
  }
});
    // Viewer left (for broadcaster)
    this.socket.on('stream_viewer_left', (data) => {
      console.log('👁 Viewer left:', data);
      if (this.streamRole === 'broadcaster') {
        this.connectedViewers.delete(data.viewer.userId);
        this.cleanupViewerConnection(data.viewer.userId);
        this.streamViewerCount = data.currentViewerCount;
        this.triggerCallback('onViewerCount', { count: data.currentViewerCount });
      }
    });
    // Chat messages
    this.socket.on('stream_chat_message', (data) => {
      console.log('💬 Chat message:', data);
      this.triggerCallback('onChatMessage', data);
    });
    // Reactions
    this.socket.on('stream_reaction', (data) => {
      console.log('❤️ Reaction:', data);
      this.triggerCallback('onReaction', data);
    });
    // Stream ended
    this.socket.on('stream_ended_by_broadcaster', (data) => {
      console.log('🔚 Stream ended by broadcaster:', data);
      this.streamState = 'ended';
      this.cleanupStreaming();
      this.triggerCallback('onStreamStateChange', 'ended', data);
      this.triggerCallback('onStreamEnded', data);
    });
    this.socket.on('stream_ended', (data) => {
      console.log('🔚 Stream ended:', data);
      this.streamState = 'ended';
      this.cleanupStreaming();
      this.triggerCallback('onStreamStateChange', 'ended', data);
      this.triggerCallback('onStreamEnded', data);
    });
    // Stream errors
    this.socket.on('stream_error', (data) => {
      console.error('❌ Stream error:', data);
      this.triggerCallback('onError', {
        type: 'stream_error',
        message: data.message,
        code: data.code
      });
    });
    // Connection events
    this.socket.on('disconnect', () => {
      console.log('💔 Socket disconnected');
      this.triggerCallback('onError', new Error('Connection lost'));
    });
    this.socket.on('error', (error) => {
      console.error('❌ Socket error:', error);
      this.triggerCallback('onError', error);
    });
    console.log('✅ All socket listeners setup completed');
  }
  // ============ WEBRTC CONFIG (EXISTING) ============
  async getWebRTCConfig() {
    try {
      const response = await fetch(`${this.serverUrl}/api/v1/webrtc/config`, {
        headers: {
          'Authorization': this.authToken,
          'Content-Type': 'application/json'
        },
        timeout: 5000
      });
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data?.rtcConfiguration) {
          this.rtcConfiguration = {
            ...this.rtcConfiguration,
            ...result.data.rtcConfiguration
          };
          console.log('✅ RTC configuration updated');
        }
      }
    } catch (error) {
      console.warn('⚠ Using default RTC config:', error);
    }
  }
  // ============ MEDIA MANAGEMENT (EXISTING + ENHANCED) ============
  // In EnhancedGlobalWebRTCService.js - Enhanced getUserMedia with audio debugging
  async getUserMedia(constraints = null) {
    try {
      const mediaConstraints = constraints || this.mediaConstraints;
      console.log('🎥 Getting user media...', mediaConstraints);
      if (this.localStream) {
        this.localStream.getTracks().forEach(track => track.stop());
      }
      this.localStream = await mediaDevices.getUserMedia(mediaConstraints);
      this.localMediaReady = true;
      // ✅ ENHANCED AUDIO DEBUGGING (SAFER VERSION)
      const audioTracks = this.localStream.getAudioTracks();
      const videoTracks = this.localStream.getVideoTracks();
      console.log('✅ User media obtained:', {
        audio: audioTracks.length,
        video: videoTracks.length,
        streamId: this.localStream.id,
        streamActive: this.localStream.active
      });
      // Check each audio track safely
      audioTracks.forEach((track, index) => {
        console.log(`🎵 Audio track ${index}:`, {
          id: track.id,
          kind: track.kind,
          enabled: track.enabled,
          muted: track.muted,
          readyState: track.readyState,
          label: track.label || 'No label'
        });
        // Safely get settings if available
        try {
          if (typeof track.getSettings === 'function') {
            const settings = track.getSettings();
            console.log(`🎵 Audio track ${index} settings:`, settings);
          }
        } catch (settingsError) {
          console.log(`🎵 Audio track ${index} settings not available:`, settingsError.message);
        }
        // Listen for track events
        track.onended = () => console.log(`🎵 Audio track ${index} ended`);
        track.onmute = () => console.log(`🎵 Audio track ${index} muted`);
        track.onunmute = () => console.log(`🎵 Audio track ${index} unmuted`);
      });
      this.triggerCallback('onLocalStream', this.localStream);
      if (this.peerConnection && this.peerConnection.connectionState !== 'closed') {
        await this.updatePeerConnectionTracks();
      }
      return this.localStream;
    } catch (error) {
      console.error('❌ Failed to get user media:', error);
      this.localMediaReady = false;
      this.triggerCallback('onError', {
        type: 'media_error',
        message: `Camera/microphone access failed: ${error.message}`
      });
      throw error;
    }
  }
  async updatePeerConnectionTracks() {
    if (!this.peerConnection || !this.localStream) return;
    try {
      console.log('🔄 Updating peer connection tracks...');
      // For React Native WebRTC, we don't need to replace tracks manually
      // The addStream method handles this automatically
      if (typeof this.peerConnection.addStream === 'function') {
        console.log('🔄 Using React Native WebRTC - tracks updated automatically');
        return;
      }
      // For browser WebRTC, use getSenders safely
      if (typeof this.peerConnection.getSenders === 'function') {
        const senders = this.peerConnection.getSenders();
        console.log('🔄 Found existing senders:', senders.length);
        this.localStream.getTracks().forEach(track => {
          const sender = senders.find(s => s.track && s.track.kind === track.kind);
          if (sender && typeof sender.replaceTrack === 'function') {
            console.log(`🔄 Replacing ${track.kind} track`);
            sender.replaceTrack(track);
          } else {
            console.log(`➕ Adding new ${track.kind} track`);
            this.peerConnection.addTrack(track, this.localStream);
          }
        });
      } else {
        console.log('🔄 getSenders not available, skipping track update');
      }
      console.log('✅ Peer connection tracks updated');
    } catch (error) {
      console.error('❌ Failed to update peer connection tracks:', error);
      // Don't throw here, as this is non-critical
    }
  }
  async getLocalStream(forceRefresh = false) {
    console.log('📹 Getting local stream...', { forceRefresh, hasExisting: !!this.localStream });
    if (this.localStream && this.localStream.active && !forceRefresh) {
      console.log('📹 Returning existing active local stream');
      this.triggerCallback('onLocalStream', this.localStream);
      return this.localStream;
    }
    return await this.getUserMedia(this.mediaConstraints);
  }
  async setupMedia(callType = 'video') {
    console.log('🎥 Setting up media for call type:', callType);
    this.mediaConstraints = {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: callType === 'video' ? {
        facingMode: 'user',
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30, max: 30 }
      } : false
    };
    try {
      const stream = await this.getLocalStream(true);
      if (stream && callType === 'video') {
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
          videoTrack.enabled = true;
          console.log('📹 Video track enabled:', videoTrack.enabled);
        }
      }
      return stream;
    } catch (error) {
      console.error('❌ Failed to setup media:', error);
      throw error;
    }
  }
  // ============ NEW LIVE STREAMING METHODS ============
  // Create stream (broadcaster)
  async createStream(streamData) {
    try {
      console.log('🎥 Creating stream:', streamData);
      if (!this.socket || !this.socket.connected) {
        throw new Error('Socket not connected');
      }
      this.streamState = 'creating';
      this.streamRole = 'broadcaster';
      this.socket.emit('stream_create', {
        streamId: streamData.streamId,
        title: streamData.title,
        description: streamData.description,
        settings: streamData.settings
      });
      return true;
    } catch (error) {
      console.error('❌ Failed to create stream:', error);
      this.triggerCallback('onError', {
        type: 'stream_creation_error',
        message: error.message
      });
      return false;
    }
  }
  // Start broadcasting (broadcaster)
  // In EnhancedGlobalWebRTCService.js - Update startBroadcasting
// Fixed startBroadcasting method with proper initialization
// Replace the existing startBroadcasting method with this:
async startBroadcasting(streamId) {
  try {
    console.log('📡 Starting broadcast for stream:', streamId);
    if (!this.socket || !this.socket.connected) {
      throw new Error('Socket not connected');
    }
    // CRITICAL: Initialize collections
    console.log('🗑️ Initializing viewer collections...');
    this.viewerConnections = new Map();
    this.connectedViewers = new Map();
    console.log('✅ Viewer collections initialized');
    // Ensure we have a valid local stream with video
    if (!this.localStream || !this.localStream.active) {
      console.log('🎥 Local stream not ready, initializing...');
      await this.getUserMedia({
        video: {
          width: { min: 320, ideal: 640, max: 1280 },
          height: { min: 240, ideal: 480, max: 720 },
          frameRate: { min: 15, ideal: 24, max: 30 },
          facingMode: 'user'
        },
        audio: true
      });
    }
    // Verify video tracks exist
    const videoTracks = this.localStream.getVideoTracks();
    const audioTracks = this.localStream.getAudioTracks();
    console.log('📹 Local stream status:', {
      id: this.localStream.id,
      active: this.localStream.active,
      videoTracks: videoTracks.length,
      audioTracks: audioTracks.length
    });
    if (videoTracks.length === 0) {
      throw new Error('No video tracks available. Please enable camera.');
    }
    // Enable all tracks
    videoTracks.forEach((track, index) => {
      track.enabled = true;
      console.log(`✅ Video track ${index} enabled:`, {
        id: track.id,
        enabled: track.enabled,
        readyState: track.readyState
      });
    });
    audioTracks.forEach((track, index) => {
      track.enabled = true;
      console.log(`✅ Audio track ${index} enabled:`, {
        id: track.id,
        enabled: track.enabled,
        readyState: track.readyState
      });
    });
    // Set stream properties
    this.streamId = streamId;
    this.streamRole = 'broadcaster';
    this.streamState = 'starting';
    this.isBroadcasting = false; // Will be set to true when confirmed
    console.log('📡 WebRTC service state before broadcast:', {
      streamId: this.streamId,
      streamRole: this.streamRole,
      hasLocalStream: !!this.localStream,
      localStreamActive: this.localStream?.active,
      viewerConnectionsSize: this.viewerConnections.size
    });
    // Notify backend that broadcaster is ready
    this.socket.emit('broadcaster_ready', { 
      streamId,
      hasLocalStream: true,
      hasVideo: videoTracks.length > 0,
      hasAudio: audioTracks.length > 0,
      videoEnabled: videoTracks[0]?.enabled,
      audioEnabled: audioTracks[0]?.enabled
    });
    this.socket.emit('stream_start_broadcast', { streamId });
    // Start debug monitoring
    this.startDebugInterval();
    console.log('✅ Broadcast start initiated for stream:', streamId);
    return true;
  } catch (error) {
    console.error('❌ Failed to start broadcasting:', error);
    console.error('❌ Error stack:', error.stack);
    // Clean up on failure
    this.viewerConnections.clear();
    this.connectedViewers.clear();
    this.stopDebugInterval();
    this.triggerCallback('onError', {
      type: 'broadcast_start_error',
      message: error.message,
      error: error
    });
    return false;
  }
}
  // Join stream as viewer
  async joinStreamAsViewer(streamId) {
    try {
      console.log('👁 🎯 Joining stream as viewer:', streamId);
      console.log('👁 Socket connected:', this.socket?.connected);
      console.log('👁 Socket ID:', this.socket?.id);
      if (!this.socket || !this.socket.connected) {
        throw new Error('Socket not connected');
      }
      // Set initial state
      this.streamId = streamId;
      this.streamRole = 'viewer';
      this.streamState = 'joining';
      console.log('👁 Emitting stream_join_as_viewer event...');
      this.socket.emit('stream_join_as_viewer', { streamId });
      console.log('👁 ✅ Event emitted successfully');
      // Trigger initial state change
      this.triggerCallback('onStreamStateChange', 'joining', {
        streamId: streamId,
        message: 'Joining stream...'
      });
      return true;
    } catch (error) {
      console.error('❌ Failed to join stream:', error);
      this.triggerCallback('onError', {
        type: 'stream_join_error',
        message: error.message
      });
      return false;
    }
  }
  // Create offer for viewer (broadcaster) - FIXED VERSION
 // Fixed createOfferForViewer method with failsafe
// Replace the existing createOfferForViewer method with this:
async createOfferForViewer(viewerId) {
  try {
    console.log(`🎬 Starting createOfferForViewer for viewer: ${viewerId}`);
    console.log(`🎬 Current streamId: ${this.streamId}`);
    console.log(`🎬 Socket connected: ${this.socket ? this.socket.connected : 'No Socket'}`);
    console.log(`🎬 viewerConnections map size: ${this.viewerConnections.size}`);
    console.log(`🎬 viewerConnections map keys:`, Array.from(this.viewerConnections.keys()));
    let peerConnection = this.viewerConnections.get(viewerId);
    console.log(`🎬 Retrieved PeerConnection for ${viewerId}:`, peerConnection ? 'Exists' : 'NULL');
    // FAILSAFE: If connection doesn't exist, try to create it
    if (!peerConnection) {
      console.warn(`⚠️ No peer connection found for viewer ${viewerId}, attempting to create one...`);
      // Verify we have a local stream first
      if (!this.localStream || !this.localStream.active) {
        throw new Error('Cannot create offer without local stream');
      }
      try {
        peerConnection = await this.createViewerPeerConnection(viewerId);
        console.log(`✅ Failsafe: Created peer connection for viewer ${viewerId}`);
        // Verify it was stored
        peerConnection = this.viewerConnections.get(viewerId);
        if (!peerConnection) {
          throw new Error('Failed to store peer connection in failsafe');
        }
      } catch (createError) {
        console.error(`❌ Failsafe failed to create connection:`, createError);
        throw new Error(`Cannot create peer connection: ${createError.message}`);
      }
    }
    // Check connection state
    if (peerConnection.connectionState === 'closed') {
      console.warn(`⚠️ Peer connection is closed for viewer ${viewerId}, recreating...`);
      // Remove old connection and create new one
      this.cleanupViewerConnection(viewerId);
      peerConnection = await this.createViewerPeerConnection(viewerId);
      console.log(`✅ Recreated peer connection for viewer ${viewerId}`);
    }
    console.log(`🎬 PeerConnection state for ${viewerId}:`, {
      connectionState: peerConnection.connectionState,
      signalingState: peerConnection.signalingState,
      iceConnectionState: peerConnection.iceConnectionState
    });
    // Create the offer
    console.log(`🎬 Creating offer for viewer ${viewerId}...`);
    const offer = await peerConnection.createOffer({
      offerToReceiveAudio: false, // Viewer doesn't send audio
      offerToReceiveVideo: false, // Viewer doesn't send video
    });
    console.log(`🎬 Offer created successfully for viewer ${viewerId}`);
    console.log(`🎬 Offer SDP length: ${offer.sdp.length}`);
    // Set local description
    await peerConnection.setLocalDescription(offer);
    console.log(`🎬 Local Description set for viewer ${viewerId}`);
    // Send offer via socket
    if (this.socket && this.socket.connected && this.streamId) {
      console.log(`📡 Sending offer to backend for viewer ${viewerId} in stream ${this.streamId}`);
      this.socket.emit('stream_webrtc_offer', {
        streamId: this.streamId,
        viewerId: viewerId,
        offer: {
          type: offer.type,
          sdp: offer.sdp
        }
      });
      console.log(`📡 ✅ Offer sent successfully for viewer ${viewerId}`);
    } else {
      const socketError = !this.socket ? "No socket instance" : 
                         (!this.socket.connected ? "Socket disconnected" : "No streamId");
      throw new Error(`Cannot send offer: ${socketError}`);
    }
  } catch (error) {
    console.error(`❌ Error in createOfferForViewer for viewer ${viewerId}:`, error);
    console.error(`❌ Error stack:`, error.stack);
    // Try to clean up the failed connection
    if (viewerId) {
      this.cleanupViewerConnection(viewerId);
    }
    this.triggerCallback('onError', { 
      type: 'offer_failed', 
      message: `Offer creation failed for ${viewerId}: ${error.message}`,
      viewerId: viewerId,
      error: error
    });
  }
}
  // Handle stream offer (viewer) - FIXED VERSION
  async handleStreamOffer(data) {
    try {
      console.log('📥 🎥 Handling stream offer from broadcaster:', data);
      // Extract connection ID
      const connectionId = data.connectionId || `${this.streamId}_${this.socket.id}`;
      // Check if we've already processed this offer
      if (this.offerProcessed.has(connectionId)) {
        console.log('⚠️ Offer already processed, skipping:', connectionId);
        return;
      }
      // Check if we're already processing an offer
      if (this.processingOffer) {
        console.log('⚠️ Already processing an offer, skipping');
        return;
      }
      // Check if peer connection is already in stable state with a remote description
      if (this.broadcasterConnection && 
          this.broadcasterConnection.signalingState === 'stable' &&
          this.broadcasterConnection.remoteDescription) {
        console.log('⚠️ Connection already established, ignoring duplicate offer');
        return;
      }
      // Mark as processing
      this.processingOffer = true;
      this.currentOfferConnectionId = connectionId;
      try {
        // Create broadcaster connection if it doesn't exist
        if (!this.broadcasterConnection) {
          console.log('🔗 Creating new broadcaster peer connection...');
          this.broadcasterConnection = await this.createBroadcasterPeerConnection();
          console.log('✅ Broadcaster peer connection created');
        }
        // Set remote description (the offer)
        console.log('📝 Setting remote description (offer)...');
        const offerDescription = new RTCSessionDescription(data.offer);
        await this.broadcasterConnection.setRemoteDescription(offerDescription);
        console.log('✅ Remote description set successfully');
        // Create answer
        console.log('📝 Creating answer...');
        const answer = await this.broadcasterConnection.createAnswer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true
        });
        console.log('✅ Answer created successfully');
        // Set local description (the answer)
        console.log('📝 Setting local description (answer)...');
        await this.broadcasterConnection.setLocalDescription(answer);
        console.log('✅ Local description set successfully');
        // Send answer back to broadcaster
        console.log('📤 Sending answer to broadcaster...');
        const answerData = {
          streamId: this.streamId,
          answer: answer,
          connectionId: connectionId
        };
        this.socket.emit('stream_webrtc_answer', answerData);
        console.log('✅ Answer sent to broadcaster');
        // Mark this offer as processed
        this.offerProcessed.add(connectionId);
        // Update state
        this.triggerCallback('onStreamStateChange', 'connecting', {
          streamId: this.streamId,
          message: 'WebRTC connection establishing...'
        });
      } finally {
        // Reset processing flag
        this.processingOffer = false;
      }
    } catch (error) {
      console.error('❌ Failed to handle stream offer:', error);
      this.processingOffer = false;
      // Only trigger error if this is the first attempt
      if (!this.offerProcessed.has(this.currentOfferConnectionId)) {
        this.triggerCallback('onError', {
          type: 'webrtc_offer_error',
          message: `Failed to process stream offer: ${error.message}`
        });
      }
    }
  }
  // Handle stream answer (broadcaster)
  async handleStreamAnswer(data) {
    try {
      console.log('📥 Handling stream answer from viewer:', data.viewerId);
      // Use the specific viewer connection
      const peerConnection = this.viewerConnections.get(data.viewerId);
      if (peerConnection) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
        console.log('✅ Answer processed for viewer:', data.viewerId);
      } else {
        console.warn(`⚠️ No peer connection found for viewer ${data.viewerId} when handling answer.`);
      }
    } catch (error) {
      console.error('❌ Failed to handle stream answer:', error);
    }
  }
  // Handle ICE candidates for streaming - FIXED VERSION
  async handleStreamIceCandidate(data) {
    try {
      if (!data.candidate) return;
      if (this.streamRole === 'broadcaster' && data.from === 'viewer') {
        // Use the specific viewer connection
        const peerConnection = this.viewerConnections.get(data.viewerId);
        if (peerConnection) {
          await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
          console.log(`✅ ICE candidate added for viewer ${data.viewerId}`);
        } else {
          console.warn(`⚠️ No peer connection found for viewer ${data.viewerId} when handling ICE candidate.`);
        }
      } else if (this.streamRole === 'viewer' && data.from === 'broadcaster') {
        if (this.broadcasterConnection) {
          await this.broadcasterConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
          console.log('✅ ICE candidate added from broadcaster');
        }
      }
    } catch (error) {
      console.error('❌ Failed to handle stream ICE candidate:', error);
    }
  }
  // Create peer connection for viewer (broadcaster side) - FIXED VERSION
  // In EnhancedGlobalWebRTCService.js - Add this to ensure broadcaster has video
  // Create peer connection for broadcaster (viewer side) - FIXED VERSION
  async createViewerPeerConnection(viewerId) {
    try {
      console.log(`🔗 Creating peer connection for viewer ${viewerId}...`);
      const peerConnection = new RTCPeerConnection(this.rtcConfiguration);
      // CRITICAL FIX: Store the peer connection in the map immediately!
      this.viewerConnections.set(viewerId, peerConnection);
      console.log(`💾 Stored peer connection for viewer ${viewerId} in viewerConnections map`);
      // Setup ICE candidate handler for this specific viewer
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          console.log(`🧊 Sending ICE candidate to viewer ${viewerId}`);
          this.socket.emit('stream_webrtc_ice_candidate', {
            streamId: this.streamId,
            candidate: event.candidate,
            from: 'broadcaster',
            viewerId: viewerId
          });
        } else {
          console.log(`🧊 ICE gathering complete for viewer ${viewerId}`);
        }
      };
      // Connection state monitoring
      peerConnection.onconnectionstatechange = () => {
        const state = peerConnection.connectionState;
        console.log(`🔗 Viewer ${viewerId} connection state: ${state}`);
        if (state === 'failed' || state === 'closed') {
          console.log(`❌ Connection to viewer ${viewerId} ${state}`);
          this.cleanupViewerConnection(viewerId);
        } else if (state === 'connected') {
          console.log(`✅ Connected to viewer ${viewerId}`);
          // Store viewer data
          this.connectedViewers.set(viewerId, {
            userId: viewerId,
            connectionState: 'connected',
            connectedAt: new Date()
          });
        }
      };
      // ICE connection state monitoring  
      peerConnection.oniceconnectionstatechange = () => {
        const iceState = peerConnection.iceConnectionState;
        console.log(`🧊 Viewer ${viewerId} ICE state: ${iceState}`);
        if (iceState === 'failed') {
          console.log(`❌ ICE connection failed for viewer ${viewerId}`);
          // Try to restart ICE
          if (peerConnection.restartIce) {
            console.log(`🔄 Attempting ICE restart for viewer ${viewerId}`);
            peerConnection.restartIce();
          }
        }
      };
      // Add local stream to peer connection
      if (this.localStream && this.localStream.active) {
        const videoTracks = this.localStream.getVideoTracks();
        const audioTracks = this.localStream.getAudioTracks();
        console.log(`📹 Adding stream to viewer ${viewerId} connection:`, {
          video: videoTracks.length,
          audio: audioTracks.length,
          streamId: this.localStream.id
        });
        // Check for video tracks
        if (videoTracks.length === 0) {
          console.warn(`⚠️ No video tracks available for viewer ${viewerId}!`);
        }
        // Add stream using appropriate method
        if (typeof peerConnection.addStream === 'function') {
          peerConnection.addStream(this.localStream);
          console.log(`✅ Stream added via addStream for viewer ${viewerId}`);
        } else if (typeof peerConnection.addTrack === 'function') {
          this.localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, this.localStream);
            console.log(`✅ ${track.kind} track added via addTrack for viewer ${viewerId}`);
          });
        } else {
          throw new Error('No suitable method to add stream to peer connection');
        }
        // Apply bandwidth optimization for poor networks
        if (peerConnection.getSenders) {
          const senders = peerConnection.getSenders();
          senders.forEach(sender => {
            if (sender.track) {
              const params = sender.getParameters();
              if (!params.encodings) {
                params.encodings = [{}];
              }
              // Adaptive bitrate based on track type
              if (sender.track.kind === 'video') {
                params.encodings[0].maxBitrate = 500000; // 500kbps for video
                params.encodings[0].maxFramerate = 30;
              } else if (sender.track.kind === 'audio') {
                params.encodings[0].maxBitrate = 64000; // 64kbps for audio  
              }
              sender.setParameters(params).catch(err => {
                console.warn(`⚠️ Could not set parameters for ${sender.track.kind}:`, err);
              });
            }
          });
        }
      } else {
        console.error(`❌ No local stream available for viewer ${viewerId}!`);
        throw new Error('Broadcaster has no active stream');
      }
      console.log(`✅ Peer connection created and configured for viewer ${viewerId}`);
      console.log(`📊 Current viewerConnections:`, Array.from(this.viewerConnections.keys()));
      return peerConnection;
    } catch (error) {
      console.error(`❌ Failed to create viewer peer connection for ${viewerId}:`, error);
      // Clean up on failure
      this.cleanupViewerConnection(viewerId);
      throw error;
    }
  }

  // ADDED METHOD: Create peer connection for broadcaster (viewer side)
  async createBroadcasterPeerConnection() {
    try {
      console.log('🔗 Creating broadcaster peer connection (viewer side)...');

      const peerConnection = new RTCPeerConnection(this.rtcConfiguration);

      // Setup ICE candidate handler
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          console.log('🧊 Sending ICE candidate to broadcaster');
          this.socket.emit('stream_webrtc_ice_candidate', {
            streamId: this.streamId,
            candidate: event.candidate,
            from: 'viewer',
            connectionId: this.currentOfferConnectionId || `${this.streamId}_${this.socket.id}`
          });
        } else {
          console.log('🧊 ICE gathering complete for broadcaster connection');
        }
      };

      // Connection state monitoring
      peerConnection.onconnectionstatechange = () => {
        const state = peerConnection.connectionState;
        console.log('🔗 Broadcaster connection state:', state);

        if (state === 'connected') {
          console.log('✅ Connected to broadcaster');
          this.triggerCallback('onStreamStateChange', 'connected', {
            streamId: this.streamId,
            message: 'Connected to broadcaster'
          });
        } else if (state === 'failed' || state === 'closed') {
          console.log(`❌ Broadcaster connection ${state}`);
          this.triggerCallback('onError', {
            type: 'broadcaster_connection_failed',
            message: `Connection to broadcaster ${state}`
          });
        }
      };

      // ICE connection state monitoring
      peerConnection.oniceconnectionstatechange = () => {
        const iceState = peerConnection.iceConnectionState;
        console.log('🧊 Broadcaster ICE state:', iceState);

        if (iceState === 'connected' || iceState === 'completed') {
          console.log('✅ ICE connection established with broadcaster');
        } else if (iceState === 'failed') {
          console.log('❌ ICE connection failed, attempting restart...');
          if (peerConnection.restartIce) {
            peerConnection.restartIce();
          }
        }
      };

      // Handle incoming streams from broadcaster
      peerConnection.onaddstream = (event) => {
        console.log('📺 🎉 REMOTE STREAM RECEIVED from broadcaster via onaddstream!');
        if (event.stream) {
          this.remoteStream = event.stream;
          this.triggerCallback('onRemoteStream', event.stream);
          this.triggerCallback('onStreamStateChange', 'video_connected', {
            streamId: this.streamId,
            message: 'Video stream connected'
          });
        }
      };

      // Handle incoming tracks from broadcaster (fallback for newer browsers)
      peerConnection.ontrack = (event) => {
        console.log('📺 🎉 REMOTE TRACK RECEIVED from broadcaster via ontrack!');
        if (event.streams && event.streams[0] && !this.remoteStream) {
          this.remoteStream = event.streams[0];
          this.triggerCallback('onRemoteStream', event.streams[0]);
          this.triggerCallback('onStreamStateChange', 'video_connected', {
            streamId: this.streamId,
            message: 'Video stream connected'
          });
        }
      };

      console.log('✅ Broadcaster peer connection created successfully');
      return peerConnection;

    } catch (error) {
      console.error('❌ Failed to create broadcaster peer connection:', error);
      throw error;
    }
  }


  // Send chat message
  sendChatMessage(message) {
    try {
      if (!this.socket || !this.socket.connected || !this.streamId) {
        return false;
      }
      this.socket.emit('stream_chat_message', {
        streamId: this.streamId,
        message: message,
        messageType: 'text'
      });
      return true;
    } catch (error) {
      console.error('❌ Failed to send chat message:', error);
      return false;
    }
  }
  // Send reaction
  sendReaction(reaction) {
    try {
      if (!this.socket || !this.socket.connected || !this.streamId) {
        return false;
      }
      this.socket.emit('stream_reaction', {
        streamId: this.streamId,
        reaction: reaction,
        intensity: 1
      });
      return true;
    } catch (error) {
      console.error('❌ Failed to send reaction:', error);
      return false;
    }
  }
  // End stream
  async endStream() {
    try {
      if (!this.socket || !this.socket.connected || !this.streamId) {
        return false;
      }
      this.socket.emit('stream_end', { streamId: this.streamId });
      this.cleanupStreaming();
      return true;
    } catch (error) {
      console.error('❌ Failed to end stream:', error);
      return false;
    }
  }
  // Leave stream
  async leaveStream() {
    try {
      if (!this.socket || !this.socket.connected || !this.streamId) {
        return false;
      }
      this.socket.emit('stream_leave', { streamId: this.streamId });
      this.cleanupStreaming();
      return true;
    } catch (error) {
      console.error('❌ Failed to leave stream:', error);
      return false;
    }
  }
  // ============ EXISTING PEER CONNECTION MANAGEMENT ============
  async createPeerConnection() {
    if (this.peerConnection) {
      console.log('⚠ Closing existing peer connection');
      this.closePeerConnection();
    }
    try {
      console.log('🔗 Creating peer connection');
      this.peerConnection = new RTCPeerConnection(this.rtcConfiguration);
      this.setupPeerConnectionEventHandlers();
      if (this.localStream && this.localMediaReady) {
        console.log('➕ Adding local stream to peer connection');
        await this.addLocalStreamToPeerConnection();
      } else {
        console.warn('⚠ No local stream available when creating peer connection');
      }
      this.peerConnectionReady = true;
      console.log('✅ Peer connection created successfully');
      return this.peerConnection;
    } catch (error) {
      console.error('❌ Failed to create peer connection:', error);
      this.peerConnectionReady = false;
      throw error;
    }
  }
  async addLocalStreamToPeerConnection() {
    if (!this.peerConnection || !this.localStream) return;
    try {
      console.log('📡 Adding local stream to peer connection...');
      // ✅ VERIFY AUDIO TRACKS BEFORE ADDING
      const audioTracks = this.localStream.getAudioTracks();
      const videoTracks = this.localStream.getVideoTracks();
      console.log('📡 Tracks to add:', { audio: audioTracks.length, video: videoTracks.length });
      // Check which API is available
      if (typeof this.peerConnection.addStream === 'function') {
        // React Native WebRTC
        console.log('📡 Using addStream API (React Native)');
        this.peerConnection.addStream(this.localStream);
        console.log('✅ Local stream added via addStream');
        // REMOVED: Problematic getSenders verification that was causing crashes
        // The getSenders() method is not reliably available in React Native WebRTC
      } else if (typeof this.peerConnection.addTrack === 'function') {
        // Browser WebRTC
        console.log('📡 Using addTrack API (Browser)');
        this.localStream.getTracks().forEach(track => {
          console.log(`➕ Adding ${track.kind} track via addTrack:`, track.id);
          this.peerConnection.addTrack(track, this.localStream);
        });
        console.log('✅ Local tracks added via addTrack');
      } else {
        console.error('❌ No suitable method to add stream/tracks to peer connection');
        throw new Error('WebRTC API incompatibility');
      }
    } catch (error) {
      console.error('❌ Failed to add local stream to peer connection:', error);
      throw error;
    }
  }
  setupPeerConnectionEventHandlers() {
    if (!this.peerConnection) return;
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate && this.socket && this.signalingRoom) {
        console.log('🧊 Sending ICE candidate:', event.candidate.candidate.substring(0, 50) + '...');
        this.sendSignalingMessage('ice-candidate', {
          candidate: event.candidate
        });
      } else if (!event.candidate) {
        console.log('🧊 ICE gathering complete');
      }
    };
    this.peerConnection.onaddstream = (event) => {
      console.log('📺 🎉 REMOTE STREAM RECEIVED via onaddstream!');
      if (event.stream) {
        this.handleRemoteStream(event.stream);
      }
    };
    this.peerConnection.ontrack = (event) => {
      console.log('📺 🎉 REMOTE TRACK RECEIVED via ontrack!');
      if (event.streams && event.streams[0] && !this.remoteStream) {
        this.handleRemoteStream(event.streams[0]);
      }
    };
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState;
      console.log('🔗 Connection state changed to:', state);
      if (state === 'connected') {
        console.log('✅ Peer connection fully established!');
        if (!this.callStartTime) {
          this.callStartTime = new Date();
          this.startStatsMonitoring();
        }
      } else if (state === 'failed') {
        console.log('❌ Peer connection failed');
        this.triggerCallback('onError', {
          type: 'connection_failed',
          message: 'Call connection failed'
        });
      } else if (state === 'disconnected') {
        console.log('💔 Peer connection disconnected');
        this.triggerCallback('onCallStateChange', 'connection', { state: 'disconnected' });
      }
      this.triggerCallback('onCallStateChange', 'connection', { state });
    };
    this.peerConnection.oniceconnectionstatechange = () => {
      const state = this.peerConnection?.iceConnectionState;
      console.log('🧊 ICE connection state changed to:', state);
      this.triggerCallback('onCallStateChange', 'ice', { state });
      if (state === 'failed') {
        console.log('🔄 ICE connection failed, attempting restart in 2 seconds');
        setTimeout(() => {
          if (this.peerConnection && this.peerConnection.iceConnectionState === 'failed') {
            console.log('🔄 Attempting ICE restart');
            try {
              this.peerConnection.restartIce();
            } catch (error) {
              console.error('❌ Failed to restart ICE:', error);
            }
          }
        }, 2000);
      } else if (state === 'connected' || state === 'completed') {
        console.log('✅ ICE connection established!');
      }
    };
    this.peerConnection.onsignalingstatechange = () => {
      const state = this.peerConnection?.signalingState;
      console.log('📡 Signaling state changed to:', state);
    };
  }
  handleRemoteStream(stream) {
    console.log('📺 Processing remote stream:', stream.id);
    this.remoteStream = stream;
    this.callState = 'connected';
    console.log('✅ Remote stream set:', {
      streamId: this.remoteStream.id,
      tracks: this.remoteStream.getTracks().length
    });
    if (!this.callStartTime) {
      this.callStartTime = new Date();
      this.startStatsMonitoring();
    }
    this.triggerCallback('onRemoteStream', this.remoteStream);
    this.triggerCallback('onCallStateChange', 'connection', { state: 'connected' });
  }
  closePeerConnection() {
    if (this.peerConnection) {
      try {
        console.log('🧹 Closing peer connection');
        this.peerConnection.onicecandidate = null;
        this.peerConnection.onaddstream = null;
        this.peerConnection.ontrack = null;
        this.peerConnection.onconnectionstatechange = null;
        this.peerConnection.oniceconnectionstatechange = null;
        this.peerConnection.onsignalingstatechange = null;
        this.peerConnection.close();
      } catch (error) {
        console.warn('⚠ Error closing peer connection:', error);
      }
      this.peerConnection = null;
      this.peerConnectionReady = false;
    }
  }
  // ============ EXISTING CALL MANAGEMENT ============
  async initiateCall(calleeId, callType = 'video') {
    try {
      console.log(`📞 Initiating ${callType} call to:`, calleeId);
      this.callState = 'initiating';
      await this.setupMedia(callType);
      console.log('📡 Making API call to initiate call');
      const response = await fetch(`${this.serverUrl}/api/v1/webrtc/call/initiate`, {
        method: 'POST',
        headers: {
          'Authorization': this.authToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ calleeId, callType })
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to initiate call');
      }
      this.callId = result.data.callId;
      this.roomId = result.data.roomId;
      this.signalingRoom = result.data.signalingRoom;
      this.isInitiator = true;
      this.callState = 'ringing';
      console.log('✅ Call initiated successfully, waiting for acceptance');
      return result.data;
    } catch (error) {
      console.error('❌ Failed to initiate call:', error);
      this.callState = 'ended';
      this.cleanup();
      throw error;
    }
  }
  async acceptCall() {
    try {
      console.log('✅ Accepting call:', this.callId);
      if (!this.callId) {
        throw new Error('No call to accept');
      }
      this.callState = 'answering';
      this.triggerCallback('onCallStateChange', 'answering', { callId: this.callId });
      const callType = this.incomingCallData?.callType || 'audio';
      console.log('🎥 Setting up media for call acceptance');
      await this.setupMedia(callType);
      console.log('🔗 Creating peer connection for call acceptance');
      await this.createPeerConnection();
      console.log('📡 Joining signaling room for call acceptance');
      if (this.socket && this.signalingRoom) {
        this.signalingState = 'joining';
        this.socket.emit('joinSignalingRoom', {
          signalingRoom: this.signalingRoom,
          callId: this.callId
        });
        await this.waitForSignalingReady();
      }
      console.log('📡 Making API call to accept call');
      const response = await fetch(`${this.serverUrl}/api/v1/webrtc/call/${this.callId}/accept`, {
        method: 'POST',
        headers: {
          'Authorization': this.authToken,
          'Content-Type': 'application/json'
        }
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to accept call');
      }
      this.callState = 'connecting';
      this.currentCallData = { ...this.incomingCallData, ...result.data };
      this.triggerCallback('onCallStateChange', 'connecting', result.data);
      console.log('✅ Call accepted successfully, waiting for offer from initiator');
      return result.data;
    } catch (error) {
      console.error('❌ Failed to accept call:', error);
      this.callState = 'ended';
      this.cleanup();
      throw error;
    }
  }
  async waitForSignalingReady() {
    return new Promise((resolve) => {
      const checkSignalingReady = () => {
        if (this.signalingState === 'ready') {
          resolve();
        } else {
          setTimeout(checkSignalingReady, 100);
        }
      };
      setTimeout(() => {
        console.warn('⚠ Signaling room ready timeout');
        resolve();
      }, 5000);
      checkSignalingReady();
    });
  }
  async declineCall() {
    try {
      console.log('❌ Declining call:', this.callId);
      if (this.callId) {
        await fetch(`${this.serverUrl}/api/v1/webrtc/call/${this.callId}/decline`, {
          method: 'POST',
          headers: {
            'Authorization': this.authToken,
            'Content-Type': 'application/json'
          }
        });
      }
      this.callState = 'ended';
      this.cleanup();
      return { success: true };
    } catch (error) {
      console.error('❌ Failed to decline call:', error);
      this.cleanup();
      throw error;
    }
  }
  async endCall(duration = null) {
    try {
      console.log('🔚 Ending call:', this.callId);
      const callDuration = duration || (this.callStartTime ?
        Math.floor((new Date() - this.callStartTime) / 1000) : 0);
      if (this.callId) {
        await fetch(`${this.serverUrl}/api/v1/webrtc/call/${this.callId}/end`, {
          method: 'POST',
          headers: {
            'Authorization': this.authToken,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ duration: callDuration })
        });
      }
      this.callState = 'ended';
      this.cleanup();
      return { success: true, duration: callDuration };
    } catch (error) {
      console.error('❌ Failed to end call:', error);
      this.cleanup();
      throw error;
    }
  }
  // ============ EXISTING SIGNALING ============
  async startSignaling() {
    try {
      console.log('🚀 Starting signaling process');
      if (!this.peerConnectionReady) {
        await this.createPeerConnection();
      }
      if (this.socket && this.signalingRoom) {
        console.log('📡 Joining signaling room:', this.signalingRoom);
        this.signalingState = 'joining';
        this.socket.emit('joinSignalingRoom', {
          signalingRoom: this.signalingRoom,
          callId: this.callId
        });
      }
    } catch (error) {
      console.error('❌ Failed to start signaling:', error);
      throw error;
    }
  }
  async sendSignalingMessage(type, data) {
    if (!this.socket || !this.callId || !this.signalingRoom) {
      console.warn('⚠ Cannot send signaling: missing requirements');
      return;
    }
    const signalData = {
      callId: this.callId,
      signalingRoom: this.signalingRoom,
      type,
      data
    };
    console.log(`📤 Sending ${type} signal`);
    this.socket.emit('webrtc_signal', signalData);
  }
  async handleSignaling(signalData) {
    if (!signalData || !signalData.type) {
      console.warn('⚠ Invalid signaling data:', signalData);
      return;
    }
    const { type, data: payload, from } = signalData;
    if (from === this.socket?.id) {
      console.log('🔄 Ignoring own signal');
      return;
    }
    if (!this.peerConnection || !this.peerConnectionReady) {
      console.warn('⚠ No peer connection ready for signaling');
      return;
    }
    try {
      switch (type) {
        case 'offer':
          await this.handleOffer(payload);
          break;
        case 'answer':
          await this.handleAnswer(payload);
          break;
        case 'ice-candidate':
          await this.handleIceCandidate(payload);
          break;
        default:
          console.warn('⚠ Unknown signaling type:', type);
      }
    } catch (error) {
      console.error(`❌ Failed to handle ${type}:`, error);
      throw error;
    }
  }
  async createOffer() {
    if (!this.peerConnection || !this.peerConnectionReady || !this.localMediaReady) {
      console.warn('⚠ Cannot create offer - peer connection or media not ready');
      return;
    }
    if (this.peerConnection.signalingState !== 'stable') {
      console.warn('⚠ Cannot create offer - signaling state is:', this.peerConnection.signalingState);
      return;
    }
    try {
      console.log('📝 Creating offer...');
      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      console.log('📝 Setting local description (offer)');
      await this.peerConnection.setLocalDescription(offer);
      this.localDescriptionSet = true;
      console.log('📤 Sending offer');
      await this.sendSignalingMessage('offer', offer);
      console.log('✅ Offer created and sent successfully');
    } catch (error) {
      console.error('❌ Failed to create offer:', error);
      throw error;
    }
  }
  async handleOffer(offerData) {
    if (this.isProcessingOffer) {
      console.log('⚠ Already processing offer, skipping');
      return;
    }
    try {
      this.isProcessingOffer = true;
      console.log('📥 Handling offer...');
      if (!this.peerConnection || !this.peerConnectionReady) {
        throw new Error('Peer connection not ready for offer');
      }
      const currentState = this.peerConnection.signalingState;
      console.log('📡 Current signaling state:', currentState);
      if (currentState !== 'stable') {
        console.warn('⚠ Unexpected signaling state for offer:', currentState);
      }
      console.log('📝 Setting remote description (offer)');
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offerData));
      this.remoteDescriptionSet = true;
      console.log('📝 Creating answer...');
      const answer = await this.peerConnection.createAnswer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      console.log('📝 Setting local description (answer)');
      await this.peerConnection.setLocalDescription(answer);
      this.localDescriptionSet = true;
      console.log('📤 Sending answer');
      await this.sendSignalingMessage('answer', answer);
      setTimeout(() => {
        this.processQueuedIceCandidates();
      }, 100);
      console.log('✅ Offer handled and answer sent successfully');
    } catch (error) {
      console.error('❌ Failed to handle offer:', error);
      throw error;
    } finally {
      this.isProcessingOffer = false;
    }
  }
  async handleAnswer(answerData) {
    if (this.isProcessingAnswer) {
      console.log('⚠ Already processing answer, skipping');
      return;
    }
    try {
      this.isProcessingAnswer = true;
      console.log('📥 Handling answer...');
      if (!this.peerConnection || !this.peerConnectionReady) {
        throw new Error('Peer connection not ready for answer');
      }
      const currentState = this.peerConnection.signalingState;
      console.log('📡 Current signaling state:', currentState);
      if (currentState !== 'have-local-offer') {
        console.warn('⚠ Unexpected signaling state for answer:', currentState);
        if (currentState === 'stable') {
          console.log('⚠ Already stable, might have processed answer already');
          return;
        }
      }
      console.log('📝 Setting remote description (answer)');
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answerData));
      this.remoteDescriptionSet = true;
      setTimeout(() => {
        this.processQueuedIceCandidates();
      }, 100);
      console.log('✅ Answer handled successfully');
    } catch (error) {
      console.error('❌ Failed to handle answer:', error);
      throw error;
    } finally {
      this.isProcessingAnswer = false;
    }
  }
  async handleIceCandidate(candidateData) {
    try {
      if (!candidateData || !candidateData.candidate) {
        console.log('🧊 Received empty ICE candidate');
        return;
      }
      if (!this.peerConnection) {
        console.log('🧊 Queueing ICE candidate (no peer connection)');
        this.iceCandidatesQueue.push(candidateData);
        return;
      }
      if (!this.remoteDescriptionSet) {
        console.log('🧊 Queueing ICE candidate (no remote description)');
        this.iceCandidatesQueue.push(candidateData);
        return;
      }
      console.log('🧊 Adding ICE candidate immediately');
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidateData.candidate));
      console.log('✅ ICE candidate added successfully');
    } catch (error) {
      console.warn('⚠ Failed to handle ICE candidate:', error);
    }
  }
  async processQueuedIceCandidates() {
    if (this.iceCandidatesQueue.length === 0) {
      console.log('🧊 No queued ICE candidates to process');
      return;
    }
    console.log(`🧊 Processing ${this.iceCandidatesQueue.length} queued ICE candidates`);
    const candidates = [...this.iceCandidatesQueue];
    this.iceCandidatesQueue = [];
    for (const candidateData of candidates) {
      try {
        if (candidateData.candidate && this.peerConnection && this.remoteDescriptionSet) {
          await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidateData.candidate));
          console.log('✅ Queued ICE candidate added');
        }
      } catch (error) {
        console.warn('⚠ Failed to add queued ICE candidate:', error);
      }
    }
    console.log('✅ Finished processing queued ICE candidates');
  }
  // ============ MEDIA CONTROLS ============
  async toggleCamera() {
    try {
      console.log('🎥 Toggling camera...');
      if (!this.localStream) {
        console.warn('⚠ No local stream available');
        return false;
      }
      const videoTrack = this.localStream.getVideoTracks()[0];
      if (!videoTrack) {
        console.warn('⚠ No video track available');
        return false;
      }
      const newState = !videoTrack.enabled;
      videoTrack.enabled = newState;
      console.log('🎥 Video track enabled:', newState);
      if (this.mediaConstraints.video !== false) {
        this.mediaConstraints.video = newState ? {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30, max: 30 }
        } : false;
      }
      this.triggerCallback('onLocalStream', this.localStream);
      return newState;
    } catch (error) {
      console.error('❌ Failed to toggle camera:', error);
      return false;
    }
  }
  async toggleMicrophone() {
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        console.log('🎤 Microphone toggled:', audioTrack.enabled);
        return audioTrack.enabled;
      }
    }
    console.warn('⚠ No audio track to toggle');
    return false;
  }
  async switchCamera() {
    try {
      if (this.localStream) {
        const videoTrack = this.localStream.getVideoTracks()[0];
        if (videoTrack && videoTrack._switchCamera) {
          await videoTrack._switchCamera();
          console.log('🔄 Camera switched');
          return true;
        }
      }
      console.warn('⚠ Camera switching not supported');
      return false;
    } catch (error) {
      console.error('❌ Failed to switch camera:', error);
      return false;
    }
  }
  // ============ STATS MONITORING ============
  startStatsMonitoring() {
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
    }
    this.statsInterval = setInterval(async () => {
      try {
        const stats = await this.getConnectionStats();
        if (stats) {
          this.analyzeConnectionQuality(stats);
        }
      } catch (error) {
        console.error('❌ Error monitoring stats:', error);
      }
    }, 5000);
    console.log('📊 Started stats monitoring');
  }
  async getConnectionStats() {
    if (!this.peerConnection) return null;
    try {
      const stats = await this.peerConnection.getStats();
      const report = {
        packetsReceived: 0,
        packetsSent: 0,
        packetsLost: 0,
        bytesReceived: 0,
        bytesSent: 0,
        timestamp: Date.now()
      };
      stats.forEach(stat => {
        if (stat.type === 'inbound-rtp') {
          report.packetsReceived += stat.packetsReceived || 0;
          report.packetsLost += stat.packetsLost || 0;
          report.bytesReceived += stat.bytesReceived || 0;
        } else if (stat.type === 'outbound-rtp') {
          report.packetsSent += stat.packetsSent || 0;
          report.bytesSent += stat.bytesSent || 0;
        }
      });
      return report;
    } catch (error) {
      console.error('❌ Error getting connection stats:', error);
      return null;
    }
  }
  analyzeConnectionQuality(stats) {
    try {
      let quality = 'good';
      if (stats.packetsLost > 0 && stats.packetsReceived > 0) {
        const lossRate = stats.packetsLost / (stats.packetsReceived + stats.packetsLost);
        if (lossRate > 0.05) quality = 'poor';
        else if (lossRate > 0.02) quality = 'fair';
      }
      if (quality !== this.connectionQuality) {
        this.connectionQuality = quality;
        console.log('📊 Connection quality:', quality);
        this.triggerCallback('onConnectionQuality', { quality, stats });
      }
    } catch (error) {
      console.error('❌ Error analyzing connection quality:', error);
    }
  }
  // ============ CLEANUP METHODS ============
  cleanupViewerConnection(viewerId) {
    const peerConnection = this.viewerConnections.get(viewerId);
    if (peerConnection) {
      try {
        peerConnection.close();
      } catch (error) {
        console.warn('⚠ Error closing viewer connection:', error);
      }
      this.viewerConnections.delete(viewerId);
    }
    this.connectedViewers.delete(viewerId);
  }
  cleanupStreaming() {
    console.log('🧹 Cleaning up streaming...');
    // Clear offer tracking
    this.offerProcessed.clear();
    this.processingOffer = false;
    this.currentOfferConnectionId = null;
    // Close all viewer connections
    this.viewerConnections.forEach((connection, viewerId) => {
      try {
        connection.close();
      } catch (error) {
        console.warn('⚠ Error closing viewer connection:', error);
      }
    });
    this.viewerConnections.clear();
    this.connectedViewers.clear();
    // Close broadcaster connection
    if (this.broadcasterConnection) {
      try {
        this.broadcasterConnection.close();
      } catch (error) {
        console.warn('⚠ Error closing broadcaster connection:', error);
      }
      this.broadcasterConnection = null;
    }
    // Reset streaming state
    this.streamId = null;
    this.streamRole = null;
    this.streamState = 'idle';
    this.streamViewerCount = 0;
    this.streamTitle = '';
    this.streamDescription = '';
    this.isBroadcasting = false;
    this.isViewing = false;
    this.remoteStream = null;
    console.log('✅ Streaming cleanup completed');
  }
  cleanup() {
    console.log('🧹 Starting full WebRTC cleanup');
    // Cleanup streaming
    this.cleanupStreaming();
    // Stop stats monitoring
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }
    // Leave signaling room
    if (this.socket && this.signalingRoom) {
      try {
        this.socket.emit('leaveSignalingRoom', {
          signalingRoom: this.signalingRoom,
          callId: this.callId
        });
      } catch (error) {
        console.warn('⚠ Failed to leave signaling room:', error);
      }
    }
    // Stop local stream
    if (this.localStream) {
      try {
        this.localStream.getTracks().forEach(track => {
          track.stop();
          console.log('⏹ Stopped track:', track.kind);
        });
      } catch (error) {
        console.warn('⚠ Failed to stop local stream:', error);
      }
      this.localStream = null;
    }
    // Stop remote stream
    if (this.remoteStream) {
      try {
        this.remoteStream.getTracks().forEach(track => track.stop());
      } catch (error) {
        console.warn('⚠ Failed to stop remote stream:', error);
      }
      this.remoteStream = null;
    }
    // Close peer connection
    this.closePeerConnection();
    // Reset all state
    this.callId = null;
    this.roomId = null;
    this.signalingRoom = null;
    this.isInitiator = false;
    this.iceCandidatesQueue = [];
    this.callStartTime = null;
    this.connectionQuality = 'unknown';
    this.callState = 'idle';
    this.signalingState = 'closed';
    this.peerConnectionReady = false;
    this.localMediaReady = false;
    this.remoteDescriptionSet = false;
    this.localDescriptionSet = false;
    this.isProcessingOffer = false;
    this.isProcessingAnswer = false;
    console.log('✅ Full cleanup completed');
  }
  // ============ UTILITY METHODS ============
  disconnect() {
    console.log('💔 Disconnecting WebRTC service');
    this.cleanup();
    // ENHANCED: Only disconnect socket if we created it (not external)
    if (this.socket && !this.isUsingExternalSocket) {
      console.log('🔌 Disconnecting own socket');
      this.socket.disconnect();
      this.socket = null;
    } else if (this.isUsingExternalSocket) {
      console.log('🔌 Keeping external socket connected, just clearing reference');
      this.socket = null;
      this.externalSocket = null;
      this.isUsingExternalSocket = false;
    }
    this.isInitialized = false;
    this.initializationPromise = null;
  }
  isReady() {
    return this.isInitialized && this.socket && this.socket.connected;
  }
  // ENHANCED: Debug socket connection
  getSocketStatus() {
    return {
      socketExists: !!this.socket,
      socketConnected: this.socket?.connected || false,
      socketId: this.socket?.id || null,
      isInitialized: this.isInitialized,
      authToken: !!this.authToken,
      serverUrl: this.serverUrl,
      isUsingExternalSocket: this.isUsingExternalSocket,
      externalSocketExists: !!this.externalSocket,
      externalSocketConnected: this.externalSocket?.connected || false,
    };
  }
  // ENHANCED: Debug streaming state
  getStreamingDebugInfo() {
    return {
      streamId: this.streamId,
      streamRole: this.streamRole,
      streamState: this.streamState,
      isBroadcasting: this.isBroadcasting,
      isViewing: this.isViewing,
      hasRemoteStream: !!this.remoteStream,
      remoteStreamActive: this.remoteStream?.active || false,
      hasBroadcasterConnection: !!this.broadcasterConnection,
      broadcasterConnectionState: this.broadcasterConnection?.connectionState || 'none',
      broadcasterIceState: this.broadcasterConnection?.iceConnectionState || 'none',
      socketStatus: this.getSocketStatus()
    };
  }
  // ENHANCED: Test socket connection
  testSocketConnection() {
    console.log('🧪 Testing socket connection...');
    if (!this.socket) {
      console.error('❌ No socket instance');
      return false;
    }
    if (!this.socket.connected) {
      console.error('❌ Socket not connected');
      return false;
    }
    console.log('✅ Socket appears to be connected');
    console.log('🔗 Socket ID:', this.socket.id);
    console.log('🔗 Socket transport:', this.socket.io.engine.transport.name);
    console.log('🔗 Using external socket:', this.isUsingExternalSocket);
    // Test emit
    try {
      this.socket.emit('test_connection', { timestamp: Date.now() });
      console.log('✅ Test emit successful');
      return true;
    } catch (error) {
      console.error('❌ Test emit failed:', error);
      return false;
    }
  }
  getCallState() {
    const videoTrack = this.localStream?.getVideoTracks()[0];
    const audioTrack = this.localStream?.getAudioTracks()[0];
    return {
      isInCall: ['connecting', 'connected'].includes(this.callState),
      callId: this.callId,
      isInitiator: this.isInitiator,
      hasLocalStream: this.localMediaReady && !!this.localStream,
      hasRemoteStream: !!this.remoteStream,
      localStreamActive: this.localStream ? this.localStream.active : false,
      remoteStreamActive: this.remoteStream ? this.remoteStream.active : false,
      peerConnectionState: this.peerConnection?.connectionState || 'new',
      iceConnectionState: this.peerConnection?.iceConnectionState || 'new',
      callDuration: this.getCallDuration(),
      connectionQuality: this.connectionQuality,
      callState: this.callState,
      signalingState: this.signalingState,
      peerConnectionReady: this.peerConnectionReady,
      localMediaReady: this.localMediaReady,
      videoEnabled: videoTrack ? videoTrack.enabled : false,
      audioEnabled: audioTrack ? audioTrack.enabled : true,
      videoTrackState: videoTrack ? {
        enabled: videoTrack.enabled,
        muted: videoTrack.muted,
        readyState: videoTrack.readyState
      } : null
    };
  }
  getStreamState() {
    return {
      streamId: this.streamId,
      streamRole: this.streamRole,
      streamState: this.streamState,
      isBroadcasting: this.isBroadcasting,
      isViewing: this.isViewing,
      streamViewerCount: this.streamViewerCount,
      hasLocalStream: this.localMediaReady && !!this.localStream,
      hasRemoteStream: !!this.remoteStream,
      connectedViewers: this.connectedViewers.size,
    };
  }
  async ensureLocalStream() {
    if (!this.localStream || !this.localStream.active) {
      console.log('🔄 Local stream not available, getting new one...');
      return await this.getLocalStream(true);
    }
    return this.localStream;
  }
  getCallDuration() {
    if (this.callStartTime) {
      return Math.floor((new Date() - this.callStartTime) / 1000);
    }
    return 0;
  }
}
// Create a single global instance
const enhancedGlobalWebRTCService = new EnhancedGlobalWebRTCService();
export default enhancedGlobalWebRTCService;