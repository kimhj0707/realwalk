/**
 * 보행로 DAO
 *
 * KOR.WALKING_PATH 테이블 접근 레이어
 */

import pool from '../utils/database.js';

/**
 * 특정 지점 주변의 보행로 조회
 *
 * @param {number} lat - 위도
 * @param {number} lng - 경도
 * @param {number} radiusKm - 반경 (km)
 * @returns {Promise<Array>} 보행로 배열
 */
export async function findNearbyWalkingPaths(lat, lng, radiusKm = 0.5) {
  const radiusMeters = radiusKm * 1000;

  const query = `
    SELECT
      path_id,
      osm_id,
      highway,
      name,
      ST_AsGeoJSON(path_geom)::json as geometry,
      ST_Distance(
        path_geom::geography,
        ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography
      ) as distance
    FROM KOR.WALKING_PATH
    WHERE ST_DWithin(
      path_geom::geography,
      ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography,
      $3
    )
    ORDER BY distance
  `;

  const result = await pool.query(query, [lat, lng, radiusMeters]);

  return result.rows.map(row => ({
    pathId: row.path_id,
    osmId: row.osm_id,
    highway: row.highway,
    name: row.name,
    geometry: row.geometry,
    distance: parseFloat(row.distance)
  }));
}

/**
 * 모든 보행로를 GeoJSON 형식으로 반환
 * (지도 시각화용)
 *
 * @param {number} limit - 최대 개수
 * @returns {Promise<Object>} GeoJSON FeatureCollection
 */
export async function getAllPathsAsGeoJSON(limit = 5000) {
  const query = `
    SELECT
      jsonb_build_object(
        'type', 'FeatureCollection',
        'features', jsonb_agg(
          jsonb_build_object(
            'type', 'Feature',
            'id', path_id,
            'geometry', ST_AsGeoJSON(path_geom)::jsonb,
            'properties', jsonb_build_object(
              'path_id', path_id,
              'highway', highway,
              'name', name
            )
          )
        )
      ) as geojson
    FROM (
      SELECT * FROM KOR.WALKING_PATH
      LIMIT $1
    ) sub
  `;

  const result = await pool.query(query, [limit]);
  return result.rows[0]?.geojson || { type: 'FeatureCollection', features: [] };
}

/**
 * 통계 조회
 */
export async function getStatistics() {
  const query = `
    SELECT
      COUNT(*) as total_paths,
      COUNT(DISTINCT highway) as highway_types,
      SUM(ST_Length(path_geom::geography)) as total_length_meters
    FROM KOR.WALKING_PATH
  `;

  const result = await pool.query(query);
  const row = result.rows[0];

  return {
    totalPaths: parseInt(row.total_paths),
    highwayTypes: parseInt(row.highway_types),
    totalLengthKm: (parseFloat(row.total_length_meters) / 1000).toFixed(2)
  };
}
