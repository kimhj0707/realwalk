import { query, closePool } from './utils/database.js';

async function checkGeometry() {
  console.log('🔍 Geometry 컬럼 확인 중...\n');

  try {
    // geometry_columns 확인
    const geomColumns = await query('SELECT * FROM geometry_columns');
    console.log('📋 Geometry Columns:');
    console.log(JSON.stringify(geomColumns.rows, null, 2));

    // 모든 스키마의 테이블 확인
    console.log('\n📋 모든 스키마의 테이블:');
    const allTables = await query(`
      SELECT schemaname, tablename
      FROM pg_tables
      WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
      ORDER BY schemaname, tablename;
    `);
    console.log(JSON.stringify(allTables.rows, null, 2));

  } catch (error) {
    console.error('❌ 에러:', error.message);
  } finally {
    await closePool();
  }
}

checkGeometry();
