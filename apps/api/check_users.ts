import { supabaseAdmin } from './src/lib/supabase';

async function check() {
  try {
    const { data: users, error } = await supabaseAdmin.from('users').select('id, display_name, username, email');
    if (error) {
      console.error('Error fetching users:', error);
    } else {
      console.log('Registered Users with emails:', users);
    }
  } catch (err) {
    console.error('Catch error:', err);
  }
}

check();
