// // src/hooks/useWebRTC.js - FIXED VERSION - Resolves Connection Issues
// import { useState, useEffect, useRef, useCallback } from 'react';
// import { useSocket } from '../context/SocketContext';
// import { mediaDevices, RTCPeerConnection, RTCSessionDescription, RTCIceCandidate } from 'react-native-webrtc';
// import { Platform, PermissionsAndroid } from 'react-native';

// const useWebRTC = (isBroadcaster, initialStreamId) => {
//   const { 
//     socket, 
//     isConnected,
//     registerStreamHandlers,
//     emitBroadcasterReady,
//     emitViewerJoin,
//     emitWebRTCOffer,
//     emitWebRTCAnswer,
//     emitICECandidate,
//     emitConnectionState,
//     emitReconnectRequest
//   } = useSocket();

//   // FIXED: Use internal state for streamId instead of relying on parameter
//   const [currentStreamId, setCurrentStreamId] = useState(initialStreamId);
  
//   // Update internal streamId when parameter changes
//   useEffect(() => {
//     console.log(`🔄 StreamId updated from ${currentStreamId} to ${initialStreamId}`);
//     setCurrentStreamId(initialStreamId);
//   }, [initialStreamId]);

//   // Refs for WebRTC objects
//   const localStreamRef = useRef(null);
//   const peerConnectionsRef = useRef(new Map()); // For broadcaster: Map<peerConnectionId, RTCPeerConnection>
//   const viewerPeerConnectionRef = useRef(null); // For viewer: single connection
//   const currentPeerConnectionIdRef = useRef(null); // For viewer: current peerConnectionId
//   const handlersRegisteredRef = useRef(false); // FIXED: Track if handlers are registered

//   // States exposed to components
//   const [localStream, setLocalStream] = useState(null);
//   const [remoteStream, setRemoteStream] = useState(null);
//   const [isWebRTCConnected, setIsWebRTCConnected] = useState(false);
//   const [webRTCError, setWebRTCError] = useState(null);
//   const [iceServers, setIceServers] = useState([{ urls: 'stun:stun.l.google.com:19302' }]);
//   const [connectedViewers, setConnectedViewers] = useState(new Set());

//   // Cleanup function
//   const cleanupWebRTC = useCallback(() => {
//     console.log('🧹 Cleaning up WebRTC resources...');
    
//     // Stop local stream
//     if (localStreamRef.current) {
//       localStreamRef.current.getTracks().forEach(track => {
//         console.log(`  - Stopping local track: ${track.kind}`);
//         track.stop();
//       });
//       localStreamRef.current = null;
//       setLocalStream(null);
//     }

//     // Close all broadcaster peer connections
//     if (isBroadcaster) {
//       peerConnectionsRef.current.forEach((pc, peerConnectionId) => {
//         console.log(`  - Closing broadcaster PC: ${peerConnectionId}`);
//         pc.close();
//       });
//       peerConnectionsRef.current.clear();
//       setConnectedViewers(new Set());
//     }

//     // Close viewer peer connection
//     if (viewerPeerConnectionRef.current) {
//       console.log('  - Closing viewer PC');
//       viewerPeerConnectionRef.current.close();
//       viewerPeerConnectionRef.current = null;
//     }

//     currentPeerConnectionIdRef.current = null;
//     setRemoteStream(null);
//     setIsWebRTCConnected(false);
//     setWebRTCError(null);
//   }, [isBroadcaster]);

//   // Request permissions (Android specific)
//   const requestPermissions = useCallback(async () => {
//     if (Platform.OS !== 'android') {
//       return true;
//     }
//     try {
//       console.log('📱 Requesting Android permissions...');
//       const cameraPermission = await PermissionsAndroid.request(
//         PermissionsAndroid.PERMISSIONS.CAMERA,
//         {
//           title: 'Camera Permission',
//           message: 'App needs access to your camera for live streaming.',
//           buttonNeutral: 'Ask Me Later',
//           buttonNegative: 'Cancel',
//           buttonPositive: 'OK',
//         },
//       );
//       const audioPermission = await PermissionsAndroid.request(
//         PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
//         {
//           title: 'Microphone Permission',
//           message: 'App needs access to your microphone for live streaming.',
//           buttonNeutral: 'Ask Me Later',
//           buttonNegative: 'Cancel',
//           buttonPositive: 'OK',
//         },
//       );
//       const granted = cameraPermission === PermissionsAndroid.RESULTS.GRANTED &&
//                       audioPermission === PermissionsAndroid.RESULTS.GRANTED;
//       console.log(`  Permissions granted: ${granted}`);
//       return granted;
//     } catch (err) {
//       console.error('❌ Permission request error:', err);
//       setWebRTCError('Failed to get required permissions.');
//       return false;
//     }
//   }, []);

