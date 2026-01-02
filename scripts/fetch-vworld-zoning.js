/**
 * V-World API로 금천구 용도지역 데이터 가져오기
 */

import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const VWORLD_API_KEY = process.env.VWORLD_API_KEY;

async function fetchZoningData() {
  try {
    console.log('🌐 V-World API로 용도지역 데이터 가져오는 중...');

    // 금천구 대략적인 범위 (BBOX)
    const bbox = '126.886,37.436,126.918,37.491';

    const wfsUrl = new URL('http://api.vworld.kr/req/wfs');
    wfsUrl.searchParams.append('service', 'wfs');
    wfsUrl.searchParams.append('version', '2.0.0');
    wfsUrl.searchParams.append('request', 'GetFeature');
    wfsUrl.searchParams.append('typeName', 'lp_pa_cbnd_bonbun'); // 용도지역 레이어
    wfsUrl.searchParams.append('outputFormat', 'application/json');
    wfsUrl.searchParams.append('srsName', 'EPSG:4326');
    wfsUrl.searchParams.append('bbox', `${bbox},EPSG:4326`);
    wfsUrl.searchParams.append('key', VWORLD_API_KEY);

    console.log('📡 요청 URL:', wfsUrl.toString());

    const response = await fetch(wfsUrl);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    console.log('📊 응답 데이터 타입:', data.type);
    const featureCount = data.features ? data.features.length : 0;
    console.log(`✅ ${featureCount}개의 Feature를 받았습니다.`);

    if (featureCount === 0) {
      console.warn('⚠️  검색 결과가 없습니다. 다른 typeName을 시도해보세요.');
      console.warn('💡 가능한 typeName: lp_uq_121, lt_c_uq121, lp_pa_cbnd_bonbun');
      return;
    }

    // 속성 필드 확인
    if (data.features.length > 0) {
      console.log('\n📋 첫 번째 Feature 속성:');
      console.log(JSON.stringify(data.features[0].properties, null, 2));
    }

    // 저장
    const outputDir = 'backend/data/boundaries';
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputPath = path.join(outputDir, 'geumcheon_zoning.geojson');
    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf8');

    console.log(`\n✅ 저장 완료: ${outputPath}`);
    console.log(`📏 파일 크기: ${(fs.statSync(outputPath).size / 1024).toFixed(2)} KB`);

    // 용도지역 통계
    if (data.features.length > 0) {
      const zoningTypes = {};
      data.features.forEach(f => {
        const props = f.properties;
        // 가능한 필드명들 확인
        const zoningField = props.PRPOS_NM || props.jijiguName || props.jimok || props.UQ_NM || '알 수 없음';
        zoningTypes[zoningField] = (zoningTypes[zoningField] || 0) + 1;
      });

      console.log('\n📊 용도지역 통계:');
      Object.entries(zoningTypes)
        .sort((a, b) => b[1] - a[1])
        .forEach(([type, count]) => {
          console.log(`  ${type}: ${count}개`);
        });
    }

  } catch (error) {
    console.error('❌ 에러 발생:', error.message);

    // 대체 레이어 시도
    console.log('\n💡 다른 레이어로 시도 중...');
    await tryAlternativeLayers();
  }
}

/**
 * 대체 레이어 시도
 */
async function tryAlternativeLayers() {
  const alternativeTypes = [
    'lt_c_uq121',      // 용도지역지구
    'lp_uq_121',       // 용도지역
    'lt_c_upisuq',     // 도시계획시설
    'lp_pa_cbnd'       // 연속지적도
  ];

  for (const typeName of alternativeTypes) {
    try {
      console.log(`\n🔄 시도 중: ${typeName}`);

      const bbox = '126.886,37.436,126.918,37.491';
      const wfsUrl = new URL('http://api.vworld.kr/req/wfs');
      wfsUrl.searchParams.append('service', 'wfs');
      wfsUrl.searchParams.append('version', '2.0.0');
      wfsUrl.searchParams.append('request', 'GetFeature');
      wfsUrl.searchParams.append('typeName', typeName);
      wfsUrl.searchParams.append('outputFormat', 'application/json');
      wfsUrl.searchParams.append('srsName', 'EPSG:4326');
      wfsUrl.searchParams.append('bbox', `${bbox},EPSG:4326`);
      wfsUrl.searchParams.append('key', VWORLD_API_KEY);

      const response = await fetch(wfsUrl);

      if (response.ok) {
        const data = await response.json();
        const featureCount = data.features ? data.features.length : 0;

        if (featureCount > 0) {
          console.log(`✅ ${typeName}에서 ${featureCount}개 발견!`);
          console.log('첫 번째 속성:', JSON.stringify(data.features[0].properties, null, 2));

          const outputPath = `backend/data/boundaries/geumcheon_${typeName}.geojson`;
          fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf8');
          console.log(`저장: ${outputPath}`);
        }
      }
    } catch (err) {
      console.log(`❌ ${typeName} 실패:`, err.message);
    }
  }
}

// 실행
console.log('='.repeat(60));
console.log('🗺️  V-World 용도지역 데이터 가져오기');
console.log('='.repeat(60));

fetchZoningData()
  .then(() => {
    console.log('\n✨ 작업 완료!');
  })
  .catch((error) => {
    console.error('\n❌ 작업 실패:', error.message);
    process.exit(1);
  });
