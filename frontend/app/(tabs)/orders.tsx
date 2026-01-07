import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Colors } from '../../src/constants/Colors';
import { Card } from '../../src/components/Card';
import { dataService, Order } from '../../src/services/dataService';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { SkeletonCard } from '../../src/components/SkeletonLoader';
import { useTheme } from '../../src/context/ThemeContext';
import { useRBAC, LocationType } from '../../src/hooks/useRBAC';
import * as Haptics from 'expo-haptics';

export default function OrdersScreen() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [isInitialLoad, setIsInitialLoad] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [selectionMode, setSelectionMode] = useState(false);
    const router = useRouter();
    const { theme: themeMode } = useTheme();
    const theme = Colors[themeMode];
    const { canEditOrders, canUpdateOrderStatus, getAllowedLocations, role } = useRBAC();
    const allowedLocations = useMemo(() => getAllowedLocations(), [role]);

    // Stats calculations
    const stats = useMemo(() => {
        const total = orders.length;
        const completed = orders.filter(o => o.status === 'completed').length;
        const pending = total - completed;
        return { total, completed, pending };
    }, [orders]);

    const fetchData = useCallback(async (pageNum: number = 1, append: boolean = false) => {
        try {
            if (pageNum === 1) setLoading(true);
            else setLoadingMore(true);

            const response = await dataService.getOrders(pageNum, 15);
            const data = response.data || response;
            const pagination = response.pagination;

            // Filter by allowed locations
            const filtered = data.filter((order: Order) =>
                allowedLocations.includes((order.location || 'Shop') as LocationType)
            );

            if (append) {
                setOrders(prev => [...prev, ...filtered]);
            } else {
                setOrders(filtered);
            }

            setHasMore(pagination?.hasMore ?? false);
            setPage(pageNum);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
            setLoadingMore(false);
            setIsInitialLoad(false);
        }
    }, [role, allowedLocations]);

    const loadMore = useCallback(() => {
        if (!loadingMore && hasMore) {
            fetchData(page + 1, true);
        }
    }, [loadingMore, hasMore, page, fetchData]);

    useFocusEffect(
        useCallback(() => {
            fetchData(1, false);
        }, [fetchData])
    );

    const handleStatusUpdate = useCallback((item: Order) => {
        const location = (item.location || 'Shop') as LocationType;
        if (!canUpdateOrderStatus(location)) {
            Alert.alert('Access Denied', 'You cannot update this order status');
            return;
        }
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        const newStatus = (item.status === 'completed') ? 'pending' : 'completed';
        Alert.alert(
            'Update Status',
            `Mark order as ${newStatus}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: newStatus === 'completed' ? '✓ Complete' : '↩ Pending',
                    style: newStatus === 'completed' ? 'default' : 'destructive',
                    onPress: async () => {
                        try {
                            await dataService.updateOrder(item._id, { status: newStatus });
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                            fetchData();
                        } catch (e) {
                            Alert.alert("Error", "Failed to update status");
                        }
                    }
                }
            ]
        );
    }, [fetchData, canUpdateOrderStatus]);

    const handleDelete = useCallback((item: Order) => {
        const location = (item.location || 'Shop') as LocationType;
        if (!canEditOrders(location)) {
            Alert.alert('Access Denied', 'You cannot delete this order');
            return;
        }
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        Alert.alert('Delete Order', 'Are you sure?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', style: 'destructive', onPress: async () => {
                    try {
                        await dataService.deleteOrder(item._id);
                        fetchData();
                    } catch (e) {
                        Alert.alert("Error", "Failed to delete order");
                    }
                }
            }
        ]);
    }, [fetchData, canEditOrders]);

    const toggleSelection = useCallback((id: string) => {
        setSelectedIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) newSet.delete(id);
            else newSet.add(id);
            if (newSet.size === 0) setSelectionMode(false);
            return newSet;
        });
    }, []);

    const handleLongPress = useCallback((id: string, location: string) => {
        if (!canEditOrders(location as LocationType)) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        setSelectionMode(true);
        toggleSelection(id);
    }, [canEditOrders, toggleSelection]);

    const handleBulkDelete = useCallback(() => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        Alert.alert('Bulk Delete', `Delete ${selectedIds.size} orders?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', style: 'destructive', onPress: async () => {
                    try {
                        await dataService.bulkDeleteOrders(Array.from(selectedIds));
                        setSelectedIds(new Set());
                        setSelectionMode(false);
                        fetchData();
                    } catch (e) {
                        Alert.alert("Error", "Failed to delete orders");
                    }
                }
            }
        ]);
    }, [selectedIds, fetchData]);

    const handleRefresh = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        dataService.invalidateCache('orders');
        fetchData();
    }, [fetchData]);

    const renderItem = useCallback(({ item, index }: { item: Order, index: number }) => {
        const isCompleted = item.status === 'completed';
        const isSelected = selectedIds.has(item._id);
        const location = (item.location || 'Shop') as LocationType;
        const canEdit = canEditOrders(location);

        return (
            <Card
                delay={index * 50}
                style={[
                    styles.card,
                    isSelected && { borderColor: theme.primary, borderWidth: 2 },
                    { backgroundColor: isCompleted ? `${theme.success}10` : theme.surface }
                ]}
            >
                <TouchableOpacity
                    onLongPress={() => handleLongPress(item._id, location)}
                    onPress={() => selectionMode ? toggleSelection(item._id) : /* @ts-ignore */ router.push(`/orders/${item._id}`)}
                    activeOpacity={0.8}
                >
                    {/* Status Badge */}
                    <View style={styles.headerRow}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Text style={[styles.orderId, { color: theme.text }]}>
                                #{item._id.slice(-6).toUpperCase()}
                            </Text>
                            <View style={[
                                styles.locationTag,
                                { backgroundColor: location === 'Factory' ? theme.primary : theme.success }
                            ]}>
                                <Text style={styles.locationTagText}>{location}</Text>
                            </View>
                        </View>

                        <TouchableOpacity
                            onPress={() => handleStatusUpdate(item)}
                            style={[
                                styles.statusBadge,
                                { backgroundColor: isCompleted ? theme.success : '#f59e0b' }
                            ]}
                        >
                            <Ionicons
                                name={isCompleted ? "checkmark-circle" : "time"}
                                size={14}
                                color="#fff"
                            />
                            <Text style={styles.statusText}>
                                {isCompleted ? 'COMPLETED' : 'PENDING'}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    <Text style={[styles.date, { color: theme.textSecondary }]}>
                        {new Date(item.createdAt).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                        })}
                    </Text>

                    <View style={[styles.divider, { backgroundColor: theme.border }]} />

                    <View style={styles.itemsRow}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Ionicons name="cube-outline" size={16} color={theme.textSecondary} />
                            <Text style={[styles.items, { color: theme.text, marginLeft: 4 }]}>
                                {item.items.length} Items
                            </Text>
                        </View>
                        <Text style={[styles.total, { color: theme.primary }]}>
                            ₹{item.totalAmount?.toLocaleString() || 0}
                        </Text>
                    </View>

                    {/* Actions */}
                    {selectionMode ? (
                        <View style={styles.selectionIndicator}>
                            <Ionicons
                                name={isSelected ? "checkbox" : "square-outline"}
                                size={24}
                                color={isSelected ? theme.primary : theme.textSecondary}
                            />
                        </View>
                    ) : (
                        canEdit && (
                            <View style={styles.actionsRow}>
                                <TouchableOpacity
                                    onPress={() => handleDelete(item)}
                                    style={[styles.actionBtn, { backgroundColor: theme.error + '20' }]}
                                >
                                    <Ionicons name="trash-outline" size={18} color={theme.error} />
                                </TouchableOpacity>
                            </View>
                        )
                    )}
                </TouchableOpacity>
            </Card>
        );
    }, [theme, selectedIds, selectionMode, canEditOrders, handleStatusUpdate, handleDelete, handleLongPress, toggleSelection, router]);

    const keyExtractor = useCallback((item: Order) => item._id, []);

    const handleAddOrder = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push('/orders/create');
    }, [router]);

    const SkeletonList = useMemo(() => (
        <View style={styles.listContent}>
            {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}
        </View>
    ), []);

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
            <View style={styles.header}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={[styles.title, { color: theme.text }]}>
                        {selectionMode ? `${selectedIds.size} Selected` : 'Orders'}
                    </Text>
                    {selectionMode && (
                        <TouchableOpacity onPress={handleBulkDelete}>
                            <Text style={{ color: theme.error, fontWeight: 'bold' }}>Delete Selected</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Stats Cards */}
                {!selectionMode && (
                    <View style={styles.statsContainer}>
                        <View style={[styles.statCard, { backgroundColor: theme.primary + '20' }]}>
                            <Text style={[styles.statNumber, { color: theme.primary }]}>{stats.total}</Text>
                            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Total</Text>
                        </View>
                        <View style={[styles.statCard, { backgroundColor: '#f59e0b20' }]}>
                            <Text style={[styles.statNumber, { color: '#f59e0b' }]}>{stats.pending}</Text>
                            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Pending</Text>
                        </View>
                        <View style={[styles.statCard, { backgroundColor: theme.success + '20' }]}>
                            <Text style={[styles.statNumber, { color: theme.success }]}>{stats.completed}</Text>
                            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Completed</Text>
                        </View>
                    </View>
                )}
            </View>

            {isInitialLoad ? SkeletonList : (
                <FlatList
                    data={orders}
                    renderItem={renderItem}
                    keyExtractor={keyExtractor}
                    contentContainerStyle={styles.listContent}
                    refreshing={loading}
                    onRefresh={handleRefresh}
                    ListEmptyComponent={
                        !loading ? (
                            <View style={styles.emptyState}>
                                <Ionicons name="cart-outline" size={48} color={theme.textSecondary} />
                                <Text style={{ color: theme.textSecondary, marginTop: 8 }}>No orders found</Text>
                            </View>
                        ) : null
                    }
                    removeClippedSubviews={true}
                    maxToRenderPerBatch={10}
                    windowSize={5}
                    onEndReached={loadMore}
                    onEndReachedThreshold={0.3}
                    ListFooterComponent={
                        loadingMore ? (
                            <View style={{ padding: 20, alignItems: 'center' }}>
                                <ActivityIndicator size="small" color={theme.primary} />
                            </View>
                        ) : null
                    }
                />
            )}

            {canEditOrders() && (
                <TouchableOpacity
                    style={[styles.fab, { backgroundColor: theme.primary, shadowColor: theme.text }]}
                    onPress={handleAddOrder}
                    activeOpacity={0.8}
                >
                    <Ionicons name="add" size={32} color="#fff" />
                </TouchableOpacity>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { padding: 20, paddingBottom: 10 },
    title: { fontSize: 28, fontWeight: 'bold' },
    statsContainer: {
        flexDirection: 'row',
        marginTop: 16,
        gap: 12
    },
    statCard: {
        flex: 1,
        padding: 12,
        borderRadius: 12,
        alignItems: 'center',
    },
    statNumber: { fontSize: 24, fontWeight: 'bold' },
    statLabel: { fontSize: 12, marginTop: 2 },
    listContent: { padding: 20, paddingBottom: 100 },
    card: { marginBottom: 12, borderRadius: 16 },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8
    },
    orderId: { fontWeight: '700', fontSize: 16 },
    locationTag: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4
    },
    locationTagText: { color: '#fff', fontSize: 10, fontWeight: '600' },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        gap: 4,
    },
    statusText: { color: '#fff', fontSize: 10, fontWeight: '700' },
    date: { fontSize: 12, marginBottom: 8 },
    divider: { height: 1, marginVertical: 8 },
    itemsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    items: { fontSize: 14 },
    total: { fontSize: 18, fontWeight: '700' },
    actionsRow: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        marginTop: 12,
        gap: 8
    },
    actionBtn: {
        padding: 8,
        borderRadius: 8
    },
    selectionIndicator: {
        position: 'absolute',
        right: 0,
        top: 0,
    },
    fab: {
        position: 'absolute',
        bottom: 90,
        right: 20,
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 4,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
    },
    emptyState: { alignItems: 'center', marginTop: 40 }
});
