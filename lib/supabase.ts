import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ykkfaflwzoynhmtmtiwp.supabase.co';
const supabaseAnonKey = 'sb_publishable_KtbuH_IVWVzTqSOqwFAgKw_5rqzpfUt';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);