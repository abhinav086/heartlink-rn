// src/navigation/CallNavigation.js - Navigation Helper for Call Screens
import { CommonActions } from '@react-navigation/native';

/**
 * Call Navigation Helper
 * Manages navigation flow for call-related screens
 */
export class CallNavigation {
  /**
   * Navigate to incoming call screen
   */
  static navigateToIncomingCall(navigation, callData) {
    try {
      console.log('📱 Navigating to incoming call screen:', callData.callId);
      
      navigation.navigate('IncomingCallScreen', {
        callId: callData.callId,
        caller: callData.caller,
        channelName: callData.channelName,
        token: callData.token,
        uid: callData.uid,
        appId: callData.appId,
        callType: callData.callType,
        expiresAt: callData.expiresAt,
        metadata: callData.metadata,
      });
    } catch (error) {
      console.error('❌ Error navigating to incoming call:', error);
    }
  }

  /**
   * Navigate to call page (active call screen)
   */
  static navigateToCallPage(navigation, callData, options = {}) {
    try {
      console.log('📱 Navigating to call page:', callData.callId);
      
      const params = {
        callId: callData.callId,
        channelName: callData.channelName,
        token: callData.token,
        uid: callData.uid,
        appId: callData.appId,
        callType: callData.callType,
        isIncoming: callData.isIncoming || false,
        caller: callData.caller,
        callee: callData.callee,
        receiverId: callData.receiverId,
        receiverName: callData.receiverName,
        receiverData: callData.receiverData,
        metadata: callData.metadata,
      };

      if (options.replace) {
        navigation.replace('CallPage', params);
      } else {
        navigation.navigate('CallPage', params);
      }
    } catch (error) {
      console.error('❌ Error navigating to call page:', error);
    }
  }

  /**
   * Navigate to call screen (alternative call screen)
   */
  static navigateToCallScreen(navigation, callData, options = {}) {
    try {
      console.log('📱 Navigating to call screen:', callData.callId);
      
      const params = {
        callId: callData.callId,
        channelName: callData.channelName,
        token: callData.token,
        uid: callData.uid,
        appId: callData.appId,
        callType: callData.callType,
        isIncoming: callData.isIncoming || false,
        caller: callData.caller,
        callee: callData.callee,
        receiverId: callData.receiverId,
        receiverName: callData.receiverName,
        receiverData: callData.receiverData,
        metadata: callData.metadata,
      };

      if (options.replace) {
        navigation.replace('CallScreen', params);
      } else {
        navigation.navigate('CallScreen', params);
      }
    } catch (error) {
      console.error('❌ Error navigating to call screen:', error);
    }
  }

