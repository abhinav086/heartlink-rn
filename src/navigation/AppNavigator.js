// AppNavigator.js (Updated for new Live Stream Components)
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
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
import AboutScreen from '../screens/profile/AboutScreen.tsx'
import BlockedUsersScreen from '../screens/BlockedUsersScreen.js';

// --- UPDATED: Import the new, separate Live Stream Components ---
import CreateLiveStream from '../components/Home/CreateLiveStream.jsx'; // Adjust path as needed
import LiveStreamViewer from '../components/Home/LiveStreamViewer.jsx';   // Adjust path as needed

// Dating Components
import TakeOnDatePage from '../components/Dating/TakeOnDatePage.tsx';
import BudgetSelectorPage from '../components/Dating/BudgetSelectorPage.tsx';

// Dating Request Management Screens
import DateRequestsScreen from '../components/Dating/DateRequestsScreen';
import PendingDateRequestsScreen from '../components/Dating/PendingDateRequestsScreen';
import DateRequestDetailScreen from '../components/Dating/DateRequestDetailScreen';
import DateRequestStatusScreen from '../components/Dating/DateRequestStatusScreen';

// Hey heyy messaging 
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
// import CallPage from '../screens/CallPage';
import CallScreen from '../screens/CallScreen';

const Stack = createNativeStackNavigator();

// --- Screen Options (mostly unchanged) ---
const defaultScreenOptions = {
  headerShown: false,
  gestureEnabled: true,
  animation: 'slide_from_right',
};

const modalScreenOptions = {
  headerShown: false,
  presentation: 'modal',
  gestureEnabled: true,
  animation: 'slide_from_bottom',
};

const fullScreenModalOptions = {
  headerShown: false,
  presentation: 'fullScreenModal',
  gestureEnabled: false,
  animation: 'slide_from_right',
  animationDuration: 200,
};

