#!/usr/bin/env node

// Database Setup Script für RadBefund+
// Erstellt die Database und führt das Schema aus

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  database: 'postgres' // Connect to default postgres database first
};

const TARGET_DB = process.env.DB_NAME || 'radbefund_plus';

async function setupDatabase() {
  console.log('🚀 Setting up RadBefund+ Database...');
  
  const client = new Client(DB_CONFIG);
  
  try {
    // Connect to postgres database
    await client.connect();
    console.log('✅ Connected to PostgreSQL');
    
    // Check if database exists
    const dbCheck = await client.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [TARGET_DB]
    );
    
    if (dbCheck.rows.length === 0) {
      // Create database
      await client.query(`CREATE DATABASE ${TARGET_DB}`);
      console.log(`✅ Database '${TARGET_DB}' created`);
    } else {
      console.log(`✅ Database '${TARGET_DB}' already exists`);
    }
    
    await client.end();
    
    // Connect to the new database
    const targetClient = new Client({
      ...DB_CONFIG,
      database: TARGET_DB
    });
    
    await targetClient.connect();
    console.log(`✅ Connected to '${TARGET_DB}' database`);
    
    // Read and execute schema
    const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    // Split schema into individual statements
    const statements = schema
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`📋 Executing ${statements.length} SQL statements...`);
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        try {
          await targetClient.query(statement);
          console.log(`✅ Statement ${i + 1}/${statements.length} executed`);
        } catch (error) {
          if (error.message.includes('already exists')) {
            console.log(`⚠️  Statement ${i + 1}/${statements.length} skipped (already exists)`);
          } else {
            console.error(`❌ Error in statement ${i + 1}:`, error.message);
            throw error;
          }
        }
      }
    }
    
    // Verify tables were created
    const tables = await targetClient.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log('\n📊 Created tables:');
    tables.rows.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });
    
    // Test basic functionality
    console.log('\n🧪 Testing database functionality...');
    
    // Test user creation
    const testUser = await targetClient.query(`
      INSERT INTO users (email, password_hash, name, organization)
      VALUES ('test@radbefund.de', crypt('test123', gen_salt('bf')), 'Test User', 'Test Org')
      RETURNING id, email, name
    `);
    
    console.log('✅ Test user created:', testUser.rows[0]);
    
    // Test layout creation
    const testLayout = await targetClient.query(`
      INSERT INTO user_layouts (user_id, name, description, template)
      VALUES ($1, 'Test Layout', 'Test Description', 'Test Template')
      RETURNING id, name
    `, [testUser.rows[0].id]);
    
    console.log('✅ Test layout created:', testLayout.rows[0]);
    
    // Clean up test data
    await targetClient.query('DELETE FROM user_layouts WHERE user_id = $1', [testUser.rows[0].id]);
    await targetClient.query('DELETE FROM users WHERE id = $1', [testUser.rows[0].id]);
    
    console.log('✅ Test data cleaned up');
    
    await targetClient.end();
    
    console.log('\n🎉 Database setup completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('1. Copy config.example.env to .env');
    console.log('2. Update database credentials in .env');
    console.log('3. Start the backend server');
    
  } catch (error) {
    console.error('❌ Database setup failed:', error);
    process.exit(1);
  }
}

// Run setup if called directly
if (require.main === module) {
  setupDatabase();
}

module.exports = { setupDatabase };
