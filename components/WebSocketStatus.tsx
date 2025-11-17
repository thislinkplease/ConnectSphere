import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import WebSocketService from '@/src/services/websocket';

/**
 * WebSocket connection status indicator
 * Shows a small indicator at the top of the screen when WebSocket is disconnected
 */
export const WebSocketStatus: React.FC = () => {
  const [isConnected, setIsConnected] = useState(true);
  const [fadeAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    const handleConnectionChange = (connected: boolean) => {
      setIsConnected(connected);
      
      // Animate in/out based on connection status
      Animated.timing(fadeAnim, {
        toValue: connected ? 0 : 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    };

    // Subscribe to connection status changes
    WebSocketService.onConnectionStatusChange(handleConnectionChange);

    return () => {
      WebSocketService.offConnectionStatusChange(handleConnectionChange);
    };
  }, [fadeAnim]);

  // Don't render anything if connected
  if (isConnected) {
    return null;
  }

  return (
    <Animated.View 
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [
            {
              translateY: fadeAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [-50, 0],
              }),
            },
          ],
        },
      ]}
    >
      <View style={styles.dot} />
      <Text style={styles.text}>Reconnecting...</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FF6B6B',
    paddingVertical: 8,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    elevation: 10,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
    marginRight: 8,
  },
  text: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
});

export default WebSocketStatus;
