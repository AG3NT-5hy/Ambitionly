#!/usr/bin/env node

/**
 * Test script for Supabase integration
 * Run with: node scripts/test-supabase-integration.js
 */

const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  console.error('Please set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testSupabaseConnection() {
  console.log('🧪 Testing Supabase connection...');
  
  try {
    // Test basic connection
    const { data, error } = await supabase
      .from('user_data')
      .select('count')
      .limit(1);
    
    if (error) {
      console.error('❌ Supabase connection failed:', error.message);
      return false;
    }
    
    console.log('✅ Supabase connection successful');
    return true;
  } catch (error) {
    console.error('❌ Supabase connection error:', error.message);
    return false;
  }
}

async function testUserDataOperations() {
  console.log('🧪 Testing user data operations...');
  
  const testUserId = 'test-user-' + Date.now();
  const testData = {
    goal: 'Test goal',
    timeline: '3 months',
    timeCommitment: '1 hour daily',
    answers: ['Answer 1', 'Answer 2'],
    roadmap: { phases: ['Phase 1', 'Phase 2'] },
    completedTasks: ['Task 1'],
    streakData: {
      lastCompletionDate: new Date().toISOString(),
      streak: 5
    },
    taskTimers: [{ task: 'Test task', duration: 30 }]
  };
  
  try {
    // Test insert
    console.log('  📝 Testing data insert...');
    const { error: insertError } = await supabase
      .from('user_data')
      .insert({
        user_id: testUserId,
        ...testData
      });
    
    if (insertError) {
      console.error('❌ Insert failed:', insertError.message);
      return false;
    }
    console.log('✅ Data inserted successfully');
    
    // Test select
    console.log('  📖 Testing data retrieval...');
    const { data: retrievedData, error: selectError } = await supabase
      .from('user_data')
      .select('*')
      .eq('user_id', testUserId)
      .single();
    
    if (selectError) {
      console.error('❌ Select failed:', selectError.message);
      return false;
    }
    console.log('✅ Data retrieved successfully');
    
    // Test update
    console.log('  ✏️ Testing data update...');
    const { error: updateError } = await supabase
      .from('user_data')
      .update({ goal: 'Updated test goal' })
      .eq('user_id', testUserId);
    
    if (updateError) {
      console.error('❌ Update failed:', updateError.message);
      return false;
    }
    console.log('✅ Data updated successfully');
    
    // Test delete
    console.log('  🗑️ Testing data deletion...');
    const { error: deleteError } = await supabase
      .from('user_data')
      .delete()
      .eq('user_id', testUserId);
    
    if (deleteError) {
      console.error('❌ Delete failed:', deleteError.message);
      return false;
    }
    console.log('✅ Data deleted successfully');
    
    return true;
  } catch (error) {
    console.error('❌ User data operations error:', error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Starting Supabase integration test...\n');
  
  const connectionTest = await testSupabaseConnection();
  if (!connectionTest) {
    console.log('\n❌ Connection test failed. Please check your Supabase configuration.');
    process.exit(1);
  }
  
  console.log('');
  const dataTest = await testUserDataOperations();
  if (!dataTest) {
    console.log('\n❌ Data operations test failed. Please check your Supabase table setup.');
    process.exit(1);
  }
  
  console.log('\n🎉 All tests passed! Supabase integration is working correctly.');
  console.log('\nNext steps:');
  console.log('1. Set up your environment variables');
  console.log('2. Run the SQL setup script in your Supabase dashboard');
  console.log('3. Start your development server');
  console.log('4. Test user registration and data persistence');
}

main().catch(console.error);
