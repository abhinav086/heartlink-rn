// TabNavigator.js - Enhanced with gesture navigation protection
import React, { useRef, useEffect } from 'react';
import {
  View,
  Image,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Dimensions,
  ImageSourcePropType,
  GestureResponderEvent,
  Platform,
} from 'react-native';
import { createBottomTabNavigator, BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import { icons } from '../constants';
import HomeScreen from '../screens/tabs/HomeScreen';
import CreateScreen from '../screens/tabs/CreateScreen';
import WChatScreen from '../screens/tabs/WChatScreen';
import ProfileScreen from '../screens/tabs/ProfileScreen';
import ReelsScreen from '../screens/tabs/ReelsScreen';
import type { TabParamList } from '../types/tabnavigation';

// Centralized theme
const theme = {
  primary: '#ed167e',
  inactive: '#aaa',
  background: 'rgba(10, 10, 10, 0.9)',
};

interface TabIconProps {
  icon: ImageSourcePropType;
  color: string;
  focused: boolean;
  isLarge?: boolean;
  isExtraLarge?: boolean;
  label: string;
}

const TabIcon: React.FC<TabIconProps> = ({
  icon,
  color,
  focused,
  isLarge,
  isExtraLarge,
  label,
}) => {
  const scaleAnim = useRef(new Animated.Value(focused ? 1.2 : 1)).current;

  useEffect(() => {
    Animated.timing(scaleAnim, {
      toValue: focused ? 1.2 : 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [focused, scaleAnim]);

  return (
    <Animated.View
      style={[
        styles.iconContainer,
        isExtraLarge && styles.iconExtraLargeContainer,
        { transform: [{ scale: scaleAnim }] },
      ]}
      accessible
      accessibilityLabel={label}
    >
      <Image
        source={icon}
        style={[
          styles.icon,
          isLarge ? styles.iconLarge : {},
          isExtraLarge ? styles.iconExtraLarge : {},
          { tintColor: focused ? theme.primary : color },
        ]}
      />
    </Animated.View>
  );
};

// Custom Tab Button for Create
const CreateTabButton: React.FC<BottomTabBarButtonProps> = (props) => {
  const navigation = useNavigation<any>();

  return (
    <TouchableOpacity
      {...props}
      activeOpacity={0.7}
      style={styles.middleButtonTouchable}
      onPress={() => navigation.navigate('Create')}
      accessible
      accessibilityLabel="Create"
    >
      <View style={styles.middleButtonWrapper}>
        <TabIcon
          icon={icons.plus}
          color="#fff"
          focused={props.accessibilityState?.selected ?? false}
          isExtraLarge
          label="Create"
        />
      </View>
    </TouchableOpacity>
  );
};

// Custom Tab Button for Home
const HomeTabButton: React.FC<BottomTabBarButtonProps & { homeScreenRef: React.RefObject<{ scrollToTopAndRefresh: () => void }> }> = ({
  homeScreenRef,
  ...props
}) => {
  return (
    <TouchableOpacity
      {...props}
      onPress={(e: GestureResponderEvent) => {
        console.log('Home icon tapped, ref exists:', !!homeScreenRef.current); // Debug
        if (homeScreenRef.current) {
          homeScreenRef.current.scrollToTopAndRefresh();
        }
        props.onPress?.(e); // Navigate to Home screen
      }}
      accessible
      accessibilityLabel="Home"
    >
      <TabIcon
        icon={icons.home}
        color={theme.inactive}
        focused={props.accessibilityState?.selected ?? false}
        label="Home"
      />
    </TouchableOpacity>
  );
};

const Tab = createBottomTabNavigator<TabParamList>();

const TabNavigator: React.FC = () => {
  const screenWidth = Dimensions.get('window').width;
  const homeScreenRef = useRef<{ scrollToTopAndRefresh: () => void }>(null);

  // Debug ref assignment
  useEffect(() => {
    console.log('homeScreenRef.current:', homeScreenRef.current);
  }, []);

  // ENHANCED: Get platform-specific tab navigation options
  const getTabScreenOptions = () => ({
    headerShown: false,
    // CRITICAL: Disable gesture on individual tabs to prevent app exit
    gestureEnabled: false,
    // Enhanced Android configuration
    ...(Platform.OS === 'android' && {
      gestureDirection: 'horizontal',
      gestureResponseDistance: {
        horizontal: 0, // Disable horizontal gestures at tab level
        vertical: -1,
      },
      gestureVelocityImpact: 0,
    }),
    // iOS specific configurations
    ...(Platform.OS === 'ios' && {
      gestureDirection: 'horizontal',
      gestureResponseDistance: {
        horizontal: 0, // Disable horizontal gestures at tab level
      },
    }),
  });

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: [
          styles.tabBar,
          { marginHorizontal: screenWidth * 0.03 },
        ],
        tabBarHideOnKeyboard: false,
        // ENHANCED: Root level gesture protection
        gestureEnabled: false,
        // Prevent tab switching gestures that might interfere with navigation
        swipeEnabled: false,
        // Enhanced gesture configuration for tabs
        ...(Platform.OS === 'android' && {
          gestureDirection: 'horizontal',
          gestureResponseDistance: {
            horizontal: 0, // Completely disable horizontal gestures
            vertical: -1,
          },
          gestureVelocityImpact: 0,
        }),
        // iOS specific tab configurations
        ...(Platform.OS === 'ios' && {
          gestureDirection: 'horizontal',
          gestureResponseDistance: {
            horizontal: 0, // Completely disable horizontal gestures
          },
        }),
      }}
    >
      {/* Home Tab */}
      <Tab.Screen
        name="Home"
        options={{
          tabBarButton: (props) => <HomeTabButton {...props} homeScreenRef={homeScreenRef} />,
          ...getTabScreenOptions(),
        }}
      >
        {() => {
          console.log('Rendering HomeScreen with ref'); // Debug
          return <HomeScreen ref={homeScreenRef} />;
        }}
      </Tab.Screen>

      {/* Chat Tab */}
      <Tab.Screen
        name="Chat"
        component={WChatScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon icon={icons.chat} color={theme.inactive} focused={focused} label="Chat" />
          ),
          ...getTabScreenOptions(),
        }}
      />

      {/* Create Tab (Center Button) */}
      <Tab.Screen
        name="Create"
        component={CreateScreen}
        options={{
          tabBarButton: (props) => <CreateTabButton {...props} />,
          ...getTabScreenOptions(),
        }}
      />

      {/* Reels Tab (Video/WChat) */}
      <Tab.Screen
        name="WChat"
        component={ReelsScreen} // This renders the ReelsScreen component
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              icon={icons.video}
              color={theme.inactive}
              focused={focused}
              isLarge
              label="Reels"
            />
          ),
          ...getTabScreenOptions(),
        }}
      />

      {/* Profile Tab */}
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              icon={icons.profile}
              color={theme.inactive}
              focused={focused}
              label="Profile"
            />
          ),
          ...getTabScreenOptions(),
        }}
      />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    backgroundColor: theme.background,
    borderTopWidth: 0,
    height: Dimensions.get('window').height * 0.07,
    borderRadius: 20,
    bottom: 10,
    paddingTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 5,
    // ENHANCED: Additional z-index to ensure tab bar stays on top
    zIndex: 1000,
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    width: 28,
    height: 28,
  },
  iconLarge: {
    width: 34,
    height: 34,
  },
  iconExtraLarge: {
    width: 50,
    height: 50,
  },
  iconExtraLargeContainer: {
    marginBottom: 15,
  },
  middleButtonTouchable: {
    width: 70,
    height: 70,
    justifyContent: 'center',
    alignItems: 'center',
    top: Dimensions.get('window').height * -0.03,
    // ENHANCED: Ensure button stays interactive
    zIndex: 1001,
  },
  middleButtonWrapper: {
    backgroundColor: theme.primary,
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 5,
    elevation: 8,
  },
});

export default TabNavigator;