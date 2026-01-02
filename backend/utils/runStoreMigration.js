/**
 * STORE 테이블 마이그레이션 실행
 */

import fs from 'fs';
import pool from './database.js';

async function runStoreMigration() {
  console.log('🔧 STORE 테이블 마이그레이션 시작\n');

  try {
    // 마이그레이션 SQL 읽기
    const sql = fs.readFileSync('backend/db/migrations/004_create_store_table.sql', 'utf-8');

    // SQL 실행
    await pool.query(sql);

    console.log('✅ 마이그레이션 완료!');
    console.log('   - KOR.STORE 테이블 생성');
    console.log('   - 공간 인덱스 생성 (GIST)');
    console.log('   - 카테고리별 인덱스 생성');
    console.log('   - 동별 인덱스 생성');
    console.log('   - store_code UNIQUE 제약조건 추가\n');

    // 테이블 확인
    const checkQuery = `
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'kor' AND table_name = 'store'
      ORDER BY ordinal_position;
    `;
    const result = await pool.query(checkQuery);

    console.log('📋 테이블 컬럼 목록:');
    result.rows.forEach(row => {
      console.log(`   - ${row.column_name}: ${row.data_type}`);
    });

  } catch (error) {
    console.error('❌ 마이그레이션 에러:', error.message);
    console.error(error);
  } finally {
    await pool.end();
  }
}

runStoreMigration();
