// // services/EnhancedLiveStreamService.js - FINAL SOLUTION using Enhanced WebRTC
// import {
//     RTCPeerConnection,
//     RTCSessionDescription,
//     RTCIceCandidate,
//     mediaDevices,
//   } from 'react-native-webrtc';
//   import io from 'socket.io-client';
//   import BASE_URL from '../config/config';
  
//   class EnhancedLiveStreamService {
//     constructor() {
//       this.socket = null;
//       this.viewerPeerConnection = null;
//       this.broadcasterPeerConnections = new Map(); // For multiple viewers
//       this.localStream = null;
//       this.remoteStream = null;
//       this.iceCandidatesQueue = [];
//       this.isBroadcaster = false;
//       this.currentStreamId = null;
//       this.currentPeerConnectionId = null;
//       this.authToken = null;
//       this.serverUrl = BASE_URL;
//       this.connectionQuality = 'unknown';
//       this.statsInterval = null;
  
//       // Unified callback system
//       this.callbacks = {
//         onLocalStream: null,
//         onRemoteStream: null,
//         onStreamStateChange: null,
//         onError: null,
//         onViewerCount: null,
//         onConnectionQuality: null,
//         onChatMessage: null,
//         onReaction: null,
//       };
  
//       // Enhanced state management
//       this.streamState = 'idle'; // idle, connecting, connected, ended
//       this.connectionState = 'closed';
//       this.peerConnectionReady = false;
//       this.localMediaReady = false;
//       this.remoteDescriptionSet = false;
//       this.localDescriptionSet = false;
//       this.isProcessingOffer = false;
//       this.isProcessingAnswer = false;
  
//       // Enhanced RTC configuration
//       this.rtcConfiguration = {
//         iceServers: [
//           { urls: 'stun:stun.l.google.com:19302' },
//           { urls: 'stun:stun1.l.google.com:19302' },
//           {
//             urls: 'turn:openrelay.metered.ca:80',
//             username: 'openrelayproject',
//             credential: 'openrelayproject'
//           }
//         ],
//         iceCandidatePoolSize: 10,
//         iceTransportPolicy: 'all'
//       };
  
//       this.mediaConstraints = {
//         video: {
//           width: { ideal: 1280, max: 1920 },
//           height: { ideal: 720, max: 1080 },
//           frameRate: { ideal: 30, max: 60 },
//           facingMode: 'user'
//         },
//         audio: {
//           echoCancellation: true,
//           noiseSuppression: true,
//           autoGainControl: true,
//           sampleRate: 48000
//         }
//       };
  
//       this.isInitialized = false;
//       this.initializationPromise = null;
//     }
  
//     // ============ INITIALIZATION ============
  
//     async initialize(authToken) {
//       if (this.isInitialized) {
//         console.log('✅ Live Stream service already initialized');
//         return;
//       }
  
//       if (this.initializationPromise) {
//         console.log('⏳ Waiting for existing initialization');
//         return await this.initializationPromise;
//       }
  
//       this.initializationPromise = this._performInitialization(authToken);
//       return await this.initializationPromise;
//     }
  
//     async _performInitialization(authToken) {
//       try {
//         console.log('🚀 Initializing Enhanced Live Stream service...');
//         this.authToken = authToken;
  
//         await this.initializeSocket(authToken);
  
//         this.isInitialized = true;
//         console.log('✅ Enhanced Live Stream service initialized successfully');
//       } catch (error) {
//         console.error('❌ Failed to initialize Live Stream service:', error);
//         this.initializationPromise = null;
//         throw error;
//       }
//     }
  
//     // ============ CALLBACK MANAGEMENT ============
  
//     setCallbacks(callbacks) {
//       this.callbacks = { ...this.callbacks, ...callbacks };
//       console.log('📱 Live Stream callbacks set');
//     }
  
//     triggerCallback(callbackName, ...args) {
//       const callback = this.callbacks[callbackName];
//       if (callback && typeof callback === 'function') {
//         try {
//           callback(...args);
//           console.log(`✅ Callback executed: ${callbackName}`);
//         } catch (error) {
//           console.error(`❌ Callback error (${callbackName}):`, error);
//         }
//       }
//     }
  
//     // ============ SOCKET INITIALIZATION ============
  
//     async initializeSocket(authToken) {
//       if (this.socket && this.socket.connected) {
//         console.log('✅ Socket already connected');
//         return this.socket.id;
//       }
  
