import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider } from '@/src/context/AuthContext';
import { ThemeProvider as AppThemeProvider } from '@/src/context/ThemeContext';
import { StripeProvider } from '@/src/context/StripeContext';

export const unstable_settings = {
  initialRouteName: 'index',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <StripeProvider>
      <AuthProvider>
        <AppThemeProvider>
          <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
            <Stack>
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="auth/login" options={{ headerShown: false }} />
              <Stack.Screen name="auth/signup" options={{ presentation: 'card' }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
           
              <Stack.Screen 
                name="feed/notification" 
                options={{ 
                  presentation: 'card',
                  title: 'Notifications',
                }} 
              />
              <Stack.Screen 
                name="feed/event-detail" 
                options={{ 
                  presentation: 'card',
                  title: 'Event Details',
                }} 
              />
              <Stack.Screen 
                name="inbox/chat" 
                options={{ 
                  presentation: 'card',
                }} 
              />
              <Stack.Screen 
                name="account/profile" 
                options={{ 
                  presentation: 'card',
                }} 
              />
              <Stack.Screen 
                name="account/edit-profile" 
                options={{ 
                  presentation: 'card',
                  title: 'Edit Profile',
                }} 
              />
              <Stack.Screen 
                name="account/settings" 
                options={{ 
                  presentation: 'card',
                  title: 'Settings',
                }} 
              />
              <Stack.Screen 
                name="account/payment-pro" 
                options={{ 
                  presentation: 'card',
                  title: 'Pro Features',
                }} 
              />
              <Stack.Screen 
                name="account/followers-list" 
                options={{ 
                  presentation: 'card',
                }} 
              />
            </Stack>
            <StatusBar style="auto" />
          </ThemeProvider>
        </AppThemeProvider>
      </AuthProvider>
    </StripeProvider>
  );
}
