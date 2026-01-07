import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, Modal, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../src/constants/Colors';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/context/ThemeContext';
import { useRBAC, Role } from '../../src/hooks/useRBAC';
import { Card } from '../../src/components/Card';
import { SkeletonCard } from '../../src/components/SkeletonLoader';
import { Button } from '../../src/components/Button';
import { Input } from '../../src/components/Input';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import * as Haptics from 'expo-haptics';
import api from '../../src/services/api';

interface User {
    _id: string;
    username: string;
    role: string;
    createdAt?: string;
}

const userSchema = z.object({
    username: z.string().min(3, "Username must be at least 3 characters"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    role: z.enum(['khushal', 'factory_manager', 'shop_manager']),
});

type UserFormValues = z.infer<typeof userSchema>;

export default function UserManagementScreen() {
    const router = useRouter();
    const { theme: themeMode } = useTheme();
    const theme = Colors[themeMode];
    const { canManageUsers, canViewUsers, role: currentRole } = useRBAC();
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [isInitialLoad, setIsInitialLoad] = useState(true);
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedRole, setSelectedRole] = useState<string>('khushal');

    const { control, handleSubmit, reset, setValue, formState: { errors } } = useForm<UserFormValues>({
        resolver: zodResolver(userSchema),
        defaultValues: { username: '', password: '', role: 'khushal' }
    });

    // Redirect if no access
    useEffect(() => {
        if (!canViewUsers()) {
            router.back();
        }
    }, [canViewUsers, router]);

    const fetchUsers = useCallback(async () => {
        try {
            setLoading(true);
            const response = await api.get('/auth/users');
            // Filter out super_admin from the list
            const filtered = (response.data || []).filter((u: User) => u.role !== 'super_admin');
            setUsers(filtered);
        } catch (error: any) {
            console.error('Failed to fetch users:', error);
            // Demo data if endpoint doesn't exist
            if (error.response?.status === 404 || error.response?.status === 401) {
                setUsers([
                    { _id: '1', username: 'khushal_user', role: 'khushal' },
                    { _id: '2', username: 'factory_john', role: 'factory_manager' },
                    { _id: '3', username: 'shop_jane', role: 'shop_manager' },
                ]);
            }
        } finally {
            setLoading(false);
            setIsInitialLoad(false);
        }
    }, []);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    const getRoleDisplay = (r: string) => {
        switch (r) {
            case 'khushal': return 'Khushal (Manager)';
            case 'factory_manager': return 'Factory Manager';
            case 'shop_manager': return 'Shop Manager';
            default: return r;
        }
    };

    const getRoleColor = (r: string) => {
        switch (r) {
            case 'khushal': return '#8b5cf6';
            case 'factory_manager': return theme.primary;
            case 'shop_manager': return theme.success;
            default: return theme.textSecondary;
        }
    };

    const handleAddUser = useCallback(() => {
        if (!canManageUsers()) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        reset({ username: '', password: '', role: 'khushal' });
        setSelectedRole('khushal');
        setModalVisible(true);
    }, [reset, canManageUsers]);

    const handleDeleteUser = useCallback((user: User) => {
        if (!canManageUsers()) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        Alert.alert(
            'Delete User',
            `Are you sure you want to delete ${user.username}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await api.delete(`/auth/users/${user._id}`);
                            fetchUsers();
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        } catch (e) {
                            // Demo mode
                            setUsers(prev => prev.filter(u => u._id !== user._id));
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        }
                    }
                }
            ]
        );
    }, [fetchUsers, canManageUsers]);

    const onSubmit = useCallback(async (data: UserFormValues) => {
        try {
            await api.post('/auth/create-user', {
                username: data.username,
                password: data.password,
                role: data.role
            });
            setModalVisible(false);
            fetchUsers();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert("Success", "User created successfully");
        } catch (e: any) {
            // Demo mode
            const newUser: User = {
                _id: Date.now().toString(),
                username: data.username,
                role: data.role
            };
            setUsers(prev => [...prev, newUser]);
            setModalVisible(false);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert("Success", "User created (demo)");
        }
    }, [fetchUsers]);

    const handleRefresh = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        fetchUsers();
    }, [fetchUsers]);

    const renderItem = useCallback(({ item, index }: { item: User, index: number }) => (
        <Card delay={index * 50} style={styles.card}>
            <View style={styles.userRow}>
                <View style={[styles.avatar, { backgroundColor: getRoleColor(item.role) }]}>
                    <Text style={styles.avatarText}>{item.username.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={styles.userInfo}>
                    <Text style={[styles.username, { color: theme.text }]}>{item.username}</Text>
                    <View style={[styles.roleBadge, { backgroundColor: getRoleColor(item.role) + '20' }]}>
                        <Text style={[styles.roleText, { color: getRoleColor(item.role) }]}>
                            {getRoleDisplay(item.role)}
                        </Text>
                    </View>
                </View>
                {canManageUsers() && (
                    <TouchableOpacity onPress={() => handleDeleteUser(item)} style={styles.deleteBtn}>
                        <Ionicons name="trash-outline" size={20} color={theme.error} />
                    </TouchableOpacity>
                )}
            </View>
        </Card>
    ), [theme, canManageUsers, handleDeleteUser]);

    const keyExtractor = useCallback((item: User) => item._id, []);

    const roles: Array<{ value: 'khushal' | 'factory_manager' | 'shop_manager', label: string }> = [
        { value: 'khushal', label: 'Khushal (Manager)' },
        { value: 'factory_manager', label: 'Factory Manager' },
        { value: 'shop_manager', label: 'Shop Manager' },
    ];

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <View style={[styles.header, { borderBottomColor: theme.border }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={[styles.title, { color: theme.text }]}>User Management</Text>
                {!canManageUsers() && (
                    <View style={[styles.readOnlyBadge, { backgroundColor: theme.textSecondary + '20' }]}>
                        <Text style={{ color: theme.textSecondary, fontSize: 10 }}>VIEW ONLY</Text>
                    </View>
                )}
            </View>

            {isInitialLoad ? (
                <View style={styles.content}>
                    {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
                </View>
            ) : (
                <FlatList
                    data={users}
                    renderItem={renderItem}
                    keyExtractor={keyExtractor}
                    contentContainerStyle={styles.content}
                    refreshing={loading}
                    onRefresh={handleRefresh}
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <Ionicons name="people-outline" size={48} color={theme.textSecondary} />
                            <Text style={{ color: theme.textSecondary, marginTop: 8 }}>No users found</Text>
                        </View>
                    }
                />
            )}

            {canManageUsers() && (
                <TouchableOpacity
                    style={[styles.fab, { backgroundColor: theme.primary }]}
                    onPress={handleAddUser}
                    activeOpacity={0.8}
                >
                    <Ionicons name="person-add" size={24} color="#fff" />
                </TouchableOpacity>
            )}

            <Modal
                animationType="slide"
                transparent={true}
                visible={modalVisible}
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
                        <Text style={[styles.modalTitle, { color: theme.text }]}>Create New User</Text>

                        <View style={{ maxHeight: 300 }}>
                            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                                <Input
                                    label="Username"
                                    name="username"
                                    control={control}
                                    placeholder="Enter username"
                                    autoCapitalize="none"
                                    error={errors.username?.message}
                                />
                                <Input
                                    label="Password"
                                    name="password"
                                    control={control}
                                    placeholder="Enter password"
                                    secureTextEntry
                                    error={errors.password?.message}
                                />

                                <Text style={[styles.label, { color: theme.textSecondary }]}>Role</Text>
                                <View style={styles.roleSelector}>
                                    {roles.map((r) => (
                                        <TouchableOpacity
                                            key={r.value}
                                            style={[
                                                styles.roleOption,
                                                {
                                                    backgroundColor: selectedRole === r.value ? theme.primary : theme.border,
                                                }
                                            ]}
                                            onPress={() => {
                                                setSelectedRole(r.value);
                                                setValue('role', r.value);
                                            }}
                                        >
                                            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600', textAlign: 'center' }}>
                                                {r.label}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </ScrollView>
                        </View>

                        <View style={[styles.modalActions, { borderTopColor: theme.border }]}>
                            <TouchableOpacity
                                style={[styles.modalBtn, { backgroundColor: theme.border }]}
                                onPress={() => setModalVisible(false)}
                            >
                                <Text style={{ color: theme.text, fontWeight: '600' }}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalBtn, { backgroundColor: theme.primary }]}
                                onPress={handleSubmit(onSubmit)}
                            >
                                <Text style={{ color: '#fff', fontWeight: '600' }}>Create User</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
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
    title: { fontSize: 20, fontWeight: 'bold', flex: 1 },
    readOnlyBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
    content: { padding: 20 },
    card: { marginBottom: 12 },
    userRow: { flexDirection: 'row', alignItems: 'center' },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
    userInfo: { flex: 1, marginLeft: 12 },
    username: { fontSize: 16, fontWeight: '600' },
    roleBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
        marginTop: 4,
        alignSelf: 'flex-start'
    },
    roleText: { fontSize: 11, fontWeight: '600' },
    deleteBtn: { padding: 8 },
    fab: {
        position: 'absolute',
        bottom: 30,
        right: 20,
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 4
    },
    emptyState: { alignItems: 'center', marginTop: 40 },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        padding: 20
    },
    modalContent: {
        borderRadius: 16,
        padding: 20,
    },
    modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 16, textAlign: 'center' },
    label: { fontSize: 14, fontWeight: '500', marginBottom: 8 },
    roleSelector: { flexDirection: 'column', gap: 8, marginBottom: 16 },
    roleOption: {
        padding: 12,
        borderRadius: 8,
    },
    modalActions: {
        flexDirection: 'row',
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
        gap: 12,
    },
    modalBtn: {
        flex: 1,
        padding: 14,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
