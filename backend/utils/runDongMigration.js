/**
 * DONG 테이블 마이그레이션 실행
 */

import fs from 'fs';
import pool from './database.js';

async function runDongMigration() {
  console.log('🔧 DONG 테이블 마이그레이션 시작\n');

  try {
    // 마이그레이션 SQL 읽기
    const sql = fs.readFileSync('backend/db/migrations/005_create_dong_table.sql', 'utf-8');

    // SQL 실행
    await pool.query(sql);

    console.log('✅ 마이그레이션 완료!');
    console.log('   - KOR.DONG 테이블 생성');
    console.log('   - 공간 인덱스 생성 (GIST)');
    console.log('   - 동 이름/코드 인덱스 생성\n');

    // 테이블 확인
    const checkQuery = `
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'kor' AND table_name = 'dong'
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

runDongMigration();
