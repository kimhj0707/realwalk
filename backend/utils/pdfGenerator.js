/**
 * PDF 리포트 생성 유틸리티
 * Puppeteer를 사용하여 분석 결과를 PDF로 변환
 */

import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 분석 결과를 PDF로 변환
 *
 * @param {Object} analysisData - 분석 결과 데이터
 * @returns {Promise<Buffer>} PDF 버퍼
 */
export async function generatePDF(analysisData) {
  const startTime = Date.now();

  try {
    console.log('📄 PDF 생성 시작...');

    // Puppeteer 브라우저 실행
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    // HTML 템플릿 생성
    const html = generateHTMLTemplate(analysisData);

    // HTML 설정
    await page.setContent(html, {
      waitUntil: 'networkidle0'
    });

    // PDF 생성 옵션
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '15mm',
        bottom: '20mm',
        left: '15mm'
      }
    });

    await browser.close();

    const elapsed = Date.now() - startTime;
    console.log(`✅ PDF 생성 완료: ${elapsed}ms`);

    return pdfBuffer;

  } catch (error) {
    console.error('❌ PDF 생성 실패:', error);
    throw error;
  }
}

/**
 * HTML 템플릿 생성
 *
 * @param {Object} data - 분석 결과 데이터
 * @returns {string} HTML 문자열
 */
