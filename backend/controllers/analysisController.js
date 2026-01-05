import { geocodeAddress, reverseGeocode as reverseGeocodeUtil } from '../utils/geocoder.js';
import * as bldgDao from '../dao/bldg.dao.js';
import * as poiDao from '../dao/poi.dao.js';
import * as subwayDao from '../dao/subway.dao.js';
import * as storeDao from '../dao/store.dao.js';
import * as dongDao from '../dao/dong.dao.js';
import * as walkingPathDao from '../dao/walkingPath.dao.js';
import * as competitorDao from '../dao/competitor.dao.js';
import { calculateReachableArea, filterByNetworkDistance, buildNetworkGraph } from '../utils/networkAnalysis.js';
import { generatePDF } from '../utils/pdfGenerator.js';

/**
 * 상권 분석 메인 함수
 * POST /api/analyze
 */
export async function analyzeLocation(req, res) {
  const apiStartTime = Date.now();
  try {
    const { address, business, coordinates, radius } = req.body;

    // 입력 검증
    if (!address && !coordinates) {
      return res.status(400).json({
        success: false,
        error: '주소 또는 좌표를 입력해주세요.'
      });
    }

    // 주소 → 좌표 변환 (Geocoding)
    let targetCoords = coordinates;
    let resolvedAddress = address;

    if (!targetCoords && address) {
      try {
        const geocodeResult = await geocodeAddress(address);
        targetCoords = {
          lat: geocodeResult.lat,
          lng: geocodeResult.lng
        };
        resolvedAddress = geocodeResult.address;
        console.log(`✅ 주소 변환 성공: ${address} → (${targetCoords.lat}, ${targetCoords.lng})`);
      } catch (geocodeError) {
        console.error('❌ 주소 변환 실패:', geocodeError.message);
        return res.status(400).json({
          success: false,
          error: `주소를 찾을 수 없습니다: ${geocodeError.message}`
        });
      }
    }

    // 금천구 범위 체크 (대략적인 범위)
    const isInGeumcheon = checkGeumcheonRange(targetCoords.lat, targetCoords.lng);
    if (!isInGeumcheon) {
      console.warn('⚠️  금천구 외 지역:', targetCoords);
      // 금천구 밖이어도 분석은 진행 (MVP이므로)
    }

    // DB에서 주변 데이터 조회 (동적 반경: 기본값 500m)
    const radiusMeters = radius || 500;
    const radiusKm = radiusMeters / 1000;
    console.log(`📏 분석 반경: ${radiusMeters}m (${radiusKm}km)`);

    // DAO에 전달하기 전, 숫자 타입 명시적 변환 (타입 문제 방지)
    const finalLat = parseFloat(targetCoords.lat);
    const finalLng = parseFloat(targetCoords.lng);
    const finalRadiusKm = parseFloat(radiusKm);

    // 보행로 네트워크 데이터 조회 추가
    const [nearbyBuildings, nearbyPOIs, allCategories, nearbySubways, nearbyStores, storeDensity, dongInfo, walkingPaths] = await Promise.all([
      bldgDao.findNearbyBuildings(finalLat, finalLng, finalRadiusKm),
      poiDao.findNearbyPOIs(finalLat, finalLng, finalRadiusKm),
      poiDao.getAllCategories(),
      subwayDao.findNearbySubways(finalLat, finalLng, finalRadiusKm),
      storeDao.findNearbyStores(finalLat, finalLng, finalRadiusKm),
      storeDao.getStoreDensity(finalLat, finalLng, finalRadiusKm),
      dongDao.findDongByCoordinates(finalLat, finalLng),
      walkingPathDao.findNearbyWalkingPaths(finalLat, finalLng, finalRadiusKm)
    ]);

    console.log(`📊 주변 데이터: 건물 ${nearbyBuildings.length}개, POI ${nearbyPOIs.length}개, 지하철역 ${nearbySubways.length}개, 상가 ${nearbyStores.length}개, 보행로 ${walkingPaths.length}개, 동: ${dongInfo?.dong_nm || 'N/A'}`);

    // 경쟁업체 필터링 (POI + STORE 통합 검색)
    const competitors = await competitorDao.findCompetitorsHybrid(finalLat, finalLng, radiusMeters, business);

    // 동별 통계 가져오기 (dongInfo가 있는 경우)
    let dongStats = null;
    if (dongInfo) {
      dongStats = await dongDao.getDongStatistics(dongInfo.dong_nm);
    }

    // 분석 수행 (보행로 네트워크 데이터 포함)
    const analysisResult = performAnalysis(
      targetCoords,
      business,
      nearbyBuildings,
      nearbyPOIs,
      competitors,
      nearbySubways,
      nearbyStores,
      storeDensity,
      dongInfo,
      dongStats,
      walkingPaths,
      radiusMeters
    );

    const apiElapsed = Date.now() - apiStartTime;
    console.log(`\n⏱️  [성능] === 전체 API 응답 시간: ${apiElapsed}ms ===\n`);

    // 결과 반환
    res.json({
      success: true,
      result: {
        address: resolvedAddress,
        coordinates: targetCoords,
        business,
        ...analysisResult,
        dataSource: 'PostgreSQL (금천구)',
        timestamp: new Date().toISOString(),
        performanceMs: apiElapsed  // 성능 측정 결과 포함
      }
    });

  } catch (error) {
    console.error('분석 에러:', error);
    res.status(500).json({
      success: false,
      error: '분석 중 오류가 발생했습니다.',
      message: error.message
    });
  }
}

