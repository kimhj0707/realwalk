/**
 * kakao_id UNIQUE 제약조건 추가
 */

import fs from 'fs';
import pool from './database.js';

async function runMigration() {
  console.log('🔧 kakao_id UNIQUE 제약조건 추가\n');

  try {
    // 마이그레이션 SQL 읽기
    const sql = fs.readFileSync('backend/db/migrations/002_add_kakao_id_unique.sql', 'utf-8');

    // SQL 실행
    await pool.query(sql);

    console.log('✅ 제약조건 추가 완료!');
    console.log('   - kakao_id UNIQUE 제약조건 추가됨');
    console.log('   - 중복 데이터 제거됨\n');

  } catch (error) {
    console.error('❌ 마이그레이션 에러:', error.message);
  } finally {
    await pool.end();
  }
}

runMigration();
