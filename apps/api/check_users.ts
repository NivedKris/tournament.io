import { supabaseAdmin } from './src/lib/supabase';

async function check() {
  const { data, error } = await supabaseAdmin.from('tenant_invitations').select('id');
  if (error) {
    console.error('Table check failed:', error.message);
  } else {
    console.log('Table exists! Rows:', data);
  }
}
check();
