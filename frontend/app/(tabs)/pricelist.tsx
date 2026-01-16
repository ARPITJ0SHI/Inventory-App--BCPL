import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, Alert, Modal, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from 'react-native';
import { Colors } from '../../src/constants/Colors';
import { Card } from '../../src/components/Card';
import { dataService, PriceItem } from '../../src/services/dataService';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { SkeletonCard } from '../../src/components/SkeletonLoader';
import { useTheme } from '../../src/context/ThemeContext';
import { useRBAC } from '../../src/hooks/useRBAC';
import { Button } from '../../src/components/Button';
import { Input } from '../../src/components/Input';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import * as Haptics from 'expo-haptics';

const priceSchema = z.object({
    productName: z.string().min(1, "Product name is required"),
    price: z.string().refine(val => !isNaN(Number(val)) && Number(val) >= 0, "Must be a valid price"),
    category: z.string().optional(),
});

type PriceFormValues = z.infer<typeof priceSchema>;

import { cacheService, CACHE_KEYS } from '../../src/services/cacheService';

export default function PriceListScreen() {
    const [items, setItems] = useState<PriceItem[]>([]);
    const [filteredItems, setFilteredItems] = useState<PriceItem[]>([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [isInitialLoad, setIsInitialLoad] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'asc' | 'desc_alpha'>('newest');
    const [selectedType, setSelectedType] = useState<'buying' | 'selling'>('selling');
    const [refreshing, setRefreshing] = useState(false);

    const [modalVisible, setModalVisible] = useState(false);
    const [editingItem, setEditingItem] = useState<PriceItem | null>(null);
    const { theme: themeMode } = useTheme();
    const theme = Colors[themeMode];
    const { canEditPrices } = useRBAC();
    const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const { control, handleSubmit, reset, formState: { errors } } = useForm<PriceFormValues>({
        resolver: zodResolver(priceSchema),
        defaultValues: { productName: '', price: '', category: '' }
    });

    // Cache logic
    const loadCachedData = async () => {
        const cached = await cacheService.load(CACHE_KEYS.PRICELIST);
        if (cached && Array.isArray(cached) && isInitialLoad) {
            setItems(cached);
            setFilteredItems(cached);
            setLoading(false);
        }
    };

    const fetchData = useCallback(async (pageNum: number = 1, append: boolean = false, isBackground: boolean = false) => {
        try {
            if (pageNum === 1 && !isBackground && items.length === 0) setLoading(true);
            else if (pageNum > 1) setLoadingMore(true);

            const response = await dataService.getPriceList(pageNum, 15, search, sortOrder, selectedType);
            const data = response.data || response;
            const pagination = response.pagination;

            if (append) {
                setItems(prev => [...prev, ...data]);
                setFilteredItems(prev => [...prev, ...data]);
            } else {
                setItems(data);
                setFilteredItems(data);
                // Save Cache (Page 1)
                if (pageNum === 1 && !search) {
                    cacheService.save(CACHE_KEYS.PRICELIST, data);
                }
            }

            setHasMore(pagination?.hasMore ?? false);
            setPage(pageNum);
        } catch (error) {
            console.error('PriceList fetchData error:', error);
        } finally {
            setLoading(false);
            setLoadingMore(false);
            setIsInitialLoad(false);
        }
    }, [search, sortOrder, selectedType, items.length]);

    const loadMore = useCallback(() => {
        if (!loadingMore && hasMore) {
            fetchData(page + 1, true);
        }
    }, [loadingMore, hasMore, page, fetchData]);

    // Refs for Polling
    const searchRef = useRef(search);
    const fetchDataRef = useRef(fetchData);

    // Update Refs
    useEffect(() => {
        searchRef.current = search;
        fetchDataRef.current = fetchData;
    }, [search, fetchData]);

    // 1. Initial Load (Run ONCE)
    useEffect(() => {
        const init = async () => {
            await loadCachedData();
            await fetchData(1, false, true);
        };
        init();

        return () => { };
    }, []);

    // 2. Subscribe to Global Updates
    useEffect(() => {
        const unsubscribe = dataService.subscribe('pricelist', () => {
            if (!searchRef.current) {
                fetchDataRef.current(1, false, true);
            }
        });
        return () => unsubscribe();
    }, []);

    // Fetch on sort change
    useEffect(() => {
        fetchData(1, false);
    }, [sortOrder, selectedType, fetchData]); // Added fetchData to dependencies

    // Search - debounced live search (300ms delay)
    const handleSearchChange = useCallback((text: string) => {
        setSearch(text);

        // Clear any existing debounce timer
        if (debounceTimer.current) {
            clearTimeout(debounceTimer.current);
        }

        // Set new debounce timer
        debounceTimer.current = setTimeout(() => {
            fetchData(1, false);
        }, 300);
    }, [fetchData]);

    const handleSearchSubmit = useCallback(() => {
        // Clear debounce timer on immediate submit
        if (debounceTimer.current) {
            clearTimeout(debounceTimer.current);
        }
        fetchData(1, false);
    }, [fetchData]);

    const handleClearSearch = useCallback(() => {
        setSearch('');
        if (debounceTimer.current) {
            clearTimeout(debounceTimer.current);
        }
        // Fetch with delay to allow state update
        setTimeout(() => fetchData(1, false), 50);
    }, [fetchData]);

    // Sort toggle
    const toggleSortOrder = useCallback(() => {
        setSortOrder(prev => {
            if (prev === 'newest') return 'oldest';
            if (prev === 'oldest') return 'asc';
            if (prev === 'asc') return 'desc_alpha';
            return 'newest';
        });
    }, []);

    const handleRefresh = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        dataService.invalidateCache('pricelist');
        fetchData();
    }, [fetchData]);

    const handleAdd = useCallback(() => {
        if (!canEditPrices()) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setEditingItem(null);
        reset({ productName: '', price: '', category: '' });
        setModalVisible(true);
    }, [reset, canEditPrices]);

    const handleEdit = useCallback((item: PriceItem) => {
        if (!canEditPrices()) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setEditingItem(item);
        reset({
            productName: item.productName,
            price: item.price.toString(),
            category: item.category || ''
        });
        setModalVisible(true);
    }, [reset, canEditPrices]);

    const handleDelete = useCallback((item: PriceItem) => {
        if (!canEditPrices()) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        Alert.alert('Delete Price', `Remove ${item.productName}?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', style: 'destructive', onPress: async () => {
                    try {
                        await dataService.deletePrice(item._id);
                        fetchData();
                    } catch (e) {
                        Alert.alert("Error", "Failed to delete");
                    }
                }
            }
        ]);
    }, [fetchData, canEditPrices]);

    const onSubmit = useCallback(async (data: PriceFormValues) => {
        try {
            if (editingItem) {
                await dataService.updatePrice(editingItem._id, {
                    productName: data.productName,
                    price: Number(data.price),
                    category: data.category,
                    type: selectedType
                });
            } else {
                await dataService.createPrice({
                    productName: data.productName,
                    price: Number(data.price),
                    category: data.category,
                    type: selectedType
                });
            }
            setModalVisible(false);
            fetchData();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert("Success", editingItem ? "Price updated" : "Price added");
        } catch (e) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert("Error", "Failed to save price");
        }
    }, [fetchData, editingItem]);

    const renderItem = useCallback(({ item, index }: { item: PriceItem, index: number }) => (
        <Card delay={index * 50} style={styles.card}>
            <View style={styles.row}>
                <View style={{ flex: 1 }}>
                    <Text style={[styles.productName, { color: theme.text }]}>{item.productName}</Text>
                    {item.category && (
                        <View style={[styles.categoryBadge, { backgroundColor: theme.primary + '20' }]}>
                            <Text style={[styles.categoryText, { color: theme.primary }]}>{item.category}</Text>
                        </View>
                    )}
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.price, { color: theme.primary }]}>₹{item.price}</Text>
                    {canEditPrices() && (
                        <View style={styles.actions}>
                            <TouchableOpacity onPress={() => handleEdit(item)} style={styles.actionBtn}>
                                <Ionicons name="create-outline" size={18} color={theme.primary} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => handleDelete(item)} style={styles.actionBtn}>
                                <Ionicons name="trash-outline" size={18} color={theme.error} />
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </View>
        </Card>
    ), [theme, canEditPrices, handleEdit, handleDelete]);

    const keyExtractor = useCallback((item: PriceItem) => item._id, []);

    const SkeletonList = useMemo(() => (
        <View style={styles.listContent}>
            {[1, 2, 3, 4, 5].map((i) => <SkeletonCard key={i} />)}
        </View>
    ), []);

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
            <View style={styles.header}>
                <View style={[styles.headerRow]}>
                    <Text style={[styles.title, { color: theme.text, marginBottom: 0 }]}>Price List</Text>
                    {canEditPrices() && (
                        <View></View> // Spacer or action if needed
                    )}
                </View>

                {/* Type Tabs */}
                <View style={[styles.tabContainer, { backgroundColor: theme.surface }]}>
                    <TouchableOpacity
                        style={[styles.tab, selectedType === 'selling' && { backgroundColor: theme.primary }]}
                        onPress={() => setSelectedType('selling')}
                    >
                        <Text style={[styles.tabText, { color: selectedType === 'selling' ? '#fff' : theme.textSecondary }]}>Selling Price</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tab, selectedType === 'buying' && { backgroundColor: theme.primary }]}
                        onPress={() => setSelectedType('buying')}
                    >
                        <Text style={[styles.tabText, { color: selectedType === 'buying' ? '#fff' : theme.textSecondary }]}>Buying Price</Text>
                    </TouchableOpacity>
                </View>
                <View style={[styles.searchContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <Ionicons name="search" size={20} color={theme.textSecondary} />
                    <TextInput
                        style={[styles.searchInput, { color: theme.text }]}
                        placeholder="Search products... (Enter)"
                        placeholderTextColor={theme.textSecondary}
                        value={search}
                        onChangeText={handleSearchChange}
                        onSubmitEditing={handleSearchSubmit}
                        returnKeyType="search"
                    />
                    {search.length > 0 && (
                        <TouchableOpacity onPress={handleClearSearch}>
                            <Ionicons name="close-circle" size={24} color={theme.textSecondary} />
                        </TouchableOpacity>
                    )}
                </View>
                {/* Sort Toggle */}
                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 }}>
                    <TouchableOpacity
                        onPress={toggleSortOrder}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                    >
                        <Ionicons
                            name={
                                sortOrder === 'asc' ? 'arrow-down-circle' :
                                    sortOrder === 'desc_alpha' ? 'arrow-up-circle' :
                                        sortOrder === 'newest' ? 'arrow-down' : 'arrow-up'
                            }
                            size={16}
                            color={theme.primary}
                        />
                        <Text style={{ color: theme.primary, fontSize: 12 }}>
                            {
                                sortOrder === 'asc' ? 'A-Z' :
                                    sortOrder === 'desc_alpha' ? 'Z-A' :
                                        sortOrder === 'newest' ? 'Newest' : 'Oldest'
                            }
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>

            {isInitialLoad ? SkeletonList : (
                <FlatList
                    data={items}
                    renderItem={renderItem}
                    keyExtractor={keyExtractor}
                    contentContainerStyle={styles.listContent}
                    refreshing={loading}
                    onRefresh={handleRefresh}
                    removeClippedSubviews={true}
                    maxToRenderPerBatch={15}
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
                    ListEmptyComponent={
                        !loading ? (
                            <View style={styles.emptyState}>
                                <Ionicons name="pricetag-outline" size={48} color={theme.textSecondary} />
                                <Text style={{ color: theme.textSecondary, marginTop: 8 }}>No prices found</Text>
                            </View>
                        ) : null
                    }
                />
            )}

            {canEditPrices() && (
                <TouchableOpacity
                    style={[styles.fab, { backgroundColor: theme.primary }]}
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
                            {editingItem ? 'Edit Price' : 'Add Price'}
                        </Text>

                        <View style={{ maxHeight: 250 }}>
                            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                                <Input
                                    label="Product Name"
                                    name="productName"
                                    control={control}
                                    placeholder="Enter product name"
                                    error={errors.productName?.message}
                                />
                                <Input
                                    label="Price (₹)"
                                    name="price"
                                    control={control}
                                    placeholder="0"
                                    keyboardType="numeric"
                                    error={errors.price?.message}
                                />
                                <Input
                                    label="Category (Optional)"
                                    name="category"
                                    control={control}
                                    placeholder="e.g., Vegetables, Fruits"
                                    error={errors.category?.message}
                                />
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
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    tabContainer: {
        flexDirection: 'row',
        borderRadius: 12,
        padding: 4,
        marginBottom: 16,
    },
    tab: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: 8,
    },
    tabText: {
        fontWeight: '600',
        fontSize: 14,
    },

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
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    productName: { fontSize: 16, fontWeight: '600' },
    categoryBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
        marginTop: 4,
        alignSelf: 'flex-start'
    },
    categoryText: { fontSize: 10, fontWeight: '600' },
    price: { fontSize: 20, fontWeight: '700' },
    actions: { flexDirection: 'row', marginTop: 8 },
    actionBtn: { padding: 4, marginLeft: 8 },
    fab: {
        position: 'absolute',
        bottom: 110,
        right: 20,
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 4
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
        maxHeight: '80%'
    },
    modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 16, textAlign: 'center' },
    modalActions: {
        flexDirection: 'row',
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
        gap: 12,
    },
    modalBtn: { flex: 1, padding: 14, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    emptyState: { alignItems: 'center', marginTop: 40 }
});
