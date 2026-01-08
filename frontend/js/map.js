// 전역 변수: 클릭 마커
let clickMarker = null;

// 전역 변수: 네트워크 분석 도달 가능 영역 레이어
let reachableAreaLayer = null;

// 전역 변수: 지도 컨트롤 추적
let currentLayerControl = null;
let currentLegend = null;

/**
 * 네트워크 분석 도달 가능 영역 레이어 업데이트
 * @param {Object} map - Leaflet 지도 객체
 * @param {Object} geometry - GeoJSON geometry 객체
 */
export function updateReachableAreaLayer(map, geometry) {
  // 기존 레이어 제거
  if (reachableAreaLayer) {
    map.removeLayer(reachableAreaLayer);
  }

  if (!geometry) {
    return;
  }

  // 새 레이어 생성 및 추가
  reachableAreaLayer = L.geoJSON(geometry, {
    style: {
      color: '#0ea5e9', // 하늘색 테두리
      weight: 2,
      opacity: 0.8,
      fillColor: '#67e8f9', // 청록색 채우기
      fillOpacity: 0.25,
    },
    interactive: false,
  }).addTo(map);

  console.log('✅ 보행 네트워크 도달 가능 영역 표시');
}

/**
 * 지도 초기화
 */
export function initMap(elementId, options = {}) {
  const { center = [37.5665, 126.9780], zoom = 13, onMapClick = null } = options;

  // Leaflet 지도 생성
  const map = L.map(elementId).setView(center, zoom);

  // 기본 타일 레이어 (CartoDB Positron - 깔끔한 회색톤)
  const baseLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 20
  }).addTo(map);

  // V-World 레이어 추가
  addVWorldLayers(map);

  // 금천구 행정구역 경계선 로드 및 표시
  loadGeumcheonBoundary(map);

  // 금천구 상가업소 데이터 로드 (토글 가능)
  loadGeumcheonStores(map);

  // 지도 클릭 이벤트
  if (onMapClick) {
    map.on('click', function(e) {
      const { lat, lng } = e.latlng;

      // 기존 클릭 마커 제거
      if (clickMarker) {
        map.removeLayer(clickMarker);
      }

      // 새 클릭 마커 추가
      clickMarker = L.marker([lat, lng], {
        icon: L.divIcon({
          html: `<div style="
            font-size: 32px;
            text-align: center;
            line-height: 1;
            filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
          ">📍</div>`,
          className: 'click-marker',
          iconSize: [32, 32],
          iconAnchor: [16, 32]
        })
      }).addTo(map);

      // 콜백 호출
      onMapClick(lat, lng);
    });
  }

  console.log('🗺️ 지도 초기화 완료 (CartoDB Positron)');

  return map;
}

/**
 * 클릭 마커 제거
 */
export function clearClickMarker(map) {
  if (clickMarker) {
    map.removeLayer(clickMarker);
    clickMarker = null;
  }
}

/**
 * 금천구 행정구역 경계선 로드 및 표시
 */
async function loadGeumcheonBoundary(map) {
  try {
    const response = await fetch('/data/boundaries/geumcheon_boundary.geojson');
    if (!response.ok) {
      console.warn('⚠️  금천구 경계 파일을 불러올 수 없습니다.');
      return;
    }

    const geojson = await response.json();

    L.geoJSON(geojson, {
      style: {
        color: '#3b82f6',
        weight: 2.5,
        opacity: 0.7,
        fillColor: '#3b82f6',
        fillOpacity: 0.04,
        dashArray: '8, 8'
      },
      interactive: false
    }).addTo(map);

    console.log('✅ 금천구 경계선 표시 완료');

  } catch (error) {
    console.warn('⚠️  금천구 경계 로드 실패:', error.message);
  }
}

/**
 * 금천구 상가업소 데이터 로드 및 레이어 추가 (토글 가능)
 */
