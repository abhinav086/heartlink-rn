// config/config.js
const BASE_URL = 'https://backendforheartlink.in';

// Story configuration constants
export const STORY_CONFIG = {
  MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB (matching backend)
  MAX_STORIES_PER_UPLOAD: 10,      // Maximum stories per upload
  VIDEO_DURATION_LIMIT: 30,        // 30 seconds for story videos
  STORY_EXPIRY_HOURS: 24,          // Stories expire after 24 hours
  
  // Supported file types
  SUPPORTED_IMAGE_TYPES: [
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'image/gif',
    'image/webp'
  ],
  
  SUPPORTED_VIDEO_TYPES: [
    'video/mp4',
    'video/mov',
    'video/avi',
    'video/quicktime',
    'video/x-msvideo'
  ]
};

// Story API endpoints
export const STORY_ENDPOINTS = {
  UPLOAD_STORY: '/api/v1/stories/story',                    // Recommended for multiple uploads
  UPLOAD_STORY_SINGLE: '/api/v1/stories/story/single',      // For single file upload  
  UPLOAD_STORY_FIELDS: '/api/v1/stories/story/upload',      // Alternative with fields method
  GET_STORIES: '/api/v1/stories/stories',                   // Get all stories from followed users
  GET_MY_STORIES: '/api/v1/stories/my-stories',             // Get current user's stories
  VIEW_STORY: '/api/v1/stories/stories/:storyId/view',      // Mark story as viewed
  DELETE_STORY: '/api/v1/stories/stories/:storyId',         // Delete a story
  CHECK_USER_STORY: '/api/v1/stories/users/:userId/has-story' // Check if user has story
};

export default BASE_URL;