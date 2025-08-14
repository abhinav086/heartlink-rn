import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../../types/navigation';
import { useAuth } from '../../context/AuthContext';
import BASE_URL from '../../config/config';

type QuestionsScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Questions'>;
type QuestionsScreenRouteProp = RouteProp<RootStackParamList, 'Questions'>;

type Props = {
  route: QuestionsScreenRouteProp;
  navigation: QuestionsScreenNavigationProp;
};

const maleQuestions = [
  {
    question: 'What do you love doing?',
    options: ['Clubbing', 'Outing', 'Travel & Adventure', 'Movies', 'Games'],
    multiSelect: true,
  },
  {
    question: 'Your ideal weekend vibe?',
    options: ['Chilling at home', 'Hitting the gym', 'Road trip', 'Gaming marathon', 'Night out'],
    multiSelect: false,
  },
];

const femaleQuestions = [
  {
    question: 'What sparks your vibe?',
    options: ['Art & Creativity', 'Foodie Adventures', 'Music & Dance', 'Exploring Nature', 'Yoga & Wellness', 'Movies', 'Travel'],
    multiSelect: true,
  },
  {
    question: 'What gifts make you smile?',
    options: ['Thoughtful Gifts', 'Jewelry', 'Spa Day', 'Books', 'Flowers', 'Chocolates', 'Experiences'],
    multiSelect: true,
  },
  {
    question: 'Your ideal date spot?',
    options: ['Cozy Café', 'Rooftop Dinner', 'Nature Hike', 'Art Gallery', 'Live Music', 'Movie Night'],
    multiSelect: false,
  },
];

const QuestionsScreen = ({ route, navigation }: Props) => {
  const { gender, userId } = route.params;
  const { token, updateUser } = useAuth(); // Get token from auth context
  const questions = gender === 'Male' ? maleQuestions : femaleQuestions;
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [allAnswers, setAllAnswers] = useState<{ [key: string]: string[] }>({});
  const [currentAnswers, setCurrentAnswers] = useState<string[]>([]);

  const handleSelect = (option: string) => {
    if (questions[currentQuestion].multiSelect) {
      setCurrentAnswers((prev) =>
        prev.includes(option) ? prev.filter((item) => item !== option) : [...prev, option]
      );
    } else {
      setCurrentAnswers([option]);
    }
  };

  const handleNextOrContinue = async () => {
    if (!userId) {
      Alert.alert('Error', 'User ID not found. Please log in again.');
      navigation.navigate('Login');
      return;
    }
    if (currentAnswers.length === 0) {
      Alert.alert('Error', 'Please select at least one option');
      return;
    }

    setAllAnswers((prev) => ({
      ...prev,
      [questions[currentQuestion].question]: currentAnswers,
    }));

    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
      setCurrentAnswers([]);
    } else {
      const finalAnswers = {
        ...allAnswers,
        [questions[currentQuestion].question]: currentAnswers,
      };
      const flattenedAnswers = Object.values(finalAnswers).flat();

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      try {
        // ✅ FIXED: Use token from auth context instead of AsyncStorage
        if (!token) {
          Alert.alert('Error', 'Authentication token not found. Please log in again.');
          navigation.navigate('Login');
          return;
        }

        console.log('🔑 Token found, proceeding with onboarding...');

        const response = await fetch(`${BASE_URL}/api/v1/users/onboarding/complete`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            userId,
            gender,
            preferences: flattenedAnswers,
            onboardingCompleted: true,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        const data = await response.json();
        
        console.log('📡 Onboarding response:', {
          status: response.status,
          ok: response.ok,
          message: data.message
        });

        if (!response.ok) {
          throw new Error(data.message || 'Onboarding failed');
        }

        // Update user in auth context
        updateUser({
          gender,
          hobbies: flattenedAnswers,
          onboardingCompleted: true,
        });

        try {
          await AsyncStorage.setItem('onboardingCompleted', 'true');
          console.log('✅ Onboarding completion saved to storage');
        } catch (error) {
          console.error('AsyncStorage Error:', error);
          Alert.alert('Error', 'Failed to save onboarding status. Please try again.');
          return;
        }
        
        console.log('🎉 Onboarding completed successfully, navigating to HomeScreen');
        navigation.navigate('HomeScreen');
      } catch (error: any) {
        clearTimeout(timeoutId);
        console.error('❌ Onboarding save error:', error);
        let errorMessage = 'Failed to complete onboarding';
        if (error.name === 'AbortError') {
          errorMessage = 'Request timed out. Please check your connection.';
        } else if (error.message.includes('JSON')) {
          errorMessage = 'Invalid server response.';
        } else {
          errorMessage = error.message || 'Unknown error';
        }
        Alert.alert('Error', errorMessage);
      }
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.progress}>Question {currentQuestion + 1}/{questions.length}</Text>
      <Text style={styles.question}>{questions[currentQuestion].question}</Text>
      <View style={styles.optionsContainer}>
        {questions[currentQuestion].options.map((option) => (
          <TouchableOpacity
            key={option}
            style={[styles.option, currentAnswers.includes(option) && styles.selectedOption]}
            onPress={() => handleSelect(option)}
            accessible
            accessibilityLabel={`Select ${option} option`}
          >
            <Text style={styles.optionText}>{option}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          accessible
          accessibilityLabel="Back button"
        >
          <Text style={styles.buttonText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.nextButton, { opacity: currentAnswers.length === 0 ? 0.5 : 1 }]}
          onPress={handleNextOrContinue}
          disabled={currentAnswers.length === 0}
          accessible
          accessibilityLabel={currentQuestion === questions.length - 1 ? "Continue button" : "Next button"}
        >
          <Text style={styles.buttonText}>
            {currentQuestion === questions.length - 1 ? 'Continue' : 'Next'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    padding: 20,
  },
  progress: {
    fontSize: 16,
    color: '#AAAAAA',
    marginTop: 20,
  },
  question: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 20,
    textAlign: 'center',
  },
  optionsContainer: {
    width: '100%',
    marginTop: 20,
  },
  option: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#FFFFFF',
    borderRadius: 10,
    padding: 15,
    marginVertical: 10,
    alignItems: 'center',
  },
  selectedOption: {
    backgroundColor: '#8B5CF6',
    borderColor: '#8B5CF6',
  },
  optionText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '80%',
    marginTop: 20,
  },
  backButton: {
    backgroundColor: '#AAAAAA',
    borderRadius: 10,
    padding: 15,
    width: '45%',
    alignItems: 'center',
  },
  nextButton: {
    backgroundColor: '#ed167e',
    borderRadius: 10,
    padding: 15,
    width: '45%',
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default QuestionsScreen;