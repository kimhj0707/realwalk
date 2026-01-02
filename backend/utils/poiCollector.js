/**
 * 카카오 로컬 API로 금천구 POI 수집
 * 73개 → 6,000개 이상 목표
 */

import dotenv from 'dotenv';
import axios from 'axios';
import pool from './database.js';

dotenv.config();

const KAKAO_API_KEY = process.env.KAKAO_REST_API_KEY;
const KAKAO_API_URL = 'https://dapi.kakao.com/v2/local/search/category.json';

// 금천구 경계 (대략적)
const GEUMCHEON_BOUNDS = {
  minLat: 37.436,
  maxLat: 37.491,
  minLng: 126.886,
  maxLng: 126.918
};

// 카카오 카테고리 코드
const CATEGORIES = [
  'MT1',  // 대형마트
  'CS2',  // 편의점
  'PS3',  // 어린이집, 유치원
  'SC4',  // 학교
  'AC5',  // 학원
  'PK6',  // 주차장
  'OL7',  // 주유소, 충전소
  'SW8',  // 지하철역
  'BK9',  // 은행
  'CT1',  // 문화시설
  'AG2',  // 중개업소
  'PO3',  // 공공기관
  'AT4',  // 관광명소
  'AD5',  // 숙박
  'FD6',  // 음식점
  'CE7',  // 카페
  'HP8',  // 병원
  'PM9'   // 약국
];

// 카테고리 한글명 매핑
const CATEGORY_NAMES = {
  'MT1': '대형마트',
  'CS2': '편의점',
  'PS3': '어린이집/유치원',
  'SC4': '학교',
  'AC5': '학원',
  'PK6': '주차장',
  'OL7': '주유소/충전소',
  'SW8': '지하철역',
  'BK9': '은행',
  'CT1': '문화시설',
  'AG2': '중개업소',
  'PO3': '공공기관',
  'AT4': '관광명소',
  'AD5': '숙박',
  'FD6': '음식점',
  'CE7': '카페',
  'HP8': '병원',
  'PM9': '약국'
};

/**
 * 금천구를 격자로 나누기
 * @param {number} gridSize - 격자 크기 (km)
 * @returns {Array} 격자 중심점 배열
 */
function createGrid(gridSize = 0.5) {
  const grid = [];
  const latStep = gridSize / 111;  // 1도 ≈ 111km
  const lngStep = gridSize / (111 * Math.cos(37.46 * Math.PI / 180));  // 위도 보정

  for (let lat = GEUMCHEON_BOUNDS.minLat; lat < GEUMCHEON_BOUNDS.maxLat; lat += latStep) {
    for (let lng = GEUMCHEON_BOUNDS.minLng; lng < GEUMCHEON_BOUNDS.maxLng; lng += lngStep) {
      grid.push({
        lat: lat + latStep / 2,
        lng: lng + lngStep / 2
      });
    }
  }

  return grid;
}

/**
 * 카카오 API로 POI 검색
 * @param {string} category - 카테고리 코드
 * @param {number} x - 경도
 * @param {number} y - 위도
 * @param {number} radius - 반경 (미터, 최대 20000)
 * @returns {Promise<Array>} POI 배열
 */
async function searchPOIs(category, x, y, radius = 500) {
  try {
    const response = await axios.get(KAKAO_API_URL, {
      headers: {
        'Authorization': `KakaoAK ${KAKAO_API_KEY}`
      },
      params: {
        category_group_code: category,
        x: x,
        y: y,
        radius: radius,
        size: 15  // 한 번에 최대 15개
      }
    });

    return response.data.documents || [];

  } catch (error) {
    if (error.response?.status === 429) {
      console.log('⚠️  API 호출 제한 - 1초 대기...');
      await sleep(1000);
      return searchPOIs(category, x, y, radius);  // 재시도
    }
    console.error(`❌ API 에러 (${category}):`, error.message);
    return [];
  }
}

/**
 * POI가 금천구 내에 있는지 확인
 */
