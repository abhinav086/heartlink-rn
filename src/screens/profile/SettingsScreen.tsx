import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Alert, 
  Image,
  ActivityIndicator,
  SafeAreaView,
  ScrollView 
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { icons } from '../../constants';
import BASE_URL from '../../config/config';

const SettingsScreen = () => {
  const navigation = useNavigation();
  const { user, token } = useAuth();
  const [subscriptionData, setSubscriptionData] = useState(null);
  const [loadingSubscription, setLoadingSubscription] = useState(true);

  // Fetch subscription status on component mount
  useEffect(() => {
    fetchSubscriptionStatus();
  }, []);

  const fetchSubscriptionStatus = async () => {
    if (!token) {
      console.warn('No token available for subscription status fetch');
      setLoadingSubscription(false);
      return;
    }

    try {
      setLoadingSubscription(true);
      const response = await fetch(`${BASE_URL}/api/v1/subscription/status`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Subscription Data:', data.data.subscription); // Debug log
        setSubscriptionData(data.data.subscription);
      } else {
        console.error('Failed to fetch subscription status:', response.status);
        Alert.alert('Error', 'Failed to fetch subscription status. Please try again.');
      }
    } catch (error) {
      console.error('Error fetching subscription status:', error.message);
      Alert.alert('Error', 'Network error while fetching subscription status.');
    } finally {
      setLoadingSubscription(false);
    }
  };

  const handleEditProfile = () => {
    navigation.navigate('EditProfile');
  };

  const handleWallet = () => {
    navigation.navigate('WalletScreen');
  };

  const handleSubscription = () => {
    navigation.navigate('SubscriptionScreen');
  };

  const handlePrivacySettings = () => {
    Alert.alert('Coming Soon', 'Privacy Settings feature will be available soon!');
  };

  const handleNotifications = () => {
    Alert.alert('Coming Soon', 'Notifications feature will be available soon!');
  };

  const handleAbout = () => {
    navigation.navigate('AboutScreen');
  };

  const handleSupport = () => {
    Alert.alert('Support', 'Need help? Contact us at support@heartlink.com');
  };

  // Get user profile picture from auth state
  const getUserProfilePicture = () => {
    if (!user) return null;
    return user.profilePic || user.photoUrl || user.avatar || user.photo || null;
  };

  const formatDate = (dateString) => {
    try {
      return dateString ? new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      }) : 'N/A';
    } catch (error) {
      return 'Invalid Date';
    }
  };

  const getStatusColor = (subscription) => {
    if (subscription?.currentPlan === 'free') return '#666'; // Gray for free
    if (!subscription?.isActive) return '#ff4757'; // Red for inactive
    if (subscription?.isExpired) return '#ff4757'; // Red for expired
    if (subscription?.daysRemaining <= 7) return '#ffa502'; // Orange for expiring soon
    return '#2ed573'; // Green for active
  };

  const getStatusText = (subscription) => {
    if (subscription?.currentPlan === 'free') return 'Free';
    if (!subscription?.isActive) return 'Inactive';
    if (subscription?.isExpired) return 'Expired';
    if (subscription?.daysRemaining <= 7) return 'Expiring Soon';
    return 'Active';
  };

  const profilePicture = getUserProfilePicture();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {/* Header with Back Button */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
              <Text style={styles.backButtonText}>←</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Settings</Text>
            <View style={styles.headerSpacer} />
          </View>
          
          {/* User Info Section */}
          {user && (
            <View style={styles.userSection}>
              <View style={styles.userAvatar}>
                {profilePicture ? (
                  <Image 
                    source={{ uri: profilePicture }} 
                    style={styles.userAvatarImage}
                    onError={() => console.log('Profile image failed to load')}
                  />
                ) : (
                  <Text style={styles.userAvatarText}>
                    {user.fullName?.charAt(0)?.toUpperCase() || 'U'}
                  </Text>
                )}
              </View>
              <View style={styles.userInfo}>
                <Text style={styles.userName}>{user.fullName || 'User'}</Text>
                <Text style={styles.userEmail}>{user.email || 'No email'}</Text>
              </View>
            </View>
          )}

          {/* Subscription Status Section */}
          <View style={styles.subscriptionSection}>
            <Text style={styles.sectionTitle}>Subscription Status</Text>
            {loadingSubscription ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#ed167e" />
                <Text style={styles.loadingText}>Loading subscription...</Text>
              </View>
            ) : subscriptionData ? (
              <View style={styles.subscriptionCard}>
                <View style={styles.subscriptionHeader}>
                  <View>
                    <Text style={styles.planName}>
                      {subscriptionData.planDetails?.name || subscriptionData.currentPlan || 'Unknown Plan'}
                    </Text>
                    <Text style={styles.planPrice}>
                      ₹{subscriptionData.planDetails?.amount || 0}/month
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(subscriptionData) }]}>
                    <Text style={styles.statusText}>{getStatusText(subscriptionData)}</Text>
                  </View>
                </View>
                
                {subscriptionData.currentPlan !== 'free' && (
                  <View style={styles.subscriptionDetails}>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Expires:</Text>
                      <Text style={styles.detailValue}>{formatDate(subscriptionData.expiresAt)}</Text>
                    </View>
                    {/* <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Days Remaining:</Text>
                      <Text style={[styles.detailValue, { color: getStatusColor(subscriptionData) }]}>
                        {subscriptionData.daysRemaining || 0} days
                      </Text>
                    </View> */}
                    {/* <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Auto Renew:</Text>
                      <Text style={styles.detailValue}>
                        {subscriptionData.autoRenew ? 'On' : 'Off'}
                      </Text>
                    </View> */}
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.noSubscriptionCard}>
                <Text style={styles.noSubscriptionText}>No active subscription</Text>
                <TouchableOpacity style={styles.subscribeButton} onPress={handleSubscription}>
                  <Text style={styles.subscribeButtonText}>Subscribe Now</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Settings Options */}
          <View style={styles.optionsContainer}>
            <TouchableOpacity style={styles.option} onPress={handleEditProfile}>
              <View style={styles.optionRow}>
                <Image source={icons.user} style={styles.optionIcon} />
                <Text style={styles.optionText}>Edit Profile</Text>
                <Image source={icons.rightArrow} style={styles.arrowIcon} />
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.option} onPress={handleWallet}>
              <View style={styles.optionRow}>
                <Image source={icons.wallet || icons.creditCard} style={styles.optionIcon} />
                <Text style={styles.optionText}>Wallet</Text>
                <Image source={icons.rightArrow} style={styles.arrowIcon} />
              </View>
            </TouchableOpacity>

            {/* <TouchableOpacity style={styles.option} onPress={handleSubscription}>
              <View style={styles.optionRow}>
                <Image source={icons.subscription || icons.star} style={styles.optionIcon} />
                <Text style={styles.optionText}>Subscription</Text>
                <Image source={icons.rightArrow} style={styles.arrowIcon} />
              </View>
            </TouchableOpacity> */}

            <TouchableOpacity style={styles.option} onPress={handlePrivacySettings}>
              <View style={styles.optionRow}>
                <Image source={icons.lock} style={styles.optionIcon} />
                <Text style={styles.optionText}>Privacy Settings</Text>
                <Image source={icons.rightArrow} style={styles.arrowIcon} />
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.option} onPress={handleNotifications}>
              <View style={styles.optionRow}>
                <Image source={icons.notification} style={styles.optionIcon} />
                <Text style={styles.optionText}>Notifications</Text>
                <Image source={icons.rightArrow} style={styles.arrowIcon} />
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.option} onPress={handleSupport}>
              <View style={styles.optionRow}>
                <Image source={icons.help} style={styles.optionIcon} />
                <Text style={styles.optionText}>Help & Support</Text>
                <Image source={icons.rightArrow} style={styles.arrowIcon} />
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.option, styles.lastOption]} onPress={handleAbout}>
              <View style={styles.optionRow}>
                <Image source={icons.info} style={styles.optionIcon} />
                <Text style={styles.optionText}>About</Text>
                <Image source={icons.rightArrow} style={styles.arrowIcon} />
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    color: '#ed167e',
    fontSize: 24,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
  },
  headerSpacer: {
    width: 40,
  },
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
  },
  userAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#ed167e',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    overflow: 'hidden',
  },
  userAvatarImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  userAvatarText: {
    color: 'white',
    fontSize: 24,
    fontWeight: '700',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: '#999',
  },
  subscriptionSection: {
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    padding: 20,
    borderRadius: 12,
  },
  loadingText: {
    color: '#999',
    marginLeft: 10,
    fontSize: 14,
  },
  subscriptionCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 20,
  },
  subscriptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  planName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  planPrice: {
    fontSize: 14,
    color: '#ed167e',
    fontWeight: '500',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  subscriptionDetails: {
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: '#999',
  },
  detailValue: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
  },
  noSubscriptionCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  noSubscriptionText: {
    color: '#999',
    fontSize: 16,
    marginBottom: 16,
  },
  subscribeButton: {
    backgroundColor: '#ed167e',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  subscribeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  optionsContainer: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    overflow: 'hidden',
  },
  option: {
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#2e2e2e',
  },
  lastOption: {
    borderBottomWidth: 0,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  optionIcon: {
    width: 24,
    height: 24,
    tintColor: '#999',
    marginRight: 16,
  },
  optionText: {
    fontSize: 16,
    color: '#fff',
    flex: 1,
    fontWeight: '500',
  },
  arrowIcon: {
    width: 16,
    height: 16,
    tintColor: '#666',
  },
});

export default SettingsScreen;