/**
 * 보행로 데이터 PostgreSQL 임포트
 *
 * OpenStreetMap GeoJSON 데이터를 KOR.WALKING_PATH 테이블에 저장
 */

import fs from 'fs';
import path from 'path';
import pool from './database.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * GeoJSON 파일 로드
 */
function loadGeoJSON(filename) {
  const filePath = path.join(__dirname, '../data/networks', filename);
  console.log(`📂 파일 로드: ${filePath}`);

  if (!fs.existsSync(filePath)) {
    throw new Error(`파일을 찾을 수 없습니다: ${filePath}`);
  }

  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  console.log(`✅ ${data.features.length}개 피처 로드 완료\n`);

  return data;
}

/**
 * 보행로 데이터 임포트
 */
async function importWalkingPaths(geojson) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('🔄 데이터 임포트 시작...\n');

    let imported = 0;
    let skipped = 0;
    let failed = 0;

    for (const feature of geojson.features) {
      try {
        const props = feature.properties;
        const coords = feature.geometry.coordinates;

        // LineString을 WKT 형식으로 변환
        const wkt = `LINESTRING(${coords.map(c => `${c[0]} ${c[1]}`).join(',')})`;

        const query = `
          INSERT INTO KOR.WALKING_PATH (
            osm_id, highway, name, footway, surface, width, lit, access, path_geom
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, ST_GeomFromText($9, 4326)
          )
          ON CONFLICT (osm_id) DO NOTHING
          RETURNING path_id
        `;

        const values = [
          props.osm_id,
          props.highway || null,
          props.name || null,
          props.footway || null,
          props.surface || null,
          props.width || null,
          props.lit || null,
          props.access || null,
          wkt
        ];

        const result = await client.query(query, values);

        if (result.rowCount > 0) {
          imported++;
          if (imported % 100 === 0) {
            process.stdout.write(`\r   진행: ${imported}/${geojson.features.length}`);
          }
        } else {
          skipped++;
        }

      } catch (error) {
        console.error(`\n⚠️  OSM ID ${feature.properties.osm_id} 임포트 실패:`, error.message);
        failed++;
      }
    }

    await client.query('COMMIT');

    console.log('\n\n✅ 임포트 완료!');
    console.log(`   성공: ${imported}개`);
    console.log(`   중복 스킵: ${skipped}개`);
    console.log(`   실패: ${failed}개`);

    return { imported, skipped, failed };

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ 트랜잭션 롤백:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * 통계 출력
 */
async function printStatistics() {
  console.log('\n📊 저장된 데이터 통계:\n');

  // 총 개수
  const countResult = await pool.query('SELECT COUNT(*) FROM KOR.WALKING_PATH');
  console.log(`   총 보행로: ${parseInt(countResult.rows[0].count).toLocaleString()}개`);

  // 도로 유형별
  const typeResult = await pool.query(`
    SELECT highway, COUNT(*) as count
    FROM KOR.WALKING_PATH
    GROUP BY highway
    ORDER BY count DESC
  `);

  console.log('\n   도로 유형별:');
  typeResult.rows.forEach(row => {
    console.log(`   - ${row.highway || 'unknown'}: ${parseInt(row.count).toLocaleString()}개`);
  });

  // 이름 있는 경로
  const namedResult = await pool.query(`
    SELECT COUNT(*) FROM KOR.WALKING_PATH WHERE name IS NOT NULL
  `);
  console.log(`\n   이름 있는 경로: ${parseInt(namedResult.rows[0].count).toLocaleString()}개`);

  // 총 길이 계산
  const lengthResult = await pool.query(`
    SELECT SUM(ST_Length(path_geom::geography)) as total_length
    FROM KOR.WALKING_PATH
  `);
  const totalKm = (parseFloat(lengthResult.rows[0].total_length) / 1000).toFixed(2);
  console.log(`   총 길이: ${totalKm} km`);
}

/**
 * 메인 실행
 */
async function main() {
  console.log('='.repeat(70));
  console.log('  보행로 데이터 PostgreSQL 임포트');
  console.log('='.repeat(70));
  console.log();

  try {
    // 1. 마이그레이션 실행
    console.log('1️⃣  테이블 생성 중...');
    const migrationPath = path.join(__dirname, '../db/migrations/006_create_walking_path_table.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    await pool.query(migrationSQL);
    console.log('✅ 테이블 생성 완료\n');

    // 2. GeoJSON 로드
    console.log('2️⃣  GeoJSON 파일 로드 중...');
    const geojson = loadGeoJSON('geumcheon_walking_paths_osm.geojson');

    // 3. 데이터 임포트
    console.log('3️⃣  데이터 임포트 중...');
    const result = await importWalkingPaths(geojson);

    // 4. 통계 출력
    console.log('\n4️⃣  저장된 데이터 확인 중...');
    await printStatistics();

    console.log('\n✅ 모든 작업 완료!');
    console.log('\n💡 다음 단계:');
    console.log('   1. 네트워크 그래프 구축 (Turf.js)');
    console.log('   2. 도달 가능 영역 계산 알고리즘 구현');
    console.log('   3. 분석 컨트롤러에 통합');

  } catch (error) {
    console.error('\n❌ 오류 발생:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
