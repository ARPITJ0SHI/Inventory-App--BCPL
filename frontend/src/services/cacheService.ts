import AsyncStorage from '@react-native-async-storage/async-storage';

export const CACHE_KEYS = {
    STOCK: 'cache_stock',
    ORDERS: 'cache_orders',
    PRICELIST: 'cache_pricelist',
};

const EXPIRY_TIME = 24 * 60 * 60 * 1000; // 24 Hours (we want to show something even if old)

export const cacheService = {
    save: async (key: string, data: any) => {
        try {
            const payload = {
                timestamp: Date.now(),
                data: data,
            };
            await AsyncStorage.setItem(key, JSON.stringify(payload));
        } catch (error) {
            console.error('Cache Save Error:', error);
        }
    },

    load: async (key: string) => {
        try {
            const json = await AsyncStorage.getItem(key);
            if (!json) return null;

            const payload = JSON.parse(json);
            // Optionally check expiry here, but for "offline/cold start" mode, 
            // stale data is better than no data.
            return payload.data;
        } catch (error) {
            console.error('Cache Load Error:', error);
            return null;
        }
    },

    clear: async (key: string) => {
        try {
            await AsyncStorage.removeItem(key);
        } catch (error) {
            console.error('Cache Clear Error:', error);
        }
    }
};
