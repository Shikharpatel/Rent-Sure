const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting Rent-Sure Application...\n');

// Start the Backend Server
const backend = spawn('node', ['index.js'], { 
  cwd: path.join(__dirname, 'backend'), 
  shell: true, 
  stdio: 'inherit' 
});

// Start the Frontend React Development Server
const frontend = spawn('npm', ['run', 'dev'], { 
  cwd: path.join(__dirname, 'frontend'), 
  shell: true, 
  stdio: 'inherit' 
});

backend.on('error', (err) => console.error('❌ Failed to start backend:', err));
frontend.on('error', (err) => console.error('❌ Failed to start frontend:', err));

// Graceful shutdown
const handleExit = () => {
  console.log('\n🛑 Shutting down servers...');
  backend.kill('SIGINT');
  frontend.kill('SIGINT');
  process.exit();
};

process.on('SIGINT', handleExit);
process.on('SIGTERM', handleExit);
