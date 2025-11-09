// Try to load the actual backend server
// First try compiled dist/server.js, then try server.ts with dynamic import
(async () => {
  const path = require('path');
  const fs = require('fs');
  
  try {
    // Try to use the compiled server from dist (ES module)
    const distServerPath = path.resolve(__dirname, 'dist', 'server.js');
    if (fs.existsSync(distServerPath)) {
      console.log('📦 Loading compiled server from dist/server.js...');
      // Use file:// URL for ES module import
      const fileUrl = 'file://' + distServerPath.replace(/\\/g, '/');
      await import(fileUrl);
      return; // Server should start automatically
    }
  } catch (distError) {
    console.log('⚠️  Could not load dist/server.js:', distError.message);
    console.log('📝 Trying to use tsx to run server.ts...');
  }
  
  try {
    // Try to use tsx to run server.ts directly
    const { execSync } = require('child_process');
    const serverTsPath = path.resolve(__dirname, 'server.ts');
    
    if (fs.existsSync(serverTsPath)) {
      console.log('📝 Running server.ts with tsx...');
      // Use execSync to run tsx (this will block, which is what we want)
      execSync(`npx tsx "${serverTsPath}"`, { 
        stdio: 'inherit',
        cwd: __dirname 
      });
      return; // This should not return if successful
    }
  } catch (tsxError) {
    console.error('❌ Could not run server.ts:', tsxError.message);
  }
  
  // Fallback: Simple health check server
  startFallbackServer();
})();

function startFallbackServer() {
  console.log('⚠️  Starting fallback server (limited functionality)');
  console.log('📝 To enable full backend, configure Render to use: npx tsx server.ts');
  
  const { serve } = require('@hono/node-server');
  const { Hono } = require('hono');
  const { cors } = require('hono/cors');
  
  const app = new Hono();
  app.use('*', cors());
  
  app.get('/', (c) => c.json({ 
    status: 'warning',
    message: 'Backend running in fallback mode',
    instruction: 'Update Render start command to: npx tsx server.ts',
    endpoints: {
      health: '/health'
    }
  }));
  
  app.get('/health', (c) => c.json({ status: 'healthy' }));
  
  const port = process.env.PORT || 3000;
  const host = process.env.HOST || '0.0.0.0';
  
  serve({
    fetch: app.fetch,
    port,
    hostname: host
  });
}

