// screens/tabs/CreateStoryScreen.js - UPDATED TO NAVIGATE TO NEW DEDICATED LIVE STREAM SCREEN
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  Dimensions,
  StatusBar,
  TextInput,
  ActivityIndicator,
  Platform,
  PermissionsAndroid,
} from 'react-native';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { useNavigation } from '@react-navigation/native'; // We will use this for navigation
import AsyncStorage from '@react-native-async-storage/async-storage';
import BASE_URL from '../../config/config';
// --- REMOVED OLD IMPORT ---
// import { LiveStreamCreator } from '../../components/LiveStreamManager';
import Icon from 'react-native-vector-icons/Ionicons';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import Feather from 'react-native-vector-icons/Feather';

const { width, height } = Dimensions.get('window');

const CreateStoryScreen = () => {
  const navigation = useNavigation(); // Hook for navigation
  const [selectedImage, setSelectedImage] = useState(null);
  const [storyText, setStoryText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [showSuccessOptions, setShowSuccessOptions] = useState(false);
  // --- REMOVED OLD STATE ---
  // const [showLiveCreator, setShowLiveCreator] = useState(false); // WebRTC Live stream modal

  useEffect(() => {
    requestPermissions();
  }, []);

  const requestPermissions = async () => {
    if (Platform.OS === 'android') {
      try {
        console.log('--- Permissions Request Initiated ---');
        console.log('Current Android Platform Version:', Platform.Version);

        const permissionsToRequest = [PermissionsAndroid.PERMISSIONS.CAMERA];

        if (Platform.Version >= 33) {
          console.log('Requesting READ_MEDIA_IMAGES for Android 13+');
          permissionsToRequest.push(PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES);
        } else if (Platform.Version <= 28) {
          console.log('Requesting READ_EXTERNAL_STORAGE and WRITE_EXTERNAL_STORAGE for Android 9 and below');
          permissionsToRequest.push(PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE);
          permissionsToRequest.push(PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE);
        } else {
          console.log('Requesting READ_EXTERNAL_STORAGE for Android 10-12 (Scoped Storage)');
          permissionsToRequest.push(PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE);
        }

        console.log('Permissions array to request:', permissionsToRequest);

        const grantedStatus = await PermissionsAndroid.requestMultiple(permissionsToRequest);
        console.log('Raw granted status results:', grantedStatus);

        let allPermissionsGranted = true;
        let missingPermissions = [];

        for (const permission of permissionsToRequest) {
          if (grantedStatus[permission] !== PermissionsAndroid.RESULTS.GRANTED) {
            allPermissionsGranted = false;
            missingPermissions.push(permission);
            console.log(`Permission ${permission} NOT GRANTED. Status: ${grantedStatus[permission]}`);
          } else {
            console.log(`Permission ${permission} GRANTED.`);
          }
        }

        console.log('Overall allPermissionsGranted:', allPermissionsGranted);
        if (missingPermissions.length > 0) {
            console.warn('Missing permissions:', missingPermissions.join(', '));
            Alert.alert(
                'Permissions Required',
                `Please grant the following permissions to create stories: ${missingPermissions.map(p => p.split('.').pop()).join(', ')}. You may need to go to app settings if prompted "Don\'t ask again."`,
                [{ text: 'OK', onPress: () => navigation.goBack() }]
            );
        } else if (!allPermissionsGranted) {
            Alert.alert(
                'Permissions Required',
                'Please grant camera and storage permissions to create stories. You may need to go to app settings if prompted "Don\'t ask again."',
                [{ text: 'OK', onPress: () => navigation.goBack() }]
            );
        }
      } catch (err) {
        console.error('Error during permission request process:', err);
      }
    }
  };

  const openCamera = () => {
    const options = {
      mediaType: 'photo',
      quality: 0.8,
      maxWidth: 1080,
      maxHeight: 1920,
      includeBase64: false,
      saveToPhotos: true,
    };

    launchCamera(options, (response) => {
      if (response.didCancel) {
        console.log('User cancelled camera picker');
        return;
      } else if (response.errorMessage) {
        console.error('ImagePicker Error: ', response.errorMessage);
        Alert.alert('Camera Error', response.errorMessage);
        return;
      }

      if (response.assets && response.assets[0]) {
        console.log('Camera photo selected:', response.assets[0].uri);
        setSelectedImage(response.assets[0]);
      }
    });
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

  // --- REPLACED OLD HANDLER ---
  // WebRTC: Handle Go Live button press - Now navigates to the new screen
  const handleGoLive = () => {
    console.log('Go Live pressed - navigating to CreateLiveStream screen');
    // Navigate to the new dedicated live stream creation screen
    // Make sure this screen name matches your AppNavigator setup
    navigation.navigate('CreateLiveStream'); 
    // Optional: Close this screen if you don't want it in the stack behind
    // navigation.replace('CreateLiveStream'); 
  };

  // --- REMOVED OLD HANDLERS ---
  /*
  // WebRTC: Handle successful live stream creation
  const handleLiveStreamStarted = (streamData) => {
    console.log('WebRTC Live stream started:', streamData);
    // The LiveStreamCreator component handles navigation to the viewer
    // We just need to close this screen
  };

  // WebRTC: Handle live stream creator close
  const handleLiveStreamCreatorClose = () => {
    console.log('WebRTC Live stream creator closed');
    setShowLiveCreator(false);
  };
  */

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

      console.log('Starting story upload...');
      console.log('Selected image:', selectedImage);

      const formData = new FormData();
      formData.append('media', {
        uri: selectedImage.uri,
        type: selectedImage.type || 'image/jpeg',
        name: selectedImage.fileName || `story_${Date.now()}.jpg`,
      });

      if (storyText.trim()) {
        formData.append('content', storyText.trim());
      }

      console.log('FormData prepared, making API call to:', `${BASE_URL}/api/v1/stories/story`);

      const response = await fetch(`${BASE_URL}/api/v1/stories/story`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          // 'Content-Type': 'multipart/form-data',
        },
        body: formData,
      });

      console.log('Story upload response status:', response.status);
      const data = await response.json();
      console.log('Story upload response data:', data);

      if (response.ok && data.success) {
        console.log('Story uploaded successfully!');
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
    // Story is already reset from uploadStory
  };

  const handleDone = () => {
    setShowSuccessOptions(false);
    navigation.goBack();
  };

  // Success options modal
  if (showSuccessOptions) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="black" />

        <View style={styles.successContainer}>
          <View style={styles.successContent}>
            <MaterialIcon name="check-circle" size={60} color="#ed167e" style={styles.successIcon} />
            <Text style={styles.successTitle}>Story Posted!</Text>
            <Text style={styles.successSubtitle}>Your story has been shared successfully</Text>

            <View style={styles.successButtons}>
              <TouchableOpacity
                style={styles.createAnotherButton}
                onPress={handleCreateAnother}
              >
                <Feather name="plus" size={18} color="white" />
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
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="black" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="close" size={30} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Story</Text>
        <View style={styles.placeholder} />
      </View>

      {/* --- REMOVED OLD MODAL COMPONENT ---
      <LiveStreamCreator
        visible={showLiveCreator}
        onClose={handleLiveStreamCreatorClose}
        onStreamStarted={handleLiveStreamStarted}
      />
      */}

      {/* Content */}
      <View style={styles.content}>
        {selectedImage ? (
          <View style={styles.previewContainer}>
            <Image source={{ uri: selectedImage.uri }} style={styles.previewImage} />

            {/* Text overlay input */}
            <View style={styles.textOverlay}>
              <TextInput
                style={styles.textInput}
                placeholder="Add text to your story..."
                placeholderTextColor="rgba(255,255,255,0.7)"
                value={storyText}
                onChangeText={setStoryText}
                multiline
                maxLength={100}
              />
            </View>

            {/* Action buttons */}
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={styles.resetButton}
                onPress={resetStory}
              >
                <Icon name="refresh" size={20} color="white" />
                <Text style={styles.buttonText}>Reset</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.shareButton, uploading && styles.disabledButton]}
                onPress={uploadStory}
                disabled={uploading}
              >
                {uploading ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <>
                    <Icon name="share-outline" size={20} color="white" />
                    <Text style={styles.buttonText}>Share</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.optionsContainer}>
            <Text style={styles.title}>Create Your Story</Text>
            <Text style={styles.subtitle}>Share a moment with your followers</Text>

            <View style={styles.options}>
              <TouchableOpacity
                style={styles.option}
                onPress={openCamera}
              >
                <View style={styles.optionIcon}>
                  <Icon name="camera" size={32} color="#ed167e" />
                </View>
                <Text style={styles.optionTitle}>Take Photo</Text>
                <Text style={styles.optionSubtitle}>Capture a new moment</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.option}
                onPress={openGallery}
              >
                <View style={styles.optionIcon}>
                  <Icon name="images" size={32} color="#ed167e" />
                </View>
                <Text style={styles.optionTitle}>Choose from Gallery</Text>
                <Text style={styles.optionSubtitle}>Select an existing photo</Text>
              </TouchableOpacity>

              {/* WebRTC: Go Live Option - Updated to use navigation */}
              <TouchableOpacity
                style={[styles.option, styles.liveOption]}
                onPress={handleGoLive} // <-- Updated handler
              >
                <View style={[styles.optionIcon, styles.liveOptionIcon]}>
                  <Icon name="radio" size={32} color="#ff0000" />
                </View>
                <Text style={[styles.optionTitle, styles.liveOptionTitle]}>Go Live</Text>
                <Text style={styles.optionSubtitle}>Stream live with WebRTC to your followers</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </View>
  );
};

