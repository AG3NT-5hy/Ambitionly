#!/usr/bin/env node

/**
 * Test script to verify tRPC email routes are working
 */

// Using built-in fetch (Node.js 18+)

async function testTRPCEmails() {
  console.log('🧪 Testing tRPC Email Routes...\n');
  
  try {
    // Test the tRPC endpoint
    const baseUrl = 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/trpc/admin.emails.get`);
    
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ tRPC response received:');
      console.log(JSON.stringify(data, null, 2));
    } else {
      const text = await response.text();
      console.log('❌ tRPC response error:');
      console.log(text);
    }
    
  } catch (error) {
    console.error('❌ Error testing tRPC routes:', error);
    console.log('\nMake sure the development server is running with: npm start');
  }
}

testTRPCEmails();
