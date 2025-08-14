// // components/LiveStreamManager.js - Complete WebRTC Live Streaming Solution
// import React, { useState, useEffect, useRef } from 'react';
// import {
//   View,
//   Text,
//   StyleSheet,
//   TouchableOpacity,
//   Modal,
//   TextInput,
//   ActivityIndicator,
//   Alert,
//   FlatList,
//   Dimensions,
//   Platform,
//   PermissionsAndroid,
//   ScrollView,
//   Animated,
// } from 'react-native';
// import AsyncStorage from '@react-native-async-storage/async-storage';
// import { useAuth } from '../context/AuthContext';
// import { useSocket } from '../context/SocketContext';
// import { useNavigation } from '@react-navigation/native';
// import BASE_URL from '../config/config';
// // Add this import after the existing imports
// import Icon from 'react-native-vector-icons/MaterialIcons';
// import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
// const { width, height } = Dimensions.get('window');
// // Utility function for exponential backoff delay
// const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
// // Utility function for retry with exponential backoff
// const retryWithBackoff = async (fn, maxRetries = 3, baseDelay = 1000) => {
//   for (let attempt = 1; attempt <= maxRetries; attempt++) {
//     try {
//       return await fn();
//     } catch (error) {
//       console.log(`Attempt ${attempt} failed:`, error.message);
//       if (attempt === maxRetries) {
//         throw error;
//       }
//       // Exponential backoff: 1s, 2s, 4s
//       const delayTime = baseDelay * Math.pow(2, attempt - 1);
//       console.log(`Waiting ${delayTime}ms before retry...`);
//       await delay(delayTime);
//     }
//   }
// };
// // LiveStreamCreator Component - For creating and starting streams
// export const LiveStreamCreator = ({ visible, onClose, onStreamStarted }) => {
//   const { user, token } = useAuth();
//   const { socket, isConnected } = useSocket();
//   const navigation = useNavigation();
//   const [streamTitle, setStreamTitle] = useState('');
//   const [streamDescription, setStreamDescription] = useState('');
//   const [creating, setCreating] = useState(false);
//   const [titleFocused, setTitleFocused] = useState(false);
//   const [descriptionFocused, setDescriptionFocused] = useState(false);
//   const [existingStream, setExistingStream] = useState(null);
//   const [checkingExisting, setCheckingExisting] = useState(false);
//   const [showExistingStreamOptions, setShowExistingStreamOptions] = useState(false);
//   const [creationStatus, setCreationStatus] = useState('');
//   useEffect(() => {
//     if (visible && token) {
//       checkForExistingStreams();
//     }
//   }, [visible, token]);
//   const checkForExistingStreams = async () => {
//     if (!token) {
//       console.log('No token available for checking streams');
//       return;
//     }
//     try {
//       setCheckingExisting(true);
//       console.log('Checking for existing streams...');
//       // Check if user has any active streams
//       const response = await fetch(`${BASE_URL}/api/v1/live/my-streams?page=1&limit=10`, {
//         method: 'GET',
//         headers: {
//           'Authorization': `Bearer ${token}`,
//           'Content-Type': 'application/json',
//         },
//       });
//       if (!response.ok) {
//         throw new Error(`HTTP ${response.status}`);
//       }
//       const data = await response.json();
//       console.log('My streams response:', data);
//       if (data.success && data.data && data.data.streams && Array.isArray(data.data.streams)) {
//         // Find any active streams (WAITING or LIVE status)
//         const activeStreams = data.data.streams.filter(stream =>
//           stream.status === 'WAITING' || stream.status === 'LIVE'
//         );
//         if (activeStreams.length > 0) {
//           console.log('Found existing active streams:', activeStreams);
//           // Use the first active stream
//           setExistingStream(activeStreams[0]);
//           setShowExistingStreamOptions(true);
//         } else {
//           console.log('No active streams found');
//           setExistingStream(null);
//           setShowExistingStreamOptions(false);
//         }
//       } else {
//         console.log('No streams in response or invalid format');
//         setExistingStream(null);
//         setShowExistingStreamOptions(false);
//       }
//     } catch (error) {
//       console.error('Error checking existing streams:', error);
//       // Don't show error to user for this background check
//     } finally {
//       setCheckingExisting(false);
//     }
//   };
//   const endExistingStream = async () => {
//     if (!existingStream || !token) {
//       console.log('No existing stream or token to end');
//       return;
//     }
//     try {
//       setCreating(true);
//       console.log('Ending existing stream:', existingStream.streamId);
//       const response = await fetch(`${BASE_URL}/api/v1/live/${existingStream.streamId}/end`, {
//         method: 'POST',
//         headers: {
//           'Authorization': `Bearer ${token}`,
//           'Content-Type': 'application/json',
//         },
//       });
//       if (!response.ok) {
//         throw new Error(`HTTP ${response.status}`);
//       }
//       const data = await response.json();
//       console.log('End stream response:', data);
//       if (data.success) {
//         console.log('Successfully ended existing stream');
//         setExistingStream(null);
//         setShowExistingStreamOptions(false);
//         Alert.alert('Success', 'Previous stream ended. You can now start a new stream.');
//       } else {
//         throw new Error(data.message || 'Failed to end existing stream');
//       }
//     } catch (error) {
//       console.error('Error ending existing stream:', error);
//       const errorMessage = error.message.includes('HTTP')
//         ? 'Network error. Please check your connection.'
//         : 'Failed to end existing stream. Please try again.';
//       Alert.alert('Error', errorMessage);
//     } finally {
//       setCreating(false);
//     }
//   };
//   const handleEndPreviousAndCreateNew = async () => {
//     try {
//       setCreating(true);
//       setCreationStatus('Ending previous streams...');
//       console.log('Ending previous streams and creating new one...');
//       // First, get all active streams with retry
//       const getStreamsWithRetry = async () => {
//         const response = await fetch(`${BASE_URL}/api/v1/live/my-streams?page=1&limit=20`, {
//           method: 'GET',
//           headers: {
//             'Authorization': `Bearer ${token}`,
//             'Content-Type': 'application/json',
//           },
//         });
//         if (!response.ok) {
//           throw new Error(`HTTP ${response.status}: Failed to fetch streams`);
//         }
//         return await response.json();
//       };
//       const data = await retryWithBackoff(getStreamsWithRetry, 3, 1000);
//       if (data.success && data.data && data.data.streams && Array.isArray(data.data.streams)) {
//         // Find ALL streams that might conflict (not just WAITING/LIVE)
//         const activeStreams = data.data.streams.filter(stream =>
//           stream.status === 'WAITING' || stream.status === 'LIVE' || stream.status === 'CREATED'
//         );
//         console.log(`Found ${activeStreams.length} active streams to end`);
//         // End all active streams with error handling for each
//         const endPromises = activeStreams.map(async (stream) => {
//           try {
//             console.log('Ending stream:', stream.streamId, 'Status:', stream.status);
//             const endResponse = await fetch(`${BASE_URL}/api/v1/live/${stream.streamId}/end`, {
//               method: 'POST',
//               headers: {
//                 'Authorization': `Bearer ${token}`,
//                 'Content-Type': 'application/json',
//               },
//             });
//             const endData = await endResponse.json();
//             if (endResponse.ok && endData.success) {
//               console.log('Successfully ended stream:', stream.streamId);
//               return { success: true, streamId: stream.streamId };
//             } else {
//               console.log('Failed to end stream:', stream.streamId, endData.message);
//               return { success: false, streamId: stream.streamId, error: endData.message };
//             }
//           } catch (endError) {
//             console.error('Error ending stream:', stream.streamId, endError);
//             return { success: false, streamId: stream.streamId, error: endError.message };
//           }
//         });
//         // Wait for all end operations to complete
//         const endResults = await Promise.allSettled(endPromises);
//         console.log('End results:', endResults);
//       }
//       setCreationStatus('Waiting for cleanup...');
//       // Extended wait for backend cleanup - increased from 1s to 3s
//       await delay(3000);
//       setCreationStatus('Creating new stream...');
//       // Now try to create the new stream with retry logic
//       await createNewStreamWithRetry();
//     } catch (error) {
//       console.error('Error in handleEndPreviousAndCreateNew:', error);
//       setCreationStatus('');
//       Alert.alert('Error', 'Failed to end previous streams. Please try again.');
//       setCreating(false);
//     }
//   };
//   const createNewStreamWithRetry = async () => {
//     const createStreamAttempt = async () => {
//       console.log('Creating new stream with retry logic...');
//       // Create stream via API with simplified settings
//       const response = await fetch(`${BASE_URL}/api/v1/live/create`, {
//         method: 'POST',
//         headers: {
//           'Authorization': `Bearer ${token}`,
//           'Content-Type': 'application/json',
//         },
//         body: JSON.stringify({
//           title: streamTitle.trim(),
//           description: streamDescription.trim(),
//           isPublic: true,
//           allowComments: true,
//           maxViewers: 1000,
//           // Add a unique identifier to help prevent duplicates
//           clientTimestamp: Date.now(),
//         }),
//       });
//       const data = await response.json();
//       console.log('Create stream retry response:', data);
//       if (!response.ok || !data.success) {
//         // Check if it's the duplicate key error
//         if (data.message && (
//           data.message.includes('E11000 duplicate key error') ||
//           data.message.includes('duplicate') ||
//           data.message.includes('roomID')
//         )) {
//           throw new Error('DUPLICATE_KEY_ERROR');
//         }
//         throw new Error(data.message || 'Failed to create stream');
//       }
//       return data;
//     };
//     try {
//       // Retry stream creation with longer delays for duplicate key errors
//       const data = await retryWithBackoff(createStreamAttempt, 5, 2000);
//       const streamData = data.data.stream;
//       const rtcConfig = data.data.rtcConfig;
//       console.log('Stream created successfully with retry:', streamData.streamId);
//       // Close modal and navigate to broadcaster view
//       handleClose();
//       // Navigate to LiveStreamViewer in broadcaster mode
//       navigation.navigate('LiveStreamViewer', {
//         streamId: streamData.streamId,
//         streamData: streamData,
//         rtcConfig: rtcConfig,
//         isOwner: true,
//         mode: 'broadcaster'
//       });
//       if (onStreamStarted) {
//         onStreamStarted(streamData);
//       }
//       Alert.alert('Success', 'Previous stream ended and new stream created successfully!');
//     } catch (error) {
//       console.error('Error creating stream with retry:', error);
//       setCreationStatus('');
//       let errorMessage = 'Failed to create new stream. Please try again.';
//       if (error.message === 'DUPLICATE_KEY_ERROR') {
//         errorMessage = 'Database cleanup still in progress. Please wait a moment and try again.';
//       } else if (error.message.includes('HTTP')) {
//         errorMessage = 'Network error. Please check your connection.';
//       } else if (error.message) {
//         errorMessage = error.message;
//       }
//       Alert.alert('Error', errorMessage);
//     } finally {
//       setCreating(false);
//       setCreationStatus('');
//     }
//   };
//   const continueExistingStream = () => {
//     if (!existingStream) {
//       console.log('No existing stream to continue');
//       return;
//     }
//     console.log('Continuing existing stream:', existingStream.streamId);
//     // Close modal and navigate to existing stream
//     handleClose();
//     navigation.navigate('LiveStreamViewer', {
//       streamId: existingStream.streamId,
//       streamData: existingStream,
//       isOwner: true,
//       mode: 'broadcaster'
//     });
//     if (onStreamStarted) {
//       onStreamStarted(existingStream);
//     }
//   };
//   const createLiveStream = async () => {
//     if (!streamTitle.trim()) {
//       Alert.alert('Error', 'Please enter a stream title');
//       return;
//     }
//     // Check if there's an existing stream first
//     if (showExistingStreamOptions) {
//       Alert.alert(
//         'Active Stream Found',
//         'You already have an active stream. Please end it first or continue with the existing stream.',
//         [{ text: 'OK' }]
//       );
//       return;
//     }
//     try {
//       setCreating(true);
//       setCreationStatus('Checking permissions...');
//       // Request camera and microphone permissions
//       if (Platform.OS === 'android') {
//         const granted = await PermissionsAndroid.requestMultiple([
//           PermissionsAndroid.PERMISSIONS.CAMERA,
//           PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
//         ]);
//         const cameraGranted = granted[PermissionsAndroid.PERMISSIONS.CAMERA] === PermissionsAndroid.RESULTS.GRANTED;
//         const audioGranted = granted[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] === PermissionsAndroid.RESULTS.GRANTED;
//         if (!cameraGranted || !audioGranted) {
//           Alert.alert('Permissions Required', 'Camera and microphone permissions are required for live streaming');
//           return;
//         }
//       }
//       setCreationStatus('Creating live stream...');
//       console.log('Creating live stream...');
//       // Create stream via API with retry logic for initial creation
//       const createStreamAttempt = async () => {
//         const response = await fetch(`${BASE_URL}/api/v1/live/create`, {
//           method: 'POST',
//           headers: {
//             'Authorization': `Bearer ${token}`,
//             'Content-Type': 'application/json',
//           },
//           body: JSON.stringify({
//             title: streamTitle.trim(),
//             description: streamDescription.trim(),
//             isPublic: true,
//             allowComments: true,
//             maxViewers: 1000,
//             clientTimestamp: Date.now(),
//           }),
//         });
//         const data = await response.json();
//         console.log('Create stream response:', data);
//         if (!response.ok || !data.success) {
//           // Handle specific duplicate stream error
//           if (data.message && (
//             data.message.includes('E11000 duplicate key error') ||
//             data.message.includes('duplicate') ||
//             data.message.includes('STREAM_ALREADY_EXISTS') ||
//             data.message.includes('roomID')
//           )) {
//             throw new Error('DUPLICATE_STREAM_ERROR');
//           }
//           throw new Error(data.message || 'Failed to create stream');
//         }
//         return data;
//       };
//       const data = await retryWithBackoff(createStreamAttempt, 3, 1500);
//       const streamData = data.data.stream;
//       const rtcConfig = data.data.rtcConfig;
//       console.log('Stream created successfully:', streamData.streamId);
//       // Close modal and navigate to broadcaster view
//       handleClose();
//       // Navigate to LiveStreamViewer in broadcaster mode
//       navigation.navigate('LiveStreamViewer', {
//         streamId: streamData.streamId,
//         streamData: streamData,
//         rtcConfig: rtcConfig,
//         isOwner: true,
//         mode: 'broadcaster'
//       });
//       if (onStreamStarted) {
//         onStreamStarted(streamData);
//       }
//     } catch (error) {
//       console.error('Error creating live stream:', error);
//       setCreationStatus('');
//       let errorMessage = 'Failed to create live stream. Please try again.';
//       if (error.message === 'DUPLICATE_STREAM_ERROR') {
//         Alert.alert(
//           'Active Stream Detected',
//           'You have an active stream running. Would you like to end it and create a new one?',
//           [
//             { text: 'Cancel', style: 'cancel' },
//             {
//               text: 'End Previous & Create New',
//               onPress: async () => {
//                 await handleEndPreviousAndCreateNew();
//               }
//             }
//           ]
//         );
//         return;
//       } else if (error.message.includes('Network')) {
//         errorMessage = 'Network error. Please check your connection and try again.';
//       } else if (error.message.includes('401')) {
//         errorMessage = 'Session expired. Please log in again.';
//       } else if (error.message) {
//         errorMessage = error.message;
//       }
//       Alert.alert('Error', errorMessage);
//     } finally {
//       setCreating(false);
//       setCreationStatus('');
//     }
//   };
//   const resetForm = () => {
//     setStreamTitle('');
//     setStreamDescription('');
//     setTitleFocused(false);
//     setDescriptionFocused(false);
//     setExistingStream(null);
//     setShowExistingStreamOptions(false);
//     setCheckingExisting(false);
//     setCreating(false);
//     setCreationStatus('');
//   };
//   const handleClose = () => {
//     resetForm();
//     onClose();
//   };
//   // Render existing stream options
//   const renderExistingStreamOptions = () => {
//     if (!showExistingStreamOptions || !existingStream) return null;
//     return (
//       <View style={styles.existingStreamContainer}>
//         <View style={styles.warningHeader}>
//           <Text style={styles.warningIcon}>⚠️</Text>
//           <Text style={styles.warningTitle}>Active Stream Detected</Text>
//         </View>
//         <Text style={styles.warningText}>
//           You have an active stream: "{existingStream.title}"
//         </Text>
//         <View style={styles.streamStatusContainer}>
//           <Text style={styles.streamStatus}>
//             Status: <Text style={styles.streamStatusValue}>{existingStream.status}</Text>
//           </Text>
//           <Text style={styles.streamTime}>
//             Created: {new Date(existingStream.createdAt).toLocaleDateString()}
//           </Text>
//         </View>
//         <View style={styles.existingStreamActions}>
//           <TouchableOpacity
//             style={[styles.actionButton, styles.continueButton]}
//             onPress={continueExistingStream}
//             disabled={creating}
//           >
//             <Text style={styles.continueButtonText}>Continue Existing</Text>
//           </TouchableOpacity>
//           <TouchableOpacity
//             style={[styles.actionButton, styles.endButton]}
//             onPress={() => {
//               Alert.alert(
//                 'End Previous & Create New',
//                 'This will end your current stream and create a new one. Continue?',
//                 [
//                   { text: 'Cancel', style: 'cancel' },
//                   {
//                     text: 'Yes, Create New',
//                     onPress: async () => {
//                       setShowExistingStreamOptions(false);
//                       await handleEndPreviousAndCreateNew();
//                     }
//                   }
//                 ]
//               );
//             }}
//             disabled={creating}
//           >
//             {creating ? (
//               <ActivityIndicator size="small" color="white" />
//             ) : (
//               <Text style={styles.endButtonText}>End & Create New</Text>
//             )}
//           </TouchableOpacity>
//         </View>
//         <View style={styles.divider} />
//       </View>
//     );
//   };
//   return (
//     <Modal
//       visible={visible}
//       animationType="slide"
//       transparent={true}
//       onRequestClose={handleClose}
//     >
//       <View style={styles.modalOverlay}>
//         <View style={styles.modalContent}>
//           {/* Header */}
//           <View style={styles.modalHeader}>
//             <Text style={styles.modalTitle}>Go Live</Text>
//             {/* Replace the close button in modalHeader */}
//             <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
//               <Icon name="close" size={28} color="#666" />
//             </TouchableOpacity>
//           </View>
//           {/* Scrollable Content */}
//           <ScrollView
//             style={styles.modalBody}
//             showsVerticalScrollIndicator={false}
//             contentContainerStyle={styles.scrollContent}
//           >
//             {/* Loading State for Checking Existing Streams */}
//             {checkingExisting && (
//               <View style={styles.loadingContainer}>
//                 <ActivityIndicator size="small" color="#ff0000" />
//                 <Text style={styles.loadingText}>Checking existing streams...</Text>
//               </View>
//             )}
//             {/* Creation Status */}
//             {creating && creationStatus && (
//               <View style={styles.loadingContainer}>
//                 <ActivityIndicator size="small" color="#ff0000" />
//                 <Text style={styles.loadingText}>{creationStatus}</Text>
//               </View>
//             )}
//             {/* Existing Stream Options */}
//             {renderExistingStreamOptions()}
//             {/* Stream Title */}
//             <View style={styles.inputGroup}>
//               <Text style={styles.inputLabel}>Stream Title *</Text>
//               <TextInput
//                 style={[
//                   styles.textInput,
//                   titleFocused && styles.textInputFocused,
//                   showExistingStreamOptions && styles.textInputDisabled
//                 ]}
//                 placeholder="What's your stream about?"
//                 placeholderTextColor="#888888"
//                 value={streamTitle}
//                 onChangeText={setStreamTitle}
//                 maxLength={100}
//                 autoCapitalize="sentences"
//                 returnKeyType="next"
//                 blurOnSubmit={false}
//                 onFocus={() => setTitleFocused(true)}
//                 onBlur={() => setTitleFocused(false)}
//                 editable={!showExistingStreamOptions}
//                 onSubmitEditing={() => {
//                   // Focus on description field
//                 }}
//               />
//               <Text style={styles.characterCount}>
//                 {streamTitle.length}/100
//               </Text>
//             </View>
//             {/* Stream Description */}
//             <View style={styles.inputGroup}>
//               <Text style={styles.inputLabel}>Description (Optional)</Text>
//               <TextInput
//                 style={[
//                   styles.textInput,
//                   styles.multilineInput,
//                   descriptionFocused && styles.textInputFocused,
//                   showExistingStreamOptions && styles.textInputDisabled
//                 ]}
//                 placeholder="Tell viewers more about your stream..."
//                 placeholderTextColor="#888888"
//                 value={streamDescription}
//                 onChangeText={setStreamDescription}
//                 multiline={true}
//                 numberOfLines={4}
//                 maxLength={500}
//                 autoCapitalize="sentences"
//                 returnKeyType="done"
//                 textAlignVertical="top"
//                 onFocus={() => setDescriptionFocused(true)}
//                 onBlur={() => setDescriptionFocused(false)}
//                 editable={!showExistingStreamOptions}
//               />
//               <Text style={styles.characterCount}>
//                 {streamDescription.length}/500
//               </Text>
//             </View>
//           </ScrollView>
//           {/* Fixed Create Button */}
//           <TouchableOpacity
//             style={[
//               styles.createButton,
//               (creating || showExistingStreamOptions) && styles.createButtonDisabled
//             ]}
//             onPress={createLiveStream}
//             disabled={creating || showExistingStreamOptions}
//           >
//             {creating ? (
//               <View style={styles.createButtonLoading}>
//                 <ActivityIndicator size="small" color="white" />
//                 {creationStatus && (
//                   <Text style={styles.createButtonLoadingText}>{creationStatus}</Text>
//                 )}
//               </View>
//             ) : (
//               <Text style={styles.createButtonText}>
//                 {showExistingStreamOptions ? '⚠️ Handle Existing Stream First' : '🔴 Start Live Stream'}
//               </Text>
//             )}
//           </TouchableOpacity>
//         </View>
//       </View>
//     </Modal>
//   );
// };
// // Import WebRTC components
// import {
//   RTCPeerConnection,
//   RTCIceCandidate,
//   RTCSessionDescription,
//   RTCView,
//   MediaStream,
//   MediaStreamTrack,
//   mediaDevices,
//   registerGlobals
// } from 'react-native-webrtc';
// // Register WebRTC globals
// registerGlobals();
// // LiveStreamViewer Component - For viewing and broadcasting streams
// export const LiveStreamViewer = ({ route, navigation }) => {
//   const { streamId, streamData: initialStreamData, isOwner, mode = 'viewer' } = route.params;
//   const { user, token } = useAuth();
//   const { socket, isConnected } = useSocket();
//   // Stream state
//   const [streamData, setStreamData] = useState(initialStreamData);
//   const [loading, setLoading] = useState(true);
//   const [isLive, setIsLive] = useState(false);
//   const [viewerCount, setViewerCount] = useState(0);
//   const [streamStatus, setStreamStatus] = useState('WAITING');
//   // WebRTC state
//   const [localStream, setLocalStream] = useState(null);
//   const [remoteStream, setRemoteStream] = useState(null);
//   const [peerConnection, setPeerConnection] = useState(null);
//   const [rtcConfig, setRtcConfig] = useState(null);
//   const [cameraEnabled, setCameraEnabled] = useState(true);
//   const [micEnabled, setMicEnabled] = useState(true);
//   const [frontCamera, setFrontCamera] = useState(true);
//   // Chat state
//   const [chatMessages, setChatMessages] = useState([]);
//   const [messageText, setMessageText] = useState('');
//   const [showChat, setShowChat] = useState(false);
//   // Reactions state
//   const [reactions, setReactions] = useState([]);
//   const reactionAnimations = useRef([]).current;
//   // Refs
//   const localVideoRef = useRef(null);
//   const remoteVideoRef = useRef(null);
//   // State variables for WebRTC (Broadcaster)
//   const [peerConnections, setPeerConnections] = useState({}); // For broadcaster to manage multiple viewers
//   const [iceCandidatesQueue, setIceCandidatesQueue] = useState([]); // Viewer's queue