//       return new Promise((resolve, reject) => {
//         try {
//           this.socket = io(this.serverUrl, {
//             transports: ['websocket', 'polling'],
//             auth: { token: authToken.replace('Bearer ', '') },
//             timeout: 15000,
//             reconnection: true,
//             reconnectionAttempts: 3,
//             reconnectionDelay: 1000,
//           });
  
//           const timeout = setTimeout(() => {
//             reject(new Error('Socket connection timeout'));
//           }, 15000);
  
//           this.socket.on('connect', () => {
//             clearTimeout(timeout);
//             console.log('✅ Live Stream Socket connected:', this.socket.id);
//             this.setupSocketListeners();
//             resolve(this.socket.id);
//           });
  
//           this.socket.on('connect_error', (error) => {
//             clearTimeout(timeout);
//             console.error('❌ Live Stream Socket connection failed:', error);
//             reject(error);
//           });
//         } catch (error) {
//           reject(error);
//         }
//       });
//     }
  
//     setupSocketListeners() {
//       if (!this.socket) return;
  
//       console.log('🔌 Setting up Live Stream socket listeners');
  
//       // ===== BROADCASTER EVENTS =====
//       this.socket.on('stream:started', (data) => {
//         console.log('🎥 Stream started:', data);
//         this.streamState = 'live';
//         if (data.iceServers) {
//           this.rtcConfiguration.iceServers = data.iceServers;
//         }
//         this.triggerCallback('onStreamStateChange', 'started', data);
//       });
  
//       this.socket.on('webrtc:create_offer_for_viewer', async (data) => {
//         console.log('📡 🎯 CRITICAL: Create offer for viewer received:', data);
//         await this.handleCreateOfferForViewer(data);
//       });
  
//       this.socket.on('webrtc:answer_received', async (data) => {
//         console.log('📡 Answer received from viewer:', data);
//         await this.handleAnswerReceived(data);
//       });
  
//       // ===== VIEWER EVENTS =====
//       this.socket.on('stream:joined', (data) => {
//         console.log('🎥 🎯 CRITICAL: Stream joined event:', data);
//         this.currentPeerConnectionId = data.peerConnectionId;
//         this.currentStreamId = data.streamId;
//         this.streamState = 'connecting';
  
//         if (data.iceServers) {
//           this.rtcConfiguration.iceServers = data.iceServers;
//         }
  
//         this.triggerCallback('onStreamStateChange', 'joined', data);
//       });
  
//       this.socket.on('webrtc:offer_received', async (data) => {
//         console.log('📡 🎯 CRITICAL: Offer received from broadcaster:', data);
//         await this.handleOfferReceived(data); // This is the key event for viewers
//       });
  
//       // ===== COMMON EVENTS =====
//       this.socket.on('webrtc:ice_candidate', async (data) => {
//         console.log('📡 ICE candidate received:', data);
//         await this.handleIceCandidate(data);
//       });
  
//       this.socket.on('stream:viewer_count', (data) => {
//         console.log('👥 Viewer count update:', data);
//         this.triggerCallback('onViewerCount', data);
//       });
  
//       this.socket.on('stream:ended', (data) => {
//         console.log('🔚 Stream ended:', data);
//         this.streamState = 'ended';
//         this.cleanup();
//         this.triggerCallback('onStreamStateChange', 'ended', data);
//       });
  
//       this.socket.on('chat:message', (data) => {
//         console.log('💬 Chat message:', data);
//         this.triggerCallback('onChatMessage', data);
//       });
  
//       this.socket.on('reaction:new', (data) => {
//         console.log('❤️ New reaction:', data);
//         this.triggerCallback('onReaction', data);
//       });
  
//       this.socket.on('error', (error) => {
//         console.error('❌ Socket error:', error);
//         this.triggerCallback('onError', error);
//       });
//     }
  
//     // ============ LIVE STREAMING METHODS ============
  
//     async startBroadcasting(streamId) {
//       try {
//         console.log('🎤 Starting broadcast for stream:', streamId);
//         this.isBroadcaster = true;
//         this.currentStreamId = streamId;
//         this.streamState = 'starting';
  
//         // Get local media
//         await this.getLocalStream();
  
//         // Emit broadcaster ready
//         this.socket.emit('stream:broadcaster_ready', { streamId });
  
//         console.log('✅ Broadcasting started successfully');
//         return true;
//       } catch (error) {
//         console.error('❌ Failed to start broadcasting:', error);
//         this.triggerCallback('onError', { type: 'broadcast_error', message: error.message });
//         return false;
//       }
//     }
  
