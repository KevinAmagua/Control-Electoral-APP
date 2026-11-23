import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://zxsqqbuffujxvnospakf.supabase.co';
export const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  'sb_publishable_8h-4Av1w5l-ftlBAE8RWCA_15nto0CB';
export const AUTH_REDIRECT_URL =
  process.env.EXPO_PUBLIC_AUTH_REDIRECT_URL ?? 'controlectoraladn://callback';

export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export function getSupabaseClient(): SupabaseClient {
  return supabase;
}

export async function getCurrentAuthUser(): Promise<{
  id: string;
  email: string | null;
} | null> {
  const { data } = await supabase.auth.getUser();
  return data.user ? { id: data.user.id, email: data.user.email ?? null } : null;
}

export async function getCurrentAuthUserId(): Promise<string | null> {
  const currentUser = await getCurrentAuthUser();
  return currentUser?.id ?? null;
}
