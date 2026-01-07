import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, Alert, Modal, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Colors } from '../../src/constants/Colors';
import { Card } from '../../src/components/Card';
import { dataService, StockItem } from '../../src/services/dataService';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRBAC, Role, LocationType } from '../../src/hooks/useRBAC';
import { Button } from '../../src/components/Button';
import { Input } from '../../src/components/Input';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { SkeletonCard } from '../../src/components/SkeletonLoader';
import { useTheme } from '../../src/context/ThemeContext';
import * as Haptics from 'expo-haptics';

const stockSchema = z.object({
    location: z.enum(['Shop', 'Factory']),
    itemName: z.string().min(1, "Name is required"),
    quantity: z.string().refine(val => !isNaN(Number(val)) && Number(val) >= 0, "Must be a valid number"),
    unit: z.string().optional(),
});

type StockFormValues = z.infer<typeof stockSchema>;

export default function StockScreen() {
    const [items, setItems] = useState<StockItem[]>([]);
    const [filteredItems, setFilteredItems] = useState<StockItem[]>([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [isInitialLoad, setIsInitialLoad] = useState(true);
    const { theme: themeMode } = useTheme();
    const theme = Colors[themeMode];
    const { role, canEditStock, getAllowedLocations } = useRBAC();
    const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const allowedLocations = useMemo(() => getAllowedLocations(), [role]);

    // Modal State
    const [modalVisible, setModalVisible] = useState(false);
    const [editingItem, setEditingItem] = useState<StockItem | null>(null);

    const { control, handleSubmit, setValue, reset, watch, formState: { errors } } = useForm<StockFormValues>({
        resolver: zodResolver(stockSchema),
        defaultValues: {
            location: allowedLocations[0] || 'Shop',
            itemName: '',
            quantity: '0',
            unit: 'kg'
        }
    });

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const response = await dataService.getStock();
            const data = response.data || response; // Handle paginated response
            // Filter by allowed locations
            const filtered = data.filter((item: StockItem) =>
                allowedLocations.includes(item.location as LocationType)
            );
            setItems(filtered);
            setFilteredItems(filtered);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
            setIsInitialLoad(false);
        }
    }, [role]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Debounced search
    const handleSearchChange = useCallback((text: string) => {
        setSearch(text);
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        debounceTimer.current = setTimeout(() => {
            const filtered = items.filter(item =>
                (item.productName || '').toLowerCase().includes(text.toLowerCase())
            );
            setFilteredItems(filtered);
        }, 300);
    }, [items]);

    const handleAdd = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setEditingItem(null);
        reset({ location: allowedLocations[0] || 'Shop', itemName: '', quantity: '0', unit: 'kg' });
        setModalVisible(true);
    }, [reset, allowedLocations]);

    const handleEdit = useCallback((item: StockItem) => {
        if (!canEditStock(item.location as LocationType)) {
            Alert.alert('Access Denied', 'You cannot edit this item');
            return;
        }
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setEditingItem(item);
        setValue('location', item.location as 'Shop' | 'Factory');
        setValue('itemName', item.productName);
        setValue('quantity', item.quantity.toString());
        setValue('unit', item.unit || 'kg');
        setModalVisible(true);
    }, [setValue, canEditStock]);

    const handleDelete = useCallback((item: StockItem) => {
        if (!canEditStock(item.location as LocationType)) {
            Alert.alert('Access Denied', 'You cannot delete this item');
            return;
        }
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        Alert.alert('Confirm Delete', `Remove ${item.productName} from ${item.location}?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', style: 'destructive', onPress: async () => {
                    try {
                        await dataService.deleteStockItem(item.location, item.productName);
                        fetchData();
                    } catch (e) {
                        Alert.alert("Error", "Failed to delete");
                    }
                }
            }
        ]);
    }, [fetchData, canEditStock]);

    const onSubmit = useCallback(async (data: StockFormValues) => {
        try {
            if (!canEditStock(data.location as LocationType)) {
                Alert.alert('Access Denied', 'You cannot save to this location');
                return;
            }
            await dataService.updateStock(data.location, data.itemName, Number(data.quantity), data.unit);
            setModalVisible(false);
            fetchData();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert("Success", editingItem ? "Stock updated" : "Stock added");
        } catch (e) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert("Error", "Failed to save stock");
        }
    }, [fetchData, editingItem, canEditStock]);

    // Bulk Selection
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [selectionMode, setSelectionMode] = useState(false);

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
        if (!canEditStock(location as LocationType)) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        setSelectionMode(true);
        toggleSelection(id);
    }, [canEditStock, toggleSelection]);

    const handleBulkDelete = useCallback(() => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        Alert.alert('Bulk Delete', `Delete ${selectedIds.size} items?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', style: 'destructive', onPress: async () => {
                    try {
                        const itemsToDelete = items
                            .filter(i => selectedIds.has(i._id))
                            .map(i => ({ location: i.location, itemName: i.productName }));
                        await dataService.bulkDeleteStock(itemsToDelete);
                        setSelectedIds(new Set());
                        setSelectionMode(false);
                        fetchData();
                    } catch (e) {
                        Alert.alert("Error", "Failed to delete items");
                    }
                }
            }
        ]);
    }, [selectedIds, items, fetchData]);

    const handleRefresh = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        dataService.invalidateCache('stock');
        fetchData();
    }, [fetchData]);

    const renderItem = useCallback(({ item, index }: { item: StockItem, index: number }) => {
        const isSelected = selectedIds.has(item._id);
        const canEdit = canEditStock(item.location as LocationType);

        return (
            <Card
                delay={index * 50}
                style={[
                    styles.card,
                    isSelected && { borderColor: theme.primary, borderWidth: 2, backgroundColor: theme.surface }
                ]}
            >
                <TouchableOpacity
                    onLongPress={() => handleLongPress(item._id, item.location)}
                    onPress={() => selectionMode ? toggleSelection(item._id) : null}
                    activeOpacity={0.8}
                >
                    <View style={styles.row}>
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.productName, { color: theme.text }]}>{item.productName}</Text>
                            <View style={styles.locationBadge}>
                                <View style={[styles.badge, { backgroundColor: item.location === 'Factory' ? theme.primary : theme.success }]}>
                                    <Text style={styles.badgeText}>{item.location}</Text>
                                </View>
                                <Text style={[styles.unit, { color: theme.textSecondary }]}> • {item.unit || 'kg'}</Text>
                            </View>
                        </View>
                        <View style={styles.rightContainer}>
                            <View style={styles.quantityContainer}>
                                <Ionicons name="cube-outline" size={16} color={theme.textSecondary} style={{ marginRight: 4 }} />
                                <Text style={[styles.quantity, { color: theme.text }]}>{item.quantity}</Text>
                            </View>

                            {selectionMode ? (
                                <View style={{ marginLeft: 16 }}>
                                    <Ionicons
                                        name={isSelected ? "checkbox" : "square-outline"}
                                        size={24}
                                        color={isSelected ? theme.primary : theme.textSecondary}
                                    />
                                </View>
                            ) : (
                                canEdit && (
                                    <View style={styles.actions}>
                                        <TouchableOpacity onPress={() => handleEdit(item)} style={styles.actionBtn}>
                                            <Ionicons name="create-outline" size={20} color={theme.primary} />
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={() => handleDelete(item)} style={styles.actionBtn}>
                                            <Ionicons name="trash-outline" size={20} color={theme.error} />
                                        </TouchableOpacity>
                                    </View>
                                )
                            )}
                        </View>
                    </View>
                </TouchableOpacity>
            </Card>
        );
    }, [theme, selectedIds, selectionMode, canEditStock, handleLongPress, toggleSelection, handleEdit, handleDelete]);

    const keyExtractor = useCallback((item: StockItem) => item._id, []);

    const SkeletonList = useMemo(() => (
        <View style={styles.listContent}>
            {[1, 2, 3, 4, 5].map((i) => <SkeletonCard key={i} />)}
        </View>
    ), []);

    const currentLocation = watch('location');

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
            <View style={styles.header}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={[styles.title, { color: theme.text, marginBottom: 0 }]}>
                        {selectionMode ? `${selectedIds.size} Selected` : 'Stock Level'}
                    </Text>
                    {selectionMode && (
                        <TouchableOpacity onPress={handleBulkDelete}>
                            <Text style={{ color: theme.error, fontWeight: 'bold' }}>Delete Selected</Text>
                        </TouchableOpacity>
                    )}
                </View>
                {!selectionMode && (
                    <View style={[styles.searchContainer, { backgroundColor: theme.surface, borderColor: theme.border, marginTop: 16 }]}>
                        <Ionicons name="search" size={20} color={theme.textSecondary} />
                        <TextInput
                            style={[styles.searchInput, { color: theme.text }]}
                            placeholder="Search stock..."
                            placeholderTextColor={theme.textSecondary}
                            value={search}
                            onChangeText={handleSearchChange}
                        />
                    </View>
                )}
            </View>

            {isInitialLoad ? SkeletonList : (
                <FlatList
                    data={filteredItems}
                    renderItem={renderItem}
                    keyExtractor={keyExtractor}
                    contentContainerStyle={[styles.listContent, filteredItems.length === 0 && { flex: 1 }]}
                    refreshing={loading}
                    onRefresh={handleRefresh}
                    removeClippedSubviews={true}
                    maxToRenderPerBatch={10}
                    windowSize={5}
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <Ionicons name="cube-outline" size={64} color={theme.textSecondary} />
                            <Text style={[styles.emptyTitle, { color: theme.text }]}>No Stock Items</Text>
                            <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
                                {search ? 'No items match your search' : 'Add stock items to get started'}
                            </Text>
                        </View>
                    }
                />
            )}

            {canEditStock() && (
                <TouchableOpacity
                    style={[styles.fab, { backgroundColor: theme.primary, shadowColor: theme.text }]}
                    onPress={handleAdd}
                    activeOpacity={0.8}
                >
                    <Ionicons name="add" size={32} color="#fff" />
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
                        <Text style={[styles.modalTitle, { color: theme.text }]}>
                            {editingItem ? 'Edit Stock' : 'Add Stock'}
                        </Text>

                        <View style={{ maxHeight: 280 }}>
                            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                                <Text style={[styles.label, { color: theme.textSecondary }]}>
                                    Location:{editingItem ? ' (Cannot Change)' : ''}
                                </Text>
                                <View style={styles.locationRow}>
                                    {(['Shop', 'Factory'] as const).map((loc) => {
                                        const isSelected = currentLocation === loc;
                                        const isAllowed = allowedLocations.includes(loc);
                                        return (
                                            <TouchableOpacity
                                                key={loc}
                                                style={[
                                                    styles.locBadge,
                                                    {
                                                        backgroundColor: isSelected ? theme.primary : theme.border,
                                                        opacity: isAllowed && !editingItem ? 1 : 0.5
                                                    },
                                                ]}
                                                onPress={() => !editingItem && isAllowed && setValue('location', loc)}
                                                disabled={!!editingItem || !isAllowed}
                                            >
                                                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>{loc}</Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>

                                <Input
                                    label="Item Name"
                                    name="itemName"
                                    control={control}
                                    placeholder="Enter item name"
                                    editable={!editingItem}
                                    error={errors.itemName?.message}
                                />
                                <Input
                                    label="Quantity"
                                    name="quantity"
                                    control={control}
                                    placeholder="0"
                                    keyboardType="numeric"
                                    error={errors.quantity?.message}
                                />
                                <Text style={[styles.label, { color: theme.textSecondary }]}>Unit</Text>
                                <View style={styles.unitRow}>
                                    {(['kg', 'L', 'pcs', 'bag', 'ton'] as const).map((u) => {
                                        const isSelected = watch('unit') === u;
                                        return (
                                            <TouchableOpacity
                                                key={u}
                                                style={[
                                                    styles.unitBadge,
                                                    { backgroundColor: isSelected ? theme.primary : theme.border }
                                                ]}
                                                onPress={() => setValue('unit', u)}
                                            >
                                                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>{u}</Text>
                                            </TouchableOpacity>
                                        );
                                    })}
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
                                <Text style={{ color: '#fff', fontWeight: '600' }}>Save</Text>
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
    header: { padding: 20, paddingBottom: 10 },
    title: { fontSize: 28, fontWeight: 'bold', marginBottom: 16 },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        height: 48,
        borderRadius: 12,
        borderWidth: 1
    },
    searchInput: { flex: 1, marginLeft: 8, fontSize: 16 },
    listContent: { padding: 20, paddingBottom: 100 },
    card: { marginBottom: 12 },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    productName: { fontSize: 16, fontWeight: '600' },
    locationBadge: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
    badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
    badgeText: { color: '#fff', fontSize: 10, fontWeight: '600' },
    unit: { fontSize: 12 },
    rightContainer: { alignItems: 'flex-end' },
    quantityContainer: { flexDirection: 'row', alignItems: 'center' },
    quantity: { fontSize: 18, fontWeight: '700' },
    actions: { flexDirection: 'row', marginTop: 8 },
    actionBtn: { padding: 4, marginLeft: 12 },
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
        shadowRadius: 4
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        padding: 20
    },
    modalContent: {
        borderRadius: 16,
        padding: 20,
        maxHeight: '80%',
    },
    modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 16, textAlign: 'center' },
    modalActions: { flexDirection: 'row', marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#e2e8f0', gap: 12 },
    modalBtn: { flex: 1, padding: 14, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    label: { fontSize: 14, fontWeight: '500', marginBottom: 8 },
    locationRow: { flexDirection: 'row', marginBottom: 16, gap: 8 },
    locBadge: { flex: 1, padding: 12, borderRadius: 8, alignItems: 'center' },
    unitRow: { flexDirection: 'row', marginBottom: 16, gap: 6 },
    unitBadge: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8 },
    emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
    emptyTitle: { fontSize: 18, fontWeight: '600', marginTop: 16 },
    emptySubtitle: { fontSize: 14, marginTop: 8, textAlign: 'center' },
});
