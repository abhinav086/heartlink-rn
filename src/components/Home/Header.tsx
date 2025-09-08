import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Text,
  Alert,
} from "react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import Icon from 'react-native-vector-icons/Ionicons';

const Header = ({ hasUnreadNotifications = false, onNotificationPress }) => {
  const navigation = useNavigation();
  const [menuVisible, setMenuVisible] = useState(false);
  
  // Temporary mock data - replace with real auth context
  const token = null; // Replace with: useAuth()?.token
  const user = null;  // Replace with: useAuth()?.user

  const handleNavigate = (screen) => {
    setMenuVisible(false);
    navigation.navigate(screen);
  };

  const handleNotificationPress = () => {
    if (onNotificationPress) {
      onNotificationPress();
    } else {
      navigation.navigate('NotificationsScreen');
    }
  };

  const handleComingSoon = () => {
    setMenuVisible(false);
    Alert.alert("Coming Soon", "This feature will be available soon!");
  };

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <TouchableOpacity
        style={styles.iconContainer}
        onPress={() => handleNavigate("ExploreScreen")}
        activeOpacity={0.8}
      >
        <TextInput
          style={styles.searchInput}
          placeholder="Search..."
          placeholderTextColor="#ef1279"
          editable={false}
        />
        <Icon name="compass" size={20} color="#ef1279" />
      </TouchableOpacity>

      {/* Right side icons container */}
      <View style={styles.rightIconsContainer}>
        {/* Notification Icon with Red Dot */}
        <TouchableOpacity onPress={handleNotificationPress} style={styles.iconWrapper}>
          <Icon name="notifications" size={28} color="white" style={styles.icon} />
          {hasUnreadNotifications && <View style={styles.badge} />}
        </TouchableOpacity>

        {/* 3-Dots Menu Icon */}
        <TouchableOpacity onPress={() => setMenuVisible(true)} style={styles.iconWrapper}>
          <Icon name="ellipsis-vertical" size={28} color="white" style={styles.icon} />
        </TouchableOpacity>
      </View>

      {/* Simplified Dropdown Menu */}
      <Modal
        transparent
        animationType="fade"
        visible={menuVisible}
        onRequestClose={() => setMenuVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          onPress={() => setMenuVisible(false)}
          activeOpacity={1}
        >
          <View style={styles.dropdown}>
            {/* Main Menu Section */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>⚡ Menu</Text>
            </View>

            <TouchableOpacity
              style={styles.dropdownItemContainer}
              onPress={() => handleNavigate("NotificationsScreen")}
            >
              <View style={styles.menuItemRow}>
                <Icon name="notifications-outline" size={18} color="white" />
                <Text style={styles.dropdownItem}>Notifications</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.dropdownItemContainer}
              onPress={() => handleNavigate("OffersScreen")}
            >
              <View style={styles.menuItemRow}>
                <Icon name="pricetag-outline" size={18} color="#ed167e" />
                <Text style={styles.dropdownItem}>Offers</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.dropdownItemContainer}
              onPress={handleComingSoon}
            >
              <View style={styles.menuItemRow}>
                <Icon name="book-outline" size={18} color="white" />
                <Text style={styles.dropdownItem}>Boost Post</Text>
                <Text style={styles.soonBadge}>Soon</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.dropdownItemContainer, styles.lastItem]}
              onPress={handleComingSoon}
            >
              <View style={styles.menuItemRow}>
                <Icon name="link-outline" size={18} color="white" />
                <Text style={styles.dropdownItem}>Link Devices</Text>
                <Text style={styles.soonBadge}>Soon</Text>
              </View>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const SearchBar = () => null;

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 15,
    backgroundColor: "black",
  },
  iconContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#222",
    borderRadius: 15,
    paddingHorizontal: 12,
    paddingVertical: 5,
    flex: 1, // Made wider by increasing flex value
    marginRight: 10, // Add margin to separate from right icons
  },
  rightIconsContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconWrapper: {
    position: 'relative',
    marginLeft: 8,
  },
  searchInput: {
    flex: 1,
    color: "white",
    fontFamily: "Montserrat-Regular",
  },
  icon: {
    marginLeft: 5,
  },
  badge: {
    position: 'absolute',
    top: -3,
    right: -3,
    backgroundColor: 'red',
    borderRadius: 10,
    width: 10,
    height: 10,
    zIndex: 1,
  },
  modalOverlay: {
    flex: 1,
    alignItems: "flex-end",
    justifyContent: "flex-start",
    paddingTop: 60,
    paddingRight: 15,
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  dropdown: {
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    paddingVertical: 10,
    width: 200,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 5,
  },
  sectionHeader: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    backgroundColor: '#2a2a2a',
  },
  sectionTitle: {
    color: '#ed167e',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: "Montserrat-Regular",
  },
  dropdownItemContainer: {
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderBottomColor: "#333",
    borderBottomWidth: 1,
  },
  lastItem: {
    borderBottomWidth: 0,
  },
  menuItemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dropdownItem: {
    color: "white",
    fontFamily: "Montserrat-Regular",
    fontSize: 16,
    marginLeft: 10,
    flex: 1,
  },
  soonBadge: {
    color: "#ed167e",
    fontSize: 12,
    fontFamily: "Montserrat-Regular",
    fontWeight: "600",
    borderColor: "#ed167e",
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
    marginLeft: 8,
  },
});

export { Header, SearchBar };