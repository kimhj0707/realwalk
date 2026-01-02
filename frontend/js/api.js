/**
 * API 기본 URL
 */
const API_BASE_URL = '/api';

/**
 * 상권 분석 API 호출
 */
export async function analyzeLocation(data) {
  try {
    const response = await fetch(`${API_BASE_URL}/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    return await response.json();

  } catch (error) {
    console.error('API 호출 에러:', error);
    throw error;
  }
}

/**
 * 데이터 상태 확인 API 호출
 */
export async function checkDataStatus() {
  try {
    const response = await fetch(`${API_BASE_URL}/data-status`);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();

  } catch (error) {
    console.error('데이터 상태 확인 에러:', error);
    throw error;
  }
}

/**
 * Health Check
 */
export async function checkHealth() {
  try {
    const response = await fetch('/health');

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();

  } catch (error) {
    console.error('Health Check 에러:', error);
    throw error;
  }
}

/**
 * 좌표를 주소로 변환 (Reverse Geocoding)
 * @param {number} lat - 위도
 * @param {number} lng - 경도
 * @returns {Promise<string>} 주소
 */
export async function reverseGeocode(lat, lng) {
  try {
    const response = await fetch(`${API_BASE_URL}/reverse-geocode?lat=${lat}&lng=${lng}`);

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || '주소 변환 실패');
    }

    const data = await response.json();
    return data.address;

  } catch (error) {
    console.error('Reverse Geocoding 에러:', error);
    throw error;
  }
}
