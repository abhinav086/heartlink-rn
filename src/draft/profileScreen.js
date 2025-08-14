import React, { useState } from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import ProfileHeader from '../../components/Profile/ProfileHeader';
import ProfileActions from '../../components/Profile/ProfileActions';
import ProfileTabs from '../../components/Profile/ProfileTabs';
import ProfilePosts from '../../components/Profile/ProfilePosts';

const ProfileScreen = () => {
  const [activeTab, setActiveTab] = useState('Posts');

  return (
    <View style={styles.container}>
      <FlatList
        data={[]}
        keyExtractor={(item, index) => index.toString()}
        ListHeaderComponent={() => (
          <>
            <ProfileHeader />
            <ProfileActions />
            <ProfileTabs setActiveTab={setActiveTab} />
            <ProfilePosts />
          </>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
});

export default ProfileScreen;

