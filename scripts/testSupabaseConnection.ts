/**
 * Test Supabase Connection
 * 
 * This script tests the Supabase connection to help diagnose authentication issues.
 * 
 * Usage:
 *   npx ts-node scripts/testSupabaseConnection.ts
 * 
 * Or with tsx:
 *   npx tsx scripts/testSupabaseConnection.ts
 */

import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

console.log('🔍 Testing Supabase Connection...\n');
console.log('Supabase URL:', supabaseUrl);
console.log('Anon Key:', supabaseAnonKey ? `${supabaseAnonKey.substring(0, 20)}...` : 'NOT SET');
console.log('');

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase environment variables!');
  console.error('Please ensure EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY are set in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
});

async function testConnection() {
  try {
    console.log('1️⃣  Testing basic connection...');
    const { data, error } = await supabase.from('users').select('id').limit(1);
    
    if (error) {
      console.error('❌ Connection error:', error.message);
      return false;
    }
    
    console.log('✅ Successfully connected to Supabase');
    console.log(`   Found ${data?.length || 0} user(s) in database\n`);
    return true;
  } catch (err: any) {
    console.error('❌ Connection failed:', err.message);
    return false;
  }
}

async function testAuth() {
  console.log('2️⃣  Testing authentication...');
  
  // Test signup with a test user
  const testEmail = `test-${Date.now()}@example.com`;
  const testPassword = 'TestPassword123!';
  
  try {
    console.log('   Creating test user:', testEmail);
    const { data: signupData, error: signupError } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
    });
    
    if (signupError) {
      console.error('❌ Signup error:', signupError.message);
      return false;
    }
    
    console.log('✅ Test user created:', signupData.user?.id);
    
    // Try to sign in immediately
    console.log('   Testing immediate login...');
    const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });
    
    if (loginError) {
      if (loginError.message.includes('Email not confirmed')) {
        console.log('⚠️  Email confirmation is ENABLED');
        console.log('   Users must confirm their email before logging in');
        console.log('   To disable: Go to Supabase Dashboard → Authentication → Settings → Disable email confirmation\n');
      } else {
        console.error('❌ Login error:', loginError.message);
      }
      return false;
    }
    
    console.log('✅ Successfully logged in');
    console.log('✅ Email confirmation is DISABLED (good for development)\n');
    
    // Clean up - sign out
    await supabase.auth.signOut();
    
    return true;
  } catch (err: any) {
    console.error('❌ Auth test failed:', err.message);
    return false;
  }
}

async function checkEmailConfirmation() {
  console.log('3️⃣  Checking email confirmation settings...');
  console.log('   To check/change this setting:');
  console.log('   1. Go to https://supabase.com/dashboard');
  console.log('   2. Select your project');
  console.log('   3. Go to Authentication → Providers → Email');
  console.log('   4. Check "Confirm email" setting');
  console.log('');
  console.log('   For development, it\'s recommended to DISABLE email confirmation');
  console.log('   For production, you should ENABLE it\n');
}

async function main() {
  const connectionOk = await testConnection();
  
  if (!connectionOk) {
    console.log('\n❌ Connection test failed. Please check your Supabase configuration.');
    process.exit(1);
  }
  
  await testAuth();
  await checkEmailConfirmation();
  
  console.log('✅ All tests completed!\n');
  console.log('💡 Next steps:');
  console.log('   1. If email confirmation is enabled, disable it for development');
  console.log('   2. Try signing up in the app');
  console.log('   3. Check the console logs for any errors');
  console.log('   4. If signup succeeds, try logging in');
  console.log('');
}

main().catch(console.error);
