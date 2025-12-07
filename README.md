# MangaMigrate

**Seamless backup conversion between Kotatsu and Mihon/Tachiyomi**

A web-based tool for converting manga library backups between Kotatsu (`.bk.zip`) and Mihon/Tachiyomi (`.tachibk`) formats.

## Features

- **Bidirectional Conversion**: Kotatsu → Mihon and Mihon → Kotatsu
- **Preserves Data**: Manga, categories, favorites, and reading history
- **Smart Source Mapping**: 100+ manga sources with fuzzy matching
- **No Installation**: Works entirely in your browser
- **Privacy First**: All processing happens locally - no data uploaded

## Usage

1. **Open the tool**: Visit the hosted page or open `index.html` locally
2. **Select direction**: Click "Kotatsu → Mihon" or "Mihon → Kotatsu"
3. **Drop your backup**: Drag and drop your `.bk.zip` or `.tachibk` file
4. **Download result**: Click "Download Backup" when conversion completes
5. **Import**: Load the converted backup in your target app

## Supported Data

| Data Type          | Kotatsu → Mihon | Mihon → Kotatsu |
| ------------------ | :-------------: | :-------------: |
| Manga Library      |       ✅        |       ✅        |
| Categories         |       ✅        |       ✅        |
| Favorites          |       ✅        |       ✅        |
| Reading History    |       ✅        |       ✅        |
| Chapters           |   ⚠️ Partial    |   ⚠️ Partial    |
| Tracking (MAL, AL) |       ❌        |       ❌        |
| Settings           |       ❌        |       ❌        |

## Supported Sources

The tool includes mappings for **200+ unique manga sources** including:

### Major Aggregators

- MangaDex, MangaPlus, Webtoons, Batoto
- MangaNato, MangaKakalot, MangaPark, MangaSee
- Comick.fun, MangaFire, MangaPill

### Scanlator Groups

- Asura Scans, Reaper Scans, Flame Scans
- Luminous Scans, Void Scans, Reset Scans

### Regional Sites

- **Chinese**: CopyManga, DMZJ, MangaBZ
- **Korean**: NewToki, TopToon, RawKuma
- **Japanese**: SenManga, RawLH, Weloma
- **Spanish**: TuMangaOnline, LeerManga, InManga
- **Portuguese**: MangaLivre, MangaHosted, UnionMangas
- **French**: JapScan, ScanVF, SushiScan
- **Russian**: ReManga, MangaLib, Desu.me
- **Indonesian**: Komiku, KomikCast, Kiryuu
- **Vietnamese**: BlogTruyen, NetTruyen, TruyenQQ
- **Turkish**: MangaDenizi, TempestScans
- **Arabic**: GManga, TeamX, MangaAE
- **Thai**: NekoPost, Manga168

### Adult Sites

- NHentai, E-Hentai, HentaiFox, HentaiHand
- 3Hentai, AsmHentai, Hitomi, Pururin

Unknown sources are mapped to "Local Source" (ID: 0).

## Technical Details

### File Formats

- **Kotatsu**: ZIP archive containing JSON files (`favourites.json`, `categories.json`, `history.json`)
- **Mihon**: GZipped Protocol Buffer binary (`.tachibk`)

### Project Structure

```
kotatsu-migrate/
├── index.html      # Main UI
├── style.css       # Styling
├── app.js          # Application logic
└── src/
    ├── schema.js   # Mihon Protobuf schema
    ├── sources.js  # Source ID mappings
    ├── kotatsu.js  # Kotatsu parser/builder
    └── mihon.js    # Mihon parser/builder
```

### Dependencies (CDN)

- [JSZip](https://stuk.github.io/jszip/) - ZIP handling
- [Pako](https://github.com/nodeca/pako) - GZip compression
- [Protobuf.js](https://github.com/protobufjs/protobuf.js) - Protocol Buffer parsing

## Known Limitations

- Mihon → Kotatsu may fail on newer Mihon backups with complex preference formats
- Chapter read progress is preserved but chapter URLs may not match between sources
- Some source mappings may be incorrect; please report issues

## Contributing

1. Fork the repository
2. Add source mappings to `src/sources.js`
3. Test with real backups
4. Submit a pull request

## License

MIT License - Free to use and modify.

---

**Built for manga readers** • [Report Issues](https://github.com/Tarke4618/kotatsu-migrate/issues)