async function loadGeumcheonStores(map) {
  try {
    const response = await fetch('/data/processed/geumcheon_stores.geojson');
    if (!response.ok) {
      console.warn('⚠️  상가업소 데이터를 불러올 수 없습니다.');
      return;
    }

    const geojson = await response.json();
    console.log(`📊 금천구 상가업소 로드: ${geojson.features.length}개`);

    // 클러스터 그룹 생성 (17,849개 마커용)
    const storeClusterGroup = L.markerClusterGroup({
      iconCreateFunction: function(cluster) {
        const count = cluster.getChildCount();
        let size = 'small';
        if (count > 500) size = 'large';
        else if (count > 100) size = 'medium';

        return L.divIcon({
          html: `<div><span>${count}</span></div>`,
          className: 'marker-cluster marker-cluster-store marker-cluster-' + size,
          iconSize: L.point(40, 40)
        });
      },
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      maxClusterRadius: 60,
      disableClusteringAtZoom: 18
    });

    // 업종별 색상 매핑
    const categoryColors = {
      '과학·기술': '#6366f1',    // 보라
      '음식': '#ef4444',          // 빨강
      '소매': '#10b981',          // 초록
      '수리·개인': '#f59e0b',     // 노랑
      '시설관리·임대': '#64748b', // 회색
      '교육': '#3b82f6',          // 파랑
      '부동산': '#8b5cf6',        // 보라
      '예술·스포츠': '#ec4899',   // 핑크
      '보건의료': '#14b8a6',      // 청록
      '숙박': '#f97316'           // 오렌지
    };

    // GeoJSON 피처를 마커로 변환
    geojson.features.forEach(feature => {
      const { coordinates } = feature.geometry;
      const props = feature.properties;
      const [lng, lat] = coordinates;

      if (!lat || !lng) return;

      const category = props.categoryLarge || '기타';
      const color = categoryColors[category] || '#9ca3af';

      // 작은 원형 마커 생성 (기존 POI와 구분)
      const marker = L.circleMarker([lat, lng], {
        radius: 4,
        fillColor: color,
        color: '#fff',
        weight: 1,
        opacity: 0.8,
        fillOpacity: 0.6
      });

      // 팝업 추가
      marker.bindPopup(`
        <div style="min-width: 200px;">
          <strong>${props.name}</strong>
          ${props.branch ? `<span style="color: #6b7280;"> (${props.branch})</span>` : ''}<br>
          <span style="color: #6b7280; font-size: 12px;">
            ${category} > ${props.categoryMedium || ''}<br>
            ${props.roadAddress || props.address || ''}<br>
            ${props.buildingName ? `${props.buildingName} ` : ''}${props.floor ? `${props.floor}층` : ''}
          </span>
        </div>
      `);

      storeClusterGroup.addLayer(marker);
    });

    // 지도에는 추가하지 않고 레이어 컨트롤에만 등록 (기본 꺼짐)
    // 나중에 레이어 컨트롤이 추가될 때 여기에 포함됨
    map._geumcheonStoresLayer = storeClusterGroup;

    console.log('✅ 상가업소 레이어 준비 완료 (기본 비활성)');

  } catch (error) {
    console.warn('⚠️  상가업소 데이터 로드 실패:', error.message);
  }
}

/**
 * V-World WMS 레이어 추가 (작동하는 레이어만)
 */
function addVWorldLayers(map) {
  // V-World API 키
  const VWORLD_KEY = '32F2FDFF-9500-3D2B-A8D2-32EBE4D27E62';

  // V-World Base 레이어들 (작동 확인됨)
  const vworldBaseLayer = L.tileLayer.wms('http://api.vworld.kr/req/wms', {
    key: VWORLD_KEY,
    layers: 'Base',
    format: 'image/png',
    transparent: false,
    version: '1.3.0',
    attribution: 'V-World'
  });

  const vworldGrayLayer = L.tileLayer.wms('http://api.vworld.kr/req/wms', {
    key: VWORLD_KEY,
    layers: 'gray',
    format: 'image/png',
    transparent: false,
    version: '1.3.0',
    attribution: 'V-World'
  });

  // 기본 레이어 선택
  const baseLayers = {
    '기본 지도': L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap',
      subdomains: 'abcd',
      maxZoom: 20
    }),
    'V-World 일반': vworldBaseLayer,
    'V-World 회색': vworldGrayLayer
  };

  // 레이어 컨트롤 추가
  L.control.layers(baseLayers, null, {
    position: 'topright',
    collapsed: true
  }).addTo(map);

  console.log('✅ V-World 기본 레이어 추가 완료');
}

/**
 * 지도 업데이트 (분석 결과 시각화)
 * @param {Object} map - Leaflet 지도 객체
 * @param {Array|Object} results - 분석 결과 (배열 또는 단일 객체)
 * @param {number} radius - 분석 반경 (미터, 기본값 500)
 */
