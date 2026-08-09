'use client';

// Stores broker connection METADATA only (never secrets — those go to the server).

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Connection {
    id: string;
    brokerId: string;
    label: string;
    mode: 'paper' | 'live';
    status: 'connected' | 'disconnected' | 'error';
    createdAt: number;
}

interface ConnectionsStore {
    connections: Connection[];
    add: (c: Omit<Connection, 'id' | 'createdAt'>) => void;
    remove: (id: string) => void;
    setStatus: (id: string, status: Connection['status']) => void;
}

export const useConnectionsStore = create<ConnectionsStore>()(
    persist(
        (set) => ({
            connections: [],
            add: (c) =>
                set((s) => ({
                    connections: [
                        { ...c, id: `conn-${Date.now()}`, createdAt: Date.now() },
                        ...s.connections,
                    ],
                })),
            remove: (id) => set((s) => ({ connections: s.connections.filter((c) => c.id !== id) })),
            setStatus: (id, status) =>
                set((s) => ({ connections: s.connections.map((c) => (c.id === id ? { ...c, status } : c)) })),
        }),
        { name: 'gth-connections' }
    )
);