//   useEffect(() => {
//     initializeStream();
//     const cleanupListeners = setupSocketListeners(); // Get cleanup function
//     return () => {
//       cleanupListeners(); // Cleanup socket listeners on unmount
//       cleanup(); // Cleanup streams and connections
//     };
//   }, []); // Empty dependency array ensures this runs only once on mount

//   const initializeStream = async () => {
//     try {
//       setLoading(true);
//       // Get stream details
//       if (!initialStreamData) {
//         await fetchStreamDetails();
//       }
//       // Get WebRTC configuration
//       await fetchRTCConfig();
//       if (isOwner && mode === 'broadcaster') {
//         await initializeBroadcaster();
//       } else {
//         await initializeViewer();
//       }
//     } catch (error) {
//       console.error('Error initializing stream:', error);
//       Alert.alert('Error', 'Failed to initialize stream');
//     } finally {
//       setLoading(false);
//     }
//   };

//   const fetchStreamDetails = async () => {
//     try {
//       const response = await fetch(`${BASE_URL}/api/v1/live/${streamId}/details`, {
//         headers: {
//           'Authorization': `Bearer ${token}`,
//         },
//       });
//       const data = await response.json();
//       if (data.success) {
//         setStreamData(data.data.stream);
//         setViewerCount(data.data.stream.viewers?.length || 0);
//         setStreamStatus(data.data.stream.status);
//       }
//     } catch (error) {
//       console.error('Error fetching stream details:', error);
//     }
//   };

