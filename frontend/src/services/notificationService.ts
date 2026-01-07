import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';

const READ_ANNOUNCEMENTS_KEY = '@read_announcements';

// Configure how notifications appear when app is in foreground
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

// Register for push notifications
export async function registerForPushNotificationsAsync(): Promise<string | null> {
    if (!Device.isDevice) {
        console.log('Push notifications require a physical device');
        return null;
    }

    try {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }

        if (finalStatus !== 'granted') {
            console.log('Push notification permission not granted');
            return null;
        }

        // Get Expo push token
        const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

        if (!projectId) {
            console.log('No projectId found - EAS build required for push notifications');
            return null;
        }

        const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
        const token = tokenData.data;

        // Android-specific channel setup
        if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('default', {
                name: 'default',
                importance: Notifications.AndroidImportance.MAX,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#6366f1',
            });
        }

        return token;
    } catch (error) {
        console.log('Error registering for push notifications:', error);
        return null;
    }
}

// Save push token to server
export async function savePushTokenToServer(token: string): Promise<void> {
    try {
        await api.post('/auth/push-token', { pushToken: token });
    } catch (error) {
        console.error('Failed to save push token:', error);
    }
}

// Read announcement tracking
export async function getReadAnnouncementIds(): Promise<string[]> {
    try {
        const data = await AsyncStorage.getItem(READ_ANNOUNCEMENTS_KEY);
        return data ? JSON.parse(data) : [];
    } catch {
        return [];
    }
}

export async function markAnnouncementsAsRead(ids: string[]): Promise<void> {
    try {
        const existing = await getReadAnnouncementIds();
        const updated = [...new Set([...existing, ...ids])];
        await AsyncStorage.setItem(READ_ANNOUNCEMENTS_KEY, JSON.stringify(updated));
    } catch (error) {
        console.error('Failed to save read announcements:', error);
    }
}

export async function getUnreadAnnouncements<T extends { _id: string }>(announcements: T[]): Promise<T[]> {
    const readIds = await getReadAnnouncementIds();
    return announcements.filter(a => !readIds.includes(a._id));
}
