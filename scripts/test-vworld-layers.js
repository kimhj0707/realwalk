import dotenv from 'dotenv';
dotenv.config();

const VWORLD_KEY = process.env.VWORLD_API_KEY;
const bbox = '126.886,37.436,126.918,37.491';

const layers = [
  'lt_c_uq121',      // 용도지역지구
  'lp_uq_121',       // 용도지역
  'lt_c_upisuq',     // 도시계획시설
  'lp_pa_cbnd',      // 연속지적도
  'lt_c_spbd',       // 건물 폴리곤
  'lt_l_moctlink'    // 도로 네트워크
];

async function testLayers() {
  for (const layer of layers) {
    const url = `http://api.vworld.kr/req/wfs?service=wfs&version=2.0.0&request=GetFeature&typeName=${layer}&outputFormat=application/json&srsName=EPSG:4326&bbox=${bbox},EPSG:4326&key=${VWORLD_KEY}&maxFeatures=5`;

    console.log(`\n🔍 테스트: ${layer}`);

    try {
      const res = await fetch(url);
      const data = await res.json();
      const count = data.features?.length || 0;

      console.log(`   결과: ${count}개`);

      if (count > 0) {
        console.log('   ✅ 성공! 속성 키:', Object.keys(data.features[0].properties).join(', '));
        console.log('   첫 번째 값:', JSON.stringify(data.features[0].properties).substring(0, 150) + '...');
      }
    } catch (e) {
      console.log(`   ❌ 에러: ${e.message}`);
    }
  }
}

console.log('=' .repeat(60));
console.log('V-World 레이어 테스트');
console.log('='.repeat(60));

testLayers().then(() => console.log('\n✨ 테스트 완료!'));
