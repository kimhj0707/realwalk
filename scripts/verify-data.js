
import pool from '../backend/utils/database.js';
import * as bldgDao from '../backend/dao/bldg.dao.js';

// --- Configuration ---
// 가산디지털단지역 근처 좌표
const TEST_COORDS = {
  lat: 37.481,
  lng: 126.882
};
const TEST_RADIUS_KM = 0.2; // 200m

async function verifyDataIntegration() {
  console.log('✅ 데이터 통합 검증을 시작합니다...');
  console.log(`- 기준 위치: (${TEST_COORDS.lat}, ${TEST_COORDS.lng})`);
  console.log(`- 분석 반경: ${TEST_RADIUS_KM * 1000}m`);

  let client;
  let foundEntrances = false;

  try {
    client = await pool.connect();
    
    // 1. DAO를 사용하여 주변 건물 조회
    console.log('\n1️⃣  주변 건물을 조회합니다...');
    const nearbyBuildings = await bldgDao.findNearbyBuildings(TEST_COORDS.lat, TEST_COORDS.lng, TEST_RADIUS_KM);

    if (nearbyBuildings.length === 0) {
      console.log('❌ 검증 실패: 기준 위치 주변에서 건물을 찾을 수 없습니다.');
      if (client) client.release();
      return;
    }
    console.log(`👍 ${nearbyBuildings.length}개의 건물을 찾았습니다.`);

    // 2. 첫 번째 건물과 연결된 출입구 조회
    console.log('\n2️⃣  찾은 건물에 출입구가 연결되었는지 확인합니다...');
    for (const building of nearbyBuildings.slice(0, 5)) { // 상위 5개 건물에 대해 검사
      if (!building.bd_mgt_sn) {
        console.log(`- [${building.bldg_nm || '이름 없는 건물'}] (ID: ${building.bldg_id}) - bd_mgt_sn이 없어 출입구를 찾을 수 없습니다.`);
        continue;
      }

      const { rows } = await client.query(
        'SELECT COUNT(*) AS entrance_count FROM kor.bldg_entrance WHERE bd_mgt_sn = $1',
        [building.bd_mgt_sn]
      );
      
      const entranceCount = parseInt(rows[0].entrance_count, 10);

      if (entranceCount > 0) {
        console.log(`- ✅ [${building.bldg_nm || '이름 없는 건물'}] (관리번호: ${building.bd_mgt_sn}) - ${entranceCount}개의 출입구를 찾았습니다!`);
        foundEntrances = true;
      } else {
        console.log(`- ⚠️  [${building.bldg_nm || '이름 없는 건물'}] (관리번호: ${building.bd_mgt_sn}) - 연결된 출입구가 없습니다.`);
      }
    }

    // 3. 최종 결과
    console.log('\n3️⃣  최종 검증 결과:');
    if (foundEntrances) {
      console.log('✅ 성공: 건물 데이터와 출입구 데이터가 성공적으로 연결되었습니다.');
    } else {
      console.log('❌ 실패: 조회된 건물들에서 연결된 출입구를 찾지 못했습니다. 데이터 임포트 과정에 문제가 있을 수 있습니다.');
    }

  } catch (error) {
    console.error('\n💥 검증 중 오류 발생:', error);
  } finally {
    if (client) {
      client.release();
    }
    console.log('\n🔚 검증 스크립트 실행이 완료되었습니다.');
  }
}

verifyDataIntegration().finally(() => {
  // 스크립트가 성공하든 실패하든 풀을 확실히 종료
  pool.end().then(() => console.log('데이터베이스 연결 풀이 정상적으로 종료되었습니다.'));
});
