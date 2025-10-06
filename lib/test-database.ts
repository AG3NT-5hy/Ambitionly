import { prisma } from '@/lib/prisma';

export async function testDatabaseConnection() {
  try {
    console.log('[Database Test] Testing database connection...');
    
    // Test creating a user
    const testUser = await prisma.user.create({
      data: {
        deviceId: 'test_device_123',
        goal: 'Test goal',
        timeline: '3 months',
        timeCommitment: '1 hour daily',
      },
    });
    
    console.log('[Database Test] User created:', testUser.id);
    
    // Test reading the user
    const retrievedUser = await prisma.user.findUnique({
      where: { deviceId: 'test_device_123' },
    });
    
    console.log('[Database Test] User retrieved:', retrievedUser?.id);
    
    // Test updating the user
    const updatedUser = await prisma.user.update({
      where: { deviceId: 'test_device_123' },
      data: {
        goal: 'Updated test goal',
      },
    });
    
    console.log('[Database Test] User updated:', updatedUser.goal);
    
    // Clean up test data
    await prisma.user.delete({
      where: { deviceId: 'test_device_123' },
    });
    
    console.log('[Database Test] Test data cleaned up');
    console.log('[Database Test] ✅ Database connection test passed!');
    
    return true;
  } catch (error) {
    console.error('[Database Test] ❌ Database connection test failed:', error);
    return false;
  }
}