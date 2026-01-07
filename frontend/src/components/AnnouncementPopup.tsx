import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Dimensions, Alert } from 'react-native';
import { Colors } from '../constants/Colors';
import { useTheme } from '../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import * as SecureStore from 'expo-secure-store';
import * as Haptics from 'expo-haptics';
import { Announcement, dataService } from '../services/dataService';
import { useRBAC } from '../hooks/useRBAC';

interface AnnouncementPopupProps {
    announcements: Announcement[];
    onDismiss: () => void;
}

const SEEN_ANNOUNCEMENTS_KEY = 'seen_announcements';

export const AnnouncementPopup = React.memo(function AnnouncementPopup({
    announcements,
    onDismiss
}: AnnouncementPopupProps) {
    const { theme: themeMode } = useTheme();
    const theme = Colors[themeMode];
    const { role } = useRBAC();
    const [unseenAnnouncements, setUnseenAnnouncements] = useState<Announcement[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const checkUnseen = async () => {
            try {
                const seenJson = await SecureStore.getItemAsync(SEEN_ANNOUNCEMENTS_KEY);
                const seenIds: string[] = seenJson ? JSON.parse(seenJson) : [];

                // Filter out announcements that have been seen
                const unseen = announcements.filter(a => !seenIds.includes(a._id));

                if (unseen.length > 0) {
                    setUnseenAnnouncements(unseen);
                    setVisible(true);
                }
            } catch (e) {
                console.error('Failed to check seen announcements', e);
            }
        };

        if (announcements.length > 0) {
            checkUnseen();
        }
    }, [announcements]);

    const markAsSeen = useCallback(async (id: string) => {
        try {
            const seenJson = await SecureStore.getItemAsync(SEEN_ANNOUNCEMENTS_KEY);
            const seenIds: string[] = seenJson ? JSON.parse(seenJson) : [];

            if (!seenIds.includes(id)) {
                seenIds.push(id);
                // Keep only last 50 seen IDs to prevent storage bloat
                const trimmed = seenIds.slice(-50);
                await SecureStore.setItemAsync(SEEN_ANNOUNCEMENTS_KEY, JSON.stringify(trimmed));
            }
        } catch (e) {
            console.error('Failed to mark announcement as seen', e);
        }
    }, []);

    const handleNext = useCallback(async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        // Mark current as seen
        if (unseenAnnouncements[currentIndex]) {
            await markAsSeen(unseenAnnouncements[currentIndex]._id);
        }

        if (currentIndex < unseenAnnouncements.length - 1) {
            setCurrentIndex(prev => prev + 1);
        } else {
            // All seen, close
            setVisible(false);
            onDismiss();
        }
    }, [currentIndex, unseenAnnouncements, markAsSeen, onDismiss]);

    const handleDismissAll = useCallback(async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        // Mark all as seen
        for (const announcement of unseenAnnouncements) {
            await markAsSeen(announcement._id);
        }

        setVisible(false);
        onDismiss();
    }, [unseenAnnouncements, markAsSeen, onDismiss]);

    if (!visible || unseenAnnouncements.length === 0) return null;

    const current = unseenAnnouncements[currentIndex];
    const remaining = unseenAnnouncements.length - currentIndex;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={handleDismissAll}
        >
            <View style={styles.overlay}>
                <MotiView
                    from={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: 'timing', duration: 300 }}
                    style={[styles.popup, { backgroundColor: theme.surface }]}
                >
                    {/* Header */}
                    <View style={styles.header}>
                        <View style={[styles.iconBadge, { backgroundColor: theme.primary + '20' }]}>
                            <Ionicons name="megaphone" size={24} color={theme.primary} />
                        </View>
                        <Text style={[styles.headerTitle, { color: theme.text }]}>Announcement</Text>
                        {remaining > 1 && (
                            <View style={[styles.countBadge, { backgroundColor: theme.error }]}>
                                <Text style={styles.countText}>{remaining}</Text>
                            </View>
                        )}
                    </View>

                    {/* Content */}
                    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                        <Text style={[styles.title, { color: theme.text }]}>{current.title}</Text>
                        <Text style={[styles.message, { color: theme.textSecondary }]}>{current.message}</Text>
                        <Text style={[styles.date, { color: theme.textSecondary }]}>
                            {new Date(current.createdAt).toLocaleDateString('en-IN', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric'
                            })}
                        </Text>
                    </ScrollView>

                    <View style={styles.actions}>
                        {role === 'super_admin' && (
                            <TouchableOpacity
                                style={[styles.dismissBtn, { borderColor: theme.error, marginRight: 8 }]}
                                onPress={() => {
                                    Alert.alert('Delete Announcement', 'Are you sure?', [
                                        { text: 'Cancel', style: 'cancel' },
                                        {
                                            text: 'Delete', style: 'destructive', onPress: async () => {
                                                try {
                                                    await dataService.deleteAnnouncement(current._id);
                                                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                                                    // Move to next or close
                                                    if (currentIndex < unseenAnnouncements.length - 1) {
                                                        // Remove from list locally for smooth UX
                                                        setUnseenAnnouncements(prev => prev.filter(a => a._id !== current._id));
                                                        // Index stays same as next item shifts into place
                                                    } else {
                                                        setVisible(false);
                                                        onDismiss();
                                                    }
                                                } catch (e) {
                                                    Alert.alert("Error", "Failed to delete");
                                                }
                                            }
                                        }
                                    ]);
                                }}
                            >
                                <Ionicons name="trash-outline" size={20} color={theme.error} />
                            </TouchableOpacity>
                        )}
                        {remaining > 1 && (
                            <TouchableOpacity
                                style={[styles.dismissBtn, { borderColor: theme.border }]}
                                onPress={handleDismissAll}
                            >
                                <Text style={{ color: theme.textSecondary }}>Dismiss All</Text>
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity
                            style={[styles.nextBtn, { backgroundColor: theme.primary }]}
                            onPress={handleNext}
                        >
                            <Text style={styles.nextText}>
                                {remaining > 1 ? 'Next' : 'Got it'}
                            </Text>
                            {remaining > 1 && <Ionicons name="arrow-forward" size={16} color="#fff" />}
                        </TouchableOpacity>
                    </View>
                </MotiView>
            </View>
        </Modal>
    );
});

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    popup: {
        width: width - 48,
        maxHeight: '70%',
        borderRadius: 20,
        padding: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    iconBadge: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        marginLeft: 12,
        flex: 1,
    },
    countBadge: {
        width: 28,
        height: 28,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    countText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: 'bold',
    },
    content: {
        maxHeight: 200,
        marginBottom: 16,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        marginBottom: 8,
    },
    message: {
        fontSize: 15,
        lineHeight: 22,
        marginBottom: 12,
    },
    date: {
        fontSize: 12,
    },
    actions: {
        flexDirection: 'row',
        gap: 12,
    },
    dismissBtn: {
        flex: 1,
        padding: 14,
        borderRadius: 12,
        alignItems: 'center',
        borderWidth: 1,
    },
    nextBtn: {
        flex: 1,
        padding: 14,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    nextText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 15,
    },
});
