import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Alert,
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  Image
} from 'react-native';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { icons } from '../../constants';

const AboutScreen = () => {
  const navigation = useNavigation();
  const { logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    Alert.alert(
      'Confirm Logout',
      'Are you sure you want to log out?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            setLoggingOut(true);
            try {
              // Sign out from Google if user used Google login
              try {
                await GoogleSignin.signOut();
                console.log('Google sign out successful');
              } catch (googleError) {
                console.log('Google sign out error (normal if not Google login):', googleError.message);
              }

              // Use AuthContext logout function
              await logout();
              
              Alert.alert('Success', 'Logged out successfully');
              
              // Navigate to Login screen and reset navigation stack
              navigation.reset({
                index: 0,
                routes: [{ name: 'Login' }],
              });
            } catch (error) {
              console.error('Logout error:', error.message);
              Alert.alert('Error', 'Logout failed. Please try again.');
            } finally {
              setLoggingOut(false);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {/* Header with Back Button */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
              <Text style={styles.backButtonText}>←</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>About</Text>
            <View style={styles.headerSpacer} />
          </View>

          {/* App Logo/Icon */}
          <View style={styles.logoContainer}>
            <View style={styles.logoCircle}>
              <Text style={styles.logoText}>❤️</Text>
            </View>
          </View>

          {/* App Info */}
          <View style={styles.appInfoContainer}>
            <Text style={styles.appName}>Heartlink</Text>
            <Text style={styles.appVersion}>Version 1.0.0</Text>
          </View>

          {/* About Content */}
          <View style={styles.aboutContent}>
            <Text style={styles.aboutTitle}>Find Your Perfect Match</Text>
            <Text style={styles.aboutText}>
              Heartlink is more than just a dating app - it's your gateway to meaningful connections. 
              We believe that everyone deserves to find love, and we're here to make that journey 
              as smooth and enjoyable as possible.
            </Text>

            <Text style={styles.aboutSubTitle}>Why Choose Heartlink?</Text>
            <Text style={styles.aboutText}>
              • <Text style={styles.highlightText}>Smart Matching:</Text> Our advanced algorithm 
              connects you with compatible partners based on your interests, values, and preferences.
            </Text>
            <Text style={styles.aboutText}>
              • <Text style={styles.highlightText}>Safe & Secure:</Text> Your privacy and safety 
              are our top priorities. All profiles are verified and your data is protected.
            </Text>
            <Text style={styles.aboutText}>
              • <Text style={styles.highlightText}>Genuine Connections:</Text> We focus on quality 
              over quantity, helping you build real relationships that last.
            </Text>
            <Text style={styles.aboutText}>
              • <Text style={styles.highlightText}>Easy to Use:</Text> Our intuitive interface 
              makes finding love simple and fun.
            </Text>

            <Text style={styles.aboutSubTitle}>Our Mission</Text>
            <Text style={styles.aboutText}>
              To create a world where finding love is accessible, safe, and enjoyable for everyone. 
              We're committed to helping singles connect with their perfect match and build 
              lasting relationships.
            </Text>

            <Text style={styles.aboutSubTitle}>Join the Love Revolution</Text>
            <Text style={styles.aboutText}>
              Whether you're looking for a serious relationship, casual dating, or new friendships, 
              Heartlink is your companion in the journey of love. Start your story today and 
              discover the connections that await you.
            </Text>

            <View style={styles.contactContainer}>
              <Text style={styles.contactTitle}>Get in Touch</Text>
              <Text style={styles.contactText}>Email: support@heartlink.com</Text>
              <Text style={styles.contactText}>Website: www.heartlink.com</Text>
              <Text style={styles.contactText}>Follow us on social media for updates and dating tips!</Text>
            </View>

            <View style={styles.legalContainer}>
              <Text style={styles.legalText}>
                By using Heartlink, you agree to our Terms of Service and Privacy Policy.
              </Text>
            </View>
          </View>

          {/* Logout Button */}
          <View style={styles.logoutContainer}>
            <TouchableOpacity 
              style={styles.logoutButton} 
              onPress={handleLogout}
              disabled={loggingOut}
            >
              <View style={styles.logoutButtonContent}>
                <Image source={icons.logout} style={styles.logoutIcon} />
                {loggingOut ? (
                  <ActivityIndicator size="small" color="#fff" style={{ marginRight: 10 }} />
                ) : null}
                <Text style={styles.logoutText}>
                  {loggingOut ? 'Logging out...' : 'Log Out'}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 30,
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
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
  },
  headerSpacer: {
    width: 40,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#ed167e',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#ed167e',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  logoText: {
    fontSize: 32,
  },
  appInfoContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  appName: {
    fontSize: 32,
    fontWeight: '700',
    color: '#ed167e',
    marginBottom: 8,
  },
  appVersion: {
    fontSize: 16,
    color: '#999',
    fontWeight: '500',
  },
  aboutContent: {
    marginBottom: 30,
  },
  aboutTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ed167e',
    marginBottom: 16,
    textAlign: 'center',
  },
  aboutSubTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ed167e',
    marginTop: 24,
    marginBottom: 12,
  },
  aboutText: {
    fontSize: 16,
    color: '#fff',
    lineHeight: 24,
    marginBottom: 12,
    textAlign: 'justify',
  },
  highlightText: {
    color: '#ed167e',
    fontWeight: '600',
  },
  contactContainer: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 20,
    marginTop: 24,
    marginBottom: 20,
  },
  contactTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ed167e',
    marginBottom: 12,
  },
  contactText: {
    fontSize: 14,
    color: '#fff',
    marginBottom: 8,
  },
  legalContainer: {
    alignItems: 'center',
    marginTop: 16,
  },
  legalText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    lineHeight: 18,
  },
  logoutContainer: {
    marginTop: 20,
  },
  logoutButton: {
    backgroundColor: '#d32f2f',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    shadowColor: '#d32f2f',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  logoutButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutIcon: {
    width: 24,
    height: 24,
    tintColor: '#fff',
    marginRight: 12,
  },
  logoutText: {
    fontSize: 18,
    color: '#fff',
    fontWeight: '600',
  },
});

export default AboutScreen;