import { supabaseAdmin } from './lib/supabase';

async function test() {
  const email = 'nithupd@gmail.com';
  console.log('--- USERS ---');
  const { data: users } = await supabaseAdmin
    .from('users')
    .select('*')
    .ilike('email', email);
  console.log(JSON.stringify(users, null, 2));

  if (users && users.length > 0) {
    const userId = users[0].id;
    console.log('--- MEMBERSHIPS ---');
    const { data: memberships } = await supabaseAdmin
      .from('tenant_memberships')
      .select('*, tenants(*)')
      .eq('user_id', userId);
    console.log(JSON.stringify(memberships, null, 2));
  }

  console.log('--- INVITATIONS ---');
  const { data: invitations } = await supabaseAdmin
    .from('tenant_invitations')
    .select('*, tenants(*)')
    .ilike('email', email);
  console.log(JSON.stringify(invitations, null, 2));
}

test().catch(console.error);
