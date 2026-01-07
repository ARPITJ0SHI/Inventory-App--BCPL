import api from './api';

export const authService = {
    login: async (data: any) => {
        const response = await api.post('/auth/login', data);
        return response.data;
    },
    register: async (data: any) => {
        const response = await api.post('/auth/register', data);
        return response.data;
    },
};