//   const fetchRTCConfig = async () => {
//     try {
//       const response = await fetch(`${BASE_URL}/api/v1/live/${streamId}/rtc-config`, {
//         headers: {
//           'Authorization': `Bearer ${token}`,
//         },
//       });
//       const data = await response.json();
//       if (data.success) {
//         setRtcConfig(data.data.rtcConfig);
//       }
//     } catch (error) {
//       console.error('Error fetching RTC config:', error);
//     }
//   };

//   const initializeBroadcaster = async () => {
//     try {
//       console.log('Initializing broadcaster mode...');
//       // Get camera and microphone stream
//       await getCameraStream();
//       // Setup WebRTC peer connection
//       await setupPeerConnection();
//       // Join socket room as broadcaster
//       if (socket && isConnected) {
//         socket.emit('join_live_stream', {
//           streamId,
//           role: 'broadcaster'
//         });
//       }
//       // Auto-start the stream
//       await startStream();
//     } catch (error) {
//       console.error('Error initializing broadcaster:', error);
//       Alert.alert('Error', 'Failed to start broadcasting: ' + error.message);
//     }
//   };

//   const getCameraStream = async () => {
//     try {
//       console.log('Getting camera stream...');
//       // Check available devices
//       const devices = await mediaDevices.enumerateDevices();
//       console.log('Available devices:', devices);
//       // Get user media with camera and microphone
//       const constraints = {
//         audio: true,
//         video: {
//           mandatory: {
//             minWidth: 640,
//             minHeight: 480,
//             minFrameRate: 30,
//           },
//           facingMode: frontCamera ? 'user' : 'environment',
//           optional: [
//             { minFrameRate: 60 },
//             { minWidth: 1280 },
//             { minHeight: 720 }
//           ],
//         },
//       };
//       const stream = await mediaDevices.getUserMedia(constraints);
//       console.log('Got local stream:', stream.toURL());
//       setLocalStream(stream);
//       return stream;
//     } catch (error) {
//       console.error('Error getting camera stream:', error);
//       let errorMessage = 'Failed to access camera';
//       if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
//         errorMessage = 'Camera permission denied. Please enable camera access in settings.';
//       } else if (error.name === 'NotFoundError') {
//         errorMessage = 'No camera found on this device.';
//       } else if (error.name === 'NotReadableError') {
//         errorMessage = 'Camera is already in use by another app.';
//       }
//       Alert.alert('Camera Error', errorMessage);
//       throw error;
//     }
//   };

