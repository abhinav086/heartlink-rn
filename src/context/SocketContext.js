// src/context/SocketContext.js - UPDATED: Enhanced Live Streaming Support
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
  const [onlineUserIds, setOnlineUserIds] = useState(new Set());
  
  const { user, token, isAuthenticated } = useAuth();
  
  const reconnectTimeoutRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);
  const maxReconnectAttempts = 5;
  
  // Stream event handlers registry
  const streamHandlersRef = useRef({
    // Component-level handlers (UI stuff)
    onViewerCount: null,
    onStreamEnded: null,
    onStreamEndedByBroadcaster: null,
    onStreamInterrupted: null,
    onChatMessage: null,
    onUserTyping: null,
    onNewReaction: null,
    onLikeUpdate: null,
    onStreamWentLive: null,
    
    // WebRTC-specific handlers (from Enhanced WebRTC Service)
    onStreamCreated: null,
    onBroadcastStarted: null,
    onStreamJoined: null,
    onWebRTCOffer: null,
    onWebRTCAnswer: null,
    onWebRTCIceCandidate: null,
    onViewerJoined: null,
    onViewerLeft: null,
    onConnectionStatus: null,
  });

  // Register stream handlers with merge instead of replace
  const registerStreamHandlers = useCallback((handlers) => {
    console.log('🎥 Registering stream handlers in SocketContext:', Object.keys(handlers));
    streamHandlersRef.current = { 
      ...streamHandlersRef.current, 
      ...handlers 
    };
    console.log('🎥 Total registered handlers:', Object.keys(streamHandlersRef.current).filter(key => streamHandlersRef.current[key] !== null));
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
        if (isAuthenticated && user && !socket?.connected) {
          console.log('🔄 App became active, reconnecting socket...');
          setConnectionAttempts(0);
          initializeSocket();
        }
      } else if (nextAppState === 'background') {
        console.log('📱 App went to background, keeping socket connected');
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
      
      if (socket) {
        socket.disconnect();
      }

      const socketInstance = io(BASE_URL, {
        auth: {
          token: token,
        },
        transports: ['websocket', 'polling'],
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
      });

      // Connection event handlers
      socketInstance.on('connect', () => {
        console.log('✅ Socket connected successfully');
        console.log('🔗 Transport:', socketInstance.io.engine.transport.name);
        console.log('🆔 Socket ID:', socketInstance.id);
        
        setIsConnected(true);
        setConnectionAttempts(0);
        clearReconnectTimeout();
        
        // Join user to their personal room
        socketInstance.emit('user_online', {
          userId: user._id,
          userInfo: {
            _id: user._id,
            fullName: user.fullName,
            photoUrl: user.photoUrl,
            profilePic: user.profilePic,
            platform: Platform.OS,
            appState: appStateRef.current,
          }
        });
      });
      
      // Online users management
      socketInstance.on('allOnlineUsers', (users) => {
        console.log('👥 All online users received:', users);
        let processedUsers = [];
        let processedUserIds = new Set();
        
        if (Array.isArray(users)) {
          processedUsers = users;
          processedUserIds = new Set(users.map(user => user._id || user.id || user.userId).filter(Boolean));
        } else if (users && Array.isArray(users.users)) {
          processedUsers = users.users;
          processedUserIds = new Set(users.users.map(user => user._id || user.id).filter(Boolean));
        }
        
        setOnlineUsers(processedUsers);
        setOnlineUserIds(processedUserIds);
      });

      socketInstance.on('userOnline', (userData) => {
        console.log('✅ User came online:', userData);
        const userId = userData.userId || userData.user?._id || userData._id;
        const userInfo = userData.user || userData.userInfo || { _id: userId };
        
        if (userId) {
          setOnlineUsers(prev => {
            const exists = prev.find(u => (u._id || u.id) === userId);
            if (exists) return prev;
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

      socketInstance.on('disconnect', (reason) => {
        console.log('❌ Socket disconnected:', reason);
        setIsConnected(false);
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

      // ===== ENHANCED LIVE STREAMING EVENTS =====
      
      // Stream creation and management
      socketInstance.on('stream_created', (data) => {
        console.log('🎥 Stream created event received:', data);
        try {
          if (streamHandlersRef.current.onStreamCreated) {
            streamHandlersRef.current.onStreamCreated(data);
          } else {
            console.warn('⚠️ No handler registered for stream_created');
          }
        } catch (error) {
          console.error('❌ Error in stream_created handler:', error);
        }
      });

      socketInstance.on('stream_broadcast_started', (data) => {
        console.log('📡 Broadcast started event received:', data);
        try {
          if (streamHandlersRef.current.onBroadcastStarted) {
            streamHandlersRef.current.onBroadcastStarted(data);
          } else {
            console.warn('⚠️ No handler registered for stream_broadcast_started');
          }
        } catch (error) {
          console.error('❌ Error in stream_broadcast_started handler:', error);
        }
      });

      socketInstance.on('stream_joined_as_viewer', (data) => {
        console.log('👁️ Stream joined as viewer event received:', data);
        try {
          if (streamHandlersRef.current.onStreamJoined) {
            streamHandlersRef.current.onStreamJoined(data);
          } else {
            console.warn('⚠️ No handler registered for stream_joined_as_viewer');
          }
        } catch (error) {
          console.error('❌ Error in stream_joined_as_viewer handler:', error);
        }
      });

      // WebRTC signaling events
      socketInstance.on('stream_webrtc_offer', (data) => {
        console.log('📡 WebRTC offer event received:', data);
        try {
          if (streamHandlersRef.current.onWebRTCOffer) {
            streamHandlersRef.current.onWebRTCOffer(data);
          } else {
            console.warn('⚠️ No handler registered for stream_webrtc_offer');
          }
        } catch (error) {
          console.error('❌ Error in stream_webrtc_offer handler:', error);
        }
      });

      socketInstance.on('stream_webrtc_answer', (data) => {
        console.log('📡 WebRTC answer event received:', data);
        try {
          if (streamHandlersRef.current.onWebRTCAnswer) {
            streamHandlersRef.current.onWebRTCAnswer(data);
          } else {
            console.warn('⚠️ No handler registered for stream_webrtc_answer');
          }
        } catch (error) {
          console.error('❌ Error in stream_webrtc_answer handler:', error);
        }
      });

      socketInstance.on('stream_webrtc_ice_candidate', (data) => {
        console.log('🧊 WebRTC ICE candidate event received:', data);
        try {
          if (streamHandlersRef.current.onWebRTCIceCandidate) {
            streamHandlersRef.current.onWebRTCIceCandidate(data);
          } else {
            console.warn('⚠️ No handler registered for stream_webrtc_ice_candidate');
          }
        } catch (error) {
          console.error('❌ Error in stream_webrtc_ice_candidate handler:', error);
        }
      });

      // Viewer management events
      socketInstance.on('stream_viewer_joined', (data) => {
        console.log('👁️ Viewer joined event received:', data);
        try {
          if (streamHandlersRef.current.onViewerJoined) {
            streamHandlersRef.current.onViewerJoined(data);
          }
          if (streamHandlersRef.current.onViewerCount) {
            streamHandlersRef.current.onViewerCount({ count: data.currentViewerCount });
          }
        } catch (error) {
          console.error('❌ Error in stream_viewer_joined handler:', error);
        }
      });

      socketInstance.on('stream_viewer_left', (data) => {
        console.log('👁️ Viewer left event received:', data);
        try {
          if (streamHandlersRef.current.onViewerLeft) {
            streamHandlersRef.current.onViewerLeft(data);
          }
          if (streamHandlersRef.current.onViewerCount) {
            streamHandlersRef.current.onViewerCount({ count: data.currentViewerCount });
          }
        } catch (error) {
          console.error('❌ Error in stream_viewer_left handler:', error);
        }
      });

      socketInstance.on('stream_viewer_count_updated', (data) => {
        console.log('👥 Viewer count updated event received:', data);
        try {
          if (streamHandlersRef.current.onViewerCount) {
            streamHandlersRef.current.onViewerCount({ count: data.currentViewerCount });
          }
        } catch (error) {
          console.error('❌ Error in stream_viewer_count_updated handler:', error);
        }
      });

      // Connection status events
      socketInstance.on('stream_connection_status', (data) => {
        console.log('🔗 Connection status event received:', data);
        try {
          if (streamHandlersRef.current.onConnectionStatus) {
            streamHandlersRef.current.onConnectionStatus(data);
          }
        } catch (error) {
          console.error('❌ Error in stream_connection_status handler:', error);
        }
      });

      // Discovery events
      socketInstance.on('stream_went_live', (data) => {
        console.log('📢 Stream went live event received:', data);
        try {
          if (streamHandlersRef.current.onStreamWentLive) {
            streamHandlersRef.current.onStreamWentLive(data);
          }
        } catch (error) {
          console.error('❌ Error in stream_went_live handler:', error);
        }
      });

      // Chat and interaction events
      socketInstance.on('stream_chat_message', (data) => {
        console.log('💬 Stream chat message event received:', data);
        try {
          if (streamHandlersRef.current.onChatMessage) {
            streamHandlersRef.current.onChatMessage(data);
          }
        } catch (error) {
          console.error('❌ Error in stream_chat_message handler:', error);
        }
      });

      socketInstance.on('stream_reaction', (data) => {
        console.log('❤️ Stream reaction event received:', data);
        try {
          if (streamHandlersRef.current.onNewReaction) {
            streamHandlersRef.current.onNewReaction(data);
          }
        } catch (error) {
          console.error('❌ Error in stream_reaction handler:', error);
        }
      });

      // Stream end events
      socketInstance.on('stream_ended_by_broadcaster', (data) => {
        console.log('🔚 Stream ended by broadcaster event received:', data);
        try {
          if (streamHandlersRef.current.onStreamEndedByBroadcaster) {
            streamHandlersRef.current.onStreamEndedByBroadcaster(data);
          }
          if (streamHandlersRef.current.onStreamEnded) {
            streamHandlersRef.current.onStreamEnded(data);
          }
        } catch (error) {
          console.error('❌ Error in stream_ended_by_broadcaster handler:', error);
        }
      });

      socketInstance.on('stream_ended', (data) => {
        console.log('🔚 Stream ended event received:', data);
        try {
          if (streamHandlersRef.current.onStreamEnded) {
            streamHandlersRef.current.onStreamEnded(data);
          }
        } catch (error) {
          console.error('❌ Error in stream_ended handler:', error);
        }
      });

      socketInstance.on('stream_interrupted', (data) => {
        console.log('⚠️ Stream interrupted event received:', data);
        try {
          if (streamHandlersRef.current.onStreamInterrupted) {
            streamHandlersRef.current.onStreamInterrupted(data);
          }
        } catch (error) {
          console.error('❌ Error in stream_interrupted handler:', error);
        }
      });

      // Error events
      socketInstance.on('stream_error', (data) => {
        console.error('❌ Stream error event received:', data);
        // Stream errors are typically handled by the WebRTC service directly
      });

      // ===== CALL/VIDEO EVENTS (EXISTING) =====
      socketInstance.on('incoming_call', async (data) => {
        console.log('📞 Incoming call via socket:', data);
        // Existing call logic...
      });

      socketInstance.on('call_accepted', async (data) => {
        console.log('✅ Call accepted via socket:', data);
        // Existing call logic...
      });

      socketInstance.on('call_declined', async (data) => {
        console.log('❌ Call declined via socket:', data);
        // Existing call logic...
      });

      socketInstance.on('call_ended', async (data) => {
        console.log('🔚 Call ended via socket:', data);
        // Existing call logic...
      });

      // WebRTC signaling for calls
      socketInstance.on('joinSignalingRoom', async (data) => {
        // Existing WebRTC signaling logic...
      });

      socketInstance.on('webrtc_signal', async (data) => {
        // Existing WebRTC signaling logic...
      });

      // ===== CHAT/MESSAGE EVENTS (EXISTING) =====
      socketInstance.on('joinConversation', async (data) => {
        // Existing conversation logic...
      });

      socketInstance.on('sendMessage', async (data) => {
        // Existing message logic...
      });

      setSocket(socketInstance);

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

  // ===== LIVE STREAMING HELPER FUNCTIONS =====

  // Stream creation and management
  const emitStreamCreate = useCallback((streamData) => {
    if (socket && isConnected) {
      console.log('📡 Emitting stream create:', streamData);
      socket.emit('stream_create', streamData);
      return true;
    }
    console.warn('⚠️ Cannot emit stream create: Socket not connected');
    return false;
  }, [socket, isConnected]);

  const emitStreamStartBroadcast = useCallback((streamId) => {
    if (socket && isConnected) {
      console.log('📡 Emitting stream start broadcast:', streamId);
      socket.emit('stream_start_broadcast', { streamId });
      return true;
    }
    console.warn('⚠️ Cannot emit stream start broadcast: Socket not connected');
    return false;
  }, [socket, isConnected]);

  const emitStreamJoinAsViewer = useCallback((streamId) => {
    if (socket && isConnected) {
      console.log('📡 Emitting stream join as viewer:', streamId);
      socket.emit('stream_join_as_viewer', { streamId });
      return true;
    }
    console.warn('⚠️ Cannot emit stream join as viewer: Socket not connected');
    return false;
  }, [socket, isConnected]);

  // WebRTC signaling for streams
  const emitStreamWebRTCOffer = useCallback((data) => {
    if (socket && isConnected) {
      console.log('📡 Emitting stream WebRTC offer:', data);
      socket.emit('stream_webrtc_offer', data);
      return true;
    }
    console.warn('⚠️ Cannot emit stream WebRTC offer: Socket not connected');
    return false;
  }, [socket, isConnected]);

  const emitStreamWebRTCAnswer = useCallback((data) => {
    if (socket && isConnected) {
      console.log('📡 Emitting stream WebRTC answer:', data);
      socket.emit('stream_webrtc_answer', data);
      return true;
    }
    console.warn('⚠️ Cannot emit stream WebRTC answer: Socket not connected');
    return false;
  }, [socket, isConnected]);

  const emitStreamICECandidate = useCallback((data) => {
    if (socket && isConnected) {
      console.log('📡 Emitting stream ICE candidate:', data);
      socket.emit('stream_webrtc_ice_candidate', data);
      return true;
    }
    console.warn('⚠️ Cannot emit stream ICE candidate: Socket not connected');
    return false;
  }, [socket, isConnected]);

  const emitStreamConnectionStatus = useCallback((data) => {
    if (socket && isConnected) {
      console.log('📡 Emitting stream connection status:', data);
      socket.emit('stream_connection_status', data);
      return true;
    }
    return false;
  }, [socket, isConnected]);

  // Stream interaction
  const emitStreamChatMessage = useCallback((streamId, message) => {
    if (socket && isConnected) {
      console.log('📡 Emitting stream chat message:', { streamId, message });
      socket.emit('stream_chat_message', { streamId, message, messageType: 'text' });
      return true;
    }
    return false;
  }, [socket, isConnected]);

  const emitStreamReaction = useCallback((streamId, reaction) => {
    if (socket && isConnected) {
      console.log('📡 Emitting stream reaction:', { streamId, reaction });
      socket.emit('stream_reaction', { streamId, reaction, intensity: 1 });
      return true;
    }
    return false;
  }, [socket, isConnected]);

  // Stream termination
  const emitStreamEnd = useCallback((streamId) => {
    if (socket && isConnected) {
      console.log('📡 Emitting stream end:', streamId);
      socket.emit('stream_end', { streamId });
      return true;
    }
    return false;
  }, [socket, isConnected]);

  const emitStreamLeave = useCallback((streamId) => {
    if (socket && isConnected) {
      console.log('📡 Emitting stream leave:', streamId);
      socket.emit('stream_leave', { streamId });
      return true;
    }
    return false;
  }, [socket, isConnected]);

  // ===== EXISTING HELPER FUNCTIONS (CALLS, CHAT, ETC.) =====
  
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

  const isUserOnline = useCallback((userId) => {
    if (!isConnected || !userId) return false;
    return onlineUserIds.has(userId);
  }, [isConnected, onlineUserIds]);

  const value = {
    socket,
    isConnected,
    onlineUsers,
    onlineUserIds,
    connectionAttempts,
    maxReconnectAttempts,
    
    // Online status functions
    isUserOnline,
    
    // Stream handlers registration
    registerStreamHandlers,
    
    // Live streaming actions
    emitStreamCreate,
    emitStreamStartBroadcast,
    emitStreamJoinAsViewer,
    emitStreamEnd,
    emitStreamLeave,
    
    // Stream WebRTC actions
    emitStreamWebRTCOffer,
    emitStreamWebRTCAnswer,
    emitStreamICECandidate,
    emitStreamConnectionStatus,
    
    // Stream interactions
    emitStreamChatMessage,
    emitStreamReaction,
    
    // Connection management
    initializeSocket,
    disconnectSocket,
    forceReconnect,
    
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