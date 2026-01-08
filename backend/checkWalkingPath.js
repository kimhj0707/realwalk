import pool from './utils/database.js';

async function checkWalkingPath() {
  try {
    // 1. 테이블 존재 확인
    console.log('\n=== 1. KOR.WALKING_PATH 테이블 존재 확인 ===');
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'KOR'
        AND table_name = 'WALKING_PATH'
      );
    `);
    console.log('테이블 존재:', tableCheck.rows[0].exists);

    if (!tableCheck.rows[0].exists) {
      console.log('❌ KOR.WALKING_PATH 테이블이 없습니다!');

      // 대소문자 변형 확인
      const altCheck = await pool.query(`
        SELECT table_schema, table_name
        FROM information_schema.tables
        WHERE table_name ILIKE '%walking%' OR table_name ILIKE '%path%'
      `);
      console.log('\n비슷한 이름의 테이블:', altCheck.rows);

      await pool.end();
      return;
    }

    // 2. 데이터 개수 확인
    console.log('\n=== 2. 데이터 개수 확인 ===');
    const countResult = await pool.query('SELECT COUNT(*) FROM KOR.WALKING_PATH');
    console.log('총 보행로 개수:', countResult.rows[0].count);

    // 3. 샘플 데이터 확인
    console.log('\n=== 3. 샘플 데이터 (5개) ===');
    const sampleResult = await pool.query(`
      SELECT path_id, highway, name,
             ST_AsText(ST_StartPoint(path_geom)) as start_point,
             ST_Length(path_geom::geography) as length_meters
      FROM KOR.WALKING_PATH
      LIMIT 5
    `);
    sampleResult.rows.forEach(row => {
      console.log('  - ID: ' + row.path_id + ', highway: ' + row.highway + ', name: ' + (row.name || 'N/A') + ', length: ' + Math.round(row.length_meters) + 'm');
    });

    // 4. 특정 지점 주변 보행로 확인 (범안로 주변)
    console.log('\n=== 4. 범안로 주변 보행로 확인 (500m 반경) ===');
    const nearbyResult = await pool.query(`
      SELECT path_id, highway, name,
             ST_Distance(
               path_geom::geography,
               ST_SetSRID(ST_MakePoint(126.893, 37.466), 4326)::geography
             ) as distance
      FROM KOR.WALKING_PATH
      WHERE ST_DWithin(
        path_geom::geography,
        ST_SetSRID(ST_MakePoint(126.893, 37.466), 4326)::geography,
        500
      )
      ORDER BY distance
      LIMIT 10
    `);
    console.log('주변 보행로 개수: ' + nearbyResult.rows.length);
    nearbyResult.rows.forEach(row => {
      console.log('  - ID: ' + row.path_id + ', highway: ' + row.highway + ', name: ' + (row.name || 'N/A') + ', distance: ' + Math.round(row.distance) + 'm');
    });

    await pool.end();
  } catch (error) {
    console.error('Error:', error);
    await pool.end();
    process.exit(1);
  }
}

checkWalkingPath();
