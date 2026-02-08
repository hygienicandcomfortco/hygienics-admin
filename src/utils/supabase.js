import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://uhkheprfbxxwuojswyht.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVoa2hlcHJmYnh4d3VvanN3eWh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1MjQ4NTMsImV4cCI6MjA4MzEwMDg1M30.sm7ZhqVDWWckAolZN_7p3cGMaK0_aOnwgQcPXnUA-Es";

export const supabase = createClient(supabaseUrl, supabaseKey);