//   // Replace the setupSocketListeners function:
//   const setupSocketListeners = () => {
//     if (!socket || !isConnected) return () => {}; // Return empty cleanup if no socket

//     console.log('Setting up socket listeners for stream:', streamId);

//     // Listen for stream events
//     const handleJoinedStream = (data) => {
//         console.log('Joined live stream:', data);
//         setViewerCount(data.viewersCount || 0);
//     };
//     const handleViewerJoined = async (data) => {
//         console.log('Viewer joined:', data);
//         setViewerCount(data.viewersCount || 0);
//         // If we're the broadcaster, create offer for new viewer when stream is live
//         if (isOwner && mode === 'broadcaster' && isLive && data.newViewer) {
//           const viewerId = data.newViewer._id;
//           console.log('New viewer detected, creating offer for:', viewerId);
//           // Wait a bit for viewer to be ready - important!
//           setTimeout(() => {
//             createOfferForViewer(viewerId);
//           }, 1500);
//         }
//     };
//     const handleViewerLeft = (data) => {
//         console.log('Viewer left:', data);
//         setViewerCount(data.viewersCount || 0);
//     };
//     const handleStreamStatusUpdate = (data) => {
//         console.log('Stream status updated:', data);
//         setStreamStatus(data.status);
//         setIsLive(data.status === 'LIVE');
//         if (data.status === 'ENDED') {
//           Alert.alert('Stream Ended', 'The stream has ended', [
//             { text: 'OK', onPress: () => navigation.goBack() }
//           ]);
//         }
//     };
//     const handleChatMessage = (data) => {
//         setChatMessages(prev => [...prev, data]);
//     };
//     const handleReaction = (data) => {
//         // Add reaction to display
//         const reactionId = Date.now() + Math.random();
//         const newReaction = {
//           id: reactionId,
//           emoji: data.reaction,
//           intensity: data.intensity,
//           user: data.user.fullName || data.user.username,
//         };
//         setReactions(prev => [...prev, newReaction]);
//         // Remove reaction after animation
//         setTimeout(() => {
//           setReactions(prev => prev.filter(r => r.id !== reactionId));
//         }, 3000);
//     };
//     // IMPORTANT: Listen for the correct WebRTC signal event
//     const handleWebRTCSignal = async (data) => {
//         console.log('WebRTC signal received:', data.type, 'from:', data.fromRole);
//         try {
//           switch (data.type) {
//             case 'offer':
//               if (!isOwner && mode === 'viewer') {
//                 await handleOffer(data);
//               }
//               break;
//             case 'answer':
//               if (isOwner && mode === 'broadcaster') {
//                 await handleAnswer(data);
//               }
//               break;
//             case 'ice-candidate':
//               await handleIceCandidate(data);
//               break;
//             case 'viewer-ready':
//               if (isOwner && mode === 'broadcaster') {
//                 console.log('Viewer ready, creating offer for:', data.from);
//                 await createOfferForViewer(data.from); // Use await here
//               }
//               break;
//             default:
//               console.warn('Unknown signal type:', data.type);
//           }
//         } catch (error) {
//           console.error('Error handling WebRTC signal:', error);
//         }
//     };

//     socket.on('joined_live_stream', handleJoinedStream);
//     socket.on('viewer_joined_stream', handleViewerJoined);
//     socket.on('viewer_left_stream', handleViewerLeft);
//     socket.on('stream_status_updated', handleStreamStatusUpdate);
//     socket.on('live_stream_chat_message', handleChatMessage);
//     socket.on('live_stream_reaction', handleReaction);
//     socket.on('stream_webrtc_signal', handleWebRTCSignal);

//     // Return a cleanup function
//     return () => {
//       socket.off('joined_live_stream', handleJoinedStream);
//       socket.off('viewer_joined_stream', handleViewerJoined);
//       socket.off('viewer_left_stream', handleViewerLeft);
//       socket.off('stream_status_updated', handleStreamStatusUpdate);
//       socket.off('live_stream_chat_message', handleChatMessage);
//       socket.off('live_stream_reaction', handleReaction);
//       socket.off('stream_webrtc_signal', handleWebRTCSignal);
//     };
//   };

//   // Updated handleOffer function:
//   const handleOffer = async (data) => {
//     console.log('Handling offer from broadcaster');
//     try {
//       if (!peerConnection) {
//         await setupPeerConnection();
//       }
//       // Set remote description
//       await peerConnection.setRemoteDescription(
//         new RTCSessionDescription(data.data)
//       );
//       // Create answer
//       const answer = await peerConnection.createAnswer();
//       await peerConnection.setLocalDescription(answer);
//       // Send answer back through unified signal
//       socket.emit('stream_webrtc_signal', {
//         streamId,
//         type: 'answer',
//         data: answer,
//         targetRole: 'broadcaster'
//       });
//       console.log('Answer sent to broadcaster');

//       // Process queued ICE candidates after setting local description
//       if (iceCandidatesQueue.length > 0) {
//         console.log(`Processing ${iceCandidatesQueue.length} queued ICE candidates`);
//         for (const candidateData of iceCandidatesQueue) {
//           try {
//             const candidate = new RTCIceCandidate(candidateData);
//             await peerConnection.addIceCandidate(candidate);
//             console.log("Added queued ICE candidate");
//           } catch (e) {
//             console.error("Error adding queued ICE candidate:", e);
//           }
//         }
//         setIceCandidatesQueue([]); // Clear queue after processing
//       }
//     } catch (error) {
//       console.error('Error handling offer:', error);
//     }
//   };

//   // Updated handleAnswer function:
//   const handleAnswer = async (data) => {
//     console.log('Handling answer from viewer:', data.from);
//     try {
//       // Use the specific viewer's peer connection if available, otherwise fallback
//       const pc = peerConnections[data.from] || peerConnection;
//       if (pc) {
//         await pc.setRemoteDescription(
//           new RTCSessionDescription(data.data)
//         );
//         console.log('Answer set successfully for viewer:', data.from);

//         // Optional: Check connection state after setting answer
//         // if (pc.connectionState === 'connected') {
//         //   console.log("Viewer connection established immediately after answer!");
//         // }

//       } else {
//         console.warn("No peer connection found for viewer:", data.from);
//       }
//     } catch (error) {
//       console.error('Error handling answer:', error);
//     }
//   };

