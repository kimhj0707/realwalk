/**
 * 데이터베이스 연결 테스트
 */

import pool from './database.js';

async function testDatabaseConnection() {
  console.log('🔍 데이터베이스 연결 테스트 시작...\n');

  try {
    // 1. 기본 연결 테스트
    console.log('1. PostgreSQL 연결 테스트...');
    const timeResult = await pool.query('SELECT NOW() as current_time');
    console.log(`   ✅ 연결 성공! 현재 시각: ${timeResult.rows[0].current_time}\n`);

    // 2. 건물 데이터 확인
    console.log('2. 건물 데이터 확인...');
    const bldgCount = await pool.query('SELECT COUNT(*) FROM KOR.BLDG');
    console.log(`   ✅ 건물: ${parseInt(bldgCount.rows[0].count).toLocaleString()}개\n`);

    // 3. POI 데이터 확인
    console.log('3. POI 데이터 확인...');
    const poiCount = await pool.query('SELECT COUNT(*) FROM KOR.POI');
    console.log(`   ✅ POI: ${parseInt(poiCount.rows[0].count).toLocaleString()}개\n`);

    // 4. 지하철역 데이터 확인
    console.log('4. 지하철역 데이터 확인...');
    const subwayCount = await pool.query('SELECT COUNT(*) FROM KOR.SUBWAY_STATION');
    console.log(`   ✅ 지하철역: ${parseInt(subwayCount.rows[0].count).toLocaleString()}개\n`);

    // 5. 상가 데이터 확인
    console.log('5. 상가 데이터 확인...');
    const storeCount = await pool.query('SELECT COUNT(*) FROM KOR.STORE');
    console.log(`   ✅ 상가: ${parseInt(storeCount.rows[0].count).toLocaleString()}개\n`);

    // 6. 상가 카테고리별 통계
    console.log('6. 상가 카테고리별 통계 (상위 5개):');
    const categoryStats = await pool.query(`
      SELECT category_large, COUNT(*) as count
      FROM KOR.STORE
      GROUP BY category_large
      ORDER BY count DESC
      LIMIT 5
    `);
    categoryStats.rows.forEach(row => {
      console.log(`   - ${row.category_large}: ${parseInt(row.count).toLocaleString()}개`);
    });

    console.log('\n✅ 모든 테스트 통과!\n');

  } catch (error) {
    console.error('❌ 테스트 실패:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

testDatabaseConnection();
