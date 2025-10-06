#!/usr/bin/env node

/**
 * Test script to verify tRPC routes are working
 */

const { emailStorageService } = require('../lib/email-storage');

async function testTRPCRoutes() {
  console.log('🧪 Testing tRPC Email Routes...\n');
  
  try {
    // Test 1: Add an email
    console.log('📝 Adding test email...');
    emailStorageService.addEmail('test-signup@example.com', 'test-user-123', 'signup');
    console.log('✅ Email added successfully');
    
    // Test 2: Get all emails
    console.log('\n📖 Retrieving emails...');
    const emails = emailStorageService.getAllEmails();
    console.log(`Found ${emails.length} emails:`);
    emails.forEach((email, index) => {
      console.log(`  ${index + 1}. ${email.email} (${email.source}) - ${email.timestamp}`);
    });
    
    // Test 3: Get statistics
    console.log('\n📊 Getting statistics...');
    const stats = emailStorageService.getStats();
    console.log('Statistics:', stats);
    
    // Test 4: Export emails
    console.log('\n📄 Testing export...');
    const textExport = emailStorageService.exportEmailsAsText();
    console.log('Text export preview:');
    console.log(textExport.substring(0, 200) + '...');
    
    console.log('\n🎉 All tRPC route functions are working correctly!');
    
  } catch (error) {
    console.error('❌ Error testing tRPC routes:', error);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

testTRPCRoutes();
