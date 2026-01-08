import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform, Image } from 'react-native';
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
import { useRBAC, Role, LocationType } from '../../src/hooks/useRBAC';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';

const orderSchema = z.object({
    vendorName: z.string().min(1, "Vendor name is required"),
    location: z.enum(['Shop', 'Factory']),
    items: z.array(z.object({
        name: z.string().min(1, "Item name required"),
        quantity: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0, "Qty > 0"),
        price: z.string().refine((val) => !isNaN(Number(val)) && Number(val) >= 0, "Invalid price"),
    })).min(1, 'Add at least one item'),
});

type OrderFormValues = z.infer<typeof orderSchema>;

export default function CreateOrderScreen() {
    const router = useRouter();
    const { theme: themeMode } = useTheme();
    const theme = Colors[themeMode];
    const { role, getAllowedLocations, getWritableLocations, canEditOrders } = useRBAC();
    const allowedLocations = useMemo(() => getAllowedLocations(), [role]);
    const [isLoading, setIsLoading] = useState(false);

    // Images - order image mandatory, parchi optional
    const [orderImage, setOrderImage] = useState<string | null>(null);
    const [parchiImage, setParchiImage] = useState<string | null>(null);

    const defaultLocation = allowedLocations[0] || 'Shop';

    const { control, handleSubmit, setValue, watch, formState: { errors } } = useForm<OrderFormValues>({
        resolver: zodResolver(orderSchema),
        defaultValues: {
            vendorName: '',
            location: defaultLocation,
            items: [{ name: '', quantity: '1', price: '0' }],
        },
    });

    const currentLocation = watch('location');

    // Watch items with useWatch for reactive total calculation
    const watchedItems = useWatch({ control, name: 'items' });

    // Calculate total - updates whenever any item property changes
    const total = useMemo(() => {
        if (!watchedItems) return 0;
        return watchedItems.reduce((sum, item) => {
            const qty = Number(item.quantity) || 0;
            const price = Number(item.price) || 0;
            return sum + (qty * price);
        }, 0);
    }, [watchedItems]);

    // Camera-only image picker
    const takePhoto = useCallback(async (setImage: (uri: string) => void) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission needed', 'Camera permission is required to take photos');
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
        // Validate mandatory order image
        if (!orderImage) {
            Alert.alert('Image Required', 'Please take an order photo (mandatory).');
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
                price: Number(item.price || 0)
            }));

            formData.append('items', JSON.stringify(formattedItems));
            formData.append('totalAmount', total.toString());

            // Append Images
            const appendImage = (uri: string, fieldName: string) => {
                const filename = uri.split('/').pop();
                const match = /\.(\w+)$/.exec(filename || '');
                const type = match ? `image/${match[1]}` : `image/jpeg`;
                // @ts-ignore
                formData.append(fieldName, { uri, name: filename, type } as any);
            };

            appendImage(orderImage, 'orderImage');
            if (parchiImage) {
                appendImage(parchiImage, 'parchiImage');
            }

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

    const canSwitchLocation = role === Role.SUPER_ADMIN || role === Role.KHUSHAL;

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
                        // Use getWritableLocations - restricts managers to their own location
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

                {/* Total */}
                <View style={[styles.totalRow, { backgroundColor: theme.primary + '20', borderColor: theme.primary }]}>
                    <Text style={[styles.totalLabel, { color: theme.text }]}>Total Amount</Text>
                    <Text style={[styles.totalValue, { color: theme.primary }]}>₹{total.toLocaleString()}</Text>
                </View>

                {/* Images - Camera Only */}
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
    locationRow: { flexDirection: 'row', gap: 12 },
    locationBtn: {
        flex: 1,
        padding: 14,
        borderWidth: 1,
        alignItems: 'center',
        borderRadius: 12
    },
    disabledBtn: { opacity: 0.4 },
    locationText: { fontWeight: '600', fontSize: 14 },
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
    imageRow: { flexDirection: 'row', gap: 12 },
    imagePicker: {
        flex: 1,
        aspectRatio: 1,
        borderRadius: 12,
        overflow: 'hidden',
        borderWidth: 2,
        backgroundColor: '#f8fafc'
    },
    previewImage: { width: '100%', height: '100%' },
    placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    placeholderText: { marginTop: 8, fontSize: 12, fontWeight: '600' },
});
