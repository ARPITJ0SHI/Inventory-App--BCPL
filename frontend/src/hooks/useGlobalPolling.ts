import { useEffect, useRef } from 'react';
import { dataService } from '../services/dataService';

/**
 * Global Polling Hook - Runs ONCE in _layout.tsx
 * Fetches fresh data every 60 seconds for all data types
 */
export const useGlobalPolling = (intervalMs: number = 60000) => {
    const isRunning = useRef(false);

    useEffect(() => {
        // Prevent duplicate initialization
        if (isRunning.current) return;
        isRunning.current = true;

        console.log(`[GlobalPolling] Started (${intervalMs / 1000}s interval)`);

        const intervalId = setInterval(() => {
            console.log('[GlobalPolling] Tick');
            dataService.backgroundFetchAll();
        }, intervalMs);

        return () => {
            console.log('[GlobalPolling] Stopped');
            isRunning.current = false;
            clearInterval(intervalId);
        };
    }, []);  // Empty deps - run only once, ignore intervalMs changes
};
