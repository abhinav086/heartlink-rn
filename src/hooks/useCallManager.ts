// // src/hooks/useCallManager.ts
// import { useState, useEffect, useRef } from 'react';
// import { AppState, Platform } from 'react-native';
// import RtcEngine from 'react-native-agora';
// import { 
//   CallData, 
//   CallState, 
//   CallType,
//   requestCallPermissions 
// } from '../utils/AgoraUtils';
// import { AGORA_CONFIG } from '../config/AgoraConfig';

// interface UseCallManagerProps {
//   callData: CallData;
//   isOutgoing: boolean;
//   onCallEnd?: () => void;
//   onCallConnect?: () => void;
//   onError?: (error: string) => void;
// }

// interface UseCallManagerReturn {
//   engine: RtcEngine | null;
//   callState: CallState;
//   callDuration: number;
//   isInitialized: boolean;
//   remoteUserJoined: boolean;
//   // Audio controls
//   isMuted: boolean;
//   isSpeakerOn: boolean;
//   toggleMute: () => Promise<void>;
//   toggleSpeaker: () => Promise<void>;
//   // Video controls (if video call)
//   isVideoEnabled: boolean;
//   isFrontCamera: boolean;
//   remoteVideoEnabled: boolean;
//   toggleVideo: () => Promise<void>;
//   switchCamera: () => Promise<void>;
//   // Call controls
//   endCall: () => Promise<void>;
//   cleanup: () => Promise<void>;
// }

// export const useCallManager = ({
//   callData,
//   isOutgoing,
//   onCallEnd,
//   onCallConnect,
//   onError,
// }: UseCallManagerProps): UseCallManagerReturn => {
//   const [engine, setEngine] = useState<RtcEngine | null>(null);
//   const [callState, setCallState] = useState<CallState>(
//     isOutgoing ? CallState.CALLING : CallState.CONNECTING
//   );
//   const [callDuration, setCallDuration] = useState(0);
//   const [isInitialized, setIsInitialized] = useState(false);
//   const [remoteUserJoined, setRemoteUserJoined] = useState(false);
  
//   // Audio state
//   const [isMuted, setIsMuted] = useState(false);
//   const [isSpeakerOn, setIsSpeakerOn] = useState(callData.callType === CallType.VIDEO);
  
//   // Video state
//   const [isVideoEnabled, setIsVideoEnabled] = useState(callData.callType === CallType.VIDEO);
//   const [isFrontCamera, setIsFrontCamera] = useState(true);
//   const [remoteVideoEnabled, setRemoteVideoEnabled] = useState(true);

//   const engineRef = useRef<RtcEngine | null>(null);
//   const callStartTimeRef = useRef<number | null>(null);
//   const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

//   // Initialize call
//   useEffect(() => {
//     let mounted = true;

//     const initCall = async () => {
//       try {
//         const hasPermissions = await requestCallPermissions();
//         if (!hasPermissions) {
//           onError?.('Permissions required for calls');
//           return;
//         }

//         if (mounted) {
//           await initializeEngine();
//         }
//       } catch (error) {
//         onError?.(error.message);
//       }
//     };

//     initCall();

//     return () => {
//       mounted = false;
//       cleanup();
//     };
//   }, []);

//   // Handle app state changes
//   useEffect(() => {
//     const handleAppStateChange = (nextAppState: string) => {
//       if (callData.callType === CallType.VIDEO && engineRef.current) {
//         if (nextAppState === 'background' && isVideoEnabled) {
//           engineRef.current.muteLocalVideoStream(true);
//         } else if (nextAppState === 'active' && isVideoEnabled) {
//           engineRef.current.muteLocalVideoStream(false);
//         }
//       }
//     };

//     const subscription = AppState.addEventListener('change', handleAppStateChange);
//     return () => subscription?.remove();
//   }, [isVideoEnabled]);

//   const initializeEngine = async () => {
//     try {
//       console.log(`Initializing ${callData.callType} call...`);
      
//       const rtcEngine = await RtcEngine.create(AGORA_CONFIG.APP_ID);
//       engineRef.current = rtcEngine;
//       setEngine(rtcEngine);

//       await setupEventListeners(rtcEngine);
//       await configureEngine(rtcEngine);

//       setIsInitialized(true);

//       const token = callData.token || null;
//       await rtcEngine.joinChannel(token, callData.channelName, null, 0);

//     } catch (error) {
//       console.error('Error initializing engine:', error);
//       onError?.(error.message);
//     }
//   };

//   const setupEventListeners = async (rtcEngine: RtcEngine) => {
//     rtcEngine.addListener('JoinChannelSuccess', (channel, uid) => {
//       console.log('Joined channel successfully:', channel, uid);
//       setCallState(CallState.CONNECTING);
//     });

//     rtcEngine.addListener('UserJoined', (uid) => {
//       console.log('Remote user joined:', uid);
//       setRemoteUserJoined(true);
//       setCallState(CallState.CONNECTED);
//       startCallTimer();
//       onCallConnect?.();
//     });

