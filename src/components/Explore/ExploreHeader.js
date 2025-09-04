import React from "react";
import { View, Text, Image, StyleSheet, TouchableOpacity } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { icons } from "../../constants";

const ExploreHeader = () => {
  const navigation = useNavigation();

  const handleNotificationPress = () => {
    navigation.navigate('NotificationsScreen');
  };

  const handleSearchPress = () => {
    // Add search functionality here if needed
    console.log("Search pressed");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Explore</Text>
      
      <View style={styles.iconContainer}>
       
        
        {/* <TouchableOpacity onPress={handleNotificationPress} style={styles.iconButton}>
          <Image source={icons.bell || icons.notification} style={styles.icon} />
        </TouchableOpacity> */}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 15,
    backgroundColor: "black",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "white",
  },
  iconContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconButton: {
    marginLeft: 16,
    padding: 4, // Add some padding for better touch target
  },
  icon: {
    width: 24,
    height: 24,
    tintColor: "white",
  },
});

export default ExploreHeader;