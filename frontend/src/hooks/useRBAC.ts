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
        // Everyone (who has a valid role) can view stock now
        // Managers can view both Shop and Factory, but can only edit their own
        return !!role;
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
        // Only super_admin and khushal can view price list
        return role === Role.SUPER_ADMIN || role === Role.KHUSHAL;
    };

    // User management - super_admin full CRUD, khushal read-only
    const canManageUsers = () => {
        return role === Role.SUPER_ADMIN;
    };

    const canViewUsers = () => {
        return role === Role.SUPER_ADMIN || role === Role.KHUSHAL;
    };

    // Get locations user can VIEW (for filters)
    const getViewableLocations = (): LocationType[] => {
        // All these roles can switch views between Shop and Factory
        if (role === Role.SUPER_ADMIN || role === Role.KHUSHAL ||
            role === Role.FACTORY_MANAGER || role === Role.SHOP_MANAGER) {
            return ['Shop', 'Factory'];
        }
        return [];
    };

    // Get locations user can WRITE to (for creating/editing)
    const getWritableLocations = (): LocationType[] => {
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
        getViewableLocations,
        getWritableLocations,
        // Backward compatibility (deprecated, alias to viewable for filters)
        getAllowedLocations: getViewableLocations,
        Role,
    };
};