//   // Initialize local media stream for the broadcaster
//   const initializeLocalStream = useCallback(async () => {
//     if (!isBroadcaster) {
//       console.log('🚫 initializeLocalStream called for viewer, ignoring.');
//       return true;
//     }

//     console.log('📹 Initializing local media stream...');
//     const hasPermission = await requestPermissions();
//     if (!hasPermission) {
//       setWebRTCError('Camera and Microphone permissions are required.');
//       return false;
//     }

//     try {
//       if (localStreamRef.current) {
//         localStreamRef.current.getTracks().forEach(track => track.stop());
//       }

//       const stream = await mediaDevices.getUserMedia({
//         audio: true,
//         video: {
//           facingMode: 'user',
//           width: { ideal: 1280 },
//           height: { ideal: 720 },
//         },
//       });

//       console.log('✅ Local media stream acquired.');
//       localStreamRef.current = stream;
//       setLocalStream(stream);
//       return true;
//     } catch (error) {
//       console.error('❌ Error getting user media:', error);
//       setWebRTCError(`Could not access media devices: ${error.message}`);
//       return false;
//     }
//   }, [isBroadcaster, requestPermissions]);

//   // Create peer connection with proper event handlers
//   const createPeerConnection = useCallback((peerConnectionId, providedIceServers = null) => {
//     console.log(`🔗 Creating RTCPeerConnection for: ${peerConnectionId}`);

//     const serversToUse = providedIceServers || iceServers;
//     if (providedIceServers) {
//       setIceServers(providedIceServers);
//     }

//     try {
//       const pc = new RTCPeerConnection({ iceServers: serversToUse });
//       console.log('  - RTCPeerConnection created with ICE servers:', serversToUse);

//       // ICE candidate handler
//       pc.onicecandidate = (event) => {
//         if (event.candidate && socket && isConnected && currentStreamId) {
//           console.log(`📡 ICE candidate for ${peerConnectionId}`);
//           emitICECandidate({
//             streamId: currentStreamId,
//             peerConnectionId: peerConnectionId,
//             candidate: event.candidate,
//             targetType: isBroadcaster ? 'viewer' : 'broadcaster',
//           });
//         }
//       };

//       // Connection state handler
//       pc.oniceconnectionstatechange = () => {
//         console.log(`📡 ICE Connection State for ${peerConnectionId}: ${pc.iceConnectionState}`);
        
//         if (socket && isConnected && currentStreamId) {
//           emitConnectionState({
//             streamId: currentStreamId,
//             peerConnectionId: peerConnectionId,
//             state: pc.iceConnectionState,
//           });
//         }

//         if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
//           if (isBroadcaster) {
//             setConnectedViewers(prev => new Set([...prev, peerConnectionId]));
//           } else {
//             setIsWebRTCConnected(true);
//             setWebRTCError(null);
//           }
//         } else if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
//           if (isBroadcaster) {
//             setConnectedViewers(prev => {
//               const newSet = new Set(prev);
//               newSet.delete(peerConnectionId);
//               return newSet;
//             });
//           } else {
//             setIsWebRTCConnected(false);
//           }
          
//           if (pc.iceConnectionState === 'failed') {
//             const errorMsg = `WebRTC connection failed for ${peerConnectionId}`;
//             setWebRTCError(errorMsg);
//             console.error(`🚨 ${errorMsg}`);
//           }
//         }
//       };

//       pc.onconnectionstatechange = () => {
//         console.log(`📡 PeerConnection State for ${peerConnectionId}: ${pc.connectionState}`);
//       };

//       // Track handling
//       if (isBroadcaster) {
//         // Add local tracks for broadcasting
//         if (localStreamRef.current) {
//           console.log(`  - Adding local tracks to PC: ${peerConnectionId}`);
//           localStreamRef.current.getTracks().forEach(track => {
//             pc.addTrack(track, localStreamRef.current);
//             console.log(`    - Added track: ${track.kind}`);
//           });
//         }
//       } else {
//         // Handle remote tracks for viewer
//         pc.ontrack = (event) => {
//           console.log(`📥 Received remote track for ${peerConnectionId}: ${event.track.kind}`);
//           if (event.streams && event.streams[0]) {
//             console.log('  - Setting remote stream for viewer');
//             setRemoteStream(event.streams[0]);
//           }
//         };
//       }

