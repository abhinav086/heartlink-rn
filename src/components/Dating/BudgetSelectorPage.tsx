import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Alert,
  TextInput,
  ScrollView,
  Platform,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from 'react-native-linear-gradient';
import Slider from '@react-native-community/slider';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuth } from '../../context/AuthContext';
import BASE_URL from '../../config/config';

interface RouteParams {
  userId: string;
  username: string;
  dateType: string;
  dateTitle: string;
}

const BudgetSelectorPage: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { userId, username, dateType, dateTitle } = route.params as RouteParams;
  const { token, user } = useAuth();

  // Updated to match backend validation (min: 500, max: 200000 but controller limits to 50000)
  const [budget, setBudget] = useState<number>(5000);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<string>('');
  const [preferredDate, setPreferredDate] = useState<Date>(new Date(Date.now() + 24 * 60 * 60 * 1000));
  const [preferredTime, setPreferredTime] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);
  const [showTimePicker, setShowTimePicker] = useState<boolean>(false);
  const [location, setLocation] = useState({
    city: '',
    area: '',
    landmark: ''
  });

  // Updated to match backend validation
  const minBudget = 500;  // Changed from 1000 to 500
  const maxBudget = 50000; // Matches controller validation

  // Initialize preferred time to a reasonable default (6 PM)
  useEffect(() => {
    const defaultTime = new Date();
    defaultTime.setHours(18, 0, 0, 0); // 6:00 PM
    setPreferredTime(defaultTime);
  }, []);

  const formatCurrency = (amount: number): string => {
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  const getBudgetDescription = (amount: number): string => {
    if (amount <= 2000) return 'Budget-friendly experience';
    if (amount <= 10000) return 'Comfortable experience';
    if (amount <= 25000) return 'Premium experience';
    return 'Luxury experience';
  };

  const getBudgetEmoji = (amount: number): string => {
    if (amount <= 2000) return '💰';
    if (amount <= 10000) return '✨';
    if (amount <= 25000) return '👑';
    return '💎';
  };

  const formatTime = (time: Date): string => {
    return time.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatDateTime = (date: Date, time: Date): string => {
    const combinedDateTime = new Date(date);
    combinedDateTime.setHours(time.getHours(), time.getMinutes(), 0, 0);
    return combinedDateTime.toISOString();
  };

  // Updated predefined budgets to match backend validation
  const predefinedBudgets = [
    { amount: 1000, label: '₹1k' },
    { amount: 3000, label: '₹3k' },
    { amount: 5000, label: '₹5k' },
    { amount: 10000, label: '₹10k' },
    { amount: 20000, label: '₹20k' },
    { amount: 50000, label: '₹50k' },
  ];

  // Quick time selections
  const quickTimeOptions = [
    { time: '10:00', label: '10:00 AM', hours: 10, minutes: 0 },
    { time: '12:00', label: '12:00 PM', hours: 12, minutes: 0 },
    { time: '14:00', label: '2:00 PM', hours: 14, minutes: 0 },
    { time: '16:00', label: '4:00 PM', hours: 16, minutes: 0 },
    { time: '18:00', label: '6:00 PM', hours: 18, minutes: 0 },
    { time: '20:00', label: '8:00 PM', hours: 20, minutes: 0 },
  ];

  const handleGoBack = () => {
    navigation.goBack();
  };

  const handleBudgetSelect = (selectedBudget: number) => {
    setBudget(selectedBudget);
  };

  const handleQuickTimeSelect = (hours: number, minutes: number) => {
    const newTime = new Date();
    newTime.setHours(hours, minutes, 0, 0);
    setPreferredTime(newTime);
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setPreferredDate(selectedDate);
    }
  };

  const onTimeChange = (event: any, selectedTime?: Date) => {
    setShowTimePicker(false);
    if (selectedTime) {
      setPreferredTime(selectedTime);
    }
  };

  const createDateRequest = async (requestData: any) => {
    try {
      console.log('🔄 Creating date request...');
      console.log('Request data:', JSON.stringify(requestData, null, 2));
      console.log('Using token:', token ? 'Token available' : 'No token');
      console.log('API URL:', `${BASE_URL}/api/v1/dating/request`);

      if (!token) {
        throw new Error('Authentication token is missing');
      }

      const response = await fetch(`${BASE_URL}/api/v1/dating/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
     },
        body: JSON.stringify(requestData),
      });
      console.log('📡 Response status:', response.status);
      console.log('📡 Response headers:', Object.fromEntries(response.headers.entries()));

      let responseData;
      const responseText = await response.text();
      console.log('📡 Raw response:', responseText);

      try {
        responseData = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Failed to parse response as JSON:', parseError);
        throw new Error(`Invalid response from server: ${responseText.substring(0, 100)}`);
      }

      console.log('📡 Parsed response data:', responseData);

      if (!response.ok) {
        // Handle different error scenarios
        if (response.status === 401) {
          throw new Error('Authentication failed. Please login again.');
        } else if (response.status === 400) {
          throw new Error(responseData.message || 'Invalid request data');
        } else if (response.status === 404) {
          throw new Error('User not found or API endpoint not available');
        } else if (response.status >= 500) {
          throw new Error('Server error. Please try again later.');
        } else {
          throw new Error(responseData.message || `Request failed with status ${response.status}`);
        }
      }

      return responseData;
    } catch (error: any) {
      console.error('❌ Error creating date request:', error);
      
      // Enhanced error handling
      if (error.name === 'TypeError' && error.message.includes('Network request failed')) {
        throw new Error('Network error. Please check your internet connection.');
      } else if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error('Failed to connect to server. Please try again.');
      }
      
      throw error;
    }
  };

  const validateForm = (): string | null => {
    // Check required fields
    if (!userId) {
      return 'User ID is missing';
    }

    if (!location.city.trim()) {
      return 'Please enter a city for the date location';
    }

    if (location.city.trim().length > 100) {
      return 'City name is too long (max 100 characters)';
    }

    if (location.area.trim().length > 100) {
      return 'Area name is too long (max 100 characters)';
    }

    if (location.landmark.trim().length > 200) {
      return 'Landmark description is too long (max 200 characters)';
    }

    // Validate date and time combination
    const combinedDateTime = new Date(preferredDate);
    combinedDateTime.setHours(preferredTime.getHours(), preferredTime.getMinutes(), 0, 0);
    
    if (combinedDateTime <= new Date()) {
      return 'Please select a future date and time for your date';
    }

    if (budget < minBudget || budget > maxBudget) {
      return `Budget must be between ₹${minBudget} and ₹${maxBudget.toLocaleString('en-IN')}`;
    }

    if (message.length > 500) {
      return 'Message is too long (max 500 characters)';
    }

    if (dateType === 'other' && (!dateTitle || dateTitle.trim().length === 0)) {
      return 'Custom date type is required when "other" is selected';
    }

    if (dateType === 'other' && dateTitle.trim().length > 100) {
      return 'Custom date type is too long (max 100 characters)';
    }

    return null;
  };

  const handleConfirmDate = async () => {
    // Validate form
    const validationError = validateForm();
    if (validationError) {
      Alert.alert('Validation Error', validationError);
      return;
    }

    if (!token) {
      Alert.alert('Authentication Error', 'Please login again');
      return;
    }

    setIsLoading(true);
    
    try {
      // Prepare request data exactly as backend expects
      const requestData = {
        recipientId: userId, // Make sure this is the correct field name
        dateType: dateType,
        customDateType: dateType === 'other' ? dateTitle.trim() : null,
        budget: Number(budget), // Ensure it's a number
        message: message.trim(),
        preferredDate: formatDateTime(preferredDate, preferredTime), // Combined date and time
        location: {
          city: location.city.trim(),
          area: location.area.trim() || '', // Ensure empty string if not provided
          landmark: location.landmark.trim() || '', // Ensure empty string if not provided
        }
      };

      console.log('🚀 Sending date request with data:', requestData);
      
      const response = await createDateRequest(requestData);
      
      console.log('✅ Date request successful:', response);
      
      const formattedDateTime = `${preferredDate.toLocaleDateString('en-IN')} at ${formatTime(preferredTime)}`;
      
      Alert.alert(
        'Date Request Sent! 💕',
        `Your ${dateTitle.toLowerCase()} request for ${formattedDateTime} with budget ₹${budget.toLocaleString('en-IN')} has been sent to @${username}. They have 24 hours to respond.`,
        [
          {
            text: 'OK',
            onPress: () => {
              // Navigate back to previous screens
              navigation.goBack();
              navigation.goBack();
            },
          },
        ]
      );
    } catch (error: any) {
      console.error('❌ Error sending date request:', error);
      
      let errorMessage = 'Failed to send date request. Please try again.';
      
      if (error.message) {
        errorMessage = error.message;
      }
      
      Alert.alert('Error', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const getDateIcon = (dateType: string): string => {
    switch (dateType) {
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

  // Debug info (remove in production)
  useEffect(() => {
    console.log('🔍 Component Debug Info:');
    console.log('- User ID:', userId);
    console.log('- Username:', username);
    console.log('- Date Type:', dateType);
    console.log('- Date Title:', dateTitle);
    console.log('- Auth Token Available:', !!token);
    console.log('- Base URL:', BASE_URL);
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0a" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleGoBack} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Set Date Details</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* Date Info */}
        <View style={styles.dateInfoContainer}>
          <View style={styles.dateInfo}>
            <Icon name={getDateIcon(dateType)} size={32} color="#ed167e" />
            <Text style={styles.dateTitle}>{dateTitle}</Text>
            <Text style={styles.dateUsername}>with @{username}</Text>
          </View>
        </View>

        {/* Budget Display */}
        <View style={styles.budgetDisplayContainer}>
          <Text style={styles.budgetLabel}>Your Budget</Text>
          <Text style={styles.budgetAmount}>{formatCurrency(budget)}</Text>
          <Text style={styles.budgetDescription}>
            {getBudgetEmoji(budget)} {getBudgetDescription(budget)}
          </Text>
        </View>

        {/* Budget Slider */}
        <View style={styles.sliderContainer}>
          <Text style={styles.sliderLabel}>Adjust your budget</Text>
          <View style={styles.sliderWrapper}>
            <Text style={styles.minMaxText}>₹{(minBudget/1000).toFixed(0)}k</Text>
            <Slider
              style={styles.slider}
              minimumValue={minBudget}
              maximumValue={maxBudget}
              value={budget}
              onValueChange={setBudget}
              step={500}
              minimumTrackTintColor="#ed167e"
              maximumTrackTintColor="#333"
              thumbStyle={styles.sliderThumb}
            />
            <Text style={styles.minMaxText}>₹{(maxBudget/1000).toFixed(0)}k</Text>
          </View>
        </View>

        {/* Quick Budget Options */}
        <View style={styles.quickBudgetContainer}>
          <Text style={styles.quickBudgetLabel}>Quick Select</Text>
          <View style={styles.quickBudgetGrid}>
            {predefinedBudgets.map((item) => (
              <TouchableOpacity
                key={item.amount}
                style={[
                  styles.quickBudgetButton,
                  budget === item.amount && styles.quickBudgetButtonActive,
                ]}
                onPress={() => handleBudgetSelect(item.amount)}
              >
                <Text
                  style={[
                    styles.quickBudgetText,
                    budget === item.amount && styles.quickBudgetTextActive,
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Date and Time Selection */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionLabel}>Preferred Date & Time</Text>
          
          {/* Date Selection */}
          <TouchableOpacity
            style={styles.dateTimePickerButton}
            onPress={() => setShowDatePicker(true)}
          >
            <Icon name="calendar-today" size={20} color="#ed167e" />
            <View style={styles.dateTimeTextContainer}>
              <Text style={styles.dateTimeLabel}>Date</Text>
              <Text style={styles.dateTimeText}>
                {preferredDate.toLocaleDateString('en-IN', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                })}
              </Text>
            </View>
            <Icon name="arrow-drop-down" size={24} color="#999" />
          </TouchableOpacity>

          {/* Time Selection */}
          <TouchableOpacity
            style={styles.dateTimePickerButton}
            onPress={() => setShowTimePicker(true)}
          >
            <Icon name="access-time" size={20} color="#ed167e" />
            <View style={styles.dateTimeTextContainer}>
              <Text style={styles.dateTimeLabel}>Time</Text>
              <Text style={styles.dateTimeText}>
                {formatTime(preferredTime)}
              </Text>
            </View>
            <Icon name="arrow-drop-down" size={24} color="#999" />
          </TouchableOpacity>

          {/* Quick Time Options */}
          <View style={styles.quickTimeContainer}>
            <Text style={styles.quickTimeLabel}>Quick Time Select</Text>
            <View style={styles.quickTimeGrid}>
              {quickTimeOptions.map((option) => {
                const isSelected = preferredTime.getHours() === option.hours && preferredTime.getMinutes() === option.minutes;
                return (
                  <TouchableOpacity
                    key={option.time}
                    style={[
                      styles.quickTimeButton,
                      isSelected && styles.quickTimeButtonActive,
                    ]}
                    onPress={() => handleQuickTimeSelect(option.hours, option.minutes)}
                  >
                    <Text
                      style={[
                        styles.quickTimeText,
                        isSelected && styles.quickTimeTextActive,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        {/* Location Input */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionLabel}>Location Details</Text>
          <TextInput
            style={[styles.textInput, !location.city.trim() && styles.textInputError]}
            placeholder="City (Required) *"
            placeholderTextColor="#666"
            value={location.city}
            onChangeText={(text) => setLocation(prev => ({ ...prev, city: text }))}
            maxLength={100}
          />
          <TextInput
            style={styles.textInput}
            placeholder="Area (optional)"
            placeholderTextColor="#666"
            value={location.area}
            onChangeText={(text) => setLocation(prev => ({ ...prev, area: text }))}
            maxLength={100}
          />
          <TextInput
            style={styles.textInput}
            placeholder="Landmark (optional)"
            placeholderTextColor="#666"
            value={location.landmark}
            onChangeText={(text) => setLocation(prev => ({ ...prev, landmark: text }))}
            maxLength={200}
          />
        </View>

        {/* Confirm Button */}
        <View style={styles.confirmContainer}>
          <TouchableOpacity
            style={[styles.confirmButton, isLoading && styles.confirmButtonDisabled]}
            onPress={handleConfirmDate}
            disabled={isLoading}
          >
            <LinearGradient
              colors={isLoading ? ['#666', '#888'] : ['#FF69B4', '#4169E1']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.confirmButtonGradient}
            >
              <Text style={styles.confirmButtonText}>
                {isLoading ? 'Sending Request...' : 'Send Date Request 💕'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Date Picker Modal */}
        {showDatePicker && (
          <DateTimePicker
            value={preferredDate}
            mode="date"
            display="default"
            onChange={onDateChange}
            minimumDate={new Date()}
          />
        )}

        {/* Time Picker Modal */}
        {showTimePicker && (
          <DateTimePicker
            value={preferredTime}
            mode="time"
            display="default"
            onChange={onTimeChange}
            is24Hour={false}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#2e2e2e',
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  placeholder: {
    width: 34,
  },
  scrollContainer: {
    flex: 1,
  },
  dateInfoContainer: {
    paddingHorizontal: 20,
    paddingVertical: 25,
    alignItems: 'center',
  },
  dateInfo: {
    alignItems: 'center',
    gap: 8,
  },
  dateTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  dateUsername: {
    fontSize: 16,
    color: '#999',
  },
  budgetDisplayContainer: {
    paddingHorizontal: 20,
    paddingVertical: 30,
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    marginHorizontal: 20,
    borderRadius: 16,
    marginBottom: 30,
  },
  budgetLabel: {
    fontSize: 16,
    color: '#999',
    marginBottom: 10,
  },
  budgetAmount: {
    fontSize: 48,
    fontWeight: '700',
    color: '#ed167e',
    marginBottom: 8,
  },
  budgetDescription: {
    fontSize: 16,
    color: '#ccc',
  },
  sliderContainer: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  sliderLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 20,
    textAlign: 'center',
  },
  sliderWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
  },
  slider: {
    flex: 1,
    height: 40,
  },
  sliderThumb: {
    backgroundColor: '#ed167e',
    width: 20,
    height: 20,
  },
  minMaxText: {
    fontSize: 14,
    color: '#999',
    fontWeight: '600',
  },
  quickBudgetContainer: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  quickBudgetLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 15,
    textAlign: 'center',
  },
  quickBudgetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  quickBudgetButton: {
    width: '30%',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: '#2e2e2e',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#444',
  },
  quickBudgetButtonActive: {
    backgroundColor: '#ed167e',
    borderColor: '#ed167e',
  },
  quickBudgetText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ccc',
  },
  quickBudgetTextActive: {
    color: '#fff',
  },
  sectionContainer: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  sectionLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 15,
  },
  dateTimePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 15,
    borderWidth: 1,
    borderColor: '#333',
    marginBottom: 10,
  },
  dateTimeTextContainer: {
    flex: 1,
    marginLeft: 10,
  },
  dateTimeLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 2,
  },
  dateTimeText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '500',
  },
  quickTimeContainer: {
    marginTop: 20,
  },
  quickTimeLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 15,
  },
  quickTimeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
  },
  quickTimeButton: {
    width: '30%',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: '#2e2e2e',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#444',
  },
  quickTimeButtonActive: {
    backgroundColor: '#ed167e',
    borderColor: '#ed167e',
  },
  quickTimeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ccc',
  },
  quickTimeTextActive: {
    color: '#fff',
  },
  textInput: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#333',
    marginBottom: 10,
  },
  textInputError: {
    borderColor: '#ed167e',
  },
  messageInput: {
    height: 100,
    paddingTop: 15,
  },
  characterCount: {
    fontSize: 12,
    color: '#666',
    textAlign: 'right',
    marginTop: 5,
  },
  confirmContainer: {
    paddingHorizontal: 20,
    paddingBottom: 30,
    marginTop: 10,
  },
  confirmButton: {
    borderRadius: 22,
    overflow: 'hidden',
  },
  confirmButtonDisabled: {
    opacity: 0.7,
  },
  confirmButtonGradient: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
});

export default BudgetSelectorPage;