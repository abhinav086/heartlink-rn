// src/screens/auth/LoginScreen.tsx
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
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CommonActions } from '@react-navigation/native'; // Import CommonActions
import { RootStackParamList } from '../../types/navigation';
import { icons, images } from '../../constants';
import { useAuth } from '../../context/AuthContext';

const { width, height } = Dimensions.get('window');

type LoginScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Login'>;

type Props = {
  navigation: LoginScreenNavigationProp;
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

const LoginScreen = ({ navigation }: Props) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [successModalVisible, setSuccessModalVisible] = useState(false);

  const { login, googleLogin, user, checkOnboardingStatus } = useAuth();

  useEffect(() => {
    // Configure Google Sign-In
    GoogleSignin.configure({
      webClientId: '275966453498-hc9fa9v3475p4mkeal76jhd326tv0lcd.apps.googleusercontent.com',
      offlineAccess: true,
    });
  }, []);

  // MODIFIED: handleNavigation now uses CommonActions.reset
  const handleNavigation = async () => {
    setSuccessModalVisible(false);
    try {
      if (!user) {
        Alert.alert('Error', 'User data not found. Please try logging in again.');
        return;
      }

      const onboardingStatus = await checkOnboardingStatus();
      
      let targetScreen;
      let targetParams = {};

      if (onboardingStatus.completed) {
        targetScreen = 'HomeScreen';
      } else {
        targetScreen = 'Gender';
        targetParams = { userId: user._id };
      }

      // Reset the navigation stack to the target screen
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [
            {
              name: targetScreen,
              params: targetParams,
            },
          ],
        })
      );
    } catch (error) {
      console.error('Navigation Error:', error);
      Alert.alert('Error', 'Failed to retrieve onboarding status. Please try again.');
    }
  };

  const handleLogin = async () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !password) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }
    if (!emailRegex.test(email)) {
      Alert.alert('Error', 'Please enter a valid email (e.g., user@example.com)');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters long');
      return;
    }

    setLoading(true);
    
    try {
      const result = await login(email, password);
      
      if (result.success) {
        setSuccessModalVisible(true);
      } else {
        Alert.alert('Error', result.message || 'Login failed');
      }
    } catch (error) {
      console.error('Login Error:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      // Check if Google Play Services are available
      await GoogleSignin.hasPlayServices();
      
      // Sign out any existing user first to ensure clean login
      await GoogleSignin.signOut();
      
      // Perform the sign-in
      const userInfo = await GoogleSignin.signIn();
      console.log('Google Sign-In successful:', userInfo);
      
      // Get the ID token
      const { idToken } = await GoogleSignin.getTokens();
      console.log('ID Token received:', idToken ? 'Token exists' : 'No token');
      
      if (!idToken) {
        throw new Error('Failed to get Google ID token');
      }
      
      // Call the backend API with the ID token
      const result = await googleLogin(idToken);
      
      if (result.success) {
        console.log('Google login successful, showing success modal');
        setSuccessModalVisible(true);
      } else {
        Alert.alert('Error', result.message || 'Google login failed');
      }
    } catch (error: any) {
      console.error('Google Login Error:', error);
      let errorMessage = 'Google login failed';
      
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        errorMessage = 'Google Sign-In was cancelled';
      } else if (error.code === statusCodes.IN_PROGRESS) {
        errorMessage = 'Sign-In in progress';
      } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        errorMessage = 'Google Play Services not available';
      } else {
        errorMessage = error.message || 'Unknown error occurred during Google login';
      }
      
      Alert.alert('Error', errorMessage);
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
          placeholder="Email"
          placeholderTextColor="gray"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          accessible
          accessibilityLabel="Email input"
          autoCapitalize="none" // Added for better UX
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
            autoCapitalize="none" // Added for better UX
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
          onPress={handleLogin}
          disabled={loading}
          accessible
          accessibilityLabel="Login button"
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.buttonText}>Login</Text>
          )}
        </TouchableOpacity>

        <View style={styles.orContainer}>
          <View style={styles.line} />
          <Text style={styles.orText}>OR</Text>
          <View style={styles.line} />
        </View>

        <TouchableOpacity
          style={[styles.googleButton, loading && { opacity: 0.5 }]}
          onPress={handleGoogleLogin}
          disabled={loading}
          accessible
          accessibilityLabel="Continue with Google button"
        >
          <Image
            source={icons.google}
            style={styles.googleIcon as ImageStyle}
            accessible
            accessibilityLabel="Google icon"
          />
          <Text style={styles.googleText}>Continue with Google</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => navigation.navigate('Signup')}
          accessible
          accessibilityLabel="Sign Up link"
        >
          <Text style={styles.linkText}>
            Don't have an account? <Text style={styles.highlightText}>Sign Up</Text>
          </Text>
        </TouchableOpacity>

        <View style={styles.footer}>
          <TouchableOpacity accessible accessibilityLabel="Terms of Use link">
            <Text style={styles.footerText}>Terms of Use</Text>
          </TouchableOpacity>
          <TouchableOpacity accessible accessibilityLabel="Privacy Policy link">
            <Text style={styles.footerText}>Privacy Policy</Text>
          </TouchableOpacity>
        </View>
      </View>

      <CustomSuccessModal
        visible={successModalVisible}
        onClose={() => setSuccessModalVisible(false)}
        message="Logged in successfully!"
        buttonText="Let's Go"
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
  orContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  orText: {
    color: '#c1c1c1',
    marginHorizontal: 50,
    fontSize: 18,
    fontWeight: '500',
  },
  line: {
    height: 1,
    flex: 1,
    backgroundColor: '#c1c1c1',
  },
  googleButton: {
    flexDirection: 'row',
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#d9d9d9',
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
    width: '80%',
    justifyContent: 'center',
  },
  googleIcon: {
    width: 20,
    height: 20,
    marginRight: 10,
  },
  googleText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#d9d9d9',
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
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '80%',
    marginTop: 40,
    position: 'absolute',
    bottom: 10,
  },
  footerText: {
    color: '#c1c1c1',
    fontSize: 14,
    marginBottom: 25,
    fontWeight: '500',
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

export default LoginScreen;