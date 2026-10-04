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
let started = false;

export const useAuth = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  profile: null,
  ready: false,
  profileReady: false,
  init: () => {
    if (started) return;
    started = true;
    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        set({ session: data.session, user: data.session?.user ?? null });
        if (data.session) await get().refreshProfile();
        else set({ profileReady: true });
        set({ ready: true });
      })
      .catch((e) => {
        reportError('Session Supabase illisible', e);
        set({ ready: true, profileReady: true });
      });
    supabase.auth.onAuthStateChange((_event, session) => {
      set({ session, user: session?.user ?? null });
      if (session)
        setTimeout(() => {
          void get().refreshProfile();
        }, 0);
      else set({ profile: null, profileReady: true });
    });
  },
  refreshProfile: async () => {
    const uid = get().user?.id;
    if (!uid) {
      set({ profile: null, profileReady: true });
      return;
    }
    const { data, error } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle();
    if (error) reportError('Profil illisible', error);
    set({ profile: (data as Profile | null) ?? null, profileReady: true });
  },
  signOut: async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    set({ session: null, user: null, profile: null });
  },
}));
