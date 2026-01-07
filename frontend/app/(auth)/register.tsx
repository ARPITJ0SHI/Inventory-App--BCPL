import React from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Input } from '../../src/components/Input';
import { Button } from '../../src/components/Button';
import { Colors } from '../../src/constants/Colors';
import { authService } from '../../src/services/authService';
import { useAuth } from '../../src/context/AuthContext';
import { MotiView } from 'moti';

const registerSchema = z.object({
    username: z.string().min(3, 'Username must be at least 3 characters'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    role: z.string().optional(), // 'admin' or 'staff', default to staff if not provided or handled by backend? 
    // Backend authRoutes.js expects role in body, default schema doesn't validate it strictly but I'll add "staff" as default hidden field if needed.
    // Actually the form doesn't show role selection, I'll default to 'staff' or let user type it?
    // Use simple registration for now.
});

type RegisterFormData = z.infer<typeof registerSchema>;

export default function RegisterScreen() {
    const router = useRouter();
    const { login } = useAuth();
    const [isLoading, setIsLoading] = React.useState(false);
    const colorScheme = 'light';
    const theme = Colors[colorScheme];

    const { control, handleSubmit, formState: { errors } } = useForm<RegisterFormData>({
        resolver: zodResolver(registerSchema),
        defaultValues: {
            username: '',
            password: '',
            role: 'staff',
        },
    });

    const onSubmit = async (data: RegisterFormData) => {
        try {
            setIsLoading(true);
            // Adding default role if not present, though defaultValues should handle it.
            const payload = { ...data, role: data.role || 'staff' };
            const response = await authService.register(payload);

            if (response.token) {
                await login(response.token, response.role || 'staff');
                // Router auto-redirects
            } else {
                Alert.alert('Registration Failed', 'No token received');
            }
        } catch (error: any) {
            const msg = error.response?.data?.message || 'Something went wrong';
            Alert.alert('Registration Failed', msg);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={[styles.container, { backgroundColor: theme.background }]}
        >
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <MotiView
                    from={{ opacity: 0, translateY: 20 }}
                    animate={{ opacity: 1, translateY: 0 }}
                    transition={{ type: 'timing', duration: 500 }}
                    style={styles.header}
                >
                    <Text style={[styles.title, { color: theme.primary }]}>Create Account</Text>
                    <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Join our inventory management system</Text>
                </MotiView>

                <MotiView
                    from={{ opacity: 0, translateY: 20 }}
                    animate={{ opacity: 1, translateY: 0 }}
                    transition={{ type: 'timing', duration: 500, delay: 100 }}
                    style={styles.form}
                >
                    <Input
                        label="Username"
                        name="username"
                        control={control}
                        placeholder="Choose a username"
                        icon="person-outline"
                        autoCapitalize="none"
                        error={errors.username?.message}
                    />
                    <Input
                        label="Password"
                        name="password"
                        control={control}
                        placeholder="Choose a password"
                        icon="lock-closed-outline"
                        secureTextEntry
                        error={errors.password?.message}
                    />

                    <Button
                        title="Sign Up"
                        onPress={handleSubmit(onSubmit)}
                        isLoading={isLoading}
                        style={styles.button}
                    />

                    <View style={styles.footer}>
                        <Text style={[styles.footerText, { color: theme.textSecondary }]}>Already have an account? </Text>
                        <Link href="/login" asChild>
                            <Text style={[styles.link, { color: theme.primary }]}>Sign In</Text>
                        </Link>
                    </View>
                </MotiView>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        padding: 24,
    },
    header: {
        marginBottom: 32,
        alignItems: 'center',
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
    },
    form: {
        width: '100%',
    },
    button: {
        marginTop: 16,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 24,
    },
    footerText: {
        fontSize: 14,
    },
    link: {
        fontSize: 14,
        fontWeight: '600',
    },
});
