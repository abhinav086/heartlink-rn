import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from 'react-native-linear-gradient';

interface RouteParams {
  userId: string;
  username: string;
}

const TakeOnDatePage: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { userId, username } = route.params as RouteParams;

  const dateOptions = [
    {
      id: 'dinner',
      title: 'Dinner Date',
      subtitle: 'Romantic evening dining',
      icon: 'restaurant',
      gradient: ['#FF6B6B', '#FF8E8E'],
    },
    {
      id: 'lunch',
      title: 'Lunch Date',
      subtitle: 'Casual midday meal',
      icon: 'lunch-dining',
      gradient: ['#4ECDC4', '#44A08D'],
    },
    {
      id: 'coffee',
      title: 'Coffee Date',
      subtitle: 'Cozy café conversations',
      icon: 'local-cafe',
      gradient: ['#8B4513', '#D2691E'],
    },
    {
      id: 'movie',
      title: 'Movie Date',
      subtitle: 'Cinema experience together',
      icon: 'movie',
      gradient: ['#FF1744', '#FF5722'],
    },
    {
      id: 'park_walk',
      title: 'Park Walk',
      subtitle: 'Peaceful nature stroll',
      icon: 'park',
      gradient: ['#43A047', '#66BB6A'],
    },
    {
      id: 'beach',
      title: 'Beach Date',
      subtitle: 'Sun, sand, and waves',
      icon: 'beach-access',
      gradient: ['#00BCD4', '#26C6DA'],
    },
    {
      id: 'adventure',
      title: 'Adventure Date',
      subtitle: 'Thrilling outdoor activities',
      icon: 'terrain',
      gradient: ['#FF9800', '#FFB74D'],
    },
    {
      id: 'shopping',
      title: 'Shopping Date',
      subtitle: 'Explore stores together',
      icon: 'shopping-bag',
      gradient: ['#9C27B0', '#E91E63'],
    },
    {
      id: 'party',
      title: 'Party Date',
      subtitle: 'Dance and celebrate',
      icon: 'celebration',
      gradient: ['#673AB7', '#9C27B0'],
    },
    {
      id: 'cultural_event',
      title: 'Cultural Event',
      subtitle: 'Museums, art, and shows',
      icon: 'museum',
      gradient: ['#3F51B5', '#5C6BC0'],
    },
    {
      id: 'sports',
      title: 'Sports Date',
      subtitle: 'Active fun together',
      icon: 'sports-tennis',
      gradient: ['#FF5722', '#FF7043'],
    },
    {
      id: 'other',
      title: 'Custom Date',
      subtitle: 'Plan something unique',
      icon: 'add-circle',
      gradient: ['#607D8B', '#78909C'],
    },
  ];

  const handleDateTypeSelect = (dateType: string, title: string) => {
    navigation.navigate('BudgetSelector', {
      userId,
      username,
      dateType,
      dateTitle: title,
    });
  };

  const handleGoBack = () => {
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0a" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleGoBack} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Take on a Date</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Subtitle */}
      <View style={styles.subtitleContainer}>
        <Text style={styles.subtitle}>
          Choose your perfect date experience with @{username}
        </Text>
      </View>

      {/* Date Options */}
      <ScrollView 
        style={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.optionsContainer}
      >
        {dateOptions.map((option) => (
          <TouchableOpacity
            key={option.id}
            style={styles.optionCard}
            onPress={() => handleDateTypeSelect(option.id, option.title)}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={option.gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.cardGradient}
            >
              <View style={styles.cardContent}>
                <View style={styles.iconContainer}>
                  <Icon name={option.icon} size={32} color="#fff" />
                </View>
                <View style={styles.textContainer}>
                  <Text style={styles.optionTitle}>{option.title}</Text>
                  <Text style={styles.optionSubtitle}>{option.subtitle}</Text>
                </View>
                <View style={styles.arrowContainer}>
                  <Icon name="arrow-forward-ios" size={18} color="#fff" />
                </View>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Bottom Note */}
      <View style={styles.bottomNote}>
        <Text style={styles.noteText}>
          💝 Premium feature - Create memorable experiences together
        </Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#2e2e2e',
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  placeholder: {
    width: 34,
  },
  subtitleContainer: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  subtitle: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    lineHeight: 22,
  },
  scrollContainer: {
    flex: 1,
  },
  optionsContainer: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
    gap: 15,
  },
  optionCard: {
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  cardGradient: {
    padding: 18,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  textContainer: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  optionSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  arrowContainer: {
    marginLeft: 10,
  },
  bottomNote: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    alignItems: 'center',
  },
  noteText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});

export default TakeOnDatePage;