  /**
   * Exit call and return to previous screen
   */
  static exitCall(navigation, options = {}) {
    try {
      console.log('📱 Exiting call screen');
      
      if (options.resetToHome) {
        navigation.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [{ name: 'Home' }],
          })
        );
      } else if (options.popToTop) {
        navigation.popToTop();
      } else {
        navigation.goBack();
      }
    } catch (error) {
      console.error('❌ Error exiting call:', error);
      // Fallback: try to go back
      navigation.goBack();
    }
  }

  /**
   * Handle call rejection and navigation
   */
  static handleCallRejection(navigation, options = {}) {
    try {
      console.log('📱 Handling call rejection');
      
      if (options.showMessage) {
        // You could show a toast or alert here
        console.log('📱 Call was rejected');
      }
      
      this.exitCall(navigation, options);
    } catch (error) {
      console.error('❌ Error handling call rejection:', error);
    }
  }

  /**
   * Handle call completion and navigation
   */
  static handleCallCompletion(navigation, callData, options = {}) {
    try {
      console.log('📱 Handling call completion');
      
      if (options.showSummary && callData.duration > 0) {
        // Navigate to call summary screen if it exists
        navigation.replace('CallSummary', {
          callId: callData.callId,
          duration: callData.duration,
          callType: callData.callType,
          participant: callData.participant,
        });
      } else {
        this.exitCall(navigation, options);
      }
    } catch (error) {
      console.error('❌ Error handling call completion:', error);
      this.exitCall(navigation);
    }
  }

  /**
   * Start outgoing call flow
   */
  static startOutgoingCall(navigation, receiverData, callType = 'video') {
    try {
      console.log('📱 Starting outgoing call to:', receiverData.id);
      
      navigation.navigate('OutgoingCallScreen', {
        receiver: receiverData,
        callType: callType,
      });
    } catch (error) {
      console.error('❌ Error starting outgoing call:', error);
    }
  }

  /**
   * Navigate to call history
   */
  static navigateToCallHistory(navigation) {
    try {
      console.log('📱 Navigating to call history');
      navigation.navigate('CallHistory');
    } catch (error) {
      console.error('❌ Error navigating to call history:', error);
    }
  }

  /**
   * Navigate to call settings
   */
  static navigateToCallSettings(navigation) {
    try {
      console.log('📱 Navigating to call settings');
      navigation.navigate('CallSettings');
    } catch (error) {
      console.error('❌ Error navigating to call settings:', error);
    }
  }

  /**
   * Check if current screen is a call screen
   */
  static isCallScreen(routeName) {
    const callScreens = [
      'CallPage',
      'CallScreen', 
      'IncomingCallScreen',
      'OutgoingCallScreen',
      'CallSummary'
    ];
    return callScreens.includes(routeName);
  }

  /**
   * Get safe navigation params for call screens
   */
  static getSafeCallParams(routeParams) {
    const safeParams = {
      callId: routeParams?.callId || null,
      channelName: routeParams?.channelName || null,
      token: routeParams?.token || null,
      uid: routeParams?.uid || 0,
      appId: routeParams?.appId || null,
      callType: routeParams?.callType || 'video',
      isIncoming: routeParams?.isIncoming || false,
      caller: routeParams?.caller || null,
      callee: routeParams?.callee || null,
      receiverId: routeParams?.receiverId || null,
      receiverName: routeParams?.receiverName || 'Unknown',
      receiverData: routeParams?.receiverData || null,
      metadata: routeParams?.metadata || {},
    };

    // Validate required params
    const requiredParams = ['callId', 'channelName', 'token', 'appId'];
    const missingParams = requiredParams.filter(param => !safeParams[param]);
    
    if (missingParams.length > 0) {
      console.warn('⚠️ Missing required call params:', missingParams);
    }

    return safeParams;
  }

  /**
   * Handle deep linking to call screens
   */
  static handleCallDeepLink(navigation, linkData) {
    try {
      console.log('📱 Handling call deep link:', linkData);
      
      const { action, callId, ...params } = linkData;
      
      switch (action) {
        case 'incoming_call':
          this.navigateToIncomingCall(navigation, { callId, ...params });
          break;
        case 'join_call':
          this.navigateToCallPage(navigation, { callId, ...params });
          break;
        case 'call_history':
          this.navigateToCallHistory(navigation);
          break;
        default:
          console.warn('⚠️ Unknown call deep link action:', action);
      }
    } catch (error) {
      console.error('❌ Error handling call deep link:', error);
    }
  }

  /**
   * Handle system back button in call screens
   */
  static handleCallScreenBackButton(navigation, routeName, onEndCall) {
    if (this.isCallScreen(routeName)) {
      // In call screens, back button should end the call
      if (onEndCall) {
        onEndCall();
      } else {
        this.exitCall(navigation);
      }
      return true; // Prevent default back behavior
    }
    return false; // Allow default back behavior
  }

  /**
   * Reset navigation stack and go to home after call
   */
  static resetToHome(navigation) {
    try {
      console.log('📱 Resetting navigation to home');
      
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'HomeScreen' }], // Adjust based on your home screen name
        })
      );
    } catch (error) {
      console.error('❌ Error resetting to home:', error);
    }
  }

  /**
   * Navigate with call state preservation
   */
  static navigateWithCallState(navigation, screenName, params = {}, callState) {
    try {
      console.log('📱 Navigating with call state preservation');
      
      navigation.navigate(screenName, {
        ...params,
        preservedCallState: callState,
      });
    } catch (error) {
      console.error('❌ Error navigating with call state:', error);
    }
  }
}

/**
 * React Navigation Screen Options for Call Screens
 */
export const CallScreenOptions = {
  /**
   * Common options for all call screens
   */
  common: {
    headerShown: false,
    gestureEnabled: false, // Disable swipe gestures during calls
    cardStyleInterpolator: ({ current }) => ({
      cardStyle: {
        opacity: current.progress,
      },
    }),
  },

  /**
   * Incoming call screen options
   */
  incomingCall: {
    ...CallScreenOptions?.common,
    presentation: 'fullScreenModal', // iOS
    animationTypeForReplace: 'push',
  },

  /**
   * Active call screen options
   */
  activeCall: {
    ...CallScreenOptions?.common,
    presentation: 'card',
  },

  /**
   * Call summary screen options
   */
  callSummary: {
    headerShown: true,
    title: 'Call Summary',
    headerBackTitleVisible: false,
  },
};

/**
 * Call Navigation Guards
 */
export const CallNavigationGuards = {
  /**
   * Check if navigation is allowed during call
   */
  canNavigate(routeName, isInCall) {
    const allowedDuringCall = [
      'CallPage',
      'CallScreen',
      'IncomingCallScreen',
      'CallSettings',
    ];
    
    if (isInCall && !allowedDuringCall.includes(routeName)) {
      console.warn('⚠️ Navigation blocked during active call:', routeName);
      return false;
    }
    
    return true;
  },

  /**
   * Handle navigation conflicts
   */
  handleNavigationConflict(navigation, attemptedRoute, isInCall) {
    if (isInCall) {
      console.log('📱 Navigation conflict during call, staying on call screen');
      // Could show a warning toast here
      return false;
    }
    return true;
  },
};

export default CallNavigation;