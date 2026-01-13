import React, { useEffect, useRef } from 'react';
import { StyleSheet, ViewStyle, StyleProp, TouchableOpacity, Animated } from 'react-native';
import { Colors } from '../constants/Colors';
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
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const translateYAnim = useRef(new Animated.Value(10)).current;

    useEffect(() => {
        const timeout = setTimeout(() => {
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 350,
                    useNativeDriver: true,
                }),
                Animated.timing(translateYAnim, {
                    toValue: 0,
                    duration: 350,
                    useNativeDriver: true,
                }),
            ]).start();
        }, delay);
        return () => clearTimeout(timeout);
    }, [delay]);

    const cardContent = (
        <Animated.View
            style={[
                styles.card,
                {
                    backgroundColor: theme.surface,
                    shadowColor: themeMode === 'dark' ? '#000' : theme.text,
                    borderColor: accentColor || theme.border,
                    borderLeftWidth: accentColor ? 4 : 0,
                    opacity: fadeAnim,
                    transform: [{ translateY: translateYAnim }],
                },
                style
            ]}
        >
            {children}
        </Animated.View>
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
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 3,
        borderWidth: 1,
    },
});
