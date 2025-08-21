// // screens/tabs/InAppCameraScreen.js
// import React, { useEffect, useRef, useState } from 'react';
// import {
//   View,
//   Text,
//   TouchableOpacity,
//   StyleSheet,
//   Alert,
//   Dimensions,
// } from 'react-native';
// import { Camera, CameraCaptureError } from 'react-native-vision-camera';
// import { useNavigation } from '@react-navigation/native';

// const { width, height } = Dimensions.get('window');

// const InAppCameraScreen = ({ route }) => {
//   const navigation = useNavigation();
//   const camera = useRef(null);
//   const [hasPermission, setHasPermission] = useState(false);

//   useEffect(() => {
//     (async () => {
//       const status = await Camera.requestCameraPermission();
//       setHasPermission(status === 'authorized');
//     })();
//   }, []);

//   const takePicture = async () => {
//     if (camera.current == null) return;
//     try {
//       const photo = await camera.current.takePhoto({
//         qualityPrioritization: 'quality',
//         flash: 'auto',
//       });
//       const imagePath = `file://${photo.path}`;
//       console.log('Photo taken:', imagePath);

//       // Pass the image back to CreateStoryScreen
//       navigation.navigate('CreateStory', {
//         capturedImageUri: imagePath,
//       });
//     } catch (error) {
//       console.error('Failed to take picture:', error);
//       Alert.alert('Error', 'Failed to capture photo');
//     }
//   };

//   if (!hasPermission) {
//     return (
//       <View style={styles.permissionContainer}>
//         <Text style={styles.permissionText}>Camera permission is required.</Text>
//         <TouchableOpacity
//           style={styles.retryButton}
//           onPress={() => navigation.goBack()}
//         >
//           <Text style={styles.retryText}>Go Back</Text>
//         </TouchableOpacity>
//       </View>
//     );
//   }

//   return (
//     <View style={styles.container}>
//       <Camera
//         ref={camera}
//         style={StyleSheet.absoluteFill}
//         device={Camera.getAvailableCameraDevices()[0]}
//         isActive={true}
//         photo
//       />

//       <TouchableOpacity style={styles.captureButton} onPress={takePicture}>
//         <Text style={styles.captureButtonText}>Capture</Text>
//       </TouchableOpacity>

//       <TouchableOpacity
//         style={styles.closeButton}
//         onPress={() => navigation.goBack()}
//       >
//         <Text style={styles.closeButtonText}>✕</Text>
//       </TouchableOpacity>
//     </View>
//   );
// };

// export default InAppCameraScreen;

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     backgroundColor: 'black',
//   },
//   permissionContainer: {
//     flex: 1,
//     justifyContent: 'center',
//     alignItems: 'center',
//     backgroundColor: 'black',
//   },
//   permissionText: {
//     color: 'white',
//     fontSize: 18,
//   },
//   retryButton: {
//     marginTop: 20,
//     padding: 10,
//     backgroundColor: '#ed167e',
//     borderRadius: 8,
//   },
//   retryText: {
//     color: 'white',
//     fontWeight: 'bold',
//   },
//   captureButton: {
//     position: 'absolute',
//     bottom: 40,
//     alignSelf: 'center',
//     padding: 15,
//     backgroundColor: '#ed167e',
//     borderRadius: 50,
//   },
//   captureButtonText: {
//     color: 'white',
//     fontWeight: 'bold',
//   },
//   closeButton: {
//     position: 'absolute',
//     top: 50,
//     right: 20,
//   },
//   closeButtonText: {
//     color: 'white',
//     fontSize: 30,
//   },
// });