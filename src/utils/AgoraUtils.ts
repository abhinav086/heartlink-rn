// // src/utils/AgoraUtils.ts
// import { AGORA_CONFIG, DEV_MODE } from '../config/AgoraConfig';

// export enum CallType {
//   AUDIO = 'audio',
//   VIDEO = 'video',
// }

// export enum CallState {
//   IDLE = 'idle',
//   CALLING = 'calling',
//   CONNECTING = 'connecting',
//   CONNECTED = 'connected',
//   DECLINED = 'declined',
//   ENDED = 'ended',
//   FAILED = 'failed',
// }

// export interface CallData {
//   callId: string;
//   channelName: string;
//   callType: CallType;
//   callerId: string;
//   callerName: string;
//   receiverId: string;
//   receiverName: string;
//   token: string;
//   state: CallState;
//   startTime: number;
//   endTime?: number;
//   duration?: number;
// }

// export interface CallNotification {
//   callData: CallData;
//   type: 'incoming' | 'missed' | 'declined' | 'ended';
// }

// /**
//  * Generate a unique channel name for two users
//  */
// export const generateChannelName = (userId1: string, userId2: string): string => {
//   // Sort user IDs to ensure consistent channel names regardless of who initiates
//   const sortedIds = [userId1, userId2].sort();
//   const timestamp = Date.now();
//   return `call_${sortedIds[0]}_${sortedIds[1]}_${timestamp}`;
// };

// /**
//  * Generate Agora token for development/production
//  */
// export const generateAgoraToken = (
//   channelName: string,
//   uid: number = 0
// ): string => {
//   try {
//     if (DEV_MODE) {
//       // For development, return null which allows testing without token server
//       // Note: This only works if your Agora project has "Testing Mode" enabled
//       return '';
//     } else {
//       // In production, you should call your backend to generate proper tokens
//       // Example: return await fetch('/api/agora/token', { ... })
//       console.warn('Production token generation not implemented. Implement your token server.');
//       return '';
//     }
//   } catch (error) {
//     console.error('Error generating Agora token:', error);
//     return '';
//   }
// };

// /**
//  * Generate a unique call ID
//  */
// export const generateCallId = (): string => {
//   return `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
// };

// /**
//  * Validate channel name format
//  */
// export const isValidChannelName = (channelName: string): boolean => {
//   // Agora channel name requirements:
//   // - ASCII letters, numbers, and certain symbols
//   // - Cannot be empty
//   // - Max 64 characters
//   const channelRegex = /^[a-zA-Z0-9!#$%&()+\-:;<=.>?@\[\]^_`{|}~, ]{1,64}$/;
//   return channelRegex.test(channelName);
// };

// /**
//  * Format call duration from milliseconds to readable string
//  */
// export const formatCallDuration = (durationMs: number): string => {
//   const seconds = Math.floor(durationMs / 1000);
//   const minutes = Math.floor(seconds / 60);
//   const hours = Math.floor(minutes / 60);

//   if (hours > 0) {
//     return `${hours}:${(minutes % 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
//   } else {
//     return `${minutes}:${(seconds % 60).toString().padStart(2, '0')}`;
//   }
// };

// /**
//  * Get call type display name
//  */
// export const getCallTypeDisplayName = (callType: CallType): string => {
//   return callType === CallType.AUDIO ? 'Voice Call' : 'Video Call';
// };

// /**
//  * Create call data object
//  */
// export const createCallData = (
//   callerId: string,
//   callerName: string,
//   receiverId: string,
//   receiverName: string,
//   callType: CallType
// ): CallData => {
//   const channelName = generateChannelName(callerId, receiverId);
//   const token = generateAgoraToken(channelName);

//   return {
//     callId: generateCallId(),
//     channelName,
//     callType,
//     callerId,
//     callerName,
//     receiverId,
//     receiverName,
//     token,
//     state: CallState.CALLING,
//     startTime: Date.now(),
//   };
// };

// /**
//  * Audio quality settings
//  */
// export const AUDIO_PROFILES = {
//   SPEECH_STANDARD: {
//     profile: 1, // AUDIO_PROFILE_SPEECH_STANDARD
//     scenario: 1, // AUDIO_SCENARIO_DEFAULT
//   },
//   MUSIC_STANDARD: {
//     profile: 2, // AUDIO_PROFILE_MUSIC_STANDARD
//     scenario: 3, // AUDIO_SCENARIO_GAME_STREAMING
//   },
//   MUSIC_HIGH_QUALITY: {
//     profile: 4, // AUDIO_PROFILE_MUSIC_HIGH_QUALITY
//     scenario: 3, // AUDIO_SCENARIO_GAME_STREAMING
//   },
// };

// /**
//  * Video quality settings
//  */
// export const VIDEO_PROFILES = {
//   LOW: {
//     width: 320,
//     height: 240,
//     frameRate: 15,
//     bitrate: 200,
//   },
//   STANDARD: {
//     width: 640,
//     height: 480,
//     frameRate: 15,
//     bitrate: 500,
//   },
//   HIGH: {
//     width: 1280,
//     height: 720,
//     frameRate: 30,
//     bitrate: 1000,
//   },
// };

// /**
//  * Request permissions for calls
//  */
// export const requestCallPermissions = async (): Promise<boolean> => {
//   try {
//     const { PermissionsAndroid, Platform } = require('react-native');
    
//     if (Platform.OS === 'android') {
//       const permissions = [
//         PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
//         PermissionsAndroid.PERMISSIONS.CAMERA,
//       ];

//       const granted = await PermissionsAndroid.requestMultiple(permissions);
      
//       return (
//         granted[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] === PermissionsAndroid.RESULTS.GRANTED &&
//         granted[PermissionsAndroid.PERMISSIONS.CAMERA] === PermissionsAndroid.RESULTS.GRANTED
//       );
//     }
    
//     return true; // iOS permissions are handled in Info.plist
//   } catch (error) {
//     console.error('Error requesting permissions:', error);
//     return false;
//   }
// };