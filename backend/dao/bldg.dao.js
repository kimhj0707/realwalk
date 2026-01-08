import pool from '../utils/database.js';

/**
 * 금천구 내 특정 위치 주변 건물 조회 (반경 기반)
 * @param {number} lat - 위도
 * @param {number} lng - 경도
 * @param {number} radiusKm - 반경 (킬로미터)
 * @returns {Promise<Array>} 건물 배열
 */
export async function findNearbyBuildings(lat, lng, radiusKm = 0.5) {
  // 킬로미터를 미터로 변환
  const radiusMeters = radiusKm * 1000;

  const query = `
    SELECT
      bldg_id,
      bd_mgt_sn,
      sig_cd,
      lotno_addr,
      road_nm_addr,
      bldg_nm,
      gro_flo_co as ground_floor_count,
      und_flo_co as underground_floor_count,
      bdtyp_cd as building_type_code,
      ST_AsGeoJSON(bldg_geom)::json as geometry,
      ST_Distance(
        bldg_geom::geography,
        ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography
      ) as distance
    FROM kor.bldg
    WHERE ST_DWithin(
      bldg_geom::geography,
      ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography,
      $3
    )
    ORDER BY distance
    LIMIT 500;
  `;

  const result = await pool.query(query, [lat, lng, radiusMeters]);
  return result.rows;
}

/**
 * 금천구 전체 건물 수 조회
 * @returns {Promise<number>} 건물 수
 */
export async function countAllBuildings() {
  const result = await pool.query('SELECT COUNT(*) as count FROM kor.bldg');
  return parseInt(result.rows[0].count);
}

/**
 * ID로 건물 조회
 * @param {number} bldgId - 건물 ID
 * @returns {Promise<Object|null>} 건물 객체 또는 null
 */
export async function findById(bldgId) {
  const query = `
    SELECT
      bldg_id,
      bd_mgt_sn,
      sig_cd,
      lotno_addr,
      road_nm_addr,
      bldg_nm,
      gro_flo_co as ground_floor_count,
      und_flo_co as underground_floor_count,
      bdtyp_cd as building_type_code,
      ST_AsGeoJSON(bldg_geom)::json as geometry
    FROM kor.bldg
    WHERE bldg_id = $1;
  `;

  const result = await pool.query(query, [bldgId]);
  return result.rows[0] || null;
}

/**
 * 금천구 내 모든 건물 조회 (페이징)
 * @param {number} limit - 조회 개수
 * @param {number} offset - 시작 위치
 * @returns {Promise<Array>} 건물 배열
 */
export async function findAll(limit = 100, offset = 0) {
  const query = `
    SELECT
      bldg_id,
      bd_mgt_sn,
      sig_cd,
      lotno_addr,
      road_nm_addr,
      bldg_nm,
      gro_flo_co as ground_floor_count,
      und_flo_co as underground_floor_count,
      bdtyp_cd as building_type_code,
      ST_AsGeoJSON(bldg_geom)::json as geometry
    FROM kor.bldg
    ORDER BY bldg_id
    LIMIT $1 OFFSET $2;
  `;

  const result = await pool.query(query, [limit, offset]);
  return result.rows;
}
