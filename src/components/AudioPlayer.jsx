// src/components/AudioPlayer.jsx

import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Easing } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import PropTypes from 'prop-types'; // Make sure to install prop-types if not already

// Use JavaScript default parameters instead of defaultProps
const AudioPlayer = ({ 
  isPlaying, 
  onPressPlayPause, 
  duration = 0, // Default parameter
  currentTime = 0, // Default parameter
  disabled = false // Default parameter
}) => {
  const [progressAnimation] = useState(new Animated.Value(0));
  const progressValueRef = useRef(0); // Use ref to track animation value for smoother updates
  const lastKnownDurationRef = useRef(duration); // Store last known duration

  // Update animation based on currentTime and duration
  useEffect(() => {
    if (duration > 0) {
      lastKnownDurationRef.current = duration;
      const progress = currentTime / duration;
      // Use ref value for smoother updates if animation is running
      Animated.timing(progressAnimation, {
        toValue: progress,
        duration: 200, // Short duration for UI update, not playback
        easing: Easing.linear,
        useNativeDriver: false,
      }).start(() => {
        progressValueRef.current = progress; // Update ref after animation completes
      });
    } else if (lastKnownDurationRef.current > 0) {
       // If duration is 0 but we had a previous one (e.g., loading state changed)
       const progress = currentTime / lastKnownDurationRef.current;
       Animated.timing(progressAnimation, {
        toValue: progress,
        duration: 200,
        easing: Easing.linear,
        useNativeDriver: false,
       }).start(() => {
         progressValueRef.current = progress;
       });
    }
  }, [currentTime, duration, progressAnimation]);

  const formatTime = (seconds) => {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const remainingTime = duration > 0 ? duration - currentTime : 0;

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={onPressPlayPause} disabled={disabled} activeOpacity={0.7}>
        <Ionicons
          name={isPlaying ? 'pause' : 'play'}
          size={24}
          color="#00A884" // WhatsApp green
        />
      </TouchableOpacity>

      <View style={styles.progressContainer}>
        <Animated.View
          style={[
            styles.progressBar,
            {
              width: progressAnimation.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
        {/* Optional: Add a seekable thumb if needed, but WhatsApp doesn't seem to have it directly on the message */}
      </View>

      <Text style={styles.timeText}>{formatTime(remainingTime)}</Text>
    </View>
  );
};

AudioPlayer.propTypes = {
  isPlaying: PropTypes.bool.isRequired,
  onPressPlayPause: PropTypes.func.isRequired,
  duration: PropTypes.number,
  currentTime: PropTypes.number,
  disabled: PropTypes.bool,
};

// --- REMOVE THIS BLOCK ---
// AudioPlayer.defaultProps = {
//   duration: 0,
//   currentTime: 0,
//   disabled: false,
// };
// --- END REMOVE ---

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    // paddingHorizontal: 8, // Optional padding inside the message bubble
    width: 220, // Set a fixed width similar to WhatsApp
  },
  progressContainer: {
    flex: 1,
    height: 2,
    backgroundColor: '#E0E0E0', // Light grey background
    marginHorizontal: 10,
    borderRadius: 1, // Slight rounding
    overflow: 'hidden', // Ensures the animated bar stays within bounds
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#00A884', // WhatsApp green
  },
  timeText: {
    fontSize: 12,
    color: '#666', // Dark grey text
    minWidth: 35, // Ensures consistent width for time display
    textAlign: 'right',
  },
});

export default AudioPlayer;