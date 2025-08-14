// import React, { useState, useEffect, useRef } from 'react';
// import {
// View,
// Text,
// TouchableOpacity,
// StyleSheet,
// Alert,
// Platform,
// PermissionsAndroid,
// Animated,
// Dimensions,
// ActivityIndicator,
// Linking,
// } from 'react-native';
// import Ionicons from 'react-native-vector-icons/Ionicons';
// import { request, check, PERMISSIONS, RESULTS } from 'react-native-permissions';
// import AudioRecorderPlayer, {
// AVEncoderAudioQualityIOSType,
// AVEncodingOption,
// AudioEncoderAndroidType,
// AudioSourceAndroidType,
// OutputFormatAndroidType,
// } from 'react-native-audio-recorder-player';

// const { width } = Dimensions.get('window');

// // Audio Utility Functions
// export const audioUtils = {
// formatDuration: (milliseconds) => {
// if (!milliseconds || milliseconds === 0) return '0:00';
// const totalSeconds = Math.floor(milliseconds / 1000);
// const minutes = Math.floor(totalSeconds / 60);
// const seconds = totalSeconds % 60;
// return `${minutes}:${seconds.toString().padStart(2, '0')}`;
// },

// // FIXED: Much simpler and more reliable permission check
// checkAudioPermissions: async () => {
// console.log('🔍 Checking audio permissions...');

// if (Platform.OS === 'android') {
// try {
// // Direct boolean check - more reliable
// const hasPermission = await PermissionsAndroid.check(
// PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
// );

// console.log('🎤 Raw permission check result:', hasPermission);
// console.log('🎤 Permission type:', typeof hasPermission);

// // Return the boolean directly
// return hasPermission;
// } catch (err) {
// console.error('❌ Permission check error:', err);
// return false;
// }
// } else {
// // iOS
// try {
// const result = await check(PERMISSIONS.IOS.MICROPHONE);
// console.log('🎤 iOS microphone permission status:', result);
// return result === RESULTS.GRANTED;
// } catch (error) {
// console.warn('❌ iOS permission check error:', error);
// return false;
// }
// }
// },

// // FIXED: Force refresh permission status
// requestAudioPermissions: async () => {
// console.log('📱 Requesting audio permissions...');

// if (Platform.OS === 'android') {
// try {
// // First check if we already have permission
// const currentPermission = await PermissionsAndroid.check(
// PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
// );

// console.log('📱 Current permission before request:', currentPermission);

// if (currentPermission === true) {
// console.log('✅ Permission already granted!');
// return true;
// }

// // Request permission
// const granted = await PermissionsAndroid.request(
// PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
// {
// title: 'Microphone Permission',
// message: 'This app needs access to your microphone to record voice messages.',
// buttonNeutral: 'Ask Me Later',
// buttonNegative: 'Cancel',
// buttonPositive: 'OK',
// }
// );

// console.log('📱 Permission request result:', granted);
// console.log('📱 Result type:', typeof granted);

// // Check again after request
// const finalCheck = await PermissionsAndroid.check(
// PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
// );

// console.log('📱 Final permission check:', finalCheck);

// return finalCheck === true;
// } catch (err) {
// console.error('❌ Android permission request error:', err);
// return false;
// }
// } else {
// // iOS
// try {
// const result = await request(PERMISSIONS.IOS.MICROPHONE);
// console.log('📱 iOS permission result:', result);
// return result === RESULTS.GRANTED;
// } catch (error) {
// console.warn('❌ iOS permission request error:', error);
// return false;
// }
// }
// },

// generateFilename: () => {
// const timestamp = Date.now();
// return `voice_message_${timestamp}`;
// },

// // Fixed: Get proper recording path
// getRecordingPath: () => {
// const filename = audioUtils.generateFilename();
// if (Platform.OS === 'android') {
// return `${filename}.mp4`;
// } else {
// return `${filename}.m4a`;
// }
// },
// };

