import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import * as Updates from 'expo-updates';
import * as Notifications from 'expo-notifications';
import { Alert, AppState } from 'react-native';

interface UpdateContextType {
    isUpdateAvailable: boolean;
    isChecking: boolean;
    isDownloading: boolean;
    lastChecked: Date | null;
    checkForUpdate: (isManual?: boolean) => Promise<void>;
    reloadApp: () => Promise<void>;
}

const UpdateContext = createContext<UpdateContextType>({
    isUpdateAvailable: false,
    isChecking: false,
    isDownloading: false,
    lastChecked: null,
    checkForUpdate: async () => { },
    reloadApp: async () => { },
});

export const useUpdates = () => useContext(UpdateContext);

// Send local notification when update is available
const sendUpdateNotification = async () => {
    try {
        await Notifications.scheduleNotificationAsync({
            content: {
                title: '🚀 Update Available!',
                body: 'A new version of the app is ready. Tap to update now!',
                data: { type: 'app_update' },
            },
            trigger: null, // Show immediately
        });
    } catch (error) {
        console.error('Failed to send update notification:', error);
    }
};

export const UpdateProvider = ({ children }: { children: React.ReactNode }) => {
    const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);
    const [isChecking, setIsChecking] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [lastChecked, setLastChecked] = useState<Date | null>(null);

    const downloadUpdate = useCallback(async () => {
        try {
            setIsDownloading(true);
            await Updates.fetchUpdateAsync();
            Alert.alert(
                'Update Ready',
                'The update has been downloaded. The app will restart to apply changes.',
                [{ text: 'Restart', onPress: async () => await Updates.reloadAsync() }]
            );
        } catch (error) {
            console.error('Error downloading update:', error);
            Alert.alert('Error', 'Failed to download update.');
        } finally {
            setIsDownloading(false);
        }
    }, []);

    const checkForUpdate = useCallback(async (isManual = false) => {
        if (__DEV__) {
            if (isManual) Alert.alert('Dev Mode', 'OTA updates are not available in development mode.');
            return;
        }

        try {
            setIsChecking(true);
            const update = await Updates.checkForUpdateAsync();

            if (update.isAvailable) {
                setIsUpdateAvailable(true);

                if (isManual) {
                    Alert.alert(
                        'Update Available',
                        'A new version of the app is available. Would you like to download and install it now?',
                        [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Update', onPress: () => downloadUpdate() }
                        ]
                    );
                } else {
                    // Send push notification for background updates
                    await sendUpdateNotification();
                    // Auto-download in background
                    downloadUpdate();
                }
            } else {
                if (isManual) Alert.alert('No Updates', 'You are already on the latest version.');
            }
            setLastChecked(new Date());
        } catch (error) {
            console.error('Error checking for updates:', error);
            if (isManual) Alert.alert('Error', 'Failed to check for updates.');
        } finally {
            setIsChecking(false);
        }
    }, [downloadUpdate]);

    const reloadApp = async () => {
        try {
            await Updates.reloadAsync();
        } catch (error) {
            console.error('Error reloading app:', error);
        }
    };

    // Check on mount (and app foreground)
    useEffect(() => {
        checkForUpdate();

        const subscription = AppState.addEventListener('change', (nextAppState) => {
            if (nextAppState === 'active') {
                checkForUpdate();
            }
        });

        return () => {
            subscription.remove();
        };
    }, [checkForUpdate]);

    return (
        <UpdateContext.Provider
            value={{
                isUpdateAvailable,
                isChecking,
                isDownloading,
                lastChecked,
                checkForUpdate,
                reloadApp
            }}
        >
            {children}
        </UpdateContext.Provider>
    );
};
