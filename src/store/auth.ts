import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { reportError } from '@/lib/diagnostics';
import type { Profile } from '@/types';

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  ready: boolean;
  profileReady: boolean;
  init: () => void;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}
let authSubscription: { unsubscribe: () => void } | null = null;
let profileRequest = 0;

async function loadProfile(uid: string, requestId: number, set: (partial: Partial<AuthState>) => void, get: () => AuthState) {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle();
  if (requestId !== profileRequest || get().user?.id !== uid) return;
  if (error) reportError('Profil illisible', error);
  set({ profile: (data as Profile | null) ?? null, profileReady: true });
}

export const useAuth = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  profile: null,
  ready: false,
  profileReady: false,
  init: () => {
    if (authSubscription) return;
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      const previousUid = get().user?.id;
      const uid = session?.user.id ?? null;
      if (!session) {
        profileRequest += 1;
        set({ session: null, user: null, profile: null, ready: true, profileReady: true });
        return;
      }

      const shouldLoadProfile = event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'USER_UPDATED' || previousUid !== uid;
      set({
        session,
        user: session.user,
        ready: true,
        ...(shouldLoadProfile ? { profile: null, profileReady: false } : {}),
      });

      // Auth callbacks run under the SDK's auth lock; defer Supabase queries until the callback returns.
      if (shouldLoadProfile) {
        const requestId = ++profileRequest;
        setTimeout(() => void loadProfile(session.user.id, requestId, set, get), 0);
      }
      // TOKEN_REFRESHED updates the session above without refetching an unchanged profile.
    });
    authSubscription = data.subscription;
  },
  refreshProfile: async () => {
    const uid = get().user?.id;
    if (!uid) {
      profileRequest += 1;
      set({ profile: null, profileReady: true });
      return;
    }
    const requestId = ++profileRequest;
    set({ profileReady: false });
    await loadProfile(uid, requestId, set, get);
  },
  signOut: async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    set({ session: null, user: null, profile: null });
  },
}));
