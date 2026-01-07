import React, { useEffect } from 'react';
import { View, StyleSheet, StyleProp, ViewStyle, Animated, Easing } from 'react-native';
import { MotiView } from 'moti';
import { Colors } from '../constants/Colors';
import { useTheme } from '../context/ThemeContext';

interface SkeletonLoaderProps {
    width?: number | string;
    height?: number;
    borderRadius?: number;
    style?: StyleProp<ViewStyle>;
}

export const SkeletonLoader = React.memo(function SkeletonLoader({
    width = '100%',
    height = 20,
    borderRadius = 8,
    style
}: SkeletonLoaderProps) {
    const { theme: themeMode } = useTheme();
    const theme = Colors[themeMode];

    return (
        <MotiView
            from={{ opacity: 0.4 }}
            animate={{ opacity: 0.8 }}
            transition={{
                type: 'timing',
                duration: 1000,
                loop: true,
            }}
            style={[
                styles.skeleton,
                {
                    width: width as any,
                    height,
                    borderRadius,
                    backgroundColor: theme.border,
                },
                style
            ]}
        />
    );
});

interface SkeletonCardProps {
    style?: StyleProp<ViewStyle>;
}

export const SkeletonCard = React.memo(function SkeletonCard({ style }: SkeletonCardProps) {
    const { theme: themeMode } = useTheme();
    const theme = Colors[themeMode];

    return (
        <MotiView
            from={{ opacity: 0, translateY: 5 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 300 }}
            style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }, style]}
        >
            <View style={styles.cardHeader}>
                <View style={styles.iconPlaceholder}>
                    <SkeletonLoader width={28} height={28} borderRadius={14} />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                    <SkeletonLoader width={140} height={16} borderRadius={4} />
                    <SkeletonLoader width={80} height={12} borderRadius={4} style={{ marginTop: 6 }} />
                </View>
            </View>
            <SkeletonLoader width="90%" height={12} borderRadius={4} style={{ marginTop: 14 }} />
            <SkeletonLoader width="70%" height={12} borderRadius={4} style={{ marginTop: 8 }} />
        </MotiView>
    );
});

const styles = StyleSheet.create({
    skeleton: {
        overflow: 'hidden',
    },
    card: {
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconPlaceholder: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
});