function isInGeumcheon(lat, lng) {
  return lat >= GEUMCHEON_BOUNDS.minLat && lat <= GEUMCHEON_BOUNDS.maxLat &&
         lng >= GEUMCHEON_BOUNDS.minLng && lng <= GEUMCHEON_BOUNDS.maxLng;
}

/**
 * POI DB 저장
 */
async function savePOI(poi, categoryCode) {
  const query = `
    INSERT INTO KOR.POI (
      poi_nm,
      ctgry_group_nm,
      category_name,
      poi_geom,
      kakao_id,
      data_source,
      phone,
      address_name,
      road_address_name,
      place_url,
      is_active,
      created_at,
      updated_at
    ) VALUES ($1, $2, $3, ST_SetSRID(ST_MakePoint($4, $5), 4326), $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
    ON CONFLICT (kakao_id) DO UPDATE SET
      poi_nm = EXCLUDED.poi_nm,
      phone = EXCLUDED.phone,
      address_name = EXCLUDED.address_name,
      road_address_name = EXCLUDED.road_address_name,
      place_url = EXCLUDED.place_url,
      is_active = EXCLUDED.is_active,
      updated_at = NOW();
  `;

  const values = [
    poi.place_name,
    CATEGORY_NAMES[categoryCode],
    poi.category_name,
    parseFloat(poi.x),  // 경도
    parseFloat(poi.y),  // 위도
    poi.id,
    'kakao',
    poi.phone || null,
    poi.address_name || null,
    poi.road_address_name || null,
    poi.place_url || null,
    true
  ];

  try {
    await pool.query(query, values);
  } catch (error) {
    // kakao_id 컬럼이 없으면 일반 INSERT
    if (error.code === '42703') {  // undefined_column
      const simpleQuery = `
        INSERT INTO KOR.POI (
          poi_nm,
          ctgry_group_nm,
          poi_geom,
          data_source
        ) VALUES ($1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326), $5);
      `;
      await pool.query(simpleQuery, [
        poi.place_name,
        CATEGORY_NAMES[categoryCode],
        parseFloat(poi.x),
        parseFloat(poi.y),
        'kakao'
      ]);
    } else {
      throw error;
    }
  }
}

/**
 * 대기 함수
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 메인 수집 함수
 */
async function collectPOIs() {
  console.log('🚀 금천구 POI 수집 시작\n');

  // 1. 격자 생성
  const grid = createGrid(0.5);  // 500m 격자
  console.log(`📐 격자 생성 완료: ${grid.length}개 지점\n`);

  // 2. 전체 수집 결과 저장용
  const allPOIs = new Set();  // 중복 제거용 (kakao_id 기준)
  let totalSaved = 0;

  // 3. 카테고리별 수집
  for (const category of CATEGORIES) {
    console.log(`\n📍 카테고리: ${CATEGORY_NAMES[category]} (${category})`);
    let categoryCount = 0;

    for (let i = 0; i < grid.length; i++) {
      const point = grid[i];

      // API 호출
      const pois = await searchPOIs(category, point.lng, point.lat, 500);

      // 금천구 내 POI 필터링 및 저장
      for (const poi of pois) {
        const lat = parseFloat(poi.y);
        const lng = parseFloat(poi.x);

        if (isInGeumcheon(lat, lng)) {
          if (!allPOIs.has(poi.id)) {
            await savePOI(poi, category);
            allPOIs.add(poi.id);
            categoryCount++;
            totalSaved++;
          }
        }
      }

      // 진행률 표시
      if ((i + 1) % 5 === 0) {
        process.stdout.write(`\r   진행: ${i + 1}/${grid.length} (${categoryCount}개 수집)`);
      }

      // API 호출 제한 대응 (0.1초 대기)
      await sleep(100);
    }

    console.log(`\n   ✅ ${CATEGORY_NAMES[category]}: ${categoryCount}개 수집`);
  }

  console.log(`\n\n🎉 수집 완료!`);
  console.log(`   총 ${totalSaved}개 POI 저장됨`);
  console.log(`   중복 제거: ${allPOIs.size}개 유니크 POI`);

  await pool.end();
}

// 스크립트 실행
collectPOIs().catch(error => {
  console.error('❌ 에러 발생:', error);
  process.exit(1);
});
