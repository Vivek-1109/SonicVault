import { env } from './config/env.js';
import './config/database.js';
import { runMigrations } from './db/migrate.js';
import { createAdminUser } from './services/authService.js';
import app from './app.js';

async function main(): Promise<void> {
  console.log('🎵 Sonic Vault Backend starting...');
  console.log(`   Environment: ${env.NODE_ENV}`);

  // Run database migrations
  console.log('\n📦 Running migrations...');
  runMigrations();

  // Seed admin user
  console.log('\n👤 Checking admin user...');
  await createAdminUser(env.ADMIN_EMAIL, env.ADMIN_PASSWORD);

  // Start the HTTP server
  app.listen(env.PORT, () => {
    console.log(`\n🚀 Server running on http://localhost:${env.PORT}`);
    console.log(`   Health check: http://localhost:${env.PORT}/api/health`);
    console.log(`   Admin panel:  http://localhost:${env.PORT}/admin`);
    console.log(`   API base:     http://localhost:${env.PORT}/api`);
  });
}

// Handle unhandled rejections
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
