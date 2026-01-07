import React, { createContext, useContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { useRouter, useSegments } from 'expo-router';

type AuthContextType = {
    token: string | null;
    role: string | null;
    isLoading: boolean;
    login: (token: string, role: string, persist?: boolean) => Promise<void>;
    logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
    token: null,
    role: null,
    isLoading: true,
    login: async () => { },
    logout: async () => { },
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [token, setToken] = useState<string | null>(null);
    const [role, setRole] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();
    const segments = useSegments();

    useEffect(() => {
        const loadAuthData = async () => {
            try {
                const storedToken = await SecureStore.getItemAsync('token');
                const storedRole = await SecureStore.getItemAsync('role');
                if (storedToken) {
                    setToken(storedToken);
                    if (storedRole) setRole(storedRole);
                }
            } catch (e) {
                console.error('Failed to load auth data', e);
            } finally {
                setIsLoading(false);
            }
        };
        loadAuthData();
    }, []);

    useEffect(() => {
        if (isLoading) return;

        // Wait for router to be ready (segments populated)
        if (!segments || !segments[0]) return;

        const inAuthGroup = segments[0] === '(auth)';

        console.log('Auth Check:', { token: !!token, role, segments, inAuthGroup });

        // If we have a token and are in the auth group (login/register), go to tabs
        if (token && inAuthGroup) {
            router.replace('/(tabs)');
        }
        // If we have NO token and are NOT in auth group, go to login
        else if (!token && !inAuthGroup) {
            router.replace('/(auth)/login');
        }
    }, [token, segments, isLoading]);

    const login = async (newToken: string, newRole: string, persist: boolean = true) => {
        if (persist) {
            await SecureStore.setItemAsync('token', newToken);
            await SecureStore.setItemAsync('role', newRole);
        }
        setToken(newToken);
        setRole(newRole);

        // Register for push notifications after login
        try {
            const { registerForPushNotificationsAsync, savePushTokenToServer } = await import('../services/notificationService');
            const pushToken = await registerForPushNotificationsAsync();
            if (pushToken) {
                await savePushTokenToServer(pushToken);
            }
        } catch (error) {
            console.log('Push notification registration skipped:', error);
        }
    };

    const logout = async () => {
        await SecureStore.deleteItemAsync('token');
        await SecureStore.deleteItemAsync('role');
        setToken(null);
        setRole(null);
    };

    return (
        <AuthContext.Provider value={{ token, role, isLoading, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};
