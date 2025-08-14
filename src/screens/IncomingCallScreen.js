// src/screens/IncomingCallScreen.js - Enhanced Incoming Call Handler
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  Animated,
  BackHandler,
  StatusBar,
  Alert,
  SafeAreaView,
  Platform,
  Vibration,
  PermissionsAndroid,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import { useSocket } from '../context/SocketContext.js';
import { useAuth } from '../context/AuthContext.tsx';
import BASE_URL from '../config/config.js';

const { width, height } = Dimensions.get('window');

const IncomingCallScreen = ({ navigation, route }) => {
  const { socket } = useSocket();
  const { token, user: currentUser } = useAuth();
  
  // Call data from navigation params
  const {
    callId,
    caller,
    channelName,
    token: agoraToken,
    uid,
    appId,
    callType = 'video',
    expiresAt,
  } = route.params;

  // State management
  const [isProcessing, setIsProcessing] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [timeRemaining, setTimeRemaining] = useState(30);
  const [permissionsChecked, setPermissionsChecked] = useState(false);
  const [hasPermissions, setHasPermissions] = useState(false);

  // Animation refs
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(height)).current;
  const rippleAnim = useRef(new Animated.Value(0)).current;
  const buttonScaleAnim = useRef(new Animated.Value(1)).current;
  
  // Timers and refs
  const autoDeclineTimerRef = useRef(null);
  const countdownTimerRef = useRef(null);
  const pulseAnimationRef = useRef(null);
  const rippleAnimationRef = useRef(null);
  const vibrationPatternRef = useRef(null);

  // Check permissions when component mounts
  useEffect(() => {
    checkPermissions();
  }, []);

  useEffect(() => {
    if (permissionsChecked) {
      initializeIncomingCall();
    }
  }, [permissionsChecked]);

  const checkPermissions = async () => {
    if (Platform.OS === 'android') {
      try {
        const permissions = [PermissionsAndroid.PERMISSIONS.RECORD_AUDIO];
        
        if (callType === 'video') {
          permissions.push(PermissionsAndroid.PERMISSIONS.CAMERA);
        }

        const granted = await PermissionsAndroid.requestMultiple(permissions);
        
        const audioGranted = granted[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] === PermissionsAndroid.RESULTS.GRANTED;
        const cameraGranted = callType === 'video' 
          ? granted[PermissionsAndroid.PERMISSIONS.CAMERA] === PermissionsAndroid.RESULTS.GRANTED
          : true;

        setHasPermissions(audioGranted && cameraGranted);
      } catch (error) {
        console.error('Permission check error:', error);
        setHasPermissions(false);
      }
    } else {
      setHasPermissions(true); // iOS permissions handled in Info.plist
    }
    setPermissionsChecked(true);
  };

  const initializeIncomingCall = () => {
    // Slide in animation
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();

    // Start animations
    startPulseAnimation();
    startRippleAnimation();
    
    // Start vibration pattern
    startVibrationPattern();
    
    // Setup socket listeners
    setupSocketListeners();
    
    // Handle back button
    const backHandler = BackHandler.addEventListener('hardwareBackPress', handleBackPress);
    
    // Start countdown timer
    startCountdownTimer();
    
    // Auto-decline after time expires
    autoDeclineTimerRef.current = setTimeout(() => {
      if (!isProcessing) {
        handleDecline(true); // Auto decline
      }
    }, 30000);

    return () => {
      cleanup();
      backHandler.remove();
    };
  };

  const startPulseAnimation = () => {
    pulseAnimationRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    pulseAnimationRef.current.start();
  };

  const startRippleAnimation = () => {
    rippleAnimationRef.current = Animated.loop(
      Animated.timing(rippleAnim, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: true,
      })
    );
    rippleAnimationRef.current.start();
  };

  const startVibrationPattern = () => {
    // Vibration pattern for incoming call
    const pattern = [0, 1000, 1000, 1000, 1000];
    vibrationPatternRef.current = setInterval(() => {
      if (Platform.OS === 'android') {
        Vibration.vibrate(pattern);
      } else {
        Vibration.vibrate();
      }
    }, 3000);
  };

  const startCountdownTimer = () => {
    countdownTimerRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const cleanup = () => {
    // Stop animations
    if (pulseAnimationRef.current) {
      pulseAnimationRef.current.stop();
    }
    if (rippleAnimationRef.current) {
      rippleAnimationRef.current.stop();
    }
    
    // Clear timers
    if (autoDeclineTimerRef.current) {
      clearTimeout(autoDeclineTimerRef.current);
    }
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
    }
    if (vibrationPatternRef.current) {
      clearInterval(vibrationPatternRef.current);
    }
    
    // Stop vibration
    Vibration.cancel();
  };

  const setupSocketListeners = () => {
    if (!socket) return;

    socket.on('call_ended', (data) => {
      console.log('📞 Call ended remotely:', data);
      cleanup();
      navigation.goBack();
    });

    socket.on('call_cancelled', (data) => {
      console.log('📞 Call cancelled:', data);
      cleanup();
      navigation.goBack();
    });

    socket.on('call_timeout', (data) => {
      console.log('📞 Call timeout:', data);
      cleanup();
      navigation.goBack();
    });
  };

  const handleBackPress = () => {
    // Prevent back button during incoming call
    return true;
  };

  const getProfileImageUrl = (user) => {
    if (!user) return null;
    
    if (user.photoUrl && typeof user.photoUrl === 'string') {
      return user.photoUrl;
    }
    
    if (user.profilePicture && typeof user.profilePicture === 'string') {
      return user.profilePicture;
    }
    
    if (user.profilePic && typeof user.profilePic === 'string') {
      if (user.profilePic.startsWith('http://') || user.profilePic.startsWith('https://')) {
        return user.profilePic;
      }
      const cleanPath = user.profilePic.startsWith('/') ? user.profilePic.substring(1) : user.profilePic;
      return `${BASE_URL}/${cleanPath}`;
    }
    
    if (user.avatar && typeof user.avatar === 'string') {
      if (user.avatar.startsWith('http://') || user.avatar.startsWith('https://')) {
        return user.avatar;
      }
      const cleanPath = user.avatar.startsWith('/') ? user.avatar.substring(1) : user.avatar;
      return `${BASE_URL}/${cleanPath}`;
    }
    
    return null;
  };

  const getInitials = (fullName) => {
    if (!fullName) return '?';
    const names = fullName.trim().split(' ');
    if (names.length === 1) {
      return names[0].charAt(0).toUpperCase();
    }
    return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase();
  };

  const getAvatarColor = (name) => {
    const colors = [
      '#FF6B9D', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
      '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
    ];
    const charCodeSum = name.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
    return colors[charCodeSum % colors.length];
  };

  const animateButtonPress = (callback) => {
    Animated.sequence([
      Animated.timing(buttonScaleAnim, {
        toValue: 0.9,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(buttonScaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start(() => {
      if (callback) callback();
    });
  };

  const handleAccept = async () => {
    if (isProcessing) return;
    
    // Check permissions before accepting
    if (!hasPermissions) {
      Alert.alert(
        'Permissions Required',
        'Camera and microphone permissions are required to accept this call.',
        [
          { text: 'Cancel', onPress: () => handleDecline() },
          { text: 'Grant Permissions', onPress: () => checkPermissions() }
        ]
      );
      return;
    }
    
    animateButtonPress(async () => {
      try {
        setIsProcessing(true);
        console.log('✅ Accepting call:', callId);

        // Stop vibration and animations
        cleanup();

        // Call API to accept the call
        const response = await fetch(`${BASE_URL}/api/v1/agora/call/${callId}/accept`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        const data = await response.json();

        if (response.ok && data.success) {
          // Emit socket event
          if (socket) {
            socket.emit('call_accepted', { callId });
          }

          // Navigate to CallPage
          navigation.replace('CallPage', {
            callId,
            channelName: data.data?.channelName || channelName,
            token: data.data?.token || agoraToken,
            uid: data.data?.uid || uid,
            appId: data.data?.appId || appId,
            callType,
            isIncoming: true,
            caller,
            callee: currentUser,
            receiverId: caller?.id,
            receiverName: caller?.name || caller?.fullName,
            receiverData: caller,
          });
        } else {
          console.error('Failed to accept call:', data);
          setIsProcessing(false);
          Alert.alert(
            'Call Error',
            data.message || 'Failed to accept the call. Please try again.',
            [{ text: 'OK', onPress: () => navigation.goBack() }]
          );
        }

      } catch (error) {
        console.error('❌ Error accepting call:', error);
        setIsProcessing(false);
        
        Alert.alert(
          'Call Error',
          'Failed to accept the call. Please check your connection and try again.',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      }
    });
  };

  const handleDecline = async (isAutoDecline = false) => {
    if (isProcessing) return;
    
    animateButtonPress(async () => {
      try {
        setIsProcessing(true);
        console.log('❌ Declining call:', callId, isAutoDecline ? '(auto)' : '(manual)');

        // Stop vibration and animations
        cleanup();

        // Call API to decline the call
        const response = await fetch(`${BASE_URL}/api/v1/agora/call/${callId}/decline`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            reason: isAutoDecline ? 'timeout' : 'user_declined'
          }),
        });

        // Emit socket event regardless of API response
        if (socket) {
          socket.emit('call_declined', { 
            callId,
            reason: isAutoDecline ? 'timeout' : 'user_declined'
          });
        }

        // Navigate back
        navigation.goBack();

      } catch (error) {
        console.error('❌ Error declining call:', error);
        
        // Still emit socket event and go back
        if (socket) {
          socket.emit('call_declined', { 
            callId,
            reason: isAutoDecline ? 'timeout' : 'user_declined'
          });
        }
        
        navigation.goBack();
      }
    });
  };

  const handleQuickMessage = async () => {
    try {
      if (socket) {
        socket.emit('quick_message', {
          callId,
          recipientId: caller?.id,
          message: "Can't talk right now, I'll call you back later."
        });
      }
      handleDecline();
    } catch (error) {
      console.error('Error sending quick message:', error);
      handleDecline();
    }
  };

  const handleRemindMe = async () => {
    try {
      console.log('Setting reminder for call from:', caller?.name || caller?.fullName);
      // You can implement reminder logic here
      // For now, just decline the call
      handleDecline();
    } catch (error) {
      console.error('Error setting reminder:', error);
      handleDecline();
    }
  };

  const renderCallerInfo = () => {
    const profileImageUrl = getProfileImageUrl(caller);
    const safeFullName = caller?.fullName || caller?.name || 'Unknown Caller';
    
    return (
      <View style={styles.callerContainer}>
        <Animated.View 
          style={[
            styles.avatarContainer,
            { transform: [{ scale: pulseAnim }] }
          ]}
        >
          {/* Ripple effect */}
          <Animated.View
            style={[
              styles.ripple,
              {
                opacity: rippleAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.7, 0],
                }),
                transform: [
                  {
                    scale: rippleAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 2],
                    }),
                  },
                ],
              },
            ]}
          />
          
          {profileImageUrl ? (
            <Image 
              source={{ uri: profileImageUrl }} 
              style={styles.avatar}
              onError={(error) => {
                console.log('Profile image error:', error?.nativeEvent?.error || 'Unknown error');
              }}
            />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: getAvatarColor(safeFullName) }]}>
              <Text style={styles.avatarText}>
                {getInitials(safeFullName)}
              </Text>
            </View>
          )}
        </Animated.View>
        
        <Text style={styles.callerName}>{safeFullName}</Text>
        {caller?.username && (
          <Text style={styles.callerUsername}>@{caller.username}</Text>
        )}
        
        <Text style={styles.callTypeText}>
          Incoming {callType.charAt(0).toUpperCase() + callType.slice(1)} Call
        </Text>
        
        <View style={styles.statusContainer}>
          <Animated.View
            style={[
              styles.statusIndicator,
              {
                opacity: pulseAnim.interpolate({
                  inputRange: [1, 1.1],
                  outputRange: [0.5, 1],
                }),
              },
            ]}
          />
          <Text style={styles.statusText}>Ringing... ({timeRemaining}s)</Text>
        </View>

        {!hasPermissions && (
          <View style={styles.permissionWarning}>
            <Icon name="warning" size={20} color="#FFC107" />
            <Text style={styles.permissionWarningText}>
              Permissions required to accept call
            </Text>
          </View>
        )}
      </View>
    );
  };

  const renderCallActions = () => (
    <Animated.View 
      style={[
        styles.actionsContainer,
        { transform: [{ scale: buttonScaleAnim }] }
      ]}
    >
      {/* Decline button */}
      <TouchableOpacity
        style={[styles.actionButton, styles.declineButton]}
        onPress={() => handleDecline()}
        disabled={isProcessing}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={['#ff416c', '#ff4757']}
          style={styles.actionButtonGradient}
        >
          <Ionicons name="call" size={32} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
        </LinearGradient>
      </TouchableOpacity>

      {/* Accept button */}
      <TouchableOpacity
        style={[styles.actionButton, styles.acceptButton]}
        onPress={handleAccept}
        disabled={isProcessing || !hasPermissions}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={hasPermissions ? ['#00d2ff', '#3a7bd5'] : ['#666', '#888']}
          style={styles.actionButtonGradient}
        >
          <Ionicons name="call" size={32} color="#fff" />
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );

  const renderQuickActions = () => (
    <View style={styles.quickActionsContainer}>
      {/* Quick message */}
      <TouchableOpacity 
        style={styles.quickActionButton}
        onPress={handleQuickMessage}
        disabled={isProcessing}
      >
        <View style={styles.quickActionIcon}>
          <Icon name="message" size={20} color="#fff" />
        </View>
        <Text style={styles.quickActionText}>Message</Text>
      </TouchableOpacity>

      {/* Remind me */}
      <TouchableOpacity 
        style={styles.quickActionButton}
        onPress={handleRemindMe}
        disabled={isProcessing}
      >
        <View style={styles.quickActionIcon}>
          <Icon name="schedule" size={20} color="#fff" />
        </View>
        <Text style={styles.quickActionText}>Remind</Text>
      </TouchableOpacity>
    </View>
  );

  if (!permissionsChecked) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Checking permissions...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <Animated.View 
      style={[
        styles.container,
        { transform: [{ translateY: slideAnim }] }
      ]}
    >
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      
      {/* Background overlay */}
      <LinearGradient
        colors={['#2c3e50', '#3498db', '#9b59b6']}
        style={styles.backgroundGradient}
      >
        {caller?.photoUrl && (
          <Image 
            source={{ uri: getProfileImageUrl(caller) }} 
            style={styles.backgroundImage}
            blurRadius={20}
          />
        )}
      </LinearGradient>

      {/* Content */}
      <SafeAreaView style={styles.content}>
        {renderCallerInfo()}
        {renderQuickActions()}
        {renderCallActions()}
      </SafeAreaView>

      {/* Processing overlay */}
      {isProcessing && (
        <View style={styles.processingOverlay}>
          <View style={styles.processingContainer}>
            <Text style={styles.processingText}>
              {isProcessing ? 'Connecting...' : 'Processing...'}
            </Text>
          </View>
        </View>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: 'white',
    fontSize: 16,
  },
  backgroundGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  backgroundImage: {
    width: '100%',
    height: '100%',
    opacity: 0.3,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingVertical: 60,
    paddingHorizontal: 30,
  },
  callerContainer: {
    alignItems: 'center',
    marginTop: 80,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 30,
  },
  ripple: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#fff',
    top: -25,
    left: -25,
  },
  avatar: {
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 4,
    borderColor: '#fff',
  },
  avatarPlaceholder: {
    width: 150,
    height: 150,
    borderRadius: 75,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#fff',
  },
  avatarText: {
    color: '#fff',
    fontSize: 60,
    fontWeight: 'bold',
  },
  callerName: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 5,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10,
  },
  callerUsername: {
    color: '#e0e0e0',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10,
  },
  callTypeText: {
    color: '#fff',
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 20,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4CAF50',
    marginRight: 8,
  },
  statusText: {
    color: '#e0e0e0',
    fontSize: 16,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10,
  },
  permissionWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 193, 7, 0.2)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 10,
  },
  permissionWarningText: {
    color: '#FFC107',
    fontSize: 12,
    marginLeft: 5,
  },
  quickActionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 40,
    paddingHorizontal: 40,
  },
  quickActionButton: {
    alignItems: 'center',
    padding: 15,
  },
  quickActionIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  quickActionText: {
    color: '#fff',
    fontSize: 12,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10,
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 60,
  },
  actionButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  actionButtonGradient: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  declineButton: {
    // Styles handled by gradient
  },
  acceptButton: {
    // Styles handled by gradient
  },
  processingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  processingContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 30,
    paddingVertical: 20,
    borderRadius: 10,
  },
  processingText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});

export default IncomingCallScreen;