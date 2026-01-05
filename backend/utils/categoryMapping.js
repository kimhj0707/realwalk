/**
 * POI 카테고리와 STORE 업종 코드/카테고리 매핑 테이블
 *
 * POI 데이터의 카테고리와 STORE 데이터의 업종 코드를 매핑하여
 * 통합 경쟁업체 검색을 지원합니다.
 */

export const CATEGORY_MAPPING = {
  // 카페
  cafe: {
    poi: {
      categories: ['카페'],
      keywords: ['cafe', 'coffee', '커피']
    },
    store: {
      industryNames: ['커피전문점', '카페', '다방'],
      categoryMedium: ['커피전문점', '기타음료점업']
    }
  },

  // 편의점
  convenience: {
    poi: {
      categories: ['편의점'],
      keywords: ['편의점', 'CU', 'GS25', '세븐일레븐', 'emart24']
    },
    store: {
      industryNames: ['편의점', '슈퍼마켓'],
      categoryMedium: ['편의점', '슈퍼마켓']
    }
  },

  // 치킨
  chicken: {
    poi: {
      categories: ['음식점'],
      keywords: ['치킨', '닭', '후라이드', '양념']
    },
    store: {
      industryNames: ['치킨 전문점', '통닭(치킨)', '닭강정'],  // 실제 DB 값: "치킨 전문점" (공백 포함)
      categoryMedium: []  // category_medium은 너무 광범위하여 제외, industry_nm만 사용
    }
  },

  // 음식점 (일반)
  restaurant: {
    poi: {
      categories: ['음식점'],
      keywords: []
    },
    store: {
      industryNames: ['한식음식점', '중식음식점', '일식음식점', '서양식음식점', '분식전문점'],
      categoryMedium: ['한식음식점업', '중식음식점업', '일식음식점업', '서양식음식점업', '기타음식점업']
    }
  },

  // 은행
  bank: {
    poi: {
      categories: ['은행'],
      keywords: ['은행', 'bank']
    },
    store: {
      industryNames: ['은행'],
      categoryMedium: ['은행업']
    }
  },

  // 학원
  academy: {
    poi: {
      categories: ['학원'],
      keywords: ['학원', '교습소']
    },
    store: {
      industryNames: ['학원', '교습소', '입시학원'],
      categoryMedium: ['일반교습학원', '외국어학원', '예술학원', '직업기술학원']
    }
  },

  // 약국
  pharmacy: {
    poi: {
      categories: ['약국'],
      keywords: ['약국', 'pharmacy']
    },
    store: {
      industryNames: ['약국'],
      categoryMedium: ['약국업']
    }
  },

  // 베이커리
  bakery: {
    poi: {
      categories: ['음식점', '카페'],
      keywords: ['빵', '베이커리', 'bakery', '제과']
    },
    store: {
      industryNames: ['제과점', '떡제조판매', '제빵'],
      categoryMedium: ['제과점업']
    }
  },

  // 술집/주점
  bar: {
    poi: {
      categories: ['음식점'],
      keywords: ['술집', '호프', '맥주', '이자카야', '주점']
    },
    store: {
      industryNames: ['호프', '간이주점', '일반유흥주점', '생맥주전문점'],
      categoryMedium: ['일반유흥주점업', '무도유흥주점업', '기타 주점업']
    }
  },

  // PC방
  pcroom: {
    poi: {
      categories: ['여가/오락'],
      keywords: ['PC방', 'PC룸', '피시방']
    },
    store: {
      industryNames: ['PC방', '인터넷컴퓨터게임시설제공업'],
      categoryMedium: ['인터넷컴퓨터게임시설제공업']
    }
  },

  // 미용실
  beauty: {
    poi: {
      categories: ['미용'],
      keywords: ['미용실', '헤어', 'hair']
    },
    store: {
      industryNames: ['미용실', '이발소', '미장원', '헤어샵'],
      categoryMedium: ['이용업', '미용업']
    }
  },

  // 네일샵
  nail: {
    poi: {
      categories: ['미용'],
      keywords: ['네일', 'nail', '네일아트']
    },
    store: {
      industryNames: ['네일아트', '네일샵', '손발톱관리'],
      categoryMedium: ['네일아트', '기타 미용업']
    }
  },

  // 부동산
  realEstate: {
    poi: {
      categories: ['중개업소'],
      keywords: ['부동산', '공인중개사']
    },
    store: {
      industryNames: ['부동산중개업', '공인중개사사무소'],
      categoryMedium: ['부동산중개업', '부동산관리업']
    }
  },

  // 세탁소
  laundry: {
    poi: {
      categories: ['세탁소'],
      keywords: ['세탁', 'laundry', '크리닝']
    },
    store: {
      industryNames: ['세탁소', '드라이크리닝'],
      categoryMedium: ['세탁업']
    }
  },

  // 코인노래방
  karaoke: {
    poi: {
      categories: ['여가/오락'],
      keywords: ['노래방', '코인노래방', 'karaoke']
    },
    store: {
      industryNames: ['노래연습장', '코인노래방'],
      categoryMedium: ['노래연습장운영업']
    }
  },

  // 꽃집
  flower: {
    poi: {
      categories: ['꽃집'],
      keywords: ['꽃', 'flower', '화훼']
    },
    store: {
      industryNames: ['꽃집', '화훼소매'],
      categoryMedium: ['꽃집']
    }
  },

  // 병원/의원
  clinic: {
    poi: {
      categories: ['병원'],
      keywords: ['병원', '의원', '클리닉']
    },
    store: {
      industryNames: ['병원', '의원', '치과', '한의원'],
      categoryMedium: ['병원', '의원', '치과의원', '한의원']
    }
  },

  // 피트니스/헬스장
  gym: {
    poi: {
      categories: ['체육시설'],
      keywords: ['헬스', '피트니스', 'gym', '체육관']
    },
    store: {
      industryNames: ['체력단련장', '헬스클럽', '피트니스센터'],
      categoryMedium: ['체력단련장운영업']
    }
  },

  // 요가/필라테스
  yoga: {
    poi: {
      categories: ['체육시설'],
      keywords: ['요가', 'yoga', '필라테스', 'pilates']
    },
    store: {
      industryNames: ['요가학원', '필라테스', '스포츠강습'],
      categoryMedium: ['기타 스포츠시설 운영업']
    }
  }
};

