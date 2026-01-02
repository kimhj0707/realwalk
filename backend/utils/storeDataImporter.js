/**
 * 소상공인 상가정보 JSON → PostgreSQL 마이그레이션
 * geumcheon_stores.json 데이터를 KOR.STORE 테이블에 삽입
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from './database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// JSON 파일 경로
const JSON_FILE_PATH = path.join(__dirname, '../data/processed/geumcheon_stores.json');

/**
 * 배치 단위로 데이터 삽입 (성능 최적화)
 */
async function insertStoreBatch(stores) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    let inserted = 0;
    let skipped = 0;

    for (const store of stores) {
      try {
        const query = `
          INSERT INTO KOR.STORE (
            store_code, store_nm, branch_nm,
            category_large, category_medium, category_small,
            industry_code, industry_nm,
            dong, address_jibun, address_road, building_nm,
            floor_info, ho_info, geom
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
            ST_SetSRID(ST_MakePoint($15, $16), 4326)
          )
          ON CONFLICT (store_code) DO NOTHING
        `;

        const values = [
          store.id,                    // store_code
          store.name || '',            // store_nm
          store.branch || '',          // branch_nm
          store.categoryLarge || '',   // category_large
          store.categoryMedium || '',  // category_medium
          store.categorySmall || '',   // category_small
          store.industryCode || '',    // industry_code
          store.industryName || '',    // industry_nm
          store.dong || '',            // dong
          store.address || '',         // address_jibun
          store.roadAddress || '',     // address_road
          store.buildingName || '',    // building_nm
          store.floor || '',           // floor_info
          store.ho || '',              // ho_info
          store.lng,                   // longitude
          store.lat                    // latitude
        ];

        const result = await client.query(query, values);

        if (result.rowCount > 0) {
          inserted++;
        } else {
          skipped++;
        }

        // 진행상황 출력 (1000개마다)
        if ((inserted + skipped) % 1000 === 0) {
          console.log(`진행중... ${inserted + skipped}개 처리 (삽입: ${inserted}, 스킵: ${skipped})`);
        }

      } catch (err) {
        console.error(`상가 삽입 실패 [${store.id}]:`, err.message);
        skipped++;
      }
    }

    await client.query('COMMIT');

    console.log('\n=== 마이그레이션 완료 ===');
    console.log(`총 처리: ${inserted + skipped}개`);
    console.log(`삽입 성공: ${inserted}개`);
    console.log(`스킵/실패: ${skipped}개`);

    return { inserted, skipped };

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('트랜잭션 실패:', err);
    throw err;
  } finally {
    client.release();
  }
}

/**
 * 메인 실행 함수
 */
async function main() {
  console.log('=== 소상공인 상가정보 DB 통합 시작 ===\n');

  try {
    // 1. JSON 파일 읽기
    console.log('1. JSON 파일 로딩...');
    const jsonData = fs.readFileSync(JSON_FILE_PATH, 'utf-8');
    const stores = JSON.parse(jsonData);
    console.log(`   → ${stores.length}개 상가 데이터 로드 완료\n`);

    // 2. 테이블 존재 확인
    console.log('2. KOR.STORE 테이블 확인...');
    const tableCheckQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'kor'
        AND table_name = 'store'
      );
    `;
    const tableExists = await pool.query(tableCheckQuery);

    if (!tableExists.rows[0].exists) {
      console.error('   ✗ KOR.STORE 테이블이 존재하지 않습니다.');
      console.error('   → 먼저 마이그레이션 스크립트를 실행하세요:');
      console.error('   psql -U postgres -d realwalk -f backend/db/migrations/004_create_store_table.sql');
      process.exit(1);
    }
    console.log('   ✓ 테이블 확인 완료\n');

    // 3. 기존 데이터 개수 확인
    console.log('3. 기존 데이터 확인...');
    const countResult = await pool.query('SELECT COUNT(*) FROM KOR.STORE');
    const existingCount = parseInt(countResult.rows[0].count);
    console.log(`   → 현재 ${existingCount}개 상가 등록됨\n`);

    // 4. 데이터 삽입
    console.log('4. 데이터 삽입 시작...\n');
    const result = await insertStoreBatch(stores);

    // 5. 최종 확인
    console.log('\n5. 최종 확인...');
    const finalCount = await pool.query('SELECT COUNT(*) FROM KOR.STORE');
    const totalCount = parseInt(finalCount.rows[0].count);
    console.log(`   → 총 ${totalCount}개 상가 등록됨`);
    console.log(`   → 신규 추가: ${totalCount - existingCount}개\n`);

    // 6. 카테고리별 통계
    console.log('6. 카테고리별 통계:');
    const statsQuery = `
      SELECT category_large, COUNT(*) as count
      FROM KOR.STORE
      GROUP BY category_large
      ORDER BY count DESC;
    `;
    const stats = await pool.query(statsQuery);
    stats.rows.forEach(row => {
      console.log(`   - ${row.category_large}: ${row.count}개`);
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
main();