// // Audio Player Component
// export const AudioPlayer = ({
// audioUrl,
// duration,
// isOwnMessage = false,
// messageId,
// onPlaybackStart,
// onPlaybackEnd,
// style
// }) => {
// const [isPlaying, setIsPlaying] = useState(false);
// const [isLoading, setIsLoading] = useState(false);
// const [hasError, setHasError] = useState(false);
// const [currentPosition, setCurrentPosition] = useState(0);
// const [totalDuration, setTotalDuration] = useState(duration || 0);

// // FIXED: Initialize AudioRecorderPlayer properly
// const [audioRecorderPlayer] = useState(() => new AudioRecorderPlayer());
// const playbackListenerRef = useRef(null);

// // Animation values
// const waveAnim = useRef(new Animated.Value(0)).current;

// useEffect(() => {
// return () => {
// // Cleanup
// if (audioRecorderPlayer) {
// audioRecorderPlayer.stopPlayer();
// if (playbackListenerRef.current) {
// audioRecorderPlayer.removePlayBackListener();
// }
// }
// };
// }, [audioRecorderPlayer]);

// useEffect(() => {
// if (isPlaying) {
// startWaveAnimation();
// } else {
// stopWaveAnimation();
// }
// }, [isPlaying]);

// const startWaveAnimation = () => {
// Animated.loop(
// Animated.sequence([
// Animated.timing(waveAnim, {
// toValue: 1,
// duration: 1000,
// useNativeDriver: false,
// }),
// Animated.timing(waveAnim, {
// toValue: 0,
// duration: 1000,
// useNativeDriver: false,
// }),
// ])
// ).start();
// };

// const stopWaveAnimation = () => {
// waveAnim.stopAnimation();
// waveAnim.setValue(0);
// };

// const playAudio = async () => {
// if (!audioUrl) {
// Alert.alert('Error', 'Audio file not available');
// return;
// }

// setIsLoading(true);
// setHasError(false);

// console.log('▶️ Playing audio:', audioUrl);

// if (onPlaybackStart) {
// onPlaybackStart(messageId);
// }

// try {
// // Add playback listener
// playbackListenerRef.current = audioRecorderPlayer.addPlayBackListener((e) => {
// const position = e.currentPosition;
// const duration = e.duration;

// setCurrentPosition(position);
// if (totalDuration === 0 && duration > 0) {
// setTotalDuration(duration);
// }

// // Check if playback finished
// if (position >= duration && duration > 0) {
// handlePlaybackEnd();
// }
// });

// // Start playing
// const startResult = await audioRecorderPlayer.startPlayer(audioUrl);
// console.log('✅ Audio started playing:', startResult);

// setIsPlaying(true);
// setIsLoading(false);

// } catch (error) {
// console.error('❌ Play error:', error);
// setHasError(true);
// setIsLoading(false);
// Alert.alert('Playback Error', 'Unable to play this audio file.');
// }
// };

// const stopAudio = async () => {
// try {
// await audioRecorderPlayer.stopPlayer();
// handlePlaybackEnd();
// } catch (error) {
// console.error('❌ Stop audio error:', error);
// handlePlaybackEnd();
// }
// };

// const handlePlaybackEnd = () => {
// setIsPlaying(false);
// setCurrentPosition(0);

// if (playbackListenerRef.current) {
// audioRecorderPlayer.removePlayBackListener();
// playbackListenerRef.current = null;
// }

// if (onPlaybackEnd) {
// onPlaybackEnd(messageId);
// }
// };

// const togglePlayback = () => {
// if (isPlaying) {
// stopAudio();
// } else {
// playAudio();
// }
// };

// const renderWaveform = () => {
// const numBars = 15;
// const bars = [];

// for (let i = 0; i < numBars; i++) {
// const animatedHeight = waveAnim.interpolate({
// inputRange: [0, 1],
// outputRange: [4, Math.random() * 20 + 8],
// });

// const opacity = isPlaying ? 1 : 0.3;
// const color = isOwnMessage ? '#FF6B9D' : '#4ECDC4';

// bars.push(
// <Animated.View
// key={i}
// style={[
// styles.waveBar,
// {
// height: isPlaying ? animatedHeight : Math.random() * 15 + 5,
// backgroundColor: color,
// opacity: opacity,
// }
// ]}
// />
// );
// }

// return bars;
// };