//       return pc;
//     } catch (error) {
//       console.error('❌ Error creating RTCPeerConnection:', error);
//       setWebRTCError(`Failed to create peer connection: ${error.message}`);
//       return null;
//     }
//   }, [isBroadcaster, socket, isConnected, currentStreamId, iceServers, emitICECandidate, emitConnectionState]);

//   // FIXED: Register handlers IMMEDIATELY when socket is available, not waiting for streamId
//   useEffect(() => {
//     if (!socket || !isConnected || handlersRegisteredRef.current) return;

//     console.log(`🔌 Registering WebRTC socket listeners for ${isBroadcaster ? 'broadcaster' : 'viewer'} IMMEDIATELY`);

//     const handlers = {};

//     if (isBroadcaster) {
//       // Broadcaster handlers
//       handlers.onStreamStarted = (data) => {
//         console.log('🎥 Stream started event received:', data);
//         if (data.iceServers) {
//           setIceServers(data.iceServers);
//         }
//       };

//       handlers.onCreateOfferForViewer = async (data) => {
//         console.log('📡 Create offer for viewer:', data);
//         const { viewerId, peerConnectionId } = data;

//         if (!localStreamRef.current) {
//           console.error('❌ No local stream available for offer creation');
//           return;
//         }

//         if (!currentStreamId) {
//           console.error('❌ No streamId available for offer creation');
//           return;
//         }

//         try {
//           // Create new peer connection for this viewer
//           const pc = createPeerConnection(peerConnectionId);
//           if (!pc) {
//             console.error(`❌ Failed to create PC for viewer: ${peerConnectionId}`);
//             return;
//           }

//           // Store the peer connection
//           peerConnectionsRef.current.set(peerConnectionId, pc);

//           // Create offer
//           const offer = await pc.createOffer({
//             offerToReceiveAudio: false,
//             offerToReceiveVideo: false,
//           });
//           await pc.setLocalDescription(offer);

//           // Send offer to viewer
//           emitWebRTCOffer({
//             streamId: currentStreamId,
//             viewerId: viewerId,
//             peerConnectionId: peerConnectionId,
//             offer: offer,
//           });

//           console.log(`✅ Offer sent for viewer: ${peerConnectionId}`);
//         } catch (error) {
//           console.error(`❌ Error creating offer for viewer ${peerConnectionId}:`, error);
//           // Clean up failed connection
//           const pc = peerConnectionsRef.current.get(peerConnectionId);
//           if (pc) {
//             pc.close();
//             peerConnectionsRef.current.delete(peerConnectionId);
//           }
//         }
//       };

//       handlers.onAnswerReceived = async (data) => {
//         console.log('📡 Answer received from viewer:', data);
//         const { peerConnectionId, answer } = data;

//         const pc = peerConnectionsRef.current.get(peerConnectionId);
//         if (!pc) {
//           console.error(`❌ No PC found for peerConnectionId: ${peerConnectionId}`);
//           return;
//         }

//         try {
//           await pc.setRemoteDescription(new RTCSessionDescription(answer));
//           console.log(`✅ Remote description set for viewer: ${peerConnectionId}`);
//         } catch (error) {
//           console.error(`❌ Error setting remote description for ${peerConnectionId}:`, error);
//         }
//       };

//       handlers.onViewerLeft = (data) => {
//         console.log('👁 Viewer left:', data);
//         const { peerConnectionId } = data;
        
//         const pc = peerConnectionsRef.current.get(peerConnectionId);
//         if (pc) {
//           pc.close();
//           peerConnectionsRef.current.delete(peerConnectionId);
//           setConnectedViewers(prev => {
//             const newSet = new Set(prev);
//             newSet.delete(peerConnectionId);
//             return newSet;
//           });
//         }
//       };

//     } else {
//       // Viewer handlers
//       handlers.onStreamJoined = (data) => {
//         console.log('🎥 Stream joined event received:', data);
//         const { peerConnectionId, iceServers: receivedIceServers } = data;
        
