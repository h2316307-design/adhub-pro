const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://atqjaiebixuzomrfwilu.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF0cWphaWViaXh1em9tcmZ3aWx1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcxOTkxOTcsImV4cCI6MjA3Mjc3NTE5N30.OGAQFsAl1Eo1tmPZ93VZoSL5tO2FYZa_szeRvUmoj-4";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

async function main() {
  console.log('--- Attempting Sign In ---');
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'admin@example.com',
    password: 'admin123'
  });

  if (authError) {
    console.warn('Sign In Failed:', authError.message);
  } else {
    console.log('Sign In Success!');
  }

  console.log('--- Fetching Contract 1158 ---');
  const { data: contract, error: err1 } = await supabase
    .from('Contract')
    .select('*')
    .eq('Contract_Number', 1158)
    .maybeSingle();

  if (err1) console.error('Error fetching Contract:', err1);
  else console.log('Contract:', JSON.stringify(contract, null, 2));

  console.log('\n--- Fetching Paused Billboards for 1158 ---');
  const { data: paused, error: err2 } = await supabase
    .from('paused_billboards')
    .select('*')
    .eq('contract_number', 1158);

  if (err2) console.error('Error fetching Paused Billboards:', err2);
  else console.log('Paused Billboards:', JSON.stringify(paused, null, 2));

  console.log('\n--- Fetching Replacements for 1158 ---');
  const { data: replacements, error: err3 } = await supabase
    .from('paused_billboard_replacements')
    .select('*')
    .eq('contract_number', 1158);

  if (err3) console.error('Error fetching Replacements:', err3);
  else console.log('Replacements:', JSON.stringify(replacements, null, 2));
}

main();