/**
 * 금천구 범위 체크 (대략적인 경계)
 */
function checkGeumcheonRange(lat, lng) {
  // 금천구 대략적인 범위 (실제로는 폴리곤으로 체크해야 하지만 MVP용)
  const bounds = {
    minLat: 37.436,
    maxLat: 37.491,
    minLng: 126.886,
    maxLng: 126.918
  };

  return lat >= bounds.minLat && lat <= bounds.maxLat &&
         lng >= bounds.minLng && lng <= bounds.maxLng;
}

/**
 * 경쟁업체 필터링
 */
function filterCompetitors(pois, businessType) {
  if (!businessType) return [];

  // 업종별 카테고리 매핑 (실제 DB 카테고리에 맞춤)
  // 실제 DB 카테고리: 음식점(28), 카페(10), 편의점(4), 은행(4), 학원(3), 중개업소(2), 약국(1)
  const categoryMap = {
    'cafe': { categories: ['카페'], keywords: [] },
    'convenience': { categories: ['편의점'], keywords: [] },
    'chicken': { categories: ['음식점'], keywords: ['치킨', '닭'] },  // 이름으로 필터링
    'restaurant': { categories: ['음식점'], keywords: [] },
    'bank': { categories: ['은행'], keywords: [] },
    'academy': { categories: ['학원'], keywords: [] },
    'pharmacy': { categories: ['약국'], keywords: [] }
  };

  const filterConfig = categoryMap[businessType] || { categories: [businessType], keywords: [] };
  const { categories, keywords } = filterConfig;

  console.log(`🔍 경쟁업체 필터링: 업종=${businessType}, 카테고리=${categories.join(',')}, 키워드=${keywords.join(',')}`);
  console.log(`📊 전체 POI 수: ${pois.length}`);

  const filtered = pois.filter(poi => {
    const category = poi.category || '';
    const name = poi.name || '';

    // 카테고리 매칭
    const categoryMatch = categories.some(cat => category.includes(cat));

    // 키워드가 없으면 카테고리 매칭만 사용
    if (keywords.length === 0) {
      return categoryMatch;
    }

    // 키워드가 있으면 카테고리 매칭 + 이름에 키워드 포함 여부
    const keywordMatch = keywords.some(keyword => name.includes(keyword));
    return categoryMatch && keywordMatch;
  });

  console.log(`✅ 필터링 결과: ${filtered.length}개 경쟁업체 발견`);

  // 처음 3개 샘플 출력
  if (filtered.length > 0) {
    console.log('샘플 경쟁업체:', filtered.slice(0, 3).map(p => `${p.name} (${p.category})`).join(', '));
  } else if (keywords.length > 0) {
    // 키워드 매칭 실패 시 카테고리만 매칭된 POI 확인
    const categoryOnly = pois.filter(poi => {
      const category = poi.category || '';
      return categories.some(cat => category.includes(cat));
    });
    console.log(`⚠️ 카테고리만 매칭된 POI: ${categoryOnly.length}개`);
    if (categoryOnly.length > 0) {
      console.log('샘플 (키워드 불일치):', categoryOnly.slice(0, 5).map(p => `${p.name} (${p.category})`).join(', '));
    }
  }

  return filtered;
}