//     rtcEngine.addListener('UserOffline', (uid, reason) => {
//       console.log('Remote user left:', uid, reason);
//       setRemoteUserJoined(false);
//       endCall();
//     });

//     rtcEngine.addListener('Error', (errorCode) => {
//       console.error('Agora Error:', errorCode);
//       setCallState(CallState.FAILED);
//       onError?.(`Call error: ${errorCode}`);
//     });

//     if (callData.callType === CallType.VIDEO) {
//       rtcEngine.addListener('RemoteVideoStateChanged', (uid, state) => {
//         setRemoteVideoEnabled(state === 2); // REMOTE_VIDEO_STATE_DECODING
//       });
//     }
//   };

//   const configureEngine = async (rtcEngine: RtcEngine) => {
//     // Common configuration
//     await rtcEngine.setChannelProfile(1); // Communication
//     await rtcEngine.setClientRole(1); // Broadcaster

//     // Audio configuration
//     await rtcEngine.setAudioProfile(1, 1); // SPEECH_STANDARD
//     await rtcEngine.enableAudio();

//     if (callData.callType === CallType.VIDEO) {
//       // Video configuration
//       await rtcEngine.setVideoEncoderConfiguration({
//         width: 640,
//         height: 480,
//         frameRate: 15,
//         bitrate: 500,
//         orientationMode: 0,
//       });
//       await rtcEngine.enableVideo();
//       await rtcEngine.startPreview();
//       await rtcEngine.setDefaultAudioRoutetoSpeakerphone(true);
//     } else {
//       await rtcEngine.setDefaultAudioRoutetoSpeakerphone(false);
//     }
//   };

//   const startCallTimer = () => {
//     callStartTimeRef.current = Date.now();
//     durationIntervalRef.current = setInterval(() => {
//       if (callStartTimeRef.current) {
//         const duration = Date.now() - callStartTimeRef.current;
//         setCallDuration(duration);
//       }
//     }, 1000);
//   };

//   const stopCallTimer = () => {
//     if (durationIntervalRef.current) {
//       clearInterval(durationIntervalRef.current);
//       durationIntervalRef.current = null;
//     }
//   };

//   const toggleMute = async () => {
//     if (engineRef.current && isInitialized) {
//       try {
//         await engineRef.current.muteLocalAudioStream(!isMuted);
//         setIsMuted(!isMuted);
//       } catch (error) {
//         console.error('Error toggling mute:', error);
//       }
//     }
//   };

//   const toggleSpeaker = async () => {
//     if (engineRef.current && isInitialized) {
//       try {
//         await engineRef.current.setDefaultAudioRoutetoSpeakerphone(!isSpeakerOn);
//         setIsSpeakerOn(!isSpeakerOn);
//       } catch (error) {
//         console.error('Error toggling speaker:', error);
//       }
//     }
//   };

//   const toggleVideo = async () => {
//     if (engineRef.current && isInitialized && callData.callType === CallType.VIDEO) {
//       try {
//         await engineRef.current.muteLocalVideoStream(!isVideoEnabled);
//         setIsVideoEnabled(!isVideoEnabled);
//       } catch (error) {
//         console.error('Error toggling video:', error);
//       }
//     }
//   };

//   const switchCamera = async () => {
//     if (engineRef.current && isInitialized && callData.callType === CallType.VIDEO) {
//       try {
//         await engineRef.current.switchCamera();
//         setIsFrontCamera(!isFrontCamera);
//       } catch (error) {
//         console.error('Error switching camera:', error);
//       }
//     }
//   };

//   const endCall = async () => {
//     console.log('Ending call...');
//     stopCallTimer();
//     setCallState(CallState.ENDED);

//     if (engineRef.current) {
//       try {
//         if (callData.callType === CallType.VIDEO) {
//           await engineRef.current.stopPreview();
//         }
//         await engineRef.current.leaveChannel();
//       } catch (error) {
//         console.error('Error leaving channel:', error);
//       }
//     }

//     onCallEnd?.();
//   };

//   const cleanup = async () => {
//     console.log('Cleaning up call...');
//     stopCallTimer();
    
//     if (engineRef.current) {
//       try {
//         if (callData.callType === CallType.VIDEO) {
//           await engineRef.current.stopPreview();
//         }
//         await engineRef.current.leaveChannel();
//         await engineRef.current.destroy();
//         engineRef.current = null;
//       } catch (error) {
//         console.error('Error during cleanup:', error);
//       }
//     }
    
//     setEngine(null);
//     setIsInitialized(false);
//   };

//   return {
//     engine,
//     callState,
//     callDuration,
//     isInitialized,
//     remoteUserJoined,
//     // Audio controls
//     isMuted,
//     isSpeakerOn,
//     toggleMute,
//     toggleSpeaker,
//     // Video controls
//     isVideoEnabled,
//     isFrontCamera,
//     remoteVideoEnabled,
//     toggleVideo,
//     switchCamera,
//     // Call controls
//     endCall,
//     cleanup,
//   };
// };