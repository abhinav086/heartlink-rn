import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Dimensions,
  Image,
  Alert,
  ActivityIndicator,
  Modal,
  Animated,
  ImageStyle,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';
import { icons, images } from '../../constants';
import { useAuth } from '../../context/AuthContext';

const { width, height } = Dimensions.get('window');

type SignupScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Signup'>;

type Props = {
  navigation: SignupScreenNavigationProp;
};

type CustomSuccessModalProps = {
  visible: boolean;
  onClose: () => void;
  message: string;
  subMessage?: string;
  buttonText: string;
  onButtonPress: () => void;
};

const CustomSuccessModal: React.FC<CustomSuccessModalProps> = ({
  visible,
  onClose,
  message,
  subMessage,
  buttonText,
  onButtonPress,
}) => {
  const [fadeAnim] = useState(new Animated.Value(0));
  const [scaleAnim] = useState(new Animated.Value(0.8));

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
    return () => {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.8);
    };
  }, [visible, fadeAnim, scaleAnim]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose} accessible={false}>
        <Animated.View
          style={[styles.modalContainer, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}
        >
          <View style={styles.checkmarkContainer}>
            <Text style={styles.checkmark}>✓</Text>
          </View>
          <Text style={styles.modalTitle}>{message}</Text>
          {subMessage && <Text style={styles.modalSubTitle}>{subMessage}</Text>}
          <TouchableOpacity onPress={onButtonPress} accessible accessibilityLabel="Continue button">
            <LinearGradient colors={['#ed167e', '#ff6f91']} style={styles.modalButton}>
              <Text style={styles.modalButtonText}>{buttonText}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
};

