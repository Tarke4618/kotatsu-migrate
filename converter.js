// converter.js

// Kotatsu parsing logic
async function convertKotatsuToTachiyomi(file) {
    const zip = new JSZip();
    const contents = await zip.loadAsync(file);
    
    // Data holders
    let kotatsuFavs = [];
    let kotatsuHistory = [];
    let kotatsuCats = [];
    let kotatsuChapters = {}; // Map mangaId -> chapters list if separate

    // 1. Categories
    let kotatsuCategories = [];
    if (contents.files['categories.json']) {
        try {
            const str = await contents.files['categories.json'].async('string');
            kotatsuCategories = JSON.parse(str);
        } catch(e) { console.warn("Failed to parse categories", e); }
    }
    
    // 2. Favourites
    // Could be 'favourites.json' or 'manga.json'
    if (contents.files['favourites.json']) {
        try {
            const str = await contents.files['favourites.json'].async('string');
            kotatsuFavs = JSON.parse(str);
        } catch(e) { console.warn("Failed to parse favourites", e); }
    }

    // 3. History
    if (contents.files['history.json']) {
        try {
            const str = await contents.files['history.json'].async('string');
            kotatsuHistory = JSON.parse(str);
        } catch(e) { console.warn("Failed to parse history", e); }
    }

    // Tachiyomi Categories
    // Kotatsu categories might just be names.
    // Tachi needs objects.
    const tachiCategories = kotatsuCategories.map((c, idx) => ({
        name: c.name || c,
        order: idx, // or c.order
        flags: 0
    }));
    
    // Helper to find category index by name
    const getCatIndex = (name) => {
        return tachiCategories.findIndex(tc => tc.name === name);
    };

    // Process Managa
    const tachiMangaList = kotatsuFavs.map(kManga => {
        // Source mapping
        // Kotatsu source names need to map to Tachi Source IDs (long)
        // This is the hardest part.
        const sourceId = mapSourceToTachiyomiId(kManga.source);

        // Categories
        // Kotatsu treats categories as string name attached to manga?
        // Check kManga.category or kManga.categories
        let mangCats = [];
        if (kManga.category) { // Single category?
             const idx = getCatIndex(kManga.category);
             if (idx >= 0) mangCats.push(idx); // Tachi uses order/index usually? No, older uses ID, Proto uses 'categories' int32 which matches 'order' usually unless logic changed.
             // Actually proto 'repeated int32 categories = 14' usually refers to order or flags?
             // Standard Tachi: categories are mapped by comparing 'BackupCategory.order'??
             // Let's assume sending the index in tachiCategories array works.
        } else if (kManga.categories) {
            kManga.categories.forEach(cName => {
                const idx = getCatIndex(cName);
                if (idx >= 0) mangCats.push(idx);
            });
        }

        // Chapters & History
        // If Kotatsu doesn't have chapters in favourites.json, we might need to look elsewhere.
        // Assuming minimal migration for now (Library only) if chapters missing.
        // If history exists, we try to attach.
        
        // Find history for this manga
        // Kotatsu history might link by mangaId or title
        // Assuming kManga.id exists?
        const hItems = kotatsuHistory.filter(h => h.mangaId === kManga.id || (h.mangaTitle === kManga.title));
        
        let tachiChapters = [];
        let tachiHistory = [];
        
        if (hItems.length > 0) {
            // Logic to convert history to chapters/history objects
        }

        return {
            source: sourceId,
            url: kManga.url || "",
            title: kManga.title || "Unknown",
            artist: kManga.artist || "",
            author: kManga.author || "",
            description: kManga.description || "",
            genre: kManga.genre ? (Array.isArray(kManga.genre) ? kManga.genre : kManga.genre.split(',').map(s=>s.trim())) : [],
            status: mapStatus(kManga.status),
            thumbnailUrl: kManga.coverUrl || kManga.thumbnailUrl || "",
            dateAdded: kManga.dateAdded || Date.now(),
            categories: mangCats,
            backupChapters: tachiChapters,
            backupHistory: tachiHistory
        };
    });

    // Build Proto
    if (typeof protobuf === 'undefined' || typeof TACHIYOMI_PROTO_STRING === 'undefined') {
        throw new Error("Dependencies missing");
    }

    const root = protobuf.parse(TACHIYOMI_PROTO_STRING).root;
    const BackupMessage = root.lookupType("Backup");
    
    // Fix Longs
    // Protobuf.js needs Longs for int64.
    // sourceId, dateAdded, etc.
    // If standard JS numbers are safe integer range, it works. sourceId definitely needs String or Long object.
    
    const payload = {
        backupManga: tachiMangaList,
        backupCategories: tachiCategories,
    };
    
    // Verify?
    // Conversion to message first allows setting defaults
    const message = BackupMessage.create(payload);
    const buffer = BackupMessage.encode(message).finish();
    
    const gzipped = pako.gzip(buffer);
    return {
        blob: new Blob([gzipped], {type: "application/octet-stream"}),
        debugData: {
            kotatsuFavourites: kotatsuFavs,
            kotatsuCategories: kotatsuCategories,
            mappedTachiManga: tachiMangaList
        }
    };
}

