import React, { useState, } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, Image, Modal, Alert, ActivityIndicator, Animated 
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { launchImageLibrary } from 'react-native-image-picker';
import ImageResizer from 'react-native-image-resizer';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../../types/navigation';

type ProfileSetupNavigationProp = NativeStackNavigationProp<RootStackParamList, 'ProfileSetup'>;
type ProfileSetupRouteProp = RouteProp<RootStackParamList, 'ProfileSetup'>;

type Props = {
  route: ProfileSetupRouteProp;
  navigation: ProfileSetupNavigationProp;
};

const MAX_BIO_LENGTH = 100;
const MAX_IMAGE_SIZE_MB = 10;

const ProfileSetupScreen = ({ route, navigation }: Props) => {
  const { gender, answers, userId } = route.params;
  const [bio, setBio] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [optionsVisible, setOptionsVisible] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [retryVisible, setRetryVisible] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(1));

  const compressImage = async (uri: string) => {
    try {
      const resized = await ImageResizer.createResizedImage(uri, 800, 800, 'JPEG', 80);
      // resized.uri and resized.size (in bytes)
      const sizeMB = resized.size / (1024 * 1024);
      if (sizeMB > MAX_IMAGE_SIZE_MB) {
        Alert.alert('Image too large', `Please select an image smaller than ${MAX_IMAGE_SIZE_MB} MB.`);
        return null;
      }
      return resized.uri;
    } catch (e) {
      console.warn('Image compression failed:', e);
      return uri;
    }
  };

  const uploadPhoto = async (uri: string) => {
    setUploading(true);
    setRetryVisible(false);
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        Alert.alert('Error', 'Authentication token not found. Please log in again.');
        navigation.navigate('Login');
        return false;
      }

      const formData = new FormData();
      formData.append('photo', {
        uri,
        type: 'image/jpeg',
        name: `profile-${userId}.jpg`,
      });

      const uploadResponse = await fetch('http://192.168.1.17:5000/api/upload-photo', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!uploadResponse.ok) {
        const text = await uploadResponse.text();
        throw new Error(`Upload failed: ${text || uploadResponse.statusText}`);
      }

      const uploadData = await uploadResponse.json();
      if (!uploadData.photoUrl) throw new Error('No photo URL returned');

      setPhoto(uploadData.photoUrl);
      return true;
    } catch (error: any) {
      console.error('Upload error:', error.message);
      Alert.alert('Upload failed', 'Network error or server issue. Please retry.');
      setRetryVisible(true);
      return false;
    } finally {
      setUploading(false);
    }
  };

  const handlePhotoUpload = () => {
    setOptionsVisible(false);
    launchImageLibrary({ mediaType: 'photo', quality: 0.8 }, async (response) => {
      if (response.didCancel) return;
      if (response.errorCode) {
        Alert.alert('Error', response.errorMessage || 'Unknown error selecting image');
        return;
      }
      const selectedUri = response.assets?.[0]?.uri;
      if (!selectedUri) return;

      const compressedUri = await compressImage(selectedUri);
      if (!compressedUri) return;

      await uploadPhoto(compressedUri);
    });
  };

  const handleRetry = () => {
    if (!photo) {
      Alert.alert('No photo selected', 'Please select a photo to upload first.');
      setRetryVisible(false);
      return;
    }
    uploadPhoto(photo);
  };

  const handleFinish = async () => {
    if (!bio.trim()) {
      Alert.alert('Error', 'Please enter a bio');
      return;
    }
    if (!photo) {
      Alert.alert('Error', 'Please upload a photo');
      return;
    }
    setUploading(true);
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        Alert.alert('Error', 'Authentication token not found. Please log in again.');
        navigation.navigate('Login');
        return;
      }
      const profileData = {
        userId,
        bio,
        photoUrl: photo,
        gender,
        preferences: answers,
        onboardingCompleted: true,
      };
      const response = await fetch('http://192.168.1.17:5000/api/profile/setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(profileData),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to save profile');
      }
      await AsyncStorage.setItem('onboardingCompleted', 'true');

      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }).start(() => {
        navigation.navigate('HomeScreen');
      });
    } catch (error: any) {
      Alert.alert('Error', `Failed to save profile: ${error.message || 'Network request failed'}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <Text style={styles.title}>Set up your profile</Text>
      <View style={styles.photoContainer}>
        {photo ? (
          <TouchableOpacity style={styles.thumbnailContainer} onPress={() => setPreviewVisible(true)}>
            <Image source={{ uri: photo }} style={styles.thumbnail} />
            <TouchableOpacity style={styles.marker} onPress={() => setOptionsVisible(true)}>
              <Text style={styles.markerText}>✎</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.photoPlaceholder}
            onPress={handlePhotoUpload}
            disabled={uploading}
          >
            {uploading ? (
              <ActivityIndicator size="large" color="#ed167e" />
            ) : (
              <Text style={styles.photoText}>+</Text>
            )}
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.addPhotoButton}
          onPress={handlePhotoUpload}
          disabled={uploading}
        >
          {uploading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>{photo ? 'Change Photo' : 'Add Photo'}</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Retry Upload Button */}
      {retryVisible && (
        <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
          <Text style={styles.retryText}>Retry Upload</Text>
        </TouchableOpacity>
      )}

      <TextInput
        style={styles.bioInput}
        placeholder="Tell us about you!"
        placeholderTextColor="#AAAAAA"
        maxLength={MAX_BIO_LENGTH}
        value={bio}
        onChangeText={setBio}
        multiline
      />
      <Text style={[styles.charCounter, bio.length > MAX_BIO_LENGTH * 0.8 && { color: '#ed167e' }]}>
        {bio.length}/{MAX_BIO_LENGTH}
      </Text>

      <TouchableOpacity
        style={[styles.finishButton, uploading && styles.disabledButton]}
        onPress={handleFinish}
        disabled={uploading}
      >
        {uploading ? (
          <ActivityIndicator size="small" color="#FFF" />
        ) : (
          <Text style={styles.buttonText}>Finish</Text>
        )}
      </TouchableOpacity>

      {/* Preview Modal */}
      <Modal visible={previewVisible} transparent animationType="fade">
        <View style={styles.modalContainer}>
          <TouchableOpacity
            style={styles.modalBackground}
            onPress={() => setPreviewVisible(false)}
          />
          <Image source={{ uri: photo! }} style={styles.previewImage} resizeMode="contain" />
        </View>
      </Modal>

      {/* Options Modal */}
      <Modal visible={optionsVisible} transparent animationType="fade">
        <View style={styles.modalContainer}>
          <TouchableOpacity
            style={styles.modalBackground}
            onPress={() => setOptionsVisible(false)}
          />
          <View style={styles.optionsBox}>
            <TouchableOpacity onPress={handlePhotoUpload} style={styles.optionButton}>
              <Text style={styles.optionText}>Change Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setPhoto(null); setOptionsVisible(false); }} style={styles.optionButton}>
              <Text style={styles.optionText}>Remove Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setOptionsVisible(false)} style={styles.optionButton}>
              <Text style={styles.optionText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
    padding: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
  },
  photoContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  photoPlaceholder: {
    backgroundColor: '#333',
    height: 120,
    width: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoText: {
    fontSize: 48,
    color: '#ed167e',
  },
  thumbnailContainer: {
    position: 'relative',
  },
  thumbnail: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  marker: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#ed167e',
    borderRadius: 15,
    padding: 6,
  },
  markerText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 18,
  },
  addPhotoButton: {
    marginTop: 15,
    backgroundColor: '#ed167e',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 30,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 18,
  },
  retryButton: {
    marginVertical: 10,
    backgroundColor: '#f44336',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 25,
    alignSelf: 'center',
  },
  retryText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  bioInput: {
    backgroundColor: '#222',
    color: '#fff',
    fontSize: 16,
    padding: 14,
    borderRadius: 10,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  charCounter: {
    color: '#666',
    alignSelf: 'flex-end',
    marginTop: 6,
    marginBottom: 20,
    fontSize: 14,
    fontWeight: '500',
  },
  finishButton: {
    backgroundColor: '#ed167e',
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: 'center',
  },
  disabledButton: {
    opacity: 0.6,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBackground: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  previewImage: {
    width: '90%',
    height: '70%',
    borderRadius: 20,
  },
  optionsBox: {
    backgroundColor: '#333',
    borderRadius: 15,
    paddingVertical: 20,
    paddingHorizontal: 30,
    width: '80%',
  },
  optionButton: {
    paddingVertical: 12,
    borderBottomColor: '#555',
    borderBottomWidth: 1,
  },
  optionText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default ProfileSetupScreen;
