// src/sources.js - Comprehensive Source ID Mapping Database
// Maps between Kotatsu source names and Mihon extension IDs

const SOURCE_MAP = {
  // ===== ENGLISH SOURCES =====
  "mangadex": "2499283573021220255",
  "mangadex (en)": "2499283573021220255",
  "manganato": "1024627298672457456",
  "mangakakalot": "3846770256925639136",
  "mangasee": "9",
  "mangasee123": "9",
  "mangalife": "9",
  "mangapark": "8254287141594575556",
  "mangapark v3": "8254287141594575556",
  "mangaplus": "1998944621602463790",
  "manga plus": "1998944621602463790",
  "webtoons": "1845182923275629188",
  "webtoon": "1845182923275629188",
  "comick": "5765891966456790523",
  "comick.fun": "5765891966456790523",
  "batoto": "1309193200845035910",
  "bato": "1309193200845035910",
  "bato.to": "1309193200845035910",
  
  // ===== SCANLATOR SITES =====
  "asurascans": "2553637714107023673",
  "asura scans": "2553637714107023673",
  "asura": "2553637714107023673",
  "reaperscans": "188497029855967603",
  "reaper scans": "188497029855967603",
  "flamescans": "8761790328498522074",
  "flame scans": "8761790328498522074",
  "flamecomics": "8761790328498522074",
  "luminousscans": "7706177082439987755",
  "luminous scans": "7706177082439987755",
  "alphascans": "7546756490325966047",
  "alpha scans": "7546756490325966047",
  "voidscans": "8247065093786800725",
  "void scans": "8247065093786800725",
  "nightscans": "4509655996247443912",
  
  // ===== AGGREGATORS =====
  "readm": "6543234632498168544",
  "readmanga": "6543234632498168544",
  "mangahere": "6884673034175326498",
  "mangafox": "6884673034175326498",
  "mangareader": "8076783582632021587",
  "mangapill": "8076783582632021531",
  "mangabuddy": "2538700039992853512",
  "mangatx": "3908282244132481792",
  "manhuaplus": "7530287748450684184",
  "1stkissmanga": "2721247987442232157",
  "kissmanga": "4955866890569858952",
  
  // ===== SPANISH =====
  "tmofans": "6840633575263395267",
  "tumangaonline": "6840633575263395267",
  "tu manga online": "6840633575263395267",
  "lectortmo": "6840633575263395267",
  "mangasin": "4064709858673115067",
  "inmanga": "6965218235655802377",
  
  // ===== FRENCH =====
  "mangalib": "5714610692227829831",
  "japscan": "1908802013916934156",
  "sushi-scan": "7534436782915393377",
  "scantrad": "4264224553264275714",
  
  // ===== RUSSIAN =====
  "remanga": "8033579885549490547",
  "readmanga.live": "8033579885549490547",
  "mangalib.me": "5714610692227829831",
  
  // ===== JAPANESE =====
  "rawkuma": "1839226880348126720",
  "raw-manga": "1839226880348126720",
  
  // ===== KOREAN (Manhwa) =====
  "toonily": "6294577055953029822",
  "manhwa18": "2016038381909498697",
  "manhwatop": "8034989885549490544",
  "manytoon": "3539019969854829131",
  
  // ===== CHINESE (Manhua) =====
  "manhuafast": "7530287748450684444",
  "manhuaga": "6178928928441088567",
  
  // ===== NSFW =====
  "nhentai": "7309587263682593705",
  "nhentai.net": "7309587263682593705",
  "hentai2read": "1147788850338020",
  "e-hentai": "8803127450021473025",
  "pururin": "5199602181685553409",
  
  // ===== PORTUGUESE =====
  "mangalivre": "1808054561602432821",
  "manga livre": "1808054561602432821",
  "unionmangas": "380034878545898019",
  
  // ===== INDONESIAN =====
  "komikindo": "6927605517028511574",
  "komiku": "5119602181685553408",
  "maidmanga": "3427285214399817467",
  "mangaindo": "6927605517028511573",
  
  // ===== ARABIC =====
  "mangaae": "3270616857158279808",
  "azoramanga": "7346812700127449620",
  
  // ===== TURKISH =====
  "mangadenizi": "5427285214399817468",
  "turktoon": "3427285214399817469",
  
  // ===== VIETNAMESE =====
  "nettruyen": "2761192643234155643",
  "truyenqq": "1998944621602463792",
};

// Reverse map for Mihon ID -> Kotatsu name
const REVERSE_SOURCE_MAP = {};
for (const [name, id] of Object.entries(SOURCE_MAP)) {
  if (!REVERSE_SOURCE_MAP[id]) {
    REVERSE_SOURCE_MAP[id] = name;
  }
}

/**
 * Find Mihon source ID from Kotatsu source name
 * @param {string} kotatsuSource - Source name from Kotatsu backup
 * @returns {string} Mihon source ID (as string for int64 compatibility)
 */
function findMihonSourceId(kotatsuSource) {
  if (!kotatsuSource) return "0";
  
  const normalized = kotatsuSource.toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();
  
  // Direct match
  for (const [key, id] of Object.entries(SOURCE_MAP)) {
    if (key.replace(/[^a-z0-9]/g, "") === normalized) {
      return id;
    }
  }
  
  // Partial match
  for (const [key, id] of Object.entries(SOURCE_MAP)) {
    const keyNorm = key.replace(/[^a-z0-9]/g, "");
    if (normalized.includes(keyNorm) || keyNorm.includes(normalized)) {
      return id;
    }
  }
  
  console.warn(`[sources] Unknown Kotatsu source: ${kotatsuSource}`);
  return "0"; // Local source fallback
}

/**
 * Find Kotatsu source name from Mihon source ID
 * @param {string|number} mihonId - Source ID from Mihon backup
 * @returns {string} Kotatsu source name
 */
function findKotatsuSourceName(mihonId) {
  if (!mihonId) return "LOCAL";
  
  const id = String(mihonId);
  return REVERSE_SOURCE_MAP[id] || `UNKNOWN_${id}`;
}

// Export
if (typeof window !== 'undefined') {
  window.findMihonSourceId = findMihonSourceId;
  window.findKotatsuSourceName = findKotatsuSourceName;
  window.SOURCE_MAP = SOURCE_MAP;
}
