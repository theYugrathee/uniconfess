import { db as supabaseDb } from './supabaseService';

// Export the supabase service (wrapping firebase auth)
export const db = supabaseDb;
