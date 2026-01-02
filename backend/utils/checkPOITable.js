/**
 * POI 테이블 구조 확인
 */

import pool from './database.js';

async function checkTable() {
  try {
    const result = await pool.query(`
      SELECT
        column_name,
        data_type,
        column_default,
        is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'kor'
        AND table_name = 'poi'
      ORDER BY ordinal_position;
    `);

    console.log('📋 POI 테이블 구조:\n');
    result.rows.forEach(row => {
      console.log(`   ${row.column_name}`);
      console.log(`      - 타입: ${row.data_type}`);
      console.log(`      - 기본값: ${row.column_default || 'None'}`);
      console.log(`      - Nullable: ${row.is_nullable}\n`);
    });

  } catch (error) {
    console.error('❌ 에러:', error.message);
  } finally {
    await pool.end();
  }
}

checkTable();
