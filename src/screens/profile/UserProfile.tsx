// src/screens/profile/UserProfile.tsx


import React, { useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Text,
  TouchableOpacity,
  SafeAreaView,
} from "react-native";
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { useAuth } from "../../context/AuthContext";
import BASE_URL from "../../config/config";
import ProfileHeader from "../../components/Profile2/ProfileHeader";
import ProfileTabs from "../../components/Profile2/ProfileTabs";

// Type definitions
interface User {
  _id: string;
  fullName: string;
  photoUrl?: string;
  bio?: string;
  followersCount?: number;
  followingCount?: number;
}

interface RouteParams {
  userId?: string;
}

type RootStackParamList = {
  UserProfileScreen: RouteParams;
  SettingsScreen: undefined;
  // Add other screen types as needed
};

type UserProfileScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'UserProfileScreen'
>;

type UserProfileScreenRouteProp = RouteProp<
  RootStackParamList,
  'UserProfileScreen'
>;

interface Props {
  route: UserProfileScreenRouteProp;
  navigation: UserProfileScreenNavigationProp;
}

interface ApiResponse {
  success: boolean;
  message?: string;
  data?: {
    user: User;
  };
}

const UserProfileScreen: React.FC<Props> = ({ route, navigation }) => {
  const { userId } = route?.params || {};
  const { user: currentUser, token } = useAuth();
  const [userData, setUserData] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Determine if this is the current user's profile
  const isOwnProfile: boolean = !userId || userId === currentUser?._id || userId === "me";
  const targetUserId: string | undefined = isOwnProfile ? currentUser?._id : userId;

  useEffect(() => {
    if (isOwnProfile && currentUser) {
      // If it's own profile, use data from AuthContext
      setUserData(currentUser);
      setLoading(false);
    } else if (targetUserId) {
      // If it's another user's profile, fetch from API
      fetchUserData();
    } else {
      setError("No user ID provided");
      setLoading(false);
    }
  }, [targetUserId, currentUser, isOwnProfile, token]);

  const fetchUserData = async (): Promise<void> => {
    if (!token) {
      setError("Authentication required");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${BASE_URL}/api/v1/users/user/${targetUserId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data: ApiResponse = await response.json();

      if (response.ok && data.success) {
        setUserData(data.data?.user || null);
      } else {
        setError(data.message || 'Failed to fetch user data');
      }
    } catch (e) {
      console.error('Error fetching user data:', e);
      setError("Failed to load user data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSettingsPress = (): void => {
    navigation.navigate('SettingsScreen');
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#ed167e" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchUserData}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (!userData) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <Text style={styles.errorText}>No user data found.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header with Back Button and Settings Button */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isOwnProfile ? 'My Profile' : userData?.fullName || 'Profile'}
        </Text>
        {/* Settings Button - Only show for own profile */}
        {isOwnProfile ? (
          <TouchableOpacity style={styles.settingsButton} onPress={handleSettingsPress}>
            <View style={styles.settingsIcon}>
              <View style={styles.line} />
              <View style={styles.line} />
              <View style={styles.line} />
            </View>
          </TouchableOpacity>
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>

      <View style={styles.profileContent}>
        {/* Pass followersCount and followingCount to ProfileHeader */}
        <ProfileHeader
          navigation={navigation}
          userId={targetUserId || ''}
          username={userData?.fullName || 'User'}
          profilePic={userData?.photoUrl || ''}
          bio={userData?.bio || ''}
          isOwnProfile={isOwnProfile}
          followersCount={userData?.followersCount || 0}
          followingCount={userData?.followingCount || 0}
        />

        {/* Profile Tabs (Posts/Reels) */}
        <ProfileTabs
          userId={targetUserId}
          isOwnProfile={isOwnProfile}
          username={userData?.fullName}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0a0a",
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2e2e2e',
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    color: '#ed167e',
    fontSize: 24,
    fontWeight: '600',
  },
  headerTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  headerSpacer: {
    width: 40,
  },
  settingsButton: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsIcon: {
    width: 24,
    height: 18,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  line: {
    width: 20,
    height: 2,
    backgroundColor: '#ed167e',
    borderRadius: 1,
  },
  profileContent: {
    flex: 1,
  },
  center: {
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: '#999',
    fontSize: 16,
    marginTop: 16,
  },
  errorText: {
    color: '#ff4757',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  retryButton: {
    backgroundColor: '#ed167e',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default UserProfileScreen;