export function updateMap(map, results, radius = 500) {
  if (!map || !results) {
    console.error('지도 또는 결과 데이터가 없습니다.');
    return;
  }

  // 배열이 아니면 배열로 변환
  const resultsArray = Array.isArray(results) ? results : [results];

  // 기존 레이어 모두 제거
  clearMap(map);

  // 비교 모드 여부
  const isComparisonMode = resultsArray.length === 2;

  // 반경 컨트롤 표시
  const radiusControl = document.getElementById('radiusControl');
  if (radiusControl) {
    radiusControl.style.display = 'block';
  }

  // 첫 번째 결과의 중심으로 이동
  const firstResult = resultsArray[0];
  if (firstResult.coordinates && firstResult.coordinates.lat && firstResult.coordinates.lng) {
    map.setView([firstResult.coordinates.lat, firstResult.coordinates.lng], isComparisonMode ? 15 : 16);
  }

  // 레이어 그룹 생성
  const buildingLayer = L.layerGroup();

  // 일반 POI 클러스터 (선택 업종 제외)
  const poiClusterLayer = L.markerClusterGroup({
    iconCreateFunction: function(cluster) {
      const count = cluster.getChildCount();
      let size = 'small';
      if (count > 100) size = 'large';
      else if (count > 10) size = 'medium';

      return L.divIcon({
        html: `<div><span>${count}</span></div>`,
        className: 'marker-cluster marker-cluster-' + size,
        iconSize: L.point(40, 40)
      });
    },
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: false,
    zoomToBoundsOnClick: true,
    maxClusterRadius: 50
  });

  // 선택업종 레이어 제거 - 경쟁업체만 표시
  // const selectedBusinessPOILayer = L.layerGroup();

  const competitorLayer = L.layerGroup();
  const analysisLayer = L.layerGroup();

  // 히트맵 레이어 생성
  let heatmapLayer = null;

  // 1. 분석 레이어 (타겟 위치 + 도달권 원)
  // 비교 모드일 때 색상 변경
  const colors = [
    { marker: '#3b82f6', circle: '#3b82f6', fill: '#60a5fa', emoji: '⭐' },
    { marker: '#10b981', circle: '#10b981', fill: '#34d399', emoji: '🌟' }
  ];

  resultsArray.forEach((result, index) => {
    const { coordinates } = result;
    const color = colors[index] || colors[0];

    const targetMarker = L.marker([coordinates.lat, coordinates.lng], {
      icon: createCustomIcon(color.emoji, color.marker)
    });

    targetMarker.bindPopup(`
      <div style="text-align: center;">
        <strong>${isComparisonMode ? `📍 위치 ${index + 1}` : '🎯 분석 위치'}</strong><br>
        ${result.address}<br>
        점수: <strong>${result.score !== null ? result.score : '데이터 부족'}</strong>
      </div>
    `);

    analysisLayer.addLayer(targetMarker);
  });

  analysisLayer.addTo(map);

  // 첫 번째 결과의 데이터로 나머지 레이어 생성
  const { competitors, nearbyBuildings, nearbyPOIs, business } = firstResult;

  // 선택 업종에 해당하는 POI 카테고리 매핑
  const businessToCategoryMap = {
    'cafe': '카페',
    'convenience': '편의점',
    'chicken': '음식점',
    'restaurant': '음식점',
    'other': null
  };
  const selectedCategory = businessToCategoryMap[business] || null;

  // 2. 건물 폴리곤 레이어
  if (nearbyBuildings && nearbyBuildings.length > 0) {
    nearbyBuildings.forEach(building => {
      if (!building.geometry) return;

      const geoJsonLayer = L.geoJSON(building.geometry, {
        style: {
          color: '#475569',
          weight: 1.5,
          fillColor: '#e2e8f0',
          fillOpacity: 0.4
        }
      });

      const networkDistText = building.networkDistance ? `${Math.round(building.networkDistance)}m` : 'N/A';
      geoJsonLayer.bindPopup(`
        <strong>${building.name || '건물'}</strong><br>
        ${building.address || ''}<br>
        층수: ${building.floors}층<br>
        🚶 도보 거리: ${networkDistText}
      `);

      buildingLayer.addLayer(geoJsonLayer);
    });

    buildingLayer.addTo(map);
  }

  // 3. 주변 POI 마커 레이어 (경쟁업체 제외)
  if (nearbyPOIs && nearbyPOIs.length > 0) {
    nearbyPOIs.forEach(poi => {
      if (!poi.lat || !poi.lng) return;

      const icon = getPOIIcon(poi.category);

      const poiMarker = L.marker([poi.lat, poi.lng], {
        icon: createCustomIcon(icon.emoji, icon.color, false)
      });

      const networkDistText = poi.networkDistance ? `${Math.round(poi.networkDistance)}m` : 'N/A';
      poiMarker.bindPopup(`
        <strong>${poi.name}</strong><br>
        카테고리: ${poi.category}<br>
        🚶 도보 거리: ${networkDistText}
      `);

      // 모든 POI를 클러스터에 추가
      poiClusterLayer.addLayer(poiMarker);
    });

    poiClusterLayer.addTo(map);

    // 히트맵 레이어 생성 (POI 밀집도 시각화)
    const heatmapData = nearbyPOIs
      .filter(poi => poi.lat && poi.lng)
      .map(poi => {
        // 카테고리별 가중치 (중요도가 높은 POI는 더 강하게 표시)
        const weight = getCategoryWeight(poi.category);
        return [poi.lat, poi.lng, weight];
      });

    if (heatmapData.length > 0) {
      heatmapLayer = L.heatLayer(heatmapData, {
        radius: 25,
        blur: 15,
        maxZoom: 17,
        max: 1.0,
        gradient: {
          0.0: '#3b82f6',  // 파란색 (낮은 밀집도)
          0.3: '#10b981',  // 초록색
          0.5: '#f59e0b',  // 노란색
          0.7: '#ef4444',  // 빨간색 (높은 밀집도)
          1.0: '#dc2626'   // 진한 빨간색
        }
      });
    }
  }

  // 4. 경쟁업체 마커 레이어
  if (competitors && competitors.length > 0) {
    competitors.forEach(competitor => {
      if (!competitor.lat || !competitor.lng) return;

      const competitorMarker = L.marker([competitor.lat, competitor.lng], {
        icon: createCustomIcon('🎯', '#ef4444')
      });

      const networkDistText = competitor.networkDistance ? `${Math.round(competitor.networkDistance)}m` : 'N/A';
      competitorMarker.bindPopup(`
        <strong>⚠️ 경쟁업체</strong><br>
        <strong>${competitor.name}</strong><br>
        카테고리: ${competitor.category}<br>
        🚶 도보 거리: ${networkDistText}
      `);

      competitorLayer.addLayer(competitorMarker);
    });

    competitorLayer.addTo(map);
  }

  // 5. 레이어 컨트롤 추가
  const overlays = {
    '🏢 건물': buildingLayer,
    '📍 주변 시설': poiClusterLayer,
    '🎯 경쟁업체': competitorLayer,
    '🎯 분석 위치': analysisLayer
  };

  // 히트맵이 있으면 레이어 컨트롤에 추가
  if (heatmapLayer) {
    overlays['🔥 수요 히트맵'] = heatmapLayer;
  }

  // 금천구 상가업소 레이어 추가 (있으면)
  if (map._geumcheonStoresLayer) {
    overlays['📊 금천구 상가업소'] = map._geumcheonStoresLayer;
  }

  // 레이어 컨트롤 생성 및 저장
  currentLayerControl = L.control.layers(null, overlays, { collapsed: false }).addTo(map);

  // 6. 범례 추가
  currentLegend = addLegend(map, isComparisonMode);

  console.log('🗺️ 지도 업데이트 완료');
  console.log(`  - 분석 위치: ${resultsArray.length}개${isComparisonMode ? ' (비교 모드)' : ''}`);
  console.log(`  - 건물: ${nearbyBuildings?.length || 0}개`);
  console.log(`  - POI: ${nearbyPOIs?.length || 0}개`);
  console.log(`  - 경쟁업체: ${competitors?.length || 0}개`);
}

