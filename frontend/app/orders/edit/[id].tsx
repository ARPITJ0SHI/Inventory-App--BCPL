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
    })).min(1, 'Add at least one item'),
});

type OrderFormValues = z.infer<typeof orderSchema>;

export default function EditOrderScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const { theme: themeMode } = useTheme();
    const theme = Colors[themeMode];
    const [isLoading, setIsLoading] = useState(false);
    const [fetching, setFetching] = useState(true);

    const { control, handleSubmit, setValue, reset, formState: { errors } } = useForm<OrderFormValues>({
        resolver: zodResolver(orderSchema),
        defaultValues: {
            items: [{ name: '', quantity: '1', price: '0' }],
        },
    });

    // Fetch initial data
    useEffect(() => {
        const load = async () => {
            try {
                const order = await dataService.getOrder(id as string);
                const initItems = order.items.map((i: any) => ({
                    name: i.name,
                    quantity: String(i.quantity),
                    price: String(i.price)
                }));
                reset({ items: initItems });
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

    const total = useMemo(() => {
        if (!watchedItems) return 0;
        return watchedItems.reduce((sum, item) => {
            const qty = Number(item.quantity) || 0;
            const price = Number(item.price) || 0;
            return sum + (qty * price);
        }, 0);
    }, [watchedItems]);

    const onSubmit = async (data: OrderFormValues) => {
        try {
            setIsLoading(true);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

            const formattedItems = data.items.map(item => ({
                name: item.name,
                quantity: Number(item.quantity),
                price: Number(item.price || 0)
            }));

            // Only update items and totalAmount, keep images/location same
            await dataService.updateOrder(id as string, {
                items: formattedItems,
                totalAmount: total
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
                        <View style={{ width: 60 }}>
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
                    onPress={() => append({ name: '', quantity: '1', price: '0' })}
                    style={{ marginBottom: 16 }}
                />

                <View style={[styles.totalRow, { backgroundColor: theme.primary + '20', borderColor: theme.primary }]}>
                    <Text style={[styles.totalLabel, { color: theme.text }]}>Total Amount</Text>
                    <Text style={[styles.totalValue, { color: theme.primary }]}>₹{total.toLocaleString()}</Text>
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
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1
    },
    backButton: { marginRight: 16 },
    title: { fontSize: 20, fontWeight: 'bold' },
    content: { padding: 20, paddingBottom: 40 },
    sectionLabel: {
        fontSize: 12,
        fontWeight: '600',
        marginBottom: 8,
        textTransform: 'uppercase',
        letterSpacing: 0.5
    },
    itemRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 12,
        padding: 12,
        borderRadius: 12,
        borderWidth: 1
    },
    removeBtn: { marginTop: 28, marginLeft: 4 },
    totalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
    },
    totalLabel: { fontSize: 16, fontWeight: '600' },
    totalValue: { fontSize: 24, fontWeight: 'bold' },
});
