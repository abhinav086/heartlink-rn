import React, { useEffect, useState, useRef } from "react";
import {
View,
Text,
TouchableOpacity,
StyleSheet,
Dimensions,
StatusBar,
Alert,
Animated,
ScrollView,
Image,
ActivityIndicator,
Modal,
PanResponder,
} from "react-native";
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { useIsFocused } from "@react-navigation/native";
import Icon from 'react-native-vector-icons/Ionicons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import ImageCropPicker from 'react-native-image-crop-picker';
import { Video } from 'react-native-compressor';
import RNFS from 'react-native-fs';

const { width, height } = Dimensions.get("window");
const MAX_PHOTOS = 10;

// Video Compression Modal Component
const VideoCompressionModal = ({ visible, onComplete, onCancel, videoUri, originalSize }) => {
const [compressionProgress, setCompressionProgress] = useState(0);
const [compressionStage, setCompressionStage] = useState('preparing');
const [compressedSize, setCompressedSize] = useState(null);
const [compressionRatio, setCompressionRatio] = useState(null);
const [compressionCancelled, setCompressionCancelled] = useState(false);

const compressionStages = {
preparing: 'Preparing video for compression...',
analyzing: 'Analyzing video properties...',
compressing: 'Processing video...',
finalizing: 'Finalizing compressed video...',
completed: 'Compression completed!',
error: 'Compression failed'
};

useEffect(() => {
if (visible && videoUri) {
compressVideo();
}
}, [visible, videoUri]);

const formatFileSize = (bytes) => {
if (bytes === 0) return '0 Bytes';
const k = 1024;
const sizes = ['Bytes', 'KB', 'MB', 'GB'];
const i = Math.floor(Math.log(bytes) / Math.log(k));
return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const compressVideo = async () => {
try {
setCompressionCancelled(false);
setCompressionStage('preparing');
setCompressionProgress(0);

console.log('🎬 Starting video compression for:', videoUri);

// Check if original file exists and get its size
setCompressionStage('analyzing');
setCompressionProgress(10);

const fileExists = await RNFS.exists(videoUri.replace('file://', ''));
if (!fileExists) {
throw new Error('Original video file not found');
}

const originalFileInfo = await RNFS.stat(videoUri.replace('file://', ''));
const actualOriginalSize = originalFileInfo.size;
console.log('📊 Original file size:', formatFileSize(actualOriginalSize));

setCompressionStage('compressing');
setCompressionProgress(20);

// Compression options
const compressionOptions = {
compressionMethod: 'auto', // 'auto', 'manual'
quality: 'medium', // 'low', 'medium', 'high'
input: videoUri,
output: undefined, // Let the library generate output path
getCancellationId: (cancellationId) => {
console.log('📝 Compression cancellation ID:', cancellationId);
},
progressDivider: 10,
includeAudio: true,
optimizeForNetworkUse: true,
minimumFileSizeForCompress: 2, // Only compress if larger than 2MB
};

const compressedVideoUri = await Video.compress(
videoUri,
compressionOptions,
(progress) => {
const adjustedProgress = 20 + (progress * 0.7); // Progress from 20% to 90%
setCompressionProgress(Math.round(adjustedProgress));
console.log('📊 Compression progress:', Math.round(progress), '%');
}
);

if (compressionCancelled) {
console.log('❌ Compression was cancelled');
return;
}

setCompressionStage('finalizing');
setCompressionProgress(95);

// Get compressed file size
const compressedFileInfo = await RNFS.stat(compressedVideoUri.replace('file://', ''));
const finalCompressedSize = compressedFileInfo.size;
const ratio = ((actualOriginalSize - finalCompressedSize) / actualOriginalSize) * 100;

setCompressedSize(finalCompressedSize);
setCompressionRatio(ratio);
setCompressionProgress(100);
setCompressionStage('completed');

console.log('✅ Video compression completed!');
console.log('📊 Original size:', formatFileSize(actualOriginalSize));
console.log('📊 Compressed size:', formatFileSize(finalCompressedSize));
console.log('📊 Compression ratio:', Math.round(ratio), '%');

// Wait a moment to show completion
setTimeout(() => {
onComplete({
uri: compressedVideoUri,
originalSize: actualOriginalSize,
compressedSize: finalCompressedSize,
compressionRatio: ratio,
compressionMethod: 'react-native-compressor'
});
}, 1000);

} catch (error) {
console.error('❌ Video compression failed:', error);
setCompressionStage('error');

if (error.message.includes('cancelled') || compressionCancelled) {
onCancel();
return;
}

Alert.alert(
"Compression Failed",
`Video compression failed: ${error.message}\n\nWould you like to use the original video?`,
[
{
text: "Cancel",
style: "cancel",
onPress: onCancel
},
{
text: "Use Original",
onPress: () => {
onComplete({
uri: videoUri,
originalSize: originalSize,
compressedSize: originalSize,
compressionRatio: 0,
compressionMethod: 'none',
compressionFailed: true
});
}
}
]
);
}
};

const handleCancel = () => {
setCompressionCancelled(true);
onCancel();
};

if (!visible) return null;

return (
<Modal
visible={visible}
animationType="slide"
transparent={true}
onRequestClose={handleCancel}
>
<View style={compressionStyles.overlay}>
<View style={compressionStyles.container}>
<View style={compressionStyles.header}>
<Text style={compressionStyles.title}>Processing Video</Text>
<TouchableOpacity
onPress={handleCancel}
style={compressionStyles.cancelButton}
>
<MaterialIcons name="close" size={24} color="#fff" />
</TouchableOpacity>
</View>

<View style={compressionStyles.content}>
<View style={compressionStyles.progressContainer}>
<View style={compressionStyles.progressCircle}>
<Text style={compressionStyles.progressText}>{compressionProgress}%</Text>
</View>

<View style={compressionStyles.progressBarContainer}>
<View
style={[
compressionStyles.progressBar,
{ width: `${compressionProgress}%` }
]}
/>
</View>
</View>

<Text style={compressionStyles.stageText}>
{compressionStages[compressionStage]}
</Text>

{/* {originalSize && (
<View style={compressionStyles.sizeInfo}>
<Text style={compressionStyles.sizeLabel}>Original Size:</Text>
<Text style={compressionStyles.sizeValue}>{formatFileSize(originalSize)}</Text>
</View>
)} */}

{/* {compressedSize && (
<View style={compressionStyles.sizeInfo}>
<Text style={compressionStyles.sizeLabel}>Compressed Size:</Text>
<Text style={compressionStyles.sizeValue}>{formatFileSize(compressedSize)}</Text>
</View>
)} */}

{/* {compressionRatio !== null && (
<View style={compressionStyles.sizeInfo}>
<Text style={compressionStyles.sizeLabel}>Space Saved:</Text>
<Text style={[compressionStyles.sizeValue, { color: '#4CAF50' }]}>
{Math.round(compressionRatio)}%
</Text>
</View>
)} */}

{compressionStage === 'completed' && (
<View style={compressionStyles.completedIndicator}>
<MaterialIcons name="check-circle" size={48} color="#4CAF50" />
<Text style={compressionStyles.completedText}>
Video Processed successfully!
</Text>
</View>
)}

{compressionStage === 'error' && (
<View style={compressionStyles.errorIndicator}>
<MaterialIcons name="error" size={48} color="#f44336" />
<Text style={compressionStyles.errorText}>
Compression failed. Please try again.
</Text>
</View>
)}
</View>
</View>
</View>
</Modal>
);
};

// Enhanced Image Cropping Modal with Better Sensitivity
const ImageCropModal = ({ visible, imageUri, onCrop, onCancel }) => {
const [cropArea, setCropArea] = useState({
x: 50,
y: 100,
width: width - 100,
height: width - 100,
});
const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
const [imageLayout, setImageLayout] = useState({
x: 0,
y: 0,
width: 0,
height: 0
});
const [isMoving, setIsMoving] = useState(false);
const [isResizing, setIsResizing] = useState(false);
const [isProcessing, setIsProcessing] = useState(false);

// Refs for gesture tracking
const lastPan = useRef({ x: 0, y: 0 });
const lastResize = useRef({ width: 0, height: 0 });

// Reset crop area when modal opens
useEffect(() => {
if (visible) {
const defaultSize = Math.min(width - 100, 250);
setCropArea({
x: (width - defaultSize) / 2,
y: 150,
width: defaultSize,
height: defaultSize,
});
lastPan.current = { x: 0, y: 0 };
lastResize.current = { width: 0, height: 0 };

// Reset layout data
setImageLayout({ x: 0, y: 0, width: 0, height: 0 });
setImageSize({ width: 0, height: 0 });
}
}, [visible, imageUri]);

// Enhanced pan responder for dragging with reduced sensitivity
const panResponder = useRef(
PanResponder.create({
onStartShouldSetPanResponder: () => true,
onMoveShouldSetPanResponder: (evt, gestureState) => {
return Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5;
},
onPanResponderGrant: (evt, gestureState) => {
setIsMoving(true);
lastPan.current = { x: cropArea.x, y: cropArea.y };
},
onPanResponderMove: (evt, gestureState) => {
const sensitivity = 0.8;
const dx = gestureState.dx * sensitivity;
const dy = gestureState.dy * sensitivity;

setCropArea(prev => {
const newX = Math.max(
0,
Math.min(
width - prev.width,
lastPan.current.x + dx
)
);
const newY = Math.max(
100,
Math.min(
height - 150 - prev.height,
lastPan.current.y + dy
)
);

return {
...prev,
x: newX,
y: newY,
};
});
},
onPanResponderRelease: () => {
setIsMoving(false);
},
})
).current;

const createResizeResponder = (corner) => {
return PanResponder.create({
onStartShouldSetPanResponder: () => true,
onMoveShouldSetPanResponder: (evt, gestureState) => {
return Math.abs(gestureState.dx) > 3 || Math.abs(gestureState.dy) > 3;
},
onPanResponderGrant: () => {
setIsResizing(true);
lastResize.current = {
width: cropArea.width,
height: cropArea.height,
x: cropArea.x,
y: cropArea.y
};
},
onPanResponderMove: (evt, gestureState) => {
const sensitivity = 0.6;
const dx = gestureState.dx * sensitivity;
const dy = gestureState.dy * sensitivity;

setCropArea(prev => {
let newArea = { ...prev };
const minSize = 80;
const maxWidth = width - 20;
const maxHeight = height - 250;

switch (corner) {
case 'bottomRight':
newArea.width = Math.max(
minSize,
Math.min(
maxWidth - prev.x,
lastResize.current.width + dx
)
);
newArea.height = Math.max(
minSize,
Math.min(
maxHeight - (prev.y - 100),
lastResize.current.height + dy
)
);
break;

case 'bottomLeft':
const newWidthLeft = lastResize.current.width - dx;
const newXLeft = lastResize.current.x + dx;
if (newWidthLeft >= minSize && newXLeft >= 10) {
newArea.width = newWidthLeft;
newArea.x = newXLeft;
}
newArea.height = Math.max(
minSize,
Math.min(
maxHeight - (prev.y - 100),
lastResize.current.height + dy
)
);
break;

case 'topRight':
newArea.width = Math.max(
minSize,
Math.min(
maxWidth - prev.x,
lastResize.current.width + dx
)
);
const newHeightTop = lastResize.current.height - dy;
const newYTop = lastResize.current.y + dy;
if (newHeightTop >= minSize && newYTop >= 110) {
newArea.height = newHeightTop;
newArea.y = newYTop;
}
break;

case 'topLeft':
const newWidthTopLeft = lastResize.current.width - dx;
const newXTopLeft = lastResize.current.x + dx;
const newHeightTopLeft = lastResize.current.height - dy;
const newYTopLeft = lastResize.current.y + dy;

if (newWidthTopLeft >= minSize && newXTopLeft >= 10) {
newArea.width = newWidthTopLeft;
newArea.x = newXTopLeft;
}
if (newHeightTopLeft >= minSize && newYTopLeft >= 110) {
newArea.height = newHeightTopLeft;
newArea.y = newYTopLeft;
}
break;
}

return newArea;
});
},
onPanResponderRelease: () => {
setIsResizing(false);
},
});
};

const bottomRightResize = useRef(createResizeResponder('bottomRight')).current;
const bottomLeftResize = useRef(createResizeResponder('bottomLeft')).current;
const topRightResize = useRef(createResizeResponder('topRight')).current;
const topLeftResize = useRef(createResizeResponder('topLeft')).current;

const handleImageLoad = (event) => {
const { width: imgWidth, height: imgHeight } = event.nativeEvent;
setImageSize({ width: imgWidth, height: imgHeight });

const headerHeight = 100;
const toolsHeight = 50;
const footerHeight = 50;
const containerHeight = height - headerHeight - toolsHeight - footerHeight;
const containerWidth = width;

const imageAspectRatio = imgWidth / imgHeight;
const containerAspectRatio = containerWidth / containerHeight;

let displayWidth, displayHeight, offsetX, offsetY;

if (imageAspectRatio > containerAspectRatio) {
displayWidth = containerWidth;
displayHeight = containerWidth / imageAspectRatio;
offsetX = 0;
offsetY = (containerHeight - displayHeight) / 2 + headerHeight + toolsHeight;
} else {
displayHeight = containerHeight;
displayWidth = containerHeight * imageAspectRatio;
offsetX = (containerWidth - displayWidth) / 2;
offsetY = headerHeight + toolsHeight;
}

setImageLayout({
x: offsetX,
y: offsetY,
width: displayWidth,
height: displayHeight,
});
};

const calculateCropCoordinates = () => {
if (!imageSize.width || !imageSize.height) {
const defaultSize = Math.min(cropArea.width, cropArea.height);
return {
x: 0,
y: 0,
width: defaultSize * 2,
height: defaultSize * 2,
};
}

const screenCropWidth = cropArea.width;
const screenCropHeight = cropArea.height;

const screenWidthPercent = screenCropWidth / width;
const screenHeightPercent = screenCropHeight / (height - 200);

const cropWidth = Math.round(imageSize.width * screenWidthPercent);
const cropHeight = Math.round(imageSize.height * screenHeightPercent);

const xPercent = Math.max(0, (cropArea.x - 50) / (width - 100));
const yPercent = Math.max(0, (cropArea.y - 150) / (height - 300));

const cropX = Math.round(imageSize.width * xPercent);
const cropY = Math.round(imageSize.height * yPercent);

const finalX = Math.max(0, Math.min(cropX, imageSize.width - cropWidth));
const finalY = Math.max(0, Math.min(cropY, imageSize.height - cropHeight));
const finalWidth = Math.min(cropWidth, imageSize.width - finalX);
const finalHeight = Math.min(cropHeight, imageSize.height - finalY);

const coords = {
x: finalX,
y: finalY,
width: Math.max(50, finalWidth),
height: Math.max(50, finalHeight),
};

return coords;
};

const handleCrop = async () => {
if (isProcessing) return;

setIsProcessing(true);

try {
const cropCoords = calculateCropCoordinates();

if (!cropCoords) {
setIsProcessing(false);
return;
}

const croppedImage = await ImageCropPicker.openCropper({
path: imageUri,
width: cropCoords.width,
height: cropCoords.height,
cropperCircleOverlay: false,
cropperRotateButtonsHidden: true,
cropperChooseText: 'Choose',
cropperCancelText: 'Cancel',
includeBase64: false,
compressImageQuality: 0.8,
freeStyleCropEnabled: true,
showCropGuidelines: true,
showCropFrame: true,
hideBottomControls: true,
enableRotationGesture: false,
disableCropperColorSetters: true,
cropperToolbarTitle: 'Crop Image',
cropperStatusBarColor: '#000000',
cropperToolbarColor: '#000000',
cropperActiveWidgetColor: '#ed167e',
cropperToolbarWidgetColor: '#ffffff',
});

const cropData = {
uri: croppedImage.path,
originalUri: imageUri,
cropArea: cropCoords,
originalSize: imageSize,
croppedSize: {
width: croppedImage.width,
height: croppedImage.height,
},
};

onCrop(cropData);

} catch (error) {
console.error('Cropping error:', error);

if (error.message === 'User cancelled image selection') {
setIsProcessing(false);
return;
}

try {
const cropData = {
uri: imageUri,
originalUri: imageUri,
cropArea: calculateCropCoordinates(),
originalSize: imageSize,
croppedSize: imageSize,
isCropped: true,
cropApplied: false,
};

Alert.alert(
"Crop Preview",
"Showing crop area preview. For actual cropping, please install react-native-image-crop-picker properly.",
[{ text: "OK", onPress: () => onCrop(cropData) }]
);

} catch (fallbackError) {
console.error('Fallback also failed:', fallbackError);
Alert.alert("Error", "Failed to crop image. Please try again.");
}
} finally {
setIsProcessing(false);
}
};

const makeSquare = () => {
setCropArea(prev => {
const size = Math.min(prev.width, prev.height, width - 40);
return {
...prev,
width: size,
height: size,
};
});
};

const resetCrop = () => {
const defaultSize = Math.min(width - 100, 250);
setCropArea({
x: (width - defaultSize) / 2,
y: 150,
width: defaultSize,
height: defaultSize,
});
};

if (!visible) return null;

return (
<Modal
visible={visible}
animationType="slide"
statusBarTranslucent
onRequestClose={onCancel}
>
<View style={cropStyles.container}>
<StatusBar barStyle="light-content" backgroundColor="black" />

<View style={cropStyles.header}>
<TouchableOpacity onPress={onCancel} style={cropStyles.cancelButton}>
<Text style={cropStyles.cancelText}>Cancel</Text>
</TouchableOpacity>

<Text style={cropStyles.headerTitle}>Crop Photo</Text>

<TouchableOpacity
onPress={handleCrop}
style={[cropStyles.doneButton, { opacity: isProcessing ? 0.5 : 1 }]}
disabled={isProcessing}
>
{isProcessing ? (
<ActivityIndicator size="small" color="#ed167e" />
) : (
<Text style={cropStyles.doneText}>Done</Text>
)}
</TouchableOpacity>
</View>

<View style={cropStyles.toolsContainer}>
<TouchableOpacity onPress={resetCrop} style={cropStyles.toolButton}>
<MaterialIcons name="refresh" size={18} color="#fff" />
<Text style={cropStyles.toolText}>Reset</Text>
</TouchableOpacity>

<TouchableOpacity onPress={makeSquare} style={cropStyles.toolButton}>
<MaterialIcons name="crop-square" size={18} color="#fff" />
<Text style={cropStyles.toolText}>Square</Text>
</TouchableOpacity>
</View>

<View style={cropStyles.imageContainer}>
<Image
source={{ uri: imageUri }}
style={cropStyles.image}
resizeMode="contain"
onLoad={handleImageLoad}
onError={(error) => {
console.log('Image load error:', error);
Alert.alert("Error", "Failed to load image for cropping");
}}
/>

<View style={cropStyles.overlay}>
<View style={[cropStyles.overlayPart, { height: cropArea.y }]} />

<View style={[cropStyles.overlayRow, { top: cropArea.y, height: cropArea.height }]}>
<View style={[cropStyles.overlayPart, { width: cropArea.x }]} />
<View style={[cropStyles.overlayPart, {
left: cropArea.x + cropArea.width,
width: width - cropArea.x - cropArea.width
}]} />
</View>

<View style={[
cropStyles.overlayPart,
{
top: cropArea.y + cropArea.height,
height: height - cropArea.y - cropArea.height
}
]} />

<View
style={[
cropStyles.cropArea,
{
left: cropArea.x,
top: cropArea.y,
width: cropArea.width,
height: cropArea.height,
borderColor: (isMoving || isResizing) ? '#ff4081' : '#ed167e',
borderWidth: (isMoving || isResizing) ? 3 : 2,
},
]}
{...panResponder.panHandlers}
>
<View style={[cropStyles.gridLine, { top: '33%', width: '100%', height: 1 }]} />
<View style={[cropStyles.gridLine, { top: '66%', width: '100%', height: 1 }]} />
<View style={[cropStyles.gridLine, { left: '33%', height: '100%', width: 1 }]} />
<View style={[cropStyles.gridLine, { left: '66%', height: '100%', width: 1 }]} />

<View
style={[cropStyles.cornerHandle, cropStyles.topLeft]}
{...topLeftResize.panHandlers}
/>
<View
style={[cropStyles.cornerHandle, cropStyles.topRight]}
{...topRightResize.panHandlers}
/>
<View
style={[cropStyles.cornerHandle, cropStyles.bottomLeft]}
{...bottomLeftResize.panHandlers}
/>
<View
style={[cropStyles.cornerHandle, cropStyles.bottomRight]}
{...bottomRightResize.panHandlers}
/>

<View style={cropStyles.centerIndicator}>
<MaterialIcons name="drag-indicator" size={16} color="rgba(255,255,255,0.8)" />
</View>
</View>
</View>
</View>

<View style={cropStyles.instructionsContainer}>
<Text style={cropStyles.instructionsText}>
Drag crop area to move • Use corner handles to resize • Reduced sensitivity for precise control
</Text>
</View>
</View>
</Modal>
);
};

const CreateScreen = ({ navigation }) => {
const [selectedMedia, setSelectedMedia] = useState([]);
const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
const [contentMode, setContentMode] = useState("photo");
const [sliderAnimation] = useState(new Animated.Value(0));
const [imageLoading, setImageLoading] = useState({});
const [showCropModal, setShowCropModal] = useState(false);
const [croppedImageUri, setCroppedImageUri] = useState(null);

// Video compression states
const [showCompressionModal, setShowCompressionModal] = useState(false);
const [videoToCompress, setVideoToCompress] = useState(null);
const [compressionInProgress, setCompressionInProgress] = useState(false);

const isFocused = useIsFocused();

// Reset when mode changes or screen is focused
useEffect(() => {
if (isFocused) {
setSelectedMedia([]);
setIsMultiSelectMode(false);
setImageLoading({});
setShowCropModal(false);
setCroppedImageUri(null);
setShowCompressionModal(false);
setVideoToCompress(null);
setCompressionInProgress(false);
}
}, [contentMode, isFocused]);

// Animate slider when mode changes
useEffect(() => {
Animated.timing(sliderAnimation, {
toValue: contentMode === "reel" ? 1 : 0,
duration: 200,
useNativeDriver: false,
}).start();
}, [contentMode, sliderAnimation]);

// Helper function to format file size
const formatFileSize = (bytes) => {
if (bytes === 0) return '0 Bytes';
const k = 1024;
const sizes = ['Bytes', 'KB', 'MB', 'GB'];
const i = Math.floor(Math.log(bytes) / Math.log(k));
return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Get file size for any URI
const getFileSize = async (uri) => {
try {
const cleanUri = uri.replace('file://', '');
const fileInfo = await RNFS.stat(cleanUri);
return fileInfo.size;
} catch (error) {
console.log('Could not get file size for:', uri);
return 0;
}
};

// Video compression handler
const handleVideoSelected = async (videoAsset) => {
console.log('🎬 Video selected, checking if compression is needed...');

try {
// Get original file size
const originalSize = await getFileSize(videoAsset.uri);
console.log('📊 Original video size:', formatFileSize(originalSize));

// Only compress if video is larger than 5MB
if (originalSize > 5 * 1024 * 1024) {
console.log('📦 Video is large, starting compression...');
setVideoToCompress({ ...videoAsset, originalSize });
setShowCompressionModal(true);
setCompressionInProgress(true);
} else {
console.log('✅ Video is small enough, no compression needed');
// Add size info to the video asset
const enhancedAsset = {
...videoAsset,
originalSize,
compressedSize: originalSize,
compressionRatio: 0,
compressionMethod: 'none'
};
setSelectedMedia([enhancedAsset]);
}
} catch (error) {
console.error('❌ Error checking video size:', error);
// Still proceed with the video even if we can't get size
setSelectedMedia([videoAsset]);
}
};

// Handle compression completion
const handleCompressionComplete = (compressionResult) => {
console.log('✅ Compression completed:', compressionResult);

const enhancedAsset = {
...videoToCompress,
uri: compressionResult.uri,
originalUri: videoToCompress.uri,
originalSize: compressionResult.originalSize,
compressedSize: compressionResult.compressedSize,
compressionRatio: compressionResult.compressionRatio,
compressionMethod: compressionResult.compressionMethod,
compressionFailed: compressionResult.compressionFailed || false,
isCompressed: compressionResult.compressionRatio > 0
};

setSelectedMedia([enhancedAsset]);
setShowCompressionModal(false);
setCompressionInProgress(false);
setVideoToCompress(null);
};

// Handle compression cancellation
const handleCompressionCancel = () => {
console.log('❌ Video compression cancelled');
setShowCompressionModal(false);
setCompressionInProgress(false);
setVideoToCompress(null);
// Don't set any media, user needs to select again
};

// FIXED: Better gallery opening with enhanced video support and compression
const openGallery = () => {
// Base options for both photo and video
const baseOptions = {
mediaType: contentMode === "reel" ? 'video' : 'photo',
quality: 0.8,
selectionLimit: contentMode === "reel" ? 1 : (isMultiSelectMode ? MAX_PHOTOS : 1),
presentationStyle: 'fullScreen',
includeBase64: false,
allowsEditing: false,
};

// Add specific options based on content type
const options = contentMode === "reel"
? {
...baseOptions,
videoQuality: 'high',
durationLimit: 300, // 5 minutes max
// Don't set maxWidth/maxHeight for videos to avoid errors
}
: {
...baseOptions,
maxWidth: 1080,
maxHeight: 1080,
};

console.log('🎬 Opening gallery with options:', options);

launchImageLibrary(options, (response) => {
console.log('📱 Gallery picker response:', response);

if (response.didCancel) {
console.log('User cancelled gallery picker');
return;
}

if (response.errorCode) {
console.log('Gallery picker error code:', response.errorCode);
Alert.alert("Gallery Error", `Error: ${response.errorCode}. Please try again.`);
return;
}

if (response.errorMessage) {
console.log('Gallery picker error message:', response.errorMessage);
Alert.alert("Gallery Error", "Failed to open gallery. Please check permissions and try again.");
return;
}

if (!response.assets || response.assets.length === 0) {
console.log('No assets selected from gallery');
Alert.alert("No Media Selected", "Please select a file and try again.");
return;
}

if (response.assets && response.assets.length > 0) {
try {
// ENHANCED: Better media conversion with validation
const convertedMedia = response.assets.map((asset, index) => {
console.log(`📱 Converting asset ${index + 1}:`, {
uri: asset.uri,
type: asset.type,
fileSize: asset.fileSize,
duration: asset.duration,
width: asset.width,
height: asset.height,
fileName: asset.fileName
});

// Validate video assets
if (contentMode === "reel") {
if (!asset.uri) {
console.error('❌ Video asset missing URI');
throw new Error('Video file is not accessible');
}

if (asset.type && !asset.type.startsWith('video/')) {
console.warn('⚠️ Selected file may not be a video:', asset.type);
}
}

return {
id: `${Date.now()}_${index}`,
uri: asset.uri, // Primary URI
image: { uri: asset.uri }, // For compatibility
originalUri: asset.uri, // Store original
type: asset.type || (contentMode === "reel" ? 'video/mp4' : 'image/jpeg'),
timestamp: asset.timestamp || Date.now(),
location: asset.location || null,
width: asset.width,
height: asset.height,
fileSize: asset.fileSize,
duration: asset.duration, // Important for videos
fileName: asset.fileName || `${contentMode}_${Date.now()}.${contentMode === 'reel' ? 'mp4' : 'jpg'}`,
};
});

console.log('✅ Converted media:', convertedMedia);

// Handle video compression for reels
if (contentMode === "reel" && convertedMedia.length > 0) {
handleVideoSelected(convertedMedia[0]);
} else {
setSelectedMedia(convertedMedia);
setCroppedImageUri(null);
}
} catch (error) {
console.error('❌ Error converting gallery media:', error);
Alert.alert("Media Error", error.message || "Failed to process selected media. Please try again.");
}
}
});
};

// FIXED: Better camera opening with enhanced video support and compression
const openCamera = () => {
// Base options for both photo and video
const baseOptions = {
mediaType: contentMode === "reel" ? 'video' : 'photo',
quality: 0.9,
presentationStyle: 'fullScreen',
includeBase64: false,
allowsEditing: false,
};

// Add specific options based on content type
const options = contentMode === "reel"
? {
...baseOptions,
videoQuality: 'high',
durationLimit: 300, // 5 minutes max for videos
// Don't set maxWidth/maxHeight for videos to avoid errors
}
: {
...baseOptions,
maxWidth: 1080,
maxHeight: 1080,
};

console.log('📷 Opening camera with options:', options);

launchCamera(options, (response) => {
console.log('📷 Camera response:', response);

if (response.didCancel) {
console.log('User cancelled camera');
return;
}

if (response.errorCode) {
console.log('Camera error code:', response.errorCode);
Alert.alert("Camera Error", `Error: ${response.errorCode}. Please try again.`);
return;
}

if (response.errorMessage) {
console.log('Camera error message:', response.errorMessage);
Alert.alert("Camera Error", "Failed to open camera. Please check permissions and try again.");
return;
}

if (!response.assets || response.assets.length === 0) {
console.log('No assets captured from camera');
Alert.alert("No Media Captured", "Please capture media and try again.");
return;
}

if (response.assets && response.assets.length > 0) {
try {
const asset = response.assets[0];
console.log('📷 Camera asset:', {
uri: asset.uri,
type: asset.type,
fileSize: asset.fileSize,
duration: asset.duration,
width: asset.width,
height: asset.height,
fileName: asset.fileName
});

// Validate camera asset
if (!asset.uri) {
console.error('❌ Camera asset missing URI');
throw new Error('Captured media is not accessible. Please try again.');
}

if (contentMode === "reel" && asset.type && !asset.type.startsWith('video/')) {
console.warn('⚠️ Captured file may not be a video:', asset.type);
}

// ENHANCED: Better camera media conversion
const convertedMedia = {
id: `${Date.now()}_camera`,
uri: asset.uri,
image: { uri: asset.uri },
originalUri: asset.uri,
type: asset.type || (contentMode === "reel" ? 'video/mp4' : 'image/jpeg'),
timestamp: asset.timestamp || Date.now(),
location: asset.location || null,
width: asset.width,
height: asset.height,
fileSize: asset.fileSize,
duration: asset.duration,
fileName: asset.fileName || `camera_${contentMode}_${Date.now()}.${contentMode === 'reel' ? 'mp4' : 'jpg'}`,
};

console.log('✅ Camera converted media:', convertedMedia);

// Handle video compression for reels
if (contentMode === "reel") {
handleVideoSelected(convertedMedia);
} else {
setSelectedMedia([convertedMedia]);
setCroppedImageUri(null);
}
} catch (error) {
console.error('❌ Error converting camera media:', error);
Alert.alert("Camera Error", error.message || "Failed to process captured media. Please try again.");
}
}
});
};

const handleCropComplete = (cropData) => {
console.log('Crop completed with data:', cropData);

if (!cropData || !cropData.uri) {
Alert.alert("Error", "Invalid crop data received. Please try again.");
return;
}

if (selectedMedia.length > 0) {
const updatedMedia = [...selectedMedia];
updatedMedia[0] = {
...updatedMedia[0],
uri: cropData.uri, // Update primary URI
image: { uri: cropData.uri },
originalUri: updatedMedia[0].originalUri || updatedMedia[0].uri,
cropData: cropData.cropArea,
croppedSize: cropData.croppedSize,
isCropped: true,
cropApplied: cropData.cropApplied !== false,
};
setSelectedMedia(updatedMedia);
setCroppedImageUri(cropData.uri);

if (cropData.cropApplied === false) {
Alert.alert("Crop Preview", "Crop area has been selected. Install react-native-image-crop-picker for actual cropping.");
} else {
Alert.alert("Success", "Image cropped successfully!");
}
}

setShowCropModal(false);
};

const handleCropCancel = () => {
setShowCropModal(false);
};

const openCropModal = () => {
if (selectedMedia.length === 1 && contentMode === "photo") {
Alert.alert(
"Crop Image",
"Choose your cropping method:",
[
{
text: "Advanced Crop",
onPress: async () => {
try {
const croppedImage = await ImageCropPicker.openCropper({
path: selectedMedia[0].originalUri || selectedMedia[0].uri,
width: 400,
height: 400,
cropperCircleOverlay: false,
cropperRotateButtonsHidden: false,
cropperChooseText: 'Choose',
cropperCancelText: 'Cancel',
includeBase64: false,
compressImageQuality: 0.8,
freeStyleCropEnabled: true,
showCropGuidelines: true,
showCropFrame: true,
enableRotationGesture: true,
cropperToolbarTitle: 'Crop Image',
cropperStatusBarColor: '#000000',
cropperToolbarColor: '#000000',
cropperActiveWidgetColor: '#ed167e',
cropperToolbarWidgetColor: '#ffffff',
});

const updatedMedia = [...selectedMedia];
updatedMedia[0] = {
...updatedMedia[0],
uri: croppedImage.path,
image: { uri: croppedImage.path },
originalUri: updatedMedia[0].originalUri || updatedMedia[0].uri,
cropData: {
width: croppedImage.width,
height: croppedImage.height,
},
croppedSize: {
width: croppedImage.width,
height: croppedImage.height,
},
isCropped: true,
};
setSelectedMedia(updatedMedia);
setCroppedImageUri(croppedImage.path);
Alert.alert("Success", "Image cropped successfully!");

} catch (error) {
console.log('Direct crop error:', error);
if (error.message !== 'User cancelled image selection') {
Alert.alert("Error", "Advanced crop failed. Trying custom crop...");
setShowCropModal(true);
}
}
}
},
{
text: "Custom Crop",
onPress: () => setShowCropModal(true)
},
{
text: "Cancel",
style: "cancel"
}
]
);
}
};

const removeSelectedMedia = (indexToRemove) => {
const newSelection = selectedMedia.filter((_, index) => index !== indexToRemove);
setSelectedMedia(newSelection);
if (indexToRemove === 0) {
setCroppedImageUri(null);
}
};

const toggleMultiSelectMode = () => {
if (contentMode === "reel") return;
if (isMultiSelectMode && selectedMedia.length > 1) {
setSelectedMedia(selectedMedia.slice(0, 1));
}
setIsMultiSelectMode(!isMultiSelectMode);
setCroppedImageUri(null);
};

const handleNext = () => {
if (selectedMedia.length === 0) {
Alert.alert("No media selected", `Please select ${contentMode === "reel" ? "a video" : "at least one photo"}.`);
return;
}

// Check if compression is in progress
if (compressionInProgress) {
Alert.alert("Compression in Progress", "Please wait for video compression to complete before proceeding.");
return;
}

console.log('🚀 Navigating to EditPost with:', {
selectedMedia,
contentType: contentMode === "reel" ? 'reel' : 'post'
});

navigation.navigate('EditPost', {
selectedMedia,
contentType: contentMode === "reel" ? 'reel' : 'post'
});
};

const sliderPosition = sliderAnimation.interpolate({
inputRange: [0, 1],
outputRange: ['0%', '50%'],
});

const handleClose = () => {
navigation.goBack();
};

const handleImageLoadStart = (id) => {
setImageLoading(prev => ({ ...prev, [id]: true }));
};

const handleImageLoadEnd = (id) => {
setImageLoading(prev => ({ ...prev, [id]: false }));
};

const FastImage = ({ uri, style, id }) => (
<View style={style}>
{imageLoading[id] && (
<View style={styles.imageLoader}>
<ActivityIndicator size="small" color="#ed167e" />
</View>
)}
<Image
source={{ uri }}
style={[style, { position: imageLoading[id] ? 'absolute' : 'relative' }]}
onLoadStart={() => handleImageLoadStart(id)}
onLoadEnd={() => handleImageLoadEnd(id)}
onError={() => handleImageLoadEnd(id)}
resizeMode="cover"
fadeDuration={100}
progressiveRenderingEnabled={true}
borderRadius={style.borderRadius || 0}
/>
</View>
);

const showCropButton = contentMode === "photo" && selectedMedia.length === 1 && !isMultiSelectMode;

return (
<View style={styles.container}>
<StatusBar barStyle="light-content" backgroundColor="black" />

<ScrollView
style={styles.scrollContainer}
contentContainerStyle={styles.scrollContent}
showsVerticalScrollIndicator={false}
bounces={false}
>
{/* Header */}
<View style={styles.header}>
<TouchableOpacity onPress={handleClose} style={styles.closeButton}>
<Icon name="close" size={24} color="#fff" />
</TouchableOpacity>

<Text style={styles.headerTitle}>New {contentMode === "reel" ? "reel" : "post"}</Text>

<TouchableOpacity
onPress={handleNext}
disabled={selectedMedia.length === 0 || compressionInProgress}
style={[
styles.nextButton,
{ opacity: (selectedMedia.length > 0 && !compressionInProgress) ? 1 : 0.5 },
]}
>
{compressionInProgress ? (
<ActivityIndicator size="small" color="#ed167e" />
) : (
<Text style={styles.nextText}>Next</Text>
)}
</TouchableOpacity>
</View>

{/* Mode Slider */}
<View style={styles.modeContainer}>
<View style={styles.modeSlider}>
<Animated.View style={[styles.sliderIndicator, { left: sliderPosition }]} />
<TouchableOpacity
style={[styles.modeOption, contentMode === "photo" && styles.activeModeOption]}
onPress={() => setContentMode("photo")}
>
<MaterialIcons
name="photo"
size={16}
color={contentMode === "photo" ? "#fff" : "#888"}
style={styles.modeIcon}
/>
<Text style={[styles.modeText, contentMode === "photo" && styles.activeModeText]}>
PHOTO
</Text>
</TouchableOpacity>
<TouchableOpacity
style={[styles.modeOption, contentMode === "reel" && styles.activeModeOption]}
onPress={() => setContentMode("reel")}
>
<MaterialIcons
name="videocam"
size={16}
color={contentMode === "reel" ? "#fff" : "#888"}
style={styles.modeIcon}
/>
<Text style={[styles.modeText, contentMode === "reel" && styles.activeModeText]}>
REEL
</Text>
</TouchableOpacity>
</View>
</View>

{/* Selected Media Preview */}
<View style={styles.previewContainer}>
{selectedMedia.length > 0 ? (
<View style={styles.previewWrapper}>
<FastImage
uri={selectedMedia[0].uri || selectedMedia[0].image.uri}
style={styles.selectedPreview}
id="main_preview"
/>

{/* Crop Button - Only for single photo */}
{showCropButton && (
<TouchableOpacity
style={styles.cropButton}
onPress={openCropModal}
>
<MaterialIcons name="crop" size={24} color="#fff" />
<Text style={styles.cropButtonText}>Crop</Text>
</TouchableOpacity>
)}

{/* Cropped indicator */}
{selectedMedia[0]?.isCropped && (
<View style={styles.croppedIndicator}>
<MaterialIcons name="check-circle" size={16} color="#4CAF50" />
<Text style={styles.croppedText}>Cropped</Text>
</View>
)}

{/* Video indicator */}
{contentMode === "reel" && (
<View style={styles.videoPlayIndicator}>
<MaterialIcons name="play-circle-filled" size={48} color="rgba(255,255,255,0.8)" />
</View>
)}

{/* File size indicator */}
{selectedMedia[0]?.compressedSize && (
<View style={styles.fileSizeIndicator}>
<Text style={styles.fileSizeText}>

</Text>
</View>
)}


</View>
) : (
<View style={styles.emptyPreview}>
<MaterialIcons
name={contentMode === "reel" ? "videocam" : "photo"}
size={48}
color="#444"
/>
<Text style={styles.emptyPreviewText}>
{contentMode === "reel" ? "Select a video" : "Select photos"}
</Text>
</View>
)}
{selectedMedia.length > 1 && (
<View style={styles.countBadge}>
<Text style={styles.countBadgeText}>+{selectedMedia.length - 1}</Text>
</View>
)}
</View>

{/* Gallery Section */}
<View style={styles.gallerySection}>
<View style={styles.galleryHeader}>
<View style={styles.headerLeftSection}>
<MaterialIcons
name={contentMode === "reel" ? "video-library" : "photo-library"}
size={20}
color="#fff"
style={styles.headerIcon}
/>
<Text style={styles.headerText}>
{contentMode === "reel" ? "Video" : "Photos"}
</Text>
</View>

{contentMode === "photo" && (
<TouchableOpacity
style={[
styles.selectMultipleButton,
isMultiSelectMode && styles.selectMultipleButtonActive
]}
onPress={toggleMultiSelectMode}
>
<MaterialIcons
name={isMultiSelectMode ? "check-box" : "check-box-outline-blank"}
size={16}
color="#fff"
style={styles.selectIcon}
/>
<Text style={[
styles.selectMultipleText,
isMultiSelectMode && styles.selectMultipleTextActive
]}>
{isMultiSelectMode ? `MULTI-SELECT` : 'SELECT MULTIPLE'}
</Text>
</TouchableOpacity>
)}
</View>

{/* Info text */}
{contentMode === "photo" && isMultiSelectMode && (
<View style={styles.infoContainer}>
<Icon name="information-circle-outline" size={14} color="#888" style={styles.infoIcon} />
<Text style={styles.infoText}>
Select up to {MAX_PHOTOS} photos from your gallery
</Text>
</View>
)}

{/* Video compression info */}
{contentMode === "reel" && (
<View style={styles.infoContainer}>
<MaterialIcons name="compress" size={14} color="#4CAF50" style={styles.infoIcon} />
<Text style={styles.infoText}>
Videos larger than 5MB will be automatically compressed for better upload
</Text>
</View>
)}

{/* Selected Media List */}
{selectedMedia.length > 0 && (
<View style={styles.selectedMediaContainer}>
<Text style={styles.selectedMediaTitle}>
Selected {contentMode === "reel" ? "Video" : "Photos"} ({selectedMedia.length})
</Text>
<ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.selectedMediaScroll}>
{selectedMedia.map((media, index) => (
<View key={media.id || index} style={styles.selectedMediaItem}>
<FastImage
uri={media.uri || media.image.uri}
style={styles.selectedMediaThumbnail}
id={`thumbnail_${index}`}
/>

<TouchableOpacity
style={styles.removeButton}
onPress={() => removeSelectedMedia(index)}
>
<Icon name="close-circle" size={20} color="#ed167e" />
</TouchableOpacity>

{contentMode === "reel" && (
<View style={styles.videoIndicator}>
<MaterialIcons name="play-arrow" size={12} color="#fff" />
{media.compressedSize && (
<Text style={styles.videoSizeText}>
{formatFileSize(media.compressedSize)}
</Text>
)}
</View>
)}

{media.isCropped && (
<View style={styles.thumbnailCroppedIndicator}>
<MaterialIcons name="crop" size={10} color="#4CAF50" />
</View>
)}

{media.isCompressed && (
<View style={styles.thumbnailCompressedIndicator}>
<MaterialIcons name="compress" size={10} color="#4CAF50" />
<Text style={styles.compressionRatioText}>
-{Math.round(media.compressionRatio)}%
</Text>
</View>
)}
</View>
))}
</ScrollView>
</View>
)}

{/* Action Buttons */}
<View style={styles.actionButtonsContainer}>
<TouchableOpacity style={styles.actionButton} onPress={openGallery}>
<View style={styles.actionButtonContent}>
<MaterialIcons
name={contentMode === "reel" ? "video-library" : "photo-library"}
size={24}
color="#ed167e"
/>
<View style={styles.actionButtonTextContainer}>
<Text style={styles.actionButtonText}>
Choose from Gallery
</Text>
<Text style={styles.actionButtonSubtext}>
{contentMode === "reel"
? "Select video - large files will be compressed automatically"
: `Select ${isMultiSelectMode ? `up to ${MAX_PHOTOS} photos` : 'photo'} from gallery`
}
</Text>
</View>
</View>
</TouchableOpacity>

<TouchableOpacity style={styles.actionButton} onPress={openCamera}>
<View style={styles.actionButtonContent}>
<MaterialIcons
name={contentMode === "reel" ? "videocam" : "camera-alt"}
size={24}
color="#ed167e"
/>
<View style={styles.actionButtonTextContainer}>
<Text style={styles.actionButtonText}>
{contentMode === "reel" ? "Record Video" : "Take Photo"}
</Text>
<Text style={styles.actionButtonSubtext}>
{contentMode === "reel"
? "Record video - will be compressed if needed"
: "Take a new photo with your camera"
}
</Text>
</View>
</View>
</TouchableOpacity>
</View>
</View>
</ScrollView>

{/* Video Compression Modal */}
<VideoCompressionModal
visible={showCompressionModal}
onComplete={handleCompressionComplete}
onCancel={handleCompressionCancel}
videoUri={videoToCompress?.uri}
originalSize={videoToCompress?.originalSize}
/>

{/* Crop Modal */}
<ImageCropModal
visible={showCropModal}
imageUri={selectedMedia[0]?.originalUri || selectedMedia[0]?.uri || selectedMedia[0]?.image?.uri}
onCrop={handleCropComplete}
onCancel={handleCropCancel}
/>
</View>
);
};

export default CreateScreen;

const styles = StyleSheet.create({
container: {
flex: 1,
backgroundColor: "black",
},
scrollContainer: {
flex: 1,
},
scrollContent: {
flexGrow: 1,
},
header: {
flexDirection: "row",
justifyContent: "space-between",
alignItems: "center",
paddingHorizontal: 16,
paddingTop: 44,
paddingBottom: 12,
borderBottomWidth: 0.5,
borderBottomColor: "#333",
},
closeButton: {
width: 32,
height: 32,
justifyContent: "center",
alignItems: "center",
},
headerTitle: {
color: "#fff",
fontSize: 16,
fontWeight: "600",
},
nextButton: {
paddingVertical: 8,
paddingHorizontal: 12,
borderRadius: 6,
},
nextText: {
color: "#ed167e",
fontWeight: "600",
fontSize: 16,
},
modeContainer: {
paddingHorizontal: 16,
paddingVertical: 12,
borderBottomWidth: 0.5,
borderBottomColor: "#333",
},
modeSlider: {
flexDirection: "row",
backgroundColor: "#262626",
borderRadius: 25,
padding: 2,
position: "relative",
},
sliderIndicator: {
position: "absolute",
top: 2,
width: "50%",
height: "100%",
backgroundColor: "#ed167e",
borderRadius: 23,
zIndex: 1,
},
modeOption: {
flex: 1,
paddingVertical: 10,
alignItems: "center",
zIndex: 2,
flexDirection: "row",
justifyContent: "center",
},
modeIcon: {
marginRight: 6,
},
activeModeOption: {
// Style handled by slider indicator
},
modeText: {
color: "#888",
fontSize: 12,
fontWeight: "600",
},
activeModeText: {
color: "#fff",
},
previewContainer: {
aspectRatio: 1,
backgroundColor: "#000",
borderBottomWidth: 0.5,
borderBottomColor: "#333",
position: "relative",
},
previewWrapper: {
width: "100%",
height: "100%",
position: "relative",
},
selectedPreview: {
width: "100%",
height: "100%",
},
cropButton: {
position: "absolute",
bottom: 16,
left: 16,
backgroundColor: "rgba(0,0,0,0.8)",
paddingHorizontal: 16,
paddingVertical: 10,
borderRadius: 20,
flexDirection: "row",
alignItems: "center",
borderWidth: 1,
borderColor: "#ed167e",
},
cropButtonText: {
color: "#fff",
fontSize: 14,
fontWeight: "600",
marginLeft: 6,
},
croppedIndicator: {
position: "absolute",
top: 16,
left: 16,
backgroundColor: "rgba(0,0,0,0.8)",
paddingHorizontal: 10,
paddingVertical: 6,
borderRadius: 12,
flexDirection: "row",
alignItems: "center",
},
croppedText: {
color: "#4CAF50",
fontSize: 12,
fontWeight: "600",
marginLeft: 4,
},
videoPlayIndicator: {
position: "absolute",
top: "50%",
left: "50%",
marginTop: -24,
marginLeft: -24,
},
fileSizeIndicator: {
position: "absolute",
top: 16,
right: 16,
backgroundColor: "rgba(0,0,0,0.8)",
paddingHorizontal: 10,
paddingVertical: 6,
borderRadius: 12,
flexDirection: "row",
alignItems: "center",
},
fileSizeText: {
color: "#fff",
fontSize: 12,
fontWeight: "600",
},
compressedText: {
color: "#4CAF50",
fontSize: 10,
fontWeight: "600",
},
compressionIndicator: {
position: "absolute",
top: 50,
left: 16,
backgroundColor: "rgba(76, 175, 80, 0.9)",
paddingHorizontal: 10,
paddingVertical: 6,
borderRadius: 12,
flexDirection: "row",
alignItems: "center",
},
compressionText: {
color: "#fff",
fontSize: 12,
fontWeight: "600",
marginLeft: 4,
},
emptyPreview: {
flex: 1,
justifyContent: "center",
alignItems: "center",
},
emptyPreviewText: {
color: "#666",
fontSize: 16,
marginTop: 12,
},
countBadge: {
position: "absolute",
top: 12,
right: 12,
backgroundColor: "#ed167e",
borderRadius: 12,
paddingHorizontal: 8,
paddingVertical: 4,
},
countBadgeText: {
color: "#fff",
fontSize: 12,
fontWeight: "600",
},
imageLoader: {
position: "absolute",
top: 0,
left: 0,
right: 0,
bottom: 0,
justifyContent: "center",
alignItems: "center",
backgroundColor: "#1a1a1a",
zIndex: 1,
},
gallerySection: {
backgroundColor: "#000",
paddingBottom: 20,
},
galleryHeader: {
flexDirection: "row",
justifyContent: "space-between",
alignItems: "center",
paddingHorizontal: 16,
paddingVertical: 12,
borderBottomWidth: 0.5,
borderBottomColor: "#333",
},
headerLeftSection: {
flexDirection: "row",
alignItems: "center",
},
headerIcon: {
marginRight: 8,
},
headerText: {
color: "#fff",
fontSize: 16,
fontWeight: "600",
},
selectMultipleButton: {
backgroundColor: "#262626",
paddingHorizontal: 12,
paddingVertical: 6,
borderRadius: 16,
flexDirection: "row",
alignItems: "center",
},
selectMultipleButtonActive: {
backgroundColor: "#ed167e",
},
selectIcon: {
marginRight: 4,
},
selectMultipleText: {
color: "#fff",
fontSize: 11,
fontWeight: "600",
},
selectMultipleTextActive: {
color: "#fff",
},
infoContainer: {
paddingHorizontal: 16,
paddingVertical: 8,
backgroundColor: "#1a1a1a",
flexDirection: "row",
alignItems: "center",
justifyContent: "center",
},
infoIcon: {
marginRight: 6,
},
infoText: {
color: "#888",
fontSize: 12,
},
selectedMediaContainer: {
paddingHorizontal: 16,
paddingVertical: 12,
borderBottomWidth: 0.5,
borderBottomColor: "#333",
},
selectedMediaTitle: {
color: "#fff",
fontSize: 14,
fontWeight: "600",
marginBottom: 8,
},
selectedMediaScroll: {
flexDirection: "row",
},
selectedMediaItem: {
marginRight: 12,
position: "relative",
},
selectedMediaThumbnail: {
width: 60,
height: 60,
borderRadius: 8,
},
removeButton: {
position: "absolute",
top: -6,
right: -6,
backgroundColor: "#000",
borderRadius: 10,
},
videoIndicator: {
position: "absolute",
bottom: 4,
left: 4,
backgroundColor: "rgba(0,0,0,0.8)",
borderRadius: 8,
paddingHorizontal: 4,
paddingVertical: 2,
flexDirection: "row",
alignItems: "center",
},
videoSizeText: {
color: "#fff",
fontSize: 8,
marginLeft: 2,
},
thumbnailCroppedIndicator: {
position: "absolute",
bottom: 4,
right: 4,
backgroundColor: "rgba(76, 175, 80, 0.8)",
borderRadius: 6,
padding: 2,
},
thumbnailCompressedIndicator: {
position: "absolute",
top: 4,
left: 4,
backgroundColor: "rgba(76, 175, 80, 0.9)",
borderRadius: 6,
paddingHorizontal: 4,
paddingVertical: 2,
flexDirection: "row",
alignItems: "center",
},
compressionRatioText: {
color: "#fff",
fontSize: 8,
marginLeft: 2,
fontWeight: "600",
},
actionButtonsContainer: {
paddingHorizontal: 16,
paddingTop: 20,
},
actionButton: {
backgroundColor: "#1a1a1a",
borderRadius: 12,
paddingVertical: 16,
paddingHorizontal: 16,
marginBottom: 12,
borderWidth: 1,
borderColor: "#333",
},
actionButtonContent: {
flexDirection: "row",
alignItems: "center",
},
actionButtonTextContainer: {
marginLeft: 12,
flex: 1,
},
actionButtonText: {
color: "#fff",
fontSize: 16,
fontWeight: "600",
},
actionButtonSubtext: {
color: "#888",
fontSize: 12,
marginTop: 2,
},
});

// Video compression modal styles
const compressionStyles = StyleSheet.create({
overlay: {
flex: 1,
backgroundColor: "rgba(0,0,0,0.9)",
justifyContent: "center",
alignItems: "center",
},
container: {
backgroundColor: "#1a1a1a",
borderRadius: 16,
paddingVertical: 24,
paddingHorizontal: 20,
width: width * 0.9,
maxWidth: 400,
borderWidth: 1,
borderColor: "#333",
},
header: {
flexDirection: "row",
justifyContent: "space-between",
alignItems: "center",
marginBottom: 24,
},
title: {
color: "#fff",
fontSize: 18,
fontWeight: "600",
},
cancelButton: {
padding: 8,
},
content: {
alignItems: "center",
},
progressContainer: {
alignItems: "center",
marginBottom: 20,
},
progressCircle: {
width: 80,
height: 80,
borderRadius: 40,
borderWidth: 4,
borderColor: "#ed167e",
justifyContent: "center",
alignItems: "center",
marginBottom: 16,
backgroundColor: "#262626",
},
progressText: {
color: "#fff",
fontSize: 18,
fontWeight: "bold",
},
progressBarContainer: {
width: "100%",
height: 8,
backgroundColor: "#333",
borderRadius: 4,
overflow: "hidden",
},
progressBar: {
height: "100%",
backgroundColor: "#ed167e",
borderRadius: 4,
},
stageText: {
color: "#ccc",
fontSize: 14,
textAlign: "center",
marginBottom: 20,
lineHeight: 20,
},
sizeInfo: {
flexDirection: "row",
justifyContent: "space-between",
width: "100%",
marginBottom: 8,
paddingHorizontal: 8,
},
sizeLabel: {
color: "#888",
fontSize: 14,
},
sizeValue: {
color: "#fff",
fontSize: 14,
fontWeight: "600",
},
completedIndicator: {
alignItems: "center",
marginTop: 16,
},
completedText: {
color: "#4CAF50",
fontSize: 14,
fontWeight: "600",
marginTop: 8,
textAlign: "center",
},
errorIndicator: {
alignItems: "center",
marginTop: 16,
},
errorText: {
color: "#f44336",
fontSize: 14,
fontWeight: "600",
marginTop: 8,
textAlign: "center",
},
});

// Enhanced cropping modal styles
const cropStyles = StyleSheet.create({
container: {
flex: 1,
backgroundColor: "black",
},
header: {
flexDirection: "row",
justifyContent: "space-between",
alignItems: "center",
paddingHorizontal: 16,
paddingTop: 44,
paddingBottom: 12,
borderBottomWidth: 0.5,
borderBottomColor: "#333",
},
cancelButton: {
paddingVertical: 8,
paddingHorizontal: 12,
},
cancelText: {
color: "#fff",
fontSize: 16,
},
headerTitle: {
color: "#fff",
fontSize: 16,
fontWeight: "600",
},
doneButton: {
paddingVertical: 8,
paddingHorizontal: 12,
borderRadius: 6,
minWidth: 60,
alignItems: "center",
},
doneText: {
color: "#ed167e",
fontWeight: "600",
fontSize: 16,
},
toolsContainer: {
flexDirection: "row",
justifyContent: "center",
paddingVertical: 12,
borderBottomWidth: 0.5,
borderBottomColor: "#333",
},
toolButton: {
flexDirection: "row",
alignItems: "center",
paddingHorizontal: 16,
paddingVertical: 8,
marginHorizontal: 8,
backgroundColor: "#262626",
borderRadius: 20,
},
toolText: {
color: "#fff",
fontSize: 12,
marginLeft: 4,
},
imageContainer: {
flex: 1,
justifyContent: "center",
alignItems: "center",
backgroundColor: "#000",
},
image: {
width: "100%",
height: "100%",
},
overlay: {
position: "absolute",
top: 0,
left: 0,
right: 0,
bottom: 0,
},
overlayPart: {
position: "absolute",
backgroundColor: "rgba(0,0,0,0.6)",
},
overlayRow: {
position: "absolute",
flexDirection: "row",
width: "100%",
},
cropArea: {
position: "absolute",
backgroundColor: "transparent",
},
gridLine: {
position: "absolute",
backgroundColor: "rgba(255, 255, 255, 0.4)",
},
cornerHandle: {
position: "absolute",
width: 24,
height: 24,
backgroundColor: "#ed167e",
borderRadius: 12,
borderWidth: 3,
borderColor: "#fff",
shadowColor: "#000",
shadowOffset: { width: 0, height: 2 },
shadowOpacity: 0.3,
shadowRadius: 3,
elevation: 5,
},
topLeft: {
top: -12,
left: -12,
},
topRight: {
top: -12,
right: -12,
},
bottomLeft: {
bottom: -12,
left: -12,
},
bottomRight: {
bottom: -12,
right: -12,
},
centerIndicator: {
position: "absolute",
top: "50%",
left: "50%",
marginTop: -8,
marginLeft: -8,
backgroundColor: "rgba(0,0,0,0.5)",
borderRadius: 8,
padding: 2,
},
instructionsContainer: {
paddingHorizontal: 16,
paddingVertical: 12,
backgroundColor: "#1a1a1a",
},
instructionsText: {
color: "#888",
fontSize: 11,
textAlign: "center",
lineHeight: 16,
},
});