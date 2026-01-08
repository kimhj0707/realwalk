import fs from 'fs/promises';
import path from 'path';
import pool from '../backend/utils/database.js';

const MIGRATIONS_DIR = 'backend/db/migrations';
const MIGRATION_TABLE = 'schema_migrations';

async function runMigrations() {
  console.log('🚀 데이터베이스 마이그레이션을 시작합니다...');
  const client = await pool.connect();

  try {
    // 1. Ensure the migration tracking table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${MIGRATION_TABLE} (
        version VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log(`✅ '${MIGRATION_TABLE}' 테이블 확인/생성 완료.`);

    // 2. Get already applied migrations
    const { rows: appliedMigrations } = await client.query(`SELECT version FROM ${MIGRATION_TABLE}`);
    const appliedVersions = new Set(appliedMigrations.map(r => r.version));
    console.log(`📈 현재까지 ${appliedVersions.size}개의 마이그레이션이 적용되었습니다.`);

    // 3. Get all available migration files
    const allFiles = (await fs.readdir(MIGRATIONS_DIR))
      .filter(file => file.endsWith('.sql'))
      .sort();

    // 4. Determine which migrations to run
    const filesToRun = allFiles.filter(file => !appliedVersions.has(file));

    if (filesToRun.length === 0) {
      console.log('📂 실행할 새로운 마이그레이션 파일이 없습니다. 모든 것이 최신 상태입니다.');
      return;
    }

    console.log(`🔍 총 ${filesToRun.length}개의 새로운 마이그레이션을 실행합니다.`);

    // 5. Run the new migrations
    for (const file of filesToRun) {
      console.log(`
▶️  [${file}] 마이그레이션을 실행합니다...`);
      const filePath = path.join(MIGRATIONS_DIR, file);
      const sql = await fs.readFile(filePath, 'utf-8');

      // Execute the migration file within a transaction
      try {
        await client.query('BEGIN');
        await client.query(sql);
        // Record the migration in the tracking table
        await client.query(`INSERT INTO ${MIGRATION_TABLE} (version) VALUES ($1)`, [file]);
        await client.query('COMMIT');
        console.log(`✅ [${file}] 마이그레이션 성공 및 기록 완료.`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`❌ [${file}] 마이그레이션 중 오류가 발생하여 롤백합니다.`);
        throw err; // Stop the entire process if one migration fails
      }
    }

    console.log('\n✨ 모든 새로운 마이그레이션이 성공적으로 완료되었습니다.');

  } catch (error) {
    console.error('\n💥 마이그레이션 프로세스 중 심각한 오류가 발생했습니다:', error.message);
  } finally {
    client.release();
    await pool.end();
    console.log('🔚 데이터베이스 연결이 종료되었습니다.');
  }
}

runMigrations();