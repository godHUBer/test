import { absoluteOrigin } from './model';
export function inventoryConfig() {
  const mode = process.env.PUBLIC_INVENTORY_MODE ?? 'snapshot';
  if (mode==='snapshot') return { mode:'snapshot' } as const;
  if (mode!=='supabase') return { mode:'error' } as const;
  const url=absoluteOrigin(process.env.PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL);
  const key=process.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return { mode:'error' } as const;
  if (key.startsWith('eyJ')) {
    try { if (JSON.parse(Buffer.from(key.split('.')[1]??'','base64url').toString()).role!=='anon') return {mode:'error'} as const; } catch { return {mode:'error'} as const; }
  } else if (!key.startsWith('sb_publishable_')) return {mode:'error'} as const;
  return { mode:'supabase', url, key } as const;
}