//     async joinStreamAsViewer(streamId) {
//       try {
//         console.log('🎥 🎯 ENHANCED: Joining stream as viewer:', streamId);
//         this.isBroadcaster = false;
//         this.currentStreamId = streamId;
//         this.streamState = 'joining';
  
//         // Step 1: Authorize via REST API
//         console.log('📡 Step 1: REST API Authorization');
//         const response = await fetch(`${this.serverUrl}/api/v1/live/${streamId}/join`, {
//           method: 'POST',
//           headers: {
//             'Authorization': `Bearer ${this.authToken}`, // Use Bearer prefix
//             'Content-Type': 'application/json',
//           },
//         });
  
//         if (!response.ok) {
//           const errorText = await response.text();
//           console.error('❌ Join API Error Response:', errorText);
//           throw new Error(`Join authorization failed: ${response.status} - ${errorText}`);
//         }
  
//         const joinData = await response.json();
//         console.log('✅ REST API authorization successful:', joinData);
  
//         // Step 2: Emit viewer join via socket
//         console.log('📡 Step 2: Socket viewer join');
//         this.socket.emit('stream:viewer_join', { streamId });
  
//         // Step 3: Wait for stream:joined event which will trigger offer creation
//         console.log('⏳ Step 3: Waiting for stream:joined event...');
  
//         this.triggerCallback('onStreamStateChange', 'joining', { streamId });
//         return true;
//       } catch (error) {
//         console.error('❌ Failed to join stream:', error);
//         this.triggerCallback('onError', { type: 'join_error', message: error.message });
//         return false;
//       }
//     }
  
//     // ============ WEBRTC PEER CONNECTION ============
  
//     async createPeerConnection(peerConnectionId, isForViewer = false) {
//       try {
//         console.log(`🔗 Creating peer connection: ${peerConnectionId} (isForViewer: ${isForViewer})`);
  
//         const pc = new RTCPeerConnection(this.rtcConfiguration);
//         console.log('✅ RTCPeerConnection created with servers:', this.rtcConfiguration.iceServers);
  
//         // Setup event handlers
//         pc.onicecandidate = (event) => {
//           if (event.candidate && this.socket && this.currentStreamId) {
//             console.log('🧊 Sending ICE candidate');
//             this.socket.emit('webrtc:ice_candidate', {
//               streamId: this.currentStreamId,
//               peerConnectionId: peerConnectionId,
//               candidate: event.candidate,
//               targetType: this.isBroadcaster ? 'viewer' : 'broadcaster',
//             });
//           }
//         };
  
//         pc.onconnectionstatechange = () => {
//           console.log(`🔗 Connection state: ${pc.connectionState}`);
//           if (pc.connectionState === 'connected') {
//             this.streamState = 'connected';
//             this.triggerCallback('onStreamStateChange', 'connected', { peerConnectionId });
//             if (!this.isBroadcaster) {
//               this.startStatsMonitoring();
//             }
//           } else if (pc.connectionState === 'failed') {
//                console.error('❌ PeerConnection failed');
//                this.triggerCallback('onError', { type: 'connection_failed', message: 'WebRTC connection failed.' });
//           }
//         };
  
//         pc.oniceconnectionstatechange = () => {
//           console.log(`🧊 ICE state: ${pc.iceConnectionState}`);
//           if (this.socket && this.currentStreamId) {
//             this.socket.emit('webrtc:connection_state', {
//               streamId: this.currentStreamId,
//               peerConnectionId: peerConnectionId,
//               state: pc.iceConnectionState,
//             });
//           }
//            if (pc.iceConnectionState === 'failed') {
//                console.error('❌ ICE Connection failed');
//                this.triggerCallback('onError', { type: 'ice_failed', message: 'ICE connection failed.' });
//            }
//         };
  
//         // Handle tracks/streams
//         if (this.isBroadcaster && this.localStream) {
//           console.log('📡 Adding local stream to broadcaster PC');
//           this.localStream.getTracks().forEach(track => {
//             pc.addTrack(track, this.localStream);
//           });
//         } else if (!this.isBroadcaster) {
//           // For viewers, handle incoming remote stream
//           pc.ontrack = (event) => {
//             console.log('📺 🎉 REMOTE TRACK RECEIVED!');
//             if (event.streams && event.streams[0]) {
//               this.handleRemoteStream(event.streams[0]);
//             }
//           };
  
