import { initMap, updateMap, clearClickMarker, updateReachableAreaLayer } from './map.js';
import { analyzeLocation, reverseGeocode } from './api.js';

// 전역 상태
let map = null;
let analysisResults = []; // 분석 결과 저장 (최대 2개)
let comparisonMode = false;
let currentRadius = 500; // 현재 분석 반경 (미터)
let lastAnalysisParams = null; // 마지막 분석 파라미터 저장 (반경 변경 시 재분석용)

// DOM 요소
const analysisForm = document.getElementById('analysisForm');
const resultPanel = document.getElementById('resultPanel');
const loadingSpinner = document.getElementById('loadingSpinner');
const emptyState = document.getElementById('emptyState');
const errorState = document.getElementById('errorState');
const addCompareBtnEl = document.getElementById('addCompareBtn');
const resetBtnEl = document.getElementById('resetBtn');
const comparisonSectionEl = document.getElementById('comparisonSection');
const comparisonContentEl = document.getElementById('comparisonContent');

// 결과 표시 요소
const finalScoreEl = document.getElementById('finalScore');
const dailyTrafficEl = document.getElementById('dailyTraffic');
const stayableTrafficEl = document.getElementById('stayableTraffic');
const competitorCountEl = document.getElementById('competitorCount');
const saturationEl = document.getElementById('saturation');
const recommendationTextEl = document.getElementById('recommendationText');

/**
 * 앱 초기화
 */
async function init() {
  console.log('🚀 RealWalk 앱 초기화...');

  // 지도 초기화 (금천구청 기본 위치)
  map = initMap('map', {
    center: [37.4565, 126.8956], // 금천구청
    zoom: 14,
    onMapClick: handleMapClick
  });

  // 폼 제출 이벤트 리스너
  analysisForm.addEventListener('submit', handleFormSubmit);

  // 버튼 이벤트 리스너
  addCompareBtnEl.addEventListener('click', handleAddCompare);
  resetBtnEl.addEventListener('click', handleReset);

  // 반경 컨트롤 버튼
  setupRadiusControl();

  // 초기 상태: 빈 상태 표시
  showEmptyState();

  console.log('✅ 앱 초기화 완료');
}

/**
 * 반경 컨트롤 설정
 */
function setupRadiusControl() {
  const radiusBtns = document.querySelectorAll('.radius-btn');

  radiusBtns.forEach(btn => {
    btn.addEventListener('click', async () => {
      // 모든 버튼 비활성화
      radiusBtns.forEach(b => b.classList.remove('active'));

      // 클릭된 버튼 활성화
      btn.classList.add('active');

      // 반경 변경
      const newRadius = parseInt(btn.dataset.radius);
      const oldRadius = currentRadius;
      currentRadius = newRadius;

      console.log(`🔄 반경 변경: ${oldRadius}m → ${currentRadius}m`);

      // 분석 결과가 있으면 재분석 실행
      if (lastAnalysisParams && analysisResults.length > 0) {
        const { address, business, coordinates } = lastAnalysisParams;
        await startAnalysis(address, business, coordinates);
      }
    });
  });
}

/**
 * 지도 클릭 핸들러
 */
async function handleMapClick(lat, lng) {
  console.log('📍 지도 클릭:', { lat, lng });

  try {
    // 로딩 표시
    showLoading();

    // 좌표를 주소로 변환
    const address = await reverseGeocode(lat, lng);

    // 로딩 숨김
    hideLoading();

    // 주소와 업종 선택 확인
    const business = await showLocationConfirmDialog(address);

    if (business) {
      // 주소 폼에 채우기
      document.getElementById('address').value = address;
      document.getElementById('business').value = business;

      // 분석 시작 (좌표를 직접 전달)
      await startAnalysis(address, business, { lat, lng });
    } else {
      // 취소 시 클릭 마커 제거
      clearClickMarker(map);
    }

  } catch (error) {
    hideLoading();
    console.error('❌ 지도 클릭 처리 에러:', error);
    alert(`주소 변환 실패: ${error.message}`);
    clearClickMarker(map);
  }
}

/**
 * 위치 확인 다이얼로그
 */
async function showLocationConfirmDialog(address) {
  const businessOptions = [
    { value: 'cafe', label: '카페' },
    { value: 'convenience', label: '편의점' },
    { value: 'chicken', label: '치킨' },
    { value: 'restaurant', label: '음식점' },
    { value: 'other', label: '기타' }
  ];

  const optionsHtml = businessOptions
    .map(opt => `<option value="${opt.value}">${opt.label}</option>`)
    .join('');

  const html = `
    <div style="padding: 1rem;">
      <h3 style="margin-bottom: 1rem;">📍 이 위치를 분석하시겠습니까?</h3>
      <p style="margin-bottom: 1rem; color: #64748b;">
        <strong>주소:</strong> ${address}
      </p>
      <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">
        업종 선택:
      </label>
      <select id="dialogBusiness" style="width: 100%; padding: 0.5rem; border: 1px solid #e2e8f0; border-radius: 0.5rem; margin-bottom: 1rem;">
        <option value="">선택하세요</option>
        ${optionsHtml}
      </select>
      <div style="display: flex; gap: 0.5rem;">
        <button id="dialogConfirm" class="btn-primary" style="flex: 1;">
          분석 시작
        </button>
        <button id="dialogCancel" class="btn-secondary" style="flex: 1;">
          취소
        </button>
      </div>
    </div>
  `;

  return new Promise((resolve) => {
    // 기존 다이얼로그 제거
    const existingDialog = document.getElementById('locationDialog');
    if (existingDialog) {
      existingDialog.remove();
    }

    // 다이얼로그 생성
    const dialog = document.createElement('div');
    dialog.id = 'locationDialog';
    dialog.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: white;
      border-radius: 0.75rem;
      box-shadow: 0 10px 25px rgba(0,0,0,0.2);
      z-index: 10000;
      min-width: 400px;
      max-width: 500px;
    `;
    dialog.innerHTML = html;

    // 배경 오버레이
    const overlay = document.createElement('div');
    overlay.id = 'dialogOverlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.5);
      z-index: 9999;
    `;

    document.body.appendChild(overlay);
    document.body.appendChild(dialog);

    // 이벤트 리스너
    const confirmBtn = document.getElementById('dialogConfirm');
    const cancelBtn = document.getElementById('dialogCancel');
    const businessSelect = document.getElementById('dialogBusiness');

    confirmBtn.addEventListener('click', () => {
      const business = businessSelect.value;
      if (!business) {
        alert('업종을 선택해주세요.');
        return;
      }
      cleanup();
      resolve(business);
    });

    cancelBtn.addEventListener('click', () => {
      cleanup();
      resolve(null);
    });

    overlay.addEventListener('click', () => {
      cleanup();
      resolve(null);
    });

    function cleanup() {
      overlay.remove();
      dialog.remove();
    }
  });
}

