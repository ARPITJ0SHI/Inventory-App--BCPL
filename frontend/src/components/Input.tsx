import React from 'react';
import { View, TextInput, Text, StyleSheet, TextInputProps } from 'react-native';
import { Colors } from '../constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { Controller, Control, FieldValues, Path } from 'react-hook-form';
import { useTheme } from '../context/ThemeContext';

interface InputProps<T extends FieldValues> extends TextInputProps {
    label: string;
    name: Path<T>;
    control: Control<T>;
    error?: string;
    icon?: keyof typeof Ionicons.glyphMap;
    secureTextEntry?: boolean;
}

export function Input<T extends FieldValues>({
    label,
    name,
    control,
    error,
    icon,
    secureTextEntry,
    ...props
}: InputProps<T>) {
    const [isPasswordVisible, setIsPasswordVisible] = React.useState(!secureTextEntry);
    const { theme: themeMode } = useTheme();
    const theme = Colors[themeMode];

    return (
        <View style={styles.container}>
            <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
            <Controller
                control={control}
                name={name}
                render={({ field: { onChange, onBlur, value } }) => (
                    <View style={[styles.inputContainer, { borderColor: error ? theme.error : theme.border, backgroundColor: theme.surface }]}>
                        {icon && <Ionicons name={icon} size={20} color={theme.textSecondary} style={styles.icon} />}
                        <TextInput
                            style={[styles.input, { color: theme.text }]}
                            placeholderTextColor={theme.textSecondary}
                            onBlur={onBlur}
                            onChangeText={onChange}
                            value={value}
                            secureTextEntry={secureTextEntry && !isPasswordVisible}
                            {...props}
                        />
                        {secureTextEntry && (
                            <Ionicons
                                name={isPasswordVisible ? 'eye-off' : 'eye'}
                                size={20}
                                color={theme.textSecondary}
                                onPress={() => setIsPasswordVisible(!isPasswordVisible)}
                                style={styles.eyeIcon}
                            />
                        )}
                    </View>
                )}
            />
            {error && <Text style={[styles.errorText, { color: theme.error }]}>{error}</Text>}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: 16,
    },
    label: {
        fontSize: 14,
        fontWeight: '500',
        marginBottom: 8,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 48,
    },
    icon: {
        marginRight: 8,
    },
    input: {
        flex: 1,
        height: '100%',
        fontSize: 16,
    },
    eyeIcon: {
        marginLeft: 8,
    },
    errorText: {
        fontSize: 12,
        marginTop: 4,
    },
});
