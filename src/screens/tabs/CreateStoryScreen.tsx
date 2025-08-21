// screens/tabs/CreateStoryScreen.js
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ImageBackground,
  Alert,
  Dimensions,
  StatusBar,
  TextInput,
  ActivityIndicator,
  Platform,
  PermissionsAndroid,
  Animated,
  Easing,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import BASE_URL from '../../config/config';
import Icon from 'react-native-vector-icons/Ionicons';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import Feather from 'react-native-vector-icons/Feather';
import { launchImageLibrary } from 'react-native-image-picker';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useCodeScanner,
} from 'react-native-vision-camera';
import { useFocusEffect } from '@react-navigation/native';

const { width, height } = Dimensions.get('window');

// Define theme colors for a consistent look and feel
const COLORS = {
  primary: '#ed167e',
  dark: '#121212',
  darkSecondary: '#1E1E1E',
  lightText: '#FFFFFF',
  mediumText: '#A9A9A9',
  darkText: '#333333',
  red: '#ff0000',
  black: '#000000',
};

const CreateStoryScreen = () => {
  const navigation = useNavigation();
  const [selectedImage, setSelectedImage] = useState(null);
  const [storyText, setStoryText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [showSuccessOptions, setShowSuccessOptions] = useState(false);
  const [cameraPosition, setCameraPosition] = useState('back');
  const [flash, setFlash] = useState('off');
  const [isCameraActive, setIsCameraActive] = useState(true);
  const [zoom, setZoom] = useState(0);
  const cameraRef = useRef(null);
  const device = useCameraDevice(cameraPosition);
  const { hasPermission, requestPermission } = useCameraPermission();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useFocusEffect(
    React.useCallback(() => {
      setIsCameraActive(true);
      return () => setIsCameraActive(false);
    }, [])
  );

  useEffect(() => {
    requestPermissions();
  }, []);

  useEffect(() => {
    if (selectedImage) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        easing: Easing.ease,
        useNativeDriver: true,
      }).start();
    } else {
      fadeAnim.setValue(0);
    }
  }, [selectedImage, fadeAnim]);

  const requestPermissions = async () => {
    if (Platform.OS === 'android') {
      try {
        const permissionsToRequest = [PermissionsAndroid.PERMISSIONS.CAMERA];

        if (Platform.Version >= 33) {
          permissionsToRequest.push(PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES);
        } else {
          permissionsToRequest.push(PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE);
        }

        const grantedStatus = await PermissionsAndroid.requestMultiple(permissionsToRequest);
        const allPermissionsGranted = Object.values(grantedStatus).every(
          status => status === PermissionsAndroid.RESULTS.GRANTED
        );

        if (!allPermissionsGranted) {
          Alert.alert(
            'Permissions Required',
            'Please grant camera and storage permissions to create stories.',
            [{ text: 'OK', onPress: () => navigation.goBack() }]
          );
        }
      } catch (err) {
        console.error('Error during permission request:', err);
      }
    } else {
      await requestPermission();
    }
  };

  const toggleCamera = () => {
    setCameraPosition(prev => (prev === 'back' ? 'front' : 'back'));
  };

  const toggleFlash = () => {
    setFlash(prev => {
      if (prev === 'off') return 'on';
      if (prev === 'on') return 'auto';
      return 'off';
    });
  };

  const takePhoto = async () => {
    if (cameraRef.current && device) {
      try {
        const photo = await cameraRef.current.takePhoto({
          flash: flash,
          qualityPrioritization: 'quality',
        });
        setSelectedImage({
          uri: `file://${photo.path}`,
          type: 'image/jpeg',
          fileName: `story_${Date.now()}.jpg`,
        });
      } catch (error) {
        console.error('Error taking photo:', error);
        Alert.alert('Camera Error', 'Failed to capture photo. Please try again.');
      }
    }
  };

  const openGallery = () => {
    const options = {
      mediaType: 'photo',
      quality: 0.8,
      maxWidth: 1080,
      maxHeight: 1920,
      includeBase64: false,
    };

    launchImageLibrary(options, (response) => {
      if (response.didCancel) {
        console.log('User cancelled gallery picker');
        return;
      } else if (response.errorMessage) {
        console.error('ImagePicker Error: ', response.errorMessage);
        Alert.alert('Gallery Error', response.errorMessage);
        return;
      }

      if (response.assets && response.assets[0]) {
        console.log('Gallery photo selected:', response.assets[0].uri);
        setSelectedImage(response.assets[0]);
      }
    });
  };

  const handleGoLive = () => {
    console.log('Go Live pressed - navigating to CreateLiveStream screen');
    navigation.navigate('CreateLiveStream');
  };

  const uploadStory = async () => {
    if (!selectedImage) {
      Alert.alert('Error', 'Please select an image for your story');
      return;
    }

    try {
      setUploading(true);
      const token = await AsyncStorage.getItem('token');

      if (!token) {
        Alert.alert('Error', 'Please log in to create a story');
        navigation.navigate('Login');
        return;
      }

      const formData = new FormData();
      formData.append('media', {
        uri: selectedImage.uri,
        type: selectedImage.type || 'image/jpeg',
        name: selectedImage.fileName || `story_${Date.now()}.jpg`,
      });

      if (storyText.trim()) {
        formData.append('content', storyText.trim());
      }

      const response = await fetch(`${BASE_URL}/api/v1/stories/story`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await response.json();

      if (response.ok && data.success) {
        resetStory();
        setShowSuccessOptions(true);
      } else {
        throw new Error(data.message || 'Failed to upload story');
      }
    } catch (error) {
      console.error('Error uploading story:', error);
      let errorMessage = 'Failed to upload story. Please try again.';
      if (error.message.includes('Network')) {
        errorMessage = 'Network error. Please check your connection.';
      } else if (error.message.includes('401')) {
        errorMessage = 'Session expired. Please log in again.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      Alert.alert('Error', errorMessage);
    } finally {
      setUploading(false);
    }
  };

  const resetStory = () => {
    setSelectedImage(null);
    setStoryText('');
  };

  const handleCreateAnother = () => {
    setShowSuccessOptions(false);
  };

  const handleDone = () => {
    setShowSuccessOptions(false);
    navigation.goBack();
  };

  if (showSuccessOptions) {
    return (
      <View style={styles.successContainer}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />
        <View style={styles.successContent}>
          <MaterialIcon name="check-circle" size={60} color={COLORS.primary} style={styles.successIcon} />
          <Text style={styles.successTitle}>Story Posted!</Text>
          <Text style={styles.successSubtitle}>Your story has been shared successfully.</Text>
          <View style={styles.successButtons}>
            <TouchableOpacity
              style={styles.createAnotherButton}
              onPress={handleCreateAnother}
            >
              <Feather name="plus" size={18} color={COLORS.lightText} />
              <Text style={styles.createAnotherText}>Create Another</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.doneButton}
              onPress={handleDone}
            >
              <Text style={styles.doneText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  if (selectedImage) {
    return (
      <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />
        <ImageBackground source={{ uri: selectedImage.uri }} style={styles.previewImageBackground}>
          <View style={styles.previewHeader}>
            <TouchableOpacity style={styles.headerIconContainer} onPress={resetStory}>
              <Icon name="arrow-back" size={28} color={COLORS.lightText} />
            </TouchableOpacity>
            {/* <View style={styles.previewTools}>
              <TouchableOpacity style={styles.headerIconContainer}>
                <Icon name="text" size={28} color={COLORS.lightText} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.headerIconContainer}>
                <Icon name="color-filter-outline" size={28} color={COLORS.lightText} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.headerIconContainer}>
                <Icon name="musical-notes-outline" size={28} color={COLORS.lightText} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.headerIconContainer}>
                <Icon name="happy-outline" size={28} color={COLORS.lightText} />
              </TouchableOpacity>
            </View> */}
          </View>

          {/* <View style={styles.textInputContainer}>
            <TextInput
              style={styles.textInput}
              placeholder="Add text..."
              placeholderTextColor="rgba(255,255,255,0.7)"
              value={storyText}
              onChangeText={setStoryText}
              multiline
            />
          </View> */}

          <View style={styles.previewFooter}>
            <TouchableOpacity
              style={[styles.postButton, uploading && styles.disabledButton]}
              onPress={uploadStory}
              disabled={uploading}
            >
              {uploading ? (
                <ActivityIndicator size="small" color={COLORS.lightText} />
              ) : (
                <Text style={styles.postButtonText}>Post Story</Text>
              )}
            </TouchableOpacity>
          </View>
        </ImageBackground>
      </Animated.View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      {device && hasPermission ? (
        <Camera
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          device={device}
          isActive={isCameraActive}
          photo
          flash={flash}
          zoom={zoom}
        />
      ) : (
        <View style={styles.cameraPlaceholder}>
          <Text style={styles.cameraPlaceholderText}>
            {hasPermission 
              ? 'Camera not available' 
              : 'Grant camera permission to continue'}
          </Text>
        </View>
      )}

      {/* Lowered Header */}
      <View style={styles.creatorHeader}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="close" size={30} color={COLORS.lightText} />
        </TouchableOpacity>
        <Text style={styles.creatorTitle}>New Story</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Camera Controls */}
      <View style={styles.creatorControls}>
        <View style={styles.leftControls}>
          <TouchableOpacity style={styles.controlButton} onPress={openGallery}>
            <Icon name="images-outline" size={28} color={COLORS.lightText} />
            <Text style={styles.controlButtonText}>Gallery</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.shutterButton} onPress={takePhoto}>
          <View style={styles.shutterButtonInner} />
        </TouchableOpacity>

        <View style={styles.rightControls}>
          <TouchableOpacity style={styles.controlButton} onPress={toggleCamera}>
            <Icon name="camera-reverse-outline" size={28} color={COLORS.lightText} />
            <Text style={styles.controlButtonText}>Flip</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Go Live Button */}
      <View style={styles.liveButtonContainer}>
        <TouchableOpacity style={styles.liveButton} onPress={handleGoLive}>
          <Icon name="radio" size={24} color={COLORS.red} />
          <Text style={styles.liveButtonText}>Go Live</Text>
        </TouchableOpacity>
      </View>

      {/* Flash Toggle (moved to side controls) */}
      <View style={styles.sideControls}>
        <TouchableOpacity style={styles.sideControlButton} onPress={toggleFlash}>
          <Icon 
            name={flash === 'on' ? 'flash' : flash === 'auto' ? 'flash-outline' : 'flash-off'} 
            size={24} 
            color={flash === 'off' ? COLORS.mediumText : COLORS.lightText} 
          />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.black,
  },
  // --- Creator Screen Styles ---
  creatorHeader: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 80 : 50, // Lowered from 50/20 to 80/50
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    zIndex: 10,
  },
  creatorTitle: {
    color: COLORS.lightText,
    fontSize: 18,
    fontWeight: '600',
  },
  headerSpacer: {
    width: 30, // Placeholder for removed flash icon
  },
  cameraPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.dark,
  },
  cameraPlaceholderText: {
    color: COLORS.mediumText,
    fontSize: 16,
  },
  creatorControls: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 40 : 20,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  leftControls: {
    flex: 1,
    alignItems: 'flex-start',
  },
  rightControls: {
    flex: 1,
    alignItems: 'flex-end',
  },
  controlButton: {
    alignItems: 'center',
    width: 70,
  },
  controlButtonText: {
    color: COLORS.lightText,
    fontSize: 12,
    marginTop: 4,
  },
  shutterButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: COLORS.lightText,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  shutterButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.lightText,
    borderWidth: 2,
    borderColor: COLORS.black,
  },
  // Go Live Button
  liveButtonContainer: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 140 : 120,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 5,
  },
  liveButton: {
    backgroundColor: 'rgba(255, 0, 0, 0.1)',
    borderWidth: 2,
    borderColor: COLORS.red,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  liveButtonText: {
    color: COLORS.red,
    fontSize: 16,
    fontWeight: '600',
  },
  // Side Controls
  sideControls: {
    position: 'absolute',
    right: 20,
    top: '50%',
    transform: [{ translateY: -50 }],
    zIndex: 5,
  },
  sideControlButton: {
    backgroundColor: 'rgba(0,0,0,0.4)',
    padding: 12,
    borderRadius: 50,
    marginBottom: 15,
  },
  // --- Preview Screen Styles ---
  previewImageBackground: {
    flex: 1,
    width: width,
    height: height,
    justifyContent: 'space-between',
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingTop: Platform.OS === 'ios' ? 80 : 50, // Lowered to match main header
  },
  previewTools: {
    flexDirection: 'row',
    gap: 15,
  },
  headerIconContainer: {
    backgroundColor: 'rgba(0,0,0,0.4)',
    padding: 8,
    borderRadius: 50,
  },
  textInputContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  textInput: {
    color: COLORS.lightText,
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: {width: -1, height: 1},
    textShadowRadius: 10,
  },
  previewFooter: {
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  postButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postButtonText: {
    color: COLORS.lightText,
    fontSize: 18,
    fontWeight: 'bold',
  },
  disabledButton: {
    opacity: 0.6,
  },
  // --- Success Modal Styles ---
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.9)',
  },
  successContent: {
    backgroundColor: COLORS.darkSecondary,
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    marginHorizontal: 30,
    width: '90%',
  },
  successIcon: {
    marginBottom: 20,
  },
  successTitle: {
    color: COLORS.lightText,
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  successSubtitle: {
    color: COLORS.mediumText,
    fontSize: 16,
    marginBottom: 30,
    textAlign: 'center',
  },
  successButtons: {
    width: '100%',
    gap: 12,
  },
  createAnotherButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  createAnotherText: {
    color: COLORS.lightText,
    fontSize: 16,
    fontWeight: '600',
  },
  doneButton: {
    backgroundColor: 'transparent',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.darkText,
  },
  doneText: {
    color: COLORS.mediumText,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default CreateStoryScreen;