/**
 * 업종 타입에 해당하는 POI 카테고리 목록 반환
 * @param {string} businessType - 업종 타입 (cafe, chicken 등)
 * @returns {Object} { categories: [], keywords: [] }
 */
export function getPOIMapping(businessType) {
  const mapping = CATEGORY_MAPPING[businessType];
  if (!mapping) {
    return { categories: [], keywords: [] };
  }
  return mapping.poi;
}

/**
 * 업종 타입에 해당하는 STORE 필터 조건 반환
 * @param {string} businessType - 업종 타입 (cafe, chicken 등)
 * @returns {Object} { industryNames: [], categoryMedium: [] }
 */
export function getStoreMapping(businessType) {
  const mapping = CATEGORY_MAPPING[businessType];
  if (!mapping) {
    return { industryNames: [], categoryMedium: [] };
  }
  return mapping.store;
}

/**
 * 업종 타입에 대한 전체 매핑 정보 반환
 * @param {string} businessType - 업종 타입
 * @returns {Object} { poi: {...}, store: {...} }
 */
export function getMapping(businessType) {
  return CATEGORY_MAPPING[businessType] || { poi: { categories: [], keywords: [] }, store: { industryNames: [], categoryMedium: [] } };
}

/**
 * 지원하는 모든 업종 타입 목록 반환
 * @returns {Array<string>} 업종 타입 배열
 */
export function getAllBusinessTypes() {
  return Object.keys(CATEGORY_MAPPING);
}
