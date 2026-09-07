import { useState, useCallback, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { Dropzone } from './components/Dropzone';
import { Configuration } from './components/Configuration';
import { Preview } from './components/Preview';
import { Instructions } from './components/Instructions';
import { History } from './components/History';
import { ImpositionConfig, PDFMetadata, ImpositionStats, ImpositionResult } from './types';
import { createImposedPDF, calculateImpositionStats, createSamplePDF, sanitizePdfBuffer } from './lib/imposition';
import { useFirebase } from './hooks/useFirebase';
import { PDFDocument } from 'pdf-lib';
import { 
  Download, 
  Sparkles, 
  Loader2, 
  FileText, 
  Layers, 
  FilePlus2, 
  Printer, 
  FileCheck,
  CheckCircle2,
  AlertCircle,
  X,
  Image as ImageIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PngExportModal } from './components/PngExportModal';
import { PrintInstructionsAlert } from './components/PrintInstructionsAlert';
import { renderImposedPdfToPngs, downloadPngsIndividually, downloadPngsAsZip } from './lib/exportPng';

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [fileBuffer, setFileBuffer] = useState<Uint8Array | null>(null);
  const [originalPageCount, setOriginalPageCount] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const [config, setConfig] = useState<ImpositionConfig>({
    preset: 'pocketbook-a6',
    sheetsPerSignature: 4, // Default coptic signature size
    customSheetsCount: 4,
    addCropMarks: true,
    addFoldGuides: true,
    addSignatureLabels: true,
  });

  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadSuccess, setDownloadSuccess] = useState<boolean>(false);

  // PNG Export states
  const [isExportingPng, setIsExportingPng] = useState<boolean>(false);
  const [pngProgress, setPngProgress] = useState<number>(0);
  const [pngStatusMessage, setPngStatusMessage] = useState<string>('');
  const [pngSuccess, setPngSuccess] = useState<boolean>(false);
  const [isPngModalOpen, setIsPngModalOpen] = useState<boolean>(false);

  const { user, history, totalStats, loading: statsLoading, saveGeneration, login, logout } = useFirebase();

  // Load and read PDF pages count safely using pdf-lib (without storing huge objects in RAM)
  const handleFileSelect = async (selectedFile: File) => {
    if (!selectedFile) return;

    if (selectedFile.size === 0) {
      setFile(null);
      setFileBuffer(null);
      setOriginalPageCount(0);
      setErrorMessage('O arquivo selecionado está vazio (0 bytes). Selecione um arquivo PDF com conteúdo ou carregue o exemplo de 16 páginas.');
      return;
    }

    try {
      setIsProcessing(true);
      setErrorMessage(null);
      setStatusMessage('Lendo páginas do arquivo PDF...');

      const rawBuffer = await selectedFile.arrayBuffer();
      if (!rawBuffer || rawBuffer.byteLength === 0) {
        setErrorMessage('O arquivo selecionado está vazio (0 bytes). Selecione um arquivo PDF com conteúdo ou carregue o exemplo de 16 páginas.');
        setFile(null);
        setFileBuffer(null);
        setOriginalPageCount(0);
        return;
      }

      // Sanitize buffer (strips leading BOM, whitespace, or invalid preamble)
      const cleanBytes = sanitizePdfBuffer(rawBuffer);
      
      // Extract page count safely using pdf-lib
      const pdfDoc = await PDFDocument.load(cleanBytes, { ignoreEncryption: true });
      const count = pdfDoc.getPageCount();

      if (count === 0) {
        setErrorMessage('O arquivo PDF selecionado não contém páginas legíveis.');
        setFile(null);
        setFileBuffer(null);
        setOriginalPageCount(0);
        return;
      }

      setFile(selectedFile);
      setFileBuffer(cleanBytes);
      setOriginalPageCount(count);
      setErrorMessage(null);
    } catch (err: any) {
      console.warn('PDF parsing notification:', err?.message || err);
      setFile(null);
      setFileBuffer(null);
      setOriginalPageCount(0);

      const msg = err?.message || 'Não foi possível ler o arquivo PDF. Verifique se o arquivo não está corrompido ou protegido por senha.';
      setErrorMessage(msg);
    } finally {
      setIsProcessing(false);
      setStatusMessage('');
      // Release any intermediate garbage
      try {
        if (typeof (window as any).gc === 'function') {
          (window as any).gc();
        }
      } catch (_) {}
    }
  };

  // Load sample demo PDF
  const handleLoadSample = async () => {
    try {
      setIsProcessing(true);
      setErrorMessage(null);
      setStatusMessage('Gerando documento de exemplo (16 páginas)...');
      const sampleBytes = await createSamplePDF(16);
      const cleanBytes = sanitizePdfBuffer(sampleBytes);
      const sampleBlob = new Blob([cleanBytes], { type: 'application/pdf' });
      const sampleFile = new File([sampleBlob], 'Pocketbook-Exemplo-16p.pdf', { type: 'application/pdf' });

      setFile(sampleFile);
      setFileBuffer(cleanBytes);
      setOriginalPageCount(16);
      setErrorMessage(null);
    } catch (err: any) {
      console.warn('Sample generation note:', err);
      setErrorMessage('Erro ao carregar documento de exemplo: ' + (err?.message || ''));
    } finally {
      setIsProcessing(false);
      setStatusMessage('');
      try {
        if (typeof (window as any).gc === 'function') {
          (window as any).gc();
        }
      } catch (_) {}
    }
  };

  const handleClear = () => {
    setFile(null);
    setFileBuffer(null);
    setOriginalPageCount(0);
    setErrorMessage(null);
    try {
      if (typeof (window as any).gc === 'function') {
        (window as any).gc();
      }
    } catch (_) {}
  };

  // Instantaneous mathematical statistics calculation (0ms, 0MB RAM)
  const currentStats = originalPageCount > 0
    ? calculateImpositionStats(originalPageCount, config.preset, config.sheetsPerSignature, config.customSheetsCount)
    : null;

  // On-demand full PDF generation with strict RAM management for mobile safety
  const handleDownload = async () => {
    if (!fileBuffer || originalPageCount === 0 || isDownloading || isProcessing) return;

    let result: ImpositionResult | null = null;

    try {
      setIsDownloading(true);
      setDownloadProgress(0);
      setStatusMessage('Processando imposição gráfica e gerando PDF...');

      result = await createImposedPDF(fileBuffer, config, {
        onlyFirstSheet: false,
        onProgress: (p) => {
          setDownloadProgress(p.percent);
        },
      });

      const blob = new Blob([result.pdfBytes], { type: 'application/pdf' });
      
      // Immediately dereference the heavy result buffer to prevent mobile tab crash
      result = null;

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.style.display = 'none';
      link.href = url;

      const rawName = file?.name ? file.name.replace(/\.[^/.]+$/, '') : 'pocketbook';
      link.download = `${rawName}-imposto-${config.preset}.pdf`;

      document.body.appendChild(link);
      link.click();

      // Rapid cleanup of object URL
      setTimeout(() => {
        if (document.body.contains(link)) {
          document.body.removeChild(link);
        }
        URL.revokeObjectURL(url);
      }, 1000);

      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 3500);

      // Save history record if user is authenticated
      if (user && currentStats) {
        saveGeneration({
          fileName: file?.name || 'document.pdf',
          preset: config.preset,
          pageCount: originalPageCount,
          sheetsGenerated: currentStats.totalA4Sheets,
          signaturesCount: currentStats.signaturesCount,
          blankPagesCount: currentStats.blankPagesAdded,
        }).catch((err) => console.warn('History save note:', err));
      }
    } catch (err: any) {
      console.error('Download execution failed:', err);
      setErrorMessage('Erro ao gerar arquivo completo para download: ' + (err?.message || 'Memória insuficiente no dispositivo.'));
    } finally {
      result = null;
      setIsDownloading(false);
      setDownloadProgress(0);
      setStatusMessage('');

      // Force garbage collection if browser environment exposes window.gc
      try {
        if (typeof (window as any).gc === 'function') {
          (window as any).gc();
        }
      } catch (_) {}
    }
  };

  // High-resolution PNG export (3508 x 2480 px @ 300 DPI) for borderless printing
  const handleExportPngClick = () => {
    if (!fileBuffer || originalPageCount === 0 || isDownloading || isProcessing || isExportingPng) return;
    
    // Se for apenas 1 folha A4 (Frente e Verso = 2 imagens), baixa direto sem modal
    if (currentStats && currentStats.totalA4Sheets === 1) {
      executePngExport('individual');
    } else {
      // Se houver múltiplas folhas, abre o modal de seleção (ZIP ou Individuais)
      setIsPngModalOpen(true);
    }
  };

  const executePngExport = async (format: 'zip' | 'individual') => {
    if (!fileBuffer || originalPageCount === 0 || isExportingPng) return;

    setIsExportingPng(true);
    setPngProgress(0);
    setPngStatusMessage('Preparando matriz de imposição...');

    let result: ImpositionResult | null = null;
    try {
      // 1. Gera a imposição em PDF mantendo rigorosamente a matemática de cadernos
      result = await createImposedPDF(fileBuffer, config, {
        onlyFirstSheet: false,
        onProgress: (p) => {
          setPngProgress(Math.round(p.percent * 0.35));
          setPngStatusMessage(`Calculando imposição gráfica (${p.percent}%)...`);
        },
      });

      setPngStatusMessage('Renderizando folhas em 300 DPI (3508 × 2480 px)...');

      // 2. Renderiza cada folha A4 em Canvas a 300 DPI (3508 x 2480 px)
      const images = await renderImposedPdfToPngs(result.pdfBytes, (p) => {
        setPngProgress(35 + Math.round(p.percent * 0.55));
        setPngStatusMessage(p.statusText);
      });

      const rawName = file?.name ? file.name.replace(/\.[^/.]+$/, '') : 'pocketbook';

      // 3. Download conforme escolha do usuário
      if (format === 'zip') {
        setPngStatusMessage('Empacotando arquivo ZIP...');
        setPngProgress(92);
        await downloadPngsAsZip(images, `${rawName}-imposto-${config.preset}`, (zipPct) => {
          setPngProgress(92 + Math.round(zipPct * 0.08));
        });
      } else {
        setPngStatusMessage('Disparando download dos arquivos PNG...');
        setPngProgress(95);
        await downloadPngsIndividually(images);
      }

      setPngProgress(100);
      setPngSuccess(true);
      setTimeout(() => setPngSuccess(false), 4000);
      setIsPngModalOpen(false);

      // Salva histórico caso o usuário esteja autenticado
      if (user && currentStats) {
        saveGeneration({
          fileName: file?.name || 'document.pdf',
          preset: config.preset,
          pageCount: originalPageCount,
          sheetsGenerated: currentStats.totalA4Sheets,
          signaturesCount: currentStats.signaturesCount,
          blankPagesCount: currentStats.blankPagesAdded,
        }).catch((err) => console.warn('History save note:', err));
      }
    } catch (err: any) {
      console.error('PNG export failed:', err);
      setErrorMessage('Erro ao exportar folhas em PNG: ' + (err?.message || 'Falha ao processar imagens em alta resolução.'));
      setIsPngModalOpen(false);
    } finally {
      result = null;
      setIsExportingPng(false);
      setPngProgress(0);
      setPngStatusMessage('');

      try {
        if (typeof (window as any).gc === 'function') {
          (window as any).gc();
        }
      } catch (_) {}
    }
  };

  return (
    <div className="min-h-screen bg-[#FBFBFE] text-gray-900 selection:bg-indigo-100 selection:text-indigo-900 font-sans">
      <Header totalCount={totalStats} user={user} login={login} logout={logout} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        
        {/* Error Alert Banner */}
        <AnimatePresence>
          {errorMessage && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-6 p-4 bg-rose-50/90 border border-rose-200 rounded-2xl flex items-start justify-between gap-3 shadow-xs"
            >
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 mt-0.5">
                  <AlertCircle size={18} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-rose-900 uppercase tracking-wider">Aviso de Leitura do PDF</h4>
                  <p className="text-xs text-rose-800 mt-0.5 leading-relaxed">{errorMessage}</p>
                  <div className="mt-2.5 flex items-center gap-3">
                    <button
                      onClick={() => {
                        setErrorMessage(null);
                        handleLoadSample();
                      }}
                      className="text-xs font-bold text-rose-900 bg-rose-200/70 hover:bg-rose-200 px-3 py-1 rounded-lg transition-colors"
                    >
                      Carregar Exemplo de Teste (16 Págs)
                    </button>
                    <button
                      onClick={() => setErrorMessage(null)}
                      className="text-xs font-medium text-rose-700 hover:text-rose-900 underline"
                    >
                      Fechar
                    </button>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setErrorMessage(null)}
                className="text-rose-400 hover:text-rose-700 p-1 rounded-lg transition-colors"
              >
                <X size={16} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Quick Sample Action Bar for fast testing */}
        {!file && (
          <div className="mb-8 p-4 bg-gradient-to-r from-indigo-50/80 via-white to-purple-50/80 rounded-2xl border border-indigo-100/80 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
            <div className="flex items-center gap-3 text-center sm:text-left">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                <Sparkles size={20} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900">Quer testar sem ter um arquivo PDF em mãos?</h3>
                <p className="text-xs text-gray-500">
                  Gere instantaneamente um documento de 16 páginas para ver a imposição de cadernos em ação.
                </p>
              </div>
            </div>
            <button
              onClick={handleLoadSample}
              disabled={isProcessing}
              className="w-full sm:w-auto px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl shadow-sm hover:bg-indigo-700 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              {isProcessing ? <Loader2 size={15} className="animate-spin" /> : <FileCheck size={15} />}
              Carregar Exemplo (16 Páginas)
            </button>
          </div>
        )}

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">
          
          {/* Left Column: Upload & Configurations */}
          <div className="lg:col-span-5 space-y-8">
            
            {/* Step 1: File Upload */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                  1. Arquivo de Origem
                </h2>
                {file && (
                  <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                    {originalPageCount} páginas lidas
                  </span>
                )}
              </div>
              <Dropzone 
                onFileSelect={handleFileSelect} 
                selectedFile={file} 
                onClear={handleClear} 
                onError={(msg) => setErrorMessage(msg)}
              />
            </section>

            {/* Step 2: Imposition & Signatures Config */}
            <AnimatePresence>
              {file && (
                <motion.section
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-200/90 shadow-xs space-y-6"
                >
                  <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                    2. Imposição & Costura Copta
                  </h2>
                  <Configuration 
                    config={config} 
                    onChange={setConfig} 
                    pageCount={originalPageCount} 
                  />
                </motion.section>
              )}
            </AnimatePresence>

            {/* Recent History / Cloud persistence */}
            <section className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-200/80 shadow-xs">
              <History items={history} loading={statsLoading} />
            </section>

          </div>

          {/* Right Column: Stats Cards, Preview & Download */}
          <div className="lg:col-span-7 space-y-8">

            {/* Statistics Cards (Requested Feature) */}
            {currentStats && (
              <motion.section
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-3 sm:space-y-4"
              >
                {/* Resumo Dinâmico em Destaque */}
                <div className="bg-gradient-to-r from-indigo-50/90 via-purple-50/60 to-white border border-indigo-100 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                  <div className="flex items-start sm:items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5 sm:mt-0">
                      <Sparkles size={16} />
                    </div>
                    <div>
                      <p className="text-xs sm:text-sm font-bold text-gray-900 leading-tight">
                        Gerado{currentStats.signaturesCount > 1 ? 's' : ''} {currentStats.signatureDetailsSummary}
                      </p>
                      <p className="text-[11px] text-gray-500 font-medium mt-0.5">
                        Total de {currentStats.totalA4Sheets} folha{currentStats.totalA4Sheets > 1 ? 's' : ''} A4 | {currentStats.blankPagesAdded === 0 ? '0 páginas em branco adicionadas' : `${currentStats.blankPagesAdded} página${currentStats.blankPagesAdded > 1 ? 's' : ''} em branco adicionada${currentStats.blankPagesAdded > 1 ? 's' : ''}`}
                      </p>
                    </div>
                  </div>

                  {/* Pílulas com o número REAL de folhas A4 de cada caderno */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1 sm:pt-0">
                    {currentStats.signatureSheets.map((sheets, idx) => {
                      const pCount = sheets * (currentStats.totalPagesWithBlanks / currentStats.totalA4Sheets);
                      return (
                        <span 
                          key={idx}
                          className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-white border border-indigo-200/80 text-indigo-950 shadow-2xs whitespace-nowrap"
                        >
                          Caderno {idx + 1}: {sheets} {sheets === 1 ? 'folha' : 'folhas'} A4 ({pCount} págs)
                        </span>
                      );
                    })}
                  </div>
                </div>

                {/* 3 Grid Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                  {/* Total de Páginas */}
                  <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-xs">
                    <div className="flex items-center gap-2 text-indigo-600 mb-1.5">
                      <FileText size={18} />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Total de Páginas</span>
                    </div>
                    <p className="text-xl sm:text-2xl font-black text-gray-900 leading-none">
                      {currentStats.totalPagesWithBlanks}
                    </p>
                    <p className="text-[11px] text-gray-500 mt-1 font-medium truncate">
                      {currentStats.originalPages} originais + {currentStats.blankPagesAdded} brancas
                    </p>
                  </div>

                  {/* Quantidade de Cadernos */}
                  <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-xs">
                    <div className="flex items-center gap-2 text-purple-600 mb-1.5">
                      <Layers size={18} />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Cadernos Copta</span>
                    </div>
                    <p className="text-xl sm:text-2xl font-black text-gray-900 leading-none">
                      {currentStats.signaturesCount} <span className="text-sm font-bold text-gray-500">caderno{currentStats.signaturesCount > 1 ? 's' : ''}</span>
                    </p>
                    <p className="text-[11px] text-gray-500 mt-1 font-medium truncate">
                      {currentStats.signatureDetailsSummary}
                    </p>
                  </div>

                  {/* Páginas em Branco Adicionadas */}
                  <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-xs col-span-2 sm:col-span-1">
                    <div className="flex items-center gap-2 text-amber-600 mb-1.5">
                      <FilePlus2 size={18} />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Páginas em Branco</span>
                    </div>
                    <p className="text-xl sm:text-2xl font-black text-gray-900 leading-none">
                      {currentStats.blankPagesAdded}
                    </p>
                    <p className="text-[11px] text-gray-500 mt-1 font-medium truncate">
                      {currentStats.blankPagesAdded === 0 ? 'Múltiplo exato de folhas A4' : 'Apenas para fechar a última folha'}
                    </p>
                  </div>
                </div>
              </motion.section>
            )}

            {/* Interactive Preview Canvas */}
            <section className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-200/90 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-gray-100">
                <div>
                  <h2 className="text-lg sm:text-xl font-black text-gray-900 tracking-tight flex items-center gap-2.5">
                    Estrutura da Imposição
                    {(isProcessing || isDownloading) && <Loader2 className="animate-spin text-indigo-600" size={20} />}
                  </h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Preview matemático em tempo real com mapeamento das páginas e guias de corte/dobra
                  </p>
                </div>

                {/* Explicit Download / Process Buttons */}
                {fileBuffer && currentStats && (
                  <div className="flex flex-col items-start lg:items-end gap-2">
                    <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
                      {/* Botão de PDF Existente */}
                      <button 
                        id="btn-download-pdf"
                        type="button"
                        onClick={handleDownload}
                        disabled={isDownloading || isProcessing || isExportingPng}
                        className={`flex items-center gap-2 px-4 sm:px-5 py-3 rounded-xl font-bold text-xs sm:text-sm shadow-md transition-all active:scale-95 disabled:opacity-80 disabled:cursor-not-allowed ${
                          downloadSuccess 
                            ? 'bg-emerald-600 text-white shadow-emerald-200' 
                            : isDownloading
                            ? 'bg-indigo-700 text-white shadow-indigo-100'
                            : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200'
                        }`}
                      >
                        {downloadSuccess ? (
                          <>
                            <CheckCircle2 size={18} />
                            PDF Baixado!
                          </>
                        ) : isDownloading ? (
                          <>
                            <Loader2 size={18} className="animate-spin" />
                            Processando PDF ({downloadProgress}%)...
                          </>
                        ) : (
                          <>
                            <Download size={18} />
                            Baixar PDF Impresso ({currentStats.totalA4Sheets} Folhas A4)
                          </>
                        )}
                      </button>

                      {/* Botão Alternativo PNG (Sem Margem) */}
                      <button
                        id="btn-download-png"
                        type="button"
                        onClick={handleExportPngClick}
                        disabled={isDownloading || isProcessing || isExportingPng}
                        className={`flex items-center gap-2 px-4 sm:px-5 py-3 rounded-xl font-bold text-xs sm:text-sm border shadow-xs transition-all active:scale-95 disabled:opacity-80 disabled:cursor-not-allowed ${
                          pngSuccess
                            ? 'bg-emerald-600 border-emerald-600 text-white shadow-emerald-200'
                            : isExportingPng
                            ? 'bg-purple-700 border-purple-700 text-white shadow-purple-100'
                            : 'bg-white hover:bg-purple-50/70 border-purple-200 hover:border-purple-300 text-purple-800'
                        }`}
                      >
                        {pngSuccess ? (
                          <>
                            <CheckCircle2 size={18} />
                            PNG Baixado!
                          </>
                        ) : isExportingPng ? (
                          <>
                            <Loader2 size={18} className="animate-spin" />
                            Renderizando PNG ({pngProgress}%)...
                          </>
                        ) : (
                          <>
                            <ImageIcon size={18} className="text-purple-600" />
                            Baixar Folhas em PNG (Sem Margem)
                          </>
                        )}
                      </button>
                    </div>

                    {/* Aviso Sutil Solicitado */}
                    <p className="text-[11px] text-gray-500 flex items-center gap-1.5 font-medium">
                      <span className="text-amber-600 font-bold">Dica:</span> Use o formato PNG para ativar a opção 'Imprimir sem margem' nas configurações da sua impressora.
                    </p>
                  </div>
                )}
              </div>

              {/* Instruções Dinâmicas de Impressão (Duplex) conforme o modelo selecionado */}
              <PrintInstructionsAlert preset={config.preset} />

              {/* Zero-RAM CSS/HTML Structural Preview */}
              <Preview 
                config={config}
                stats={currentStats}
                onProcessPdf={handleDownload}
                isProcessing={isDownloading || isProcessing || isExportingPng}
              />
            </section>

            {/* Practical Craft Instructions */}
            <Instructions preset={config.preset} />

          </div>

        </div>
      </main>

      {/* Modal de Escolha de Formato PNG para Múltiplas Folhas */}
      <PngExportModal
        isOpen={isPngModalOpen}
        onClose={() => {
          if (!isExportingPng) {
            setIsPngModalOpen(false);
          }
        }}
        onSelectOption={(option) => executePngExport(option)}
        totalSheets={currentStats?.totalA4Sheets || 1}
        isExporting={isExportingPng}
        exportProgress={pngProgress}
        statusMessage={pngStatusMessage}
        preset={config.preset}
      />

      {/* Footer */}
      <footer className="border-t border-gray-200/80 py-10 mt-12 bg-white">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-2 text-indigo-600 mb-2">
            <Sparkles size={16} />
            <span className="text-[11px] font-black uppercase tracking-widest">Pocketbook Creator • 100% Client-Side</span>
          </div>
          <p className="text-xs text-gray-400 font-medium max-w-md mx-auto leading-relaxed">
            Manipulação local de PDF em alta precisão para encadernação artística, livretos e costura copta. Seus arquivos nunca saem do seu dispositivo.
          </p>
        </div>
      </footer>
    </div>
  );
}
