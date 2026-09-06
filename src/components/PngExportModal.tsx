import { FC } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileArchive, 
  Image as ImageIcon, 
  X, 
  Printer, 
  Check, 
  Sparkles,
  Info
} from 'lucide-react';

interface PngExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectOption: (option: 'zip' | 'individual') => void;
  totalSheets: number;
  isExporting: boolean;
  exportProgress: number;
  statusMessage: string;
}

export const PngExportModal: FC<PngExportModalProps> = ({
  isOpen,
  onClose,
  onSelectOption,
  totalSheets,
  isExporting,
  exportProgress,
  statusMessage,
}) => {
  if (!isOpen) return null;

  const totalImages = totalSheets * 2;

  return (
    <AnimatePresence>
      <div 
        id="png-export-modal-backdrop"
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-xs overflow-y-auto"
        onClick={(e) => {
          if (e.target === e.currentTarget && !isExporting) {
            onClose();
          }
        }}
      >
        <motion.div
          id="png-export-modal-container"
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2 }}
          className="bg-white rounded-3xl p-6 sm:p-7 max-w-lg w-full border border-gray-100 shadow-2xl space-y-5 my-8"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center shadow-md shrink-0">
                <ImageIcon size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base sm:text-lg font-black text-gray-900 leading-tight">
                    Exportar Folhas em PNG
                  </h3>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                    300 DPI
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5 font-medium">
                  3508 × 2480 px (A4 Paisagem) para impressão sem margem
                </p>
              </div>
            </div>

            {!isExporting && (
              <button
                id="btn-close-png-modal"
                type="button"
                onClick={onClose}
                className="text-gray-400 hover:text-gray-700 p-1.5 rounded-xl hover:bg-gray-100 transition-colors"
                title="Fechar"
              >
                <X size={18} />
              </button>
            )}
          </div>

          {/* Resumo do Documento */}
          <div className="p-3.5 bg-indigo-50/70 border border-indigo-100 rounded-2xl flex items-center justify-between text-xs">
            <span className="text-gray-600 font-medium">
              Total a renderizar:
            </span>
            <span className="font-bold text-indigo-950">
              {totalSheets} {totalSheets === 1 ? 'folha A4' : 'folhas A4'} ({totalImages} imagens: Frente e Verso)
            </span>
          </div>

          {/* Estado de Progresso ou Seleção de Opção */}
          {isExporting ? (
            <div className="space-y-4 py-4 text-center">
              <div className="w-12 h-12 mx-auto rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center animate-pulse">
                <Printer size={24} className="animate-bounce" />
              </div>

              <div>
                <p className="text-sm font-bold text-gray-900">
                  {statusMessage || 'Renderizando imagens em 300 DPI...'}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Processando com dimensões de 3508 × 2480 pixels
                </p>
              </div>

              <div className="space-y-1.5">
                <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-indigo-600 to-purple-600 h-full rounded-full transition-all duration-300"
                    style={{ width: `${exportProgress}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] font-semibold text-gray-500">
                  <span>Progresso</span>
                  <span>{exportProgress}%</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-gray-600 font-medium">
                Como você deseja efetuar o download dos arquivos?
              </p>

              {/* Opção 1: Pacote ZIP (Recomendado) */}
              <button
                id="btn-option-zip"
                type="button"
                onClick={() => onSelectOption('zip')}
                className="w-full text-left p-4 rounded-2xl border-2 border-indigo-200/80 hover:border-indigo-600 bg-white hover:bg-indigo-50/40 transition-all group flex items-start gap-3.5 shadow-2xs hover:shadow-sm"
              >
                <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform mt-0.5">
                  <FileArchive size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-gray-900 group-hover:text-indigo-950">
                      Compactado em Arquivo ZIP
                    </h4>
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200">
                      Recomendado
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                    Baixa um único arquivo <code className="font-mono text-indigo-900 bg-indigo-100/60 px-1 py-0.5 rounded">.zip</code> com todas as {totalImages} folhas nomeadas em ordem.
                  </p>
                </div>
              </button>

              {/* Opção 2: Imagens Individuais */}
              <button
                id="btn-option-individual"
                type="button"
                onClick={() => onSelectOption('individual')}
                className="w-full text-left p-4 rounded-2xl border border-gray-200 hover:border-gray-400 bg-white hover:bg-gray-50/60 transition-all group flex items-start gap-3.5 shadow-2xs hover:shadow-sm"
              >
                <div className="w-9 h-9 rounded-xl bg-gray-100 text-gray-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform mt-0.5">
                  <ImageIcon size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-bold text-gray-900 group-hover:text-gray-950">
                    Baixar Imagens Individuais
                  </h4>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                    Dispara o download direto de cada folha separadamente (<code className="font-mono text-gray-700 bg-gray-100 px-1 py-0.5 rounded">folha1_frente.png</code>, <code className="font-mono text-gray-700 bg-gray-100 px-1 py-0.5 rounded">folha1_verso.png</code>, etc.).
                  </p>
                </div>
              </button>
            </div>
          )}

          {/* Dica de Impressão Sem Margem Solicitada */}
          <div className="p-3 bg-amber-50/80 border border-amber-200/90 rounded-2xl flex items-start gap-2.5 text-xs text-amber-900">
            <Info size={16} className="text-amber-600 shrink-0 mt-0.5" />
            <p className="leading-relaxed text-[11.5px]">
              <span className="font-bold">Dica:</span> Use o formato PNG para ativar a opção <strong>"Imprimir sem margem"</strong> nas configurações da sua impressora.
            </p>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
