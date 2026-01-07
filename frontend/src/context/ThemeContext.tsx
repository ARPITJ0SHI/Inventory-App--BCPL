import React, { createContext, useContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';

type ThemeMode = 'light' | 'dark';

type ThemeContextType = {
    theme: ThemeMode;
    toggleTheme: () => void;
    setTheme: (theme: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextType>({
    theme: 'light',
    toggleTheme: () => { },
    setTheme: () => { },
});

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
    const [theme, setThemeState] = useState<ThemeMode>('light');

    useEffect(() => {
        const loadTheme = async () => {
            try {
                const storedTheme = await SecureStore.getItemAsync('theme');
                if (storedTheme === 'dark' || storedTheme === 'light') {
                    setThemeState(storedTheme);
                }
            } catch (e) {
                console.error('Failed to load theme', e);
            }
        };
        loadTheme();
    }, []);

    const toggleTheme = async () => {
        const newTheme = theme === 'light' ? 'dark' : 'light';
        setThemeState(newTheme);
        await SecureStore.setItemAsync('theme', newTheme);
    };

    const setTheme = async (newTheme: ThemeMode) => {
        setThemeState(newTheme);
        await SecureStore.setItemAsync('theme', newTheme);
    };

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};
