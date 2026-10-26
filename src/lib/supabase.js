import { createClient } from "@supabase/supabase-js"

const supabaseUrl = "https://rmkszfhwqxomrcowesiu.supabase.co"
const supabaseKey = "sb_publishable_q_WpcapWnJ0vwC7W1HP6Mg_9T4UC9Lu"

export const supabase = createClient(
  supabaseUrl,
  supabaseKey
)