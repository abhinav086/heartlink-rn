// src/components/CallHistoryButton.js - Reusable Call History Access Component
import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useCall } from '../context/CallManager';
import Ionicons from 'react-native-vector-icons/Ionicons';

const CallHistoryButton = ({ 
  style = {},
  textStyle = {},
  iconSize = 24,
  showText = true,
  variant = 'default', // 'default', 'header', 'fab', 'list'
}) => {
  const navigation = useNavigation();
  const { callHistory } = useCall();

  const handlePress = () => {
    navigation.navigate('CallHistory');
  };

  const missedCallsCount = callHistory.filter(call => 
    call.status === 'missed' && call.direction === 'incoming'
  ).length;

  const renderByVariant = () => {
    switch (variant) {
      case 'header':
        return (
          <TouchableOpacity 
            style={[styles.headerButton, style]} 
            onPress={handlePress}
            activeOpacity={0.7}
          >
            <View style={styles.iconContainer}>
              <Ionicons name="time-outline" size={iconSize} color="#FF6B9D" />
              {missedCallsCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {missedCallsCount > 99 ? '99+' : missedCallsCount}
                  </Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        );

      case 'fab':
        return (
          <TouchableOpacity 
            style={[styles.fabButton, style]} 
            onPress={handlePress}
            activeOpacity={0.8}
          >
            <View style={styles.iconContainer}>
              <Ionicons name="time-outline" size={iconSize} color="white" />
              {missedCallsCount > 0 && (
                <View style={[styles.badge, styles.fabBadge]}>
                  <Text style={styles.badgeText}>
                    {missedCallsCount > 99 ? '99+' : missedCallsCount}
                  </Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        );

      case 'list':
        return (
          <TouchableOpacity 
            style={[styles.listItem, style]} 
            onPress={handlePress}
            activeOpacity={0.7}
          >
            <View style={styles.listItemLeft}>
              <View style={[styles.listIconContainer, styles.iconContainer]}>
                <Ionicons name="time-outline" size={iconSize} color="#FF6B9D" />
                {missedCallsCount > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {missedCallsCount > 99 ? '99+' : missedCallsCount}
                    </Text>
                  </View>
                )}
              </View>
              {showText && (
                <View style={styles.textContainer}>
                  <Text style={[styles.listText, textStyle]}>Call History</Text>
                  {missedCallsCount > 0 && (
                    <Text style={styles.listSubtext}>
                      {missedCallsCount} missed call{missedCallsCount !== 1 ? 's' : ''}
                    </Text>
                  )}
                </View>
              )}
            </View>
            <Ionicons name="chevron-forward-outline" size={20} color="#666" />
          </TouchableOpacity>
        );

      default:
        return (
          <TouchableOpacity 
            style={[styles.defaultButton, style]} 
            onPress={handlePress}
            activeOpacity={0.7}
          >
            <View style={styles.iconContainer}>
              <Ionicons name="time-outline" size={iconSize} color="#FF6B9D" />
              {missedCallsCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {missedCallsCount > 99 ? '99+' : missedCallsCount}
                  </Text>
                </View>
              )}
            </View>
            {showText && (
              <Text style={[styles.defaultText, textStyle]}>Call History</Text>
            )}
          </TouchableOpacity>
        );
    }
  };

  return renderByVariant();
};

const styles = StyleSheet.create({
  // Default variant
  defaultButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#2C2C2E',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FF6B9D',
  },
  defaultText: {
    color: '#FF6B9D',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },

  // Header variant
  headerButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'transparent',
  },

  // FAB variant
  fabButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FF6B9D',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
  },

  // List variant
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#1C1C1E',
    borderBottomWidth: 1,
    borderBottomColor: '#2C2C2E',
  },
  listItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  listIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2C2C2E',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  listText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 2,
  },
  listSubtext: {
    color: '#FF6B9D',
    fontSize: 12,
    fontWeight: '500',
  },

  // Common styles
  iconContainer: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#F44336',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#1C1C1E',
  },
  fabBadge: {
    borderColor: '#FF6B9D',
  },
  badgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
  },
});

export default CallHistoryButton;