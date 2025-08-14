// src/components/Dating/PrivateTakeOnDate.tsx

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  ScrollView,
  Image,
  RefreshControl,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import BASE_URL from '../../config/config';
import LinearGradient from 'react-native-linear-gradient';

const TakeOnDate = () => {
  const navigation = useNavigation();
  const route = useRoute(); 
  const { userId, username, profilePic, fullName } = route.params || {};
  const authContext = useAuth();
  const { user, token } = authContext || {};
  const scrollViewRef = useRef(null);

  // State management
  const [messages, setMessages] = useState([]);
  const [messageTypes, setMessageTypes] = useState({});
  const [loading, setLoading] = useState(true);
  const [sendingMessage, setSendingMessage] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showTakeOnDateButton, setShowTakeOnDateButton] = useState(false);
  const [showMessageButtons, setShowMessageButtons] = useState(true);
  const [otherUserData, setOtherUserData] = useState(null); // Store complete user data
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    hasNextPage: false,
  });

  useEffect(() => {
    if (token && userId) {
      fetchMessageTypes();
      fetchConversation();
    }
  }, [token, userId]);

  // Check message limits and button visibility - UPDATED LOGIC
  useEffect(() => {
    if (messages.length === 0) {
      setShowTakeOnDateButton(false);
      setShowMessageButtons(true);
      return;
    }

    // Check if current user has already sent a message
    const currentUserMessages = messages.filter(message => 
      message.sender._id === user?._id
    );
    const otherUserMessages = messages.filter(message => 
      message.sender._id !== user?._id
    );

    // Hide message buttons if current user has already sent a message
    if (currentUserMessages.length >= 1) {
      setShowMessageButtons(false);
    } else {
      setShowMessageButtons(true);
    }

    // Get the first message to determine who initiated the conversation
    const firstMessage = messages[0];
    const currentUserInitiated = firstMessage.sender._id === user?._id;
    
    // Show "Take on Date" button only if:
    // 1. Current user initiated the conversation
    // 2. Both users have sent exactly one message each (total 2 messages)
    const shouldShowTakeOnDateButton = currentUserInitiated && 
                                     currentUserMessages.length === 1 && 
                                     otherUserMessages.length === 1 &&
                                     messages.length === 2;
    
    setShowTakeOnDateButton(shouldShowTakeOnDateButton);
  }, [messages, user?._id]);

  // Navigate to Take on Date page
  const navigateToTakeOnDate = () => {
    navigation.navigate('TakeOnDate', {
      userId,
      username,
      profilePic,
      fullName: otherUserData?.fullName || fullName,
    });
  };

  // Fetch available message types from API
  const fetchMessageTypes = async () => {
    try {
      const response = await fetch(`${BASE_URL}/api/v1/private-messages/message-types`);
      const data = await response.json();
      
      if (response.ok && data?.success) {
        setMessageTypes(data.data.messageTypes || {});
      } else {
        console.error('Failed to fetch message types:', data.message);
        // Fallback to default message types
        setMessageTypes({
          HI: "Hi 👋",
          HELLO: "Hello! 😊"
        });
      }
    } catch (error) {
      console.error('Error fetching message types:', error);
      // Fallback to default message types
      setMessageTypes({
        HI: "Hi 👋",
        HELLO: "Hello! 😊"
      });
    }
  };

  // Fetch conversation with the selected user
  const fetchConversation = async (page = 1, isRefresh = false) => {
    if (!token || !userId) return;
    
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else if (page === 1) {
        setLoading(true);
      }

      const response = await fetch(
        `${BASE_URL}/api/v1/private-messages/conversation/${userId}?page=${page}&limit=20`,
        {
          headers: { 'Authorization': `Bearer ${token}` },
        }
      );
      
      const data = await response.json();
      console.log('Conversation API Response:', JSON.stringify(data, null, 2));
      
      if (response.ok && data?.success) {
        const newMessages = data.data.messages || [];
        
        // Store other user data from API response
        if (data.data.otherUser) {
          setOtherUserData(data.data.otherUser);
          console.log('Other user data:', JSON.stringify(data.data.otherUser, null, 2));
        }
        
        if (page === 1 || isRefresh) {
          setMessages(newMessages.reverse()); // Reverse to show oldest first
        } else {
          setMessages(prev => [...newMessages.reverse(), ...prev]);
        }
        
        setPagination(data.data.pagination || {});
        
        // Auto-scroll to bottom for new messages
        if (page === 1 || isRefresh) {
          setTimeout(() => {
            scrollViewRef.current?.scrollToEnd({ animated: true });
          }, 100);
        }
      } else {
        console.error('Failed to fetch conversation:', data.message);
      }
    } catch (error) {
      console.error('Error fetching conversation:', error);
      Alert.alert('Error', 'Failed to load conversation. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Send a predefined message - UPDATED WITH VALIDATION
  const sendMessage = async (messageType) => {
    if (!token || !userId || sendingMessage) return;
    
    // Check if user has already sent a message
    const currentUserMessages = messages.filter(message => 
      message.sender._id === user?._id
    );
    
    if (currentUserMessages.length >= 1) {
      Alert.alert('Message Limit', 'You can only send one message per conversation.');
      return;
    }
    
    setSendingMessage(messageType);
    
    try {
      const response = await fetch(`${BASE_URL}/api/v1/private-messages/send`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          receiverId: userId,
          messageType: messageType,
        }),
      });
      
      const data = await response.json();
      
      if (response.ok && data?.success) {
        // Add the new message to the conversation
        const newMessage = data.data;
        setMessages(prev => [...prev, newMessage]);
        
        // Auto-scroll to bottom
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);
        
        // Show success feedback
        Alert.alert('Success', 'Message sent successfully!');
      } else {
        Alert.alert('Error', data.message || 'Failed to send message');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message. Please try again.');
    } finally {
      setSendingMessage(null);
    }
  };

  // Mark messages as read when viewing
  const markMessagesAsRead = async () => {
    if (!token || !userId) return;
    
    const unreadMessages = messages.filter(msg => 
      !msg.isRead && msg.receiver._id === user?._id
    );
    
    if (unreadMessages.length === 0) return;
    
    try {
      const messageIds = unreadMessages.map(msg => msg._id);
      
      await fetch(`${BASE_URL}/api/v1/private-messages/read-multiple`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messageIds }),
      });
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  useEffect(() => {
    if (messages.length > 0) {
      markMessagesAsRead();
    }
  }, [messages]);

  // Refresh conversation
  const onRefresh = () => {
    fetchConversation(1, true);
  };

  // Load more messages (pagination)
  const loadMoreMessages = () => {
    if (pagination.hasNextPage && !loading) {
      fetchConversation(pagination.currentPage + 1);
    }
  };

  // Get user initials for avatar - IMPROVED
  const getInitials = (userData) => {
    let name = '';
    
    if (typeof userData === 'string') {
      name = userData; // If it's just a string (username)
    } else if (userData && typeof userData === 'object') {
      name = userData.fullName || userData.username || '';
    } else {
      name = username || fullName || '';
    }
    
    if (!name) return '?';
    const names = name.split(' ').filter(Boolean);
    if (names.length === 1) return names[0].charAt(0).toUpperCase();
    return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase();
  };

  // Get avatar color
  const getAvatarColor = (userData) => {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7'];
    
    let name = '';
    if (typeof userData === 'string') {
      name = userData;
    } else if (userData && typeof userData === 'object') {
      name = userData.username || userData.fullName || '';
    } else {
      name = username || '';
    }
    
    if (!name) return colors[0];
    const charCodeSum = name.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
    return colors[charCodeSum % colors.length];
  };

  // Get display name for header
  const getDisplayName = () => {
    if (otherUserData) {
      return otherUserData.fullName || `@${otherUserData.username}` || `@${username}`;
    }
    return fullName || `@${username}` || 'Unknown User';
  };

  // Get profile image URL
  const getProfileImageUrl = () => {
    if (otherUserData) {
      return otherUserData.photoUrl || otherUserData.avatar;
    }
    return profilePic;
  };

  // Get message limit status text - NEW FUNCTION
  const getMessageLimitStatus = () => {
    const currentUserMessages = messages.filter(message => 
      message.sender._id === user?._id
    );
    const otherUserMessages = messages.filter(message => 
      message.sender._id !== user?._id
    );

    if (currentUserMessages.length === 0) {
      return "You can send 1 message";
    } else if (currentUserMessages.length === 1 && otherUserMessages.length === 0) {
      return "Waiting for their reply...";
    } else if (currentUserMessages.length === 1 && otherUserMessages.length === 1) {
      return "Message limit reached (1 message each)";
    }
    return "";
  };

  // Render individual message - ENHANCED
  const renderMessage = (message, index) => {
    const isMyMessage = message.sender._id === user?._id;
    const messageUser = isMyMessage ? message.receiver : message.sender;
    
    return (
      <View key={message._id} style={[
        styles.messageContainer,
        isMyMessage ? styles.myMessage : styles.theirMessage
      ]}>
        {/* Show sender info for their messages */}
        {!isMyMessage && (
          <View style={styles.messageHeader}>
            <View style={[
              styles.smallAvatar,
              { backgroundColor: getAvatarColor(messageUser) }
            ]}>
              {(messageUser.photoUrl || messageUser.avatar) ? (
                <Image 
                  source={{ uri: messageUser.photoUrl || messageUser.avatar }} 
                  style={styles.smallAvatarImage}
                  onError={() => console.log('Small avatar image failed to load')}
                />
              ) : (
                <Text style={styles.smallAvatarText}>
                  {getInitials(messageUser)}
                </Text>
              )}
            </View>
            <Text style={styles.senderName}>
              {messageUser.fullName || messageUser.username || 'Unknown'}
            </Text>
          </View>
        )}
        
        <View style={[
          styles.messageBubble,
          isMyMessage ? styles.myMessageBubble : styles.theirMessageBubble
        ]}>
          <Text style={[
            styles.messageText,
            isMyMessage ? styles.myMessageText : styles.theirMessageText
          ]}>
            {message.messageContent}
          </Text>
          <Text style={[
            styles.messageTime,
            isMyMessage ? styles.myMessageTime : styles.theirMessageTime
          ]}>
            {new Date(message.createdAt).toLocaleTimeString([], { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
            {isMyMessage && (
              <Text style={styles.readStatus}>
                {message.isRead ? ' ✓✓' : ' ✓'}
              </Text>
            )}
          </Text>
        </View>
      </View>
    );
  };

  if (loading && messages.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{getDisplayName()}</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#ed167e" />
          <Text style={styles.loadingText}>Loading conversation...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header - ENHANCED */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerUser}>
          <View style={[
            styles.headerAvatar,
            { backgroundColor: getAvatarColor(otherUserData || username) }
          ]}>
            {getProfileImageUrl() ? (
              <Image 
                source={{ uri: getProfileImageUrl() }} 
                style={styles.headerAvatarImage}
                onError={() => console.log('Header avatar image failed to load')}
                onLoad={() => console.log('Header avatar image loaded successfully')}
              />
            ) : (
              <Text style={styles.headerAvatarText}>
                {getInitials(otherUserData || username)}
              </Text>
            )}
          </View>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>{getDisplayName()}</Text>
            {otherUserData && otherUserData.fullName && otherUserData.username && (
              <Text style={styles.headerSubtitle}>@{otherUserData.username}</Text>
            )}
          </View>
        </View>
      </View>

      {/* Messages List */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#ed167e"
          />
        }
        onScrollBeginDrag={loadMoreMessages}
      >
        {messages.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No messages yet.</Text>
            <Text style={styles.emptySubtext}>Start the conversation by sending a message!</Text>
            <Text style={styles.emptySubtext}>Note: Each person can only send 1 message.</Text>
          </View>
        ) : (
          messages.map((message, index) => renderMessage(message, index))
        )}
      </ScrollView>

      {/* Take on Date Button - Shows only when both users have sent 1 message each */}
      {showTakeOnDateButton && (
        <View style={styles.takeOnDateContainer}>
          <TouchableOpacity
            style={styles.takeOnDateButton}
            onPress={navigateToTakeOnDate}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#FF1493', '#FF69B4', '#8A2BE2']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.takeOnDateGradient}
            >
              <Text style={styles.takeOnDateText}>💕 Take on a Date</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}

      {/* Message Input Area - Hide if user has already sent a message */}
      {showMessageButtons && (
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Send a message:</Text>
          <Text style={styles.messageLimitText}>{getMessageLimitStatus()}</Text>
          <View style={styles.messageButtons}>
            {Object.entries(messageTypes).map(([type, content]) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.messageButton,
                  sendingMessage === type && styles.messageButtonSending
                ]}
                onPress={() => sendMessage(type)}
                disabled={sendingMessage !== null}
              >
                <LinearGradient
                  colors={sendingMessage === type ? ['#999', '#666'] : ['#FF69B4', '#4169E1']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.messageButtonGradient}
                >
                  {sendingMessage === type ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.messageButtonText}>{content}</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Message Limit Reached Notice - NEW */}
      {!showMessageButtons && !showTakeOnDateButton && messages.length > 0 && (
        <View style={styles.limitReachedContainer}>
          <Text style={styles.limitReachedText}>
            {getMessageLimitStatus()}
          </Text>
          {messages.length === 2 && (
            <Text style={styles.limitReachedSubtext}>
              Both messages sent! Wait for the conversation initiator to take you on a date.
            </Text>
          )}
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  
  // Header Styles - ENHANCED
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#2e2e2e',
  },
  backButton: {
    marginRight: 15,
    padding: 5,
  },
  backButtonText: {
    color: '#ed167e',
    fontSize: 24,
    fontWeight: 'bold',
  },
  headerUser: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  headerAvatarImage: {
    width: '100%',
    height: '100%',
  },
  headerAvatarText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // NEW: Container for header text
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  // NEW: Subtitle for username
  headerSubtitle: {
    color: '#999',
    fontSize: 14,
    marginTop: 2,
  },

  // Loading Styles
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#999',
    fontSize: 16,
    marginTop: 10,
  },

  // Messages Styles
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 20,
    paddingBottom: 10,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 50,
  },
  emptyText: {
    color: '#999',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptySubtext: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 5,
  },

  // Message Styles - ENHANCED
  messageContainer: {
    marginBottom: 15,
  },
  myMessage: {
    alignItems: 'flex-end',
  },
  theirMessage: {
    alignItems: 'flex-start',
  },
  messageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  smallAvatar: {
    width: 25,
    height: 25,
    borderRadius: 12.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    overflow: 'hidden',
  },
  smallAvatarImage: {
    width: '100%',
    height: '100%',
  },
  smallAvatarText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  senderName: {
    color: '#999',
    fontSize: 12,
    fontWeight: '500',
  },
  messageBubble: {
    maxWidth: '80%',
    borderRadius: 18,
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  myMessageBubble: {
    backgroundColor: '#ed167e',
  },
  theirMessageBubble: {
    backgroundColor: '#2e2e2e',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  myMessageText: {
    color: '#fff',
  },
  theirMessageText: {
    color: '#fff',
  },
  messageTime: {
    fontSize: 11,
    marginTop: 5,
  },
  myMessageTime: {
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'right',
  },
  theirMessageTime: {
    color: '#999',
  },
  readStatus: {
    color: 'rgba(255, 255, 255, 0.7)',
  },

  // Take on Date Button Styles
  takeOnDateContainer: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#2e2e2e',
  },
  takeOnDateButton: {
    borderRadius: 25,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#FF1493',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  takeOnDateGradient: {
    paddingVertical: 15,
    paddingHorizontal: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  takeOnDateText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },

  // Input Styles
  inputContainer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#2e2e2e',
    backgroundColor: '#0a0a0a',
  },
  inputLabel: {
    color: '#999',
    fontSize: 14,
    marginBottom: 5,
    fontWeight: '500',
  },
  // NEW: Message limit status text
  messageLimitText: {
    color: '#FF69B4',
    fontSize: 12,
    marginBottom: 10,
    fontStyle: 'italic',
  },
  messageButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  messageButton: {
    flex: 1,
    borderRadius: 20,
    overflow: 'hidden',
  },
  messageButtonSending: {
    opacity: 0.7,
  },
  messageButtonGradient: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  messageButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },

  // NEW: Limit Reached Notice Styles
  limitReachedContainer: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderTopWidth: 1,
    borderTopColor: '#2e2e2e',
    backgroundColor: '#0a0a0a',
    alignItems: 'center',
  },
  limitReachedText: {
    color: '#999',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  limitReachedSubtext: {
    color: '#666',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 5,
    fontStyle: 'italic',
  },
});

export default TakeOnDate;