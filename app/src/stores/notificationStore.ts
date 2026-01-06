import { create } from 'zustand';
import { toast } from 'sonner';

export type NotificationType = 'success' | 'error' | 'warning' | 'info' | 'order';

export interface Notification {
    id: string;
    type: NotificationType;
    title: string;
    message?: string;
    timestamp: number;
    read: boolean;
    data?: Record<string, unknown>;
}

interface NotificationState {
    notifications: Notification[];
    soundEnabled: boolean;

    // Actions
    addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
    markAsRead: (id: string) => void;
    markAllAsRead: () => void;
    removeNotification: (id: string) => void;
    clearAll: () => void;
    toggleSound: () => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
    notifications: [],
    soundEnabled: true,

    addNotification: (notification) => {
        const id = `notif-${Date.now()}-${Math.random().toString(36).substring(7)}`;
        const newNotification: Notification = {
            ...notification,
            id,
            timestamp: Date.now(),
            read: false,
        };

        set((state) => ({
            notifications: [newNotification, ...state.notifications.slice(0, 99)],
        }));

        // Show toast based on type
        const toastOptions = {
            id,
            description: notification.message,
        };

        switch (notification.type) {
            case 'success':
                toast.success(notification.title, toastOptions);
                break;
            case 'error':
                toast.error(notification.title, toastOptions);
                break;
            case 'warning':
                toast.warning(notification.title, toastOptions);
                break;
            case 'order':
                toast(notification.title, {
                    ...toastOptions,
                    icon: '📊',
                });
                break;
            default:
                toast.info(notification.title, toastOptions);
        }

        // Play sound if enabled
        if (get().soundEnabled) {
            playNotificationSound(notification.type);
        }
    },

    markAsRead: (id) =>
        set((state) => ({
            notifications: state.notifications.map((n) =>
                n.id === id ? { ...n, read: true } : n
            ),
        })),

    markAllAsRead: () =>
        set((state) => ({
            notifications: state.notifications.map((n) => ({ ...n, read: true })),
        })),

    removeNotification: (id) =>
        set((state) => ({
            notifications: state.notifications.filter((n) => n.id !== id),
        })),

    clearAll: () => set({ notifications: [] }),

    toggleSound: () => set((state) => ({ soundEnabled: !state.soundEnabled })),
}));

// Sound effects (using Web Audio API)
function playNotificationSound(type: NotificationType) {
    if (typeof window === 'undefined') return;

    try {
        const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        // Different sounds for different notification types
        switch (type) {
            case 'success':
            case 'order':
                oscillator.frequency.value = 880; // A5
                gainNode.gain.value = 0.1;
                break;
            case 'error':
                oscillator.frequency.value = 220; // A3
                gainNode.gain.value = 0.15;
                break;
            case 'warning':
                oscillator.frequency.value = 440; // A4
                gainNode.gain.value = 0.1;
                break;
            default:
                oscillator.frequency.value = 660; // E5
                gainNode.gain.value = 0.08;
        }

        oscillator.type = 'sine';
        oscillator.start();

        // Fade out
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
        oscillator.stop(audioContext.currentTime + 0.15);
    } catch {
        // Audio API not available
    }
}

// Helper functions for common notifications
export function notifyOrderFilled(symbol: string, side: 'buy' | 'sell', quantity: number, price: number) {
    useNotificationStore.getState().addNotification({
        type: 'order',
        title: `Order Filled: ${side.toUpperCase()} ${symbol}`,
        message: `${quantity} @ $${price.toFixed(2)}`,
        data: { symbol, side, quantity, price },
    });
}

export function notifyOrderCancelled(symbol: string, orderId: string) {
    useNotificationStore.getState().addNotification({
        type: 'warning',
        title: `Order Cancelled: ${symbol}`,
        message: `Order ID: ${orderId}`,
    });
}

export function notifyPriceAlert(symbol: string, price: number, condition: 'above' | 'below') {
    useNotificationStore.getState().addNotification({
        type: 'info',
        title: `Price Alert: ${symbol}`,
        message: `Price is now ${condition} $${price.toFixed(2)}`,
        data: { symbol, price, condition },
    });
}

export function notifyError(title: string, message?: string) {
    useNotificationStore.getState().addNotification({
        type: 'error',
        title,
        message,
    });
}

export function notifySuccess(title: string, message?: string) {
    useNotificationStore.getState().addNotification({
        type: 'success',
        title,
        message,
    });
}
