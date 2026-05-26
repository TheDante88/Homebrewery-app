document.addEventListener('DOMContentLoaded', () => {
  
  // --- ELEMENTI DOM ---
  const editor = document.getElementById('editor');
  const btnToggle = document.getElementById('btnToggle');
  const previewContainer = document.getElementById('preview-container');
  const customStyles = document.getElementById('customAdventureStyles');
  
  const modalStili = document.getElementById('styleModal');
  const styleEditor = document.getElementById('styleEditor');
  
  const modalDrive = document.getElementById('driveModal');
  const fileList = document.getElementById('driveFileList');

  // --- IMPOSTAZIONI GOOGLE DRIVE API ---
  // IMPORTANTE: Per far funzionare l'accesso ai file originali di Homebrewery, 
  // devi creare un progetto su console.cloud.google.com e incollare qui il tuo Client ID.
  const GOOGLE_CLIENT_ID = '378200277078-edff4nvc1d28i4d2erapckr28tp62lld.apps.googleusercontent.com.apps.googleusercontent.com';
  let tokenClient;
  let gapiInited = false;
  let gisInited = false;
  let currentDriveFileId = null; // Memorizza il file aperto per sovrascriverlo

  // --- STILE PREDEFINITO SABBIA NERA (Estratto dal tuo file) ---
  const defaultCSS = `
:root {
  --fs-base: 13px; --fs-h1: 4.8em; --fs-h2: 2.8em; --fs-h3: 1.8em;
  --bg-nero: #0a0a0a; --testo-base: #b3b3b3; --ottone: #b58d3d;
  --pp: #ff3333; --energia: #33ccff; --psichico: #cc33ff; --necrotico: #33ff33;
}
.page { 
  width: 210mm; height: 297mm; font-size: var(--fs-base); line-height: 1.2; 
  background-color: var(--bg-nero); color: var(--testo-base); 
  position: relative; overflow: hidden; padding: 1.5cm;
}
.page strong { color: var(--pp); font-weight: bold; }
.page h1 { font-size: var(--fs-h1); color: var(--ottone); text-transform: uppercase; font-family: serif; border-bottom: 2px solid var(--ottone); }
.page h2 { font-size: var(--fs-h2); color: var(--ottone); font-family: serif; }
.page h3 { font-size: var(--fs-h3); color: var(--ottone); font-family: serif; border-bottom: 1px solid #333; }
.quote-box { background: #151515; border-left: 4px solid var(--ottone); padding: 10px; font-style: italic; margin-bottom: 15px; }
.lore-box { border: 1px solid var(--ottone); background: #111; padding: 15px; border-radius: 4px; box-shadow: inset 0 0 10px rgba(0,0,0,0.5); }
.history-table, .d-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; color: var(--testo-base); }
.history-table th, .d-table th { background: #1a1a1a; color: var(--ottone); padding: 8px; border-bottom: 2px solid var(--ottone); text-align: left; }
.history-table td, .d-table td { padding: 8px; border-bottom: 1px solid #222; }
.wide { column-span: all; width: 100%; }
.pageNumber.auto { position: absolute; bottom: 15px; right: 15px; color: var(--ottone); font-weight: bold; }
  `;

  // --- CARICAMENTO INIZIALE MEMORIA LOCALE ---
  if (localStorage.getItem('hb_content')) editor.value = localStorage.getItem('hb_content');
  if (localStorage.getItem('hb_css')) {
    styleEditor.value = localStorage.getItem('hb_css');
    customStyles.innerHTML = localStorage.getItem('hb_css');
  } else {
    styleEditor.value = defaultCSS;
    customStyles.innerHTML = defaultCSS;
  }

  // --- PARSER HOMEBREWERY V3 AVANZATO ---
  function updatePreview() {
    // Configura Marked per non sanificare l'HTML (permette alle tue tabelle <table> di funzionare)
    marked.setOptions({ breaks: true }); 
    
    let rawText = editor.value;

    // 1. Estrae metadati e CSS interno (se incolli un manuale intero)
    rawText = rawText.replace(/```metadata[\s\S]*?```/g, '');
    const styleMatch = rawText.match(/<style>([\s\S]*?)<\/style>/);
    if (styleMatch) {
        customStyles.innerHTML = styleMatch[1];
        rawText = rawText.replace(/<style>[\s\S]*?<\/style>/, '');
    }

    // 2. Dividi in Pagine
    const pages = rawText.split(/\\page/g);
    let finalHtml = '';

    pages.forEach((pageText, index) => {
      if (pageText.trim() === '') return;

      // Traduzioni V3 native
      pageText = pageText.replace(/\\column/g, '\n<div class="column-break"></div>\n');
      pageText = pageText.replace(/\{\{pageNumber,auto\}\}/g, '<div class="pageNumber auto"></div>');
      
      // Traduzione Blocchi V3 {{classe ... }} in <div class="classe">
      // Usa una regex multiriga per catturare il contenuto
      pageText = pageText.replace(/\{\{([^ \n]+)\n([\s\S]*?)\n\}\}/g, '<div class="$1">\n$2\n</div>');

      // Traduzione Immagini Background (es. ![bg](url))
      pageText = pageText.replace(/!\[bg\]\((.*?)\)/g, '<img src="$1" style="position:absolute; top:0; left:0; width:100%; height:100%; z-index:-1; object-fit:cover;">');

      // Parla a Marked.js
      let pageHtml = marked.parse(pageText);

      // Avvolgi in un wrapper scalabile per il mobile
      finalHtml += `<div class="page-wrapper"><div class="page page${index+1}" id="p${index+1}">${pageHtml}</div></div>`;
    });

    previewContainer.innerHTML = finalHtml;
  }

  updatePreview();

  // Debounce Scrittura
  let debounceTimer;
  editor.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      updatePreview();
      localStorage.setItem('hb_content', editor.value);
    }, 400);
  });

  // --- GESTIONE SNIPPET (Con Selezione Intelligente) ---
  document.querySelectorAll('.snippet-btn').forEach(button => {
    button.addEventListener('click', () => {
      const prefix = button.getAttribute('data-prefix').replace(/\\n/g, '\n');
      const suffix = button.getAttribute('data-suffix').replace(/\\n/g, '\n');
      
      const startPos = editor.selectionStart;
      const endPos = editor.selectionEnd;
      const selectedText = editor.value.substring(startPos, endPos);
      
      // Se c'è testo selezionato, lo avvolge. Altrimenti inserisce i tag e mette il cursore in mezzo.
      const replacement = prefix + selectedText + suffix;
      
      editor.setRangeText(replacement, startPos, endPos, 'select');
      
      if (selectedText.length === 0) {
        // Riposiziona il cursore esattamente in mezzo ai tag
        editor.selectionStart = startPos + prefix.length;
        editor.selectionEnd = startPos + prefix.length;
      }
      
      editor.focus();
      updatePreview();
      localStorage.setItem('hb_content', editor.value);
    });
  });

  // --- TOGGLE ANTEPRIMA ---
  let isPreviewMode = false;
  btnToggle.addEventListener('click', () => {
    isPreviewMode = !isPreviewMode;
    if (isPreviewMode) {
      editor.classList.add('hidden');
      previewContainer.classList.remove('hidden');
      btnToggle.innerHTML = '<i class="fas fa-edit"></i> Editor';
      document.querySelector('.bottom-toolbar').style.display = 'none';
    } else {
      editor.classList.remove('hidden');
      previewContainer.classList.add('hidden');
      btnToggle.innerHTML = '<i class="fas fa-eye"></i> Anteprima';
      document.querySelector('.bottom-toolbar').style.display = 'block';
    }
  });

  // --- GESTIONE STILI MODAL ---
  document.getElementById('btnStyles').addEventListener('click', () => modalStili.classList.remove('hidden'));
  document.getElementById('closeStyles').addEventListener('click', () => modalStili.classList.add('hidden'));
  document.getElementById('saveStyles').addEventListener('click', () => {
    const cleanCSS = styleEditor.value;
    customStyles.innerHTML = cleanCSS;
    localStorage.setItem('hb_css', cleanCSS);
    modalStili.classList.add('hidden');
    updatePreview();
  });

  // ==========================================
  // LOGICA GOOGLE DRIVE (App Data Folder)
  // ==========================================
  
  function gapiLoaded() {
    gapi.load('client', () => {
      gapi.client.init({}).then(() => { gapiInited = true; checkGoogleInit(); });
    });
  }
  
  function gisLoaded() {
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: 'https://www.googleapis.com/auth/drive.appdata',
      callback: (tokenResponse) => {
        if (tokenResponse.error !== undefined) { throw (tokenResponse); }
        document.getElementById('btnAuthDrive').classList.add('hidden');
        document.getElementById('btnOpenDrive').classList.remove('hidden');
        document.getElementById('btnSaveDrive').classList.remove('hidden');
        alert("Autenticato con successo a Google Drive!");
      },
    });
    gisInited = true;
    checkGoogleInit();
  }

  function checkGoogleInit() { /* Pronti se serve */ }
  window.gapiLoaded = gapiLoaded; window.gisLoaded = gisLoaded;

  document.getElementById('btnAuthDrive').addEventListener('click', () => {
    if(GOOGLE_CLIENT_ID === 'INSERISCI_QUI_IL_TUO_CLIENT_ID.apps.googleusercontent.com') {
        alert("ATTENZIONE: Devi inserire il tuo Client ID Google nel file script.js alla riga 17 per accedere al tuo Drive.");
        return;
    }
    if (gapi.client.getToken() === null) { tokenClient.requestAccessToken({prompt: 'consent'}); } 
    else { tokenClient.requestAccessToken({prompt: ''}); }
  });

  document.getElementById('btnOpenDrive').addEventListener('click', async () => {
    modalDrive.classList.remove('hidden');
    fileList.innerHTML = "Caricamento file di Homebrewery in corso...";
    try {
      const response = await gapi.client.request({
        'path': 'https://www.googleapis.com/drive/v3/files',
        'method': 'GET',
        'params': { 'spaces': 'appDataFolder', 'fields': 'files(id, name)', 'q': "mimeType='text/plain'" }
      });
      const files = response.result.files;
      if (files && files.length > 0) {
        fileList.innerHTML = '';
        files.forEach(file => {
          const div = document.createElement('div');
          div.className = 'file-item';
          div.innerHTML = `<span class="file-name"><i class="fas fa-file-alt"></i> ${file.name}</span> <button>Apri</button>`;
          div.onclick = () => loadFileFromDrive(file.id, file.name);
          fileList.appendChild(div);
        });
      } else {
        fileList.innerHTML = 'Nessun file trovato in Homebrewery.';
      }
    } catch (err) {
      fileList.innerHTML = "Errore di connessione a Drive: " + err.message;
    }
  });

  async function loadFileFromDrive(fileId, fileName) {
    fileList.innerHTML = "Scaricamento in corso...";
    try {
      const response = await gapi.client.request({
        'path': `https://www.googleapis.com/drive/v3/files/${fileId}`,
        'method': 'GET',
        'params': { 'alt': 'media' }
      });
      editor.value = response.body;
      currentDriveFileId = fileId;
      localStorage.setItem('hb_content', editor.value);
      updatePreview();
      modalDrive.classList.add('hidden');
      alert(`Manuale "${fileName}" caricato!`);
    } catch (err) { alert("Errore caricamento: " + err.message); }
  }

  document.getElementById('btnSaveDrive').addEventListener('click', async () => {
    if (!currentDriveFileId) {
      alert("Devi prima aprire un file da Drive per poterlo sovrascrivere. Questa versione non crea file nuovi, modifica quelli esistenti di Homebrewery.");
      return;
    }
    if(confirm("Vuoi sovrascrivere il file su Google Drive? (Questa modifica si rifletterà sul sito di Homebrewery)")) {
        try {
            await gapi.client.request({
                'path': `/upload/drive/v3/files/${currentDriveFileId}`,
                'method': 'PATCH',
                'params': { 'uploadType': 'media' },
                'body': editor.value
            });
            alert("File salvato con successo su Google Drive!");
        } catch(err) { alert("Errore durante il salvataggio: " + err.message); }
    }
  });

  document.getElementById('closeDrive').addEventListener('click', () => modalDrive.classList.add('hidden'));
});
  
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
