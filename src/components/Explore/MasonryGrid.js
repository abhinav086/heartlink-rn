// components/Explore/MasonryGrid.js

import React from 'react';
import { View, Image, StyleSheet, Dimensions, TouchableOpacity, Text } from 'react-native';

const { width } = Dimensions.get('window');
// Calculate item width for a 2-column layout, accounting for margins/gaps
const ITEM_WIDTH = (width / 2) - (StyleSheet.hairlineWidth * 3); // Example, adjust margin as needed

const MasonryGrid = ({ item }) => {
  // Ensure item and item.imageUrl exist before rendering
  if (!item || !item.imageUrl) {
    return null; // Or a placeholder/error image
  }

  // You might need to dynamically calculate image height for a true masonry layout.
  // For simplicity, using a random height or fixed height is common if original aspect ratio isn't known.
  // Ideally, your backend should provide image dimensions or you calculate them on the client.
  const dynamicHeight = item.height || Math.random() * (width * 0.7) + (width * 0.4); // Example: random height between 40%-70% of screen width

  return (
    <TouchableOpacity style={styles.itemContainer} onPress={() => { /* Handle image press, e.g., navigate to detail */ }}>
      <Image
        source={{ uri: item.imageUrl }}
        style={[styles.image, { height: dynamicHeight }]}
        resizeMode="cover" // Cover ensures the image fills the space
      />
      {/* You can overlay text like author's name, likes, etc. */}
      {/*
      <View style={styles.overlay}>
        <Text style={styles.authorText}>{item.author?.fullName}</Text>
        <Text style={styles.likesText}>{item.likes?.length || 0} Likes</Text>
      </View>
      */}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  itemContainer: {
    flex: 1,
    margin: StyleSheet.hairlineWidth, // Small margin between items
    backgroundColor: '#1a1a1a', // A subtle background for items
    borderRadius: 8,
    overflow: 'hidden', // Ensures content stays within rounded corners
  },
  image: {
    width: '100%', // Take full width of its container
    borderRadius: 8, // Apply border radius to the image
  },
  overlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 8,
  },
  authorText: {
    color: 'white',
    fontWeight: 'bold',
  },
  likesText: {
    color: '#ccc',
    fontSize: 12,
  },
});

export default MasonryGrid;