// --- UPDATED: WebRTC Live Stream specific options ---
// Considered renaming to be more generic or specific to viewer/creator if needed,
// but keeping the name for now as it applies to the full-screen experience.
const liveStreamOptions = {
  headerShown: false,
  presentation: 'fullScreenModal',
  gestureEnabled: false,
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

// --- Call screen options (unchanged) ---
const callScreenOptions = {
  presentation: 'fullScreenModal',
  gestureEnabled: false,
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

const AppNavigator = ({ initialRouteName }) => {
  return (
    <Stack.Navigator 
      initialRouteName={initialRouteName}
      screenOptions={defaultScreenOptions}
    >
      {/* ========== AUTH SCREENS ========== */}
      <Stack.Screen 
        name="Splash" 
        component={SplashScreen} 
        options={{ 
          headerShown: false,
          gestureEnabled: false,
        }} 
      />
      <Stack.Screen
        name="Memberships"
        component={MembershipsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="Login" 
        component={LoginScreen} 
        options={{ 
          headerShown: false,
          gestureEnabled: false,
        }} 
      />
      <Stack.Screen 
        name="Signup" 
        component={SignupScreen} 
        options={{ headerShown: false }} 
      />

      {/* ========== ONBOARDING SCREENS ========== */}
      <Stack.Screen 
        name="Gender" 
        component={GenderScreen} 
        options={{ 
          headerShown: false,
          gestureEnabled: false,
        }} 
      />
      <Stack.Screen 
        name="Questions" 
        component={QuestionsScreen} 
        options={{ 
          headerShown: false,
          gestureEnabled: false,
        }} 
      />
      <Stack.Screen 
        name="ProfileSetup" 
        component={ProfileSetupScreen} 
        options={{ 
          headerShown: false,
          gestureEnabled: false,
        }} 
      />

      {/* ========== MAIN APP SCREENS ========== */}
      <Stack.Screen 
        name="HomeScreen" 
        component={TabNavigator} 
        options={{ 
          headerShown: false,
          gestureEnabled: false,
        }} 
      />
      
      {/* ========== STANDALONE SCREENS ========== */}
      <Stack.Screen 
        name="ExploreScreen" 
        component={ExploreScreen} 
        options={{ headerShown: false }} 
      />
      <Stack.Screen 
        name="CreateScreen" 
        component={CreateScreen} 
        options={{ headerShown: false }} 
      />
      <Stack.Screen 
        name="CreateStory" 
        component={CreateStoryScreen} 
        options={modalScreenOptions}
      />
      <Stack.Screen 
        name="EditPost" 
        component={EditPostScreen} 
        options={{ 
          headerShown: false,
          animation: 'slide_from_right',
        }} 
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
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Membership99"
        component={MembershipPage99}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Membership499"
        component={MembershipPage499}
        options={{ headerShown: false }}
      />
          
      {/* ========== PROFILE SCREENS ========== */}
      <Stack.Screen 
        name="EditProfile" 
        component={EditProfileScreen} 
        options={{ 
          headerShown: false,
          animation: 'slide_from_right',
        }} 
      />
      <Stack.Screen 
        name="SettingsScreen" 
        component={SettingsScreen} 
        options={{ headerShown: false }} 
      />
      <Stack.Screen 
        name="WalletScreen" 
        component={WalletScreen} 
        options={{ 
          headerShown: false,
          animation: 'slide_from_right',
        }} 
      />
      <Stack.Screen 
        name="UserProfile" 
        component={UserProfileScreen} 
        options={{ headerShown: false }} 
      />
      <Stack.Screen 
        name="FollowersList" 
        component={FollowersList} 
        options={{ 
          headerShown: false,
          animation: 'slide_from_right',
        }} 
      />
      <Stack.Screen 
        name="FollowingList" 
        component={FollowingList} 
        options={{ 
          headerShown: false,
          animation: 'slide_from_right',
        }} 
      />
      <Stack.Screen 
        name="BlockedUsersScreen" 
        component={BlockedUsersScreen} 
        options={{ 
          headerShown: false,
          animation: 'slide_from_right',
        }} 
      />
      <Stack.Screen 
        name="AboutScreen" 
        component={AboutScreen} 
        options={{ headerShown: false }}
      />
      
      {/* ========== MEDIA VIEWER SCREENS ========== */}
      <Stack.Screen 
        name="PhotoViewerScreen" 
        component={PhotoViewerScreen} 
        options={{ 
          headerShown: false,
          presentation: 'modal',
          animationTypeForReplace: 'push',
          gestureEnabled: true,
        }}
      />
      <Stack.Screen 
        name="ReelsViewerScreen" 
        component={ReelsViewerScreen}
        options={{ 
          headerShown: false,
          presentation: 'modal',
          animationTypeForReplace: 'push',
          gestureEnabled: true,
        }}
      />
      <Stack.Screen 
        name="StoryViewer" 
        component={StoryViewer} 
        options={{ 
          headerShown: false,
          gestureEnabled: false,
          animationTypeForReplace: 'push',
        }}
      />
      
      {/* ========== OTHER SCREENS ========== */}
      <Stack.Screen 
        name="OffersScreen" 
        component={OffersScreen} 
        options={{ headerShown: false }} 
      />

      {/* ========== ✅ WEBRTC LIVE STREAMING ========== */}
      {/* 
        PRIORITY: WebRTC Live Streaming Screens
        Optimized for real-time streaming performance with special configurations
        to prevent accidental navigation and maintain WebRTC connections.
        Added separate screens for Creating and Viewing streams.
      */}
      {/* --- NEW: Screen for Creating a Live Stream --- */}
      <Stack.Screen 
        name="CreateLiveStream" 
        component={CreateLiveStream} 
        options={liveStreamOptions} // Reuse the optimized options
      />

      {/* --- UPDATED: Screen for Viewing a Live Stream --- */}
      <Stack.Screen 
        name="LiveStreamViewer" 
        component={LiveStreamViewer} 
        options={liveStreamOptions} // Reuse the optimized options
      />
      
      {/* ========== CHAT SCREENS ========== */}
      <Stack.Screen 
        name="UsersListScreen" 
        component={UsersListScreen} 
        options={{ 
          headerShown: false,
          animation: 'slide_from_bottom',
        }} 
      />
      
      {/* ✅ ENHANCED: Chat Detail Screen optimized for WebRTC calling */}
      <Stack.Screen 
        name="ChatDetail" 
        component={ChatDetailScreen} 
        options={{ 
          headerShown: false,
          animation: 'slide_from_right',
          gestureEnabled: true,
          freezeOnBlur: false,
          animationDuration: 250,
          gestureResponseDistance: {
            horizontal: 50,
            vertical: -1,
          },
        }} 
      />

      {/* ========== DATING SCREENS ========== */}
      <Stack.Screen 
        name="TakeOnDate" 
        component={TakeOnDatePage}
        options={{
          headerShown: false,
          gestureEnabled: true,
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen 
        name="BudgetSelector" 
        component={BudgetSelectorPage}
        options={{
          headerShown: false,
          gestureEnabled: true,
          animation: 'slide_from_right',
        }}
      />

      <Stack.Screen 
        name="DateRequests" 
        component={DateRequestsScreen}
        options={{
          headerShown: false,
          gestureEnabled: true,
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen 
        name="PendingDateRequests" 
        component={PendingDateRequestsScreen}
        options={{
          headerShown: false,
          gestureEnabled: true,
          animation: 'slide_from_bottom',
          presentation: 'modal',
        }}
      />
      <Stack.Screen 
        name="DateRequestDetail" 
        component={DateRequestDetailScreen}
        options={{
          headerShown: false,
          gestureEnabled: true,
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen 
        name="DateRequestStatus" 
        component={DateRequestStatusScreen}
        options={{
          headerShown: false,
          gestureEnabled: true,
          animation: 'slide_from_right',
        }}
      />

      {/* ========== PAYMENT & CONFIRMATION SCREENS ========== */}
      <Stack.Screen 
        name="PaymentScreen" 
        component={PaymentScreen}
        options={{
          headerShown: false,
          gestureEnabled: false,
          animation: 'slide_from_right',
          presentation: 'card',
          statusBarStyle: 'light',
          statusBarBackgroundColor: '#0a0a0a',
          freezeOnBlur: true,
        }}
      />
      
      <Stack.Screen 
        name="DateConfirmed" 
        component={DateConfirmed}
        options={{
          headerShown: false,
          gestureEnabled: false,
          animation: 'slide_from_right',
          presentation: 'card',
          statusBarStyle: 'light',
          statusBarBackgroundColor: '#0a0a0a',
          freezeOnBlur: false,
        }}
      />
      
        <Stack.Screen 
          name="PrivateChat" 
          component={PrivateChatScreen} 
          options={{ 
            headerShown: false,
            animation: 'slide_from_right',
          }} 
        />
         <Stack.Screen 
          name="PrivateTakeOnDate" 
          component={TakeOnDate} 
          options={{ 
            headerShown: false,
            animation: 'slide_from_right',
          }} 
        />


      {/* ========== ENHANCED CALL SCREENS ========== */}
      <Stack.Screen
        name="CallScreen"
        component={CallScreen}
        options={callScreenOptions}
      />
      
      
      {/* <Stack.Screen 
        name="CallPage" 
        component={CallPage}
        options={{
          ...callScreenOptions,
          animationDuration: 250,
        }}
      /> */}
    </Stack.Navigator>
  );
};

export default AppNavigator;