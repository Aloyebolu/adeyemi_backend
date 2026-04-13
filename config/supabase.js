// config/supabase.js
import fetch from "cross-fetch";
import { createClient } from "@supabase/supabase-js";


// 🔑 Polyfill fetch for Node < 18
global.fetch = fetch;

// Optional sanity log (remove later)
export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false
    }
  }
);
