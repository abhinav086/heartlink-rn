// src/components/AudioPlayer.jsx

import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Easing } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import PropTypes from 'prop-types';

const AudioPlayer = ({ 
  isPlaying, 
  onPressPlayPause, 
  duration = 0, 
  currentTime = 0, 
  disabled = false 
}) => {
  const [progressAnimation] = useState(new Animated.Value(0));
  const progressValueRef = useRef(0);
  const lastKnownDurationRef = useRef(duration);

  // Update animation based on currentTime and duration
  useEffect(() => {
    if (duration > 0) {
      lastKnownDurationRef.current = duration;
      const progress = currentTime / duration;
      Animated.timing(progressAnimation, {
        toValue: progress,
        duration: 200,
        easing: Easing.linear,
        useNativeDriver: false,
      }).start(() => {
        progressValueRef.current = progress;
      });
    } else if (lastKnownDurationRef.current > 0) {
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

  // Function to format time as MM:SS
  const formatTime = (seconds) => {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Calculate remaining time
  const remainingTime = duration > 0 ? duration - currentTime : 0;

  // Create an animated waveform effect
  const [waveformAnimation] = useState(new Animated.Value(0));
  
  // Animate the waveform effect when playing
  useEffect(() => {
    if (isPlaying && duration > 0) {
      const animateWaveform = () => {
        Animated.sequence([
          Animated.timing(waveformAnimation, {
            toValue: 1,
            duration: 500,
            easing: Easing.out(Easing.exp),
            useNativeDriver: false,
          }),
          Animated.timing(waveformAnimation, {
            toValue: 0,
            duration: 500,
            easing: Easing.in(Easing.exp),
            useNativeDriver: false,
          }),
        ]).start(() => {
          if (isPlaying) {
            animateWaveform(); // Repeat the animation while playing
          }
        });
      };
      
      animateWaveform();
    } else {
      waveformAnimation.setValue(0);
    }
  }, [isPlaying, duration, waveformAnimation]);

  // Interpolate the waveform animation to create a wave-like effect
  const waveformTransform = waveformAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: ['translateY(0)', 'translateY(-4)'],
  });

  // Generate the waveform bars
  const generateWaveformBars = () => {
    const bars = [];
    const barCount = 30; // Number of bars in the waveform
    const maxBarHeight = 18; // Maximum height of the bars
    
    for (let i = 0; i < barCount; i++) {
      // Create a random height for each bar
      const barHeight = Math.random() * maxBarHeight;
      // Apply the animation to the bar
      const barAnimation = waveformAnimation.interpolate({
        inputRange: [0, 1],
        outputRange: [barHeight * 0.7, barHeight], // Bar height varies between 70% and 100% of its max height
      });
      
      bars.push(
        <Animated.View
          key={i}
          style={[
            styles.waveformBar,
            { height: barAnimation },
            { opacity: 0.8 }
          ]}
        />
      );
    }
    
    return bars;
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={onPressPlayPause} disabled={disabled} activeOpacity={0.7}>
        <Ionicons
          name={isPlaying ? 'pause' : 'play'}
          size={24}
          color="#00A884" // WhatsApp green
        />
      </TouchableOpacity>

      {/* Waveform Visualization */}
      <View style={styles.waveformContainer}>
        <Animated.View style={[styles.waveform, { transform: [{ translateY: waveformTransform }] }]}>
          {generateWaveformBars()}
        </Animated.View>
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

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    width: 220,
  },
  waveformContainer: {
    flex: 1,
    height: 20,
    backgroundColor: '#E0E0E0', // Light grey background
    marginHorizontal: 10,
    borderRadius: 10,
    overflow: 'hidden',
  },
  waveform: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 8,
    paddingBottom: 4,
  },
  waveformBar: {
    width: 2,
    backgroundColor: '#00A884', // WhatsApp green
    borderRadius: 1,
  },
  timeText: {
    fontSize: 12,
    color: '#666', // Dark grey text
    minWidth: 35, // Ensures consistent width for time display
    textAlign: 'right',
  },
});

export default AudioPlayer;