/**
 * 경쟁 포화도 계산 (거리 가중치 및 업종별 기준 반영)
 */
function calculateCompetitionScore(targetCoords, competitors, business) {
  if (competitors.length === 0) {
    return { saturation: 0, competitionScore: 100 };
  }

  // 업종별 적정 경쟁업체 수 (반경 500m 기준)
  const optimalCompetitorCount = {
    'cafe': 3,          // 카페는 3개 정도가 적정
    'convenience': 2,   // 편의점은 2개 정도가 적정
    'chicken': 2,       // 치킨집은 2개 정도가 적정
    'restaurant': 5,    // 음식점은 5개 정도가 적정 (다양성 필요)
    'default': 3
  };

  const optimal = optimalCompetitorCount[business] || optimalCompetitorCount['default'];

  // 거리 기반 가중치 계산
  let weightedCompetitorCount = 0;

  competitors.forEach(competitor => {
    const distance = competitor.distance || 500; // 거리 (미터)

    // 거리별 가중치 (가까울수록 영향력 큼)
    let distanceWeight;
    if (distance < 100) {
      distanceWeight = 2.0;    // 100m 이내: 매우 높은 경쟁
    } else if (distance < 200) {
      distanceWeight = 1.5;    // 200m 이내: 높은 경쟁
    } else if (distance < 300) {
      distanceWeight = 1.0;    // 300m 이내: 보통 경쟁
    } else if (distance < 400) {
      distanceWeight = 0.6;    // 400m 이내: 낮은 경쟁
    } else {
      distanceWeight = 0.3;    // 400m 이상: 매우 낮은 경쟁
    }

    weightedCompetitorCount += distanceWeight;
  });

  // 포화도 계산 (0-100)
  // 적정 수 대비 가중 경쟁업체 수 비율
  const saturationRatio = weightedCompetitorCount / optimal;
  const saturation = Math.min(100, Math.round(saturationRatio * 50));

  // 경쟁 점수 (포화도의 역수)
  const competitionScore = Math.max(0, 100 - saturation);

  return { saturation, competitionScore };
}

/**
 * 보행로 타입별 가중치 계산
 */
function getPathWeight(highwayType) {
  const weights = {
    'residential': 500,    // 주거지역 도로
    'primary': 800,        // 간선도로
    'secondary': 700,      // 보조간선도로
    'tertiary': 400,       // 3차 도로
    'footway': 300,        // 보행로
    'pedestrian': 350,     // 보행자 전용
    'steps': 100,          // 계단
    'path': 200,           // 오솔길
    'default': 300         // 기본값
  };
  return weights[highwayType] || weights['default'];
}

/**
 * 건물 유형별 가중치 계산
 */
function getBuildingTypeWeight(buildingTypeCode) {
  // 건물 유형 코드는 DB 확인 필요, MVP에서는 1.0 고정
  // 추후 상업용=1.5, 주거용=1.0, 공공용=0.8 등으로 세분화 가능
  return 1.0;
}

/**
 * POI 카테고리별 방문객 가중치 계산
 */
function getPOICategoryWeight(category) {
  const weights = {
    '음식점': 200,    // 음식점은 점심/저녁 방문객 많음
    '카페': 150,      // 카페는 회전율 높음
    '편의점': 300,    // 편의점은 방문 빈도 높음
    '은행': 100,      // 은행은 체류시간 짧음
    '학원': 80,       // 학원은 특정 시간대만
    '중개업소': 30,   // 중개업소는 방문객 적음
    '약국': 120,      // 약국은 중간 수준
    'default': 100    // 기본값
  };
  return weights[category] || weights['default'];
}

/**
 * 유동량 추정 (보행로, 건물, POI, 지하철 데이터 종합)
 */
