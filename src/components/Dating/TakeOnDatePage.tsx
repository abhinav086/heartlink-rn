// src/components/Dating/PrivateTakeOnDate.tsx - COMPLETE UPDATED CODE
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
const TakeOnDatePage = () => {
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
  // Form states for counter-proposal
  const [counterProposal, setCounterProposal] = useState({
    preferredLocation: {
      city: '',
      area: '',
      specificPlace: ''
    },
    preferredDate: '',
    preferredTime: '',
    suggestedBudget: '2000',
    recipientMessage: ''
  });
  // Initial date request form - COMPLETE WITH ALL FIELDS
  const [initialDateRequest, setInitialDateRequest] = useState({
    message: 'Would you like to go on a date?',
    dateType: 'dinner',
    location: {
      city: '',
      area: '',
      specificPlace: ''
    },
    preferredDate: '',
    preferredTime: '',
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
  // Fetch date requests between these users
  const fetchDateRequests = async () => {
    if (!token || !userId) return;
    try {
      const response = await fetch(
        `${BASE_URL}/api/v1/dating?type=all&status=all&limit=10`,
        {
          headers: { 'Authorization': `Bearer ${token}` },
        }
      );
      const data = await response.json();
      if (response.ok && data?.success) {
        const relevantRequests = data.data.requests.filter(req => 
          (req.requester._id === user?._id && req.recipient._id === userId) ||
          (req.requester._id === userId && req.recipient._id === user?._id)
        );
        setDateRequests(relevantRequests);
        const activeRequest = relevantRequests.find(req => 
          ['pending_initial', 'counter_proposed', 'accepted', 'paid'].includes(req.status)
        );
        setCurrentDateRequest(activeRequest || null);
        console.log('Date requests:', relevantRequests);
      }
    } catch (error) {
      console.error('Error fetching date requests:', error);
    }
  };
  // Create initial date request - UPDATED WITH ALL FIELDS
  const createInitialDateRequest = async () => {
    if (!token || !userId || creatingDateRequest) return;
    // Validation for required fields
    if (!initialDateRequest.location.city || !initialDateRequest.preferredDate || 
        !initialDateRequest.preferredTime || !initialDateRequest.budget) {
      Alert.alert('Missing Fields', 'Please fill in all required fields (City, Date, Time, Budget)');
      return;
    }
    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(initialDateRequest.preferredDate)) {
      Alert.alert('Invalid Date', 'Please enter date in YYYY-MM-DD format (e.g., 2025-01-20)');
      return;
    }
    // Validate time format
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(initialDateRequest.preferredTime)) {
      Alert.alert('Invalid Time', 'Please enter time in HH:MM format (e.g., 19:30)');
      return;
    }
    // Validate budget
    const budget = parseInt(initialDateRequest.budget);
    if (isNaN(budget) || budget < 500 || budget > 200000) {
      Alert.alert('Invalid Budget', 'Budget must be between ₹500 and ₹200,000');
      return;
    }
    // Validate date is in future
    const selectedDate = new Date(initialDateRequest.preferredDate);
    if (selectedDate <= new Date()) {
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
          preferredDate: initialDateRequest.preferredDate,
          preferredTime: initialDateRequest.preferredTime,
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
  // Respond to initial date request
  const respondToInitialRequest = async () => {
    if (!token || !currentDateRequest || respondingToRequest) return;
    setRespondingToRequest(true);
    try {
      let requestBody = {
        action: responseForm.action,
        message: responseForm.message
      };
      if (responseForm.action === 'counter_propose') {
        if (!counterProposal.preferredLocation.city || 
            !counterProposal.preferredDate || 
            !counterProposal.preferredTime || 
            !counterProposal.suggestedBudget) {
          Alert.alert('Error', 'Please fill in all preference fields');
          setRespondingToRequest(false);
          return;
        }
        requestBody = {
          ...requestBody,
          preferredLocation: counterProposal.preferredLocation,
          preferredDate: counterProposal.preferredDate,
          preferredTime: counterProposal.preferredTime,
          suggestedBudget: parseInt(counterProposal.suggestedBudget),
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
      requestId: currentDateRequest._id, // Changed from dateRequestId to requestId
      // Optional: You can still pass these if PaymentScreen needed them directly,
      // but based on its code, it fetches details itself using requestId.
      // request: currentDateRequest // Uncomment if needed by PaymentScreen directly
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
        setMessageTypes(data.data.messageTypes || {});
      } else {
        console.error('Failed to fetch message types:', data.message);
        setMessageTypes({
          HI: "Hi 👋",
          HELLO: "Hello! 😊"
        });
      }
    } catch (error) {
      console.error('Error fetching message types:', error);
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
        return 'Date confirmed! Payment completed'; // Updated status message
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
  // Render date request status card
  const renderDateRequestStatus = () => {
    if (!currentDateRequest) return null;
    const isRequester = currentDateRequest.requester._id === user?._id;
    const status = currentDateRequest.status;
    return (
      <View style={styles.dateRequestCard}>
        <View style={styles.dateRequestHeader}>
          <Text style={styles.dateRequestTitle}>Date Request Status</Text>
          {['pending_initial', 'counter_proposed', 'accepted'].includes(status) && (
            <TouchableOpacity
              onPress={cancelDateRequest}
              style={styles.cancelButton}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          )}
        </View>
        <Text style={styles.dateRequestStatus}>{getDateRequestStatus()}</Text>
        
        {/* Show original request details */}
        {currentDateRequest.initialRequest && (
          <View style={styles.originalRequest}>
            <Text style={styles.originalRequestTitle}>Original Request:</Text>
            <View style={styles.originalRequestDetails}>
              <Text style={styles.originalRequestDetail}>
                Type: {getDateTypeDisplay(currentDateRequest.initialRequest.dateType)}
              </Text>
              <Text style={styles.originalRequestDetail}>
                Message: {currentDateRequest.initialRequest.message}
              </Text>
            </View>
          </View>
        )}
        
        {/* Show counter-proposal details if exists */}
        {currentDateRequest.counterProposal?.hasCounterProposal && (
          <View style={styles.counterProposalDetails}>
            <Text style={styles.counterProposalTitle}>Date Preferences:</Text>
            <View style={styles.counterProposalDetailsContainer}>
              <View style={styles.counterProposalRow}>
                <Icon name="place" size={16} color="#ed167e" />
                <Text style={styles.counterProposalText}>
                  {currentDateRequest.counterProposal.preferredLocation.city}
                  {currentDateRequest.counterProposal.preferredLocation.area && `, ${currentDateRequest.counterProposal.preferredLocation.area}`}
                </Text>
              </View>
              <View style={styles.counterProposalRow}>
                <Icon name="calendar-today" size={16} color="#ed167e" />
                <Text style={styles.counterProposalText}>
                  {new Date(currentDateRequest.counterProposal.preferredDate).toLocaleDateString()}
                </Text>
              </View>
              <View style={styles.counterProposalRow}>
                <Icon name="access-time" size={16} color="#ed167e" />
                <Text style={styles.counterProposalText}>
                  {currentDateRequest.counterProposal.preferredTime}
                </Text>
              </View>
              <View style={styles.counterProposalRow}>
                <Icon name="attach-money" size={16} color="#ed167e" />
                <Text style={styles.counterProposalText}>
                  ₹{currentDateRequest.counterProposal.suggestedBudget?.toLocaleString('en-IN')}
                </Text>
              </View>
              {currentDateRequest.counterProposal.recipientMessage && (
                <View style={styles.counterProposalRow}>
                  <Icon name="message" size={16} color="#ed167e" />
                  <Text style={styles.counterProposalMessage}>
                    {currentDateRequest.counterProposal.recipientMessage}
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}
        
        {/* Show final details if accepted or paid */}
        {currentDateRequest.finalDetails && (status === 'accepted' || status === 'paid') && (
          <View style={styles.finalDetails}>
            <Text style={styles.finalDetailsTitle}>Final Date Details:</Text>
            <View style={styles.finalDetailsContainer}>
              <View style={styles.finalDetailsRow}>
                <Icon name="place" size={16} color="#ed167e" />
                <Text style={styles.finalDetailsText}>
                  {currentDateRequest.finalDetails.location?.city}
                  {currentDateRequest.finalDetails.location?.area && `, ${currentDateRequest.finalDetails.location.area}`}
                </Text>
              </View>
              <View style={styles.finalDetailsRow}>
                <Icon name="calendar-today" size={16} color="#ed167e" />
                <Text style={styles.finalDetailsText}>
                  {new Date(currentDateRequest.finalDetails.dateTime).toLocaleDateString()}
                </Text>
              </View>
              <View style={styles.finalDetailsRow}>
                <Icon name="access-time" size={16} color="#ed167e" />
                <Text style={styles.finalDetailsText}>
                  {new Date(currentDateRequest.finalDetails.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
              <View style={styles.finalDetailsRow}>
                <Icon name="attach-money" size={16} color="#ed167e" />
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
                <Text style={styles.actionButtonText}>Accept</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.rejectButton]}
              onPress={() => respondToCounterProposal('reject')}
              disabled={respondingToRequest}
            >
              <Text style={styles.actionButtonText}>Decline</Text>
            </TouchableOpacity>
          </View>
        )}
        {status === 'accepted' && isRequester && (
          <TouchableOpacity
            style={styles.paymentButton}
            onPress={navigateToPayment}
          >
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
      {/* Header */}
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
              <Text style={styles.takeOnDateText}>💕 Take on a Date</Text>
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
                    <Text style={styles.messageButtonText}>{content}</Text>
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
      {/* COMPLETE INITIAL DATE REQUEST MODAL - WITH ALL FIELDS */}
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
              <Text style={styles.modalTitle}>Send Date Request</Text>
              <TouchableOpacity
                onPress={() => setShowDateRequestModal(false)}
                style={styles.modalCloseButton}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Message:</Text>
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
              <Text style={styles.inputLabel}>Date Type:</Text>
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
              <Text style={styles.inputLabel}>Location:</Text>
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
              <Text style={styles.inputLabel}>Preferred Date *</Text>
              <TextInput
                style={styles.textInput}
                value={initialDateRequest.preferredDate}
                onChangeText={(text) => setInitialDateRequest({
                  ...initialDateRequest,
                  preferredDate: text
                })}
                placeholder="2025-01-20"
                placeholderTextColor="#666"
              />
              <Text style={styles.inputLabel}>Preferred Time *</Text>
              <TextInput
                style={styles.textInput}
                value={initialDateRequest.preferredTime}
                onChangeText={(text) => setInitialDateRequest({
                  ...initialDateRequest,
                  preferredTime: text
                })}
                placeholder="19:30"
                placeholderTextColor="#666"
              />
              <Text style={styles.inputLabel}>Budget (₹) *</Text>
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
              <View style={styles.modalFormFooter}>
                <Text style={styles.requiredFieldsNote}>* Required fields</Text>
              </View>
            </ScrollView>
            <TouchableOpacity
              style={[
                styles.modalSubmitButton,
                (!initialDateRequest.location.city || !initialDateRequest.preferredDate || 
                 !initialDateRequest.preferredTime || !initialDateRequest.budget) && 
                styles.modalSubmitButtonDisabled
              ]}
              onPress={createInitialDateRequest}
              disabled={creatingDateRequest || !initialDateRequest.location.city || 
                       !initialDateRequest.preferredDate || !initialDateRequest.preferredTime || 
                       !initialDateRequest.budget}
            >
              {creatingDateRequest ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.modalSubmitButtonText}>Send Date Request</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      {/* Response Modal */}
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
              <Text style={styles.modalTitle}>Respond to Date Request</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowResponseModal(false);
                  setShowCounterProposalForm(false);
                }}
                style={styles.modalCloseButton}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalContent}>
              {currentDateRequest && (
                <View style={styles.requestSummary}>
                  <Text style={styles.requestSummaryTitle}>Date Request from {currentDateRequest.requester.fullName}</Text>
                  <Text style={styles.requestSummaryText}>{currentDateRequest.initialRequest.message}</Text>
                  <Text style={styles.requestSummaryText}>Type: {getDateTypeDisplay(currentDateRequest.initialRequest.dateType)}</Text>
                </View>
              )}
              <Text style={styles.inputLabel}>Your Response:</Text>
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
                  <Text style={[
                    styles.responseButtonText,
                    responseForm.action === 'accept' && styles.responseButtonTextSelected
                  ]}>✅ Accept</Text>
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
                  <Text style={[
                    styles.responseButtonText,
                    responseForm.action === 'reject' && styles.responseButtonTextSelected
                  ]}>❌ Decline</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.responseButton,
                    responseForm.action === 'counter_propose' && styles.responseButtonSelected
                  ]}
                  onPress={() => {
                    setResponseForm({ ...responseForm, action: 'counter_propose' });
                    setShowCounterProposalForm(true);
                  }}
                >
                  <Text style={[
                    styles.responseButtonText,
                    responseForm.action === 'counter_propose' && styles.responseButtonTextSelected
                  ]}>📝 Share Preferences</Text>
                </TouchableOpacity>
              </View>
              {/* Counter-Proposal Form */}
              {showCounterProposalForm && (
                <View style={styles.counterProposalForm}>
                  <Text style={styles.formSectionTitle}>Your Date Preferences</Text>
                  <Text style={styles.inputLabel}>City *</Text>
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
                    placeholder="Linking Road Cafe"
                    placeholderTextColor="#666"
                  />
                  <Text style={styles.inputLabel}>Preferred Date *</Text>
                  <TextInput
                    style={styles.textInput}
                    value={counterProposal.preferredDate}
                    onChangeText={(text) => setCounterProposal({
                      ...counterProposal,
                      preferredDate: text
                    })}
                    placeholder="2025-01-20"
                    placeholderTextColor="#666"
                  />
                  <Text style={styles.inputLabel}>Preferred Time *</Text>
                  <TextInput
                    style={styles.textInput}
                    value={counterProposal.preferredTime}
                    onChangeText={(text) => setCounterProposal({
                      ...counterProposal,
                      preferredTime: text
                    })}
                    placeholder="19:30"
                    placeholderTextColor="#666"
                  />
                  <Text style={styles.inputLabel}>Suggested Budget (₹) *</Text>
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
                  <Text style={styles.inputLabel}>Message (Optional)</Text>
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
              <Text style={styles.inputLabel}>Optional Message:</Text>
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
                <Text style={styles.modalSubmitButtonText}>
                  {responseForm.action === 'accept' ? 'Accept Date' :
                   responseForm.action === 'reject' ? 'Decline Date' :
                   responseForm.action === 'counter_propose' ? 'Share Preferences' :
                   'Select Response'}
                </Text>
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
  originalRequest: {
    backgroundColor: '#2e2e2e',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
  },
  originalRequestTitle: {
    color: '#FF69B4',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  originalRequestDetails: {
    marginLeft: 10,
  },
  originalRequestDetail: {
    color: '#fff',
    fontSize: 13,
    marginBottom: 4,
  },
  counterProposalDetails: {
    backgroundColor: '#2e2e2e',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
  },
  counterProposalTitle: {
    color: '#FF69B4',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  counterProposalDetailsContainer: {
    gap: 8,
  },
  counterProposalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  counterProposalText: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 5,
  },
  counterProposalMessage: {
    color: '#ccc',
    fontSize: 14,
    fontStyle: 'italic',
    marginTop: 10,
  },
  finalDetails: {
    backgroundColor: '#1a4a1a',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
  },
  finalDetailsTitle: {
    color: '#4CAF50',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  finalDetailsContainer: {
    gap: 8,
  },
  finalDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  finalDetailsText: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 5,
  },
  respondButton: {
    backgroundColor: '#ed167e',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
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
  subInputLabel: {
    color: '#ccc',
    fontSize: 13,
    marginBottom: 5,
    marginTop: 10,
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
  modalTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  modalCloseButton: {
    padding: 5,
  },
  modalCloseText: {
    color: '#ed167e',
    fontSize: 24,
    fontWeight: 'bold',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  textInput: {
    backgroundColor: '#2e2e2e',
    borderRadius: 10,
    padding: 15,
    color: '#fff',
    fontSize: 16,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#444',
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
  },
  modalSubmitButtonDisabled: {
    backgroundColor: '#666',
  },
  modalSubmitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  requestSummary: {
    backgroundColor: '#2e2e2e',
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
  },
  requestSummaryTitle: {
    color: '#FF69B4',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  requestSummaryText: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 5,
  },
  responseOptions: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  responseButton: {
    flex: 1,
    backgroundColor: '#2e2e2e',
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#444',
  },
  responseButtonSelected: {
    backgroundColor: '#ed167e',
    borderColor: '#ed167e',
  },
  responseButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  responseButtonTextSelected: {
    color: '#fff',
    fontWeight: 'bold',
  },
  counterProposalForm: {
    backgroundColor: '#2e2e2e',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
  },
  formSectionTitle: {
    color: '#FF69B4',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  flowExplanation: {
    backgroundColor: '#2a2a2a',
    borderRadius: 10,
    padding: 15,
    marginTop: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#ed167e',
  },
  flowExplanationTitle: {
    color: '#ed167e',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  flowExplanationText: {
    color: '#ccc',
    fontSize: 14,
    lineHeight: 20,
  },
});

export default TakeOnDatePage;
