/**
 * Check Supabase Settings
 * 
 * This script helps verify your Supabase configuration and settings
 */

import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://lryrcmdfhahaddzbeuzn.supabase.co';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxyeXJjbWRmaGFoYWRkemJldXpuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI2ODI4OTIsImV4cCI6MjA3ODI1ODg5Mn0.miUENWlC9h-eF--GSJmt_FabuQqC4s_gUrQ3ZviLjjM';

console.log('='.repeat(60));
console.log('🔍 Supabase Configuration Check');
console.log('='.repeat(60));
console.log('');

console.log('📋 Configuration:');
console.log(`   URL: ${SUPABASE_URL}`);
console.log(`   Anon Key: ${SUPABASE_ANON_KEY.substring(0, 30)}...`);
console.log('');

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
});

async function checkConnection() {
  console.log('1️⃣  Testing Database Connection...');
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, email, username, created_at')
      .limit(5);
    
    if (error) {
      console.log('   ❌ Connection failed:', error.message);
      return false;
    }
    
    console.log(`   ✅ Connected! Found ${data?.length || 0} users in database`);
    
    if (data && data.length > 0) {
      console.log('');
      console.log('   Sample users:');
      data.forEach((user, i) => {
        console.log(`   ${i + 1}. ${user.username || 'N/A'} (${user.email || 'N/A'})`);
      });
    }
    
    console.log('');
    return true;
  } catch (error: any) {
    console.log('   ❌ Error:', error.message);
    return false;
  }
}

async function testAuthFlow() {
  console.log('2️⃣  Testing Authentication Flow...');
  
  const testEmail = `test-${Date.now()}@example.com`;
  const testPassword = 'TestPassword123!';
  const testUsername = `testuser${Date.now()}`;
  
  try {
    // Test signup
    console.log(`   📝 Creating test user: ${testEmail}`);
    const { data: signupData, error: signupError } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
      options: {
        data: { username: testUsername },
      },
    });
    
    if (signupError) {
      console.log('   ❌ Signup failed:', signupError.message);
      return false;
    }
    
    if (!signupData.user) {
      console.log('   ❌ No user returned from signup');
      return false;
    }
    
    console.log(`   ✅ User created with ID: ${signupData.user.id}`);
    
    // Check if session was created
    if (signupData.session) {
      console.log('   ✅ Session created immediately');
      console.log('   ℹ️  Email confirmation is DISABLED (recommended for development)');
    } else {
      console.log('   ⚠️  No session created');
      console.log('   ℹ️  Email confirmation is ENABLED');
    }
    
    console.log('');
    
    // Test immediate login
    console.log('   🔐 Testing immediate login...');
    const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });
    
    if (loginError) {
      if (loginError.message.includes('Email not confirmed')) {
        console.log('   ⚠️  Login blocked: Email confirmation required');
        console.log('');
        console.log('   📧 EMAIL CONFIRMATION IS ENABLED');
        console.log('');
        console.log('   To disable (recommended for development):');
        console.log('   1. Go to: https://supabase.com/dashboard');
        console.log('   2. Select your project');
        console.log('   3. Navigate to: Authentication → Providers → Email');
        console.log('   4. Find "Confirm email" and toggle it OFF');
        console.log('   5. Save changes');
        console.log('');
      } else {
        console.log('   ❌ Login failed:', loginError.message);
      }
      
      // Clean up
      await supabase.auth.signOut();
      return false;
    }
    
    console.log('   ✅ Login successful!');
    console.log('   ✅ Email confirmation is DISABLED');
    console.log('');
    
    // Clean up
    await supabase.auth.signOut();
    
    return true;
  } catch (error: any) {
    console.log('   ❌ Test failed:', error.message);
    return false;
  }
}

async function checkExistingUsers() {
  console.log('3️⃣  Checking for Existing Auth Users...');
  
  try {
    // We can't list auth users with anon key
    // But we can check if the current session has a user
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session?.user) {
      console.log(`   ✅ Found active session for: ${session.user.email}`);
      console.log(`   User ID: ${session.user.id}`);
    } else {
      console.log('   ℹ️  No active session');
    }
    
    console.log('');
    
    // Check users table
    const { data, error } = await supabase
      .from('users')
      .select('email, username, created_at')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (error) {
      console.log('   ❌ Could not fetch users:', error.message);
      return false;
    }
    
    if (!data || data.length === 0) {
      console.log('   ℹ️  No users found in database');
      console.log('   💡 This is normal for a new project');
      console.log('');
      return true;
    }
    
    console.log(`   Found ${data.length} users in database:`);
    data.forEach((user, i) => {
      const date = new Date(user.created_at).toLocaleString();
      console.log(`   ${i + 1}. ${user.username || 'N/A'} (${user.email || 'N/A'}) - Created: ${date}`);
    });
    
    console.log('');
    return true;
  } catch (error: any) {
    console.log('   ❌ Error:', error.message);
    return false;
  }
}

async function printSummary(connectionOk: boolean, authOk: boolean) {
  console.log('='.repeat(60));
  console.log('📊 Summary');
  console.log('='.repeat(60));
  console.log('');
  
  if (connectionOk && authOk) {
    console.log('✅ Everything looks good!');
    console.log('');
    console.log('💡 Next steps:');
    console.log('   1. Make sure your server is running (doAnCoSo4.1.server)');
    console.log('   2. Try signing up in the app');
    console.log('   3. Check console logs for any errors');
    console.log('   4. After signup, try logging in');
    console.log('');
  } else if (!connectionOk) {
    console.log('❌ Database connection failed');
    console.log('');
    console.log('🔧 Troubleshooting:');
    console.log('   1. Check your EXPO_PUBLIC_SUPABASE_URL in .env');
    console.log('   2. Check your EXPO_PUBLIC_SUPABASE_ANON_KEY in .env');
    console.log('   3. Verify your Supabase project is active');
    console.log('   4. Check if your IP is allowed in Supabase settings');
    console.log('');
  } else if (!authOk) {
    console.log('⚠️  Authentication has issues');
    console.log('');
    console.log('🔧 Most likely: Email confirmation is enabled');
    console.log('   Solution: Disable it in Supabase Dashboard (see instructions above)');
    console.log('');
  }
  
  console.log('📚 For more help:');
  console.log('   - Read: AUTHENTICATION_GUIDE.md');
  console.log('   - Read: QUICK_FIX_LOGIN.md');
  console.log('   - Dashboard: https://supabase.com/dashboard');
  console.log('');
}

async function main() {
  const connectionOk = await checkConnection();
  
  if (!connectionOk) {
    await printSummary(false, false);
    process.exit(1);
  }
  
  const authOk = await testAuthFlow();
  await checkExistingUsers();
  await printSummary(connectionOk, authOk);
}

main().catch((error) => {
  console.error('');
  console.error('❌ Fatal error:', error.message);
  console.error('');
  process.exit(1);
});
