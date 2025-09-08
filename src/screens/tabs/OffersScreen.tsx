import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Modal,
  TextInput,
  ActivityIndicator
} from 'react-native';
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import Icon from 'react-native-vector-icons/Ionicons';

const OffersScreen = () => {
  const navigation = useNavigation();
  const [dateStats, setDateStats] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  // PIN Management State
  const [userHasPin, setUserHasPin] = useState(false);
  const [isPinModalVisible, setIsPinModalVisible] = useState(false);
  const [pinMode, setPinMode] = useState('enter'); // Will be set dynamically
  const [enteredPin, setEnteredPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const pinInputRef = useRef(null);
  const confirmPinInputRef = useRef(null);

  // --- IMPORTANT: Replace with your actual token retrieval logic ---
  // const { token } = useAuth(); // Example using context
  const token = "YOUR_JWT_TOKEN_HERE"; // Placeholder - Replace with actual token

  // Fetch dating statistics
  const fetchDateStats = async () => {
    try {
      // Mock data for demonstration
      setDateStats({
        pending: 2,
        accepted: 1,
        completed: 5,
        total: 8
      });
      setPendingCount(2);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching date stats:', error);
      setLoading(false);
    }
  };

  // Fetch pending requests count
  const fetchPendingCount = async () => {
    try {
      // Mock data for demonstration
      setPendingCount(2);
    } catch (error) {
      console.error('Error fetching pending count:', error);
    }
  };

  // --- NEW: Check if user has a private PIN set using the dedicated endpoint ---
  const checkUserPinStatus = async () => {
    try {
      if (!token) {
        console.warn("No token available for PIN check");
        setUserHasPin(false);
        return;
      }

      const response = await fetch(`https://backendforheartlink.in/api/v1/private-pin/status`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (response.ok && result.success) {
        const hasPin = result.data.hasPrivatePin || false;
        setUserHasPin(hasPin);
        console.log("PIN Status Check (via /status) - Has PIN:", hasPin);
      } else {
        console.error("Failed to fetch user PIN status (/status):", result.message || response.status);
        setUserHasPin(false);
      }
    } catch (error) {
      console.error('Error checking user PIN status (/status):', error);
      setUserHasPin(false);
    }
  };


  // Set a new private PIN
  const setPrivatePin = async () => {
    if (!enteredPin.trim()) {
      setPinError('Please enter a PIN.');
      return;
    }
    if (pinMode === 'set' && !confirmPin.trim()) {
      setPinError('Please confirm your PIN.');
      return;
    }
    if (pinMode === 'set' && enteredPin !== confirmPin) {
      setPinError('PINs do not match. Please try again.');
      setConfirmPin('');
      if (confirmPinInputRef.current) {
        confirmPinInputRef.current.focus();
      }
      return;
    }
    if (enteredPin.length < 4 || enteredPin.length > 8 || !/^\d+$/.test(enteredPin)) {
      setPinError('PIN must be 4-8 digits.');
      return;
    }

    setIsProcessing(true);
    setPinError('');

    try {
      const pinToSet = enteredPin.trim();
      const response = await fetch(`https://backendforheartlink.in/api/v1/private-pin/set`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ pin: pinToSet })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setUserHasPin(true);
        setIsPinModalVisible(false);
        setEnteredPin('');
        setConfirmPin('');
        Alert.alert('Success', 'Your Private PIN has been set successfully!', [
          { text: 'OK' }
        ]);
      } else {
        setPinError(result.message || 'Failed to set PIN. Please try again.');
      }
    } catch (error) {
      console.error('PIN set error:', error);
      setPinError('Failed to set PIN. Please check your connection and try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Verify the entered PIN with the backend
  const verifyPrivatePin = async () => {
    if (!enteredPin.trim()) {
      setPinError('Please enter your PIN.');
      return;
    }

    setIsProcessing(true);
    setPinError('');

    try {
      const response = await fetch(`https://backendforheartlink.in/api/v1/private-pin/verify`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ pin: enteredPin.trim() })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setIsPinModalVisible(false);
        setEnteredPin('');
        navigation.navigate('PrivateChat'); // Make sure 'PrivateChat' is a valid route name
      } else {
        setPinError(result.message || 'Invalid PIN. Please try again.');
        setEnteredPin('');
        if (pinInputRef.current) {
          pinInputRef.current.focus();
        }
      }
    } catch (error) {
      console.error('PIN verification error:', error);
      setPinError('Failed to verify PIN. Please check your connection and try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  // --- UPDATED: Handle pressing the "Private Messages" button ---
  const handlePrivateMessagePress = async () => {
    setLoading(true);
    try {
      await checkUserPinStatus(); // Ensure the latest PIN status is fetched

      // Determine the mode based on the fetched userHasPin state
      const mode = userHasPin ? 'enter' : 'set';
      console.log("Setting PIN mode to:", mode, "based on userHasPin:", userHasPin);
      setPinMode(mode);
      setIsPinModalVisible(true);
      setPinError('');
      setEnteredPin('');
      setConfirmPin('');

      // Delay focus slightly to ensure modal is fully rendered
      setTimeout(() => {
        if (mode === 'set' && pinInputRef.current) {
          pinInputRef.current.focus();
        } else if (mode === 'enter' && pinInputRef.current) {
          pinInputRef.current.focus();
        }
      }, 300);

    } catch (err) {
      console.error("Error in handlePrivateMessagePress:", err);
      Alert.alert("Error", "Could not process PIN check. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Refresh data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      const fetchData = async () => {
        await fetchDateStats();
        await fetchPendingCount();
        await checkUserPinStatus(); // Check PIN status on focus
      };
      fetchData();
    }, [token])
  );

  // Pull to refresh functionality
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchDateStats();
    await fetchPendingCount();
    await checkUserPinStatus(); // Check PIN status on refresh
    setRefreshing(false);
  }, [token]);

  const handleDateRequestsPress = () => {
    navigation.navigate('DateRequests');
  };

  const handlePendingRequestsPress = () => {
    if (pendingCount > 0) {
      navigation.navigate('PendingDateRequests');
    } else {
      navigation.navigate('DateRequests');
    }
  };

  const handleComingSoon = () => {
    Alert.alert("Coming Soon", "This feature will be available soon!");
  };

  const handleDatingStatsPress = () => {
    if (dateStats) {
      Alert.alert(
        'Dating Stats 📊',
        `• Pending: ${dateStats.pending || 0}\n• Accepted: ${dateStats.accepted || 0}\n• Completed: ${dateStats.completed || 0}\n• Total: ${dateStats.total || 0}`,
        [
          { text: 'View Details', onPress: () => navigation.navigate('DateRequests') },
          { text: 'Close', style: 'cancel' }
        ]
      );
    }
  };

  const renderBadge = (count, type = 'info') => {
    if (count === 0) return null;

    const getBadgeStyle = () => {
      switch (type) {
        case 'urgent': return styles.urgentBadge;
        case 'success': return styles.successBadge;
        default: return styles.infoBadge;
      }
    };

    return (
      <View style={getBadgeStyle()}>
        <Text style={styles.badgeText}>
          {count > 99 ? '99+' : count.toString()}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Icon name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Offers & Dating</Text>
        <TouchableOpacity onPress={onRefresh} style={styles.refreshButton} disabled={refreshing}>
          {refreshing ? (
            <ActivityIndicator size="small" color="#ed167e" />
          ) : (
            <Icon name="refresh" size={24} color="#ed167e" />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ed167e" />
        }
      >
        {/* Dating Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Icon name="heart" size={20} color="#ed167e" />
            <Text style={styles.sectionTitle}>💕 Dating</Text>
          </View>

          {/* Date Requests Card */}
          {/* <TouchableOpacity
            style={styles.card}
            onPress={handleDateRequestsPress}
          >
            <View style={styles.cardContent}>
              <View style={styles.cardLeft}>
                <Icon name="heart-outline" size={24} color="#ed167e" />
                <View style={styles.cardText}>
                  <Text style={styles.cardTitle}>Date Requests</Text>
                  <Text style={styles.cardSubtitle}>Manage your date requests</Text>
                </View>
              </View>
            </View>
          </TouchableOpacity> */}

          {/* Pending Requests Card */}
          {/* <TouchableOpacity
            style={styles.card}
            onPress={handlePendingRequestsPress}
          >
            <View style={styles.cardContent}>
              <View style={styles.cardLeft}>
                <Icon name="time-outline" size={24} color="#FFA500" />
                <View style={styles.cardText}>
                  <Text style={styles.cardTitle}>Pending Requests</Text>
                  <Text style={styles.cardSubtitle}>
                    {pendingCount > 0 ? ` Your pending requests` : 'No pending requests'}
                  </Text>
                </View>
              </View>
            </View>
          </TouchableOpacity> */}

          {/* Private Messages Card */}
          <TouchableOpacity
            style={[styles.card, loading && styles.cardDisabled]}
            onPress={handlePrivateMessagePress}
            disabled={loading}
          >
            <View style={styles.cardContent}>
              <View style={styles.cardLeft}>
                <Icon name="chatbox-ellipses" size={24} color="#ed167e" />
                <View style={styles.cardText}>
                  <Text style={styles.cardTitle}>Private Messages</Text>
                  <Text style={styles.cardSubtitle}>
                    Secure your private conversations
                  </Text>
                </View>
              </View>
              {loading && (
                <ActivityIndicator size="small" color="#999" style={{ marginRight: 10 }} />
              )}
            </View>
          </TouchableOpacity>
        </View>

        {/* Loading State for main content */}
        {loading && !isPinModalVisible && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#ed167e" />
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        )}
      </ScrollView>

      {/* PIN Management Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isPinModalVisible}
        onRequestClose={() => {
          setIsPinModalVisible(false);
          setEnteredPin('');
          setConfirmPin('');
          setPinError('');
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalView}>
            {pinMode === 'set' ? (
              <>
                <Text style={styles.modalTitle}>🔐 Set Private PIN</Text>
                <Text style={styles.modalSubtitle}>
                  Create a 4-8 digit PIN to protect your private messages.
                </Text>

                <View style={styles.pinInputContainer}>
                  <TextInput
                    ref={pinInputRef}
                    style={styles.pinInput}
                    onChangeText={setEnteredPin}
                    value={enteredPin}
                    placeholder="Enter New PIN"
                    placeholderTextColor="#666"
                    keyboardType="number-pad"
                    maxLength={8}
                    secureTextEntry={true}
                  />
                </View>

                <View style={styles.pinInputContainer}>
                  <TextInput
                    ref={confirmPinInputRef}
                    style={styles.pinInput}
                    onChangeText={setConfirmPin}
                    value={confirmPin}
                    placeholder="Confirm PIN"
                    placeholderTextColor="#666"
                    keyboardType="number-pad"
                    maxLength={8}
                    secureTextEntry={true}
                    onSubmitEditing={setPrivatePin}
                  />
                </View>
              </>
            ) : (
              <>
                <Text style={styles.modalTitle}>🔒 Enter Private PIN</Text>
                <Text style={styles.modalSubtitle}>
                  Access your private messages by entering your PIN.
                </Text>

                <View style={styles.pinInputContainer}>
                  <TextInput
                    ref={pinInputRef}
                    style={styles.pinInput}
                    onChangeText={setEnteredPin}
                    value={enteredPin}
                    placeholder="Enter PIN"
                    placeholderTextColor="#666"
                    keyboardType="number-pad"
                    maxLength={8}
                    secureTextEntry={true}
                    onSubmitEditing={verifyPrivatePin}
                  />
                </View>
              </>
            )}

            {pinError ? (
              <Text style={styles.pinErrorText}>{pinError}</Text>
            ) : null}

            <View style={styles.modalButtonContainer}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setIsPinModalVisible(false);
                  setEnteredPin('');
                  setConfirmPin('');
                  setPinError('');
                }}
                disabled={isProcessing}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.actionButton]}
                onPress={pinMode === 'set' ? setPrivatePin : verifyPrivatePin}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={styles.actionButtonText}>
                    {pinMode === 'set' ? 'Set PIN' : 'Verify & Enter'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "black",
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    fontFamily: "Montserrat-Regular",
  },
  refreshButton: {
    padding: 5,
  },
  content: {
    flex: 1,
    padding: 15,
  },
  section: {
    marginBottom: 25,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    color: '#ed167e',
    fontSize: 18,
    fontWeight: '600',
    fontFamily: "Montserrat-Regular",
    marginLeft: 8,
  },
  card: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#333',
  },
  cardDisabled: {
    opacity: 0.7,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  cardText: {
    marginLeft: 12,
    flex: 1,
  },
  cardTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: "Montserrat-Regular",
    marginBottom: 2,
  },
  cardSubtitle: {
    color: '#999',
    fontSize: 14,
    fontFamily: "Montserrat-Regular",
  },
  urgentBadge: {
    backgroundColor: '#ed167e',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  successBadge: {
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  infoBadge: {
    backgroundColor: '#2196F3',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  badgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 4,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  loadingText: {
    color: '#999',
    fontSize: 16,
    fontFamily: "Montserrat-Regular",
    marginTop: 10,
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  modalView: {
    width: '85%',
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    padding: 25,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    borderColor: '#ed167e',
    borderWidth: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ed167e',
    marginBottom: 10,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#999',
    marginBottom: 20,
    textAlign: 'center',
    fontFamily: "Montserrat-Regular",
  },
  pinInputContainer: {
    width: '100%',
    marginBottom: 15,
  },
  pinInput: {
    backgroundColor: '#2a2a2a',
    color: 'white',
    padding: 15,
    borderRadius: 10,
    fontSize: 18,
    textAlign: 'center',
    fontFamily: "Montserrat-Regular",
  },
  pinErrorText: {
    color: '#FF6B6B',
    fontSize: 14,
    marginBottom: 15,
    textAlign: 'center',
    fontFamily: "Montserrat-Regular",
  },
  modalButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  cancelButton: {
    backgroundColor: '#333',
  },
  cancelButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
    fontFamily: "Montserrat-Regular",
  },
  actionButton: {
    backgroundColor: '#ed167e',
  },
  actionButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
    fontFamily: "Montserrat-Regular",
  },
});

export default OffersScreen;