/**
 * 분석 시작
 * @param {string} address - 주소
 * @param {string} business - 업종
 * @param {Object} coordinates - 좌표 (선택, 지도 클릭 시 사용)
 */
async function startAnalysis(address, business, coordinates = null) {
  // UI 상태 변경
  showLoading();
  hideResults();

  try {
    console.log('📍 분석 시작:', { address, business, radius: currentRadius, coordinates });

    // API 호출 (반경 및 좌표 포함)
    const apiParams = { address, business, radius: currentRadius };
    if (coordinates) {
      apiParams.coordinates = coordinates;
    }
    const result = await analyzeLocation(apiParams);

    // 분석 파라미터 저장 (반경 변경 시 재분석용)
    lastAnalysisParams = { address, business, coordinates };

    if (result.success) {
      // 결과 저장
      if (comparisonMode && analysisResults.length === 1) {
        // 비교 분석 추가
        analysisResults.push(result.result);
        comparisonMode = false;
      } else {
        // 첫 번째 분석 또는 초기화 후
        analysisResults = [result.result];
      }

      // 결과 표시
      displayResults(result.result);

      // 지도 업데이트
      updateMap(map, analysisResults, currentRadius);

      // 보행 네트워크 도달 가능 영역 표시
      updateReachableAreaLayer(map, result.result.reachableArea);

      // 버튼 표시
      showActionButtons();

      // 비교 분석이 2개면 비교 섹션 표시
      if (analysisResults.length === 2) {
        displayComparison();
      }

      console.log('✅ 분석 완료:', result.result);
    } else {
      throw new Error(result.error || '분석 실패');
    }

  } catch (error) {
    console.error('❌ 분석 에러:', error);
    alert(`분석 중 오류가 발생했습니다: ${error.message}`);
    clearClickMarker(map);
  } finally {
    hideLoading();
  }
}

/**
 * 폼 제출 핸들러
 */
async function handleFormSubmit(event) {
  event.preventDefault();

  const formData = new FormData(analysisForm);
  const address = formData.get('address');
  const business = formData.get('business');

  if (!address || !business) {
    alert('주소와 업종을 모두 입력해주세요.');
    return;
  }

  // 공통 분석 함수 호출
  await startAnalysis(address, business);
}

/**
 * 결과 표시
 */
function displayResults(result) {
  // 점수 표시 (null인 경우 데이터 부족 표시)
  if (result.score === null) {
    finalScoreEl.textContent = '데이터 부족';
    finalScoreEl.style.fontSize = '1.5rem';
  } else {
    finalScoreEl.textContent = result.score;
    finalScoreEl.style.fontSize = '3rem';
  }

  // 점수에 따른 색상 변경
  const scoreCard = document.querySelector('.score-card');
  if (result.score === null) {
    scoreCard.style.background = 'linear-gradient(135deg, #6b7280, #4b5563)';
  } else if (result.score >= 70) {
    scoreCard.style.background = 'linear-gradient(135deg, #10b981, #059669)';
  } else if (result.score >= 50) {
    scoreCard.style.background = 'linear-gradient(135deg, #f59e0b, #d97706)';
  } else {
    scoreCard.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
  }

  // 메트릭 표시 (null인 경우 "실제 데이터 필요" 표시)
  dailyTrafficEl.textContent = result.dailyTraffic === null ? '실제 데이터 필요' : formatNumber(result.dailyTraffic) + '명';
  stayableTrafficEl.textContent = result.stayableTraffic === null ? '실제 데이터 필요' : formatNumber(result.stayableTraffic) + '명';
  competitorCountEl.textContent = result.competitorCount + '개';
  saturationEl.textContent = result.saturation + '%';

  // 추천 전략
  recommendationTextEl.textContent = result.recommendation || '분석 결과가 없습니다.';

  // 점수 근거 3개 표시
  displayScoreBreakdown(result);

  // 상세 정보 표시
  displayBuildingDetails(result.nearbyBuildings);
  displayPOIDetails(result.nearbyPOIs);
  displaySubwayDetails(result.nearbySubways);
  displayStoreDetails(result.nearbyStores, result.storeDensity);

  // 추천 업종 카드 표시
  displayRecommendedBusinesses(result);

  // 차트 표시
  displayCharts(result);

  // 결과 패널 표시
  showResults();
}

/**
 * 점수 근거 3개 표시
 */
