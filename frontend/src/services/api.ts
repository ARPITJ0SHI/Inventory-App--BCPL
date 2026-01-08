import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

// Get API URL - Use Local for Dev, Production for Build
const PROD_URL = Constants.expoConfig?.extra?.apiUrl;
const DEV_URL = 'http://192.168.1.13:5000/api'; // Your local IP

const API_URL = __DEV__ ? DEV_URL : (PROD_URL || DEV_URL);

const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
    timeout: 30000, // 30 second timeout for large image uploads
});

api.interceptors.request.use(
    async (config) => {
        const token = await SecureStore.getItemAsync('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        if (error.response?.status === 401) {
            await SecureStore.deleteItemAsync('token');
            await SecureStore.deleteItemAsync('role');
            // Check if we can trigger a navigation or valid state change here
            // For now, removing the token ensures the next app load (or auth check) redirects to login.
        }
        return Promise.reject(error);
    }
);

export default api;
