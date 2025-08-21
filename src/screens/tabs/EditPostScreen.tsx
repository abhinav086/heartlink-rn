import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ScrollView,
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  BackHandler,
  Platform,
  AppState,
  Modal,
  NativeEventEmitter,
  NativeModules,
} from "react-native";
import Slider from '@react-native-community/slider';
import DeviceInfo from "react-native-device-info";
import Video from "react-native-video";
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import RNFS from 'react-native-fs';
import { useAuth } from "../../context/AuthContext";
import { useNavigation } from "@react-navigation/native";
// Updated import for react-native-video-trim v5.0.3
import { trim, isValidFile } from 'react-native-video-trim';
const { width, height } = Dimensions.get("window");
const API_BASE_URL = "https://backendforheartlink.in/api/v1";
const MAX_REEL_DURATION = 25; // 25 seconds max for reels
// Get the native module for event listeners
const { NativeVideoTrim } = NativeModules;
// TypeScript interfaces
interface MediaItem {
  uri?: string;
  image?: { uri: string };
  originalUri?: string;
  type?: string;
  isCompressed?: boolean;
  compressionMethod?: string;
  compressedSize?: number;
  originalSize?: number;
  compressionRatio?: number;
  fileSize?: number;
}
interface TrimmedVideoInfo {
  uri: string;
  duration: number;
  startTime: number;
  endTime: number;
  fileSize: number;
  method: string;
}
interface CustomVideoTrimmerProps {
  visible: boolean;
  videoUri: string;
  videoDuration: number;
  onTrimComplete: (trimmedVideoInfo: TrimmedVideoInfo) => void;
  onCancel: () => void;
  maxDuration: number;
}
interface RouteParams {
  selectedMedia: MediaItem[];
  contentType: 'post' | 'reel';
}
interface DeviceCapabilities {
  totalMemory: number;
  availableMemory: number;
  androidVersion: number;
  isLowEndDevice: boolean;
  isOldAndroid: boolean;
}
interface VideoLoadData {
  duration: number;
  currentTime: number;
  canPlaySlowReverse: boolean;
  audioTracks: any[];
  videoTracks: any[];
  naturalSize: {
    width: number;
    height: number;
    orientation: string;
  };
  canPlayFastForward: boolean;
  textTracks: any[];
  trackId: string;
  canPlaySlowForward: boolean;
  canPlayReverse: boolean;
}
interface VideoProgressData {
  currentTime: number;
  playableDuration: number;
  atValue: number;
}
// Trim options interface based on the documentation
interface TrimOptions {
  startTime?: number; // in milliseconds
  endTime?: number; // in milliseconds
  outputExt?: string;
  maxDuration?: number; // in milliseconds
  minDuration?: number; // in milliseconds
}
const CustomVideoTrimmer: React.FC<CustomVideoTrimmerProps> = ({
  visible,
  videoUri,
  videoDuration,
  onTrimComplete,
  onCancel,
  maxDuration
}) => {
  const [startTime, setStartTime] = useState<number>(0);
  const [endTime, setEndTime] = useState<number>(Math.min(videoDuration || maxDuration, maxDuration));
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isTrimming, setIsTrimming] = useState<boolean>(false);
  const [trimProgress, setTrimProgress] = useState<number>(0);
  const [previewPaused, setPreviewPaused] = useState<boolean>(true);
  const videoPlayerRef = useRef<Video>(null);
  const eventEmitter = useRef<NativeEventEmitter | null>(null);
  const eventSubscriptions = useRef<{ [key: string]: any }>({});
  useEffect(() => {
    if (visible && videoDuration) {
      setEndTime(Math.min(videoDuration, maxDuration));
      setStartTime(0);
      setCurrentTime(0);
      setPreviewPaused(true); // Ensure preview is paused initially
    }
  }, [visible, videoDuration, maxDuration]);

  useEffect(() => {
    // Setup event listeners for react-native-video-trim
    if (NativeVideoTrim && visible) {
      eventEmitter.current = new NativeEventEmitter(NativeVideoTrim);
      // Clear existing subscriptions
      Object.values(eventSubscriptions.current).forEach(sub => sub?.remove?.());
      eventSubscriptions.current = {};
      // Listen for trim completion
      eventSubscriptions.current.onFinishTrimming = eventEmitter.current.addListener(
        'onFinishTrimming',
        ({ outputPath, startTime: trimStartTime, endTime: trimEndTime, duration }: {
          outputPath: string;
          startTime: number;
          endTime: number;
          duration: number;
        }) => {
          console.log('✅ Trimming completed:', { outputPath, trimStartTime, trimEndTime, duration });
          setIsTrimming(false);
          setTrimProgress(100);
          // Clear timeout if it exists
          if ((window as any).trimTimeout) {
            clearTimeout((window as any).trimTimeout);
            (window as any).trimTimeout = null;
          }
          // Get file size
          RNFS.stat(outputPath.replace('file://', ''))
            .then(fileInfo => {
              onTrimComplete({
                uri: outputPath.startsWith('file://') ? outputPath : `file://${outputPath}`,
                duration: duration / 1000, // Convert from milliseconds to seconds
                startTime: trimStartTime / 1000,
                endTime: trimEndTime / 1000,
                fileSize: fileInfo.size,
                method: 'react-native-video-trim-v5',
              });
            })
            .catch(error => {
              console.error('Error getting file size:', error);
              // Still call completion but without file size
              onTrimComplete({
                uri: outputPath.startsWith('file://') ? outputPath : `file://${outputPath}`,
                duration: duration / 1000,
                startTime: trimStartTime / 1000,
                endTime: trimEndTime / 1000,
                fileSize: 0,
                method: 'react-native-video-trim-v5',
              });
            });
        }
      );
      // Listen for trim progress updates
      eventSubscriptions.current.onStatistics = eventEmitter.current.addListener(
        'onStatistics',
        ({ time, speed }: { time: number; speed: number; }) => {
          // Calculate progress based on the time processed vs total duration
          const totalDuration = (endTime - startTime) * 1000; // Convert to milliseconds
          if (totalDuration > 0) {
            const progress = Math.min((time / totalDuration) * 100, 95); // Cap at 95% until completion
            setTrimProgress(Math.round(progress));
            console.log(`📊 Trim progress: ${Math.round(progress)}% (${time}ms/${totalDuration}ms) Speed: ${speed}x`);
          }
        }
      );
      // Listen for trim errors
      eventSubscriptions.current.onError = eventEmitter.current.addListener(
        'onError',
        ({ message, errorCode }: { message: string; errorCode: string }) => {
          console.error('❌ Trimming error:', message, errorCode);
          setIsTrimming(false);
          setTrimProgress(0);
          // Clear timeout if it exists
          if ((window as any).trimTimeout) {
            clearTimeout((window as any).trimTimeout);
            (window as any).trimTimeout = null;
          }
          Alert.alert(
            "Trim Failed",
            `Failed to trim video: ${message}`,
            [{ text: "OK" }]
          );
        }
      );
      // Listen for trim cancellation
      eventSubscriptions.current.onCancelTrimming = eventEmitter.current.addListener(
        'onCancelTrimming',
        () => {
          console.log('Trimming cancelled by user');
          setIsTrimming(false);
          setTrimProgress(0);
          // Clear timeout if it exists
          if ((window as any).trimTimeout) {
            clearTimeout((window as any).trimTimeout);
            (window as any).trimTimeout = null;
          }
        }
      );
      // Listen for start trimming
      eventSubscriptions.current.onStartTrimming = eventEmitter.current.addListener(
        'onStartTrimming',
        () => {
          console.log('Trimming started');
          setIsTrimming(true);
          setTrimProgress(0);
        }
      );
    }
    return () => {
      // Clean up event listeners
      Object.values(eventSubscriptions.current).forEach(subscription => {
        subscription?.remove?.();
      });
      eventSubscriptions.current = {};
      // Clear any remaining timeout
      if ((window as any).trimTimeout) {
        clearTimeout((window as any).trimTimeout);
        (window as any).trimTimeout = null;
      }
    };
  }, [visible, onTrimComplete, endTime, startTime]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleVideoProgress = (data: VideoProgressData): void => {
    setCurrentTime(data.currentTime);
    // Loop the preview within the selected range
    if (data.currentTime >= endTime) {
      videoPlayerRef.current?.seek(startTime);
    }
  };

  const handlePlayPause = (): void => {
    setPreviewPaused(!previewPaused);
    setIsPlaying(!isPlaying);
    if (previewPaused) {
      videoPlayerRef.current?.seek(startTime);
    }
  };

  const handleStartTimeChange = (value: number): void => {
    const newStartTime = Math.min(value, endTime - 1);
    setStartTime(newStartTime);
    videoPlayerRef.current?.seek(newStartTime);
    setPreviewPaused(true); // Pause preview when slider is moved
  };

  const handleEndTimeChange = (value: number): void => {
    const newEndTime = Math.max(value, startTime + 1);
    setEndTime(newEndTime);
  };

  // Updated performTrim function for react-native-video-trim v5.0.3
  const performTrim = async (): Promise<void> => {
    if (!videoUri) {
      Alert.alert("Error", "No video selected for trimming.");
      return;
    }

    setIsTrimming(true);
    setTrimProgress(0);

    try {
      const trimDuration = endTime - startTime;
      if (trimDuration <= 0) {
        Alert.alert("Error", "Invalid trim duration. Please adjust the trim points.");
        setIsTrimming(false);
        return;
      }

      // Ensure input video has proper file:// prefix
      let inputPath = videoUri;
      if (!inputPath.startsWith('file://') && !inputPath.startsWith('content://')) {
        inputPath = `file://${videoUri}`;
      }

      console.log('🎬 Trimming video:', {
        source: inputPath,
        startTime: startTime,
        endTime: endTime,
        duration: trimDuration
      });

      // Validate file first
      try {
        const isValid = await isValidFile(inputPath);
        if (!isValid) {
          throw new Error('Invalid video file or file does not exist');
        }
      } catch (validationError) {
        console.error('File validation error:', validationError);
        throw new Error('Could not validate video file. Please ensure the file exists.');
      }

      // Create a simulated progress interval
      const progressInterval = setInterval(() => {
        setTrimProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 500);

      // Trim options for react-native-video-trim v5.0.3
      // IMPORTANT: The library expects times in SECONDS, not milliseconds
      const trimOptions: TrimOptions = {
        startTime: Math.floor(startTime * 1000), // Convert seconds to milliseconds
        endTime: Math.floor(endTime * 1000),     // Convert seconds to milliseconds
        outputExt: 'mp4'
      };

      console.log('Calling trim with options:', trimOptions);

      try {
        // The trim function returns the output path directly
        const outputPath = await trim(inputPath, trimOptions);

        clearInterval(progressInterval);
        setTrimProgress(100);

        console.log('✅ Trim completed, output path:', outputPath);

        // Ensure the output path has proper prefix
        let finalOutputPath = outputPath;
        if (typeof outputPath === 'string' && !outputPath.startsWith('file://')) {
          finalOutputPath = `file://${outputPath}`;
        }

        // Get file info
        try {
          const cleanPath = finalOutputPath.replace('file://', '');
          const fileInfo = await RNFS.stat(cleanPath);

          const trimmedInfo: TrimmedVideoInfo = {
            uri: finalOutputPath,
            duration: trimDuration, // Duration in seconds
            startTime: startTime,   // Start time in seconds
            endTime: endTime,       // End time in seconds
            fileSize: fileInfo.size,
            method: 'react-native-video-trim-v5',
          };

          console.log('✅ Trimmed video info:', trimmedInfo);

          setIsTrimming(false);
          setTrimProgress(0);

          // Call the completion handler
          onTrimComplete(trimmedInfo);

        } catch (statError) {
          console.error('Error getting file stats:', statError);
          // Still complete even if we can't get file size
          const trimmedInfo: TrimmedVideoInfo = {
            uri: finalOutputPath,
            duration: trimDuration,
            startTime: startTime,
            endTime: endTime,
            fileSize: 0,
            method: 'react-native-video-trim-v5',
          };

          setIsTrimming(false);
          setTrimProgress(0);
          onTrimComplete(trimmedInfo);
        }

      } catch (trimError: any) {
        clearInterval(progressInterval);
        throw trimError;
      }

    } catch (error: any) {
      console.error('❌ Trim error:', error);
      setIsTrimming(false);
      setTrimProgress(0);

      let errorMessage = "Failed to trim video.";
      if (error.message) {
        errorMessage = error.message;
      }

      Alert.alert(
        "Trim Failed",
        errorMessage,
        [{ text: "OK" }]
      );
    }
  };

  const handleSaveAndClose = (): void => {
    Alert.alert(
      "Save Trimmed Video",
      `Trim from ${formatTime(startTime)} to ${formatTime(endTime)} (${formatTime(endTime - startTime)} duration)?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Save",
          onPress: performTrim,
          style: "default"
        }
      ]
    );
  };

  if (!visible) return null;

  const trimDuration = endTime - startTime;
  const isDurationValid = trimDuration > 0 && trimDuration <= maxDuration;

  return (
    <Modal
      animationType="slide"
      transparent={false}
      visible={visible}
      onRequestClose={onCancel}
    >
      <View style={styles.trimmerContainer}>
        {/* Header */}
        <View style={styles.trimmerHeader}>
          <TouchableOpacity onPress={onCancel} disabled={isTrimming}>
            <MaterialIcons name="close" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.trimmerTitle}>Trim Video</Text>
          <TouchableOpacity
            onPress={handleSaveAndClose}
            disabled={isTrimming || !isDurationValid}
            style={{ opacity: isTrimming || !isDurationValid ? 0.5 : 1 }}
          >
            <Text style={styles.saveButtonText}>
              {isTrimming ? 'Processing...' : 'Save'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Video Preview */}
        <View style={styles.videoPreviewContainer}>
          {videoUri ? (
            <>
              <Video
                ref={videoPlayerRef}
                source={{ uri: videoUri }}
                style={styles.trimmerVideoPreview}
                paused={previewPaused}
                repeat={true}
                resizeMode="contain"
                onProgress={handleVideoProgress}
                onLoad={(data: VideoLoadData) => {
                  console.log('Video loaded in trimmer:', data);
                  // Seek to start position when loaded
                  videoPlayerRef.current?.seek(startTime);
                }}
                onError={(error: any) => {
                  console.error('Video error in trimmer:', error);
                  Alert.alert("Error", "Failed to load video preview");
                }}
                volume={1.0}
                rate={1.0}
              />

              {/* Play/Pause Overlay */}
              <TouchableOpacity
                style={styles.playPauseOverlay}
                onPress={handlePlayPause}
                activeOpacity={0.8}
              >
                <View style={styles.playPauseButton}>
                  <MaterialIcons
                    name={previewPaused ? "play-arrow" : "pause"}
                    size={50}
                    color="#fff"
                  />
                </View>
              </TouchableOpacity>

              {/* Current Time Indicator */}
              <View style={styles.timeIndicator}>
                <Text style={styles.timeText}>
                  {formatTime(currentTime)} / {formatTime(videoDuration || 0)}
                </Text>
              </View>
            </>
          ) : (
            <View style={styles.noVideoContainer}>
              <MaterialIcons name="videocam-off" size={50} color="#666" />
              <Text style={styles.noVideoText}>No video loaded</Text>
            </View>
          )}
        </View>

        {/* Trim Controls */}
        <View style={styles.trimControlsContainer}>
          {/* Duration Info */}
          <View style={styles.durationInfoContainer}>
            <Text style={styles.durationLabel}>Trimmed Duration:</Text>
            <Text style={[
              styles.durationValue,
              { color: isDurationValid ? '#4CAF50' : '#ff5252' }
            ]}>
              {formatTime(trimDuration)} / {formatTime(maxDuration)} max
            </Text>
          </View>

          {/* Start Time Slider */}
          <View style={styles.sliderContainer}>
            <Text style={styles.sliderLabel}>Start: {formatTime(startTime)}</Text>
            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={videoDuration || maxDuration}
              value={startTime}
              onValueChange={handleStartTimeChange}
              minimumTrackTintColor="#ed167e"
              maximumTrackTintColor="#333"
              thumbTintColor="#ed167e"
              disabled={isTrimming}
            />
          </View>

          {/* End Time Slider */}
          <View style={styles.sliderContainer}>
            <Text style={styles.sliderLabel}>End: {formatTime(endTime)}</Text>
            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={videoDuration || maxDuration}
              value={endTime}
              onValueChange={handleEndTimeChange}
              minimumTrackTintColor="#ed167e"
              maximumTrackTintColor="#333"
              thumbTintColor="#ed167e"
              disabled={isTrimming}
            />
          </View>

          {/* Trim Range Visual */}
          <View style={styles.trimRangeVisual}>
            <View style={styles.trimRangeBar}>
              <View
                style={[
                  styles.trimRangeSelected,
                  {
                    left: `${(startTime / (videoDuration || maxDuration)) * 100}%`,
                    width: `${((endTime - startTime) / (videoDuration || maxDuration)) * 100}%`,
                  }
                ]}
              />
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtonsContainer}>
            <TouchableOpacity
              style={[styles.actionButton, styles.cancelButton]}
              onPress={onCancel}
              disabled={isTrimming}
            >
              <Text style={styles.actionButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.actionButton,
                styles.trimButton,
                { opacity: isDurationValid && !isTrimming ? 1 : 0.5 }
              ]}
              onPress={handleSaveAndClose}
              disabled={!isDurationValid || isTrimming}
            >
              {isTrimming ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <MaterialIcons name="content-cut" size={20} color="#fff" />
                  <Text style={styles.actionButtonText}>Trim Video</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Warning Messages */}
          {!isDurationValid && (
            <View style={styles.warningContainer}>
              <MaterialIcons name="warning" size={16} color="#ff5252" />
              <Text style={styles.warningText}>
                {trimDuration <= 0
                  ? "End time must be after start time"
                  : `Duration exceeds maximum of ${maxDuration} seconds`}
              </Text>
            </View>
          )}
        </View>

        {/* Processing Overlay */}
        {isTrimming && (
          <View style={styles.processingOverlay}>
            <View style={styles.processingContainer}>
              <ActivityIndicator size="large" color="#ed167e" />
              <Text style={styles.processingText}>Trimming video...</Text>

              {/* Progress Bar */}
              {trimProgress > 0 && (
                <View style={styles.progressContainer}>
                  <View style={styles.progressBarBackground}>
                    <View style={[styles.progressBarFill, { width: `${trimProgress}%` }]} />
                  </View>
                  <Text style={styles.progressText}>{trimProgress}%</Text>
                </View>
              )}

              <Text style={styles.processingSubtext}>
                {trimProgress > 0
                  ? `Processing... ${trimProgress}% complete`
                  : "Please wait, this may take a moment"
                }
              </Text>

              {/* Tips for user */}
              <View style={styles.tipsContainer}>
                <Text style={styles.tipsText}>💡 Tip: Shorter videos trim faster</Text>
                <Text style={styles.tipsText}>⚡ Processing time depends on video size</Text>
              </View>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
};

// Main EditPostScreen Component
const EditPostScreen: React.FC<{ route: { params: RouteParams } }> = ({ route }) => {
  const navigation = useNavigation();
  const { selectedMedia, contentType } = route.params;
  const [caption, setCaption] = useState<string>("");
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [deviceCapabilities, setDeviceCapabilities] = useState<DeviceCapabilities | null>(null);
  const [appState, setAppState] = useState<string>(AppState.currentState);
  const [uploadRetries, setUploadRetries] = useState<number>(0);
  // Video trimmer states
  const [showVideoTrimmer, setShowVideoTrimmer] = useState<boolean>(false);
  const [videoNeedsTrimming, setVideoNeedsTrimming] = useState<boolean>(false);
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [trimmedVideo, setTrimmedVideo] = useState<TrimmedVideoInfo | null>(null);
  const [checkingVideoDuration, setCheckingVideoDuration] = useState<boolean>(false);
  // File size display
  const [mediaFileSizes, setMediaFileSizes] = useState<{ [key: number]: number }>({});
  const { token, user, isAuthenticated } = useAuth();
  const videoRef = useRef<Video>(null);
  const uploadAbortController = useRef<AbortController | null>(null);
  // Device capabilities check
  const getDeviceCapabilities = (): DeviceCapabilities => {
    try {
      const totalMemory = DeviceInfo.getTotalMemorySync();
      const availableMemory = DeviceInfo.getFreeDiskStorageSync();
      const androidVersion = Platform.Version as number;
      return {
        totalMemory,
        availableMemory,
        androidVersion,
        isLowEndDevice: totalMemory < 1 * 1024 * 1024 * 1024,
        isOldAndroid: androidVersion < 21,
      };
    } catch (error) {
      console.log('Device capabilities detection failed, using defaults');
      return {
        totalMemory: 4 * 1024 * 1024 * 1024,
        availableMemory: 10 * 1024 * 1024 * 1024,
        androidVersion: 28,
        isLowEndDevice: false,
        isOldAndroid: false,
      };
    }
  };
  // Helper function to format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };
  // Get current file size for media
  const getCurrentFileSize = async (mediaItem: MediaItem): Promise<number> => {
    try {
      if (mediaItem.compressedSize) {
        return mediaItem.compressedSize;
      }
      const uri = mediaItem.uri || mediaItem.image?.uri;
      if (!uri) return 0;
      const cleanUri = uri.replace('file://', '');
      const fileInfo = await RNFS.stat(cleanUri);
      return fileInfo.size;
    } catch (error) {
      console.log('Could not get file size for media:', error);
      return mediaItem.fileSize || 0;
    }
  };
  useEffect(() => {
    const checkDeviceCapabilities = async (): Promise<void> => {
      try {
        const capabilities = getDeviceCapabilities();
        setDeviceCapabilities(capabilities);
        console.log('📱 Device capabilities:', {
          totalMemory: Math.round(capabilities.totalMemory / (1024 * 1024 * 1024)) + 'GB',
          availableStorage: Math.round(capabilities.availableMemory / (1024 * 1024 * 1024)) + 'GB',
          androidVersion: capabilities.androidVersion,
          isLowEndDevice: capabilities.isLowEndDevice,
          isOldAndroid: capabilities.isOldAndroid
        });
      } catch (error) {
        console.error('❌ Failed to get device capabilities:', error);
        setDeviceCapabilities({
          totalMemory: 0,
          availableMemory: 0,
          androidVersion: 0,
          isLowEndDevice: false,
          isOldAndroid: false
        });
      }
    };
    checkDeviceCapabilities();
  }, [contentType]);
  useEffect(() => {
    // Get file sizes for all media items
    const getFileSizes = async (): Promise<void> => {
      const sizes: { [key: number]: number } = {};
      for (let i = 0; i < selectedMedia.length; i++) {
        const mediaItem = selectedMedia[i];
        try {
          const size = await getCurrentFileSize(mediaItem);
          sizes[i] = size;
        } catch (error) {
          console.log(`Failed to get size for media ${i}:`, error);
          sizes[i] = 0;
        }
      }
      setMediaFileSizes(sizes);
    };
    if (selectedMedia && selectedMedia.length > 0) {
      getFileSizes();
    }
  }, [selectedMedia]);
  useEffect(() => {
    if (contentType === 'reel' && selectedMedia[0] && !trimmedVideo) {
      const videoMedia = selectedMedia[0];
      if (videoMedia.compressionMethod && videoMedia.compressionMethod !== 'none') {
        console.log('✅ Video already processed with compression');
        setCheckingVideoDuration(false);
      } else {
        setCheckingVideoDuration(true);
      }
    }
  }, [contentType, selectedMedia, trimmedVideo]);
  useEffect(() => {
    const handleAppStateChange = (nextAppState: string): void => {
      if (appState.match(/inactive|background/) && nextAppState === 'active') {
        console.log('📱 App has come to the foreground');
      } else if (nextAppState.match(/inactive|background/)) {
        console.log('📱 App has gone to the background');
        if (uploading && uploadAbortController.current) {
          console.log('⚠️ Pausing upload due to app backgrounding');
        }
      }
      setAppState(nextAppState);
    };
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [appState, uploading]);
  useEffect(() => {
    if (!isAuthenticated) {
      Alert.alert("Authentication Error", "You must be logged in to create a post. Please log in again.");
      (navigation as any).navigate('Login');
    }
    const backAction = (): boolean => {
      if (caption.trim() || uploading || showVideoTrimmer) {
        Alert.alert(
          "Discard Changes?",
          "You have unsaved changes. Are you sure you want to go back?",
          [
            { text: "Stay", style: "cancel" },
            {
              text: "Discard", style: "destructive", onPress: () => {
                if (uploading && uploadAbortController.current) {
                  uploadAbortController.current.abort();
                }
                navigation.goBack();
              }
            }
          ]
        );
        return true;
      }
      return false;
    };
    const backHandler = BackHandler.addEventListener("hardwareBackPress", backAction);
    return () => backHandler.remove();
  }, [isAuthenticated, navigation, caption, uploading, showVideoTrimmer]);
  const handleBack = (): void => {
    if (caption.trim() || uploading || showVideoTrimmer) {
      Alert.alert(
        "Discard Changes?",
        "You have unsaved changes. Are you sure you want to go back?",
        [
          { text: "Stay", style: "cancel" },
          {
            text: "Discard", style: "destructive", onPress: () => {
              if (uploading && uploadAbortController.current) {
                uploadAbortController.current.abort();
              }
              navigation.goBack();
            }
          }
        ]
      );
    } else {
      navigation.goBack();
    }
  };
  const onVideoLoad = (data: VideoLoadData): void => {
    console.log('🎬 Video loaded with duration:', data.duration);
    setVideoDuration(data.duration);
    setCheckingVideoDuration(false);
    const videoMedia = selectedMedia[0];
    if (videoMedia.compressionMethod && videoMedia.compressionMethod !== 'none') {
      console.log('✅ Video already processed, skipping duration check');
      setVideoNeedsTrimming(false);
      return;
    }
    if (data.duration > MAX_REEL_DURATION) {
      setVideoNeedsTrimming(true);
      console.log(`⚠️ Video duration ${Math.round(data.duration)}s exceeds max ${MAX_REEL_DURATION}s`);
    } else {
      setVideoNeedsTrimming(false);
      console.log('✅ Video duration is within limits');
    }
  };
  const handleTrimComplete = (trimmedVideoInfo: TrimmedVideoInfo): void => {
    console.log('✅ Video trimmed successfully:', trimmedVideoInfo);
    setTrimmedVideo(trimmedVideoInfo);
    setShowVideoTrimmer(false);
    setVideoNeedsTrimming(false);
    Alert.alert(
      "Success! ✂️",
      `Video trimmed to ${Math.round(trimmedVideoInfo.duration)} seconds`,
      [{ text: "OK" }]
    );
  };
  const handleTrimCancel = (): void => {
    setShowVideoTrimmer(false);
  };
  const handleTrimButtonPress = (): void => {
    if (!videoDuration) {
      Alert.alert("Error", "Video is still loading. Please wait.");
      return;
    }
    setShowVideoTrimmer(true);
  };
  const performMemoryCleanup = (): void => {
    try {
      if ((global as any).gc) {
        (global as any).gc();
      }
      console.log('🧹 Memory cleanup performed');
    } catch (error) {
      console.log('⚠️ Memory cleanup not available');
    }
  };
  const normalizeFileUri = (uri?: string): string | null => {
    if (!uri) return null;
    console.log('📁 Normalizing URI:', uri);
    if (uri.startsWith('content://') || uri.startsWith('file://') || uri.startsWith('ph://')) {
      return uri;
    } else if (uri.startsWith('/')) {
      return `file://${uri}`;
    }
    return uri;
  };
  const validateVideoFile = (videoAsset: MediaItem): boolean => {
    console.log('🎬 Validating video file:', videoAsset);
    if (!videoAsset) {
      throw new Error('No video file provided');
    }
    if (!videoAsset.uri && !videoAsset.image?.uri && !trimmedVideo?.uri) {
      throw new Error('Invalid video file - no URI found');
    }
    console.log('✅ Video validation passed');
    return true;
  };
  const getMimeTypeFromUri = (uri: string, contentType: string): string => {
    if (!uri) return contentType === 'reel' ? 'video/mp4' : 'image/jpeg';
    const uriLower = uri.toLowerCase();
    if (contentType === 'reel') {
      if (uriLower.includes('.mp4')) return 'video/mp4';
      if (uriLower.includes('.mov')) return 'video/quicktime';
      if (uriLower.includes('.avi')) return 'video/x-msvideo';
      if (uriLower.includes('.3gp')) return 'video/3gpp';
      if (uriLower.includes('.webm')) return 'video/webm';
      return 'video/mp4';
    } else {
      if (uriLower.includes('.jpg') || uriLower.includes('.jpeg')) return 'image/jpeg';
      if (uriLower.includes('.png')) return 'image/png';
      if (uriLower.includes('.webp')) return 'image/webp';
      if (uriLower.includes('.gif')) return 'image/gif';
      return 'image/jpeg';
    }
  };
  const generateFileName = (uri: string, mimeType: string, contentType: string, indexOrSuffix: number | string = 0): string => {
    const timestamp = Date.now();
    const cleanUserId = user?._id ? user._id.replace(/[^a-zA-Z0-9]/g, '').substring(0, 8) : 'user';
    let extension = 'jpg';
    if (contentType === 'reel') {
      if (mimeType.includes('mp4')) extension = 'mp4';
      else if (mimeType.includes('quicktime')) extension = 'mov';
      else if (mimeType.includes('3gpp')) extension = '3gp';
      else extension = 'mp4';
    } else {
      if (mimeType.includes('png')) extension = 'png';
      else if (mimeType.includes('webp')) extension = 'webp';
      else if (mimeType.includes('gif')) extension = 'gif';
      else extension = 'jpg';
    }
    const prefix = contentType === 'reel' ? 'reel' : 'photo';
    const suffix = typeof indexOrSuffix === 'string' ? indexOrSuffix : `_${indexOrSuffix}`;
    return `${prefix}_${cleanUserId}_${timestamp}${suffix}.${extension}`;
  };
  const createFormData = (): FormData => {
    console.log('📝 Creating FormData for:', contentType);
    console.log('📱 Selected media:', selectedMedia.length, 'items');
    performMemoryCleanup();
    const formData = new FormData();
    formData.append('content', caption.trim());
    formData.append('privacy', 'public');
    if (contentType === 'reel') {
      const videoAsset = selectedMedia[0];
      let videoUri: string;
      if (trimmedVideo) {
        console.log('✅ Using trimmed video file');
        videoUri = trimmedVideo.uri;
        formData.append('videoPreTrimmed', 'true');
        formData.append('originalDuration', videoDuration.toString());
        formData.append('trimmedDuration', trimmedVideo.duration.toString());
        formData.append('trimMethod', trimmedVideo.method || 'local');
      } else {
        videoUri = videoAsset?.uri || videoAsset?.image?.uri || videoAsset?.originalUri || '';
        console.log('📹 Using original video URI:', videoUri);
      }
      videoUri = normalizeFileUri(videoUri) || '';
      if (!videoUri) {
        throw new Error('No valid video URI found');
      }
      validateVideoFile(videoAsset);
      const detectedMimeType = videoAsset?.type || getMimeTypeFromUri(videoUri, 'reel');
      let fileSuffix = '';
      if (trimmedVideo) {
        fileSuffix = '_trimmed';
      } else if (videoAsset.isCompressed) {
        fileSuffix = '_compressed';
      }
      const fileName = generateFileName(videoUri, detectedMimeType, 'reel', fileSuffix);
      if (videoAsset.isCompressed) {
        formData.append('videoCompressed', 'true');
        formData.append('originalVideoSize', videoAsset.originalSize?.toString() || '0');
        formData.append('compressedVideoSize', videoAsset.compressedSize?.toString() || '0');
        formData.append('compressionRatio', videoAsset.compressionRatio?.toString() || '0');
        formData.append('compressionMethod', videoAsset.compressionMethod || 'react-native-compressor');
      }
      const videoFile = {
        uri: videoUri,
        type: detectedMimeType,
        name: fileName
      };
      formData.append('video', videoFile as any);
      console.log('✅ Video file appended to FormData');
    } else {
      console.log('📸 Processing', selectedMedia.length, 'images');
      selectedMedia.forEach((photo, index) => {
        let imageUri = photo?.uri || photo?.image?.uri || photo?.originalUri;
        imageUri = normalizeFileUri(imageUri);
        if (!imageUri) {
          console.error(`❌ No valid URI for image ${index + 1}`);
          return;
        }
        const detectedMimeType = photo?.type || getMimeTypeFromUri(imageUri, 'post');
        const fileName = generateFileName(imageUri, detectedMimeType, 'post', index);
        const photoFile = {
          uri: imageUri,
          type: detectedMimeType,
          name: fileName
        };
        formData.append('images', photoFile as any);
        console.log(`✅ Image ${index + 1} appended to FormData`);
      });
    }
    return formData;
  };
  const uploadContent = async (): Promise<void> => {
    console.log('🚀 Starting upload process...');
    if (!isAuthenticated || !token) {
      Alert.alert("Authentication Error", "You are not logged in. Please login again.");
      (navigation as any).navigate('Login');
      return;
    }
    if (contentType === 'reel' && videoNeedsTrimming && !trimmedVideo) {
      Alert.alert(
        "Video Too Long",
        `Your video needs to be trimmed to maximum ${MAX_REEL_DURATION} seconds before uploading.`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Trim Video", onPress: () => setShowVideoTrimmer(true) }
        ]
      );
      return;
    }
    if (contentType === 'reel') {
      const videoAsset = selectedMedia[0];
      if (!videoAsset) {
        Alert.alert("No Video Selected", "Please select a video to upload.");
        return;
      }
      try {
        validateVideoFile(videoAsset);
      } catch (error: any) {
        Alert.alert("Video Validation Failed", error.message);
        return;
      }
    } else {
      if (selectedMedia.length === 0) {
        Alert.alert("No Images Selected", "Please select at least one image to upload.");
        return;
      }
    }
    setUploading(true);
    setUploadProgress(0);
    uploadAbortController.current = new AbortController();
    try {
      performMemoryCleanup();
      const formData = createFormData();
      const endpoint = `${API_BASE_URL}/posts/${contentType === 'reel' ? 'create-reel' : 'create'}`;
      console.log('🎯 Upload endpoint:', endpoint);
      const uploadPromise = new Promise<any>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        uploadAbortController.current!.signal.addEventListener('abort', () => {
          xhr.abort();
          reject(new Error('Upload cancelled'));
        });
        let lastProgressUpdate = 0;
        xhr.upload.addEventListener('progress', (event) => {
          const now = Date.now();
          if (event.lengthComputable && now - lastProgressUpdate > 100) {
            const progress = (event.loaded / event.total) * 100;
            setUploadProgress(Math.round(progress));
            console.log(`📊 Upload progress: ${Math.round(progress)}%`);
            lastProgressUpdate = now;
          }
        });
        xhr.addEventListener('load', () => {
          console.log('📡 Upload completed with status:', xhr.status);
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const response = JSON.parse(xhr.responseText);
              console.log('✅ Upload successful:', response);
              resolve(response);
            } catch (parseError) {
              console.error('❌ Failed to parse success response:', parseError);
              resolve({ message: `${contentType === 'reel' ? 'Reel' : 'Post'} uploaded successfully!` });
            }
          } else {
            console.error('❌ Server error:', xhr.status);
            let errorMessage = `Upload failed with status ${xhr.status}`;
            try {
              const errorResponse = JSON.parse(xhr.responseText);
              errorMessage = errorResponse.message || errorResponse.error || errorMessage;
            } catch (parseError) {
              console.log('Could not parse error response');
            }
            reject(new Error(errorMessage));
          }
        });
        xhr.addEventListener('error', (event) => {
          console.error('❌ Network error during upload:', event);
          reject(new Error('Network error. Please check your connection and try again.'));
        });
        xhr.addEventListener('timeout', () => {
          console.error('❌ Upload timeout');
          reject(new Error('Upload timed out. Please try again.'));
        });
        xhr.open('POST', endpoint);
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.timeout = contentType === 'reel' ? 1800000 : 900000;
        console.log('📤 Sending upload request...');
        xhr.send(formData);
      });
      const responseData = await uploadPromise;
      console.log('✅ Upload completed successfully');
      performMemoryCleanup();
      setUploadRetries(0);
      // Clean up trimmed video file if it exists
      if (trimmedVideo && trimmedVideo.uri) {
        try {
          const trimmedPath = trimmedVideo.uri.replace('file://', '');
          await RNFS.unlink(trimmedPath);
          console.log('Cleaned up trimmed video file');
        } catch (error) {
          console.log('Could not clean up trimmed video:', error);
        }
      }
      let successMessage = responseData.message || `${contentType === 'reel' ? 'Reel' : 'Post'} uploaded successfully!`;
      if (responseData.data?.reward?.message) {
        successMessage += `
🎉 ${responseData.data.reward.message}`;
      }
      Alert.alert("Success! 🎉", successMessage, [
        {
          text: "OK",
          onPress: () => {
            setCaption("");
            setTrimmedVideo(null);
            (navigation as any).navigate('HomeScreen');
          },
        },
      ]);
    } catch (error: any) {
      console.error('❌ Upload error:', error);
      performMemoryCleanup();
      let errorMessage = "Upload failed. Please try again.";
      let showRetryOption = false;
      if (error.message.includes('cancelled')) {
        return;
      } else if (error.message.includes('Network error')) {
        errorMessage = "Network error. Please check your internet connection.";
        showRetryOption = true;
      } else if (error.message.includes('timeout')) {
        errorMessage = "Upload timed out. Please check your connection.";
        showRetryOption = true;
      } else if (error.message) {
        errorMessage = error.message;
        showRetryOption = true;
      }
      if (showRetryOption && uploadRetries < 3) {
        Alert.alert(
          "Upload Failed",
          errorMessage + `
Retry attempt ${uploadRetries + 1}/3`,
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Retry",
              onPress: () => {
                setUploadRetries(prev => prev + 1);
                setTimeout(() => uploadContent(), 1000);
              }
            }
          ]
        );
      } else {
        Alert.alert("Upload Failed", errorMessage);
        setUploadRetries(0);
      }
    } finally {
      setUploading(false);
      setUploadProgress(0);
      uploadAbortController.current = null;
    }
  };
  const renderMediaPreview = (): JSX.Element => {
    if (contentType === 'reel') {
      const videoAsset = selectedMedia[0];
      let videoUri: string;
      if (trimmedVideo) {
        videoUri = trimmedVideo.uri;
      } else {
        videoUri = normalizeFileUri(videoAsset?.uri || videoAsset?.image?.uri || videoAsset?.originalUri) || '';
      }
      if (!videoUri) {
        return (
          <View style={styles.mediaPreviewError}>
            <Text style={styles.errorText}>Video not accessible</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.retryText}>Select Again</Text>
            </TouchableOpacity>
          </View>
        );
      }
      return (
        <View style={styles.mediaPreviewContainer}>
          <View style={styles.mediaPreview}>
            <Video
              ref={videoRef}
              source={{ uri: videoUri }}
              style={styles.videoPreview}
              controls={true}
              resizeMode="cover"
              paused={false}
              repeat={true}
              muted={true}
              onError={(error: any) => {
                console.error('Video playback error:', error);
              }}
              onLoad={checkingVideoDuration ? onVideoLoad : (data: VideoLoadData) => {
                console.log('Video loaded (not checking duration):', data);
                if (!videoDuration || trimmedVideo) {
                  setVideoDuration(data.duration);
                }
              }}
            />
            {checkingVideoDuration && (
              <View style={styles.durationCheckOverlay}>
                <ActivityIndicator color="#ed167e" size="large" />
                <Text style={styles.durationCheckText}>Checking video duration...</Text>
              </View>
            )}
            {/* Video Info Overlays */}
            <View style={styles.videoInfoContainer}>
              <View style={styles.durationIndicator}>
                <MaterialIcons name="timer" size={14} color="#fff" />
                <Text style={styles.durationText}>
                  {trimmedVideo
                    ? `${Math.round(trimmedVideo.duration)}s`
                    : videoDuration
                      ? `${Math.round(videoDuration)}s`
                      : 'Loading...'
                  }
                </Text>
                {videoDuration > MAX_REEL_DURATION && !trimmedVideo && (
                  <Text style={styles.durationWarning}> (Max: {MAX_REEL_DURATION}s)</Text>
                )}
              </View>
              {(videoAsset.compressedSize || mediaFileSizes[0]) && (
                <View style={styles.fileSizeIndicator}>
                  <MaterialIcons name="folder" size={14} color="#fff" />
                  <Text style={styles.fileSizeText}>
                    {formatFileSize(videoAsset.compressedSize || mediaFileSizes[0] || 0)}
                  </Text>
                </View>
              )}
              {trimmedVideo && (
                <View style={styles.statusBadge}>
                  <MaterialIcons name="check-circle" size={14} color="#4CAF50" />
                  <Text style={styles.statusText}>Trimmed</Text>
                </View>
              )}
              {videoAsset.isCompressed && (
                <View style={[styles.statusBadge, { top: trimmedVideo ? 84 : 50 }]}>
                  <MaterialIcons name="compress" size={14} color="#2196F3" />
                  <Text style={styles.statusText}>Compressed</Text>
                </View>
              )}
            </View>
          </View>
          {/* Trim Button Section */}
          <View style={styles.trimButtonSection}>
            <TouchableOpacity
              style={[
                styles.trimMainButton,
                videoNeedsTrimming && !trimmedVideo && styles.trimButtonRequired,
                trimmedVideo && styles.trimButtonCompleted,
              ]}
              onPress={handleTrimButtonPress}
              activeOpacity={0.8}
            >
              <MaterialIcons
                name={trimmedVideo ? "check" : "content-cut"}
                size={22}
                color="#fff"
              />
              <Text style={styles.trimButtonText}>
                {trimmedVideo
                  ? `✓ Trimmed to ${Math.round(trimmedVideo.duration)}s`
                  : videoNeedsTrimming
                    ? `Trim Video (Required)`
                    : `Trim Video`
                }
              </Text>
            </TouchableOpacity>
            {videoNeedsTrimming && !trimmedVideo && (
              <View style={styles.trimRequiredInfo}>
                <MaterialIcons name="info" size={16} color="#ff9800" />
                <Text style={styles.trimRequiredText}>
                  Video must be {MAX_REEL_DURATION}s or less to upload
                </Text>
              </View>
            )}
            {trimmedVideo && (
              <TouchableOpacity
                style={styles.retrimButton}
                onPress={handleTrimButtonPress}
              >
                <Text style={styles.retrimButtonText}>Adjust Trim</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      );
    } else {
      // Image preview for posts
      return (
        <ScrollView horizontal style={styles.mediaPreview} showsHorizontalScrollIndicator={false}>
          {selectedMedia.map((photo, index) => {
            const imageUri = normalizeFileUri(photo.uri || photo.image?.uri || photo.originalUri);
            if (!imageUri) {
              return (
                <View key={index} style={styles.photoContainer}>
                  <View style={styles.imageError}>
                    <Text style={styles.errorText}>Image not accessible</Text>
                  </View>
                </View>
              );
            }
            return (
              <View key={index} style={styles.photoContainer}>
                <Image
                  source={{ uri: imageUri }}
                  style={styles.photoPreview}
                  resizeMode="cover"
                  onError={(error: any) => {
                    console.error(`Failed to load image at index ${index}:`, error);
                  }}
                />
                {selectedMedia.length > 1 && (
                  <View style={styles.photoIndicator}>
                    <Text style={styles.photoIndicatorText}>{index + 1}/{selectedMedia.length}</Text>
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      );
    }
  };
  if (!isAuthenticated) {
    return (
      <View style={styles.errorContainer}>
        <StatusBar barStyle="light-content" backgroundColor="black" />
        <Text style={styles.errorText}>Authentication Required</Text>
        <Text style={styles.errorSubText}>Please login to upload content.</Text>
        <TouchableOpacity
          style={styles.loginButton}
          onPress={() => (navigation as any).navigate('Login')}
        >
          <Text style={styles.loginButtonText}>Go to Login</Text>
        </TouchableOpacity>
      </View>
    );
  }
  return (
    <>
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="black" />
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Text style={styles.backText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            New {contentType === 'reel' ? 'Reel' : 'Post'}
          </Text>
          <TouchableOpacity
            onPress={uploadContent}
            disabled={uploading || (contentType === 'reel' && videoNeedsTrimming && !trimmedVideo)}
            style={[
              styles.shareButton,
              { opacity: uploading || (contentType === 'reel' && videoNeedsTrimming && !trimmedVideo) ? 0.5 : 1 },
            ]}
          >
            {uploading ? (
              <View style={styles.uploadingContainer}>
                <ActivityIndicator color="#ed167e" size="small" />
                {uploadProgress > 0 && (
                  <Text style={styles.progressText}>{uploadProgress}%</Text>
                )}
              </View>
            ) : (
              <Text style={styles.shareText}>Share</Text>
            )}
          </TouchableOpacity>
        </View>
        {/* Upload Progress Bar */}
        {uploading && (
          <View style={styles.progressBarContainer}>
            <View style={[styles.progressBar, { width: `${uploadProgress}%` }]} />
            <Text style={styles.uploadingText}>
              Uploading... {uploadProgress}%
            </Text>
          </View>
        )}
        {/* Content */}
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {renderMediaPreview()}
          {/* Caption Section */}
          <View style={styles.captionSection}>
            <View style={styles.userInfo}>
              <Text style={styles.userName}>{user?.fullName || 'User'}</Text>
            </View>
            <TextInput
              style={styles.captionInput}
              placeholder={`Write a caption...`}
              placeholderTextColor="#888"
              multiline
              value={caption}
              onChangeText={setCaption}
              maxLength={2000}
              textAlignVertical="top"
              editable={!uploading}
            />
            <Text style={styles.characterCount}>
              {caption.length}/2000
            </Text>
          </View>
        </ScrollView>
      </View>
      {/* Custom Video Trimmer Modal */}
      {showVideoTrimmer && contentType === 'reel' && (
        <CustomVideoTrimmer
          visible={showVideoTrimmer}
          videoUri={normalizeFileUri(
            selectedMedia[0]?.uri ||
            selectedMedia[0]?.image?.uri ||
            selectedMedia[0]?.originalUri
          ) || ''}
          videoDuration={videoDuration}
          onTrimComplete={handleTrimComplete}
          onCancel={handleTrimCancel}
          maxDuration={MAX_REEL_DURATION}
        />
      )}
    </>
  );
};
export default EditPostScreen;
// Styles remain the same as in your original file
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "black",
  },
  errorContainer: {
    flex: 1,
    backgroundColor: "black",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 8,
    textAlign: "center",
  },
  errorSubText: {
    color: "#888",
    fontSize: 14,
    marginBottom: 20,
    textAlign: "center",
  },
  loginButton: {
    backgroundColor: "#ed167e",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  loginButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 10 : 44,
    paddingBottom: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: "#333",
  },
  backButton: {
    padding: 4,
  },
  backText: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "bold",
  },
  headerTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  shareButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  shareText: {
    color: "#ed167e",
    fontWeight: "600",
    fontSize: 16,
  },
  uploadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  progressText: {
    color: "#ed167e",
    fontSize: 12,
    fontWeight: "600",
  },
  progressBarContainer: {
    backgroundColor: "#111",
  },
  progressBar: {
    height: 3,
    backgroundColor: "#ed167e",
    borderRadius: 2,
  },
  uploadingText: {
    color: "#fff",
    fontSize: 12,
    textAlign: "center",
    paddingVertical: 8
  },
  content: {
    flex: 1,
  },
  mediaPreviewContainer: {
    backgroundColor: "#1a1a1a",
  },
  mediaPreview: {
    height: width,
    backgroundColor: "#1a1a1a",
  },
  mediaPreviewError: {
    height: width,
    backgroundColor: "#1a1a1a",
    justifyContent: "center",
    alignItems: "center",
  },
  retryButton: {
    backgroundColor: "#ed167e",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    marginTop: 12,
  },
  retryText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  videoPreview: {
    width: "100%",
    height: "100%",
  },
  durationCheckOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  durationCheckText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginTop: 12,
  },
  videoInfoContainer: {
    position: "absolute",
    top: 16,
    right: 16,
  },
  durationIndicator: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.8)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 8,
  },
  durationText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
    marginLeft: 4,
  },
  durationWarning: {
    color: "#ff9800",
    fontSize: 12,
    fontWeight: "600",
  },
  fileSizeIndicator: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.8)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 8,
  },
  fileSizeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
    marginLeft: 4,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.8)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 8,
  },
  statusText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
    marginLeft: 4,
  },
  trimButtonSection: {
    padding: 16,
    backgroundColor: "#0a0a0a",
    borderTopWidth: 0.5,
    borderTopColor: "#333",
  },
  trimMainButton: {
    backgroundColor: "#333",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 25,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  trimButtonRequired: {
    backgroundColor: "#ed167e",
  },
  trimButtonCompleted: {
    backgroundColor: "#4CAF50",
  },
  trimButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  trimRequiredInfo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    paddingHorizontal: 16,
  },
  trimRequiredText: {
    color: "#ff9800",
    fontSize: 13,
    marginLeft: 6,
    fontStyle: "italic",
  },
  retrimButton: {
    marginTop: 8,
    alignItems: "center",
  },
  retrimButtonText: {
    color: "#2196F3",
    fontSize: 14,
    textDecorationLine: "underline",
  },
  photoContainer: {
    width: width,
    height: width,
    position: "relative",
  },
  photoPreview: {
    width: "100%",
    height: "100%",
  },
  imageError: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#333",
  },
  photoIndicator: {
    position: "absolute",
    top: 16,
    right: 16,
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  photoIndicatorText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  captionSection: {
    padding: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: "#333",
  },
  userInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 8,
  },
  userName: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  captionInput: {
    color: "#fff",
    fontSize: 16,
    minHeight: 100,
    padding: 0,
    textAlignVertical: "top",
  },
  characterCount: {
    color: "#888",
    fontSize: 12,
    textAlign: "right",
    marginTop: 8,
  },
  // Custom Trimmer Styles
  trimmerContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  trimmerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 16 : 60,
    paddingBottom: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#333',
  },
  trimmerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  saveButtonText: {
    color: '#ed167e',
    fontSize: 16,
    fontWeight: '600',
  },
  videoPreviewContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  trimmerVideoPreview: {
    width: width,
    height: width * (16 / 9),
    maxHeight: height * 0.5,
    backgroundColor: '#111',
  },
  playPauseOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playPauseButton: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 40,
    padding: 10,
  },
  timeIndicator: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  timeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  noVideoContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  noVideoText: {
    color: '#666',
    fontSize: 16,
    marginTop: 10,
  },
  trimControlsContainer: {
    backgroundColor: '#111',
    padding: 20,
    borderTopWidth: 0.5,
    borderTopColor: '#333',
  },
  durationInfoContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  durationLabel: {
    color: '#888',
    fontSize: 14,
  },
  durationValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  sliderContainer: {
    marginBottom: 20,
  },
  sliderLabel: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 10,
    paddingHorizontal: 10,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  trimRangeVisual: {
    height: 50,
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  trimRangeBar: {
    flex: 1,
    backgroundColor: '#333',
    borderRadius: 4,
    overflow: 'hidden',
  },
  trimRangeSelected: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: '#ed167e',
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#333',
  },
  trimButton: {
    backgroundColor: '#ed167e',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 6,
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    paddingHorizontal: 10,
  },
  warningText: {
    color: '#ff5252',
    fontSize: 12,
    marginLeft: 6,
  },
  processingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  processingContainer: {
    backgroundColor: '#1a1a1a',
    padding: 30,
    borderRadius: 16,
    alignItems: 'center',
  },
  processingText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
  },
  processingSubtext: {
    color: '#888',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  progressContainer: {
    width: '100%',
    marginTop: 20,
    alignItems: 'center',
  },
  progressBarBackground: {
    width: '100%',
    height: 8,
    backgroundColor: '#333',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#ed167e',
    borderRadius: 4,
  },
  progressText: {
    color: '#ed167e',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
  },
  tipsContainer: {
    marginTop: 20,
    alignItems: 'center',
  },
  tipsText: {
    color: '#666',
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
});