function displayScoreBreakdown(result) {
  const breakdownEl = document.getElementById('scoreBreakdown');

  if (result.score === null) {
    breakdownEl.style.display = 'none';
    return;
  }

  // 백엔드에서 계산된 점수 사용
  const trafficScore = result.trafficScore || 0;
  const accessibilityScore = result.accessibilityScore || 0;
  const competitionScore = result.competitionScore || 0;

  // 1. 유동량 점수 표시
  const nearestSubway = result.nearbySubways?.[0];
  const walkTime = nearestSubway ? Math.ceil(nearestSubway.distance / 80) : 0; // 80m/분

  document.getElementById('accessibilityScore').textContent = `${Math.round(trafficScore)}점`;
  document.getElementById('accessibilityDesc').textContent =
    result.dailyTraffic
      ? `일일 ${formatNumber(result.dailyTraffic)}명`
      : '유동량 분석 중';

  // 2. 경쟁 점수 표시
  const competitorCount = result.competitorCount || 0;
  let competitionLevel = '';

  if (competitionScore >= 80) {
    competitionLevel = '우수';
  } else if (competitionScore >= 60) {
    competitionLevel = '양호';
  } else if (competitionScore >= 40) {
    competitionLevel = '보통';
  } else {
    competitionLevel = '포화';
  }

  document.getElementById('competitionScore').textContent = `${competitionLevel} (${Math.round(competitionScore)}점)`;
  document.getElementById('competitionDesc').textContent = `동일업종 ${competitorCount}개`;

  // 3. 접근성 점수 표시
  let accessibilityLevel = '';
  if (accessibilityScore >= 80) {
    accessibilityLevel = '우수';
  } else if (accessibilityScore >= 60) {
    accessibilityLevel = '양호';
  } else if (accessibilityScore >= 40) {
    accessibilityLevel = '보통';
  } else {
    accessibilityLevel = '미흡';
  }

  document.getElementById('demandScore').textContent = `${accessibilityLevel} (${Math.round(accessibilityScore)}점)`;
  document.getElementById('demandDesc').textContent =
    nearestSubway
      ? `${nearestSubway.name}역 도보 ${walkTime}분`
      : `건물 ${result.buildingCount}개 · POI ${result.poiCount}개`;

  breakdownEl.style.display = 'grid';
}

/**
 * 주변 건물 정보 표시
 */
function displayBuildingDetails(buildings) {
  const container = document.getElementById('buildingDetails');

  if (!buildings || buildings.length === 0) {
    container.innerHTML = '<p class="detail-placeholder">주변 건물 정보가 없습니다.</p>';
    return;
  }

  // 상위 5개만 표시
  const topBuildings = buildings.slice(0, 5);

  const html = `
    <ul class="detail-list">
      ${topBuildings.map(building => {
        const networkDistText = building.networkDistance ? `${Math.round(building.networkDistance)}m` : 'N/A';
        return `
        <li class="detail-item">
          <div class="detail-item-main">
            <span class="detail-item-name">${building.name || '이름 없음'}</span>
            <span class="detail-item-info">
              ${building.address || '주소 정보 없음'} • ${building.floors || 1}층
            </span>
          </div>
          <span class="detail-item-badge distance">
            ${building.networkDistance ? '🚶' : ''}
            ${networkDistText}
          </span>
        </li>
      `}).join('')}
    </ul>
    ${buildings.length > 5 ? `<p style="margin-top: 0.5rem; font-size: 0.75rem; color: var(--text-secondary);">외 ${buildings.length - 5}개 건물</p>` : ''}
  `;

  container.innerHTML = html;
}

/**
 * 주변 POI 분포 표시
 */
function displayPOIDetails(pois) {
  const container = document.getElementById('poiDetails');

  if (!pois || pois.length === 0) {
    container.innerHTML = '<p class="detail-placeholder">주변 POI 정보가 없습니다.</p>';
    return;
  }

  // 카테고리별 집계
  const categoryCounts = {};
  pois.forEach(poi => {
    const category = poi.category || '기타';
    categoryCounts[category] = (categoryCounts[category] || 0) + 1;
  });

  // 카테고리 아이콘 매핑
  const categoryIcons = {
    '카페': '☕',
    '음식점': '🍽️',
    '편의점': '🏪',
    '은행': '🏦',
    '학원': '📚',
    '중개업소': '🏘️',
    '약국': '💊',
    '대형마트': '🛒',
    '병원': '🏥',
    '문화시설': '🎭',
    '주차장': '🅿️',
    '주유소/충전소': '⛽',
    '지하철역': '🚇',
    '공공기관': '🏛️',
    '관광명소': '🗼',
    '숙박': '🏨',
    '어린이집/유치원': '👶',
    '학교': '🏫',
    '기타': '📍'
  };

  const categoryArray = Object.entries(categoryCounts)
    .sort((a, b) => b[1] - a[1]); // 많은 순으로 정렬

  const html = `
    <div class="detail-category-grid">
      ${categoryArray.map(([category, count]) => `
        <div class="category-card">
          <div class="category-icon">${categoryIcons[category] || '📍'}</div>
          <div class="category-name">${category}</div>
          <div class="category-count">${count}개</div>
        </div>
      `).join('')}
    </div>
    <p style="margin-top: 0.75rem; font-size: 0.75rem; color: var(--text-secondary);">
      총 ${pois.length}개 POI
    </p>
  `;

  container.innerHTML = html;
}

/**
 * 인근 지하철역 정보 표시
 */