// Tachiyomi to Kotatsu conversion
async function convertTachiyomiToKotatsu(file) {
    if (typeof protobuf === 'undefined' || typeof TACHIYOMI_PROTO_STRING === 'undefined') {
        throw new Error("Dependencies missing");
    }

    // 1. Read and Gunzip
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    let protoData;
    try {
        // Try ungzip first (standard .tachibk is gzipped)
        protoData = pako.ungzip(uint8Array);
    } catch (e) {
        console.warn("Not gzipped? Trying raw.", e);
        protoData = uint8Array;
    }

    // 2. Decode Proto
    const root = protobuf.parse(TACHIYOMI_PROTO_STRING).root;
    const BackupMessage = root.lookupType("Backup");
    
    const message = BackupMessage.decode(protoData);
    const backup = BackupMessage.toObject(message, {
        longs: String, // Convert Longs to Strings
        enums: String,
        bytes: String,
        defaults: true,
        arrays: true
    });

    // 3. Map to Kotatsu
    // Categories
    const categories = (backup.backupCategories || []).map(c => ({
        name: c.name,
        order: c.order
    }));

    // Manga
    // Kotatsu `favourites.json`
    const favourites = (backup.backupManga || []).map(m => {
        return {
            id: generateId(m.url, m.title), // Kotatsu needs an ID? Usually generic hash.
            title: m.title,
            author: m.author,
            artist: m.artist,
            description: m.description,
            url: m.url,
            coverUrl: m.thumbnailUrl,
            source: mapTachiyomiIdToSource(m.source),
            status: mapTachiStatus(m.status),
            genre: (m.genre || []).join(', '),
            dateAdded: Number(m.dateAdded),
            categories: mapTachiCategories(m.categories, categories)
        };
    });

    // History
    // Kotatsu `history.json`
    let history = [];
    (backup.backupManga || []).forEach(m => {
        if (m.backupHistory && m.backupHistory.length > 0) {
            m.backupHistory.forEach(h => {
                history.push({
                    mangaId: generateId(m.url, m.title),
                    mangaTitle: m.title,
                    chapterId: 0, // Unknown
                    // Kotatsu history format is tricky without seeing it.
                    // Assuming simplified:
                    date: Number(h.lastRead),
                    // ...
                });
            });
        }
    });

    // 4. Zip
    const zip = new JSZip();
    zip.file("categories.json", JSON.stringify(categories, null, 2));
    zip.file("favourites.json", JSON.stringify(favourites, null, 2));
    if (history.length > 0) {
        zip.file("history.json", JSON.stringify(history, null, 2));
    }

    const blob = await zip.generateAsync({type: "blob"});
    return {
        blob: blob,
        debugData: {
            tachiBackup: backup,
            mappedKotatsuFavourites: favourites,
            mappedKotatsuCategories: categories
        }
    };
}

// Helpers
function generateId(url, title) {
    // Simple hash for ID
    let str = (url || "") + (title || "");
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
}

function mapTachiyomiIdToSource(id) {
    if (!id) return "LOCAL";
    const sId = String(id);
    if (sId === "6400630869375065225") return "MANGADEX";
    if (sId === "7369325983802951508") return "MANGANATO";
    if (sId === "7146431200542137600") return "BATO";
    // TODO: Add more mappings
    return "UNKNOWN_SOURCE_" + sId;
}

function mapTachiStatus(status) {
    // Tachi: 1=ONGOING, 2=COMPLETED
    if (status === 1) return "ONGOING";
    if (status === 2) return "COMPLETED";
    return "UNKNOWN";
}

function mapTachiCategories(catIds, allCats) {
    // catIds is array of int32 Order? Or indices?
    // In Tachi proto: repeated int32 categories = 14;
    // These are usually values matching BackupCategory.order?? Or generic IDs?
    // If we assume they match 'order' field in BackupCategory.
    if (!catIds || !allCats) return [];
    
    // Find category names
    // Note: This logic depends on implementation.
    // If ids match order:
    return catIds.map(id => {
        const cat = allCats.find(c => c.order === id);
        return cat ? cat.name : null;
    }).filter(n => n);
}

function mapSourceToTachiyomiId(sourceName) {
    if (!sourceName) return 0;
    const s = sourceName.toLowerCase();
    
    // Common Sources (IDs from standard Tachi Extensions)
    // MangaDex: 6400630869375065225 -> need to represent as string for protobuf.js or Long
    // Use String "6400630869375065225"
    if (s.includes("mangadex")) return "6400630869375065225";
    if (s.includes("manganato")) return "7369325983802951508"; // Example, might be wrong
    if (s.includes("bato")) return "7146431200542137600";
    
    // Fallback: Local Source
    return "0";
}

function mapStatus(kStatus) {
    if (!kStatus) return 0;
    const s = kStatus.toUpperCase();
    if (s === 'ONGOING') return 1;
    if (s === 'COMPLETED') return 2;
    if (s === 'LICENSED') return 3;
    if (s === 'PUBLISHING') return 4; // ?
    if (s === 'CANCELLED') return 5;
    if (s === 'HIATUS') return 6;
    return 0;
}
