// components/IncomingCallModal.js - ENHANCED FOR BETTER INTEGRATION
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Dimensions,
  Image,
  Animated,
  StatusBar
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import BASE_URL from '../config/config';

const { width, height } = Dimensions.get('window');

const IncomingCallModal = ({
  visible,
  callerData,
  callType,
  onAccept,
  onDecline,
  onDismiss
}) => {
  const [pulseAnim] = useState(new Animated.Value(1));
  const [slideAnim] = useState(new Animated.Value(height));
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (visible) {
      console.log('📞 IncomingCallModal showing for:', callerData?.fullName || 'Unknown');
      
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();

      Animated.loop(
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
      ).start();
    } else {
      slideAnim.setValue(height);
      pulseAnim.setValue(1);
      setIsProcessing(false);
    }
  }, [visible, pulseAnim, slideAnim]);

  if (!visible || !callerData) return null;

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

  const getInitials = (name) => {
    if (!name) return '?';
    const names = name.trim().split(' ');
    if (names.length === 1) {
      return names[0].charAt(0).toUpperCase();
    }
    return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase();
  };

  // ENHANCED: Handle accept with loading state
  const handleAccept = async () => {
    if (isProcessing) return;
    
    try {
      setIsProcessing(true);
      console.log('✅ User accepting call');
      await onAccept();
    } catch (error) {
      console.error('❌ Error accepting call:', error);
      setIsProcessing(false);
    }
  };

  // ENHANCED: Handle decline with loading state
  const handleDecline = async () => {
    if (isProcessing) return;
    
    try {
      setIsProcessing(true);
      console.log('❌ User declining call');
      await onDecline();
    } catch (error) {
      console.error('❌ Error declining call:', error);
      setIsProcessing(false);
    }
  };

  const profileImageUrl = getProfileImageUrl(callerData);
  const callerName = callerData.fullName || callerData.name || 'Unknown';
  const callTypeText = callType === 'video' ? 'Video' : 'Voice';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <StatusBar backgroundColor="rgba(0,0,0,0.9)" barStyle="light-content" />
      
      <View style={styles.overlay}>
        <Animated.View 
          style={[
            styles.container,
            {
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          <View style={styles.backgroundGradient} />
          
          <View style={styles.header}>
            <Text style={styles.incomingText}>Incoming {callTypeText} call</Text>
          </View>

          <View style={styles.callerInfo}>
            <Animated.View 
              style={[
                styles.avatarContainer,
                { transform: [{ scale: pulseAnim }] }
              ]}
            >
              {profileImageUrl ? (
                <Image 
                  source={{ uri: profileImageUrl }} 
                  style={styles.avatar}
                  onError={() => console.log('Failed to load caller image')}
                />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarText}>
                    {getInitials(callerName)}
                  </Text>
                </View>
              )}
              
              <View style={styles.avatarRing} />
            </Animated.View>
            
            <Text style={styles.callerName}>{callerName}</Text>
            <Text style={styles.callerSubtext}>
              {callTypeText} call • HeartLink
            </Text>
          </View>

          <View style={styles.callInfo}>
            <View style={styles.callTypeIndicator}>
              <Ionicons 
                name={callType === 'video' ? 'videocam' : 'call'} 
                size={20} 
                color="#4CAF50" 
              />
              <Text style={styles.callTypeText}>{callTypeText} Call</Text>
            </View>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity 
              style={[styles.actionButton, isProcessing && styles.disabledButton]} 
              onPress={handleDecline}
              activeOpacity={0.8}
              disabled={isProcessing}
            >
              <View style={[styles.declineButton, isProcessing && styles.disabledActionButton]}>
                <Ionicons name="call" size={32} color="white" style={styles.declineIcon} />
              </View>
              <Text style={styles.actionButtonText}>Decline</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.actionButton, isProcessing && styles.disabledButton]} 
              onPress={handleAccept}
              activeOpacity={0.8}
              disabled={isProcessing}
            >
              <View style={[styles.acceptButton, isProcessing && styles.disabledActionButton]}>
                <Ionicons name="call" size={32} color="white" />
              </View>
              <Text style={styles.actionButtonText}>Accept</Text>
            </TouchableOpacity>
          </View>

          {isProcessing && (
            <View style={styles.processingContainer}>
              <Text style={styles.processingText}>Processing...</Text>
            </View>
          )}

          <View style={styles.additionalActions}>
            <TouchableOpacity 
              style={[styles.smallActionButton, isProcessing && styles.disabledButton]}
              disabled={isProcessing}
            >
              <Ionicons name="chatbubble" size={20} color={isProcessing ? "#555" : "#999"} />
              <Text style={[styles.smallActionText, isProcessing && styles.disabledText]}>Message</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.smallActionButton, isProcessing && styles.disabledButton]}
              disabled={isProcessing}
            >
              <Ionicons name="person-add" size={20} color={isProcessing ? "#555" : "#999"} />
              <Text style={[styles.smallActionText, isProcessing && styles.disabledText]}>Remind me</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: width,
    height: height,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  backgroundGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#1a1a1a',
    opacity: 0.9,
  },
  header: {
    position: 'absolute',
    top: 60,
    alignItems: 'center',
  },
  incomingText: {
    color: '#ccc',
    fontSize: 16,
    fontWeight: '400',
  },
  callerInfo: {
    alignItems: 'center',
    marginBottom: 40,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 20,
  },
  avatar: {
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 4,
    borderColor: '#4CAF50',
  },
  avatarPlaceholder: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: '#FF6B9D',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#4CAF50',
  },
  avatarText: {
    fontSize: 64,
    color: 'white',
    fontWeight: 'bold',
  },
  avatarRing: {
    position: 'absolute',
    top: -8,
    left: -8,
    right: -8,
    bottom: -8,
    borderRadius: 88,
    borderWidth: 2,
    borderColor: 'rgba(76, 175, 80, 0.3)',
  },
  callerName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
    textAlign: 'center',
  },
  callerSubtext: {
    fontSize: 16,
    color: '#ccc',
    textAlign: 'center',
  },
  callInfo: {
    alignItems: 'center',
    marginBottom: 60,
  },
  callTypeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.3)',
  },
  callTypeText: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: width * 0.7,
    marginBottom: 20,
    alignItems: 'center',
  },
  actionButton: {
    alignItems: 'center',
  },
  acceptButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    backgroundColor: '#4CAF50',
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  declineButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    backgroundColor: '#FF4444',
    shadowColor: '#FF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  declineIcon: {
    transform: [{ rotate: '135deg' }],
  },
  actionButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.5,
  },
  disabledActionButton: {
    backgroundColor: '#666',
  },
  disabledText: {
    color: '#555',
  },
  processingContainer: {
    marginBottom: 20,
  },
  processingText: {
    color: '#4CAF50',
    fontSize: 14,
    textAlign: 'center',
  },
  additionalActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: width * 0.5,
    position: 'absolute',
    bottom: 100,
  },
  smallActionButton: {
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  smallActionText: {
    color: '#999',
    fontSize: 12,
    marginTop: 4,
  },
});

export default IncomingCallModal;