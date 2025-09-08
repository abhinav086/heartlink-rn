// AppNavigator.js - Enhanced with gesture navigation protection
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Platform } from 'react-native';
import SplashScreen from '../screens/auth/SplashScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import SignupScreen from '../screens/auth/SignupScreen';
import GenderScreen from '../screens/onboarding/GenderScreen';
import QuestionsScreen from '../screens/onboarding/QuestionsScreen';
import ProfileSetupScreen from '../screens/onboarding/ProfileSetupScreen';
import TabNavigator from './TabNavigator';
import ExploreScreen from '../screens/tabs/ExploreScreen';
import CreateScreen from '../screens/tabs/CreateScreen';
import CreateStoryScreen from '../screens/tabs/CreateStoryScreen';
import EditPostScreen from '../screens/tabs/EditPostScreen';
import EditProfileScreen from '../screens/profile/EditProfileScreen';
import SettingsScreen from '../screens/profile/SettingsScreen';
import WalletScreen from '../screens/profile/WalletScreen';
import AboutScreen from '../screens/profile/AboutScreen.tsx';
import PrivacySettingsScreen from '../screens/profile/PrivacySettingsScreen.js';
import BlockedUsersScreen from '../screens/BlockedUsersScreen.js';
import SearchUsersList from '../screens/tabs/SearchUsersList.jsx';

// Live Stream Components
import CreateLiveStream from '../components/Home/CreateLiveStream.jsx';
import LiveStreamViewer from '../components/Home/LiveStreamViewer.jsx';

// Dating Components
import TakeOnDatePage from '../components/Dating/TakeOnDatePage.tsx';
import BudgetSelectorPage from '../components/Dating/BudgetSelectorPage.tsx';

// Dating Request Management Screens
import DateRequestsScreen from '../components/Dating/DateRequestsScreen';
import PendingDateRequestsScreen from '../components/Dating/PendingDateRequestsScreen';
import DateRequestDetailScreen from '../components/Dating/DateRequestDetailScreen';
import DateRequestStatusScreen from '../components/Dating/DateRequestStatusScreen';

// Messaging 
import PrivateChatScreen from '../components/Dating/PrivateChatScreen';
import TakeOnDate from '../components/Dating/privateTakeOnDate.tsx';

// Payment & Confirmation Screens
import PaymentScreen from '../components/Dating/PaymentScreen';
import DateConfirmed from '../components/Dating/DateConfirmed';

import NotificationsScreen from '../screens/profile/NotificationsScreen';
import CommentScreen from '../components/Home/CommentScreen';
import LikeScreen from '../components/Home/LikeScreen';

import MembershipPage99 from '../components/Subscription/MembershipPage99';
import MembershipPage499 from '../components/Subscription/MembershipPage499';
import MembershipsScreen from '../components/Subscription/MembershipsScreen';

import FollowersList from '../screens/profile/FollowersList';
import FollowingList from '../screens/profile/FollowingList';
import StoryViewer from '../components/Home/StoryViewer';

import OffersScreen from '../screens/tabs/OffersScreen';
import UserProfileScreen from '../screens/profile/UserProfile';
import UsersListScreen from '../screens/tabs/WChatScreen';
import ChatDetailScreen from '../screens/tabs/ChatUsers';
import PhotoViewerScreen from '../screens/tabs/PhotoViewerScreen';
import ReelsViewerScreen from '../screens/tabs/ReelsViewerScreen';

// Call-related screens
import CallScreen from '../screens/CallScreen';

const Stack = createNativeStackNavigator();

// ENHANCED: Root screens that should prevent gesture exit to app
const ROOT_SCREENS = [
  'HomeScreen',
  'Login', 
  'Splash',
  'Gender',
  'Questions', 
  'ProfileSetup',
  'Memberships'
];

// ENHANCED: Critical screens that need gesture protection
const PROTECTED_SCREENS = [
  'CallScreen',
  'CreateLiveStream',
  'LiveStreamViewer',
  'PaymentScreen',
  'DateConfirmed',
  'StoryViewer'
];

