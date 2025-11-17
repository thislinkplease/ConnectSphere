import { Tabs } from 'expo-router';
import React from 'react';
import { Text, StyleSheet, View } from 'react-native';
import { HapticTab } from '@/components/haptic-tab';
import { Home, UserRound, Compass, MessageCircleMore, Users } from 'lucide-react-native';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { WebSocketStatus } from '@/components/WebSocketStatus';

export default function TabLayout() {
    const colorScheme = useColorScheme();

    return (
        <>
            <WebSocketStatus />
            <Tabs
                screenOptions={{
                    tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
                    headerShown: false,
                    tabBarButton: HapticTab,
                    tabBarStyle: {
                        height: 105,
                        paddingTop: 20,
                    },
                }}
            >
            <Tabs.Screen
                name="discussion"
                options={{
                    tabBarLabel: ({ focused, color }) => (
                        <View style={styles.labelContainer}>
                            <Text style={[styles.tabLabel, { color: focused ? color : '#999' }]}>
                                {focused ? '' : 'Discussion'}
                            </Text>
                        </View>
                    ),
                    tabBarIcon: ({ color, focused }) => (
                        <Home size={focused ? 35 : 24} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="connection"
                options={{
                    tabBarLabel: ({ focused, color }) => (
                        <View style={styles.labelContainer}>
                            <Text style={[styles.tabLabel, { color: focused ? color : '#999' }]}>
                                {focused ? '' : 'Connection'}
                            </Text>
                        </View>
                    ),
                    tabBarIcon: ({ color, focused }) => (
                        <Users size={focused ? 35 : 24} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="hangout"
                options={{
                    tabBarLabel: ({ focused, color }) => (
                        <View style={styles.labelContainer}>
                            <Text style={[styles.tabLabel, { color: focused ? color : '#999' }]}>
                                {focused ? '' : 'Hangout'}
                            </Text>
                        </View>
                    ),
                    tabBarIcon: ({ color, focused }) => (
                        <Compass size={focused ? 40 : 24} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="inbox"
                options={{
                    tabBarLabel: ({ focused, color }) => (
                        <View style={styles.labelContainer}>
                            <Text style={[styles.tabLabel, { color: focused ? color : '#999' }]}>
                                {focused ? '' : 'Inbox'}
                            </Text>
                        </View>
                    ),
                    tabBarIcon: ({ color, focused }) => (
                        <MessageCircleMore size={focused ? 35 : 24} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="account"
                options={{
                    tabBarLabel: ({ focused, color }) => (
                        <View style={styles.labelContainer}>
                            <Text style={[styles.tabLabel, { color: focused ? color : '#999' }]}>
                                {focused ? '' : 'Account'}
                            </Text>
                        </View>
                    ),
                    tabBarIcon: ({ color, focused }) => (
                        <UserRound size={focused ? 35 : 24} color={color} />
                    ),
                }}
            />
        </Tabs>
        </>
    );
}

const styles = StyleSheet.create({
    tabLabel: {
        fontSize: 10
    },
    labelContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        height: 30,
    },
});