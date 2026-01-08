import fs from 'fs';
import readline from 'readline';
import proj4 from 'proj4';
import pool from '../backend/utils/database.js';

// --- Configuration ---
const ENTRANCE_FILE_PATH = 'backend/data/도로명주소출입구_전체분_서울특별시_금천구/RNENTDATA_2512_11545.txt';

// --- Coordinate System Definitions ---
proj4.defs('UTMK', '+proj=tmerc +lat_0=38 +lon_0=127.5 +k=0.9996 +x_0=1000000 +y_0=2000000 +ellps=GRS80 +units=m +no_defs');
proj4.defs('WGS84', '+proj=longlat +ellps=WGS84 +datum=WGS84 +no_defs');

// --- Main Function ---
async function importEntrancesOneByOne() {
  console.log('🚪 건물 출입구 데이터 임포트 (한 번에 하나씩)를 시작합니다...');
  const client = await pool.connect();
  let totalLinesProcessed = 0;
  let totalImportedCount = 0;
  let totalFailedCount = 0;

  const fileStream = fs.createReadStream(ENTRANCE_FILE_PATH);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  try {
    console.log('📂 출입구 파일을 읽는 중...');
    await client.query('BEGIN'); // 트랜잭션 시작

    for await (const line of rl) {
      totalLinesProcessed++;
      const parts = line.split('|');
      
      if (parts.length < 20) {
        totalFailedCount++;
        continue;
      }
      
      const entranceId = parts[0];
      const dongCode = parts[1].trim(); // 트림 처리 추가!
      const x = parseFloat(parts[parts.length - 2]);
      const y = parseFloat(parts[parts.length - 1]);

      if (!entranceId || !dongCode || isNaN(x) || isNaN(y)) {
        totalFailedCount++;
        continue;
      }
      
      const [lng, lat] = proj4('UTMK', 'WGS84', [x, y]);

      try {
        const { rows } = await client.query(
          `SELECT bd_mgt_sn 
           FROM kor.bldg 
           WHERE bd_mgt_sn LIKE $1 || '%' 
             AND ST_DWithin(
               bldg_geom::geography, 
               ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography, 
               75
             )
           ORDER BY ST_Distance(bldg_geom::geography, ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography) 
           LIMIT 1`,
          [dongCode, lng, lat]
        );

        if (rows.length > 0) {
          const full_bd_mgt_sn = rows[0].bd_mgt_sn.trim(); // TRIM 추가!
          await client.query(
            `INSERT INTO kor.bldg_entrance (entrance_id, bd_mgt_sn, geom) 
             VALUES ($1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326))
             ON CONFLICT (entrance_id) DO UPDATE SET 
               bd_mgt_sn = EXCLUDED.bd_mgt_sn, 
               geom = EXCLUDED.geom, 
               updated_at = NOW()`,
            [entranceId, full_bd_mgt_sn, lng, lat]
          );
          totalImportedCount++;
        } else {
          totalFailedCount++;
        }
      } catch (e) {
        totalFailedCount++;
      }
      
      if (totalLinesProcessed % 1000 === 0) {
        process.stdout.write(`... 처리된 라인: ${totalLinesProcessed}, 성공: ${totalImportedCount}, 실패: ${totalFailedCount}\r`);
      }
    }

    await client.query('COMMIT'); // 최종 커밋
    console.log(`\n\n✨ 총 ${totalLinesProcessed} 라인 처리 완료.`);
    console.log(`   - 성공적으로 임포트/업데이트된 출입구: ${totalImportedCount}개`);
    console.log(`   - 실패한 출입구 (매칭되는 건물 없음): ${totalFailedCount}개`);


  } catch (error) {
    console.error('\n💥 임포트 중 심각한 오류가 발생했습니다:', error);
  } finally {
    await client.release();
    await pool.end();
    console.log('🔚 데이터베이스 연결이 종료되었습니다.');
  }
}

importEntrancesOneByOne();