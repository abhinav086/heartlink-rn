import React from 'react';
import { TouchableOpacity, StyleSheet, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { icons } from '../../constants';

const ExploreButton = () => {
  const navigation = useNavigation();

  return (
    <TouchableOpacity style={styles.button} onPress={() => navigation.navigate("ExploreScreen")}>
      <Image source={icons.plus} style={styles.plusIcon} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    width: 100,
    height: 100,
    marginTop: 250,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusIcon: {
    width: 60,
    height: 60,
    tintColor: '#3c3c3c',
  },
});

export default ExploreButton;
