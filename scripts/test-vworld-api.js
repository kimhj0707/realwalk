/**
 * V-World API 테스트 - 사용 가능한 레이어 확인
 */

import fetch from 'node-fetch';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const VWORLD_API_KEY = process.env.VWORLD_API_KEY;

// 금천구 중심점
const CENTER = {
  lat: 37.4565,
  lng: 126.8956
};

async function testLayer(layerName, description) {
  console.log(`\n테스트: ${description} (${layerName})`);
  console.log('-'.repeat(60));

  const wfsUrl = new URL('http://api.vworld.kr/req/wfs');
  wfsUrl.searchParams.append('service', 'wfs');
  wfsUrl.searchParams.append('version', '2.0.0');
  wfsUrl.searchParams.append('request', 'GetFeature');
  wfsUrl.searchParams.append('typeName', layerName);
  wfsUrl.searchParams.append('outputFormat', 'application/json');
  wfsUrl.searchParams.append('srsName', 'EPSG:4326');
  wfsUrl.searchParams.append('key', VWORLD_API_KEY);
  wfsUrl.searchParams.append('maxFeatures', '10'); // 테스트용 소량만

  // 금천구 중심 주변만
  const bbox = `${CENTER.lng - 0.01},${CENTER.lat - 0.01},${CENTER.lng + 0.01},${CENTER.lat + 0.01},EPSG:4326`;
  wfsUrl.searchParams.append('bbox', bbox);

  try {
    const response = await fetch(wfsUrl.toString(), { timeout: 10000 });
    const data = await response.json();

    if (data.features && data.features.length > 0) {
      console.log(`✅ 성공! ${data.features.length}개 피처 발견`);
      console.log(`   첫 번째 피처 속성:`, Object.keys(data.features[0].properties).slice(0, 10).join(', '));
      return true;
    } else {
      console.log(`❌ 데이터 없음`);
      return false;
    }
  } catch (error) {
    console.log(`❌ 오류: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('  V-World API 레이어 테스트');
  console.log('='.repeat(60));

  if (!VWORLD_API_KEY) {
    console.error('\n❌ VWORLD_API_KEY가 설정되지 않았습니다.');
    process.exit(1);
  }

  console.log(`\n🔑 API Key: ${VWORLD_API_KEY.substring(0, 10)}...`);
  console.log(`📍 테스트 지역: 금천구 중심 (${CENTER.lat}, ${CENTER.lng})`);

  // 다양한 레이어 테스트
  const layers = [
    ['lt_c_spbd', '건물 외곽선'],
    ['lt_l_moctlink', '도로 네트워크 (국토부)'],
    ['lp_pa_cbnd_bonbun', '지적도 (필지)'],
    ['lt_l_uslink', '도로 (일반)'],
    ['lp_uq_121', '용도지역'],
  ];

  const results = [];
  for (const [layerName, description] of layers) {
    const success = await testLayer(layerName, description);
    results.push({ layerName, description, success });
    await new Promise(resolve => setTimeout(resolve, 1000)); // 1초 대기
  }

  console.log('\n' + '='.repeat(60));
  console.log('  결과 요약');
  console.log('='.repeat(60));

  results.forEach(({ layerName, description, success }) => {
    console.log(`${success ? '✅' : '❌'} ${description} (${layerName})`);
  });

  const successCount = results.filter(r => r.success).length;
  console.log(`\n총 ${results.length}개 중 ${successCount}개 레이어 사용 가능`);
}

main();
