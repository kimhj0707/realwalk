/**
 * OpenStreetMap Overpass API로 금천구 보행로 데이터 수집
 *
 * 장점:
 * - 완전 무료
 * - 보행로/인도 데이터가 잘 정리됨
 * - 실시간 업데이트
 * - V-World보다 데이터 품질 좋음
 */

import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 금천구 경계
const GEUMCHEON_BBOX = {
  south: 37.436,
  west: 126.886,
  north: 37.491,
  east: 126.918
};

/**
 * Overpass QL 쿼리 생성
 * 보행로 관련 OSM 태그:
 * - highway=footway (보행자 전용도로)
 * - highway=pedestrian (보행자 구역)
 * - highway=path (오솔길)
 * - highway=steps (계단)
 * - highway=residential (주거지 도로)
 * - footway=sidewalk (인도)
 */
function buildOverpassQuery() {
  const bbox = `${GEUMCHEON_BBOX.south},${GEUMCHEON_BBOX.west},${GEUMCHEON_BBOX.north},${GEUMCHEON_BBOX.east}`;

  return `
[out:json][timeout:60];
(
  // 보행자 전용 도로
  way["highway"="footway"](${bbox});
  way["highway"="pedestrian"](${bbox});
  way["highway"="path"](${bbox});
  way["highway"="steps"](${bbox});

  // 주거지 도로 (보행 가능)
  way["highway"="residential"](${bbox});
  way["highway"="living_street"](${bbox});

  // 인도 (sidewalk)
  way["footway"="sidewalk"](${bbox});
);
out geom;
  `.trim();
}

/**
 * Overpass API 호출
 */
async function fetchOSMData() {
  console.log('🌍 OpenStreetMap에서 금천구 보행로 데이터 수집 중...\n');

  const query = buildOverpassQuery();
  const overpassUrl = 'https://overpass-api.de/api/interpreter';

  console.log('📝 Overpass QL 쿼리:');
  console.log(query);
  console.log('\n⏳ 데이터 다운로드 중 (1-2분 소요)...\n');

  try {
    const response = await fetch(overpassUrl, {
      method: 'POST',
      body: query,
      headers: { 'Content-Type': 'text/plain' }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log(`✅ 데이터 수집 완료: ${data.elements.length}개 경로\n`);

    return data;
  } catch (error) {
    console.error('❌ OSM 데이터 수집 실패:', error.message);
    throw error;
  }
}

/**
 * OSM 데이터를 GeoJSON으로 변환
 */
function convertToGeoJSON(osmData) {
  console.log('🔄 GeoJSON 변환 중...');

  const features = osmData.elements
    .filter(element => element.type === 'way' && element.geometry)
    .map(way => ({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: way.geometry.map(node => [node.lon, node.lat])
      },
      properties: {
        osm_id: way.id,
        highway: way.tags?.highway || 'unknown',
        name: way.tags?.name || null,
        footway: way.tags?.footway || null,
        surface: way.tags?.surface || null,
        width: way.tags?.width || null,
        lit: way.tags?.lit || null,  // 가로등 있는지
        access: way.tags?.access || null,
        ...way.tags
      }
    }));

  const geojson = {
    type: 'FeatureCollection',
    features: features
  };

  console.log(`   ✅ ${features.length}개 피처로 변환 완료`);
  return geojson;
}

/**
 * 통계 출력
 */
function printStatistics(geojson) {
  console.log('\n📊 데이터 통계:');

  // 도로 유형별 집계
  const types = {};
  geojson.features.forEach(feature => {
    const type = feature.properties.highway || 'unknown';
    types[type] = (types[type] || 0) + 1;
  });

  console.log('\n   도로 유형별 개수:');
  Object.entries(types)
    .sort((a, b) => b[1] - a[1])
    .forEach(([type, count]) => {
      console.log(`   - ${type}: ${count}개`);
    });

  // 이름 있는 도로
  const namedPaths = geojson.features.filter(f => f.properties.name).length;
  console.log(`\n   이름 있는 경로: ${namedPaths}개`);

  // 폭 정보 있는 도로
  const widthPaths = geojson.features.filter(f => f.properties.width).length;
  console.log(`   폭 정보 있음: ${widthPaths}개`);

  // 가로등 있는 도로
  const litPaths = geojson.features.filter(f => f.properties.lit === 'yes').length;
  console.log(`   가로등 있음: ${litPaths}개`);

  // 총 길이 추정
  const totalLength = geojson.features.reduce((sum, feature) => {
    const coords = feature.geometry.coordinates;
    let length = 0;
    for (let i = 1; i < coords.length; i++) {
      const [lng1, lat1] = coords[i - 1];
      const [lng2, lat2] = coords[i];
      const dx = (lng2 - lng1) * 111320;
      const dy = (lat2 - lat1) * 110540;
      length += Math.sqrt(dx * dx + dy * dy);
    }
    return sum + length;
  }, 0);

  console.log(`\n   총 보행로 길이: ${(totalLength / 1000).toFixed(2)} km`);
}

/**
 * GeoJSON 파일로 저장
 */
function saveGeoJSON(geojson, filename) {
  const dataDir = path.join(__dirname, '../backend/data/networks');

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const filePath = path.join(dataDir, filename);
  fs.writeFileSync(filePath, JSON.stringify(geojson, null, 2));

  const fileSize = (fs.statSync(filePath).size / 1024 / 1024).toFixed(2);
  console.log(`\n💾 저장 완료: ${filePath}`);
  console.log(`📦 파일 크기: ${fileSize} MB`);
}

/**
 * 메인 실행
 */
async function main() {
  console.log('='.repeat(70));
  console.log('  OpenStreetMap 보행로 데이터 수집 (금천구)');
  console.log('='.repeat(70));
  console.log();

  try {
    // 1. OSM 데이터 수집
    const osmData = await fetchOSMData();

    // 2. GeoJSON 변환
    const geojson = convertToGeoJSON(osmData);

    // 3. 통계 출력
    printStatistics(geojson);

    // 4. 파일 저장
    saveGeoJSON(geojson, 'geumcheon_walking_paths_osm.geojson');

    console.log('\n✅ 모든 작업 완료!');
    console.log('\n💡 다음 단계:');
    console.log('   1. PostgreSQL에 데이터 저장 (KOR.WALKING_PATH 테이블)');
    console.log('   2. Turf.js로 네트워크 그래프 구축');
    console.log('   3. 도달 가능 영역 계산 알고리즘 구현');
    console.log('   4. 기존 원형 분석을 네트워크 분석으로 교체');

  } catch (error) {
    console.error('\n❌ 오류 발생:', error);
    process.exit(1);
  }
}

main();
