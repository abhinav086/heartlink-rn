import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
  Image,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  PermissionsAndroid,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
// import { icons } from '../../constants';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import Icon from 'react-native-vector-icons/Ionicons';
import BASE_URL from '../../config/config'; // Use your existing config

const UpdateProfileScreen = () => {
  const navigation = useNavigation();
  const { user, token, updateUser, logout } = useAuth(); // Get token directly from AuthContext
  
  // Form state
  const [formData, setFormData] = useState({
    fullName: '',
    username: '',
    email: '',
    phoneNumber: '',
    bio: '',
    gender: '',
    isPrivateAccount: false,
    allowFollowRequests: true,
  });
  
  const [profilePhoto, setProfilePhoto] = useState(null);
  const [hobbies, setHobbies] = useState([]);
  const [giftPreferences, setGiftPreferences] = useState([]);
  const [newHobby, setNewHobby] = useState('');
  const [newGiftPref, setNewGiftPref] = useState('');
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [genderModalVisible, setGenderModalVisible] = useState(false);
  const [photoModalVisible, setPhotoModalVisible] = useState(false);
  const [errors, setErrors] = useState({});
  
  // Predefined options
  const genderOptions = ['Male', 'Female', 'Others'];
  const popularHobbies = [
    'Reading', 'Photography', 'Traveling', 'Cooking', 'Gaming',
    'Music', 'Dancing', 'Sports', 'Art', 'Movies', 'Fitness', 'Nature'
  ];
  const popularGiftPrefs = [
    'Books', 'Jewelry', 'Electronics', 'Clothing', 'Experiences',
    'Art', 'Flowers', 'Chocolates', 'Perfume', 'Gadgets'
  ];

  // Initialize form with user data
  useEffect(() => {
    if (user) {
      setFormData({
        fullName: user.fullName || '',
        username: user.username || '',
        email: user.email || '',
        phoneNumber: user.phoneNumber || '',
        bio: user.bio || '',
        gender: user.gender || '',
        isPrivateAccount: user.isPrivateAccount || false,
        allowFollowRequests: user.allowFollowRequests !== false,
      });
      setHobbies(user.hobbies || []);
      setGiftPreferences(user.giftPreferences || []);
      setProfilePhoto(user.photoUrl ? { uri: user.photoUrl } : null);
    }
  }, [user]);

  // Request camera permission for Android
  const requestCameraPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            title: 'Camera Permission',
            message: 'App needs camera permission to take photos',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.warn(err);
        return false;
      }
    }
    return true;
  };

  // Form validation
  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.fullName.trim()) {
      newErrors.fullName = 'Full name is required';
    }
    
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }
    
    if (formData.username && formData.username.length < 3) {
      newErrors.username = 'Username must be at least 3 characters';
    }
    
    if (formData.bio && formData.bio.length > 500) {
      newErrors.bio = 'Bio cannot exceed 500 characters';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form input changes
  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  // Handle image selection
  const selectImage = async (source) => {
    try {
      const options = {
        mediaType: 'photo',
        includeBase64: false,
        maxHeight: 1000,
        maxWidth: 1000,
        quality: 0.8,
      };

      if (source === 'camera') {
        const hasPermission = await requestCameraPermission();
        if (!hasPermission) {
          Alert.alert('Permission denied', 'Camera permission is required to take photos');
          return;
        }
        
        launchCamera(options, (response) => {
          if (response.didCancel || response.error) {
            return;
          }
          
          if (response.assets && response.assets[0]) {
            setProfilePhoto({
              uri: response.assets[0].uri,
              type: response.assets[0].type,
              name: response.assets[0].fileName || 'profile.jpg',
            });
            setPhotoModalVisible(false);
          }
        });
      } else {
        launchImageLibrary(options, (response) => {
          if (response.didCancel || response.error) {
            return;
          }
          
          if (response.assets && response.assets[0]) {
            setProfilePhoto({
              uri: response.assets[0].uri,
              type: response.assets[0].type,
              name: response.assets[0].fileName || 'profile.jpg',
            });
            setPhotoModalVisible(false);
          }
        });
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to select image');
    }
  };

  // Add hobby
  const addHobby = (hobby) => {
    const trimmedHobby = hobby.trim();
    if (trimmedHobby && !hobbies.includes(trimmedHobby) && hobbies.length < 10) {
      setHobbies(prev => [...prev, trimmedHobby]);
      setNewHobby('');
    }
  };

  // Remove hobby
  const removeHobby = (index) => {
    setHobbies(prev => prev.filter((_, i) => i !== index));
  };

  // Add gift preference
  const addGiftPreference = (pref) => {
    const trimmedPref = pref.trim();
    if (trimmedPref && !giftPreferences.includes(trimmedPref) && giftPreferences.length < 20) {
      setGiftPreferences(prev => [...prev, trimmedPref]);
      setNewGiftPref('');
    }
  };

  // Remove gift preference
  const removeGiftPreference = (index) => {
    setGiftPreferences(prev => prev.filter((_, i) => i !== index));
  };

  // Get user initials for avatar
  const getInitials = (name) => {
    if (!name) return '?';
    const names = name.trim().split(' ');
    if (names.length === 1) {
      return names[0].charAt(0).toUpperCase();
    }
    return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase();
  };

  // Get avatar color
  const getAvatarColor = (name) => {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
      '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
    ];
    if (!name) return colors[0];
    const charCodeSum = name.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
    return colors[charCodeSum % colors.length];
  };

  // Handle form submission
  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    // Check authentication first
    if (!token || !user) {
      Alert.alert('Error', 'You need to be logged in to update your profile.', [
        { text: 'OK', onPress: () => logout() }
      ]);
      return;
    }

    setLoading(true);
    try {
      // Debug logging
      console.log('Submitting profile update with:', {
        userId: user._id,
        hasToken: !!token,
        endpoint: `${BASE_URL}/api/v1/users/user/profile`
      });

      // Prepare form data for API
      const updateData = new FormData();
      
      // Add text fields
      updateData.append('fullName', formData.fullName.trim());
      updateData.append('username', formData.username.trim());
      updateData.append('email', formData.email.toLowerCase().trim());
      updateData.append('phoneNumber', formData.phoneNumber.trim());
      updateData.append('bio', formData.bio.trim());
      updateData.append('gender', formData.gender);
      updateData.append('isPrivateAccount', formData.isPrivateAccount.toString());
      updateData.append('allowFollowRequests', formData.allowFollowRequests.toString());
      
      // Add arrays as JSON strings (as expected by backend)
      updateData.append('hobbies', JSON.stringify(hobbies));
      updateData.append('giftPreferences', JSON.stringify(giftPreferences));
      
      // Add photo if changed (only if it's a new local file)
      if (profilePhoto && profilePhoto.uri && !profilePhoto.uri.includes('http')) {
        updateData.append('photo', {
          uri: profilePhoto.uri,
          type: profilePhoto.type || 'image/jpeg',
          name: profilePhoto.name || 'profile.jpg',
        });
      }

      console.log('Sending update request...');

      // Make API call to update profile - using your backend route structure
      const response = await fetch(`${BASE_URL}/api/v1/users/user/profile`, {
        method: 'PUT',
        body: updateData,
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${token}`,
        },
      });

      console.log('Response status:', response.status);

      const result = await response.json();
      console.log('API Response:', result);

      if (response.ok && result.success) {
        // Update was successful
        console.log('Profile updated successfully:', result);
        
        // Update user in context
        updateUser(result.data.user);
        
        Alert.alert(
          'Success', 
          'Profile updated successfully!', 
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      } else {
        // Handle different error scenarios
        console.error('Update failed:', result);
        
        if (response.status === 401) {
          Alert.alert(
            'Authentication Error', 
            'Your session has expired. Please login again.',
            [{ text: 'OK', onPress: () => logout() }]
          );
        } else if (response.status === 400) {
          // Validation errors
          const errorMessage = result.message || 'Invalid data provided';
          Alert.alert('Validation Error', errorMessage);
        } else {
          Alert.alert('Error', result.message || 'Failed to update profile');
        }
      }
    } catch (error) {
      console.error('Network error:', error);
      
      if (error.message.includes('Network request failed')) {
        Alert.alert(
          'Network Error', 
          'Please check your internet connection and try again.'
        );
      } else if (error.message.includes('Failed to fetch')) {
        Alert.alert(
          'Connection Error', 
          'Could not connect to server. Please check your network connection.'
        );
      } else {
        Alert.alert('Error', 'Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.headerButton} 
            onPress={() => navigation.goBack()}
          >
            <Icon name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Profile</Text>
          <TouchableOpacity 
            style={styles.headerButton}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.saveText}>Save</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView 
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Profile Photo Section */}
          <View style={styles.photoSection}>
            <TouchableOpacity 
              style={styles.photoContainer}
              onPress={() => setPhotoModalVisible(true)}
            >
              {profilePhoto ? (
                <Image source={profilePhoto} style={styles.profilePhoto} />
              ) : (
                <View style={[styles.avatarPlaceholder, { backgroundColor: getAvatarColor(formData.fullName) }]}>
                  <Text style={styles.avatarText}>{getInitials(formData.fullName)}</Text>
                </View>
              )}
              <View style={styles.photoEditOverlay}>
                <Icon name="camera" size={20} color="#fff" />
              </View>
            </TouchableOpacity>
            <Text style={styles.photoHint}>Tap to change photo</Text>
          </View>

          {/* Basic Information */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Basic Information</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Full Name *</Text>
              <TextInput
                style={[styles.textInput, errors.fullName && styles.inputError]}
                value={formData.fullName}
                onChangeText={(value) => handleInputChange('fullName', value)}
                placeholder="Enter your full name"
                placeholderTextColor="#666"
              />
              {errors.fullName && <Text style={styles.errorText}>{errors.fullName}</Text>}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Username</Text>
              <TextInput
                style={[styles.textInput, errors.username && styles.inputError]}
                value={formData.username}
                onChangeText={(value) => handleInputChange('username', value.toLowerCase())}
                placeholder="Choose a username"
                placeholderTextColor="#666"
                autoCapitalize="none"
              />
              {errors.username && <Text style={styles.errorText}>{errors.username}</Text>}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Email *</Text>
              <TextInput
                style={[styles.textInput, errors.email && styles.inputError]}
                value={formData.email}
                onChangeText={(value) => handleInputChange('email', value)}
                placeholder="Enter your email"
                placeholderTextColor="#666"
                keyboardType="email-address"
                autoCapitalize="none"
              />
              {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Phone Number</Text>
              <TextInput
                style={styles.textInput}
                value={formData.phoneNumber}
                onChangeText={(value) => handleInputChange('phoneNumber', value)}
                placeholder="Enter your phone number"
                placeholderTextColor="#666"
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Gender</Text>
              <TouchableOpacity
                style={styles.selectInput}
                onPress={() => setGenderModalVisible(true)}
              >
                <Text style={[styles.selectText, !formData.gender && styles.placeholder]}>
                  {formData.gender || 'Select gender'}
                </Text>
                <Icon name="chevron-down" size={20} color="#666" />
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Bio</Text>
              <TextInput
                style={[styles.textInput, styles.bioInput, errors.bio && styles.inputError]}
                value={formData.bio}
                onChangeText={(value) => handleInputChange('bio', value)}
                placeholder="Tell us about yourself..."
                placeholderTextColor="#666"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
              <Text style={styles.characterCount}>
                {formData.bio.length}/500
              </Text>
              {errors.bio && <Text style={styles.errorText}>{errors.bio}</Text>}
            </View>
          </View>

          {/* Hobbies Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Hobbies & Interests</Text>
            <Text style={styles.sectionSubtitle}>Add up to 10 hobbies</Text>
            
            <View style={styles.addItemContainer}>
              <TextInput
                style={styles.addItemInput}
                value={newHobby}
                onChangeText={setNewHobby}
                placeholder="Add a hobby"
                placeholderTextColor="#666"
                onSubmitEditing={() => addHobby(newHobby)}
              />
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => addHobby(newHobby)}
                disabled={!newHobby.trim() || hobbies.length >= 10}
              >
                <Icon name="add" size={20} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Popular hobbies suggestions */}
            <View style={styles.suggestionsContainer}>
              {popularHobbies.filter(hobby => !hobbies.includes(hobby)).slice(0, 6).map((hobby, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.suggestionTag}
                  onPress={() => addHobby(hobby)}
                  disabled={hobbies.length >= 10}
                >
                  <Text style={styles.suggestionText}>{hobby}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Current hobbies */}
            <View style={styles.tagsContainer}>
              {hobbies.map((hobby, index) => (
                <View key={index} style={styles.tag}>
                  <Text style={styles.tagText}>{hobby}</Text>
                  <TouchableOpacity onPress={() => removeHobby(index)}>
                    <Icon name="close" size={16} color="#ed167e" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>

          {/* Gift Preferences Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Gift Preferences</Text>
            <Text style={styles.sectionSubtitle}>Add up to 20 preferences</Text>
            
            <View style={styles.addItemContainer}>
              <TextInput
                style={styles.addItemInput}
                value={newGiftPref}
                onChangeText={setNewGiftPref}
                placeholder="Add a gift preference"
                placeholderTextColor="#666"
                onSubmitEditing={() => addGiftPreference(newGiftPref)}
              />
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => addGiftPreference(newGiftPref)}
                disabled={!newGiftPref.trim() || giftPreferences.length >= 20}
              >
                <Icon name="add" size={20} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Popular gift preferences suggestions */}
            <View style={styles.suggestionsContainer}>
              {popularGiftPrefs.filter(pref => !giftPreferences.includes(pref)).slice(0, 6).map((pref, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.suggestionTag}
                  onPress={() => addGiftPreference(pref)}
                  disabled={giftPreferences.length >= 20}
                >
                  <Text style={styles.suggestionText}>{pref}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Current gift preferences */}
            <View style={styles.tagsContainer}>
              {giftPreferences.map((pref, index) => (
                <View key={index} style={styles.tag}>
                  <Text style={styles.tagText}>{pref}</Text>
                  <TouchableOpacity onPress={() => removeGiftPreference(index)}>
                    <Icon name="close" size={16} color="#ed167e" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>

         

          {/* Save Button */}
          <TouchableOpacity
            style={[styles.saveButton, loading && styles.saveButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.saveButtonText}>Save Changes</Text>
            )}
          </TouchableOpacity>
        </ScrollView>

        {/* Gender Selection Modal */}
        <Modal
          visible={genderModalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setGenderModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Gender</Text>
                <TouchableOpacity onPress={() => setGenderModalVisible(false)}>
                  <Icon name="close" size={24} color="#666" />
                </TouchableOpacity>
              </View>
              {genderOptions.map((gender, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.modalOption}
                  onPress={() => {
                    handleInputChange('gender', gender);
                    setGenderModalVisible(false);
                  }}
                >
                  <Text style={styles.modalOptionText}>{gender}</Text>
                  {formData.gender === gender && (
                    <Icon name="checkmark" size={20} color="#ed167e" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Modal>

        {/* Photo Selection Modal */}
        <Modal
          visible={photoModalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setPhotoModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Change Photo</Text>
                <TouchableOpacity onPress={() => setPhotoModalVisible(false)}>
                  <Icon name="close" size={24} color="#666" />
                </TouchableOpacity>
              </View>
              
              <TouchableOpacity
                style={styles.modalOption}
                onPress={() => selectImage('camera')}
              >
                <Icon name="camera" size={24} color="#ed167e" />
                <Text style={styles.modalOptionText}>Take Photo</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.modalOption}
                onPress={() => selectImage('gallery')}
              >
                <Icon name="image" size={24} color="#ed167e" />
                <Text style={styles.modalOptionText}>Choose from Gallery</Text>
              </TouchableOpacity>
              
              {profilePhoto && (
                <TouchableOpacity
                  style={styles.modalOption}
                  onPress={() => {
                    setProfilePhoto(null);
                    setPhotoModalVisible(false);
                  }}
                >
                  <Icon name="trash" size={24} color="#ff4757" />
                  <Text style={[styles.modalOptionText, { color: '#ff4757' }]}>Remove Photo</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2e2e2e',
  },
  headerButton: {
    padding: 8,
    minWidth: 60,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  saveText: {
    color: '#ed167e',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  photoSection: {
    alignItems: 'center',
    paddingVertical: 30,
    borderBottomWidth: 1,
    borderBottomColor: '#2e2e2e',
  },
  photoContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  profilePhoto: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 48,
    fontWeight: '700',
  },
  photoEditOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#ed167e',
    borderRadius: 18,
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#0a0a0a',
  },
  photoHint: {
    color: '#666',
    fontSize: 14,
  },
  section: {
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  sectionSubtitle: {
    color: '#666',
    fontSize: 14,
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#2e2e2e',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#fff',
    fontSize: 16,
  },
  bioInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  inputError: {
    borderColor: '#ff4757',
  },
  errorText: {
    color: '#ff4757',
    fontSize: 12,
    marginTop: 4,
  },
  characterCount: {
    color: '#666',
    fontSize: 12,
    textAlign: 'right',
    marginTop: 4,
  },
  placeholder: {
    color: '#666',
  },
  selectInput: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#2e2e2e',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectText: {
    color: '#fff',
    fontSize: 16,
  },
  addItemContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 12,
  },
  addItemInput: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#2e2e2e',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 16,
  },
  addButton: {
    backgroundColor: '#ed167e',
    borderRadius: 12,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  suggestionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  suggestionTag: {
    backgroundColor: '#2e2e2e',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  suggestionText: {
    color: '#999',
    fontSize: 14,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2e2e2e',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    gap: 6,
  },
  tagText: {
    color: '#ed167e',
    fontSize: 14,
    fontWeight: '500',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2e2e2e',
  },
  settingInfo: {
    flex: 1,
  },
  settingTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  settingSubtitle: {
    color: '#666',
    fontSize: 14,
  },
  toggle: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#2e2e2e',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleActive: {
    backgroundColor: '#ed167e',
  },
  toggleThumb: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#fff',
    alignSelf: 'flex-start',
  },
  toggleThumbActive: {
    alignSelf: 'flex-end',
  },
  saveButton: {
    backgroundColor: '#ed167e',
    marginHorizontal: 20,
    marginVertical: 20,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2e2e2e',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  modalOptionText: {
    color: '#fff',
    fontSize: 16,
    flex: 1,
  },
});

export default UpdateProfileScreen;