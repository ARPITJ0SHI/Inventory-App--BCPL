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
}

export interface StockItem {
    _id: string;
    productName: string;
    quantity: number;
    unit?: string;
    location: string;
}

export interface OrderItem {
    name: string;
    quantity: number;
    price: number;
    unit?: string;
}

export interface OrderImage {
    data: string;
    contentType: string;
    name: string;
}

export interface Order {
    _id: string;
    items: OrderItem[];
    totalAmount: number;
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
    getPriceList: async (page: number = 1, limit: number = 50) => {
        const cacheKey = `pricelist_${page}_${limit}`;
        const cached = cache.get<{ data: PriceItem[]; pagination: any }>(cacheKey);
        if (cached) return cached;

        const response = await api.get(`/pricelist?page=${page}&limit=${limit}`);
        cache.set(cacheKey, response.data);
        return response.data; // { data: PriceItem[], pagination: {...} }
    },

    createPrice: async (data: { productName: string; price: number; category?: string }) => {
        const response = await api.post('/pricelist', data);
        cache.invalidate('pricelist');
        return response.data;
    },

    updatePrice: async (id: string, data: { productName: string; price: number; category?: string }) => {
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
    getStock: async (page: number = 1, limit: number = 20) => {
        const cacheKey = `stock_${page}_${limit}`;
        const cached = cache.get<{ data: StockItem[]; pagination: any }>(cacheKey);
        if (cached) return cached;

        const response = await api.get(`/stock?page=${page}&limit=${limit}`);

        // Flatten nested structure: [ { location, items: [...] } ] -> StockItem[]
        let result: StockItem[] = [];
        const rawData = response.data.data || response.data; // Handle paginated or raw

        if (Array.isArray(rawData) && rawData.length > 0 && 'items' in rawData[0]) {
            rawData.forEach((doc: any) => {
                doc.items.forEach((item: any) => {
                    result.push({
                        _id: item._id || Math.random().toString(),
                        productName: item.name,
                        quantity: item.quantity,
                        unit: item.unit || 'kg',
                        location: doc.location
                    });
                });
            });
        } else {
            result = rawData;
        }

        const finalResponse = {
            data: result,
            pagination: response.data.pagination || { page: 1, limit: 20, total: result.length, pages: 1, hasMore: false }
        };

        cache.set(cacheKey, finalResponse);
        return finalResponse;
    },

    updateStock: async (location: string, itemName: string, quantity: number, unit?: string) => {
        const response = await api.post('/stock/update', { location, itemName, quantity, unit });
        cache.invalidate('stock');
        return response.data;
    },

    deleteStockItem: async (location: string, itemName: string) => {
        const response = await api.delete(`/stock/${location}/${itemName}`);
        cache.invalidate('stock');
        return response.data;
    },

    // Orders
    getOrders: async (page: number = 1, limit: number = 20) => {
        const cacheKey = `orders_${page}_${limit}`;
        const cached = cache.get<{ data: Order[]; pagination: any }>(cacheKey);
        if (cached) return cached;

        const response = await api.get(`/orders?page=${page}&limit=${limit}`);
        cache.set(cacheKey, response.data);
        return response.data; // { data: Order[], pagination: {...} }
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
