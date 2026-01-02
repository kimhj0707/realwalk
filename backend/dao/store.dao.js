import pool from '../utils/database.js';

/**
 * 특정 위치 주변 상가 조회 (반경 기반)
 * @param {number} lat - 위도
 * @param {number} lng - 경도
 * @param {number} radiusKm - 반경 (킬로미터)
 * @param {string} categoryLarge - 대분류 카테고리 (선택)
 * @returns {Promise<Array>} 상가 배열
 */
export async function findNearbyStores(lat, lng, radiusKm = 0.5, categoryLarge = null) {
  const radiusMeters = radiusKm * 1000;

  let query = `
    SELECT
      store_id,
      store_code,
      store_nm as name,
      branch_nm as branch,
      category_large,
      category_medium,
      category_small,
      industry_code,
      industry_nm as industry_name,
      dong,
      address_jibun,
      address_road,
      building_nm as building_name,
      floor_info,
      ho_info,
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
  `;

  const params = [lat, lng, radiusMeters];

  if (categoryLarge) {
    query += ` AND category_large = $4`;
    params.push(categoryLarge);
  }

  query += ` ORDER BY distance LIMIT 1000;`;

  const result = await pool.query(query, params);
  return result.rows;
}

/**
 * 카테고리별 상가 조회
 * @param {string} categoryLarge - 대분류 카테고리
 * @param {number} limit - 최대 개수 (기본 100)
 * @returns {Promise<Array>} 상가 배열
 */
export async function findByCategory(categoryLarge, limit = 100) {
  const query = `
    SELECT
      store_id,
      store_code,
      store_nm as name,
      category_large,
      category_medium,
      category_small,
      dong,
      address_road,
      ST_X(geom) as lng,
      ST_Y(geom) as lat
    FROM KOR.STORE
    WHERE category_large = $1
    LIMIT $2;
  `;

  const result = await pool.query(query, [categoryLarge, limit]);
  return result.rows;
}

/**
 * 금천구 내 모든 카테고리 조회
 * @returns {Promise<Array>} 카테고리 배열 (대분류 기준)
 */
export async function getAllCategories() {
  const query = `
    SELECT
      category_large as category,
      COUNT(*) as count
    FROM KOR.STORE
    GROUP BY category_large
    ORDER BY count DESC;
  `;

  const result = await pool.query(query);
  return result.rows;
}

/**
 * 동별 상가 통계
 * @returns {Promise<Array>} 동별 상가 개수
 */
export async function getStoresByDong() {
  const query = `
    SELECT
      dong,
      COUNT(*) as count,
      COUNT(DISTINCT category_large) as category_count
    FROM KOR.STORE
    GROUP BY dong
    ORDER BY count DESC;
  `;

  const result = await pool.query(query);
  return result.rows;
}

/**
 * 특정 위치의 상가 밀도 계산
 * @param {number} lat - 위도
 * @param {number} lng - 경도
 * @param {number} radiusKm - 반경 (킬로미터)
 * @returns {Promise<Object>} 밀도 정보 (총 개수, 카테고리별 분포)
 */
export async function getStoreDensity(lat, lng, radiusKm = 0.5) {
  const radiusMeters = radiusKm * 1000;

  // 총 개수 및 카테고리별 분포
  const query = `
    SELECT
      COUNT(*) as total_count,
      COUNT(DISTINCT category_large) as category_count,
      json_object_agg(
        category_large,
        category_cnt
      ) as category_distribution
    FROM (
      SELECT
        category_large,
        COUNT(*) as category_cnt
      FROM KOR.STORE
      WHERE ST_DWithin(
        geom::geography,
        ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography,
        $3
      )
      GROUP BY category_large
    ) subquery;
  `;

  const result = await pool.query(query, [lat, lng, radiusMeters]);
  return result.rows[0];
}

/**
 * 특정 업종의 경쟁 상가 조회 (거리순)
 * @param {number} lat - 위도
 * @param {number} lng - 경도
 * @param {string} categoryMedium - 중분류 카테고리 (예: "한식음식점업")
 * @param {number} radiusKm - 반경 (킬로미터)
 * @returns {Promise<Array>} 경쟁 상가 배열
 */
export async function findCompetitors(lat, lng, categoryMedium, radiusKm = 0.5) {
  const radiusMeters = radiusKm * 1000;

  const query = `
    SELECT
      store_id,
      store_nm as name,
      branch_nm as branch,
      category_medium,
      category_small,
      address_road,
      building_nm as building_name,
      floor_info,
      ST_X(geom) as lng,
      ST_Y(geom) as lat,
      ST_Distance(
        geom::geography,
        ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography
      ) as distance
    FROM KOR.STORE
    WHERE category_medium = $3
      AND ST_DWithin(
        geom::geography,
        ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography,
        $4
      )
    ORDER BY distance
    LIMIT 50;
  `;

  const result = await pool.query(query, [lat, lng, categoryMedium, radiusMeters]);
  return result.rows;
}

/**
 * 상가 ID로 상세 정보 조회
 * @param {number} storeId - 상가 ID
 * @returns {Promise<Object>} 상가 상세 정보
 */
export async function findById(storeId) {
  const query = `
    SELECT
      store_id,
      store_code,
      store_nm as name,
      branch_nm as branch,
      category_large,
      category_medium,
      category_small,
      industry_code,
      industry_nm as industry_name,
      dong,
      address_jibun,
      address_road,
      building_nm as building_name,
      floor_info,
      ho_info,
      ST_X(geom) as lng,
      ST_Y(geom) as lat,
      created_at,
      updated_at
    FROM KOR.STORE
    WHERE store_id = $1;
  `;

  const result = await pool.query(query, [storeId]);
  return result.rows[0];
}

/**
 * 상가 총 개수 조회
 * @returns {Promise<number>} 총 상가 개수
 */
export async function getTotalCount() {
  const query = `SELECT COUNT(*) as count FROM KOR.STORE;`;
  const result = await pool.query(query);
  return parseInt(result.rows[0].count);
}
