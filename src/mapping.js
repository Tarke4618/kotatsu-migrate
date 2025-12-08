// src/mapping.js - Shared Mapping Logic
// Handles status code conversions between Kotatsu and Mihon

/**
 * Map Kotatsu status string to Mihon status integer
 * @param {string} status - Kotatsu status (ONGOING, FINISHED, etc.)
 * @returns {number} Mihon status code
 */
function mapKotatsuStatusToMihon(status) {
  // Kotatsu: ONGOING, FINISHED, ABANDONED, PAUSED, UPCOMING
  // Mihon: 0=Unknown, 1=Ongoing, 2=Completed, 3=Licensed, 4=Publishing, 5=Cancelled, 6=Hiatus
  if (!status) return 0;
  const s = String(status).toUpperCase();
  
  if (s.includes('ONGOING')) return 1; // Ongoing
  if (s.includes('FINISHED') || s.includes('COMPLETED')) return 2; // Completed
  if (s.includes('ABANDONED') || s.includes('CANCELLED')) return 5; // Cancelled
  if (s.includes('PAUSED') || s.includes('HIATUS')) return 6; // Hiatus
  if (s.includes('UPCOMING') || s.includes('PUBLISHING')) return 4; // Publishing/Upcoming (Mihon 3 is Licensed, 4 is Publishing)
  
  return 0; // Unknown
}

/**
 * Map Mihon status integer to Kotatsu status string
 * @param {number} status - Mihon status code
 * @returns {string} Kotatsu status string
 */
function mapMihonStatusToKotatsu(status) {
  // Mihon: 0=Unknown, 1=Ongoing, 2=Completed, 3=Licensed, 4=Publishing, 5=Cancelled, 6=Hiatus
  // Kotatsu: ONGOING, FINISHED, ABANDONED, PAUSED
  
  switch (Number(status)) {
    case 1: return 'ONGOING';
    case 2: return 'FINISHED';
    case 3: return 'ONGOING'; // Licensed - best effort map to Ongoing
    case 4: return 'ONGOING'; // Publishing - best effort map to Ongoing (or maybe UPCOMING if Kotatsu supported it widely)
    case 5: return 'ABANDONED'; // Cancelled
    case 6: return 'PAUSED'; // Hiatus
    default: return 'ONGOING'; // Default fallback, or nullable
  }
}

// Export
if (typeof window !== 'undefined') {
  window.mapKotatsuStatusToMihon = mapKotatsuStatusToMihon;
  window.mapMihonStatusToKotatsu = mapMihonStatusToKotatsu;
}