/**
 * 범례 추가 (4개 그룹으로 단순화)
 */
function addLegend(map, isComparisonMode = false) {
  const legend = L.control({ position: 'bottomright' });

  legend.onAdd = function() {
    const div = L.DomUtil.create('div', 'map-legend');
    div.style.cssText = `
      background: white;
      padding: 12px;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      font-size: 12px;
      line-height: 1.6;
      max-width: 280px;
    `;

    const comparisonHeader = isComparisonMode
      ? `<div style="display: flex; gap: 8px; font-size: 11px; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px solid #e5e7eb;">
          <div style="flex: 1; padding: 4px; background: #eff6ff; border-radius: 4px; text-align: center;">⭐ 위치 1</div>
          <div style="flex: 1; padding: 4px; background: #f0fdf4; border-radius: 4px; text-align: center;">🌟 위치 2</div>
        </div>`
      : '';

    div.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 10px; font-size: 14px; color: #1f2937;">범례</div>
      ${comparisonHeader}

      <!-- 그룹 1: 분석 위치 -->
      <div class="legend-group">
        <div class="legend-group-header" style="font-weight: 600; font-size: 11px; color: #374151; margin-bottom: 4px; cursor: pointer; display: flex; align-items: center; gap: 4px;">
          <span class="legend-toggle">▼</span> 분석 위치
        </div>
        <div class="legend-group-content" style="margin-left: 12px; font-size: 11px; color: #6b7280;">
          ${!isComparisonMode ? '<div style="margin-bottom: 2px;">⭐ 타겟 위치</div>' : '<div style="margin-bottom: 2px;">⭐ 위치 1 | 🌟 위치 2</div>'}
          <div style="margin-bottom: 2px;">
            <span style="display: inline-block; width: 40px; height: 8px; background: rgba(103, 232, 249, 0.25); border: 2px solid #0ea5e9; vertical-align: middle;"></span>
            <span style="margin-left: 4px;">실제 보행 가능 영역</span>
          </div>
        </div>
      </div>

      <!-- 그룹 2: 경쟁업체 -->
      <div class="legend-group" style="margin-top: 8px;">
        <div class="legend-group-header" style="font-weight: 600; font-size: 11px; color: #374151; margin-bottom: 4px; cursor: pointer; display: flex; align-items: center; gap: 4px;">
          <span class="legend-toggle">▼</span> 경쟁업체
        </div>
        <div class="legend-group-content" style="margin-left: 12px; font-size: 11px; color: #6b7280;">
          <div>🎯 동일 업종</div>
        </div>
      </div>

      <!-- 그룹 3: 수요 시설 (주요 유동인구 발생) -->
      <div class="legend-group" style="margin-top: 8px;">
        <div class="legend-group-header" style="font-weight: 600; font-size: 11px; color: #374151; margin-bottom: 4px; cursor: pointer; display: flex; align-items: center; gap: 4px;">
          <span class="legend-toggle">▼</span> 수요 시설
        </div>
        <div class="legend-group-content" style="margin-left: 12px; display: grid; grid-template-columns: 1fr 1fr; gap: 2px; font-size: 11px; color: #6b7280;">
          <div>🚇 지하철</div>
          <div>🏫 학교</div>
          <div>🏥 병원</div>
          <div>🛒 마트</div>
          <div>🏛️ 공공기관</div>
          <div>👶 어린이집</div>
        </div>
      </div>

      <!-- 그룹 4: 기타 시설 -->
      <div class="legend-group" style="margin-top: 8px;">
        <div class="legend-group-header" style="font-weight: 600; font-size: 11px; color: #374151; margin-bottom: 4px; cursor: pointer; display: flex; align-items: center; gap: 4px;">
          <span class="legend-toggle">▼</span> 기타 시설
        </div>
        <div class="legend-group-content" style="margin-left: 12px; display: grid; grid-template-columns: 1fr 1fr; gap: 2px; font-size: 11px; color: #6b7280;">
          <div>☕ 카페</div>
          <div>🍽️ 음식점</div>
          <div>🏪 편의점</div>
          <div>🏦 은행</div>
          <div>📚 학원</div>
          <div>💊 약국</div>
          <div>🏨 숙박</div>
          <div>🎭 문화</div>
        </div>
      </div>

      <div style="margin-top: 10px; padding-top: 8px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #6b7280;">
        <span style="display: inline-block; width: 20px; height: 10px; background: #e2e8f0; border: 1px solid #94a3b8; margin-right: 6px; vertical-align: middle;"></span>
        건물 경계
      </div>
    `;

    // 접기/펼치기 기능 추가
    const groupHeaders = div.querySelectorAll('.legend-group-header');
    groupHeaders.forEach(header => {
      header.addEventListener('click', function() {
        const content = this.nextElementSibling;
        const toggle = this.querySelector('.legend-toggle');

        if (content.style.display === 'none') {
          content.style.display = 'block';
          toggle.textContent = '▼';
        } else {
          content.style.display = 'none';
          toggle.textContent = '▶';
        }
      });
    });

    return div;
  };

  legend.addTo(map);
  return legend;
}

/**
 * POI 카테고리별 아이콘 매핑
 */
function getPOIIcon(category) {
  const iconMap = {
    '카페': { emoji: '☕', color: '#8b4513' },
    '음식점': { emoji: '🍽️', color: '#ef4444' },
    '편의점': { emoji: '🏪', color: '#10b981' },
    '은행': { emoji: '🏦', color: '#3b82f6' },
    '학원': { emoji: '📚', color: '#8b5cf6' },
    '약국': { emoji: '💊', color: '#ec4899' },
    '중개업소': { emoji: '🏘️', color: '#64748b' },
    '대형마트': { emoji: '🛒', color: '#f59e0b' },
    '주차장': { emoji: '🅿️', color: '#6366f1' },
    '주유소/충전소': { emoji: '⛽', color: '#eab308' },
    '지하철역': { emoji: '🚇', color: '#06b6d4' },
    '문화시설': { emoji: '🎭', color: '#a855f7' },
    '공공기관': { emoji: '🏛️', color: '#475569' },
    '관광명소': { emoji: '🗼', color: '#14b8a6' },
    '숙박': { emoji: '🏨', color: '#f97316' },
    '병원': { emoji: '🏥', color: '#dc2626' },
    '어린이집/유치원': { emoji: '👶', color: '#fb923c' },
    '학교': { emoji: '🏫', color: '#0ea5e9' }
  };

  return iconMap[category] || { emoji: '📍', color: '#6b7280' };
}

/**
 * 커스텀 아이콘 생성
 * @param {string} emoji - 이모지
 * @param {string} color - 색상 (미사용, 향후 확장용)
 * @param {boolean} emphasized - 강조 표시 여부 (크기 확대, 그림자 강화)
 */
function createCustomIcon(emoji, color, emphasized = false) {
  return L.divIcon({
    html: `<div style="
      font-size: ${emphasized ? '32px' : '24px'};
      text-align: center;
      line-height: 1;
      filter: drop-shadow(0 2px 4px rgba(0,0,0,${emphasized ? '0.5' : '0.3'}));
      ${emphasized ? 'font-weight: bold;' : ''}
    ">${emoji}</div>`,
    className: 'custom-marker',
    iconSize: [emphasized ? 36 : 30, emphasized ? 36 : 30],
    iconAnchor: [emphasized ? 18 : 15, emphasized ? 18 : 15]
  });
}

