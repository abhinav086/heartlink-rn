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
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import BASE_URL from '../../config/config';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import DateTimePicker from '@react-native-community/datetimepicker';

// Enhanced Vector Icons component with more icon options
const VectorIcon = ({ name, size = 20, color = '#ed167e', style = {} }) => (
  <Icon name={name} size={size} color={color} style={style} />
);

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
  const [otherUserData, setOtherUserData] = useState(null);

  // Date request states
  const [dateRequests, setDateRequests] = useState([]);
  const [currentDateRequest, setCurrentDateRequest] = useState(null);
  const [showDateRequestModal, setShowDateRequestModal] = useState(false);
  const [showResponseModal, setShowResponseModal] = useState(false);
  const [showCounterProposalForm, setShowCounterProposalForm] = useState(false);
  const [creatingDateRequest, setCreatingDateRequest] = useState(false);
  const [respondingToRequest, setRespondingToRequest] = useState(false);

  // Enhanced Date/Time picker states
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showCounterDatePicker, setShowCounterDatePicker] = useState(false);
  const [showCounterTimePicker, setShowCounterTimePicker] = useState(false);

  // Form states for counter-proposal with improved structure
  const [counterProposal, setCounterProposal] = useState({
    preferredLocation: {
      city: '',
      area: '',
      specificPlace: ''
    },
    preferredDate: new Date(),
    preferredTime: new Date(),
    suggestedBudget: '',
    recipientMessage: ''
  });

  // Enhanced initial date request form with date/time pickers
  const [initialDateRequest, setInitialDateRequest] = useState({
    message: 'Would you like to go on a date?',
    dateType: 'dinner',
    location: {
      city: '',
      area: '',
      specificPlace: ''
    },
    preferredDate: new Date(),
    preferredTime: new Date(),
    budget: '2000'
  });

  // Response form
  const [responseForm, setResponseForm] = useState({
    action: '',
    message: ''
  });

  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    hasNextPage: false,
  });

  useEffect(() => {
    if (token && userId) {
      fetchMessageTypes();
      fetchConversation();
      fetchDateRequests();
    }
  }, [token, userId]);

  // Check message limits and button visibility
  useEffect(() => {
    if (messages.length === 0) {
      setShowTakeOnDateButton(false);
      setShowMessageButtons(true);
      return;
    }
    const currentUserMessages = messages.filter(message =>
      message.sender._id === user?._id
    );
    const otherUserMessages = messages.filter(message =>
      message.sender._id !== user?._id
    );
    if (currentUserMessages.length >= 1) {
      setShowMessageButtons(false);
    } else {
      setShowMessageButtons(true);
    }
    const firstMessage = messages[0];
    const currentUserInitiated = firstMessage.sender._id === user?._id;
    const hasActiveDateRequest = dateRequests.some(req =>
      ['pending_initial', 'counter_proposed', 'accepted'].includes(req.status)
    );
    const shouldShowTakeOnDateButton = currentUserInitiated &&
      currentUserMessages.length === 1 &&
      otherUserMessages.length === 1 &&
      messages.length === 2 &&
      !hasActiveDateRequest;
    setShowTakeOnDateButton(shouldShowTakeOnDateButton);
  }, [messages, user?._id, dateRequests]);

  // --- MODIFIED: Enhanced fetchDateRequests with robust checks ---
  // Fetch date requests between these users
  const fetchDateRequests = async () => {
    // Ensure token, userId, and user._id are available before proceeding
    if (!token || !userId || !user?._id) {
      console.log("Missing required data for fetchDateRequests:", { token: !!token, userId, user_id: !!user?._id });
      return;
    }
    try {
      const response = await fetch(
        `${BASE_URL}/api/v1/dating?type=all&status=all&limit=10`,
        {
          headers: { 'Authorization': `Bearer ${token}` },
        }
      );
      const data = await response.json();
      if (response.ok && data?.success) {

        // --- MODIFIED: Add robust checks for requester and recipient ---
        const relevantRequests = data.data.requests.filter(req => {
          // Check if requester and recipient objects exist
          if (!req.requester || !req.recipient) {
            console.warn("Skipping date request due to missing requester or recipient:", req);
            return false; // Skip this request if data is malformed
          }
          // Now it's safe to access _id
          const isUserRequester = req.requester._id === user._id;
          const isUserRecipient = req.recipient._id === user._id;
          const isOtherUserRequester = req.requester._id === userId;
          const isOtherUserRecipient = req.recipient._id === userId;

          // Check if this request is between the current user and the other user
          return (isUserRequester && isOtherUserRecipient) || (isOtherUserRequester && isUserRecipient);
        });
        // --- END OF MODIFICATION ---

        setDateRequests(relevantRequests);

        // Apply the same robust check for finding the active request
        const activeRequest = relevantRequests.find(req => {
          // Double-check structure even within relevant requests
          if (!req.requester || !req.recipient) {
            console.warn("Skipping relevant request for active check due to missing data:", req);
            return false;
          }
          return ['pending_initial', 'counter_proposed', 'accepted', 'paid'].includes(req.status);
        });

        setCurrentDateRequest(activeRequest || null);
      } else {
        console.error('API Error fetching date requests:', data.message || 'Unknown error');
      }
    } catch (error) {
      // More descriptive error logging
      console.error('Network or unexpected error fetching date requests:', error);
      // Consider adding user-facing error handling here if needed
    }
  };
  // --- END OF MODIFIED fetchDateRequests ---

  // Enhanced date/time formatting utilities
  const formatDateForAPI = (date) => {
    return date.toISOString().split('T')[0]; // YYYY-MM-DD format
  };
  const formatTimeForAPI = (date) => {
    return date.toTimeString().split(' ')[0].substring(0, 5); // HH:MM format
  };
  const formatDisplayDate = (date) => {
    return date.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };
  const formatDisplayTime = (date) => {
    return date.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  // Enhanced create initial date request with date/time pickers
  const createInitialDateRequest = async () => {
    if (!token || !userId || creatingDateRequest) return;
    // Validation for required fields
    if (!initialDateRequest.location.city || !initialDateRequest.budget) {
      Alert.alert('Missing Fields', 'Please fill in City and Budget fields');
      return;
    }
    // Validate budget
    const budget = parseInt(initialDateRequest.budget);
    if (isNaN(budget) || budget < 500 || budget > 200000) {
      Alert.alert('Invalid Budget', 'Budget must be between ₹500 and ₹200,000');
      return;
    }
    // Validate date is in future
    if (initialDateRequest.preferredDate <= new Date()) {
      Alert.alert('Invalid Date', 'Please select a future date');
      return;
    }
    setCreatingDateRequest(true);
    try {
      const response = await fetch(`${BASE_URL}/api/v1/dating/initial-request`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipientId: userId,
          message: initialDateRequest.message,
          dateType: initialDateRequest.dateType,
          location: initialDateRequest.location,
          preferredDate: formatDateForAPI(initialDateRequest.preferredDate),
          preferredTime: formatTimeForAPI(initialDateRequest.preferredTime),
          budget: budget,
          conversationId: route.params?.conversationId || null
        }),
      });
      const data = await response.json();
      if (response.ok && data?.success) {
        Alert.alert('Success', 'Date request sent successfully!');
        setShowDateRequestModal(false);
        setCurrentDateRequest(data.data);
        await fetchDateRequests();
      } else {
        Alert.alert('Error', data.message || 'Failed to send date request');
      }
    } catch (error) {
      console.error('Error creating date request:', error);
      Alert.alert('Error', 'Failed to send date request. Please try again.');
    } finally {
      setCreatingDateRequest(false);
    }
  };

  // Enhanced respond to initial date request
  const respondToInitialRequest = async () => {
    if (!token || !currentDateRequest || respondingToRequest) return;
    setRespondingToRequest(true);
    try {
      let requestBody = {
        action: responseForm.action,
        message: responseForm.message
      };
      if (responseForm.action === 'counter_propose') {
        if (!counterProposal.preferredLocation.city || !counterProposal.suggestedBudget) {
          Alert.alert('Error', 'Please fill in City and Budget fields');
          setRespondingToRequest(false);
          return;
        }
        const budget = parseInt(counterProposal.suggestedBudget);
        if (isNaN(budget) || budget < 500 || budget > 200000) {
          Alert.alert('Invalid Budget', 'Budget must be between ₹500 and ₹200,000');
          setRespondingToRequest(false);
          return;
        }
        requestBody = {
          ...requestBody,
          preferredLocation: counterProposal.preferredLocation,
          preferredDate: formatDateForAPI(counterProposal.preferredDate),
          preferredTime: formatTimeForAPI(counterProposal.preferredTime),
          suggestedBudget: budget,
          recipientMessage: counterProposal.recipientMessage
        };
      }
      const response = await fetch(
        `${BASE_URL}/api/v1/dating/${currentDateRequest._id}/respond-initial`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        }
      );
      const data = await response.json();
      if (response.ok && data?.success) {
        Alert.alert('Success',
          responseForm.action === 'accept' ? 'Date request accepted!' :
            responseForm.action === 'reject' ? 'Date request declined' :
              'Your preferences have been shared!'
        );
        setShowResponseModal(false);
        setShowCounterProposalForm(false);
        setCurrentDateRequest(data.data);
        await fetchDateRequests();
      } else {
        Alert.alert('Error', data.message || 'Failed to respond to date request');
      }
    } catch (error) {
      console.error('Error responding to date request:', error);
      Alert.alert('Error', 'Failed to respond. Please try again.');
    } finally {
      setRespondingToRequest(false);
    }
  };

  // Respond to counter-proposal
  const respondToCounterProposal = async (action) => {
    if (!token || !currentDateRequest || respondingToRequest) return;
    setRespondingToRequest(true);
    try {
      const response = await fetch(
        `${BASE_URL}/api/v1/dating/${currentDateRequest._id}/respond-counter-proposal`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: action,
            message: responseForm.message || ''
          }),
        }
      );
      const data = await response.json();
      if (response.ok && data?.success) {
        Alert.alert('Success',
          action === 'accept' ? 'Counter-proposal accepted! Ready for payment.' :
            'Counter-proposal declined'
        );
        setCurrentDateRequest(data.data);
        await fetchDateRequests();
      } else {
        Alert.alert('Error', data.message || 'Failed to respond to counter-proposal');
      }
    } catch (error) {
      console.error('Error responding to counter-proposal:', error);
      Alert.alert('Error', 'Failed to respond. Please try again.');
    } finally {
      setRespondingToRequest(false);
    }
  };

  // Check if can create date request
  const checkCanCreateDateRequest = async () => {
    if (!token || !userId) return false;
    try {
      const response = await fetch(
        `${BASE_URL}/api/v1/dating/can-request/${userId}`,
        {
          headers: { 'Authorization': `Bearer ${token}` },
        }
      );
      const data = await response.json();
      if (response.ok && data?.success) {
        if (!data.data.canRequest) {
          Alert.alert('Cannot Create Request', data.data.reason);
          return false;
        }
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error checking can create request:', error);
      return false;
    }
  };

  // Navigate to payment screen
  const navigateToPayment = () => {
    if (!currentDateRequest) return;
    navigation.navigate('PaymentScreen', {
      requestId: currentDateRequest._id,
    });
  };

  // Cancel date request
  const cancelDateRequest = async () => {
    if (!token || !currentDateRequest) return;
    Alert.alert(
      'Cancel Date Request',
      'Are you sure you want to cancel this date request?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await fetch(
                `${BASE_URL}/api/v1/dating/${currentDateRequest._id}/cancel`,
                {
                  method: 'PATCH',
                  headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    reason: 'Cancelled by user'
                  }),
                }
              );
              const data = await response.json();
              if (response.ok && data?.success) {
                Alert.alert('Success', 'Date request cancelled successfully');
                await fetchDateRequests();
              } else {
                Alert.alert('Error', data.message || 'Failed to cancel date request');
              }
            } catch (error) {
              console.error('Error cancelling date request:', error);
              Alert.alert('Error', 'Failed to cancel date request');
            }
          }
        }
      ]
    );
  };

  // Fetch available message types from API
  const fetchMessageTypes = async () => {
    try {
      const response = await fetch(`${BASE_URL}/api/v1/private-messages/message-types`);
      const data = await response.json();
      if (response.ok && data?.success) {
        const cleanMessageTypes = {};
        Object.entries(data.data.messageTypes || {}).forEach(([key, value]) => {
          cleanMessageTypes[key] = value.replace(/[^\w\s!]/g, '').trim();
        });
        setMessageTypes(cleanMessageTypes.HI ? cleanMessageTypes : {
          HI: "Hi",
          HELLO: "Hello!"
        });
      } else {
        console.error('Failed to fetch message types:', data.message);
        setMessageTypes({
          HI: "Hi",
          HELLO: "Hello!"
        });
      }
    } catch (error) {
      console.error('Error fetching message types:', error);
      setMessageTypes({
        HI: "Hi",
        HELLO: "Hello!"
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
      if (response.ok && data?.success) {
        const newMessages = data.data.messages || [];
        if (data.data.otherUser) {
          setOtherUserData(data.data.otherUser);
        }
        if (page === 1 || isRefresh) {
          setMessages(newMessages.reverse());
        } else {
          setMessages(prev => [...newMessages.reverse(), ...prev]);
        }
        setPagination(data.data.pagination || {});
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

  // Send a predefined message
  const sendMessage = async (messageType) => {
    if (!token || !userId || sendingMessage) return;
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
        const newMessage = data.data;
        setMessages(prev => [...prev, newMessage]);
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);
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
    fetchDateRequests();
  };

  // Load more messages (pagination)
  const loadMoreMessages = () => {
    if (pagination.hasNextPage && !loading) {
      fetchConversation(pagination.currentPage + 1);
    }
  };

  // Get user initials for avatar
  const getInitials = (userData) => {
    let name = '';
    if (typeof userData === 'string') {
      name = userData;
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

  // Get message limit status text
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

  // Get date type display name
  const getDateTypeDisplay = (dateType) => {
    const dateTypeMap = {
      'dinner': 'Dinner Date',
      'lunch': 'Lunch Date',
      'coffee': 'Coffee Date',
      'movie': 'Movie Date',
      'park_walk': 'Park Walk',
      'beach': 'Beach Date',
      'adventure': 'Adventure Date',
      'shopping': 'Shopping Date',
      'party': 'Party/Club',
      'cultural_event': 'Cultural Event',
      'sports': 'Sports Activity'
    };
    return dateTypeMap[dateType] || dateType;
  };

  // Get current date request status description
  const getDateRequestStatus = () => {
    if (!currentDateRequest) return null;
    const isRequester = currentDateRequest.requester._id === user?._id;
    switch (currentDateRequest.status) {
      case 'pending_initial':
        return isRequester
          ? 'Waiting for their response to your date request'
          : 'You have a pending date request - please respond';
      case 'counter_proposed':
        return isRequester
          ? 'They shared their preferences - please review and respond'
          : 'Waiting for their response to your preferences';
      case 'accepted':
        return isRequester
          ? 'Date accepted! Complete payment to confirm'
          : 'Date accepted! Waiting for payment';
      case 'paid':
        return 'Date confirmed! Payment completed';
      case 'completed':
        return 'Date completed successfully';
      case 'rejected':
        return 'Date request was declined';
      case 'cancelled':
        return 'Date request was cancelled';
      case 'expired':
        return 'Date request expired';
      default:
        return null;
    }
  };

  // Enhanced render date request status card with complete original request details
  const renderDateRequestStatus = () => {
    if (!currentDateRequest) return null;
    const isRequester = currentDateRequest.requester._id === user?._id;
    const status = currentDateRequest.status;
    return (
      <View style={styles.dateRequestCard}>
        <View style={styles.dateRequestHeader}>
          <View style={styles.dateRequestTitleContainer}>
            <VectorIcon name="favorite" size={20} color="#ed167e" />
            <Text style={styles.dateRequestTitle}>Date Request Status</Text>
          </View>
          {['pending_initial', 'counter_proposed', 'accepted'].includes(status) && (
            <TouchableOpacity
              onPress={cancelDateRequest}
              style={styles.cancelButton}
            >
              <VectorIcon name="close" size={16} color="#fff" />
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          )}
        </View>
        <Text style={styles.dateRequestStatus}>{getDateRequestStatus()}</Text>
        {/* COMPLETE Enhanced original request details display */}
        <View style={styles.originalRequest}>
          <View style={styles.originalRequestHeader}>
            <VectorIcon name="info" size={16} color="#FF69B4" />
            <Text style={styles.originalRequestTitle}>
              {isRequester ? 'Your Original Request:' : 'Their Request:'}
            </Text>
          </View>
          <View style={styles.originalRequestDetails}>
            {/* Date Type - Always show */}
            <View style={styles.originalRequestRow}>
              <VectorIcon name="restaurant" size={16} color="#ed167e" />
              <Text style={styles.originalRequestDetail}>
                Type: {getDateTypeDisplay(currentDateRequest.initialRequest?.dateType || 'dinner')}
              </Text>
            </View>
            {/* Message - Always show */}
            <View style={styles.originalRequestRow}>
              <VectorIcon name="chat-bubble" size={16} color="#ed167e" />
              <Text style={styles.originalRequestDetail}>
                Message: "{currentDateRequest.initialRequest?.message || 'Would you like to go on a date?'}"
              </Text>
            </View>
            {/* Location - Show all available location data */}
            <View style={styles.originalRequestRow}>
              <VectorIcon name="location-on" size={16} color="#ed167e" />
              <Text style={styles.originalRequestDetail}>
                Location: {(() => {
                  const location = currentDateRequest.initialRequest?.location || currentDateRequest.location;
                  if (location) {
                    let locationText = location.city || 'Not specified';
                    if (location.area) locationText += `, ${location.area}`;
                    if (location.specificPlace) locationText += ` (${location.specificPlace})`;
                    return locationText;
                  }
                  return 'Not specified';
                })()}
              </Text>
            </View>
            {/* Date - Show with proper formatting */}
            <View style={styles.originalRequestRow}>
              <VectorIcon name="event" size={16} color="#ed167e" />
              <Text style={styles.originalRequestDetail}>
                Date: {(() => {
                  const date = currentDateRequest.initialRequest?.preferredDate || currentDateRequest.preferredDate;
                  if (date) {
                    try {
                      return new Date(date).toLocaleDateString('en-IN', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      });
                    } catch (e) {
                      return date;
                    }
                  }
                  return 'Not specified';
                })()}
              </Text>
            </View>
            {/* Time - Show formatted time */}
            <View style={styles.originalRequestRow}>
              <VectorIcon name="access-time" size={16} color="#ed167e" />
              <Text style={styles.originalRequestDetail}>
                Time: {currentDateRequest.initialRequest?.preferredTime || currentDateRequest.preferredTime || 'Not specified'}
              </Text>
            </View>
            {/* Budget - Show with proper formatting */}
            <View style={styles.originalRequestRow}>
              <VectorIcon name="currency-rupee" size={16} color="#ed167e" />
              <Text style={styles.originalRequestDetail}>
                Budget: {(() => {
                  const budget = currentDateRequest.initialRequest?.budget || currentDateRequest.budget;
                  if (budget && typeof budget === 'number') {
                    return `₹${budget.toLocaleString('en-IN')}`;
                  }
                  return budget ? `₹${budget}` : 'Not specified';
                })()}
              </Text>
            </View>
          </View>
        </View>
        {/* Enhanced counter-proposal details */}
        {currentDateRequest.counterProposal?.hasCounterProposal && (
          <View style={styles.counterProposalDetails}>
            <View style={styles.counterProposalHeader}>
              <VectorIcon name="edit" size={16} color="#FF69B4" />
              <Text style={styles.counterProposalTitle}>
                {isRequester ? 'Their Preferences:' : 'Your Preferences:'}
              </Text>
            </View>
            <View style={styles.counterProposalDetailsContainer}>
              <View style={styles.counterProposalRow}>
                <VectorIcon name="location-on" size={16} color="#ed167e" />
                <Text style={styles.counterProposalText}>
                  {currentDateRequest.counterProposal.preferredLocation.city}
                  {currentDateRequest.counterProposal.preferredLocation.area && `, ${currentDateRequest.counterProposal.preferredLocation.area}`}
                  {currentDateRequest.counterProposal.preferredLocation.specificPlace && ` (${currentDateRequest.counterProposal.preferredLocation.specificPlace})`}
                </Text>
              </View>
              <View style={styles.counterProposalRow}>
                <VectorIcon name="event" size={16} color="#ed167e" />
                <Text style={styles.counterProposalText}>
                  {new Date(currentDateRequest.counterProposal.preferredDate).toLocaleDateString('en-IN', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </Text>
              </View>
              <View style={styles.counterProposalRow}>
                <VectorIcon name="access-time" size={16} color="#ed167e" />
                <Text style={styles.counterProposalText}>
                  {currentDateRequest.counterProposal.preferredTime}
                </Text>
              </View>
              <View style={styles.counterProposalRow}>
                <VectorIcon name="currency-rupee" size={16} color="#ed167e" />
                <Text style={styles.counterProposalText}>
                  ₹{currentDateRequest.counterProposal.suggestedBudget?.toLocaleString('en-IN')}
                </Text>
              </View>
              {currentDateRequest.counterProposal.recipientMessage && (
                <View style={styles.counterProposalRow}>
                  <VectorIcon name="chat-bubble" size={16} color="#ed167e" />
                  <Text style={styles.counterProposalMessage}>
                    "{currentDateRequest.counterProposal.recipientMessage}"
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}
        {/* Show final details if accepted or paid */}
        {currentDateRequest.finalDetails && (status === 'accepted' || status === 'paid') && (
          <View style={styles.finalDetails}>
            <View style={styles.finalDetailsHeader}>
              <VectorIcon name="check-circle" size={16} color="#4CAF50" />
              <Text style={styles.finalDetailsTitle}>Final Date Details:</Text>
            </View>
            <View style={styles.finalDetailsContainer}>
              <View style={styles.finalDetailsRow}>
                <VectorIcon name="location-on" size={16} color="#4CAF50" />
                <Text style={styles.finalDetailsText}>
                  {currentDateRequest.finalDetails.location?.city}
                  {currentDateRequest.finalDetails.location?.area && `, ${currentDateRequest.finalDetails.location.area}`}
                  {currentDateRequest.finalDetails.location?.specificPlace && ` (${currentDateRequest.finalDetails.location.specificPlace})`}
                </Text>
              </View>
              <View style={styles.finalDetailsRow}>
                <VectorIcon name="event" size={16} color="#4CAF50" />
                <Text style={styles.finalDetailsText}>
                  {new Date(currentDateRequest.finalDetails.dateTime).toLocaleDateString('en-IN', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </Text>
              </View>
              <View style={styles.finalDetailsRow}>
                <VectorIcon name="access-time" size={16} color="#4CAF50" />
                <Text style={styles.finalDetailsText}>
                  {new Date(currentDateRequest.finalDetails.dateTime).toLocaleTimeString('en-IN', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true
                  })}
                </Text>
              </View>
              <View style={styles.finalDetailsRow}>
                <VectorIcon name="currency-rupee" size={16} color="#4CAF50" />
                <Text style={styles.finalDetailsText}>
                  ₹{currentDateRequest.finalDetails.budget?.toLocaleString('en-IN')}
                </Text>
              </View>
            </View>
          </View>
        )}
        {/* Action buttons based on status */}
        {status === 'pending_initial' && !isRequester && (
          <TouchableOpacity
            style={styles.respondButton}
            onPress={() => setShowResponseModal(true)}
          >
            <VectorIcon name="reply" size={20} color="#fff" />
            <Text style={styles.respondButtonText}>Respond to Date Request</Text>
          </TouchableOpacity>
        )}
        {status === 'counter_proposed' && isRequester && (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.actionButton, styles.acceptButton]}
              onPress={() => respondToCounterProposal('accept')}
              disabled={respondingToRequest}
            >
              {respondingToRequest ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <VectorIcon name="check" size={16} color="#fff" />
                  <Text style={styles.actionButtonText}>Accept</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.rejectButton]}
              onPress={() => respondToCounterProposal('reject')}
              disabled={respondingToRequest}
            >
              <VectorIcon name="close" size={16} color="#fff" />
              <Text style={styles.actionButtonText}>Decline</Text>
            </TouchableOpacity>
          </View>
        )}
        {status === 'accepted' && isRequester && (
          <TouchableOpacity
            style={styles.paymentButton}
            onPress={navigateToPayment}
          >
            <VectorIcon name="payment" size={20} color="#fff" />
            <Text style={styles.paymentButtonText}>
              Complete Payment (₹{currentDateRequest.finalDetails?.budget?.toLocaleString('en-IN')})
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // Render individual message
  const renderMessage = (message, index) => {
    const isMyMessage = message.sender._id === user?._id;
    const messageUser = isMyMessage ? message.receiver : message.sender;
    return (
      <View key={message._id} style={[
        styles.messageContainer,
        isMyMessage ? styles.myMessage : styles.theirMessage
      ]}>
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
              <View style={styles.readStatusContainer}>
                <VectorIcon
                  name={message.isRead ? "done-all" : "done"}
                  size={12}
                  color="rgba(255, 255, 255, 0.7)"
                />
              </View>
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
            <VectorIcon name="arrow-back" size={24} color="#ed167e" />
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
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <VectorIcon name="arrow-back" size={24} color="#ed167e" />
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
      {/* Messages and Date Request Status */}
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
        {/* Date Request Status Card */}
        {renderDateRequestStatus()}
        {messages.length === 0 ? (
          <View style={styles.emptyContainer}>
            <VectorIcon name="chat-bubble-outline" size={48} color="#666" />
            <Text style={styles.emptyText}>No messages yet.</Text>
            <Text style={styles.emptySubtext}>Start the conversation by sending a message!</Text>
            <Text style={styles.emptySubtext}>Note: Each person can only send 1 message.</Text>
          </View>
        ) : (
          messages.map((message, index) => renderMessage(message, index))
        )}
      </ScrollView>
      {/* Take on Date Button */}
      {showTakeOnDateButton && (
        <View style={styles.takeOnDateContainer}>
          <TouchableOpacity
            style={styles.takeOnDateButton}
            onPress={async () => {
              const canCreate = await checkCanCreateDateRequest();
              if (canCreate) {
                setShowDateRequestModal(true);
              }
            }}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#FF1493', '#FF69B4', '#8A2BE2']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.takeOnDateGradient}
            >
              <VectorIcon name="favorite" size={20} color="#fff" />
              <Text style={styles.takeOnDateText}>Take on a Date</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}
      {/* Message Input Area */}
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
                    <>
                      <VectorIcon name="send" size={16} color="#fff" />
                      <Text style={styles.messageButtonText}>{content}</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
      {/* Message Limit Reached Notice */}
      {!showMessageButtons && !showTakeOnDateButton && messages.length > 0 && !currentDateRequest && (
        <View style={styles.limitReachedContainer}>
          <VectorIcon name="info" size={20} color="#999" />
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
      {/* Enhanced Initial Date Request Modal with Date/Time Pickers */}
      <Modal
        visible={showDateRequestModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowDateRequestModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleContainer}>
                <VectorIcon name="favorite" size={24} color="#ed167e" />
                <Text style={styles.modalTitle}>Send Date Request</Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowDateRequestModal(false)}
                style={styles.modalCloseButton}
              >
                <VectorIcon name="close" size={24} color="#ed167e" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              <View style={styles.formSection}>
                <View style={styles.inputLabelContainer}>
                  <VectorIcon name="chat-bubble" size={16} color="#ed167e" />
                  <Text style={styles.inputLabel}>Message:</Text>
                </View>
                <TextInput
                  style={styles.textInput}
                  value={initialDateRequest.message}
                  onChangeText={(text) => setInitialDateRequest({
                    ...initialDateRequest,
                    message: text
                  })}
                  placeholder="Would you like to go on a date?"
                  placeholderTextColor="#666"
                  multiline={true}
                  numberOfLines={3}
                />
              </View>
              <View style={styles.formSection}>
                <View style={styles.inputLabelContainer}>
                  <VectorIcon name="restaurant" size={16} color="#ed167e" />
                  <Text style={styles.inputLabel}>Date Type:</Text>
                </View>
                <View style={styles.dateTypeContainer}>
                  {['dinner', 'lunch', 'coffee', 'movie'].map(type => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.dateTypeButton,
                        initialDateRequest.dateType === type && styles.dateTypeButtonSelected
                      ]}
                      onPress={() => setInitialDateRequest({
                        ...initialDateRequest,
                        dateType: type
                      })}
                    >
                      <Text style={[
                        styles.dateTypeButtonText,
                        initialDateRequest.dateType === type && styles.dateTypeButtonTextSelected
                      ]}>
                        {getDateTypeDisplay(type)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <View style={styles.formSection}>
                <View style={styles.inputLabelContainer}>
                  <VectorIcon name="location-on" size={16} color="#ed167e" />
                  <Text style={styles.inputLabel}>Location:</Text>
                </View>
                <Text style={styles.subInputLabel}>City *</Text>
                <TextInput
                  style={styles.textInput}
                  value={initialDateRequest.location.city}
                  onChangeText={(text) => setInitialDateRequest({
                    ...initialDateRequest,
                    location: {
                      ...initialDateRequest.location,
                      city: text
                    }
                  })}
                  placeholder="Mumbai"
                  placeholderTextColor="#666"
                />
                <Text style={styles.subInputLabel}>Area (Optional)</Text>
                <TextInput
                  style={styles.textInput}
                  value={initialDateRequest.location.area}
                  onChangeText={(text) => setInitialDateRequest({
                    ...initialDateRequest,
                    location: {
                      ...initialDateRequest.location,
                      area: text
                    }
                  })}
                  placeholder="Bandra"
                  placeholderTextColor="#666"
                />
                <Text style={styles.subInputLabel}>Specific Place (Optional)</Text>
                <TextInput
                  style={styles.textInput}
                  value={initialDateRequest.location.specificPlace}
                  onChangeText={(text) => setInitialDateRequest({
                    ...initialDateRequest,
                    location: {
                      ...initialDateRequest.location,
                      specificPlace: text
                    }
                  })}
                  placeholder="Linking Road Cafe"
                  placeholderTextColor="#666"
                />
              </View>
              {/* Enhanced Date Picker Section */}
              <View style={styles.formSection}>
                <View style={styles.inputLabelContainer}>
                  <VectorIcon name="event" size={16} color="#ed167e" />
                  <Text style={styles.inputLabel}>Preferred Date *</Text>
                </View>
                <TouchableOpacity
                  style={styles.dateTimeButton}
                  onPress={() => setShowDatePicker(true)}
                >
                  <VectorIcon name="event" size={20} color="#ed167e" />
                  <Text style={styles.dateTimeButtonText}>
                    {formatDisplayDate(initialDateRequest.preferredDate)}
                  </Text>
                  <VectorIcon name="keyboard-arrow-down" size={20} color="#666" />
                </TouchableOpacity>
                {showDatePicker && (
                  <DateTimePicker
                    value={initialDateRequest.preferredDate}
                    mode="date"
                    display="default"
                    minimumDate={new Date()}
                    onChange={(event, selectedDate) => {
                      setShowDatePicker(false);
                      if (selectedDate) {
                        setInitialDateRequest({
                          ...initialDateRequest,
                          preferredDate: selectedDate
                        });
                      }
                    }}
                  />
                )}
              </View>
              {/* Enhanced Time Picker Section */}
              <View style={styles.formSection}>
                <View style={styles.inputLabelContainer}>
                  <VectorIcon name="access-time" size={16} color="#ed167e" />
                  <Text style={styles.inputLabel}>Preferred Time *</Text>
                </View>
                <TouchableOpacity
                  style={styles.dateTimeButton}
                  onPress={() => setShowTimePicker(true)}
                >
                  <VectorIcon name="access-time" size={20} color="#ed167e" />
                  <Text style={styles.dateTimeButtonText}>
                    {formatDisplayTime(initialDateRequest.preferredTime)}
                  </Text>
                  <VectorIcon name="keyboard-arrow-down" size={20} color="#666" />
                </TouchableOpacity>
                {showTimePicker && (
                  <DateTimePicker
                    value={initialDateRequest.preferredTime}
                    mode="time"
                    display="default"
                    onChange={(event, selectedTime) => {
                      setShowTimePicker(false);
                      if (selectedTime) {
                        setInitialDateRequest({
                          ...initialDateRequest,
                          preferredTime: selectedTime
                        });
                      }
                    }}
                  />
                )}
              </View>
              <View style={styles.formSection}>
                <View style={styles.inputLabelContainer}>
                  <VectorIcon name="currency-rupee" size={16} color="#ed167e" />
                  <Text style={styles.inputLabel}>Budget (₹) *</Text>
                </View>
                <TextInput
                  style={styles.textInput}
                  value={initialDateRequest.budget}
                  onChangeText={(text) => setInitialDateRequest({
                    ...initialDateRequest,
                    budget: text
                  })}
                  placeholder="2000"
                  placeholderTextColor="#666"
                  keyboardType="numeric"
                />
                <Text style={styles.helperText}>
                  Suggested range: ₹500 - ₹200,000
                </Text>
              </View>
              <View style={styles.modalFormFooter}>
                <VectorIcon name="info" size={16} color="#999" />
                <Text style={styles.requiredFieldsNote}>* Required fields</Text>
              </View>
            </ScrollView>
            <TouchableOpacity
              style={[
                styles.modalSubmitButton,
                (!initialDateRequest.location.city || !initialDateRequest.budget) &&
                styles.modalSubmitButtonDisabled
              ]}
              onPress={createInitialDateRequest}
              disabled={creatingDateRequest || !initialDateRequest.location.city || !initialDateRequest.budget}
            >
              {creatingDateRequest ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <VectorIcon name="send" size={20} color="#fff" />
                  <Text style={styles.modalSubmitButtonText}>Send Date Request</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      {/* Enhanced Response Modal with Complete Original Request Display */}
      <Modal
        visible={showResponseModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowResponseModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleContainer}>
                <VectorIcon name="reply" size={24} color="#ed167e" />
                <Text style={styles.modalTitle}>Respond to Date Request</Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setShowResponseModal(false);
                  setShowCounterProposalForm(false);
                }}
                style={styles.modalCloseButton}
              >
                <VectorIcon name="close" size={24} color="#ed167e" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalContent}>
              {/* Enhanced Complete Original Request Summary */}
              {currentDateRequest && (
                <View style={styles.requestSummary}>
                  <View style={styles.requestSummaryHeader}>
                    <VectorIcon name="person" size={20} color="#FF69B4" />
                    <Text style={styles.requestSummaryTitle}>
                      Date Request from {currentDateRequest.requester.fullName || currentDateRequest.requester.username}
                    </Text>
                  </View>
                  <View style={styles.requestSummaryDetails}>
                    <View style={styles.requestSummaryRow}>
                      <VectorIcon name="restaurant" size={16} color="#ed167e" />
                      <Text style={styles.requestSummaryText}>
                        {getDateTypeDisplay(currentDateRequest.initialRequest.dateType)}
                      </Text>
                    </View>
                    <View style={styles.requestSummaryRow}>
                      <VectorIcon name="chat-bubble" size={16} color="#ed167e" />
                      <Text style={styles.requestSummaryText}>
                        "{currentDateRequest.initialRequest.message}"
                      </Text>
                    </View>
                    {/* Complete location display */}
                    {currentDateRequest.initialRequest.location && (
                      <View style={styles.requestSummaryRow}>
                        <VectorIcon name="location-on" size={16} color="#ed167e" />
                        <Text style={styles.requestSummaryText}>
                          {currentDateRequest.initialRequest.location.city}
                          {currentDateRequest.initialRequest.location.area && `, ${currentDateRequest.initialRequest.location.area}`}
                          {currentDateRequest.initialRequest.location.specificPlace && ` (${currentDateRequest.initialRequest.location.specificPlace})`}
                        </Text>
                      </View>
                    )}
                    {/* Date and time display */}
                    {currentDateRequest.initialRequest.preferredDate && (
                      <View style={styles.requestSummaryRow}>
                        <VectorIcon name="event" size={16} color="#ed167e" />
                        <Text style={styles.requestSummaryText}>
                          {new Date(currentDateRequest.initialRequest.preferredDate).toLocaleDateString('en-IN', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </Text>
                      </View>
                    )}
                    {currentDateRequest.initialRequest.preferredTime && (
                      <View style={styles.requestSummaryRow}>
                        <VectorIcon name="access-time" size={16} color="#ed167e" />
                        <Text style={styles.requestSummaryText}>
                          {currentDateRequest.initialRequest.preferredTime}
                        </Text>
                      </View>
                    )}
                    {/* Budget display */}
                    {currentDateRequest.initialRequest.budget && (
                      <View style={styles.requestSummaryRow}>
                        <VectorIcon name="currency-rupee" size={16} color="#ed167e" />
                        <Text style={styles.requestSummaryText}>
                          ₹{currentDateRequest.initialRequest.budget.toLocaleString('en-IN')}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              )}
              <View style={styles.formSection}>
                <View style={styles.inputLabelContainer}>
                  <VectorIcon name="reply" size={16} color="#ed167e" />
                  <Text style={styles.inputLabel}>Your Response:</Text>
                </View>
                <View style={styles.responseOptions}>
                  <TouchableOpacity
                    style={[
                      styles.responseButton,
                      responseForm.action === 'accept' && styles.responseButtonSelected
                    ]}
                    onPress={() => {
                      setResponseForm({ ...responseForm, action: 'accept' });
                      setShowCounterProposalForm(false);
                    }}
                  >
                    <VectorIcon name="check" size={16} color={responseForm.action === 'accept' ? '#fff' : '#999'} />
                    <Text style={[
                      styles.responseButtonText,
                      responseForm.action === 'accept' && styles.responseButtonTextSelected
                    ]}>Accept as proposed</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.responseButton,
                      responseForm.action === 'reject' && styles.responseButtonSelected
                    ]}
                    onPress={() => {
                      setResponseForm({ ...responseForm, action: 'reject' });
                      setShowCounterProposalForm(false);
                    }}
                  >
                    <VectorIcon name="close" size={16} color={responseForm.action === 'reject' ? '#fff' : '#999'} />
                    <Text style={[
                      styles.responseButtonText,
                      responseForm.action === 'reject' && styles.responseButtonTextSelected
                    ]}>Decline politely</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.responseButton,
                      responseForm.action === 'counter_propose' && styles.responseButtonSelected
                    ]}
                    onPress={() => {
                      setResponseForm({ ...responseForm, action: 'counter_propose' });
                      setShowCounterProposalForm(true);
                      // Pre-fill with original request data
                      setCounterProposal({
                        preferredLocation: {
                          city: currentDateRequest?.initialRequest.location?.city || '',
                          area: currentDateRequest?.initialRequest.location?.area || '',
                          specificPlace: currentDateRequest?.initialRequest.location?.specificPlace || ''
                        },
                        preferredDate: currentDateRequest?.initialRequest.preferredDate ?
                          new Date(currentDateRequest.initialRequest.preferredDate) : new Date(),
                        preferredTime: currentDateRequest?.initialRequest.preferredTime ?
                          new Date(`2000-01-01T${currentDateRequest.initialRequest.preferredTime}:00`) : new Date(),
                        suggestedBudget: currentDateRequest?.initialRequest.budget?.toString() || '2000',
                        recipientMessage: ''
                      });
                    }}
                  >
                    <VectorIcon name="edit" size={16} color={responseForm.action === 'counter_propose' ? '#fff' : '#999'} />
                    <Text style={[
                      styles.responseButtonText,
                      responseForm.action === 'counter_propose' && styles.responseButtonTextSelected
                    ]}>Share my preferences</Text>
                  </TouchableOpacity>
                </View>
              </View>
              {/* Enhanced Counter-Proposal Form with Date/Time Pickers */}
              {showCounterProposalForm && (
                <View style={styles.counterProposalForm}>
                  <View style={styles.formSectionTitleContainer}>
                    <VectorIcon name="edit" size={20} color="#FF69B4" />
                    <Text style={styles.formSectionTitle}>Your Date Preferences</Text>
                  </View>
                  <View style={styles.inputLabelContainer}>
                    <VectorIcon name="location-on" size={16} color="#ed167e" />
                    <Text style={styles.inputLabel}>City *</Text>
                  </View>
                  <TextInput
                    style={styles.textInput}
                    value={counterProposal.preferredLocation.city}
                    onChangeText={(text) => setCounterProposal({
                      ...counterProposal,
                      preferredLocation: {
                        ...counterProposal.preferredLocation,
                        city: text
                      }
                    })}
                    placeholder="Mumbai"
                    placeholderTextColor="#666"
                  />
                  <Text style={styles.inputLabel}>Area (Optional)</Text>
                  <TextInput
                    style={styles.textInput}
                    value={counterProposal.preferredLocation.area}
                    onChangeText={(text) => setCounterProposal({
                      ...counterProposal,
                      preferredLocation: {
                        ...counterProposal.preferredLocation,
                        area: text
                      }
                    })}
                    placeholder="Bandra"
                    placeholderTextColor="#666"
                  />
                  <Text style={styles.inputLabel}>Specific Place (Optional)</Text>
                  <TextInput
                    style={styles.textInput}
                    value={counterProposal.preferredLocation.specificPlace}
                    onChangeText={(text) => setCounterProposal({
                      ...counterProposal,
                      preferredLocation: {
                        ...counterProposal.preferredLocation,
                        specificPlace: text
                      }
                    })}
                    placeholder="Suggest a specific place"
                    placeholderTextColor="#666"
                  />
                  {/* Counter Proposal Date Picker */}
                  <View style={styles.inputLabelContainer}>
                    <VectorIcon name="event" size={16} color="#ed167e" />
                    <Text style={styles.inputLabel}>Preferred Date *</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.dateTimeButton}
                    onPress={() => setShowCounterDatePicker(true)}
                  >
                    <VectorIcon name="event" size={20} color="#ed167e" />
                    <Text style={styles.dateTimeButtonText}>
                      {formatDisplayDate(counterProposal.preferredDate)}
                    </Text>
                    <VectorIcon name="keyboard-arrow-down" size={20} color="#666" />
                  </TouchableOpacity>
                  {showCounterDatePicker && (
                    <DateTimePicker
                      value={counterProposal.preferredDate}
                      mode="date"
                      display="default"
                      minimumDate={new Date()}
                      onChange={(event, selectedDate) => {
                        setShowCounterDatePicker(false);
                        if (selectedDate) {
                          setCounterProposal({
                            ...counterProposal,
                            preferredDate: selectedDate
                          });
                        }
                      }}
                    />
                  )}
                  {/* Counter Proposal Time Picker */}
                  <View style={styles.inputLabelContainer}>
                    <VectorIcon name="access-time" size={16} color="#ed167e" />
                    <Text style={styles.inputLabel}>Preferred Time *</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.dateTimeButton}
                    onPress={() => setShowCounterTimePicker(true)}
                  >
                    <VectorIcon name="access-time" size={20} color="#ed167e" />
                    <Text style={styles.dateTimeButtonText}>
                      {formatDisplayTime(counterProposal.preferredTime)}
                    </Text>
                    <VectorIcon name="keyboard-arrow-down" size={20} color="#666" />
                  </TouchableOpacity>
                  {showCounterTimePicker && (
                    <DateTimePicker
                      value={counterProposal.preferredTime}
                      mode="time"
                      display="default"
                      onChange={(event, selectedTime) => {
                        setShowCounterTimePicker(false);
                        if (selectedTime) {
                          setCounterProposal({
                            ...counterProposal,
                            preferredTime: selectedTime
                          });
                        }
                      }}
                    />
                  )}
                  {/* Enhanced Budget Input with Soft Guidance */}
                  <View style={styles.inputLabelContainer}>
                    <VectorIcon name="currency-rupee" size={16} color="#ed167e" />
                    <Text style={styles.inputLabel}>Budget Preference (₹) *</Text>
                  </View>
                  <TextInput
                    style={styles.textInput}
                    value={counterProposal.suggestedBudget}
                    onChangeText={(text) => setCounterProposal({
                      ...counterProposal,
                      suggestedBudget: text
                    })}
                    placeholder="2000"
                    placeholderTextColor="#666"
                    keyboardType="numeric"
                  />
                  {/* Soft Budget Guidance */}
                  <View style={styles.budgetGuidanceContainer}>
                    <Text style={styles.budgetReference}>
                      They suggested: ₹{currentDateRequest?.initialRequest.budget?.toLocaleString('en-IN') || '2,000'}
                    </Text>
                    <Text style={styles.budgetHelper}>
                      You can suggest any amount that works for you
                    </Text>
                    {/* Soft warning for significant budget differences */}
                    {counterProposal.suggestedBudget && currentDateRequest?.initialRequest.budget && (
                      (() => {
                        const suggestedAmount = parseInt(counterProposal.suggestedBudget);
                        const originalAmount = currentDateRequest.initialRequest.budget;
                        const difference = suggestedAmount - originalAmount;
                        const percentDifference = Math.abs(difference) / originalAmount * 100;
                        if (!isNaN(suggestedAmount) && percentDifference > 20) {
                          return (
                            <View style={styles.budgetNoteContainer}>
                              <VectorIcon name="info" size={14} color="#FF9800" />
                              <Text style={styles.budgetNote}>
                                {difference > 0
                                  ? "This is higher than their suggestion. They'll need to approve the new amount."
                                  : "This is lower than their suggestion. They may appreciate the consideration."
                                }
                              </Text>
                            </View>
                          );
                        }
                        return null;
                      })()
                    )}
                  </View>
                  <View style={styles.inputLabelContainer}>
                    <VectorIcon name="chat-bubble" size={16} color="#ed167e" />
                    <Text style={styles.inputLabel}>Optional Message:</Text>
                  </View>
                  <TextInput
                    style={styles.textInput}
                    value={counterProposal.recipientMessage}
                    onChangeText={(text) => setCounterProposal({
                      ...counterProposal,
                      recipientMessage: text
                    })}
                    placeholder="Looking forward to it!"
                    placeholderTextColor="#666"
                    multiline={true}
                    numberOfLines={2}
                  />
                </View>
              )}
              <View style={styles.formSection}>
                <View style={styles.inputLabelContainer}>
                  <VectorIcon name="chat-bubble" size={16} color="#ed167e" />
                  <Text style={styles.inputLabel}>Optional Message:</Text>
                </View>
                <TextInput
                  style={styles.textInput}
                  value={responseForm.message}
                  onChangeText={(text) => setResponseForm({
                    ...responseForm,
                    message: text
                  })}
                  placeholder="Add a message..."
                  placeholderTextColor="#666"
                  multiline={true}
                  numberOfLines={2}
                />
              </View>
            </ScrollView>
            <TouchableOpacity
              style={[
                styles.modalSubmitButton,
                !responseForm.action && styles.modalSubmitButtonDisabled
              ]}
              onPress={respondToInitialRequest}
              disabled={!responseForm.action || respondingToRequest}
            >
              {respondingToRequest ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <VectorIcon name="send" size={20} color="#fff" />
                  <Text style={styles.modalSubmitButtonText}>
                    {responseForm.action === 'accept' ? 'Accept Date Request' :
                      responseForm.action === 'reject' ? 'Decline Date Request' :
                        responseForm.action === 'counter_propose' ? 'Share My Preferences' :
                          'Select Response'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  // Header Styles
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
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
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
    marginTop: 15,
  },
  emptySubtext: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 5,
  },
  // Message Styles
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
    flexDirection: 'row',
    alignItems: 'center',
  },
  myMessageTime: {
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'right',
  },
  theirMessageTime: {
    color: '#999',
  },
  readStatusContainer: {
    marginLeft: 5,
  },
  // Date Request Card Styles
  dateRequestCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#ed167e',
  },
  dateRequestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  dateRequestTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateRequestTitle: {
    color: '#ed167e',
    fontSize: 18,
    fontWeight: 'bold',
  },
  cancelButton: {
    backgroundColor: '#dc3545',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  dateRequestStatus: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 15,
    lineHeight: 22,
  },
  // Enhanced Original Request Styles
  originalRequest: {
    backgroundColor: '#2e2e2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 15,
    borderLeftWidth: 3,
    borderLeftColor: '#FF69B4',
  },
  originalRequestHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  originalRequestTitle: {
    color: '#FF69B4',
    fontSize: 16,
    fontWeight: 'bold',
  },
  originalRequestDetails: {
    gap: 8,
  },
  originalRequestRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 2,
  },
  originalRequestDetail: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },
  // Enhanced Counter Proposal Styles
  counterProposalDetails: {
    backgroundColor: '#2e2e2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 15,
    borderLeftWidth: 3,
    borderLeftColor: '#4CAF50',
  },
  counterProposalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  counterProposalTitle: {
    color: '#4CAF50',
    fontSize: 16,
    fontWeight: 'bold',
  },
  counterProposalDetailsContainer: {
    gap: 8,
  },
  counterProposalRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 2,
  },
  counterProposalText: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },
  counterProposalMessage: {
    color: '#ccc',
    fontSize: 14,
    fontStyle: 'italic',
    marginTop: 5,
    flex: 1,
  },
  // Final Details Styles
  finalDetails: {
    backgroundColor: '#1a4a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 15,
    borderLeftWidth: 3,
    borderLeftColor: '#4CAF50',
  },
  finalDetailsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  finalDetailsTitle: {
    color: '#4CAF50',
    fontSize: 16,
    fontWeight: 'bold',
  },
  finalDetailsContainer: {
    gap: 8,
  },
  finalDetailsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 2,
  },
  finalDetailsText: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },
  // Action Button Styles
  respondButton: {
    backgroundColor: '#ed167e',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  respondButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  acceptButton: {
    backgroundColor: '#28a745',
  },
  rejectButton: {
    backgroundColor: '#dc3545',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  paymentButton: {
    backgroundColor: '#007bff',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  paymentButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
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
    flexDirection: 'row',
    gap: 8,
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
  inputLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  inputLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  subInputLabel: {
    color: '#ccc',
    fontSize: 13,
    marginBottom: 8,
    marginTop: 12,
    fontWeight: '400',
  },
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
    flexDirection: 'row',
    gap: 6,
  },
  messageButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Limit Reached Notice Styles
  limitReachedContainer: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderTopWidth: 1,
    borderTopColor: '#2e2e2e',
    backgroundColor: '#0a0a0a',
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
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
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    minHeight: '60%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#2e2e2e',
  },
  modalTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  modalCloseButton: {
    padding: 5,
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  // Form Section Styles
  formSection: {
    marginBottom: 20,
  },
  formSectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 15,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#2e2e2e',
  },
  formSectionTitle: {
    color: '#FF69B4',
    fontSize: 18,
    fontWeight: 'bold',
  },
  textInput: {
    backgroundColor: '#2e2e2e',
    borderRadius: 10,
    padding: 15,
    color: '#fff',
    fontSize: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#444',
  },
  helperText: {
    color: '#999',
    fontSize: 12,
    marginTop: 4,
    fontStyle: 'italic',
  },
  // Enhanced Date/Time Picker Styles
  dateTimeButton: {
    backgroundColor: '#2e2e2e',
    borderRadius: 10,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#444',
  },
  dateTimeButtonText: {
    color: '#fff',
    fontSize: 16,
    flex: 1,
    marginLeft: 10,
  },
  dateTypeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 15,
  },
  dateTypeButton: {
    backgroundColor: '#2e2e2e',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: '#444',
  },
  dateTypeButtonSelected: {
    backgroundColor: '#ed167e',
    borderColor: '#ed167e',
  },
  dateTypeButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  dateTypeButtonTextSelected: {
    color: '#fff',
    fontWeight: 'bold',
  },
  modalFormFooter: {
    paddingTop: 20,
    paddingBottom: 10,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  requiredFieldsNote: {
    color: '#999',
    fontSize: 12,
    fontStyle: 'italic',
  },
  modalSubmitButton: {
    backgroundColor: '#ed167e',
    borderRadius: 15,
    paddingVertical: 15,
    paddingHorizontal: 25,
    alignItems: 'center',
    margin: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  modalSubmitButtonDisabled: {
    backgroundColor: '#666',
  },
  modalSubmitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  // Enhanced Request Summary Styles
  requestSummary: {
    backgroundColor: '#2e2e2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#FF69B4',
  },
  requestSummaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  requestSummaryTitle: {
    color: '#FF69B4',
    fontSize: 16,
    fontWeight: 'bold',
  },
  requestSummaryDetails: {
    gap: 8,
  },
  requestSummaryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 3,
  },
  requestSummaryText: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },
  // Response Options Styles
  responseOptions: {
    gap: 12,
    marginBottom: 20,
  },
  responseButton: {
    backgroundColor: '#2e2e2e',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#444',
    flexDirection: 'row',
    gap: 12,
  },
  responseButtonSelected: {
    backgroundColor: '#ed167e',
    borderColor: '#ed167e',
  },
  responseButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'left',
    flex: 1,
  },
  responseButtonTextSelected: {
    color: '#fff',
    fontWeight: 'bold',
  },
  // Enhanced Counter Proposal Form Styles
  counterProposalForm: {
    backgroundColor: '#2e2e2e',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#444',
  },
  // Enhanced Budget Guidance Styles
  budgetGuidanceContainer: {
    marginTop: 8,
    padding: 12,
    backgroundColor: '#333',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#4CAF50',
  },
  budgetReference: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  budgetHelper: {
    color: '#999',
    fontSize: 12,
    lineHeight: 16,
  },
  budgetNoteContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 8,
    padding: 8,
    backgroundColor: '#3a2a1a',
    borderRadius: 6,
  },
  budgetNote: {
    color: '#FFB74D',
    fontSize: 12,
    lineHeight: 16,
    flex: 1,
  },
});

export default TakeOnDate;