//           pc.onaddstream = (event) => {
//             console.log('📺 🎉 REMOTE STREAM RECEIVED (Legacy)!');
//             if (event.stream) {
//               this.handleRemoteStream(event.stream);
//             }
//           };
//         }
  
//         return pc;
//       } catch (error) {
//         console.error('❌ Failed to create peer connection:', error);
//         throw error;
//       }
//     }
  
//     handleRemoteStream(stream) {
//       console.log('📺 🎯 CRITICAL: Processing remote stream:', stream.id);
//       this.remoteStream = stream;
//       this.streamState = 'connected'; // Consider 'video_connected' if you want a distinct state
//       console.log('✅ Remote stream set successfully:', {
//         streamId: stream.id,
//         tracks: stream.getTracks().length,
//         active: stream.active
//       });
  
//       this.triggerCallback('onRemoteStream', stream);
//       // Use 'video_connected' state if preferred, or just 'connected'
//       this.triggerCallback('onStreamStateChange', 'video_connected', { stream });
//     }
  
//     // ============ SIGNALING HANDLERS ============
  
//     async handleCreateOfferForViewer(data) {
//       if (!this.isBroadcaster) return;
  
//       try {
//         console.log('🎯 BROADCASTER: Creating offer for viewer:', data);
//         const { viewerId, peerConnectionId } = data;
  
//         // Create peer connection for this viewer
//         const pc = await this.createPeerConnection(peerConnectionId, true);
//         this.broadcasterPeerConnections.set(peerConnectionId, pc);
  
//         // Create offer
//         const offer = await pc.createOffer({
//           // For broadcasting, the broadcaster sends the stream, viewer receives.
//           // These are typically true for the broadcaster.
//           offerToReceiveAudio: false, // Broadcaster sends audio
//           offerToReceiveVideo: false, // Broadcaster sends video
//         });
  
//         await pc.setLocalDescription(offer);
  
//         // Send offer
//         this.socket.emit('webrtc:offer_for_viewer', {
//           streamId: this.currentStreamId,
//           viewerId: viewerId,
//           peerConnectionId: peerConnectionId,
//           offer: offer,
//         });
  
//         console.log('✅ Offer created and sent for viewer:', peerConnectionId);
//       } catch (error) {
//         console.error('❌ Failed to create offer for viewer:', error);
//       }
//     }
  
//     async handleAnswerReceived(data) {
//       if (!this.isBroadcaster) return;
  
//       try {
//         console.log('🎯 BROADCASTER: Processing answer from viewer:', data);
//         const { peerConnectionId, answer } = data;
  
//         const pc = this.broadcasterPeerConnections.get(peerConnectionId);
//         if (!pc) {
//           console.error('❌ No peer connection found for:', peerConnectionId);
//           return;
//         }
  
//         await pc.setRemoteDescription(new RTCSessionDescription(answer));
//         console.log('✅ Answer processed for viewer:', peerConnectionId);
//       } catch (error) {
//         console.error('❌ Failed to process answer:', error);
//       }
//     }
  
//     async handleOfferReceived(data) {
//       // ADD THIS DEBUG LINE AT THE VERY BEGINNING
//       console.log('🎯 VIEWER: handleOfferReceived FUNCTION CALLED with data:', JSON.stringify(data, null, 2));
  
//       if (this.isBroadcaster) {
//           console.log("❌ This is broadcaster, ignoring offer");
//           return;
//       }
  
//       try {
//         console.log('🎯 VIEWER: Processing offer from broadcaster:', data);
//         const { peerConnectionId, offer } = data;
  
//         // Verify this is our peer connection
//         if (peerConnectionId !== this.currentPeerConnectionId) {
//           console.warn('⚠️ Received offer for different peer connection:', peerConnectionId);
//           // It's generally safer to update the ID if it's expected to change,
//           // but ensure the server logic is correct.
//           this.currentPeerConnectionId = peerConnectionId;
//         }
  
//         // Create peer connection if not exists
//         if (!this.viewerPeerConnection) {
//           this.viewerPeerConnection = await this.createPeerConnection(peerConnectionId, false);
//         }
//         const pc = this.viewerPeerConnection;
  
//         // Set remote description
//         await pc.setRemoteDescription(new RTCSessionDescription(offer));
//         console.log('✅ Remote description (offer) set');
  
