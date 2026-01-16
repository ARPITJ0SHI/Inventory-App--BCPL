import api from './api';

export interface Announcement {
    _id: string;
    title: string;
    message: string;
    createdAt: string;
}

export interface PriceItem {
    _id: string;
    productName: string;
    price: number;
    unit?: string;
    category?: string;
    type: 'buying' | 'selling';
}

export interface StockItem {
    _id: string;
    productName: string;
    itemName?: string; // Backend alias
    quantity: number;
    unit?: string;
    location: string;
}

export interface OrderItem {
    name: string;
    quantity: number;
    price: number;
    unit?: string;
    gst?: number; // GST Percentage (0, 5, 12, 18, etc.)
}

export interface OrderImage {
    data: string;
    contentType: string;
    name: string;
}

export interface Order {
    _id: string;
    vendorName: string;
    items: OrderItem[];
    totalAmount: number;
    deposit?: number; // Advance Payment
    status: string;
    location: string;
    images?: OrderImage[];
    createdAt: string;
}

// Simple in-memory cache with TTL
interface CacheEntry<T> {
    data: T;
    timestamp: number;
}

class SimpleCache {
    private cache: Map<string, CacheEntry<any>> = new Map();
    private defaultTTL: number = 30000; // 30 seconds

    get<T>(key: string): T | null {
        const entry = this.cache.get(key);
        if (!entry) return null;

        if (Date.now() - entry.timestamp > this.defaultTTL) {
            this.cache.delete(key);
            return null;
        }

        return entry.data;
    }

    set<T>(key: string, data: T): void {
        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });
    }

    invalidate(pattern?: string): void {
        if (!pattern) {
            this.cache.clear();
            return;
        }

        for (const key of this.cache.keys()) {
            if (key.includes(pattern)) {
                this.cache.delete(key);
            }
        }
    }
}

const cache = new SimpleCache();

