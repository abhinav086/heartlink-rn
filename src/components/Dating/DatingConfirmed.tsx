import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView,
  Image,
  Animated,
  Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from 'react-native-linear-gradient';

const DateConfirmedScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { requestId, request } = route.params;

  const [scaleValue] = useState(new Animated.Value(0));
  const [fadeValue] = useState(new Animated.Value(0));

  useEffect(() => {
    // Celebration animation
    Animated.sequence([
      Animated.spring(scaleValue, {
        toValue: 1,
        useNativeDriver: true,
        tension: 80,
        friction: 8,
      }),
      Animated.timing(fadeValue, {
        toValue: 1,
        duration: 500,
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
    switch (dateType?.toLowerCase()) {
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

  const handleGoHome = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'Home' }],
    });
  };

  const handleViewRequest = () => {
    navigation.navigate('DateRequestStatus', { 
      requestId, 
      request 
    });
  };

  const getDatePreparationTips = (dateType) => {
    const tips = {
      coffee: [
        "Choose a cozy coffee shop",
        "Arrive 5-10 minutes early",
        "Bring conversation topics",
        "Dress casually but neat"
      ],
      movie: [
        "Book seats in advance",
        "Arrive 15 minutes early",
        "Choose snacks to share",
        "Plan post-movie activity"
      ],
      dinner: [
        "Make restaurant reservation",
        "Dress appropriately",
        "Plan interesting conversation",
        "Offer to share the bill"
      ],
      shopping: [
        "Research good shopping areas",
        "Wear comfortable shoes",
        "Bring sufficient budget",
        "Plan lunch/coffee breaks"
      ],
      default: [
        "Be punctual and courteous",
        "Dress appropriately",
        "Bring positive energy",
        "Plan backup conversation topics"
      ]
    };

    return tips[dateType?.toLowerCase()] || tips.default;
  };

  const tips = getDatePreparationTips(request.dateType);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0a" />
      
      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* Success Header */}
        <View style={styles.successHeader}>
          <Animated.View 
            style={[
              styles.successIconContainer,
              { transform: [{ scale: scaleValue }] }
            ]}
          >
            <LinearGradient
              colors={['#4CAF50', '#45a049']}
              style={styles.successIconGradient}
            >
              <Icon name="check" size={60} color="#fff" />
            </LinearGradient>
          </Animated.View>
          
          <Animated.View style={{ opacity: fadeValue }}>
            <Text style={styles.successTitle}>Date Confirmed! 🎉</Text>
            <Text style={styles.successSubtitle}>
              Payment successful • Your date is locked in
            </Text>
          </Animated.View>
        </View>

        {/* Date Summary Card */}
        <View style={styles.summaryCard}>
          <LinearGradient
            colors={['#ed167e', '#FF69B4']}
            style={styles.summaryGradient}
          >
            <View style={styles.summaryHeader}>
              <Icon name={getDateIcon(request.dateType)} size={40} color="#fff" />
              <View style={styles.summaryInfo}>
                <Text style={styles.summaryTitle}>{request.dateTypeDisplay}</Text>
                <Text style={styles.summaryBudget}>{request.formattedBudget}</Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* Date Details */}
        <View style={styles.detailsCard}>
          <Text style={styles.sectionTitle}>Your Date Details</Text>
          
          <View style={styles.detailItem}>
            <View style={styles.detailIconContainer}>
              <Icon name="person" size={24} color="#ed167e" />
            </View>
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>With</Text>
              <Text style={styles.detailValue}>{request.recipient?.fullName}</Text>
            </View>
          </View>

          <View style={styles.detailItem}>
            <View style={styles.detailIconContainer}>
              <Icon name="calendar-today" size={24} color="#ed167e" />
            </View>
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Date & Time</Text>
              <Text style={styles.detailValue}>{formatDate(request.preferredDate)}</Text>
            </View>
          </View>

          <View style={styles.detailItem}>
            <View style={styles.detailIconContainer}>
              <Icon name="location-on" size={24} color="#ed167e" />
            </View>
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Location</Text>
              <Text style={styles.detailValue}>
                {request.location?.city}
                {request.location?.area && `, ${request.location.area}`}
                {request.location?.landmark && `\n📍 ${request.location.landmark}`}
              </Text>
            </View>
          </View>

          <View style={styles.detailItem}>
            <View style={styles.detailIconContainer}>
              <Icon name="attach-money" size={24} color="#4CAF50" />
            </View>
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Budget Paid</Text>
              <Text style={[styles.detailValue, styles.paidAmount]}>{request.formattedBudget}</Text>
            </View>
          </View>
        </View>

        {/* Preparation Tips */}
        <View style={styles.tipsCard}>
          <Text style={styles.sectionTitle}>💡 Date Preparation Tips</Text>
          {tips.map((tip, index) => (
            <View key={index} style={styles.tipItem}>
              <View style={styles.tipBullet} />
              <Text style={styles.tipText}>{tip}</Text>
            </View>
          ))}
        </View>

        {/* Important Note */}
        <View style={styles.noteCard}>
          <Icon name="info" size={24} color="#FFA500" />
          <View style={styles.noteContent}>
            <Text style={styles.noteTitle}>Important Reminder</Text>
            <Text style={styles.noteText}>
              After your date, both of you need to confirm completion in the app for the payment to be processed to your date partner.
            </Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.secondaryButton} onPress={handleViewRequest}>
            <Icon name="visibility" size={20} color="#ed167e" />
            <Text style={styles.secondaryButtonText}>View Request Details</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.primaryButton} onPress={handleGoHome}>
            <LinearGradient
              colors={['#ed167e', '#FF69B4']}
              style={styles.primaryButtonGradient}
            >
              <Icon name="home" size={20} color="#fff" />
              <Text style={styles.primaryButtonText}>Back to Home</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Contact Support */}
        <TouchableOpacity style={styles.supportButton}>
          <Icon name="support-agent" size={20} color="#999" />
          <Text style={styles.supportText}>Need help? Contact Support</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  scrollContainer: {
    flex: 1,
  },
  successHeader: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
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
    marginBottom: 8,
  },
  successSubtitle: {
    fontSize: 16,
    color: '#4CAF50',
    textAlign: 'center',
  },
  summaryCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 16,
    overflow: 'hidden',
  },
  summaryGradient: {
    padding: 20,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryInfo: {
    marginLeft: 15,
    flex: 1,
  },
  summaryTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 5,
  },
  summaryBudget: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  detailsCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 20,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  detailIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2e2e2e',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 14,
    color: '#999',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '500',
  },
  paidAmount: {
    color: '#4CAF50',
    fontWeight: '700',
  },
  tipsCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 20,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  tipBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ed167e',
    marginTop: 8,
    marginRight: 12,
  },
  tipText: {
    fontSize: 15,
    color: '#ccc',
    flex: 1,
    lineHeight: 22,
  },
  noteCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 30,
    flexDirection: 'row',
    borderLeftWidth: 4,
    borderLeftColor: '#FFA500',
  },
  noteContent: {
    marginLeft: 15,
    flex: 1,
  },
  noteTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFA500',
    marginBottom: 8,
  },
  noteText: {
    fontSize: 14,
    color: '#ccc',
    lineHeight: 20,
  },
  actionButtons: {
    paddingHorizontal: 20,
    marginBottom: 20,
    gap: 15,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#2e2e2e',
    borderWidth: 1,
    borderColor: '#ed167e',
    gap: 8,
  },
  secondaryButtonText: {
    color: '#ed167e',
    fontSize: 16,
    fontWeight: '600',
  },
  primaryButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  primaryButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  supportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  supportText: {
    color: '#999',
    fontSize: 14,
  },
});

export default DateConfirmedScreen;