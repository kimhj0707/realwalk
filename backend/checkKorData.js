import { query, closePool } from './utils/database.js';

async function checkKorData() {
  console.log('🔍 kor 스키마 데이터 확인 중...\n');

  try {
    // bldg 테이블 확인
    console.log('=== 🏢 BLDG 테이블 ===');
    const bldgCount = await query('SELECT COUNT(*) as count FROM kor.bldg');
    console.log(`총 ${bldgCount.rows[0].count}개 건물\n`);

    const bldgColumns = await query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'kor' AND table_name = 'bldg'
      ORDER BY ordinal_position;
    `);
    console.log('컬럼 목록:');
    bldgColumns.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type}`);
    });

    const bldgSample = await query('SELECT * FROM kor.bldg LIMIT 2');
    console.log('\n샘플 데이터:');
    console.log(JSON.stringify(bldgSample.rows, null, 2));

    // poi 테이블 확인
    console.log('\n\n=== 📍 POI 테이블 ===');
    const poiCount = await query('SELECT COUNT(*) as count FROM kor.poi');
    console.log(`총 ${poiCount.rows[0].count}개 POI\n`);

    const poiColumns = await query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'kor' AND table_name = 'poi'
      ORDER BY ordinal_position;
    `);
    console.log('컬럼 목록:');
    poiColumns.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type}`);
    });

    const poiSample = await query('SELECT * FROM kor.poi LIMIT 2');
    console.log('\n샘플 데이터:');
    console.log(JSON.stringify(poiSample.rows, null, 2));

    // 금천구 데이터 확인
    console.log('\n\n=== 🌍 지역별 데이터 ===');
    const bldgRegion = await query(`
      SELECT DISTINCT sig_nm, COUNT(*) as count
      FROM kor.bldg
      GROUP BY sig_nm
      ORDER BY count DESC
      LIMIT 10;
    `);
    console.log('건물 지역별 분포:');
    bldgRegion.rows.forEach(row => {
      console.log(`  - ${row.sig_nm}: ${row.count}개`);
    });

  } catch (error) {
    console.error('❌ 에러:', error.message);
    console.error(error);
  } finally {
    await closePool();
  }
}

checkKorData();
