// components/Create/SelectedMediaPreview.tsx
import React, { useState } from 'react';
import {
  View,
  Image,
  StyleSheet,
  Text,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import Video from 'react-native-video'; // Changed import
import Icon from 'react-native-vector-icons/Ionicons'; // Still correct for react-native-vector-icons

const { width: screenWidth } = Dimensions.get('window');

interface SelectedMediaPreviewProps {
  uri: string;
  type: string;
  selectedCount: number | null;
  style?: any;
}

const SelectedMediaPreview: React.FC<SelectedMediaPreviewProps> = ({
  uri,
  type,
  selectedCount,
  style
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const isVideo = type?.startsWith('video/');

  const handleLoadEnd = () => {
    setLoading(false);
  };

  const handleError = () => {
    setLoading(false);
    setError(true);
    console.error('Failed to load media:', uri); // Log the error for debugging
  };

  if (error) {
    return (
      <View style={[styles.container, style]}>
        <View style={styles.errorContainer}>
          <Icon name="image-outline" size={40} color="#666" />
          <Text style={styles.errorText}>Failed to load media</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      {isVideo ? (
        <>
          <Video
            source={{ uri }}
            style={styles.media}
            resizeMode="cover"
            paused={true} // Changed from shouldPlay={false}
            repeat={false} // Changed from isLooping={false}
            muted={true} // Changed from isMuted={true}
            onLoad={handleLoadEnd} // Fired when media loads metadata
            onError={handleError} // Fired on error
            // Optional: for better video loading control, especially if
            // the video itself is the source of `loading` state
            onReadyForDisplay={handleLoadEnd}
            onBuffer={({ isBuffering }) => setLoading(isBuffering)} // Show loading if buffering
          />
          <View style={styles.videoIndicator}>
            <Icon name="play-circle" size={40} color="rgba(255,255,255,0.9)" />
          </View>
        </>
      ) : (
        <Image
          source={{ uri }}
          style={styles.media}
          resizeMode="cover"
          onLoadEnd={handleLoadEnd}
          onError={handleError}
        />
      )}

      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#ed167e" />
        </View>
      )}

      {selectedCount !== null && selectedCount > 1 && (
        <View style={styles.countBadge}>
          <Icon name="copy-outline" size={14} color="#fff" />
          <Text style={styles.countText}>{selectedCount}</Text>
        </View>
      )}

      {/* Gradient overlay for better visibility of badges */}
      {/* Removed `backgroundImage` as it's not supported in RN StyleSheet.
          Use `react-native-linear-gradient` for actual gradients.
          A simple translucent background is used as a placeholder. */}
      <View style={styles.gradientOverlay} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  media: {
    width: '100%',
    height: '100%',
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  errorContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111',
  },
  errorText: {
    color: '#666',
    fontSize: 14,
    marginTop: 8,
  },
  videoIndicator: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -20 }, { translateY: -20 }],
  },
  countBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    // backdropFilter: 'blur(10px)', // Not directly supported in RN StyleSheet
  },
  countText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  gradientOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 80,
    // backgroundImage: 'linear-gradient(to bottom, rgba(0,0,0,0.5), transparent)', // Not supported
    backgroundColor: 'rgba(0,0,0,0.3)', // Simple translucent background as fallback
  },
});

export default SelectedMediaPreview;