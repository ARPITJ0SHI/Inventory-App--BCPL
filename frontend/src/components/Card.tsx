import React from 'react';
import { View, StyleSheet, ViewStyle, Platform, StyleProp, TouchableOpacity } from 'react-native';
import { Colors } from '../constants/Colors';
import { MotiView } from 'moti';
import { useTheme } from '../context/ThemeContext';

interface CardProps {
    children: React.ReactNode;
    style?: StyleProp<ViewStyle>;
    delay?: number;
    onPress?: () => void;
    accentColor?: string;
}

export const Card = React.memo(function Card({ children, style, delay = 0, onPress, accentColor }: CardProps) {
    const { theme: themeMode } = useTheme();
    const theme = Colors[themeMode];

    const cardContent = (
        <MotiView
            from={{ opacity: 0, translateY: 10 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 350, delay }}
            style={[
                styles.card,
                {
                    backgroundColor: theme.surface,
                    shadowColor: themeMode === 'dark' ? '#000' : theme.text,
                    borderColor: accentColor || theme.border,
                    borderLeftWidth: accentColor ? 4 : 0,
                },
                style
            ]}
        >
            {children}
        </MotiView>
    );

    if (onPress) {
        return (
            <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
                {cardContent}
            </TouchableOpacity>
        );
    }

    return cardContent;
});

const styles = StyleSheet.create({
    card: {
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        // Enhanced shadow for iOS
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        // Shadow for Android
        elevation: 3,
        borderWidth: 1,
    },
});