//   // Updated handleIceCandidate function:
//   const handleIceCandidate = async (data) => {
//     console.log('Handling ICE candidate from:', data.fromRole);
//     try {
//       const candidate = data.data?.candidate || data.data;
//       if (isOwner && mode === 'broadcaster') {
//         // Handle ICE from viewer (Broadcaster side)
//         const pc = peerConnections[data.from] || peerConnection;
//         if (pc && pc.remoteDescription && candidate) {
//           await pc.addIceCandidate(new RTCIceCandidate(candidate));
//           console.log("Added ICE candidate from viewer:", data.from);
//         } else {
//             console.warn("Could not add ICE candidate for viewer (no PC or remote desc not set yet)", data.from);
//             // Optionally, queue if needed, but usually not for broadcaster
//         }
//       } else if (!isOwner && peerConnection) {
//         // Handle ICE from broadcaster (Viewer side)
//         if (peerConnection.remoteDescription && peerConnection.remoteDescription.type) {
//           // Remote description is set, try adding immediately
//           await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
//           console.log("Added ICE candidate from broadcaster");
//         } else {
//           // Queue it if remote description is not ready yet
//           console.log("Queueing ICE candidate, remote description not set yet.");
//           setIceCandidatesQueue(prev => [...prev, candidate]);
//         }
//       }
//     } catch (error) {
//       console.error('Error adding ICE candidate:', error);
//     }
//   };

//   const toggleCamera = () => {
//     if (localStream) {
//       const videoTrack = localStream.getVideoTracks()[0];
//       if (videoTrack) {
//         videoTrack.enabled = !videoTrack.enabled;
//         setCameraEnabled(videoTrack.enabled);
//       }
//     }
//   };

//   const toggleMicrophone = () => {
//     if (localStream) {
//       const audioTrack = localStream.getAudioTracks()[0];
//       if (audioTrack) {
//         audioTrack.enabled = !audioTrack.enabled;
//         setMicEnabled(audioTrack.enabled);
//       }
//     }
//   };

//   const switchCamera = async () => {
//     try {
//       if (!localStream) return;
//       const newFrontCamera = !frontCamera;
//       // Stop current stream completely
//       localStream.getTracks().forEach(track => {
//         track.stop();
//       });
//       // Get new stream with opposite camera
//       const constraints = {
//         audio: true, // Include audio to maintain consistency
//         video: {
//           mandatory: {
//             minWidth: 640,
//             minHeight: 480,
//             minFrameRate: 30,
//           },
//           facingMode: newFrontCamera ? 'user' : 'environment',
//           optional: [
//             { minFrameRate: 60 },
//             { minWidth: 1280 },
//             { minHeight: 720 }
//           ],
//         },
//       };
//       const newStream = await mediaDevices.getUserMedia(constraints);
//       // Update peer connection with new stream
//       if (peerConnection) {
//         // Remove old tracks
//         peerConnection.getSenders().forEach(sender => {
//           if (sender.track) {
//             peerConnection.removeTrack(sender);
//           }
//         });
//         // Add new tracks
//         newStream.getTracks().forEach(track => {
//           peerConnection.addTrack(track, newStream);
//         });
//       }
//       // Update state
//       setLocalStream(newStream);
//       setFrontCamera(newFrontCamera);
//       console.log('Camera switched successfully');
//     } catch (error) {
//       console.error('Error switching camera:', error);
//       Alert.alert('Error', 'Failed to switch camera. Please try again.');
//       // Attempt to restore original stream if switching failed
//       try {
//         const fallbackStream = await getCameraStream();
//         setLocalStream(fallbackStream);
//       } catch (fallbackError) {
//         console.error('Failed to restore camera stream:', fallbackError);
//       }
//     }
//   };

//   // Updated handleViewerJoined for broadcaster:
//   const handleViewerJoined = async (data) => {
//     console.log('Viewer joined:', data);
//     setViewerCount(data.viewersCount || 0);
//     // If we're the broadcaster, create offer for new viewer when stream is live
//     if (isOwner && mode === 'broadcaster' && isLive && data.newViewer) {
//       const viewerId = data.newViewer._id;
//       console.log('New viewer detected, creating offer for:', viewerId);
//       // Wait a bit for viewer to be ready - important!
//       setTimeout(() => {
//         createOfferForViewer(viewerId);
//       }, 1500);
//     }
//   };

//   // Updated createOfferForViewer function:
//   const createOfferForViewer = async (viewerId) => {
//     try {
//       console.log('Creating offer for viewer:', viewerId);

//       // Check if we already have a peer connection for this viewer
//       if (peerConnections[viewerId]) {
//         console.warn("Peer connection already exists for viewer:", viewerId);
//         // Optionally, close the old one and create a new one
//         // peerConnections[viewerId].close();
//         // setPeerConnections(prev => {
//         //   const newConnections = { ...prev };
//         //   delete newConnections[viewerId];
//         //   return newConnections;
//         // });
//         // Or just return if we don't want to recreate
//         // return;
//       }

//       // Create a new peer connection for this viewer
//       const pcConfig = {
//         iceServers: [
//           { urls: 'stun:stun.l.google.com:19302' },
//           { urls: 'stun:stun1.l.google.com:19302' },
//           ...(rtcConfig?.iceServers || [])
//         ],
//       };

//       const pc = new RTCPeerConnection(pcConfig);

//       // Add local stream to this new peer connection
//       if (localStream) {
//         localStream.getTracks().forEach(track => {
//           pc.addTrack(track, localStream);
//         });
//       }

//       // Handle ICE candidates for this connection
//       pc.onicecandidate = (event) => {
//         if (event.candidate) {
//           socket.emit('stream_webrtc_signal', {
//             streamId,
//             type: 'ice-candidate',
//             data: { candidate: event.candidate },
//             targetUserId: viewerId // Target specific viewer
//           });
//         }
//       };

//       // Monitor connection state for this viewer
//       pc.onconnectionstatechange = () => {
//         console.log(`Connection with viewer ${viewerId}:`, pc.connectionState);
//         if (pc.connectionState === 'connected') {
//           console.log('✅ Connected to viewer:', viewerId);
//           // Optional: Update UI or state to reflect connection
//         } else if (pc.connectionState === 'failed') {
//           console.error('❌ Connection failed with viewer:', viewerId);
//           // Optional: Handle failure, e.g., retry or notify
//         }
//       };

//       // Store this connection
//       setPeerConnections(prev => ({
//         ...prev,
//         [viewerId]: pc
//       }));

//       // Create and send offer
//       const offer = await pc.createOffer();
//       await pc.setLocalDescription(offer);

//       socket.emit('stream_webrtc_signal', {
//         streamId,
//         type: 'offer',
//         data: offer,
//         targetUserId: viewerId // Target specific viewer
//       });

//       console.log('Offer sent to viewer:', viewerId);

//     } catch (error) {
//       console.error('Error creating offer for viewer:', viewerId, error);
//     }
//   };

//   // Updated initializeViewer function:
//   const initializeViewer = async () => {
//     try {
//       console.log('Initializing viewer mode...');
//       // Setup peer connection first
//       await setupPeerConnection();
//       // Join stream as viewer
//       const response = await fetch(`${BASE_URL}/api/v1/live/${streamId}/join`, {
//         method: 'POST',
//         headers: {
//           'Authorization': `Bearer ${token}`,
//           'Content-Type': 'application/json',
//         },
//       });
//       const data = await response.json();
//       if (data.success) {
//         setViewerCount(data.data.stream?.viewerCount || 0);
//         // Join socket room as viewer with proper data
//         if (socket && isConnected) {
//           socket.emit('join_live_stream', {
//             streamId,
//             role: 'viewer'
//           });
//           // Wait for room join confirmation then signal ready
//           setTimeout(() => {
//             if (socket && isConnected) { // Double-check connection before emitting
//                 console.log('Signaling viewer ready to broadcaster');
//                 socket.emit('stream_webrtc_signal', {
//                   streamId,
//                   type: 'viewer-ready',
//                   targetRole: 'broadcaster'
//                 });
//             } else {
//                 console.warn("Socket not connected when trying to signal viewer-ready");
//             }
//           }, 1500); // Delay is often necessary to ensure broadcaster is listening
//         }
//       }
//     } catch (error) {
//       console.error('Error joining stream:', error);
//       Alert.alert('Error', 'Failed to join stream');
//     }
//   };

//   // Updated setupPeerConnection:
//   const setupPeerConnection = async () => {
//     try {
//       console.log('Setting up peer connection...');

//       const pcConfig = {
//         iceServers: [
//           { urls: 'stun:stun.l.google.com:19302' },
//           { urls: 'stun:stun1.l.google.com:19302' },
//           ...(rtcConfig?.iceServers || [])
//         ],
//         iceCandidatePoolSize: 10, // Optional: Pre-gather ICE candidates
//       };

//       const pc = new RTCPeerConnection(pcConfig);

//       // For broadcaster: add local stream (if applicable)
//       if (isOwner && localStream) {
//         console.log('Adding local stream tracks');
//         localStream.getTracks().forEach(track => {
//           pc.addTrack(track, localStream);
//         });
//       }