function displaySubwayDetails(subways) {
  const container = document.getElementById('subwayDetails');

  if (!subways || subways.length === 0) {
    container.innerHTML = '<p class="detail-placeholder">인근 지하철역 정보가 없습니다.</p>';
    return;
  }

  const html = `
    <ul class="detail-list">
      ${subways.map(subway => {
        const networkDistText = subway.networkDistance ? `${Math.round(subway.networkDistance)}m` : 'N/A';
        return `
        <li class="detail-item">
          <div class="detail-item-main">
            <span class="detail-item-name">${subway.name}</span>
            <span class="detail-item-info">
              ${subway.line} • 일평균 ${formatNumber(subway.dailyUsers)}명
            </span>
          </div>
          <span class="detail-item-badge distance">
            ${subway.networkDistance ? '🚶' : ''}
            ${networkDistText}
          </span>
        </li>
      `}).join('')}
    </ul>
  `;

  container.innerHTML = html;
}

/**
 * 주변 상가 정보 표시
 */
function displayStoreDetails(stores, storeDensity) {
  const container = document.getElementById('storeDetails');

  if (!stores || stores.length === 0) {
    container.innerHTML = '<p class="detail-placeholder">인근 상가 정보가 없습니다.</p>';
    return;
  }

  // 상위 10개 상가만 표시
  const displayStores = stores.slice(0, 10);
  const remainingCount = stores.length - displayStores.length;

  // 카테고리별 통계
  const categoryStats = storeDensity?.categoryDistribution || {};
  const totalStoreCount = storeDensity?.totalCount || stores.length;

  const html = `
    <div class="store-summary">
      <p><strong>반경 내 총 상가: ${formatNumber(totalStoreCount)}개</strong></p>
      ${Object.keys(categoryStats).length > 0 ? `
        <div class="category-stats">
          ${Object.entries(categoryStats)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([category, count]) => `
              <span class="category-tag">${category} ${count}개</span>
            `).join('')}
        </div>
      ` : ''}
    </div>

    <ul class="detail-list">
      ${displayStores.map(store => {
        const networkDistText = store.networkDistance ? `${Math.round(store.networkDistance)}m` : 'N/A';
        return `
        <li class="detail-item">
          <div class="detail-item-main">
            <span class="detail-item-name">${store.name}${store.branch ? ` (${store.branch})` : ''}</span>
            <span class="detail-item-info">
              ${store.categorySmall || store.categoryMedium || store.category}
              ${store.buildingName ? `• ${store.buildingName}` : ''}
              ${store.floor ? ` ${store.floor}층` : ''}
            </span>
          </div>
          <span class="detail-item-badge distance">
            ${store.networkDistance ? '🚶' : ''}
            ${networkDistText}
          </span>
        </li>
      `}).join('')}
    </ul>

    ${remainingCount > 0 ? `
      <p class="detail-more">외 ${remainingCount}개 상가 더보기...</p>
    ` : ''}
  `;

  container.innerHTML = html;
}

/**
 * 숫자 포맷팅 (천 단위 쉼표)
 */
function formatNumber(num) {
  if (num === null || num === undefined) return '-';
  return num.toLocaleString('ko-KR');
}

/**
 * UI 상태 관리
 */
function showLoading() {
  loadingSpinner.classList.remove('hidden');
  emptyState.classList.add('hidden');
  errorState.classList.add('hidden');
  resultPanel.classList.add('hidden');
}

function hideLoading() {
  loadingSpinner.classList.add('hidden');
}

function showResults() {
  resultPanel.classList.remove('hidden');
  emptyState.classList.add('hidden');
  errorState.classList.add('hidden');
}

function hideResults() {
  resultPanel.classList.add('hidden');
}

function showEmptyState() {
  emptyState.classList.remove('hidden');
  resultPanel.classList.add('hidden');
  loadingSpinner.classList.add('hidden');
  errorState.classList.add('hidden');
}

function showErrorState() {
  errorState.classList.remove('hidden');
  resultPanel.classList.add('hidden');
  loadingSpinner.classList.add('hidden');
  emptyState.classList.add('hidden');
}

/**
 * 액션 버튼 표시
 */
function showActionButtons() {
  resetBtnEl.style.display = 'block';

  // 첫 번째 분석 완료 시에만 비교 버튼 표시
  if (analysisResults.length === 1) {
    addCompareBtnEl.style.display = 'block';
  } else {
    addCompareBtnEl.style.display = 'none';
  }
}

/**
 * 초기화 버튼 핸들러
 */
function handleReset() {
  if (confirm('분석 결과를 초기화하시겠습니까?')) {
    // 상태 초기화
    analysisResults = [];
    comparisonMode = false;

    // UI 초기화
    hideResults();
    comparisonSectionEl.classList.add('hidden');
    addCompareBtnEl.style.display = 'none';
    resetBtnEl.style.display = 'none';

    // 폼 초기화
    analysisForm.reset();

    // 지도 초기화 (금천구청으로)
    map.setView([37.4565, 126.8956], 14);

    console.log('🔄 초기화 완료');
  }
}

/**
 * 비교 분석 추가 버튼 핸들러
 */
function handleAddCompare() {
  comparisonMode = true;

  // 폼 초기화 (새 주소 입력 가능)
  analysisForm.reset();

  // 버튼 숨기기
  addCompareBtnEl.style.display = 'none';

  alert('비교할 두 번째 위치를 입력해주세요.');

  console.log('➕ 비교 분석 모드 활성화');
}

/**
 * 비교 분석 결과 표시
 */
