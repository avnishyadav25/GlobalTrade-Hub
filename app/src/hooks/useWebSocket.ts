'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

export type WebSocketStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

interface UseWebSocketOptions {
    url: string;
    onMessage?: (data: unknown) => void;
    onConnect?: () => void;
    onDisconnect?: () => void;
    onError?: (error: Event) => void;
    autoReconnect?: boolean;
    reconnectInterval?: number;
    maxReconnectAttempts?: number;
}

interface UseWebSocketReturn {
    status: WebSocketStatus;
    send: (data: unknown) => void;
    connect: () => void;
    disconnect: () => void;
    reconnectAttempts: number;
}

export function useWebSocket({
    url,
    onMessage,
    onConnect,
    onDisconnect,
    onError,
    autoReconnect = true,
    reconnectInterval = 3000,
    maxReconnectAttempts = 10,
}: UseWebSocketOptions): UseWebSocketReturn {
    const [status, setStatus] = useState<WebSocketStatus>('disconnected');
    const [reconnectAttempts, setReconnectAttempts] = useState(0);

    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const messageQueueRef = useRef<unknown[]>([]);

    const clearReconnectTimeout = useCallback(() => {
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }
    }, []);

    const connect = useCallback(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            return;
        }

        clearReconnectTimeout();
        setStatus('connecting');

        try {
            const ws = new WebSocket(url);

            ws.onopen = () => {
                setStatus('connected');
                setReconnectAttempts(0);
                onConnect?.();

                // Flush message queue
                while (messageQueueRef.current.length > 0) {
                    const msg = messageQueueRef.current.shift();
                    ws.send(JSON.stringify(msg));
                }
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    onMessage?.(data);
                } catch {
                    onMessage?.(event.data);
                }
            };

            ws.onerror = (error) => {
                onError?.(error);
            };

            ws.onclose = () => {
                setStatus('disconnected');
                onDisconnect?.();
                wsRef.current = null;

                // Auto-reconnect with exponential backoff
                if (autoReconnect && reconnectAttempts < maxReconnectAttempts) {
                    setStatus('reconnecting');
                    const delay = Math.min(
                        reconnectInterval * Math.pow(2, reconnectAttempts),
                        30000 // Max 30 seconds
                    );

                    reconnectTimeoutRef.current = setTimeout(() => {
                        setReconnectAttempts((prev) => prev + 1);
                        connect();
                    }, delay);
                }
            };

            wsRef.current = ws;
        } catch (error) {
            console.error('WebSocket connection error:', error);
            setStatus('disconnected');
        }
    }, [url, onMessage, onConnect, onDisconnect, onError, autoReconnect, reconnectInterval, maxReconnectAttempts, reconnectAttempts, clearReconnectTimeout]);

    const disconnect = useCallback(() => {
        clearReconnectTimeout();
        setReconnectAttempts(maxReconnectAttempts); // Prevent auto-reconnect

        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }

        setStatus('disconnected');
    }, [clearReconnectTimeout, maxReconnectAttempts]);

    const send = useCallback((data: unknown) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(data));
        } else {
            // Queue message for later
            messageQueueRef.current.push(data);
        }
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            clearReconnectTimeout();
            if (wsRef.current) {
                wsRef.current.close();
            }
        };
    }, [clearReconnectTimeout]);

    return {
        status,
        send,
        connect,
        disconnect,
        reconnectAttempts,
    };
}
