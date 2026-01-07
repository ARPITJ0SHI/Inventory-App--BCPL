import React, { useCallback } from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle, Pressable, Animated } from 'react-native';
import { Colors } from '../constants/Colors';
import { MotiView } from 'moti';
import * as Haptics from 'expo-haptics';

interface ButtonProps {
    title: string;
    onPress: () => void;
    isLoading?: boolean;
    variant?: 'primary' | 'secondary' | 'outline';
    style?: ViewStyle;
    hapticFeedback?: boolean;
}

export const Button = React.memo(function Button({
    title,
    onPress,
    isLoading,
    variant = 'primary',
    style,
    hapticFeedback = true
}: ButtonProps) {
    const colorScheme = 'light';
    const theme = Colors[colorScheme];
    const scaleAnim = React.useRef(new Animated.Value(1)).current;

    const getBackgroundColor = useCallback(() => {
        switch (variant) {
            case 'primary': return theme.primary;
            case 'secondary': return theme.surface;
            case 'outline': return 'transparent';
            default: return theme.primary;
        }
    }, [variant, theme]);

    const getTextColor = useCallback(() => {
        switch (variant) {
            case 'primary': return '#fff';
            case 'secondary': return theme.text;
            case 'outline': return theme.primary;
            default: return '#fff';
        }
    }, [variant, theme]);

    const getBorderColor = useCallback(() => {
        if (variant === 'outline') return theme.primary;
        if (variant === 'secondary') return theme.border;
        return 'transparent';
    }, [variant, theme]);

    const handlePressIn = useCallback(() => {
        Animated.spring(scaleAnim, {
            toValue: 0.96,
            useNativeDriver: true,
        }).start();
    }, [scaleAnim]);

    const handlePressOut = useCallback(() => {
        Animated.spring(scaleAnim, {
            toValue: 1,
            friction: 3,
            tension: 40,
            useNativeDriver: true,
        }).start();
    }, [scaleAnim]);

    const handlePress = useCallback(() => {
        if (hapticFeedback) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        onPress();
    }, [hapticFeedback, onPress]);

    return (
        <MotiView
            from={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'timing', duration: 150 }}
        >
            <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
                <TouchableOpacity
                    style={[
                        styles.container,
                        {
                            backgroundColor: getBackgroundColor(),
                            borderColor: getBorderColor(),
                            borderWidth: variant === 'outline' || variant === 'secondary' ? 1 : 0
                        },
                        style
                    ]}
                    onPress={handlePress}
                    onPressIn={handlePressIn}
                    onPressOut={handlePressOut}
                    disabled={isLoading}
                    activeOpacity={0.9}
                >
                    {isLoading ? (
                        <ActivityIndicator color={getTextColor()} />
                    ) : (
                        <Text style={[styles.text, { color: getTextColor() }]}>{title}</Text>
                    )}
                </TouchableOpacity>
            </Animated.View>
        </MotiView>
    );
});

const styles = StyleSheet.create({
    container: {
        height: 50,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 16,
        width: '100%',
    },
    text: {
        fontSize: 16,
        fontWeight: '600',
    },
});
