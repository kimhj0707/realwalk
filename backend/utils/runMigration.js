/**
 * POI 테이블 마이그레이션 실행
 */

import fs from 'fs';
import pool from './database.js';

async function runMigration() {
  console.log('🔧 POI 테이블 마이그레이션 시작\n');

  try {
    // 마이그레이션 SQL 읽기
    const sql = fs.readFileSync('backend/db/migrations/001_add_poi_columns.sql', 'utf-8');

    // SQL 실행
    await pool.query(sql);

    console.log('✅ 마이그레이션 완료!');
    console.log('   - data_source 컬럼 추가');
    console.log('   - kakao_id 컬럼 추가');
    console.log('   - 기타 메타데이터 컬럼 추가');
    console.log('   - 인덱스 생성 완료\n');

  } catch (error) {
    console.error('❌ 마이그레이션 에러:', error.message);
  } finally {
    await pool.end();
  }
}

runMigration();
