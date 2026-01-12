import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../../src/constants/Colors';
import { Input } from '../../../src/components/Input';
import { Button } from '../../../src/components/Button';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Ionicons } from '@expo/vector-icons';
import { dataService } from '../../../src/services/dataService';
import { useTheme } from '../../../src/context/ThemeContext';
import * as Haptics from 'expo-haptics';

const orderSchema = z.object({
    items: z.array(z.object({
        name: z.string().min(1, "Item name required"),
        quantity: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0, "Qty > 0"),
        price: z.string().refine((val) => !isNaN(Number(val)) && Number(val) >= 0, "Invalid price"),
        gst: z.string().optional(),
    })).min(1, 'Add at least one item'),
    deposit: z.string().optional(),
});

type OrderFormValues = z.infer<typeof orderSchema>;

export default function EditOrderScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const { theme: themeMode } = useTheme();
    const theme = Colors[themeMode];
    const [isLoading, setIsLoading] = useState(false);
    const [fetching, setFetching] = useState(true);

    const { control, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<OrderFormValues>({
        resolver: zodResolver(orderSchema),
        defaultValues: {
            items: [{ name: '', quantity: '1', price: '0', gst: '0' }],
            deposit: '0',
        },
    });

    const deposit = watch('deposit');

    // Fetch initial data
    useEffect(() => {
        const load = async () => {
            try {
                const order = await dataService.getOrder(id as string);
                const initItems = order.items.map((i: any) => ({
                    name: i.name,
                    quantity: String(i.quantity),
                    price: String(i.price),
                    gst: String(i.gst || 0)
                }));
                reset({
                    items: initItems,
                    deposit: String(order.deposit || 0)
                });
            } catch (error) {
                Alert.alert("Error", "Failed to obtain order details");
                router.back();
            } finally {
                setFetching(false);
            }
        };
        load();
    }, [id, reset, router]);

    const { fields, append, remove } = useFieldArray({ control, name: 'items' });
    const watchedItems = useWatch({ control, name: 'items' });

    const { total, balance } = useMemo(() => {
        if (!watchedItems) return { total: 0, balance: 0 };
        const grossTotal = watchedItems.reduce((sum, item) => {
            const qty = Number(item.quantity) || 0;
            const price = Number(item.price) || 0;
            const gst = Number(item.gst) || 0;
            const itemBase = qty * price;
            const taxAmount = itemBase * (gst / 100);
            return sum + itemBase + taxAmount;
        }, 0);
        const depositAmount = Number(deposit) || 0;
        return { total: grossTotal, balance: grossTotal - depositAmount };
    }, [watchedItems, deposit]);

    const onSubmit = async (data: OrderFormValues) => {
        try {
            setIsLoading(true);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

            const formattedItems = data.items.map(item => ({
                name: item.name,
                quantity: Number(item.quantity),
                price: Number(item.price || 0),
                gst: Number(item.gst || 0)
            }));

            await dataService.updateOrder(id as string, {
                items: formattedItems,
                totalAmount: total,
                deposit: Number(data.deposit) || 0
            });

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert('Success', 'Order updated successfully');
            router.back();
        } catch (error: any) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert('Error', 'Failed to update order');
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    if (fetching) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={theme.primary} />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <View style={[styles.header, { borderBottomColor: theme.border }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={[styles.title, { color: theme.text }]}>Edit Order</Text>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <Text style={[styles.sectionLabel, { color: theme.textSecondary, marginTop: 16 }]}>Items & Price</Text>
                {fields.map((field, index) => (
                    <View key={field.id} style={[styles.itemRow, { borderColor: theme.border, backgroundColor: theme.surface }]}>
                        <View style={{ flex: 2, marginRight: 8 }}>
                            <Input
                                label={index === 0 ? "Item" : ""}
                                name={`items.${index}.name`}
                                control={control}
                                placeholder="Item name"
                                error={errors.items?.[index]?.name?.message}
                            />
                        </View>
                        <View style={{ flex: 1, marginRight: 8 }}>
                            <Input
                                label={index === 0 ? "Price ₹" : ""}
                                name={`items.${index}.price`}
                                control={control}
                                placeholder="0"
                                keyboardType="numeric"
                                error={errors.items?.[index]?.price?.message}
                            />
                        </View>
                        <View style={{ width: 50, marginRight: 8 }}>
                            <Input
                                label={index === 0 ? "GST%" : ""}
                                name={`items.${index}.gst`}
                                control={control}
                                placeholder="0"
                                keyboardType="numeric"
                            />
                        </View>
                        <View style={{ width: 55 }}>
                            <Input
                                label={index === 0 ? "Qty" : ""}
                                name={`items.${index}.quantity`}
                                control={control}
                                placeholder="1"
                                keyboardType="numeric"
                                error={errors.items?.[index]?.quantity?.message}
                            />
                        </View>
                        {index > 0 && (
                            <TouchableOpacity onPress={() => remove(index)} style={styles.removeBtn}>
                                <Ionicons name="close-circle" size={24} color={theme.error} />
                            </TouchableOpacity>
                        )}
                    </View>
                ))}

                <Button
                    title="+ Add Item"
                    variant="secondary"
                    onPress={() => append({ name: '', quantity: '1', price: '0', gst: '0' })}
                    style={{ marginBottom: 16 }}
                />

                {/* Deposit */}
                <View style={{ marginTop: 8 }}>
                    <Input
                        label="Deposit / Advance (₹)"
                        name="deposit"
                        control={control}
                        placeholder="0"
                        keyboardType="numeric"
                    />
                </View>

                {/* Totals */}
                <View style={[styles.totalRow, { backgroundColor: theme.primary + '20', borderColor: theme.primary, flexDirection: 'column', alignItems: 'stretch', gap: 8 }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={[styles.totalLabel, { color: theme.text }]}>Grand Total</Text>
                        <Text style={[styles.totalValue, { color: theme.primary }]}>₹{Math.round(total).toLocaleString()}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: theme.primary + '40', paddingTop: 8 }}>
                        <Text style={[styles.totalLabel, { color: theme.textSecondary, fontSize: 14 }]}>Deposit</Text>
                        <Text style={[styles.totalValue, { color: theme.textSecondary, fontSize: 18 }]}>- ₹{Number(deposit || 0).toLocaleString()}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 2, borderTopColor: theme.primary, paddingTop: 8 }}>
                        <Text style={[styles.totalLabel, { color: theme.text }]}>Balance Due</Text>
                        <Text style={[styles.totalValue, { color: theme.error }]}>₹{Math.round(balance).toLocaleString()}</Text>
                    </View>
                </View>

                <Button
                    title="Save Changes"
                    onPress={handleSubmit(onSubmit)}
                    isLoading={isLoading}
                    style={{ marginTop: 24 }}
                />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1 },
    backButton: { marginRight: 16 },
    title: { fontSize: 20, fontWeight: 'bold' },
    content: { padding: 20, paddingBottom: 40 },
    sectionLabel: { fontSize: 12, fontWeight: '600', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
    itemRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12, padding: 12, borderRadius: 12, borderWidth: 1 },
    removeBtn: { marginTop: 28, marginLeft: 4 },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderRadius: 12, borderWidth: 1, marginTop: 16 },
    totalLabel: { fontSize: 16, fontWeight: '600' },
    totalValue: { fontSize: 24, fontWeight: 'bold' },
});
