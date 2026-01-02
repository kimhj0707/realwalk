/**
 * V-World API를 통해 금천구 도로 네트워크 데이터를 수집합니다.
 *
 * 용도: 보행로 네트워크 데이터 대체용
 * - 실제 보행 가능 경로 기반 분석
 * - 직선거리가 아닌 실제 경로 거리 계산
 */

import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const VWORLD_API_KEY = process.env.VWORLD_API_KEY;

// 금천구 경계 (대략적)
const GEUMCHEON_BBOX = {
  minLng: 126.886,
  minLat: 37.436,
  maxLng: 126.918,
  maxLat: 37.491
};

/**
 * V-World WFS로 도로 네트워크 데이터 가져오기
 */
async function fetchRoadNetwork() {
  console.log('🌐 V-World API로 금천구 도로 네트워크 데이터 수집 시작...\n');

  const wfsUrl = new URL('http://api.vworld.kr/req/wfs');
  wfsUrl.searchParams.append('service', 'wfs');
  wfsUrl.searchParams.append('version', '2.0.0');
  wfsUrl.searchParams.append('request', 'GetFeature');
  wfsUrl.searchParams.append('typeName', 'lt_l_moctlink'); // 도로 네트워크 레이어
  wfsUrl.searchParams.append('outputFormat', 'application/json');
  wfsUrl.searchParams.append('srsName', 'EPSG:4326');
  wfsUrl.searchParams.append('key', VWORLD_API_KEY);

  // BBOX로 금천구 영역만 필터링
  const bbox = `${GEUMCHEON_BBOX.minLng},${GEUMCHEON_BBOX.minLat},${GEUMCHEON_BBOX.maxLng},${GEUMCHEON_BBOX.maxLat},EPSG:4326`;
  wfsUrl.searchParams.append('bbox', bbox);

  console.log(`📍 요청 URL: ${wfsUrl.toString().substring(0, 100)}...`);
  console.log(`📦 BBOX: ${bbox}\n`);

  try {
    const response = await fetch(wfsUrl.toString());

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (!data.features || data.features.length === 0) {
      console.warn('⚠️  데이터가 없습니다. BBOX 또는 레이어명을 확인하세요.');
      return null;
    }

    console.log(`✅ 도로 데이터 수집 완료: ${data.features.length}개 세그먼트\n`);

    // 통계 출력
    const totalLength = data.features.reduce((sum, feature) => {
      if (feature.geometry.type === 'LineString') {
        const coords = feature.geometry.coordinates;
        let length = 0;
        for (let i = 1; i < coords.length; i++) {
          const [lng1, lat1] = coords[i - 1];
          const [lng2, lat2] = coords[i];
          const dx = (lng2 - lng1) * 111320; // 대략적인 미터 변환
          const dy = (lat2 - lat1) * 110540;
          length += Math.sqrt(dx * dx + dy * dy);
        }
        return sum + length;
      }
      return sum;
    }, 0);

    console.log(`📏 총 도로 길이: ${(totalLength / 1000).toFixed(2)} km`);
    console.log(`📊 도로 유형 분포:`);

    const roadTypes = {};
    data.features.forEach(feature => {
      const type = feature.properties.road_type || feature.properties.type || 'unknown';
      roadTypes[type] = (roadTypes[type] || 0) + 1;
    });

    Object.entries(roadTypes).forEach(([type, count]) => {
      console.log(`   - ${type}: ${count}개`);
    });

    return data;

  } catch (error) {
    console.error('❌ 데이터 수집 실패:', error.message);
    throw error;
  }
}

/**
 * 보행 가능 경로만 필터링
 * (차도가 아닌 인도, 보행자도로, 자전거도로 등)
 */
function filterWalkablePaths(roadData) {
  console.log('\n🚶 보행 가능 경로 필터링 중...');

  const walkableTypes = [
    'sidewalk',      // 인도
    'footway',       // 보행자 전용도로
    'pedestrian',    // 보행자 구역
    'path',          // 오솔길
    'cycleway',      // 자전거도로 (보행 가능)
    'residential',   // 주거지역 도로 (보행 가능)
  ];

  const filtered = {
    type: 'FeatureCollection',
    features: roadData.features.filter(feature => {
      const roadType = (feature.properties.road_type || feature.properties.type || '').toLowerCase();
      const roadName = (feature.properties.road_name || feature.properties.name || '').toLowerCase();

      // 보행 가능 유형이거나, 도로명에 '보도', '인도', '보행' 포함
      return walkableTypes.some(type => roadType.includes(type)) ||
             roadName.includes('보도') ||
             roadName.includes('인도') ||
             roadName.includes('보행');
    })
  };

  console.log(`   원본: ${roadData.features.length}개`);
  console.log(`   보행 가능: ${filtered.features.length}개`);
  console.log(`   필터링률: ${((filtered.features.length / roadData.features.length) * 100).toFixed(1)}%`);

  return filtered;
}

/**
 * GeoJSON 파일로 저장
 */
async function saveGeoJSON(data, filename) {
  const dataDir = path.join(__dirname, '../backend/data/networks');

  // 디렉토리 생성
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const filePath = path.join(dataDir, filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

  const fileSize = (fs.statSync(filePath).size / 1024).toFixed(2);
  console.log(`\n💾 저장 완료: ${filePath}`);
  console.log(`📦 파일 크기: ${fileSize} KB`);
}

/**
 * 메인 실행
 */
async function main() {
  console.log('=' .repeat(60));
  console.log('  V-World 도로 네트워크 데이터 수집');
  console.log('=' .repeat(60));
  console.log();

  if (!VWORLD_API_KEY) {
    console.error('❌ VWORLD_API_KEY가 .env 파일에 설정되지 않았습니다.');
    process.exit(1);
  }

  try {
    // 1. 도로 데이터 수집
    const roadData = await fetchRoadNetwork();

    if (!roadData) {
      console.error('❌ 데이터 수집 실패');
      process.exit(1);
    }

    // 2. 전체 도로 저장
    await saveGeoJSON(roadData, 'geumcheon_roads_all.geojson');

    // 3. 보행 가능 경로만 필터링 및 저장
    const walkablePaths = filterWalkablePaths(roadData);
    await saveGeoJSON(walkablePaths, 'geumcheon_walking_paths.geojson');

    console.log('\n✅ 모든 작업 완료!');
    console.log('\n📁 생성된 파일:');
    console.log('   1. geumcheon_roads_all.geojson - 전체 도로');
    console.log('   2. geumcheon_walking_paths.geojson - 보행 가능 경로만');
    console.log('\n💡 다음 단계:');
    console.log('   1. PostgreSQL에 데이터 저장');
    console.log('   2. 네트워크 그래프 구축');
    console.log('   3. 도달 가능 영역 계산 알고리즘 구현');

  } catch (error) {
    console.error('\n❌ 오류 발생:', error);
    process.exit(1);
  }
}

main();