//         currentPeerConnectionIdRef.current = peerConnectionId;
//         console.log(`🔑 Set current peer connection ID: ${peerConnectionId}`);
        
//         if (receivedIceServers) {
//           setIceServers(receivedIceServers);
//         }
//       };

//       handlers.onOfferReceived = async (data) => {
//         console.log('📡 Offer received from broadcaster:', data);
//         const { peerConnectionId, offer } = data;

//         // FIXED: Don't verify peerConnectionId if we don't have one yet
//         if (currentPeerConnectionIdRef.current && peerConnectionId !== currentPeerConnectionIdRef.current) {
//           console.warn(`⚠ Received offer for different peerConnectionId: ${peerConnectionId} vs ${currentPeerConnectionIdRef.current}`);
//           // But still process it, maybe we missed the joined event
//           currentPeerConnectionIdRef.current = peerConnectionId;
//         }

//         if (!currentPeerConnectionIdRef.current) {
//           console.log(`🔑 Setting peer connection ID from offer: ${peerConnectionId}`);
//           currentPeerConnectionIdRef.current = peerConnectionId;
//         }

//         try {
//           // Create peer connection if not exists
//           if (!viewerPeerConnectionRef.current) {
//             const pc = createPeerConnection(peerConnectionId);
//             if (!pc) {
//               console.error('❌ Failed to create viewer PC');
//               return;
//             }
//             viewerPeerConnectionRef.current = pc;
//           }

//           const pc = viewerPeerConnectionRef.current;

//           // Set remote description
//           await pc.setRemoteDescription(new RTCSessionDescription(offer));
//           console.log('  - Remote description (offer) set');

//           // Create answer
//           const answer = await pc.createAnswer();
//           await pc.setLocalDescription(answer);
//           console.log('  - Local description (answer) set');

//           // FIXED: Use currentStreamId from state, not parameter
//           if (!currentStreamId) {
//             console.error('❌ No currentStreamId available for answer');
//             return;
//           }

//           // Send answer
//           emitWebRTCAnswer({
//             streamId: currentStreamId,
//             peerConnectionId: peerConnectionId,
//             answer: answer,
//           });

//           console.log('✅ Answer sent to broadcaster');
//         } catch (error) {
//           console.error('❌ Error handling offer:', error);
//           setWebRTCError(`Failed to handle offer: ${error.message}`);
//         }
//       };

//       handlers.onReconnectRequired = () => {
//         console.log('📡 Reconnect required');
//         if (currentPeerConnectionIdRef.current && currentStreamId) {
//           emitReconnectRequest({
//             streamId: currentStreamId,
//             oldPeerConnectionId: currentPeerConnectionIdRef.current,
//           });
//         }
//       };

//       handlers.onReconnectInitiated = (data) => {
//         console.log('📡 Reconnect initiated:', data);
//         const { newPeerConnectionId } = data;
        
//         // Close old connection
//         if (viewerPeerConnectionRef.current) {
//           viewerPeerConnectionRef.current.close();
//           viewerPeerConnectionRef.current = null;
//         }
        
//         // Update current connection ID
//         currentPeerConnectionIdRef.current = newPeerConnectionId;
//         setIsWebRTCConnected(false);
//         setRemoteStream(null);
//       };
//     }

//     // Common handlers
//     handlers.onIceCandidate = async (data) => {
//       const { peerConnectionId, candidate } = data;

//       if (isBroadcaster) {
//         const pc = peerConnectionsRef.current.get(peerConnectionId);
//         if (pc && candidate) {
//           try {
//             await pc.addIceCandidate(new RTCIceCandidate(candidate));
//             console.log(`📡 ICE candidate added for viewer: ${peerConnectionId}`);
//           } catch (error) {
//             console.error(`❌ Error adding ICE candidate for ${peerConnectionId}:`, error);
//           }
//         }
//       } else {
//         if (peerConnectionId === currentPeerConnectionIdRef.current && viewerPeerConnectionRef.current && candidate) {
//           try {
//             await viewerPeerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
//             console.log('📡 ICE candidate added for viewer connection');
//           } catch (error) {
//             console.error('❌ Error adding ICE candidate:', error);
//           }
//         }
//       }
//     };

//     // Register handlers with socket context
//     registerStreamHandlers(handlers);
//     handlersRegisteredRef.current = true;

