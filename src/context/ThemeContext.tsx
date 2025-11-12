import React, { createContext, useContext, useMemo } from 'react';
import { useAuth } from './AuthContext';

interface ThemeColors {
  primary: string;
  secondary: string;
  background: string;
  card: string;
  text: string;
  border: string;
  notification: string;
  success: string;
  error: string;
  warning: string;
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
  border: '#e0e0e0',
  notification: '#FF3B30',
  success: '#4CAF50',
  error: '#FF3B30',
  warning: '#FF9500',
};

// Pro theme (yellow & white)
const proTheme: ThemeColors = {
  primary: '#FFB300',
  secondary: '#FFC947',
  background: '#FFFBF0',
  card: '#ffffff',
  text: '#333333',
  border: '#FFE082',
  notification: '#FF3B30',
  success: '#4CAF50',
  error: '#FF3B30',
  warning: '#FF9500',
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
