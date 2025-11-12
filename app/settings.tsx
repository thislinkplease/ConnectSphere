import React, { useState } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Switch, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/context/AuthContext';
import { useTheme } from '@/src/context/ThemeContext';

export default function SettingsScreen() {
  const router = useRouter();
  const { logout } = useAuth();
  const { colors } = useTheme();

  // Settings state
  const [pushNotifications, setPushNotifications] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [messageNotifications, setMessageNotifications] = useState(true);
  const [eventNotifications, setEventNotifications] = useState(true);
  const [hangoutNotifications, setHangoutNotifications] = useState(true);
  const [profileVisibility, setProfileVisibility] = useState(true);
  const [showLocation, setShowLocation] = useState(true);
  const [showOnlineStatus, setShowOnlineStatus] = useState(true);

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Logout', 
          style: 'destructive',
          onPress: async () => {
            try {
              await logout();
              router.replace('/login');
            } catch (error) {
              console.error('Logout error:', error);
              Alert.alert('Error', 'Failed to logout. Please try again.');
            }
          }
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: () => {
            Alert.alert('Feature Coming Soon', 'Account deletion will be available soon.');
          }
        },
      ]
    );
  };

  const SettingRow = ({ 
    icon, 
    title, 
    value, 
    onValueChange, 
    showSwitch = false,
    onPress,
    showChevron = false,
    danger = false,
  }: {
    icon: string;
    title: string;
    value?: boolean;
    onValueChange?: (value: boolean) => void;
    showSwitch?: boolean;
    onPress?: () => void;
    showChevron?: boolean;
    danger?: boolean;
  }) => (
    <TouchableOpacity 
      style={styles.settingRow}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={styles.settingLeft}>
        <Ionicons name={icon as any} size={24} color={danger ? '#FF3B30' : '#666'} />
        <Text style={[styles.settingTitle, danger && styles.dangerText]}>{title}</Text>
      </View>
      <View style={styles.settingRight}>
        {showSwitch && (
          <Switch
            value={value}
            onValueChange={onValueChange}
            trackColor={{ false: '#e0e0e0', true: colors.primary }}
            thumbColor="#fff"
          />
        )}
        {showChevron && (
          <Ionicons name="chevron-forward" size={20} color="#ccc" />
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Settings',
        }}
      />
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
        <ScrollView>
          {/* Account Settings */}
          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <Text style={styles.sectionTitle}>Account</Text>
            <SettingRow
              icon="person-outline"
              title="Edit Profile"
              onPress={() => router.push('/edit-profile')}
              showChevron
            />
            <SettingRow
              icon="key-outline"
              title="Change Password"
              onPress={() => Alert.alert('Coming Soon', 'Password change will be available soon.')}
              showChevron
            />
            <SettingRow
              icon="shield-checkmark-outline"
              title="Privacy & Security"
              onPress={() => Alert.alert('Coming Soon', 'Privacy settings will be available soon.')}
              showChevron
            />
          </View>

          {/* Notification Settings */}
          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <Text style={styles.sectionTitle}>Notifications</Text>
            <SettingRow
              icon="notifications-outline"
              title="Push Notifications"
              value={pushNotifications}
              onValueChange={setPushNotifications}
              showSwitch
            />
            <SettingRow
              icon="mail-outline"
              title="Email Notifications"
              value={emailNotifications}
              onValueChange={setEmailNotifications}
              showSwitch
            />
            <SettingRow
              icon="chatbubble-outline"
              title="Message Notifications"
              value={messageNotifications}
              onValueChange={setMessageNotifications}
              showSwitch
            />
            <SettingRow
              icon="calendar-outline"
              title="Event Notifications"
              value={eventNotifications}
              onValueChange={setEventNotifications}
              showSwitch
            />
            <SettingRow
              icon="people-outline"
              title="Hangout Notifications"
              value={hangoutNotifications}
              onValueChange={setHangoutNotifications}
              showSwitch
            />
          </View>

          {/* Privacy Settings */}
          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <Text style={styles.sectionTitle}>Privacy</Text>
            <SettingRow
              icon="eye-outline"
              title="Profile Visibility"
              value={profileVisibility}
              onValueChange={setProfileVisibility}
              showSwitch
            />
            <SettingRow
              icon="location-outline"
              title="Show My Location"
              value={showLocation}
              onValueChange={setShowLocation}
              showSwitch
            />
            <SettingRow
              icon="radio-outline"
              title="Show Online Status"
              value={showOnlineStatus}
              onValueChange={setShowOnlineStatus}
              showSwitch
            />
          </View>

          {/* App Settings */}
          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <Text style={styles.sectionTitle}>App Settings</Text>
            <SettingRow
              icon="language-outline"
              title="Language"
              onPress={() => Alert.alert('Coming Soon', 'Language selection will be available soon.')}
              showChevron
            />
            <SettingRow
              icon="moon-outline"
              title="Dark Mode"
              onPress={() => Alert.alert('Coming Soon', 'Dark mode will be available soon.')}
              showChevron
            />
            <SettingRow
              icon="refresh-outline"
              title="Clear Cache"
              onPress={() => Alert.alert('Success', 'Cache cleared successfully!')}
              showChevron
            />
          </View>

          {/* About */}
          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <Text style={styles.sectionTitle}>About</Text>
            <SettingRow
              icon="information-circle-outline"
              title="About ConnectSphere"
              onPress={() => Alert.alert('ConnectSphere', 'Version 1.0.0\n\nA social networking app to connect with people around the world.')}
              showChevron
            />
            <SettingRow
              icon="document-text-outline"
              title="Terms of Service"
              onPress={() => Alert.alert('Coming Soon', 'Terms of service will be available soon.')}
              showChevron
            />
            <SettingRow
              icon="shield-outline"
              title="Privacy Policy"
              onPress={() => Alert.alert('Coming Soon', 'Privacy policy will be available soon.')}
              showChevron
            />
            <SettingRow
              icon="help-circle-outline"
              title="Help & Support"
              onPress={() => Alert.alert('Coming Soon', 'Help center will be available soon.')}
              showChevron
            />
          </View>

          {/* Danger Zone */}
          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <Text style={styles.sectionTitle}>Danger Zone</Text>
            <SettingRow
              icon="log-out-outline"
              title="Logout"
              onPress={handleLogout}
              showChevron
              danger
            />
            <SettingRow
              icon="trash-outline"
              title="Delete Account"
              onPress={handleDeleteAccount}
              showChevron
              danger
            />
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Flat Sphere v1.0.0</Text>
            <Text style={styles.footerSubtext}>&hearts; Made with 3 chị em cute đáng yêu &hearts;</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    
  },
  section: {
    
    marginTop: 8,
    paddingVertical: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    color: '#333',
    marginLeft: 16,
  },
  dangerText: {
    color: '#FF3B30',
  },
  settingRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  footerText: {
    fontSize: 14,
    color: '#999',
    marginBottom: 4,
  },
  footerSubtext: {
    fontSize: 12,
    color: '#ccc',
  },
});
