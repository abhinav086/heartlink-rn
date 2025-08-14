import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { icons } from '../../constants';

const PendingRequests = () => {
  return (
    <View style={styles.box}>
      <Text style={styles.text}>Pending Requests</Text>
      <View style={styles.iconContainer}>
        <Image source={icons.bell} style={styles.bellIcon} />
        <View style={styles.notificationDot} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  box: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#3c3c3c',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    elevation: 2,
  },
  text: {
    fontSize: 16,
    fontWeight: '400',
    color: '#fff',
  },
  iconContainer: {
    position: 'relative',
  },
  bellIcon: {
    width: 24,
    height: 24,
    tintColor: '#fff',
  },
  notificationDot: {
    width: 8,
    height: 8,
    backgroundColor: '#ED167E',
    borderRadius: 50,
    position: 'absolute',
    top: 0,
    right: 0,
  },
});

export default PendingRequests;