// if (hasError) {
// return (
// <View style={[styles.playerContainer, styles.errorContainer, style]}>
// <View style={styles.playButton}>
// <Ionicons name="warning" size={20} color="#FF4444" />
// </View>
// <View style={styles.audioInfo}>
// <Text style={styles.errorText}>Audio unavailable</Text>
// <Text style={styles.durationText}>
// {audioUtils.formatDuration(totalDuration)}
// </Text>
// </View>
// </View>
// );
// }

// return (
// <View style={[styles.playerContainer, style]}>
// <TouchableOpacity
// style={[
// styles.playButton,
// { backgroundColor: isOwnMessage ? '#FF6B9D' : '#4ECDC4' },
// isLoading && styles.loadingButton
// ]}
// onPress={togglePlayback}
// disabled={isLoading}
// >
// {isLoading ? (
// <ActivityIndicator size="small" color="white" />
// ) : (
// <Ionicons
// name={isPlaying ? "pause" : "play"}
// size={20}
// color="white"
// />
// )}
// </TouchableOpacity>

// <View style={styles.audioInfo}>
// <View style={styles.waveformContainer}>
// {renderWaveform()}
// </View>

// <View style={styles.timeContainer}>
// <Text style={[
// styles.durationText,
// { color: isOwnMessage ? '#E0E0E0' : '#666' }
// ]}>
// {isPlaying ?
// `${audioUtils.formatDuration(currentPosition)} / ${audioUtils.formatDuration(totalDuration)}` :
// audioUtils.formatDuration(totalDuration)
// }
// </Text>
// </View>
// </View>
// </View>
// );
// };

// // Voice Recorder Component
// export const VoiceRecorder = ({
// onSendVoiceMessage,
// isVisible,
// onClose,
// disabled = false
// }) => {
// const [isRecording, setIsRecording] = useState(false);
// const [recordTime, setRecordTime] = useState('00:00');
// const [hasRecording, setHasRecording] = useState(false);
// const [recordedPath, setRecordedPath] = useState('');
// const [recordingStartTime, setRecordingStartTime] = useState(null);
// const [isPlaying, setIsPlaying] = useState(false);
// const [permissionStatus, setPermissionStatus] = useState('unknown');
// const [recordingDuration, setRecordingDuration] = useState(0);

// // Animation values
// const slideAnim = useRef(new Animated.Value(300)).current;
// const pulseAnim = useRef(new Animated.Value(1)).current;
// const waveAnim = useRef(new Animated.Value(0)).current;

// const intervalRef = useRef(null);
// // FIXED: Initialize AudioRecorderPlayer properly
// const [audioRecorderPlayer] = useState(() => new AudioRecorderPlayer());
// const recordingListenerRef = useRef(null);
// const playbackListenerRef = useRef(null);

// useEffect(() => {
// if (isVisible) {
// showRecorder();
// // Force check permission status when component becomes visible
// setTimeout(() => {
// checkPermissionStatus();
// }, 100);
// } else {
// hideRecorder();
// }
// }, [isVisible]);

// useEffect(() => {
// if (isRecording) {
// startPulseAnimation();
// startWaveAnimation();
// } else {
// stopAnimations();
// }
// }, [isRecording]);

// const checkPermissionStatus = async () => {
// console.log('🔄 Force checking permission status...');
// const hasPermission = await audioUtils.checkAudioPermissions();
// const status = hasPermission ? 'granted' : 'denied';
// setPermissionStatus(status);
// console.log('🎤 Permission status updated to:', status);
// return hasPermission;
// };

// const showRecorder = () => {
// Animated.spring(slideAnim, {
// toValue: 0,
// useNativeDriver: true,
// }).start();
// };

// const hideRecorder = () => {
// Animated.spring(slideAnim, {
// toValue: 300,
// useNativeDriver: true,
// }).start();
// };

// const startPulseAnimation = () => {
// Animated.loop(
// Animated.sequence([
// Animated.timing(pulseAnim, {
// toValue: 1.2,
// duration: 800,
// useNativeDriver: true,
// }),
// Animated.timing(pulseAnim, {
// toValue: 1,
// duration: 800,
// useNativeDriver: true,
// }),
// ])
// ).start();
// };

