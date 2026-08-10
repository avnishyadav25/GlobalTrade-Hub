'use client';

import { useEffect } from 'react';
import { startCloudSync } from '@/lib/cloudSync';

// Headless: hydrates + persists client stores to Supabase when configured.
export function CloudSync() {
    useEffect(() => startCloudSync(), []);
    return null;
}
