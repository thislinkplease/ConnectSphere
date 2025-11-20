import React, { createContext, useContext, useMemo } from 'react';
import { useAuth } from './AuthContext';

interface ThemeColors {
  primary: string;
  secondary: string;
  background: string;
  card: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  notification: string;
  success: string;
  error: string;
  warning: string;
  info: string;
  accent: string;
  surface: string;
  surfaceVariant: string;
  outline: string;
  shadow: string;
  overlay: string;
  disabled: string;
  link: string;
  badge: string;
  badgeText: string;
  highlight: string;
}

interface ThemeContextType {
  colors: ThemeColors;
  isPro: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Regular theme (blue & white)
const regularTheme: ThemeColors = {
  primary: '#007AFF',
  secondary: '#5AC8FA',
  background: '#f5f5f5',
  card: '#ffffff',
  text: '#333333',
  textSecondary: '#666666',
  textMuted: '#999999',
  border: '#e0e0e0',
  notification: '#FF3B30',
  success: '#4CAF50',
  error: '#FF3B30',
  warning: '#FF9500',
  info: '#5AC8FA',
  accent: '#007AFF',
  surface: '#f9f9f9',
  surfaceVariant: '#f0f0f0',
  outline: '#d0d0d0',
  shadow: '#000000',
  overlay: 'rgba(0, 0, 0, 0.5)',
  disabled: '#cccccc',
  link: '#007AFF',
  badge: '#FF3B30',
  badgeText: '#ffffff',
  highlight: '#E3F2FD',
};

// Pro theme (yellow & white)
const proTheme: ThemeColors = {
  primary: '#FFB300',
  secondary: '#FFC947',
  background: '#FFFBF0',
  card: '#ffffff',
  text: '#333333',
  textSecondary: '#666666',
  textMuted: '#999999',
  border: '#FFE082',
  notification: '#FF3B30',
  success: '#4CAF50',
  error: '#FF3B30',
  warning: '#FF9500',
  info: '#FFC947',
  accent: '#FFD54F',
  surface: '#FFFEF7',
  surfaceVariant: '#FFF9E6',
  outline: '#FFECB3',
  shadow: '#000000',
  overlay: 'rgba(0, 0, 0, 0.5)',
  disabled: '#E0E0E0',
  link: '#FFB300',
  badge: '#FFB300',
  badgeText: '#ffffff',
  highlight: '#FFF9E6',
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  
  const value = useMemo(() => {
    const isPro = user?.isPro || false;
    return {
      colors: isPro ? proTheme : regularTheme,
      isPro,
    };
  }, [user?.isPro]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
