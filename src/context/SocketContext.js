// src/context/SocketContext.js - ENHANCED FOR GLOBAL CALL RECEPTION
import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import io from 'socket.io-client';
import { useAuth } from './AuthContext';
import { AppState, Platform } from 'react-native';
import BASE_URL from '../config/config';

const SocketContext = createContext();

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const { user, token, isAuthenticated } = useAuth();
  
  const reconnectTimeoutRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);
  const maxReconnectAttempts = 5;
  
  // ENHANCED: Global call event handlers registry
  const globalCallHandlersRef = useRef({
    onIncomingCall: null,
    onCallAccepted: null,
    onCallDeclined: null,
    onCallEnded: null,
    onCallMissed: null,
    onCallError: null
  });

  // Register global call handlers (to be called from App.js)
  const registerGlobalCallHandlers = useCallback((handlers) => {
    console.log('📞 Registering global call handlers in SocketContext');
    globalCallHandlersRef.current = { ...globalCallHandlersRef.current, ...handlers };
  }, []);

  // Initialize socket connection
  useEffect(() => {
    if (isAuthenticated && user && token) {
      initializeSocket();
    } else {
      disconnectSocket();
    }

    return () => {
      disconnectSocket();
    };
  }, [isAuthenticated, user, token]);

  // Handle app state changes
  useEffect(() => {
    const handleAppStateChange = (nextAppState) => {
      if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
        // App came to foreground
        if (isAuthenticated && user && !socket?.connected) {
          console.log('🔄 App became active, reconnecting socket...');
          setConnectionAttempts(0);
          initializeSocket();
        }
      } else if (nextAppState === 'background') {
        // App went to background - keep socket connected for calls
        console.log('📱 App went to background, keeping socket connected for calls');
        if (socket && socket.connected) {
          socket.emit('userActivity', { status: 'background' });
        }
      }
      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [isAuthenticated, user, socket]);

  const initializeSocket = useCallback(() => {
    try {
      console.log('🔌 Initializing socket connection...');
      console.log('🔗 Connecting to:', BASE_URL);
      
      // Disconnect existing socket before creating new one
      if (socket) {
        socket.disconnect();
      }

      const socketInstance = io(BASE_URL, {
        auth: {
          token: token,
          userId: user._id,
        },
        
        // Enhanced transport configuration for call reliability
        transports: ['polling', 'websocket'],
        upgrade: true,
        rememberUpgrade: false,
        
        // Connection settings optimized for real-time calls
        timeout: 15000,
        reconnection: true,
        reconnectionAttempts: maxReconnectAttempts,
        reconnectionDelay: 1000, // Faster reconnection for calls
        reconnectionDelayMax: 5000, // Reduced max delay
        maxReconnectionAttempts: maxReconnectAttempts,
        randomizationFactor: 0.3,
        
        forceNew: true,
        autoConnect: true,
        withCredentials: false,
        
        query: {
          platform: Platform.OS,
          userId: user._id,
          version: '1.0.0',
          callsEnabled: true // Indicate this client can receive calls
        }
      });

      // ENHANCED: Connection event handlers with call-specific setup
      socketInstance.on('connect', () => {
        console.log('✅ Socket connected successfully');
        console.log('🔗 Transport:', socketInstance.io.engine.transport.name);
        console.log('🆔 Socket ID:', socketInstance.id);
        
        setIsConnected(true);
        setConnectionAttempts(0);
        clearReconnectTimeout();
        
        // CRITICAL: Join user to their personal room for calls
        socketInstance.emit('user_online', {
          userId: user._id,
          userInfo: {
            _id: user._id,
            fullName: user.fullName,
            photoUrl: user.photoUrl,
            profilePic: user.profilePic,
            platform: Platform.OS,
            appState: appStateRef.current,
            supportsIncomingCalls: true // Mark as call-capable
          }
        });

        // Verify room membership for calls
        socketInstance.emit('verify_room_membership', { userId: user._id });
        
        // Request current online users
        socketInstance.emit('getAllOnlineUsers');
        
        // Enable call notifications
        socketInstance.emit('enable_call_notifications', { userId: user._id });
      });

      socketInstance.on('disconnect', (reason) => {
        console.log('❌ Socket disconnected:', reason);
        setIsConnected(false);
        
        if (reason === 'io server disconnect' || reason === 'io client disconnect') {
          console.log('🚫 Manual disconnect, not reconnecting');
          return;
        }
        
        if (connectionAttempts < maxReconnectAttempts) {
          console.log(`🔄 Will attempt reconnection (${connectionAttempts + 1}/${maxReconnectAttempts})`);
          scheduleReconnect();
        }
      });

      socketInstance.on('connect_error', (error) => {
        console.error('❌ Socket connection error:', error);
        setIsConnected(false);
        setConnectionAttempts(prev => prev + 1);
        
        if (connectionAttempts < maxReconnectAttempts) {
          scheduleReconnect();
        }
      });

      // ENHANCED: Call event handlers with global forwarding
      socketInstance.on('incoming_call', (callData) => {
        console.log('📞 SOCKET: Incoming call received:', JSON.stringify(callData, null, 2));
        
        // Validate call data
        if (!callData || (!callData.caller && !callData.from)) {
          console.error('❌ Invalid incoming call data via socket');
          return;
        }

        // Forward to global handler
        if (globalCallHandlersRef.current.onIncomingCall) {
          try {
            globalCallHandlersRef.current.onIncomingCall(callData);
          } catch (error) {
            console.error('❌ Error in global incoming call handler:', error);
          }
        } else {
          console.warn('⚠️ No global incoming call handler registered');
        }

        // Acknowledge receipt
        socketInstance.emit('call_received_acknowledgment', {
          callId: callData.callId || callData.id,
          receiverId: user._id
        });
      });

      socketInstance.on('call_accepted', (callData) => {
        console.log('✅ SOCKET: Call accepted:', JSON.stringify(callData, null, 2));
        
        if (globalCallHandlersRef.current.onCallAccepted) {
          globalCallHandlersRef.current.onCallAccepted(callData);
        }
      });

      socketInstance.on('call_declined', (callData) => {
        console.log('❌ SOCKET: Call declined:', JSON.stringify(callData, null, 2));
        
        if (globalCallHandlersRef.current.onCallDeclined) {
          globalCallHandlersRef.current.onCallDeclined(callData);
        }
      });

      socketInstance.on('call_ended', (callData) => {
        console.log('📴 SOCKET: Call ended:', JSON.stringify(callData, null, 2));
        
        if (globalCallHandlersRef.current.onCallEnded) {
          globalCallHandlersRef.current.onCallEnded(callData);
        }
      });

      socketInstance.on('call_missed', (callData) => {
        console.log('📞❌ SOCKET: Call missed:', JSON.stringify(callData, null, 2));
        
        if (globalCallHandlersRef.current.onCallMissed) {
          globalCallHandlersRef.current.onCallMissed(callData);
        }
      });

      socketInstance.on('call_error', (error) => {
        console.error('📞❌ SOCKET: Call error:', error);
        
        if (globalCallHandlersRef.current.onCallError) {
          globalCallHandlersRef.current.onCallError(error);
        }
      });

      // WebRTC signaling events
      socketInstance.on('webrtc_offer', (data) => {
        console.log('📡 SOCKET: WebRTC offer received:', data);
      });

      socketInstance.on('webrtc_answer', (data) => {
        console.log('📡 SOCKET: WebRTC answer received:', data);
      });

      socketInstance.on('webrtc_ice_candidate', (data) => {
        console.log('📡 SOCKET: ICE candidate received:', data);
      });

      // Enhanced room and connection confirmations
      socketInstance.on('room_verification_result', (data) => {
        console.log('🔍 Room verification result:', data);
        if (!data.isInUserRoom) {
          console.warn('⚠️ User not in personal room, re-joining...');
          socketInstance.emit('join_user_room', { userId: user._id });
        }
      });

      socketInstance.on('call_notifications_enabled', (data) => {
        console.log('🔔 Call notifications enabled:', data);
      });

      socketInstance.on('user_room_joined', (data) => {
        console.log('✅ User room joined successfully:', data);
      });

      // Chat event handlers
      socketInstance.on('newMessage', (data) => {
        console.log('💬 New message received:', data);
      });

      socketInstance.on('messageNotification', (data) => {
        console.log('🔔 Message notification:', data);
      });

      socketInstance.on('userTyping', (data) => {
        console.log('⌨️ User typing:', data);
      });

      socketInstance.on('messagesRead', (data) => {
        console.log('👁️ Messages read:', data);
      });

      // Online users management
      socketInstance.on('allOnlineUsers', (users) => {
        console.log('👥 All online users received:', users?.length || 0);
        setOnlineUsers(users || []);
      });

      socketInstance.on('userOnline', (userData) => {
        console.log('✅ User came online:', userData.user?.fullName);
        setOnlineUsers(prev => {
          const exists = prev.find(u => u._id === userData.user?._id);
          return exists ? prev : [...prev, userData.user];
        });
      });

      socketInstance.on('userOffline', (userData) => {
        console.log('❌ User went offline:', userData.user?.fullName);
        setOnlineUsers(prev => prev.filter(u => u._id !== userData.user?._id));
      });

      // Connection health monitoring
      socketInstance.on('pong', () => {
        console.log('🏓 Pong received - connection healthy');
      });

      socketInstance.on('error', (error) => {
        console.error('🚨 Socket error:', error);
      });

      setSocket(socketInstance);
      
      // Test connection health
      setTimeout(() => {
        if (socketInstance.connected) {
          socketInstance.emit('ping');
          socketInstance.emit('debug_call_events');
        }
      }, 2000);

    } catch (error) {
      console.error('❌ Failed to initialize socket:', error);
      setConnectionAttempts(prev => prev + 1);
      if (connectionAttempts < maxReconnectAttempts) {
        scheduleReconnect();
      }
    }
  }, [user, token, connectionAttempts]);

  const disconnectSocket = useCallback(() => {
    if (socket) {
      console.log('🔌 Disconnecting socket...');
      
      // Emit user going offline
      if (socket.connected) {
        socket.emit('user_offline', { userId: user?._id });
      }
      
      socket.disconnect();
      setSocket(null);
      setIsConnected(false);
      setOnlineUsers([]);
      setConnectionAttempts(0);
      clearReconnectTimeout();
    }
  }, [socket, user]);

  const scheduleReconnect = useCallback(() => {
    clearReconnectTimeout();
    
    if (connectionAttempts >= maxReconnectAttempts) {
      console.log('❌ Max reconnection attempts reached');
      return;
    }

    const delay = Math.min(1000 * Math.pow(1.5, connectionAttempts), 5000); // Faster backoff for calls
    console.log(`🔄 Scheduling reconnect in ${delay}ms (attempt ${connectionAttempts + 1}/${maxReconnectAttempts})`);
    
    reconnectTimeoutRef.current = setTimeout(() => {
      if (isAuthenticated && user && !socket?.connected) {
        console.log('🔄 Attempting to reconnect socket...');
        initializeSocket();
      }
    }, delay);
  }, [connectionAttempts, isAuthenticated, user, socket, initializeSocket]);

  const clearReconnectTimeout = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  // ENHANCED: Call-related emission functions with better error handling
  const emitCallAction = useCallback((action, callData) => {
    if (socket && isConnected) {
      console.log(`📡 SOCKET: Emitting ${action}:`, JSON.stringify(callData, null, 2));
      socket.emit(action, callData);
      return true;
    } else {
      console.warn(`⚠️ Cannot emit ${action}: Socket not connected`);
      
      // Try emergency reconnect for critical call actions
      if (['call_accepted', 'call_declined', 'call_ended'].includes(action)) {
        console.log('🚨 Emergency reconnect for critical call action');
        if (isAuthenticated && user) {
          initializeSocket();
        }
      }
      return false;
    }
  }, [socket, isConnected, isAuthenticated, user, initializeSocket]);

  const emitJoinCall = useCallback((callData) => {
    return emitCallAction('call_initiated', callData);
  }, [emitCallAction]);

  // Enhanced utility functions
  const emitMessage = useCallback((messageData) => {
    if (socket && isConnected) {
      console.log('📤 Emitting message:', messageData);
      socket.emit('sendMessage', messageData);
      return true;
    } else {
      console.warn('⚠️ Cannot send message: Socket not connected');
      return false;
    }
  }, [socket, isConnected]);

  const joinConversation = useCallback((conversationId) => {
    if (socket && isConnected) {
      console.log('🚪 Joining conversation:', conversationId);
      socket.emit('joinConversation', { conversationId });
      return true;
    }
    return false;
  }, [socket, isConnected]);

  const leaveConversation = useCallback((conversationId) => {
    if (socket && isConnected) {
      console.log('🚪 Leaving conversation:', conversationId);
      socket.emit('leaveConversation', { conversationId });
      return true;
    }
    return false;
  }, [socket, isConnected]);

  const pingServer = useCallback(() => {
    if (socket && isConnected) {
      console.log('🏓 Sending ping...');
      socket.emit('ping');
      return true;
    }
    return false;
  }, [socket, isConnected]);

  const forceReconnect = useCallback(() => {
    console.log('🔄 Force reconnecting...');
    setConnectionAttempts(0);
    disconnectSocket();
    setTimeout(() => {
      if (isAuthenticated && user) {
        initializeSocket();
      }
    }, 1000);
  }, [disconnectSocket, isAuthenticated, user, initializeSocket]);

  // Test call functionality
  const testCallReceive = useCallback(() => {
    if (socket && isConnected) {
      console.log('🧪 Testing call receive functionality...');
      socket.emit('test_incoming_call', { userId: user._id });
      return true;
    }
    return false;
  }, [socket, isConnected, user]);

  const value = {
    socket,
    isConnected,
    onlineUsers,
    connectionAttempts,
    maxReconnectAttempts,
    
    // ENHANCED: Global call handler registration
    registerGlobalCallHandlers,
    
    // Message functions
    emitMessage,
    emitTyping: (conversationId, receiverId) => {
      return socket && isConnected ? socket.emit('typing', { conversationId, receiverId, isTyping: true }) : false;
    },
    emitStopTyping: (conversationId, receiverId) => {
      return socket && isConnected ? socket.emit('typing', { conversationId, receiverId, isTyping: false }) : false;
    },
    markMessagesAsRead: (conversationId) => {
      return socket && isConnected ? socket.emit('markMessagesAsRead', { conversationId }) : false;
    },
    
    // Call functions
    emitJoinCall,
    emitCallAction,
    
    // Conversation functions
    joinConversation,
    leaveConversation,
    
    // Connection management
    initializeSocket,
    disconnectSocket,
    forceReconnect,
    pingServer,
    testCallReceive,
    
    // Utility
    isSocketHealthy: isConnected && socket?.connected,
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};

export default SocketProvider;