import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/Colors';
import { Platform, View, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '../../src/context/ThemeContext';
import { useRBAC, Role } from '../../src/hooks/useRBAC';
import * as ScreenCapture from 'expo-screen-capture';
import { useEffect } from 'react';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useGlobalPolling } from '../../src/hooks/useGlobalPolling';

export default function TabLayout() {
  const { theme: themeMode } = useTheme();
  const theme = Colors[themeMode];
  const { role, canViewPriceList } = useRBAC();
  const insets = useSafeAreaInsets();

  // Activate Global Polling (Every 2 minutes)
  useGlobalPolling(120000);

  useEffect(() => {
    // Prevent screen capture/recording for ALL users
    ScreenCapture.preventScreenCaptureAsync();
  }, []);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarStyle: {
          position: 'absolute',
          bottom: 16 + insets.bottom,
          left: 16,
          right: 16,
          height: 65,
          borderRadius: 20,
          backgroundColor: theme.surface,
          borderTopWidth: 0,
          elevation: 10,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.15,
          shadowRadius: 12,
          paddingBottom: 0, // Reset padding
          paddingHorizontal: 0, // Reset horizontal padding
          alignItems: 'center', // Center items vertically container
          justifyContent: 'center', // Center items horizontally container
        },
        tabBarBackground: () => (
          Platform.OS === 'ios' ? (
            <BlurView
              intensity={90}
              style={{
                flex: 1,
                borderRadius: 20,
                overflow: 'hidden',
                backgroundColor: `${theme.surface}E6`
              }}
            />
          ) : null
        ),
        tabBarShowLabel: false,
        tabBarItemStyle: {
          height: 65, // Explicit height
          justifyContent: 'center', // Center content
          alignItems: 'center', // Center content
          paddingTop: 10, // Slight optical adjustment if needed, or removing it for center
          paddingBottom: 10, // Slight optical adjustment
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconContainer, focused && { backgroundColor: theme.primary + '20' }]}>
              <Ionicons name={focused ? 'home' : 'home-outline'} size={22} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="pricelist"
        options={{
          title: 'Prices',
          href: canViewPriceList() ? undefined : null,
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconContainer, focused && { backgroundColor: theme.primary + '20' }]}>
              <Ionicons name={focused ? 'pricetag' : 'pricetag-outline'} size={22} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="stock"
        options={{
          title: 'Stock',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconContainer, focused && { backgroundColor: theme.primary + '20' }]}>
              <Ionicons name={focused ? 'cube' : 'cube-outline'} size={22} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Orders',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconContainer, focused && { backgroundColor: theme.primary + '20' }]}>
              <Ionicons name={focused ? 'cart' : 'cart-outline'} size={22} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconContainer, focused && { backgroundColor: theme.primary + '20' }]}>
              <Ionicons name={focused ? 'person' : 'person-outline'} size={22} color={color} />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

