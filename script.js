document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const dropKotatsu = document.getElementById('drop-kotatsu');
    const fileKotatsu = document.getElementById('file-kotatsu');
    const statusKotatsu = document.getElementById('status-kotatsu');

    // Helper: Handle Drag & Drop
    function setupDragDrop(dropZone, fileInput, callback) {
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('drag-over');
        });

        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('drag-over');
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('drag-over');
            if (e.dataTransfer.files.length) {
                callback(e.dataTransfer.files[0]);
            }
        });

        dropZone.addEventListener('click', () => {
            fileInput.click();
        });

        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length) {
                callback(e.target.files[0]);
            }
        });
    }

    // Process Kotatsu File
    setupDragDrop(dropKotatsu, fileKotatsu, async (file) => {
        if (!file.name.endsWith('.zip') && !file.name.endsWith('.bk') && !file.name.endsWith('.bk.zip')) {
            setStatus(statusKotatsu, 'Warning: File does not look like a Kotatsu backup (.zip). Processing anyway...', 'info');
        } else {
            setStatus(statusKotatsu, 'Processing Kotatsu backup...', 'info');
        }
        
        try {
            const result = await convertKotatsuToTachiyomi(file);
            // ... (rest of logic)
            if (result.success) {
                setStatus(statusKotatsu, 'Conversion successful!', 'success');
                createDownloadLink(statusKotatsu, result.blob, 'backup.tachibk');
            } else {
                setStatus(statusKotatsu, 'Conversion failed: ' + (result.debugData.error || "Unknown error"), 'error');
            }
            createDebugLink(statusKotatsu, result.debugData);
        } catch (err) {
            console.error(err);
            setStatus(statusKotatsu, 'Critical Error: ' + err.message, 'error');
        }
    });

    // Process Tachiyomi File


    function setStatus(element, text, type) {
        element.innerHTML = `<span class="${type}-msg">${text}</span>`;
        if (type === 'info') {
             element.innerHTML += '<div class="spinner"></div>';
        }
    }

    function createDownloadLink(container, blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.textContent = 'Download Converted File';
        a.className = 'btn-download';
        
        container.appendChild(document.createElement('br'));
        container.appendChild(a);
    }

    function createDebugLink(container, data) {
        const btn = document.createElement('button');
        btn.textContent = 'View Raw Data';
        btn.className = 'btn-download'; // Reuse style or add new one
        btn.style.marginTop = '10px';
        btn.style.background = 'linear-gradient(90deg, #64748b, #475569)';
        btn.onclick = () => showModal(data);
        
        container.appendChild(document.createElement('br'));
        container.appendChild(btn);
    }

    // Modal Logic
    const modal = document.getElementById('debug-modal');
    const closeBtn = document.getElementsByClassName('close-btn')[0];
    const content = document.getElementById('debug-content');

    function showModal(data) {
        content.textContent = JSON.stringify(data, null, 2);
        modal.style.display = 'block';
    }

    if (closeBtn) {
        closeBtn.onclick = () => modal.style.display = 'none';
    } else {
        console.warn("Close button not found");
    }

    window.onclick = (event) => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    };
});