//       // Handle ICE candidates
//       pc.onicecandidate = (event) => {
//         if (event.candidate && socket && isConnected) {
//           console.log('Sending ICE candidate');
//           socket.emit('stream_webrtc_signal', {
//             streamId,
//             type: 'ice-candidate',
//             data: { candidate: event.candidate },
//             targetRole: isOwner ? 'viewer' : 'broadcaster'
//           });
//         }
//       };

//       // Handle remote stream (for viewers)
//       pc.onaddstream = (event) => {
//         console.log('🎉 REMOTE STREAM RECEIVED!');
//         setRemoteStream(event.stream);
//         setStreamStatus('LIVE');
//         setIsLive(true);
//       };

//       pc.ontrack = (event) => {
//         console.log('🎉 REMOTE TRACK RECEIVED!');
//         if (event.streams && event.streams[0]) {
//           setRemoteStream(event.streams[0]);
//           setStreamStatus('LIVE');
//           setIsLive(true);
//         }
//       };

//       // Monitor connection state
//       pc.onconnectionstatechange = () => {
//         console.log('Connection state:', pc.connectionState);
//         if (pc.connectionState === 'connected') {
//           console.log('✅ Peer connection established!');
//           setStreamStatus('LIVE');
//           setIsLive(true);
//         } else if (pc.connectionState === 'failed') {
//           console.error('❌ Connection failed');
//           // Optional: Try to recover or notify user
//           // if (pc.restartIce) {
//           //   pc.restartIce();
//           // }
//         }
//       };

//       // Add iceconnectionstatechange listener for more granular control
//       pc.oniceconnectionstatechange = () => {
//           console.log('ICE Connection state:', pc.iceConnectionState);
//           if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
//               console.log("✅ ICE connection established!");
//               setStreamStatus('LIVE');
//               setIsLive(true);
//           } else if (pc.iceConnectionState === 'failed') {
//               console.error("❌ ICE connection failed!");
//               // Optional: Handle failure
//           }
//       };

//       setPeerConnection(pc);
//       return pc;
//     } catch (error) {
//       console.error('Error setting up peer connection:', error);
//       throw error;
//     }
//   };

//   const startStream = async () => {
//     try {
//       const response = await fetch(`${BASE_URL}/api/v1/live/${streamId}/start`, {
//         method: 'POST',
//         headers: {
//           'Authorization': `Bearer ${token}`,
//           'Content-Type': 'application/json',
//         },
//       });
//       const data = await response.json();
//       if (data.success) {
//         setIsLive(true);
//         setStreamStatus('LIVE');
//         console.log('Stream started successfully');
//       }
//     } catch (error) {
//       console.error('Error starting stream:', error);
//       Alert.alert('Error', 'Failed to start stream');
//     }
//   };

//   const endStream = async () => {
//     try {
//       const response = await fetch(`${BASE_URL}/api/v1/live/${streamId}/end`, {
//         method: 'POST',
//         headers: {
//           'Authorization': `Bearer ${token}`,
//           'Content-Type': 'application/json',
//         },
//       });
//       const data = await response.json();
//       if (data.success) {
//         setIsLive(false);
//         setStreamStatus('ENDED');
//         console.log('Stream ended successfully');
//         // Navigate back
//         navigation.goBack();
//       }
//     } catch (error) {
//       console.error('Error ending stream:', error);
//       Alert.alert('Error', 'Failed to end stream');
//     }
//   };

//   const leaveStream = async () => {
//     try {
//       await fetch(`${BASE_URL}/api/v1/live/${streamId}/leave`, {
//         method: 'POST',
//         headers: {
//           'Authorization': `Bearer ${token}`,
//           'Content-Type': 'application/json',
//         },
//       });
//       navigation.goBack();
//     } catch (error) {
//       console.error('Error leaving stream:', error);
//       navigation.goBack();
//     }
//   };


//   const sendChatMessage = () => {
//     if (!messageText.trim() || !socket || !isConnected) return;
//     socket.emit('live_stream_chat', {
//       streamId,
//       message: messageText.trim(),
//       messageType: 'text'
//     });
//     setMessageText('');
//   };

//   const sendReaction = (emoji, intensity = 3) => {
//     if (!socket || !isConnected) return;
//     socket.emit('live_stream_reaction', {
//       streamId,
//       reaction: emoji,
//       intensity
//     });
//   };

//   const cleanup = () => {
//     console.log('Cleaning up streams and connections...');
//     // Clean up WebRTC connections
//     if (peerConnection) {
//       peerConnection.close();
//       setPeerConnection(null);
//     }
//     // Clean up multiple peer connections (broadcaster)
//     Object.values(peerConnections).forEach(pc => {
//         if (pc) {
//             pc.close();
//             console.log("Closed peer connection for viewer");
//         }
//     });
//     setPeerConnections({});

//     // Stop local stream tracks
//     if (localStream) {
//       localStream.getTracks().forEach(track => {
//         track.stop();
//         console.log('Stopped track:', track.kind);
//       });
//       setLocalStream(null);
//     }

//     // Stop remote stream tracks
//     if (remoteStream) {
//       remoteStream.getTracks().forEach(track => {
//         track.stop();
//       });
//       setRemoteStream(null);
//     }

//     // Leave stream if viewer
//     if (!isOwner) {
//       leaveStream();
//     }
//   };

//   const renderStreamControls = () => {
//     if (!isOwner) return null;
//     return (
//       <View style={styles.streamControls}>
//         {/* Camera toggle */}
//         <TouchableOpacity
//           style={[styles.controlButton, !cameraEnabled && styles.controlButtonDisabled]}
//           onPress={toggleCamera}
//         >
//           <Icon
//             name={cameraEnabled ? "videocam" : "videocam-off"}
//             size={24}
//             color={cameraEnabled ? "white" : "#ff4444"}
//           />
//         </TouchableOpacity>
//         {/* Microphone toggle */}
//         <TouchableOpacity
//           style={[styles.controlButton, !micEnabled && styles.controlButtonDisabled]}
//           onPress={toggleMicrophone}
//         >
//           <Icon
//             name={micEnabled ? "mic" : "mic-off"}
//             size={24}
//             color={micEnabled ? "white" : "#ff4444"}
//           />
//         </TouchableOpacity>
//         {/* Camera switch */}
//         {/* <TouchableOpacity
//           style={styles.controlButton}
//           onPress={switchCamera}
//         >
//           <MaterialCommunityIcons
//             name="camera-switch"
//             size={24}
//             color="white"
//           />
//         </TouchableOpacity> */}
//         {/* Chat toggle */}
//         <TouchableOpacity
//           style={styles.controlButton}
//           onPress={() => setShowChat(!showChat)}
//         >
//           <MaterialCommunityIcons
//             name="chat"
//             size={24}
//             color="white"
//           />
//         </TouchableOpacity>
//         {/* End stream */}
//         <TouchableOpacity
//           style={[styles.controlButton, styles.endStreamButton]}
//           onPress={() => {
//             Alert.alert(
//               'End Stream',
//               'Are you sure you want to end this stream?',
//               [
//                 { text: 'Cancel', style: 'cancel' },
//                 { text: 'End Stream', onPress: endStream, style: 'destructive' }
//               ]
//             );
//           }}
//         >
//           <View style={styles.endStreamButtonContent}>
//             <MaterialCommunityIcons name="stop" size={20} color="white" />
//             <Text style={styles.endStreamButtonText}>End</Text>
//           </View>
//         </TouchableOpacity>
//       </View>
//     );
//   };

//   const renderViewerControls = () => {
//     if (isOwner) return null;
//     return (
//       <View style={styles.viewerControls}>
//         <TouchableOpacity
//           style={styles.controlButton}
//           onPress={() => setShowChat(!showChat)}
//         >
//           <MaterialCommunityIcons
//             name="chat"
//             size={24}
//             color="white"
//           />
//         </TouchableOpacity>
//         <TouchableOpacity
//           style={styles.controlButton}
//           onPress={() => sendReaction('❤️')}
//         >
//           <MaterialCommunityIcons
//             name="heart"
//             size={24}
//             color="#ff4444"
//           />
//         </TouchableOpacity>
//         <TouchableOpacity
//           style={styles.controlButton}
//           onPress={() => sendReaction('👏')}
//         >
//           <MaterialCommunityIcons
//             name="hand-clap"
//             size={24}
//             color="white"
//           />
//         </TouchableOpacity>
//         <TouchableOpacity
//           style={styles.controlButton}
//           onPress={() => sendReaction('🔥')}
//         >
//           <MaterialCommunityIcons
//             name="fire"
//             size={24}
//             color="#ff6600"
//           />
//         </TouchableOpacity>
//       </View>
//     );
//   };

