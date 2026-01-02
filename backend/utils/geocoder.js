import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// ES 모듈에서 __dirname 사용하기
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 환경변수 로드 (루트 디렉토리의 .env 파일)
dotenv.config({ path: path.join(__dirname, '../../.env') });

const KAKAO_REST_API_KEY = process.env.KAKAO_REST_API_KEY;
const KAKAO_GEOCODE_URL = 'https://dapi.kakao.com/v2/local/search/address.json';

/**
 * 카카오 API를 사용하여 주소를 좌표로 변환
 * @param {string} address - 변환할 주소
 * @returns {Promise<{lat: number, lng: number, address: string}>}
 */
export async function geocodeAddress(address) {
  if (!address) {
    throw new Error('주소를 입력해주세요.');
  }

  if (!KAKAO_REST_API_KEY) {
    throw new Error('카카오 API 키가 설정되지 않았습니다. .env 파일을 확인하세요.');
  }

  try {
    const response = await axios.get(KAKAO_GEOCODE_URL, {
      params: {
        query: address
      },
      headers: {
        'Authorization': `KakaoAK ${KAKAO_REST_API_KEY}`
      }
    });

    const { data } = response;

    // 결과가 없는 경우
    if (!data.documents || data.documents.length === 0) {
      throw new Error(`주소를 찾을 수 없습니다: ${address}`);
    }

    // 첫 번째 결과 사용
    const result = data.documents[0];

    // 도로명 주소 또는 지번 주소
    const addressInfo = result.road_address || result.address;

    return {
      lat: parseFloat(addressInfo.y),
      lng: parseFloat(addressInfo.x),
      address: addressInfo.address_name,
      addressType: result.road_address ? 'road' : 'jibun'
    };

  } catch (error) {
    if (error.response) {
      // 카카오 API 에러
      console.error('카카오 API 에러:', error.response.data);
      throw new Error(`주소 검색 실패: ${error.response.data.message || '알 수 없는 오류'}`);
    } else if (error.request) {
      // 네트워크 에러
      console.error('네트워크 에러:', error.message);
      throw new Error('주소 검색 서버에 연결할 수 없습니다.');
    } else {
      // 기타 에러
      throw error;
    }
  }
}

/**
 * 좌표를 주소로 변환 (역지오코딩)
 * @param {number} lat - 위도
 * @param {number} lng - 경도
 * @returns {Promise<{address: string}>}
 */
export async function reverseGeocode(lat, lng) {
  if (!lat || !lng) {
    throw new Error('좌표를 입력해주세요.');
  }

  if (!KAKAO_REST_API_KEY) {
    throw new Error('카카오 API 키가 설정되지 않았습니다.');
  }

  try {
    const response = await axios.get('https://dapi.kakao.com/v2/local/geo/coord2address.json', {
      params: {
        x: lng,
        y: lat
      },
      headers: {
        'Authorization': `KakaoAK ${KAKAO_REST_API_KEY}`
      }
    });

    const { data } = response;

    if (!data.documents || data.documents.length === 0) {
      throw new Error('주소를 찾을 수 없습니다.');
    }

    const result = data.documents[0];
    const addressInfo = result.road_address || result.address;

    return {
      address: addressInfo.address_name
    };

  } catch (error) {
    console.error('역지오코딩 에러:', error.message);
    throw new Error('좌표를 주소로 변환하는데 실패했습니다.');
  }
}
