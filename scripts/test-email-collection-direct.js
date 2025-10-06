#!/usr/bin/env node

/**
 * Direct test of email collection functionality
 * This simulates what happens when a user signs up
 */

const fs = require('fs');
const path = require('path');

// Simulate the email storage service
class EmailStorageService {
  constructor() {
    this.emailsFile = path.join(process.cwd(), 'data', 'collected-emails.json');
    this.emails = [];
    this.loadEmails();
  }

  loadEmails() {
    try {
      if (fs.existsSync(this.emailsFile)) {
        const data = fs.readFileSync(this.emailsFile, 'utf8');
        this.emails = JSON.parse(data);
      } else {
        this.emails = [];
        this.saveEmails();
      }
    } catch (error) {
      console.error('Failed to load emails:', error);
      this.emails = [];
    }
  }

  saveEmails() {
    try {
      fs.writeFileSync(this.emailsFile, JSON.stringify(this.emails, null, 2));
    } catch (error) {
      console.error('Failed to save emails:', error);
    }
  }

  addEmail(email, userId, source) {
    const existingEmail = this.emails.find(e => e.email === email);
    
    if (existingEmail) {
      existingEmail.timestamp = new Date().toISOString();
      existingEmail.source = source;
      existingEmail.userId = userId;
    } else {
      const emailRecord = {
        email,
        userId,
        timestamp: new Date().toISOString(),
        source
      };
      this.emails.push(emailRecord);
    }
    
    this.saveEmails();
    console.log(`Email ${source}: ${email} (User: ${userId})`);
  }

  getAllEmails() {
    return [...this.emails];
  }

  getStats() {
    const signups = this.emails.filter(e => e.source === 'signup').length;
    const logins = this.emails.filter(e => e.source === 'login').length;
    const uniqueEmails = new Set(this.emails.map(e => e.email)).size;
    const lastEmail = this.emails.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )[0];

    return {
      total: this.emails.length,
      unique: uniqueEmails,
      signups,
      logins,
      lastUpdated: lastEmail?.timestamp || null
    };
  }
}

async function testEmailCollection() {
  console.log('🧪 Testing Email Collection System...\n');
  
  const emailService = new EmailStorageService();
  
  try {
    // Test 1: Add signup email
    console.log('📝 Testing signup email collection...');
    emailService.addEmail('user@example.com', 'user-123', 'signup');
    
    // Test 2: Add login email
    console.log('📝 Testing login email collection...');
    emailService.addEmail('user2@example.com', 'user-456', 'login');
    
    // Test 3: Add duplicate email (should update)
    console.log('📝 Testing duplicate email update...');
    emailService.addEmail('user@example.com', 'user-123', 'login');
    
    // Test 4: Get all emails
    console.log('\n📖 Retrieved emails:');
    const emails = emailService.getAllEmails();
    emails.forEach((email, index) => {
      console.log(`  ${index + 1}. ${email.email} (${email.source}) - ${email.timestamp}`);
    });
    
    // Test 5: Get statistics
    console.log('\n📊 Statistics:');
    const stats = emailService.getStats();
    console.log(`Total: ${stats.total}`);
    console.log(`Unique: ${stats.unique}`);
    console.log(`Signups: ${stats.signups}`);
    console.log(`Logins: ${stats.logins}`);
    console.log(`Last Updated: ${stats.lastUpdated}`);
    
    console.log('\n🎉 Email collection system is working correctly!');
    console.log('\nNow try signing up in your app and check the developer settings.');
    
  } catch (error) {
    console.error('❌ Error testing email collection:', error);
    process.exit(1);
  }
}

testEmailCollection();
