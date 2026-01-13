import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Alert, TouchableOpacity, Animated } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Input } from '../../src/components/Input';
import { Button } from '../../src/components/Button';
import { Colors } from '../../src/constants/Colors';
import { authService } from '../../src/services/authService';
import { useAuth } from '../../src/context/AuthContext';
import { useTheme } from '../../src/context/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';

const loginSchema = z.object({
    username: z.string().min(1, 'Username is required'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginScreen() {
    const router = useRouter();
    const { login } = useAuth();
    const [isLoading, setIsLoading] = React.useState(false);
    const [rememberMe, setRememberMe] = React.useState(true);
    const { theme: themeMode } = useTheme();
    const theme = Colors[themeMode];

    const logoScale = useRef(new Animated.Value(0.8)).current;
    const logoOpacity = useRef(new Animated.Value(0)).current;
    const headerOpacity = useRef(new Animated.Value(0)).current;
    const headerTranslateY = useRef(new Animated.Value(20)).current;
    const formOpacity = useRef(new Animated.Value(0)).current;
    const formTranslateY = useRef(new Animated.Value(20)).current;

    useEffect(() => {
        // Logo animation
        Animated.parallel([
            Animated.spring(logoScale, { toValue: 1, friction: 8, useNativeDriver: true }),
            Animated.timing(logoOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        ]).start();

        // Header animation
        Animated.parallel([
            Animated.timing(headerOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
            Animated.timing(headerTranslateY, { toValue: 0, duration: 500, useNativeDriver: true }),
        ]).start();

        // Form animation with delay
        setTimeout(() => {
            Animated.parallel([
                Animated.timing(formOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
                Animated.timing(formTranslateY, { toValue: 0, duration: 500, useNativeDriver: true }),
            ]).start();
        }, 100);
    }, []);

    const { control, handleSubmit, formState: { errors } } = useForm<LoginFormData>({
        resolver: zodResolver(loginSchema),
        defaultValues: {
            username: '',
            password: '',
        },
    });

    const onSubmit = async (data: LoginFormData) => {
        try {
            setIsLoading(true);
            const response = await authService.login(data);
            if (response.token) {
                await login(response.token, response.role || 'viewer', rememberMe);
                router.replace('/(tabs)');
            } else {
                Alert.alert('Login Failed', 'No token received');
            }
        } catch (error: any) {
            console.error('Login Error:', error);
            const msg = error.response?.data?.message || error.message || 'Something went wrong';
            Alert.alert('Login Failed', msg);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
                    {/* Logo Area */}
                    <Animated.View
                        style={[
                            styles.logoContainer,
                            {
                                backgroundColor: theme.primary + '15',
                                opacity: logoOpacity,
                                transform: [{ scale: logoScale }]
                            }
                        ]}
                    >
                        <Ionicons name="cube" size={56} color={theme.primary} />
                    </Animated.View>

                    <Animated.View
                        style={[
                            styles.header,
                            { opacity: headerOpacity, transform: [{ translateY: headerTranslateY }] }
                        ]}
                    >
                        <Text style={[styles.title, { color: theme.text }]}>Welcome Back</Text>
                        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Sign in to manage your inventory</Text>
                    </Animated.View>

                    <Animated.View
                        style={[
                            styles.formCard,
                            {
                                backgroundColor: theme.surface,
                                borderColor: theme.border,
                                opacity: formOpacity,
                                transform: [{ translateY: formTranslateY }]
                            }
                        ]}
                    >
                        <Input
                            label="Username"
                            name="username"
                            control={control}
                            placeholder="Enter your username"
                            icon="person-outline"
                            autoCapitalize="none"
                            error={errors.username?.message}
                        />
                        <Input
                            label="Password"
                            name="password"
                            control={control}
                            placeholder="Enter your password"
                            icon="lock-closed-outline"
                            secureTextEntry
                            error={errors.password?.message}
                        />

                        <View style={styles.rememberRow}>
                            <TouchableOpacity
                                style={styles.checkboxContainer}
                                onPress={() => setRememberMe(!rememberMe)}
                                activeOpacity={0.8}
                            >
                                <View style={[styles.checkbox, { borderColor: rememberMe ? theme.primary : theme.textSecondary, backgroundColor: rememberMe ? theme.primary : 'transparent' }]}>
                                    {rememberMe && <Ionicons name="checkmark" size={14} color="#fff" />}
                                </View>
                                <Text style={[styles.rememberText, { color: theme.text }]}>Stay logged in</Text>
                            </TouchableOpacity>
                        </View>

                        <Button
                            title="Sign In"
                            onPress={handleSubmit(onSubmit)}
                            isLoading={isLoading}
                            style={styles.button}
                        />
                    </Animated.View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
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
    rememberRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    checkboxContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    checkbox: {
        width: 20,
        height: 20,
        borderRadius: 4,
        borderWidth: 2,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 8,
    },
    rememberText: {
        fontSize: 14,
    },
    logoContainer: {
        width: 100,
        height: 100,
        borderRadius: 50,
        justifyContent: 'center',
        alignItems: 'center',
        alignSelf: 'center',
        marginBottom: 24,
    },
    formCard: {
        padding: 20,
        borderRadius: 16,
        borderWidth: 1,
    },
});
