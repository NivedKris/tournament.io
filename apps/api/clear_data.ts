import { supabaseAdmin } from './src/lib/supabase';

async function clearData() {
  console.log('Starting database and auth cleanup...');

  try {
    // 1. Delete transactional data
    console.log('Clearing matches...');
    await supabaseAdmin.from('matches').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    console.log('Clearing squads...');
    await supabaseAdmin.from('squads').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    console.log('Clearing nation claims...');
    await supabaseAdmin.from('nation_claims').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    console.log('Clearing tournament rewards...');
    await supabaseAdmin.from('tournament_rewards').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    // 2. Fetch and delete all auth users except superadmin
    console.log('Fetching auth users...');
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) {
      throw listError;
    }

    console.log(`Found ${users.length} users in auth.`);
    for (const u of users) {
      if (u.email === 'mark.organisation@gmail.com') {
        console.log(`Preserving super admin: ${u.email}`);
        continue;
      }
      console.log(`Deleting user from auth: ${u.email} (${u.id})...`);
      const { error: delError } = await supabaseAdmin.auth.admin.deleteUser(u.id);
      if (delError) {
        console.error(`Failed to delete auth user ${u.email}:`, delError.message);
      }
    }

    // 3. Delete from public.users (in case cascade didn't catch it)
    console.log('Cleaning up remaining public profiles...');
    await supabaseAdmin.from('users').delete().neq('email', 'mark.organisation@gmail.com');

    console.log('Cleanup completed successfully!');
  } catch (err: any) {
    console.error('Error during cleanup:', err.message || err);
  }
}

clearData();
