// components/ConnectionQualityIndicator.js
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

const ConnectionQualityIndicator = ({ 
  quality = 'unknown', 
  stats = null, 
  visible = false 
}) => {
  const [fadeAnim] = useState(new Animated.Value(0));
  const [pulseAnim] = useState(new Animated.Value(1));

  useEffect(() => {
    if (visible) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();

      // Pulse animation for poor quality
      if (quality === 'poor') {
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
      } else {
        pulseAnim.setValue(1);
      }
    } else {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, quality]);

  const getQualityConfig = () => {
    switch (quality) {
      case 'good':
        return {
          icon: 'wifi',
          color: '#4CAF50',
          text: 'Good Connection',
          bars: 3
        };
      case 'fair':
        return {
          icon: 'wifi',
          color: '#FF9800',
          text: 'Fair Connection',
          bars: 2
        };
      case 'poor':
        return {
          icon: 'wifi',
          color: '#F44336',
          text: 'Poor Connection',
          bars: 1
        };
      default:
        return {
          icon: 'wifi-off',
          color: '#666',
          text: 'Unknown Connection',
          bars: 0
        };
    }
  };

  const config = getQualityConfig();

  const formatStats = () => {
    if (!stats) return null;

    const packetsLost = stats.packetsLost || 0;
    const packetsReceived = stats.packetsReceived || 0;
    const totalPackets = packetsLost + packetsReceived;
    const lossPercentage = totalPackets > 0 ? ((packetsLost / totalPackets) * 100).toFixed(1) : '0.0';
    
    return {
      lossPercentage,
      jitter: stats.jitter ? Math.round(stats.jitter) : 0,
      bytesReceived: stats.bytesReceived ? (stats.bytesReceived / 1024).toFixed(1) : '0',
      bytesSent: stats.bytesSent ? (stats.bytesSent / 1024).toFixed(1) : '0'
    };
  };

  const formattedStats = formatStats();

  if (!visible) return null;

  return (
    <Animated.View 
      style={[
        styles.container, 
        { 
          opacity: fadeAnim,
          transform: [{ scale: pulseAnim }],
          borderColor: config.color
        }
      ]}
    >
      <View style={styles.header}>
        <Ionicons 
          name={config.icon} 
          size={16} 
          color={config.color} 
        />
        <Text style={[styles.qualityText, { color: config.color }]}>
          {config.text}
        </Text>
        
        {/* Signal strength bars */}
        <View style={styles.barsContainer}>
          {[1, 2, 3].map((bar) => (
            <View
              key={bar}
              style={[
                styles.bar,
                {
                  backgroundColor: bar <= config.bars ? config.color : '#333',
                  height: 4 + (bar * 2)
                }
              ]}
            />
          ))}
        </View>
      </View>

      {formattedStats && (
        <View style={styles.statsContainer}>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Packet Loss:</Text>
            <Text style={[
              styles.statValue,
              { color: parseFloat(formattedStats.lossPercentage) > 2 ? '#F44336' : '#4CAF50' }
            ]}>
              {formattedStats.lossPercentage}%
            </Text>
          </View>
          
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Jitter:</Text>
            <Text style={[
              styles.statValue,
              { color: formattedStats.jitter > 100 ? '#F44336' : '#4CAF50' }
            ]}>
              {formattedStats.jitter}ms
            </Text>
          </View>
          
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Data:</Text>
            <Text style={styles.statValue}>
              ↓{formattedStats.bytesReceived}KB ↑{formattedStats.bytesSent}KB
            </Text>
          </View>
        </View>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 100,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    minWidth: 180,
    zIndex: 1000,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  qualityText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
    flex: 1,
  },
  barsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  bar: {
    width: 3,
    marginHorizontal: 1,
    borderRadius: 1,
  },
  statsContainer: {
    borderTopWidth: 1,
    borderTopColor: '#333',
    paddingTop: 8,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 10,
    color: '#999',
  },
  statValue: {
    fontSize: 10,
    fontWeight: '500',
    color: '#fff',
  },
});

export default ConnectionQualityIndicator;