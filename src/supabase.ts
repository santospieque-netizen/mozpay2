/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Use fallbacks if env vars are missing or don't look like valid URLs
const finalUrl = (supabaseUrl && supabaseUrl.startsWith('http')) ? supabaseUrl : 'https://mvkdomgoyhgmswoqnoeg.supabase.co';
const finalKey = supabaseKey || 'sb_publishable_BgPFexqc4WcdBpxSMcLdEw_iNZynZMW';

export const supabase = createClient(finalUrl, finalKey);