// Styles remain the same
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  headerButton: {
    padding: 8,
  },
  headerButtonText: {
    color: 'white',
    fontSize: 24,
    fontWeight: '300',
  },
  headerTitle: {
    flex: 1,
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  // Success Modal Styles
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.9)',
  },
  successContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    padding: 40,
    alignItems: 'center',
    marginHorizontal: 40,
    minWidth: 280,
  },
  successIcon: {
    marginBottom: 20,
  },
  successTitle: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  successSubtitle: {
    color: '#666',
    fontSize: 16,
    marginBottom: 30,
    textAlign: 'center',
    lineHeight: 22,
  },
  successButtons: {
    width: '100%',
    gap: 12,
  },
  createAnotherButton: {
    backgroundColor: '#ed167e',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  createAnotherText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  doneButton: {
    backgroundColor: 'transparent',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  doneText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  // Existing styles
  optionsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  title: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    color: '#666',
    fontSize: 16,
    marginBottom: 40,
    textAlign: 'center',
  },
  options: {
    width: '100%',
  },
  option: {
    backgroundColor: '#1a1a1a',
    padding: 24,
    borderRadius: 12,
    marginBottom: 16,
    alignItems: 'center',
  },
  // WebRTC: Live option styles
  liveOption: {
    borderWidth: 2,
    borderColor: '#ff0000',
    backgroundColor: 'rgba(255, 0, 0, 0.05)',
  },
  optionIcon: {
    width: 64,
    height: 64,
    backgroundColor: 'rgba(237, 22, 126, 0.1)',
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  // WebRTC: Live option icon styles
  liveOptionIcon: {
    backgroundColor: 'rgba(255, 0, 0, 0.1)',
    borderWidth: 2,
    borderColor: '#ff0000',
  },
  iconText: {
    fontSize: 32,
  },
  optionTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  // WebRTC: Live option title styles
  liveOptionTitle: {
    color: '#ff0000',
  },
  optionSubtitle: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
  },
  // Preview styles
  previewContainer: {
    flex: 1,
    position: 'relative',
  },
  previewImage: {
    width: width,
    height: height - 100, // Account for header
    resizeMode: 'cover',
  },
  textOverlay: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
  },
  textInput: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  actionButtons: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  resetButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  shareButton: {
    backgroundColor: '#ed167e',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 120,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  disabledButton: {
    opacity: 0.6,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default CreateStoryScreen;