
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://dyzirrckocwdnhvjksbi.supabase.co";

const supabaseKey = "sb_publishable_C-AdQdg-xTvnPwqLZmMFvQ_h7MudKxd";

export const supabase = createClient(
  supabaseUrl,
  supabaseKey
);
