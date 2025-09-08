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
import { captureRef } from 'react-native-view-shot';

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
  blue: '#007AFF',
  green: '#34C759',
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
  const [isEditingText, setIsEditingText] = useState(false);
  const [textPosition, setTextPosition] = useState({ x: width/2 - 100, y: height/2 - 100 });
  const [textColor, setTextColor] = useState(COLORS.lightText);
  const [fontSize, setFontSize] = useState(28);
  const [textAlign, setTextAlign] = useState('center');
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  
  // Capture mode state (photo or video)
  const [captureMode, setCaptureMode] = useState('photo'); // 'photo' or 'video'
  
  const cameraRef = useRef(null);
  const device = useCameraDevice(cameraPosition);
  const { hasPermission, requestPermission } = useCameraPermission();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const recordingTimer = useRef(null);
  const recordingProgress = useRef(new Animated.Value(0)).current;
  const shutterScale = useRef(new Animated.Value(1)).current;
  const pan = useRef(new Animated.ValueXY({ x: width/2 - 100, y: height/2 - 100 })).current;
  const videoRef = useRef(null);
  const textInputRef = useRef(null);
  const previewContainerRef = useRef(null);

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
  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => showTextOverlay && !isEditingText,
    onMoveShouldSetPanResponder: () => showTextOverlay && !isEditingText,
    onPanResponderGrant: (evt, gestureState) => {
      pan.setOffset({
        x: pan.x._value,
        y: pan.y._value,
      });
    },
    onPanResponderMove: Animated.event(
      [null, { dx: pan.x, dy: pan.y }],
      { useNativeDriver: false }
    ),
    onPanResponderRelease: (evt, gestureState) => {
      pan.flattenOffset();
      // Update text position state for consistency
      setTextPosition({
        x: pan.x._value,
        y: pan.y._value,
      });
    },
  });

  const requestPermissions = async () => {
    if (Platform.OS === 'android') {
      try {
        const permissionsToRequest = [
          PermissionsAndroid.PERMISSIONS.CAMERA,
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
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

  // Create composite image with text embedded
  const createCompositeImage = async () => {
    if (!previewContainerRef.current || !selectedMedia) {
      throw new Error('Preview container not ready');
    }

    try {
      setIsProcessingImage(true);
      
      // Capture the entire preview container as an image
      const imageUri = await captureRef(previewContainerRef.current, {
        format: 'jpg',
        quality: 0.9,
        width: width,
        height: height,
      });

      console.log('Composite image created:', imageUri);
      return imageUri;
    } catch (error) {
      console.error('Error creating composite image:', error);
      throw error;
    } finally {
      setIsProcessingImage(false);
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

      let finalMediaUri = selectedMedia.uri;
      let finalMediaType = selectedMedia.type;
      let finalFileName = selectedMedia.fileName;

      // If it's an image with text overlay, create composite image
      if (selectedMedia.mediaType === 'photo' && showTextOverlay && storyText.trim()) {
        console.log('Creating composite image with embedded text...');
        finalMediaUri = await createCompositeImage();
        finalMediaType = 'image/jpeg';
        finalFileName = `story_composite_${Date.now()}.jpg`;
      }

      const formData = new FormData();
      formData.append('media', {
        uri: finalMediaUri,
        type: finalMediaType,
        name: finalFileName,
      });

      // For videos, still send text content separately since we can't embed in video
      if (selectedMedia.mediaType === 'video' && storyText.trim()) {
        formData.append('content', storyText.trim());
        formData.append('textOverlay', JSON.stringify({
          text: storyText.trim(),
          position: textPosition,
          color: textColor,
          fontSize: fontSize,
          textAlign: textAlign,
        }));
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
    setIsEditingText(false);
    setIsProcessingImage(false);
    setTextPosition({ x: width/2 - 100, y: height/2 - 100 });
    setTextColor(COLORS.lightText);
    setFontSize(28);
    setTextAlign('center');
    pan.setValue({ x: width/2 - 100, y: height/2 - 100 });
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
    setIsEditingText(true);
    // Reset text position to center
    const centerPosition = { x: width/2 - 100, y: height/2 - 100 };
    setTextPosition(centerPosition);
    pan.setValue(centerPosition);
    
    // Auto focus text input after a small delay
    setTimeout(() => {
      if (textInputRef.current) {
        textInputRef.current.focus();
      }
    }, 100);
  };

  const finishEditingText = () => {
    if (!storyText.trim()) {
      // If no text entered, remove text overlay
      removeTextFromStory();
    } else {
      setIsEditingText(false);
    }
  };

  const removeTextFromStory = () => {
    setShowTextOverlay(false);
    setIsEditingText(false);
    setStoryText('');
    pan.setValue({ x: width/2 - 100, y: height/2 - 100 });
  };

  const handleTextAlign = () => {
    if (textAlign === 'center') {
      setTextAlign('left');
    } else if (textAlign === 'left') {
      setTextAlign('right');
    } else {
      setTextAlign('center');
    }
  };

  if (showSuccessOptions) {
    return (
      <View style={styles.successContainer}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />
        <View style={styles.successContent}>
          <MaterialIcon name="check-circle" size={60} color={COLORS.primary} style={styles.successIcon} />
          <Text style={styles.successTitle}>Story Posted!</Text>
          <Text style={styles.successSubtitle}>Your story has been shared successfully with embedded text.</Text>
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
        
        {/* Preview Container - This will be captured as composite image */}
        <View 
          ref={previewContainerRef}
          style={styles.previewContainer}
          collapsable={false}
        >
          {selectedMedia.mediaType === 'video' ? (
            <Video
              ref={videoRef}
              source={{ uri: selectedMedia.uri }}
              style={styles.previewMediaBackground}
              resizeMode="cover"
              repeat
              muted
            />
          ) : (
            <ImageBackground 
              source={{ uri: selectedMedia.uri }} 
              style={styles.previewMediaBackground}
              resizeMode="cover"
            />
          )}

          {/* Text Overlay for both images and videos */}
          {showTextOverlay && storyText.trim() && (
            <Animated.View
              style={[
                styles.textOverlay,
                {
                  transform: [
                    { translateX: pan.x },
                    { translateY: pan.y }
                  ],
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
                    textAlign: textAlign,
                  },
                ]}
              >
                {storyText}
              </Text>
              {!isEditingText && (
                <View style={styles.dragIndicator}>
                  <Icon name="move" size={16} color={COLORS.lightText} />
                </View>
              )}
            </Animated.View>
          )}
        </View>
        
        <View style={styles.previewOverlay}>
          <View style={styles.previewHeader}>
            <TouchableOpacity style={styles.headerIconContainer} onPress={resetStory}>
              <Icon name="arrow-back" size={28} color={COLORS.lightText} />
            </TouchableOpacity>
            
            <View style={styles.headerCenter}>
              {selectedMedia.mediaType === 'video' && (
                <View style={styles.mediaTypeIndicator}>
                  <Icon name="videocam" size={20} color={COLORS.lightText} />
                  <Text style={styles.mediaTypeText}>Video</Text>
                </View>
              )}
              {selectedMedia.mediaType === 'photo' && showTextOverlay && (
                <View style={styles.mediaTypeIndicator}>
                  <Icon name="text" size={20} color={COLORS.lightText} />
                  <Text style={styles.mediaTypeText}>Text Embedded</Text>
                </View>
              )}
            </View>

            {showTextOverlay && (
              <TouchableOpacity style={styles.headerIconContainer} onPress={removeTextFromStory}>
                <Icon name="trash-outline" size={24} color={COLORS.red} />
              </TouchableOpacity>
            )}
          </View>

          {/* Text Editing Panel */}
          {isEditingText && (
            <View style={styles.textEditingPanel}>
              <View style={styles.panelHeader}>
                <Icon name="text" size={24} color={COLORS.primary} />
                <Text style={styles.panelTitle}>Add Text to Story</Text>
              </View>
              
              <View style={styles.textInputWrapper}>
                <TextInput
                  ref={textInputRef}
                  style={styles.textInput}
                  placeholder="Type your text here..."
                  placeholderTextColor={COLORS.mediumText}
                  value={storyText}
                  onChangeText={setStoryText}
                  multiline
                  maxLength={100}
                  onBlur={finishEditingText}
                />
                <Text style={styles.characterCount}>{storyText.length}/100</Text>
              </View>
              
              <View style={styles.textControls}>
                <Text style={styles.controlLabel}>Colors</Text>
                <View style={styles.colorControls}>
                  {[COLORS.lightText, COLORS.red, COLORS.yellow, COLORS.blue, COLORS.green, COLORS.primary].map((color, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.colorButton}
                      onPress={() => setTextColor(color)}
                    >
                      <View
                        style={[
                          styles.colorPreview,
                          { backgroundColor: color },
                          textColor === color && styles.selectedColor,
                        ]}
                      />
                    </TouchableOpacity>
                  ))}
                </View>
                
                <Text style={styles.controlLabel}>Style</Text>
                <View style={styles.textOptions}>
                  <TouchableOpacity
                    style={[styles.textOptionButton, fontSize <= 20 && styles.disabledOption]}
                    onPress={() => setFontSize(prev => Math.max(20, prev - 4))}
                    disabled={fontSize <= 20}
                  >
                    <Text style={styles.textOptionText}>A-</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.textOptionButton, fontSize >= 40 && styles.disabledOption]}
                    onPress={() => setFontSize(prev => Math.min(40, prev + 4))}
                    disabled={fontSize >= 40}
                  >
                    <Text style={styles.textOptionText}>A+</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={styles.textOptionButton}
                    onPress={handleTextAlign}
                  >
                    <Icon 
                      name={
                        textAlign === 'center' ? 'text-outline' : 
                        textAlign === 'left' ? 'chevron-back-outline' : 
                        'chevron-forward-outline'
                      } 
                      size={20} 
                      color={COLORS.lightText} 
                    />
                  </TouchableOpacity>
                </View>
              </View>
              
              <TouchableOpacity
                style={styles.doneEditingButton}
                onPress={finishEditingText}
              >
                <Icon name="checkmark" size={20} color={COLORS.lightText} />
                <Text style={styles.doneEditingText}>Apply Text</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.previewFooter}>
            {!showTextOverlay ? (
              <View style={styles.footerActions}>
                <TouchableOpacity
                  style={styles.addTextButton}
                  onPress={addTextToStory}
                >
                  <View style={styles.addTextIcon}>
                    <Icon name="text" size={20} color={COLORS.primary} />
                  </View>
                  <Text style={styles.addTextButtonText}>Add Text</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.postButton, (uploading || isProcessingImage) && styles.disabledButton]}
                  onPress={uploadStory}
                  disabled={uploading || isProcessingImage}
                >
                  {uploading || isProcessingImage ? (
                    <ActivityIndicator size="small" color={COLORS.lightText} />
                  ) : (
                    <>
                      <Icon name="paper-plane" size={20} color={COLORS.lightText} />
                      <Text style={styles.postButtonText}>Share Story</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            ) : !isEditingText ? (
              <TouchableOpacity
                style={[styles.postButton, (uploading || isProcessingImage) && styles.disabledButton]}
                onPress={uploadStory}
                disabled={uploading || isProcessingImage}
              >
                {uploading ? (
                  <View style={styles.uploadingContainer}>
                    <ActivityIndicator size="small" color={COLORS.lightText} />
                    <Text style={styles.uploadingText}>
                      {isProcessingImage ? 'Embedding text...' : 'Uploading...'}
                    </Text>
                  </View>
                ) : (
                  <>
                    <Icon name="paper-plane" size={20} color={COLORS.lightText} />
                    <Text style={styles.postButtonText}>Share with Text</Text>
                  </>
                )}
              </TouchableOpacity>
            ) : null}
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
  previewContainer: {
    flex: 1,
    width: width,
    height: height,
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
  previewMediaBackground: {
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
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerIconContainer: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 10,
    borderRadius: 50,
  },
  mediaTypeIndicator: {
    backgroundColor: 'rgba(0,0,0,0.6)',
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
    maxWidth: width - 80,
    minWidth: 120,
    zIndex: 20,
  },
  storyText: {
    fontWeight: '800',
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 6,
    lineHeight: 36,
    padding: 8,
  },
  dragIndicator: {
    position: 'absolute',
    top: -15,
    right: -15,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 15,
    padding: 6,
  },
  // Text Editing Panel
  textEditingPanel: {
    backgroundColor: 'rgba(0,0,0,0.95)',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    paddingHorizontal: 25,
    paddingTop: 25,
    paddingBottom: 15,
    marginTop: 'auto',
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 10,
  },
  panelTitle: {
    color: COLORS.lightText,
    fontSize: 18,
    fontWeight: '600',
  },
  textInputWrapper: {
    marginBottom: 25,
  },
  textInput: {
    color: COLORS.lightText,
    fontSize: 18,
    padding: 18,
    borderWidth: 2,
    borderColor: COLORS.primary,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.1)',
    minHeight: 70,
    maxHeight: 140,
    textAlignVertical: 'top',
  },
  characterCount: {
    color: COLORS.mediumText,
    fontSize: 12,
    textAlign: 'right',
    marginTop: 8,
  },
  textControls: {
    marginBottom: 25,
  },
  controlLabel: {
    color: COLORS.lightText,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
  },
  colorControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  colorButton: {
    padding: 6,
  },
  colorPreview: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 3,
    borderColor: 'transparent',
  },
  selectedColor: {
    borderColor: COLORS.lightText,
  },
  textOptions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  textOptionButton: {
    backgroundColor: COLORS.darkSecondary,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 10,
    minWidth: 60,
    alignItems: 'center',
  },
  disabledOption: {
    opacity: 0.5,
  },
  textOptionText: {
    color: COLORS.lightText,
    fontSize: 16,
    fontWeight: 'bold',
  },
  doneEditingButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  doneEditingText: {
    color: COLORS.lightText,
    fontSize: 16,
    fontWeight: '600',
  },
  // Preview Footer
  previewFooter: {
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  footerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  addTextButton: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 2,
    borderColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  addTextIcon: {
    backgroundColor: COLORS.lightText,
    borderRadius: 15,
    padding: 6,
  },
  addTextButtonText: {
    color: COLORS.lightText,
    fontSize: 16,
    fontWeight: '600',
  },
  postButton: {
    flex: 1,
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  postButtonText: {
    color: COLORS.lightText,
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.6,
  },
  uploadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  uploadingText: {
    color: COLORS.lightText,
    fontSize: 14,
    fontWeight: '600',
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