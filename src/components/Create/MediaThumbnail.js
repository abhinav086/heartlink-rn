  import React, { useState } from "react";
  import {
    TouchableOpacity,
    Image,
    StyleSheet,
    View,
    Text,
  } from "react-native";
  import Icon from "react-native-vector-icons/Ionicons";

  const MediaThumbnail = ({ uri, type, isSelected, onPress, size, selectionNumber }) => {
    const [imageError, setImageError] = useState(false);
    
    // Validate props
    const validSize = typeof size === 'number' && size > 0 ? size : 100;
    const validUri = uri && typeof uri === 'string' && uri.length > 0;
    const isVideo = type && (type.startsWith('video') || type === 'video');

    const handleImageError = (error) => {
      console.log('MediaThumbnail image error:', error?.nativeEvent?.error || 'Unknown error');
      console.log('Failed URI:', uri);
      setImageError(true);
    };

    const handleImageLoad = () => {
      if (imageError) {
        setImageError(false);
      }
    };

    return (
      <TouchableOpacity
        onPress={onPress}
        style={[styles.container, { width: validSize, height: validSize }]}
        activeOpacity={0.8}
      >
        {validUri && !imageError ? (
          <Image
            source={{ uri }}
            style={[styles.image, { width: validSize, height: validSize }]}
            resizeMode="cover"
            onError={handleImageError}
            onLoad={handleImageLoad}
          />
        ) : (
          <View style={[styles.placeholder, { width: validSize, height: validSize }]}>
            <Text style={styles.placeholderText}>
              {isVideo ? '🎥' : '📷'}
            </Text>
            <Text style={styles.placeholderSubtext}>
              {imageError ? 'Failed' : 'No Media'}
            </Text>
          </View>
        )}
        
        {/* Video icon indicator */}
        {isVideo && validUri && !imageError && (
          <Icon
            name="videocam"
            size={18}
            color="#fff"
            style={styles.videoIcon}
          />
        )}
        
        {/* Selection border */}
        {isSelected && (
          <View
            style={[
              StyleSheet.absoluteFillObject,
              {
                borderWidth: 2,
                borderColor: "#ed167e",
                borderRadius: 6,
              },
            ]}
          />
        )}
        
        {/* Selection number for multi-select */}
        {isSelected && selectionNumber && (
          <View style={styles.selectionNumberContainer}>
            <Text style={styles.selectionNumber}>{selectionNumber}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  export default MediaThumbnail;

  const styles = StyleSheet.create({
    container: {
      margin: 2,
      position: "relative",
      borderRadius: 6,
      overflow: "hidden",
    },
    image: {
      borderRadius: 6,
    },
    placeholder: {
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: "#1a1a1a",
      borderRadius: 6,
    },
    placeholderText: {
      fontSize: 24,
      marginBottom: 4,
    },
    placeholderSubtext: {
      color: "#aaa",
      fontSize: 10,
      textAlign: "center",
    },
    videoIcon: {
      position: "absolute",
      bottom: 6,
      right: 6,
      backgroundColor: "rgba(0, 0, 0, 0.6)",
      borderRadius: 12,
      padding: 2,
    },
    selectionNumberContainer: {
      position: "absolute",
      top: 6,
      right: 6,
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: "#ed167e",
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 1,
      borderColor: "#fff",
    },
    selectionNumber: {
      color: "#fff",
      fontSize: 12,
      fontWeight: "bold",
    },
  });