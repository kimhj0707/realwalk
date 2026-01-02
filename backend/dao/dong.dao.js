import pool from '../utils/database.js';

/**
 * 좌표로 해당하는 동(행정동) 찾기 (Point-in-Polygon 검색)
 * @param {number} lat - 위도
 * @param {number} lng - 경도
 * @returns {Promise<Object|null>} 동 정보 (없으면 null)
 */
export async function findDongByCoordinates(lat, lng) {
  const query = `
    SELECT
      dong_id,
      emd_cd,
      dong_nm,
      dong_eng_nm,
      full_nm
    FROM KOR.DONG
    WHERE ST_Contains(
      geom,
      ST_SetSRID(ST_MakePoint($2, $1), 4326)
    )
    LIMIT 1;
  `;

  const result = await pool.query(query, [lat, lng]);
  return result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * 모든 동 목록 조회
 * @returns {Promise<Array>} 동 목록
 */
export async function getAllDongs() {
  const query = `
    SELECT
      dong_id,
      emd_cd,
      dong_nm,
      dong_eng_nm,
      full_nm
    FROM KOR.DONG
    ORDER BY dong_nm;
  `;

  const result = await pool.query(query);
  return result.rows;
}

/**
 * 특정 동의 통계 정보 조회
 * @param {string} dongNm - 동 이름 (예: '가산동')
 * @returns {Promise<Object>} 동 통계 정보
 */
export async function getDongStatistics(dongNm) {
  const query = `
    SELECT
      (SELECT COUNT(*) FROM KOR.BLDG b, KOR.DONG d
       WHERE d.dong_nm = $1 AND ST_Contains(d.geom, b.bldg_geom)) as building_count,
      (SELECT COUNT(*) FROM KOR.POI p, KOR.DONG d
       WHERE d.dong_nm = $1 AND ST_Contains(d.geom, p.poi_geom)) as poi_count,
      (SELECT COUNT(*) FROM KOR.STORE s, KOR.DONG d
       WHERE d.dong_nm = $1 AND ST_Contains(d.geom, s.geom)) as store_count
  `;

  const result = await pool.query(query, [dongNm]);
  return result.rows[0];
}

/**
 * 동별 상가 카테고리 통계
 * @param {string} dongNm - 동 이름
 * @returns {Promise<Array>} 카테고리별 통계
 */
export async function getDongStoreCategories(dongNm) {
  const query = `
    SELECT
      s.category_large,
      COUNT(*) as count
    FROM KOR.STORE s
    JOIN KOR.DONG d ON ST_Contains(d.geom, s.geom)
    WHERE d.dong_nm = $1
    GROUP BY s.category_large
    ORDER BY count DESC;
  `;

  const result = await pool.query(query, [dongNm]);
  return result.rows;
}

/**
 * 동 이름으로 동 정보 조회
 * @param {string} dongNm - 동 이름
 * @returns {Promise<Object|null>} 동 정보
 */
export async function findDongByName(dongNm) {
  const query = `
    SELECT
      dong_id,
      emd_cd,
      dong_nm,
      dong_eng_nm,
      full_nm,
      ST_AsGeoJSON(geom)::json as geometry
    FROM KOR.DONG
    WHERE dong_nm = $1
    LIMIT 1;
  `;

  const result = await pool.query(query, [dongNm]);
  return result.rows.length > 0 ? result.rows[0] : null;
}
