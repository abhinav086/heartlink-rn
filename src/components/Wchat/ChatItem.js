import { View, Text, Image, StyleSheet } from 'react-native';
import React from 'react';
import { icons } from '../../constants';

const ChatItem = ({ name, message, time, dp, status }) => {
  const statusIconsMap = {
    seen: icons.read,
    delivered: icons.delivered,
  };

  const getStatusIcon = () => {
    if (status === 'unread') return null;

    const iconSource = statusIconsMap[status];
    if (!iconSource) return null;

    return (
      <Image
        source={iconSource}
        style={[
          styles.statusIcon,
          { tintColor: status === 'seen' ? '#ed167e' : 'gray' },
        ]}
      />
    );
  };

  const isUnread = status === 'unread';

  return (
    <View style={styles.container}>
      <Image source={{ uri: dp }} style={styles.dp} />
      <View style={styles.content}>
        <View style={styles.topRow}>
          <Text style={[styles.name, isUnread && { color: '#ed167e' }]}>
            {name}
          </Text>
          <Text style={styles.time}>{time}</Text>
        </View>
        <View style={styles.bottomRow}>
          {getStatusIcon()}
          <Text
            style={[
              styles.message,
              isUnread ? styles.unreadMessage : styles.readMessage,
            ]}
          >
            {message}
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2e2e2e',
  },
  dp: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 16,
  },
  content: {
    flex: 1,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  name: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  time: {
    color: 'gray',
    fontSize: 12,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  statusIcon: {
    width: 16,
    height: 16,
    marginRight: 4,
  },
  message: {
    fontSize: 14,
  },
  unreadMessage: {
    color: 'white',
    fontWeight: 'bold',
  },
  readMessage: {
    color: 'gray',
  },
});

export default ChatItem;
