import React, { useState, useRef, useEffect } from "react";
import {
View,
Text,
TextInput,
TouchableOpacity,
StyleSheet,
StatusBar,
ScrollView,
ActivityIndicator,
Alert,
Dimensions,
Image,
BackHandler,
Platform,
AppState,
} from "react-native";
import DeviceInfo from "react-native-device-info";
import Video from "react-native-video";
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import RNFS from 'react-native-fs';
import { useAuth } from "../../context/AuthContext";
import { useNavigation } from "@react-navigation/native";
import VideoTrimmer from "./VideoTrimmer";

const { width } = Dimensions.get("window");
const API_BASE_URL = "https://backendforheartlink.in/api/v1";
const MAX_REEL_DURATION = 25; // 25 seconds max for reels

const getDeviceCapabilities = () => {
try {
const totalMemory = DeviceInfo.getTotalMemorySync();
const availableMemory = DeviceInfo.getFreeDiskStorageSync();
const androidVersion = Platform.Version;

return {
totalMemory,
availableMemory,
androidVersion,
isLowEndDevice: totalMemory < 1 * 1024 * 1024 * 1024,
isOldAndroid: androidVersion < 21,
};
} catch (error) {
console.log('Device capabilities detection failed, using defaults');
return {
totalMemory: 4 * 1024 * 1024 * 1024,
availableMemory: 10 * 1024 * 1024 * 1024,
androidVersion: 28,
isLowEndDevice: false,
isOldAndroid: false,
};
}
};