function calculateEstimatedTraffic(buildings, pois, walkingPaths, subways, radiusMeters) {
  // 1. 보행로 기반 유동량 추정
  let pathTraffic = 0;
  if (walkingPaths && walkingPaths.length > 0) {
    // 보행로 밀도 계산 (보행로 수 / 분석 면적)
    const radiusKm = radiusMeters / 1000;
    const areaKm2 = Math.PI * Math.pow(radiusKm, 2);
    const pathDensity = walkingPaths.length / areaKm2;

    // 보행로당 추정 유동량 (highway 타입별 가중치)
    walkingPaths.forEach(path => {
      const weight = getPathWeight(path.highway);
      pathTraffic += weight;
    });

    console.log(`🚶 보행로 분석: ${walkingPaths.length}개, 밀도 ${pathDensity.toFixed(2)}/km², 유동량 ${pathTraffic}명`);
  }

  // 2. 건물 기반 인구 추정
  let buildingPopulation = 0;
  if (buildings && buildings.length > 0) {
    buildings.forEach(building => {
      const floors = building.ground_floor_count || 1;
      const typeWeight = getBuildingTypeWeight(building.building_type_code);
      // 층당 50명 추정
      buildingPopulation += floors * 50 * typeWeight;
    });
    console.log(`🏢 건물 인구: ${buildings.length}개 건물, 추정 ${buildingPopulation}명`);
  }

  // 3. POI 기반 방문객 추정
  let poiVisitors = 0;
  if (pois && pois.length > 0) {
    pois.forEach(poi => {
      const categoryWeight = getPOICategoryWeight(poi.category);
      poiVisitors += categoryWeight;
    });
    console.log(`🏪 POI 방문객: ${pois.length}개 시설, 추정 ${poiVisitors}명`);
  }

  // 4. 지하철역 영향
  let subwayImpact = 0;
  if (subways && subways.length > 0) {
    subways.forEach(subway => {
      const dailyUsers = subway.daily_users || 0;
      const distance = subway.distance || 500;
      // 거리 기반 감쇠 (1km 기준)
      const decay = Math.max(0, 1 - distance / 1000);
      // 10% 유입 가정
      subwayImpact += dailyUsers * decay * 0.1;
    });
    console.log(`🚇 지하철 영향: ${subways.length}개역, 유입 ${Math.round(subwayImpact)}명`);
  }

  // 5. 최종 유동량 = 가중 평균
  const estimatedTraffic = Math.round(
    (pathTraffic * 0.3) +
    (buildingPopulation * 0.3) +
    (poiVisitors * 0.2) +
    (subwayImpact * 0.2)
  );

  console.log(`✅ 총 추정 유동량: ${estimatedTraffic}명/일`);

  return estimatedTraffic;
}

/**
 * 체류 유동량 추정
 */
function calculateStayableTraffic(estimatedTraffic, pois) {
  if (!pois || pois.length === 0) {
    return 0;
  }

  // 체류 유도 시설 가중치
  const stayableWeights = {
    '카페': 0.8,
    '음식점': 0.6,
    '공원': 0.9,
    '문화시설': 0.7,
    '숙박': 0.9,
    '학원': 0.5,
    '편의점': 0.3
  };

  // 주변 체류 유도 시설 비율 계산
  let stayableScore = 0;
  pois.forEach(poi => {
    const category = poi.category || '';
    const weight = stayableWeights[category] || 0;
    if (weight > 0) {
      stayableScore += weight;
    }
  });

  const stayRatio = Math.min(1.0, stayableScore / pois.length);

  // 체류 유동량 = 총 유동량 × 체류 비율 × 0.5
  const stayableTraffic = Math.round(estimatedTraffic * stayRatio * 0.5);

  console.log(`⏱️  체류 유동량: ${stayableTraffic}명 (비율: ${(stayRatio * 100).toFixed(1)}%)`);

  return stayableTraffic;
}

/**
 * GIS 분석 수행
 */
