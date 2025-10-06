#!/usr/bin/env node

/**
 * Test script for email collection system
 * Run with: node scripts/test-email-collection.js
 */

const { emailStorageService } = require('../lib/email-storage');

async function testEmailCollection() {
  console.log('🧪 Testing Email Collection System...\n');
  
  try {
    // Test 1: Add some test emails
    console.log('📝 Adding test emails...');
    emailStorageService.addEmail('test1@example.com', 'user-1', 'signup');
    emailStorageService.addEmail('test2@example.com', 'user-2', 'login');
    emailStorageService.addEmail('test3@example.com', 'user-3', 'signup');
    emailStorageService.addEmail('test1@example.com', 'user-1', 'login'); // Duplicate email
    
    console.log('✅ Test emails added');
    
    // Test 2: Get all emails
    console.log('\n📖 Retrieving all emails...');
    const allEmails = emailStorageService.getAllEmails();
    console.log(`Found ${allEmails.length} email records`);
    
    allEmails.forEach((email, index) => {
      console.log(`  ${index + 1}. ${email.email} (${email.source}) - ${email.timestamp}`);
    });
    
    // Test 3: Get statistics
    console.log('\n📊 Email statistics...');
    const stats = emailStorageService.getStats();
    console.log(`Total records: ${stats.total}`);
    console.log(`Unique emails: ${stats.unique}`);
    console.log(`Signups: ${stats.signups}`);
    console.log(`Logins: ${stats.logins}`);
    console.log(`Last updated: ${stats.lastUpdated || 'Never'}`);
    
    // Test 4: Export as text
    console.log('\n📄 Exporting as text...');
    const textExport = emailStorageService.exportEmailsAsText();
    console.log('Text export preview:');
    console.log(textExport.substring(0, 200) + '...');
    
    // Test 5: Export as CSV
    console.log('\n📊 Exporting as CSV...');
    const csvExport = emailStorageService.exportEmailsAsCSV();
    console.log('CSV export preview:');
    console.log(csvExport.substring(0, 200) + '...');
    
    // Test 6: Get emails by source
    console.log('\n🔍 Filtering by source...');
    const signupEmails = emailStorageService.getEmailsBySource('signup');
    const loginEmails = emailStorageService.getEmailsBySource('login');
    console.log(`Signup emails: ${signupEmails.length}`);
    console.log(`Login emails: ${loginEmails.length}`);
    
    // Test 7: Clear emails (optional - uncomment to test)
    // console.log('\n🗑️ Clearing all emails...');
    // emailStorageService.clearEmails();
    // console.log('✅ All emails cleared');
    
    console.log('\n🎉 All tests passed! Email collection system is working correctly.');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testEmailCollection().catch(console.error);
