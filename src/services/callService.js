// src/services/CallService.js - API Service for Call Management
import BASE_URL from '../config/config';

/**
 * Call Service - Handles all call-related API operations
 */
export class CallService {
  constructor(authToken) {
    this.baseURL = BASE_URL;
    this.authToken = authToken;
  }

  /**
   * Set authentication token
   */
  setAuthToken(token) {
    this.authToken = token;
  }

  /**
   * Get common headers for API requests
   */
  getHeaders() {
    return {
      'Authorization': `Bearer ${this.authToken}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Handle API response
   */
  async handleResponse(response) {
    const contentType = response.headers.get('content-type');
    let data;

    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      const error = new Error(data.message || `HTTP error! status: ${response.status}`);
      error.status = response.status;
      error.data = data;
      throw error;
    }

    return data;
  }

  /**
   * Initiate a new call
   */
  async initiateCall(callData) {
    try {
      console.log('📞 Initiating call:', callData);

      const response = await fetch(`${this.baseURL}/api/v1/agora/call/initiate`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          receiverId: callData.receiverId,
          callType: callData.callType,
          metadata: callData.metadata || {},
        }),
      });

      const result = await this.handleResponse(response);
      console.log('✅ Call initiated successfully:', result);
      return result;
    } catch (error) {
      console.error('❌ Error initiating call:', error);
      throw error;
    }
  }

  /**
   * Accept an incoming call
   */
  async acceptCall(callId) {
    try {
      console.log('✅ Accepting call:', callId);

      const response = await fetch(`${this.baseURL}/api/v1/agora/call/${callId}/accept`, {
        method: 'POST',
        headers: this.getHeaders(),
      });

      const result = await this.handleResponse(response);
      console.log('✅ Call accepted successfully:', result);
      return result;
    } catch (error) {
      console.error('❌ Error accepting call:', error);
      throw error;
    }
  }

  /**
   * Decline an incoming call
   */
  async declineCall(callId, reason = 'user_declined') {
    try {
      console.log('❌ Declining call:', callId, 'reason:', reason);

      const response = await fetch(`${this.baseURL}/api/v1/agora/call/${callId}/decline`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ reason }),
      });

      const result = await this.handleResponse(response);
      console.log('❌ Call declined successfully:', result);
      return result;
    } catch (error) {
      console.error('❌ Error declining call:', error);
      throw error;
    }
  }

  /**
   * End an active call
   */
  async endCall(callId, duration, reason = 'user_ended') {
    try {
      console.log('🔚 Ending call:', callId, 'duration:', duration, 'reason:', reason);

      const response = await fetch(`${this.baseURL}/api/v1/agora/call/${callId}/end`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ duration, reason }),
      });

      const result = await this.handleResponse(response);
      console.log('🔚 Call ended successfully:', result);
      return result;
    } catch (error) {
      console.error('❌ Error ending call:', error);
      throw error;
    }
  }

  /**
   * Update call status
   */
  async updateCallStatus(callId, status, metadata = {}) {
    try {
      console.log('📝 Updating call status:', callId, 'status:', status);

      const response = await fetch(`${this.baseURL}/api/v1/agora/call/update-status`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ callId, status, metadata }),
      });

      const result = await this.handleResponse(response);
      console.log('📝 Call status updated successfully:', result);
      return result;
    } catch (error) {
      console.error('❌ Error updating call status:', error);
      throw error;
    }
  }

  /**
   * Get call details
   */
  async getCallDetails(callId) {
    try {
      console.log('📋 Getting call details:', callId);

      const response = await fetch(`${this.baseURL}/api/v1/agora/call/${callId}`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      const result = await this.handleResponse(response);
      console.log('📋 Call details retrieved:', result);
      return result;
    } catch (error) {
      console.error('❌ Error getting call details:', error);
      throw error;
    }
  }

  /**
   * Get call history
   */
  async getCallHistory(page = 1, limit = 20, filters = {}) {
    try {
      console.log('📚 Getting call history:', { page, limit, filters });

      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...filters,
      });

      const response = await fetch(`${this.baseURL}/api/v1/agora/call/history?${queryParams}`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      const result = await this.handleResponse(response);
      console.log('📚 Call history retrieved:', result);
      return result;
    } catch (error) {
      console.error('❌ Error getting call history:', error);
      throw error;
    }
  }

  /**
   * Report call quality
   */
  async reportCallQuality(callId, qualityData) {
    try {
      console.log('📊 Reporting call quality:', callId, qualityData);

      const response = await fetch(`${this.baseURL}/api/v1/agora/call/${callId}/quality`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          quality: qualityData.quality,
          metrics: qualityData.metrics,
          feedback: qualityData.feedback,
          timestamp: Date.now(),
        }),
      });

      const result = await this.handleResponse(response);
      console.log('📊 Call quality reported successfully:', result);
      return result;
    } catch (error) {
      console.error('❌ Error reporting call quality:', error);
      throw error;
    }
  }

  /**
   * Get Agora token for call
   */
  async getAgoraToken(channelName, uid, role = 'publisher') {
    try {
      console.log('🎫 Getting Agora token:', { channelName, uid, role });

      const response = await fetch(`${this.baseURL}/api/v1/agora/token`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ channelName, uid, role }),
      });

      const result = await this.handleResponse(response);
      console.log('🎫 Agora token retrieved successfully');
      return result;
    } catch (error) {
      console.error('❌ Error getting Agora token:', error);
      throw error;
    }
  }

  /**
   * Check if user is available for call
   */
  async checkUserAvailability(userId) {
    try {
      console.log('🔍 Checking user availability:', userId);

      const response = await fetch(`${this.baseURL}/api/v1/agora/user/${userId}/availability`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      const result = await this.handleResponse(response);
      console.log('🔍 User availability checked:', result);
      return result;
    } catch (error) {
      console.error('❌ Error checking user availability:', error);
      throw error;
    }
  }

  /**
   * Cancel a call
   */
  async cancelCall(callId, reason = 'user_cancelled') {
    try {
      console.log('🚫 Cancelling call:', callId, 'reason:', reason);

      const response = await fetch(`${this.baseURL}/api/v1/agora/call/${callId}/cancel`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ reason }),
      });

      const result = await this.handleResponse(response);
      console.log('🚫 Call cancelled successfully:', result);
      return result;
    } catch (error) {
      console.error('❌ Error cancelling call:', error);
      throw error;
    }
  }

  /**
   * Get active calls for user
   */
  async getActiveCalls() {
    try {
      console.log('📞 Getting active calls');

      const response = await fetch(`${this.baseURL}/api/v1/agora/call/active`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      const result = await this.handleResponse(response);
      console.log('📞 Active calls retrieved:', result);
      return result;
    } catch (error) {
      console.error('❌ Error getting active calls:', error);
      throw error;
    }
  }

  /**
   * Update user call preferences
   */
  async updateCallPreferences(preferences) {
    try {
      console.log('⚙️ Updating call preferences:', preferences);

      const response = await fetch(`${this.baseURL}/api/v1/agora/preferences`, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify(preferences),
      });

      const result = await this.handleResponse(response);
      console.log('⚙️ Call preferences updated successfully:', result);
      return result;
    } catch (error) {
      console.error('❌ Error updating call preferences:', error);
      throw error;
    }
  }

  /**
   * Get call statistics
   */
  async getCallStatistics(timeRange = '30d') {
    try {
      console.log('📈 Getting call statistics:', timeRange);

      const response = await fetch(`${this.baseURL}/api/v1/agora/statistics?range=${timeRange}`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      const result = await this.handleResponse(response);
      console.log('📈 Call statistics retrieved:', result);
      return result;
    } catch (error) {
      console.error('❌ Error getting call statistics:', error);
      throw error;
    }
  }
}

/**
 * Create singleton instance factory
 */
let callServiceInstance = null;

export const createCallService = (authToken) => {
  if (!callServiceInstance) {
    callServiceInstance = new CallService(authToken);
  } else {
    callServiceInstance.setAuthToken(authToken);
  }
  return callServiceInstance;
};

/**
 * Get existing instance
 */
export const getCallService = () => {
  if (!callServiceInstance) {
    throw new Error('CallService not initialized. Call createCallService first.');
  }
  return callServiceInstance;
};

/**
 * Destroy instance
 */
export const destroyCallService = () => {
  callServiceInstance = null;
};

/**
 * Helper functions for common call operations
 */
export const CallHelpers = {
  /**
   * Initiate a video call
   */
  async startVideoCall(receiverId, authToken, metadata = {}) {
    const service = createCallService(authToken);
    return await service.initiateCall({
      receiverId,
      callType: 'video',
      metadata,
    });
  },

  /**
   * Initiate an audio call
   */
  async startAudioCall(receiverId, authToken, metadata = {}) {
    const service = createCallService(authToken);
    return await service.initiateCall({
      receiverId,
      callType: 'audio',
      metadata,
    });
  },

  /**
   * Handle incoming call acceptance
   */
  async handleCallAcceptance(callId, authToken) {
    const service = createCallService(authToken);
    return await service.acceptCall(callId);
  },

  /**
   * Handle call ending with duration tracking
   */
  async handleCallEnd(callId, startTime, authToken, reason = 'user_ended') {
    const duration = startTime ? Math.floor((Date.now() - startTime) / 1000) : 0;
    const service = createCallService(authToken);
    return await service.endCall(callId, duration, reason);
  },

  /**
   * Check if user can receive calls
   */
  async canUserReceiveCalls(userId, authToken) {
    try {
      const service = createCallService(authToken);
      const availability = await service.checkUserAvailability(userId);
      return availability.available;
    } catch (error) {
      console.error('Error checking user availability:', error);
      return false;
    }
  },
};

export default CallService;