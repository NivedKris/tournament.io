import { supabaseAdmin } from './lib/supabase';

async function main() {
  // Let's check if there is an rpc function we can query or if we can get database info
  const { data, error } = await supabaseAdmin
    .from('nations')
    .select('*')
    .limit(1);
  console.log('Nations sample:', data);
}
main();
