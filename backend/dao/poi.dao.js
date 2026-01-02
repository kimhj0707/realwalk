import pool from '../utils/database.js';

/**
 * 특정 위치 주변 POI 조회 (반경 기반)
 * @param {number} lat - 위도
 * @param {number} lng - 경도
 * @param {number} radiusKm - 반경 (킬로미터)
 * @param {string} category - 카테고리 (선택)
 * @returns {Promise<Array>} POI 배열
 */
export async function findNearbyPOIs(lat, lng, radiusKm = 0.5, category = null) {
  // 킬로미터를 미터로 변환
  const radiusMeters = radiusKm * 1000;

  let query = `
    SELECT
      poi_id,
      poi_nm as name,
      ctgry_group_nm as category,
      ST_AsGeoJSON(poi_geom)::json as geometry,
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

  const params = [lat, lng, radiusMeters];

  if (category) {
    query += ` AND ctgry_group_nm = $4`;
    params.push(category);
  }

  query += ` ORDER BY distance LIMIT 500;`;

  const result = await pool.query(query, params);
  return result.rows;
}

/**
 * 카테고리별 POI 조회
 * @param {string} category - 카테고리 그룹명
 * @returns {Promise<Array>} POI 배열
 */
export async function findByCategory(category) {
  const query = `
    SELECT
      poi_id,
      poi_nm as name,
      ctgry_group_nm as category,
      ST_AsGeoJSON(poi_geom)::json as geometry,
      ST_X(poi_geom::geometry) as lng,
      ST_Y(poi_geom::geometry) as lat
    FROM kor.poi
    WHERE ctgry_group_nm = $1
    LIMIT 100;
  `;

  const result = await pool.query(query, [category]);
  return result.rows;
}

/**
 * 금천구 내 모든 카테고리 조회
 * @returns {Promise<Array>} 카테고리 배열
 */
export async function getAllCategories() {
  const query = `
    SELECT DISTINCT ctgry_group_nm as category, COUNT(*) as count
    FROM kor.poi
    GROUP BY ctgry_group_nm
    ORDER BY count DESC;
  `;

  const result = await pool.query(query);
  return result.rows;
}

/**
 * POI 이름으로 검색
 * @param {string} name - 검색할 이름
 * @returns {Promise<Array>} POI 배열
 */
export async function searchByName(name) {
  const query = `
    SELECT
      poi_id,
      poi_nm as name,
      ctgry_group_nm as category,
      ST_AsGeoJSON(poi_geom)::json as geometry,
      ST_X(poi_geom::geometry) as lng,
      ST_Y(poi_geom::geometry) as lat
    FROM kor.poi
    WHERE poi_nm LIKE $1
    LIMIT 50;
  `;

  const result = await pool.query(query, [`%${name}%`]);
  return result.rows;
}

/**
 * POI 총 개수 조회
 * @returns {Promise<number>} POI 수
 */
export async function countAllPOIs() {
  const result = await pool.query('SELECT COUNT(*) as count FROM kor.poi');
  return parseInt(result.rows[0].count);
}
