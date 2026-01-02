import pool from './backend/utils/database.js';

async function testChickenPOI() {
  try {
    console.log('=== 보드람치킨 POI 테이블 조회 ===\n');

    // 1. "보드람치킨" 이름으로 직접 검색
    const exactNameQuery = `
      SELECT
        poi_id,
        poi_nm as name,
        ctgry_group_nm as category,
        ST_X(poi_geom::geometry) as lng,
        ST_Y(poi_geom::geometry) as lat
      FROM kor.poi
      WHERE poi_nm LIKE '%보드람치킨%'
      LIMIT 10;
    `;
    const exactResult = await pool.query(exactNameQuery);
    console.log(`📍 "보드람치킨" 이름으로 검색 결과: ${exactResult.rows.length}개`);
    exactResult.rows.forEach((row, idx) => {
      console.log(`  ${idx + 1}. ${row.name} | 카테고리: ${row.category} | 좌표: (${row.lat}, ${row.lng})`);
    });
    console.log('');

    // 2. "치킨" 키워드 + "음식점" 카테고리로 검색 (경쟁업체 필터링 로직과 동일)
    const filterQuery = `
      SELECT
        poi_id,
        poi_nm as name,
        ctgry_group_nm as category,
        ST_X(poi_geom::geometry) as lng,
        ST_Y(poi_geom::geometry) as lat
      FROM kor.poi
      WHERE ctgry_group_nm LIKE '%음식%'
        AND (poi_nm LIKE '%치킨%' OR poi_nm LIKE '%닭%')
      LIMIT 20;
    `;
    const filterResult = await pool.query(filterQuery);
    console.log(`🍗 "음식" 카테고리 + "치킨/닭" 키워드 검색 결과: ${filterResult.rows.length}개`);
    filterResult.rows.forEach((row, idx) => {
      console.log(`  ${idx + 1}. ${row.name} | 카테고리: ${row.category} | 좌표: (${row.lat}, ${row.lng})`);
    });
    console.log('');

    // 3. 보드람치킨 주소 근처 (시흥대로120길 39)의 POI 조회
    // 금천구 시흥대로120길 39 좌표: 대략 37.4555, 126.8964
    const nearbyQuery = `
      SELECT
        poi_id,
        poi_nm as name,
        ctgry_group_nm as category,
        ST_X(poi_geom::geometry) as lng,
        ST_Y(poi_geom::geometry) as lat,
        ST_Distance(
          poi_geom::geography,
          ST_SetSRID(ST_MakePoint(126.8964, 37.4555), 4326)::geography
        ) as distance
      FROM kor.poi
      WHERE ST_DWithin(
        poi_geom::geography,
        ST_SetSRID(ST_MakePoint(126.8964, 37.4555), 4326)::geography,
        100
      )
      ORDER BY distance
      LIMIT 10;
    `;
    const nearbyResult = await pool.query(nearbyQuery);
    console.log(`📍 시흥대로120길 39 근처 100m 이내 POI: ${nearbyResult.rows.length}개`);
    nearbyResult.rows.forEach((row, idx) => {
      console.log(`  ${idx + 1}. ${row.name} | 카테고리: ${row.category} | 거리: ${Math.round(row.distance)}m`);
    });
    console.log('');

    // 4. POI 테이블의 카테고리별 분포
    const categoryQuery = `
      SELECT
        ctgry_group_nm as category,
        COUNT(*) as count
      FROM kor.poi
      GROUP BY ctgry_group_nm
      ORDER BY count DESC
      LIMIT 15;
    `;
    const categoryResult = await pool.query(categoryQuery);
    console.log(`📊 POI 카테고리 분포 (상위 15개):`);
    categoryResult.rows.forEach((row, idx) => {
      console.log(`  ${idx + 1}. ${row.category}: ${row.count}개`);
    });
    console.log('');

    // 5. STORE 테이블에서 "보드람치킨" 검색 (비교)
    const storeQuery = `
      SELECT
        store_id,
        store_nm as name,
        category_large,
        category_medium,
        category_small,
        address_road,
        ST_X(geom) as lng,
        ST_Y(geom) as lat
      FROM kor.store
      WHERE store_nm LIKE '%보드람치킨%'
      LIMIT 10;
    `;
    const storeResult = await pool.query(storeQuery);
    console.log(`🏪 STORE 테이블에서 "보드람치킨" 검색 결과: ${storeResult.rows.length}개`);
    storeResult.rows.forEach((row, idx) => {
      console.log(`  ${idx + 1}. ${row.name}`);
      console.log(`     카테고리: ${row.category_large} > ${row.category_medium} > ${row.category_small}`);
      console.log(`     주소: ${row.address_road}`);
      console.log(`     좌표: (${row.lat}, ${row.lng})`);
    });

  } catch (error) {
    console.error('❌ 에러:', error);
  } finally {
    await pool.end();
  }
}

testChickenPOI();