function displayComparison() {
  const [first, second] = analysisResults;

  // 점수 비교 (null 처리)
  const firstScore = first.score !== null ? first.score : 0;
  const secondScore = second.score !== null ? second.score : 0;

  const html = `
    <div class="comparison-item">
      <div class="comparison-header">
        <span class="comparison-label">📍 위치 1</span>
      </div>
      <div class="comparison-address">${first.address}</div>
      <div class="comparison-score ${firstScore >= secondScore ? 'winner' : 'second'}">
        ${first.score !== null ? first.score : '데이터 부족'}
      </div>
      <div class="comparison-metrics">
        <div class="comparison-metric">
          <div class="comparison-metric-label">유동량</div>
          <div class="comparison-metric-value">${first.dailyTraffic !== null ? formatNumber(first.dailyTraffic) : '-'}</div>
        </div>
        <div class="comparison-metric">
          <div class="comparison-metric-label">경쟁업체</div>
          <div class="comparison-metric-value">${first.competitorCount}개</div>
        </div>
        <div class="comparison-metric">
          <div class="comparison-metric-label">포화도</div>
          <div class="comparison-metric-value">${first.saturation}%</div>
        </div>
        <div class="comparison-metric">
          <div class="comparison-metric-label">건물</div>
          <div class="comparison-metric-value">${first.buildingCount}개</div>
        </div>
      </div>
    </div>

    <div class="comparison-item">
      <div class="comparison-header">
        <span class="comparison-label">📍 위치 2</span>
      </div>
      <div class="comparison-address">${second.address}</div>
      <div class="comparison-score ${secondScore >= firstScore ? 'winner' : 'second'}">
        ${second.score !== null ? second.score : '데이터 부족'}
      </div>
      <div class="comparison-metrics">
        <div class="comparison-metric">
          <div class="comparison-metric-label">유동량</div>
          <div class="comparison-metric-value">${second.dailyTraffic !== null ? formatNumber(second.dailyTraffic) : '-'}</div>
        </div>
        <div class="comparison-metric">
          <div class="comparison-metric-label">경쟁업체</div>
          <div class="comparison-metric-value">${second.competitorCount}개</div>
        </div>
        <div class="comparison-metric">
          <div class="comparison-metric-label">포화도</div>
          <div class="comparison-metric-value">${second.saturation}%</div>
        </div>
        <div class="comparison-metric">
          <div class="comparison-metric-label">건물</div>
          <div class="comparison-metric-value">${second.buildingCount}개</div>
        </div>
      </div>
    </div>
  `;

  comparisonContentEl.innerHTML = html;
  comparisonSectionEl.classList.remove('hidden');

  console.log('📊 비교 분석 표시 완료');
}

/**
 * 추천 업종 카드 표시
 */
