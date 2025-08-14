// MembershipsScreen.tsx

import React from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/Feather';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
// Import the useNavigation hook to get access to the navigation object
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

// Define the navigation prop type for type safety with TypeScript
// This tells TypeScript what screens we can navigate to from this screen.
type RootStackParamList = {
  Membership99: undefined; // No parameters expected for this route
  Membership499: undefined; // No parameters expected for this route
};
type MembershipsScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

// Define the props for our reusable card component
interface MembershipCardProps {
  planName: string;
  price: number;
  onPress: () => void;
  gradientColors: string[];
  buttonColor: string;
  outlineColor: string;
  iconName: string;
  iconColor: string;
}

// Reusable Card Component with beautiful icons
const MembershipCard: React.FC<MembershipCardProps> = ({
  planName,
  price,
  onPress,
  gradientColors,
  buttonColor,
  outlineColor,
  iconName,
  iconColor,
}) => (
  <View style={[styles.cardOutline, {borderColor: outlineColor}]}>
    <LinearGradient
      colors={gradientColors}
      start={{x: 0, y: 0.5}}
      end={{x: 1, y: 0.5}}
      style={styles.cardGradient}>
      <View style={styles.cardContent}>
        <View style={styles.iconContainer}>
          <MaterialIcons name={iconName} size={40} color={iconColor} />
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.cardText}>
           {planName} plan 
          </Text>
        </View>
        <TouchableOpacity
          onPress={onPress}
          style={[styles.arrowButton, {backgroundColor: buttonColor}]}>
          <Icon name="arrow-right" size={30} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </LinearGradient>
  </View>
);

// Main Screen Component
const MembershipsScreen = () => {
  // Get the navigation object using the hook
  const navigation = useNavigation<MembershipsScreenNavigationProp>();

  // This function now navigates to the Membership99 screen
  const handleBasicUpgrade = () => {
    navigation.navigate('Membership99');
  };

  // This function now navigates to the Membership499 screen
  const handlePremiumUpgrade = () => {
    navigation.navigate('Membership499');
  };

  return (
    <LinearGradient
      colors={['#1a1a1a', '#2d2d2d', '#1a1a1a']}
      start={{x: 0, y: 0}}
      end={{x: 0, y: 1}}
      style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" />
        <View style={styles.headerContainer}>
          <MaterialIcons name="card-membership" size={40} color="#FFFFFF" />
          <Text style={styles.header}>Memberships</Text>
        </View>

        {/* This card will now navigate to the Membership99 page on press - Silver Theme */}
        <MembershipCard
          planName="Silver"
          price={99}
          onPress={handleBasicUpgrade}
          gradientColors={['#B8B8B8', '#E8E8E8']}
          buttonColor="#9A9A9A"
          outlineColor="#C0C0C0"
          iconName="star"
          iconColor="#FFFFFF"
        />

        {/* This card will now navigate to the Membership499 page on press - Gold Theme */}
        <MembershipCard
          planName="Gold"
          price={499}
          onPress={handlePremiumUpgrade}
          gradientColors={['#FFB300', '#FFF176']}
          buttonColor="#FF8F00"
          outlineColor="#FFB300"
          iconName="workspace-premium"
          iconColor="#FFFFFF"
        />
      </SafeAreaView>
    </LinearGradient>
  );
};

// --- Styles ---
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    padding: 20,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 30,
    marginTop: 10,
  },
  header: {
    fontSize: 34,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginLeft: 15,
  },
  cardOutline: {
    borderWidth: 2,
    borderRadius: 22,
    padding: 4,
    marginBottom: 25,
  },
  cardGradient: {
    borderRadius: 18,
    padding: 25,
  },
  cardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  iconContainer: {
    marginRight: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    flex: 1, // Allows text to take available space and wrap
    marginRight: 15,
  },
  cardText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    lineHeight: 38, // Adjust line height for better spacing
  },
  arrowButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    // Adding a subtle shadow for depth
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
});

export default MembershipsScreen;