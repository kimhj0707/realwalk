import pool from '../utils/database.js';
import * as poiDao from './poi.dao.js';
import * as storeDao from './store.dao.js';
import { getMapping } from '../utils/categoryMapping.js';
import * as turf from '@turf/turf';

/**
 * POI와 STORE를 통합하여 경쟁업체 검색 (하이브리드 방식)
 *
 * @param {number} lat - 위도
 * @param {number} lng - 경도
 * @param {number} radiusMeters - 반경 (미터)
 * @param {string} businessType - 업종 타입 (cafe, chicken 등)
 * @param {number} networkDistance - 네트워크 거리 (선택, 미터)
 * @returns {Promise<Array>} 통합된 경쟁업체 배열
 */
export async function findCompetitorsHybrid(lat, lng, radiusMeters, businessType, networkDistance = null) {
  const startTime = Date.now();

  // 카테고리 매핑 정보 가져오기
  const mapping = getMapping(businessType);
  if (!mapping) {
    console.warn(`⚠️  매핑되지 않은 업종: ${businessType}`);
    return [];
  }

  const { poi, store } = mapping;

  // 1. POI에서 경쟁업체 검색
  const poiResults = await findCompetitorsFromPOI(lat, lng, radiusMeters, poi);

  // 2. STORE에서 경쟁업체 검색
  const storeResults = await findCompetitorsFromSTORE(lat, lng, radiusMeters, store);

  // 3. 통합 및 중복 제거
  const mergedResults = mergeAndDeduplicate(poiResults, storeResults);

  // 4. 네트워크 거리로 필터링 (선택사항)
  let finalResults = mergedResults;
  if (networkDistance) {
    finalResults = mergedResults.filter(comp => {
      const netDist = comp.networkDistance || comp.distance;
      return netDist <= networkDistance;
    });
  }

  const elapsed = Date.now() - startTime;
  console.log(`🔍 하이브리드 경쟁업체 검색: POI ${poiResults.length}개 + STORE ${storeResults.length}개 → 통합 ${mergedResults.length}개 (${elapsed}ms)`);

  return finalResults;
}

/**
 * POI 테이블에서 경쟁업체 검색
 *
 * @param {number} lat - 위도
 * @param {number} lng - 경도
 * @param {number} radiusMeters - 반경 (미터)
 * @param {Object} poiMapping - POI 매핑 정보 { categories, keywords }
 * @returns {Promise<Array>} POI 경쟁업체 배열
 */
async function findCompetitorsFromPOI(lat, lng, radiusMeters, poiMapping) {
  const { categories, keywords } = poiMapping;

  if (categories.length === 0) {
    return [];
  }

  // 카테고리 기반 검색
  const categoryConditions = categories.map((cat, idx) => `ctgry_group_nm = $${idx + 4}`).join(' OR ');

  let query = `
    SELECT
      poi_id as id,
      'POI' as source,
      poi_nm as name,
      NULL as branch,
      ctgry_group_nm as category,
      NULL as category_medium,
      NULL as category_small,
      ST_X(poi_geom::geometry) as lng,
      ST_Y(poi_geom::geometry) as lat,
      ST_Distance(
        poi_geom::geography,
        ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography
      ) as distance
    FROM kor.poi
    WHERE ST_DWithin(
      poi_geom::geography,
      ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography,
      $3
    )
  `;

  // 카테고리 조건 추가
  if (categories.length > 0) {
    query += ` AND (${categoryConditions})`;
  }

  // 키워드가 있는 경우 이름 필터링 추가
  if (keywords.length > 0) {
    const keywordConditions = keywords.map((_, idx) => `poi_nm LIKE $${categories.length + 4 + idx}`).join(' OR ');
    query += ` AND (${keywordConditions})`;
  }

  query += ` ORDER BY distance LIMIT 200;`;

  const params = [lat, lng, radiusMeters, ...categories];
  if (keywords.length > 0) {
    params.push(...keywords.map(kw => `%${kw}%`));
  }

  try {
    const result = await pool.query(query, params);
    return result.rows;
  } catch (error) {
    console.error('POI 경쟁업체 검색 오류:', error.message);
    return [];
  }
}

/**
 * STORE 테이블에서 경쟁업체 검색
 *
 * @param {number} lat - 위도
 * @param {number} lng - 경도
 * @param {number} radiusMeters - 반경 (미터)
 * @param {Object} storeMapping - STORE 매핑 정보 { industryNames, categoryMedium }
 * @returns {Promise<Array>} STORE 경쟁업체 배열
 */