// const startWaveAnimation = () => {
// Animated.loop(
// Animated.timing(waveAnim, {
// toValue: 1,
// duration: 1000,
// useNativeDriver: false,
// })
// ).start();
// };

// const stopAnimations = () => {
// pulseAnim.stopAnimation();
// waveAnim.stopAnimation();
// pulseAnim.setValue(1);
// waveAnim.setValue(0);
// };

// // Fixed: Improved permission request and recording start
// const startRecording = async () => {
// if (disabled) {
// console.log('🚫 Recording disabled');
// return;
// }

// console.log('🎤 Starting recording process...');

// try {
// // FORCE recheck permissions first - this is key!
// console.log('🔄 Force rechecking permissions...');
// let hasPermission = await checkPermissionStatus();

// console.log('🔍 Initial permission check result:', hasPermission);

// // If no permission, request it
// if (!hasPermission) {
// console.log('❌ No permission, requesting...');
// hasPermission = await audioUtils.requestAudioPermissions();

// // Double check after request
// if (hasPermission) {
// await checkPermissionStatus(); // Update UI state
// }
// }

// if (!hasPermission) {
// console.log('❌ Permission denied after request');
// Alert.alert(
// 'Permission Required',
// 'Microphone permission is required to record voice messages. Please enable it in your device settings.',
// [
// { text: 'Cancel', style: 'cancel' },
// {
// text: 'Open Settings',
// onPress: () => {
// if (Platform.OS === 'ios') {
// Linking.openURL('app-settings:');
// } else {
// Linking.openSettings();
// }
// }
// }
// ]
// );
// return;
// }

// console.log('✅ Permission confirmed, starting recording...');
// setPermissionStatus('granted');

// // Configure audio recording options
// const audioSet = {
// AudioEncoderAndroid: AudioEncoderAndroidType.AAC,
// AudioSourceAndroid: AudioSourceAndroidType.MIC,
// AVEncoderAudioQualityKeyIOS: AVEncoderAudioQualityIOSType.high,
// AVNumberOfChannelsKeyIOS: 1,
// AVFormatIDKeyIOS: AVEncodingOption.aac,
// OutputFormatAndroid: OutputFormatAndroidType.AAC_ADTS,
// };

// // Add recording listener
// recordingListenerRef.current = audioRecorderPlayer.addRecordBackListener((e) => {
// const currentTime = e.currentPosition;
// setRecordTime(audioUtils.formatDuration(currentTime));
// setRecordingDuration(currentTime);
// });

// // Start recording
// const result = await audioRecorderPlayer.startRecorder(
// audioUtils.getRecordingPath(),
// audioSet
// );

// console.log('🎤 Recording started successfully!', result);
// setIsRecording(true);
// setRecordingStartTime(Date.now());
// setRecordTime('00:00');
// setHasRecording(false);
// setRecordedPath(result);

// } catch (error) {
// console.error('❌ Recording init error:', error);
// Alert.alert('Error', `Failed to start recording: ${error.message}`);
// }
// };

// const stopRecording = async () => {
// if (!isRecording) {
// console.log('⚠️ No active recording to stop');
// return;
// }

// try {
// console.log('⏹️ Stopping recording...');

// const result = await audioRecorderPlayer.stopRecorder();
// console.log('✅ Recording stopped successfully', result);

// // Remove recording listener
// if (recordingListenerRef.current) {
// audioRecorderPlayer.removeRecordBackListener();
// recordingListenerRef.current = null;
// }

// setIsRecording(false);
// setHasRecording(true);
// setRecordedPath(result);

// } catch (error) {
// console.error('❌ Stop recording error:', error);
// Alert.alert('Error', 'Failed to stop recording.');
// }
// };

// const playRecording = async () => {
// if (!hasRecording || !recordedPath) {
// Alert.alert('Error', 'No recording available to play');
// return;
// }

// console.log('▶️ Playing recording:', recordedPath);

// try {
// // Add playback listener
// playbackListenerRef.current = audioRecorderPlayer.addPlayBackListener((e) => {
// // Check if playback finished
// if (e.currentPosition >= e.duration && e.duration > 0) {
// stopPlayback();
// }
// });

