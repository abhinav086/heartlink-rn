 // services/EnhancedGlobalWebRTCService.js - FIXED: React Native WebRTC Compatibility
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
    this.socket = null;
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
    
    // Unified callback system
    this.callbacks = {
      onLocalStream: null,
      onRemoteStream: null,
      onCallStateChange: null,
      onError: null,
      onIncomingCall: null,
      onConnectionQuality: null,
    };
    
    // Enhanced state management
    this.callState = 'idle';
    this.signalingState = 'closed';
    this.peerConnectionReady = false;
    this.localMediaReady = false;
    this.remoteDescriptionSet = false;
    this.localDescriptionSet = false;
    this.isProcessingOffer = false;
    this.isProcessingAnswer = false;
    
    // Enhanced RTC configuration
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
        autoGainControl: true,
        sampleRate: 48000
      }
    };
    
    this.isInitialized = false;
    this.initializationPromise = null;
  }

  // ============ INITIALIZATION ============
  
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
      console.log('🚀 Initializing WebRTC service...');
      this.authToken = authToken;
      
      await this.initializeSocket(authToken);
      await this.getWebRTCConfig();
      
      this.isInitialized = true;
      console.log('✅ WebRTC service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize WebRTC service:', error);
      this.initializationPromise = null;
      throw error;
    }
  }

  // ============ CALLBACK MANAGEMENT ============
  
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
    this.setScreenCallbacks(callbacks);
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

  // ============ SOCKET INITIALIZATION ============
  
  async initializeSocket(authToken) {
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
  if (!this.socket) return;

  this.socket.on('incoming_call', (data) => {
    console.log('📞 Incoming call received:', data);
    this.callId = data.callId;
    this.roomId = data.roomId;
    this.signalingRoom = data.signalingRoom;
    this.isInitiator = false;
    this.callState = 'ringing';
    
    // IMPORTANT: Store the incoming call data including call type
    this.incomingCallData = data;
    
    this.triggerCallback('onIncomingCall', data);
  });

    this.socket.on('call_accepted', (data) => {
      console.log('✅ Call accepted:', data);
      this.callState = 'connecting';
      this.triggerCallback('onCallStateChange', 'accepted', data);
      
      // Start signaling process
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
      
      // If we're the initiator, create offer after joining room
      if (this.isInitiator && this.callState === 'connecting') {
        setTimeout(() => this.createOffer(), 1500);
      }
    });

    this.socket.on('disconnect', () => {
      console.log('💔 Socket disconnected');
      this.triggerCallback('onError', new Error('Connection lost'));
    });

    this.socket.on('error', (error) => {
      console.error('❌ Socket error:', error);
      this.triggerCallback('onError', error);
    });
  }

  // ============ WEBRTC CONFIG ============
  
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

  // ============ MEDIA MANAGEMENT ============
  
  async getUserMedia(constraints = null) {
  try {
    // DON'T stop existing stream immediately - just update it
    const mediaConstraints = constraints || this.mediaConstraints;
    console.log('🎥 Getting user media...', mediaConstraints);
    
    // Create new stream
    const newStream = await mediaDevices.getUserMedia(mediaConstraints);
    
    // If we have an existing stream, stop it AFTER getting the new one
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
    }
    
    this.localStream = newStream;
    this.localMediaReady = true;
    
    console.log('✅ User media obtained:', {
      audio: this.localStream.getAudioTracks().length,
      video: this.localStream.getVideoTracks().length,
      streamId: this.localStream.id
    });
    
    // Trigger callback immediately
    this.triggerCallback('onLocalStream', this.localStream);
    
    // Also update peer connection if it exists
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
    
    // Get current senders
    const senders = this.peerConnection.getSenders();
    
    // Update or add tracks
    this.localStream.getTracks().forEach(track => {
      const sender = senders.find(s => s.track && s.track.kind === track.kind);
      
      if (sender) {
        // Replace existing track
        console.log(`🔄 Replacing ${track.kind} track`);
        sender.replaceTrack(track);
      } else {
        // Add new track
        console.log(`➕ Adding new ${track.kind} track`);
        this.peerConnection.addTrack(track, this.localStream);
      }
    });
    
    console.log('✅ Peer connection tracks updated');
  } catch (error) {
    console.error('❌ Failed to update peer connection tracks:', error);
  }
}

async getLocalStream(forceRefresh = false) {
  console.log('📹 Getting local stream...', { forceRefresh, hasExisting: !!this.localStream });
  
  // Return existing stream if available and not forcing refresh
  if (this.localStream && this.localStream.active && !forceRefresh) {
    console.log('📹 Returning existing active local stream');
    // Still trigger callback to ensure UI updates
    this.triggerCallback('onLocalStream', this.localStream);
    return this.localStream;
  }

  // Get new stream
  return await this.getUserMedia(this.mediaConstraints);
}


