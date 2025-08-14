// src/utils/CallUtils.js - Call Utility Functions and Helpers
import { Alert, Platform, PermissionsAndroid, Linking } from 'react-native';
import { RtcEngine } from 'react-native-agora';
import BASE_URL from '../config/config';

/**
 * Call Types
 */
export const CALL_TYPES = {
  VIDEO: 'video',
  AUDIO: 'audio'
};

/**
 * Call States
 */
export const CALL_STATES = {
  CONNECTING: 'connecting',
  WAITING: 'waiting',
  RINGING: 'ringing',
  CONNECTED: 'connected',
  RECONNECTING: 'reconnecting',
  ENDING: 'ending',
  ENDED: 'ended',
  FAILED: 'failed'
};

/**
 * Network Quality Levels
 */
export const NETWORK_QUALITY = {
  UNKNOWN: 'unknown',
  EXCELLENT: 'excellent',
  GOOD: 'good',
  FAIR: 'fair',
  POOR: 'poor'
};

/**
 * Permission Utils
 */
export class PermissionUtils {
  static async requestCallPermissions(callType) {
    if (Platform.OS === 'android') {
      try {
        const permissions = [PermissionsAndroid.PERMISSIONS.RECORD_AUDIO];
        
        if (callType === CALL_TYPES.VIDEO) {
          permissions.push(PermissionsAndroid.PERMISSIONS.CAMERA);
        }

        const granted = await PermissionsAndroid.requestMultiple(permissions);
        
        const audioGranted = granted[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] === PermissionsAndroid.RESULTS.GRANTED;
        const cameraGranted = callType === CALL_TYPES.VIDEO 
          ? granted[PermissionsAndroid.PERMISSIONS.CAMERA] === PermissionsAndroid.RESULTS.GRANTED
          : true;

        return {
          audio: audioGranted,
          camera: cameraGranted,
          all: audioGranted && cameraGranted
        };
      } catch (error) {
        console.error('Permission request error:', error);
        return { audio: false, camera: false, all: false };
      }
    }
    
    // iOS permissions are handled in Info.plist
    return { audio: true, camera: true, all: true };
  }

  static async checkCallPermissions(callType) {
    if (Platform.OS === 'android') {
      try {
        const audioPermission = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
        const cameraPermission = callType === CALL_TYPES.VIDEO 
          ? await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CAMERA)
          : true;

        return {
          audio: audioPermission,
          camera: cameraPermission,
          all: audioPermission && cameraPermission
        };
      } catch (error) {
        console.error('Permission check error:', error);
        return { audio: false, camera: false, all: false };
      }
    }
    
    return { audio: true, camera: true, all: true };
  }

  static showPermissionAlert(callType, onRetry, onCancel) {
    const permissionType = callType === CALL_TYPES.VIDEO ? 'Camera and microphone' : 'Microphone';
    
    Alert.alert(
      'Permissions Required',
      `${permissionType} permissions are required to ${callType === CALL_TYPES.VIDEO ? 'make video calls' : 'make voice calls'}.`,
      [
        { text: 'Cancel', onPress: onCancel, style: 'cancel' },
        { text: 'Grant Permissions', onPress: onRetry },
        { text: 'Settings', onPress: () => Linking.openSettings() }
      ]
    );
  }
}

/**
 * Call Duration Formatter
 */
export class CallTimer {
  static formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  static formatDurationText(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    }
    return `${secs}s`;
  }
}

/**
 * Network Quality Utils
 */
export class NetworkQualityUtils {
  static getQualityFromScore(txQuality, rxQuality) {
    const quality = Math.min(txQuality, rxQuality);
    
    if (quality <= 2) return NETWORK_QUALITY.EXCELLENT;
    else if (quality <= 3) return NETWORK_QUALITY.GOOD;
    else if (quality <= 4) return NETWORK_QUALITY.FAIR;
    else return NETWORK_QUALITY.POOR;
  }

  static getQualityColor(quality) {
    switch (quality) {
      case NETWORK_QUALITY.EXCELLENT: return '#4CAF50';
      case NETWORK_QUALITY.GOOD: return '#8BC34A';
      case NETWORK_QUALITY.FAIR: return '#FFC107';
      case NETWORK_QUALITY.POOR: return '#F44336';
      default: return '#9E9E9E';
    }
  }

  static getQualityIcon(quality) {
    switch (quality) {
      case NETWORK_QUALITY.EXCELLENT: return 'signal-cellular-4-bar';
      case NETWORK_QUALITY.GOOD: return 'signal-cellular-3-bar';
      case NETWORK_QUALITY.FAIR: return 'signal-cellular-2-bar';
      case NETWORK_QUALITY.POOR: return 'signal-cellular-1-bar';
      default: return 'signal-cellular-null';
    }
  }
}

/**
 * User Avatar Utils
 */
export class AvatarUtils {
  static getProfileImageUrl(user, baseUrl = BASE_URL) {
    if (!user) return null;
    
    // Check for different possible profile image properties
    const imageFields = ['photoUrl', 'profilePicture', 'profilePic', 'avatar'];
    
    for (const field of imageFields) {
      if (user[field] && typeof user[field] === 'string') {
        const imageUrl = user[field];
        
        // If it's already a full URL, return it
        if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
          return imageUrl;
        }
        
        // If it's a relative path, construct full URL
        const cleanPath = imageUrl.startsWith('/') ? imageUrl.substring(1) : imageUrl;
        return `${baseUrl}/${cleanPath}`;
      }
    }
    
