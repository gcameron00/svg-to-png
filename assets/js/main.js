(() => {
  const dropZone    = document.getElementById('drop-zone');
  const fileInput   = document.getElementById('file-input');
  const errorMsg    = document.getElementById('error-msg');
  const previewSec  = document.getElementById('preview-section');
  const previewImg  = document.getElementById('preview-img');
  const scaleSlider = document.getElementById('scale-slider');
  const scaleInput  = document.getElementById('scale-input');
  const dimensions  = document.getElementById('dimensions');
  const downloadBtn = document.getElementById('download-btn');

  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

  let currentSvgUrl = null;
  let currentFilename = 'image';
  let naturalW = 0;
  let naturalH = 0;

  // ── Drag & drop ──────────────────────────────────────────────────────────
  dropZone.addEventListener('dragover', e => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });

  ['dragleave', 'dragend'].forEach(ev =>
    dropZone.addEventListener(ev, () => dropZone.classList.remove('drag-over'))
  );

  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    handleFiles(e.dataTransfer.files);
  });

  // Click on drop zone triggers file picker (unless clicking the label itself)
  dropZone.addEventListener('click', e => {
    if (e.target.tagName !== 'LABEL' && e.target !== fileInput) {
      fileInput.click();
    }
  });

  dropZone.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInput.click();
    }
  });

  fileInput.addEventListener('change', () => handleFiles(fileInput.files));

  // ── File handling ─────────────────────────────────────────────────────────
  function handleFiles(files) {
    clearError();

    if (!files || files.length === 0) return;
    if (files.length > 1) {
      showError('Please upload one file at a time.');
      return;
    }

    const file = files[0];
    const validationError = validateFile(file);
    if (validationError) {
      showError(validationError);
      return;
    }

    loadSvg(file);
  }

  function validateFile(file) {
    // Check MIME type
    const validMimes = ['image/svg+xml', 'text/xml', 'application/xml', 'text/plain'];
    if (file.type && !validMimes.includes(file.type)) {
      return `"${file.name}" doesn't look like an SVG file (got type: ${file.type}).`;
    }

    // Check extension
    if (!file.name.toLowerCase().endsWith('.svg')) {
      return `"${file.name}" doesn't have an .svg extension. Please upload an SVG file.`;
    }

    // Check size
    if (file.size === 0) {
      return 'The file is empty.';
    }
    if (file.size > MAX_FILE_SIZE) {
      const mb = (file.size / 1024 / 1024).toFixed(1);
      return `File is too large (${mb} MB). Maximum allowed size is 10 MB.`;
    }

    return null;
  }

  function loadSvg(file) {
    const reader = new FileReader();

    reader.addEventListener('load', e => {
      const text = e.target.result;

      // Sanity-check SVG content
      const contentError = validateSvgContent(text);
      if (contentError) {
        showError(contentError);
        return;
      }

      // Revoke any previous object URL
      if (currentSvgUrl) URL.revokeObjectURL(currentSvgUrl);

      const blob = new Blob([text], { type: 'image/svg+xml' });
      currentSvgUrl = URL.createObjectURL(blob);
      currentFilename = file.name.replace(/\.svg$/i, '');

      // Load into a temp Image to get natural dimensions
      const probe = new Image();
      probe.addEventListener('load', () => {
        naturalW = probe.naturalWidth || 300;
        naturalH = probe.naturalHeight || 150;
        previewImg.src = currentSvgUrl;
        showPreview();
        updateDimensions();
      });
      probe.addEventListener('error', () => {
        showError('The SVG could not be rendered. It may contain unsupported features.');
      });
      probe.src = currentSvgUrl;
    });

    reader.addEventListener('error', () => showError('Could not read the file.'));
    reader.readAsText(file);
  }

  function validateSvgContent(text) {
    const trimmed = text.trimStart();

    // Must look like XML
    if (!trimmed.startsWith('<')) {
      return 'The file does not appear to be a valid SVG (expected XML content).';
    }

    // Must contain an <svg element
    if (!/<svg[\s>]/i.test(text)) {
      return 'No <svg> element found. Please upload a valid SVG file.';
    }

    // Reject SVGs with embedded scripts (basic XSS guard)
    if (/<script[\s>]/i.test(text)) {
      return 'SVG files containing <script> elements are not supported for security reasons.';
    }

    return null;
  }

  // ── Preview & scale ───────────────────────────────────────────────────────
  function showPreview() {
    previewSec.hidden = false;
    scaleSlider.value = 1;
    scaleInput.value  = 1;
  }

  function updateDimensions() {
    const scale = parseFloat(scaleInput.value) || 1;
    const w = Math.round(naturalW * scale);
    const h = Math.round(naturalH * scale);
    dimensions.textContent = `Output size: ${w} × ${h} px`;
  }

  function syncScale(value) {
    const clamped = Math.min(10, Math.max(0.1, parseFloat(value) || 1));
    scaleSlider.value = Math.min(4, clamped);
    scaleInput.value  = clamped;
    updateDimensions();
  }

  scaleSlider.addEventListener('input', () => syncScale(scaleSlider.value));
  scaleInput.addEventListener('input', () => syncScale(scaleInput.value));

  // ── Download ──────────────────────────────────────────────────────────────
  downloadBtn.addEventListener('click', () => {
    const scale = parseFloat(scaleInput.value) || 1;
    const w = Math.round(naturalW * scale);
    const h = Math.round(naturalH * scale);

    const canvas = document.createElement('canvas');
    canvas.width  = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');

    const img = new Image();
    img.addEventListener('load', () => {
      ctx.drawImage(img, 0, 0, w, h);
      const link = document.createElement('a');
      link.download = `${currentFilename}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    });
    img.src = currentSvgUrl;
  });

  // ── Helpers ───────────────────────────────────────────────────────────────
  function showError(msg) {
    errorMsg.textContent = msg;
    errorMsg.hidden = false;
    previewSec.hidden = true;
  }

  function clearError() {
    errorMsg.hidden = true;
    errorMsg.textContent = '';
  }
})();