//   const renderChat = () => {
//     if (!showChat) return null;
//     return (
//       <View style={styles.chatContainer}>
//         <View style={styles.chatHeader}>
//           <Text style={styles.chatTitle}>Live Chat</Text>
//           <TouchableOpacity onPress={() => setShowChat(false)}>
//             <Text style={styles.chatCloseButton}>×</Text>
//           </TouchableOpacity>
//         </View>
//         <FlatList
//           data={chatMessages}
//           keyExtractor={(item, index) => `${item.id || index}`}
//           renderItem={({ item }) => (
//             <View style={styles.chatMessage}>
//               <Text style={styles.chatUsername}>
//                 {item.user?.fullName || item.user?.username || 'Anonymous'}:
//               </Text>
//               <Text style={styles.chatText}> {item.message}</Text>
//             </View>
//           )}
//           style={styles.chatMessages}
//           inverted
//         />
//         {streamData?.settings?.allowComments && (
//           <View style={styles.chatInput}>
//             <TextInput
//               style={styles.chatTextInput}
//               placeholder="Type a message..."
//               placeholderTextColor="#666"
//               value={messageText}
//               onChangeText={setMessageText}
//               onSubmitEditing={sendChatMessage}
//               returnKeyType="send"
//             />
//             <TouchableOpacity
//               style={styles.chatSendButton}
//               onPress={sendChatMessage}
//             >
//               <Text style={styles.chatSendButtonText}>Send</Text>
//             </TouchableOpacity>
//           </View>
//         )}
//       </View>
//     );
//   };

//   const renderReactions = () => {
//     return (
//       <View style={styles.reactionsContainer}>
//         {reactions.map((reaction) => (
//           <Animated.View
//             key={reaction.id}
//             style={[
//               styles.reactionBubble,
//               {
//                 transform: [{
//                   translateY: new Animated.Value(0)
//                 }]
//               }
//             ]}
//           >
//             <Text style={styles.reactionEmoji}>{reaction.emoji}</Text>
//           </Animated.View>
//         ))}
//       </View>
//     );
//   };

//   if (loading) {
//     return (
//       <View style={styles.loadingContainer}>
//         <ActivityIndicator size="large" color="#ed167e" />
//         <Text style={styles.loadingText}>Loading stream...</Text>
//       </View>
//     );
//   }

//   return (
//     <View style={styles.container}>
//       {/* Header */}
//       <View style={styles.header}>
//         {/* Replace the back button in header */}
//         <TouchableOpacity
//           style={styles.backButton}
//           onPress={() => navigation.goBack()}
//         >
//           <Icon name="arrow-back" size={24} color="white" />
//         </TouchableOpacity>
//         <View style={styles.headerInfo}>
//           <Text style={styles.streamTitle} numberOfLines={1}>
//             {streamData?.title || 'Live Stream'}
//           </Text>
//           <View style={styles.streamStats}>
//             <View style={styles.liveIndicator}>
//               <View style={styles.liveIcon} />
//               <Text style={styles.liveText}>LIVE</Text>
//             </View>
//             <Text style={styles.viewerCount}>{viewerCount} viewers</Text>
//           </View>
//         </View>
//       </View>
//       {/* Video Container */}
//       <View style={styles.videoContainer}>
//         {/* Local video stream for broadcaster */}
//         {isOwner && localStream && (
//           <RTCView
//             streamURL={localStream.toURL()}
//             style={styles.localVideo}
//             objectFit="cover"
//             mirror={frontCamera}
//           />
//         )}
//         {/* Remote video stream for viewer */}
//         {!isOwner && remoteStream && (
//           <RTCView
//             streamURL={remoteStream.toURL()}
//             style={styles.remoteVideo}
//             objectFit="cover"
//           />
//         )}
//         {/* Placeholder when no stream */}
//         {(!localStream && isOwner) || (!remoteStream && !isOwner) ? (
//           <View style={styles.videoPlaceholder}>
//             <ActivityIndicator size="large" color="#ed167e" />
//             <Text style={styles.videoPlaceholderText}>
//               {isOwner ? 'Starting camera...' : 'Connecting to stream...'}
//             </Text>
//             <Text style={styles.streamStatusText}>Status: {streamStatus}</Text>
//           </View>
//         ) : null}
//         {/* Stream info overlay */}
//         {(localStream || remoteStream) && (
//           <View style={styles.videoOverlay}>
//             <View style={styles.streamInfo}>
//               <Text style={styles.streamTitleOverlay} numberOfLines={1}>
//                 {streamData?.title || 'Live Stream'}
//               </Text>
//             </View>
//           </View>
//         )}
//         {/* Reactions overlay */}
//         {renderReactions()}
//       </View>
//       {/* Controls */}
//       <View style={styles.bottomControls}>
//         {renderStreamControls()}
//         {renderViewerControls()}
//       </View>
//       {/* Chat overlay */}
//       {renderChat()}
//     </View>
//   );
// };

