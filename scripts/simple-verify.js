
import fs from 'fs';
import proj4 from 'proj4';
import pool from '../backend/utils/database.js';

// --- Coordinate System Definitions ---
proj4.defs('UTMK', '+proj=tmerc +lat_0=38 +lon_0=127.5 +k=0.9996 +x_0=1000000 +y_0=2000000 +ellps=GRS80 +units=m +no_defs');
proj4.defs('WGS84', '+proj=longlat +ellps=WGS84 +datum=WGS84 +no_defs');

async function simpleVerify() {
  console.log('🔬 단순 검증 스크립트를 시작합니다...');
  const client = await pool.connect();

  try {
    // 1. Get one building with a valid geometry
    console.log('\n1. 건물 한 개를 조회합니다...');
    const { rows: buildings } = await client.query(
      `SELECT bd_mgt_sn, ST_AsText(bldg_geom) as geom_wkt 
       FROM kor.bldg 
       WHERE bldg_geom IS NOT NULL 
       LIMIT 1`
    );
    if (buildings.length === 0) {
      console.log('❌ 건물을 찾을 수 없습니다.');
      return;
    }
    const building = buildings[0];
    console.log(`- 건물 관리번호: ${building.bd_mgt_sn}`);
    // console.log(`- 건물 지오메트리(WKT): ${building.geom_wkt}`);

    // 2. Get one entrance from the text file
    console.log('\n2. 출입구 파일에서 한 개 라인을 읽습니다...');
    const entranceLine = fs.readFileSync('backend/data/도로명주소출입구_전체분_서울특별시_금천구/RNENTDATA_2512_11545.txt', 'utf-8').split('\n')[0];
    const parts = entranceLine.split('|');
    const entranceId = parts[0];
    const x = parseFloat(parts[parts.length - 2]);
    const y = parseFloat(parts[parts.length - 1]);
    const [lng, lat] = proj4('UTMK', 'WGS84', [x, y]);
    console.log(`- 출입구 ID: ${entranceId}`);
    console.log(`- 출입구 좌표 (WGS84): lng=${lng}, lat=${lat}`);
    
    // 3. Perform a spatial query with the entrance coordinates against ALL buildings
    console.log('\n3. 출입구 좌표로 포함되는 건물이 있는지 공간 쿼리를 실행합니다...');
    const { rows: found } = await client.query(
      `
      SELECT bd_mgt_sn, ST_AsText(bldg_geom) as geom_wkt
      FROM kor.bldg 
      WHERE ST_DWithin(
        bldg_geom,
        ST_SetSRID(ST_MakePoint($1, $2), 4326),
        5.0
      )
      LIMIT 5
      `,
      [lng, lat]
    );

    // 4. Log results
    if (found.length > 0) {
      console.log(`✅ 성공! 출입구 ID [${entranceId}] 근처에서 ${found.length}개의 건물을 찾았습니다.`);
      found.forEach(f => {
        console.log(`   - 건물 관리번호: ${f.bd_mgt_sn}`);
      });
    } else {
      console.log(`❌ 실패. 출입구 ID [${entranceId}] 근처에서 건물을 찾지 못했습니다.`);
      console.log(`   - 쿼리 좌표: lng=${lng}, lat=${lat}`);
    }

  } catch (error) {
    console.error('💥 검증 중 오류 발생:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

simpleVerify();
