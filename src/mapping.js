// src/mapping.js - Ultra-fast Status Mapping
// Uses direct array indexing instead of switch/if chains

// Mihon -> Kotatsu: index by Mihon status code (0-6)
const MIHON_TO_KOTATSU = ['ONGOING', 'ONGOING', 'FINISHED', 'ONGOING', 'ONGOING', 'ABANDONED', 'PAUSED'];

// Kotatsu -> Mihon: direct lookup table
const KOTATSU_TO_MIHON = {
  'ONGOING': 1,
  'FINISHED': 2,
  'COMPLETED': 2,
  'ABANDONED': 5,
  'CANCELLED': 5,
  'PAUSED': 6,
  'HIATUS': 6,
  'UPCOMING': 4,
  'PUBLISHING': 4,
};

function mapKotatsuStatusToMihon(status) {
  if (!status) return 0;
  return KOTATSU_TO_MIHON[String(status).toUpperCase()] || 0;
}

function mapMihonStatusToKotatsu(status) {
  return MIHON_TO_KOTATSU[Number(status)] || 'ONGOING';
}

if (typeof window !== 'undefined') {
  window.mapKotatsuStatusToMihon = mapKotatsuStatusToMihon;
  window.mapMihonStatusToKotatsu = mapMihonStatusToKotatsu;
}
