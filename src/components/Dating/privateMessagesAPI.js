// Dating/privateMessagesAPI.js - API utility for Private Messages
import AsyncStorage from '@react-native-async-storage/async-storage';

// Configuration
const API_BASE_URL = 'https://backendforheartlink.in/api/v1/private-messages';

// Types
export interface MessageTypes {
  HI: string;
  HELLO: string;
}

export interface User {
  _id: string;
  username: string;
  avatar: string;
  isVerified: boolean;
}

export interface Message {
  _id: string;
  sender: User;
  receiver: User;
  messageType: string;
  messageContent: string;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SendMessageRequest {
  receiverId: string;
  messageType: 'HI' | 'HELLO';
}

export interface ApiResponse<T> {
  statusCode: number;
  data: T;
  message: string;
  success: boolean;
}

export interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  totalMessages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

// Helper function to get auth headers
const getAuthHeaders = async () => {
  try {
    const token = await AsyncStorage.getItem('authToken');
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  } catch (error) {
    console.error('Error getting auth token:', error);
    throw new Error('Authentication required');
  }
};

// Helper function to handle API responses
const handleApiResponse = async (response: Response) => {
  const result = await response.json();
  
  if (!response.ok) {
    throw new Error(result.message || `HTTP error! status: ${response.status}`);
  }
  
  if (!result.success) {
    throw new Error(result.message || 'API request failed');
  }
  
  return result;
};

// API Functions
export const privateMessagesAPI = {
  
  /**
   * Get available message types
   * @returns Promise<MessageTypes>
   */
  getMessageTypes: async (): Promise<MessageTypes> => {
    try {
      const response = await fetch(`${API_BASE_URL}/message-types`);
      const result = await handleApiResponse(response);
      return result.data.messageTypes;
    } catch (error) {
      console.error('Error fetching message types:', error);
      throw error;
    }
  },

  /**
   * Send a predefined message to another user
   * @param request - SendMessageRequest object
   * @returns Promise<Message>
   */
  sendMessage: async (request: SendMessageRequest): Promise<Message> => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/send`, {
        method: 'POST',
        headers,
        body: JSON.stringify(request)
      });
      
      const result = await handleApiResponse(response);
      return result.data;
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  },

  /**
   * Get received messages (inbox) with pagination and filtering
   * @param page - Page number (default: 1)
   * @param limit - Messages per page (default: 20, max: 50)
   * @param isRead - Filter by read status (optional)
   * @returns Promise<{messages: Message[], pagination: PaginationInfo, unreadCount: number}>
   */
  getReceivedMessages: async (
    page: number = 1, 
    limit: number = 20, 
    isRead?: boolean
  ) => {
    try {
      const headers = await getAuthHeaders();
      let url = `${API_BASE_URL}/received?page=${page}&limit=${limit}`;
      
      if (isRead !== undefined) {
        url += `&isRead=${isRead}`;
      }
      
      const response = await fetch(url, { headers });
      const result = await handleApiResponse(response);
      
      return {
        messages: result.data.messages,
        pagination: result.data.pagination,
        unreadCount: result.data.unreadCount
      };
    } catch (error) {
      console.error('Error fetching received messages:', error);
      throw error;
    }
  },

  /**
   * Get sent messages (outbox) with pagination
   * @param page - Page number (default: 1)
   * @param limit - Messages per page (default: 20)
   * @returns Promise<{messages: Message[], pagination: PaginationInfo}>
   */
  getSentMessages: async (page: number = 1, limit: number = 20) => {
    try {
      const headers = await getAuthHeaders();
      const url = `${API_BASE_URL}/sent?page=${page}&limit=${limit}`;
      
      const response = await fetch(url, { headers });
      const result = await handleApiResponse(response);
      
      return {
        messages: result.data.messages,
        pagination: result.data.pagination
      };
    } catch (error) {
      console.error('Error fetching sent messages:', error);
      throw error;
    }
  },

  /**
   * Get unread message count
   * @returns Promise<number>
   */
  getUnreadCount: async (): Promise<number> => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/unread-count`, { headers });
      const result = await handleApiResponse(response);
      return result.data.unreadCount;
    } catch (error) {
      console.error('Error fetching unread count:', error);
      throw error;
    }
  },

  /**
   * Mark a single message as read
   * @param messageId - ID of the message to mark as read
   * @returns Promise<Message>
   */
  markAsRead: async (messageId: string): Promise<Message> => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/read/${messageId}`, {
        method: 'PATCH',
        headers
      });
      
      const result = await handleApiResponse(response);
      return result.data;
    } catch (error) {
      console.error('Error marking message as read:', error);
      throw error;
    }
  },

  /**
   * Mark multiple messages as read
   * @param messageIds - Array of message IDs to mark as read
   * @returns Promise<{modifiedCount: number, messageIds: string[]}>
   */
  markMultipleAsRead: async (messageIds: string[]) => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/read-multiple`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ messageIds })
      });
      
      const result = await handleApiResponse(response);
      return {
        modifiedCount: result.data.modifiedCount,
        messageIds: result.data.messageIds
      };
    } catch (error) {
      console.error('Error marking multiple messages as read:', error);
      throw error;
    }
  },

  /**
   * Get conversation with a specific user
   * @param userId - ID of the other user
   * @param page - Page number (default: 1)
   * @param limit - Messages per page (default: 20)
   * @returns Promise<{messages: Message[], otherUser: User, pagination: PaginationInfo}>
   */
  getConversation: async (userId: string, page: number = 1, limit: number = 20) => {
    try {
      const headers = await getAuthHeaders();
      const url = `${API_BASE_URL}/conversation/${userId}?page=${page}&limit=${limit}`;
      
      const response = await fetch(url, { headers });
      const result = await handleApiResponse(response);
      
      return {
        messages: result.data.messages,
        otherUser: result.data.otherUser,
        pagination: result.data.pagination
      };
    } catch (error) {
      console.error('Error fetching conversation:', error);
      throw error;
    }
  },

  /**
   * Delete a message (only sender can delete)
   * @param messageId - ID of the message to delete
   * @returns Promise<void>
   */
  deleteMessage: async (messageId: string): Promise<void> => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/delete/${messageId}`, {
        method: 'DELETE',
        headers
      });
      
      await handleApiResponse(response);
    } catch (error) {
      console.error('Error deleting message:', error);
      throw error;
    }
  },

  /**
   * Get all conversations (this is a helper method to build conversation list)
   * Note: This endpoint might not exist in your API, so you may need to build this
   * from received and sent messages
   */
  getAllConversations: async () => {
    try {
      // This is a mock implementation - you may need to implement this differently
      // based on your backend or build it from received/sent messages
      
      const [received, sent] = await Promise.all([
        privateMessagesAPI.getReceivedMessages(1, 50),
        privateMessagesAPI.getSentMessages(1, 50)
      ]);
      
      // Build conversations from received and sent messages
      const conversationMap = new Map();
      
      // Process received messages
      received.messages.forEach(message => {
        const otherUserId = message.sender._id;
        if (!conversationMap.has(otherUserId)) {
          conversationMap.set(otherUserId, {
            otherUser: message.sender,
            lastMessage: message,
            unreadCount: !message.isRead ? 1 : 0,
            lastMessageTime: new Date(message.createdAt).getTime()
          });
        } else {
          const existing = conversationMap.get(otherUserId);
          if (new Date(message.createdAt).getTime() > existing.lastMessageTime) {
            existing.lastMessage = message;
            existing.lastMessageTime = new Date(message.createdAt).getTime();
          }
          if (!message.isRead) {
            existing.unreadCount++;
          }
        }
      });
      
      // Process sent messages
      sent.messages.forEach(message => {
        const otherUserId = message.receiver._id;
        if (!conversationMap.has(otherUserId)) {
          conversationMap.set(otherUserId, {
            otherUser: message.receiver,
            lastMessage: message,
            unreadCount: 0,
            lastMessageTime: new Date(message.createdAt).getTime()
          });
        } else {
          const existing = conversationMap.get(otherUserId);
          if (new Date(message.createdAt).getTime() > existing.lastMessageTime) {
            existing.lastMessage = message;
            existing.lastMessageTime = new Date(message.createdAt).getTime();
          }
        }
      });
      
      // Convert to array and sort by last message time
      const conversations = Array.from(conversationMap.values())
        .sort((a, b) => b.lastMessageTime - a.lastMessageTime);
      
      return {
        conversations,
        totalUnreadCount: received.unreadCount
      };
      
    } catch (error) {
      console.error('Error fetching conversations:', error);
      throw error;
    }
  }
};

// Socket.IO Event Handlers
export class PrivateMessagesSocket {
  private socket: any = null;
  private listeners: Map<string, Function[]> = new Map();

  constructor(socketInstance: any) {
    this.socket = socketInstance;
    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    if (!this.socket) return;

    // Listen for new personal messages
    this.socket.on('new_personal_message', (messageData: Message) => {
      this.emit('newMessage', messageData);
    });

    // Listen for message read events
    this.socket.on('message_read', (messageData: Message) => {
      this.emit('messageRead', messageData);
    });
  }

  // Add event listener
  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)?.push(callback);
  }

  // Remove event listener
  off(event: string, callback: Function) {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      const index = eventListeners.indexOf(callback);
      if (index > -1) {
        eventListeners.splice(index, 1);
      }
    }
  }

  // Emit event to listeners
  private emit(event: string, data: any) {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(callback => callback(data));
    }
  }

  // Cleanup
  destroy() {
    if (this.socket) {
      this.socket.off('new_personal_message');
      this.socket.off('message_read');
    }
    this.listeners.clear();
  }
}

// Export default
export default privateMessagesAPI;