function performAnalysis(targetCoords, business, buildings, pois, competitors, subways = [], stores = [], storeDensity = {}, dongInfo = null, dongStats = null, walkingPaths = [], radiusMeters = 500) {
  // 🚶 네트워크 기반 도달 가능 영역 계산
  let reachableArea = null;
  let networkFilteredBuildings = buildings;
  let networkFilteredPOIs = pois;
  let networkFilteredCompetitors = competitors;

  if (walkingPaths.length > 0) {
    const networkAnalysisStartTime = Date.now();
    console.log(`🔬 네트워크 분석 시작: ${walkingPaths.length}개 보행로 사용`);

    try {
      // 🚀 성능 최적화: 그래프를 한 번만 생성하고 재사용
      const graph = buildNetworkGraph(walkingPaths);
      console.log('✅ 그래프 생성 완료 - 재사용 모드');

      // 실제 보행 가능 영역 계산 (그래프 재사용)
      reachableArea = calculateReachableArea(targetCoords, walkingPaths, radiusMeters, graph);
      console.log('✅ 네트워크 기반 도달 가능 영역 계산 완료');

      // 실제 보행 거리로 POI, 경쟁업체 필터링 (그래프 재사용)
      // 건물은 geometry만 있고 lat/lng가 없어서 필터링 불가 - 직선거리 결과 사용
      networkFilteredPOIs = filterByNetworkDistance(
        targetCoords,
        pois,
        walkingPaths,
        radiusMeters,
        graph
      );

      networkFilteredCompetitors = filterByNetworkDistance(
        targetCoords,
        competitors,
        walkingPaths,
        radiusMeters,
        graph
      );

      const networkAnalysisElapsed = Date.now() - networkAnalysisStartTime;
      console.log(`📊 네트워크 필터링 결과: 건물 ${buildings.length}(직선거리), POI ${pois.length}→${networkFilteredPOIs.length}, 경쟁업체 ${competitors.length}→${networkFilteredCompetitors.length}`);
      console.log(`⏱️  [성능] 네트워크 분석 전체 (그래프 재사용): ${networkAnalysisElapsed}ms`);
    } catch (error) {
      console.error('⚠️ 네트워크 분석 실패, 직선거리 기반으로 대체:', error.message);
      // 실패 시 원본 데이터 사용
    }
  }

  // 접근성 점수 계산 (네트워크 거리 기반으로 개선)
  const accessibilityScore = Math.min(100,
    (networkFilteredBuildings.length * 1.5) +
    (subways.length > 0 ? 30 : 0) +
    (walkingPaths.length * 0.5)
  );

  // 경쟁 포화도 계산 (네트워크 거리 가중치 반영)
  const { saturation, competitionScore } = calculateCompetitionScore(
    targetCoords,
    networkFilteredCompetitors,
    business
  );

  // 유동량 추정 (보행로, 건물, POI, 지하철 데이터 종합)
  const estimatedTraffic = calculateEstimatedTraffic(
    networkFilteredBuildings,
    networkFilteredPOIs,
    walkingPaths,
    subways,
    radiusMeters
  );

  // 체류 유동량 추정
  const stayableTraffic = calculateStayableTraffic(estimatedTraffic, networkFilteredPOIs);

  // 유동량 점수 계산 (0-100)
  // 일일 유동량 20,000명을 만점(100점) 기준으로 설정
  const trafficScore = Math.min(100, (estimatedTraffic / 200));

  // 환경 점수 (POI 다양성 기반)
  const environmentScore = Math.min(100, networkFilteredPOIs.length * 3);

  // 최종 점수 계산 (가중 평균)
  const finalScore = Math.round(
    (trafficScore * 0.4) +           // 유동량 40%
    (accessibilityScore * 0.2) +     // 접근성 20%
    (competitionScore * 0.3) +       // 경쟁 30%
    (environmentScore * 0.1)         // 환경 10%
  );

  // 추천 전략
  const recommendation = generateRecommendation(
    finalScore,
    networkFilteredCompetitors.length,
    estimatedTraffic,
    business,
    subways.length > 0 ? subways[0] : null
  );

  return {
    score: finalScore,
    trafficScore,
    competitionScore,
    accessibilityScore,
    environmentScore,
    dailyTraffic: estimatedTraffic,
    stayableTraffic,
    competitorCount: networkFilteredCompetitors.length,
    saturation,
    buildingCount: networkFilteredBuildings.length,
    poiCount: networkFilteredPOIs.length,
    // 🚶 네트워크 분석 결과
    reachableArea,  // 실제 보행 가능 영역 (GeoJSON Polygon)
    walkingPaths: walkingPaths.map(path => ({
      pathId: path.pathId,
      highway: path.highway,
      name: path.name,
      distance: Math.round(path.distance),
      geometry: path.geometry  // GeoJSON LineString
    })),
    networkAnalysisEnabled: walkingPaths.length > 0,
    competitors: networkFilteredCompetitors.map(c => ({
      name: c.name,
      branch: c.branch || null,
      category: c.category,
      categoryMedium: c.category_medium || null,
      categorySmall: c.category_small || null,
      lat: c.lat,
      lng: c.lng,
      distance: Math.round(c.networkDistance || c.distance),
      networkDistance: c.networkDistance ? Math.round(c.networkDistance) : null,
      source: c.source || 'POI',  // POI or STORE
      displayName: c.branch ? `${c.name} ${c.branch}` : c.name
    })),
    nearbyBuildings: networkFilteredBuildings.map(b => ({
      name: b.bldg_nm,
      address: b.road_nm_addr || b.lotno_addr,
      distance: Math.round(b.networkDistance || b.distance),
      networkDistance: b.networkDistance ? Math.round(b.networkDistance) : null,
      floors: b.ground_floor_count || 1,
      geometry: b.geometry  // GeoJSON geometry 추가
    })),
    nearbyPOIs: networkFilteredPOIs.map(p => ({
      name: p.name,
      category: p.category,
      lat: p.lat,
      lng: p.lng,
      distance: Math.round(p.networkDistance || p.distance),
      networkDistance: p.networkDistance ? Math.round(p.networkDistance) : null
    })),
    nearbySubways: subways.map(s => ({
      name: s.name,
      line: s.line,
      dailyUsers: s.daily_users,
      distance: Math.round(s.distance),
      lat: s.lat,
      lng: s.lng
    })),
    nearbyStores: stores.map(st => ({
      name: st.name,
      branch: st.branch,
      category: st.category_large,
      categoryMedium: st.category_medium,
      categorySmall: st.category_small,
      address: st.address_road || st.address_jibun,
      buildingName: st.building_name,
      floor: st.floor_info,
      distance: Math.round(st.distance),
      lat: st.lat,
lng: st.lng
    })),
    storeDensity: {
      totalCount: parseInt(storeDensity.total_count) || 0,
      categoryCount: parseInt(storeDensity.category_count) || 0,
      categoryDistribution: storeDensity.category_distribution || {}
    },
    dongInfo: dongInfo ? {
      dongNm: dongInfo.dong_nm,
      emdCd: dongInfo.emd_cd,
      fullNm: dongInfo.full_nm,
      buildingCount: dongStats?.building_count || 0,
      poiCount: dongStats?.poi_count || 0,
      storeCount: dongStats?.store_count || 0
    } : null,
    recommendation
  };
}

