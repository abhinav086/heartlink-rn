import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Animated,
  Dimensions,
  Platform,
  Modal,
  StatusBar,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

// Import RNCamera if available
let RNCamera;
try {
  RNCamera = require('react-native-camera').RNCamera;
} catch (e) {
  console.log('RNCamera not installed');
}

const { width, height } = Dimensions.get('window');

const VideoRecorder = ({ 
  onVideoRecorded, 
  onPhotoTaken, 
  disabled = false,
  onRecordingStateChange 
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [showCamera, setShowCamera] = useState(false);
  const [isPhoto, setIsPhoto] = useState(false);
  const [cameraType, setCameraType] = useState('back');
  const [hasPermission, setHasPermission] = useState(null);
  
  const cameraRef = useRef(null);
  const recordingTimerRef = useRef(null);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    checkPermissions();
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, []);

  const checkPermissions = async () => {
    try {
      if (Platform.OS === 'android') {
        const { PermissionsAndroid } = require('react-native');
        const cameraGranted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            title: 'Camera Permission',
            message: 'This app needs access to camera to record videos and take photos.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        
        const audioGranted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          {
            title: 'Microphone Permission',
            message: 'This app needs access to microphone to record videos with audio.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );

        const storageGranted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
          {
            title: 'Storage Permission',
            message: 'This app needs access to storage to save videos and photos.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );

        setHasPermission(
          cameraGranted === PermissionsAndroid.RESULTS.GRANTED &&
          audioGranted === PermissionsAndroid.RESULTS.GRANTED &&
          storageGranted === PermissionsAndroid.RESULTS.GRANTED
        );
      } else {
        // For iOS, permissions are handled by RNCamera component
        setHasPermission(true);
      }
    } catch (err) {
      console.warn(err);
      setHasPermission(false);
    }
  };

  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const stopPulseAnimation = () => {
    pulseAnim.stopAnimation();
    Animated.timing(pulseAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  const openCamera = () => {
    if (!RNCamera) {
      Alert.alert(
        'Camera Not Available',
        'Please install react-native-camera to use video recording features.',
        [{ text: 'OK' }]
      );
      return;
    }

    if (hasPermission === false) {
      Alert.alert(
        'Permission Required',
        'Camera and microphone permissions are required to record videos.',
        [
          { text: 'Cancel' },
          { text: 'Settings', onPress: () => checkPermissions() }
        ]
      );
      return;
    }

    setShowCamera(true);
    setIsPhoto(false);
  };

  const closeCamera = () => {
    if (isRecording) {
      stopVideoRecording();
    }
    setShowCamera(false);
    setRecordingTime(0);
  };

  const startVideoRecording = async () => {
    if (!cameraRef.current || isRecording) return;

    try {
      setIsRecording(true);
      setRecordingTime(0);
      onRecordingStateChange?.(true);
      
      startPulseAnimation();
      
      // Start timer
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          const newTime = prev + 1;
          // Auto-stop at 60 seconds
          if (newTime >= 60) {
            stopVideoRecording();
          }
          return newTime;
        });
      }, 1000);

      const options = {
        quality: RNCamera.Constants.VideoQuality['720p'],
        maxDuration: 60, // 60 seconds max
        maxFileSize: 50 * 1024 * 1024, // 50MB max
        videoBitrate: 2000000, // 2Mbps
        audioBitrate: 128000, // 128kbps
      };

      const data = await cameraRef.current.recordAsync(options);
      
      if (data && data.uri) {
        const videoFile = {
          uri: data.uri,
          type: 'video/mp4',
          name: `video_${Date.now()}.mp4`,
          size: null, // Will be calculated by the system
        };
        
        onVideoRecorded?.(videoFile, recordingTime);
      }
      
    } catch (error) {
      console.error('Video recording error:', error);
      Alert.alert('Recording Error', 'Failed to record video. Please try again.');
    } finally {
      setIsRecording(false);
      stopPulseAnimation();
      onRecordingStateChange?.(false);
      setShowCamera(false);
      setRecordingTime(0);
      
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    }
  };

  const stopVideoRecording = async () => {
    if (!cameraRef.current || !isRecording) return;

    try {
      await cameraRef.current.stopRecording();
    } catch (error) {
      console.error('Error stopping video recording:', error);
    }
  };

  const takePhoto = async () => {
    if (!cameraRef.current) return;

    try {
      const options = {
        quality: 0.8,
        width: 1024,
        height: 1024,
        exif: false,
      };

      const data = await cameraRef.current.takePictureAsync(options);
      
      if (data && data.uri) {
        const photoFile = {
          uri: data.uri,
          type: 'image/jpeg',
          name: `photo_${Date.now()}.jpg`,
        };
        
        onPhotoTaken?.(photoFile);
        setShowCamera(false);
      }
    } catch (error) {
      console.error('Photo capture error:', error);
      Alert.alert('Photo Error', 'Failed to take photo. Please try again.');
    }
  };

  const toggleCameraType = () => {
    setCameraType(prev => prev === 'back' ? 'front' : 'back');
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePressIn = () => {
    if (disabled) return;
    
    Animated.spring(scaleAnim, {
      toValue: 0.9,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  const renderCameraInterface = () => {
    if (!RNCamera) return null;

    return (
      <Modal
        visible={showCamera}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={closeCamera}
      >
        <StatusBar hidden />
        <View style={styles.cameraContainer}>
          <RNCamera
            ref={cameraRef}
            style={styles.camera}
            type={cameraType === 'back' ? RNCamera.Constants.Type.back : RNCamera.Constants.Type.front}
            flashMode={RNCamera.Constants.FlashMode.auto}
            androidCameraPermissionOptions={{
              title: 'Permission to use camera',
              message: 'We need your permission to use your camera',
              buttonPositive: 'Ok',
              buttonNegative: 'Cancel',
            }}
            androidRecordAudioPermissionOptions={{
              title: 'Permission to use audio recording',
              message: 'We need your permission to use your audio',
              buttonPositive: 'Ok',
              buttonNegative: 'Cancel',
            }}
            onMountError={(error) => {
              console.error('Camera mount error:', error);
              Alert.alert('Camera Error', 'Failed to initialize camera');
              closeCamera();
            }}
          />
          
          {/* Camera Overlay */}
          <View style={styles.cameraOverlay}>
            {/* Top Controls */}
            <View style={styles.topControls}>
              <TouchableOpacity style={styles.closeButton} onPress={closeCamera}>
                <Ionicons name="close" size={30} color="white" />
              </TouchableOpacity>
              
              {isRecording && (
                <View style={styles.recordingIndicator}>
                  <View style={styles.recordingDot} />
                  <Text style={styles.recordingTime}>{formatTime(recordingTime)}</Text>
                </View>
              )}
              
              <TouchableOpacity style={styles.flipButton} onPress={toggleCameraType}>
                <Ionicons name="camera-reverse" size={30} color="white" />
              </TouchableOpacity>
            </View>

            {/* Mode Toggle */}
            <View style={styles.modeToggle}>
              <TouchableOpacity
                style={[styles.modeButton, !isPhoto && styles.activeModeButton]}
                onPress={() => setIsPhoto(false)}
              >
                <Text style={[styles.modeText, !isPhoto && styles.activeModeText]}>VIDEO</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeButton, isPhoto && styles.activeModeButton]}
                onPress={() => setIsPhoto(true)}
              >
                <Text style={[styles.modeText, isPhoto && styles.activeModeText]}>PHOTO</Text>
              </TouchableOpacity>
            </View>

            {/* Bottom Controls */}
            <View style={styles.bottomControls}>
              {isPhoto ? (
                <TouchableOpacity style={styles.captureButton} onPress={takePhoto}>
                  <View style={styles.captureButtonInner} />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.recordButton}
                  onPressIn={startVideoRecording}
                  onPressOut={stopVideoRecording}
                  disabled={isRecording}
                >
                  <Animated.View
                    style={[
                      styles.recordButtonInner,
                      {
                        transform: [{ scale: pulseAnim }],
                        backgroundColor: isRecording ? '#FF4444' : '#FF6B9D',
                      },
                    ]}
                  />
                  {isRecording && <View style={styles.recordingSquare} />}
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <View>
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <TouchableOpacity
          style={[styles.videoButton, disabled && styles.disabledButton]}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          onPress={openCamera}
          disabled={disabled}
        >
          <Ionicons 
            name="videocam" 
            size={24} 
            color={disabled ? "#666" : "#FF6B9D"} 
          />
        </TouchableOpacity>
      </Animated.View>
      
      {renderCameraInterface()}
    </View>
  );
};

const styles = StyleSheet.create({
  videoButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2C2C2E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabledButton: {
    opacity: 0.6,
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: 'black',
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
  },
  topControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 20,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  flipButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF4444',
    marginRight: 8,
  },
  recordingTime: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  modeToggle: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 20,
    margin: 20,
    alignSelf: 'center',
  },
  modeButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 16,
  },
  activeModeButton: {
    backgroundColor: '#FF6B9D',
  },
  modeText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    fontWeight: '600',
  },
  activeModeText: {
    color: 'white',
  },
  bottomControls: {
    alignItems: 'center',
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  captureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'white',
  },
  captureButtonInner: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'white',
  },
  recordButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'white',
  },
  recordButtonInner: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FF6B9D',
  },
  recordingSquare: {
    position: 'absolute',
    width: 20,
    height: 20,
    backgroundColor: 'white',
    borderRadius: 4,
  },
});

export default VideoRecorder;