function displayRecommendedBusinesses(result) {
  const container = document.getElementById('recommendedBusinessCards');

  if (!result.nearbyPOIs || result.nearbyPOIs.length === 0) {
    container.innerHTML = '<p class="detail-placeholder">주변 POI 데이터가 부족하여 업종 추천이 어렵습니다.</p>';
    return;
  }

  // POI 카테고리별 집계
  const categoryCounts = {};
  result.nearbyPOIs.forEach(poi => {
    const category = poi.category || '기타';
    categoryCounts[category] = (categoryCounts[category] || 0) + 1;
  });

  // 업종별 분석 및 점수 계산
  const businessAnalysis = analyzeBusinessOpportunities(
    categoryCounts,
    result.competitorCount,
    result.saturation,
    result.nearbySubways || [],
    result.nearbyBuildings || []
  );

  // 사용자가 선택한 업종 찾기
  const selectedBusinessType = result.business || 'cafe';
  const businessNameMap = {
    'cafe': '카페',
    'convenience': '편의점',
    'chicken': '치킨/프랜차이즈',
    'restaurant': '음식점',
    'other': '기타'
  };

  // 선택한 업종의 분석 결과 찾기
  const selectedBusiness = businessAnalysis.find(b => b.name === businessNameMap[selectedBusinessType]) || businessAnalysis[0];

  // 나머지 업종 중 상위 2개
  const otherRecommendations = businessAnalysis
    .filter(b => b.name !== selectedBusiness.name)
    .slice(0, 2);

  // 선택한 업종 카드 (크게 표시)
  const selectedCardId = 'selected-business-card';
  const selectedHtml = `
    <div class="business-card selected-business top-recommendation" id="${selectedCardId}">
      <div class="business-card-badge">선택한 업종</div>
      <div class="business-card-header">
        <div class="business-card-icon">${selectedBusiness.icon}</div>
        <div class="business-card-title">${selectedBusiness.name}</div>
      </div>
      <div class="business-card-reason">${selectedBusiness.reason}</div>
      <div class="business-card-stats">
        <div class="business-card-stat">
          <div class="business-card-stat-label">적합도</div>
          <div class="business-card-stat-value">${selectedBusiness.score}점</div>
        </div>
        <div class="business-card-stat">
          <div class="business-card-stat-label">경쟁</div>
          <div class="business-card-stat-value">${selectedBusiness.competition}</div>
        </div>
        <div class="business-card-stat">
          <div class="business-card-stat-label">수요</div>
          <div class="business-card-stat-value">${selectedBusiness.demand}</div>
        </div>
      </div>
      <button class="why-recommended-btn" onclick="toggleRecommendationDetail('${selectedCardId}')">
        <span class="toggle-icon">▼</span> 왜 추천?
      </button>
      <div class="recommendation-detail" style="display: none;">
        <div class="recommendation-detail-header">💡 추천 근거</div>
        <div class="recommendation-detail-content">
          ${generateDetailedReason(selectedBusiness, categoryCounts, result.nearbySubways || [])}
        </div>
      </div>
    </div>
  `;

  // 비교 업종 섹션
  const comparisonHtml = otherRecommendations.length > 0 ? `
    <div style="margin-top: 1.5rem;">
      <h5 style="font-size: 0.875rem; color: var(--text-secondary); margin-bottom: 0.75rem; font-weight: 600;">
        📊 다른 업종과 비교
      </h5>
      <div style="display: grid; gap: 0.5rem;">
        ${otherRecommendations.map(business => `
          <div class="business-comparison-card">
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span style="font-size: 1.25rem;">${business.icon}</span>
              <div style="flex: 1;">
                <div style="font-weight: 600; font-size: 0.875rem;">${business.name}</div>
                <div style="font-size: 0.75rem; color: var(--text-secondary);">
                  적합도: ${business.score}점 · 경쟁: ${business.competition} · 수요: ${business.demand}
                </div>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  ` : '';

  container.innerHTML = selectedHtml + comparisonHtml;
}

/**
 * 업종별 기회 분석
 */
function analyzeBusinessOpportunities(categoryCounts, competitorCount, saturation, subways, buildings) {
  // 업종 정의
  const businessTypes = [
    {
      name: '카페',
      icon: '☕',
      targetCategories: ['지하철역', '학교', '학원', '공공기관', '병원'],
      avoidCategories: ['카페'],
      minSubwayDistance: 500,
      idealSaturation: 60
    },
    {
      name: '편의점',
      icon: '🏪',
      targetCategories: ['지하철역', '학교', '어린이집/유치원', '공공기관'],
      avoidCategories: ['편의점'],
      minSubwayDistance: 300,
      idealSaturation: 50
    },
    {
      name: '치킨/프랜차이즈',
      icon: '🍗',
      targetCategories: ['학교', '어린이집/유치원', '주거지역'],
      avoidCategories: ['음식점'],
      minSubwayDistance: 1000,
      idealSaturation: 70
    },
    {
      name: '음식점',
      icon: '🍽️',
      targetCategories: ['지하철역', '공공기관', '학교', '병원'],
      avoidCategories: ['음식점'],
      minSubwayDistance: 400,
      idealSaturation: 65
    },
    {
      name: '학원',
      icon: '📚',
      targetCategories: ['학교', '어린이집/유치원', '지하철역'],
      avoidCategories: ['학원'],
      minSubwayDistance: 500,
      idealSaturation: 55
    }
  ];

  const results = businessTypes.map(business => {
    // 1. 수요 점수 (주변에 타겟 카테고리가 많을수록 높음)
    let demandScore = 0;
    business.targetCategories.forEach(category => {
      demandScore += (categoryCounts[category] || 0) * 10;
    });
    demandScore = Math.min(demandScore, 100);

    // 2. 경쟁 점수 (경쟁이 적을수록 높음)
    let competitionScore = 100;
    business.avoidCategories.forEach(category => {
      const count = categoryCounts[category] || 0;
      competitionScore -= count * 15;
    });
    competitionScore = Math.max(competitionScore, 0);

    // 3. 지하철역 접근성 점수
    let subwayScore = 0;
    if (subways.length > 0) {
      const nearestSubway = subways[0];
      if (nearestSubway.distance <= business.minSubwayDistance) {
        subwayScore = 100 - (nearestSubway.distance / business.minSubwayDistance) * 50;
      } else {
        subwayScore = 50 - ((nearestSubway.distance - business.minSubwayDistance) / 1000) * 10;
      }
      subwayScore = Math.max(subwayScore, 0);
    }

    // 4. 포화도 점수 (이상적인 포화도에 가까울수록 높음)
    const saturationDiff = Math.abs(saturation - business.idealSaturation);
    const saturationScore = Math.max(100 - saturationDiff * 2, 0);

    // 종합 점수 (가중 평균)
    const finalScore = Math.round(
      demandScore * 0.35 +
      competitionScore * 0.30 +
      subwayScore * 0.20 +
      saturationScore * 0.15
    );

    // 수요/경쟁 레벨 표시
    const demandLevel = demandScore >= 70 ? '높음' : demandScore >= 40 ? '보통' : '낮음';
    const competitionLevel = competitionScore >= 70 ? '낮음' : competitionScore >= 40 ? '보통' : '높음';

    // 상세한 추천 이유 생성 (데이터 기반)
    const reasonParts = [];

    // 1. 수요 분석
    const targetFacilities = business.targetCategories
      .map(cat => {
        const count = categoryCounts[cat] || 0;
        return count > 0 ? `${cat} ${count}개` : null;
      })
      .filter(Boolean);

    if (targetFacilities.length > 0) {
      reasonParts.push(`주변 ${targetFacilities.slice(0, 2).join(', ')} 등 수요 시설 존재`);
    }

    // 2. 지하철 접근성
    if (subways.length > 0) {
      const nearestSubway = subways[0];
      if (nearestSubway.distance <= 500) {
        reasonParts.push(`${nearestSubway.name} 도보권(${Math.round(nearestSubway.distance)}m)`);
      }
    }

    // 3. 경쟁 상황
    const competitorCategories = business.avoidCategories;
    const totalCompetitors = competitorCategories.reduce((sum, cat) => sum + (categoryCounts[cat] || 0), 0);

    if (totalCompetitors === 0) {
      reasonParts.push('경쟁업체 없음 (선점 기회)');
    } else if (totalCompetitors <= 3) {
      reasonParts.push(`동종업체 ${totalCompetitors}개 (경쟁 보통)`);
    } else {
      reasonParts.push(`동종업체 ${totalCompetitors}개 (차별화 필요)`);
    }

    // 4. 종합 평가
    let summary = '';
    if (finalScore >= 75) {
      summary = '✅ 높은 성공 가능성';
    } else if (finalScore >= 60) {
      summary = '⚠️ 전략적 운영 시 성공 가능';
    } else if (finalScore >= 40) {
      summary = '⚠️ 틈새시장 공략 전략 필요';
    } else {
      summary = '❌ 다른 입지 검토 권장';
    }

    const reason = reasonParts.length > 0
      ? `${reasonParts.join(' · ')}. ${summary}`
      : summary;

    return {
      name: business.name,
      icon: business.icon,
      score: finalScore,
      demand: demandLevel,
      competition: competitionLevel,
      reason: reason
    };
  });

  // 점수 순으로 정렬
  return results.sort((a, b) => b.score - a.score);
}

/**
 * 상세 추천 근거 생성
 */
function generateDetailedReason(business, categoryCounts, subways) {
  const reasons = [];

  // 1. 수요 분석
  const demandFacilities = [];
  if (business.targetCategories) {
    business.targetCategories.forEach(cat => {
      const count = categoryCounts[cat] || 0;
      if (count > 0) {
        demandFacilities.push(`${cat} ${count}개`);
      }
    });
  }

  if (demandFacilities.length > 0) {
    reasons.push(`<strong>✅ 수요:</strong> 주변에 ${demandFacilities.slice(0, 3).join(', ')} 등 주요 시설이 위치하여 안정적인 고객 유입이 예상됩니다.`);
  } else {
    reasons.push(`<strong>⚠️ 수요:</strong> 주요 수요 시설이 다소 부족합니다. 주거 지역의 유동인구에 의존할 필요가 있습니다.`);
  }

  // 2. 접근성 분석
  if (subways && subways.length > 0) {
    const nearestSubway = subways[0];
    const walkTime = Math.ceil(nearestSubway.distance / 80);
    if (nearestSubway.distance <= 500) {
      reasons.push(`<strong>✅ 접근성:</strong> ${nearestSubway.name}역에서 도보 ${walkTime}분 거리로 대중교통 접근성이 우수합니다.`);
    } else if (nearestSubway.distance <= 1000) {
      reasons.push(`<strong>⚠️ 접근성:</strong> ${nearestSubway.name}역에서 도보 ${walkTime}분 거리로 접근성이 보통 수준입니다.`);
    } else {
      reasons.push(`<strong>❌ 접근성:</strong> 가장 가까운 지하철역(${nearestSubway.name})이 ${Math.round(nearestSubway.distance)}m 떨어져 있어 대중교통 접근성이 다소 부족합니다.`);
    }
  }

  // 3. 경쟁 분석
  const competitionLevel = business.competition;
  if (competitionLevel === '없음' || competitionLevel === '낮음') {
    reasons.push(`<strong>✅ 경쟁:</strong> 주변 경쟁이 ${competitionLevel}하여 시장 진입 기회가 좋습니다.`);
  } else if (competitionLevel === '보통') {
    reasons.push(`<strong>⚠️ 경쟁:</strong> 경쟁이 보통 수준으로, 차별화된 서비스나 가격 경쟁력이 필요합니다.`);
  } else {
    reasons.push(`<strong>❌ 경쟁:</strong> 경쟁이 높아 신중한 시장 진입 전략이 필요합니다.`);
  }

  // 4. 종합 의견
  if (business.score >= 70) {
    reasons.push(`<strong>💡 종합:</strong> 입지 적합도가 높아 안정적인 운영이 가능할 것으로 판단됩니다.`);
  } else if (business.score >= 50) {
    reasons.push(`<strong>💡 종합:</strong> 보통 수준의 입지로, 전략적 운영이 필요합니다.`);
  } else {
    reasons.push(`<strong>💡 종합:</strong> 입지 조건이 다소 부족하므로, 신중한 검토가 필요합니다.`);
  }

  return reasons.map(r => `<div class="reason-item">${r}</div>`).join('');
}

/**
 * 추천 상세 정보 토글
 */
window.toggleRecommendationDetail = function(cardId) {
  const card = document.getElementById(cardId);
  if (!card) return;

  const detail = card.querySelector('.recommendation-detail');
  const toggleIcon = card.querySelector('.toggle-icon');

  if (!detail || !toggleIcon) return;

  if (detail.style.display === 'none') {
    detail.style.display = 'block';
    toggleIcon.textContent = '▲';
  } else {
    detail.style.display = 'none';
    toggleIcon.textContent = '▼';
  }
};

/**
 * 차트 생성 함수들
 */

// 전역 차트 인스턴스 저장
let chartInstances = {
  scoreDonut: null,
  scoreBreakdown: null,
  poiDistribution: null,
  storeDistribution: null
};

/**
 * 기존 차트 삭제
 */
function destroyCharts() {
  Object.keys(chartInstances).forEach(key => {
    if (chartInstances[key]) {
      chartInstances[key].destroy();
      chartInstances[key] = null;
    }
  });
}

/**
 * 1. 점수 도넛 차트 (최종 점수)
 */
function createScoreDonutChart(score) {
  const ctx = document.getElementById('scoreDonutChart');
  if (!ctx) return;

  // 점수에 따른 색상
  let scoreColor;
  if (score >= 70) {
    scoreColor = '#10b981'; // 녹색
  } else if (score >= 50) {
    scoreColor = '#f59e0b'; // 노란색
  } else {
    scoreColor = '#ef4444'; // 빨간색
  }

  chartInstances.scoreDonut = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['점수', '부족분'],
      datasets: [{
        data: [score, 100 - score],
        backgroundColor: [scoreColor, '#e5e7eb'],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          enabled: false
        }
      },
      cutout: '70%'
    },
    plugins: [{
      id: 'centerText',
      afterDraw: (chart) => {
        const { ctx, chartArea: { width, height } } = chart;
        ctx.save();
        ctx.font = 'bold 32px sans-serif';
        ctx.fillStyle = scoreColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(score, width / 2, height / 2 - 10);
        ctx.font = '14px sans-serif';
        ctx.fillStyle = '#64748b';
        ctx.fillText('/ 100점', width / 2, height / 2 + 20);
        ctx.restore();
      }
    }]
  });
}

/**
 * 2. 점수 구성 요소 막대 그래프
 */
function createScoreBreakdownChart(result) {
  const ctx = document.getElementById('scoreBreakdownChart');
  if (!ctx) return;

  const trafficScore = result.trafficScore || 0;
  const competitionScore = result.competitionScore || 0;
  const accessibilityScore = result.accessibilityScore || 0;
  const environmentScore = result.environmentScore || 0;

  chartInstances.scoreBreakdown = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['유동량\n(40%)', '경쟁\n(30%)', '접근성\n(20%)', '환경\n(10%)'],
      datasets: [{
        label: '점수',
        data: [trafficScore, competitionScore, accessibilityScore, environmentScore],
        backgroundColor: [
          'rgba(59, 130, 246, 0.8)',  // 파란색
          'rgba(139, 92, 246, 0.8)',  // 보라색
          'rgba(16, 185, 129, 0.8)',  // 녹색
          'rgba(245, 158, 11, 0.8)'   // 노란색
        ],
        borderColor: [
          'rgba(59, 130, 246, 1)',
          'rgba(139, 92, 246, 1)',
          'rgba(16, 185, 129, 1)',
          'rgba(245, 158, 11, 1)'
        ],
        borderWidth: 2
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: (context) => `${context.parsed.x}점`
          }
        }
      },
      scales: {
        x: {
          beginAtZero: true,
          max: 100,
          ticks: {
            callback: (value) => value + '점'
          }
        }
      }
    }
  });
}

/**
 * 3. POI 분포 파이 차트
 */
function createPOIDistributionChart(pois) {
  const ctx = document.getElementById('poiDistributionChart');
  if (!ctx) return;

  // 카테고리별 집계
  const categories = {};
  pois.forEach(poi => {
    const category = poi.category || '기타';
    categories[category] = (categories[category] || 0) + 1;
  });

  // 상위 6개 카테고리만 표시
  const sortedCategories = Object.entries(categories)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  const labels = sortedCategories.map(([cat]) => cat);
  const data = sortedCategories.map(([, count]) => count);

  chartInstances.poiDistribution = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: [
          'rgba(59, 130, 246, 0.8)',
          'rgba(16, 185, 129, 0.8)',
          'rgba(245, 158, 11, 0.8)',
          'rgba(239, 68, 68, 0.8)',
          'rgba(139, 92, 246, 0.8)',
          'rgba(236, 72, 153, 0.8)'
        ],
        borderWidth: 2,
        borderColor: '#ffffff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            padding: 10,
            font: {
              size: 11
            }
          }
        },
        tooltip: {
          callbacks: {
            label: (context) => {
              const label = context.label || '';
              const value = context.parsed || 0;
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const percentage = ((value / total) * 100).toFixed(1);
              return `${label}: ${value}개 (${percentage}%)`;
            }
          }
        }
      }
    }
  });
}

/**
 * 4. 상가 업종 분포 파이 차트
 */
function createStoreDistributionChart(storeDensity) {
  const ctx = document.getElementById('storeDistributionChart');
  if (!ctx) return;

  const distribution = storeDensity.categoryDistribution || {};

  // 상위 6개 카테고리만 표시
  const sortedCategories = Object.entries(distribution)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  if (sortedCategories.length === 0) {
    // 데이터가 없으면 차트를 숨김
    ctx.parentElement.parentElement.style.display = 'none';
    return;
  }

  const labels = sortedCategories.map(([cat]) => cat);
  const data = sortedCategories.map(([, count]) => count);

  chartInstances.storeDistribution = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: [
          'rgba(99, 102, 241, 0.8)',
          'rgba(34, 197, 94, 0.8)',
          'rgba(251, 146, 60, 0.8)',
          'rgba(244, 63, 94, 0.8)',
          'rgba(168, 85, 247, 0.8)',
          'rgba(14, 165, 233, 0.8)'
        ],
        borderWidth: 2,
        borderColor: '#ffffff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            padding: 10,
            font: {
              size: 11
            }
          }
        },
        tooltip: {
          callbacks: {
            label: (context) => {
              const label = context.label || '';
              const value = context.parsed || 0;
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const percentage = ((value / total) * 100).toFixed(1);
              return `${label}: ${value}개 (${percentage}%)`;
            }
          }
        }
      }
    }
  });
}

/**
 * 모든 차트 생성 및 표시
 */
function displayCharts(result) {
  // 기존 차트 삭제
  destroyCharts();

  // 차트 섹션 표시
  const chartsSection = document.getElementById('chartsSection');
  if (chartsSection) {
    chartsSection.style.display = 'block';
  }

  // 각 차트 생성
  if (result.score !== null) {
    createScoreDonutChart(result.score);
  }

  createScoreBreakdownChart(result);

  if (result.nearbyPOIs && result.nearbyPOIs.length > 0) {
    createPOIDistributionChart(result.nearbyPOIs);
  }

  if (result.storeDensity) {
    createStoreDistributionChart(result.storeDensity);
  }

  console.log('✅ 차트 생성 완료');
}

// 앱 시작
document.addEventListener('DOMContentLoaded', init);
