// Comprehensive Source ID Mapping for Kotatsu to Mihon
// Extracted from common extension repositories (Keiyoushi, etc)

window.sourceMap = {
    // English
    "mangadex": "6400630869375065225",
    "manganato": "7369325983802951508",
    "bato": "7146431200542137600",
    "batoto": "7146431200542137600",
    "readmanganato": "7369325983802951508",
    "mangakakalot": "129848532426998595",
    "mangasee": "4546401666710486005",
    "mangasee123": "4546401666710486005",
    "mangalife": "4546401666710486005",
    "comick": "5449718423401569947",
    "tmofans": "3834079813280879512",
    "tu manga online": "3834079813280879512",
    "mangahub": "5833215801328608226",
    "mangapark": "2522397858349455322",
    "mangapark v3": "2522397858349455322",
    "mangaplus": "5576269666831778942",
    "webtoons": "6586073167439169620",
    "webtoon": "6586073167439169620",
    "toonily": "4165561049214436585",
    "manhwa18": "84824249051566850",
    "hiperdex": "3015486842718408544",
    "reaperscans": "8242967664654519655",
    "asura scans": "8247065093786800725",
    "flame scans": "7485292837380969502",
    "luminous scans": "5781313437255776075",
    "alpha scans": "6614532646698656111",

    // Scanlators / Other
    "nhentai": "7337372332675975253",
    "nhentai.net": "7337372332675975253",
    "pururin": "2572520031821814674",
    "hentai2read": "5762635957019565567",
    "e-hentai": "5055009087596823374",

    // If source name logic fails, fallback to hashing or search
};

// Helper: Levenshtein distance for fuzzy matching
function getLevenshteinDistance(a, b) {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const matrix = [];

    // increment along the first column of each row
    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }

    // increment each column in the first row
    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }

    // Fill in the rest of the matrix
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // substitution
                    Math.min(
                        matrix[i][j - 1] + 1, // insertion
                        matrix[i - 1][j] + 1  // deletion
                    )
                );
            }
        }
    }

    return matrix[b.length][a.length];
}

// Global Smart Mapper
window.findSourceId = function(kotatsuSourceName) {
    if (!kotatsuSourceName) return "0";
    const kName = kotatsuSourceName.toLowerCase().replace(/[^a-z0-9]/g, "");

    // 1. Direct key match (fast)
    if (window.sourceMap[kName]) return window.sourceMap[kName];

    // 2. Contains match
    for (const [key, id] of Object.entries(window.sourceMap)) {
        if (kName.includes(key) || key.includes(kName)) return id;
    }

    // 3. Fuzzy Match (if needed, but keeping it simple for now to avoid false positives)
    // We can add a threshold if we have a larger DB.
    
    // Default to a Local Source if really unknown, 
    // OR return a "Magic Hash" that is consistent? 
    // Mihon treats unknown large IDs as "Available to install?" maybe.
    
    // Let's stick to 0 (Local) for safety, but maybe log it.
    console.warn(`Unknown source: ${kotatsuSourceName}`);
    return "0"; 
};