/**
 * 숫자를 천 단위 구분 형식으로 변환
 */
function formatNumber(num) {
  return num.toLocaleString('ko-KR');
}

/**
 * 추천 전략 생성 (업종별 임계값 및 상세 메시지)
 */
function generateRecommendation(score, competitorCount, traffic, business, nearestSubway) {
  // 업종별 유동량 임계값
  const trafficThresholds = {
    'cafe': { min: 3000, optimal: 8000 },
    'convenience': { min: 5000, optimal: 12000 },
    'chicken': { min: 4000, optimal: 10000 },
    'restaurant': { min: 5000, optimal: 15000 },
    'default': { min: 3000, optimal: 10000 }
  };

  const threshold = trafficThresholds[business] || trafficThresholds['default'];

  // 지하철역 정보
  const subwayInfo = nearestSubway
    ? `${nearestSubway.name}역 인근(${Math.round(nearestSubway.distance)}m)으로 접근성이 우수하며, `
    : '';

  // 점수 기반 상세 추천
  if (score >= 70) {
    if (traffic >= threshold.optimal) {
      return `✅ 매우 추천합니다. 일일 유동인구 ${formatNumber(traffic)}명으로 ${business || '선택하신'} 업종에 최적의 입지입니다. ${subwayInfo}경쟁업체 ${competitorCount}개로 포화도가 적정 수준입니다.`;
    } else {
      return `✅ 추천 입지입니다. 유동인구 ${formatNumber(traffic)}명과 적절한 경쟁 환경(${competitorCount}개)을 갖추고 있습니다. ${subwayInfo}충분히 성공 가능한 입지입니다.`;
    }
  } else if (score >= 50) {
    if (traffic >= threshold.min) {
      if (competitorCount > 3) {
        return `⚠️ 보통 수준입니다. 유동인구 ${formatNumber(traffic)}명으로 운영은 가능하나, 경쟁업체 ${competitorCount}개로 경쟁이 다소 치열합니다. 차별화 전략이 필요합니다.`;
      } else {
        return `⚠️ 보통 수준입니다. 유동인구 ${formatNumber(traffic)}명으로 운영 가능하며, ${subwayInfo}마케팅 전략으로 극복 가능합니다.`;
      }
    } else {
      return `⚠️ 신중한 검토가 필요합니다. 유동인구가 ${formatNumber(traffic)}명으로 ${business || '선택하신'} 업종 최소 기준(${formatNumber(threshold.min)}명)에 다소 부족합니다.`;
    }
  } else {
    if (traffic < threshold.min) {
      return `❌ 신중한 검토가 필요합니다. 유동인구가 ${formatNumber(traffic)}명으로 ${business || '선택하신'} 업종 최소 기준(${formatNumber(threshold.min)}명)에 미달합니다. 다른 입지를 고려하시는 것을 권장합니다.`;
    } else {
      return `❌ 유동량은 충분하나 경쟁 포화(${competitorCount}개) 또는 접근성 문제가 있습니다. 입지 선정에 신중을 기하시기 바랍니다.`;
    }
  }
}

