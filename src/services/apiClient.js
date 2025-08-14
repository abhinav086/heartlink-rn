// src/services/apiClient.js
import BASE_URL from '../config/config';

class ApiService {
  constructor() {
    this.baseURL = `${BASE_URL}/api/v1`;
  }

  // Helper method to make authenticated requests
  async authenticatedRequest(endpoint, options = {}) {
    const { token, ...otherOptions } = options;
    
    if (!token) {
      throw new Error('Authentication token is required');
    }

    const defaultHeaders = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    const requestOptions = {
      ...otherOptions,
      headers: {
        ...defaultHeaders,
        ...otherOptions.headers,
      },
    };

    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, requestOptions);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      return data;
    } catch (error) {
      console.error(`API Error for ${endpoint}:`, error);
      throw error;
    }
  }

  // Get user posts (photos and reels)
  async getUserPosts(userId, options = {}) {
    const { token, page = 1, limit = 50, type = 'all' } = options;
    
    const queryParams = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });

    if (type !== 'all') {
      queryParams.append('type', type);
    }

    const endpoint = `/posts/users/${userId}/posts?${queryParams}`;
    const data = await this.authenticatedRequest(endpoint, { token });
    
    return data.data || {};
  }

  // Get user posts by type
  async getUserPostsByType(userId, type, options = {}) {
    return this.getUserPosts(userId, { ...options, type });
  }

  // Get user photos only
  async getUserPhotos(userId, options = {}) {
    return this.getUserPostsByType(userId, 'post', options);
  }

  // Get user reels only
  async getUserReels(userId, options = {}) {
    return this.getUserPostsByType(userId, 'reel', options);
  }

  // Get user profile data
  async getUserProfile(userId, token) {
    const endpoint = `/users/profile/${userId}`;
    const data = await this.authenticatedRequest(endpoint, { token });
    
    return data.data || data;
  }

  // Get all posts (feed)
  async getAllPosts(options = {}) {
    const { token, page = 1, limit = 10, type = 'all' } = options;
    
    const queryParams = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });

    if (type !== 'all') {
      queryParams.append('type', type);
    }

    const endpoint = `/posts/post?${queryParams}`;
    const data = await this.authenticatedRequest(endpoint, { token });
    
    return data.data || {};
  }

  // Get all reels
  async getAllReels(options = {}) {
    const { token, page = 1, limit = 10 } = options;
    
    const queryParams = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });

    const endpoint = `/posts/reels?${queryParams}`;
    const data = await this.authenticatedRequest(endpoint, { token });
    
    return data.data || {};
  }

  // Get random reels
  async getRandomReels(options = {}) {
    const { token, limit = 10 } = options;
    
    const queryParams = new URLSearchParams({
      limit: limit.toString(),
    });

    const endpoint = `/posts/reels/random?${queryParams}`;
    const data = await this.authenticatedRequest(endpoint, { token });
    
    return data.data || {};
  }

  // Get single post
  async getPost(postId, token) {
    const endpoint = `/posts/posts/${postId}`;
    const data = await this.authenticatedRequest(endpoint, { token });
    
    return data.data || {};
  }

  // Like/Unlike post
  async toggleLike(postId, token) {
    const endpoint = `/posts/posts/${postId}/like`;
    const data = await this.authenticatedRequest(endpoint, { 
      token,
      method: 'POST',
    });
    
    return data.data || {};
  }

  // Add comment
  async addComment(postId, content, token) {
    const endpoint = `/posts/posts/${postId}/comments`;
    const data = await this.authenticatedRequest(endpoint, {
      token,
      method: 'POST',
      body: JSON.stringify({ content }),
    });
    
    return data.data || {};
  }

  // Search posts
  async searchPosts(query, options = {}) {
    const { token, type = 'all', page = 1, limit = 10 } = options;
    
    const queryParams = new URLSearchParams({
      query,
      type,
      page: page.toString(),
      limit: limit.toString(),
    });

    const endpoint = `/posts/search/posts?${queryParams}`;
    const data = await this.authenticatedRequest(endpoint, { token });
    
    return data.data || {};
  }
}

// Create and export a singleton instance
export const apiService = new ApiService();
export default apiService;