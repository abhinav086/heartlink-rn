import React, { useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView,
  Animated,
  Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from 'react-native-linear-gradient';

const DateConfirmed = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { requestId, request } = route.params || {};

  const fadeAnim = new Animated.Value(0);
  const scaleAnim = new Animated.Value(0.8);

  useEffect(() => {
    // Animate the success message
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getDateIcon = (dateType) => {
    const type = dateType?.toLowerCase();
    switch (type) {
      case 'coffee': return 'local-cafe';
      case 'movie': return 'movie';
      case 'shopping': return 'shopping-bag';
      case 'dinner': return 'restaurant';
      case 'lunch': return 'lunch-dining';
      case 'park_walk': return 'park';
      case 'beach': return 'beach-access';
      case 'adventure': return 'terrain';
      case 'party': return 'celebration';
      case 'cultural_event': return 'museum';
      case 'sports': return 'sports-tennis';
      default: return 'favorite';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0a" />
      
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Success Animation */}
        <Animated.View 
          style={[
            styles.successContainer,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }]
            }
          ]}
        >
          <View style={styles.successIconContainer}>
            <LinearGradient
              colors={['#4CAF50', '#45a049']}
              style={styles.successIconGradient}
            >
              <Icon name="check" size={60} color="#fff" />
            </LinearGradient>
          </View>
          
          <Text style={styles.successTitle}>Payment Successful!</Text>
          <Text style={styles.successSubtitle}>Your date is confirmed 🎉</Text>
        </Animated.View>

        {/* Date Details Card */}
        {request && (
          <View style={styles.dateCard}>
            <LinearGradient
              colors={['#ed167e', '#FF69B4']}
              style={styles.dateCardGradient}
            >
              <View style={styles.dateHeader}>
                <Icon name={getDateIcon(request.dateType)} size={40} color="#fff" />
                <Text style={styles.dateTitle}>
                  {request.dateTypeDisplay || request.dateType || 'Date'}
                </Text>
              </View>
            </LinearGradient>

            <View style={styles.dateDetails}>
              <View style={styles.detailRow}>
                <Icon name="person" size={20} color="#ed167e" />
                <Text style={styles.detailText}>
                  With {request.recipient?.fullName || 'Someone Special'}
                </Text>
              </View>

              <View style={styles.detailRow}>
                <Icon name="calendar-today" size={20} color="#ed167e" />
                <Text style={styles.detailText}>
                  {formatDate(request.preferredDate)}
                </Text>
              </View>

              <View style={styles.detailRow}>
                <Icon name="location-on" size={20} color="#ed167e" />
                <Text style={styles.detailText}>
                  {request.location?.city}
                  {request.location?.area && `, ${request.location.area}`}
                </Text>
              </View>

              <View style={styles.detailRow}>
                <Icon name="payment" size={20} color="#4CAF50" />
                <Text style={styles.detailText}>
                  Paid: {request.formattedBudget || `₹${request.budget}`}
                </Text>
              </View>

              {/* Show Mobile Number after payment */}
              {request.recipient?.phoneNumber && (
                <View style={styles.phoneNumberContainer}>
                  <Icon name="phone" size={24} color="#4CAF50" />
                  <View style={styles.phoneNumberContent}>
                    <Text style={styles.phoneNumberLabel}>Contact Number:</Text>
                    <Text style={styles.phoneNumber}>
                      {request.recipient.phoneNumber}
                    </Text>
                    <Text style={styles.phoneNumberNote}>
                      You can now contact {request.recipient.fullName} for date planning
                    </Text>
                  </View>
                </View>
              )}
            </View>
          </View>
        )}

        {/* What's Next Section */}
        <View style={styles.nextStepsCard}>
          <Text style={styles.nextStepsTitle}>What's Next?</Text>
          
          <View style={styles.stepItem}>
            <View style={styles.stepIcon}>
              <Icon name="notifications" size={20} color="#ed167e" />
            </View>
            <Text style={styles.stepText}>
              Your date partner has been notified about the confirmed payment
            </Text>
          </View>

          <View style={styles.stepItem}>
            <View style={styles.stepIcon}>
              <Icon name="chat" size={20} color="#ed167e" />
            </View>
            <Text style={styles.stepText}>
              You can now chat and plan your date details
            </Text>
          </View>

          <View style={styles.stepItem}>
            <View style={styles.stepIcon}>
              <Icon name="event" size={20} color="#ed167e" />
            </View>
            <Text style={styles.stepText}>
              Both of you need to confirm completion after the date
            </Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => {
              // Navigate to chat or call the person directly
              // You can customize this based on your chat implementation
              if (request.recipient?.phoneNumber) {
                // Option 1: Navigate to existing chat screen if available
                // navigation.navigate('ChatDetail', { userId: request.recipient._id });
                
                // Option 2: For now, just show an alert with the phone number
                Alert.alert(
                  'Contact Details',
                  `You can call ${request.recipient.fullName} at ${request.recipient.phoneNumber}`,
                  [{ text: 'OK' }]
                );
              }
            }}
          >
            <LinearGradient
              colors={['#ed167e', '#FF69B4']}
              style={styles.buttonGradient}
            >
              <Icon name="phone" size={20} color="#fff" />
              <Text style={styles.primaryButtonText}>Contact Now</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => navigation.navigate('DateRequests')}
          >
            <Text style={styles.secondaryButtonText}>View All Dates</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.tertiaryButton}
            onPress={() => navigation.navigate('HomeScreen')} // Fixed navigation
          >
            <Text style={styles.tertiaryButtonText}>Back to Home</Text>
          </TouchableOpacity>
        </View>

        {/* Support Section */}
        <View style={styles.supportSection}>
          <Text style={styles.supportText}>
            Need help? Contact our support team
          </Text>
          <TouchableOpacity
            style={styles.supportButton}
            onPress={() => {
              // Navigate to support or show contact info
              Alert.alert(
                'Support',
                'For any issues, please contact our support team.',
                [{ text: 'OK' }]
              );
            }}
          >
            <Icon name="help-outline" size={16} color="#4CAF50" />
            <Text style={styles.supportButtonText}>Get Support</Text>
          </TouchableOpacity>
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
  content: {
    padding: 20,
    paddingTop: 40,
  },
  successContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  successIconContainer: {
    marginBottom: 20,
  },
  successIconGradient: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  successTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 10,
  },
  successSubtitle: {
    fontSize: 18,
    color: '#999',
    textAlign: 'center',
  },
  dateCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 30,
  },
  dateCardGradient: {
    padding: 20,
  },
  dateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
  },
  dateTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    flex: 1,
  },
  dateDetails: {
    padding: 20,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  detailText: {
    fontSize: 16,
    color: '#ccc',
    marginLeft: 15,
    flex: 1,
  },
  phoneNumberContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 15,
    marginTop: 15,
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  phoneNumberContent: {
    flex: 1,
    marginLeft: 15,
  },
  phoneNumberLabel: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '600',
    marginBottom: 5,
  },
  phoneNumber: {
    fontSize: 18,
    color: '#fff',
    fontWeight: '700',
    marginBottom: 5,
    letterSpacing: 1,
  },
  phoneNumberNote: {
    fontSize: 12,
    color: '#999',
    lineHeight: 16,
  },
  nextStepsCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 20,
    marginBottom: 30,
  },
  nextStepsTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 20,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 15,
  },
  stepIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2a2a2a',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  stepText: {
    fontSize: 16,
    color: '#ccc',
    flex: 1,
    lineHeight: 22,
  },
  actionButtons: {
    gap: 15,
    marginBottom: 30,
  },
  primaryButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 10,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: '#2a2a2a',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  tertiaryButton: {
    paddingVertical: 15,
    alignItems: 'center',
  },
  tertiaryButtonText: {
    color: '#999',
    fontSize: 16,
  },
  supportSection: {
    alignItems: 'center',
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: '#2a2a2a',
  },
  supportText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
  },
  supportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  supportButtonText: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '500',
  },
});

export default DateConfirmed;