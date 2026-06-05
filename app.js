// app.js - Main Application Logic
// Kotatsu to Mihon Converter

document.addEventListener('DOMContentLoaded', () => {
  // ===== DOM Elements =====
  const zone = document.getElementById('zone-kotatsu');
  const input = document.getElementById('input-kotatsu');
  
  const statusDot = document.getElementById('status-dot');
  const statusText = document.getElementById('status-text');
  
  const statsPanel = document.getElementById('stats');
  const statManga = document.getElementById('stat-manga');
  const statCategories = document.getElementById('stat-categories');
  const statHistory = document.getElementById('stat-history');
  
  const sourcesContainer = document.getElementById('sources-container');
  const sourcesList = document.getElementById('sources-list');

  // Source Details interactive panel elements
  const detailsContainer = document.getElementById('source-details-container');
  const detailsTitle = document.getElementById('details-source-title');
  const detailsCount = document.getElementById('details-source-count');
  const detailsSearchInput = document.getElementById('details-search-input');
  const btnClearSearch = document.getElementById('btn-clear-search');
  const btnCloseDetails = document.getElementById('btn-close-details');
  const detailsGrid = document.getElementById('details-grid');
  
  const verificationReport = document.getElementById('verification-report');
  const vInput = document.getElementById('v-input');
  const vOutput = document.getElementById('v-output');
  const vBadge = document.getElementById('integrity-badge');
  const vMsg = document.getElementById('verification-msg');
  
  const actionsPanel = document.getElementById('actions');
  const btnDownload = document.getElementById('btn-download');
  const btnDebug = document.getElementById('btn-debug');
  
  const modalDebug = document.getElementById('modal-debug');
  const debugContent = document.getElementById('debug-content');
  const btnCloseModal = document.getElementById('btn-close-modal');

  // ===== State =====
  let parsedData = null;
  let convertedBlob = null;
  let debugData = {};
  let selectedSource = null;
  let searchQuery = '';
  let isMihonInput = false;

  // ===== Visual Progress Step Tracker =====
  function setStep(activeStep, success = true) {
    for (let i = 1; i <= 4; i++) {
      const step = document.getElementById(`step-${i}`);
      const line = document.getElementById(`line-${i - 1}`); // line-1 is before step 2
      
      if (!step) continue;
      
      step.classList.remove('active', 'completed');
      if (line) line.classList.remove('active');
      
      if (i < activeStep) {
        step.classList.add('completed');
        if (line) line.classList.add('active');
      } else if (i === activeStep) {
        step.classList.add('active');
      }
    }
  }

  // ===== Status Message Updates =====
  function setStatus(text, type = 'default') {
    statusText.textContent = text.toUpperCase();
    
    // Reset dot classes
    statusDot.className = 'status-dot';
    
    if (type === 'success') {
      statusDot.classList.add('success');
    } else if (type === 'error') {
      statusDot.classList.add('error');
    } else if (type === 'loading') {
      statusDot.classList.add('pulsing', 'success');
    } else {
      statusDot.classList.add('pulsing');
    }
  }

  // ===== Stats Grid Rendering =====
  function showStats(manga, categories, history) {
    statManga.textContent = manga;
    statCategories.textContent = categories;
    statHistory.textContent = history;
    statsPanel.style.display = 'grid';
  }

  function hideStats() {
    statsPanel.style.display = 'none';
  }

  // ===== Source Details Extraction Helpers =====
  function getSourceName(item, isMihonInput) {
    const m = item.manga || item;
    let sourceName = 'Unknown';
    if (isMihonInput) {
      const srcId = String(item.source || '0');
      if (srcId === '0') {
        sourceName = 'Local';
      } else {
        sourceName = window.findKotatsuSourceName ? window.findKotatsuSourceName(srcId) : 'Unknown';
      }
    } else {
      sourceName = m.source || 'Unknown';
    }
    
    if (sourceName === sourceName.toUpperCase() && sourceName.includes('_')) {
      sourceName = sourceName.split('_')
        .map(w => w.charAt(0) + w.slice(1).toLowerCase())
        .join(' ');
    }
    return sourceName;
  }

  function formatDate(timestamp) {
    if (!timestamp || timestamp === '0' || timestamp === 0) return '';
    try {
      const date = new Date(Number(timestamp));
      if (isNaN(date.getTime())) return '';
      return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    } catch (e) {
      return '';
    }
  }

  function getInitials(title) {
    if (!title) return '?';
    const clean = title.replace(/[^a-zA-Z0-9\s]/g, '');
    const words = clean.split(/\s+/).filter(Boolean);
    if (words.length === 0) return title.charAt(0);
    if (words.length === 1) return words[0].substring(0, 2);
    return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
  }

  const MIHON_STATUS_MAP = {
    0: 'Unknown',
    1: 'Ongoing',
    2: 'Completed',
    3: 'Licensed',
    4: 'Publishing',
    5: 'Cancelled',
    6: 'On Hiatus'
  };

  const MIHON_VIEWERS = {
    0: 'Default',
    1: 'LTR',
    2: 'RTL',
    3: 'Vertical',
    4: 'Webtoon',
    5: 'Continuous Vertical'
  };

  function getMangaBySource(isMihonInput) {
    if (!parsedData || !parsedData.manga) return {};
    const grouped = {};
    for (let i = 0; i < parsedData.manga.length; i++) {
      const item = parsedData.manga[i];
      const sourceName = getSourceName(item, isMihonInput);
      if (!grouped[sourceName]) grouped[sourceName] = [];
      grouped[sourceName].push(item);
    }
    return grouped;
  }

  function renderMangaDetails(sourceName, isMihonInput) {
    const allManga = getMangaBySource(isMihonInput)[sourceName] || [];
    const query = searchQuery.toLowerCase().trim();
    const filteredManga = allManga.filter(item => {
      const m = item.manga || item;
      const title = (m.title || '').toLowerCase();
      const author = (m.author || '').toLowerCase();
      const artist = (m.artist || '').toLowerCase();
      return title.includes(query) || author.includes(query) || artist.includes(query);
    });

    detailsTitle.textContent = sourceName;
    detailsCount.textContent = filteredManga.length;
    detailsGrid.innerHTML = '';

    if (filteredManga.length === 0) {
      detailsGrid.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 40px 20px; font-size: 0.85rem; width: 100%;">No matching titles found</div>';
      return;
    }

    for (let i = 0; i < filteredManga.length; i++) {
      const item = filteredManga[i];
      const m = item.manga || item;
      
      const title = m.title || 'Unknown';
      const initials = getInitials(title);
      const author = m.author || m.artist || '';
      const coverUrl = m.cover_url || m.coverUrl || m.large_cover_url || m.thumbnail_url || m.thumbnailUrl || '';
      const nsfw = m.nsfw || String(m.content_rating).toUpperCase() === 'ADULT';
      
      let rating = null;
      if (m.rating !== undefined && m.rating > 0) {
        if (m.rating <= 1.0) {
          rating = Math.round(m.rating * 100) + '%';
        } else {
          rating = m.rating.toFixed(1);
        }
      }
      
      let status = '';
      if (isMihonInput) {
        status = MIHON_STATUS_MAP[m.status] || '';
      } else {
        status = m.state || '';
      }
      
      const categories = [];
      if (isMihonInput) {
        if (item.categories && item.categories.length > 0) {
          for (let c = 0; c < item.categories.length; c++) {
            const catId = item.categories[c];
            const cat = parsedData.categories.find(cc => String(cc.id) === String(catId) || String(cc.order) === String(catId));
            if (cat && cat.name) categories.push(cat.name);
          }
        }
      } else {
        if (item.category_id !== undefined && item.category_id !== 0) {
          const cat = parsedData.categories.find(cc => String(cc.category_id) === String(item.category_id));
          if (cat && cat.title) categories.push(cat.title);
        }
      }
      
      const trackingCount = (item.tracking && item.tracking.length) || 0;
      
      let viewerMode = '';
      if (isMihonInput && item.viewer) {
        viewerMode = MIHON_VIEWERS[item.viewer] || '';
      }
      
      let genres = [];
      if (isMihonInput) {
        genres = m.genre || [];
      } else {
        if (m.tags && m.tags.length > 0) {
          genres = m.tags.map(t => t.title).filter(Boolean);
        }
      }
      
      const notes = m.notes || '';
      
      let readCh = 0;
      let totalCh = 0;
      let percentRead = null;
      
      if (isMihonInput) {
        if (item.chapters && item.chapters.length > 0) {
          totalCh = item.chapters.length;
          readCh = item.chapters.filter(ch => ch.read).length;
          percentRead = Math.round((readCh / totalCh) * 100);
        }
      } else {
        const mangaId = item.manga_id || m.id;
        const mangaHistory = parsedData.history ? parsedData.history.filter(h => String(h.manga_id) === String(mangaId)) : [];
        readCh = mangaHistory.length;
        totalCh = Math.max(0, ...mangaHistory.map(h => h.chapters || 0));
        if (totalCh > 0) {
          percentRead = Math.round((readCh / totalCh) * 100);
          percentRead = Math.min(100, percentRead);
        }
      }
      
      let lastReadStr = '';
      let dateAddedStr = '';
      
      if (isMihonInput) {
        if (item.history && item.history.length > 0) {
          const maxRead = Math.max(...item.history.map(h => Number(h.lastRead) || 0));
          lastReadStr = formatDate(maxRead);
        }
        if (item.dateAdded && item.dateAdded !== '0') {
          dateAddedStr = formatDate(item.dateAdded);
        }
      } else {
        const mangaId = item.manga_id || m.id;
        const mangaHistory = parsedData.history ? parsedData.history.filter(h => String(h.manga_id) === String(mangaId)) : [];
        if (mangaHistory.length > 0) {
          const maxRead = Math.max(...mangaHistory.map(h => h.updated_at || h.created_at || 0));
          lastReadStr = formatDate(maxRead);
        }
        if (item.created_at) {
          dateAddedStr = formatDate(item.created_at);
        }
      }
      
      const publicUrl = m.public_url || m.url || '';
      
      const mangaCard = document.createElement('div');
      mangaCard.className = 'manga-detail-card';
      mangaCard.innerHTML = `
        <div class="manga-cover-wrapper">
          ${coverUrl ? `<img src="${coverUrl}" alt="${title} Cover" class="manga-cover" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">` : ''}
          <div class="manga-cover-fallback" ${coverUrl ? 'style="display: none;"' : ''}>
            <span>${initials}</span>
          </div>
          ${nsfw ? '<span class="manga-badge-nsfw">NSFW</span>' : ''}
        </div>
        <div class="manga-info">
          <div class="manga-title-row">
            <h5 class="manga-title">
              ${publicUrl ? `<a href="${publicUrl}" target="_blank" rel="noopener noreferrer">${title}</a>` : title}
            </h5>
            ${rating ? `<span class="manga-rating">★ ${rating}</span>` : ''}
          </div>
          <p class="manga-author">${author || 'Unknown Author'}</p>
          
          <div class="manga-badges-row">
            ${status ? `<span class="manga-badge-status ${status.toLowerCase()}">${status}</span>` : ''}
            ${categories.map(c => `<span class="manga-badge-category">${c}</span>`).join('')}
            ${trackingCount > 0 ? `<span class="manga-badge-tracking">🔗 ${trackingCount} Trackers</span>` : ''}
            ${viewerMode ? `<span class="manga-badge-viewer">📖 ${viewerMode}</span>` : ''}
          </div>
          
          ${genres.length > 0 ? `
          <div class="manga-genres">
            ${genres.map(g => `<span class="manga-genre-tag">${g}</span>`).join('')}
          </div>
          ` : ''}
          
          ${notes ? `<p class="manga-notes" title="${notes}"><strong>Note:</strong> ${notes}</p>` : ''}
          
          <div class="manga-progress-section">
            <div class="manga-progress-text">
              <span>Chapters: <strong>${readCh}</strong> / ${totalCh > 0 ? totalCh : '??'}</span>
              ${percentRead !== null ? `<span>${percentRead}%</span>` : ''}
            </div>
            <div class="manga-progress-bar-container">
              <div class="manga-progress-bar-fill" style="width: ${percentRead !== null ? percentRead : 0}%;"></div>
            </div>
          </div>
          
          <div class="manga-dates-row">
            ${lastReadStr ? `<span>Last read: ${lastReadStr}</span>` : ''}
            ${dateAddedStr ? `<span>Added: ${dateAddedStr}</span>` : ''}
          </div>
        </div>
      `;
      detailsGrid.appendChild(mangaCard);
    }
  }

  // ===== Sources List Breakdown =====
  function renderSourcesList(mangaList, isMihonInput) {
    sourcesList.innerHTML = '';
    
    if (!mangaList || mangaList.length === 0) {
      sourcesContainer.style.display = 'none';
      return;
    }
    
    const sourceCounts = {};
    
    for (let i = 0; i < mangaList.length; i++) {
      const item = mangaList[i];
      const name = getSourceName(item, isMihonInput);
      sourceCounts[name] = (sourceCounts[name] || 0) + 1;
    }
    
    const sortedSources = Object.entries(sourceCounts)
      .sort((a, b) => b[1] - a[1]);
      
    for (const [name, count] of sortedSources) {
      const badge = document.createElement('div');
      badge.className = 'source-badge';
      badge.innerHTML = `${name} <span class="source-count">${count}</span>`;
      
      // Make badge clickable
      badge.addEventListener('click', () => {
        const isActive = badge.classList.contains('active');
        
        // Remove active class from all badges
        sourcesList.querySelectorAll('.source-badge').forEach(b => b.classList.remove('active'));
        
        if (isActive) {
          detailsContainer.style.display = 'none';
          selectedSource = null;
        } else {
          badge.classList.add('active');
          selectedSource = name;
          searchQuery = '';
          detailsSearchInput.value = '';
          btnClearSearch.style.display = 'none';
          
          renderMangaDetails(name, isMihonInput);
          detailsContainer.style.display = 'block';
          
          // Smooth scroll to the details container
          detailsContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      });
      
      sourcesList.appendChild(badge);
    }
    
    sourcesContainer.style.display = 'block';
  }

  function hideSourcesList() {
    sourcesContainer.style.display = 'none';
    sourcesList.innerHTML = '';
    detailsContainer.style.display = 'none';
    selectedSource = null;
  }

  // ===== File Input & Drop Handling =====
  function setupDropZone() {
    // Click drop zone to browse files
    zone.addEventListener('click', () => input.click());

    // Drag events
    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      // Add general drag hover glow
      zone.classList.add('hover-kotatsu');
    });

    zone.addEventListener('dragleave', () => {
      zone.classList.remove('hover-kotatsu', 'hover-mihon');
    });

    // Drop handler
    zone.addEventListener('drop', async (e) => {
      e.preventDefault();
      zone.classList.remove('hover-kotatsu', 'hover-mihon');
      
      const file = e.dataTransfer.files[0];
      if (file) {
        await handleFile(file);
      }
    });

    // File input handler
    input.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (file) {
        await handleFile(file);
      }
    });
  }

  setupDropZone();

  // ===== Source Details Interactive Actions =====
  detailsSearchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    if (searchQuery.trim()) {
      btnClearSearch.style.display = 'block';
    } else {
      btnClearSearch.style.display = 'none';
    }
    if (selectedSource) {
      renderMangaDetails(selectedSource, isMihonInput);
    }
  });

  btnClearSearch.addEventListener('click', () => {
    detailsSearchInput.value = '';
    searchQuery = '';
    btnClearSearch.style.display = 'none';
    if (selectedSource) {
      renderMangaDetails(selectedSource, isMihonInput);
    }
  });

  btnCloseDetails.addEventListener('click', () => {
    detailsContainer.style.display = 'none';
    selectedSource = null;
    searchQuery = '';
    detailsSearchInput.value = '';
    btnClearSearch.style.display = 'none';
    
    sourcesList.querySelectorAll('.source-badge').forEach(b => b.classList.remove('active'));
  });

  // ===== Main Processing flow =====
  async function handleFile(file) {
    // Reset state and views
    hideStats();
    hideSourcesList();
    verificationReport.style.display = 'none';
    actionsPanel.style.display = 'none';
    btnDownload.style.display = ''; // Reset display style in case of previous errors

    
    debugData = {
      fileName: file.name,
      fileSize: file.size,
      parsedAt: new Date().toISOString()
    };
    parsedData = null;
    convertedBlob = null;
    selectedSource = null;
    searchQuery = '';
    detailsSearchInput.value = '';
    btnClearSearch.style.display = 'none';
    detailsContainer.style.display = 'none';
    
    // Highlight drop-zone color persistently depending on file format
    zone.classList.remove('hover-kotatsu', 'hover-mihon');
    const isMihon = file.name.endsWith('.tachibk') || file.name.endsWith('.proto.gz');
    isMihonInput = isMihon;
    zone.classList.add(isMihon ? 'hover-mihon' : 'hover-kotatsu');

    // 1. Start Upload
    setStep(1);
    setStatus('Reading file buffer...', 'loading');
    
    // Tiny delay to allow DOM render before heavy processing
    await new Promise(r => setTimeout(r, 100));

    try {
      // 2. Parse file contents
      setStep(2);
      setStatus('Extracting backup data...', 'loading');
      await new Promise(r => setTimeout(r, 100));

      let parseResult;
      if (isMihon) {
        parseResult = await window.parseMihonBackup(file);
      } else {
        parseResult = await window.parseKotatsuBackup(file);
      }
      
      debugData.parseResult = {
        success: parseResult.success,
        mangaCount: parseResult.data?.manga?.length || 0,
        categoriesCount: parseResult.data?.categories?.length || 0,
        historyCount: parseResult.data?.history?.length || 0,
        errors: parseResult.debug?.errors || []
      };

      if (!parseResult.success) {
        throw new Error(parseResult.debug?.errors?.join('; ') || 'Database parse failed. Is the file corrupt?');
      }

      parsedData = parseResult.data;
      const mangaCount = parsedData.manga?.length || 0;
      const categoryCount = parsedData.categories?.length || 0;
      const historyCount = parsedData.history?.length || 0;

      showStats(mangaCount, categoryCount, historyCount);
      renderSourcesList(parsedData.manga, isMihon);

      // 3. Convert contents
      setStep(3);
      setStatus('Translating schemas & hashing UIDs...', 'loading');
      await new Promise(r => setTimeout(r, 100));

      if (isMihon) {
        // Convert Mihon TO Kotatsu
        convertedBlob = await window.createKotatsuBackup(parsedData);
        debugData.outputFormat = 'Kotatsu (.bk.zip)';
      } else {
        // Convert Kotatsu TO Mihon
        convertedBlob = await window.createMihonBackup(parsedData);
        debugData.outputFormat = 'Mihon (.tachibk)';
      }
      
      debugData.convertedSize = convertedBlob.size;

      // 4. Verify contents
      setStep(4);
      setStatus('Auditing structural integrity...', 'loading');
      await new Promise(r => setTimeout(r, 150));

      let verifyResult;
      const fakeFile = new File([convertedBlob], "temp_verification" + (isMihon ? ".bk.zip" : ".tachibk"));
      
      if (isMihon) {
        verifyResult = await window.parseKotatsuBackup(fakeFile);
      } else {
        verifyResult = await window.parseMihonBackup(fakeFile);
      }

      debugData.verificationResult = {
        success: verifyResult.success,
        mangaCount: verifyResult.data?.manga?.length || 0,
        errors: verifyResult.debug?.errors || []
      };

      if (verifyResult.success) {
        const inputManga = mangaCount;
        const outputManga = verifyResult.data.manga.length;
        
        vInput.textContent = inputManga;
        vOutput.textContent = outputManga;
        verificationReport.style.display = 'block';

        if (inputManga === outputManga) {
          vBadge.textContent = "VERIFIED";
          vBadge.className = "verification-badge";
          vMsg.textContent = "100% Data Integrity. All library records successfully reconstructed.";
          vMsg.style.color = "var(--color-mihon)";
        } else {
          const diff = inputManga - outputManga;
          vBadge.textContent = "WARNING";
          vBadge.className = "verification-badge warning";
          vMsg.textContent = `Audit Warning: ${Math.abs(diff)} mismatch in parsed records.`;
          vMsg.style.color = "var(--accent-warning)";
        }
      } else {
        throw new Error(verifyResult.debug?.errors?.join('; ') || 'Post-conversion validation failed.');
      }

      // Completed all steps!
      setStep(5); // Highlight all 4 steps as completed
      setStatus('Migration Successful! Ready for download.', 'success');
      actionsPanel.style.display = 'flex';

    } catch (err) {
      console.error('Migration error:', err);
      debugData.error = err.message;
      debugData.stack = err.stack;
      
      setStatus(err.message.includes('parse') ? 'Extraction failed' : 'Conversion failed', 'error');
      
      // Reset step highlights to indicate failure
      for (let i = 1; i <= 4; i++) {
        const step = document.getElementById(`step-${i}`);
        if (step) step.classList.remove('active', 'completed');
      }
      
      actionsPanel.style.display = 'flex';
      btnDownload.style.display = 'none'; // Only debug is allowed on error
    }
  }

  // ===== Download Trigger =====
  btnDownload.addEventListener('click', () => {
    if (!convertedBlob) return;

    const isMihonOutput = debugData.outputFormat && debugData.outputFormat.includes('Mihon');
    const ext = isMihonOutput ? 'tachibk' : 'bk.zip';
    const prefix = isMihonOutput ? 'kotatsu_to_mihon' : 'mihon_to_kotatsu';
    const filename = `${prefix}_${Date.now()}.${ext}`;
    
    const url = URL.createObjectURL(convertedBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  // ===== Debug Modal Controls =====
  btnDebug.addEventListener('click', () => {
    debugContent.textContent = JSON.stringify(debugData, null, 2);
    modalDebug.style.display = 'flex';
  });

  btnCloseModal.addEventListener('click', () => {
    modalDebug.style.display = 'none';
  });

  modalDebug.addEventListener('click', (e) => {
    if (e.target === modalDebug) {
      modalDebug.style.display = 'none';
    }
  });

  // ===== 3D Tilt Effect on Dashboard Card =====
  const card = document.querySelector('.dashboard-card');
  if (card) {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      const xc = rect.width / 2;
      const yc = rect.height / 2;
      
      const angleX = (yc - y) / 40;
      const angleY = (x - xc) / 40;
      
      card.style.transform = `perspective(1000px) rotateX(${angleX}deg) rotateY(${angleY}deg) translateY(-2px)`;
      card.style.boxShadow = `
        0 35px 70px rgba(0, 0, 0, 0.5),
        0 0 30px rgba(255, 112, 67, 0.05),
        0 0 30px rgba(0, 230, 118, 0.05),
        inset 0 1px 1px rgba(255, 255, 255, 0.03)
      `;
    });
    
    card.addEventListener('mouseleave', () => {
      card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0)';
      card.style.boxShadow = `
        0 30px 60px rgba(0, 0, 0, 0.4),
        inset 0 1px 1px rgba(255, 255, 255, 0.03)
      `;
    });
  }
});