//         // Create answer
//         const answer = await pc.createAnswer();
//         await pc.setLocalDescription(answer);
//         console.log('✅ Local description (answer) set');
  
//         // Send answer
//         this.socket.emit('webrtc:answer', { // Ensure this event name matches server expectation
//           streamId: this.currentStreamId,
//           peerConnectionId: peerConnectionId,
//           answer: answer,
//         });
  
//         console.log('✅ Answer created and sent to broadcaster');
  
//         // Process queued ICE candidates
//         setTimeout(() => this.processQueuedIceCandidates(), 100);
  
//       } catch (error) {
//         console.error('❌ Failed to process offer:', error);
//         this.triggerCallback('onError', { type: 'offer_error', message: error.message });
//       }
//     }
  
//     async handleIceCandidate(data) {
//       try {
//         const { peerConnectionId, candidate } = data;
  
//         if (!candidate) {
//           console.log('🧊 Received end-of-candidates');
//           return;
//         }
  
//         let pc = null;
//         if (this.isBroadcaster) {
//           pc = this.broadcasterPeerConnections.get(peerConnectionId);
//         } else {
//           pc = this.viewerPeerConnection;
//         }
  
//         if (!pc) {
//           console.log('🧊 Queueing ICE candidate (no peer connection)');
//           this.iceCandidatesQueue.push({ peerConnectionId, candidate });
//           return;
//         }
  
//         if (pc.remoteDescription) {
//           await pc.addIceCandidate(new RTCIceCandidate(candidate));
//           console.log('✅ ICE candidate added');
//         } else {
//           console.log('🧊 Queueing ICE candidate (no remote description)');
//           this.iceCandidatesQueue.push({ peerConnectionId, candidate });
//         }
//       } catch (error) {
//         console.warn('⚠️ Failed to handle ICE candidate:', error);
//       }
//     }
  
//     async processQueuedIceCandidates() {
//       if (this.iceCandidatesQueue.length === 0) return;
  
//       console.log(`🧊 Processing ${this.iceCandidatesQueue.length} queued ICE candidates`);
  
//       const candidates = [...this.iceCandidatesQueue];
//       this.iceCandidatesQueue = [];
  
//       for (const { peerConnectionId, candidate } of candidates) {
//         try {
//           let pc = null;
//           if (this.isBroadcaster) {
//             pc = this.broadcasterPeerConnections.get(peerConnectionId);
//           } else {
//             pc = this.viewerPeerConnection;
//           }
  
//           if (pc && pc.remoteDescription && candidate) {
//             await pc.addIceCandidate(new RTCIceCandidate(candidate));
//             console.log('✅ Queued ICE candidate processed');
//           }
//         } catch (error) {
//           console.warn('⚠️ Failed to process queued ICE candidate:', error);
//         }
//       }
//     }
  
//     // ============ MEDIA MANAGEMENT ============
  
//     async getLocalStream() {
//       try {
//         console.log('📹 Getting local media stream...');
  
//         if (this.localStream && this.localStream.active) {
//           console.log('📹 Returning existing active stream');
//           this.triggerCallback('onLocalStream', this.localStream);
//           return this.localStream;
//         }
  
//         const stream = await mediaDevices.getUserMedia(this.mediaConstraints);
//         this.localStream = stream;
//         this.localMediaReady = true;
  
//         console.log('✅ Local media stream acquired:', {
//           audio: stream.getAudioTracks().length,
//           video: stream.getVideoTracks().length,
//           id: stream.id
//         });
  
//         this.triggerCallback('onLocalStream', stream);
//         return stream;
//       } catch (error) {
//         console.error('❌ Failed to get local media:', error);
//         this.triggerCallback('onError', { type: 'media_error', message: error.message });
//         throw error;
//       }
//     }
  
//     // ============ STATS MONITORING ============
  
//     startStatsMonitoring() {
//       if (this.statsInterval) clearInterval(this.statsInterval);
  
//       this.statsInterval = setInterval(async () => {
//         try {
//           const pc = this.isBroadcaster ?
//             Array.from(this.broadcasterPeerConnections.values())[0] :
//             this.viewerPeerConnection;
  
//           if (pc) {
//             const stats = await this.getConnectionStats(pc);
//             if (stats) {
//               this.analyzeConnectionQuality(stats);
//             }
//           }
//         } catch (error) {
//           console.error('❌ Stats monitoring error:', error);
//         }
//       }, 5000);
//     }
  