// // Start playing
// await audioRecorderPlayer.startPlayer(recordedPath);
// setIsPlaying(true);

// } catch (error) {
// console.error('❌ Playback error:', error);
// Alert.alert('Error', 'Cannot play recording preview');
// }
// };

// const stopPlayback = async () => {
// try {
// await audioRecorderPlayer.stopPlayer();

// if (playbackListenerRef.current) {
// audioRecorderPlayer.removePlayBackListener();
// playbackListenerRef.current = null;
// }

// setIsPlaying(false);
// } catch (error) {
// console.error('❌ Stop playback error:', error);
// setIsPlaying(false);
// }
// };

// const sendVoiceMessage = async () => {
// if (!hasRecording || !recordedPath) {
// Alert.alert('Error', 'No recording to send');
// return;
// }

// try {
// const durationSeconds = Math.floor(recordingDuration / 1000);

// const fileData = {
// uri: Platform.OS === 'android' ? `file://${recordedPath}` : recordedPath,
// type: Platform.OS === 'android' ? 'audio/mp4' : 'audio/m4a',
// name: audioUtils.generateFilename() + (Platform.OS === 'android' ? '.mp4' : '.m4a'),
// };

// console.log('📤 Sending voice message:', {
// uri: fileData.uri,
// name: fileData.name,
// duration: durationSeconds
// });

// await onSendVoiceMessage(fileData, durationSeconds);
// deleteRecording();
// onClose();
// } catch (error) {
// console.error('❌ Send voice message error:', error);
// Alert.alert('Error', 'Failed to send voice message. Please try again.');
// }
// };

// const deleteRecording = async () => {
// console.log('🗑️ Deleting recording');

// // Stop playback if playing
// if (isPlaying) {
// await stopPlayback();
// }

// // Stop recording if recording
// if (isRecording) {
// await stopRecording();
// }

// setHasRecording(false);
// setRecordedPath('');
// setRecordTime('00:00');
// setRecordingStartTime(null);
// setRecordingDuration(0);
// };

// const cancelRecording = async () => {
// console.log('❌ Cancelling recording');

// await deleteRecording();
// onClose();
// };

// if (!isVisible) return null;

// const waveScale = waveAnim.interpolate({
// inputRange: [0, 1],
// outputRange: [1, 1.5],
// });

// return (
// <Animated.View
// style={[
// styles.recorderContainer,
// { transform: [{ translateY: slideAnim }] }
// ]}
// >
// <View style={styles.recorderContent}>
// {/* Permission Status */}
// {permissionStatus === 'denied' && (
// <View style={styles.permissionWarning}>
// <Ionicons name="warning" size={20} color="#FF4444" />
// <Text style={styles.permissionWarningText}>
// Microphone permission required
// </Text>
// <TouchableOpacity
// style={styles.refreshButton}
// onPress={checkPermissionStatus}
// >
// <Ionicons name="refresh" size={16} color="#FF4444" />
// </TouchableOpacity>
// </View>
// )}

// {/* DEBUG: Add permission status display */}
// <View style={styles.debugContainer}>
// <Text style={styles.debugText}>
// Permission Status: {permissionStatus}
// </Text>
// <TouchableOpacity
// style={styles.debugButton}
// onPress={checkPermissionStatus}
// >
// <Text style={styles.debugButtonText}>Refresh</Text>
// </TouchableOpacity>
// </View>

// {/* Recording Status */}
// <View style={styles.statusContainer}>
// {isRecording ? (
// <View style={styles.recordingStatus}>
// <Animated.View
// style={[
// styles.recordingDot,
// { transform: [{ scale: pulseAnim }] }
// ]}
// />
// <Text style={styles.recordingText}>Recording • {recordTime}</Text>
// </View>
// ) : hasRecording ? (
// <View style={styles.recordingStatus}>
// <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
// <Text style={styles.recordingText}>Ready to send • {recordTime}</Text>
// </View>
// ) : (
// <Text style={styles.instructionText}>
// {permissionStatus === 'granted' ?
// 'Tap to record voice message' :
// 'Grant microphone permission to record'
// }
// </Text>
// )}
// </View>

