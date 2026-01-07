import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Image, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../src/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { dataService, Order } from '../../src/services/dataService';
import { useTheme } from '../../src/context/ThemeContext';
import { useRBAC, LocationType } from '../../src/hooks/useRBAC';
import * as Haptics from 'expo-haptics';

export default function OrderDetailsScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const { theme: themeMode } = useTheme();
    const theme = Colors[themeMode];
    const { canEditOrders } = useRBAC();

    const [order, setOrder] = useState<Order | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchOrder = useCallback(async () => {
        try {
            setLoading(true);
            const data = await dataService.getOrder(id as string);
            setOrder(data);
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'Failed to load order details');
            router.back();
        } finally {
            setLoading(false);
        }
    }, [id, router]);

    useFocusEffect(
        useCallback(() => {
            fetchOrder();
        }, [fetchOrder])
    );

    const handleEdit = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        // @ts-ignore
        router.push(`/orders/edit/${id}`);
    };

    if (loading) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={theme.primary} />
            </SafeAreaView>
        );
    }

    if (!order) return null;

    const location = (order.location || 'Shop') as LocationType;
    const canEdit = canEditOrders(location);

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <View style={[styles.header, { borderBottomColor: theme.border }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={[styles.title, { color: theme.text }]}>Order #{order._id.slice(-6).toUpperCase()}</Text>

                {canEdit && (
                    <TouchableOpacity onPress={handleEdit} style={styles.editButton}>
                        <Text style={{ color: theme.primary, fontWeight: 'bold' }}>Edit</Text>
                    </TouchableOpacity>
                )}
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                {/* Status & Location */}
                <View style={styles.statusRow}>
                    <View style={[
                        styles.badge,
                        { backgroundColor: order.status === 'completed' ? theme.success : '#f59e0b' }
                    ]}>
                        <Ionicons name={order.status === 'completed' ? "checkmark-circle" : "time"} size={16} color="#fff" />
                        <Text style={styles.badgeText}>{order.status.toUpperCase()}</Text>
                    </View>

                    <View style={[
                        styles.badge,
                        { backgroundColor: order.location === 'Factory' ? theme.primary : theme.success }
                    ]}>
                        <Ionicons name="location" size={16} color="#fff" />
                        <Text style={styles.badgeText}>{order.location}</Text>
                    </View>
                </View>

                <Text style={[styles.date, { color: theme.textSecondary }]}>
                    Created on {new Date(order.createdAt).toLocaleDateString('en-IN', {
                        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                        hour: '2-digit', minute: '2-digit'
                    })}
                </Text>

                {/* Items */}
                <View style={[styles.section, { backgroundColor: theme.surface }]}>
                    <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Items</Text>
                    {order.items.map((item, index) => (
                        <View key={index} style={[styles.itemRow, { borderBottomColor: theme.border, borderBottomWidth: index < order.items.length - 1 ? 1 : 0 }]}>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.itemName, { color: theme.text }]}>{item.name}</Text>
                                <Text style={[styles.itemQty, { color: theme.textSecondary }]}>{item.quantity} x ₹{item.price}</Text>
                            </View>
                            <Text style={[styles.itemTotal, { color: theme.text }]}>₹{(item.quantity * item.price).toLocaleString()}</Text>
                        </View>
                    ))}
                    <View style={[styles.totalRow, { borderTopColor: theme.border }]}>
                        <Text style={[styles.totalLabel, { color: theme.text }]}>Total Amount</Text>
                        <Text style={[styles.totalValue, { color: theme.primary }]}>₹{order.totalAmount.toLocaleString()}</Text>
                    </View>
                </View>

                {/* Images */}
                <Text style={[styles.sectionTitle, { color: theme.textSecondary, marginTop: 24, paddingHorizontal: 4 }]}>Images</Text>

                {order.orderImage && (
                    <View style={styles.imageCard}>
                        <Text style={[styles.imageLabel, { color: theme.textSecondary }]}>Order Photo</Text>
                        <Image
                            source={{ uri: order.orderImage.startsWith('data:') ? order.orderImage : `data:image/jpeg;base64,${order.orderImage}` }}
                            style={styles.image}
                            resizeMode="cover"
                        />
                    </View>
                )}

                {order.parchiImage && (
                    <View style={[styles.imageCard, { marginTop: 16 }]}>
                        <Text style={[styles.imageLabel, { color: theme.textSecondary }]}>Parchi Photo</Text>
                        <Image
                            source={{ uri: order.parchiImage.startsWith('data:') ? order.parchiImage : `data:image/jpeg;base64,${order.parchiImage}` }}
                            style={styles.image}
                            resizeMode="cover"
                        />
                    </View>
                )}
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
        borderBottomWidth: 1,
        justifyContent: 'space-between'
    },
    backButton: { padding: 4 },
    title: { fontSize: 18, fontWeight: 'bold', flex: 1, textAlign: 'center' },
    editButton: { padding: 4 },
    content: { padding: 20, paddingBottom: 40 },
    statusRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        gap: 6
    },
    badgeText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
    date: { fontSize: 14, marginBottom: 24 },
    section: {
        borderRadius: 16,
        padding: 16,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    sectionTitle: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', marginBottom: 12 },
    itemRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
    },
    itemName: { fontSize: 16, fontWeight: '600' },
    itemQty: { fontSize: 14, marginTop: 4 },
    itemTotal: { fontSize: 16, fontWeight: 'bold' },
    totalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1
    },
    totalLabel: { fontSize: 16, fontWeight: 'bold' },
    totalValue: { fontSize: 20, fontWeight: 'bold' },
    imageCard: {
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: '#f0f0f0',
        height: 300,
    },
    image: { width: '100%', height: '100%' },
    imageLabel: {
        position: 'absolute',
        top: 12,
        left: 12,
        zIndex: 1,
        backgroundColor: 'rgba(255,255,255,0.8)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
        fontSize: 10,
        fontWeight: 'bold',
        overflow: 'hidden'
    }
});
