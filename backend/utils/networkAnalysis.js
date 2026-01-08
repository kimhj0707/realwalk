/**
 * 네트워크 기반 공간 분석 유틸리티
 *
 * 실제 보행로 네트워크를 사용한 도달 가능 영역 계산
 * - 직선거리 X
 * - 실제 보행 가능 경로 O
 */

import * as turf from '@turf/turf';

/**
 * 네트워크 그래프 생성
 *
 * 보행로 좌표들을 노드로 만들고 인접 좌표 간 거리를 엣지로 연결
 *
 * @param {Array} walkingPaths - 보행로 배열 (GeoJSON features)
 * @returns {Object} 그래프 객체 {nodes: Map}
 */
export function buildNetworkGraph(walkingPaths) {
  const startTime = Date.now();
  const nodes = new Map();

  const getKey = (lng, lat) => `${lng.toFixed(6)},${lat.toFixed(6)}`;

  const ensureNode = (lng, lat) => {
    const key = getKey(lng, lat);
    if (!nodes.has(key)) {
      nodes.set(key, { lng, lat, neighbors: new Map() });
    }
    return key;
  };

  const addEdge = (keyA, keyB, distance) => {
    const nodeA = nodes.get(keyA);
    const nodeB = nodes.get(keyB);
    if (!nodeA || !nodeB) return;

    const prevA = nodeA.neighbors.get(keyB);
    if (prevA === undefined || distance < prevA) {
      nodeA.neighbors.set(keyB, distance);
    }
    const prevB = nodeB.neighbors.get(keyA);
    if (prevB === undefined || distance < prevB) {
      nodeB.neighbors.set(keyA, distance);
    }
  };

  if (!walkingPaths || walkingPaths.length === 0) {
    return { nodes };
  }

  walkingPaths.forEach(path => {
    const coords = path?.geometry?.coordinates;
    if (!coords || coords.length < 2) return;

    for (let i = 0; i < coords.length - 1; i++) {
      const [lng1, lat1] = coords[i];
      const [lng2, lat2] = coords[i + 1];
      if (lng1 == null || lat1 == null || lng2 == null || lat2 == null) continue;

      const keyA = ensureNode(lng1, lat1);
      const keyB = ensureNode(lng2, lat2);
      const dist = turf.distance(
        turf.point([lng1, lat1]),
        turf.point([lng2, lat2]),
        { units: 'meters' }
      );

      addEdge(keyA, keyB, dist);
    }
  });

  const elapsed = Date.now() - startTime;
  console.log(`⏱️  [성능] 그래프 생성: ${elapsed}ms (노드 ${nodes.size}개, 보행로 ${walkingPaths.length}개)`);

  return { nodes };
}

/**
 * 가장 가까운 네트워크 노드 찾기
 */
function findNearestNode(point, graph) {
  if (!graph || graph.nodes.size === 0) return null;

  const target = turf.point([point.lng, point.lat]);
  let bestKey = null;
  let bestDist = Infinity;

  for (const [key, node] of graph.nodes.entries()) {
    const dist = turf.distance(target, turf.point([node.lng, node.lat]), { units: 'meters' });
    if (dist < bestDist) {
      bestDist = dist;
      bestKey = key;
    }
  }

  if (!bestKey) return null;
  return { key: bestKey, distance: bestDist };
}

/**
 * 다익스트라 (단일 시작점 최단거리)
 */
function computeShortestPaths(graph, startKey, maxDistance) {
  const startTime = Date.now();
  const distances = new Map();
  const visited = new Set();

  // 간단한 우선순위 큐 (노드 수가 크지 않다는 가정)
  const queue = [{ key: startKey, dist: 0 }];
  distances.set(startKey, 0);

  while (queue.length > 0) {
    queue.sort((a, b) => a.dist - b.dist);
    const current = queue.shift();

    if (!current || visited.has(current.key)) continue;
    visited.add(current.key);

    const currentDist = current.dist;
    if (currentDist > maxDistance) continue;

    const node = graph.nodes.get(current.key);
    if (!node) continue;

    for (const [neighborKey, edgeDist] of node.neighbors.entries()) {
      const nextDist = currentDist + edgeDist;
      if (nextDist > maxDistance) continue;

      const prev = distances.get(neighborKey);
      if (prev === undefined || nextDist < prev) {
        distances.set(neighborKey, nextDist);
        queue.push({ key: neighborKey, dist: nextDist });
      }
    }
  }

  const elapsed = Date.now() - startTime;
  console.log(`⏱️  [성능] 최단경로 계산: ${elapsed}ms (도달 노드 ${distances.size}개, 최대거리 ${maxDistance}m)`);

  return distances;
}

/**
 * 보행로 네트워크에서 실제 도달 가능한 영역 계산
 *
 * @param {Object} startPoint - 시작점 {lat, lng}
 * @param {Array} walkingPaths - 보행로 배열 (GeoJSON features)
 * @param {number} maxDistanceMeters - 최대 보행 거리 (미터)
 * @param {Object} prebuiltGraph - 미리 생성된 그래프 (선택사항, 성능 최적화용)
 * @returns {Object|null} 도달 가능 영역 (GeoJSON Geometry) 또는 null
 */
