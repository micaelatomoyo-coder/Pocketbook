
import React from 'react';
import { ImpositionPreset, ImpositionConfig, SignatureSetting } from '../types';
import { LayoutGrid, Book, Columns, Check, Info, Scissors, Minimize2, Bookmark } from 'lucide-react';
import { motion } from 'motion/react';
import { getPagesPerSheet, calculateImpositionStats } from '../lib/imposition';

interface ConfigurationProps {
  config: ImpositionConfig;
  onChange: (config: ImpositionConfig) => void;
  pageCount: number;
}

export function Configuration({ config, onChange, pageCount }: ConfigurationProps) {
  const presets: { id: ImpositionPreset; name: string; desc: string; icon: any; mult: number; tag: string }[] = [
    { 
      id: 'pocketbook-a6', 
      name: 'Pocketbook A6', 
      desc: '8 páginas por folha A4. Corte ao meio e dobra vertical (Cadernos A6).', 
      icon: LayoutGrid,
      mult: 8,
      tag: 'Mais Popular'
    },
    { 
      id: 'mini-pocket-a7', 
      name: 'Mini Pocket A7', 
      desc: '16 páginas por folha A4. 4 tiras dobradas em cadernos compactos A7.', 
      icon: Minimize2,
      mult: 16,
      tag: 'Ultra Compacto'
    },
    { 
      id: 'booklet-a5', 
      name: 'Livreto A5', 
      desc: '4 páginas por folha A4. Dobra central simples em A5.', 
      icon: Book,
      mult: 4,
      tag: 'Dobra Simples'
    },
    { 
      id: 'cut-stack', 
      name: 'Cut & Stack', 
      desc: '8 páginas por folha A4. Corte reto em 4 pilhas para blocos sem dobra.', 
      icon: Scissors,
      mult: 8,
      tag: 'Sem Dobra'
    },
  ];

  const signatureOptions: { id: SignatureSetting; label: string; sub: string }[] = [
    { id: 'single', label: 'Bloco Único', sub: 'Todas as folhas em 1 caderno' },
    { id: 3, label: '3 Folhas (Máx)', sub: 'Cadernos finos e maleáveis' },
    { id: 4, label: '4 Folhas (Máx)', sub: 'Espessura equilibrada' },
    { id: 5, label: '5 Folhas (Máx)', sub: 'Costura copta clássica' },
    { id: 'custom', label: 'Personalizado', sub: 'Definir capacidade máxima' },
  ];

  const isCustom = typeof config.sheetsPerSignature === 'number' && ![3, 4, 5].includes(config.sheetsPerSignature);
  const activeSigOption: SignatureSetting = isCustom ? 'custom' : config.sheetsPerSignature;

  const pagesPerSheet = getPagesPerSheet(config.preset);
  const stats = calculateImpositionStats(
    pageCount, 
    config.preset, 
    config.sheetsPerSignature, 
    config.customSheetsCount
  );
  const sigCount = stats.signaturesCount;
  const blanks = stats.blankPagesAdded;

  return (
    <div className="space-y-8">
      {/* Imposition Presets */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">1. Formato de Imposição</h3>
          <span className="text-[11px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
            {pagesPerSheet} págs / folha A4
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {presets.map((preset) => (
            <button
              key={preset.id}
              onClick={() => onChange({ ...config, preset: preset.id })}
              className={`relative flex items-start gap-3 p-3.5 rounded-xl border-2 transition-all text-left ${
                config.preset === preset.id 
                  ? 'border-indigo-600 bg-indigo-50/40 shadow-sm' 
                  : 'border-gray-100 hover:border-gray-200 bg-white'
              }`}
            >
              <div className={`mt-0.5 p-2 rounded-lg shrink-0 ${
                config.preset === preset.id ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500'
              }`}>
                <preset.icon size={18} />
              </div>
              <div className="flex-1 pr-6">
                <div className="flex items-center gap-1.5">
                  <h4 className={`text-sm font-bold leading-none ${config.preset === preset.id ? 'text-indigo-950' : 'text-gray-900'}`}>
                    {preset.name}
                  </h4>
                </div>
                <span className="inline-block text-[10px] font-semibold text-indigo-600/80 uppercase tracking-wider mt-1">
                  {preset.tag}
                </span>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">{preset.desc}</p>
              </div>
              {config.preset === preset.id && (
                <div className="absolute top-3.5 right-3 text-indigo-600">
                  <Check size={18} strokeWidth={3} />
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Coptic Stitch Signatures (Cadernos) */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            <Bookmark size={15} className="text-indigo-600" />
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">2. Folhas A4 por Caderno (Costura Copta)</h3>
          </div>
          <span className="text-[11px] font-semibold text-gray-500">
            {sigCount} caderno{sigCount > 1 ? 's' : ''} resultante{sigCount > 1 ? 's' : ''}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {signatureOptions.map((opt) => {
            const isSelected = activeSigOption === opt.id;
            return (
              <button
                key={String(opt.id)}
                onClick={() => {
                  if (opt.id === 'custom') {
                    onChange({ ...config, sheetsPerSignature: config.customSheetsCount || 4 });
                  } else {
                    onChange({ ...config, sheetsPerSignature: opt.id });
                  }
                }}
                className={`p-3 rounded-xl border text-left transition-all ${
                  isSelected 
                    ? 'border-indigo-600 bg-indigo-600 text-white shadow-sm' 
                    : 'border-gray-200 hover:border-gray-300 bg-white text-gray-800'
                }`}
              >
                <p className={`text-xs font-bold leading-none ${isSelected ? 'text-white' : 'text-gray-900'}`}>
                  {opt.label}
                </p>
                <p className={`text-[10px] mt-1 line-clamp-1 ${isSelected ? 'text-indigo-100' : 'text-gray-400'}`}>
                  {opt.sub}
                </p>
              </button>
            );
          })}
        </div>

        {/* Custom sheets slider / number input if custom */}
        {activeSigOption === 'custom' && (
          <div className="mt-3 p-3 bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-between">
            <span className="text-xs font-medium text-gray-700">Folhas personalizadas por caderno:</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={20}
                value={typeof config.sheetsPerSignature === 'number' ? config.sheetsPerSignature : (config.customSheetsCount || 4)}
                onChange={(e) => {
                  const val = Math.max(1, Math.min(20, parseInt(e.target.value) || 1));
                  onChange({ ...config, sheetsPerSignature: val, customSheetsCount: val });
                }}
                className="w-16 px-2.5 py-1 text-center font-bold text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <span className="text-xs font-semibold text-gray-500">folhas</span>
            </div>
          </div>
        )}

        <p className="text-[11px] text-gray-400 mt-2 leading-relaxed">
          * A matemática de imposição reseta o ciclo para cada caderno de forma independente. No final de cada caderno, as folhas dobram-se juntas sem desalinhar a leitura.
        </p>
      </div>

      {/* Printing & Finishing Guides */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">3. Guias de Acabamento</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <label className="flex items-center justify-between p-3 rounded-xl border border-gray-200 bg-white cursor-pointer select-none hover:border-gray-300 transition-colors">
            <div className="flex flex-col">
              <span className="text-xs font-bold text-gray-900">Marcas de Corte</span>
              <span className="text-[10px] text-gray-400 font-medium">Linhas sólidas nos centros</span>
            </div>
            <input 
              type="checkbox" 
              checked={config.addCropMarks} 
              onChange={(e) => onChange({ ...config, addCropMarks: e.target.checked })}
              className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500" 
            />
          </label>

          <label className="flex items-center justify-between p-3 rounded-xl border border-gray-200 bg-white cursor-pointer select-none hover:border-gray-300 transition-colors">
            <div className="flex flex-col">
              <span className="text-xs font-bold text-gray-900">Guias de Dobra</span>
              <span className="text-[10px] text-gray-400 font-medium">Linhas pontilhadas centrais</span>
            </div>
            <input 
              type="checkbox" 
              checked={config.addFoldGuides} 
              onChange={(e) => onChange({ ...config, addFoldGuides: e.target.checked })}
              className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500" 
            />
          </label>

          <label className="flex items-center justify-between p-3 rounded-xl border border-gray-200 bg-white cursor-pointer select-none hover:border-gray-300 transition-colors sm:col-span-2">
            <div className="flex flex-col">
              <span className="text-xs font-bold text-gray-900">Identificador de Caderno no Rodapé (Slug)</span>
              <span className="text-[10px] text-gray-400 font-medium">Ex: "CADERNO 1/3 | FOLHA 1/4 (Frente)" para não misturar</span>
            </div>
            <input 
              type="checkbox" 
              checked={config.addSignatureLabels} 
              onChange={(e) => onChange({ ...config, addSignatureLabels: e.target.checked })}
              className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500" 
            />
          </label>
        </div>

        {blanks > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex gap-3 p-3.5 bg-amber-50/70 rounded-xl border border-amber-200/80"
          >
            <div className="text-amber-600 shrink-0 mt-0.5">
              <Info size={18} />
            </div>
            <div>
              <p className="text-xs font-bold text-amber-900">Fechamento da Última Folha A4</p>
              <p className="text-xs text-amber-800/90 mt-0.5 leading-relaxed">
                Adicionadas <strong>{blanks} página{blanks > 1 ? 's' : ''} em branco</strong> apenas para completar a última folha A4 ({pagesPerSheet} págs/folha). O restante dos cadernos não recebe páginas extras.
              </p>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
