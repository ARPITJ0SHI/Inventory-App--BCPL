import React from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { Colors } from '../../src/constants/Colors';
import { Button } from '../../src/components/Button';
import { useAuth } from '../../src/context/AuthContext';
import { useUpdates } from '../../src/context/UpdateContext';
import { useTheme } from '../../src/context/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useRBAC, Role } from '../../src/hooks/useRBAC';

export default function ProfileScreen() {
    const { logout, login, token } = useAuth();
    const { checkForUpdate, isChecking } = useUpdates();
    const { role, canManageUsers, canViewUsers } = useRBAC();
    const router = useRouter();
    const { theme: themeMode } = useTheme();
    const theme = Colors[themeMode];

    const getRoleDisplay = (r: string | null) => {
        switch (r) {
            case Role.SUPER_ADMIN: return 'Super Admin';
            case Role.KHUSHAL: return 'Khushal (Manager)';
            case Role.FACTORY_MANAGER: return 'Factory Manager';
            case Role.SHOP_MANAGER: return 'Shop Manager';
            default: return r || 'Unknown';
        }
    };

    const handleLogout = async () => {
        Alert.alert(
            "Logout",
            "Are you sure you want to logout?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Logout",
                    style: "destructive",
                    onPress: async () => {
                        await logout();
                    }
                }
            ]
        );
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
            <View style={styles.header}>
                <Text style={[styles.title, { color: theme.text }]}>Profile</Text>
            </View>

            <View style={styles.content}>
                <View style={[styles.profileCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
                        <Ionicons name="person" size={40} color="#fff" />
                    </View>
                    <Text style={[styles.username, { color: theme.text }]}>
                        {role === Role.SUPER_ADMIN ? 'Super Admin' : 'User'}
                    </Text>
                    <View style={[styles.roleBadge, { backgroundColor: theme.primary + '20' }]}>
                        <Text style={[styles.roleText, { color: theme.primary }]}>{getRoleDisplay(role)}</Text>
                    </View>
                </View>

                <View style={styles.section}>
                    <TouchableOpacity
                        style={[styles.menuItem, { borderBottomColor: theme.border }]}
                        onPress={() => router.push('/profile/settings')}
                    >
                        <Ionicons name="settings-outline" size={24} color={theme.text} />
                        <Text style={[styles.menuText, { color: theme.text }]}>Settings</Text>
                        <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.menuItem, { borderBottomColor: theme.border }]}
                        onPress={() => checkForUpdate(true)}
                        disabled={isChecking}
                    >
                        <Ionicons name="cloud-download-outline" size={24} color={theme.text} />
                        <Text style={[styles.menuText, { color: theme.text }]}>
                            {isChecking ? 'Checking for updates...' : 'Check for Updates'}
                        </Text>
                        <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
                    </TouchableOpacity>

                    {canViewUsers() && (
                        <TouchableOpacity
                            style={[styles.menuItem, { borderBottomColor: theme.border }]}
                            onPress={() => router.push('/profile/users')}
                        >
                            <Ionicons name="people-outline" size={24} color={theme.text} />
                            <Text style={[styles.menuText, { color: theme.text }]}>
                                User Management {!canManageUsers() && '(View Only)'}
                            </Text>
                            <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
                        </TouchableOpacity>
                    )}



                    {/* Dev Role Switcher - Available for ALL roles in dev mode */}
                    {__DEV__ && (
                        <TouchableOpacity
                            style={[styles.menuItem, { borderBottomColor: theme.border, backgroundColor: theme.primary + '10' }]}
                            onPress={() => {
                                const roles = [Role.SUPER_ADMIN, Role.KHUSHAL, Role.FACTORY_MANAGER, Role.SHOP_MANAGER];
                                const currentIdx = roles.indexOf(role as Role);
                                const nextRole = roles[(currentIdx + 1) % roles.length];
                                if (token) {
                                    login(token, nextRole);
                                    Alert.alert("Role Switched", `Now testing as: ${getRoleDisplay(nextRole)}`);
                                }
                            }}
                        >
                            <Ionicons name="swap-horizontal-outline" size={24} color={theme.primary} />
                            <Text style={[styles.menuText, { color: theme.text }]}>
                                Switch Role → {getRoleDisplay(role)}
                            </Text>
                            <Ionicons name="refresh" size={20} color={theme.primary} />
                        </TouchableOpacity>
                    )}
                </View>

                <Button
                    title="Logout"
                    onPress={handleLogout}
                    variant="outline"
                    style={{ marginTop: 'auto', borderColor: theme.error }}
                />
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { padding: 20, paddingBottom: 10 },
    title: { fontSize: 28, fontWeight: 'bold' },
    content: { flex: 1, padding: 24 },
    profileCard: {
        alignItems: 'center',
        padding: 24,
        borderRadius: 20,
        borderWidth: 1,
        marginBottom: 32,
    },
    avatar: {
        width: 80,
        height: 80,
        borderRadius: 40,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    username: { fontSize: 20, fontWeight: 'bold', marginBottom: 8 },
    roleBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
    },
    roleText: { fontSize: 14, fontWeight: '600' },
    section: { marginBottom: 24 },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        borderBottomWidth: 1,
    },
    menuText: { flex: 1, fontSize: 16, marginLeft: 16 }
});
