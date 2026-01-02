/**
 * 금천구 동 경계 데이터 임포터
 * geumcheon_dong_boundaries.geojson → KOR.DONG 테이블
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from './database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GEOJSON_FILE = path.join(__dirname, '../data/boundaries/geumcheon_dong_boundaries.geojson');

/**
 * GeoJSON을 PostGIS geometry로 변환
 */
function geometryToWKT(geometry) {
  // GeoJSON geometry를 PostgreSQL이 인식할 수 있는 형식으로 변환
  // PostGIS의 ST_GeomFromGeoJSON 함수를 사용
  return JSON.stringify(geometry);
}

/**
 * 동 경계 데이터 삽입
 */
async function importDongBoundaries() {
  console.log('=== 금천구 동 경계 데이터 임포트 시작 ===\n');

  try {
    // 1. GeoJSON 파일 읽기
    console.log('1. GeoJSON 파일 로딩...');
    const jsonData = fs.readFileSync(GEOJSON_FILE, 'utf-8');
    const geoData = JSON.parse(jsonData);
    console.log(`   → ${geoData.features.length}개 동 경계 로드 완료\n`);

    // 2. 테이블 존재 확인
    console.log('2. KOR.DONG 테이블 확인...');
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'kor' AND table_name = 'dong'
      );
    `);

    if (!tableCheck.rows[0].exists) {
      console.error('   ✗ KOR.DONG 테이블이 존재하지 않습니다.');
      console.error('   → 먼저 마이그레이션을 실행하세요:');
      console.error('   node backend/utils/runDongMigration.js');
      process.exit(1);
    }
    console.log('   ✓ 테이블 확인 완료\n');

    // 3. 기존 데이터 확인
    console.log('3. 기존 데이터 확인...');
    const countResult = await pool.query('SELECT COUNT(*) FROM KOR.DONG');
    const existingCount = parseInt(countResult.rows[0].count);
    console.log(`   → 현재 ${existingCount}개 동 등록됨\n`);

    // 4. 데이터 삽입
    console.log('4. 동 경계 데이터 삽입...\n');
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      let inserted = 0;
      let skipped = 0;

      for (const feature of geoData.features) {
        const props = feature.properties;
        const geomJSON = JSON.stringify(feature.geometry);

        try {
          const query = `
            INSERT INTO KOR.DONG (
              emd_cd, dong_nm, dong_eng_nm, full_nm, geom
            ) VALUES (
              $1, $2, $3, $4, ST_SetSRID(ST_GeomFromGeoJSON($5), 4326)
            )
            ON CONFLICT (emd_cd) DO NOTHING
          `;

          const values = [
            props.emd_cd,
            props.emd_kor_nm,
            props.emd_eng_nm,
            props.full_nm,
            geomJSON
          ];

          const result = await client.query(query, values);

          if (result.rowCount > 0) {
            inserted++;
            console.log(`   ✓ ${props.emd_kor_nm} (${props.emd_cd}) 삽입 완료`);
          } else {
            skipped++;
            console.log(`   - ${props.emd_kor_nm} 이미 존재 (스킵)`);
          }

        } catch (err) {
          console.error(`   ✗ ${props.emd_kor_nm} 삽입 실패:`, err.message);
          skipped++;
        }
      }

      await client.query('COMMIT');

      console.log('\n=== 임포트 완료 ===');
      console.log(`총 처리: ${inserted + skipped}개`);
      console.log(`삽입 성공: ${inserted}개`);
      console.log(`스킵/실패: ${skipped}개\n`);

    } catch (err) {
      await client.query('ROLLBACK');
      console.error('트랜잭션 실패:', err);
      throw err;
    } finally {
      client.release();
    }

    // 5. 최종 확인
    console.log('5. 최종 확인...');
    const finalCount = await pool.query('SELECT COUNT(*) FROM KOR.DONG');
    console.log(`   → 총 ${finalCount.rows[0].count}개 동 등록됨\n`);

    // 6. 동 목록 출력
    console.log('6. 등록된 동 목록:');
    const dongList = await pool.query(`
      SELECT dong_nm, emd_cd, full_nm
      FROM KOR.DONG
      ORDER BY dong_nm;
    `);

    dongList.rows.forEach(dong => {
      console.log(`   - ${dong.dong_nm} (${dong.emd_cd}): ${dong.full_nm}`);
    });

    console.log('\n✓ 모든 작업 완료!');

  } catch (err) {
    console.error('\n✗ 오류 발생:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// 스크립트 실행
importDongBoundaries();
