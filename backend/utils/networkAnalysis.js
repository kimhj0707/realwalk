/**
 * 네트워크 기반 공간 분석 유틸리티
 *
 * 실제 보행로 네트워크를 사용한 도달 가능 영역 계산
 * - 직선거리 X
 * - 실제 보행 가능 경로 O
 */

import * as turf from '@turf/turf';

/**
 * 보행로 네트워크에서 실제 도달 가능한 영역 계산
 *
 * @param {Object} startPoint - 시작점 {lat, lng}
 * @param {Array} walkingPaths - 보행로 배열 (GeoJSON features)
 * @param {number} maxDistanceMeters - 최대 보행 거리 (미터)
 * @returns {Object|null} 도달 가능 영역 (GeoJSON Geometry) 또는 null
 */
export function calculateReachableArea(startPoint, walkingPaths, maxDistanceMeters = 500) {
  try {
    const start = turf.point([startPoint.lng, startPoint.lat]);

    if (!walkingPaths || walkingPaths.length === 0) {
        console.warn('⚠️ No walking paths provided, returning small buffer around start point.');
        const bufferedPoint = turf.buffer(start, 50, { units: 'meters' });
        return bufferedPoint.geometry;
    }

    // 1. 타겟 위치에서 가까운 보행로만 선택 (연결성 확인)
    // 각 보행로의 가장 가까운 지점이 타겟에서 100m 이내인 것만 포함
    const connectedPaths = walkingPaths.filter(path => {
      const line = turf.lineString(path.geometry.coordinates);
      const nearestPoint = turf.nearestPointOnLine(line, start);
      const distanceToPath = turf.distance(start, nearestPoint, { units: 'meters' });
      return distanceToPath <= 100; // 100m 이내의 보행로만 포함
    });

    if (connectedPaths.length === 0) {
        console.warn('⚠️ No connected walking paths found, returning buffer around start point.');
        const bufferedPoint = turf.buffer(start, maxDistanceMeters, { units: 'meters' });
        return bufferedPoint.geometry;
    }

    console.log(`🔗 Connected paths: ${connectedPaths.length}/${walkingPaths.length} (within 100m)`);

    // 2. 연결된 보행로에 대해서만 버퍼 생성
    const reachablePathLines = connectedPaths.map(p => turf.lineString(p.geometry.coordinates));
    const featureCollection = turf.featureCollection(reachablePathLines);
    const buffered = turf.buffer(featureCollection, 20, { units: 'meters' });

    if (!buffered || !buffered.features || buffered.features.length === 0) {
        console.error('⚠️ Buffering walking paths resulted in no features.');
        return null;
    }

    const dissolved = turf.dissolve(buffered);

    if (dissolved && dissolved.features.length > 0 && dissolved.features[0].geometry) {
        return dissolved.features[0].geometry;
    }

    console.error('⚠️ Dissolve failed, returning null.');
    return null;

  } catch (error) {
    console.error('⚠️ Error in calculateReachableArea:', error.message);
    const fallbackPoint = turf.point([startPoint.lng, startPoint.lat]);
    const bufferedFallback = turf.buffer(fallbackPoint, 20, { units: 'meters' });
    return bufferedFallback ? bufferedFallback.geometry : null;
  }
}


/**
 * 경로에서 도달 가능한 부분만 추출
 *
 * @param {Object} line - Turf LineString
 * @param {Object} startPoint - 시작점 (Turf Point)
 * @param {number} distance - 도달 가능 거리 (미터)
 * @returns {Object} 도달 가능한 경로 세그먼트
 */
function getReachableSegment(line, startPoint, distance) {
  try {
    const totalLength = turf.length(line, { units: 'meters' });

    if (distance >= totalLength) {
      // 전체 경로 도달 가능
      return line;
    }

    // 경로를 따라 distance만큼 이동한 지점 찾기
    const along = turf.along(line, distance, { units: 'meters' });

    // 시작점부터 해당 지점까지의 세그먼트 생성
    // (간단화를 위해 전체 경로 반환)
    return line;

  } catch (error) {
    return line;
  }
}

