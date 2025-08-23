import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  SafeAreaView,
  TextInput,
  Alert,
  Image,
  Modal,
  Pressable
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
// ✅ Import the service
import walletService from '../../services/walletService';
import { icons } from '../../constants'; // Assuming you have an icons file

const WalletScreen = ({ navigation }) => {
  const { token } = useAuth();
  const [walletData, setWalletData] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [subscriptionHistory, setSubscriptionHistory] = useState([]);
  const [withdrawalRequests, setWithdrawalRequests] = useState([]); // New state for requests
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('rewards'); // 'rewards', 'subscriptions', or 'requests'
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  const [requestsLoading, setRequestsLoading] = useState(false); // Loading state for requests
  const [error, setError] = useState(null);

  // New state flags to prevent repeated fetching
  const [hasFetchedSubscriptions, setHasFetchedSubscriptions] = useState(false);
  const [hasFetchedRequests, setHasFetchedRequests] = useState(false);

  // Withdrawal Modal State
  const [isWithdrawModalVisible, setIsWithdrawModalVisible] = useState(false);
  const [withdrawalMethod, setWithdrawalMethod] = useState('upi'); // 'upi' or 'bank'
  const [withdrawalAmount, setWithdrawalAmount] = useState('');
  const [upiId, setUpiId] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankIfscCode, setBankIfscCode] = useState('');
  const [withdrawalLoading, setWithdrawalLoading] = useState(false);

  // ✅ FIXED: This function now correctly fetches and processes subscription history.
  const fetchSubscriptionHistory = useCallback(async () => {
    if (subscriptionLoading) return; // Prevent multiple fetches

    setSubscriptionLoading(true);
    setError(null);
    try {
      // 1. Use the centralized walletService to fetch data
      const data = await walletService.getSubscriptionHistory(token, { limit: 50 });

      if (data.success) {
        const history = data.data.history || [];

        // 2. Map the backend response to the format your UI needs
        const processedHistory = history.map(transaction => ({
          _id: transaction._id,
          // Use planInfo from backend, with fallbacks for safety
          planInfo: {
            name: transaction.planInfo?.name || transaction.description || 'Subscription Payment',
          },
          // Amount is provided by the backend
          amount: transaction.amount,
          // The status is for the payment transaction (e.g., completed, failed)
          status: transaction.status,
          // Use 'purchaseDate' from the backend and map it to 'createdAt' for consistent sorting/display
          createdAt: transaction.purchaseDate,
        }));

        setSubscriptionHistory(processedHistory);
      } else {
        throw new Error(data.message || 'Failed to fetch subscription history');
      }
    } catch (err) {
      const errorMessage = err.message || 'Unable to load subscription history. Please check your connection and try again.';
      console.error('Error fetching subscription history:', err);
      setError(errorMessage);
      Alert.alert('Error', errorMessage, [{ text: 'OK' }]); // Show error to user
    } finally {
      setSubscriptionLoading(false);
    }
  }, [token, subscriptionLoading]);

  // ✅ NEW: Function to fetch withdrawal requests
  const fetchWithdrawalRequests = useCallback(async () => {
    if (requestsLoading) return;

    setRequestsLoading(true);
    setError(null);
    try {
      const response = await fetch('https://backendforheartlink.in/api/v1/wallet/requests?limit=50', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (response.ok && data.statusCode === 200) {
        // Sort by createdAt descending (newest first)
        const sortedRequests = (data.data.requests || []).sort(
          (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
        );
        setWithdrawalRequests(sortedRequests);
      } else {
        throw new Error(data.message || 'Failed to fetch withdrawal requests');
      }
    } catch (err) {
      const errorMessage = err.message || 'Unable to load withdrawal requests. Please check your connection and try again.';
      console.error('Error fetching withdrawal requests:', err);
      setError(errorMessage);
      Alert.alert('Error', errorMessage, [{ text: 'OK' }]);
    } finally {
      setRequestsLoading(false);
    }
  }, [token, requestsLoading]);

  const initializeData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const summaryData = await walletService.getWalletSummary(token);
      setWalletData(summaryData.data.summary);

      const transactionData = await walletService.getTransactionHistory(token, { limit: 50 });
      setTransactions(transactionData.data.transactions || []);

    } catch (err) {
      setError('Failed to load wallet data');
      console.error('Initialization error:', err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    initializeData();
  }, [initializeData]);

  useEffect(() => {
    // Fetch subscription history when tab is switched to 'subscriptions' for the first time
    if (activeTab === 'subscriptions' && !hasFetchedSubscriptions && subscriptionHistory.length === 0 && !error) {
      fetchSubscriptionHistory().then(() => setHasFetchedSubscriptions(true));
    }
    // Fetch withdrawal requests when tab is switched to 'requests' for the first time
    if (activeTab === 'requests' && !hasFetchedRequests && withdrawalRequests.length === 0 && !error) {
        fetchWithdrawalRequests().then(() => setHasFetchedRequests(true));
    }
  }, [
      activeTab,
      subscriptionHistory.length,
      withdrawalRequests.length,
      hasFetchedSubscriptions,
      hasFetchedRequests,
      fetchSubscriptionHistory,
      fetchWithdrawalRequests,
      error
  ]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setError(null); // Clear previous errors on refresh

    // Refresh data for the active tab, and base wallet data
    const refreshPromises = [initializeData()];
    if (activeTab === 'subscriptions') {
      setHasFetchedSubscriptions(false); // Allow refetch
      refreshPromises.push(fetchSubscriptionHistory());
    }
    if (activeTab === 'requests') { // Refresh requests on pull-to-refresh
        setHasFetchedRequests(false); // Allow refetch
        refreshPromises.push(fetchWithdrawalRequests());
    }

    await Promise.all(refreshPromises);

    setRefreshing(false);
  }, [activeTab, initializeData, fetchSubscriptionHistory, fetchWithdrawalRequests]); // Add fetchWithdrawalRequests

  // Function to handle withdrawal request submission
  const handleSubmitWithdrawal = async () => {
    // Basic Validation
    const amount = parseFloat(withdrawalAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Invalid Input', 'Please enter a valid withdrawal amount.');
      return;
    }

    if (amount > (walletData?.balance || 0)) {
      Alert.alert('Invalid Input', 'Withdrawal amount cannot exceed your wallet balance.');
      return;
    }

    let payload = { amount };

    if (withdrawalMethod === 'upi') {
      if (!upiId.trim()) {
        Alert.alert('Invalid Input', 'Please enter your UPI ID.');
        return;
      }
      payload.upiId = upiId.trim();
    } else if (withdrawalMethod === 'bank') {
      if (!bankAccountNumber.trim() || !bankIfscCode.trim()) {
        Alert.alert('Invalid Input', 'Please enter both Bank Account Number and IFSC Code.');
        return;
      }
      payload.bankAccountNumber = bankAccountNumber.trim();
      payload.bankIfscCode = bankIfscCode.trim().toUpperCase();
    }

    setWithdrawalLoading(true);
    try {
      const response = await fetch('  https://backendforheartlink.in/api/v1/wallet/request-reward  ', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok && data.statusCode === 201) {
        Alert.alert('Success', 'Your withdrawal request has been submitted successfully.');
        setIsWithdrawModalVisible(false);
        // Reset form
        setWithdrawalAmount('');
        setUpiId('');
        setBankAccountNumber('');
        setBankIfscCode('');
        // Refresh wallet data and requests to reflect the change
        initializeData();
        // Refresh requests list if user is on that tab or will navigate there
        if (activeTab === 'requests') {
            fetchWithdrawalRequests();
        } else {
            // Optionally, clear the requests cache so it fetches fresh data on next visit
            setWithdrawalRequests([]); 
        }
      } else {
        throw new Error(data.message || 'Failed to submit withdrawal request.');
      }
    } catch (err) {
      console.error('Withdrawal Error:', err);
      Alert.alert('Error', err.message || 'An error occurred while submitting your request. Please try again.');
    } finally {
      setWithdrawalLoading(false);
    }
  };

  const handleWithdraw = () => {
    if (walletData?.balance > 0) {
      setIsWithdrawModalVisible(true);
    } else {
      Alert.alert(
        'Insufficient Balance',
        'You need a minimum balance to withdraw funds.',
        [{ text: 'OK' }]
      );
    }
  };

  const getTransactionIcon = (source, type) => {
    switch (source) {
      case 'post_reward': case 'reel_reward': return icons.star;
      case 'recharge': return icons.plus;
      case 'withdrawal': return icons.minus;
      case 'bonus': return icons.gift;
      case 'referral': return icons.users;
      default: return type === 'credit' ? icons.plus : icons.minus;
    }
  };

  const getSubscriptionIcon = (status) => {
    switch (status) {
      case 'completed': return icons.check;
      case 'pending': return icons.clock;
      case 'failed': return icons.close;
      default: return icons.subscription;
    }
  };

  // ✅ NEW: Get icon for withdrawal request status
  const getRequestStatusIcon = (status) => {
    switch (status.toLowerCase()) {
      case 'pending': return icons.clock;
      case 'approved': return icons.check;
      case 'paid': return icons.check; // Or a different "paid" icon if available
      case 'rejected': return icons.close;
      default: return icons.default; // Fallback icon
    }
  };

  const getSubscriptionStatusColor = (status) => {
    switch (status) {
      case 'completed': return '#4CAF50';
      case 'pending': return '#FF9800';
      case 'failed': return '#f44336';
      default: return '#999';
    }
  };

  // ✅ NEW: Get color for withdrawal request status
  const getRequestStatusColor = (status) => {
    switch (status.toLowerCase()) {
      case 'pending': return '#FF9800'; // Orange
      case 'approved': return '#2196F3'; // Blue
      case 'paid': return '#4CAF50';    // Green
      case 'rejected': return '#f44336'; // Red
      default: return '#999';            // Gray
    }
  };

  const formatAmount = (amount, type) => {
    const sign = type === 'credit' ? '+' : '-';
    return `${sign}₹${amount.toFixed(2)}`;
  };

  const formatSubscriptionAmount = (amount) => {
    return `-₹${amount.toFixed(2)}`;
  };

  // ✅ NEW: Format amount for requests (always negative as it's a withdrawal)
  const formatRequestAmount = (amount) => {
    return `-₹${amount.toFixed(2)}`;
  };


  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown Date';
    const date = new Date(dateString);
    const now = new Date();
    if (date.toDateString() === now.toDateString()) return 'Today';
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString('en-IN', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  };

  const formatTime = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const groupItemsByDate = (items, isSubscription = false, isRequest = false) => { // Add isRequest parameter
    const filtered = items.filter(item => {
      if (searchQuery) {
         let searchText = '';
         if (isRequest) {
             // Search by amount or status for requests
             searchText = `${item.amount} ${item.status}`.toLowerCase();
         } else if (isSubscription) {
            searchText = (item.planInfo?.name || '').toLowerCase();
         } else {
            searchText = (item.description || '').toLowerCase();
         }
         return searchText.includes(searchQuery.toLowerCase());
      }
      return true;
    });

    return filtered.reduce((acc, item) => {
      const dateKey = formatDate(item.createdAt);
      if (!acc[dateKey]) {
        acc[dateKey] = [];
      }
      acc[dateKey].push(item);
      return acc;
    }, {});
  };

  const handleTabSwitch = (tab) => {
    setActiveTab(tab);
    setSearchQuery('');
    setError(null);
    
    // Reset fetch flags when switching tabs to allow re-fetching
    if (tab === 'subscriptions') {
      setHasFetchedSubscriptions(false);
    } else if (tab === 'requests') {
      setHasFetchedRequests(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#ed167e" />
        <Text style={styles.loadingText}>Loading wallet...</Text>
      </SafeAreaView>
    );
  }

  // Determine current data and grouped data based on active tab
  let currentData, groupedData;
  if (activeTab === 'rewards') {
      currentData = transactions;
      groupedData = groupItemsByDate(currentData, false, false); // Not subscription, not request
  } else if (activeTab === 'subscriptions') {
      currentData = subscriptionHistory;
      groupedData = groupItemsByDate(currentData, true, false); // Is subscription, not request
  } else { // activeTab === 'requests'
      currentData = withdrawalRequests;
      groupedData = groupItemsByDate(currentData, false, true); // Not subscription, is request
  }


  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Wallet</Text>
        <View style={styles.headerSpacer} />
      </View>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ed167e" />
        }
      >
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Main balance</Text>
          <Text style={styles.balanceAmount}>
            ₹{walletData?.balance?.toFixed(2) || '0.00'}
          </Text>
          <TouchableOpacity style={styles.withdrawButton} onPress={handleWithdraw}>
            <Text style={styles.withdrawButtonText}>Withdraw</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Total Earned</Text>
            <Text style={styles.statAmount}>₹{walletData?.totalEarned?.toFixed(2) || '0.00'}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>This Month</Text>
            <Text style={styles.statAmount}>₹{walletData?.thisMonthEarnings?.toFixed(2) || '0.00'}</Text>
          </View>
        </View>

        <View style={styles.historySection}>
          <Text style={styles.sectionTitle}>History</Text>
          {/* Updated Tab Container with 3 tabs */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'rewards' && styles.activeTab]}
              onPress={() => handleTabSwitch('rewards')}
            >
              <Text style={[styles.tabText, activeTab === 'rewards' && styles.activeTabText]}>
                Post Rewards
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'subscriptions' && styles.activeTab]}
              onPress={() => handleTabSwitch('subscriptions')}
            >
              <Text style={[styles.tabText, activeTab === 'subscriptions' && styles.activeTabText]}>
                Subscriptions
              </Text>
            </TouchableOpacity>
            {/* New Withdraw Requests Tab */}
            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'requests' && styles.activeTab]} // Updated active state
              onPress={() => handleTabSwitch('requests')} // Handle switch to 'requests'
            >
              <Text style={[styles.tabText, activeTab === 'requests' && styles.activeTabText]}> {/* Updated active text style */}
                Requests
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.searchContainer}>
            <Image source={icons.search} style={styles.searchIcon} />
            {/* Updated placeholder based on active tab */}
            <TextInput
              style={styles.searchInput}
              placeholder={
                activeTab === 'rewards' ? "Search transactions..." :
                activeTab === 'subscriptions' ? "Search subscriptions..." :
                "Search requests..." // Placeholder for requests tab
              }
              placeholderTextColor="#666"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          {/* Conditional rendering based on active tab and loading states */}
          {activeTab === 'subscriptions' && subscriptionLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#ed167e" />
            </View>
          ) : activeTab === 'requests' && requestsLoading ? ( // Loading state for requests tab
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#ed167e" />
            </View>
          ) : Object.keys(groupedData).length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>
                {error ? error :
                  activeTab === 'rewards' ? "No transactions found." :
                  activeTab === 'subscriptions' ? "No subscription history found." :
                  "No withdrawal requests found." // Message for requests tab
                }
              </Text>
              {error && (
                <TouchableOpacity
                  style={styles.retryButton}
                  // ✅ FIXED: Pass a function reference, don't call it directly
                  onPress={
                    activeTab === 'subscriptions' ? fetchSubscriptionHistory :
                    activeTab === 'requests' ? fetchWithdrawalRequests : // Retry for requests
                    initializeData // Default retry for rewards if needed
                  }
                >
                  <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            // The rendering logic below will now work correctly for all tabs
            Object.entries(groupedData).map(([date, dayItems]) => (
              <View key={date} style={styles.dateGroup}>
                <Text style={styles.dateHeader}>{date}</Text>
                {dayItems.map((item) => (
                  <View key={item._id} style={styles.transactionItem}>
                    <View style={styles.transactionLeft}>
                      <View style={styles.transactionIcon}>
                        {/* Updated icon rendering based on active tab */}
                        {activeTab === 'rewards' ? (
                          <Image source={getTransactionIcon(item.source, item.type) || icons.default} style={[styles.iconImage, { tintColor: item.type === 'credit' ? '#4CAF50' : '#f44336' }]} />
                        ) : activeTab === 'subscriptions' ? (
                          <Image source={getSubscriptionIcon(item.status) || icons.default} style={[styles.iconImage, { tintColor: getSubscriptionStatusColor(item.status) }]} />
                        ) : ( // Icon for requests tab
                          <Image source={getRequestStatusIcon(item.status) || icons.default} style={[styles.iconImage, { tintColor: getRequestStatusColor(item.status) }]} />
                        )}
                      </View>
                      <View style={styles.transactionDetails}>
                        {/* Updated description rendering based on active tab */}
                        <Text style={styles.transactionDescription} numberOfLines={1}>
                          {activeTab === 'rewards'
                            ? item.description
                            : activeTab === 'subscriptions'
                            ? item.planInfo?.name || 'Subscription'
                            : `Withdrawal Request` // Description for requests
                          }
                        </Text>
                        <View style={styles.detailsRow}>
                          <Text style={styles.transactionTime}>
                            {formatTime(item.createdAt)}
                          </Text>
                          {/* Updated status rendering based on active tab */}
                          {activeTab === 'subscriptions' && (
                            <Text style={[styles.subscriptionStatus, { color: getSubscriptionStatusColor(item.status) }]}>
                              • {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                            </Text>
                          )}
                          {activeTab === 'requests' && ( // Status for requests tab
                            <Text style={[styles.subscriptionStatus, { color: getRequestStatusColor(item.status) }]}>
                              • {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                            </Text>
                          )}
                        </View>
                      </View>
                    </View>
                    {/* Updated amount rendering and color based on active tab */}
                    <Text style={[
                      styles.transactionAmount,
                      { color:
                        activeTab === 'rewards'
                          ? (item.type === 'credit' ? '#4CAF50' : '#f44336')
                          : activeTab === 'subscriptions'
                          ? '#f44336'
                          : getRequestStatusColor(item.status) // Color based on request status
                      }
                    ]}>
                      {activeTab === 'rewards'
                        ? formatAmount(item.amount, item.type)
                        : activeTab === 'subscriptions'
                        ? formatSubscriptionAmount(item.amount)
                        : formatRequestAmount(item.amount) // Amount for requests
                      }
                    </Text>
                  </View>
                ))}
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Withdrawal Request Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isWithdrawModalVisible}
        onRequestClose={() => setIsWithdrawModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Withdraw Funds</Text>

            {/* Amount Input */}
            <Text style={styles.inputLabel}>Amount (₹)</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter amount"
              placeholderTextColor="#888"
              keyboardType="numeric"
              value={withdrawalAmount}
              onChangeText={setWithdrawalAmount}
            />
            <Text style={styles.balanceText}>Available Balance: ₹{walletData?.balance?.toFixed(2) || '0.00'}</Text>

            {/* Method Selection */}
            <Text style={styles.inputLabel}>Withdrawal Method</Text>
            <View style={styles.methodContainer}>
              <TouchableOpacity
                style={[styles.methodButton, withdrawalMethod === 'upi' && styles.selectedMethod]}
                onPress={() => setWithdrawalMethod('upi')}
              >
                <Text style={[styles.methodText, withdrawalMethod === 'upi' && styles.selectedMethodText]}>UPI</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.methodButton, withdrawalMethod === 'bank' && styles.selectedMethod]}
                onPress={() => setWithdrawalMethod('bank')}
              >
                <Text style={[styles.methodText, withdrawalMethod === 'bank' && styles.selectedMethodText]}>Bank Transfer</Text>
              </TouchableOpacity>
            </View>

            {/* UPI Input */}
            {withdrawalMethod === 'upi' && (
              <>
                <Text style={styles.inputLabel}>UPI ID</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., user@upi"
                  placeholderTextColor="#888"
                  value={upiId}
                  onChangeText={setUpiId}
                />
              </>
            )}

            {/* Bank Details Inputs */}
            {withdrawalMethod === 'bank' && (
              <>
                <Text style={styles.inputLabel}>Bank Account Number</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter account number"
                  placeholderTextColor="#888"
                  value={bankAccountNumber}
                  onChangeText={setBankAccountNumber}
                  keyboardType="numeric"
                />
                <Text style={styles.inputLabel}>IFSC Code</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter IFSC code"
                  placeholderTextColor="#888"
                  value={bankIfscCode}
                  onChangeText={setBankIfscCode}
                  autoCapitalize="characters"
                />
              </>
            )}

            {/* Action Buttons */}
            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setIsWithdrawModalVisible(false)}
                disabled={withdrawalLoading}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalButton, styles.submitButton]}
                onPress={handleSubmitWithdrawal}
                disabled={withdrawalLoading}
              >
                {withdrawalLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.submitButtonText}>Submit Request</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  center: { justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#2e2e2e' },
  backButton: { padding: 8 },
  backButtonText: { color: '#ed167e', fontSize: 24, fontWeight: '600' },
  headerTitle: { color: 'white', fontSize: 20, fontWeight: '700' },
  headerSpacer: { width: 40 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 40 },
  balanceCard: { backgroundColor: '#ed167e', borderRadius: 16, padding: 24, marginVertical: 20, alignItems: 'center' },
  balanceLabel: { color: 'white', fontSize: 16, fontWeight: '500', marginBottom: 8 },
  balanceAmount: { color: 'white', fontSize: 36, fontWeight: '700', marginBottom: 20 },
  withdrawButton: { backgroundColor: 'rgba(255, 255, 255, 0.2)', paddingHorizontal: 32, paddingVertical: 12, borderRadius: 25, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.3)' },
  withdrawButtonText: { color: 'white', fontSize: 16, fontWeight: '600' },
  statsContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  statCard: { backgroundColor: '#1a1a1a', borderRadius: 12, padding: 16, flex: 0.48, alignItems: 'center' },
  statLabel: { color: '#999', fontSize: 14, marginBottom: 8 },
  statAmount: { color: 'white', fontSize: 18, fontWeight: '600' },
  historySection: { flex: 1 },
  sectionTitle: { color: 'white', fontSize: 20, fontWeight: '700', marginBottom: 16 },
  tabContainer: { flexDirection: 'row', backgroundColor: '#1a1a1a', borderRadius: 12, padding: 4, marginBottom: 16 },
  tabButton: { flex: 1, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8, alignItems: 'center' },
  activeTab: { backgroundColor: '#ed167e' },
  tabText: { color: '#999', fontSize: 14, fontWeight: '600' }, // Adjusted font size
  activeTabText: { color: 'white' },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a1a', borderRadius: 12, paddingHorizontal: 16, height: 48, marginBottom: 20 },
  searchIcon: { width: 20, height: 20, tintColor: '#666', marginRight: 12 },
  searchInput: { flex: 1, color: 'white', fontSize: 16 },
  loadingContainer: { alignItems: 'center', paddingVertical: 20 },
  dateGroup: { marginBottom: 20 },
  dateHeader: { color: '#999', fontSize: 16, fontWeight: '600', marginBottom: 12 },
  transactionItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#2e2e2e' },
  transactionLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 },
  transactionIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#2e2e2e', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  iconImage: { width: 20, height: 20 },
  transactionDetails: { flex: 1 },
  transactionDescription: { color: 'white', fontSize: 16, fontWeight: '500', marginBottom: 4 },
  detailsRow: { flexDirection: 'row', alignItems: 'center' },
  transactionTime: { color: '#666', fontSize: 14 },
  subscriptionStatus: { fontSize: 14, fontWeight: '500', marginLeft: 8 }, // Adjusted margin
  transactionAmount: { fontSize: 16, fontWeight: '600' },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyStateText: { color: '#666', fontSize: 16, marginBottom: 16, textAlign: 'center' },
  retryButton: { backgroundColor: '#ed167e', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  retryButtonText: { color: 'white', fontSize: 14, fontWeight: '600' },
  loadingText: { color: '#999', fontSize: 16, marginTop: 16 },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxHeight: '80%',
  },
  modalTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 20,
    textAlign: 'center',
  },
  inputLabel: {
    color: '#ccc',
    fontSize: 14,
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: '#2e2e2e',
    borderRadius: 12,
    padding: 15,
    color: 'white',
    fontSize: 16,
  },
  balanceText: {
    color: '#999',
    fontSize: 14,
    marginTop: 5,
    textAlign: 'right',
  },
  methodContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  methodButton: {
    flex: 0.48,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#444',
    alignItems: 'center',
  },
  selectedMethod: {
    backgroundColor: '#ed167e',
    borderColor: '#ed167e',
  },
  methodText: {
    color: '#999',
    fontSize: 14,
    fontWeight: '600',
  },
  selectedMethodText: {
    color: 'white',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 25,
  },
  modalButton: {
    flex: 0.48,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#2e2e2e',
    borderWidth: 1,
    borderColor: '#444',
  },
  cancelButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#ed167e',
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default WalletScreen;