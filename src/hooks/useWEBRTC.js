// src/hooks/useWebRTC.js
import { useState, useEffect, useRef, useCallback } from 'react';
import { useSocket } from '../context/SocketContext'; // Adjust path as needed
import { mediaDevices } from 'react-native-webrtc'; // Import only what's needed
import { Platform, PermissionsAndroid } from 'react-native';

const useWebRTC = (isBroadcaster, streamId) => {
  const { socket, isConnected } = useSocket();

  // Refs for WebRTC objects
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);

  // States exposed to components
  const [localStream, setLocalStream] = useState(null); // MediaStream object for broadcaster's camera/mic
  const [remoteStream, setRemoteStream] = useState(null); // MediaStream object for viewer's received stream
  const [isWebRTCConnected, setIsWebRTCConnected] = useState(false);
  const [webRTCError, setWebRTCError] = useState(null);
  const [iceServers, setIceServers] = useState([{ urls: 'stun:stun.l.google.com:19302' }]); // Default fallback

  // Cleanup function
  const cleanupWebRTC = useCallback(() => {
    console.log('🧹 Cleaning up WebRTC resources...');
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        console.log(`  - Stopping local track: ${track.kind}`);
        track.stop();
      });
      localStreamRef.current = null;
      setLocalStream(null);
    }
    if (peerConnectionRef.current) {
      console.log('  - Closing RTCPeerConnection');
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    setRemoteStream(null);
    setIsWebRTCConnected(false);
    setWebRTCError(null);
    // Note: We don't clear iceServers here as they might be needed for reconnection
  }, []);

  // Request permissions (Android specific)
  const requestPermissions = useCallback(async () => {
    if (Platform.OS !== 'android') {
      return true; // Permissions for iOS are usually handled in Info.plist
    }
    try {
      console.log('📱 Requesting Android permissions...');
      const cameraPermission = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.CAMERA,
        {
          title: 'Camera Permission',
          message: 'App needs access to your camera for live streaming.',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        },
      );
      const audioPermission = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        {
          title: 'Microphone Permission',
          message: 'App needs access to your microphone for live streaming.',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        },
      );
      const granted = cameraPermission === PermissionsAndroid.RESULTS.GRANTED &&
                      audioPermission === PermissionsAndroid.RESULTS.GRANTED;
      console.log(`  Permissions granted: ${granted}`);
      return granted;
    } catch (err) {
      console.error('❌ Permission request error:', err);
      setWebRTCError('Failed to get required permissions.');
      return false;
    }
  }, []);

  // Initialize local media stream for the broadcaster
  const initializeLocalStream = useCallback(async () => {
    if (!isBroadcaster) {
      console.log('🚫 initializeLocalStream called for viewer, ignoring.');
      return true; // Viewer doesn't need a local stream initially
    }

    console.log('📹 Initializing local media stream...');
    const hasPermission = await requestPermissions();
    if (!hasPermission) {
      setWebRTCError('Camera and Microphone permissions are required.');
      return false;
    }

    try {
      // Clean up any existing local stream
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }

      const stream = await mediaDevices.getUserMedia({
        audio: true,
        video: {
          facingMode: 'user', // Prefer front camera
          // You can add constraints like width, height, frameRate here
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      console.log('✅ Local media stream acquired.');
      localStreamRef.current = stream;
      setLocalStream(stream);
      return true;
    } catch (error) {
      console.error('❌ Error getting user media:', error);
      setWebRTCError(`Could not access media devices: ${error.message}`);
      return false;
    }
  }, [isBroadcaster, requestPermissions]);

  // Create and configure RTCPeerConnection
  const createPeerConnection = useCallback(async (providedIceServers = null) => {
    console.log('🔗 Creating RTCPeerConnection...');

    // Import RTCPeerConnection inside the function to ensure it's available
    // This is sometimes necessary in React Native module setups
    const { RTCPeerConnection } = require('react-native-webrtc');

    // Use provided ICE servers (from backend) or fallback
    const serversToUse = providedIceServers || iceServers;
    setIceServers(serversToUse); // Update state with latest servers

    try {
      if (peerConnectionRef.current) {
        console.log('  - Closing existing RTCPeerConnection');
        peerConnectionRef.current.close();
      }

      const pc = new RTCPeerConnection({ iceServers: serversToUse });
      console.log('  - RTCPeerConnection created with ICE servers:', serversToUse);

      // --- Event Listeners for the PeerConnection ---

      pc.onicecandidate = (event) => {
        console.log('📡 onicecandidate event:', event.candidate ? 'Candidate found' : 'Gathering completed');
        if (event.candidate && socket && isConnected && streamId) { // Ensure streamId is available
          // --- Corrected Event Name and Payload ---
          socket.emit('webrtc:ice_candidate', {
            streamId: streamId,
            candidate: event.candidate,
            // target is usually handled by the server based on streamId or sender/receiver logic
            // Removed 'target' as per typical simplified signaling or server-side routing
          });
          console.log('  - Emitted ICE candidate via socket.');
        }
      };

      pc.oniceconnectionstatechange = () => {
        console.log(`  - ICE Connection State changed: ${pc.iceConnectionState}`);
        if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
            setIsWebRTCConnected(true);
            setWebRTCError(null);
        } else if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
            setIsWebRTCConnected(false);
            // Optionally trigger a reconnection attempt or error state
            if (pc.iceConnectionState === 'failed') {
                 setWebRTCError('WebRTC connection failed.');
                 console.error('🚨 WebRTC ICE connection failed.');
            }
        }
      };

      pc.onconnectionstatechange = () => {
        console.log(`  - PeerConnection State changed: ${pc.connectionState}`);
        if (pc.connectionState === 'connected') {
            // Connection is established
        } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
            setIsWebRTCConnected(false);
            if (pc.connectionState === 'failed') {
                setWebRTCError('WebRTC peer connection failed.');
                console.error('🚨 WebRTC peer connection failed.');
            }
        } else if (pc.connectionState === 'closed') {
            setIsWebRTCConnected(false);
            console.log('  - PeerConnection closed.');
        }
      };

      pc.onsignalingstatechange = () => {
        console.log(`  - Signaling State changed: ${pc.signalingState}`);
      };

      // --- Track Handling ---
      if (isBroadcaster) {
        // Add local tracks to the connection for sending
        if (localStreamRef.current) {
          console.log('  - Adding local tracks to PeerConnection...');
          localStreamRef.current.getTracks().forEach(track => {
            pc.addTrack(track, localStreamRef.current);
            console.log(`    - Added track: ${track.kind}`);
          });
        } else {
            console.warn('  - No local stream available to add tracks from.');
            // Depending on logic, you might want to wait or handle this differently
        }
      } else {
        // Listen for remote tracks being added (for viewers)
        pc.ontrack = (event) => {
          console.log(`📥 ontrack event: Received remote track kind '${event.track.kind}'`);
          // event.streams[0] is the MediaStream containing the track
          if (event.streams && event.streams[0]) {
            console.log('  - Setting remote stream.');
            setRemoteStream(event.streams[0]);
          }
        };
      }

      peerConnectionRef.current = pc;
      console.log('✅ RTCPeerConnection setup complete.');
      return pc;
    } catch (error) {
      console.error('❌ Error creating RTCPeerConnection:', error);
      setWebRTCError(`Failed to create peer connection: ${error.message}`);
      return null;
    }
  }, [isBroadcaster, socket, isConnected, streamId, iceServers, localStreamRef]); // Added localStreamRef dependency

  // --- Broadcaster Specific Functions ---

  // Create WebRTC offer and signal readiness
  const createOfferAndSignal = useCallback(async () => {
    if (!isBroadcaster || !streamId || !socket || !isConnected) {
      console.warn('⚠️ createOfferAndSignal: Preconditions not met (broadcaster, streamId, socket).');
      setWebRTCError('Cannot start broadcast: Not ready.');
      return false;
    }
    if (!peerConnectionRef.current) {
      // Ensure PeerConnection is created if not already
      console.log('  - PeerConnection not found, creating one...');
      const pc = await createPeerConnection(); // Use default/fallback ICE servers here, or pass specific ones if available
      if (!pc) {
         console.error('❌ Failed to create PeerConnection for broadcaster.');
         setWebRTCError('Failed to initialize connection.');
         return false;
      }
      // peerConnectionRef.current is now set inside createPeerConnection
    }

    if (!peerConnectionRef.current) { // Double-check after potential creation
      console.error('❌ Cannot create offer: PeerConnection not initialized.');
      setWebRTCError('Peer connection not ready.');
      return false;
    }

    console.log('🎤 Creating WebRTC Offer...');
    try {
      const pc = peerConnectionRef.current;
      const offer = await pc.createOffer();
      console.log('  - Offer created.');

      await pc.setLocalDescription(offer);
      console.log('  - Local description (offer) set.');

      // --- Corrected Event Name ---
      console.log(`📡 Signaling broadcaster readiness for stream ${streamId}...`);
      socket.emit('stream:broadcaster_ready', { // <--- Correct Event Name
        streamId: streamId,
        offer: pc.localDescription, // Send the full offer object
      });
      console.log('✅ Offer sent via socket (stream:broadcaster_ready).');
      return true;
    } catch (error) {
      console.error('❌ Error creating or sending offer:', error);
      setWebRTCError(`Failed to start broadcast: ${error.message}`);
      return false;
    }
  }, [isBroadcaster, streamId, socket, isConnected, createPeerConnection]); // Added createPeerConnection dependency

  // --- Viewer Specific Functions ---

  // Handle receiving an offer from the broadcaster (via socket)
  // This is typically called from the parent component when 'stream:joined' is received
  const handleReceivedOffer = useCallback(async (offerData) => {
    if (isBroadcaster) {
      console.warn('⚠️ handleReceivedOffer called for broadcaster, ignoring.');
      return;
    }
    if (!streamId || !offerData.offer || !offerData.iceServers) {
      console.error('❌ Invalid offer data received:', offerData);
      setWebRTCError('Invalid stream offer received.');
      return false;
    }

    console.log('📥 Handling received WebRTC Offer...');
    try {
      // 1. Create PeerConnection with provided ICE servers
      await createPeerConnection(offerData.iceServers);

      if (!peerConnectionRef.current) {
        throw new Error('Failed to create PeerConnection for viewer.');
      }

      const pc = peerConnectionRef.current;

      // 2. Set the remote description (the broadcaster's offer)
      console.log('  - Setting remote description (offer)...');
      await pc.setRemoteDescription(new RTCSessionDescription(offerData.offer)); // Ensure RTCSessionDescription is imported if needed
      console.log('  - Remote description set.');

      // 3. Create an answer
      console.log('  - Creating WebRTC Answer...');
      const answer = await pc.createAnswer();
      console.log('  - Answer created.');

      // 4. Set the local description (our answer)
      console.log('  - Setting local description (answer)...');
      await pc.setLocalDescription(answer);
      console.log('  - Local description set.');

      // 5. Send the answer back to the broadcaster via socket
      // --- Corrected Event Name ---
      console.log(`📡 Sending WebRTC Answer for stream ${streamId}...`);
      socket.emit('webrtc:answer', { // <--- Correct Event Name for Viewer's Answer
        streamId: streamId,
        answer: pc.localDescription, // Send the full answer object
      });
      console.log('✅ Answer sent via socket (webrtc:answer).');

      return true;
    } catch (error) {
      console.error('❌ Error handling received offer:', error);
      setWebRTCError(`Failed to connect to stream: ${error.message}`);
      cleanupWebRTC(); // Clean up on failure
      return false;
    }
  }, [isBroadcaster, streamId, socket, isConnected, createPeerConnection, cleanupWebRTC]); // Added isConnected dependency

   // Handle receiving an ICE candidate from the other peer (via socket)
  const handleReceivedIceCandidate = useCallback(async (candidateData) => {
    console.log('📥 Handling received ICE Candidate...');
    if (!peerConnectionRef.current) {
      console.warn('  - Ignoring ICE candidate, PeerConnection not ready.');
      // It's possible to queue candidates if PC isn't ready yet, but simpler to ignore for now.
      return;
    }

    try {
      // Ensure candidateData.candidate is a valid RTCIceCandidateInit object
      // Import RTCIceCandidate if needed, or ensure it's available from react-native-webrtc
      const { RTCIceCandidate } = require('react-native-webrtc');

      if (candidateData.candidate) {
        console.log('  - Adding ICE candidate...');
        await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidateData.candidate));
        console.log('  - ICE candidate added successfully.');
      } else {
        console.log('  - End of candidates signal received (null candidate).');
      }
    } catch (error) {
      console.error('❌ Error adding received ICE candidate:', error);
      // Don't necessarily set a fatal error here, just log it
    }
  }, []); // Minimal dependencies


  // Handle receiving an answer from a viewer (broadcaster side - via socket)
  const handleReceivedAnswer = useCallback(async (answerData) => {
     if (!isBroadcaster) {
        console.warn('⚠️ handleReceivedAnswer called for viewer, ignoring.');
        return;
     }
     console.log('📥 Handling received WebRTC Answer from viewer...');
     if (!peerConnectionRef.current) {
        console.error('❌ Cannot process answer: PeerConnection not initialized.');
        setWebRTCError('Cannot process viewer answer: Connection not ready.');
        return;
     }
     if (!answerData.answer) {
         console.error('❌ Invalid answer data received:', answerData);
         return;
     }

     try {
         // Ensure RTCSessionDescription is available
         const { RTCSessionDescription } = require('react-native-webrtc');

         console.log('  - Setting remote description (answer)...');
         await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answerData.answer));
         console.log('  - Remote description (answer) set successfully.');
     } catch (error) {
         console.error('❌ Error setting remote description (answer):', error);
         setWebRTCError(`Failed to connect viewer: ${error.message}`);
     }
  }, [isBroadcaster]);


  // --- Effect for Socket Listeners (Viewer Side) ---
  useEffect(() => {
    if (!socket || isBroadcaster || !streamId) return; // Only viewers for a specific stream need these listeners

    console.log('🔌 Setting up WebRTC socket listeners for viewer (streamId:', streamId, ')');

    const handleIceCandidate = (data) => {
      // Ensure the candidate is for the correct stream
      if (data.streamId === streamId) {
        console.log('📡 Socket: ICE candidate received (for viewer, streamId match)');
        handleReceivedIceCandidate(data);
      } else {
         console.log('📡 Socket: ICE candidate received (for viewer, streamId mismatch, ignoring)');
      }
    };

    // Viewers listen for ICE candidates from the broadcaster
    socket.on('webrtc:ice_candidate', handleIceCandidate);

    // Viewers do NOT listen for 'webrtc:viewer_answer'. That's for the broadcaster.
    // Viewers get the initial offer via the 'stream:joined' event (handled outside this hook)
    // and then send their answer using 'webrtc:answer'.

    return () => {
      console.log('🔌 Cleaning up WebRTC socket listeners for viewer (streamId:', streamId, ')');
      socket.off('webrtc:ice_candidate', handleIceCandidate);
      // No need to off 'webrtc:viewer_answer' as viewer doesn't listen to it
    };
  }, [socket, isBroadcaster, streamId, handleReceivedIceCandidate]);

  // --- Effect for Socket Listeners (Broadcaster Side) ---
  useEffect(() => {
    if (!socket || !isBroadcaster || !streamId) return; // Only broadcaster for a specific stream needs these listeners

    console.log('🔌 Setting up WebRTC socket listeners for broadcaster (streamId:', streamId, ')');

    const handleIceCandidate = (data) => {
       // Ensure the candidate is for the correct stream
      if (data.streamId === streamId) {
        console.log('📡 Socket: ICE candidate received (for broadcaster, streamId match)');
        handleReceivedIceCandidate(data);
      } else {
         console.log('📡 Socket: ICE candidate received (for broadcaster, streamId mismatch, ignoring)');
      }
    };

    const handleViewerAnswer = (data) => {
        // Ensure the answer is for the correct stream
        if (data.streamId === streamId) {
            // This is the correct event for the broadcaster to receive viewer answers
            console.log('📡 Socket: Viewer answer received (for broadcaster, streamId match)');
            handleReceivedAnswer(data);
        } else {
             console.log('📡 Socket: Viewer answer received (for broadcaster, streamId mismatch, ignoring)');
        }
    };

    // Broadcaster listens for ICE candidates from viewers
    socket.on('webrtc:ice_candidate', handleIceCandidate);
    // Broadcaster listens for answers from viewers
    socket.on('webrtc:viewer_answer', handleViewerAnswer); // <--- Correct Listener Name

    return () => {
      console.log('🔌 Cleaning up WebRTC socket listeners for broadcaster (streamId:', streamId, ')');
      socket.off('webrtc:ice_candidate', handleIceCandidate);
      socket.off('webrtc:viewer_answer', handleViewerAnswer);
    };
  }, [socket, isBroadcaster, streamId, handleReceivedIceCandidate, handleReceivedAnswer]);


  // Expose functions and state to the component using this hook
  return {
    // States
    localStream,
    remoteStream,
    isWebRTCConnected,
    webRTCError,
    iceServers,

    // Functions for Broadcaster
    initializeLocalStream, // Step 1 for broadcaster
    createPeerConnection,  // Step 2 for broadcaster (optional, createOfferAndSignal calls it)
    createOfferAndSignal,  // Step 3 for broadcaster

    // Functions for Viewer
    handleReceivedOffer,    // Called by parent when 'stream:joined' received
    handleReceivedIceCandidate, // Handled internally via socket listener
    handleReceivedAnswer,   // Handled internally via socket listener (broadcaster only)

    // General Functions
    cleanupWebRTC,
  };
};

export default useWebRTC;