const SignupScreen = ({ navigation }: Props) => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [successModalVisible, setSuccessModalVisible] = useState(false);

  const { register, user, checkOnboardingStatus } = useAuth();

  const handleNavigation = async () => {
    setSuccessModalVisible(false);
    try {
      if (!user) {
        Alert.alert('Error', 'User data not found. Please try logging in again.');
        return;
      }

      const onboardingStatus = await checkOnboardingStatus();
      
      if (onboardingStatus.completed) {
        navigation.navigate('HomeScreen');
      } else {
        navigation.navigate('Gender', { userId: user._id });
      }
    } catch (error) {
      console.error('Navigation Error:', error);
      Alert.alert('Error', 'Failed to retrieve onboarding status. Please try again.');
    }
  };

  const validateInputs = () => {
    if (!fullName || !email || !phoneNumber || !password) {
      Alert.alert('Error', 'All fields are required');
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert('Error', 'Please enter a valid email (e.g., user@example.com)');
      return false;
    }
    if (password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters long');
      return false;
    }
    const phoneRegex = /^\d{10}$/;
    if (!phoneRegex.test(phoneNumber)) {
      Alert.alert('Error', 'Phone number must be exactly 10 digits');
      return false;
    }
    return true;
  };

  const handleSignup = async () => {
    if (!validateInputs()) {
      return;
    }

    setLoading(true);
    
    try {
      const result = await register({
        fullName,
        email,
        phoneNumber,
        password,
        role: 'user', // Default role
      });
      
      if (result.success) {
        setSuccessModalVisible(true);
      } else {
        Alert.alert('Error', result.message || 'Registration failed');
      }
    } catch (error) {
      console.error('Signup Error:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={['#0c0f14', '#0c0f14']} style={styles.container}>
      <View style={styles.radialContainer}>
        <Svg height="100%" width="100%">
          <Defs>
            <RadialGradient id="grad" cx="50%" cy="50%" rx="50%" ry="50%" fx="50%" fy="50%">
              <Stop offset="0%" stopColor="#3b102b" stopOpacity="1" />
              <Stop offset="100%" stopColor="#0c0f14" stopOpacity="1" />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width={width} height={height} fill="url(#grad)" />
        </Svg>
      </View>

      <View style={styles.contentContainer}>
        <Image
          source={images.logo}
          style={styles.logo as ImageStyle}
          resizeMode="contain"
          accessible
          accessibilityLabel="Heartlink logo"
        />
        <Text style={styles.title}>Heartlink</Text>

        <TextInput
          style={styles.input}
          placeholder="Full Name"
          placeholderTextColor="gray"
          value={fullName}
          onChangeText={setFullName}
          accessible
          accessibilityLabel="Full Name input"
        />
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="gray"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          accessible
          accessibilityLabel="Email input"
        />
        <TextInput
          style={styles.input}
          placeholder="Phone Number"
          placeholderTextColor="gray"
          keyboardType="numeric"
          maxLength={10}
          value={phoneNumber}
          onChangeText={(text) => setPhoneNumber(text.replace(/[^0-9]/g, ''))}
          accessible
          accessibilityLabel="Phone Number input"
        />
        <View style={styles.passwordContainer}>
          <TextInput
            style={styles.passwordInput}
            placeholder="Password"
            placeholderTextColor="gray"
            secureTextEntry={!showPassword}
            value={password}
            onChangeText={setPassword}
            accessible
            accessibilityLabel="Password input"
          />
          <TouchableOpacity
            onPress={() => setShowPassword(!showPassword)}
            accessible
            accessibilityLabel={showPassword ? "Hide password" : "Show password"}
          >
            <Image
              source={showPassword ? icons.eyeHide : icons.eye}
              style={styles.eyeIcon as ImageStyle}
              resizeMode="contain"
              accessible
              accessibilityLabel="Toggle password visibility"
            />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.button, loading && { opacity: 0.5 }]}
          onPress={handleSignup}
          disabled={loading}
          accessible
          accessibilityLabel="Sign Up button"
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.buttonText}>Sign Up</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => navigation.navigate('Login')}
          accessible
          accessibilityLabel="Login link"
        >
          <Text style={styles.linkText}>
            Already have an account? <Text style={styles.highlightText}>Login</Text>
          </Text>
        </TouchableOpacity>
      </View>

      <CustomSuccessModal
        visible={successModalVisible}
        onClose={() => setSuccessModalVisible(false)}
        message="Account created successfully!"
        subMessage="Welcome to Heartlink!"
        buttonText="Let's Start"
        onButtonPress={handleNavigation}
      />
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0c0f14',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radialContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  contentContainer: {
    flex: 1,
    width: '100%',
    paddingHorizontal: 20,
    paddingVertical: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 100,
    height: 100,
  },
  title: {
    color: '#d9d9d9',
    fontSize: 30,
    fontWeight: '400',
    fontFamily: 'Montserrat',
    marginBottom: 20,
  },
  input: {
    width: '90%',
    backgroundColor: '#262626',
    color: 'white',
    padding: 12,
    marginVertical: 10,
    borderRadius: 8,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '90%',
    backgroundColor: '#262626',
    borderRadius: 8,
    paddingRight: 10,
    marginVertical: 10,
  },
  passwordInput: {
    flex: 1,
    color: 'white',
    padding: 12,
  },
  eyeIcon: {
    width: 24,
    height: 24,
    padding: 10,
  },
  button: {
    backgroundColor: '#ed167e',
    padding: 15,
    borderRadius: 8,
    marginTop: 20,
    width: '90%',
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  linkText: {
    marginTop: 15,
    color: '#c1c1c1',
    fontSize: 16,
  },
  highlightText: {
    color: '#ed167e',
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: '#262626',
    borderRadius: 20,
    padding: 20,
    width: '80%',
    alignItems: 'center',
    elevation: 5,
  },
  checkmarkContainer: {
    backgroundColor: '#ed167e',
    borderRadius: 25,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  checkmark: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  modalSubTitle: {
    color: '#c1c1c1',
    fontSize: 14,
    marginBottom: 20,
    textAlign: 'center',
  },
  modalButton: {
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 10,
    alignItems: 'center',
    width: '100%',
  },
  modalButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default SignupScreen;