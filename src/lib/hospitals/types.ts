// 근처 병원 실데이터 계약. price=null 이면 '병원 문의'(공개가 없음).
export interface NearbyHospital {
  id: string;
  name: string;
  district: string;
  address: string | null;
  phone: string | null;
  homepageUrl: string | null;
  clNm: string | null;        // 종별(의원/병원)
  doctorCount: number | null; // 총 의사수
  estbDd: string | null;      // 개원일(ISO date)
  lat: number;
  lng: number;
  rating: number | null;
  reviews: number;
  distanceKm: number;
  price: number | null; // HIRA 비급여 공개가. 없으면 null → '문의'
  isAd: boolean;        // §27 정액 광고 노출(건당 수수료 없음)
  isPartner?: boolean;  // 입점(파트너) 여부 — 방문신청 전달 경로 결정
}

export interface RegionOption {
  id: string;
  label: string;
  lat: number;
  lng: number;
}
