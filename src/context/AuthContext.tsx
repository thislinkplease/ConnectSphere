import React, { createContext, useContext, useState, useEffect } from 'react';
import { AppState, AppStateStatus, Alert } from 'react-native';
import { User, AuthState } from '../types';
import ApiService from '../services/api';
import WebSocketService from '../services/websocket';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  signup: (username: string, name: string, email: string, password: string, country: string, city: string, gender?: 'Male' | 'Female' | 'Other') => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (data: Partial<User>) => Promise<void>;
  refreshUser: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const USER_KEY = '@auth_user';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    token: null,
  });
  const [isLoading, setIsLoading] = useState(true);

  // Handle Supabase Auth State Changes
  useEffect(() => {
    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        handleSession(session);
      } else {
        setIsLoading(false);
      }
    });

    // Listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
        handleSession(session);
      } else {
        handleSignOut();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleSession = async (session: any) => {
    try {
      const token = session.access_token;
      const supabaseUser = session.user;

      console.log('🔑 Handling session for user:', supabaseUser?.email);

      ApiService.setAuthToken(token);

      // Fetch user profile from our backend
      // We try to get the user from storage first to show something immediately
      const storedUserJson = await AsyncStorage.getItem(USER_KEY);
      let user = storedUserJson ? JSON.parse(storedUserJson) : null;

      // Try to fetch fresh user data from backend
      try {
        console.log('📥 Fetching user profile from backend...');
        const freshUser = await ApiService.getCurrentUser();
        user = freshUser;
        await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
        console.log('✅ User profile loaded:', user.username);
      } catch (err: any) {
        console.error('❌ Error fetching user profile:', err);

        // If backend user doesn't exist but Supabase user does,
        // we try to create the backend user automatically (Recovery Flow)
        if ((err?.response?.status === 401 || err?.response?.status === 404) && supabaseUser) {
          console.warn('⚠️  User exists in Supabase but not in backend. Attempting recovery...');

          try {
            const baseUsername = supabaseUser.user_metadata?.username || supabaseUser.email?.split('@')[0];
            const name = supabaseUser.user_metadata?.name || supabaseUser.email?.split('@')[0];

            let recoveredUser;
            try {
              // First try with original username
              recoveredUser = await ApiService.createProfile({
                id: supabaseUser.id,
                email: supabaseUser.email,
                username: baseUsername,
                name: name,
              });
            } catch (profileErr: any) {
              // If username taken (409), try with random suffix
              if (profileErr?.response?.status === 409) {
                console.log('⚠️ Username taken during recovery, trying with suffix...');
                const newUsername = `${baseUsername}_${Math.floor(Math.random() * 10000)}`;
                recoveredUser = await ApiService.createProfile({
                  id: supabaseUser.id,
                  email: supabaseUser.email,
                  username: newUsername,
                  name: name,
                });
              } else {
                throw profileErr;
              }
            }

            console.log('✅ Recovery successful - User profile created:', recoveredUser.username);
            user = recoveredUser;
            await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
          } catch (recoveryErr) {
            console.error('❌ Recovery failed:', recoveryErr);
            // If recovery fails, we really can't do much else than logout or show error
            console.warn('   1. Signup backend sync failed');
            console.warn('   2. User was created directly in Supabase');
            console.warn('   3. Backend database was reset');
            console.log('💡 You may need to sign up again or contact support');
          }
        }

        // If we have a stored user, use it as fallback
        if (user) {
          console.log('📦 Using cached user data');
        }
      }

      // Connect WebSocket after we have user data
      const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
      if (user && !WebSocketService.isConnected()) {
        console.log('🔌 Connecting WebSocket...');
        WebSocketService.connect(apiUrl, token);
      }

      setAuthState({
        isAuthenticated: true,
        user,
        token,
      });

      console.log('✅ Session handled successfully');
    } catch (error) {
      console.error('❌ Error handling session:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    await AsyncStorage.removeItem(USER_KEY);
    ApiService.removeAuthToken();
    WebSocketService.disconnect();
    setAuthState({
      isAuthenticated: false,
      user: null,
      token: null,
    });
    setIsLoading(false);
  };

  // Keep WebSocket connected when app comes to foreground
  useEffect(() => {
    if (!authState.isAuthenticated || !authState.token) {
      return;
    }

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        console.log('📱 App came to foreground - checking WebSocket connection');
        if (!WebSocketService.isConnected()) {
          const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
          WebSocketService.connect(apiUrl, authState.token || '');
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [authState.isAuthenticated, authState.token]);

  const login = async (email: string, password: string) => {
    console.log('🔐 Attempting login for:', email);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      console.error('❌ Login error:', error);
      Alert.alert('Login Failed', error.message || 'An unexpected error occurred');
      throw error;
    }

    console.log('✅ Supabase login successful:', data.user?.email);
    // onAuthStateChange will handle the rest
  };

  const signup = async (username: string, name: string, email: string, password: string, country: string, city: string, gender?: 'Male' | 'Female' | 'Other') => {
    try {
      console.log('📝 Starting signup process for:', email, 'username:', username);

      // 1. Sign up with Supabase Auth
      // Note: Email confirmation is controlled in Supabase Dashboard, not here
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { username, name },
        }
      });

      if (error) {
        console.error('❌ Supabase signup error:', error);
        throw error;
      }

      console.log('✅ Supabase user created:', data.user?.id);

      if (data.user) {
        // 2. Sync with our backend
        console.log('🔄 Syncing user data with backend...');
        try {
          await ApiService.signup({
            id: data.user.id,
            username,
            name,
            email,
            password: 'sb-password-placeholder', // Placeholder - not used
            country,
            city,
            gender,
          });
          console.log('✅ Backend sync successful');
        } catch (backendError) {
          console.error('❌ Backend sync error:', backendError);
          // If backend sync fails, we should still allow login since Supabase user exists
          // The backend can be synced later via the /users/me endpoint
          console.warn('⚠️ Backend sync failed but Supabase user created. User can still login.');
        }
      }

      // Check if email confirmation is required
      if (data.session) {
        console.log('✅ Session created immediately (email confirmation disabled)');
      } else {
        console.log('⚠️ Email confirmation may be required');
      }
    } catch (error: any) {
      console.error('❌ Signup error:', error);
      Alert.alert('Signup Failed', error.message || 'An unexpected error occurred');
      throw error;
    }
  };

  const logout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) console.error('Logout error:', error);
    // onAuthStateChange will handle state cleanup
  };

  const updateUser = async (data: Partial<User>) => {
    if (!authState.user?.username) return;

    try {
      let userId = authState.user.id;
      if (!userId) {
        const freshUser = await ApiService.getUserByUsername(authState.user.username);
        userId = freshUser.id;
      }

      const updatedUser = await ApiService.updateUser(userId, data);
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
    if (!authState.token) return;

    try {
      const freshUser = await ApiService.getCurrentUser();
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
