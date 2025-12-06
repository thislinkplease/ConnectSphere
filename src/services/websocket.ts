import { io, Socket } from 'socket.io-client';
import { Message } from '../types';

class WebSocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = Infinity; // Infinite reconnection attempts
  private reconnectDelay = 1000;
  private isConnecting = false;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null; // FIXED
  private connectionStatusListeners: ((connected: boolean) => void)[] = [];
  private activeConversations: Set<string> = new Set(); // Track active conversation rooms

  connect(url: string, token?: string) {
    if (this.socket?.connected) {
    
      return;
    }

    if (this.isConnecting) {
    
      return;
    }


    this.isConnecting = true;

    this.socket = io(url, {
      auth: {
        token,
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: this.reconnectDelay,
      reconnectionDelayMax: 5000,
      timeout: 10000,
      autoConnect: true,
      forceNew: false, // Reuse existing connection if available
    });

    this.socket.on('connect', () => {
  
      this.reconnectAttempts = 0;
      this.isConnecting = false;
      this.startHeartbeat();
      
      // Rejoin all active conversation rooms
      if (this.activeConversations.size > 0) {
       
        this.activeConversations.forEach(conversationId => {
          this.socket?.emit('join_conversation', { conversationId });
        });
      }
      
      this.notifyConnectionStatus(true);
    });

    this.socket.on('disconnect', (reason) => {
    
      this.isConnecting = false;
      this.stopHeartbeat();
      this.notifyConnectionStatus(false);
    });

    this.socket.on('connect_error', (error) => {
 
      this.reconnectAttempts++;
      this.isConnecting = false;
      this.notifyConnectionStatus(false);
    });

    // Listen for heartbeat from server
    this.socket.on('heartbeat', () => {
      // Acknowledge heartbeat to keep connection alive
      this.socket?.emit('heartbeat_ack');
    });
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    // Send heartbeat every 25 seconds (server expects response within 30s)
    this.heartbeatInterval = setInterval(() => {
      if (this.socket?.connected) {
        this.socket.emit('heartbeat_ack');
      }
    }, 25000);
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private notifyConnectionStatus(connected: boolean) {
    this.connectionStatusListeners.forEach(listener => {
      try {
        listener(connected);
      } catch (error) {
      
      }
    });
  }

  onConnectionStatusChange(callback: (connected: boolean) => void) {
    this.connectionStatusListeners.push(callback);
    // Immediately call with current status
    callback(this.isConnected());
  }

  offConnectionStatusChange(callback: (connected: boolean) => void) {
    const index = this.connectionStatusListeners.indexOf(callback);
    if (index > -1) {
      this.connectionStatusListeners.splice(index, 1);
    }
  }

  disconnect() {
    if (this.socket) {

      this.stopHeartbeat();
      this.socket.disconnect();
      this.socket = null;
    }
    this.isConnecting = false;
    this.reconnectAttempts = 0;
    this.activeConversations.clear(); // Clear tracked conversations on disconnect
    this.notifyConnectionStatus(false);
  }

  // Force reconnection
  forceReconnect() {
 
    if (this.socket && !this.socket.connected) {
      this.socket.connect();
    }
  }

  // Join a conversation room
  joinConversation(conversationId: string) {
    if (this.socket) {
      this.socket.emit('join_conversation', { conversationId });
      // Track this conversation so we can rejoin on reconnection
      this.activeConversations.add(conversationId);
  
    }
  }

  // Leave a conversation room
  leaveConversation(conversationId: string) {
    if (this.socket) {
      this.socket.emit('leave_conversation', { conversationId });
      // Remove from active conversations
      this.activeConversations.delete(conversationId);
 
    }
  }

  // Send a message
  sendMessage(conversationId: string, senderUsername: string, content: string, replyToMessageId?: string) {
    if (this.socket?.connected) {
      this.socket.emit('send_message', {
        conversationId,
        senderUsername,
        content,
        replyToMessageId,
      });
      return true;
    } else {
  
      return false;
    }
  }

  // Send typing indicator
  sendTyping(conversationId: string, username: string, isTyping: boolean) {
    if (this.socket) {
      this.socket.emit('typing', {
        conversationId,
        username,
        isTyping,
      });
    }
  }

  // Mark messages as read
  markAsRead(conversationId: string, username: string, upToMessageId: number) {
    if (this.socket) {
      this.socket.emit('mark_read', {
        conversationId,
        username,
        upToMessageId,
      });
    }
  }

  // Listen for new messages
  onNewMessage(callback: (message: Message) => void) {
    if (this.socket) {
      this.socket.on('new_message', callback);
    }
  }

  // Listen for typing indicator
  onTyping(callback: (data: { conversationId: string; username: string; isTyping: boolean }) => void) {
    if (this.socket) {
      this.socket.on('typing', callback);
    }
  }

  // Listen for messages marked as read
  onMessagesRead(callback: (data: { conversationId: string; username: string; upToMessageId: number }) => void) {
    if (this.socket) {
      this.socket.on('messages_read', callback);
    }
  }

  // Listen for user online status
  onUserOnline(callback: (data: { username: string; isOnline: boolean }) => void) {
    if (this.socket) {
      this.socket.on('user_status', callback);
    }
  }

  // ==================== Community Chat Methods ====================

  // Notify server that user joined a community (to ensure conversation exists)
  notifyCommunityJoined(communityId: number, username: string) {
    if (this.socket?.connected) {
      this.socket.emit('notify_community_conversation', { communityId, username });
      console.log(`Notified server about joining community ${communityId}`);
    }
  }

  // Join community chat
  joinCommunityChat(communityId: number) {
    if (this.socket?.connected) {
      this.socket.emit('join_community_chat', { communityId });
      console.log(`Joined community chat ${communityId}`);
    }
  }

  // Leave community chat
  leaveCommunityChat(communityId: number) {
    if (this.socket?.connected) {
      this.socket.emit('leave_community_chat', { communityId });
      console.log(`Left community chat ${communityId}`);
    }
  }

  // Send community message
  sendCommunityMessage(communityId: number, senderUsername: string, content: string) {
    if (this.socket?.connected) {
      this.socket.emit('send_community_message', {
        communityId,
        senderUsername,
        content,
      });
      return true;
    }
    return false;
  }

  // Send community typing indicator
  sendCommunityTyping(communityId: number, username: string, isTyping: boolean) {
    if (this.socket?.connected) {
      this.socket.emit('community_typing', {
        communityId,
        username,
        isTyping,
      });
    }
  }

  // Listen for new community messages
  onNewCommunityMessage(callback: (message: any) => void) {
    if (this.socket) {
      this.socket.on('new_community_message', callback);
    }
  }

  // Listen for community typing indicator
  onCommunityTyping(callback: (data: { communityId: number; username: string; isTyping: boolean }) => void) {
    if (this.socket) {
      this.socket.on('community_typing', callback);
    }
  }

  // Listen for user joined community chat
  onUserJoinedCommunityChat(callback: (data: { communityId: number; username: string }) => void) {
    if (this.socket) {
      this.socket.on('user_joined_community_chat', callback);
    }
  }

  // Listen for user left community chat
  onUserLeftCommunityChat(callback: (data: { communityId: number; username: string }) => void) {
    if (this.socket) {
      this.socket.on('user_left_community_chat', callback);
    }
  }

  // Remove all listeners
  removeAllListeners() {
    if (this.socket) {
      this.socket.removeAllListeners();
    }
  }

  // Remove specific listener
  off(event: string, callback?: (...args: any[]) => void) {
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }

  // Generic event listener for any socket event
  on(event: string, callback: (...args: any[]) => void) {
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  // Generic event emitter for any socket event
  emit(event: string, ...args: any[]) {
    if (this.socket?.connected) {
      this.socket.emit(event, ...args);
      return true;
    }
    return false;
  }

  // Check if connected
  isConnected(): boolean {
    return this.socket?.connected || false;
  }
}

export default new WebSocketService();