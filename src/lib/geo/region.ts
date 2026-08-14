import type { RegionOption } from "@/lib/hospitals/types";

// 위치 권한 거부/실패 시 수동 선택 폴백. 대표 좌표(도심)로 근처 조회.
// 전국 인제스트에 맞춰 주요 도시 커버. GPS 허용 유저는 이 목록과 무관하게 실좌표 기준.
export const REGIONS: RegionOption[] = [
  { id: "gangnam", label: "강남·서초", lat: 37.4979, lng: 127.0276 },
  { id: "songpa", label: "잠실·송파", lat: 37.5145, lng: 127.1059 },
  { id: "mapo", label: "마포·홍대", lat: 37.5561, lng: 126.9236 },
  { id: "jongno", label: "종로·중구", lat: 37.5704, lng: 126.9831 },
  { id: "nowon", label: "노원·강북", lat: 37.6542, lng: 127.0568 },
  { id: "bundang", label: "분당·판교", lat: 37.3826, lng: 127.1189 },
  { id: "ilsan", label: "일산", lat: 37.6584, lng: 126.7699 },
  { id: "suwon", label: "수원", lat: 37.2659, lng: 127.0011 },
  { id: "incheon", label: "인천", lat: 37.4563, lng: 126.7052 },
  { id: "daejeon", label: "대전", lat: 36.3504, lng: 127.3845 },
  { id: "daegu", label: "대구", lat: 35.8690, lng: 128.5955 },
  { id: "busan", label: "부산", lat: 35.1578, lng: 129.0593 },
  { id: "gwangju", label: "광주", lat: 35.1477, lng: 126.9160 },
  { id: "ulsan", label: "울산", lat: 35.5389, lng: 129.3114 },
  { id: "jeju", label: "제주", lat: 33.4996, lng: 126.5312 },
];
