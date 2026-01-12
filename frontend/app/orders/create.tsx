import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../src/constants/Colors';
import { Input } from '../../src/components/Input';
import { Button } from '../../src/components/Button';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Ionicons } from '@expo/vector-icons';
import { dataService } from '../../src/services/dataService';
import { useTheme } from '../../src/context/ThemeContext';
import { useRBAC, Role } from '../../src/hooks/useRBAC';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';

const orderSchema = z.object({
    vendorName: z.string().min(1, "Vendor name is required"),
    location: z.enum(['Shop', 'Factory']),
    items: z.array(z.object({
        name: z.string().min(1, "Item name required"),
        quantity: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0, "Qty > 0"),
        price: z.string().refine((val) => !isNaN(Number(val)) && Number(val) >= 0, "Invalid price"),
        gst: z.string().optional(),
    })).min(1, 'Add at least one item'),
    deposit: z.string().optional(),
});

type OrderFormValues = z.infer<typeof orderSchema>;

export default function CreateOrderScreen() {
    const router = useRouter();
    const { theme: themeMode } = useTheme();
    const theme = Colors[themeMode];
    const { role, getWritableLocations } = useRBAC();

    const writableLocations = useMemo(() => getWritableLocations(), [role]);
    const defaultLocation = writableLocations[0] || 'Shop';

    const [orderImage, setOrderImage] = useState<string | null>(null);
    const [parchiImage, setParchiImage] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const { control, handleSubmit, setValue, watch, formState: { errors } } = useForm<OrderFormValues>({
        resolver: zodResolver(orderSchema),
        defaultValues: {
            vendorName: '',
            location: defaultLocation,
            items: [{ name: '', quantity: '1', price: '0', gst: '0' }],
            deposit: '0',
        },
    });

    const currentLocation = watch('location');
    const deposit = watch('deposit');
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

    const takePhoto = useCallback(async (setImage: (uri: string) => void) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission needed', 'Camera permission is required');
            return;
        }
        const result = await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.7,
        });
        if (!result.canceled) {
            setImage(result.assets[0].uri);
        }
    }, []);

    const onSubmit = async (data: OrderFormValues) => {
        if (!orderImage) {
            Alert.alert('Image Required', 'Please take an order photo.');
            return;
        }
        try {
            setIsLoading(true);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

            const formData = new FormData();
            formData.append('vendorName', data.vendorName);
            formData.append('location', data.location);

            const formattedItems = data.items.map(item => ({
                name: item.name,
                quantity: Number(item.quantity),
                price: Number(item.price || 0),
                gst: Number(item.gst || 0)
            }));

            formData.append('items', JSON.stringify(formattedItems));
            formData.append('totalAmount', total.toString());
            formData.append('deposit', (Number(data.deposit) || 0).toString());

            const appendImage = (uri: string, fieldName: string) => {
                const filename = uri.split('/').pop();
                const match = /\.(\w+)$/.exec(filename || '');
                const type = match ? `image/${match[1]}` : `image/jpeg`;
                // @ts-ignore
                formData.append(fieldName, { uri, name: filename, type } as any);
            };

            appendImage(orderImage, 'orderImage');
            if (parchiImage) appendImage(parchiImage, 'parchiImage');

            await dataService.createOrder(formData);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert('Success', 'Order created successfully');
            router.back();
        } catch (error: any) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert('Error', 'Failed to create order');
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    const { fields, append, remove } = useFieldArray({ control, name: 'items' });

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <View style={[styles.header, { borderBottomColor: theme.border }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={[styles.title, { color: theme.text }]}>Create Order</Text>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                {/* Vendor Name */}
                <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Vendor Name</Text>
                <Input
                    label=""
                    name="vendorName"
                    control={control}
                    placeholder="Enter vendor/party name"
                    error={errors.vendorName?.message}
                />

                {/* Location Selection */}
                <Text style={[styles.sectionLabel, { color: theme.textSecondary, marginTop: 16 }]}>Location</Text>
                <View style={styles.locationRow}>
                    {(['Shop', 'Factory'] as const).map((loc) => {
                        const isSelected = currentLocation === loc;
                        const writable = getWritableLocations();
                        const canSelect = writable.includes(loc);
                        return (
                            <TouchableOpacity
                                key={loc}
                                style={[
                                    styles.locationBtn,
                                    { borderColor: theme.border },
                                    isSelected && { backgroundColor: loc === 'Factory' ? theme.primary : theme.success, borderColor: 'transparent' },
                                    !canSelect && styles.disabledBtn
                                ]}
                                onPress={() => canSelect && setValue('location', loc)}
                                disabled={!canSelect}
                            >
                                <Text style={[styles.locationText, isSelected ? { color: '#fff' } : { color: theme.text }]}>
                                    {loc}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* Items */}
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

                {/* Images */}
                <Text style={[styles.sectionLabel, { color: theme.textSecondary, marginTop: 24 }]}>Photos (Camera Only)</Text>
                <View style={styles.imageRow}>
                    <TouchableOpacity
                        style={[styles.imagePicker, { borderColor: orderImage ? theme.success : theme.error }]}
                        onPress={() => takePhoto(setOrderImage)}
                    >
                        {orderImage ? (
                            <Image source={{ uri: orderImage }} style={styles.previewImage} />
                        ) : (
                            <View style={styles.placeholder}>
                                <Ionicons name="camera" size={32} color={theme.error} />
                                <Text style={[styles.placeholderText, { color: theme.error }]}>Order Photo*</Text>
                                <Text style={{ fontSize: 10, color: theme.textSecondary }}>Required</Text>
                            </View>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.imagePicker, { borderColor: theme.border }]}
                        onPress={() => takePhoto(setParchiImage)}
                    >
                        {parchiImage ? (
                            <Image source={{ uri: parchiImage }} style={styles.previewImage} />
                        ) : (
                            <View style={styles.placeholder}>
                                <Ionicons name="document-text-outline" size={32} color={theme.textSecondary} />
                                <Text style={[styles.placeholderText, { color: theme.textSecondary }]}>Parchi Photo</Text>
                                <Text style={{ fontSize: 10, color: theme.textSecondary }}>Optional</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                </View>

                <Button
                    title="Create Order"
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
    locationRow: { flexDirection: 'row', gap: 12 },
    locationBtn: { flex: 1, padding: 14, borderWidth: 1, alignItems: 'center', borderRadius: 12 },
    disabledBtn: { opacity: 0.4 },
    locationText: { fontWeight: '600', fontSize: 14 },
    itemRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12, padding: 12, borderRadius: 12, borderWidth: 1 },
    removeBtn: { marginTop: 28, marginLeft: 4 },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderRadius: 12, borderWidth: 1, marginTop: 16 },
    totalLabel: { fontSize: 16, fontWeight: '600' },
    totalValue: { fontSize: 24, fontWeight: 'bold' },
    imageRow: { flexDirection: 'row', gap: 12 },
    imagePicker: { flex: 1, aspectRatio: 1, borderRadius: 12, overflow: 'hidden', borderWidth: 2, backgroundColor: '#f8fafc' },
    previewImage: { width: '100%', height: '100%' },
    placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    placeholderText: { marginTop: 8, fontSize: 12, fontWeight: '600' },
});
