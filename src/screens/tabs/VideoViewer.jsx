// src/screens/tabs/VideoViewer.jsx
// (No changes required for the preview issue fix, this component handles full playback)
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import Video from 'react-native-video';
import Ionicons from 'react-native-vector-icons/Ionicons';

const { width, height } = Dimensions.get('window');

const VideoViewer = ({ visible, videoUri, onClose, fileName }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [paused, setPaused] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const videoRef = useRef(null);

  useEffect(() => {
    if (visible) {
       // Reset state when modal opens
       setLoading(true);
       setError(false);
       setPaused(false);
       setCurrentTime(0);
       setDuration(0);
    }
 }, [visible]);


  const onLoad = (data) => {
    setDuration(data.duration);
    setLoading(false);
  };

  const onLoadStart = () => {
    setLoading(true);
  };

  const onError = (e) => {
    console.error("Video Player Error:", e);
    setError(true);
    setLoading(false);
    Alert.alert("Playback Error", "Could not play this video file.");
  };

  const onProgress = (data) => {
    setCurrentTime(data.currentTime);
  };

  const onEnd = () => {
    setPaused(true);
  };

  const togglePlayPause = () => {
    setPaused(!paused);
  };

  const seekTo = (time) => {
    videoRef.current?.seek(time);
    setCurrentTime(time);
  };

  const formatTime = (timeInSeconds) => {
    const mins = Math.floor(timeInSeconds / 60);
    const secs = Math.floor(timeInSeconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
            {fileName || 'Video'}
          </Text>
          <View style={{ width: 40 }} /> {/* Spacer for alignment */}
        </View>

        <View style={styles.videoContainer}>
          {loading && !error && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#FF6B9D" />
              <Text style={styles.loadingText}>Loading video...</Text>
            </View>
          )}

          {error && (
            <View style={styles.errorContainer}>
              <Ionicons name="videocam-off" size={48} color="#999" />
              <Text style={styles.errorText}>Failed to load video</Text>
            </View>
          )}

          {!error && (
            <Video
              ref={videoRef}
              source={{ uri: videoUri }}
              style={styles.video}
              controls={false} // We'll use custom controls
              onLoad={onLoad}
              onLoadStart={onLoadStart}
              onError={onError}
              onProgress={onProgress}
              onEnd={onEnd}
              paused={paused}
              resizeMode="contain"
              playWhenInactive={true}
              playInBackground={false} // Prevent playback in background for full-screen preview
              ignoreSilentSwitch={Platform.OS === 'ios' ? 'ignore' : undefined}
            />
          )}

          {/* Overlay Play/Pause Button */}
          {!loading && !error && (
            <TouchableOpacity
              style={styles.playPauseOverlay}
              onPress={togglePlayPause}
              activeOpacity={0.7}
            >
              <Ionicons
                name={paused ? 'play-circle' : 'pause-circle'}
                size={60}
                color="rgba(255, 255, 255, 0.8)"
              />
            </TouchableOpacity>
          )}
        </View>

        {/* Custom Controls */}
        {!loading && !error && (
          <View style={styles.controlsContainer}>
            <TouchableOpacity onPress={() => seekTo(0)} style={styles.controlButton}>
              <Ionicons name="play-skip-back" size={24} color="#fff" />
            </TouchableOpacity>

            <TouchableOpacity onPress={togglePlayPause} style={styles.controlButton}>
              <Ionicons
                name={paused ? 'play' : 'pause'}
                size={28}
                color="#fff"
              />
            </TouchableOpacity>

            <TouchableOpacity onPress={onEnd} style={styles.controlButton}>
              <Ionicons name="play-skip-forward" size={24} color="#fff" />
            </TouchableOpacity>

            <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
            <View style={styles.sliderContainer}>
              <View
                style={[
                  styles.progressBar,
                  { width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` },
                ]}
              />
            </View>
            <Text style={styles.timeText}>{formatTime(duration)}</Text>
          </View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: Platform.OS === 'ios' ? 50 : 12, // Adjust for iOS status bar
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    zIndex: 10,
  },
  closeButton: {
    padding: 4,
  },
  title: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 10,
  },
  videoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  video: {
    width: width,
    height: height * 0.7, // Adjust height as needed
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  loadingText: {
    color: '#999',
    marginTop: 10,
    fontSize: 16,
  },
  errorContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  errorText: {
    color: '#999',
    marginTop: 10,
    fontSize: 16,
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
  controlsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  controlButton: {
    marginHorizontal: 10,
    padding: 5,
  },
  timeText: {
    color: '#fff',
    fontSize: 12,
    minWidth: 40, // Ensure consistent width for time display
    textAlign: 'center',
  },
  sliderContainer: {
    flex: 1,
    height: 3,
    backgroundColor: '#555',
    marginHorizontal: 10,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#FF6B9D',
  },
});

export default VideoViewer;
