import { query, closePool } from './utils/database.js';

async function checkTables() {
  console.log('🔍 데이터베이스 테이블 확인 중...\n');

  try {
    // 모든 테이블 목록 조회
    const tablesResult = await query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);

    console.log('📋 테이블 목록:');
    for (const row of tablesResult.rows) {
      console.log(`   - ${row.table_name}`);

      // 각 테이블의 행 수 확인
      const countResult = await query(`SELECT COUNT(*) as count FROM "${row.table_name}"`);
      console.log(`     (${countResult.rows[0].count}개 행)\n`);
    }

    // 테이블이 있다면 첫 번째 테이블의 샘플 데이터 확인
    if (tablesResult.rows.length > 0) {
      const firstTable = tablesResult.rows[0].table_name;
      console.log(`\n📊 "${firstTable}" 테이블 샘플 데이터 (첫 3개):`);
      const sampleResult = await query(`SELECT * FROM "${firstTable}" LIMIT 3`);
      console.log(JSON.stringify(sampleResult.rows, null, 2));
    }

  } catch (error) {
    console.error('❌ 에러:', error.message);
  } finally {
    await closePool();
  }
}

checkTables();
