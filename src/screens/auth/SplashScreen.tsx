import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, Image, Text, Dimensions, Animated } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';
import { images } from '../../constants';

const { width } = Dimensions.get('window');

type SplashScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Splash'>;

type Props = {
  navigation?: SplashScreenNavigationProp;
};

const SplashScreen = ({}: Props) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [showDots, setShowDots] = useState(false);
  const [activeDot, setActiveDot] = useState(0);

  useEffect(() => {
    console.log('Rendering SplashScreen');
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true,
    }).start();

    const showDotsTimer = setTimeout(() => {
      setShowDots(true);
    }, 1000);

    return () => {
      clearTimeout(showDotsTimer);
    };
  }, [fadeAnim]);

  useEffect(() => {
    if (!showDots) return;
    const dotInterval = setInterval(() => {
      setActiveDot(prev => (prev + 1) % 3);
    }, 500);

    return () => clearInterval(dotInterval);
  }, [showDots]);

  const renderDots = () => {
    return (
      <View style={styles.dotsContainer}>
        {[0, 1, 2].map(index => (
          <Text
            key={index}
            style={[styles.dot, activeDot === index && styles.activeDot]}
          >
            .
          </Text>
        ))}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Animated.View style={{ opacity: fadeAnim, alignItems: 'center' }}>
        <Image source={images.logo} style={styles.logo} resizeMode="contain" />
        <Text style={styles.brand}>Heartlink</Text>
      </Animated.View>
      {showDots && renderDots()}
    </View>
  );
};

export default SplashScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0c0f14',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: width * 0.3,
    height: width * 0.3,
  },
  brand: {
    fontSize: 24,
    color: '#fff',
    fontWeight: '500',
    fontFamily: 'Montserrat',
    letterSpacing: 2,
    textAlign: 'center',
  },
  dotsContainer: {
    position: 'absolute',
    bottom: 50,
    flexDirection: 'row',
  },
  dot: {
    fontSize: 62,
    color: '#fff',
    marginHorizontal: 2,
  },
  activeDot: {
    color: '#ff1493',
  },
});