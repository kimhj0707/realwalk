/**
 * 금천구 상가업소 데이터 추출 및 분석
 */

import fs from 'fs';
import csv from 'csv-parser';
import path from 'path';

const INPUT_FILE = 'backend/data/소상공인시장진흥공단_상가(상권)정보_20251030/소상공인시장진흥공단_상가(상권)정보_서울_202510.csv';
const OUTPUT_DIR = 'backend/data/processed';

const stores = [];
const categoryStats = {};
const dongStats = {};

console.log('📂 금천구 상가업소 데이터 추출 시작...\n');

fs.createReadStream(INPUT_FILE)
  .pipe(csv())
  .on('data', (row) => {
    // 금천구만 필터링
    if (row['시군구명'] === '금천구') {
      const store = {
        id: row['상가업소번호'],
        name: row['상호명'],
        branch: row['지점명'],
        categoryLarge: row['상권업종대분류명'],
        categoryMedium: row['상권업종중분류명'],
        categorySmall: row['상권업종소분류명'],
        industryCode: row['표준산업분류코드'],
        industryName: row['표준산업분류명'],
        dong: row['행정동명'],
        address: row['지번주소'],
        roadAddress: row['도로명주소'],
        buildingName: row['건물명'],
        floor: row['층정보'],
        ho: row['호정보'],
        lng: parseFloat(row['경도']),
        lat: parseFloat(row['위도'])
      };

      // 좌표가 유효한 경우만 저장
      if (store.lng && store.lat && !isNaN(store.lng) && !isNaN(store.lat)) {
        stores.push(store);

        // 통계 수집
        const largeCat = store.categoryLarge || '기타';
        categoryStats[largeCat] = (categoryStats[largeCat] || 0) + 1;

        const dong = store.dong || '알수없음';
        dongStats[dong] = (dongStats[dong] || 0) + 1;
      }
    }
  })
  .on('end', () => {
    console.log(`✅ 추출 완료: ${stores.length}개 상가업소\n`);

    // 통계 출력
    console.log('📊 업종별 통계:');
    Object.entries(categoryStats)
      .sort((a, b) => b[1] - a[1])
      .forEach(([category, count]) => {
        const percentage = ((count / stores.length) * 100).toFixed(1);
        console.log(`  ${category.padEnd(15)} : ${count.toString().padStart(5)}개 (${percentage}%)`);
      });

    console.log('\n📍 동별 통계:');
    Object.entries(dongStats)
      .sort((a, b) => b[1] - a[1])
      .forEach(([dong, count]) => {
        const percentage = ((count / stores.length) * 100).toFixed(1);
        console.log(`  ${dong.padEnd(10)} : ${count.toString().padStart(5)}개 (${percentage}%)`);
      });

    // 출력 디렉토리 생성
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    // 1. JSON 저장
    const jsonPath = path.join(OUTPUT_DIR, 'geumcheon_stores.json');
    fs.writeFileSync(jsonPath, JSON.stringify(stores, null, 2), 'utf8');
    console.log(`\n💾 JSON 저장: ${jsonPath} (${(fs.statSync(jsonPath).size / 1024 / 1024).toFixed(2)} MB)`);

    // 2. GeoJSON 저장
    const geojson = {
      type: 'FeatureCollection',
      features: stores.map(store => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [store.lng, store.lat]
        },
        properties: {
          id: store.id,
          name: store.name,
          branch: store.branch,
          categoryLarge: store.categoryLarge,
          categoryMedium: store.categoryMedium,
          categorySmall: store.categorySmall,
          dong: store.dong,
          address: store.address,
          roadAddress: store.roadAddress,
          buildingName: store.buildingName,
          floor: store.floor
        }
      }))
    };

    const geojsonPath = path.join(OUTPUT_DIR, 'geumcheon_stores.geojson');
    fs.writeFileSync(geojsonPath, JSON.stringify(geojson, null, 2), 'utf8');
    console.log(`💾 GeoJSON 저장: ${geojsonPath} (${(fs.statSync(geojsonPath).size / 1024 / 1024).toFixed(2)} MB)`);

    // 3. 통계 저장
    const stats = {
      totalStores: stores.length,
      categoryStats,
      dongStats,
      generatedAt: new Date().toISOString()
    };

    const statsPath = path.join(OUTPUT_DIR, 'geumcheon_stores_stats.json');
    fs.writeFileSync(statsPath, JSON.stringify(stats, null, 2), 'utf8');
    console.log(`📊 통계 저장: ${statsPath}`);

    // 4. 업종별 분리 저장 (주요 카테고리만)
    const majorCategories = ['음식', '소매', '생활서비스', '학문/교육', '부동산'];
    majorCategories.forEach(category => {
      const filtered = stores.filter(s => s.categoryLarge === category);
      if (filtered.length > 0) {
        const catPath = path.join(OUTPUT_DIR, `geumcheon_stores_${category}.json`);
        fs.writeFileSync(catPath, JSON.stringify(filtered, null, 2), 'utf8');
        console.log(`  └─ ${category}: ${filtered.length}개 → ${catPath}`);
      }
    });

    console.log('\n✨ 모든 작업 완료!');
    console.log('\n📂 생성된 파일:');
    console.log('  1. geumcheon_stores.json - 전체 데이터');
    console.log('  2. geumcheon_stores.geojson - 지도 표시용');
    console.log('  3. geumcheon_stores_stats.json - 통계');
    console.log('  4. geumcheon_stores_[업종].json - 업종별 파일');
  })
  .on('error', (error) => {
    console.error('❌ 에러 발생:', error);
  });
