import type { Metadata } from 'next';
import { StaffSessionProvider } from '@/lib/auth/client-session';

export const metadata: Metadata = { title: 'Staff access | Sohan Automobile', robots: { index: false, follow: false } };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <StaffSessionProvider>{children}</StaffSessionProvider>;
}
