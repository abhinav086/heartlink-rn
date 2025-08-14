import React, { useState, useEffect, useCallback } from 'react';
import { 
  SafeAreaView, 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  TouchableOpacity,
  Alert,
  RefreshControl
} from 'react-native';
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import Icon from 'react-native-vector-icons/Ionicons';
// import { useAuth } from '../context/AuthContext'; // Adjust path as needed
// import BASE_URL from '../config/config'; // Adjust path as needed

// Define interfaces for type safety
interface DateStats {
  pending?: number;
  accepted?: number;
  completed?: number;
  total?: number;
}

interface DateStatsResponse {
  success: boolean;
  data: {
    stats: DateStats;
    recentRequests: any[];
    userProfile: any;
  };
}

interface PendingResponse {
  success: boolean;
  data: {
    requests: any[];
    count: number;
  };
}

const OffersScreen = () => {
  const navigation = useNavigation();
  // const { token, user } = useAuth(); // Uncomment when you have auth context
  const [dateStats, setDateStats] = useState<DateStats | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Temporary mock data - replace with real auth context
  const token = null; // Replace with: useAuth()?.token
  const user = null;  // Replace with: useAuth()?.user

  // Fetch dating statistics
  const fetchDateStats = async () => {
    try {
      if (!token) {
        // Mock data for testing - remove when you have real API
        setDateStats({
          pending: 2,
          accepted: 1,
          completed: 5,
          total: 8
        });
        setLoading(false);
        return;
      }

      // Uncomment when you have BASE_URL
      /*
      const response = await fetch(`${BASE_URL}/api/v1/dating/stats`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const result: DateStatsResponse = await response.json();
      
      if (response.ok && result.success) {
        setDateStats(result.data.stats);
        setPendingCount(result.data.stats.pending || 0);
      }
      */
      setLoading(false);
    } catch (error) {
      console.error('Error fetching date stats:', error);
      setLoading(false);
    }
  };

  // Fetch pending requests count specifically
  const fetchPendingCount = async () => {
    try {
      if (!token) {
        // Mock data for testing
        setPendingCount(2);
        return;
      }

      // Uncomment when you have BASE_URL
      /*
      const response = await fetch(`${BASE_URL}/api/v1/dating/pending`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const result: PendingResponse = await response.json();
      
      if (response.ok && result.success) {
        setPendingCount(result.data.count || 0);
      }
      */
    } catch (error) {
      console.error('Error fetching pending count:', error);
    }
  };

  // Refresh data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchDateStats();
      fetchPendingCount();
    }, [token])
  );

  // Pull to refresh functionality
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchDateStats();
    await fetchPendingCount();
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
  const handlePrivateMessagePress = () => {
    if (pendingCount > 0) {
      navigation.navigate('PrivateChat');
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

  const renderBadge = (count: number, type: 'urgent' | 'success' | 'info' = 'info') => {
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
        <TouchableOpacity onPress={onRefresh} style={styles.refreshButton}>
          <Icon name="refresh" size={24} color="#ed167e" />
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Dating Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Icon name="heart" size={20} color="#ed167e" />
            <Text style={styles.sectionTitle}>💕 Dating</Text>
          </View>

          {/* Date Requests Card */}
          <TouchableOpacity
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
              {/* <View style={styles.cardRight}>
                {dateStats && (dateStats.total || 0) > 0 && (
                  renderBadge(dateStats.total || 0, 'info')
                )}
                <Icon name="chevron-forward" size={20} color="#666" />
              </View> */}
            </View>
          </TouchableOpacity>

          {/* Pending Requests Card */}
          <TouchableOpacity
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
              {/* <View style={styles.cardRight}>
                {pendingCount > 0 && renderBadge(pendingCount, 'urgent')}
                <Icon name="chevron-forward" size={20} color="#666" />
              </View> */}
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.card}
            onPress={handlePrivateMessagePress}
          >
            <View style={styles.cardContent}>
              <View style={styles.cardLeft}>
                <Icon name="chatbox-ellipses" size={24} color="#ed167e" />
                <View style={styles.cardText}>
                  <Text style={styles.cardTitle}>Private Messages</Text>
                  <Text style={styles.cardSubtitle}>
                    {pendingCount > 0 ? ` Your pending Heyy's` : 'No pending requests'}
                  </Text>
                </View>
              </View>
              {/* <View style={styles.cardRight}>
                {pendingCount > 0 && renderBadge(pendingCount, 'urgent')}
                <Icon name="chevron-forward" size={20} color="#666" />
              </View> */}
            </View>
          </TouchableOpacity>

        

        </View>

      

     

        {/* Loading State */}
        {loading && (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        )}
      </ScrollView>
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
  premiumCard: {
    borderColor: '#FFD700',
    backgroundColor: '#1a1a1a',
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
  premiumText: {
    color: '#FFD700',
  },
  cardSubtitle: {
    color: '#999',
    fontSize: 14,
    fontFamily: "Montserrat-Regular",
  },
  cardRight: {
    flexDirection: 'row',
    alignItems: 'center',
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
  soonBadge: {
    color: "#ed167e",
    fontSize: 12,
    fontFamily: "Montserrat-Regular",
    fontWeight: "600",
    borderColor: "#ed167e",
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
    marginRight: 8,
  },
  discountBadge: {
    backgroundColor: '#FF6B6B',
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
  },
  newBadge: {
    backgroundColor: '#4CAF50',
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
  },
  statsOverview: {
    flexDirection: 'row',
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 15,
    marginTop: 10,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    color: '#ed167e',
    fontSize: 20,
    fontWeight: 'bold',
    fontFamily: "Montserrat-Regular",
  },
  statLabel: {
    color: '#999',
    fontSize: 12,
    fontFamily: "Montserrat-Regular",
    marginTop: 2,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  loadingText: {
    color: '#999',
    fontSize: 16,
    fontFamily: "Montserrat-Regular",
  },
});

export default OffersScreen;