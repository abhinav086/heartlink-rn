import BASE_URL from "../../config/config";

export interface ImpressionResponse {
  success: boolean;
  statusCode: number;
  data: {
    targetUser: {
      _id: string;
      fullName: string;
      username: string;
      photoUrl: string;
      bio: string;
    };
    impressionStats: {
      totalImpressions: number;
      impressedBy: any[];
    };
    isImpressed: boolean;
  };
  message: string;
}

export interface ImpressionError {
  success: boolean;
  statusCode: number;
  message: string;
}

class ImpressionService {
  /**
   * Impress a user
   * @param userId - Target user ID to impress
   * @param token - Authentication token
   */
  static async impressUser(userId: string, token: string): Promise<ImpressionResponse> {
    try {
      const response = await fetch(`${BASE_URL}/api/v1/users/impress/${userId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw {
          success: false,
          statusCode: response.status,
          message: data.message || 'Failed to impress user',
        } as ImpressionError;
      }

      return data;
    } catch (error: any) {
      console.error('Error impressing user:', error);
      
      // Handle network errors
      if (!error.statusCode) {
        throw {
          success: false,
          statusCode: 500,
          message: 'Network error. Please check your connection.',
        } as ImpressionError;
      }
      
      throw error;
    }
  }

  /**
   * Unimpress a user
   * @param userId - Target user ID to unimpress
   * @param token - Authentication token
   */
  static async unimpressUser(userId: string, token: string): Promise<ImpressionResponse> {
    try {
      const response = await fetch(`${BASE_URL}/api/v1/users/unimpress/${userId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw {
          success: false,
          statusCode: response.status,
          message: data.message || 'Failed to unimpress user',
        } as ImpressionError;
      }

      return data;
    } catch (error: any) {
      console.error('Error unimpressing user:', error);
      
      // Handle network errors
      if (!error.statusCode) {
        throw {
          success: false,
          statusCode: 500,
          message: 'Network error. Please check your connection.',
        } as ImpressionError;
      }
      
      throw error;
    }
  }

  /**
   * Check impression status between current user and target user
   * @param userId - Target user ID
   * @param token - Authentication token
   */
  static async checkImpressionStatus(userId: string, token: string) {
    try {
      const response = await fetch(`${BASE_URL}/api/v1/users/impression-status/${userId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw {
          success: false,
          statusCode: response.status,
          message: data.message || 'Failed to check impression status',
        } as ImpressionError;
      }

      return data;
    } catch (error: any) {
      console.error('Error checking impression status:', error);
      
      if (!error.statusCode) {
        throw {
          success: false,
          statusCode: 500,
          message: 'Network error. Please check your connection.',
        } as ImpressionError;
      }
      
      throw error;
    }
  }

  /**
   * Get impressions received by current user (for notifications)
   * @param token - Authentication token
   * @param page - Page number for pagination
   * @param limit - Number of items per page
   */
  static async getMyImpressions(token: string, page: number = 1, limit: number = 20) {
    try {
      const response = await fetch(`${BASE_URL}/api/v1/users/my-impressions?page=${page}&limit=${limit}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw {
          success: false,
          statusCode: response.status,
          message: data.message || 'Failed to fetch impressions',
        } as ImpressionError;
      }

      return data;
    } catch (error: any) {
      console.error('Error fetching impressions:', error);
      
      if (!error.statusCode) {
        throw {
          success: false,
          statusCode: 500,
          message: 'Network error. Please check your connection.',
        } as ImpressionError;
      }
      
      throw error;
    }
  }
}

export default ImpressionService;