import React, { useState, useEffect, useRef } from 'react';
import { 
  FileSpreadsheet, 
  Settings2, 
  Trash2, 
  Download, 
  FolderPlus, 
  Image as ImageIcon, 
  Files as FilesIcon, 
  File as FileIcon,
  FileAudio,
  FileVideo,
  FileText,
  CheckCircle, 
  HelpCircle, 
  X, 
  ArrowRight,
  Sun,
  Moon,
  UploadCloud,
  FileCheck2,
  RefreshCw,
  Sparkles,
  Layers,
  AlertCircle,
  Shield,
  BookOpen,
  Info,
  Mail
} from 'lucide-react';
import JSZip from 'jszip';
import { RenameableFile, LogEntry, RenameProgress, AppSettings } from './types';
import { FileItemRow } from './components/FileItemRow';
import { RenameLogger } from './components/RenameLogger';

export default function App() {
  // Core state lists
  const [files, setFiles] = useState<RenameableFile[]>([]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [targetNamesText, setTargetNamesText] = useState<string>('');
  
  // Custom interactive systems
  const [settings, setSettings] = useState<AppSettings>(() => {
    let isDarkFromStorage = false;
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('rename-dark-mode');
      if (stored !== null) {
        isDarkFromStorage = stored === 'true';
      } else {
        isDarkFromStorage = window.matchMedia('(prefers-color-scheme: dark)').matches;
      }
    }
    return {
      filterByExtension: 'images',
      keepExtension: true,
      prefix: '',
      suffix: '',
      darkMode: isDarkFromStorage,
    };
  });

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [progress, setProgress] = useState<RenameProgress>({
    total: 0,
    current: 0,
    status: 'idle',
    currentFileName: '',
  });

  const [isDragOverDropzone, setIsDragOverDropzone] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showIframeModal, setShowIframeModal] = useState(false);
  const [activeFooterPage, setActiveFooterPage] = useState<'privacy' | 'terms' | 'about' | 'contact' | null>(null);
  const [contactForm, setContactForm] = useState({ name: '', email: '', message: '' });
  const [contactSubmitted, setContactSubmitted] = useState(false);
  const [textPreviewContent, setTextPreviewContent] = useState<string>('');
  const [isTextLoading, setIsTextLoading] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync dark class on mount/change and save to localStorage
  useEffect(() => {
    const root = window.document.documentElement;
    if (settings.darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem('rename-dark-mode', String(settings.darkMode));
    } catch (e) {
      // Ignore security/sandboxed storage restriction warnings
    }
  }, [settings.darkMode]);

  // Utility to append logs
  const addLog = (type: LogEntry['type'], message: string, details?: string) => {
    const timestamp = new Date().toLocaleTimeString('pt-BR', { hour12: false });
    const newEntry: LogEntry = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp,
      type,
      message,
      details,
    };
    setLogs((prev) => [newEntry, ...prev]);
  };

  // Preset startup welcome log
  useEffect(() => {
    addLog('info', 'Renomeador Inteligente inicializado com sucesso.');
    addLog('info', 'Arraste imagens ou arquivos e digite a lista de novos nomes para iniciar.');
  }, []);

  // Split target names text by line
  const targetLines = targetNamesText.split('\n');

  // Gutter scroll synchronization and line calculation
  const handleTextareaScroll = () => {
    if (textareaRef.current && gutterRef.current) {
      gutterRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  useEffect(() => {
    if (textareaRef.current && gutterRef.current) {
      gutterRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  }, [targetNamesText]);

  const linesCount = Math.max(targetLines.length, files.length, 12);

  // Compute active preview indicators
  const previewFileIndex = files.findIndex(f => f.id === selectedFileId);
  const activePreviewItem = previewFileIndex !== -1 ? files[previewFileIndex] : (files[0] || null);
  const activePreviewIndex = previewFileIndex !== -1 ? previewFileIndex : (files.length > 0 ? 0 : -1);

  // Load text preview if focussed file is a text/code file
  useEffect(() => {
    if (!activePreviewItem) {
      setTextPreviewContent('');
      return;
    }
    const ext = (activePreviewItem.extension || '').toLowerCase();
    const isText = activePreviewItem.file && ((activePreviewItem.file.type || '').startsWith('text/') || ['txt', 'csv', 'json', 'md', 'html', 'css', 'js', 'ts', 'xml', 'log'].includes(ext));
    
    if (isText && activePreviewItem.file) {
      setIsTextLoading(true);
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        // Limit to 2000 chars for clean display
        setTextPreviewContent(text.substring(0, 2000));
        setIsTextLoading(false);
      };
      reader.onerror = () => {
        setTextPreviewContent('Erro ao carregar prévia do texto.');
        setIsTextLoading(false);
      };
      reader.readAsText(activePreviewItem.file);
    } else {
      setTextPreviewContent('');
    }
  }, [activePreviewItem]);

  // Compute total sizes
  const totalFilesSize = files.reduce((acc, f) => acc + f.size, 0);

  // Format bytes helper
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Toggle Dark Mode
  const toggleDarkMode = () => {
    setSettings(prev => ({ ...prev, darkMode: !prev.darkMode }));
    addLog('info', `Modo escuro ${!settings.darkMode ? 'ativado' : 'desativado'}.`);
  };

  // Load and process uploaded files
  const processFiles = (uploadedList: FileList | File[]) => {
    const acceptedFiles: RenameableFile[] = [];
    const skippedFiles: string[] = [];

    Array.from(uploadedList).forEach((file) => {
      if (!file) return;
      const fileType = file.type || '';
      const ext = (file.name || '').split('.').pop()?.toLowerCase() || '';
      
      const isImg = fileType.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext);
      const isAudio = fileType.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac', 'wma'].includes(ext);
      const isVideo = fileType.startsWith('video/') || ['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv', '3gp'].includes(ext);
      const isPdf = fileType === 'application/pdf' || ext === 'pdf';
      const isText = fileType.startsWith('text/') || ['txt', 'csv', 'json', 'md', 'html', 'css', 'js', 'ts', 'xml', 'log'].includes(ext);

      if (settings.filterByExtension === 'images' && !isImg) {
        skippedFiles.push(file.name);
        return;
      }
      if (settings.filterByExtension === 'audio' && !isAudio) {
        skippedFiles.push(file.name);
        return;
      }
      if (settings.filterByExtension === 'video' && !isVideo) {
        skippedFiles.push(file.name);
        return;
      }
      if (settings.filterByExtension === 'pdf' && !isPdf) {
        skippedFiles.push(file.name);
        return;
      }

      // Create object previewUrl if it's displayable/playable/interactive
      let previewUrl = null;
      if (isImg || isAudio || isVideo || isPdf || isText) {
        try {
          previewUrl = URL.createObjectURL(file);
        } catch (err: any) {
          console.warn('URL.createObjectURL block:', err);
        }
      }

      // Detect duplicates
      if (files.some(f => f.name === file.name && f.size === file.size)) {
        addLog('warning', `Arquivo duplicado ignorado: ${file.name}`);
        return;
      }

      acceptedFiles.push({
        id: Math.random().toString(36).substring(2, 9),
        file,
        name: file.name,
        size: file.size,
        type: file.type,
        previewUrl,
        extension: ext
      });
    });

    if (skippedFiles.length > 0) {
      const typeLabel = 
        settings.filterByExtension === 'images' ? 'Apenas Imagem' :
        settings.filterByExtension === 'audio' ? 'Apenas Áudio' :
        settings.filterByExtension === 'video' ? 'Apenas Vídeo' :
        settings.filterByExtension === 'pdf' ? 'Apenas PDF' : 'Tipo selecionado';
      addLog('warning', `${skippedFiles.length} arquivos ignorados devido ao filtro de tipo: '${typeLabel}'`, skippedFiles.join('\n'));
    }

    if (acceptedFiles.length > 0) {
      setFiles((prev) => [...prev, ...acceptedFiles]);
      addLog('success', `${acceptedFiles.length} novos arquivos adicionados com sucesso.`);
    }
  };

  // File picker handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
    }
  };

  // Drag over dropzone handlers
  const handleDragOverDropzone = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOverDropzone(true);
  };

  const handleDragLeaveDropzone = () => {
    setIsDragOverDropzone(false);
  };

  const handleDropOnDropzone = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOverDropzone(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  // Native reordering callback for standard list
  const handleReorder = (dragIndex: number, hoverIndex: number) => {
    const updated = [...files];
    const [removed] = updated.splice(dragIndex, 1);
    updated.splice(hoverIndex, 0, removed);
    setFiles(updated);
  };

  // Remove single file
  const removeFile = (id: string) => {
    const targetFile = files.find(f => f.id === id);
    if (targetFile) {
      if (targetFile.previewUrl && targetFile.previewUrl.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(targetFile.previewUrl);
        } catch (e) {
          console.warn('URL.revokeObjectURL error:', e);
        }
      }
      setFiles((prev) => prev.filter((f) => f.id !== id));
      addLog('info', `Arquivo removido da fila: ${targetFile.name}`);
    }
  };

  // Wipe index lists
  const clearFileList = () => {
    files.forEach(f => {
      if (f.previewUrl && f.previewUrl.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(f.previewUrl);
        } catch (e) {
          console.warn('URL.revokeObjectURL error:', e);
        }
      }
    });
    setFiles([]);
    addLog('info', 'Lista de arquivos redefinida.');
  };

  const clearNamesList = () => {
    setTargetNamesText('');
    addLog('info', 'Lista de novos nomes limpa.');
  };

  // Generate mock images and matching names for visual testing
  const populateWithMockData = () => {
    const mockNamesList = [
      'Paisagem_Montanhas_Verdes',
      'Logo_Marca_Versao_Escura',
      'Banner_Marketing_Campanha',
      'Retrato_Colaborador_Joao',
      'Ilustracao_Tecnologia_Futuro'
    ];
    
    const generated: RenameableFile[] = [];
    const colors = ['#f43f5e', '#10b981', '#3b82f6', '#f59e0b', '#8b5cf6'];
    
    addLog('info', 'Gerando 5 imagens de exemplo em tempo real para testes...');

    for (let i = 0; i < 5; i++) {
      const canvas = document.createElement('canvas');
      canvas.width = 400;
      canvas.height = 400;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Aesthetic colored block representing a photo structure
        ctx.fillStyle = colors[i];
        ctx.fillRect(0, 0, 400, 400);
        
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.lineWidth = 12;
        ctx.strokeRect(30, 30, 340, 340);
        
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 32px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`FOTO AMBO ${i + 1}`, 200, 190);
        
        ctx.font = '15px monospace';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.fillText(`Hex: ${colors[i]}`, 200, 230);
        ctx.fillText(`tamanho: 400x400`, 200, 260);
      }
      
      try {
        const dataUrl = canvas.toDataURL('image/png');
        const byteString = atob(dataUrl.split(',')[1]);
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let j = 0; j < byteString.length; j++) {
          ia[j] = byteString.charCodeAt(j);
        }
        const blob = new Blob([ab], { type: 'image/png' });
        const mockFileName = `exemplo_captura_00${i+1}.png`;
        const file = new File([blob], mockFileName, { type: 'image/png' });
        
        generated.push({
          id: Math.random().toString(36).substring(2, 9),
          file: file,
          name: mockFileName,
          size: blob.size,
          type: 'image/png',
          previewUrl: dataUrl,
          extension: 'png'
        });
      } catch (err: any) {
        addLog('error', `Falha ao gerar mockup de arquivo: ${err.message}`);
      }
    }

    setFiles((prev) => [...prev, ...generated]);
    setTargetNamesText(mockNamesList.join('\n'));
    addLog('success', '5 imagens de amostra com preenchimento em tela e 5 novos nomes carregados com sucesso!');
  };

  // Calculate new name for a file based on position and settings
  const getNewFileName = (fileItem: RenameableFile | null | undefined, index: number): string => {
    if (!fileItem) return '';
    const rawLine = targetLines[index];
    const targetName = rawLine ? rawLine.trim() : '';

    const name = fileItem.name || '';
    const extension = fileItem.extension || '';

    if (!targetName) {
      // Fallback: Use original name (no ext) if no target name was provided on that row
      const lastDotIndex = name.lastIndexOf('.');
      const nameWithoutExt = lastDotIndex !== -1 ? name.substring(0, lastDotIndex) : name;
      return `${settings.prefix}${nameWithoutExt}${settings.suffix}${settings.keepExtension && extension ? '.' + extension : ''}`;
    }

    return `${settings.prefix}${targetName}${settings.suffix}${settings.keepExtension && extension ? '.' + extension : ''}`;
  };

  /**
   * Action Type 1: File System Access API
   * Allows saving directly to a selected folder on the user's PC using showDirectoryPicker
   */
  const handleRenameDirectlyToFolder = async () => {
    if (files.length === 0) {
      addLog('warning', 'Nenhum arquivo listado para exportar.');
      return;
    }

    // Check if running inside an iframe, which restricts direct filesystem access
    const isIframe = typeof window !== 'undefined' && window.self !== window.top;
    if (isIframe) {
      setShowIframeModal(true);
      addLog('warning', 'Acesso de gravação direta negado pelo navegador devido ao iframe. Carregando ajuda com link para nova aba.');
      return;
    }

    setProgress({
      total: files.length,
      current: 0,
      status: 'processing',
      currentFileName: 'Iniciando seleção de pasta do computador...',
    });
    addLog('info', 'Solicitando acesso à pasta do computador via File System API...');

    try {
      // Check API support
      if (!('showDirectoryPicker' in window)) {
        throw new Error('Este navegador não suporta a gravação direta em diretórios locais. Use o método "Baixar Pacote ZIP".');
      }

      // @ts-ignore
      const directoryHandle = await window.showDirectoryPicker();
      
      // Proactively request readwrite permission to ensure writable access upfront
      const options = { mode: 'readwrite' };
      // @ts-ignore
      if ((await directoryHandle.queryPermission(options)) !== 'granted') {
        // @ts-ignore
        if ((await directoryHandle.requestPermission(options)) !== 'granted') {
          throw new Error('Permissão de escrita na pasta selecionada foi negada.');
        }
      }

      addLog('info', 'Permissão de diretório concedida pelo usuário.');

      let successes = 0;
      let errors = 0;

      for (let i = 0; i < files.length; i++) {
        const fileItem = files[i];
        const newName = getNewFileName(fileItem, i);

        setProgress(prev => ({
          ...prev,
          current: i + 1,
          currentFileName: `${fileItem.name} ➔ ${newName}`
        }));

        try {
          // Create file handle in directory
          const fileHandle = await directoryHandle.getFileHandle(newName, { create: true });
          
          // Request absolute permission writing access
          // @ts-ignore
          const writable = await fileHandle.createWritable();
          await writable.write(fileItem.file);
          await writable.close();

          successes++;
          addLog('success', `Gravado com sucesso no PC: ${fileItem.name} renomeado para ${newName}`);
        } catch (err: any) {
          errors++;
          addLog('error', `Falha ao gravar arquivo "${newName}" individualmente.`, err.toString());
        }
      }

      setProgress(prev => ({
        ...prev,
        status: successes === files.length ? 'completed' : 'failed'
      }));

      if (errors === 0) {
        addLog('success', `Lote completo! ${successes} arquivos foram salvos diretamente na pasta escolhida.`);
      } else {
        addLog('warning', `Lote concluído com erros. Sucessos: ${successes}, Falhas de permissão/sistema: ${errors}.`);
      }

    } catch (err: any) {
      const isAbort = err.name === 'AbortError' || 
                      err.message?.toLowerCase().includes('user aborted') || 
                      err.message?.toLowerCase().includes('cancel');

      if (isAbort) {
        setProgress({ total: 0, current: 0, status: 'idle', currentFileName: '' });
        addLog('info', 'Seleção de pasta cancelada pelo usuário.');
      } else {
        setProgress(prev => ({ ...prev, status: 'failed', currentFileName: 'Processamento cancelado.' }));
        addLog('error', 'Falha ao salvar lote na pasta escolhida do computador.', err.toString() || 'Permissão negada ou cancelada pelo usuário.');
      }
    }
  };

  /**
   * Action Type 2: Standard ZIP package container
   * Fallback and convenient batch download option using JSZip
   */
  const handleRenameAndDownloadZip = async () => {
    if (files.length === 0) {
      addLog('warning', 'Carregue arquivos antes de exportar um ZIP.');
      return;
    }

    setProgress({
      total: files.length,
      current: 0,
      status: 'processing',
      currentFileName: 'Compactando e preparando arquivos...',
    });
    addLog('info', 'Iniciando compactação compacta em ZIP...');

    const zip = new JSZip();
    let successes = 0;
    let errors = 0;

    // Use a slight timeout to let the dynamic loader thread breathe
    await new Promise(resolve => setTimeout(resolve, 300));

    for (let i = 0; i < files.length; i++) {
      const fileItem = files[i];
      const newName = getNewFileName(fileItem, i);

      try {
        setProgress(prev => ({
          ...prev,
          current: i + 1,
          currentFileName: `${fileItem.name} ➔ ${newName}`
        }));

        // Add to Zip
        zip.file(newName, fileItem.file);
        successes++;
        
        if (i % 10 === 0 || i === files.length - 1) {
          // Avoid choking large sets
          await new Promise(resolve => setTimeout(resolve, 20));
        }
      } catch (err: any) {
        errors++;
        addLog('error', `Erro ao adicionar "${fileItem.name}" ao pacote ZIP`, err.toString());
      }
    }

    try {
      if (successes > 0) {
        addLog('info', 'Gerando arquivo ZIP compactado...');
        setProgress(prev => ({ ...prev, currentFileName: 'Gerando arquivo .zip para download...' }));
        
        const zipBlob = await zip.generateAsync({ type: 'blob' }, (metadata) => {
          // Optional sub-progress inside zip compilation
        });

        const url = URL.createObjectURL(zipBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `arquivos_renomeados_lote-${new Date().toISOString().slice(0,10)}.zip`;
        link.click();
        URL.revokeObjectURL(url);

        setProgress(prev => ({ ...prev, status: 'completed' }));
        addLog('success', `Pacote ZIP gerado e baixado! ${successes} arquivos incluídos de maneira renomeada.`);
      } else {
        setProgress(prev => ({ ...prev, status: 'failed' }));
        addLog('error', 'A geração de ZIP falhou porque nenhum arquivo pôde ser adicionado ao pacote com sucesso.');
      }
    } catch (err: any) {
      setProgress(prev => ({ ...prev, status: 'failed' }));
      addLog('error', 'Ocorreu um erro catastrófico ao gerar o ZIP do lote.', err.toString());
    }
  };

  const isDirectoryPickerSupported = typeof window !== 'undefined' && 'showDirectoryPicker' in window;

  return (
    <div className={`min-h-screen bg-zinc-50 dark:bg-zinc-950 font-sans transition-colors duration-300 ${settings.darkMode ? 'dark' : ''}`}>
      
      {/* Upper Navigation Bar */}
      <header className="sticky top-0 z-40 w-full border-b border-zinc-200 dark:border-zinc-900 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md px-4 sm:px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 text-white shadow-md shadow-indigo-500/20">
            <Layers className="w-5.5 h-5.5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-zinc-950 dark:text-white tracking-tight flex items-center gap-1.5">
              Renomeador Inteligente
              <span className="text-[10px] font-mono tracking-widest uppercase bg-zinc-100 dark:bg-zinc-800 text-zinc-500 px-1.5 py-0.5 rounded-md border border-zinc-200/60 dark:border-zinc-700/60">
                v1.2
              </span>
            </h1>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 hidden sm:block">Ajuste a ordem por arrasto e modifique nomes em segundos</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Mock testing trigger */}
          <button
            type="button"
            id="mock-data-btn"
            onClick={populateWithMockData}
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 transition-all font-medium"
            title="Adiciona fotos do canvas e nomes simulados para testar instantaneamente"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Usar Amostra</span>
          </button>

          {/* Help Modal trigger */}
          <button
            type="button"
            id="help-btn"
            onClick={() => setShowHelpModal(true)}
            className="p-2 text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-xl transition-all"
            title="Como usar o aplicativo"
          >
            <HelpCircle className="w-4.5 h-4.5" />
          </button>

          {/* Theme switcher */}
          <button
            type="button"
            id="theme-toggle-btn"
            onClick={toggleDarkMode}
            className="p-2 text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-xl transition-all"
            title={settings.darkMode ? "Mudar para modo claro" : "Mudar para modo escuro"}
          >
            {settings.darkMode ? <Sun className="w-4.5 h-4.5" /> : <Moon className="w-4.5 h-4.5" />}
          </button>
        </div>
      </header>

      {/* Main content body */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6" id="app-main-layout">
        
        {/* Mock testing fallback banner on mobile */}
        <div className="md:hidden mb-4 p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 flex items-center justify-between">
          <span className="text-xs text-indigo-700 dark:text-indigo-300">Quer testar com dados simulados agora?</span>
          <button
            onClick={populateWithMockData}
            className="px-2 py-0.5 text-[10px] font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors"
          >
            Testar
          </button>
        </div>

        {/* Professional Bento Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">

          {/* Column 1: Files List and DND Dropzone (Left Box) */}
          <div className="col-span-12 lg:col-span-4 flex flex-col gap-4 bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-850 rounded-3xl p-5 shadow-sm transition-all">
            
            {/* Header section */}
            <div className="flex flex-col gap-3">
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 font-mono">
                  Etapa 1. Arquivos
                </h2>
                <p className="text-[11px] text-zinc-500 mt-0.5">Arraste para ordenar, clique para focar</p>
              </div>

              {/* Type Switcher grid requested by user */}
              <div className="grid grid-cols-3 gap-1 bg-zinc-100 dark:bg-zinc-950 rounded-xl p-1 border border-zinc-200 dark:border-zinc-800 text-[10px]">
                {/* Row 1, Col 1: Todos */}
                <button
                  type="button"
                  id="filter-all-btn"
                  onClick={() => {
                    setSettings(prev => ({ ...prev, filterByExtension: 'all' }));
                    addLog('info', "Filtro alterado para: 'Todos os formatos'.");
                  }}
                  className={`py-1 px-2 rounded-lg font-medium transition-all flex items-center justify-center gap-1 ${
                    settings.filterByExtension === 'all'
                      ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white shadow-sm font-semibold'
                      : 'text-zinc-500 hover:text-zinc-950 dark:hover:text-white'
                  }`}
                >
                  <FilesIcon className="w-3 h-3 text-indigo-500 shrink-0" />
                  <span>Todos</span>
                </button>

                {/* Row 1, Col 2: Áudio */}
                <button
                  type="button"
                  id="filter-audio-btn"
                  onClick={() => {
                    setSettings(prev => ({ ...prev, filterByExtension: 'audio' }));
                    addLog('info', "Filtro alterado para: 'Apenas Áudio'.");
                  }}
                  className={`py-1 px-2 rounded-lg font-medium transition-all flex items-center justify-center gap-1 ${
                    settings.filterByExtension === 'audio'
                      ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white shadow-sm font-semibold'
                      : 'text-zinc-500 hover:text-zinc-950 dark:hover:text-white'
                  }`}
                >
                  <FileAudio className="w-3 h-3 text-indigo-500 shrink-0" />
                  <span>Áudio</span>
                </button>

                {/* Row 1, Col 3: Vídeo */}
                <button
                  type="button"
                  id="filter-video-btn"
                  onClick={() => {
                    setSettings(prev => ({ ...prev, filterByExtension: 'video' }));
                    addLog('info', "Filtro alterado para: 'Apenas Vídeo'.");
                  }}
                  className={`py-1 px-2 rounded-lg font-medium transition-all flex items-center justify-center gap-1 ${
                    settings.filterByExtension === 'video'
                      ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white shadow-sm font-semibold'
                      : 'text-zinc-500 hover:text-zinc-950 dark:hover:text-white'
                  }`}
                >
                  <FileVideo className="w-3 h-3 text-indigo-500 shrink-0" />
                  <span>Vídeo</span>
                </button>

                {/* Row 2, Col 1: Empty or Spacer decoration */}
                <div className="text-zinc-300 dark:text-zinc-700 select-none flex items-center justify-center text-[9px] font-mono opacity-50 px-2 py-1">
                  • • •
                </div>

                {/* Row 2, Col 2: Imagem */}
                <button
                  type="button"
                  id="filter-images-btn"
                  onClick={() => {
                    setSettings(prev => ({ ...prev, filterByExtension: 'images' }));
                    addLog('info', "Filtro alterado para: 'Apenas Imagem'.");
                  }}
                  className={`py-1 px-2 rounded-lg font-medium transition-all flex items-center justify-center gap-1 ${
                    settings.filterByExtension === 'images'
                      ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white shadow-sm font-semibold'
                      : 'text-zinc-500 hover:text-zinc-950 dark:hover:text-white'
                  }`}
                >
                  <ImageIcon className="w-3 h-3 text-indigo-500 shrink-0" />
                  <span>Imagem</span>
                </button>

                {/* Row 2, Col 3: PDF */}
                <button
                  type="button"
                  id="filter-pdf-btn"
                  onClick={() => {
                    setSettings(prev => ({ ...prev, filterByExtension: 'pdf' }));
                    addLog('info', "Filtro alterado para: 'Apenas PDF'.");
                  }}
                  className={`py-1 px-2 rounded-lg font-medium transition-all flex items-center justify-center gap-1 ${
                    settings.filterByExtension === 'pdf'
                      ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white shadow-sm font-semibold'
                      : 'text-zinc-500 hover:text-zinc-950 dark:hover:text-white'
                  }`}
                >
                  <FileIcon className="w-3 h-3 text-indigo-500 shrink-0" />
                  <span>PDF</span>
                </button>
              </div>
            </div>

            {/* Dropzone Container */}
            <div
              id="upload-dropzone"
              onDragOver={handleDragOverDropzone}
              onDragLeave={handleDragLeaveDropzone}
              onDrop={handleDropOnDropzone}
              onClick={() => fileInputRef.current?.click()}
              className={`relative border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition-all duration-300 min-h-[120px] flex flex-col items-center justify-center
                ${isDragOverDropzone 
                  ? 'border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/10 scale-99' 
                  : 'border-zinc-200 dark:border-zinc-850 bg-zinc-50/50 dark:bg-zinc-950/10 hover:border-zinc-300 dark:hover:border-zinc-700'
                }
              `}
            >
              <input
                type="file"
                ref={fileInputRef}
                key={settings.filterByExtension}
                id="file-element-input"
                multiple
                accept={
                  settings.filterByExtension === 'images' ? "image/*" :
                  settings.filterByExtension === 'audio' ? "audio/*" :
                  settings.filterByExtension === 'video' ? "video/*" :
                  settings.filterByExtension === 'pdf' ? "application/pdf" : undefined
                }
                onChange={handleFileChange}
                className="hidden"
              />

              <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 mb-2 shadow-sm">
                <UploadCloud className="w-5 h-5" />
              </div>

              <h3 className="text-zinc-800 dark:text-white font-semibold text-xs">
                Arraste os arquivos aqui
              </h3>
              <p className="text-[10px] text-zinc-400 mt-1 max-w-[200px] leading-relaxed mx-auto">
                Ou clique para procurar.
                {settings.filterByExtension === 'images' && ' Aceita apenas Imagens.'}
                {settings.filterByExtension === 'audio' && ' Aceita apenas Áudios.'}
                {settings.filterByExtension === 'video' && ' Aceita apenas Vídeos.'}
                {settings.filterByExtension === 'pdf' && ' Aceita apenas PDFs.'}
                {settings.filterByExtension === 'all' && ' Aceita qualquer formato de arquivo.'}
              </p>
            </div>

            {/* Loaded Files Section wrapper */}
            <div className="flex-grow flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1">
                  <span className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400">
                    Fila ({files.length})
                  </span>
                  {files.length > 0 && (
                    <span className="text-[9px] font-mono bg-zinc-100 dark:bg-zinc-800 text-zinc-500 px-1 rounded">
                      {formatBytes(totalFilesSize)}
                    </span>
                  )}
                </div>

                {files.length > 0 && (
                  <button
                    type="button"
                    onClick={clearFileList}
                    className="flex items-center gap-1 text-[11px] text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 px-1.5 py-0.5 rounded transition-colors font-medium animate-in fade-in"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Limpar</span>
                  </button>
                )}
              </div>

              {/* Dynamic scrollable files listing */}
              {files.length === 0 ? (
                <div className="flex-grow border border-dashed border-zinc-200 dark:border-zinc-800 bg-zinc-50/20 dark:bg-zinc-950/20 rounded-2xl p-6 text-center text-zinc-400 dark:text-zinc-500 text-[11px] flex items-center justify-center min-h-[220px]">
                  <span>Nenhum arquivo carregado ainda.</span>
                </div>
              ) : (
                <div className="flex-grow max-h-[360px] overflow-y-auto pr-1">
                  {files.map((file, idx) => {
                    const mappedName = getNewFileName(file, idx);
                    const isSelected = file.id === (activePreviewItem?.id || '');
                    return (
                      <FileItemRow
                        key={file.id}
                        index={idx}
                        fileItem={file}
                        newName={mappedName}
                        draggedIndex={draggedIndex}
                        setDraggedIndex={setDraggedIndex}
                        onReorder={handleReorder}
                        onRemove={removeFile}
                        isSelected={isSelected}
                        onClick={() => setSelectedFileId(file.id)}
                      />
                    );
                  })}
                </div>
              )}
            </div>

          </div>

          {/* Column 2: Bento Live Preview Center (Middle Box) */}
          <div className="col-span-12 lg:col-span-4 flex flex-col bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-850 rounded-3xl p-5 shadow-sm transition-all">
            <div className="flex items-center justify-between mb-3.5">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 font-mono flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Painel de Prévia Ativa</span>
                </h3>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                  {activePreviewItem ? `Arquivo ${activePreviewIndex + 1} de ${files.length}` : 'Selecione um arquivo para inspecionar'}
                </p>
              </div>
              {activePreviewItem && (
                <span className="text-[10px] font-mono bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/30 px-2 py-0.5 rounded-full">
                  Foco Ativo
                </span>
              )}
            </div>

            {activePreviewItem ? (
              <div className="flex-grow flex flex-col justify-between gap-4">
                {/* Visual content container */}
                <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl bg-zinc-50/50 dark:bg-zinc-950/40 p-4 min-h-[220px]">
                  {(() => {
                    const fileType = activePreviewItem.type || '';
                    const ext = (activePreviewItem.extension || '').toLowerCase();
                    const isImg = fileType.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext);
                    const isAudio = fileType.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac', 'wma'].includes(ext);
                    const isVideo = fileType.startsWith('video/') || ['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv', '3gp'].includes(ext);
                    const isPdf = fileType === 'application/pdf' || ext === 'pdf';
                    const isTxt = fileType.startsWith('text/') || ['txt', 'csv', 'json', 'md', 'html', 'css', 'js', 'ts', 'xml', 'log'].includes(ext);

                    if (isImg && activePreviewItem.previewUrl) {
                      return (
                        <div className="relative group max-w-full w-full max-h-[180px] flex items-center justify-center rounded-xl overflow-hidden border border-zinc-200/60 dark:border-zinc-800 shadow-inner bg-zinc-100 dark:bg-black/40">
                          <img
                            src={activePreviewItem.previewUrl}
                            alt="Active preview"
                            referrerPolicy="no-referrer"
                            className="max-h-[180px] max-w-full object-contain"
                          />
                        </div>
                      );
                    } else if (isAudio && activePreviewItem.previewUrl) {
                      return (
                        <div className="flex flex-col items-center justify-center w-full bg-zinc-100/50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-850 p-4 rounded-xl shadow-inner gap-3 sm:gap-4 my-auto">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-11 h-11 rounded-full bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 animate-pulse">
                              <FileAudio className="w-5.5 h-5.5" />
                            </div>
                            <div className="text-left">
                              <span className="text-[10px] uppercase font-mono tracking-wider font-bold text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/60 px-2 py-0.5 rounded-full">
                                Modo Áudio
                              </span>
                              <p className="text-[10px] text-zinc-500 mt-1 font-mono">Pronto para tocar</p>
                            </div>
                          </div>
                          
                          <audio 
                            key={activePreviewItem.id}
                            src={activePreviewItem.previewUrl} 
                            controls 
                            preload="auto"
                            className="w-full max-w-[280px] h-9" 
                          />
                        </div>
                      );
                    } else if (isVideo && activePreviewItem.previewUrl) {
                      return (
                        <div className="relative group w-full max-h-[180px] flex items-center justify-center rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 shadow-lg bg-black my-auto">
                          <video
                            key={activePreviewItem.id}
                            src={activePreviewItem.previewUrl}
                            controls
                            playsInline
                            preload="auto"
                            className="max-h-[180px] max-w-full object-contain rounded-xl"
                          >
                            Seu navegador não suporta a visualização direta deste formato de vídeo.
                          </video>
                        </div>
                      );
                    } else if (isPdf && activePreviewItem.previewUrl) {
                      return (
                        <div className="flex flex-col items-center justify-center w-full gap-3 my-auto p-4 bg-zinc-50 dark:bg-zinc-950/40 rounded-2xl border border-zinc-200/60 dark:border-zinc-800 shadow-inner">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                              <FileText className="w-6 h-6" />
                            </div>
                            <div className="text-left">
                              <span className="text-[10px] uppercase font-mono tracking-wider font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full">
                                Documento PDF
                              </span>
                              <p className="text-[10px] text-zinc-500 mt-1 font-mono">Modo de Segurança</p>
                            </div>
                          </div>

                          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 text-center max-w-[240px] leading-normal">
                            Para garantir total compatibilidade e privacidade de dados no celular, visualize o PDF diretamente no leitor nativo.
                          </p>

                          <div className="flex justify-center w-full mt-1">
                            <a
                              href={activePreviewItem.previewUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-xl transition-all shadow-md active:scale-97 cursor-pointer"
                            >
                              <span>Visualizar PDF Completo ↗</span>
                            </a>
                          </div>
                        </div>
                      );
                    } else if (isTxt) {
                      return (
                        <div className="w-full flex flex-col gap-2 my-auto">
                          <div className="flex items-center justify-between px-1">
                            <div className="flex items-center gap-1.5 text-[10px] text-sky-600 dark:text-sky-400 font-semibold font-mono">
                              <FileText className="w-3.5 h-3.5" />
                              <span>Conteúdo do Arquivo de Texto</span>
                            </div>
                            <span className="text-[9px] text-zinc-400 font-mono">({(activePreviewItem.extension || '').toUpperCase()})</span>
                          </div>
                          
                          <div className="w-full max-h-[130px] overflow-y-auto text-left font-mono text-[10px] p-2.5 bg-zinc-100 dark:bg-black/65 border border-zinc-200 dark:border-zinc-850 rounded-xl whitespace-pre-wrap text-zinc-700 dark:text-zinc-350 leading-relaxed shadow-inner">
                            {isTextLoading ? (
                              <div className="flex items-center justify-center gap-2 py-4 text-zinc-450">
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                <span>Carregando...</span>
                              </div>
                            ) : textPreviewContent ? (
                              textPreviewContent
                            ) : (
                              <span className="italic text-zinc-400">Arquivo de texto vazio.</span>
                            )}
                          </div>
                        </div>
                      );
                    } else {
                      return (
                        <div className="flex flex-col items-center gap-2.5 text-zinc-400 dark:text-zinc-500 my-auto">
                          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/50 dark:border-zinc-800/50 text-indigo-500">
                            <FileIcon className="w-6 h-6" />
                          </div>
                          <span className="text-xs font-mono">{(activePreviewItem.extension || 'Arquivo').toUpperCase()}</span>
                          <span className="text-[10px] text-zinc-400 italic">Sem visualização direta compatível</span>
                        </div>
                      );
                    }
                  })()}

                  {/* Metadata info */}
                  <div className="mt-3 text-center">
                    <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate max-w-full px-2" title={activePreviewItem.name}>
                      {activePreviewItem.name}
                    </p>
                    <p className="text-[10px] text-zinc-400 mt-0.5 font-mono">
                      {formatBytes(activePreviewItem.size)} • {activePreviewItem.type || 'Formato Genérico'}
                    </p>
                  </div>
                </div>

                {/* Comparison block */}
                <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 flex flex-col gap-2.5">
                  <div className="min-w-0">
                    <span className="text-[9px] font-mono tracking-widest text-zinc-400 dark:text-zinc-500 uppercase">Nome Anterior</span>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400 font-mono overflow-x-auto whitespace-nowrap scrollbar-thin pb-1 line-through opacity-70" title={activePreviewItem.name}>
                      {activePreviewItem.name}
                    </div>
                  </div>
                  <div className="border-t border-zinc-200/50 dark:border-zinc-800/10 my-0.5" />
                  <div className="min-w-0">
                    <span className="text-[9px] font-mono tracking-widest text-indigo-500 dark:text-indigo-400 uppercase">Novo Nome Resultante</span>
                    <div className="text-xs text-emerald-600 dark:text-emerald-400 font-bold font-mono flex items-center gap-1.5 overflow-x-auto whitespace-nowrap scrollbar-thin pb-1" title={getNewFileName(activePreviewItem, activePreviewIndex)}>
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                      <span>{getNewFileName(activePreviewItem, activePreviewIndex)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-grow flex flex-col items-center justify-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl bg-zinc-50/20 dark:bg-zinc-950/20 p-8 text-center text-zinc-450 dark:text-zinc-500 text-xs min-h-[300px]">
                <Sparkles className="w-7 h-7 text-indigo-400/80 animate-pulse mb-3" />
                <p className="font-semibold text-zinc-700 dark:text-zinc-300">Nenhum arquivo ativo para prévia</p>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-450 mt-1 max-w-[200px] mx-auto">Adicione itens na coluna da esquerda e clique em qualquer linha para examinar a alteração imediatamente em tempo real.</p>
              </div>
            )}
          </div>

          {/* Column 3: Configuration & Paste Board (Right Box) */}
          <div className="col-span-12 lg:col-span-4 flex flex-col gap-4 bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-850 rounded-3xl p-5 shadow-sm transition-all">
            
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 font-mono">
                Etapa 2. Novos Nomes
              </h2>
              <p className="text-[11px] text-zinc-500 mt-0.5 font-sans">Cole a lista correspondente de nomes para as linhas</p>
            </div>

            {/* Paste Board */}
            <div className="flex flex-col flex-grow">
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="names-textarea-input" className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-450 flex items-center gap-1.5 font-sans">
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Novo nome para cada linha</span>
                </label>
                {targetNamesText.length > 0 && (
                  <button
                    type="button"
                    onClick={clearNamesList}
                    className="text-[10px] text-zinc-400 hover:text-rose-500 flex items-center gap-1 font-medium transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Redefinir</span>
                  </button>
                )}
              </div>

              <div className="relative flex border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 rounded-xl focus-within:ring-1 focus-within:ring-indigo-500 overflow-hidden h-[260px]">
                {/* Line Number Gutter */}
                <div 
                  ref={gutterRef}
                  className="flex flex-col text-right select-none py-3.5 pl-3 pr-2 border-r border-zinc-200 dark:border-zinc-800 bg-zinc-100/50 dark:bg-zinc-900/50 text-xs font-mono text-zinc-400 dark:text-zinc-650 overflow-hidden shrink-0"
                >
                  {Array.from({ length: linesCount }).map((_, i) => {
                    const lineNum = i + 1;
                    const hasCorrespondingFile = i < files.length;
                    return (
                      <div 
                        key={i} 
                        className={`h-6 leading-6 pr-1 font-semibold flex items-center justify-end gap-1 ${
                          hasCorrespondingFile 
                            ? 'text-indigo-600 dark:text-indigo-400 font-bold' 
                            : 'text-zinc-300 dark:text-zinc-700'
                        }`}
                        title={hasCorrespondingFile ? `Corresponde ao arquivo ${lineNum}` : undefined}
                      >
                        {hasCorrespondingFile ? (
                          <span className="inline-block w-1 h-1 rounded-full bg-indigo-500 shrink-0" />
                        ) : null}
                        <span>{lineNum}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Textarea */}
                <textarea
                  ref={textareaRef}
                  id="names-textarea-input"
                  value={targetNamesText}
                  onChange={(e) => setTargetNamesText(e.target.value)}
                  onScroll={handleTextareaScroll}
                  placeholder="Cole aqui os novos nomes correspondentes à ordem, um por linha. Ex:&#10;Foto_Beira_Mar&#10;Painel_Principal_Claro&#10;Estrutura_Prototipo"
                  className="flex-grow text-xs font-mono p-3.5 bg-transparent text-zinc-850 dark:text-zinc-100 focus:outline-none placeholder-zinc-400 leading-6 resize-none overflow-auto whitespace-pre scrollbar-thin"
                />
              </div>

              {/* Matching Helper Notice */}
              <div className="mt-3" id="alignment-helper">
                {files.length > 0 ? (
                  (() => {
                    const mappedCount = targetLines.filter(line => line.trim() !== '').length;
                    const diff = files.length - mappedCount;

                    if (diff === 0) {
                      return (
                        <div className="flex items-center gap-2 text-[11px] text-emerald-600 dark:text-emerald-400 bg-emerald-50/60 dark:bg-emerald-950/25 p-2 rounded-xl border border-emerald-100/50 dark:border-emerald-900/20 font-medium">
                          <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>Mapeamento perfeito 1-para-1!</span>
                        </div>
                      );
                    } else if (diff > 0) {
                      return (
                        <div className="flex items-start gap-1.5 text-[11px] text-amber-600 dark:text-amber-400 bg-amber-50/60 dark:bg-amber-950/25 p-2.5 rounded-xl border border-amber-100/50 dark:border-amber-900/20 leading-tight">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                          <div>
                            <span>Faltam <b>{diff} nomes</b></span>
                            <p className="text-[10px] text-zinc-450 dark:text-zinc-400 mt-1">Nomes de origem serão usados por padrão.</p>
                          </div>
                        </div>
                      );
                    } else {
                      return (
                        <div className="flex items-start gap-1.5 text-[11px] text-indigo-600 dark:text-indigo-400 bg-indigo-50/40 dark:bg-indigo-950/20 p-2.5 rounded-xl border border-indigo-100/50 dark:border-indigo-900/20 leading-tight">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                          <div>
                            <span>Excesso de <b>{Math.abs(diff)} nomes</b></span>
                            <p className="text-[10px] text-zinc-450 dark:text-zinc-400 mt-1">Não há arquivos correspondentes.</p>
                          </div>
                        </div>
                      );
                    }
                  })()
                ) : (
                  <div className="text-[10px] text-zinc-400 leading-relaxed bg-zinc-50/30 dark:bg-zinc-950/20 p-2 rounded-lg border border-zinc-200/50 dark:border-zinc-800">
                    Insira arquivos para parear.
                  </div>
                )}
              </div>
            </div>

            {/* Quick settings control card */}
            <div className="mt-2 pt-3 border-t border-zinc-150 dark:border-zinc-800 flex flex-col gap-3">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                <Settings2 className="w-3.5 h-3.5 text-indigo-500" />
                <span>Formatos de Acrescimo</span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <label htmlFor="settings-prefix" className="block text-zinc-450 mb-0.5">Prefixo (Início)</label>
                  <input
                    type="text"
                    id="settings-prefix"
                    value={settings.prefix}
                    onChange={(e) => setSettings(prev => ({ ...prev, prefix: e.target.value }))}
                    placeholder="Ex: 24-"
                    className="w-full px-2 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-100 font-mono text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="settings-suffix" className="block text-zinc-450 mb-0.5">Sufixo (Fim)</label>
                  <input
                    type="text"
                    id="settings-suffix"
                    value={settings.suffix}
                    onChange={(e) => setSettings(prev => ({ ...prev, suffix: e.target.value }))}
                    placeholder="Ex: _v2"
                    className="w-full px-2 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-100 font-mono text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-zinc-200/50 dark:border-zinc-800 text-[11px]">
                <label htmlFor="settings-keep-extension" className="text-zinc-500 dark:text-zinc-400 cursor-pointer text-[10px]">
                  Manter extensão original
                </label>
                <input
                  type="checkbox"
                  id="settings-keep-extension"
                  checked={settings.keepExtension}
                  onChange={(e) => setSettings(prev => ({ ...prev, keepExtension: e.target.checked }))}
                  className="w-4 h-4 text-indigo-600 border-zinc-300 dark:border-zinc-800 rounded focus:ring-indigo-500 accent-indigo-600 cursor-pointer"
                />
              </div>
            </div>

          </div>

        </div>

        {/* Global Progress Board / Floating state */}
        {progress.status !== 'idle' && (
          <div className="mt-6 p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-lg" id="rename-progress-bar">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                {progress.status === 'processing' && <RefreshCw className="w-3.5 h-3.5 text-indigo-500 animate-spin" />}
                {progress.status === 'completed' && <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />}
                {progress.status === 'failed' && <AlertCircle className="w-3.5 h-3.5 text-rose-500" />}
                <span>
                  {progress.status === 'processing' && 'Processando e Gerando Arquivos...'}
                  {progress.status === 'completed' && 'Lote concluído com Sucesso!'}
                  {progress.status === 'failed' && 'Processamento concluído com erros'}
                </span>
              </span>
              <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">
                {progress.current} / {progress.total} ({Math.round((progress.current / progress.total) * 100)}%)
              </span>
            </div>

            {/* Slider track */}
            <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-2 rounded-full overflow-hidden mb-2">
              <div 
                className={`h-full transition-all duration-300 ${
                  progress.status === 'failed' 
                    ? 'bg-rose-500' 
                    : progress.status === 'completed' 
                      ? 'bg-emerald-500' 
                      : 'bg-indigo-600'
                }`}
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              />
            </div>
            
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono truncate" title={progress.currentFileName}>
              {progress.currentFileName}
            </p>
          </div>
        )}

        {/* Action Bottom Operations Board */}
        <section className="mt-8 p-6 rounded-3xl bg-gradient-to-r from-zinc-900 via-neutral-900 to-zinc-900 text-white shadow-xl dark:border dark:border-zinc-800" id="export-dashboard">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-widest text-indigo-400 font-mono">
                Etapa 3. Execução e Exportação
              </h2>
              <p className="text-xs text-zinc-400 mt-1 max-w-xl">
                Escolha o método mais adequado para salvar os seus arquivos. Se o seu navegador suportar, utilize a gravação direta em uma pasta local.
              </p>
            </div>

            {/* Master Export Grid */}
            <div className="flex flex-col gap-2">
              <div className="flex flex-col sm:flex-row gap-3">
                
                {/* Button A: System Directory select (Save directly to personal computer) */}
                {isDirectoryPickerSupported ? (
                  <button
                    type="button"
                    id="direct-folder-export-btn"
                    onClick={handleRenameDirectlyToFolder}
                    disabled={files.length === 0 || progress.status === 'processing'}
                    className="px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed font-semibold text-xs transition-all flex items-center justify-center gap-2 group cursor-pointer text-white shadow-lg active:scale-97"
                  >
                    <FolderPlus className="w-4 h-4 group-hover:scale-110 transition-transform" />
                    <span>Salvar na Pasta do PC</span>
                  </button>
                ) : (
                  <div 
                    className="px-5 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-400 font-semibold text-[11px] flex items-center justify-center"
                    title="A API de gravação direta showDirectoryPicker não é suportada ou está indisponível na Sandbox do seu navegador"
                  >
                    Gravação na pasta PC indisponível
                  </div>
                )}

                {/* Button B: standard ZIP download fallback */}
                <button
                  type="button"
                  id="zip-download-export-btn"
                  onClick={handleRenameAndDownloadZip}
                  disabled={files.length === 0 || progress.status === 'processing'}
                  className="px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed font-semibold text-xs transition-all flex items-center justify-center gap-2 group cursor-pointer text-white shadow-lg active:scale-97"
                >
                  <Download className="w-4 h-4 group-hover:scale-110 transition-transform" />
                  <span>Baixar Pacote ZIP</span>
                </button>
              </div>

              {/* Subtitle iframe warning info */}
              {typeof window !== 'undefined' && window.self !== window.top && (
                <div className="text-[10px] text-amber-300 dark:text-amber-400 text-center sm:text-right font-medium flex items-center justify-center sm:justify-end gap-1 mt-1">
                  <span>⚠️ Para salvar direto na pasta do PC, clique para</span>
                  <a href={window.location.href} target="_blank" rel="noopener noreferrer" className="underline font-bold text-white hover:text-amber-300 transition-colors">abrir em nova aba ↗</a>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Detailed Audit Log Drawer */}
        <section className="mt-6" id="activity-logger-area">
          <RenameLogger logs={logs} onClearLogs={() => setLogs([])} />
        </section>

      </main>

      {/* Instructions Overlay Modal */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/75 dark:bg-zinc-950/85 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="relative bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl text-zinc-800 dark:text-zinc-200">
            <button
              onClick={() => setShowHelpModal(false)}
              className="absolute top-4 right-4 p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-lg bg-zinc-50 dark:bg-zinc-800/60"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-base font-bold text-zinc-950 dark:text-white flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-indigo-500" />
              <span>Manual de Utilização de Renomeação em Lote</span>
            </h3>

            <div className="space-y-3.5 text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed overflow-y-auto max-h-[380px] pr-1">
              <p>O aplicativo foi construído para agilizar a alteração sequencial e estruturada de fotos e dados. Siga os passos detalhados:</p>
              
              <div className="flex gap-2">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-mono text-[10px] shrink-0 mt-0.5">1</span>
                <div>
                  <b className="text-zinc-900 dark:text-zinc-100">Carregue seus arquivos:</b>
                  <p>Adicione suas fotos ou documentos no painel de seleção. Você pode prender o filtro globais a <b>Apenas Imagens</b> ou liberar todos os tipos.</p>
                </div>
              </div>

              <div className="flex gap-2">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-mono text-[10px] shrink-0 mt-0.5">2</span>
                <div>
                  <b className="text-zinc-900 dark:text-zinc-100">Ajuste e reordene:</b>
                  <p>Segure e mova verticalmente as linhas do arquivo com o mouse usando o pegador de aderência <span className="font-mono bg-zinc-100 dark:bg-zinc-800 px-1 py-0.5 rounded">Grip</span> para que fiquem pareadas na sequência correta.</p>
                </div>
              </div>

              <div className="flex gap-2">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-mono text-[10px] shrink-0 mt-0.5">3</span>
                <div>
                  <b className="text-zinc-900 dark:text-zinc-100">Cole a lista de novos nomes:</b>
                  <p>Vá na seção da direita e cole a lista de novos nomes (pode copiar facilmente de uma coluna no Excel). O mapeador calculará as associações 1-para-1 instantaneamente.</p>
                </div>
              </div>

              <div className="flex gap-2">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-mono text-[10px] shrink-0 mt-0.5">4</span>
                <div>
                  <b className="text-zinc-900 dark:text-zinc-100">Configure modificadores globais:</b>
                  <p>Se quiser, preencha prefixos de data ou sufixo sequencial do lote. Deixe marcada a caixa "Manter extensão" para não danificar a extensão original do arquivo.</p>
                </div>
              </div>

              <div className="flex gap-2">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-mono text-[10px] shrink-0 mt-0.5">5</span>
                <div>
                  <b className="text-zinc-900 dark:text-zinc-100">Escolha o método de gravação:</b>
                  <p>
                    <b>Gravação Direta na Pasta:</b> Escolha uma pasta local vazia de destino e autorize o navegador a gravar os arquivos em lote sequenciados. Muito prático!
                  </p>
                  <p className="mt-1">
                    <b>Pacote ZIP:</b> Compacta tudo localmente e faz o download instantâneo de todas as fotos organizadas sem precisar de permissões especiais de pastas no PC.
                  </p>
                </div>
              </div>

              <div className="mt-5 p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 text-[11px] text-amber-800 dark:text-amber-400">
                🔒 <b>Privacidade garantida:</b> Todo o processamento e renomeação ocorrem 100% offline no seu próprio navegador. Suas imagens jamais são transmitidas para qualquer servidor!
              </div>

            </div>

            <div className="mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-800 flex justify-end">
              <button
                type="button"
                onClick={() => setShowHelpModal(false)}
                className="px-4.5 py-2 rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 text-xs font-semibold hover:opacity-90 active:scale-97"
              >
                Entendi, Começar!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Iframe Restriction Modal */}
      {showIframeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/75 dark:bg-zinc-950/85 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="relative bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl max-w-md w-full p-6 shadow-2xl text-zinc-800 dark:text-zinc-200">
            <button
              onClick={() => setShowIframeModal(false)}
              className="absolute top-4 right-4 p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-base font-bold text-zinc-950 dark:text-white flex items-center gap-2 mb-3">
              <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
              <span>Gravação Direta Bloqueada (Segurança do Navegador)</span>
            </h3>

            <div className="space-y-4 text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
              <p>
                Os navegadores modernos (como o Chrome) possuem políticas rígidas de segurança que <b>impedem o acesso a pastas locais</b> (via função <code className="font-mono bg-zinc-100 dark:bg-zinc-800 px-1 py-0.5 rounded text-[10px]">showDirectoryPicker</code>) quando o site está rodando dentro de um <b>iFrame</b> (que é a visualização lateral do editor do AI Studio).
              </p>
              
              <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-100/50 dark:border-amber-900/20 font-medium">
                💡 <b>Para utilizar essa função perfeitamente:</b> Abra este aplicativo diretamente em uma nova aba inteira do navegador!
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <a
                  href={window.location.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-5 py-3 rounded-xl bg-indigo-600 text-white font-semibold text-xs text-center hover:bg-indigo-500 transition-all flex items-center justify-center gap-2 shadow-md hover:shadow-indigo-500/10 active:scale-97 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Abrir em Nova Aba ↗</span>
                </a>
                
                <button
                  type="button"
                  onClick={() => setShowIframeModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-450 font-semibold text-[11px] text-center hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-all cursor-pointer"
                >
                  Continuar aqui e usar "Baixar Pacote ZIP"
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Google AdSense Pages Modal */}
      {activeFooterPage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/75 dark:bg-zinc-950/85 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="relative bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl max-w-2xl w-full p-6 sm:p-7 shadow-2xl text-zinc-800 dark:text-zinc-200 flex flex-col max-h-[85vh]">
            <button
              onClick={() => {
                setActiveFooterPage(null);
                setContactSubmitted(false);
              }}
              className="absolute top-4 right-4 p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            {activeFooterPage === 'privacy' && (
              <>
                <h3 className="text-base font-bold text-zinc-950 dark:text-white flex items-center gap-2 mb-4 shrink-0">
                  <Shield className="w-5 h-5 text-indigo-500 shrink-0" />
                  <span>Política de Privacidade</span>
                </h3>
                <div className="text-xs text-zinc-600 dark:text-zinc-300 space-y-4 overflow-y-auto pr-2 scrollbar-thin flex-1 pb-2">
                  <p className="font-semibold text-zinc-800 dark:text-zinc-100">
                    Última atualização: 19 de Junho de 2026
                  </p>
                  <p>
                    A sua privacidade é crucialmente importante para nós. Esta política de privacidade delineia as regras e os compromissos relativos aos dados processados em nossa aplicação, assim como o uso de cookies de parceiros terceiros de publicidade, incluindo o <b>Google AdSense</b>.
                  </p>
                  <h4 className="font-bold text-zinc-900 dark:text-zinc-100 text-[13px] mt-3">1. Processamento e Segurança Local de Arquivos</h4>
                  <p>
                    O nosso <i>Batch File Renamer</i> foi desenhado sob o princípio de <b>privacidade absoluta por design (Privacy by Design)</b>. Todo o lote de arquivos (imagens, áudio, vídeos ou documentos PDF) inseridos ou gerados na ferramenta é processado <b>100% no seu navegador de internet</b>:
                  </p>
                  <ul className="list-disc pl-5 space-y-1.5">
                    <li>Nenhum arquivo ou dado é enviado, carregado sob upload, ou armazenado em servidores externos ou em redes na nuvem.</li>
                    <li>Sua largura de banda não é consumida para subir conteúdo para nossos servidores. Todas as leituras e gravações ocorrem em memória privada local através de APIs de sistema de arquivo locais e nativas.</li>
                  </ul>
                  
                  <h4 className="font-bold text-zinc-900 dark:text-zinc-100 text-[13px] mt-3">2. Cookies e Anúncios do Google AdSense</h4>
                  <p>
                    Utilizamos parceiros terceiros de publicidade, especificamente o <b>Google AdSense</b>, para veicular anúncios quando você visita o nosso website. O Google utiliza tecnologia de cookies de forma a personalizar, otimizar e direcionar anúncios com base nas visitas anteriores dos usuários a este e a outros websites da internet.
                  </p>
                  <ul className="list-disc pl-5 space-y-1.5">
                    <li>O Google utiliza cookies de publicidade que permitem a ele e aos seus parceiros veicular anúncios relevantes direcionados ao seu perfil de interesses gerais.</li>
                    <li>Você poderá desativar a exibição de publicidade personalizada diretamente acessando as configurações de anúncios do Google em <a href="https://www.google.com/settings/ads" target="_blank" rel="noopener noreferrer" className="text-indigo-600 dark:text-indigo-400 underline font-semibold">Configurações de Anúncios</a> ou visitando o portal de preferência global de anúncios em <a href="https://www.aboutads.info" target="_blank" rel="noopener noreferrer" className="text-indigo-600 dark:text-indigo-400 underline font-semibold">aboutads.info</a>.</li>
                  </ul>

                  <h4 className="font-bold text-zinc-900 dark:text-zinc-100 text-[13px] mt-3">3. Registros de Logs do Navegador</h4>
                  <p>
                    Armazenamos de forma puramente volátil (recarregado a cada sessão do app) logs específicos de auditoria sobre operações executadas na sua página local (como avisos de extensão ignorada, erros de permissões, etc). Esses logs só existem na aba corrente e somem permanentemente ao fechar o navegador.
                  </p>

                  <h4 className="font-bold text-zinc-900 dark:text-zinc-100 text-[13px] mt-3">4. Consentimento do Usuário</h4>
                  <p>
                    Ao utilizar a nossa ferramenta, você concorda expressamente com nossos termos e com as diretrizes e salvaguardas de privacidade estabelecidas acima. Se tiver dúvidas, pedimos que entre em contato direto pelo formulário de suporte.
                  </p>
                </div>
              </>
            )}

            {activeFooterPage === 'terms' && (
              <>
                <h3 className="text-base font-bold text-zinc-950 dark:text-white flex items-center gap-2 mb-4 shrink-0">
                  <BookOpen className="w-5 h-5 text-indigo-500 shrink-0" />
                  <span>Termos de Uso</span>
                </h3>
                <div className="text-xs text-zinc-650 dark:text-zinc-300 space-y-4 overflow-y-auto pr-2 scrollbar-thin flex-1 pb-2">
                  <p className="font-semibold text-zinc-800 dark:text-zinc-100">
                    Última atualização: 19 de Junho de 2026
                  </p>
                  <p>
                    Seja bem-vindo ao <b>Batch File Renamer Utility</b>. Ao acessar e utilizar este website gratuito, você aceita de forma irrevogável os seguintes Termos de Uso. Caso discorde de qualquer disposição, nós recomendamos que não prossiga utilizando as nossas ferramentas.
                  </p>
                  <h4 className="font-bold text-zinc-900 dark:text-zinc-100 text-[13px] mt-3">1. Licença de Uso Gratuito</h4>
                  <p>
                    Concedemos permissão para uso pessoal ou profissional, não comercial e gratuito, da nossa ferramenta interativa de renomeação em lote. Esta licença cobre puramente o acesso às funcionalidades e execuções baseadas em Javascript diretamente no cliente.
                  </p>
                  <h4 className="font-bold text-zinc-900 dark:text-zinc-100 text-[13px] mt-3">2. Isenção e Limitação de Responsabilidade</h4>
                  <p>
                    Este software e utilitário são fornecidos <b>"como estão" (as-is)</b>, sem qualquer tipo de garantia expressa ou implícita. Nós não nos responsabilizamos de forma alguma por:
                  </p>
                  <ul className="list-disc pl-5 space-y-1.5">
                    <li>Acidentes, perda acidental de dados, renomeações incorretas ou exclusões de arquivos resultantes de uso inadequado da ferramenta por parte do operador.</li>
                    <li>Erros, imprecisões ou conflitos no mapeamento de strings de novos títulos inseridas pelo usuário na prancheta de cópia.</li>
                    <li>Falta de compatibilidade entre a API nativa de gravação de arquivos por pastas (<code className="font-mono bg-zinc-100 dark:bg-zinc-800 px-1 py-0.5 rounded text-[10px]">showDirectoryPicker</code>) e o sistema operacional ou navegador utilizado pelo usuário.</li>
                  </ul>
                  <p className="text-amber-600 dark:text-amber-400 font-medium">
                    ⚠️ Recomendamos sempre copiar ou criar um backup de segurança de suas fotos originais antes de executar a renomeação em lote!
                  </p>
                  
                  <h4 className="font-bold text-zinc-900 dark:text-zinc-100 text-[13px] mt-3">3. Alterações na Ferramenta e no Website</h4>
                  <p>
                    Reservamo-nos o direito de alterar, suspender ou descontinuar qualquer recurso ou o website inteiro a qualquer momento, sem prévio aviso, visando aplicar melhorias de acessibilidade, novidades visuais e adequações comerciais para programas de anúncios.
                  </p>
                </div>
              </>
            )}

            {activeFooterPage === 'about' && (
              <>
                <h3 className="text-base font-bold text-zinc-950 dark:text-white flex items-center gap-2 mb-4 shrink-0">
                  <Info className="w-5 h-5 text-indigo-500 shrink-0" />
                  <span>Sobre</span>
                </h3>
                <div className="text-xs text-zinc-650 dark:text-zinc-300 space-y-4 overflow-y-auto pr-2 scrollbar-thin flex-1 pb-2">
                  <p>
                    O <b>Batch File Renamer Utility</b> nasceu com um propósito claro: entregar a fotógrafos, criadores de conteúdo, administradores de sistemas, designers e desenvolvedores um método verdadeiramente livre, ágil e seguro de organizar coleções caóticas de arquivos em segundos.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 my-3">
                    <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-200/20">
                      <h5 className="font-bold text-indigo-600 dark:text-indigo-400 mb-1">⚡ Ultra Veloz</h5>
                      <p className="text-[11px] text-zinc-500">Desenvolvido com renderização nativa em tempo real. O pareamento por linhas funciona instantaneamente ao digitar ou colar no editor.</p>
                    </div>
                    <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-200/20">
                      <h5 className="font-bold text-emerald-600 dark:text-emerald-400 mb-1">🔒 100% Seguro</h5>
                      <p className="text-[11px] text-zinc-500">Seus dados e arquivos confidenciais são mantidos no seu dispositivo. Nada é transferido e tudo funciona sem requisições de upload pesadas.</p>
                    </div>
                  </div>
                  <h4 className="font-bold text-zinc-900 dark:text-zinc-100 text-[13px]">Principais Recursos:</h4>
                  <ul className="list-disc pl-5 space-y-1.5">
                    <li><b>Ordenação Arraste-e-Solte (Drag and Drop):</b> Modifique a sequência de correspondência puxando as linhas com o mouse ou o toque.</li>
                    <li><b>Editor em Lote Avançado:</b> Caixa de texto sincronizada com régua de numeração, permitindo colar strings diretas do Excel, Planilhas ou bloco de notas.</li>
                    <li><b>Tipos Variados:</b> Filtros interativos para separar Foto/Imagens, Áudio, Vídeo e Documentos PDF em poucos cliques.</li>
                    <li><b>Salvamento Inteligente:</b> Baixe tudo compactado em ZIP de altíssima performance estruturado localmente.</li>
                  </ul>
                  <p className="text-zinc-500 mt-2">
                    Nossa missão é economizar tempo repetitivo e eliminar ferramentas complexas de terminal ou instaladores suspeitos de desktop. Tudo o que você precisa está disponível aqui, em um visual de alta qualidade para o seu dia a dia.
                  </p>
                </div>
              </>
            )}

            {activeFooterPage === 'contact' && (
              <>
                <h3 className="text-base font-bold text-zinc-950 dark:text-white flex items-center gap-2 mb-4 shrink-0">
                  <Mail className="w-5 h-5 text-indigo-500 shrink-0" />
                  <span>Contato e Suporte</span>
                </h3>
                <div className="text-xs text-zinc-650 dark:text-zinc-300 space-y-4 overflow-y-auto pr-2 scrollbar-thin flex-1 pb-2">
                  <p>
                    Dúvidas sobre o funcionamento, sugestões de novos filtros, relatos de problemas na sandbox, ou quer conversar sobre parcerias e anúncios? Estamos prontos para responder!
                  </p>

                  <div className="p-3.5 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100/50 dark:border-indigo-900/40 text-zinc-700 dark:text-zinc-300">
                    📧 <b>E-mail Direto de Contato:</b> <span className="font-mono text-indigo-600 dark:text-indigo-400 font-semibold select-all">clicfilebr@gmail.com</span>
                  </div>

                  {contactSubmitted ? (
                    <div className="p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 text-center space-y-2 animate-in zoom-in-95 duration-200">
                      <div className="w-9 h-9 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto text-sm font-bold font-mono">✓</div>
                      <h4 className="font-bold text-emerald-800 dark:text-emerald-300 text-xs">Mensagem Enviada com Sucesso!</h4>
                      <p className="text-[11px] text-emerald-600 dark:text-emerald-400">Obrigado por nos contatar. Responderemos à sua mensagem no seu e-mail de correspondência em até 48 horas úteis.</p>
                      <button
                        type="button"
                        onClick={() => {
                          setContactSubmitted(false);
                          setContactForm({ name: '', email: '', message: '' });
                        }}
                        className="mt-2 text-[10px] text-emerald-700 dark:text-emerald-400 underline font-medium hover:opacity-85"
                      >
                        Enviar outra mensagem
                      </button>
                    </div>
                  ) : (
                    <form 
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (contactForm.email && contactForm.message) {
                          setContactSubmitted(true);
                        }
                      }}
                      className="space-y-3 pt-1"
                    >
                      <div>
                        <label className="block text-[10px] font-mono tracking-wider font-semibold text-zinc-400 uppercase mb-1">Seu Nome</label>
                        <input
                          type="text"
                          required
                          value={contactForm.name}
                          onChange={(e) => setContactForm(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="Ex: João Silva"
                          className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-1 focus:ring-indigo-500 focus:outline-none text-zinc-850 dark:text-zinc-100 text-xs placeholder-zinc-400"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-mono tracking-wider font-semibold text-zinc-400 uppercase mb-1">Seu E-mail</label>
                        <input
                          type="email"
                          required
                          value={contactForm.email}
                          onChange={(e) => setContactForm(prev => ({ ...prev, email: e.target.value }))}
                          placeholder="Ex: joao@email.com"
                          className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-1 focus:ring-indigo-500 focus:outline-none text-zinc-850 dark:text-zinc-100 text-xs placeholder-zinc-400"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-mono tracking-wider font-semibold text-zinc-400 uppercase mb-1">Sua Mensagem</label>
                        <textarea
                          required
                          rows={3}
                          value={contactForm.message}
                          onChange={(e) => setContactForm(prev => ({ ...prev, message: e.target.value }))}
                          placeholder="Descreva sua questão ou sugestão detalhadamente..."
                          className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-1 focus:ring-indigo-500 focus:outline-none text-zinc-850 dark:text-zinc-100 text-xs placeholder-zinc-400 resize-none"
                        />
                      </div>
                      <div className="pt-1.5">
                        <button
                          type="submit"
                          className="w-full py-2.5 rounded-xl bg-indigo-650 hover:bg-indigo-600 font-semibold text-xs text-white transition-all text-center cursor-pointer shadow-md shadow-indigo-600/10 active:scale-97"
                        >
                          Enviar Mensagem
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </>
            )}

            <div className="mt-5 pt-3.5 border-t border-zinc-100 dark:border-zinc-800 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => {
                  setActiveFooterPage(null);
                  setContactSubmitted(false);
                }}
                className="px-4 py-2 rounded-xl bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 text-xs font-semibold hover:opacity-90 active:scale-97 transition-all cursor-pointer"
              >
                Fechar Painel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Humble aesthetic footer */}
      <footer className="max-w-7xl mx-auto px-4 sm:px-6 py-8 mt-12 border-t border-zinc-200 dark:border-zinc-900 flex flex-col sm:flex-row items-center justify-between gap-4 text-center">
        <div className="flex flex-col items-center sm:items-start gap-1">
          <p className="text-xs text-zinc-400 dark:text-zinc-500">Processamento executado 100% no navegador.</p>
          <div className="flex flex-wrap justify-center sm:justify-start gap-x-3 gap-y-2 mt-1 text-[11px] font-medium text-indigo-600 dark:text-indigo-400">
            <button 
              type="button" 
              onClick={() => setActiveFooterPage('privacy')}
              className="hover:underline transition-all cursor-pointer whitespace-nowrap"
            >
              Política de Privacidade
            </button>
            <span className="text-zinc-350 dark:text-zinc-800 select-none">•</span>
            <button 
              type="button" 
              onClick={() => setActiveFooterPage('terms')}
              className="hover:underline transition-all cursor-pointer whitespace-nowrap"
            >
              Termos de Uso
            </button>
            <span className="text-zinc-350 dark:text-zinc-800 select-none">•</span>
            <button 
              type="button" 
              onClick={() => setActiveFooterPage('about')}
              className="hover:underline transition-all cursor-pointer whitespace-nowrap"
            >
              Sobre
            </button>
            <span className="text-zinc-350 dark:text-zinc-800 select-none">•</span>
            <button 
              type="button" 
              onClick={() => setActiveFooterPage('contact')}
              className="hover:underline transition-all cursor-pointer whitespace-nowrap"
            >
              Contato e Suporte
            </button>
          </div>
        </div>
        <p className="text-xs text-zinc-450 dark:text-zinc-550 font-mono">2026 Batch File Renamer Utility</p>
      </footer>

    </div>
  );
}
