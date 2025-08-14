// components/AudioRecorder.jsx - MODIFIED VERSION
import React, { useState, useEffect, forwardRef, useImperativeHandle, useRef } from 'react';
import { TouchableOpacity, View, Text, Alert, StyleSheet, Platform } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { PermissionsAndroid } from 'react-native';

// Import AudioRecorderPlayer with error handling
let AudioRecorderPlayer;
try {
  AudioRecorderPlayer = require('react-native-audio-recorder-player').default;
} catch (error) {
  console.error('Failed to import AudioRecorderPlayer:', error);
}

const AudioRecorder = forwardRef(({ onRecordingComplete, disabled = false }, ref) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordTime, setRecordTime] = useState('00:00:00');
  const [audioRecorderPlayer, setAudioRecorderPlayer] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [recordingStartTime, setRecordingStartTime] = useState(null);
  const [recordedAudio, setRecordedAudio] = useState(null); // New state for recorded audio
  const [showSendButton, setShowSendButton] = useState(false); // New state for send button
  
  // Add refs to prevent double-triggering
  const isStartingRef = useRef(false);
  const isStoppingRef = useRef(false);
  const actualRecordingStartTime = useRef(null);
  const touchStartTime = useRef(null);

  // Initialize the audio recorder player
  useEffect(() => {
    const initializeRecorder = async () => {
      if (!AudioRecorderPlayer) {
        console.error('AudioRecorderPlayer is not available');
        Alert.alert(
          'Library Missing',
          'Audio recording library is not installed. Please install react-native-audio-recorder-player and rebuild the app.',
          [{ text: 'OK' }]
        );
        return;
      }

      try {
        const recorder = new AudioRecorderPlayer();
        setAudioRecorderPlayer(recorder);
        setIsInitialized(true);
        console.log('✅ AudioRecorderPlayer initialized successfully');
      } catch (error) {
        console.error('Failed to initialize AudioRecorderPlayer:', error);
        Alert.alert('Error', 'Failed to initialize audio recorder. Please restart the app.');
      }
    };

    initializeRecorder();

    // Cleanup on unmount
    return () => {
      if (audioRecorderPlayer) {
        audioRecorderPlayer.removeRecordBackListener();
        if (isRecording) {
          audioRecorderPlayer.stopRecorder().catch(e => {
            console.log("Error stopping recorder on unmount:", e);
          });
        }
      }
      // Reset refs on unmount
      isStartingRef.current = false;
      isStoppingRef.current = false;
      actualRecordingStartTime.current = null;
      touchStartTime.current = null;
    };
  }, []);

  // Request necessary permissions
  const requestPermissions = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          {
            title: 'Audio Recording Permission',
            message: 'This app needs access to your microphone to record audio messages.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          Alert.alert('Permission Denied', 'Microphone permission is required to record audio.');
          return false;
        }

        return true;
      } catch (err) {
        console.warn('Permission request error:', err);
        return false;
      }
    }
    return true;
  };

  const getRecordingPath = () => {
    if (Platform.OS === 'android') {
      return undefined;
    } else {
      const timestamp = Date.now();
      return `audio_message_${timestamp}.m4a`;
    }
  };

  const startRecording = async () => {
    if (disabled) return;

    // Reset send button state when starting new recording
    setShowSendButton(false);
    setRecordedAudio(null);

    // Prevent multiple rapid calls
    if (isStartingRef.current || isRecording) {
      console.log('⚠️ Recording already in progress or starting');
      return;
    }

    // Set the flag immediately
    isStartingRef.current = true;
    touchStartTime.current = Date.now();

    // Check if recorder is initialized
    if (!isInitialized || !audioRecorderPlayer) {
      console.error('AudioRecorderPlayer not initialized');
      Alert.alert('Error', 'Audio recorder is not ready. Please try again.');
      isStartingRef.current = false;
      return;
    }

    const hasPermission = await requestPermissions();
    if (!hasPermission) {
      isStartingRef.current = false;
      return;
    }

    try {
      // Define audio settings for better compatibility
      const audioSet = {
        AudioEncoderAndroid: 3, // AAC
        AudioSourceAndroid: 1, // MIC
        AVEncoderAudioQualityKeyIOS: 127, // High quality
        AVNumberOfChannelsKeyIOS: 2,
        AVFormatIDKeyIOS: 'aac',
      };

      const path = getRecordingPath();
      console.log('🎙️ Starting recording with path:', path || 'default library path');

      // Start the recorder
      const result = await audioRecorderPlayer.startRecorder(path, audioSet);
      console.log('🎙️ Recording started successfully at:', result);

      // Set the actual recording start time ONLY after successful start
      actualRecordingStartTime.current = Date.now();
      setRecordingStartTime(Date.now());

      // Add record back listener for time updates
      audioRecorderPlayer.addRecordBackListener((e) => {
        const currentTime = Math.floor(e.currentPosition);
        const formattedTime = millisToMinutesAndSeconds(currentTime);
        setRecordTime(formattedTime);
        return;
      });

      setIsRecording(true);
    } catch (error) {
      console.error('❌ Error starting recording:', error);
      
      let errorMessage = 'Failed to start recording. Please try again.';
      if (error.message) {
        if (error.message.includes('EROFS') || error.message.includes('Read-only')) {
          errorMessage = 'Storage error. Please try closing and reopening the app.';
        } else if (error.message.includes('permission')) {
          errorMessage = 'Microphone permission denied. Please enable it in Settings.';
        } else if (error.message.includes('Already recording')) {
          // Don't show alert for this case
          console.log('⚠️ Already recording, ignoring duplicate start request');
          isStartingRef.current = false;
          return;
        }
      }
      
      Alert.alert('Recording Error', errorMessage);
      setIsRecording(false);
      setRecordTime('00:00:00');
      setRecordingStartTime(null);
      actualRecordingStartTime.current = null;
    } finally {
      // Reset the starting flag after a delay to prevent race conditions
      setTimeout(() => {
        isStartingRef.current = false;
      }, 100);
    }
  };

  const stopRecording = async () => {
    // Prevent multiple rapid calls
    if (isStoppingRef.current || !isRecording || !audioRecorderPlayer) {
      console.log('⚠️ Not recording or already stopping');
      return;
    }

    // Set the flag immediately
    isStoppingRef.current = true;
    
    // Use the ref value for accurate duration calculation
    const recordingDuration = actualRecordingStartTime.current 
      ? Date.now() - actualRecordingStartTime.current 
      : 0;
    
    console.log('⏱️ Recording duration:', recordingDuration, 'ms');
    
    // Check minimum recording duration (500ms)
    if (recordingDuration < 500) {
      console.log('Recording too short, cancelling');
      try {
        await audioRecorderPlayer.stopRecorder();
        audioRecorderPlayer.removeRecordBackListener();
      } catch (e) {
        console.log('Error cancelling short recording:', e);
      }
      setIsRecording(false);
      setRecordTime('00:00:00');
      setRecordingStartTime(null);
      actualRecordingStartTime.current = null;
      isStoppingRef.current = false;
      return;
    }
    
    try {
      const result = await audioRecorderPlayer.stopRecorder();
      audioRecorderPlayer.removeRecordBackListener();
      
      // Calculate duration in seconds
      const durationInSeconds = Math.round(recordingDuration / 1000);
      
      setIsRecording(false);
      setRecordTime('00:00:00');
      setRecordingStartTime(null);
      actualRecordingStartTime.current = null;
      
      console.log('⏹️ Recording stopped, file path:', result);
      console.log('📏 Recording duration:', durationInSeconds, 'seconds');

      // Store the recorded audio data
      if (result) {
        // Ensure the path has the correct format
        let finalPath = result;
        
        // Add file:// prefix if not present and path is absolute
        if (Platform.OS === 'android' && !result.startsWith('file://') && result.startsWith('/')) {
          finalPath = `file://${result}`;
        }
        
        const audioFile = {
          uri: finalPath,
          type: Platform.OS === 'android' ? 'audio/mp3' : 'audio/m4a',
          name: `voice_message_${Date.now()}.${Platform.OS === 'android' ? 'mp3' : 'm4a'}`,
        };
        
        setRecordedAudio({
          file: audioFile,
          duration: durationInSeconds
        });
        setShowSendButton(true); // Show the send button
        console.log('📦 Audio recorded and ready to send:', audioFile, durationInSeconds);
      }
    } catch (error) {
      console.error('❌ Error stopping recording:', error);
      Alert.alert('Recording Error', 'Failed to stop recording.');
      setIsRecording(false);
      setRecordTime('00:00:00');
      setRecordingStartTime(null);
      actualRecordingStartTime.current = null;
    } finally {
      // Reset the stopping flag
      isStoppingRef.current = false;
    }
  };

  // New function to handle sending the recorded audio
  const handleSend = () => {
    if (recordedAudio && onRecordingComplete) {
      onRecordingComplete(recordedAudio.file, recordedAudio.duration);
      // Reset after sending
      setRecordedAudio(null);
      setShowSendButton(false);
    }
  };

  // New function to cancel the recording
  const handleCancel = () => {
    setRecordedAudio(null);
    setShowSendButton(false);
  };

  // Helper function to format milliseconds to MM:SS
  const millisToMinutesAndSeconds = (millis) => {
    const minutes = Math.floor(millis / 60000);
    const seconds = ((millis % 60000) / 1000).toFixed(0);
    return `${minutes < 10 ? '0' : ''}${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  // Handle touch events with debouncing
  const handlePressIn = () => {
    // Prevent accidental double-taps
    const now = Date.now();
    if (touchStartTime.current && (now - touchStartTime.current) < 300) {
      console.log('⚠️ Ignoring rapid touch');
      return;
    }
    startRecording();
  };

  const handlePressOut = () => {
    // Only stop if we're actually recording
    if (isRecording && !isStoppingRef.current) {
      stopRecording();
    }
  };

  // Expose methods to parent via ref
  useImperativeHandle(ref, () => ({
    stop: stopRecording,
    isRecording: () => isRecording,
  }));

  // If the library is not available, show a disabled button
  if (!AudioRecorderPlayer || !isInitialized) {
    return (
      <View style={styles.container}>
        <View style={[styles.recordButton, styles.disabledButton]}>
          <Ionicons
            name="mic-off"
            size={24}
            color="#666"
          />
        </View>
      </View>
    );
  }

  // Show send button when recording is complete
  if (showSendButton && recordedAudio) {
    return (
      <View style={styles.container}>
        <View style={styles.previewContainer}>
          <Ionicons name="mic" size={16} color="#666" />
          <Text style={styles.previewText}>{recordedAudio.duration}s</Text>
        </View>
        <TouchableOpacity
          style={styles.sendButton}
          onPress={handleSend}
          activeOpacity={0.7}
        >
          <Ionicons name="send" size={20} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={handleCancel}
          activeOpacity={0.7}
        >
          <Ionicons name="close" size={20} color="#666" />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[
          styles.recordButton,
          isRecording ? styles.recordingActive : null,
          disabled ? styles.disabledButton : null
        ]}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || !isInitialized}
        activeOpacity={0.7}
        delayPressIn={0}
        delayPressOut={0}
      >
        <Ionicons
          name={isRecording ? "stop" : "mic"}
          size={24}
          color={isRecording ? "#FF4444" : (disabled ? "#666" : "#FF6B9D")}
        />
      </TouchableOpacity>
      {isRecording && (
        <Text style={styles.timerText}>{recordTime}</Text>
      )}
    </View>
  );
});

AudioRecorder.displayName = 'AudioRecorder';

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recordButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2C2C2E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordingActive: {
    backgroundColor: '#FF444433',
    borderWidth: 2,
    borderColor: '#FF4444',
  },
  disabledButton: {
    opacity: 0.5,
  },
  timerText: {
    color: '#FF4444',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 8,
  },
  previewContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
  },
  previewText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    marginLeft: 4,
  },
  sendButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FF6B9D',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  cancelButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default AudioRecorder;