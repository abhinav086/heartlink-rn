import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  Alert,
  PanResponder,
  Platform,
} from 'react-native';
import Video from 'react-native-video';
import RNFS from 'react-native-fs';
import { trim as rnTrimVideo } from 'react-native-video-trim';

const { width } = Dimensions.get('window');
const MAX_DURATION = 25; // 25 seconds max for reels

const VideoTrimmer = ({
  videoUri,
  onTrimComplete,
  onCancel,
  videoDuration = 0
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(Math.min(videoDuration, MAX_DURATION));
  const [trimming, setTrimming] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [actualDuration, setActualDuration] = useState(videoDuration);

  // Store initial drag positions
  const [dragStartTime, setDragStartTime] = useState(0);
  const [dragEndTime, setDragEndTime] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const videoRef = useRef(null);

  // --- Calculations for timeline dimensions ---
  const timelineContainerPaddingHorizontal = 20;
  const timeLabelWidth = 40;
  const timelineMarginHorizontal = 10;
  const timelinePaddingHorizontal = 12;

  const draggableTrackWidth =
    width -
    (2 * timelineContainerPaddingHorizontal) -
    (2 * timeLabelWidth) -
    (2 * timelineMarginHorizontal) -
    (2 * timelinePaddingHorizontal);

  useEffect(() => {
    if (actualDuration > 0) {
      setEndTime(Math.min(actualDuration, MAX_DURATION));
      seekTo(0);
    }
  }, [actualDuration]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const onVideoLoad = (data) => {
    console.log('📹 Video loaded:', data);
    const duration = data.duration || videoDuration;
    setActualDuration(duration);
    setVideoLoaded(true);
    setEndTime(Math.min(duration, MAX_DURATION));
    seekTo(0);
  };

  const onVideoProgress = (data) => {
    setCurrentTime(data.currentTime);

    if (data.currentTime >= endTime) {
      setIsPlaying(false);
      videoRef.current?.seek(startTime);
    }
  };

  const seekTo = (time) => {
    const clampedTime = Math.max(0, Math.min(time, actualDuration));
    videoRef.current?.seek(clampedTime);
    setCurrentTime(clampedTime);
  };

  const togglePlayPause = () => {
    if (!videoLoaded) return;
    if (isPlaying) {
      setIsPlaying(false);
    } else {
      if (currentTime < startTime || currentTime >= endTime) {
        seekTo(startTime);
      }
      setIsPlaying(true);
    }
  };

  // Fixed drag calculation function
  const calculateTimeFromPosition = (pixelPosition) => {
    // Clamp pixel position to track bounds
    const clampedPosition = Math.max(0, Math.min(pixelPosition, draggableTrackWidth));
    // Convert pixel position to time
    return (clampedPosition / draggableTrackWidth) * actualDuration;
  };

  const getPositionFromTime = (time) => {
    return (time / actualDuration) * draggableTrackWidth;
  };

  // Updated PanResponder for start handle
  const startHandlePanResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    
    onPanResponderGrant: (evt, gestureState) => {
      // Store the initial start time when drag begins
      setDragStartTime(startTime);
      setIsDragging(true);
      console.log('Start handle drag began, initial startTime:', startTime);
    },
    
    onPanResponderMove: (evt, gestureState) => {
      // Calculate new position based on initial position + drag delta
      const initialPosition = getPositionFromTime(dragStartTime);
      const newPosition = initialPosition + gestureState.dx;
      const newTime = calculateTimeFromPosition(newPosition);
      
      // Apply constraints
      const maxStartTime = Math.min(endTime - 0.5, actualDuration - 0.5); // At least 0.5s before end
      let clampedStartTime = Math.max(0, Math.min(newTime, maxStartTime));
      
      // Ensure max duration constraint
      if (endTime - clampedStartTime > MAX_DURATION) {
        clampedStartTime = endTime - MAX_DURATION;
      }
      
      setStartTime(clampedStartTime);
      
      console.log('Start handle drag - newPosition:', newPosition.toFixed(2), 'newTime:', newTime.toFixed(2), 'clampedStartTime:', clampedStartTime.toFixed(2));
    },
    
    onPanResponderRelease: () => {
      setIsDragging(false);
      seekTo(startTime);
      console.log('Start handle drag ended, final startTime:', startTime);
    }
  });

  // Updated PanResponder for end handle
  const endHandlePanResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    
    onPanResponderGrant: (evt, gestureState) => {
      // Store the initial end time when drag begins
      setDragEndTime(endTime);
      setIsDragging(true);
      console.log('End handle drag began, initial endTime:', endTime);
    },
    
    onPanResponderMove: (evt, gestureState) => {
      // Calculate new position based on initial position + drag delta
      const initialPosition = getPositionFromTime(dragEndTime);
      const newPosition = initialPosition + gestureState.dx;
      const newTime = calculateTimeFromPosition(newPosition);
      
      // Apply constraints
      const minEndTime = Math.max(startTime + 0.5, 0.5); // At least 0.5s after start
      const maxEndTime = Math.min(startTime + MAX_DURATION, actualDuration);
      const clampedEndTime = Math.max(minEndTime, Math.min(newTime, maxEndTime));
      
      setEndTime(clampedEndTime);
      
      console.log('End handle drag - newPosition:', newPosition.toFixed(2), 'newTime:', newTime.toFixed(2), 'clampedEndTime:', clampedEndTime.toFixed(2));
    },
    
    onPanResponderRelease: () => {
      setIsDragging(false);
      if (currentTime > endTime) {
        seekTo(startTime);
      }
      console.log('End handle drag ended, final endTime:', endTime);
    }
  });

  const trimVideo = async () => {
    if (!videoUri || startTime >= endTime) {
      Alert.alert('Invalid Selection', 'Please select a valid time range.');
      return;
    }

    const duration = endTime - startTime;
    if (duration > MAX_DURATION + 0.1) {
      Alert.alert('Duration Too Long', `Selected duration is ${duration.toFixed(1)}s. Maximum is ${MAX_DURATION}s.`);
      return;
    }

    if (duration < 0.5) {
      Alert.alert('Duration Too Short', 'Selected duration must be at least 0.5 seconds.');
      return;
    }

    console.log('🎬 Starting video trim with:', {
      startTime: startTime.toFixed(3),
      endTime: endTime.toFixed(3),
      duration: duration.toFixed(3),
      videoUri
    });

    setTrimming(true);

    try {
      const trimmedVideoInfo = await performVideoTrim();

      if (trimmedVideoInfo) {
        console.log('✅ Video trim completed:', trimmedVideoInfo);
        onTrimComplete(trimmedVideoInfo);
      } else {
        throw new Error('Trimming failed or returned no info.');
      }

    } catch (error) {
      console.error('❌ Video trim error:', error);
      Alert.alert(
        'Trimming Failed',
        `Unable to trim video: ${error.message}\n\nPlease try again or select a different video.`,
        [
          { text: 'OK', onPress: () => onCancel() }
        ]
      );
    } finally {
      setTrimming(false);
    }
  };

  const performVideoTrim = async () => {
    const timestamp = Date.now();
    const outputFileName = `trimmed_video_${timestamp}.mp4`;
    const outputPath = `${RNFS.DocumentDirectoryPath}/${outputFileName}`;

    try {
      // Round to 3 decimal places for precision
      const roundedStartTime = Math.round(startTime * 1000) / 1000;
      const roundedEndTime = Math.round(endTime * 1000) / 1000;
      
      console.log('🎬 Starting video trim with react-native-video-trim:', {
        inputUri: videoUri,
        startTime: roundedStartTime,
        endTime: roundedEndTime,
        duration: (roundedEndTime - roundedStartTime).toFixed(3),
        outputPath: outputPath
      });

      // FIXED: Correct parameter names for the trimming library
      const trimmedUri = await rnTrimVideo(videoUri, {
        startTime: roundedStartTime,   // Corrected parameter
        endTime: roundedEndTime,        // Corrected parameter
        outputPath: outputPath,
        outputExt: 'mp4',
        type: 'video',
        saveToPhoto: false,
      });

      if (trimmedUri) {
        const finalUri = trimmedUri.startsWith('file://') ? trimmedUri : `file://${trimmedUri}`;
        const fileInfo = await RNFS.stat(finalUri.replace('file://', ''));

        if (fileInfo.size > 0) {
          return {
            uri: finalUri,
            originalUri: videoUri,
            startTime: roundedStartTime,
            endTime: roundedEndTime,
            duration: roundedEndTime - roundedStartTime,
            trimmed: true,
            method: 'react-native-video-trim',
            actuallyTrimmed: true,
            fileSize: fileInfo.size,
          };
        }
      }
      throw new Error('Trimming failed or returned no valid file.');
    } catch (error) {
      console.error('❌ Video trim error with react-native-video-trim:', error);
      throw error;
    }
  };

  const getStartPosition = () => getPositionFromTime(startTime);
  const getEndPosition = () => getPositionFromTime(endTime);
  const getCurrentPosition = () => getPositionFromTime(currentTime);

  const selectedDuration = endTime - startTime;
  const isValidSelection = selectedDuration > 0 && selectedDuration <= MAX_DURATION + 0.1;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onCancel} style={styles.cancelButton}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Trim Video (Max {MAX_DURATION}s)</Text>
        <TouchableOpacity
          onPress={trimVideo}
          disabled={!isValidSelection || trimming}
          style={[styles.doneButton, { opacity: isValidSelection && !trimming ? 1 : 0.5 }]}
        >
          {trimming ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.doneText}>Trim</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.infoBanner}>
        <Text style={styles.infoBannerText}>
          {trimming
            ? 'Processing video, please wait...'
            : `Selected: ${formatTime(startTime)} - ${formatTime(endTime)} (${formatTime(selectedDuration)})`
          }
        </Text>
      </View>

      <View style={styles.videoContainer}>
        <Video
          ref={videoRef}
          source={{ uri: videoUri }}
          style={styles.video}
          resizeMode="contain"
          paused={!isPlaying}
          onLoad={onVideoLoad}
          onProgress={onVideoProgress}
          onEnd={() => {
            setIsPlaying(false);
            seekTo(startTime);
          }}
          onError={(error) => {
            console.error('Video playback error:', error);
            Alert.alert('Video Error', 'Failed to load video for trimming.');
          }}
        />

        <TouchableOpacity
          style={styles.playPauseOverlay}
          onPress={togglePlayPause}
          disabled={!videoLoaded}
        >
          {!videoLoaded ? (
            <ActivityIndicator color="#fff" size="large" />
          ) : (
            <Text style={styles.playPauseText}>
              {isPlaying ? '⏸️' : '▶️'}
            </Text>
          )}
        </TouchableOpacity>

        <View style={styles.previewRangeContainer}>
          <Text style={styles.previewRangeText}>
            Preview: {formatTime(startTime)} → {formatTime(endTime)} ({formatTime(selectedDuration)})
          </Text>
        </View>
      </View>

      <View style={styles.timelineContainer}>
        <Text style={styles.timeLabel}>{formatTime(startTime)}</Text>

        <View style={styles.timeline}>
          <View style={[styles.fullDurationTrack, { width: draggableTrackWidth }]} />

          <View
            style={[
              styles.selectedRange,
              {
                left: getStartPosition(),
                width: getEndPosition() - getStartPosition(),
                backgroundColor: isValidSelection ? '#ed167e' : '#ff6b6b'
              }
            ]}
          />

          <View
            style={[
              styles.currentTimeIndicator,
              { left: getCurrentPosition() }
            ]}
          />

          <View
            style={[
              styles.handle, 
              styles.startHandle, 
              { 
                left: getStartPosition(),
                backgroundColor: isDragging ? '#ff1e7e' : '#ed167e'
              }
            ]}
            {...startHandlePanResponder.panHandlers}
          >
            <View style={styles.handleGrip} />
            <Text style={styles.handleLabel}>START</Text>
          </View>

          <View
            style={[
              styles.handle, 
              styles.endHandle, 
              { 
                left: getEndPosition(),
                backgroundColor: isDragging ? '#ff1e7e' : '#ed167e'
              }
            ]}
            {...endHandlePanResponder.panHandlers}
          >
            <View style={styles.handleGrip} />
            <Text style={styles.handleLabel}>END</Text>
          </View>
        </View>

        <Text style={styles.timeLabel}>{formatTime(endTime)}</Text>
      </View>

      <View style={styles.presetsContainer}>
        <Text style={styles.presetsTitle}>Quick Select:</Text>
        <View style={styles.presetsRow}>
          <TouchableOpacity
            style={styles.presetButton}
            onPress={() => {
              setStartTime(0);
              const newEndTime = Math.min(15, actualDuration);
              setEndTime(newEndTime);
              seekTo(0);
            }}
            disabled={!videoLoaded}
          >
            <Text style={styles.presetButtonText}>First 15s</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.presetButton}
            onPress={() => {
              setStartTime(0);
              const newEndTime = Math.min(MAX_DURATION, actualDuration);
              setEndTime(newEndTime);
              seekTo(0);
            }}
            disabled={!videoLoaded}
          >
            <Text style={styles.presetButtonText}>First {MAX_DURATION}s</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.presetButton}
            onPress={() => {
              const start = Math.max(0, actualDuration - MAX_DURATION);
              setStartTime(start);
              setEndTime(actualDuration);
              seekTo(start);
            }}
            disabled={!videoLoaded}
          >
            <Text style={styles.presetButtonText}>Last {MAX_DURATION}s</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.presetButton}
            onPress={() => {
              const middle = actualDuration / 2;
              const start = Math.max(0, middle - (MAX_DURATION / 2));
              const end = Math.min(actualDuration, start + MAX_DURATION);
              setStartTime(start);
              setEndTime(end);
              seekTo(start);
            }}
            disabled={!videoLoaded || actualDuration < MAX_DURATION}
          >
            <Text style={styles.presetButtonText}>Middle {MAX_DURATION}s</Text>
          </TouchableOpacity>
        </View>
      </View>

      {trimming && (
        <View style={styles.trimmingOverlay}>
          <ActivityIndicator color="#ed167e" size="large" />
          <Text style={styles.trimmingText}>Processing video...</Text>
          <Text style={styles.trimmingSubtext}>
            Trimming from {formatTime(startTime)} to {formatTime(endTime)}
            {'\n'}Duration: {formatTime(selectedDuration)}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#333',
  },
  cancelButton: {
    padding: 8,
  },
  cancelText: {
    color: '#fff',
    fontSize: 16,
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  doneButton: {
    backgroundColor: '#ed167e',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    minWidth: 60,
    alignItems: 'center',
  },
  doneText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  infoBanner: {
    backgroundColor: '#1a1a1a',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#333',
  },
  infoBannerText: {
    color: '#ed167e',
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '500',
  },
  videoContainer: {
    height: width * 0.6,
    backgroundColor: '#1a1a1a',
    position: 'relative',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  playPauseOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  playPauseText: {
    fontSize: 48,
  },
  previewRangeContainer: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  previewRangeText: {
    color: '#fff',
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '600',
  },
  timelineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  timeLabel: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    width: 40,
    textAlign: 'center',
  },
  timeline: {
    flex: 1,
    height: 60,
    marginHorizontal: 10,
    position: 'relative',
    paddingHorizontal: 12,
  },
  fullDurationTrack: {
    position: 'absolute',
    top: 25,
    left: 0,
    height: 10,
    backgroundColor: '#222',
    borderRadius: 5,
  },
  selectedRange: {
    position: 'absolute',
    top: 28,
    height: 4,
    borderRadius: 2,
  },
  currentTimeIndicator: {
    position: 'absolute',
    top: 23,
    width: 2,
    height: 14,
    backgroundColor: '#fff',
    borderRadius: 1,
  },
  handle: {
    position: 'absolute',
    top: 5,
    width: 28,
    height: 50,
    backgroundColor: '#ed167e',
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: -14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  startHandle: {},
  endHandle: {},
  handleGrip: {
    width: 4,
    height: 16,
    backgroundColor: '#fff',
    borderRadius: 2,
    marginBottom: 2,
  },
  handleLabel: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '600',
    marginTop: 2,
  },
  presetsContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  presetsTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  presetsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  presetButton: {
    backgroundColor: '#ed167e',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    opacity: 0.8,
  },
  presetButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  trimmingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  trimmingText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  trimmingSubtext: {
    color: '#888',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
});
export default VideoTrimmer;