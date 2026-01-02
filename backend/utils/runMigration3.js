/**
 * poi_id를 SERIAL로 변경
 */

import fs from 'fs';
import pool from './database.js';

async function runMigration() {
  console.log('🔧 poi_id SERIAL 변환 시작\n');

  try {
    // 마이그레이션 SQL 읽기
    const sql = fs.readFileSync('backend/db/migrations/003_fix_poi_id_serial.sql', 'utf-8');

    // SQL 실행
    await pool.query(sql);

    console.log('✅ poi_id SERIAL 변환 완료!');
    console.log('   - 시퀀스 생성됨');
    console.log('   - poi_id 자동 증가 설정됨\n');

  } catch (error) {
    console.error('❌ 마이그레이션 에러:', error.message);
  } finally {
    await pool.end();
  }
}

runMigration();