const EditPostScreen = ({ route }) => {
const navigation = useNavigation();
const { selectedMedia, contentType } = route.params;
const [caption, setCaption] = useState("");
const [uploading, setUploading] = useState(false);
const [uploadProgress, setUploadProgress] = useState(0);
const [deviceCapabilities, setDeviceCapabilities] = useState(null);
const [appState, setAppState] = useState(AppState.currentState);
const [uploadRetries, setUploadRetries] = useState(0);

// Video trimmer states
const [showVideoTrimmer, setShowVideoTrimmer] = useState(false);
const [videoNeedsTrimming, setVideoNeedsTrimming] = useState(false);
const [videoDuration, setVideoDuration] = useState(0);
const [trimmedVideo, setTrimmedVideo] = useState(null);
const [checkingVideoDuration, setCheckingVideoDuration] = useState(false);

// File size display
const [mediaFileSizes, setMediaFileSizes] = useState({});

const { token, user, isAuthenticated } = useAuth();

const videoRef = useRef(null);
const uploadAbortController = useRef(null);

// Helper function to format file size
const formatFileSize = (bytes) => {
if (bytes === 0) return '0 Bytes';
const k = 1024;
const sizes = ['Bytes', 'KB', 'MB', 'GB'];
const i = Math.floor(Math.log(bytes) / Math.log(k));
return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Get current file size for media
const getCurrentFileSize = async (mediaItem) => {
try {
// Use compressed size if available, otherwise try to get file size
if (mediaItem.compressedSize) {
return mediaItem.compressedSize;
}

const uri = mediaItem.uri || mediaItem.image?.uri;
if (!uri) return 0;

const cleanUri = uri.replace('file://', '');
const fileInfo = await RNFS.stat(cleanUri);
return fileInfo.size;
} catch (error) {
console.log('Could not get file size for media:', error);
return mediaItem.fileSize || 0;
}
};

useEffect(() => {
const checkDeviceCapabilities = async () => {
try {
const capabilities = getDeviceCapabilities();
setDeviceCapabilities(capabilities);

console.log('📱 Device capabilities:', {
totalMemory: Math.round(capabilities.totalMemory / (1024 * 1024 * 1024)) + 'GB',
availableStorage: Math.round(capabilities.availableMemory / (1024 * 1024 * 1024)) + 'GB',
androidVersion: capabilities.androidVersion,
isLowEndDevice: capabilities.isLowEndDevice,
isOldAndroid: capabilities.isOldAndroid
});
} catch (error) {
console.error('❌ Failed to get device capabilities:', error);
setDeviceCapabilities({ isLowEndDevice: false, isOldAndroid: false });
}
};

checkDeviceCapabilities();
}, [contentType]);

useEffect(() => {
// Get file sizes for all media items
const getFileSizes = async () => {
const sizes = {};
for (let i = 0; i < selectedMedia.length; i++) {
const mediaItem = selectedMedia[i];
try {
const size = await getCurrentFileSize(mediaItem);
sizes[i] = size;
} catch (error) {
console.log(`Failed to get size for media ${i}:`, error);
sizes[i] = 0;
}
}
setMediaFileSizes(sizes);
};

if (selectedMedia && selectedMedia.length > 0) {
getFileSizes();
}
}, [selectedMedia]);

useEffect(() => {
if (contentType === 'reel' && selectedMedia[0] && !trimmedVideo) {
// Check if the video was already processed (compressed, etc.)
const videoMedia = selectedMedia[0];
if (videoMedia.compressionMethod && videoMedia.compressionMethod !== 'none') {
console.log('✅ Video already processed with compression');
setCheckingVideoDuration(false);
} else {
setCheckingVideoDuration(true);
}
}
}, [contentType, selectedMedia, trimmedVideo]);

useEffect(() => {
const handleAppStateChange = (nextAppState) => {
if (appState.match(/inactive|background/) && nextAppState === 'active') {
console.log('📱 App has come to the foreground');
} else if (nextAppState.match(/inactive|background/)) {
console.log('📱 App has gone to the background');
if (uploading && uploadAbortController.current) {
console.log('⚠️ Pausing upload due to app backgrounding');
}
}
setAppState(nextAppState);
};

const subscription = AppState.addEventListener('change', handleAppStateChange);
return () => subscription?.remove();
}, [appState, uploading]);

useEffect(() => {
if (!isAuthenticated) {
Alert.alert("Authentication Error", "You must be logged in to create a post. Please log in again.");
navigation.navigate('Login');
}

const backAction = () => {
if (caption.trim() || uploading || showVideoTrimmer) {
Alert.alert(
"Discard Changes?",
"You have unsaved changes. Are you sure you want to go back?",
[
{ text: "Stay", style: "cancel" },
{ text: "Discard", style: "destructive", onPress: () => {
if (uploading && uploadAbortController.current) {
uploadAbortController.current.abort();
}
navigation.goBack();
}}
]
);
return true;
}
return false;
};

const backHandler = BackHandler.addEventListener("hardwareBackPress", backAction);
return () => backHandler.remove();
}, [isAuthenticated, navigation, caption, uploading, showVideoTrimmer]);

const handleBack = () => {
if (caption.trim() || uploading || showVideoTrimmer) {
Alert.alert(
"Discard Changes?",
"You have unsaved changes. Are you sure you want to go back?",
[
{ text: "Stay", style: "cancel" },
{ text: "Discard", style: "destructive", onPress: () => {
if (uploading && uploadAbortController.current) {
uploadAbortController.current.abort();
}
navigation.goBack();
}}
]
);
} else {
navigation.goBack();
}
};

const onVideoLoad = (data) => {
console.log('🎬 Video loaded with duration:', data.duration);
setVideoDuration(data.duration);
setCheckingVideoDuration(false);

// Check if video was already processed
const videoMedia = selectedMedia[0];
if (videoMedia.compressionMethod && videoMedia.compressionMethod !== 'none') {
console.log('✅ Video already processed, skipping duration check');
setVideoNeedsTrimming(false);
return;
}

if (data.duration > MAX_REEL_DURATION) {
setVideoNeedsTrimming(true);
Alert.alert(
"Video Too Long",
`Your video is ${Math.round(data.duration)}s long. Reels can be maximum ${MAX_REEL_DURATION}s. Please trim your video.`,
[
{ text: "Go Back", onPress: () => navigation.goBack() },
{ text: "Trim Video", onPress: () => setShowVideoTrimmer(true) }
]
);
} else {
setVideoNeedsTrimming(false);
console.log('✅ Video duration is within limits');
}
};

const handleTrimComplete = (trimmedVideoInfo) => {
console.log('✅ Video trimmed successfully:', trimmedVideoInfo);
setTrimmedVideo(trimmedVideoInfo);
setShowVideoTrimmer(false);
setVideoNeedsTrimming(false);

Alert.alert(
"Video Trimmed Successfully!",
`Your video has been trimmed to ${Math.round(trimmedVideoInfo.duration)}s and is ready to upload.`,
[{ text: "OK" }]
);
};

const handleTrimCancel = () => {
setShowVideoTrimmer(false);
Alert.alert(
"Trim Cancelled",
"Your video is still too long for reels. You can go back to select a different video or try trimming again.",
[
{ text: "Go Back", onPress: () => navigation.goBack() },
{ text: "Trim Again", onPress: () => setShowVideoTrimmer(true) }
]
);
};

const performMemoryCleanup = () => {
try {
if (global.gc) {
global.gc();
}
console.log('🧹 Memory cleanup performed');
} catch (error) {
console.log('⚠️ Memory cleanup not available');
}
};

const normalizeFileUri = (uri) => {
if (!uri) return null;

console.log('📁 Normalizing URI:', uri);

if (uri.startsWith('content://') || uri.startsWith('file://') || uri.startsWith('ph://')) {
return uri;
} else if (uri.startsWith('/')) {
return `file://${uri}`;
}

return uri;
};

const validateVideoFile = (videoAsset) => {
console.log('🎬 Validating video file:', videoAsset);

if (!videoAsset) {
throw new Error('No video file provided');
}

if (!videoAsset.uri && !videoAsset.image?.uri && !trimmedVideo?.uri) {
throw new Error('Invalid video file - no URI found');
}

console.log('✅ Video validation passed');
return true;
};

const getMimeTypeFromUri = (uri, contentType) => {
if (!uri) return contentType === 'reel' ? 'video/mp4' : 'image/jpeg';

const uriLower = uri.toLowerCase();

if (contentType === 'reel') {
if (uriLower.includes('.mp4')) return 'video/mp4';
if (uriLower.includes('.mov')) return 'video/quicktime';
if (uriLower.includes('.avi')) return 'video/x-msvideo';
if (uriLower.includes('.3gp')) return 'video/3gpp';
if (uriLower.includes('.webm')) return 'video/webm';
if (uriLower.includes('.m4v')) return 'video/x-m4v';
if (uriLower.includes('.mkv')) return 'video/x-matroska';
if (uriLower.includes('.flv')) return 'video/x-flv';
if (uriLower.includes('.wmv')) return 'video/x-ms-wmv';
return 'video/mp4';
} else {
if (uriLower.includes('.jpg') || uriLower.includes('.jpeg')) return 'image/jpeg';
if (uriLower.includes('.png')) return 'image/png';
if (uriLower.includes('.webp')) return 'image/webp';
if (uriLower.includes('.gif')) return 'image/gif';
if (uriLower.includes('.heic')) return 'image/heic';
return 'image/jpeg';
}
};

const generateFileName = (uri, mimeType, contentType, indexOrSuffix = 0) => {
const timestamp = Date.now();
const cleanUserId = user?._id ? user._id.replace(/[^a-zA-Z0-9]/g, '').substring(0, 8) : 'user';

let extension = 'jpg';
if (contentType === 'reel') {
if (mimeType.includes('mp4')) extension = 'mp4';
else if (mimeType.includes('quicktime')) extension = 'mov';
else if (mimeType.includes('3gpp')) extension = '3gp';
else if (mimeType.includes('webm')) extension = 'webm';
else if (mimeType.includes('avi')) extension = 'avi';
else extension = 'mp4';
} else {
if (mimeType.includes('png')) extension = 'png';
else if (mimeType.includes('webp')) extension = 'webp';
else if (mimeType.includes('gif')) extension = 'gif';
else extension = 'jpg';
}

const prefix = contentType === 'reel' ? 'reel' : 'photo';
const suffix = typeof indexOrSuffix === 'string' ? indexOrSuffix : `_${indexOrSuffix}`;

return `${prefix}_${cleanUserId}_${timestamp}${suffix}.${extension}`;
};

const createFormData = () => {
console.log('📝 Creating FormData for:', contentType);
console.log('📱 Selected media:', selectedMedia.length, 'items');

performMemoryCleanup();

const formData = new FormData();

formData.append('content', caption.trim());
formData.append('privacy', 'public');

if (contentType === 'reel') {
const videoAsset = selectedMedia[0];

let videoUri;
if (trimmedVideo) {
console.log('✅ Using locally trimmed video file');
videoUri = trimmedVideo.uri;
formData.append('videoPreTrimmed', 'true');
formData.append('originalDuration', videoDuration.toString());
formData.append('trimmedDuration', trimmedVideo.duration.toString());
formData.append('trimMethod', trimmedVideo.method || 'local');
formData.append('trimRequested', 'true');
} else {
videoUri = videoAsset?.uri || videoAsset?.image?.uri || videoAsset?.originalUri;
console.log('📹 Using video URI:', videoUri);
}

videoUri = normalizeFileUri(videoUri);

if (!videoUri) {
throw new Error('No valid video URI found in asset');
}

validateVideoFile(videoAsset);

const detectedMimeType = videoAsset?.type || getMimeTypeFromUri(videoUri, 'reel');

let fileSuffix = '';
if (trimmedVideo) {
fileSuffix = '_trimmed';
} else if (videoAsset.isCompressed) {
fileSuffix = '_compressed';
}

const fileName = generateFileName(videoUri, detectedMimeType, 'reel', fileSuffix);

// Add compression metadata to form data
if (videoAsset.isCompressed) {
formData.append('videoCompressed', 'true');
formData.append('originalVideoSize', videoAsset.originalSize?.toString() || '0');
formData.append('compressedVideoSize', videoAsset.compressedSize?.toString() || '0');
formData.append('compressionRatio', videoAsset.compressionRatio?.toString() || '0');
formData.append('compressionMethod', videoAsset.compressionMethod || 'react-native-compressor');
}

console.log('📹 Video file details:', {
uri: videoUri,
type: detectedMimeType,
name: fileName,
trimmed: !!trimmedVideo,
compressed: !!videoAsset.isCompressed,
originalSize: videoAsset.originalSize ? formatFileSize(videoAsset.originalSize) : 'unknown',
compressedSize: videoAsset.compressedSize ? formatFileSize(videoAsset.compressedSize) : 'unknown',
compressionRatio: videoAsset.compressionRatio ? `${Math.round(videoAsset.compressionRatio)}%` : '0%',
duration: trimmedVideo
? `${trimmedVideo.duration}s`
: (videoDuration ? `${videoDuration}s` : 'unknown')
});

const videoFile = {
uri: videoUri,
type: detectedMimeType,
name: fileName
};

formData.append('video', videoFile);
console.log('✅ Video file appended to FormData');

} else {
console.log('📸 Processing', selectedMedia.length, 'images');

selectedMedia.forEach((photo, index) => {
let imageUri = photo?.uri || photo?.image?.uri || photo?.originalUri;
imageUri = normalizeFileUri(imageUri);

if (!imageUri) {
console.error(`❌ No valid URI for image ${index + 1}`);
return;
}

const detectedMimeType = photo?.type || getMimeTypeFromUri(imageUri, 'post');
const fileName = generateFileName(imageUri, detectedMimeType, 'post', index);

const photoFile = {
uri: imageUri,
type: detectedMimeType,
name: fileName
};

formData.append('images', photoFile);
console.log(`✅ Image ${index + 1} appended to FormData`);
});
}

return formData;
};

const uploadContent = async () => {
console.log('🚀 Starting upload process...');

if (!isAuthenticated || !token) {
Alert.alert("Authentication Error", "You are not logged in. Please login again.");
navigation.navigate('Login');
return;
}

if (contentType === 'reel' && videoNeedsTrimming && !trimmedVideo) {
Alert.alert(
"Video Too Long",
`Your video needs to be trimmed to maximum ${MAX_REEL_DURATION} seconds before uploading.`,
[
{ text: "Trim Video", onPress: () => setShowVideoTrimmer(true) }
]
);
return;
}

if (contentType === 'reel') {
const videoAsset = selectedMedia[0];
if (!videoAsset) {
Alert.alert("No Video Selected", "Please select a video to upload.");
return;
}

try {
validateVideoFile(videoAsset);
} catch (error) {
Alert.alert("Video Validation Failed", error.message);
return;
}
} else {
if (selectedMedia.length === 0) {
Alert.alert("No Images Selected", "Please select at least one image to upload.");
return;
}
}

setUploading(true);
setUploadProgress(0);

uploadAbortController.current = new AbortController();

try {
performMemoryCleanup();

const formData = createFormData();

const endpoint = `${API_BASE_URL}/posts/${contentType === 'reel' ? 'create-reel' : 'create'}`;

console.log('🎯 Upload endpoint:', endpoint);
console.log('🔑 Using token:', token ? 'Token present' : 'No token');

const uploadPromise = new Promise((resolve, reject) => {
const xhr = new XMLHttpRequest();

uploadAbortController.current.signal.addEventListener('abort', () => {
xhr.abort();
reject(new Error('Upload cancelled'));
});

let lastProgressUpdate = 0;
xhr.upload.addEventListener('progress', (event) => {
const now = Date.now();
if (event.lengthComputable && now - lastProgressUpdate > 100) {
const progress = (event.loaded / event.total) * 100;
setUploadProgress(Math.round(progress));
console.log(`📊 Upload progress: ${Math.round(progress)}%`);
lastProgressUpdate = now;
}
});

xhr.addEventListener('load', () => {
console.log('📡 Upload completed with status:', xhr.status);
console.log('📡 Response text:', xhr.responseText);

if (xhr.status >= 200 && xhr.status < 300) {
try {
const response = JSON.parse(xhr.responseText);
console.log('✅ Upload successful:', response);
resolve(response);
} catch (parseError) {
console.error('❌ Failed to parse success response:', parseError);
resolve({ message: `${contentType === 'reel' ? 'Reel' : 'Post'} uploaded successfully!` });
}
} else if (xhr.status === 413) {
console.error('❌ Server error 413: File too large for server');
reject(new Error('File too large for server. This is a server configuration issue. Please contact support or try with a smaller file.'));
} else {
console.error('❌ Server error:', xhr.status, xhr.statusText, xhr.responseText);

let errorMessage = `Upload failed with status ${xhr.status}`;
try {
const errorResponse = JSON.parse(xhr.responseText);
errorMessage = errorResponse.message || errorResponse.error || errorMessage;
} catch (parseError) {
console.log('Could not parse error response');
}

reject(new Error(errorMessage));
}
});

xhr.addEventListener('error', (event) => {
console.error('❌ Network error during upload:', event);
reject(new Error('Network error. Please check your connection and try again.'));
});

xhr.addEventListener('timeout', () => {
console.error('❌ Upload timeout');
reject(new Error('Upload timed out. Please try again.'));
});

xhr.addEventListener('abort', () => {
console.log('❌ Upload aborted');
reject(new Error('Upload was cancelled.'));
});

xhr.open('POST', endpoint);
xhr.setRequestHeader('Authorization', `Bearer ${token}`);

xhr.timeout = contentType === 'reel' ? 1800000 : 900000;

console.log('📤 Sending upload request...');

xhr.send(formData);
});

const responseData = await uploadPromise;
console.log('✅ Upload completed successfully');

performMemoryCleanup();
setUploadRetries(0);

let successMessage = responseData.message || `${contentType === 'reel' ? 'Reel' : 'Post'} uploaded successfully!`;
if (responseData.data?.reward?.message) {
successMessage += `\n\n🎉 ${responseData.data.reward.message}`;
}

Alert.alert("Success! 🎉", successMessage, [
{
text: "OK",
onPress: () => {
setCaption("");
setTrimmedVideo(null);
navigation.navigate('HomeScreen');
}
},
]);

} catch (error) {
console.error('❌ Upload error:', error);
performMemoryCleanup();

let errorMessage = "Upload failed. Please try again.";
let showRetryOption = false;

if (error.message.includes('cancelled')) {
return;
} else if (error.message.includes('413') || error.message.includes('too large')) {
errorMessage = "File too large for server. This is a server configuration issue.\n\nOptions:\n1. Contact support\n2. Try compressing the video\n3. Use a different file";
showRetryOption = false;
} else if (error.message.includes('Network error')) {
errorMessage = "Network error. Please check your internet connection.";
showRetryOption = true;
} else if (error.message.includes('timeout') || error.message.includes('timed out')) {
errorMessage = "Upload timed out. Please check your connection.";
showRetryOption = true;
} else if (error.message.includes('401') || error.message.includes('403')) {
Alert.alert("Authentication Error", "Your session has expired. Please login again.", [
{ text: "OK", onPress: () => navigation.navigate('Login') }
]);
return;
} else if (error.message) {
errorMessage = error.message;
showRetryOption = true;
}

if (showRetryOption && uploadRetries < 3) {
Alert.alert(
"Upload Failed",
errorMessage + `\n\nRetry attempt ${uploadRetries + 1}/3`,
[
{ text: "Cancel", style: "cancel" },
{
text: "Retry",
onPress: () => {
setUploadRetries(prev => prev + 1);
setTimeout(() => uploadContent(), 1000);
}
}
]
);
} else {
Alert.alert("Upload Failed", errorMessage);
setUploadRetries(0);
}
} finally {
setUploading(false);
setUploadProgress(0);
uploadAbortController.current = null;
}
};

const renderMediaPreview = () => {
if (contentType === 'reel') {
const videoAsset = selectedMedia[0];

let videoUri;
if (trimmedVideo) {
videoUri = trimmedVideo.uri;
} else {
videoUri = normalizeFileUri(videoAsset?.uri || videoAsset?.image?.uri || videoAsset?.originalUri);
}

if (!videoUri) {
return (
<View style={styles.mediaPreviewError}>
<Text style={styles.errorText}>Video not accessible</Text>
<TouchableOpacity
style={styles.retryButton}
onPress={() => navigation.goBack()}
>
<Text style={styles.retryText}>Select Again</Text>
</TouchableOpacity>
</View>
);
}

return (
<View style={styles.mediaPreview}>
<Video
ref={videoRef}
source={{ uri: videoUri }}
style={styles.videoPreview}
controls={true}
resizeMode="cover"
paused={false}
repeat={true}
muted={true}
onError={(error) => {
console.error('Video playback error:', error);
}}
onLoad={checkingVideoDuration ? onVideoLoad : (data) => {
console.log('Video loaded:', data);
}}
/>

{checkingVideoDuration && (
<View style={styles.durationCheckOverlay}>
<ActivityIndicator color="#ed167e" size="large" />
<Text style={styles.durationCheckText}>Checking video duration...</Text>
</View>
)}

<View style={styles.durationIndicator}>
<Text style={styles.durationText}>
{trimmedVideo
? `${Math.round(trimmedVideo.duration)}s / ${MAX_REEL_DURATION}s ✂️`
: videoDuration
? `${Math.round(videoDuration)}s${videoDuration > MAX_REEL_DURATION ? ` (> ${MAX_REEL_DURATION}s)` : ''}`
: 'Checking...'
}
</Text>
</View>

{/* File size indicator with compression info */}
<View style={styles.fileSizeIndicator}>
<View style={styles.fileSizeRow}>
<MaterialIcons name="folder" size={14} color="#fff" />
<Text style={styles.fileSizeText}>
{videoAsset.compressedSize
? formatFileSize(videoAsset.compressedSize)
: mediaFileSizes[0]
? formatFileSize(mediaFileSizes[0])
: 'Calculating...'
}
</Text>
</View>

{videoAsset.isCompressed && (
<View style={styles.compressionInfoRow}>
<MaterialIcons name="compress" size={12} color="#4CAF50" />
<Text style={styles.compressionInfoText}>
-{Math.round(videoAsset.compressionRatio)}% compressed
</Text>
</View>
)}

{videoAsset.originalSize && videoAsset.compressedSize && (
<Text style={styles.originalSizeText}>
Original: {formatFileSize(videoAsset.originalSize)}
</Text>
)}
</View>

{trimmedVideo && (
<View style={[styles.trimStatusIndicator, {backgroundColor: 'rgba(76, 175, 80, 0.9)'}]}>
<Text style={styles.trimStatusText}>
✂️ Trimmed
</Text>
</View>
)}

{videoAsset.isCompressed && (
<View style={styles.compressionStatusIndicator}>
<MaterialIcons name="compress" size={14} color="#fff" />
<Text style={styles.compressionStatusText}>
Compressed
</Text>
</View>
)}

{videoNeedsTrimming && !trimmedVideo && (
<TouchableOpacity
style={styles.trimButton}
onPress={() => setShowVideoTrimmer(true)}
>
<Text style={styles.trimButtonText}>✂️ Trim to {MAX_REEL_DURATION}s</Text>
</TouchableOpacity>
)}
</View>
);
} else {
return (
<ScrollView horizontal style={styles.mediaPreview} showsHorizontalScrollIndicator={false}>
{selectedMedia.map((photo, index) => {
const imageUri = normalizeFileUri(photo.uri || photo.image?.uri || photo.originalUri);

if (!imageUri) {
return (
<View key={index} style={styles.photoContainer}>
<View style={styles.imageError}>
<Text style={styles.errorText}>Image not accessible</Text>
</View>
</View>
);
}

return (
<View key={index} style={styles.photoContainer}>
<Image
source={{ uri: imageUri }}
style={styles.photoPreview}
resizeMode="cover"
onError={(error) => {
console.error(`Failed to load image at index ${index}:`, error);
}}
/>
{selectedMedia.length > 1 && (
<View style={styles.photoIndicator}>
<Text style={styles.photoIndicatorText}>{index + 1}/{selectedMedia.length}</Text>
</View>
)}

{/* Image file size indicator */}
{mediaFileSizes[index] && (
<View style={styles.imageFileSizeIndicator}>
<Text style={styles.imageFileSizeText}>
{formatFileSize(mediaFileSizes[index])}
</Text>
</View>
)}
</View>
);
})}
<View style={styles.mediaTypeIndicator}>
<Text style={styles.mediaTypeText}>
{selectedMedia.length} PHOTO{selectedMedia.length > 1 ? 'S' : ''} - PUBLIC
</Text>
</View>
</ScrollView>
);
}
};

if (!isAuthenticated) {
return (
<View style={styles.errorContainer}>
<StatusBar barStyle="light-content" backgroundColor="black" />
<Text style={styles.errorText}>Authentication Required</Text>
<Text style={styles.errorSubText}>Please login to upload content.</Text>
<TouchableOpacity
style={styles.loginButton}
onPress={() => navigation.navigate('Login')}
>
<Text style={styles.loginButtonText}>Go to Login</Text>
</TouchableOpacity>
</View>
);
}

if (showVideoTrimmer && contentType === 'reel') {
const videoAsset = selectedMedia[0];
const videoUri = normalizeFileUri(videoAsset?.uri || videoAsset?.image?.uri || videoAsset?.originalUri);

return (
<VideoTrimmer
videoUri={videoUri}
videoDuration={videoDuration}
onTrimComplete={handleTrimComplete}
onCancel={handleTrimCancel}
/>
);
}

return (
<View style={styles.container}>
<StatusBar barStyle="light-content" backgroundColor="black" />

<View style={styles.header}>
<TouchableOpacity onPress={handleBack} style={styles.backButton}>
<Text style={styles.backText}>←</Text>
</TouchableOpacity>

<Text style={styles.headerTitle}>
New {contentType === 'reel' ? 'Reel' : 'Post'}
</Text>

<TouchableOpacity
onPress={uploadContent}
disabled={uploading || (contentType === 'reel' && videoNeedsTrimming && !trimmedVideo)}
style={[
styles.shareButton,
{ opacity: uploading || (contentType === 'reel' && videoNeedsTrimming && !trimmedVideo) ? 0.5 : 1 },
]}
>
{uploading ? (
<View style={styles.uploadingContainer}>
<ActivityIndicator color="#ed167e" size="small" />
{uploadProgress > 0 && (
<Text style={styles.progressText}>{uploadProgress}%</Text>
)}
</View>
) : (
<Text style={styles.shareText}>Share</Text>
)}
</TouchableOpacity>
</View>

{uploading && (
<View style={styles.progressBarContainer}>
<View style={[styles.progressBar, { width: `${uploadProgress}%` }]} />
<Text style={styles.uploadingText}>
{contentType === 'reel' ? 'Uploading video...' : 'Uploading images...'} {uploadProgress}%
{uploadRetries > 0 && ` (Retry ${uploadRetries}/3)`}
</Text>
</View>
)}

<ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
{renderMediaPreview()}

<View style={styles.captionSection}>
<View style={styles.userInfo}>
<Text style={styles.userName}>{user?.fullName || 'User'}</Text>
</View>
<TextInput
style={styles.captionInput}
placeholder={`Write a caption for your ${contentType === 'reel' ? 'video' : 'post'}...`}
placeholderTextColor="#888"
multiline
value={caption}
onChangeText={setCaption}
maxLength={2000}
textAlignVertical="top"
editable={!uploading}
/>
<Text style={styles.characterCount}>
{caption.length}/2000
</Text>
</View>

{/* Media Information Section */}
{/* <View style={styles.mediaInfoSection}>
<Text style={styles.mediaInfoTitle}>
📊 Media Information
</Text>

{contentType === 'reel' && selectedMedia[0] && (
<View style={styles.videoInfoContainer}>
<View style={styles.infoRow}>
<Text style={styles.infoLabel}>Duration:</Text>
<Text style={styles.infoValue}>
{trimmedVideo
? `${Math.round(trimmedVideo.duration)}s (trimmed)`
: videoDuration
? `${Math.round(videoDuration)}s`
: 'Unknown'
}
</Text>
</View>

<View style={styles.infoRow}>
<Text style={styles.infoLabel}>File Size:</Text>
<Text style={styles.infoValue}>
{selectedMedia[0].compressedSize
? formatFileSize(selectedMedia[0].compressedSize)
: mediaFileSizes[0]
? formatFileSize(mediaFileSizes[0])
: 'Calculating...'
}
</Text>
</View>

{selectedMedia[0].isCompressed && (
<>
<View style={styles.infoRow}>
<Text style={styles.infoLabel}>Original Size:</Text>
<Text style={styles.infoValue}>
{formatFileSize(selectedMedia[0].originalSize)}
</Text>
</View>

<View style={styles.infoRow}>
<Text style={styles.infoLabel}>Compression:</Text>
<Text style={[styles.infoValue, { color: '#4CAF50' }]}>
{Math.round(selectedMedia[0].compressionRatio)}% smaller
</Text>
</View>

<View style={styles.infoRow}>
<Text style={styles.infoLabel}>Method:</Text>
<Text style={styles.infoValue}>
{selectedMedia[0].compressionMethod || 'Unknown'}
</Text>
</View>
</>
)}
</View>
)}

{contentType === 'post' && (
<View style={styles.photosInfoContainer}>
<View style={styles.infoRow}>
<Text style={styles.infoLabel}>Photos Count:</Text>
<Text style={styles.infoValue}>{selectedMedia.length}</Text>
</View>

<View style={styles.infoRow}>
<Text style={styles.infoLabel}>Total Size:</Text>
<Text style={styles.infoValue}>
{Object.values(mediaFileSizes).length === selectedMedia.length
? formatFileSize(Object.values(mediaFileSizes).reduce((sum, size) => sum + size, 0))
: 'Calculating...'
}
</Text>
</View>

{Object.values(mediaFileSizes).length === selectedMedia.length && (
<View style={styles.photosListContainer}>
<Text style={styles.photosListTitle}>Individual Sizes:</Text>
{selectedMedia.map((_, index) => (
<View key={index} style={styles.photoSizeRow}>
<Text style={styles.photoIndexText}>Photo {index + 1}:</Text>
<Text style={styles.photoSizeText}>
{formatFileSize(mediaFileSizes[index] || 0)}
</Text>
</View>
))}
</View>
)}
</View>
)}
</View> */}

{trimmedVideo && (
<View style={styles.trimInfoSection}>
<Text style={styles.trimInfoTitle}>
✂️ Video Trimmed Successfully
</Text>
<Text style={styles.trimInfoText}>
Duration: <Text style={styles.trimInfoHighlight}>{Math.round(trimmedVideo.duration)}s</Text>
</Text>
<Text style={styles.trimInfoText}>
Method: <Text style={styles.trimInfoHighlight}>{trimmedVideo.method || 'local'}</Text>
</Text>
<Text style={styles.trimInfoText}>
Status: <Text style={styles.trimInfoHighlight}>Ready to upload</Text>
</Text>
</View>
)}

{uploading && (
<View style={styles.uploadingSection}>
<Text style={styles.uploadingTitle}>
{contentType === 'reel' ? 'Uploading Video...' : 'Uploading Images...'}
</Text>
<Text style={styles.uploadingSubtext}>
Please keep the app active while uploading.
{uploadRetries > 0 && ` Retry ${uploadRetries}/3 in progress.`}
</Text>
</View>
)}
</ScrollView>
</View>
);
};

export default EditPostScreen;

const styles = StyleSheet.create({
container: {
flex: 1,
backgroundColor: "black",
},
errorContainer: {
flex: 1,
backgroundColor: "black",
justifyContent: "center",
alignItems: "center",
padding: 20,
},
errorText: {
color: "#fff",
fontSize: 18,
fontWeight: "600",
marginBottom: 8,
textAlign: "center",
},
errorSubText: {
color: "#888",
fontSize: 14,
marginBottom: 20,
textAlign: "center",
},
loginButton: {
backgroundColor: "#ed167e",
paddingHorizontal: 20,
paddingVertical: 10,
borderRadius: 20,
},
loginButtonText: {
color: "#fff",
fontSize: 16,
fontWeight: "600",
},
header: {
flexDirection: "row",
justifyContent: "space-between",
alignItems: "center",
paddingHorizontal: 16,
paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 10 : 44,
paddingBottom: 12,
borderBottomWidth: 0.5,
borderBottomColor: "#333",
},
backButton: {
padding: 4,
},
backText: {
color: "#fff",
fontSize: 24,
fontWeight: "bold",
},
headerTitle: {
color: "#fff",
fontSize: 16,
fontWeight: "600",
},
shareButton: {
paddingVertical: 6,
paddingHorizontal: 12,
},
shareText: {
color: "#ed167e",
fontWeight: "600",
fontSize: 16,
},
uploadingContainer: {
flexDirection: "row",
alignItems: "center",
gap: 8,
},
progressText: {
color: "#ed167e",
fontSize: 12,
fontWeight: "600",
},
progressBarContainer: {
backgroundColor: "#111",
},
progressBar: {
height: 3,
backgroundColor: "#ed167e",
borderRadius: 2,
},
uploadingText: {
color: "#fff",
fontSize: 12,
textAlign: "center",
paddingVertical: 8
},
content: {
flex: 1,
},
mediaPreview: {
height: width,
backgroundColor: "#1a1a1a",
},
mediaPreviewError: {
height: width,
backgroundColor: "#1a1a1a",
justifyContent: "center",
alignItems: "center",
},
retryButton: {
backgroundColor: "#ed167e",
paddingHorizontal: 16,
paddingVertical: 8,
borderRadius: 16,
marginTop: 12,
},
retryText: {
color: "#fff",
fontSize: 14,
fontWeight: "600",
},
videoPreview: {
width: "100%",
height: "100%",
},
durationCheckOverlay: {
position: "absolute",
top: 0,
left: 0,
right: 0,
bottom: 0,
backgroundColor: "rgba(0,0,0,0.7)",
justifyContent: "center",
alignItems: "center",
},
durationCheckText: {
color: "#fff",
fontSize: 16,
fontWeight: "600",
marginTop: 12,
},
photoContainer: {
width: width,
height: width,
position: "relative",
},
photoPreview: {
width: "100%",
height: "100%",
},
imageError: {
width: "100%",
height: "100%",
justifyContent: "center",
alignItems: "center",
backgroundColor: "#333",
},
photoIndicator: {
position: "absolute",
top: 16,
right: 16,
backgroundColor: "rgba(0,0,0,0.7)",
paddingHorizontal: 8,
paddingVertical: 4,
borderRadius: 12,
},
photoIndicatorText: {
color: "#fff",
fontSize: 12,
fontWeight: "600",
},
mediaTypeIndicator: {
position: "absolute",
bottom: 16,
left: 16,
backgroundColor: "rgba(237, 22, 126, 0.9)",
paddingHorizontal: 8,
paddingVertical: 4,
borderRadius: 12,
},
mediaTypeText: {
color: "#fff",
fontSize: 10,
fontWeight: "600",
},
durationIndicator: {
position: "absolute",
top: 16,
right: 16,
backgroundColor: "rgba(0,0,0,0.8)",
paddingHorizontal: 10,
paddingVertical: 6,
borderRadius: 12,
borderWidth: 1,
borderColor: "rgba(255,255,255,0.2)",
},
durationText: {
color: "#fff",
fontSize: 12,
fontWeight: "600",
},
fileSizeIndicator: {
position: "absolute",
top: 50,
right: 16,
backgroundColor: "rgba(0,0,0,0.8)",
paddingHorizontal: 10,
paddingVertical: 6,
borderRadius: 12,
borderWidth: 1,
borderColor: "rgba(255,255,255,0.2)",
minWidth: 120,
},
fileSizeRow: {
flexDirection: "row",
alignItems: "center",
marginBottom: 2,
},
fileSizeText: {
color: "#fff",
fontSize: 12,
fontWeight: "600",
marginLeft: 4,
},
compressionInfoRow: {
flexDirection: "row",
alignItems: "center",
marginBottom: 2,
},
compressionInfoText: {
color: "#4CAF50",
fontSize: 10,
fontWeight: "600",
marginLeft: 4,
},
originalSizeText: {
color: "#888",
fontSize: 10,
fontStyle: "italic",
},
imageFileSizeIndicator: {
position: "absolute",
bottom: 16,
right: 16,
backgroundColor: "rgba(0,0,0,0.7)",
paddingHorizontal: 8,
paddingVertical: 4,
borderRadius: 12,
},
imageFileSizeText: {
color: "#fff",
fontSize: 11,
fontWeight: "600",
},
trimStatusIndicator: {
position: "absolute",
top: 84,
right: 16,
paddingHorizontal: 10,
paddingVertical: 6,
borderRadius: 12,
borderWidth: 1,
borderColor: "rgba(255,255,255,0.3)",
},
trimStatusText: {
color: "#fff",
fontSize: 11,
fontWeight: "600",
},
compressionStatusIndicator: {
position: "absolute",
top: 16,
left: 16,
backgroundColor: "rgba(76, 175, 80, 0.9)",
paddingHorizontal: 10,
paddingVertical: 6,
borderRadius: 12,
flexDirection: "row",
alignItems: "center",
},
compressionStatusText: {
color: "#fff",
fontSize: 11,
fontWeight: "600",
marginLeft: 4,
},
trimButton: {
position: "absolute",
top: "50%",
left: "50%",
transform: [{ translateX: -60 }, { translateY: -20 }],
backgroundColor: "#ed167e",
paddingHorizontal: 16,
paddingVertical: 8,
borderRadius: 20,
},
trimButtonText: {
color: "#fff",
fontSize: 14,
fontWeight: "600",
},
captionSection: {
padding: 16,
borderBottomWidth: 0.5,
borderBottomColor: "#333",
},
userInfo: {
flexDirection: "row",
alignItems: "center",
marginBottom: 12,
gap: 8,
},
userName: {
color: "#fff",
fontSize: 16,
fontWeight: "600",
},
captionInput: {
color: "#fff",
fontSize: 16,
minHeight: 100,
padding: 0,
textAlignVertical: "top",
},
characterCount: {
color: "#888",
fontSize: 12,
textAlign: "right",
marginTop: 8,
},
// mediaInfoSection: {
// padding: 16,
// backgroundColor: "#111",
// marginHorizontal: 16,
// borderRadius: 12,
// marginBottom: 16,
// },
// mediaInfoTitle: {
// color: "#fff",
// fontSize: 16,
// fontWeight: "600",
// marginBottom: 12,
// textAlign: "center",
// },
// videoInfoContainer: {
// gap: 8,
// },
// photosInfoContainer: {
// gap: 8,
// },
// infoRow: {
// flexDirection: "row",
// justifyContent: "space-between",
// alignItems: "center",
// paddingVertical: 4,
// },
// infoLabel: {
// color: "#888",
// fontSize: 14,
// },
// infoValue: {
// color: "#fff",
// fontSize: 14,
// fontWeight: "600",
// },
// photosListContainer: {
// marginTop: 8,
// paddingTop: 8,
// borderTopWidth: 1,
// borderTopColor: "#333",
// },
// photosListTitle: {
// color: "#ccc",
// fontSize: 12,
// marginBottom: 8,
// },
// photoSizeRow: {
// flexDirection: "row",
// justifyContent: "space-between",
// alignItems: "center",
// paddingVertical: 2,
// },
// photoIndexText: {
// color: "#888",
// fontSize: 12,
// },
// photoSizeText: {
// color: "#fff",
// fontSize: 12,
// fontWeight: "500",
// },
uploadingSection: {
padding: 16,
alignItems: "center",
backgroundColor: "#111",
marginTop: 16,
borderRadius: 12,
marginHorizontal: 16,
},
uploadingTitle: {
color: "#fff",
fontSize: 16,
fontWeight: "600",
marginBottom: 4,
},
uploadingSubtext: {
color: "#888",
fontSize: 12,
textAlign: "center",
lineHeight: 16,
},
trimInfoSection: {
padding: 16,
backgroundColor: "#1a1a1a",
margin: 16,
borderRadius: 12,
borderWidth: 1,
borderColor: "#333",
},
trimInfoTitle: {
color: "#4CAF50",
fontSize: 14,
fontWeight: "600",
marginBottom: 8,
textAlign: "center",
},
trimInfoText: {
color: "#ccc",
fontSize: 12,
marginBottom: 4,
textAlign: "center",
},
trimInfoHighlight: {
color: "#fff",
fontWeight: "600",
},
});