// ENHANCED: Get dynamic screen options based on screen name and platform
const getScreenOptions = (screenName, baseOptions = {}) => {
  const isRootScreen = ROOT_SCREENS.includes(screenName);
  const isProtectedScreen = PROTECTED_SCREENS.includes(screenName);
  const isAndroid = Platform.OS === 'android';
  
  return {
    headerShown: false,
    // Root screens and protected screens disable gestures to prevent app exit/interruption
    gestureEnabled: !isRootScreen && !isProtectedScreen,
    // Enhanced gesture configuration for Android
    ...(isAndroid && {
      gestureDirection: 'horizontal',
      gestureResponseDistance: {
        horizontal: isRootScreen || isProtectedScreen ? 0 : 50,
        vertical: -1,
      },
      // Prevent accidental gesture navigation on critical screens
      gestureVelocityImpact: isRootScreen || isProtectedScreen ? 0 : 0.3,
    }),
    // iOS specific configurations
    ...(!isAndroid && {
      gestureDirection: 'horizontal',
      gestureResponseDistance: (isRootScreen || isProtectedScreen) ? { horizontal: 0 } : undefined,
    }),
    ...baseOptions,
  };
};

// ENHANCED: Default screen options with better gesture handling
const defaultScreenOptions = {
  headerShown: false,
  gestureEnabled: true,
  animation: 'slide_from_right',
  animationDuration: 250,
  // Enhanced gesture configuration
  gestureDirection: 'horizontal',
  gestureResponseDistance: {
    horizontal: 50,
    vertical: -1,
  },
  gestureVelocityImpact: 0.3,
};

// ENHANCED: Modal screen options with safe gesture handling
const modalScreenOptions = {
  headerShown: false,
  presentation: 'modal',
  gestureEnabled: true,
  animation: 'slide_from_bottom',
  gestureDirection: 'vertical',
  gestureResponseDistance: {
    horizontal: -1,
    vertical: 100,
  },
};

// ENHANCED: Full screen modal with gesture protection
const fullScreenModalOptions = {
  headerShown: false,
  presentation: 'fullScreenModal',
  gestureEnabled: false, // Prevent accidental dismissal
  animation: 'slide_from_right',
  animationDuration: 200,
};

// ENHANCED: Live stream options with maximum protection
const liveStreamOptions = {
  headerShown: false,
  presentation: 'fullScreenModal',
  gestureEnabled: false, // Critical: Prevent gesture interruption during streaming
  animation: 'slide_from_bottom',
  animationDuration: 300,
  statusBarStyle: 'light',
  statusBarBackgroundColor: 'black',
  statusBarTranslucent: true,
  freezeOnBlur: false,
  autoHideHomeIndicator: true,
  orientation: 'portrait',
  gestureResponseDistance: {
    horizontal: 0,
    vertical: 0,
  },
  transitionSpec: {
    open: {
      animation: 'timing',
      config: {
        duration: 300,
        easing: 'ease-out',
      },
    },
    close: {
      animation: 'timing', 
      config: {
        duration: 200,
        easing: 'ease-in',
      },
    },
  },
};

// ENHANCED: Call screen options with maximum protection
const callScreenOptions = {
  presentation: 'fullScreenModal',
  gestureEnabled: false, // Critical: Prevent accidental call termination
  animation: 'slide_from_right',
  animationDuration: 200,
  headerShown: false,
  statusBarStyle: 'light',
  statusBarBackgroundColor: 'transparent',
  statusBarTranslucent: true,
  freezeOnBlur: false,
  autoHideHomeIndicator: true,
  orientation: 'portrait',
  gestureResponseDistance: {
    horizontal: 0,
    vertical: 0,
  },
  transitionSpec: {
    open: {
      animation: 'timing',
      config: {
        duration: 200,
        easing: 'ease-out',
      },
    },
    close: {
      animation: 'timing', 
      config: {
        duration: 200,
        easing: 'ease-in',
      },
    },
  },
};

// ENHANCED: Chat screen options optimized for WebRTC integration
const chatScreenOptions = {
  headerShown: false,
  animation: 'slide_from_right',
  gestureEnabled: true,
  freezeOnBlur: false, // Important for call functionality
  animationDuration: 250,
  gestureResponseDistance: {
    horizontal: 50,
    vertical: -1,
  },
  gestureVelocityImpact: 0.3,
};

