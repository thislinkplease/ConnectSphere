import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, AuthState } from '../types';
import ApiService from '../services/api';
import WebSocketService from '../services/websocket';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  signup: (username: string, name: string, email: string, password: string, country: string, city: string, gender?: 'Male' | 'Female' | 'Other') => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (data: Partial<User>) => Promise<void>;
  refreshUser: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = '@auth_token';
const USER_KEY = '@auth_user';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    token: null,
  });
  const [isLoading, setIsLoading] = useState(true);

  // Load stored auth on mount
  useEffect(() => {
    loadStoredAuth();
  }, []);

  const loadStoredAuth = async () => {
    try {
      const token = await AsyncStorage.getItem(TOKEN_KEY);
      const userJson = await AsyncStorage.getItem(USER_KEY);
      
      if (token && userJson) {
        const user = JSON.parse(userJson);
        ApiService.setAuthToken(token);
        
        // Initialize WebSocket connection
        const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
        WebSocketService.connect(apiUrl, token);
        
        // Check Pro status from server
        try {
          if (user.username) {
            const proStatus = await ApiService.getProStatus(user.username);
            user.isPro = proStatus.isPro;
            // Update stored user with Pro status
            await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
          }
        } catch (proError) {
          console.error('Error loading pro status:', proError);
          // Continue with stored isPro value
        }
        
        setAuthState({
          isAuthenticated: true,
          user,
          token,
        });
      }
    } catch (error) {
      console.error('Error loading stored auth:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const { user, token } = await ApiService.login({ email, password });
      
      // Check Pro status from server
      try {
        if (user.username) {
          const proStatus = await ApiService.getProStatus(user.username);
          user.isPro = proStatus.isPro;
        }
      } catch (proError) {
        console.error('Error loading pro status:', proError);
        // Continue without Pro status
      }
      
      // Store auth data
      await AsyncStorage.setItem(TOKEN_KEY, token);
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
      
      ApiService.setAuthToken(token);
      
      // Initialize WebSocket connection
      const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
      WebSocketService.connect(apiUrl, token);
      
      setAuthState({
        isAuthenticated: true,
        user,
        token,
      });
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const signup = async (username: string, name: string, email: string, password: string, country: string, city: string, gender?: 'Male' | 'Female' | 'Other') => {
    try {
      const { user, token } = await ApiService.signup({
        username,
        name,
        email,
        password,
        country,
        city,
        gender,
      });
      
      // Check Pro status from server (new users typically won't be Pro, but check anyway)
      try {
        if (user.username) {
          const proStatus = await ApiService.getProStatus(user.username);
          user.isPro = proStatus.isPro;
        }
      } catch (proError) {
        console.error('Error loading pro status:', proError);
        // Continue without Pro status
      }
      
      // Store auth data
      await AsyncStorage.setItem(TOKEN_KEY, token);
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
      
      ApiService.setAuthToken(token);
      
      // Initialize WebSocket connection
      const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
      WebSocketService.connect(apiUrl, token);
      
      setAuthState({
        isAuthenticated: true,
        user,
        token,
      });
    } catch (error) {
      console.error('Signup error:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      // Disconnect WebSocket immediately
      WebSocketService.disconnect();
      
      // Clear stored auth data immediately
      await AsyncStorage.removeItem(TOKEN_KEY);
      await AsyncStorage.removeItem(USER_KEY);
      
      // Clear auth token
      ApiService.removeAuthToken();
      
      // Update state immediately
      setAuthState({
        isAuthenticated: false,
        user: null,
        token: null,
      });
      
      // Call logout API in background (don't wait for it)
      ApiService.logout().catch(error => {
        console.error('Logout API error:', error);
      });
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const updateUser = async (data: Partial<User>) => {
    if (!authState.user?.username) return;

    try {
      // Use the user ID from the current authState if available
      // If not, fetch the latest user data to get the correct ID
      let userId = authState.user.id;
      
      // Only fetch fresh user if we don't have an ID
      if (!userId) {
        const freshUser = await ApiService.getUserByUsername(authState.user.username);
        userId = freshUser.id;
      }
      
      // Update using the user ID
      const updatedUser = await ApiService.updateUser(userId, data);
      
      // Update stored user
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(updatedUser));
      
      setAuthState(prev => ({
        ...prev,
        user: updatedUser,
      }));
    } catch (error) {
      console.error('Update user error:', error);
      throw error;
    }
  };

  const refreshUser = async () => {
    if (!authState.user?.username) return;

    try {
      // Fetch fresh user data from server
      const freshUser = await ApiService.getUserByUsername(authState.user.username);
      
      // Update stored user
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(freshUser));
      
      setAuthState(prev => ({
        ...prev,
        user: freshUser,
      }));
    } catch (error) {
      console.error('Refresh user error:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        ...authState,
        login,
        signup,
        logout,
        updateUser,
        refreshUser,
        isLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
