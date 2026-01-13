import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Alert, Animated } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Input } from '../../src/components/Input';
import { Button } from '../../src/components/Button';
import { Colors } from '../../src/constants/Colors';
import { authService } from '../../src/services/authService';
import { useAuth } from '../../src/context/AuthContext';

const registerSchema = z.object({
    username: z.string().min(3, 'Username must be at least 3 characters'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    role: z.string().optional(),
});

type RegisterFormData = z.infer<typeof registerSchema>;

export default function RegisterScreen() {
    const router = useRouter();
    const { login } = useAuth();
    const [isLoading, setIsLoading] = React.useState(false);
    const colorScheme = 'light';
    const theme = Colors[colorScheme];

    const headerOpacity = useRef(new Animated.Value(0)).current;
    const headerTranslateY = useRef(new Animated.Value(20)).current;
    const formOpacity = useRef(new Animated.Value(0)).current;
    const formTranslateY = useRef(new Animated.Value(20)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(headerOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
            Animated.timing(headerTranslateY, { toValue: 0, duration: 500, useNativeDriver: true }),
        ]).start();

        setTimeout(() => {
            Animated.parallel([
                Animated.timing(formOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
                Animated.timing(formTranslateY, { toValue: 0, duration: 500, useNativeDriver: true }),
            ]).start();
        }, 100);
    }, []);

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
            const payload = { ...data, role: data.role || 'staff' };
            const response = await authService.register(payload);

            if (response.token) {
                await login(response.token, response.role || 'staff');
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
                <Animated.View
                    style={[
                        styles.header,
                        { opacity: headerOpacity, transform: [{ translateY: headerTranslateY }] }
                    ]}
                >
                    <Text style={[styles.title, { color: theme.primary }]}>Create Account</Text>
                    <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Join our inventory management system</Text>
                </Animated.View>

                <Animated.View
                    style={[
                        styles.form,
                        { opacity: formOpacity, transform: [{ translateY: formTranslateY }] }
                    ]}
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
                </Animated.View>
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