export function calculateReachableArea(startPoint, walkingPaths, maxDistanceMeters = 500, prebuiltGraph = null) {
  const functionStartTime = Date.now();
  try {
    const start = turf.point([startPoint.lng, startPoint.lat]);

    if (!walkingPaths || walkingPaths.length === 0) {
        console.warn('⚠️  No walking paths provided, returning small buffer around start point.');
        const bufferedPoint = turf.buffer(start, 50, { units: 'meters' });
        return bufferedPoint.geometry;
    }

    const graph = prebuiltGraph || buildNetworkGraph(walkingPaths);
    const startNode = findNearestNode(startPoint, graph);

    // ================= DEBUG LOGGING =================
    console.log('🐞🐞🐞 DEBUG: 네트워크 분석 시작점 🐞🐞🐞');
    console.log('분석 시작점:', startPoint);
    if (startNode) {
      console.log('가장 가까운 노드:', startNode);
    } else {
      console.log('가장 가까운 노드를 찾지 못했습니다.');
    }
    console.log('🐞🐞🐞================================🐞🐞🐞');
    // =================================================

    if (!startNode) {
      console.warn('⚠️  No network nodes found, returning buffer around start point.');
      const bufferedPoint = turf.buffer(start, maxDistanceMeters, { units: 'meters' });
      return bufferedPoint.geometry;
    }

    const distances = computeShortestPaths(graph, startNode.key, maxDistanceMeters);
    const reachablePoints = [];

    for (const [key, dist] of distances.entries()) {
      if (dist > maxDistanceMeters) continue;
      const [lng, lat] = key.split(',').map(Number);
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
      reachablePoints.push(turf.point([lng, lat]));
    }

    if (reachablePoints.length === 0) {
      console.warn('⚠️  No reachable nodes within max distance, returning buffer around start point.');
      const bufferedPoint = turf.buffer(start, maxDistanceMeters, { units: 'meters' });
      return bufferedPoint.geometry;
    }

    const featureCollection = turf.featureCollection(reachablePoints);
    const buffered = turf.buffer(featureCollection, 20, { units: 'meters' });

    if (!buffered || !buffered.features || buffered.features.length === 0) {
      console.error('❌ Buffering reachable nodes resulted in no features.');
      return null;
    }

    const dissolved = turf.dissolve(buffered);

    if (dissolved && dissolved.features.length > 0 && dissolved.features[0].geometry) {
      const elapsed = Date.now() - functionStartTime;
      console.log(`⏱️  [성능] 도달가능영역 계산 전체: ${elapsed}ms (도달점 ${reachablePoints.length}개)`);
      return dissolved.features[0].geometry;
    }

    console.error('❌ Dissolve failed, returning null.');
    return null;

  } catch (error) {
    console.error('❌ Error in calculateReachableArea:', error.message);
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
    const graph = buildNetworkGraph(walkingPaths);
    const startNode = findNearestNode(pointA, graph);
    const endNode = findNearestNode(pointB, graph);

    if (!startNode || !endNode) {
      throw new Error('No network nodes available');
    }

    const distances = computeShortestPaths(graph, startNode.key, Infinity);
    const pathDist = distances.get(endNode.key);

    if (pathDist === undefined) {
      throw new Error('No path between nodes');
    }

    // 총 거리 = 시작점→네트워크 + 네트워크 경로 + 네트워크→도착점
    return startNode.distance + pathDist + endNode.distance;

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
 * @param {Object} prebuiltGraph - 미리 생성된 그래프 (선택사항, 성능 최적화용)
 * @returns {Array} 필터링된 POI
 */
export function filterByNetworkDistance(targetPoint, pois, walkingPaths, maxDistance = 500, prebuiltGraph = null) {
  const startTime = Date.now();

  if (!walkingPaths || walkingPaths.length === 0) {
    return pois
      .map(poi => {
        if (typeof poi.lat !== 'number' || typeof poi.lng !== 'number') {
          return { ...poi, networkDistance: Infinity };
        }
        const direct = turf.distance(
          turf.point([targetPoint.lng, targetPoint.lat]),
          turf.point([poi.lng, poi.lat]),
          { units: 'meters' }
        );
        return { ...poi, networkDistance: direct };
      })
      .filter(poi => poi.networkDistance <= maxDistance)
      .sort((a, b) => a.networkDistance - b.networkDistance);
  }

  const graph = prebuiltGraph || buildNetworkGraph(walkingPaths);
  const startNode = findNearestNode(targetPoint, graph);
  if (!startNode) {
    return pois.map(poi => ({ ...poi, networkDistance: Infinity }));
  }

  const distances = computeShortestPaths(graph, startNode.key, maxDistance);

  const result = pois
    .map(poi => {
      // Defensive check for valid coordinates
      if (typeof poi.lat !== 'number' || typeof poi.lng !== 'number') {
        console.warn('⚠️  Invalid coordinates for POI, skipping network distance calculation:', poi);
        return {
          ...poi,
          networkDistance: Infinity,
        };
      }

      const poiNode = findNearestNode({ lat: poi.lat, lng: poi.lng }, graph);
      if (!poiNode) {
        return { ...poi, networkDistance: Infinity };
      }

      const pathDist = distances.get(poiNode.key);
      if (pathDist === undefined) {
        return { ...poi, networkDistance: Infinity };
      }

      const totalDistance = startNode.distance + pathDist + poiNode.distance;
      return {
        ...poi,
        networkDistance: totalDistance
      };
    })
    .filter(poi => poi.networkDistance <= maxDistance)
    .sort((a, b) => a.networkDistance - b.networkDistance);

  const elapsed = Date.now() - startTime;
  console.log(`⏱️  [성능] 네트워크 거리 필터링: ${elapsed}ms (입력 ${pois.length}개 → 출력 ${result.length}개)`);

  return result;
}

