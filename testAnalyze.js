/**
 * 분석 API 테스트
 */

async function testAnalyze() {
  const testAddress = '서울시 금천구 시흥대로 73길 70';
  const testBusiness = 'cafe';

  console.log('🧪 분석 API 테스트 시작...\n');
  console.log(`📍 주소: ${testAddress}`);
  console.log(`🏪 업종: ${testBusiness}\n`);

  try {
    const response = await fetch('http://localhost:3000/api/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        address: testAddress,
        business: testBusiness
      })
    });

    const data = await response.json();

    // 전체 응답 구조 확인 (디버깅용)
    console.log('\n=== DEBUG: 전체 응답 구조 ===');
    console.log(JSON.stringify(data, null, 2).substring(0, 1000));
    console.log('...\n');

    if (!data.success) {
      console.error('❌ 분석 실패:', data.error);
      return;
    }

    console.log('✅ 분석 성공!\n');
    console.log('=== 분석 결과 ===\n');
    console.log(`📌 주소: ${data.result.address}`);
    console.log(`📍 좌표: ${data.result.coordinates.lat}, ${data.result.coordinates.lng}`);
    console.log(`⭐ 최종 점수: ${data.result.score || 'N/A'}`);
    console.log(`🏢 주변 건물: ${data.result.buildingCount}개`);
    console.log(`📍 주변 POI: ${data.result.poiCount}개`);
    console.log(`🏪 주변 상가: ${data.result.nearbyStores?.length || 0}개`);
    console.log(`🚇 인근 지하철역: ${data.result.nearbySubways?.length || 0}개`);
    console.log(`⚔️  경쟁업체: ${data.result.competitorCount}개`);
    console.log(`📊 포화도: ${data.result.saturation}%`);

    // 동 정보
    if (data.result.dongInfo) {
      console.log(`\n=== 동 정보 ===`);
      console.log(`동 이름: ${data.result.dongInfo.dongNm}`);
      console.log(`전체 주소: ${data.result.dongInfo.fullNm}`);
      console.log(`동 전체 건물: ${data.result.dongInfo.buildingCount.toLocaleString()}개`);
      console.log(`동 전체 시설: ${data.result.dongInfo.poiCount.toLocaleString()}개`);
      console.log(`동 전체 상가: ${data.result.dongInfo.storeCount.toLocaleString()}개`);
    }

    // 상가 밀도 정보
    if (data.result.storeDensity) {
      console.log(`\n=== 상가 밀도 정보 ===`);
      console.log(`총 상가 수: ${data.result.storeDensity.totalCount}개`);
      console.log(`카테고리 수: ${data.result.storeDensity.categoryCount}개`);

      const categoryDist = data.result.storeDensity.categoryDistribution;
      if (categoryDist && Object.keys(categoryDist).length > 0) {
        console.log('\n카테고리별 분포 (상위 5개):');
        Object.entries(categoryDist)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .forEach(([category, count]) => {
            console.log(`  - ${category}: ${count}개`);
          });
      }
    }

    // 상위 5개 상가
    if (data.result.nearbyStores && data.result.nearbyStores.length > 0) {
      console.log(`\n=== 주변 상가 (상위 5개) ===`);
      data.result.nearbyStores.slice(0, 5).forEach((store, index) => {
        console.log(`${index + 1}. ${store.name}${store.branch ? ` (${store.branch})` : ''}`);
        console.log(`   - 카테고리: ${store.categorySmall || store.categoryMedium || store.category}`);
        console.log(`   - 주소: ${store.address || 'N/A'}`);
        console.log(`   - 거리: ${store.distance}m`);
      });
    }

    console.log('\n✅ 테스트 완료!');

  } catch (error) {
    console.error('❌ 테스트 실패:', error.message);
  }
}

testAnalyze();
