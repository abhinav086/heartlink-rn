// // services/storyService.js
// import AsyncStorage from '@react-native-async-storage/async-storage';
// import BASE_URL, { STORY_ENDPOINTS, STORY_CONFIG } from '../config/config';

// class StoryService {
//   // Upload stories with progress tracking
//   async uploadStoriesWithProgress(mediaFiles, onProgress) {
//     const token = await AsyncStorage.getItem('token');
//     if (!token) {
//       throw new Error('No authentication token found');
//     }
//     const formData = new FormData();
//     const uploadPromises = [];
//     const progressData = {};

//     // Initialize progress for each file
//     mediaFiles.forEach((_, index) => {
//       progressData[index] = { progress: 0, status: 'preparing' };
//     });
//     onProgress(progressData);

//     // Process each file
//     for (let i = 0; i < mediaFiles.length; i++) {
//       const media = mediaFiles[i];
      
//       // Validate file size
//       if (media.fileSize && media.fileSize > STORY_CONFIG.MAX_FILE_SIZE) {
//         progressData[i] = { progress: 0, status: 'error', error: 'File too large' };
//         onProgress({ ...progressData });
//         continue;
//       }

//       // Validate file type
//       const isValidType = [
//         ...STORY_CONFIG.SUPPORTED_IMAGE_TYPES,
//         ...STORY_CONFIG.SUPPORTED_VIDEO_TYPES
//       ].includes(media.type);

//       if (!isValidType) {
//         progressData[i] = { progress: 0, status: 'error', error: 'Unsupported file type' };
//         onProgress({ ...progressData });
//         continue;
//       }

//       // Append to FormData with field name 'media'
//       formData.append('media', {
//         uri: media.uri,
//         type: media.type,
//         name: media.fileName || `story_${Date.now()}_${i}.${media.type.split('/')[1]}`,
//       });

//       progressData[i] = { progress: 10, status: 'uploading' };
//       onProgress({ ...progressData });
//     }

//     // If no valid files, throw error
//     if (!formData._parts || formData._parts.length === 0) {
//       throw new Error('No valid files to upload');
//     }

//     try {
//       // Create XMLHttpRequest for progress tracking
//       return new Promise((resolve, reject) => {
//         const xhr = new XMLHttpRequest();

//         // Track upload progress
//         xhr.upload.addEventListener('progress', (event) => {
//           if (event.lengthComputable) {
//             const percentComplete = (event.loaded / event.total) * 100;
            
//             // Update progress for all files proportionally
//             mediaFiles.forEach((_, index) => {
//               if (progressData[index].status === 'uploading') {
//                 progressData[index].progress = Math.round(percentComplete * 0.9); // 90% for upload
//               }
//             });
//             onProgress({ ...progressData });
//           }
//         });

//         // Handle response
//         xhr.onload = () => {
//           if (xhr.status >= 200 && xhr.status < 300) {
//             try {
//               const response = JSON.parse(xhr.responseText);
              
//               // Update progress to completed
//               mediaFiles.forEach((_, index) => {
//                 if (progressData[index].status === 'uploading') {
//                   progressData[index] = { progress: 100, status: 'completed' };
//                 }
//               });
//               onProgress({ ...progressData });
              
//               resolve(response);
//             } catch (error) {
//               reject(new Error('Invalid response from server'));
//             }
//           } else {
//             try {
//               const errorResponse = JSON.parse(xhr.responseText);
//               reject(new Error(errorResponse.message || `Upload failed with status ${xhr.status}`));
//             } catch {
//               reject(new Error(`Upload failed with status ${xhr.status}`));
//             }
//           }
//         };

//         // Handle errors
//         xhr.onerror = () => {
//           reject(new Error('Network error occurred during upload'));
//         };

//         // Configure and send request
//         xhr.open('POST', `${BASE_URL}${STORY_ENDPOINTS.UPLOAD_STORY}`);
//         xhr.setRequestHeader('Authorization', `Bearer ${token}`);
//         xhr.send(formData);
//       });
//     } catch (error) {
//       // Update progress to error for all uploading files
//       mediaFiles.forEach((_, index) => {
//         if (progressData[index].status === 'uploading') {
//           progressData[index] = { progress: 0, status: 'error', error: error.message };
//         }
//       });
//       onProgress({ ...progressData });
//       throw error;
//     }
//   }

//   // Get all stories
//   async getStories() {
//     const token = await AsyncStorage.getItem('token');
//     if (!token) {
//       throw new Error('No authentication token found');
//     }

//     const response = await fetch(`${BASE_URL}${STORY_ENDPOINTS.GET_STORIES}`, {
//       method: 'GET',
//       headers: {
//         'Authorization': `Bearer ${token}`,
//         'Content-Type': 'application/json',
//       },
//     });

//     if (!response.ok) {
//       const error = await response.json();
//       throw new Error(error.message || 'Failed to fetch stories');
//     }

//     return response.json();
//   }

//   // Get my stories
//   async getMyStories() {
//     const token = await AsyncStorage.getItem('token');
//     if (!token) {
//       throw new Error('No authentication token found');
//     }

//     const response = await fetch(`${BASE_URL}${STORY_ENDPOINTS.GET_MY_STORIES}`, {
//       method: 'GET',
//       headers: {
//         'Authorization': `Bearer ${token}`,
//         'Content-Type': 'application/json',
//       },
//     });

//     if (!response.ok) {
//       const error = await response.json();
//       throw new Error(error.message || 'Failed to fetch my stories');
//     }

//     return response.json();
//   }

//   // Mark story as viewed
//   async viewStory(storyId) {
//     const token = await AsyncStorage.getItem('token');
//     if (!token) {
//       throw new Error('No authentication token found');
//     }

//     const response = await fetch(
//       `${BASE_URL}${STORY_ENDPOINTS.VIEW_STORY.replace(':storyId', storyId)}`,
//       {
//         method: 'POST',
//         headers: {
//           'Authorization': `Bearer ${token}`,
//           'Content-Type': 'application/json',
//         },
//       }
//     );

//     if (!response.ok) {
//       const error = await response.json();
//       throw new Error(error.message || 'Failed to view story');
//     }

//     return response.json();
//   }

//   // Delete story
//   async deleteStory(storyId) {
//     const token = await AsyncStorage.getItem('token');
//     if (!token) {
//       throw new Error('No authentication token found');
//     }

//     const response = await fetch(
//       `${BASE_URL}${STORY_ENDPOINTS.DELETE_STORY.replace(':storyId', storyId)}`,
//       {
//         method: 'DELETE',
//         headers: {
//           'Authorization': `Bearer ${token}`,
//           'Content-Type': 'application/json',
//         },
//       }
//     );

//     if (!response.ok) {
//       const error = await response.json();
//       throw new Error(error.message || 'Failed to delete story');
//     }

//     return response.json();
//   }

//   // Check if user has story
//   async checkUserStory(userId) {
//     const token = await AsyncStorage.getItem('token');
//     if (!token) {
//       throw new Error('No authentication token found');
//     }

//     const response = await fetch(
//       `${BASE_URL}${STORY_ENDPOINTS.CHECK_USER_STORY.replace(':userId', userId)}`,
//       {
//         method: 'GET',
//         headers: {
//           'Authorization': `Bearer ${token}`,
//           'Content-Type': 'application/json',
//         },
//       }
//     );

//     if (!response.ok) {
//       const error = await response.json();
//       throw new Error(error.message || 'Failed to check user story');
//     }

//     return response.json();
//   }
// }

// export default new StoryService();