// {/* Waveform Visualization */}
// {isRecording && (
// <View style={styles.waveformContainer}>
// {[...Array(20)].map((_, index) => (
// <Animated.View
// key={index}
// style={[
// styles.waveBar,
// {
// height: Math.random() * 30 + 10,
// transform: [{ scaleY: waveScale }],
// }
// ]}
// />
// ))}
// </View>
// )}

// {/* Playback Controls */}
// {hasRecording && (
// <View style={styles.playbackContainer}>
// <TouchableOpacity
// style={styles.playButton}
// onPress={isPlaying ? stopPlayback : playRecording}
// >
// <Ionicons
// name={isPlaying ? 'stop' : 'play'}
// size={24}
// color="#FF6B9D"
// />
// </TouchableOpacity>
// <View style={styles.playbackInfo}>
// <Text style={styles.playbackTime}>Preview Recording • {recordTime}</Text>
// </View>
// </View>
// )}

// {/* Control Buttons */}
// <View style={styles.controlsContainer}>
// <TouchableOpacity style={styles.cancelButton} onPress={cancelRecording}>
// <Ionicons name="close" size={24} color="#FF4444" />
// </TouchableOpacity>

// <TouchableOpacity
// style={[
// styles.recordButton,
// isRecording && styles.recordingButton,
// (disabled || permissionStatus === 'denied') && styles.disabledButton
// ]}
// onPress={isRecording ? stopRecording : startRecording}
// disabled={disabled || permissionStatus === 'denied'}
// >
// <Ionicons
// name={isRecording ? 'stop' : hasRecording ? 'checkmark' : 'mic'}
// size={28}
// color="white"
// />
// </TouchableOpacity>

// <TouchableOpacity
// style={[
// styles.sendButton,
// !hasRecording && styles.disabledSendButton
// ]}
// onPress={sendVoiceMessage}
// disabled={!hasRecording}
// >
// <Ionicons name="send" size={24} color={hasRecording ? "white" : "#666"} />
// </TouchableOpacity>
// </View>

// {hasRecording && (
// <TouchableOpacity style={styles.deleteButton} onPress={deleteRecording}>
// <Ionicons name="trash-outline" size={20} color="#FF4444" />
// <Text style={styles.deleteText}>Delete</Text>
// </TouchableOpacity>
// )}
// </View>
// </Animated.View>
// );
// };

// const styles = StyleSheet.create({
// // Audio Player Styles
// playerContainer: {
// flexDirection: 'row',
// alignItems: 'center',
// paddingVertical: 8,
// paddingHorizontal: 12,
// minWidth: 200,
// maxWidth: 280,
// },
// errorContainer: {
// opacity: 0.6,
// },
// playButton: {
// width: 40,
// height: 40,
// borderRadius: 20,
// justifyContent: 'center',
// alignItems: 'center',
// marginRight: 12,
// elevation: 2,
// shadowColor: '#000',
// shadowOffset: { width: 0, height: 1 },
// shadowOpacity: 0.2,
// shadowRadius: 2,
// },
// loadingButton: {
// opacity: 0.7,
// },
// audioInfo: {
// flex: 1,
// justifyContent: 'center',
// },
// waveformContainer: {
// flexDirection: 'row',
// alignItems: 'center',
// height: 30,
// marginBottom: 4,
// },
// waveBar: {
// width: 3,
// marginHorizontal: 1,
// borderRadius: 1.5,
// backgroundColor: '#FF6B9D',
// },
// timeContainer: {
// flexDirection: 'row',
// alignItems: 'center',
// },
// durationText: {
// fontSize: 12,
// fontWeight: '500',
// },
// errorText: {
// color: '#FF4444',
// fontSize: 12,
// fontWeight: '500',
// },

