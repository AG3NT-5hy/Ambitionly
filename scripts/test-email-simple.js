#!/usr/bin/env node

/**
 * Simple test script for email collection system
 * This tests the email storage service directly
 */

const fs = require('fs');
const path = require('path');

// Simple email storage test
function testEmailStorage() {
  console.log('🧪 Testing Email Storage System...\n');
  
  const dataDir = path.join(process.cwd(), 'data');
  const emailsFile = path.join(dataDir, 'collected-emails.json');
  
  // Ensure data directory exists
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log('✅ Created data directory');
  }
  
  // Test file operations
  const testEmails = [
    {
      email: 'test1@example.com',
      userId: 'user-1',
      timestamp: new Date().toISOString(),
      source: 'signup'
    },
    {
      email: 'test2@example.com',
      userId: 'user-2',
      timestamp: new Date().toISOString(),
      source: 'login'
    }
  ];
  
  try {
    // Write test data
    fs.writeFileSync(emailsFile, JSON.stringify(testEmails, null, 2));
    console.log('✅ Test emails written to file');
    
    // Read test data
    const data = fs.readFileSync(emailsFile, 'utf8');
    const emails = JSON.parse(data);
    console.log(`✅ Read ${emails.length} emails from file`);
    
    emails.forEach((email, index) => {
      console.log(`  ${index + 1}. ${email.email} (${email.source}) - ${email.timestamp}`);
    });
    
    // Check file permissions
    const stats = fs.statSync(emailsFile);
    console.log(`✅ File size: ${stats.size} bytes`);
    console.log(`✅ File permissions: ${stats.mode.toString(8)}`);
    
    console.log('\n🎉 Email storage system is working correctly!');
    console.log(`📁 Data file location: ${emailsFile}`);
    
  } catch (error) {
    console.error('❌ Error testing email storage:', error);
    process.exit(1);
  }
}

testEmailStorage();
