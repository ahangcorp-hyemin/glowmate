import type { RegionOption } from "@/lib/hospitals/types";

// 위치 권한 거부/실패 시 수동 선택 폴백. 대표 좌표(구청 인근)로 근처 조회.
// 초기 인제스트 범위(강남·분당+서울)에 맞춘 지역들.
export const REGIONS: RegionOption[] = [
  { id: "gangnam", label: "강남", lat: 37.4979, lng: 127.0276 },
  { id: "seocho", label: "서초", lat: 37.4837, lng: 127.0324 },
  { id: "songpa", label: "잠실·송파", lat: 37.5145, lng: 127.1059 },
  { id: "bundang", label: "분당", lat: 37.3826, lng: 127.1189 },
  { id: "mapo", label: "마포·홍대", lat: 37.5561, lng: 126.9236 },
  { id: "yongsan", label: "용산·이태원", lat: 37.5326, lng: 126.9905 },
];