    return null;
  }

  static getInitials(fullName) {
    if (!fullName) return '?';
    
    const names = fullName.trim().split(' ');
    if (names.length === 1) {
      return names[0].charAt(0).toUpperCase();
    }
    return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase();
  }

  static getAvatarColor(name) {
    const colors = [
      '#FF6B9D', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
      '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
      '#FF7675', '#74B9FF', '#00B894', '#FDCB6E', '#E17055',
      '#6C5CE7', '#A29BFE', '#FD79A8', '#00CEC9', '#55A3FF'
    ];
    
    const charCodeSum = name.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
    return colors[charCodeSum % colors.length];
  }
}

/**
 * Call State Manager
 */
export class CallStateManager {
  constructor(initialState = CALL_STATES.CONNECTING) {
    this.state = initialState;
    this.listeners = [];
  }

  setState(newState) {
    const oldState = this.state;
    this.state = newState;
    
    console.log(`📞 Call state changed: ${oldState} → ${newState}`);
    
    // Notify listeners
    this.listeners.forEach(listener => {
      try {
        listener(newState, oldState);
      } catch (error) {
        console.error('Error in call state listener:', error);
      }
    });
  }

  getState() {
    return this.state;
  }

  addListener(listener) {
    this.listeners.push(listener);
    
    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  isConnected() {
    return this.state === CALL_STATES.CONNECTED;
  }

  isEnding() {
    return this.state === CALL_STATES.ENDING || this.state === CALL_STATES.ENDED;
  }

  canToggleMedia() {
    return this.state === CALL_STATES.CONNECTED || this.state === CALL_STATES.WAITING;
  }
}

/**
 * Call Configuration
 */
export class CallConfig {
  static getDefaultVideoConfig() {
    return {
      dimensions: { width: 640, height: 480 },
      frameRate: 15,
      bitrate: 400,
    };
  }

  static getDefaultAudioConfig() {
    return {
      profile: 'SpeechStandard',
      scenario: 'ChatRoomEntertainment',
    };
  }

  static getChannelProfile() {
    return 'Communication';
  }

  static getClientRole() {
    return 'Broadcaster';
  }
}

/**
 * Call Error Handler
 */
export class CallErrorHandler {
  static handleAgoraError(errorCode, context = '') {
    console.error(`🚨 Agora Error ${errorCode} in ${context}`);
    
    const errorMessages = {
      1: 'General error',
      2: 'Invalid argument',
      3: 'SDK not ready',
      5: 'SDK refused the request',
      6: 'Buffer too small',
      7: 'SDK not initialized',
      9: 'No permission',
      10: 'Timed out',
      17: 'Join channel rejected',
      18: 'Leave channel rejected',
      19: 'Already in use',
      20: 'Aborted',
      101: 'Invalid app ID',
      102: 'Invalid channel name',
      103: 'Invalid token',
      109: 'Token expired',
      110: 'Invalid user ID',
      111: 'Not connected',
    };

    const message = errorMessages[errorCode] || `Unknown error (${errorCode})`;
    
    return {
      code: errorCode,
      message: message,
      context: context,
      isRecoverable: [6, 10, 17, 18].includes(errorCode)
    };
  }

  static showCallError(title, message, onRetry, onCancel) {
    const buttons = [
      { text: 'Cancel', onPress: onCancel, style: 'cancel' }
    ];
    
    if (onRetry) {
      buttons.push({ text: 'Retry', onPress: onRetry });
    }

    Alert.alert(title, message, buttons);
  }
}

/**
 * Call Analytics
 */
export class CallAnalytics {
  static trackCallStarted(callId, callType, participantCount) {
    console.log('📊 Call started:', { callId, callType, participantCount });
    // Implement your analytics tracking here
  }

  static trackCallEnded(callId, duration, endReason) {
    console.log('📊 Call ended:', { callId, duration, endReason });
    // Implement your analytics tracking here
  }

  static trackCallQuality(callId, quality, metrics) {
    console.log('📊 Call quality:', { callId, quality, metrics });
    // Implement your analytics tracking here
  }

  static trackNetworkIssue(callId, issueType, details) {
    console.log('📊 Network issue:', { callId, issueType, details });
    // Implement your analytics tracking here
  }
}

/**
 * Call Validation Utils
 */
export class CallValidation {
  static validateCallParams(params) {
    const required = ['callId', 'channelName', 'token', 'uid', 'appId', 'callType'];
    const missing = required.filter(param => !params[param]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required call parameters: ${missing.join(', ')}`);
    }

    if (!Object.values(CALL_TYPES).includes(params.callType)) {
      throw new Error(`Invalid call type: ${params.callType}`);
    }

    if (typeof params.uid !== 'number' || params.uid <= 0) {
      throw new Error(`Invalid UID: ${params.uid}`);
    }

    return true;
  }

  static validateUserData(user) {
    if (!user || !user._id) {
      throw new Error('Invalid user data');
    }
    return true;
  }
}

/**
 * Default Export - Combined Utils
 */
export default {
  CALL_TYPES,
  CALL_STATES,
  NETWORK_QUALITY,
  PermissionUtils,
  CallTimer,
  NetworkQualityUtils,
  AvatarUtils,
  CallStateManager,
  CallConfig,
  CallErrorHandler,
  CallAnalytics,
  CallValidation,
};