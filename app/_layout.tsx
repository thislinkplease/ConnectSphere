import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider } from '@/src/context/AuthContext';
import { ThemeProvider as AppThemeProvider } from '@/src/context/ThemeContext';

export const unstable_settings = {
  initialRouteName: 'index',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <AuthProvider>
      <AppThemeProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <Stack>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="login" options={{ headerShown: false }} />
            <Stack.Screen name="signup" options={{ presentation: 'card' }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
            <Stack.Screen 
              name="notification" 
              options={{ 
                presentation: 'card',
                title: 'Notifications',
              }} 
            />
            <Stack.Screen 
              name="event-detail" 
              options={{ 
                presentation: 'card',
                title: 'Event Details',
              }} 
            />
            <Stack.Screen 
              name="chat" 
              options={{ 
                presentation: 'card',
              }} 
            />
            <Stack.Screen 
              name="profile" 
              options={{ 
                presentation: 'card',
              }} 
            />
            <Stack.Screen 
              name="edit-profile" 
              options={{ 
                presentation: 'card',
                title: 'Edit Profile',
              }} 
            />
            <Stack.Screen 
              name="settings" 
              options={{ 
                presentation: 'card',
                title: 'Settings',
              }} 
            />
            <Stack.Screen 
              name="payment-pro" 
              options={{ 
                presentation: 'card',
                title: 'Pro Features',
              }} 
            />
            <Stack.Screen 
              name="followers-list" 
              options={{ 
                presentation: 'card',
              }} 
            />
          </Stack>
          <StatusBar style="auto" />
        </ThemeProvider>
      </AppThemeProvider>
    </AuthProvider>
  );
}