async setupMedia(callType = 'audio') {
  console.log('🎥 Setting up media for call type:', callType);
  
  // Update constraints based on call type
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
    // Get local stream with force refresh
    const stream = await this.getLocalStream(true);
    
    // Ensure video track state matches requirements
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



  // ============ PEER CONNECTION MANAGEMENT - FIXED ============
  
  async createPeerConnection() {
    if (this.peerConnection) {
      console.log('⚠ Closing existing peer connection');
      this.closePeerConnection();
    }

    try {
      console.log('🔗 Creating peer connection');
      this.peerConnection = new RTCPeerConnection(this.rtcConfiguration);
      
      this.setupPeerConnectionEventHandlers();
      
      // FIXED: Add local stream with compatibility check
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

  // FIXED: Compatible method to add local stream
  async addLocalStreamToPeerConnection() {
    if (!this.peerConnection || !this.localStream) return;

    try {
      // Method 1: Try addTrack (newer API)
      if (this.peerConnection.addTrack && typeof this.peerConnection.addTrack === 'function') {
        console.log('📡 Using addTrack API');
        this.localStream.getTracks().forEach(track => {
          console.log(`➕ Adding ${track.kind} track via addTrack:`, track.id);
          this.peerConnection.addTrack(track, this.localStream);
        });
      }
      // Method 2: Try addStream (older API)
      else if (this.peerConnection.addStream && typeof this.peerConnection.addStream === 'function') {
        console.log('📡 Using addStream API (fallback)');
        this.peerConnection.addStream(this.localStream);
        console.log('✅ Local stream added via addStream');
      }
      // Method 3: Manual track handling
      else {
        console.log('📡 Using manual track handling (compatibility mode)');
        // Store stream for manual handling
        this.peerConnection._localStream = this.localStream;
        console.log('✅ Local stream stored for manual handling');
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

    // FIXED: Handle both onaddstream and ontrack for compatibility
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

  // FIXED: Unified remote stream handler
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

  // ============ CALL MANAGEMENT ============
  
 async initiateCall(calleeId, callType = 'video') {
  try {
    console.log(`📞 Initiating ${callType} call to:`, calleeId);
    this.callState = 'initiating';
    
    // Use setupMedia instead of getUserMedia directly
    await this.setupMedia(callType);
    
    // Make API call
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

  // FIXED: Complete acceptCall flow
 async acceptCall() {
  try {
    console.log('✅ Accepting call:', this.callId);
    
    if (!this.callId) {
      throw new Error('No call to accept');
    }
    
    this.callState = 'answering';
    this.triggerCallback('onCallStateChange', 'answering', { callId: this.callId });
    
    // Determine call type from incoming call data
    const callType = this.incomingCallData?.callType || 'audio';
    
    // Step 1: Setup media with proper type
    console.log('🎥 Setting up media for call acceptance');
    await this.setupMedia(callType);
    
    // Step 2: Create peer connection with media
    console.log('🔗 Creating peer connection for call acceptance');
    await this.createPeerConnection();
    
    // Step 3: Join signaling room
    console.log('📡 Joining signaling room for call acceptance');
    if (this.socket && this.signalingRoom) {
      this.signalingState = 'joining';
      this.socket.emit('joinSignalingRoom', { 
        signalingRoom: this.signalingRoom,
        callId: this.callId 
      });
      
      // Wait for signaling room to be ready
      await this.waitForSignalingReady();
    }
    
    // Step 4: Make API call to accept
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
    
    // Step 5: Update state and wait for offer
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

  // Helper method to wait for signaling room ready
  async waitForSignalingReady() {
    return new Promise((resolve) => {
      const checkSignalingReady = () => {
        if (this.signalingState === 'ready') {
          resolve();
        } else {
          setTimeout(checkSignalingReady, 100);
        }
      };
      
      // Timeout after 5 seconds
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

  // ============ SIGNALING ============
  
  async startSignaling() {
    try {
      console.log('🚀 Starting signaling process');
      
      // Create peer connection if not already created
      if (!this.peerConnectionReady) {
        await this.createPeerConnection();
      }
      
      // Join signaling room
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
      
      // Process queued ICE candidates
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
      
      // Process queued ICE candidates
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
      console.warn('⚠️ No local stream available');
      return false;
    }

    const videoTrack = this.localStream.getVideoTracks()[0];
    if (!videoTrack) {
      console.warn('⚠️ No video track available');
      return false;
    }

    // Toggle track
    const newState = !videoTrack.enabled;
    videoTrack.enabled = newState;
    console.log('🎥 Video track enabled:', newState);

    // Update media constraints to match
    if (this.mediaConstraints.video !== false) {
      this.mediaConstraints.video = newState ? {
        facingMode: 'user',
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30, max: 30 }
      } : false;
    }

    // Notify UI immediately
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

  // ============ CLEANUP ============
  
  cleanup() {
    console.log('🧹 Starting WebRTC cleanup');
    
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
    
    console.log('✅ WebRTC cleanup completed');
  }

  // ============ UTILITY METHODS ============
  
  disconnect() {
    console.log('💔 Disconnecting WebRTC service');
    this.cleanup();
    
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    
    this.isInitialized = false;
    this.initializationPromise = null;
  }

  isReady() {
    return this.isInitialized && this.socket && this.socket.connected;
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