import { useAuth } from '../context/AuthContext';

export enum Role {
    SUPER_ADMIN = 'super_admin',
    KHUSHAL = 'khushal',  // Manager role - full access like super_admin but read-only users
    FACTORY_MANAGER = 'factory_manager',
    SHOP_MANAGER = 'shop_manager',
}

export type LocationType = 'Shop' | 'Factory';

export const useRBAC = () => {
    const { role } = useAuth();

    const hasPermission = (allowedRoles: string[]) => {
        if (!role) return false;
        return allowedRoles.includes(role);
    };

    // Stock permissions - super_admin and khushal can edit all, managers only their location
    // When called without location (for FAB visibility), return true if user has ANY edit permission
    const canEditStock = (location?: LocationType) => {
        if (!role) return false;
        if (role === Role.SUPER_ADMIN || role === Role.KHUSHAL) return true;
        if (role === Role.FACTORY_MANAGER) return location === undefined || location === 'Factory';
        if (role === Role.SHOP_MANAGER) return location === undefined || location === 'Shop';
        return false;
    };

    const canViewStock = (location: LocationType) => {
        if (!role) return false;
        if (role === Role.SUPER_ADMIN || role === Role.KHUSHAL) return true;
        if (role === Role.FACTORY_MANAGER && location === 'Factory') return true;
        if (role === Role.SHOP_MANAGER && location === 'Shop') return true;
        return false;
    };

    // Order permissions
    // When called without location (for FAB visibility), return true if user has ANY edit permission
    const canEditOrders = (location?: LocationType) => {
        if (!role) return false;
        if (role === Role.SUPER_ADMIN || role === Role.KHUSHAL) return true;
        if (role === Role.FACTORY_MANAGER) return location === undefined || location === 'Factory';
        if (role === Role.SHOP_MANAGER) return location === undefined || location === 'Shop';
        return false;
    };

    const canUpdateOrderStatus = (location?: LocationType) => {
        return canEditOrders(location);
    };

    // Price list - only super_admin and khushal can edit
    const canEditPrices = () => {
        return role === Role.SUPER_ADMIN || role === Role.KHUSHAL;
    };

    const canViewPriceList = () => {
        // Everyone can view price list
        return true;
    };

    // User management - super_admin full CRUD, khushal read-only
    const canManageUsers = () => {
        return role === Role.SUPER_ADMIN;
    };

    const canViewUsers = () => {
        return role === Role.SUPER_ADMIN || role === Role.KHUSHAL;
    };

    // Get allowed locations for current user
    const getAllowedLocations = (): LocationType[] => {
        if (role === Role.SUPER_ADMIN || role === Role.KHUSHAL) {
            return ['Shop', 'Factory'];
        }
        if (role === Role.FACTORY_MANAGER) return ['Factory'];
        if (role === Role.SHOP_MANAGER) return ['Shop'];
        return [];
    };

    return {
        role,
        hasPermission,
        canViewStock,
        canEditStock,
        canEditOrders,
        canUpdateOrderStatus,
        canEditPrices,
        canViewPriceList,
        canManageUsers,
        canViewUsers,
        getAllowedLocations,
        Role,
    };
};
