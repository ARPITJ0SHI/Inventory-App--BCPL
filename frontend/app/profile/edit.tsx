import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../src/constants/Colors';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Input } from '../../src/components/Input';
import { Button } from '../../src/components/Button';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '../../src/context/AuthContext';

const profileSchema = z.object({
    username: z.string().min(3, "Username must be at least 3 chars"),
    password: z.string().min(6, "Password must be at least 6 chars").optional().or(z.literal('')),
});

type ProfileFormData = z.infer<typeof profileSchema>;

export default function EditProfileScreen() {
    const router = useRouter();
    const colorScheme = 'light';
    const theme = Colors[colorScheme];
    const { role } = useAuth();
    const [isLoading, setIsLoading] = useState(false);

    const { control, handleSubmit, formState: { errors } } = useForm<ProfileFormData>({
        resolver: zodResolver(profileSchema),
        defaultValues: {
            username: '', // Should load current user? For now just update.
            password: '',
        },
    });

    const onSubmit = async (data: ProfileFormData) => {
        setIsLoading(true);
        // Simulate API call
        setTimeout(() => {
            setIsLoading(false);
            Alert.alert("Success", "Profile updated successfully (Simulated)");
            router.back();
        }, 1000);
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={[styles.title, { color: theme.text }]}>Edit Profile</Text>
            </View>
            <View style={styles.content}>
                <Input
                    label="Username"
                    name="username"
                    control={control}
                    placeholder="New Username"
                    error={errors.username?.message}
                />

                <Input
                    label="New Password"
                    name="password"
                    control={control}
                    placeholder="Leave blank to keep current"
                    secureTextEntry
                    error={errors.password?.message}
                />

                <Button
                    title="Save Changes"
                    onPress={handleSubmit(onSubmit)}
                    isLoading={isLoading}
                    style={{ marginTop: 24 }}
                />
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
    backButton: { marginRight: 16 },
    title: { fontSize: 20, fontWeight: 'bold' },
    content: { padding: 20 },
});