// const styles = StyleSheet.create({
//   // Modal styles
//   modalOverlay: {
//     flex: 1,
//     backgroundColor: 'rgba(0,0,0,0.8)',
//     justifyContent: 'center',
//     alignItems: 'center',
//   },
//   modalContent: {
//     backgroundColor: '#1a1a1a',
//     borderRadius: 16,
//     width: width * 0.95,
//     maxHeight: height * 0.90,
//     minHeight: height * 0.70,
//     padding: 0,
//   },
//   modalHeader: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     alignItems: 'center',
//     padding: 24,
//     borderBottomWidth: 1,
//     borderBottomColor: '#333',
//   },
//   modalTitle: {
//     color: 'white',
//     fontSize: 22,
//     fontWeight: 'bold',
//   },
//   closeButton: {
//     padding: 10,
//   },
//   closeButtonText: {
//     color: '#666',
//     fontSize: 28,
//     fontWeight: '300',
//   },
//   modalBody: {
//     flex: 1,
//     padding: 24,
//     paddingBottom: 100, // Space for the fixed button at bottom
//   },
//   scrollContent: {
//     paddingBottom: 20, // Extra padding for scroll content
//   },
//   inputGroup: {
//     marginBottom: 32, // More space between input groups
//   },
//   inputLabel: {
//     color: 'white',
//     fontSize: 18,
//     fontWeight: '600',
//     marginBottom: 12,
//   },
//   textInput: {
//     backgroundColor: '#333333',
//     borderRadius: 12,
//     padding: 20,
//     color: 'white',
//     fontSize: 18,
//     borderWidth: 2,
//     borderColor: '#555555',
//     minHeight: 56,
//   },
//   textInputFocused: {
//     borderColor: '#ff0000',
//     backgroundColor: '#3a3a3a',
//   },
//   multilineInput: {
//     height: 100,
//     textAlignVertical: 'top',
//     paddingTop: 20,
//   },
//   characterCount: {
//     color: '#888888',
//     fontSize: 14,
//     textAlign: 'right',
//     marginTop: 8,
//   },
//   infoSection: {
//     backgroundColor: '#2a2a2a',
//     borderRadius: 12,
//     padding: 20,
//     marginTop: 12,
//     marginBottom: 20,
//   },
//   infoTitle: {
//     color: 'white',
//     fontSize: 18,
//     fontWeight: '600',
//     marginBottom: 16,
//   },
//   infoItem: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     alignItems: 'center',
//     marginBottom: 12,
//   },
//   infoLabel: {
//     color: '#cccccc',
//     fontSize: 16,
//   },
//   infoValue: {
//     color: '#ff0000',
//     fontSize: 16,
//     fontWeight: '600',
//   },
//   textInputDisabled: {
//     backgroundColor: '#2a2a2a',
//     borderColor: '#444444',
//     opacity: 0.6,
//   },
//   infoSectionDisabled: {
//     opacity: 0.6,
//   },
//   loadingContainer: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     justifyContent: 'center',
//     paddingVertical: 20,
//     marginBottom: 16,
//   },
//   loadingText: {
//     color: '#ff0000',
//     marginLeft: 12,
//     fontSize: 16,
//     fontWeight: '500',
//   },
//   existingStreamContainer: {
//     backgroundColor: '#2a1a1a',
//     borderRadius: 12,
//     padding: 20,
//     marginBottom: 24,
//     borderWidth: 2,
//     borderColor: '#ff4444',
//   },
//   warningHeader: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     marginBottom: 12,
//   },
//   warningIcon: {
//     fontSize: 20,
//     marginRight: 8,
//   },
//   warningTitle: {
//     color: '#ff4444',
//     fontSize: 18,
//     fontWeight: 'bold',
//   },
//   warningText: {
//     color: '#cccccc',
//     fontSize: 16,
//     marginBottom: 16,
//     lineHeight: 22,
//   },
//   streamStatusContainer: {
//     backgroundColor: '#1a1a1a',
//     borderRadius: 8,
//     padding: 12,
//     marginBottom: 16,
//   },
//   streamStatus: {
//     color: '#cccccc',
//     fontSize: 14,
//     marginBottom: 4,
//   },
//   streamStatusValue: {
//     color: '#ff0000',
//     fontWeight: '600',
//   },
//   streamTime: {
//     color: '#888888',
//     fontSize: 12,
//   },
//   existingStreamActions: {
//     flexDirection: 'row',
//     gap: 12,
//   },
//   actionButton: {
//     flex: 1,
//     paddingVertical: 12,
//     paddingHorizontal: 16,
//     borderRadius: 8,
//     alignItems: 'center',
//   },
//   continueButton: {
//     backgroundColor: '#00aa00',
//   },
//   endButton: {
//     backgroundColor: '#ff4444',
//   },
//   continueButtonText: {
//     color: 'white',
//     fontSize: 14,
//     fontWeight: '600',
//   },
//   endButtonText: {
//     color: 'white',
//     fontSize: 14,
//     fontWeight: '600',
//   },
//   divider: {
//     height: 2,
//     backgroundColor: '#444444',
//     marginTop: 20,
//     marginHorizontal: -20,
//   },
//   createButton: {
//     backgroundColor: '#ff0000',
//     paddingVertical: 20,
//     marginHorizontal: 24,
//     marginBottom: 24,
//     borderRadius: 16,
//     alignItems: 'center',
//     shadowColor: '#ff0000',
//     shadowOffset: {
//       width: 0,
//       height: 4,
//     },
//     shadowOpacity: 0.3,
//     shadowRadius: 8,
//     elevation: 8,
//     position: 'absolute',
//     bottom: 0,
//     left: 0,
//     right: 0,
//   },
//   createButtonDisabled: {
//     opacity: 0.6,
//   },
//   createButtonText: {
//     color: 'white',
//     fontSize: 20,
//     fontWeight: 'bold',
//   },
//   createButtonLoading: {
//     flexDirection: 'row',
//     alignItems: 'center',
//   },
//   createButtonLoadingText: {
//     color: 'white',
//     fontSize: 16,
//     fontWeight: 'bold',
//     marginLeft: 12,
//   },
//   // Viewer styles
//   container: {
//     flex: 1,
//     backgroundColor: 'black',
//   },
//   header: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     paddingTop: Platform.OS === 'ios' ? 50 : 20,
//     paddingHorizontal: 16,
//     paddingBottom: 16,
//     backgroundColor: 'rgba(0,0,0,0.8)',
//   },
//   backButton: {
//     padding: 8,
//     marginRight: 12,
//   },
//   backButtonText: {
//     color: 'white',
//     fontSize: 24,
//   },
//   headerInfo: {
//     flex: 1,
//   },
//   streamTitle: {
//     color: 'white',
//     fontSize: 18,
//     fontWeight: 'bold',
//     marginBottom: 4,
//   },
//   streamStats: {
//     flexDirection: 'row',
//     alignItems: 'center',
//   },
//   liveIndicator: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     backgroundColor: '#ff0000',
//     paddingHorizontal: 8,
//     paddingVertical: 2,
//     borderRadius: 12,
//     marginRight: 12,
//   },
//   liveIcon: {
//     width: 6,
//     height: 6,
//     borderRadius: 3,
//     backgroundColor: 'white',
//     marginRight: 4,
//   },
//   liveText: {
//     color: 'white',
//     fontSize: 10,
//     fontWeight: 'bold',
//   },
//   viewerCount: {
//     color: '#ccc',
//     fontSize: 14,
//   },
//   videoContainer: {
//     flex: 1,
//     position: 'relative',
//     backgroundColor: 'black',
//   },
//   localVideo: {
//     position: 'absolute',
//     top: 0,
//     left: 0,
//     right: 0,
//     bottom: 0,
//     backgroundColor: 'black',
//   },
//   remoteVideo: {
//     position: 'absolute',
//     top: 0,
//     left: 0,
//     right: 0,
//     bottom: 0,
//     backgroundColor: 'black',
//   },
//   videoOverlay: {
//     position: 'absolute',
//     top: 0,
//     left: 0,
//     right: 0,
//     bottom: 0,
//     pointerEvents: 'none',
//   },
//   streamInfo: {
//     position: 'absolute',
//     top: 20,
//     left: 20,
//     right: 20,
//     backgroundColor: 'rgba(0,0,0,0.6)',
//     borderRadius: 12,
//     padding: 12,
//   },
//   streamTitleOverlay: {
//     color: 'white',
//     fontSize: 16,
//     fontWeight: 'bold',
//   },
//   videoPlaceholder: {
//     flex: 1,
//     justifyContent: 'center',
//     alignItems: 'center',
//     backgroundColor: '#1a1a1a',
//   },
//   videoPlaceholderText: {
//     color: 'white',
//     fontSize: 20,
//     fontWeight: 'bold',
//     marginBottom: 8,
//     marginTop: 16,
//   },
//   streamStatusText: {
//     color: '#666',
//     fontSize: 14,
//   },
//   bottomControls: {
//     position: 'absolute',
//     bottom: 50,
//     right: 16,
//     alignItems: 'flex-end',
//   },
//   streamControls: {
//     alignItems: 'center',
//   },
//   viewerControls: {
//     alignItems: 'center',
//   },
//   controlButton: {
//     backgroundColor: 'rgba(0,0,0,0.6)',
//     paddingHorizontal: 16,
//     paddingVertical: 12,
//     borderRadius: 24,
//     marginBottom: 12,
//     minWidth: 60,
//     alignItems: 'center',
//     borderWidth: 2,
//     borderColor: 'transparent',
//   },
//   controlButtonDisabled: {
//     backgroundColor: 'rgba(255,0,0,0.6)',
//     borderColor: 'rgba(255,0,0,0.8)',
//   },
//   endStreamButton: {
//     backgroundColor: 'rgba(255,0,0,0.8)',
//   },
//   // Add these styles to your existing styles object
//   endStreamButtonContent: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     gap: 4,
//   },
//   endStreamButtonText: {
//     color: 'white',
//     fontSize: 12,
//     fontWeight: '600',
//     marginLeft: 4,
//   },
//   controlButtonText: {
//     color: 'white',
//     fontSize: 16,
//     fontWeight: '600',
//   },
//   reactionsContainer: {
//     position: 'absolute',
//     right: 20,
//     bottom: 150,
//     alignItems: 'center',
//   },
//   reactionBubble: {
//     backgroundColor: 'rgba(0,0,0,0.6)',
//     borderRadius: 20,
//     padding: 8,
//     marginBottom: 8,
//   },
//   reactionEmoji: {
//     fontSize: 20,
//   },
//   chatContainer: {
//     position: 'absolute',
//     left: 16,
//     right: 100,
//     bottom: 16,
//     height: 300,
//     backgroundColor: 'rgba(0,0,0,0.8)',
//     borderRadius: 12,
//     overflow: 'hidden',
//   },
//   chatHeader: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     alignItems: 'center',
//     padding: 12,
//     borderBottomWidth: 1,
//     borderBottomColor: '#333',
//   },
//   chatTitle: {
//     color: 'white',
//     fontSize: 16,
//     fontWeight: 'bold',
//   },
//   chatCloseButton: {
//     color: '#666',
//     fontSize: 20,
//   },
//   chatMessages: {
//     flex: 1,
//     padding: 8,
//   },
//   chatMessage: {
//     flexDirection: 'row',
//     marginBottom: 8,
//     flexWrap: 'wrap',
//   },
//   chatUsername: {
//     color: '#ed167e',
//     fontSize: 14,
//     fontWeight: 'bold',
//   },
//   chatText: {
//     color: 'white',
//     fontSize: 14,
//   },
//   chatInput: {
//     flexDirection: 'row',
//     padding: 8,
//     borderTopWidth: 1,
//     borderTopColor: '#333',
//     alignItems: 'center',
//   },
//   chatTextInput: {
//     flex: 1,
//     backgroundColor: '#2a2a2a',
//     borderRadius: 20,
//     paddingHorizontal: 12,
//     paddingVertical: 8,
//     color: 'white',
//     fontSize: 14,
//     marginRight: 8,
//   },
//   chatSendButton: {
//     backgroundColor: '#ed167e',
//     borderRadius: 16,
//     paddingHorizontal: 12,
//     paddingVertical: 8,
//   },
//   chatSendButtonText: {
//     color: 'white',
//     fontSize: 12,
//     fontWeight: 'bold',
//   },
// });

// // Export default LiveStreamManager for backward compatibility
// const LiveStreamManager = {
//   LiveStreamCreator,
//   LiveStreamViewer,
// };
// export default LiveStreamManager;