export type StaffRole = 'owner' | 'manager' | 'staff';
export interface StaffProfile { user_id: string; role: string; is_active: boolean; display_name: string | null }
export function recognisedRole(value: string): value is StaffRole {
  return ['owner', 'manager', 'staff'].includes(value);
}
export function needsMfa(role: StaffRole) { return role === 'owner' || role === 'manager'; }
export function canEnter(profile: StaffProfile | null): profile is StaffProfile & { role: StaffRole } {
  return !!profile && profile.is_active && recognisedRole(profile.role);
}
export function hasRecentTotp(amr: unknown, nowSeconds = Date.now() / 1000): boolean {
  return Array.isArray(amr) && amr.some(item => item && item.method === 'totp'
    && typeof item.timestamp === 'number' && item.timestamp <= nowSeconds + 30 && item.timestamp >= nowSeconds - 600);
}
export function validEmail(value: string) { return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value); }
export function validPassword(value: string) { return value.length >= 12 && value.length <= 128; }

export function validUuid(value: string) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value); }
