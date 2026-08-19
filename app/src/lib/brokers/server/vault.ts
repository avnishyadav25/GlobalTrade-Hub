import 'server-only';

// Broker credential storage in Supabase Vault, via the SECURITY DEFINER wrappers in
// migration 0003 (the `vault` schema is not reachable through PostgREST).
//
// The secret NAME is always derived here from ADMIN_USER_ID + broker + mode. It must
// never come from a request body: the wrappers can read any secret by name, so an
// attacker-supplied name would turn this into an arbitrary-secret-read primitive.

import { getServiceClient } from '@/lib/supabase/server';
import type { Credentials, BrokerMode } from './types';

export function secretName(brokerId: string, mode: BrokerMode): string {
    const owner = process.env.ADMIN_USER_ID ?? 'default';
    return `gth:${owner}:${brokerId}:${mode}`;
}

export function isVaultConfigured(): boolean {
    return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export async function storeCredentials(brokerId: string, mode: BrokerMode, creds: Credentials): Promise<boolean> {
    const supabase = getServiceClient();
    if (!supabase) return false;
    const { error } = await supabase.rpc('gth_vault_store', {
        p_name: secretName(brokerId, mode),
        p_secret: JSON.stringify(creds),
    });
    if (error) {
        console.error('[vault] store failed:', error.message);
        return false;
    }
    return true;
}

export async function readCredentials(brokerId: string, mode: BrokerMode): Promise<Credentials | null> {
    const supabase = getServiceClient();
    if (!supabase) return null;
    const { data, error } = await supabase.rpc('gth_vault_read', { p_name: secretName(brokerId, mode) });
    if (error || !data) return null;
    try {
        return JSON.parse(data as string) as Credentials;
    } catch {
        return null;
    }
}

export async function deleteCredentials(brokerId: string, mode: BrokerMode): Promise<void> {
    const supabase = getServiceClient();
    if (!supabase) return;
    await supabase.rpc('gth_vault_delete', { p_name: secretName(brokerId, mode) });
}

export interface ConnectionRow {
    broker_id: string;
    label: string;
    mode: BrokerMode;
    status: string;
    account_ref: string | null;
    last_verified_at: string | null;
    last_error: string | null;
}

/** Upsert the connection metadata row. Never contains secrets. */
export async function recordConnection(row: ConnectionRow): Promise<void> {
    const supabase = getServiceClient();
    const userId = process.env.ADMIN_USER_ID;
    if (!supabase || !userId) return;
    const { error } = await supabase
        .from('gth_broker_connections')
        .upsert(
            {
                user_id: userId,
                broker_id: row.broker_id,
                label: row.label,
                mode: row.mode,
                status: row.status,
                account_ref: row.account_ref,
                last_verified_at: row.last_verified_at,
                last_error: row.last_error,
                vault_secret_name: secretName(row.broker_id, row.mode),
            },
            { onConflict: 'user_id,broker_id,mode' }
        );
    if (error) console.error('[vault] connection upsert failed:', error.message);
}

export async function listConnections(): Promise<ConnectionRow[]> {
    const supabase = getServiceClient();
    const userId = process.env.ADMIN_USER_ID;
    if (!supabase || !userId) return [];
    const { data, error } = await supabase
        .from('gth_broker_connections')
        .select('broker_id,label,mode,status,account_ref,last_verified_at,last_error')
        .eq('user_id', userId);
    if (error || !data) return [];
    return data as ConnectionRow[];
}

export async function removeConnection(brokerId: string, mode: BrokerMode): Promise<void> {
    const supabase = getServiceClient();
    const userId = process.env.ADMIN_USER_ID;
    if (!supabase || !userId) return;
    await supabase.from('gth_broker_connections').delete().eq('user_id', userId).eq('broker_id', brokerId).eq('mode', mode);
    await deleteCredentials(brokerId, mode);
}
