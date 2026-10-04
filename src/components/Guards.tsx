import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/store/auth';
import { PageSpinner } from './ui';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  const loc = useLocation();
  if (!ready) return <PageSpinner />;
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname + loc.search }} />;
  return <>{children}</>;
}

/** Protection admin : session valide ET rôle 'admin'. Les données restent de toute façon protégées par RLS. */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, profile, ready, profileReady } = useAuth();
  if (!ready || (user && !profileReady)) return <PageSpinner />;
  if (!user) return <Navigate to="/admin/login" replace />;
  if (profile?.role !== 'admin') return <Navigate to="/" replace />;
  return <>{children}</>;
}