//     async getConnectionStats(pc) {
//       try {
//         const stats = await pc.getStats();
//         const report = {
//           packetsReceived: 0,
//           packetsSent: 0,
//           packetsLost: 0,
//           bytesReceived: 0,
//           bytesSent: 0,
//           timestamp: Date.now()
//         };
  
//         stats.forEach(stat => {
//           if (stat.type === 'inbound-rtp') {
//             report.packetsReceived += stat.packetsReceived || 0;
//             report.packetsLost += stat.packetsLost || 0;
//             report.bytesReceived += stat.bytesReceived || 0;
//           } else if (stat.type === 'outbound-rtp') {
//             report.packetsSent += stat.packetsSent || 0;
//             report.bytesSent += stat.bytesSent || 0;
//           }
//         });
  
//         return report;
//       } catch (error) {
//         console.error('❌ Error getting stats:', error);
//         return null;
//       }
//     }
  
//     analyzeConnectionQuality(stats) {
//       let quality = 'good';
  
//       if (stats.packetsLost > 0 && stats.packetsReceived > 0) {
//         const lossRate = stats.packetsLost / (stats.packetsReceived + stats.packetsLost);
//         if (lossRate > 0.05) quality = 'poor';
//         else if (lossRate > 0.02) quality = 'fair';
//       }
  
//       if (quality !== this.connectionQuality) {
//         this.connectionQuality = quality;
//         this.triggerCallback('onConnectionQuality', { quality, stats });
//       }
//     }
  
//     // ============ CHAT & REACTIONS ============
  
//     sendChatMessage(message) {
//       if (this.socket && this.currentStreamId) {
//         this.socket.emit('chat:send', {
//           streamId: this.currentStreamId,
//           message: message
//         });
//         return true;
//       }
//       return false;
//     }
  
//     sendReaction(reaction) {
//       if (this.socket && this.currentStreamId) {
//         this.socket.emit('reaction:send', {
//           streamId: this.currentStreamId,
//           reaction: reaction
//         });
//         return true;
//       }
//       return false;
//     }
  
//     // ============ CLEANUP ============
  
//     cleanup() {
//       console.log('🧹 Cleaning up Enhanced Live Stream service');
  
//       // Stop stats monitoring
//       if (this.statsInterval) {
//         clearInterval(this.statsInterval);
//         this.statsInterval = null;
//       }
  
//       // Stop local stream
//       if (this.localStream) {
//         this.localStream.getTracks().forEach(track => track.stop());
//         this.localStream = null;
//       }
  
//       // Stop remote stream
//       if (this.remoteStream) {
//         this.remoteStream.getTracks().forEach(track => track.stop());
//         this.remoteStream = null;
//       }
  
//       // Close peer connections
//       if (this.viewerPeerConnection) {
//         this.viewerPeerConnection.close();
//         this.viewerPeerConnection = null;
//       }
  
//       this.broadcasterPeerConnections.forEach(pc => pc.close());
//       this.broadcasterPeerConnections.clear();
  
//       // Reset state
//       this.currentStreamId = null;
//       this.currentPeerConnectionId = null;
//       this.streamState = 'idle';
//       this.iceCandidatesQueue = [];
//       this.connectionQuality = 'unknown';
//       this.peerConnectionReady = false;
//       this.localMediaReady = false;
//       this.remoteDescriptionSet = false;
//       this.localDescriptionSet = false;
  
//       console.log('✅ Enhanced Live Stream cleanup completed');
//     }
  
//     // ============ UTILITY METHODS ============
  
//     disconnect() {
//       this.cleanup();
  
//       if (this.socket) {
//         this.socket.disconnect();
//         this.socket = null;
//       }
  
//       this.isInitialized = false;
//       this.initializationPromise = null;
//     }
  
//     isReady() {
//       return this.isInitialized && this.socket && this.socket.connected;
//     }
  
//     getStreamState() {
//       return {
//         isStreaming: ['connecting', 'connected'].includes(this.streamState),
//         streamId: this.currentStreamId,
//         isBroadcaster: this.isBroadcaster,
//         hasLocalStream: this.localMediaReady && !!this.localStream,
//         hasRemoteStream: !!this.remoteStream,
//         streamState: this.streamState,
//         connectionQuality: this.connectionQuality,
//         peerConnectionId: this.currentPeerConnectionId,
//       };
//     }
//   }
  
//   // Create and export singleton instance
//   const enhancedLiveStreamService = new EnhancedLiveStreamService();
//   export default enhancedLiveStreamService;