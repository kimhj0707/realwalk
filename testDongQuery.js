/**
 * 동 정보 조회 테스트
 */

import pool from './backend/utils/database.js';

async function testDongQuery() {
  try {
    const lat = 37.4570656519531;
    const lng = 126.896036850324;

    console.log('🧪 동 조회 테스트');
    console.log(`좌표: ${lat}, ${lng}\n`);

    // 1. 모든 동 목록
    console.log('1. 등록된 동 목록:');
    const allDongs = await pool.query('SELECT dong_nm, emd_cd FROM KOR.DONG');
    allDongs.rows.forEach(dong => {
      console.log(`   - ${dong.dong_nm} (${dong.emd_cd})`);
    });

    // 2. Point-in-Polygon 검색
    console.log(`\n2. 좌표로 동 검색 (${lat}, ${lng}):`);
    const query = `
      SELECT
        dong_nm,
        emd_cd,
        full_nm,
        ST_Contains(geom, ST_SetSRID(ST_MakePoint($2, $1), 4326)) as contains
      FROM KOR.DONG;
    `;
    const result = await pool.query(query, [lat, lng]);

    console.log('   결과:');
    result.rows.forEach(dong => {
      console.log(`   - ${dong.dong_nm}: ${dong.contains}`);
    });

    // 3. 실제 findDongByCoordinates 함수 테스트
    console.log('\n3. findDongByCoordinates 함수 테스트:');
    const dongQuery = `
      SELECT
        dong_id,
        emd_cd,
        dong_nm,
        dong_eng_nm,
        full_nm
      FROM KOR.DONG
      WHERE ST_Contains(
        geom,
        ST_SetSRID(ST_MakePoint($2, $1), 4326)
      )
      LIMIT 1;
    `;
    const dongResult = await pool.query(dongQuery, [lat, lng]);

    if (dongResult.rows.length > 0) {
      console.log(`   ✓ 찾음: ${dongResult.rows[0].dong_nm}`);
      console.log(`   전체 주소: ${dongResult.rows[0].full_nm}`);
    } else {
      console.log(`   ✗ 찾을 수 없음`);
    }

  } catch (error) {
    console.error('오류:', error);
  } finally {
    await pool.end();
  }
}

testDongQuery();