const AppNavigator = ({ initialRouteName }) => {
  return (
    <Stack.Navigator 
      initialRouteName={initialRouteName}
      screenOptions={defaultScreenOptions}
    >
      {/* ========== AUTH SCREENS (Protected from gesture exit) ========== */}
      <Stack.Screen 
        name="Splash" 
        component={SplashScreen} 
        options={getScreenOptions('Splash', {
          animationTypeForReplace: 'push',
          animation: 'fade',
        })} 
      />
      
      <Stack.Screen
        name="Memberships"
        component={MembershipsScreen}
        options={getScreenOptions('Memberships')}
      />
      
      <Stack.Screen 
        name="Login" 
        component={LoginScreen} 
        options={getScreenOptions('Login', {
          animation: 'fade',
        })} 
      />
      
      <Stack.Screen 
        name="Signup" 
        component={SignupScreen} 
        options={getScreenOptions('Signup')} 
      />

      {/* ========== ONBOARDING SCREENS (Protected from gesture exit) ========== */}
      <Stack.Screen 
        name="Gender" 
        component={GenderScreen} 
        options={getScreenOptions('Gender')} 
      />
      
      <Stack.Screen 
        name="Questions" 
        component={QuestionsScreen} 
        options={getScreenOptions('Questions')} 
      />
      
      <Stack.Screen 
        name="ProfileSetup" 
        component={ProfileSetupScreen} 
        options={getScreenOptions('ProfileSetup')} 
      />

      {/* ========== MAIN APP SCREENS (Root level protection) ========== */}
      <Stack.Screen 
        name="HomeScreen" 
        component={TabNavigator} 
        options={getScreenOptions('HomeScreen', {
          animation: 'fade',
          animationDuration: 300,
        })} 
      />
      
      {/* ========== STANDALONE SCREENS ========== */}
      <Stack.Screen 
        name="ExploreScreen" 
        component={ExploreScreen} 
        options={getScreenOptions('ExploreScreen')} 
      />
      
      <Stack.Screen 
        name="CreateScreen" 
        component={CreateScreen} 
        options={getScreenOptions('CreateScreen')} 
      />
      
      <Stack.Screen 
        name="CreateStory" 
        component={CreateStoryScreen} 
        options={modalScreenOptions}
      />
      
      <Stack.Screen 
        name="EditPost" 
        component={EditPostScreen} 
        options={getScreenOptions('EditPost')} 
      />
      
      <Stack.Screen 
        name="CommentScreen" 
        component={CommentScreen}
        options={modalScreenOptions}
      />
      
      <Stack.Screen 
        name="LikeScreen" 
        component={LikeScreen}
        options={modalScreenOptions}
      />

      {/* ========== NOTIFICATION & MEMBERSHIP SCREENS ========== */}
      <Stack.Screen 
        name="NotificationsScreen" 
        component={NotificationsScreen} 
        options={getScreenOptions('NotificationsScreen')}
      />
      
      <Stack.Screen
        name="Membership99"
        component={MembershipPage99}
        options={getScreenOptions('Membership99')}
      />
      
      <Stack.Screen
        name="Membership499"
        component={MembershipPage499}
        options={getScreenOptions('Membership499')}
      />
          
      {/* ========== PROFILE SCREENS ========== */}
      <Stack.Screen 
        name="EditProfile" 
        component={EditProfileScreen} 
        options={getScreenOptions('EditProfile')} 
      />
      
      <Stack.Screen 
        name="SettingsScreen" 
        component={SettingsScreen} 
        options={getScreenOptions('SettingsScreen')} 
      />
      
      <Stack.Screen 
        name="WalletScreen" 
        component={WalletScreen} 
        options={getScreenOptions('WalletScreen')} 
      />
      
      <Stack.Screen 
        name="UserProfile" 
        component={UserProfileScreen} 
        options={getScreenOptions('UserProfile')} 
      />
      
      <Stack.Screen 
        name="FollowersList" 
        component={FollowersList} 
        options={getScreenOptions('FollowersList')} 
      />
      
      <Stack.Screen 
        name="FollowingList" 
        component={FollowingList} 
        options={getScreenOptions('FollowingList')} 
      />
      
      <Stack.Screen 
        name="BlockedUsersScreen" 
        component={BlockedUsersScreen} 
        options={getScreenOptions('BlockedUsersScreen')} 
      />
      
      <Stack.Screen 
        name="AboutScreen" 
        component={AboutScreen} 
        options={getScreenOptions('AboutScreen')}
      />
      <Stack.Screen 
        name="PrivacySettings" 
        component={PrivacySettingsScreen} 
        options={getScreenOptions('PrivacySettingsScreen')}
      />
      
      {/* ========== MEDIA VIEWER SCREENS ========== */}
      <Stack.Screen 
        name="PhotoViewerScreen" 
        component={PhotoViewerScreen} 
        options={{ 
          ...modalScreenOptions,
          animationTypeForReplace: 'push',
        }}
      />
      
      <Stack.Screen 
        name="ReelsViewerScreen" 
        component={ReelsViewerScreen}
        options={{ 
          ...modalScreenOptions,
          animationTypeForReplace: 'push',
        }}
      />
      
      <Stack.Screen 
        name="StoryViewer" 
        component={StoryViewer} 
        options={getScreenOptions('StoryViewer', {
          animationTypeForReplace: 'push',
        })}
      />
      
      {/* ========== OTHER SCREENS ========== */}
      <Stack.Screen 
        name="OffersScreen" 
        component={OffersScreen} 
        options={getScreenOptions('OffersScreen')} 
      />

      {/* ========== WEBRTC LIVE STREAMING (Maximum Protection) ========== */}
      <Stack.Screen 
        name="CreateLiveStream" 
        component={CreateLiveStream} 
        options={liveStreamOptions}
      />

      <Stack.Screen 
        name="LiveStreamViewer" 
        component={LiveStreamViewer} 
        options={liveStreamOptions}
      />
      
      {/* ========== CHAT SCREENS (Enhanced for WebRTC) ========== */}
      <Stack.Screen 
        name="UsersListScreen" 
        component={UsersListScreen} 
        options={getScreenOptions('UsersListScreen', {
          animation: 'slide_from_bottom',
        })} 
      />
      
      <Stack.Screen 
        name="ChatDetail" 
        component={ChatDetailScreen} 
        options={chatScreenOptions} 
      />

      {/* ========== DATING SCREENS ========== */}
      <Stack.Screen 
        name="TakeOnDate" 
        component={TakeOnDatePage}
        options={getScreenOptions('TakeOnDate')}
      />
      
      <Stack.Screen 
        name="BudgetSelector" 
        component={BudgetSelectorPage}
        options={getScreenOptions('BudgetSelector')}
      />

      <Stack.Screen 
        name="DateRequests" 
        component={DateRequestsScreen}
        options={getScreenOptions('DateRequests')}
      />
      
      <Stack.Screen 
        name="PendingDateRequests" 
        component={PendingDateRequestsScreen}
        options={modalScreenOptions}
      />
      
      <Stack.Screen 
        name="DateRequestDetail" 
        component={DateRequestDetailScreen}
        options={getScreenOptions('DateRequestDetail')}
      />
      
      <Stack.Screen 
        name="DateRequestStatus" 
        component={DateRequestStatusScreen}
        options={getScreenOptions('DateRequestStatus')}
      />

      {/* ========== PAYMENT & CONFIRMATION SCREENS (Protected) ========== */}
      <Stack.Screen 
        name="PaymentScreen" 
        component={PaymentScreen}
        options={getScreenOptions('PaymentScreen', {
          presentation: 'card',
          statusBarStyle: 'light',
          statusBarBackgroundColor: '#0a0a0a',
          freezeOnBlur: true,
        })}
      />
      
      <Stack.Screen 
        name="DateConfirmed" 
        component={DateConfirmed}
        options={getScreenOptions('DateConfirmed', {
          presentation: 'card',
          statusBarStyle: 'light',
          statusBarBackgroundColor: '#0a0a0a',
          freezeOnBlur: false,
        })}
      />
      
      <Stack.Screen 
        name="PrivateChat" 
        component={PrivateChatScreen} 
        options={chatScreenOptions} 
      />
      
      <Stack.Screen 
        name="PrivateTakeOnDate" 
        component={TakeOnDate} 
        options={getScreenOptions('PrivateTakeOnDate')} 
      />
       <Stack.Screen name="SearchUsersList" component={SearchUsersList} />

      {/* ========== CALL SCREENS (Maximum Protection) ========== */}
      <Stack.Screen
        name="CallScreen"
        component={CallScreen}
        options={callScreenOptions}
      />
    </Stack.Navigator>
  );
};

export default AppNavigator;