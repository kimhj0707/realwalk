/**
 * V-World API를 사용하여 금천구 행정구역 경계 가져오기
 */

import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// .env 파일 로드
dotenv.config();

const VWORLD_API_KEY = process.env.VWORLD_API_KEY;

if (!VWORLD_API_KEY) {
  console.error('❌ V-World API 키가 .env 파일에 없습니다.');
  console.error('💡 .env 파일에 VWORLD_API_KEY를 추가하세요.');
  process.exit(1);
}

/**
 * V-World WFS API로 행정구역 경계 가져오기
 * @param {string} sigunguName - 시군구 이름 (예: 금천구)
 * @param {string} outputPath - 출력 GeoJSON 파일 경로
 */
async function fetchAdministrativeBoundary(sigunguName, outputPath) {
  try {
    console.log(`🌐 V-World API로 "${sigunguName}" 경계 가져오는 중...`);
    console.log(`🔑 API Key: ${VWORLD_API_KEY.substring(0, 8)}...`);

    // V-World WFS 요청 URL
    // lt_c_adsigg = 시군구 경계
    const wfsUrl = new URL('http://api.vworld.kr/req/wfs');
    wfsUrl.searchParams.append('service', 'wfs');
    wfsUrl.searchParams.append('version', '2.0.0');
    wfsUrl.searchParams.append('request', 'GetFeature');
    wfsUrl.searchParams.append('typeName', 'lt_c_adsigg');
    wfsUrl.searchParams.append('outputFormat', 'application/json');
    wfsUrl.searchParams.append('srsName', 'EPSG:4326'); // WGS84 좌표계
    wfsUrl.searchParams.append('key', VWORLD_API_KEY);

    // CQL 필터로 금천구만 가져오기
    // SIG_KOR_NM = 시군구 한글명
    wfsUrl.searchParams.append('cql_filter', `SIG_KOR_NM='${sigunguName}'`);

    console.log(`📡 요청 URL: ${wfsUrl.toString()}`);

    const response = await fetch(wfsUrl);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type');
    console.log(`📦 응답 Content-Type: ${contentType}`);

    const data = await response.json();

    console.log(`📊 응답 데이터 타입: ${data.type}`);

    if (data.type !== 'FeatureCollection') {
      console.error('❌ 예상치 못한 응답 형식:', data);
      throw new Error('FeatureCollection이 아닌 응답을 받았습니다.');
    }

    const featureCount = data.features ? data.features.length : 0;
    console.log(`✅ ${featureCount}개의 Feature를 받았습니다.`);

    if (featureCount === 0) {
      console.warn('⚠️  검색 결과가 없습니다.');
      console.warn(`💡 시군구명 "${sigunguName}"이 정확한지 확인하세요.`);
      console.warn('💡 또는 cql_filter 조건을 확인하세요.');
      return;
    }

    // 출력 디렉토리 생성
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // GeoJSON 저장
    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf8');

    console.log(`\n✅ 저장 완료: ${outputPath}`);
    console.log(`📏 파일 크기: ${(fs.statSync(outputPath).size / 1024).toFixed(2)} KB`);

    // 첫 번째 Feature 속성 출력
    if (data.features.length > 0) {
      console.log('\n📋 첫 번째 Feature 속성:');
      console.log(JSON.stringify(data.features[0].properties, null, 2));

      // 좌표 범위 출력
      const coords = data.features[0].geometry.coordinates[0];
      if (coords && coords.length > 0) {
        const lngs = coords.map(c => c[0]);
        const lats = coords.map(c => c[1]);
        console.log('\n📍 좌표 범위:');
        console.log(`  경도: ${Math.min(...lngs).toFixed(6)} ~ ${Math.max(...lngs).toFixed(6)}`);
        console.log(`  위도: ${Math.min(...lats).toFixed(6)} ~ ${Math.max(...lats).toFixed(6)}`);
      }
    }

  } catch (error) {
    console.error('❌ 에러 발생:', error.message);
    throw error;
  }
}

/**
 * 동(EMD) 경계 가져오기
 * @param {string} sigunguName - 시군구 이름
 * @param {string} outputPath - 출력 경로
 */
async function fetchDongBoundaries(sigunguName, outputPath) {
  try {
    console.log(`\n🌐 V-World API로 "${sigunguName}" 동 경계 가져오는 중...`);

    const wfsUrl = new URL('http://api.vworld.kr/req/wfs');
    wfsUrl.searchParams.append('service', 'wfs');
    wfsUrl.searchParams.append('version', '2.0.0');
    wfsUrl.searchParams.append('request', 'GetFeature');
    wfsUrl.searchParams.append('typeName', 'lt_c_ademd'); // 읍면동 경계
    wfsUrl.searchParams.append('outputFormat', 'application/json');
    wfsUrl.searchParams.append('srsName', 'EPSG:4326');
    wfsUrl.searchParams.append('key', VWORLD_API_KEY);

    // 금천구의 동들만 가져오기
    wfsUrl.searchParams.append('cql_filter', `SIG_KOR_NM='${sigunguName}'`);

    console.log(`📡 요청 URL: ${wfsUrl.toString()}`);

    const response = await fetch(wfsUrl);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    const featureCount = data.features ? data.features.length : 0;
    console.log(`✅ ${featureCount}개의 동 경계를 받았습니다.`);

    if (featureCount === 0) {
      console.warn('⚠️  동 경계 검색 결과가 없습니다.');
      return;
    }

    // 동 이름 목록 출력
    console.log('\n📍 동 목록:');
    data.features.forEach((f, i) => {
      console.log(`  ${i + 1}. ${f.properties.EMD_KOR_NM || f.properties.EMD_NM || '알 수 없음'}`);
    });

    // 저장
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf8');

    console.log(`\n✅ 저장 완료: ${outputPath}`);
    console.log(`📏 파일 크기: ${(fs.statSync(outputPath).size / 1024).toFixed(2)} KB`);

  } catch (error) {
    console.error('❌ 동 경계 가져오기 실패:', error.message);
  }
}

// 실행
const sigunguName = process.argv[2] || '금천구';
const outputPath = process.argv[3] || 'backend/data/boundaries/geumcheon_boundary.geojson';
const dongOutputPath = process.argv[4] || 'backend/data/boundaries/geumcheon_dong_boundaries.geojson';

console.log('='.repeat(60));
console.log('🗺️  V-World 행정구역 경계 가져오기');
console.log('='.repeat(60));

// 시군구 경계 가져오기
fetchAdministrativeBoundary(sigunguName, outputPath)
  .then(() => {
    // 동 경계도 가져오기
    return fetchDongBoundaries(sigunguName, dongOutputPath);
  })
  .then(() => {
    console.log('\n✨ 모든 작업 완료!');
    console.log('\n📂 생성된 파일:');
    console.log(`  1. ${outputPath}`);
    console.log(`  2. ${dongOutputPath}`);
  })
  .catch((error) => {
    console.error('\n❌ 작업 실패:', error.message);
    process.exit(1);
  });
