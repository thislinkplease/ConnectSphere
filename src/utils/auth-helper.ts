/**
 * Authentication Helper Utilities
 * 
 * These utilities help diagnose and fix common authentication issues
 */

import { supabase } from '../lib/supabase';
import ApiService from '../services/api';

/**
 * Check if current session user matches the given email
 * Note: This only checks the currently logged-in user, not if a user exists in the system
 */
export async function checkCurrentUserEmail(email: string): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.email === email;
  } catch {
    return false;
  }
}

/**
 * Check if a user exists in the backend database
 */
export async function checkBackendUser(username: string): Promise<boolean> {
  try {
    const user = await ApiService.getUserByUsername(username);
    return !!user;
  } catch {
    return false;
  }
}

/**
 * Sync Supabase user with backend (for cases where backend sync failed during signup)
 * 
 * Note: The password field is a placeholder since actual authentication is handled by Supabase.
 * The backend should not validate or use this password field.
 */
export async function syncUserWithBackend(
  supabaseUserId: string,
  email: string,
  username: string,
  name?: string
): Promise<void> {
  try {
    console.log('🔄 Syncing user with backend...');
    
    // Password is a placeholder - backend should use Supabase ID for authentication
    const PLACEHOLDER_PASSWORD = 'supabase-auth-managed';
    
    await ApiService.signup({
      id: supabaseUserId,
      username,
      name: name || username,
      email,
      password: PLACEHOLDER_PASSWORD, // Not used for authentication
      country: '',
      city: '',
      gender: 'Male',
    });
    
    console.log('✅ Backend sync successful');
  } catch (error) {
    console.error('❌ Backend sync failed:', error);
    throw error;
  }
}

/**
 * Auth status result interface
 */
interface AuthStatus {
  hasSupabaseSession: boolean;
  supabaseUser: {
    id: string;
    email?: string;
    [key: string]: any;
  } | null;
  backendReachable: boolean;
  backendUser: any | null; // Type depends on backend User model
  issue?: string;
}

/**
 * Get detailed auth status for debugging
 */
export async function getAuthStatus(): Promise<AuthStatus> {
  const status: AuthStatus = {
    hasSupabaseSession: false,
    supabaseUser: null,
    backendReachable: false,
    backendUser: null,
    issue: undefined,
  };

  try {
    // Check Supabase session
    const { data: { session } } = await supabase.auth.getSession();
    status.hasSupabaseSession = !!session;
    status.supabaseUser = session?.user || null;

    if (!session) {
      status.issue = 'No active Supabase session. Please login.';
      return status;
    }

    // Check backend connection
    try {
      const user = await ApiService.getCurrentUser();
      status.backendReachable = true;
      status.backendUser = user;
    } catch (error: any) {
      status.backendReachable = error?.response?.status !== undefined;
      
      if (error?.response?.status === 401 || error?.response?.status === 404) {
        status.issue = 'User exists in Supabase but not in backend. Backend sync may have failed.';
      } else if (!status.backendReachable) {
        status.issue = 'Cannot reach backend server. Please check your network connection and server status.';
      } else {
        status.issue = `Backend error: ${error?.message || 'Unknown error'}`;
      }
    }

    return status;
  } catch (error: any) {
    status.issue = `Error checking auth status: ${error?.message || 'Unknown error'}`;
    return status;
  }
}

/**
 * Format error message for user display
 */
export function formatAuthError(error: Error | { message?: string } | string | unknown): string {
  if (!error) return 'An unknown error occurred';

  const message = typeof error === 'string' 
    ? error 
    : (error as any).message || String(error);

  // Map common errors to user-friendly messages
  if (message.includes('Invalid login credentials')) {
    return 'Invalid email or password. Please check your credentials and try again.\n\nIf you don\'t have an account yet, please sign up first.';
  }

  if (message.includes('Email not confirmed')) {
    return 'Please confirm your email address before logging in. Check your inbox for a confirmation link.';
  }

  if (message.includes('User already registered')) {
    return 'This email is already registered. Please try logging in instead.';
  }

  if (message.includes('Password should be at least')) {
    return 'Password must be at least 6 characters long.';
  }

  if (message.includes('network') || message.includes('Network')) {
    return 'Network error. Please check your internet connection and try again.';
  }

  if (message.includes('timeout')) {
    return 'Request timed out. Please check your internet connection and try again.';
  }

  // Return original message if no match
  return message;
}
