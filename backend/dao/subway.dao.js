/**
 * 지하철역 데이터 접근 객체 (DAO)
 */

import pool from '../utils/database.js';

/**
 * 특정 좌표 주변의 지하철역 조회
 * @param {number} lat - 위도
 * @param {number} lng - 경도
 * @param {number} radiusKm - 반경 (km)
 * @returns {Promise<Array>} 주변 지하철역 배열
 */
export async function findNearbySubways(lat, lng, radiusKm) {
  const radiusMeters = radiusKm * 1000;

  const query = `
    SELECT
      station_name as name,
      line,
      daily_total as daily_users,
      data_source,
      ST_Y(station_geom::geometry) as lat,
      ST_X(station_geom::geometry) as lng,
      ST_Distance(
        station_geom::geography,
        ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography
      ) as distance
    FROM kor.subway_station
    WHERE ST_DWithin(
      station_geom::geography,
      ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography,
      $3
    )
    ORDER BY distance;
  `;

  const result = await pool.query(query, [lat, lng, radiusMeters]);
  return result.rows;
}

/**
 * 모든 지하철역 조회
 * @returns {Promise<Array>} 전체 지하철역 배열
 */
export async function getAllSubways() {
  const query = `
    SELECT
      station_name as name,
      line,
      daily_total as daily_users,
      ST_Y(station_geom::geometry) as lat,
      ST_X(station_geom::geometry) as lng
    FROM kor.subway_station
    ORDER BY daily_users DESC;
  `;

  const result = await pool.query(query);
  return result.rows;
}