function generateHTMLTemplate(data) {
  const {
    address,
    coordinates,
    business,
    score,
    trafficScore,
    competitionScore,
    accessibilityScore,
    environmentScore,
    dailyTraffic,
    stayableTraffic,
    competitorCount,
    saturation,
    buildingCount,
    poiCount,
    competitors = [],
    networkAnalysisEnabled
  } = data;

  // 업종명 매핑
  const businessTypeMap = {
    'cafe': '카페',
    'convenience': '편의점',
    'chicken': '치킨',
    'restaurant': '음식점',
    'bank': '은행',
    'academy': '학원',
    'pharmacy': '약국'
  };
  const businessName = businessTypeMap[business] || business;

  // 점수에 따른 등급 계산
  const getGrade = (score) => {
    if (score >= 90) return { grade: 'S', color: '#4CAF50', label: '최우수' };
    if (score >= 80) return { grade: 'A', color: '#8BC34A', label: '우수' };
    if (score >= 70) return { grade: 'B', color: '#FFC107', label: '양호' };
    if (score >= 60) return { grade: 'C', color: '#FF9800', label: '보통' };
    return { grade: 'D', color: '#F44336', label: '미흡' };
  };

  const gradeInfo = getGrade(score);

  // 경쟁 포화도 평가
  const getSaturationLevel = (saturation) => {
    if (saturation >= 80) return { level: '매우 높음', color: '#F44336' };
    if (saturation >= 60) return { level: '높음', color: '#FF9800' };
    if (saturation >= 40) return { level: '보통', color: '#FFC107' };
    if (saturation >= 20) return { level: '낮음', color: '#8BC34A' };
    return { level: '매우 낮음', color: '#4CAF50' };
  };

  const saturationInfo = getSaturationLevel(saturation);

  // 상위 경쟁업체 (최대 10개)
  const topCompetitors = competitors.slice(0, 10);

  // 권장사항 생성
  const recommendations = generateRecommendations(data);

  return `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>RealWalk 상권 분석 리포트</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Malgun Gothic', sans-serif;
      line-height: 1.6;
      color: #333;
      background: #fff;
    }

    .container {
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
    }

    /* 헤더 */
    .header {
      text-align: center;
      padding: 30px 0;
      border-bottom: 3px solid #2196F3;
      margin-bottom: 30px;
    }

    .header h1 {
      font-size: 32px;
      color: #2196F3;
      margin-bottom: 10px;
    }

    .header .subtitle {
      font-size: 16px;
      color: #666;
    }

    /* 분석 개요 */
    .overview {
      background: #f5f5f5;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 30px;
    }

    .overview-item {
      display: flex;
      justify-content: space-between;
      padding: 10px 0;
      border-bottom: 1px solid #ddd;
    }

    .overview-item:last-child {
      border-bottom: none;
    }

    .overview-label {
      font-weight: bold;
      color: #555;
    }

    .overview-value {
      color: #333;
    }

    /* 종합 점수 */
    .score-section {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px;
      border-radius: 12px;
      text-align: center;
      margin-bottom: 30px;
    }

    .score-main {
      font-size: 72px;
      font-weight: bold;
      margin: 20px 0;
    }

    .score-grade {
      font-size: 48px;
      font-weight: bold;
      background: rgba(255,255,255,0.2);
      display: inline-block;
      padding: 10px 30px;
      border-radius: 50px;
      margin-top: 10px;
    }

    .score-label {
      font-size: 18px;
      opacity: 0.9;
      margin-top: 10px;
    }

    /* 세부 점수 */
    .detailed-scores {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 20px;
      margin-bottom: 30px;
    }

    .score-card {
      background: #fff;
      border: 2px solid #e0e0e0;
      border-radius: 8px;
      padding: 20px;
      text-align: center;
    }

    .score-card-title {
      font-size: 14px;
      color: #666;
      margin-bottom: 10px;
    }

    .score-card-value {
      font-size: 36px;
      font-weight: bold;
      color: #2196F3;
    }

    .score-card-max {
      font-size: 16px;
      color: #999;
    }

    /* 섹션 */
    .section {
      margin-bottom: 30px;
      page-break-inside: avoid;
    }

    .section-title {
      font-size: 24px;
      color: #2196F3;
      margin-bottom: 15px;
      padding-bottom: 10px;
      border-bottom: 2px solid #2196F3;
    }

    /* 통계 그리드 */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 15px;
      margin-bottom: 20px;
    }

    .stat-box {
      background: #f9f9f9;
      border-left: 4px solid #2196F3;
      padding: 15px;
      border-radius: 4px;
    }

    .stat-label {
      font-size: 12px;
      color: #666;
      margin-bottom: 5px;
    }

    .stat-value {
      font-size: 24px;
      font-weight: bold;
      color: #333;
    }

    .stat-unit {
      font-size: 14px;
      color: #999;
      margin-left: 2px;
    }

    /* 경쟁업체 테이블 */
    .competitor-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 15px;
    }

    .competitor-table th {
      background: #2196F3;
      color: white;
      padding: 12px;
      text-align: left;
      font-size: 14px;
    }

    .competitor-table td {
      padding: 10px 12px;
      border-bottom: 1px solid #e0e0e0;
      font-size: 13px;
    }

    .competitor-table tr:hover {
      background: #f5f5f5;
    }

    .source-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: bold;
    }

    .source-poi {
      background: #E3F2FD;
      color: #1976D2;
    }

    .source-store {
      background: #FFF3E0;
      color: #F57C00;
    }

    /* 권장사항 */
    .recommendations {
      background: #E8F5E9;
      border-left: 4px solid #4CAF50;
      padding: 20px;
      border-radius: 4px;
    }

    .recommendations ul {
      margin-left: 20px;
      margin-top: 10px;
    }

    .recommendations li {
      margin-bottom: 8px;
      line-height: 1.6;
    }

    /* 푸터 */
    .footer {
      text-align: center;
      padding: 30px 0;
      margin-top: 50px;
      border-top: 2px solid #e0e0e0;
      color: #999;
      font-size: 12px;
    }

    .footer-logo {
      font-size: 20px;
      font-weight: bold;
      color: #2196F3;
      margin-bottom: 10px;
    }

    /* 페이지 브레이크 */
    .page-break {
      page-break-after: always;
    }

    /* 배지 */
    .badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: bold;
      margin-left: 10px;
    }

    .badge-high {
      background: #FFEBEE;
      color: #C62828;
    }

    .badge-medium {
      background: #FFF3E0;
      color: #F57C00;
    }

    .badge-low {
      background: #E8F5E9;
      color: #2E7D32;
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- 헤더 -->
    <div class="header">
      <h1>🚶 RealWalk</h1>
      <div class="subtitle">보행 네트워크 기반 상권 분석 리포트</div>
    </div>

    <!-- 분석 개요 -->
    <div class="overview">
      <div class="overview-item">
        <span class="overview-label">📍 분석 위치</span>
        <span class="overview-value">${address || '정보 없음'}</span>
      </div>
      <div class="overview-item">
        <span class="overview-label">🏪 업종</span>
        <span class="overview-value">${businessName}</span>
      </div>
      <div class="overview-item">
        <span class="overview-label">📌 좌표</span>
        <span class="overview-value">${coordinates.lat.toFixed(6)}, ${coordinates.lng.toFixed(6)}</span>
      </div>
      <div class="overview-item">
        <span class="overview-label">📅 분석 일시</span>
        <span class="overview-value">${new Date().toLocaleString('ko-KR')}</span>
      </div>
      <div class="overview-item">
        <span class="overview-label">🔬 분석 방법</span>
        <span class="overview-value">${networkAnalysisEnabled ? '네트워크 거리 기반 분석' : '직선 거리 기반 분석'}</span>
      </div>
    </div>

    <!-- 종합 점수 -->
    <div class="score-section">
      <div style="font-size: 20px; opacity: 0.9;">종합 점수</div>
      <div class="score-main">${score}<span style="font-size: 36px; opacity: 0.8;">/100</span></div>
      <div class="score-grade" style="background-color: ${gradeInfo.color};">
        ${gradeInfo.grade}등급
      </div>
      <div class="score-label">${gradeInfo.label} 입지</div>
    </div>

    <!-- 세부 점수 -->
    <div class="detailed-scores">
      <div class="score-card">
        <div class="score-card-title">🚶 유동량 점수</div>
        <div class="score-card-value">${trafficScore}<span class="score-card-max">/100</span></div>
      </div>
      <div class="score-card">
        <div class="score-card-title">🏢 접근성 점수</div>
        <div class="score-card-value">${accessibilityScore}<span class="score-card-max">/100</span></div>
      </div>
      <div class="score-card">
        <div class="score-card-title">⚔️ 경쟁 점수</div>
        <div class="score-card-value">${competitionScore}<span class="score-card-max">/100</span></div>
      </div>
      <div class="score-card">
        <div class="score-card-title">🌳 환경 점수</div>
        <div class="score-card-value">${environmentScore}<span class="score-card-max">/100</span></div>
      </div>
    </div>

    <!-- 페이지 브레이크 -->
    <div class="page-break"></div>

    <!-- 유동량 분석 -->
    <div class="section">
      <h2 class="section-title">📊 유동량 분석</h2>
      <div class="stats-grid">
        <div class="stat-box">
          <div class="stat-label">일일 추정 유동량</div>
          <div class="stat-value">${dailyTraffic.toLocaleString()}<span class="stat-unit">명</span></div>
        </div>
        <div class="stat-box">
          <div class="stat-label">체류 유동량</div>
          <div class="stat-value">${stayableTraffic.toLocaleString()}<span class="stat-unit">명</span></div>
        </div>
        <div class="stat-box">
          <div class="stat-label">체류 비율</div>
          <div class="stat-value">${((stayableTraffic / dailyTraffic) * 100).toFixed(1)}<span class="stat-unit">%</span></div>
        </div>
      </div>
      <p style="color: #666; font-size: 14px; line-height: 1.8;">
        해당 지역의 일일 추정 유동량은 <strong>${dailyTraffic.toLocaleString()}명</strong>입니다.
        이 중 체류 가능 인구는 약 <strong>${stayableTraffic.toLocaleString()}명</strong>으로 추정됩니다.
        ${networkAnalysisEnabled ? '실제 보행로 네트워크를 분석하여 도달 가능한 인구만 계산하였습니다.' : ''}
      </p>
    </div>

    <!-- 상권 환경 -->
    <div class="section">
      <h2 class="section-title">🏙️ 상권 환경</h2>
      <div class="stats-grid">
        <div class="stat-box">
          <div class="stat-label">주변 건물</div>
          <div class="stat-value">${buildingCount}<span class="stat-unit">개</span></div>
        </div>
        <div class="stat-box">
          <div class="stat-label">주요 시설 (POI)</div>
          <div class="stat-value">${poiCount}<span class="stat-unit">개</span></div>
        </div>
        <div class="stat-box">
          <div class="stat-label">환경 점수</div>
          <div class="stat-value">${environmentScore}<span class="stat-unit">/100</span></div>
        </div>
      </div>
    </div>

    <!-- 경쟁 분석 -->
    <div class="section">
      <h2 class="section-title">
        ⚔️ 경쟁 분석
        <span class="badge badge-${saturation >= 60 ? 'high' : saturation >= 40 ? 'medium' : 'low'}">
          포화도 ${saturation}% (${saturationInfo.level})
        </span>
      </h2>
      <div class="stats-grid">
        <div class="stat-box" style="grid-column: span 3;">
          <div class="stat-label">반경 500m 내 경쟁업체</div>
          <div class="stat-value">${competitorCount}<span class="stat-unit">개</span></div>
        </div>
      </div>

      ${topCompetitors.length > 0 ? `
      <table class="competitor-table">
        <thead>
          <tr>
            <th style="width: 40px;">순위</th>
            <th>업체명</th>
            <th style="width: 80px;">출처</th>
            <th style="width: 100px;">거리</th>
          </tr>
        </thead>
        <tbody>
          ${topCompetitors.map((comp, idx) => `
          <tr>
            <td style="text-align: center;">${idx + 1}</td>
            <td>${comp.displayName || comp.name}</td>
            <td><span class="source-badge source-${comp.source.toLowerCase()}">${comp.source}</span></td>
            <td>${comp.distance}m</td>
          </tr>
          `).join('')}
        </tbody>
      </table>
      ` : '<p style="color: #666; margin-top: 15px;">반경 내 경쟁업체가 없습니다.</p>'}

      <p style="color: #666; font-size: 14px; margin-top: 15px; line-height: 1.8;">
        경쟁 포화도는 <strong style="color: ${saturationInfo.color};">${saturation}% (${saturationInfo.level})</strong>입니다.
        ${saturation < 40 ? '경쟁이 적어 신규 진입에 유리한 지역입니다.' :
          saturation < 60 ? '적정 수준의 경쟁 환경입니다.' :
          '경쟁이 심화된 지역으로 차별화 전략이 필요합니다.'}
      </p>
    </div>

    <!-- 페이지 브레이크 -->
    <div class="page-break"></div>

    <!-- 전략적 권장사항 -->
    <div class="section">
      <h2 class="section-title">💡 전략적 권장사항</h2>
      <div class="recommendations">
        <ul>
          ${recommendations.map(rec => `<li>${rec}</li>`).join('')}
        </ul>
      </div>
    </div>

    <!-- 분석 방법론 -->
    <div class="section">
      <h2 class="section-title">📋 분석 방법론</h2>
      <p style="color: #666; font-size: 14px; line-height: 1.8;">
        <strong>RealWalk</strong>는 실제 보행로 네트워크 데이터를 활용한 공간 분석을 제공합니다.<br><br>

        <strong>• 유동량 추정:</strong> 보행로 밀도, 주변 건물 인구, POI 방문객, 지하철 유입 인구를 종합하여 계산<br>
        <strong>• 네트워크 거리:</strong> ${networkAnalysisEnabled ? '다익스트라 알고리즘을 사용한 실제 보행 가능 거리 계산' : '직선 거리 기반 계산'}<br>
        <strong>• 경쟁 분석:</strong> POI 및 소상공인 상가 데이터를 통합하여 정확한 경쟁업체 파악<br>
        <strong>• 종합 점수:</strong> 유동량(40%) + 접근성(20%) + 경쟁(30%) + 환경(10%) 가중 평균<br>
      </p>
    </div>

    <!-- 푸터 -->
    <div class="footer">
      <div class="footer-logo">RealWalk</div>
      <div>보행 네트워크 기반 상권 분석 서비스</div>
      <div style="margin-top: 10px;">본 리포트는 참고용으로 제공되며, 실제 창업 결정 시 추가적인 시장 조사가 필요합니다.</div>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * 권장사항 생성
 *
 * @param {Object} data - 분석 데이터
 * @returns {Array<string>} 권장사항 배열
 */
function generateRecommendations(data) {
  const recommendations = [];
  const { score, competitionScore, saturation, trafficScore, competitorCount, dailyTraffic } = data;

  // 종합 점수 기반
  if (score >= 80) {
    recommendations.push('우수한 입지 조건으로 창업에 적합한 지역입니다.');
  } else if (score >= 60) {
    recommendations.push('양호한 입지이나 경쟁 환경 및 차별화 전략을 고려하세요.');
  } else {
    recommendations.push('입지 조건이 다소 미흡하여 신중한 검토가 필요합니다.');
  }

  // 경쟁 분석 기반
  if (saturation >= 80) {
    recommendations.push(`경쟁이 매우 심화된 지역입니다. 명확한 차별화 포인트와 마케팅 전략이 필수적입니다.`);
  } else if (saturation >= 60) {
    recommendations.push(`적정 수준의 경쟁 환경입니다. 품질과 서비스로 차별화하세요.`);
  } else if (saturation <= 30 && competitorCount === 0) {
    recommendations.push('경쟁업체가 없는 지역입니다. 수요 검증 후 선점 효과를 노릴 수 있습니다.');
  } else if (saturation <= 40) {
    recommendations.push('경쟁이 적어 신규 진입에 유리합니다. 초기 고객 확보에 집중하세요.');
  }

  // 유동량 기반
  if (trafficScore >= 80) {
    recommendations.push(`일일 유동량 ${dailyTraffic.toLocaleString()}명으로 높은 편입니다. 가시성과 접근성을 최대한 활용하세요.`);
  } else if (trafficScore < 50) {
    recommendations.push('유동량이 다소 낮은 편입니다. 단골 고객 확보 및 온라인 마케팅을 병행하세요.');
  }

  // 경쟁업체 수 기반
  if (competitorCount >= 10) {
    recommendations.push(`반경 500m 내 ${competitorCount}개 경쟁업체가 있습니다. 경쟁 업체 분석 및 벤치마킹을 철저히 하세요.`);
  } else if (competitorCount >= 5) {
    recommendations.push('적정 수준의 경쟁업체가 있습니다. 상권이 형성되어 있어 수요가 검증된 지역입니다.');
  }

  // 일반 권장사항
  recommendations.push('실제 방문하여 시간대별 유동 인구, 주 고객층, 주변 업종 등을 직접 확인하세요.');
  recommendations.push('임대료, 보증금, 권리금 등 재무적 요소와 함께 종합적으로 판단하세요.');

  return recommendations;
}
