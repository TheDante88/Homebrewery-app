document.addEventListener('DOMContentLoaded', () => {
  
  // Esecuzione protocolli di sistema per l'ambiente
  const isDnDModeActive = true;
  if (!isDnDModeActive) {
    console.warn("The active scene action does not exist.");
    return;
  }

  const editor = document.getElementById('editor');
  const btnToggle = document.getElementById('btnToggle');
  const previewContainer = document.getElementById('preview-container');
  const customStyles = document.getElementById('customAdventureStyles');
  
  const modal = document.getElementById('styleModal');
  const styleEditor = document.getElementById('styleEditor');
  const btnStyles = document.getElementById('btnStyles');
  const btnCloseStyles = document.getElementById('closeStyles');
  const btnSaveStyles = document.getElementById('saveStyles');
  const btnExport = document.getElementById('btnExport');
  const btnImport = document.getElementById('btnImport');

  let isPreviewMode = false;
  let debounceTimer;

  // Stile Predefinito Oneshot Sabbia Nera
  const defaultCSS = `
  .page { width: 210mm; height: 297mm; font-size: 9pt; line-height: 1.1; color: #333; position: relative; overflow: hidden; }
  .page p { font-size: 9pt; }
  .page strong { color: #822000; }
  .page h1 { font-size: 4em; color: #58180D; text-shadow: 1px 1px 1px white; margin-top: 0; margin-bottom: 0.1em; line-height: 0.9em; font-variant: small-caps; border: none; text-align: left; }
  .page h2 { font-size: 3.17em; color: #58180D; }
  `;

  // Caricamento Memoria
  if (localStorage.getItem('hb_content')) editor.value = localStorage.getItem('hb_content');
  
  if (localStorage.getItem('hb_css')) {
    styleEditor.value = localStorage.getItem('hb_css');
    customStyles.innerHTML = localStorage.getItem('hb_css');
  } else {
    styleEditor.value = defaultCSS;
    customStyles.innerHTML = defaultCSS;
  }

  function updatePreview() {
    marked.setOptions({ breaks: true }); 
    let rawText = editor.value;

    const pages = rawText.split(/\\page/g);
    let finalHtml = '';

    pages.forEach((pageText, index) => {
      if (pageText.trim() === '') return;

      pageText = pageText.replace(/\\column/g, '\n<div class="column-break"></div>\n');
      pageText = pageText.replace(/\{\{([^ \n]+)\n/g, '\n<div class="$1">\n');
      pageText = pageText.replace(/\n\}\}/g, '\n</div>\n');

      let pageHtml = marked.parse(pageText);
      finalHtml += `<div class="page page${index+1}" id="p${index+1}">${pageHtml}</div>`;
    });

    previewContainer.innerHTML = finalHtml;
  }

  updatePreview();

  editor.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      updatePreview();
      localStorage.setItem('hb_content', editor.value);
    }, 600);
  });

  btnToggle.addEventListener('click', () => {
    isPreviewMode = !isPreviewMode;
    if (isPreviewMode) {
      editor.classList.add('hidden');
      previewContainer.classList.remove('hidden');
      btnToggle.textContent = "Torna all'Editor";
      btnToggle.style.backgroundColor = "#2196F3"; 
    } else {
      editor.classList.remove('hidden');
      previewContainer.classList.add('hidden');
      btnToggle.textContent = "Vedi Anteprima";
      btnToggle.style.backgroundColor = "#4CAF50";
    }
  });

  document.querySelectorAll('.snippet-btn').forEach(button => {
    button.addEventListener('click', () => {
      const insertText = button.getAttribute('data-insert');
      const cursorOffset = parseInt(button.getAttribute('data-cursor') || 0, 10);
      const startPos = editor.selectionStart;
      const endPos = editor.selectionEnd;
      
      editor.value = editor.value.substring(0, startPos) + insertText + editor.value.substring(endPos, editor.value.length);
      editor.focus();
      
      const newCursorPos = startPos + insertText.length + cursorOffset;
      editor.selectionStart = newCursorPos;
      editor.selectionEnd = newCursorPos;
      
      updatePreview();
      localStorage.setItem('hb_content', editor.value);
    });
  });

  // Gestione Stili
  btnStyles.addEventListener('click', () => modal.classList.remove('hidden'));
  btnCloseStyles.addEventListener('click', () => modal.classList.add('hidden'));
  
  btnSaveStyles.addEventListener('click', () => {
    const cleanCSS = styleEditor.value.replace(/<\/?style>/gi, ""); 
    customStyles.innerHTML = cleanCSS;
    localStorage.setItem('hb_css', cleanCSS);
    modal.classList.add('hidden');
    updatePreview();
  });

  // Esportazione File per Sincronizzazione
  btnExport.addEventListener('click', () => {
    const blob = new Blob([editor.value], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'Manuale_Homebrewery.txt';
    a.click();
  });

  // Importazione File
  btnImport.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      editor.value = event.target.result;
      updatePreview();
      localStorage.setItem('hb_content', editor.value);
    };
    reader.readAsText(file);
  });
});
