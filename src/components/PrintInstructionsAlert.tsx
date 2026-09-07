import React from 'react';
import { ImpositionPreset } from '../types';
import { Printer, Info, Compass, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';

interface PrintInstructionsAlertProps {
  preset: ImpositionPreset;
  className?: string;
}

export function PrintInstructionsAlert({ preset, className = '' }: PrintInstructionsAlertProps) {
  const isA6 = preset === 'pocketbook-a6';

  return (
    <motion.div
      key={preset}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      id="print-instructions-card"
      className={`rounded-2xl p-4 sm:p-4.5 border transition-colors shadow-xs ${
        isA6
          ? 'bg-amber-50/95 border-amber-200/90 text-amber-950'
          : 'bg-sky-50/95 border-sky-200/90 text-sky-950'
      } ${className}`}
    >
      <div className="flex items-start gap-3 sm:gap-3.5">
        {/* Ícone de Impressora destacado */}
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-2xs mt-0.5 ${
            isA6
              ? 'bg-amber-100 text-amber-800 border border-amber-300/60'
              : 'bg-sky-100 text-sky-800 border border-sky-300/60'
          }`}
        >
          <Printer size={20} className="stroke-[2.2]" />
        </div>

        {/* Conteúdo dinâmico das instruções */}
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span
              className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${
                isA6
                  ? 'bg-amber-200/80 text-amber-900 border border-amber-300/50'
                  : 'bg-sky-200/80 text-sky-900 border border-sky-300/50'
              }`}
            >
              {isA6 ? 'Instrução para A4 Vertical' : 'Instrução para A4 Horizontal'}
            </span>

            <span className="text-[11px] font-semibold text-gray-500 flex items-center gap-1">
              <Compass size={12} className={isA6 ? 'text-amber-700' : 'text-sky-700'} />
              {isA6 ? 'Orientação Retrato' : 'Orientação Paisagem'}
            </span>
          </div>

          {/* Aviso principal obrigatório */}
          <div className="text-xs sm:text-[13px] font-bold leading-snug">
            {isA6 ? (
              <p>
                Para o formato A6, configure a sua impressora na opção:{' '}
                <span className="underline decoration-amber-500 decoration-2 font-black text-amber-900 bg-amber-200/60 px-1 py-0.5 rounded">
                  Frente e Verso → Margem Longa
                </span>
                .
              </p>
            ) : (
              <p>
                Para este formato, configure a sua impressora na opção:{' '}
                <span className="underline decoration-sky-500 decoration-2 font-black text-sky-900 bg-sky-200/60 px-1 py-0.5 rounded">
                  Frente e Verso → Margem Curta
                </span>
                .
              </p>
            )}
          </div>

          {/* Dica secundária */}
          <div
            className={`text-xs flex items-start gap-1.5 pt-0.5 ${
              isA6 ? 'text-amber-800' : 'text-sky-800'
            }`}
          >
            <Info size={14} className="shrink-0 mt-0.5 opacity-80" />
            {isA6 ? (
              <p className="leading-relaxed">
                <span className="font-bold">Dica:</span> Em arquivos PNG/Imagem, selecione{' '}
                <span className="font-semibold italic">"Preencher página"</span> ou{' '}
                <span className="font-semibold italic">"Sem margem"</span> nas preferências de impressão.
              </p>
            ) : (
              <p className="leading-relaxed">
                <span className="font-bold">Dica:</span> Mantenha a escala em{' '}
                <span className="font-semibold italic">"100% / Tamanho Real"</span> para alinhamento preciso das margens e guias.
              </p>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
