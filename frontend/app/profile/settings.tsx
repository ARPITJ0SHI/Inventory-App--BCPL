import React from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../src/constants/Colors';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/context/ThemeContext';
import * as Haptics from 'expo-haptics';

export default function SettingsScreen() {
    const router = useRouter();
    const { theme: themeMode, toggleTheme } = useTheme();
    const theme = Colors[themeMode];

    const handleThemeToggle = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        toggleTheme();
    };

    const handleClearCache = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        Alert.alert(
            'Clear Cache',
            'This will clear all cached data. You may need to reload the app.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Clear',
                    style: 'destructive',
                    onPress: () => {
                        // Clear the dataService cache
                        import('../../src/services/dataService').then(m => {
                            m.dataService.invalidateCache();
                            Alert.alert('Success', 'Cache cleared successfully');
                        });
                    }
                }
            ]
        );
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <View style={[styles.header, { borderBottomColor: theme.border }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={[styles.title, { color: theme.text }]}>Settings</Text>
            </View>

            <ScrollView style={styles.content}>
                {/* Appearance Section */}
                <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>APPEARANCE</Text>
                <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <View style={styles.settingRow}>
                        <View style={styles.settingLeft}>
                            <Ionicons
                                name={themeMode === 'dark' ? 'moon' : 'sunny'}
                                size={22}
                                color={theme.primary}
                            />
                            <Text style={[styles.settingText, { color: theme.text }]}>Dark Mode</Text>
                        </View>
                        <Switch
                            value={themeMode === 'dark'}
                            onValueChange={handleThemeToggle}
                            trackColor={{ false: theme.border, true: theme.primary }}
                            thumbColor="#fff"
                        />
                    </View>
                </View>

                {/* Data Section */}
                <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>DATA</Text>
                <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <TouchableOpacity style={styles.settingRow} onPress={handleClearCache}>
                        <View style={styles.settingLeft}>
                            <Ionicons name="trash-outline" size={22} color={theme.error} />
                            <Text style={[styles.settingText, { color: theme.text }]}>Clear Cache</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
                    </TouchableOpacity>
                </View>

                {/* About Section */}
                <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>ABOUT</Text>
                <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <View style={styles.settingRow}>
                        <View style={styles.settingLeft}>
                            <Ionicons name="information-circle-outline" size={22} color={theme.primary} />
                            <Text style={[styles.settingText, { color: theme.text }]}>Version</Text>
                        </View>
                        <Text style={[styles.versionText, { color: theme.textSecondary }]}>1.0.0</Text>
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1
    },
    backButton: { marginRight: 16 },
    title: { fontSize: 20, fontWeight: 'bold' },
    content: { flex: 1, padding: 20 },
    sectionTitle: {
        fontSize: 12,
        fontWeight: '600',
        marginBottom: 8,
        marginLeft: 4,
        letterSpacing: 0.5,
    },
    section: {
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 24,
        overflow: 'hidden',
    },
    settingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
    },
    settingLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    settingText: {
        fontSize: 16,
        marginLeft: 12,
    },
    versionText: {
        fontSize: 14,
    },
});