//     return () => {
//       console.log(`🧹 Cleaning up WebRTC socket listeners for ${isBroadcaster ? 'broadcaster' : 'viewer'}`);
//       handlersRegisteredRef.current = false;
//     };
//   }, [
//     socket, 
//     isConnected, 
//     isBroadcaster, 
//     registerStreamHandlers,
//     createPeerConnection,
//     emitWebRTCOffer,
//     emitWebRTCAnswer,
//     emitReconnectRequest
//   ]); // FIXED: Removed currentStreamId from dependencies

//   // Start broadcasting - emit broadcaster ready
//   const startBroadcasting = useCallback(async () => {
//     console.log('🎤 Checking broadcasting preconditions...');
//     console.log('  - isBroadcaster:', isBroadcaster);
//     console.log('  - currentStreamId:', currentStreamId);
//     console.log('  - socket:', !!socket);
//     console.log('  - isConnected:', isConnected);
//     console.log('  - localStreamRef.current:', !!localStreamRef.current);
    
//     if (!isBroadcaster) {
//       console.warn('⚠ Cannot start broadcasting: Not a broadcaster');
//       setWebRTCError('Cannot start broadcast: Not configured as broadcaster.');
//       return false;
//     }
    
//     if (!currentStreamId) {
//       console.warn('⚠ Cannot start broadcasting: No streamId provided');
//       setWebRTCError('Cannot start broadcast: No stream ID.');
//       return false;
//     }
    
//     if (!socket || !isConnected) {
//       console.warn('⚠ Cannot start broadcasting: Socket not connected');
//       setWebRTCError('Cannot start broadcast: Not connected to server.');
//       return false;
//     }
    
//     if (!localStreamRef.current) {
//       console.warn('⚠ Cannot start broadcasting: No local stream available');
//       setWebRTCError('Cannot start broadcast: Camera/microphone not ready.');
//       return false;
//     }

//     console.log(`🎤 Starting broadcast for stream: ${currentStreamId}`);
//     try {
//       const success = emitBroadcasterReady(currentStreamId);
//       if (!success) {
//         throw new Error('Failed to emit broadcaster ready');
//       }
//       console.log('✅ Broadcaster ready signal sent');
//       return true;
//     } catch (error) {
//       console.error('❌ Error starting broadcast:', error);
//       setWebRTCError(`Failed to start broadcast: ${error.message}`);
//       return false;
//     }
//   }, [isBroadcaster, currentStreamId, socket, isConnected, emitBroadcasterReady]);

//   // Join stream as viewer
//   const joinStream = useCallback((targetStreamId) => {
//     if (isBroadcaster) {
//       console.warn('⚠ joinStream called for broadcaster, ignoring.');
//       return false;
//     }

//     if (!socket || !isConnected || !targetStreamId) {
//       console.warn('⚠ Cannot join stream: socket not connected or no streamId');
//       setWebRTCError('Cannot join stream: Not connected.');
//       return false;
//     }

//     console.log(`🎥 Joining stream as viewer: ${targetStreamId}`);
    
//     // FIXED: Clear any previous connection state
//     if (viewerPeerConnectionRef.current) {
//       viewerPeerConnectionRef.current.close();
//       viewerPeerConnectionRef.current = null;
//     }
//     currentPeerConnectionIdRef.current = null;
//     setIsWebRTCConnected(false);
//     setRemoteStream(null);
//     setWebRTCError(null);
    
//     try {
//       const success = emitViewerJoin(targetStreamId);
//       if (!success) {
//         throw new Error('Failed to emit viewer join');
//       }
//       console.log('✅ Viewer join signal sent');
//       return true;
//     } catch (error) {
//       console.error('❌ Error joining stream:', error);
//       setWebRTCError(`Failed to join stream: ${error.message}`);
//       return false;
//     }
//   }, [isBroadcaster, socket, isConnected, emitViewerJoin]);

//   return {
//     // States
//     localStream,
//     remoteStream,
//     isWebRTCConnected,
//     webRTCError,
//     iceServers,
//     connectedViewers,

//     // Functions for Broadcaster
//     initializeLocalStream,
//     startBroadcasting,

//     // Functions for Viewer
//     joinStream,

//     // General Functions
//     cleanupWebRTC,

//     // ADDED: Expose the streamId setter for manual updates if needed
//     setStreamId: setCurrentStreamId,
//     currentStreamId, // Expose current streamId for debugging
//   };
// };

// export default useWebRTC;