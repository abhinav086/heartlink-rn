import React from "react";
import { Image, StyleSheet } from "react-native";

const MediaItem = ({ item }) => {
  return <Image source={item.source} style={styles.image} />;
};

const styles = StyleSheet.create({
  image: {
    width: "100%",
    height: "100%",
    borderRadius: 10,
  },
});

export default MediaItem;
