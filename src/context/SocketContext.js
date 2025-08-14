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
  // Enhanced online users management
  const [onlineUsers, setOnlineUsers] = useState([]); // Keep as array
  const [onlineUserIds, setOnlineUserIds] = useState(new Set()); // Add Set for faster lookup
  
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

  // Enhanced socket listeners in initializeSocket function
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
        transports: ['polling', 'websocket'],
        upgrade: true,
        rememberUpgrade: false,
        timeout: 15000,
        reconnection: true,
        reconnectionAttempts: maxReconnectAttempts,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        randomizationFactor: 0.3,
        forceNew: true,
        autoConnect: true,
        withCredentials: false,
        query: {
          platform: Platform.OS,
          userId: user._id,
          version: '1.0.0',
          callsEnabled: true
        }
      });

      // ENHANCED: Connection event handlers
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
            supportsIncomingCalls: true
          }
        });

        // Verify room membership for calls
        socketInstance.emit('verify_room_membership', { userId: user._id });
        
        // Request current online users immediately
        socketInstance.emit('getAllOnlineUsers');
        
        // Enable call notifications
        socketInstance.emit('enable_call_notifications', { userId: user._id });
      });
      
      // Enhanced online users management
      socketInstance.on('allOnlineUsers', (users) => {
        console.log('👥 All online users received:', users);
        
        // Handle different response formats from backend
        let processedUsers = [];
        let processedUserIds = new Set();
        
        if (Array.isArray(users)) {
          processedUsers = users;
          processedUserIds = new Set(users.map(user => {
            // Handle different user object structures
            if (typeof user === 'string') {
              return user;
            }
            return user._id || user.id || user.userId;
          }).filter(Boolean));
        } else if (users && Array.isArray(users.users)) {
          // Handle nested structure: { users: [...] }
          processedUsers = users.users;
          processedUserIds = new Set(users.users.map(user => user._id || user.id).filter(Boolean));
        } else if (users && users.data && Array.isArray(users.data)) {
          // Handle API response structure: { data: [...] }
          processedUsers = users.data;
          processedUserIds = new Set(users.data.map(user => user._id || user.id).filter(Boolean));
        }
        
        console.log('👥 Processed online users:', processedUsers.length, 'IDs:', Array.from(processedUserIds));
        
        setOnlineUsers(processedUsers);
        setOnlineUserIds(processedUserIds);
      });

      socketInstance.on('userOnline', (userData) => {
        console.log('✅ User came online:', userData);
        
        const userId = userData.userId || userData.user?._id || userData._id;
        const userInfo = userData.user || userData.userInfo || { _id: userId };
        
        if (userId) {
          setOnlineUsers(prev => {
            // Check if user already exists
            const exists = prev.find(u => (u._id || u.id) === userId);
            if (exists) {
              console.log('👤 User already in online list:', userId);
              return prev;
            }
            
            console.log('👤 Adding user to online list:', userId);
            return [...prev, userInfo];
          });
          
          setOnlineUserIds(prev => new Set([...prev, userId]));
        }
      });

      socketInstance.on('userOffline', (userData) => {
        console.log('❌ User went offline:', userData);
        
        const userId = userData.userId || userData.user?._id || userData._id;
        
        if (userId) {
          setOnlineUsers(prev => prev.filter(u => (u._id || u.id) !== userId));
          setOnlineUserIds(prev => {
            const newSet = new Set(prev);
            newSet.delete(userId);
            return newSet;
          });
        }
      });

      // Add connection health monitoring
      socketInstance.on('disconnect', (reason) => {
        console.log('❌ Socket disconnected:', reason);
        setIsConnected(false);
        
        // Clear online users when disconnected
        setOnlineUsers([]);
        setOnlineUserIds(new Set());
        
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

      // ... other listeners like 'incoming_call', 'newMessage', etc. remain here ...
            // ENHANCED: Call event handlers with global forwarding
            socketInstance.on('incoming_call', (callData) => {
              console.log('📞 SOCKET: Incoming call received:', JSON.stringify(callData, null, 2));
              
              if (!callData || (!callData.caller && !callData.from)) {
                console.error('❌ Invalid incoming call data via socket');
                return;
              }
      
              if (globalCallHandlersRef.current.onIncomingCall) {
                try {
                  globalCallHandlersRef.current.onIncomingCall(callData);
                } catch (error) {
                  console.error('❌ Error in global incoming call handler:', error);
                }
              } else {
                console.warn('⚠️ No global incoming call handler registered');
              }
      
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
            socketInstance.on('webrtc_offer', (data) => console.log('📡 SOCKET: WebRTC offer received:', data));
            socketInstance.on('webrtc_answer', (data) => console.log('📡 SOCKET: WebRTC answer received:', data));
            socketInstance.on('webrtc_ice_candidate', (data) => console.log('📡 SOCKET: ICE candidate received:', data));
      
            // Enhanced room and connection confirmations
            socketInstance.on('room_verification_result', (data) => {
              console.log('🔍 Room verification result:', data);
              if (!data.isInUserRoom) {
                console.warn('⚠️ User not in personal room, re-joining...');
                socketInstance.emit('join_user_room', { userId: user._id });
              }
            });
      
            socketInstance.on('call_notifications_enabled', (data) => console.log('🔔 Call notifications enabled:', data));
            socketInstance.on('user_room_joined', (data) => console.log('✅ User room joined successfully:', data));
      
            // Chat event handlers
            socketInstance.on('newMessage', (data) => console.log('💬 New message received:', data));
            socketInstance.on('messageNotification', (data) => console.log('🔔 Message notification:', data));
            socketInstance.on('userTyping', (data) => console.log('⌨️ User typing:', data));
            socketInstance.on('messagesRead', (data) => console.log('👁️ Messages read:', data));
      
            // Connection health monitoring
            socketInstance.on('pong', () => console.log('🏓 Pong received - connection healthy'));
            socketInstance.on('error', (error) => console.error('🚨 Socket error:', error));

      setSocket(socketInstance);
      
      // Test connection health
      setTimeout(() => {
        if (socketInstance.connected) {
          socketInstance.emit('ping');
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
      
      if (socket.connected) {
        socket.emit('user_offline', { userId: user?._id });
      }
      
      socket.disconnect();
      setSocket(null);
      setIsConnected(false);
      setOnlineUsers([]);
      setOnlineUserIds(new Set());
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

    const delay = Math.min(1000 * Math.pow(1.5, connectionAttempts), 5000);
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

  const emitCallAction = useCallback((action, callData) => {
    if (socket && isConnected) {
      console.log(`📡 SOCKET: Emitting ${action}:`, JSON.stringify(callData, null, 2));
      socket.emit(action, callData);
      return true;
    } else {
      console.warn(`⚠️ Cannot emit ${action}: Socket not connected`);
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

  const emitMessage = useCallback((messageData) => {
    if (socket && isConnected) {
      console.log('📤 Emitting message:', messageData);
      socket.emit('sendMessage', messageData);
      return true;
    }
    console.warn('⚠️ Cannot send message: Socket not connected');
    return false;
  }, [socket, isConnected]);

  const emitJoinConversation = useCallback((conversationId) => {
    if (socket && isConnected && conversationId) {
      console.log('🚪 Joining conversation room:', conversationId);
      socket.emit('joinConversation', { conversationId });
      return true;
    }
    console.warn('⚠ Cannot join conversation: Socket not connected or missing conversationId');
    return false;
  }, [socket, isConnected]);

  const emitLeaveConversation = useCallback((conversationId) => {
    if (socket && conversationId) {
      console.log('🚪 Leaving conversation room:', conversationId);
      socket.emit('leaveConversation', { conversationId });
      return true;
    }
    return false;
  }, [socket]);

  const verifySocketConnection = useCallback(() => {
    if (socket && socket.connected) {
      socket.emit('ping');
      return true;
    }
    return false;
  }, [socket]);
  
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

  // Enhanced utility functions
  const isUserOnline = useCallback((userId) => {
    if (!isConnected || !userId) {
      console.log('⚠ Cannot check online status: socket not connected or no userId');
      return false;
    }
    
    const isOnline = onlineUserIds.has(userId);
    console.log(`👤 User ${userId} online status:`, isOnline);
    return isOnline;
  }, [isConnected, onlineUserIds]);

  const getOnlineStatus = useCallback((userId) => {
    return {
      isOnline: isUserOnline(userId),
      isConnected: isConnected,
      totalOnlineUsers: onlineUsers.length
    };
  }, [isUserOnline, isConnected, onlineUsers.length]);


  // Add to your value object:
  const value = {
    socket,
    isConnected,
    onlineUsers,
    onlineUserIds, // Add this for direct Set access
    connectionAttempts,
    maxReconnectAttempts,
    
    // Enhanced online status functions
    isUserOnline,
    getOnlineStatus,
    
    registerGlobalCallHandlers,
    
    // Message functions
    emitMessage,
    emitTyping: (conversationId, receiverId) => socket?.emit('typing', { conversationId, receiverId, isTyping: true }),
    emitStopTyping: (conversationId, receiverId) => socket?.emit('typing', { conversationId, receiverId, isTyping: false }),
    markMessagesAsRead: (conversationId) => socket?.emit('markMessagesAsRead', { conversationId }),
    
    // Call functions
    emitJoinCall,
    emitCallAction,
    
    // Conversation functions
    joinConversation: emitJoinConversation,
    leaveConversation: emitLeaveConversation,
    
    // Connection management
    initializeSocket,
    disconnectSocket,
    forceReconnect,
    pingServer: verifySocketConnection, // Reuse verify as ping
    verifySocketConnection,
    
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