export const dataService = {
    // Announcements
    getAnnouncements: async () => {
        const cacheKey = 'announcements';
        const cached = cache.get<Announcement[]>(cacheKey);
        if (cached) return cached;

        const response = await api.get('/announcements');
        cache.set(cacheKey, response.data);
        return response.data;
    },

    createAnnouncement: async (data: { title: string; message: string }) => {
        const response = await api.post('/announcements', data);
        cache.invalidate('announcements');
        return response.data;
    },

    deleteAnnouncement: async (id: string) => {
        const response = await api.delete(`/announcements/${id}`);
        cache.invalidate('announcements');
        return response.data;
    },



    // Price List
    getPriceList: async (page: number = 1, limit: number = 50, search: string = '', sort: string = 'newest', type: string = 'selling') => {
        const cacheKey = `pricelist_${page}_${limit}_${search}_${sort}_${type}`;
        const cached = cache.get<{ data: PriceItem[]; pagination: any }>(cacheKey);
        if (cached && !search) return cached;

        const response = await api.get(`/pricelist?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}&sort=${sort}&type=${type}`);
        if (!search) cache.set(cacheKey, response.data);
        return response.data;
    },

    createPrice: async (data: { productName: string; price: number; category?: string; type: string }) => {
        const response = await api.post('/pricelist', data);
        cache.invalidate('pricelist');
        return response.data;
    },

    updatePrice: async (id: string, data: { productName: string; price: number; category?: string; type?: string }) => {
        const response = await api.patch(`/pricelist/${id}`, data);
        cache.invalidate('pricelist');
        return response.data;
    },

    deletePrice: async (id: string) => {
        const response = await api.delete(`/pricelist/${id}`);
        cache.invalidate('pricelist');
        return response.data;
    },

    // Stock
    getStock: async (page: number = 1, limit: number = 20, search: string = '', location: string = '', sort: string = 'newest') => {
        const cacheKey = `stock_${page}_${limit}_${search}_${location}_${sort}`;
        const cached = cache.get<{ data: StockItem[]; pagination: any }>(cacheKey);
        if (cached && !search) return cached;

        let url = `/stock?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}&sort=${sort}`;
        if (location) url += `&location=${encodeURIComponent(location)}`;

        const response = await api.get(url);

        const finalResponse = {
            data: response.data.data || response.data,
            pagination: response.data.pagination
        };

        if (!search && !location) cache.set(cacheKey, finalResponse);
        return finalResponse;
    },

    updateStock: async (location: string, itemName: string, quantity: number, unit?: string) => {
        const response = await api.post('/stock/update', { location, itemName, quantity, unit });
        cache.invalidate('stock');
        return response.data;
    },

    renameStockItem: async (location: string, oldItemName: string, newItemName: string) => {
        const response = await api.post('/stock/rename', { location, oldItemName, newItemName });
        cache.invalidate('stock');
        return response.data;
    },

    deleteStockItem: async (location: string, itemName: string) => {
        const response = await api.delete(`/stock/${encodeURIComponent(location)}/${encodeURIComponent(itemName)}`);
        cache.invalidate('stock');
        return response.data;
    },

    // Orders
    getOrders: async (page: number = 1, limit: number = 20, search: string = '', location: string = '', sort: string = 'newest') => {
        const cacheKey = `orders_${page}_${limit}_${search}_${location}_${sort}`;
        const cached = cache.get<{ data: Order[]; pagination: any }>(cacheKey);
        if (cached && !search && !location) return cached;

        let url = `/orders?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}&sort=${sort}`;
        if (location) url += `&location=${encodeURIComponent(location)}`;

        const response = await api.get(url);

        if (!search && !location) cache.set(cacheKey, response.data);
        return response.data;
    },

    getOrder: async (id: string) => {
        // No cache for details to ensure fresh data
        const response = await api.get(`/orders/${id}`);
        return response.data;
    },

    createOrder: async (formData: FormData) => {
        const response = await api.post('/orders', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        cache.invalidate('orders');
        return response.data;
    },

    updateOrder: async (id: string, data: any) => {
        const response = await api.patch(`/orders/${id}`, data);
        cache.invalidate('orders');
        return response.data;
    },

    deleteOrder: async (id: string) => {
        const response = await api.delete(`/orders/${id}`);
        cache.invalidate('orders');
        return response.data;
    },

    bulkDeleteOrders: async (ids: string[]) => {
        const response = await api.post('/orders/bulk-delete', { ids });
        cache.invalidate('orders');
        return response.data;
    },

    bulkDeleteStock: async (items: { location: string, itemName: string }[]) => {
        const response = await api.post('/stock/bulk-delete', { items });
        cache.invalidate('stock');
        return response.data;
    },

    // Event Subscription System
    listeners: {} as { [key: string]: Function[] },

    subscribe(event: 'stock' | 'orders' | 'pricelist', callback: Function) {
        if (!this.listeners[event]) this.listeners[event] = [];
        this.listeners[event].push(callback);
        return () => {
            this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
        };
    },

    notify(event: 'stock' | 'orders' | 'pricelist', data?: any) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(cb => cb(data));
        }
    },

    // Background Fetch (Global Poller)
    backgroundFetchAll: async () => {
        try {
            console.log('[GlobalPoller] Fetching all data...');

            // 1. Stock (Invalidate first to force fresh fetch)
            cache.invalidate('stock');
            await dataService.getStock(1, 20, '', '', 'newest');
            dataService.notify('stock');

            // 2. Orders
            cache.invalidate('orders');
            await dataService.getOrders(1, 20, '', '', 'newest');
            dataService.notify('orders');

            // 3. PriceList
            cache.invalidate('pricelist');
            await dataService.getPriceList(1, 50, '', 'newest');
            dataService.notify('pricelist');

        } catch (e) {
            console.error('[GlobalPoller] Error:', e);
        }
    },

    // Dev
    seedData: async () => {
        const response = await api.post('/seed/reset', {});
        cache.invalidate(); // Clear all caches
        return response.data;
    },

    // Utility to force refresh
    invalidateCache: (key?: string) => {
        cache.invalidate(key);
    }
};