/**
 * 데이터 상태 확인
 * GET /api/data-status
 */
export async function getDataStatus(req, res) {
  try {
    const [buildingCount, poiCount, categories, storeCount, storeCategories] = await Promise.all([
      bldgDao.countAllBuildings(),
      poiDao.countAllPOIs(),
      poiDao.getAllCategories(),
      storeDao.getTotalCount(),
      storeDao.getAllCategories()
    ]);

    res.json({
      success: true,
      status: {
        buildings: {
          loaded: buildingCount > 0,
          count: buildingCount
        },
        pois: {
          loaded: poiCount > 0,
          count: poiCount
        },
        stores: {
          loaded: storeCount > 0,
          count: storeCount
        },
        categories: categories.slice(0, 10),
        storeCategories: storeCategories,
        dataSource: 'PostgreSQL (금천구)',
        region: '서울특별시 금천구'
      }
    });
  } catch (error) {
    console.error('데이터 상태 확인 에러:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * 좌표를 주소로 변환
 * GET /api/reverse-geocode?lat=37.xxx&lng=126.xxx
 */
export async function reverseGeocode(req, res) {
  try {
    const { lat, lng } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        error: '좌표(lat, lng)를 입력해주세요.'
      });
    }

    const result = await reverseGeocodeUtil(parseFloat(lat), parseFloat(lng));

    res.json({
      success: true,
      address: result.address
    });

  } catch (error) {
    console.error('역지오코딩 에러:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * PDF 리포트 생성 및 다운로드
 * POST /api/generate-pdf
 */
export async function generatePDFReport(req, res) {
  const startTime = Date.now();

  try {
    const analysisData = req.body;

    // 필수 데이터 검증
    if (!analysisData || !analysisData.coordinates || !analysisData.business) {
      return res.status(400).json({
        success: false,
        error: 'PDF 생성에 필요한 분석 데이터가 없습니다.'
      });
    }

    console.log('📄 PDF 리포트 생성 요청:', {
      address: analysisData.address,
      business: analysisData.business,
      score: analysisData.score
    });

    // PDF 생성
    const pdfBuffer = await generatePDF(analysisData);

    const elapsed = Date.now() - startTime;
    console.log(`✅ PDF 리포트 생성 완료: ${elapsed}ms`);

    // 파일명 생성 (한글 인코딩 처리)
    const businessTypeMap = {
      'cafe': '카페',
      'convenience': '편의점',
      'chicken': '치킨',
      'restaurant': '음식점',
      'bank': '은행',
      'academy': '학원',
      'pharmacy': '약국'
    };
    const businessName = businessTypeMap[analysisData.business] || analysisData.business;
    const fileName = `RealWalk_${businessName}_분석리포트_${new Date().toISOString().split('T')[0]}.pdf`;
    const encodedFileName = encodeURIComponent(fileName);

    // PDF 응답
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${encodedFileName}"; filename*=UTF-8''${encodedFileName}`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.end(pdfBuffer, 'binary');

  } catch (error) {
    console.error('❌ PDF 생성 에러:', error);
    res.status(500).json({
      success: false,
      error: 'PDF 생성 중 오류가 발생했습니다.',
      message: error.message
    });
  }
}