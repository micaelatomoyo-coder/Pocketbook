import { useState, FC, Key } from 'react';
import { ImpositionConfig, ImpositionStats } from '../types';
import { getStructuralSheetLayout, StructuralSlot } from '../lib/imposition';
import { 
  Scissors, 
  BookOpen, 
  ChevronLeft, 
  ChevronRight, 
  Layers, 
  Sparkles,
  Info,
  Maximize2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface PreviewProps {
  config: ImpositionConfig;
  stats: ImpositionStats | null;
  onProcessPdf?: () => void;
  isProcessing?: boolean;
}

export function Preview({ config, stats, onProcessPdf, isProcessing }: PreviewProps) {
  const [activeSide, setActiveSide] = useState<'both' | 'front' | 'back'>('both');
  const [selectedSheetIndex, setSelectedSheetIndex] = useState<number>(0);

  if (!stats || stats.originalPages === 0) {
    return (
      <div className="w-full aspect-[1.414/1] max-h-[460px] bg-gray-50/50 rounded-2xl flex flex-col items-center justify-center border-2 border-dashed border-gray-200 p-8 text-center">
        <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4 shadow-2xs">
          <Layers size={28} />
        </div>
        <h4 className="text-sm font-bold text-gray-800">Aguardando PDF</h4>
        <p className="text-xs text-gray-400 max-w-sm mt-1 leading-relaxed">
          Envie um arquivo PDF ou clique em "Carregar Exemplo" para visualizar a estrutura matemática da Folha 1 (Frente e Verso).
        </p>
      </div>
    );
  }

  const totalSheets = Math.max(1, stats.totalA4Sheets);
  const currentSheetIdx = Math.max(0, Math.min(selectedSheetIndex, totalSheets - 1));
  const layout = getStructuralSheetLayout(config, stats, currentSheetIdx);

  const handlePrevSheet = () => {
    setSelectedSheetIndex((prev) => Math.max(0, prev - 1));
  };

  const handleNextSheet = () => {
    setSelectedSheetIndex((prev) => Math.min(totalSheets - 1, prev + 1));
  };

  return (
    <div className="space-y-4">
      {/* Barra de Controles do Preview Ultraleve */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 bg-gray-50/90 p-2 sm:p-2.5 rounded-xl border border-gray-200 shadow-2xs">
        {/* Alternador de Vista (Lado a Lado / Frente / Verso) */}
        <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-gray-200/80 shadow-2xs">
          <button
            type="button"
            onClick={() => setActiveSide('both')}
            className={`px-2.5 py-1.5 rounded-md text-xs font-bold transition-all ${
              activeSide === 'both' ? 'bg-indigo-600 text-white shadow-xs' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Lado a Lado
          </button>
          <button
            type="button"
            onClick={() => setActiveSide('front')}
            className={`px-2.5 py-1.5 rounded-md text-xs font-bold transition-all ${
              activeSide === 'front' ? 'bg-indigo-600 text-white shadow-xs' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Frente
          </button>
          <button
            type="button"
            onClick={() => setActiveSide('back')}
            className={`px-2.5 py-1.5 rounded-md text-xs font-bold transition-all ${
              activeSide === 'back' ? 'bg-indigo-600 text-white shadow-xs' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Verso
          </button>
        </div>

        {/* Navegador de Folhas A4 */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-lg border border-gray-200/80 shadow-2xs">
            <button
              type="button"
              onClick={handlePrevSheet}
              disabled={currentSheetIdx === 0}
              className="p-1 rounded-md text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:pointer-events-none transition-colors"
              title="Folha anterior"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs font-bold text-gray-800 px-1 whitespace-nowrap">
              Folha {layout.globalSheetNumber} / {layout.totalA4Sheets}
            </span>
            <button
              type="button"
              onClick={handleNextSheet}
              disabled={currentSheetIdx >= totalSheets - 1}
              className="p-1 rounded-md text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:pointer-events-none transition-colors"
              title="Próxima folha"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <span className="hidden sm:inline-block text-[11px] font-semibold text-indigo-900/80 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100">
            Caderno {layout.sigNumber}/{layout.totalSignatures} (Folha {layout.sheetNumberInSig}/{layout.sheetsInSig})
          </span>
        </div>
      </div>

      {/* Grid de Representação das Folhas A4 (Frente e/ou Verso) */}
      <div
        className={`grid gap-4 ${
          activeSide === 'both' ? 'grid-cols-1 xl:grid-cols-2' : 'grid-cols-1'
        }`}
      >
        {/* Folha Frente */}
        {(activeSide === 'both' || activeSide === 'front') && (
          <SheetCard
            title={`Folha ${layout.globalSheetNumber} - Frente`}
            slugText={`CADERNO ${layout.sigNumber}/${layout.totalSignatures} | FOLHA ${layout.sheetNumberInSig}/${layout.sheetsInSig} (Frente)`}
            layout={layout}
            slots={layout.frontSlots}
            side="Frente"
          />
        )}

        {/* Folha Verso */}
        {(activeSide === 'both' || activeSide === 'back') && (
          <SheetCard
            title={`Folha ${layout.globalSheetNumber} - Verso`}
            slugText={`CADERNO ${layout.sigNumber}/${layout.totalSignatures} | FOLHA ${layout.sheetNumberInSig}/${layout.sheetsInSig} (Verso)`}
            layout={layout}
            slots={layout.backSlots}
            side="Verso"
          />
        )}
      </div>

      {/* Legenda de Produção Gráfica */}
      <div className="bg-white p-3.5 rounded-xl border border-gray-200/80 text-xs text-gray-600 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-0.5 border-t-2 border-dashed border-rose-500 inline-block" />
            <span className="text-[11px] font-semibold text-gray-700 flex items-center gap-1">
              <Scissors size={12} className="text-rose-600" /> Linha de Corte
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-0.5 border-t-2 border-dashed border-indigo-500 inline-block" />
            <span className="text-[11px] font-semibold text-gray-700 flex items-center gap-1">
              <BookOpen size={12} className="text-indigo-600" /> Linha de Dobra
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-amber-100 border border-amber-300 inline-block" />
            <span className="text-[11px] font-semibold text-gray-700">Página em Branco (Fechamento)</span>
          </div>
        </div>

        <div className="text-[11px] text-gray-400 font-medium">
          Estrutura HTML/CSS ultraleve • 0MB de memória • Imune a crash
        </div>
      </div>
    </div>
  );
}

interface SheetCardProps {
  title: string;
  slugText: string;
  layout: ReturnType<typeof getStructuralSheetLayout>;
  slots: StructuralSlot[];
  side: 'Frente' | 'Verso';
}

function SheetCard({ title, slugText, layout, slots, side }: SheetCardProps) {
  const isA5 = layout.gridRows === 1 && layout.gridCols === 2;
  const isA7 = layout.gridCols === 4;
  const isPortrait = layout.orientation === 'portrait';

  return (
    <div className="bg-white rounded-2xl border border-gray-200/90 p-3 sm:p-4 shadow-xs">
      {/* Título do Card */}
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              side === 'Frente' ? 'bg-indigo-600' : 'bg-purple-600'
            }`}
          />
          <h5 className="text-xs font-bold text-gray-900 tracking-wide">{title}</h5>
        </div>
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
          {isPortrait ? 'A4 Retrato (210 × 297 mm)' : 'A4 Paisagem (297 × 210 mm)'}
        </span>
      </div>

      {/* Simulação da Folha A4 em Retrato ou Paisagem */}
      <div className={`relative w-full ${
        isPortrait ? 'aspect-[1/1.414]' : 'aspect-[1.414/1]'
      } bg-slate-50 rounded-xl border border-gray-300/80 p-2.5 flex flex-col justify-between overflow-hidden shadow-inner`}>
        {/* Carimbo de Margem (Slug Header) */}
        <div className="w-full flex items-center justify-between pb-1.5 border-b border-gray-200/60 select-none">
          <span className="text-[9px] sm:text-[10px] font-mono font-bold text-gray-500 truncate">
            {slugText}
          </span>
          <span className="text-[8px] sm:text-[9px] font-mono font-medium text-gray-400 shrink-0">
            Pocketbook Creator
          </span>
        </div>

        {/* Grade de Páginas Impostas */}
        <div className="relative flex-1 w-full mt-1.5">
          <div
            className={`w-full h-full grid gap-1.5 sm:gap-2 ${
              isA5
                ? 'grid-cols-2 grid-rows-1'
                : isA7
                ? 'grid-cols-4 grid-rows-2'
                : 'grid-cols-2 grid-rows-2'
            }`}
          >
            {slots.map((slot, idx) => (
              <SlotCard key={idx} slot={slot} />
            ))}
          </div>

          {/* Guias Visuais Sobrepostas */}
          {/* Linha de Corte Horizontal (se houver) */}
          {layout.hasHorizontalCut && (
            <div className="absolute top-1/2 left-0 right-0 -translate-y-1/2 pointer-events-none flex items-center justify-center">
              <div className="w-full border-t border-dashed border-rose-500/80" />
              <div className="absolute bg-rose-500 text-white rounded-full p-0.5 shadow-2xs">
                <Scissors size={10} />
              </div>
            </div>
          )}

          {/* Linha de Dobra Vertical Central (A5 ou A6) */}
          {layout.hasVerticalFold && !isA7 && (
            <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 pointer-events-none flex flex-col items-center justify-center">
              <div className="h-full border-l border-dashed border-indigo-500/80" />
              <div className="absolute bg-indigo-600 text-white rounded-full p-0.5 shadow-2xs">
                <BookOpen size={10} />
              </div>
            </div>
          )}

          {/* Cortes e Dobras no A7 (4 colunas) */}
          {isA7 && (
            <>
              {/* Corte vertical no centro (entre col 1 e 2) */}
              <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 pointer-events-none flex flex-col items-center justify-center">
                <div className="h-full border-l border-dashed border-rose-500/80" />
                <div className="absolute bg-rose-500 text-white rounded-full p-0.5 shadow-2xs">
                  <Scissors size={10} />
                </div>
              </div>
              {/* Dobras verticais (entre col 0 e 1, e entre col 2 e 3) */}
              <div className="absolute top-0 bottom-0 left-1/4 -translate-x-1/2 pointer-events-none">
                <div className="h-full border-l border-dashed border-indigo-400/80" />
              </div>
              <div className="absolute top-0 bottom-0 left-3/4 -translate-x-1/2 pointer-events-none">
                <div className="h-full border-l border-dashed border-indigo-400/80" />
              </div>
            </>
          )}

          {/* Corte Vertical no Cut & Stack */}
          {layout.hasVerticalCut && !isA7 && (
            <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 pointer-events-none flex flex-col items-center justify-center">
              <div className="h-full border-l border-dashed border-rose-500/80" />
              <div className="absolute bg-rose-500 text-white rounded-full p-0.5 shadow-2xs">
                <Scissors size={10} />
              </div>
            </div>
          )}
        </div>

        {/* Rodapé da Folha com Marcações */}
        <div className="w-full flex items-center justify-between pt-1 border-t border-gray-200/50 text-[8px] sm:text-[9px] text-gray-400 font-mono">
          <span>Margem de Sangria: 0mm</span>
          <span>Orientação: {isPortrait ? 'Retrato (Vertical)' : 'Paisagem (Horizontal)'}</span>
        </div>
      </div>
    </div>
  );
}

interface SlotCardProps {
  slot: StructuralSlot;
  key?: Key;
}

function SlotCard({ slot }: SlotCardProps) {
  if (slot.isBlank) {
    return (
      <div className="relative w-full h-full bg-amber-50/70 border-2 border-dashed border-amber-300/80 rounded-lg flex flex-col items-center justify-center p-1 sm:p-2 text-center overflow-hidden">
        <span className="text-[10px] sm:text-xs font-black text-amber-800/90 tracking-wide uppercase">
          Em Branco
        </span>
        <span className="text-[8px] sm:text-[10px] text-amber-700/80 font-medium leading-tight mt-0.5">
          Fechamento da Folha
        </span>
      </div>
    );
  }

  const isCover = slot.pageIndex === 0;

  return (
    <div
      className={`relative w-full h-full rounded-lg border p-1 sm:p-2 flex flex-col justify-between overflow-hidden transition-all shadow-2xs ${
        isCover
          ? 'bg-gradient-to-br from-indigo-50 via-white to-purple-50 border-indigo-300 ring-1 ring-indigo-200'
          : 'bg-white border-gray-200 hover:border-gray-300'
      }`}
    >
      {/* Top Header do Slot: Número da Página */}
      <div className="flex items-start justify-between">
        <span
          className={`text-xs sm:text-sm font-black leading-none ${
            isCover ? 'text-indigo-700' : 'text-gray-900'
          }`}
        >
          {slot.label}
        </span>
        <span className="text-[8px] sm:text-[9px] font-bold text-gray-400 leading-none">
          ▲
        </span>
      </div>

      {/* Role / Função da Página */}
      <div className="mt-auto pt-1">
        <span
          className={`block text-[8px] sm:text-[9px] font-semibold leading-tight truncate px-1 py-0.5 rounded-sm ${
            isCover
              ? 'bg-indigo-100 text-indigo-800 font-bold'
              : 'text-gray-500 bg-gray-100/80'
          }`}
        >
          {slot.role}
        </span>
      </div>
    </div>
  );
}