// // Voice Recorder Styles
// recorderContainer: {
// position: 'absolute',
// bottom: 0,
// left: 0,
// right: 0,
// backgroundColor: '#1C1C1E',
// borderTopLeftRadius: 20,
// borderTopRightRadius: 20,
// paddingBottom: 34,
// elevation: 10,
// shadowColor: '#000',
// shadowOffset: { width: 0, height: -2 },
// shadowOpacity: 0.25,
// shadowRadius: 10,
// },
// recorderContent: {
// padding: 20,
// alignItems: 'center',
// },
// permissionWarning: {
// flexDirection: 'row',
// alignItems: 'center',
// backgroundColor: '#FF4444',
// paddingHorizontal: 12,
// paddingVertical: 8,
// borderRadius: 20,
// marginBottom: 16,
// },
// permissionWarningText: {
// color: 'white',
// fontSize: 14,
// fontWeight: '500',
// marginLeft: 8,
// flex: 1,
// },
// refreshButton: {
// padding: 4,
// marginLeft: 8,
// },
// debugContainer: {
// flexDirection: 'row',
// alignItems: 'center',
// justifyContent: 'space-between',
// backgroundColor: '#2C2C2E',
// paddingHorizontal: 12,
// paddingVertical: 8,
// borderRadius: 10,
// marginBottom: 16,
// borderWidth: 1,
// borderColor: '#666',
// },
// debugText: {
// color: '#999',
// fontSize: 12,
// flex: 1,
// },
// debugButton: {
// backgroundColor: '#FF6B9D',
// paddingHorizontal: 8,
// paddingVertical: 4,
// borderRadius: 6,
// },
// debugButtonText: {
// color: 'white',
// fontSize: 10,
// fontWeight: '600',
// },
// statusContainer: {
// marginBottom: 20,
// alignItems: 'center',
// },
// recordingStatus: {
// flexDirection: 'row',
// alignItems: 'center',
// },
// recordingDot: {
// width: 10,
// height: 10,
// borderRadius: 5,
// backgroundColor: '#FF4444',
// marginRight: 8,
// },
// recordingText: {
// color: 'white',
// fontSize: 16,
// fontWeight: '500',
// },
// instructionText: {
// color: '#999',
// fontSize: 14,
// textAlign: 'center',
// },
// playbackContainer: {
// flexDirection: 'row',
// alignItems: 'center',
// marginBottom: 20,
// paddingHorizontal: 20,
// paddingVertical: 10,
// backgroundColor: '#2C2C2E',
// borderRadius: 25,
// },
// playbackInfo: {
// flex: 1,
// marginLeft: 12,
// },
// playbackTime: {
// color: 'white',
// fontSize: 14,
// fontWeight: '500',
// },
// controlsContainer: {
// flexDirection: 'row',
// alignItems: 'center',
// justifyContent: 'space-between',
// width: '100%',
// paddingHorizontal: 20,
// },
// cancelButton: {
// width: 50,
// height: 50,
// borderRadius: 25,
// backgroundColor: '#2C2C2E',
// justifyContent: 'center',
// alignItems: 'center',
// borderWidth: 1,
// borderColor: '#FF4444',
// },
// recordButton: {
// width: 70,
// height: 70,
// borderRadius: 35,
// backgroundColor: '#FF6B9D',
// justifyContent: 'center',
// alignItems: 'center',
// elevation: 5,
// shadowColor: '#FF6B9D',
// shadowOffset: { width: 0, height: 2 },
// shadowOpacity: 0.5,
// shadowRadius: 5,
// },
// recordingButton: {
// backgroundColor: '#FF4444',
// },
// disabledButton: {
// backgroundColor: '#666',
// opacity: 0.6,
// },
// sendButton: {
// width: 50,
// height: 50,
// borderRadius: 25,
// backgroundColor: '#4CAF50',
// justifyContent: 'center',
// alignItems: 'center',
// },
// disabledSendButton: {
// backgroundColor: '#2C2C2E',
// borderWidth: 1,
// borderColor: '#666',
// },
// deleteButton: {
// flexDirection: 'row',
// alignItems: 'center',
// marginTop: 15,
// paddingHorizontal: 16,
// paddingVertical: 8,
// backgroundColor: '#2C2C2E',
// borderRadius: 20,
// borderWidth: 1,
// borderColor: '#FF4444',
// },
// deleteText: {
// color: '#FF4444',
// fontSize: 14,
// fontWeight: '500',
// marginLeft: 6,
// },
// });

// export default { VoiceRecorder, AudioPlayer, audioUtils };