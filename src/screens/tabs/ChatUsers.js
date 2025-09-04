// src/screens/tabs/ChatUsers.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Modal,
  Image,
  Dimensions,
  AppState,
  Linking,
} from 'react-native';
// ADDED: Import useFocusEffect for screen focus events
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSocket } from '../../context/SocketContext';
import BASE_URL from '../../config/config';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Feather from 'react-native-vector-icons/Feather';
// WebRTC Integration - Use Global Service
import enhancedGlobalWebRTCService from '../../services/EnhancedGlobalWebRTCService';
import IncomingCallModal from '../../components/IncomingCallModal';
// Import Audio Recorder Component
import AudioRecorder from '../../components/AudioRecorder'; // Adjust path as needed
// ADDED FOR AUDIO PLAYBACK: Import the Video component
import Video from 'react-native-video';
// ADDED: Import the new AudioPlayer component
import AudioPlayer from '../../components/AudioPlayer'; // Adjust path as needed
// Import image picker and document picker
let ImagePicker;
let DocumentPicker;
try {
  ImagePicker = require('react-native-image-picker');
} catch (e) {
  console.log('ImagePicker not installed');
}
try {
  DocumentPicker = require('react-native-document-picker');
} catch (e) {
  console.log('DocumentPicker not installed');
}
const { width, height } = Dimensions.get('window');
const ChatDetailScreen = () => {
  // Chat state
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [showAttachmentModal, setShowAttachmentModal] = useState(false);
  const [selectedPreviewImage, setSelectedPreviewImage] = useState(null);
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [receiverData, setReceiverData] = useState(null);
  const [receiverOnlineStatus, setReceiverOnlineStatus] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [selectedMessageForDelete, setSelectedMessageForDelete] = useState(null);
  const [deletingMessage, setDeletingMessage] = useState(false);
  const [unseenCount, setUnseenCount] = useState(0);
  const [conversationFocused, setConversationFocused] = useState(false);
  const [isAudioRecording, setIsAudioRecording] = useState(false); // State for audio recording
  // WebRTC Call States
  const [incomingCall, setIncomingCall] = useState(null);
  const [isCallActive, setIsCallActive] = useState(false);
  const [callState, setCallState] = useState('idle');
  const [isInitiatingCall, setIsInitiatingCall] = useState(false);
  // ADDED FOR AUDIO PLAYBACK: State variables to manage audio playback
  const [currentlyPlaying, setCurrentlyPlaying] = useState(null); // Tracks the ID of the message being played
  const [paused, setPaused] = useState(true); // Controls the play/pause state for the <Video> component
  const [audioMessageUrl, setAudioMessageUrl] = useState(null); // Holds the URL of the audio file to be played
  // ADDED: State to track current time of the playing message
  const [playingMessageCurrentTime, setPlayingMessageCurrentTime] = useState(0);
  const { user: currentUser, token } = useAuth();
  const navigation = useNavigation();
  const route = useRoute();
  const flatListRef = useRef(null);
  const { socket } = useSocket();
  const appStateSubscriptionRef = useRef(null);
  const markAsReadTimeoutRef = useRef(null);
  const { conversationId, receiverId, receiverName, receiverOnline } = route.params;
  // ===== START: NEW UTILITY FUNCTION AND EFFECT =====
  // Add this function to your ChatDetailScreen component
  const handleConnectionIssues = useCallback(() => {
    if (!socket || !socket.connected) {
      console.log('🔄 Attempting to reconnect socket...');
      // Force socket reconnection
      if (typeof socket?.connect === 'function') {
        socket.connect();
      }
      return false;
    }
    return true;
  }, [socket]);
  // Add this useEffect for periodic connection checking
  useEffect(() => {
    const connectionCheckInterval = setInterval(() => {
      if (!handleConnectionIssues() && socket) {
        console.log('⚠ Socket disconnected, attempting to reconnect...');
        // Try to rejoin conversation after reconnection
        setTimeout(() => {
          if (socket?.connected && conversationId) {
            socket.emit('joinConversation', { conversationId });
          }
        }, 2000);
      }
    }, 10000); // Check every 10 seconds
    return () => clearInterval(connectionCheckInterval);
  }, [socket, conversationId, handleConnectionIssues]);
  // ===== END: NEW UTILITY FUNCTION AND EFFECT =====
  // ADDED FOR AUDIO PLAYBACK: Function to handle playing/pausing audio messages
  const handleAudioPlayPause = (messageId, fileUrl) => {
    if (currentlyPlaying === messageId) {
      // If the same audio message is tapped, toggle its paused state
      setPaused(!paused);
      // Note: Getting real-time currentTime from <Video> is tricky here.
      // We rely on the onProgress callback below for updates.
    } else {
      // If a new audio message is tapped, start playing it
      setCurrentlyPlaying(messageId);
      setAudioMessageUrl(fileUrl); // Set the URL for the <Video> component
      setPaused(false);
      setPlayingMessageCurrentTime(0); // Reset time for new message
    }
  };
  // ADDED FOR AUDIO PLAYBACK: Function to reset state when audio finishes
  const onPlaybackEnd = () => {
    setPaused(true);
    setCurrentlyPlaying(null);
    setAudioMessageUrl(null);
    setPlayingMessageCurrentTime(0); // Reset time on end
  };
  // ADDED: Helper function to get current time for a specific message
  const getCurrentTimeForMessage = (messageId) => {
    // If this message is the one currently playing, return its tracked time
    if (currentlyPlaying === messageId) {
      return playingMessageCurrentTime;
    }
    // If not playing, return 0 (or you could store last known time per message in state)
    return 0;
  };
  // Updated handleAudioRecordingComplete function to track duration:
  const handleAudioRecordingComplete = async (audioFile, duration = null) => {
    console.log('🎵 Audio recorded:', audioFile);
    setIsAudioRecording(false);
    if (audioFile && audioFile.uri) {
      setUploadingFile(true);
      try {
        // Pass duration if available (you may need to update AudioRecorder to return duration)
        await sendMessage('audio', audioFile, duration);
      } catch (error) {
        console.error("Error sending audio message:", error);
        setUploadingFile(false);
        Alert.alert("Send Error", "Failed to send audio message.");
      }
    } else {
      console.log("No audio file received or invalid path.");
      setUploadingFile(false);
    }
  };
  // Initialize WebRTC Service
  useEffect(() => {
    const initializeWebRTC = async () => {
      try {
        // Initialize global WebRTC service if not already done
        if (!enhancedGlobalWebRTCService.isReady() && token) {
          await enhancedGlobalWebRTCService.initialize(token);
        }
        // Set screen-specific callbacks
        enhancedGlobalWebRTCService.setScreenCallbacks({
          onLocalStream: handleLocalStream,
          onRemoteStream: handleRemoteStream,
          onCallStateChange: handleCallStateChange,
          onError: handleWebRTCError,
          onIncomingCall: handleIncomingCall
        });
        console.log('✅ WebRTC screen callbacks set for ChatDetailScreen');
      } catch (error) {
        console.error('❌ Failed to initialize WebRTC in ChatDetailScreen:', error);
      }
    };
    initializeWebRTC();
    return () => {
      // FIXED: Clear states on unmount
      setCallState('idle');
      setIsCallActive(false);
      setIsInitiatingCall(false);
      setIncomingCall(null);
      enhancedGlobalWebRTCService.clearScreenCallbacks();
    };
  }, [token]);
  // FIXED: Add focus effect to reset states when returning from CallScreen
  useFocusEffect(
    React.useCallback(() => {
      console.log('📱 ChatDetailScreen focused - checking call state');
      // Reset call states when screen is focused (coming back from CallScreen)
      const webrtcState = enhancedGlobalWebRTCService.getCallState();
      if (!webrtcState.isInCall) {
        console.log('🔄 Resetting call states on focus');
        setCallState('idle');
        setIsCallActive(false);
        setIsInitiatingCall(false);
        setIncomingCall(null);
      }
      return () => {
        console.log('📱 ChatDetailScreen blurred');
      };
    }, [])
  );
  // FIXED: Add periodic state check to prevent stuck states
  useEffect(() => {
    const stateCheckInterval = setInterval(() => {
      const webrtcState = enhancedGlobalWebRTCService.getCallState();
      // If WebRTC says no call but UI shows calling states, force reset
      if (!webrtcState.isInCall && (isInitiatingCall || callState !== 'idle')) {
        console.log('🔧 Forcing state reset - detected stuck state');
        setCallState('idle');
        setIsCallActive(false);
        setIsInitiatingCall(false);
        setIncomingCall(null);
      }
    }, 2000);
    return () => clearInterval(stateCheckInterval);
  }, [isInitiatingCall, callState]);
  // WebRTC Event Handlers
  const handleLocalStream = (stream) => {
    console.log('📹 Local stream received in ChatDetailScreen');
  };
  const handleRemoteStream = (stream) => {
    console.log('📺 Remote stream received in ChatDetailScreen');
    if (callState !== 'connected') {
      setCallState('connected');
      setIsCallActive(true);
    }
  };
  // REPLACED: handleCallStateChange with more robust state resetting
  const handleCallStateChange = (type, data) => {
    console.log('🔄 Call state change in ChatDetailScreen:', type, data);
    switch (type) {
      case 'accepted':
        setCallState('connecting');
        setIsCallActive(true);
        navigation.navigate('CallScreen', {
          callType: data.callType || 'video',
          isIncoming: false,
          calleeData: { id: receiverId, fullName: receiverName, ...receiverData },
          callerData: { id: currentUser._id, fullName: currentUser.fullName },
          authToken: token,
          webrtcService: enhancedGlobalWebRTCService
        });
        break;
      case 'declined':
        // FIXED: Reset all states immediately
        setCallState('idle');
        setIsCallActive(false);
        setIsInitiatingCall(false);
        setIncomingCall(null);
        Alert.alert('Call Declined', 'The user declined your call');
        break;
      case 'ended':
      case 'cleanup':
        // FIXED: Comprehensive state reset
        console.log('🔚 Call ended - resetting all states');
        setCallState('idle');
        setIsCallActive(false);
        setIsInitiatingCall(false);
        setIncomingCall(null);
        // FIXED: Double-check reset after delay
        setTimeout(() => {
          setCallState('idle');
          setIsCallActive(false);
          setIsInitiatingCall(false);
        }, 1000);
        if (type === 'ended') {
          Alert.alert('Call Ended', `Call duration: ${data.durationFormatted || '0s'}`);
        }
        break;
      case 'connection':
        if (data.state === 'connected' && callState !== 'connected') {
          setCallState('connected');
          setIsCallActive(true);
        } else if (data.state === 'disconnected' || data.state === 'failed' || data.state === 'closed') {
          // FIXED: Reset on connection failure
          console.log('🔌 Connection lost - resetting states');
          setCallState('idle');
          setIsCallActive(false);
          setIsInitiatingCall(false);
        }
        break;
      case 'error':
        // FIXED: Reset on any error
        setCallState('idle');
        setIsCallActive(false);
        setIsInitiatingCall(false);
        setIncomingCall(null);
        break;
      case 'ice':
        console.log('🧊 ICE connection state:', data.state);
        break;
    }
  };
  // REPLACED: handleWebRTCError with more robust state resetting
  const handleWebRTCError = (error) => {
    console.error('❌ WebRTC error in ChatDetailScreen:', error);
    // FIXED: Complete state reset on error
    setCallState('idle');
    setIsCallActive(false);
    setIsInitiatingCall(false);
    setIncomingCall(null);
    Alert.alert('Call Error', error.message || 'An error occurred during the call');
  };
  const handleIncomingCall = (callData) => {
    console.log('📞 Incoming call received in ChatDetailScreen:', callData);
    setIncomingCall(callData);
    setCallState('incoming');
  };
  // Call Functions
  const initiateAudioCall = async () => {
    if (isCallActive || isInitiatingCall) {
      Alert.alert('Error', 'You are already in a call or initiating one');
      return;
    }
    if (!enhancedGlobalWebRTCService.isReady()) {
      Alert.alert('Error', 'WebRTC service not ready. Please try again.');
      return;
    }
    try {
      setIsInitiatingCall(true);
      setCallState('ringing');
      console.log('🎵 Initiating audio call to:', receiverId);
      const result = await enhancedGlobalWebRTCService.initiateCall(receiverId, 'audio');
      if (result) {
        console.log('✅ Audio call initiated successfully');
        navigation.navigate('CallScreen', {
          callType: 'audio',
          isIncoming: false,
          calleeData: receiverData || { id: receiverId, fullName: receiverName },
          callerData: { id: currentUser._id, fullName: currentUser.fullName },
          authToken: token,
          webrtcService: enhancedGlobalWebRTCService
        });
      } else {
        throw new Error('Failed to initiate call');
      }
    } catch (error) {
      console.error('❌ Failed to initiate audio call:', error);
      // MODIFIED: Added more complete state reset on failure
      setCallState('idle');
      setIsInitiatingCall(false);
      setIsCallActive(false);
      setIncomingCall(null);
      Alert.alert('Call Failed', 'Unable to start audio call. Please try again.');
    }
  };
  const initiateVideoCall = async () => {
    if (isCallActive || isInitiatingCall) {
      Alert.alert('Error', 'You are already in a call or initiating one');
      return;
    }
    if (!enhancedGlobalWebRTCService.isReady()) {
      Alert.alert('Error', 'WebRTC service not ready. Please try again.');
      return;
    }
    try {
      setIsInitiatingCall(true);
      setCallState('ringing');
      console.log('🎥 Initiating video call to:', receiverId);
      const result = await enhancedGlobalWebRTCService.initiateCall(receiverId, 'video');
      if (result) {
        console.log('✅ Video call initiated successfully');
        navigation.navigate('CallScreen', {
          callType: 'video',
          isIncoming: false,
          calleeData: receiverData || { id: receiverId, fullName: receiverName },
          callerData: { id: currentUser._id, fullName: currentUser.fullName },
          authToken: token,
          webrtcService: enhancedGlobalWebRTCService
        });
      } else {
        throw new Error('Failed to initiate call');
      }
    } catch (error) {
      console.error('❌ Failed to initiate video call:', error);
      // MODIFIED: Added more complete state reset on failure
      setCallState('idle');
      setIsInitiatingCall(false);
      setIsCallActive(false);
      setIncomingCall(null);
      Alert.alert('Call Failed', 'Unable to start video call. Please try again.');
    }
  };
  const acceptIncomingCall = async () => {
    if (!incomingCall) return;
    try {
      console.log('✅ Accepting incoming call');
      setCallState('connecting');
      await enhancedGlobalWebRTCService.acceptCall();
      navigation.navigate('CallScreen', {
        callType: incomingCall.callType,
        isIncoming: true,
        callerData: incomingCall.caller,
        calleeData: { id: currentUser._id, fullName: currentUser.fullName },
        authToken: token,
        webrtcService: enhancedGlobalWebRTCService
      });
      setIncomingCall(null);
      setIsCallActive(true);
    } catch (error) {
      console.error('❌ Failed to accept call:', error);
      Alert.alert('Error', 'Failed to accept call');
      setCallState('idle');
      setIncomingCall(null);
    }
  };
  const declineIncomingCall = async () => {
    if (!incomingCall) return;
    try {
      console.log('❌ Declining incoming call');
      await enhancedGlobalWebRTCService.declineCall();
      setIncomingCall(null);
      setCallState('idle');
    } catch (error) {
      console.error('❌ Failed to decline call:', error);
      setIncomingCall(null);
      setCallState('idle');
    }
  };
  // Get profile image URL
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
  // Get message status icon
  const getStatusIcon = (message) => {
    if (message.sender._id !== currentUser?._id) return null;
    switch (message.status) {
      case 'sent':
        return <Text style={[styles.statusIcon, { color: '#666' }]}>✓</Text>;
      case 'delivered':
        return <Text style={[styles.statusIcon, { color: '#444' }]}>✓✓</Text>;
      case 'read':
        return <Text style={[styles.statusIcon, { color: '#4FC3F7' }]}>✓✓</Text>;
      default:
        return null;
    }
  };
  // Enhanced markMessagesAsRead function with socket emission
  const markMessagesAsRead = async (specificMessageIds = null) => {
    try {
      if (!token || !conversationId) return;

      const payload = { conversationId };
      if (specificMessageIds && specificMessageIds.length > 0) {
        payload.messageIds = specificMessageIds;
      }

      // Get unread message IDs before marking as read
      const unreadMessageIds = messages
        .filter(msg => msg.sender._id !== currentUser._id && msg.status !== 'read')
        .map(msg => msg._id);

      const response = await fetch(`${BASE_URL}/api/v1/chat/messages/bulk-seen`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        // Update local state
        setMessages(prev => prev.map(msg => {
          if (msg.sender._id !== currentUser._id && msg.status !== 'read') {
            return { ...msg, status: 'read', readAt: new Date().toISOString() };
          }
          return msg;
        }));
        setUnseenCount(0);

        // IMPORTANT: Emit socket event to notify sender about read status
        if (socket && socket.connected && unreadMessageIds.length > 0) {
          socket.emit('messagesRead', {
            conversationId,
            messageIds: unreadMessageIds,
            readBy: currentUser._id,
            receiverId: receiverId, // The person whose messages we just read
            timestamp: new Date().toISOString()
          });
          console.log('📤 Emitted messagesRead event for', unreadMessageIds.length, 'messages');
        }
      }
    } catch (error) {
      console.error('❌ Error marking messages as read:', error);
    }
  };
  // Handle conversation focus/blur
  const handleConversationFocus = () => {
    if (!conversationFocused && socket) {
      socket.emit('conversationFocused', { conversationId });
      setConversationFocused(true);
      if (markAsReadTimeoutRef.current) {
        clearTimeout(markAsReadTimeoutRef.current);
      }
      markAsReadTimeoutRef.current = setTimeout(() => {
        markMessagesAsRead();
      }, 1000);
    }
  };
  const handleConversationBlur = () => {
    if (conversationFocused && socket) {
      socket.emit('conversationBlurred', {
        conversationId,
        markRead: true
      });
      setConversationFocused(false);
      if (markAsReadTimeoutRef.current) {
        clearTimeout(markAsReadTimeoutRef.current);
      }
    }
  };
  // Handle app state changes
  useEffect(() => {
    const handleAppStateChange = (nextAppState) => {
      if (nextAppState === 'active') {
        updateOnlineStatus(true);
        handleConversationFocus();
      } else if (nextAppState === 'background' || nextAppState === 'inactive') {
        updateOnlineStatus(false);
        handleConversationBlur();
      }
    };
    appStateSubscriptionRef.current = AppState.addEventListener('change', handleAppStateChange);
    updateOnlineStatus(true);
    return () => {
      if (appStateSubscriptionRef.current) {
        appStateSubscriptionRef.current.remove();
      }
      updateOnlineStatus(false);
      handleConversationBlur();
    };
  }, []);
  // Enhanced Socket listeners with better error handling and reconnection
  useEffect(() => {
    if (!socket || !conversationId) return;
    console.log('🔌 Setting up socket listeners for conversation:', conversationId);
    // Join conversation room immediately
    socket.emit('joinConversation', { conversationId });
    const handleUserOnline = (data) => {
      console.log('👤 User came online:', data);
      setOnlineUsers(prev => new Set([...prev, data.userId]));
      if (data.userId === receiverId) {
        setReceiverOnlineStatus(true);
      }
    };
    const handleUserOffline = (data) => {
      console.log('👤 User went offline:', data);
      setOnlineUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(data.userId);
        return newSet;
      });
      if (data.userId === receiverId) {
        setReceiverOnlineStatus(false);
      }
    };
    const handleOnlineUsersList = (data) => {
      console.log('👥 Received online users list:', data);
      if (data && Array.isArray(data)) {
        const onlineUserIds = new Set(data.map(user => user._id || user.id || user));
        setOnlineUsers(onlineUserIds);
        const isReceiverOnline = onlineUserIds.has(receiverId);
        setReceiverOnlineStatus(isReceiverOnline);
      }
    };
    // Enhanced message handler with better error handling
    const handleNewMessage = (message) => {
      console.log('📨 New message received:', {
        messageId: message._id,
        conversationId: message.conversationId,
        currentConversationId: conversationId,
        sender: message.sender?._id,
        content: message.content?.substring(0, 50) + '...'
      });
      // Verify this message belongs to current conversation
      if (message.conversationId !== conversationId) {
        console.log('📨 Message not for current conversation, ignoring');
        return;
      }
      // Update messages state
      setMessages(prev => {
        // Check if message already exists to prevent duplicates
        const exists = prev.find(msg => msg._id === message._id);
        if (exists) {
          console.log('📨 Message already exists, skipping duplicate');
          return prev;
        }
        console.log('📨 Adding new message to state');
        const newMessages = [...prev, message];
        // Scroll to bottom after state update
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
        return newMessages;
      });
      // Auto-mark as read if conversation is focused and message is from other user
      if (message.sender._id !== currentUser._id && conversationFocused) {
        setTimeout(() => {
          markMessagesAsRead([message._id]);
        }, 500);
      } else if (message.sender._id !== currentUser._id) {
        setUnseenCount(prev => prev + 1);
      }
    };
    // Message status updates - FIXED VERSION
    const handleMessageStatusUpdate = (data) => {
      console.log('📊 Message status update received:', data);

      // Update messages for both single message and bulk updates
      setMessages(prev => prev.map(msg => {
        // Check if this is a message sent by the current user
        if (msg.sender._id === currentUser._id) {
          // Check if this specific message should be updated
          if (data.messageId && msg._id === data.messageId) {
            console.log('✅ Updating message status to:', data.status);
            return {
              ...msg,
              status: data.status,
              [data.status + 'At']: data.timestamp || new Date().toISOString()
            };
          }
          // If no specific messageId, update all unread messages from this user to this receiver
          else if (!data.messageId && data.receiverId === receiverId && msg.status !== 'read') {
            return {
              ...msg,
              status: data.status,
              [data.status + 'At']: data.timestamp || new Date().toISOString()
            };
          }
        }
        return msg;
      }));
    };

    // Bulk message status updates - FIXED VERSION
    const handleBulkMessageStatusUpdate = (data) => {
      console.log('📊 Bulk message status update received:', data);

      setMessages(prev => prev.map(msg => {
        // Update all messages sent by current user that are now read
        if (msg.sender._id === currentUser._id &&
          data.conversationId === conversationId) {

          // If messageIds array is provided, check if this message is in it
          if (data.messageIds && Array.isArray(data.messageIds)) {
            if (data.messageIds.includes(msg._id)) {
              console.log('✅ Bulk updating message to read:', msg._id);
              return {
                ...msg,
                status: 'read',
                readAt: data.timestamp || new Date().toISOString()
              };
            }
          }
          // Otherwise update all unread messages
          else if (msg.status !== 'read' && data.status === 'read') {
            return {
              ...msg,
              status: 'read',
              readAt: data.timestamp || new Date().toISOString()
            };
          }
        }
        return msg;
      }));
    };

    // Add this new handler for real-time read receipts
    const handleMessageRead = (data) => {
      console.log('👁️ Message read event received:', data);

      setMessages(prev => prev.map(msg => {
        // Update message if it matches the read message ID or is part of bulk read
        if (msg.sender._id === currentUser._id) {
          if (data.messageIds && data.messageIds.includes(msg._id)) {
            return { ...msg, status: 'read', readAt: new Date().toISOString() };
          } else if (data.messageId && msg._id === data.messageId) {
            return { ...msg, status: 'read', readAt: new Date().toISOString() };
          }
        }
        return msg;
      }));
    };

    // Conversation joined confirmation
    const handleJoinedConversation = (data) => {
      console.log('✅ Successfully joined conversation:', data);
      handleConversationFocus();
    };
    // Connection status handlers
    const handleConnect = () => {
      console.log('🔌 Socket connected, rejoining conversation');
      setTimeout(() => {
        socket.emit('joinConversation', { conversationId });
      }, 1000);
    };
    const handleDisconnect = () => {
      console.log('🔌 Socket disconnected');
    };
    const handleReconnect = () => {
      console.log('🔌 Socket reconnected, rejoining conversation');
      setTimeout(() => {
        socket.emit('joinConversation', { conversationId });
      }, 1000);
    };
    // Register all event listeners
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('reconnect', handleReconnect);
    socket.on('userOnline', handleUserOnline);
    socket.on('userOffline', handleUserOffline);
    socket.on('allOnlineUsers', handleOnlineUsersList);
    socket.on('newMessage', handleNewMessage);
    socket.on('messageStatusUpdate', handleMessageStatusUpdate);
    socket.on('bulkMessageStatusUpdate', handleBulkMessageStatusUpdate);
    socket.on('messageRead', handleMessageRead);
    socket.on('messagesRead', handleMessageRead); // Handle both single and plural events
    socket.on('joinedConversation', handleJoinedConversation);
    // Request current online users
    socket.emit('getAllOnlineUsers');
    // Cleanup function
    return () => {
      console.log('🧹 Cleaning up socket listeners for conversation:', conversationId);
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('reconnect', handleReconnect);
      socket.off('userOnline', handleUserOnline);
      socket.off('userOffline', handleUserOffline);
      socket.off('allOnlineUsers', handleOnlineUsersList);
      socket.off('newMessage', handleNewMessage);
      socket.off('messageStatusUpdate', handleMessageStatusUpdate);
      socket.off('bulkMessageStatusUpdate', handleBulkMessageStatusUpdate);
      socket.off('messageRead', handleMessageRead);
      socket.off('messagesRead', handleMessageRead);
      socket.off('joinedConversation', handleJoinedConversation);
      // Leave conversation room
      socket.emit('leaveConversation', { conversationId });
    };
  }, [socket, conversationId, receiverId, currentUser, conversationFocused]);
  // Add this useEffect to handle app focus/blur for better real-time updates
  useFocusEffect(
    React.useCallback(() => {
      console.log('📱 ChatDetailScreen focused');
      if (socket && conversationId) {
        // Rejoin conversation when screen becomes focused
        socket.emit('joinConversation', { conversationId });
        handleConversationFocus();
      }
      return () => {
        console.log('📱 ChatDetailScreen blurred');
        if (socket && conversationId) {
          handleConversationBlur();
        }
      };
    }, [socket, conversationId])
  );
  // Initial data loading
  useEffect(() => {
    fetchMessages();
    setReceiverOnlineStatus(receiverOnline || false);
    handleConversationFocus();
    return () => {
      if (markAsReadTimeoutRef.current) {
        clearTimeout(markAsReadTimeoutRef.current);
      }
    };
  }, [conversationId]);
  // Extract receiver data from messages
  useEffect(() => {
    if (messages.length > 0 && !receiverData) {
      const firstMessage = messages[0];
      const receiver = firstMessage.sender._id === receiverId ?
        firstMessage.sender : firstMessage.receiver;
      if (receiver && receiver._id === receiverId) {
        setReceiverData(receiver);
      }
    }
  }, [messages, receiverId, receiverData]);
  // Update online status
  const updateOnlineStatus = async (isOnline) => {
    try {
      if (!token || !currentUser) return;
      const response = await fetch(`${BASE_URL}/api/v1/chat/user/online-status`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isOnline }),
      });
      if (response.ok && socket) {
        if (isOnline) {
          socket.emit('user-online', { userId: currentUser._id });
        } else {
          socket.emit('user-offline', { userId: currentUser._id });
        }
      }
    } catch (error) {
      console.error('❌ Error updating online status:', error);
    }
  };
  // Fetch messages
  const fetchMessages = async (pageNum = 1, prepend = false) => {
    try {
      if (!token) return;
      const response = await fetch(
        `${BASE_URL}/api/v1/chat/conversations/${conversationId}/messages?page=${pageNum}&limit=50`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      const data = await response.json();
      if (response.ok && data.success) {
        const newMessages = data.data || [];
        const sortedMessages = newMessages.sort((a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        if (prepend) {
          setMessages(prev => [...sortedMessages, ...prev]);
        } else {
          setMessages(sortedMessages);
          setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: false });
          }, 100);
        }
        setHasMoreMessages(newMessages.length === 50);
        setPage(pageNum);
      } else {
        Alert.alert('Error', 'Failed to load messages');
      }
    } catch (error) {
      console.error('❌ Error fetching messages:', error);
      Alert.alert('Error', 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  };
 // STEP 1: Replace the sendMessage function in ChatDetailScreen
const sendMessage = async (messageType = 'text', fileData = null, audioDuration = null) => {
  if (messageType === 'text' && (!newMessage.trim() || sending)) return;
  if (messageType !== 'text' && !fileData) return;
  const messageText = messageType === 'text' ? newMessage.trim() : newMessage;
  const tempId = `temp_${Date.now()}_${Math.random()}`;
  setNewMessage('');
  // Set loading states based on message type
  if (messageType === 'text') {
    setSending(true);
  } else {
    setUploadingFile(true);
  }
  try {
    if (messageType === 'text' && socket && socket.connected) {
      // Handle text messages via socket (existing logic)
      console.log('📤 Sending text message via socket');
      const messageData = {
        conversationId,
        receiverId,
        content: messageText,
        messageType: 'text',
        tempId
      };
      socket.emit('sendMessage', messageData);
      const confirmationTimeout = setTimeout(() => {
        console.log('⚠️ Socket message timeout, falling back to HTTP');
        sendViaHTTP();
      }, 5000);
      const handleMessageSent = (data) => {
        if (data.tempId === tempId) {
          clearTimeout(confirmationTimeout);
          socket.off('messageSent', handleMessageSent);
          socket.off('error', handleMessageError);
          setSending(false);
          console.log('✅ Message sent via socket successfully');
        }
      };
      const handleMessageError = (error) => {
        if (error.tempId === tempId) {
          clearTimeout(confirmationTimeout);
          socket.off('messageSent', handleMessageSent);
          socket.off('error', handleMessageError);
          console.log('❌ Socket message failed, falling back to HTTP');
          sendViaHTTP();
        }
      };
      socket.on('messageSent', handleMessageSent);
      socket.on('error', handleMessageError);
    } else {
      // Handle file messages via HTTP with immediate UI feedback
      await sendViaHTTP();
    }
    async function sendViaHTTP() {
      console.log('📤 Sending message via HTTP, type:', messageType);
      let requestBody;
      let headers = {
        'Authorization': `Bearer ${token}`,
      };
      let endpoint = `${BASE_URL}/api/v1/chat/message`;
      // 🔥 STEP 1A: Create optimistic message for immediate UI feedback (for file uploads)
      let optimisticMessage = null;
      if (messageType !== 'text') {
        optimisticMessage = {
          _id: tempId,
          conversationId,
          sender: {
            _id: currentUser._id,
            fullName: currentUser.fullName,
            username: currentUser.username,
            photoUrl: currentUser.photoUrl
          },
          receiver: {
            _id: receiverId,
            fullName: receiverName
          },
          messageType,
          content: messageText || '',
          fileUrl: fileData.uri, // Temporary local URI
          fileName: fileData.name || 'File',
          fileSize: fileData.size,
          status: 'sending', // Custom status for optimistic update
          createdAt: new Date().toISOString(),
          isOptimistic: true // Flag to identify optimistic messages
        };
        // Add optimistic message to UI immediately
        setMessages(prev => [...prev, optimisticMessage]);
        // Scroll to bottom
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
      // Prepare request based on message type
      if (messageType === 'audio') {
        endpoint = `${BASE_URL}/api/v1/chat/message/voice`;
        const formData = new FormData();
        formData.append('voice', {
          uri: fileData.uri,
          type: fileData.type || 'audio/mp3',
          name: fileData.name || `voice_message_${Date.now()}.mp3`,
        });
        formData.append('conversationId', conversationId);
        formData.append('receiverId', receiverId);
        if (audioDuration) {
          formData.append('duration', audioDuration.toString());
        }
        requestBody = formData;
      } else if (messageType === 'text') {
        headers['Content-Type'] = 'application/json';
        requestBody = JSON.stringify({
          conversationId,
          receiverId,
          content: messageText,
          messageType: 'text',
        });
      } else {
        const formData = new FormData();
        formData.append('file', fileData);
        formData.append('conversationId', conversationId);
        formData.append('receiverId', receiverId);
        formData.append('messageType', messageType);
        if (messageText) {
          formData.append('content', messageText);
        }
        requestBody = formData;
      }
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: requestBody,
      });
      const data = await response.json();
      if (response.ok && data.success) {
        console.log('✅ Message sent via HTTP successfully');
        // 🔥 STEP 1B: Handle successful file upload
        if (messageType !== 'text' && optimisticMessage) {
          // Replace optimistic message with real message
          setMessages(prev => prev.map(msg => {
            if (msg._id === tempId && msg.isOptimistic) {
              return {
                ...data.data, // Real message from server
                statusInfo: {
                  isSent: true,
                  isDelivered: false,
                  isRead: false
                }
              };
            }
            return msg;
          }));
          // 🔥 STEP 1C: Emit via socket for real-time updates to other users
          if (socket && socket.connected) {
            socket.emit('fileMessageSent', {
              message: data.data,
              conversationId,
              receiverId
            });
          }
        }
      } else {
        console.error('❌ HTTP message failed:', data);
        // 🔥 STEP 1D: Handle failed file upload
        if (messageType !== 'text' && optimisticMessage) {
          // Remove optimistic message and show error
          setMessages(prev => prev.filter(msg => !(msg._id === tempId && msg.isOptimistic)));
          Alert.alert('Error', data.message || 'Failed to send message');
          if (messageType === 'text') {
            setNewMessage(messageText);
          }
        } else {
          Alert.alert('Error', data.message || 'Failed to send message');
          if (messageType === 'text') {
            setNewMessage(messageText);
          }
        }
      }
    }
  } catch (error) {
    console.error('❌ Error sending message:', error);
    // Handle error for optimistic messages
    if (messageType !== 'text') {
      setMessages(prev => prev.filter(msg => !(msg._id === tempId && msg.isOptimistic)));
    }
    Alert.alert('Error', 'Failed to send message');
    if (messageType === 'text') {
      setNewMessage(messageText);
    }
  } finally {
    if (messageType === 'text') {
      setSending(false);
    } else {
      setUploadingFile(false);
    }
  }
};
  // ===== END: REPLACED sendMessage FUNCTION =====
  // Delete message
  const deleteMessage = async (messageId) => {
    if (!messageId || deletingMessage) return;
    setDeletingMessage(true);
    try {
      const response = await fetch(`${BASE_URL}/api/v1/chat/message/${messageId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setMessages(prev => prev.filter(msg => msg._id !== messageId));
        setSelectedMessageForDelete(null);
      } else {
        Alert.alert('Error', data.message || 'Failed to delete message');
      }
    } catch (error) {
      console.error('❌ Error deleting message:', error);
      Alert.alert('Error', 'Failed to delete message');
    } finally {
      setDeletingMessage(false);
    }
  };
  // Message handlers
  const handleMessageLongPress = (message) => {
    if (message.sender._id === currentUser?._id) {
      setSelectedMessageForDelete(message);
    }
  };
  const cancelDelete = () => {
    setSelectedMessageForDelete(null);
  };
  const loadOlderMessages = () => {
    if (hasMoreMessages && !loading) {
      fetchMessages(page + 1, true);
    }
  };
  const handleProfilePress = () => {
    navigation.navigate('UserProfile', {
      userId: receiverId,
      fromChat: true,
      conversationId: conversationId,
    });
  };
  // File handling
  const handleAttachmentPress = () => {
    if (!ImagePicker && !DocumentPicker) {
//       Alert.alert(
//         'Packages Required',
//         'To send photos and files, install:
// • react-native-image-picker
// • react-native-document-picker
// Then restart the app.',
//         [{ text: 'OK' }]
//       );
      return;
    }
    setShowAttachmentModal(true);
  };
  const requestCameraPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const { PermissionsAndroid } = require('react-native');
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            title: 'Camera Permission',
            message: 'This app needs access to your camera to take photos.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.warn(err);
        return false;
      }
    }
    return true;
  };
  const openCamera = async () => {
    if (!ImagePicker) {
      Alert.alert('Error', 'Image picker not available');
      return;
    }
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) {
      Alert.alert('Permission Denied', 'Camera permission is required to take photos.');
      return;
    }
    setShowAttachmentModal(false);
    const options = {
      mediaType: 'photo',
      quality: 0.8,
      maxWidth: 1024,
      maxHeight: 1024,
    };
    ImagePicker.launchCamera(options, async (response) => {
      if (response.didCancel || response.errorMessage) {
        return;
      }
      if (response.assets && response.assets[0]) {
        const asset = response.assets[0];
        const fileData = {
          uri: asset.uri,
          type: asset.type || 'image/jpeg',
          name: asset.fileName || `camera_photo_${Date.now()}.jpg`,
        };
        setUploadingFile(true);
        await sendMessage('image', fileData);
      }
    });
  };
  const openGallery = () => {
    if (!ImagePicker) {
      Alert.alert('Error', 'Image picker not available');
      return;
    }
    setShowAttachmentModal(false);
    const options = {
      mediaType: 'photo',
      quality: 0.8,
      maxWidth: 1024,
      maxHeight: 1024,
    };
    ImagePicker.launchImageLibrary(options, (response) => {
      if (response.didCancel || response.errorMessage) {
        return;
      }
      if (response.assets && response.assets[0]) {
        const asset = response.assets[0];
        setSelectedPreviewImage(asset);
        setShowImagePreview(true);
      }
    });
  };
  const openDocumentPicker = async () => {
    if (!DocumentPicker) {
      Alert.alert('Error', 'Document picker not available');
      return;
    }
    setShowAttachmentModal(false);
    setUploadingFile(true);
    try {
      const result = await DocumentPicker.pick({
        type: [DocumentPicker.types.allFiles],
        copyTo: 'cachesDirectory',
      });
      if (result && result[0]) {
        const file = result[0];
        let messageType = 'file';
        if (file.type) {
          if (file.type.startsWith('image/')) {
            messageType = 'image';
          } else if (file.type.startsWith('video/')) {
            messageType = 'video';
          } else if (file.type.startsWith('audio/')) {
            messageType = 'audio';
          }
        }
        const fileData = {
          uri: file.fileCopyUri || file.uri,
          type: file.type || 'application/octet-stream',
          name: file.name || 'document',
        };
        await sendMessage(messageType, fileData);
      } else {
        setUploadingFile(false);
      }
    } catch (err) {
      if (DocumentPicker.isCancel(err)) {
        console.log('📄 Document picker cancelled by user');
      } else {
        console.error('❌ DocumentPicker Error:', err);
        Alert.alert('Error', 'Failed to pick document. Please try again.');
      }
      setUploadingFile(false);
    }
  };
  const handleFileDownload = async (fileUrl, fileName, messageType) => {
    try {
      if (!fileUrl) {
        Alert.alert('Error', 'File URL not available');
        return;
      }
      if (messageType === 'image') {
        setSelectedPreviewImage({ uri: fileUrl, fileName });
        setShowImagePreview(true);
        return;
      }
      const supported = await Linking.canOpenURL(fileUrl);
      if (supported) {
        await Linking.openURL(fileUrl);
      } else {
        Alert.alert(
          'Download File',
          `File: ${fileName}
Would you like to open this file?`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Open',
              onPress: () => {
                Linking.openURL(fileUrl).catch(() => {
                  Alert.alert('Error', 'Unable to open this file type');
                });
              }
            }
          ]
        );
      }
    } catch (error) {
      console.error('❌ Error opening file:', error);
      Alert.alert('Error', 'Failed to open file');
    }
  };
  const sendSelectedImage = () => {
    if (!selectedPreviewImage) return;
    setShowImagePreview(false);
    setUploadingFile(true);
    const fileData = {
      uri: selectedPreviewImage.uri,
      type: selectedPreviewImage.type || 'image/jpeg',
      name: selectedPreviewImage.fileName || 'image.jpg',
    };
    sendMessage('image', fileData);
    setSelectedPreviewImage(null);
  };
  // Utility functions
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
  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) {
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
    }
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };
  // Render functions
  const renderHeaderAvatar = () => {
    const userData = receiverData || { fullName: receiverName };
    const profileImageUrl = getProfileImageUrl(userData);
    const safeFullName = userData.fullName || receiverName || 'User';
    return (
      <View style={[
        styles.headerAvatar,
        { backgroundColor: getAvatarColor(safeFullName) }
      ]}>
        {profileImageUrl ? (
          <Image
            source={{ uri: profileImageUrl }}
            style={styles.headerAvatarImage}
          />
        ) : (
          <Text style={styles.headerAvatarText}>
            {getInitials(safeFullName)}
          </Text>
        )}
      </View>
    );
  };
  const renderMessage = ({ item }) => {
    const isOwnMessage = item.sender._id === currentUser?._id;
    const isSelected = selectedMessageForDelete && selectedMessageForDelete._id === item._id;
    // ADDED FOR AUDIO PLAYBACK: Check if this message is the one currently playing
    const isPlaying = currentlyPlaying === item._id;
    return (
      <View style={styles.messageWrapper}>
        <TouchableOpacity
          onLongPress={() => handleMessageLongPress(item)}
          onPress={() => {
            if (selectedMessageForDelete && selectedMessageForDelete._id !== item._id) {
              cancelDelete();
            }
          }}
          activeOpacity={0.8}
          style={[
            styles.messageContainer,
            isOwnMessage ? styles.ownMessage : styles.otherMessage,
            isSelected && styles.selectedMessage
          ]}
        >
          <View style={[
            styles.messageBubble,
            styles.commonMessageBubbleAppearance,
            isOwnMessage ? styles.ownMessageTail : styles.otherMessageTail,
            isSelected && styles.selectedMessageBubble
          ]}>
            {item.messageType === 'text' && (
              <Text style={styles.messageText}>
                {item.content}
              </Text>
            )}
            {item.messageType === 'image' && (
              <TouchableOpacity
                style={styles.imageMessageContainer}
                onPress={() => handleFileDownload(item.fileUrl, item.fileName, item.messageType)}
                activeOpacity={0.9}
              >
                <Image
                  source={{ uri: item.fileUrl }}
                  style={styles.messageImage}
                  resizeMode="cover"
                />
                {item.content && (
                  <Text style={styles.messageText}>
                    {item.content}
                  </Text>
                )}
              </TouchableOpacity>
            )}
            {/* UPDATED FOR AUDIO PLAYBACK: This block now handles audio playback using the AudioPlayer component */}
            {(item.messageType === 'file' || item.messageType === 'audio' || item.messageType === 'video') && (
              <TouchableOpacity
                style={styles.fileMessageContainer}
                onPress={() => {
                  // If the message is audio, use the playback handler
                  if (item.messageType === 'audio') {
                    // The onPress logic remains the same, handled by the parent
                    handleAudioPlayPause(item._id, item.fileUrl);
                  } else {
                    // Otherwise, use the default download/open handler
                    handleFileDownload(item.fileUrl, item.fileName, item.messageType);
                  }
                }}
                activeOpacity={0.7}
              >
                {/* Check if it's an audio message to render the new player */}
                {item.messageType === 'audio' ? (
                  // Use the new AudioPlayer component
                  <AudioPlayer
                    isPlaying={isPlaying && !paused} // Pass playing state
                    onPressPlayPause={() => handleAudioPlayPause(item._id, item.fileUrl)} // Pass handler
                    duration={item.duration ? parseFloat(item.duration) : 0} // Pass duration if available (assuming API sends it as a string)
                    currentTime={getCurrentTimeForMessage(item._id)} // Pass current time (see note below)
                    disabled={false} // Or pass a state if needed
                  />
                ) : (
                  // Render the previous UI for file/video
                  <>
                    <View style={styles.fileIcon}>
                      <Ionicons
                        name={
                          item.messageType === 'video' ? 'videocam' : 'document'
                        }
                        size={28}
                        color="#FF6B9D"
                      />
                    </View>
                    <View style={styles.fileInfo}>
                      <Text style={styles.fileName} numberOfLines={1}>
                        {item.fileName || 'File'}
                      </Text>
                      {item.fileSize && (
                        <Text style={styles.fileSize}>
                          {(item.fileSize / (1024 * 1024)).toFixed(2)} MB
                        </Text>
                      )}
                    </View>
                    <View style={styles.downloadIcon}>
                      <Ionicons name="download-outline" size={20} color="#666" />
                    </View>
                  </>
                )}
              </TouchableOpacity>
            )}
            <View style={styles.messageFooter}>
              <Text style={[
                styles.timestamp,
                isOwnMessage ? styles.ownTimestamp : styles.otherTimestamp
              ]}>
                {formatTime(item.createdAt)}
              </Text>
              {getStatusIcon(item)}
            </View>
          </View>
        </TouchableOpacity>
        {isSelected && (
          <View style={styles.deleteButtonContainer}>
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => deleteMessage(item._id)}
              disabled={deletingMessage}
            >
              {deletingMessage ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <>
                  <Ionicons name="trash-outline" size={18} color="white" />
                  <Text style={styles.deleteButtonText}>Delete</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={cancelDelete}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };
  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.headerContent}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back-outline" size={28} color="#FF6B9D" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.profileSection}
          onPress={handleProfilePress}
          activeOpacity={0.7}
        >
          {renderHeaderAvatar()}
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerName}>{receiverName}</Text>
            <View style={styles.statusContainer}>
              {receiverOnlineStatus && <View style={styles.onlineIndicator} />}
              <Text style={[
                styles.headerStatus,
                { color: receiverOnlineStatus ? '#4CAF50' : '#999' }
              ]}>
                {receiverOnlineStatus ? 'Online' : 'Offline'}
              </Text>
              {unseenCount > 0 && (
                <View style={styles.unseenBadge}>
                  <Text style={styles.unseenBadgeText}>{unseenCount}</Text>
                </View>
              )}
              {callState !== 'idle' && (
                <View style={styles.callStateBadge}>
                  <Text style={styles.callStateText}>{callState}</Text>
                </View>
              )}
            </View>
          </View>
        </TouchableOpacity>
        <View style={styles.headerActions}>
          {/* REPLACED: Header action buttons with more specific loading indicators */}
          <TouchableOpacity
              style={[
            styles.actionButton,
            (isCallActive || isInitiatingCall || !enhancedGlobalWebRTCService.isReady()) && styles.disabledButton
          ]}
          onPress={initiateAudioCall}
          disabled={isCallActive || isInitiatingCall || !enhancedGlobalWebRTCService.isReady()}
        >
          {/* Always show the icon, never the loader */}
          <Ionicons name="call-outline" size={24} color="#FF6B9D" />
        </TouchableOpacity>
                <TouchableOpacity
          style={[
            styles.actionButton,
            (isCallActive || isInitiatingCall || !enhancedGlobalWebRTCService.isReady()) && styles.disabledButton
          ]}
          onPress={initiateVideoCall}
          disabled={isCallActive || isInitiatingCall || !enhancedGlobalWebRTCService.isReady()}
        >
          {/* Always show the icon, never the loader */}
          <Ionicons name="videocam-outline" size={24} color="#FF6B9D" />
        </TouchableOpacity>
        </View>
      </View>
    </View>
  );
  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>No messages yet</Text>
      <Text style={styles.emptySubtext}>Send a message to start the conversation!</Text>
    </View>
  );
  const renderLoadMoreButton = () => {
    if (loading && page > 1) {
      return (
        <View style={styles.loadMoreIndicator}>
          <ActivityIndicator size="small" color="#FF6B9D" />
        </View>
      );
    }
    if (hasMoreMessages && messages.length > 0) {
      return (
        <TouchableOpacity onPress={loadOlderMessages} style={styles.loadMoreButton}>
          <Text style={styles.loadMoreButtonText}>Load Older Messages</Text>
        </TouchableOpacity>
      );
    }
    return null;
  };
  const renderAttachmentModal = () => (
    <Modal
      visible={showAttachmentModal}
      transparent={true}
      animationType="fade"
      onRequestClose={() => setShowAttachmentModal(false)}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={() => setShowAttachmentModal(false)}
      >
        <View style={styles.attachmentModal}>
          <Text style={styles.modalTitle}>Send Attachment</Text>
          {ImagePicker && (
            <TouchableOpacity style={styles.attachmentOption} onPress={openGallery}>
              <Ionicons name="images" size={24} color="#FF6B9D" />
              <Text style={styles.attachmentOptionText}>Gallery</Text>
            </TouchableOpacity>
          )}
          {DocumentPicker && (
            <TouchableOpacity style={styles.attachmentOption} onPress={openDocumentPicker}>
              <Ionicons name="document" size={24} color="#FF6B9D" />
              <Text style={styles.attachmentOptionText}>Document</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.modalCancelButton}
            onPress={() => setShowAttachmentModal(false)}
          >
            <Text style={styles.modalCancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
  const renderImagePreviewModal = () => (
    <Modal
      visible={showImagePreview}
      transparent={true}
      animationType="fade"
      onRequestClose={() => setShowImagePreview(false)}
    >
      <View style={styles.imagePreviewModal}>
        <View style={styles.imagePreviewHeader}>
          <TouchableOpacity onPress={() => setShowImagePreview(false)}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.imagePreviewTitle}>
            {selectedPreviewImage?.fileName ? selectedPreviewImage.fileName : 'Send Photo'}
          </Text>
          {selectedPreviewImage && !selectedPreviewImage.uri?.startsWith('http') && (
            <TouchableOpacity onPress={sendSelectedImage}>
              <Ionicons name="send" size={24} color="#FF6B9D" />
            </TouchableOpacity>
          )}
          {selectedPreviewImage && selectedPreviewImage.uri?.startsWith('http') && (
            <View style={{ width: 24 }} />
          )}
        </View>
        {selectedPreviewImage && (
          <Image
            source={{ uri: selectedPreviewImage.uri }}
            style={styles.previewImage}
            resizeMode="contain"
          />
        )}
      </View>
    </Modal>
  );
  if (loading && messages.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#1C1C1E" />
        {renderHeader()}
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF6B9D" />
          <Text style={styles.loadingText}>Loading messages...</Text>
        </View>
      </SafeAreaView>
    );
  }
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1C1C1E" />
      {/* ADDED FOR AUDIO PLAYBACK: This invisible component handles the actual audio stream */}
      {audioMessageUrl && (
        <Video
          source={{ uri: audioMessageUrl }} // The URL of the audio file to play
          paused={paused}                   // Binds the play/pause state
          onEnd={onPlaybackEnd}             // Callback for when audio finishes
          // --- Add onProgress handler ---
          onProgress={(data) => {
            if (currentlyPlaying) {
              setPlayingMessageCurrentTime(data.currentTime);
            }
          }}
          // -------------------------------
          audioOnly={true}                  // Ensures it's only for audio
          playInBackground={true}           // Allows playback while app is in the background
          playWhenInactive={true}           // Allows playback from control center
          ignoreSilentSwitch={"ignore"}     // Plays audio even if the phone is on silent
          onError={(e) => {
            console.error('Audio Playback Error:', e);
            Alert.alert("Playback Error", "Could not play this audio file.");
            onPlaybackEnd(); // Reset state in case of an error
          }}
        />
      )}
      {renderHeader()}
      <View style={styles.contentContainer}>
        <KeyboardAvoidingView
          style={styles.keyboardContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
        >
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item._id}
            renderItem={renderMessage}
            style={styles.messagesList}
            contentContainerStyle={styles.messagesContent}
            ListEmptyComponent={renderEmptyState}
            ListHeaderComponent={renderLoadMoreButton}
            showsVerticalScrollIndicator={false}
            maintainVisibleContentPosition={{
              minIndexForVisible: 0,
              autoscrollToTopThreshold: 10,
            }}
            onScrollBeginDrag={() => {
              if (unseenCount > 0) {
                markMessagesAsRead();
              }
            }}
          />
          {/* ===== START: UPDATED INPUT SECTION ===== */}
          <View style={styles.inputContainer}>
            <TouchableOpacity style={styles.cameraButton} onPress={openCamera} disabled={isAudioRecording || sending || uploadingFile}>
              <Ionicons name="camera" size={24} color={isAudioRecording || sending || uploadingFile ? "#666" : "#FF6B9D"} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.attachButton} onPress={handleAttachmentPress} disabled={isAudioRecording || sending || uploadingFile}>
              <Ionicons name="add" size={24} color={isAudioRecording || sending || uploadingFile ? "#666" : "#FF6B9D"} />
            </TouchableOpacity>
            <View style={styles.messageInputContainer}>
              <TextInput
                style={styles.messageInput}
                placeholder="Message"
                placeholderTextColor="#666"
                value={newMessage}
                onChangeText={setNewMessage}
                multiline
                maxLength={2000}
                editable={!isAudioRecording} // Disable text input while recording
              />
            </View>
            {newMessage.trim() ? (
              <TouchableOpacity
                style={styles.sendButton}
                onPress={() => sendMessage('text')}
                disabled={sending || uploadingFile || isAudioRecording} // Disable send while recording
              >
                {sending ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Feather name="send" size={20} color="white" />
                )}
              </TouchableOpacity>
            ) : (
              // Use the new AudioRecorder component with specified props removed
              <AudioRecorder
                onRecordingComplete={handleAudioRecordingComplete}
                disabled={sending || uploadingFile || newMessage.trim().length > 0} // Disable if sending, uploading, or text is present
              />
            )}
          </View>
          {/* ===== END: UPDATED INPUT SECTION ===== */}
          {uploadingFile && (
            <View style={styles.uploadingIndicator}>
              <ActivityIndicator size="small" color="#FF6B9D" />
              <Text style={styles.uploadingText}>Uploading file...</Text>
            </View>
          )}
        </KeyboardAvoidingView>
      </View>
      {renderAttachmentModal()}
      {renderImagePreviewModal()}
      {/* WebRTC Incoming Call Modal */}
      <IncomingCallModal
        visible={!!incomingCall}
        callerData={incomingCall?.caller}
        callType={incomingCall?.callType}
        onAccept={acceptIncomingCall}
        onDecline={declineIncomingCall}
        onDismiss={() => setIncomingCall(null)}
      />
    </SafeAreaView>
  );
};
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  contentContainer: {
    flex: 1,
  },
  keyboardContainer: {
    flex: 1,
  },
  header: {
    backgroundColor: '#1C1C1E',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginLeft: 8,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 2,
    borderColor: '#FF6B9D',
    overflow: 'hidden',
  },
  headerAvatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
  },
  headerAvatarText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  headerTextContainer: {
    alignItems: 'flex-start',
  },
  headerName: {
    color: 'white',
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 2,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  onlineIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4CAF50',
    marginRight: 4,
  },
  headerStatus: {
    fontSize: 12,
    fontWeight: '400',
  },
  unseenBadge: {
    backgroundColor: '#FF6B9D',
    borderRadius: 10,
    minWidth: 20,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    paddingHorizontal: 6,
  },
  unseenBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
  },
  callStateBadge: {
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 8,
  },
  callStateText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 'auto',
  },
  actionButton: {
    padding: 8,
    marginLeft: 4,
  },
  disabledButton: {
    opacity: 0.6,
  },
  messagesList: {
    flex: 1,
    backgroundColor: '#000',
  },
  messagesContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexGrow: 1,
  },
  messageWrapper: {
    marginVertical: 4,
  },
  messageContainer: {
    maxWidth: '80%',
  },
  ownMessage: {
    alignSelf: 'flex-end',
  },
  otherMessage: {
    alignSelf: 'flex-start',
  },
  selectedMessage: {
    transform: [{ scale: 0.98 }],
  },
  messageBubble: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    maxWidth: '100%',
    position: 'relative',
  },
  commonMessageBubbleAppearance: {
    backgroundColor: '#2C2C2E',
    borderWidth: 1,
    borderColor: '#FF6B9D',
  },
  selectedMessageBubble: {
    borderColor: '#FF4444',
    borderWidth: 2,
  },
  ownMessageTail: {
    borderBottomRightRadius: 8,
  },
  otherMessageTail: {
    borderBottomLeftRadius: 8,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
    color: 'white',
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  statusIcon: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  imageMessageContainer: {
    overflow: 'hidden',
  },
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
    marginBottom: 8,
  },
  fileMessageContainer: {
    // flexDirection: 'row', // Removed as AudioPlayer handles its own layout
    // alignItems: 'center',  // Removed as AudioPlayer handles its own layout
    width:'fit-content',
    padding: 8,
    minHeight: 60, // Ensure it has a minimum height for touch targets
    maxHeight: 100, // Prevent it from stretching too tall // Keep padding for touch area
  },
  fileIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  fileSize: {
    color: '#999',
    fontSize: 12,
    marginTop: 2,
  },
  downloadIcon: {
    padding: 8,
    marginLeft: 8,
  },
  timestamp: {
    fontSize: 10,
    color: '#999',
  },
  ownTimestamp: {
    alignSelf: 'flex-end',
  },
  otherTimestamp: {
    alignSelf: 'flex-start',
  },
  deleteButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
    paddingHorizontal: 16,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF4444',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    marginRight: 8,
  },
  deleteButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  cancelButton: {
    backgroundColor: '#2C2C2E',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#555',
  },
  cancelButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1C1C1E',
    borderTopWidth: 1,
    borderTopColor: '#2C2C2E',
    minHeight: 60,
  },
  cameraButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2C2C2E',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  attachButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2C2C2E',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  messageInputContainer: {
    flex: 1,
    backgroundColor: '#2C2C2E',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    minHeight: 36,
    justifyContent: 'center',
  },
  messageInput: {
    color: 'white',
    fontSize: 16,
    maxHeight: 100,
    textAlignVertical: 'center',
    paddingTop: 0,
    paddingBottom: 0,
    lineHeight: 20,
  },
  sendButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FF6B9D',
    justifyContent: 'center',
    alignItems: 'center',
  },
  audioIconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2C2C2E',
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.6,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#666',
    fontSize: 16,
    marginTop: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    color: '#999',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtext: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
  },
  loadMoreButton: {
    padding: 10,
    backgroundColor: '#2C2C2E',
    borderRadius: 10,
    alignSelf: 'center',
    marginVertical: 10,
    borderWidth: 1,
    borderColor: '#FF6B9D',
  },
  loadMoreButtonText: {
    color: '#FF6B9D',
    fontSize: 14,
    fontWeight: '600',
  },
  loadMoreIndicator: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  uploadingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    backgroundColor: '#1C1C1E',
  },
  uploadingText: {
    color: '#FF6B9D',
    fontSize: 14,
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  attachmentModal: {
    backgroundColor: '#1C1C1E',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 16,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  modalTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 20,
  },
  attachmentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#2C2C2E',
    marginBottom: 12,
  },
  attachmentOptionText: {
    color: 'white',
    fontSize: 16,
    marginLeft: 16,
  },
  modalCancelButton: {
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  modalCancelButtonText: {
    color: '#FF6B9D',
    fontSize: 16,
    fontWeight: '600',
  },
  imagePreviewModal: {
    flex: 1,
    backgroundColor: '#000',
  },
  imagePreviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: Platform.OS === 'ios' ? 50 : 12,
  },
  imagePreviewTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  previewImage: {
    flex: 1,
    width: width,
    height: height - 100,
  },
});
export default ChatDetailScreen;