async function findCompetitorsFromSTORE(lat, lng, radiusMeters, storeMapping) {
  const { industryNames, categoryMedium } = storeMapping;

  if (industryNames.length === 0 && categoryMedium.length === 0) {
    return [];
  }

  let conditions = [];
  let params = [lat, lng, radiusMeters];
  let paramIndex = 4;

  // 업종명 조건
  if (industryNames.length > 0) {
    const industryConditions = industryNames.map(() => `industry_nm = $${paramIndex++}`).join(' OR ');
    conditions.push(`(${industryConditions})`);
    params.push(...industryNames);
  }

  // 중분류 카테고리 조건
  if (categoryMedium.length > 0) {
    const categoryConditions = categoryMedium.map(() => `category_medium = $${paramIndex++}`).join(' OR ');
    conditions.push(`(${categoryConditions})`);
    params.push(...categoryMedium);
  }

  const whereClause = conditions.length > 0 ? ` AND (${conditions.join(' OR ')})` : '';

  const query = `
    SELECT
      store_id as id,
      'STORE' as source,
      store_nm as name,
      branch_nm as branch,
      category_large as category,
      category_medium,
      category_small,
      ST_X(geom) as lng,
      ST_Y(geom) as lat,
      ST_Distance(
        geom::geography,
        ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography
      ) as distance
    FROM KOR.STORE
    WHERE ST_DWithin(
      geom::geography,
      ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography,
      $3
    )
    ${whereClause}
    ORDER BY distance
    LIMIT 200;
  `;

  try {
    const result = await pool.query(query, params);
    return result.rows;
  } catch (error) {
    console.error('STORE 경쟁업체 검색 오류:', error.message);
    return [];
  }
}

/**
 * POI와 STORE 결과를 통합하고 중복 제거
 *
 * 같은 위치(10m 이내)에 있는 업체는 중복으로 간주하고 POI를 우선합니다.
 *
 * @param {Array} poiResults - POI 검색 결과
 * @param {Array} storeResults - STORE 검색 결과
 * @returns {Array} 중복 제거된 통합 결과
 */
function mergeAndDeduplicate(poiResults, storeResults) {
  const DUPLICATE_THRESHOLD_METERS = 10; // 10m 이내 동일 업체로 간주

  // 모든 결과를 하나의 배열로 통합
  const allResults = [...poiResults, ...storeResults];

  // 중복 제거: POI 우선, 거리 기준 정렬 후 10m 이내 중복 제거
  const deduplicated = [];
  const usedPositions = [];

  // 거리순으로 정렬
  allResults.sort((a, b) => a.distance - b.distance);

  for (const competitor of allResults) {
    // 이미 사용된 위치와 비교
    const isDuplicate = usedPositions.some(used => {
      const distance = calculateDistance(
        { lat: competitor.lat, lng: competitor.lng },
        { lat: used.lat, lng: used.lng }
      );
      return distance <= DUPLICATE_THRESHOLD_METERS;
    });

    if (!isDuplicate) {
      deduplicated.push(competitor);
      usedPositions.push({ lat: competitor.lat, lng: competitor.lng });
    } else {
      console.log(`🔄 중복 제거: ${competitor.name} (${competitor.source}) - 10m 이내 동일 위치`);
    }
  }

  return deduplicated;
}

/**
 * 두 지점 간 직선 거리 계산 (Haversine 공식)
 *
 * @param {Object} point1 - { lat, lng }
 * @param {Object} point2 - { lat, lng }
 * @returns {number} 거리 (미터)
 */
function calculateDistance(point1, point2) {
  const from = turf.point([point1.lng, point1.lat]);
  const to = turf.point([point2.lng, point2.lat]);
  return turf.distance(from, to, { units: 'meters' });
}

/**
 * 경쟁업체에 추가 정보 첨부 (디버깅용)
 *
 * @param {Array} competitors - 경쟁업체 배열
 * @returns {Array} 정보가 첨부된 경쟁업체 배열
 */
export function enrichCompetitors(competitors) {
  return competitors.map(comp => ({
    ...comp,
    displayName: comp.branch ? `${comp.name} ${comp.branch}` : comp.name,
    sourceLabel: comp.source === 'POI' ? '📍 POI' : '🏪 STORE'
  }));
}
