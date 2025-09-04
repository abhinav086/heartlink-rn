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
  PanResponder,
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
} from 'react-native-vision-camera';
import { useFocusEffect } from '@react-navigation/native';
import Video from 'react-native-video';

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
  yellow: '#FFD700',
};

const CreateStoryScreen = () => {
  const navigation = useNavigation();
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [storyText, setStoryText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [showSuccessOptions, setShowSuccessOptions] = useState(false);
  const [cameraPosition, setCameraPosition] = useState('back');
  const [flash, setFlash] = useState('off');
  const [isCameraActive, setIsCameraActive] = useState(true);
  const [zoom, setZoom] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [maxRecordingTime] = useState(30); // 30 seconds max
  
  // Text overlay states
  const [showTextOverlay, setShowTextOverlay] = useState(false);
  const [textPosition, setTextPosition] = useState({ x: 100, y: 100 });
  const [textColor, setTextColor] = useState(COLORS.lightText);
  const [fontSize, setFontSize] = useState(24);
  
  // Capture mode state (photo or video)
  const [captureMode, setCaptureMode] = useState('photo'); // 'photo' or 'video'
  
  const cameraRef = useRef(null);
  const device = useCameraDevice(cameraPosition);
  const { hasPermission, requestPermission } = useCameraPermission();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const recordingTimer = useRef(null);
  const recordingProgress = useRef(new Animated.Value(0)).current;
  const shutterScale = useRef(new Animated.Value(1)).current;
  const pan = useRef(new Animated.ValueXY()).current;
  const videoRef = useRef(null);

  useFocusEffect(
    React.useCallback(() => {
      setIsCameraActive(true);
      return () => {
        setIsCameraActive(false);
        if (isRecording) {
          stopRecording();
        }
      };
    }, [])
  );

  useEffect(() => {
    requestPermissions();
  }, []);

  useEffect(() => {
    if (selectedMedia) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        easing: Easing.ease,
        useNativeDriver: true,
      }).start();
    } else {
      fadeAnim.setValue(0);
    }
  }, [selectedMedia, fadeAnim]);

  // PanResponder for dragging text
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: Animated.event(
        [null, { dx: pan.x, dy: pan.y }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: () => {
        pan.flattenOffset();
      },
    })
  ).current;

  const requestPermissions = async () => {
    if (Platform.OS === 'android') {
      try {
        const permissionsToRequest = [
          PermissionsAndroid.PERMISSIONS.CAMERA,
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        ];

        if (Platform.Version >= 33) {
          permissionsToRequest.push(PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES);
          permissionsToRequest.push(PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO);
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
            'Please grant camera, microphone and storage permissions to create stories.',
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

  // Toggle between photo and video modes
  const toggleCaptureMode = () => {
    if (isRecording) return; // Don't allow mode change during recording
    
    setCaptureMode(prev => prev === 'photo' ? 'video' : 'photo');
  };

  const toggleCamera = () => {
    if (isRecording) return; // Don't allow camera switch during recording
    
    const newPosition = cameraPosition === 'back' ? 'front' : 'back';
    setCameraPosition(newPosition);
    
    // Turn off flash when switching to front camera
    if (newPosition === 'front') {
      setFlash('off');
    }
  };

  const toggleFlash = () => {
    if (isRecording) return; // Don't allow flash change during recording
    
    setFlash(prev => {
      if (prev === 'off') return 'on';
      if (prev === 'on') return 'auto';
      return 'off';
    });
  };

  const takePhoto = async () => {
    if (isRecording) return; // Don't take photo while recording
    
    if (cameraRef.current && device) {
      try {
        const photo = await cameraRef.current.takePhoto({
          flash: flash,
          qualityPrioritization: 'quality',
        });
        setSelectedMedia({
          uri: `file://${photo.path}`,
          type: 'image/jpeg',
          fileName: `story_${Date.now()}.jpg`,
          mediaType: 'photo',
        });
      } catch (error) {
        console.error('Error taking photo:', error);
        Alert.alert('Camera Error', 'Failed to capture photo. Please try again.');
      }
    }
  };

  const startRecording = async () => {
    if (!cameraRef.current || !device || isRecording) return;

    try {
      setIsRecording(true);
      setRecordingDuration(0);
      
      // Animate shutter button scale
      Animated.timing(shutterScale, {
        toValue: 1.2,
        duration: 200,
        useNativeDriver: true,
      }).start();

      // Start progress animation
      Animated.timing(recordingProgress, {
        toValue: 1,
        duration: maxRecordingTime * 1000,
        useNativeDriver: false,
      }).start();

      // Start timer
      recordingTimer.current = setInterval(() => {
        setRecordingDuration(prev => {
          const newDuration = prev + 1;
          if (newDuration >= maxRecordingTime) {
            stopRecording();
          }
          return newDuration;
        });
      }, 1000);

      await cameraRef.current.startRecording({
        flash: flash,
        onRecordingFinished: (video) => {
          console.log('Recording finished:', video);
          setSelectedMedia({
            uri: `file://${video.path}`,
            type: 'video/mp4',
            fileName: `story_${Date.now()}.mp4`,
            mediaType: 'video',
          });
        },
        onRecordingError: (error) => {
          console.error('Recording error:', error);
          Alert.alert('Recording Error', 'Failed to record video. Please try again.');
          resetRecording();
        },
      });
    } catch (error) {
      console.error('Error starting recording:', error);
      Alert.alert('Recording Error', 'Failed to start recording. Please try again.');
      resetRecording();
    }
  };

  const stopRecording = async () => {
    if (!isRecording) return;

    try {
      if (cameraRef.current) {
        await cameraRef.current.stopRecording();
      }
    } catch (error) {
      console.error('Error stopping recording:', error);
    } finally {
      resetRecording();
    }
  };

  const resetRecording = () => {
    setIsRecording(false);
    setRecordingDuration(0);
    
    if (recordingTimer.current) {
      clearInterval(recordingTimer.current);
      recordingTimer.current = null;
    }

    // Reset animations
    Animated.timing(shutterScale, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();

    recordingProgress.setValue(0);
  };

  const openGallery = () => {
    if (isRecording) return; // Don't open gallery during recording
    
    const options = {
      mediaType: 'mixed', // Allow both photos and videos
      quality: 0.8,
      maxWidth: 1080,
      maxHeight: 1920,
      includeBase64: false,
      videoQuality: 'medium',
      durationLimit: maxRecordingTime,
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
        const asset = response.assets[0];
        console.log('Gallery media selected:', asset.uri);
        setSelectedMedia({
          ...asset,
          mediaType: asset.type.startsWith('image/') ? 'photo' : 'video',
        });
      }
    });
  };

  const handleGoLive = () => {
    if (isRecording) return; // Don't navigate during recording
    
    console.log('Go Live pressed - navigating to CreateLiveStream screen');
    navigation.navigate('CreateLiveStream');
  };

  // Handle shutter button press based on mode
  const handleShutterPress = () => {
    if (captureMode === 'photo') {
      takePhoto();
    } else {
      // For video mode, start/stop recording
      if (isRecording) {
        stopRecording();
      } else {
        startRecording();
      }
    }
  };

  const uploadStory = async () => {
    if (!selectedMedia) {
      Alert.alert('Error', 'Please select an image or video for your story');
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
        uri: selectedMedia.uri,
        type: selectedMedia.type || (selectedMedia.mediaType === 'video' ? 'video/mp4' : 'image/jpeg'),
        name: selectedMedia.fileName || `story_${Date.now()}.${selectedMedia.mediaType === 'video' ? 'mp4' : 'jpg'}`,
      });

      // Send text content for videos (since we can't embed text in videos)
      if (selectedMedia.mediaType === 'video' && storyText.trim()) {
        formData.append('content', storyText.trim());
      }

      // Add media type to help backend processing
      formData.append('mediaType', selectedMedia.mediaType);

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
    setSelectedMedia(null);
    setStoryText('');
    resetRecording();
    setShowTextOverlay(false);
    setTextPosition({ x: 100, y: 100 });
    setTextColor(COLORS.lightText);
    setFontSize(24);
    pan.setValue({ x: 0, y: 0 });
  };

  const handleCreateAnother = () => {
    setShowSuccessOptions(false);
  };

  const handleDone = () => {
    setShowSuccessOptions(false);
    navigation.goBack();
  };

  // Text overlay functions
  const addTextToStory = () => {
    setShowTextOverlay(true);
    pan.setOffset({
      x: textPosition.x,
      y: textPosition.y,
    });
    pan.setValue({ x: 0, y: 0 });
  };

  const updateTextPosition = () => {
    pan.addListener(value => {
      setTextPosition({
        x: value.x,
        y: value.y,
      });
    });
    return () => {
      pan.removeAllListeners();
    };
  };

  useEffect(() => {
    if (showTextOverlay) {
      updateTextPosition();
    }
  }, [showTextOverlay]);

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

  if (selectedMedia) {
    return (
      <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />
        
        {selectedMedia.mediaType === 'video' ? (
          <View style={styles.videoContainer}>
            <Video
              ref={videoRef}
              source={{ uri: selectedMedia.uri }}
              style={styles.previewVideoBackground}
              resizeMode="cover"
              repeat
              muted
            />
            {/* Text Overlay for videos */}
            {showTextOverlay && (
              <Animated.View
                style={[
                  styles.textOverlay,
                  {
                    transform: [{ translateX: pan.x }, { translateY: pan.y }],
                  },
                ]}
                {...panResponder.panHandlers}
              >
                <Text
                  style={[
                    styles.storyText,
                    {
                      color: textColor,
                      fontSize: fontSize,
                    },
                  ]}
                >
                  {storyText || 'Your text here'}
                </Text>
              </Animated.View>
            )}
          </View>
        ) : (
          <ImageBackground source={{ uri: selectedMedia.uri }} style={styles.previewImageBackground}>
          </ImageBackground>
        )}
        
        <View style={styles.previewOverlay}>
          <View style={styles.previewHeader}>
            <TouchableOpacity style={styles.headerIconContainer} onPress={resetStory}>
              <Icon name="arrow-back" size={28} color={COLORS.lightText} />
            </TouchableOpacity>
            {selectedMedia.mediaType === 'video' && (
              <View style={styles.mediaTypeIndicator}>
                <Icon name="videocam" size={20} color={COLORS.lightText} />
                <Text style={styles.mediaTypeText}>Video</Text>
              </View>
            )}
          </View>

          {/* Text Input and Controls */}
          <View style={styles.textInputContainer}>
            <TextInput
              style={styles.textInput}
              placeholder="Add text to your story..."
              placeholderTextColor={COLORS.mediumText}
              value={storyText}
              onChangeText={setStoryText}
              multiline
            />
            <View style={styles.textControls}>
              <TouchableOpacity
                style={styles.colorButton}
                onPress={() => setTextColor(COLORS.lightText)}
              >
                <View
                  style={[
                    styles.colorPreview,
                    { backgroundColor: COLORS.lightText },
                    textColor === COLORS.lightText && styles.selectedColor,
                  ]}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.colorButton}
                onPress={() => setTextColor(COLORS.red)}
              >
                <View
                  style={[
                    styles.colorPreview,
                    { backgroundColor: COLORS.red },
                    textColor === COLORS.red && styles.selectedColor,
                  ]}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.colorButton}
                onPress={() => setTextColor(COLORS.yellow)}
              >
                <View
                  style={[
                    styles.colorPreview,
                    { backgroundColor: COLORS.yellow },
                    textColor === COLORS.yellow && styles.selectedColor,
                  ]}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.fontSizeButton}
                onPress={() => setFontSize(prev => (prev > 16 ? prev - 4 : prev))}
              >
                <Text style={styles.fontSizeText}>A-</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.fontSizeButton}
                onPress={() => setFontSize(prev => (prev < 32 ? prev + 4 : prev))}
              >
                <Text style={styles.fontSizeText}>A+</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.previewFooter}>
            {!showTextOverlay ? (
              <TouchableOpacity
                style={styles.addTextButton}
                onPress={addTextToStory}
              >
                <Icon name="text" size={24} color={COLORS.lightText} />
                <Text style={styles.addTextButtonText}>Add Text</Text>
              </TouchableOpacity>
            ) : (
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
            )}
          </View>
        </View>
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
          video
          audio
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

      {/* Recording overlay */}
      {isRecording && (
        <View style={styles.recordingOverlay}>
          <View style={styles.recordingIndicator}>
            <View style={styles.recordingDot} />
            <Text style={styles.recordingText}>Recording</Text>
            <Text style={styles.recordingDuration}>{recordingDuration}s</Text>
          </View>
          <View style={styles.recordingProgressContainer}>
            <Animated.View 
              style={[
                styles.recordingProgressBar,
                {
                  width: recordingProgress.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  })
                }
              ]} 
            />
          </View>
        </View>
      )}

      {/* Header */}
      <View style={styles.creatorHeader}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="close" size={30} color={COLORS.lightText} />
        </TouchableOpacity>
        <Text style={styles.creatorTitle}>New Story</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Capture Mode Toggle */}
      {!isRecording && (
        <View style={styles.captureModeContainer}>
          <View style={styles.captureModeToggle}>
            <TouchableOpacity
              style={[
                styles.captureModeButton,
                captureMode === 'photo' && styles.activeModeButton
              ]}
              onPress={() => setCaptureMode('photo')}
            >
              <Icon 
                name="camera" 
                size={20} 
                color={captureMode === 'photo' ? COLORS.black : COLORS.lightText} 
              />
              <Text style={[
                styles.captureModeText,
                captureMode === 'photo' && styles.activeModeText
              ]}>
                Photo
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.captureModeButton,
                captureMode === 'video' && styles.activeModeButton
              ]}
              onPress={() => setCaptureMode('video')}
            >
              <Icon 
                name="videocam" 
                size={20} 
                color={captureMode === 'video' ? COLORS.black : COLORS.lightText} 
              />
              <Text style={[
                styles.captureModeText,
                captureMode === 'video' && styles.activeModeText
              ]}>
                Video
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Camera Controls */}
      <View style={styles.creatorControls}>
        <View style={styles.leftControls}>
          <TouchableOpacity 
            style={[styles.controlButton, isRecording && styles.disabledControl]} 
            onPress={openGallery}
            disabled={isRecording}
          >
            <Icon name="images-outline" size={28} color={isRecording ? COLORS.mediumText : COLORS.lightText} />
            <Text style={[styles.controlButtonText, isRecording && styles.disabledControlText]}>Gallery</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.shutterButtonContainer}>
          <TouchableOpacity
            style={[
              styles.shutterButton,
              isRecording && styles.recordingShutterButton,
              captureMode === 'video' && !isRecording && styles.videoModeShutterButton
            ]}
            onPress={handleShutterPress}
          >
            <View style={[
              styles.shutterButtonInner, 
              isRecording && styles.recordingShutterInner,
              captureMode === 'video' && !isRecording && styles.videoModeShutterInner
            ]} />
          </TouchableOpacity>
          <Text style={styles.shutterInstruction}>
            {captureMode === 'photo' 
              ? 'Tap to take photo'
              : isRecording 
                ? 'Tap to stop recording' 
                : 'Tap to start recording'
            }
          </Text>
        </View>

        <View style={styles.rightControls}>
          <TouchableOpacity 
            style={[styles.controlButton, isRecording && styles.disabledControl]} 
            onPress={toggleCamera}
            disabled={isRecording}
          >
            <Icon name="camera-reverse-outline" size={28} color={isRecording ? COLORS.mediumText : COLORS.lightText} />
            <Text style={[styles.controlButtonText, isRecording && styles.disabledControlText]}>Flip</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Go Live Button */}
      {!isRecording && (
        <View style={styles.liveButtonContainer}>
          <TouchableOpacity style={styles.liveButton} onPress={handleGoLive}>
            <Icon name="radio" size={24} color={COLORS.red} />
            <Text style={styles.liveButtonText}>Go Live</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Flash Toggle - only show for back camera */}
      {cameraPosition === 'back' && !isRecording && (
        <View style={styles.sideControls}>
          <TouchableOpacity style={styles.sideControlButton} onPress={toggleFlash}>
            <Icon 
              name={flash === 'on' ? 'flash' : flash === 'auto' ? 'flash-outline' : 'flash-off'} 
              size={24} 
              color={flash === 'off' ? COLORS.mediumText : COLORS.lightText} 
            />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.black,
  },
  videoContainer: {
    flex: 1,
    position: 'relative',
  },
  // --- Creator Screen Styles ---
  creatorHeader: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 80 : 50,
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
    width: 30,
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
  // Capture Mode Toggle Styles
  captureModeContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 140 : 120,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 5,
  },
  captureModeToggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 25,
    padding: 4,
    gap: 4,
  },
  captureModeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  activeModeButton: {
    backgroundColor: COLORS.lightText,
  },
  captureModeText: {
    color: COLORS.lightText,
    fontSize: 14,
    fontWeight: '600',
  },
  activeModeText: {
    color: COLORS.black,
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
  disabledControl: {
    opacity: 0.5,
  },
  disabledControlText: {
    color: COLORS.mediumText,
  },
  shutterButtonContainer: {
    alignItems: 'center',
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
  recordingShutterButton: {
    borderColor: COLORS.red,
  },
  videoModeShutterButton: {
    borderColor: COLORS.red,
  },
  shutterButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.lightText,
    borderWidth: 2,
    borderColor: COLORS.black,
  },
  recordingShutterInner: {
    backgroundColor: COLORS.red,
    borderRadius: 8,
    width: 30,
    height: 30,
  },
  videoModeShutterInner: {
    backgroundColor: COLORS.red,
    borderRadius: 30,
  },
  shutterInstruction: {
    color: COLORS.lightText,
    fontSize: 10,
    marginTop: 8,
    textAlign: 'center',
    opacity: 0.8,
  },
  // Recording overlay styles
  recordingOverlay: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 180 : 160,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 15,
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.red,
    opacity: 1,
  },
  recordingText: {
    color: COLORS.lightText,
    fontSize: 14,
    fontWeight: '600',
  },
  recordingDuration: {
    color: COLORS.lightText,
    fontSize: 14,
    fontWeight: 'bold',
  },
  recordingProgressContainer: {
    width: width - 40,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    marginTop: 12,
    overflow: 'hidden',
  },
  recordingProgressBar: {
    height: '100%',
    backgroundColor: COLORS.red,
    borderRadius: 2,
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
  },
  previewVideoBackground: {
    flex: 1,
    width: width,
    height: height,
  },
  previewOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingTop: Platform.OS === 'ios' ? 80 : 50,
  },
  headerIconContainer: {
    backgroundColor: 'rgba(0,0,0,0.4)',
    padding: 8,
    borderRadius: 50,
  },
  mediaTypeIndicator: {
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  mediaTypeText: {
    color: COLORS.lightText,
    fontSize: 12,
    fontWeight: '600',
  },
  // Text Overlay Styles
  textOverlay: {
    position: 'absolute',
    zIndex: 10,
    top: 100,
    left: 100,
  },
  storyText: {
    fontWeight: 'bold',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  // Text Input and Controls
  textInputContainer: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 10,
    marginHorizontal: 20,
  },
  textInput: {
    color: COLORS.lightText,
    fontSize: 16,
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.mediumText,
    marginBottom: 10,
  },
  textControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  colorButton: {
    padding: 5,
  },
  colorPreview: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedColor: {
    borderColor: COLORS.lightText,
  },
  fontSizeButton: {
    backgroundColor: COLORS.darkSecondary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  fontSizeText: {
    color: COLORS.lightText,
    fontWeight: 'bold',
  },
  // Preview Footer
  previewFooter: {
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  addTextButton: {
    backgroundColor: COLORS.darkSecondary,
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  addTextButtonText: {
    color: COLORS.lightText,
    fontSize: 18,
    fontWeight: 'bold',
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