/**
 * 네트워크 거리 계산 (실제 경로 기반)
 *
 * 두 지점 간의 직선거리가 아닌, 실제 보행로를 따라 이동하는 거리 계산
 *
 * @param {Object} pointA - 시작점 {lat, lng}
 * @param {Object} pointB - 도착점 {lat, lng}
 * @param {Array} walkingPaths - 보행로 배열
 * @returns {number} 네트워크 거리 (미터)
 */
export function calculateNetworkDistance(pointA, pointB, walkingPaths) {
  try {
    const start = turf.point([pointA.lng, pointA.lat]);
    const end = turf.point([pointB.lng, pointB.lat]);

    // 간단한 구현: 가장 가까운 경로들을 연결
    // (실제로는 Dijkstra 알고리즘 등 사용 필요)

    // 1. 시작점과 도착점에 가장 가까운 경로 찾기
    let minDistStart = Infinity;
    let minDistEnd = Infinity;
    let nearestPathStart = null;
    let nearestPathEnd = null;

    for (const path of walkingPaths) {
      const line = turf.lineString(path.geometry.coordinates);

      const nearStart = turf.nearestPointOnLine(line, start);
      const distStart = turf.distance(start, nearStart, { units: 'meters' });

      const nearEnd = turf.nearestPointOnLine(line, end);
      const distEnd = turf.distance(end, nearEnd, { units: 'meters' });

      if (distStart < minDistStart) {
        minDistStart = distStart;
        nearestPathStart = { path, nearPoint: nearStart };
      }

      if (distEnd < minDistEnd) {
        minDistEnd = distEnd;
        nearestPathEnd = { path, nearPoint: nearEnd };
      }
    }

    // 2. 경로 거리 계산
    let pathDistance = 0;

    if (nearestPathStart && nearestPathEnd) {
      if (nearestPathStart.path.pathId === nearestPathEnd.path.pathId) {
        // 같은 경로에 있는 경우
        pathDistance = turf.distance(
          nearestPathStart.nearPoint,
          nearestPathEnd.nearPoint,
          { units: 'meters' }
        );
      } else {
        // 다른 경로인 경우 (간단화: 두 경로의 길이 합)
        const line1 = turf.lineString(nearestPathStart.path.geometry.coordinates);
        const line2 = turf.lineString(nearestPathEnd.path.geometry.coordinates);
        pathDistance = turf.length(line1, { units: 'meters' }) +
                      turf.length(line2, { units: 'meters' });
      }
    }

    // 3. 총 거리 = 시작점→경로 + 경로 거리 + 경로→도착점
    const totalDistance = minDistStart + pathDistance + minDistEnd;

    return totalDistance;

  } catch (error) {
    console.error('네트워크 거리 계산 실패:', error);
    // 실패 시 직선거리 반환
    const start = turf.point([pointA.lng, pointA.lat]);
    const end = turf.point([pointB.lng, pointB.lat]);
    return turf.distance(start, end, { units: 'meters' });
  }
}

/**
 * 네트워크 기반 POI/건물 필터링
 *
 * 직선거리가 아닌 실제 보행 거리로 필터링
 *
 * @param {Object} targetPoint - 기준점 {lat, lng}
 * @param {Array} pois - POI 배열
 * @param {Array} walkingPaths - 보행로 배열
 * @param {number} maxDistance - 최대 거리 (미터)
 * @returns {Array} 필터링된 POI
 */
export function filterByNetworkDistance(targetPoint, pois, walkingPaths, maxDistance = 500) {
  return pois
    .map(poi => {
      // Defensive check for valid coordinates
      if (typeof poi.lat !== 'number' || typeof poi.lng !== 'number') {
        console.warn(`⚠️ Invalid coordinates for POI, skipping network distance calculation:`, poi);
        return {
          ...poi,
          networkDistance: Infinity,
        };
      }

      const networkDist = calculateNetworkDistance(
        targetPoint,
        { lat: poi.lat, lng: poi.lng },
        walkingPaths
      );

      return {
        ...poi,
        networkDistance: networkDist
      };
    })
    .filter(poi => poi.networkDistance <= maxDistance)
    .sort((a, b) => a.networkDistance - b.networkDistance);
}