/**
 * 지도의 모든 레이어 제거 (타일 레이어 제외)
 */
function clearMap(map) {
  // 기존 컨트롤 제거 (레이어 컨트롤, 범례)
  if (currentLayerControl) {
    try {
      map.removeControl(currentLayerControl);
      currentLayerControl = null;
    } catch (e) {
      console.warn('레이어 컨트롤 제거 실패:', e);
    }
  }

  if (currentLegend) {
    try {
      map.removeControl(currentLegend);
      currentLegend = null;
    } catch (e) {
      console.warn('범례 제거 실패:', e);
    }
  }

  // 도달 가능 영역 레이어 제거
  if (reachableAreaLayer) {
    try {
      map.removeLayer(reachableAreaLayer);
      reachableAreaLayer = null;
    } catch (e) {
      console.warn('도달 가능 영역 레이어 제거 실패:', e);
    }
  }

  // 레이어 제거
  map.eachLayer(layer => {
    if (layer instanceof L.TileLayer) {
      return; // 타일 레이어는 유지
    }
    map.removeLayer(layer);
  });
}

/**
 * POI 카테고리별 히트맵 가중치
 * 유동인구 유발 효과가 큰 시설일수록 높은 가중치
 */
function getCategoryWeight(category) {
  const weights = {
    '지하철역': 1.0,      // 최고 가중치 - 유동인구 핵심
    '대형마트': 0.9,
    '병원': 0.8,
    '학교': 0.8,
    '어린이집/유치원': 0.7,
    '음식점': 0.7,
    '카페': 0.6,
    '편의점': 0.6,
    '은행': 0.5,
    '학원': 0.5,
    '공공기관': 0.5,
    '문화시설': 0.4,
    '관광명소': 0.4,
    '숙박': 0.3,
    '주차장': 0.3,
    '약국': 0.3,
    '주유소/충전소': 0.2,
    '중개업소': 0.2
  };

  return weights[category] || 0.3; // 기본 가중치
}
