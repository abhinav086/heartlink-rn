import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Alert } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../../types/navigation';
import { images } from '../../constants';

type GenderScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Gender'>;
type GenderScreenRouteProp = RouteProp<RootStackParamList, 'Gender'>;

type Props = {
  navigation: GenderScreenNavigationProp;
  route: GenderScreenRouteProp;
};

const GenderScreen = ({ navigation, route }: Props) => {
  const userId = route.params?.userId;
  const [selectedGender, setSelectedGender] = useState<'Male' | 'Female' | 'Others' | null>(null);

  const genders: ('Male' | 'Female' | 'Others')[] = ['Male', 'Female', 'Others'];

  const handleNext = () => {
    if (!userId) {
      console.error('userId is missing');
      Alert.alert('Error', 'User ID not found. Please try logging in again.');
      navigation.navigate('Login');
      return;
    }
    if (!selectedGender) {
      Alert.alert('Error', 'Please select a gender');
      return;
    }
    navigation.navigate('Questions', { userId, gender: selectedGender });
  };

  return (
    <View style={styles.container}>
      <Image
        source={images.logo}
        style={styles.logo}
        resizeMode="contain"
        accessible
        accessibilityLabel="Heartlink logo"
      />
      <Text style={styles.title}>Welcome to Ai Heartlink!</Text>
      <Text style={styles.subtitle}>Select your gender</Text>
      <View style={styles.buttonContainer}>
        {genders.map((gender) => (
          <TouchableOpacity
            key={gender}
            style={[
              styles.button,
              selectedGender === gender && styles.selectedButton,
            ]}
            onPress={() => setSelectedGender(gender)}
            accessible
            accessibilityLabel={`Select ${gender} gender`}
          >
            <Text style={styles.buttonText}>{gender}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity
        style={[styles.nextButton, { opacity: selectedGender ? 1 : 0.5 }]}
        onPress={handleNext}
        disabled={!selectedGender}
        accessible
        accessibilityLabel="Next button"
      >
        <Text style={styles.nextButtonText}>Next</Text>
      </TouchableOpacity>
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
  logo: {
    width: 100,
    height: 100,
    marginTop: 40,
    marginBottom: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 20,
  },
  subtitle: {
    fontSize: 16,
    color: '#AAAAAA',
    marginTop: 10,
    marginBottom: 20,
  },
  buttonContainer: {
    width: '100%',
    marginVertical: 20,
  },
  button: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#FFFFFF',
    borderRadius: 10,
    padding: 15,
    marginVertical: 10,
    alignItems: 'center',
  },
  selectedButton: {
    backgroundColor: '#8B5CF6',
    borderColor: '#8B5CF6',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  nextButton: {
    backgroundColor: '#ed167e',
    borderRadius: 10,
    padding: 15,
    width: '80%',
    alignItems: 'center',
    marginTop: 20,
  },
  nextButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default GenderScreen;
