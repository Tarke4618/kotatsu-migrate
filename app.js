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
      const m = item.manga || item;
      
      let sourceName = 'Unknown';
      if (isMihonInput) {
        // Mihon input stores source ID as integer/string
        const srcId = String(item.source || '0');
        if (srcId === '0') {
          sourceName = 'Local';
        } else {
          sourceName = window.findKotatsuSourceName ? window.findKotatsuSourceName(srcId) : 'Unknown';
        }
      } else {
        // Kotatsu input stores source name directly as string
        sourceName = m.source || 'Unknown';
      }
      
      // Capitalize source name nicely
      if (sourceName === sourceName.toUpperCase() && sourceName.includes('_')) {
        sourceName = sourceName.split('_')
          .map(w => w.charAt(0) + w.slice(1).toLowerCase())
          .join(' ');
      }
      
      sourceCounts[sourceName] = (sourceCounts[sourceName] || 0) + 1;
    }
    
    // Sort sources by count descending
    const sortedSources = Object.entries(sourceCounts)
      .sort((a, b) => b[1] - a[1]);
      
    for (const [name, count] of sortedSources) {
      const badge = document.createElement('div');
      badge.className = 'source-badge';
      badge.innerHTML = `${name} <span class="source-count">${count}</span>`;
      sourcesList.appendChild(badge);
    }
    
    sourcesContainer.style.display = 'block';
  }

  function hideSourcesList() {
    sourcesContainer.style.display = 'none';
    sourcesList.innerHTML = '';
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
    
    // Highlight drop-zone color persistently depending on file format
    zone.classList.remove('hover-kotatsu', 'hover-mihon');
    const isMihon = file.name.endsWith('.tachibk') || file.name.endsWith('.proto.gz');
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
});
