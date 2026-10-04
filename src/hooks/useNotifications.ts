import { useEffect } from 'react';
import { create } from 'zustand';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { reportError } from '@/lib/diagnostics';
import { useAuth } from '@/store/auth';
import type { AppNotification } from '@/types';

/**
 * Notifications partagées par toute l'application : UNE seule requête et UN seul canal Realtime,
 * quel que soit le nombre de composants qui les affichent (cloche, liste, menu du compte…).
 * (Plusieurs canaux de même nom faisaient planter l'application — voir l'audit.)
 */
const LIMIT = 50;
interface NState {
  items: AppNotification[];
  loading: boolean;
}
const useStore = create<NState>(() => ({ items: [], loading: true }));

let subscribers = 0;
let channel: RealtimeChannel | null = null;
let who: { userId: string; isAdmin: boolean } | null = null;

async function load() {
  if (!who) return;
  const { userId, isAdmin } = who;
  let q = supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(LIMIT);
  q = isAdmin ? q.eq('audience', 'admin') : q.eq('audience', 'user').eq('user_id', userId);
  const { data, error } = await q;
  if (error) reportError('Notifications', error);
  useStore.setState({ items: (data ?? []) as AppNotification[], loading: false });
}
function start(userId: string, isAdmin: boolean) {
  who = { userId, isAdmin };
  useStore.setState({ loading: true });
  void load();
  channel = supabase
    .channel(`notif-${userId}-${isAdmin ? 'a' : 'u'}-${Math.random().toString(36).slice(2, 8)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => {
      void load();
    })
    .subscribe();
}
function stop() {
  if (channel) void supabase.removeChannel(channel);
  channel = null;
  who = null;
  useStore.setState({ items: [], loading: false });
}

export function useNotifications(limit = 30) {
  const userId = useAuth((s) => s.user?.id ?? null);
  const isAdmin = useAuth((s) => s.profile?.role === 'admin');
  const all = useStore((s) => s.items);
  const loading = useStore((s) => s.loading);
  useEffect(() => {
    if (!userId) return;
    subscribers += 1;
    if (subscribers === 1) start(userId, isAdmin);
    return () => {
      subscribers -= 1;
      if (subscribers === 0) stop();
    };
  }, [userId, isAdmin]);

  const items = all.slice(0, limit);
  const unread = all.filter((n) => !n.read_at).length;
  const markRead = async (id: string) => {
    const now = new Date().toISOString();
    useStore.setState((s) => ({ items: s.items.map((n) => (n.id === id ? { ...n, read_at: now } : n)) }));
    const { error } = await supabase.from('notifications').update({ read_at: now }).eq('id', id);
    if (error) reportError('Notification lue', error);
  };
  const markAllRead = async () => {
    const ids = all.filter((n) => !n.read_at).map((n) => n.id);
    if (!ids.length) return;
    const now = new Date().toISOString();
    useStore.setState((s) => ({ items: s.items.map((n) => ({ ...n, read_at: n.read_at ?? now })) }));
    const { error } = await supabase.from('notifications').update({ read_at: now }).in('id', ids);
    if (error) reportError('Notifications lues', error);
  };
  const remove = async (id: string) => {
    const { error } = await supabase.from('notifications').delete().eq('id', id);
    if (error) {
      reportError('Suppression notification', error);
      return false;
    }
    useStore.setState((s) => ({ items: s.items.filter((n) => n.id !== id) }));
    return true;
  };
  return { items, unread, loading: userId ? loading : false, markRead, markAllRead, remove, reload: () => load() };
}
