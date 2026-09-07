
import { Printer, Scissors, FoldVertical, RefreshCw } from 'lucide-react';
import { ImpositionPreset } from '../types';

interface InstructionsProps {
  preset?: ImpositionPreset;
}

export function Instructions({ preset = 'pocketbook-a6' }: InstructionsProps) {
  const isA6 = preset === 'pocketbook-a6';

  const steps = [
    {
      icon: Printer,
      title: 'Impressão Duplex',
      desc: isA6
        ? 'Imprima em modo "Frente e Verso". Escolha a opção "Margem Longa" (Long Edge Bind).'
        : 'Imprima em modo "Frente e Verso". Escolha a opção "Margem Curta" (Short Edge Bind).',
      color: isA6 ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-600'
    },
    {
      icon: RefreshCw,
      title: 'Orientação',
      desc: isA6
        ? 'Folha em modo Retrato (Vertical). Mantenha a escala em 100% ou "Tamanho Real".'
        : 'Folha em modo Paisagem (Horizontal). Mantenha a escala em 100% ou "Tamanho Real".',
      color: 'bg-purple-50 text-purple-600'
    },
    {
      icon: Scissors,
      title: isA6 ? 'Corte Central A6' : 'Linhas de Corte',
      desc: isA6
        ? 'Corte a folha A4 exatamente ao meio na horizontal para obter duas tiras A5.'
        : 'Corte nas linhas tracejadas centrais indicadas na folha impressa.',
      color: 'bg-orange-50 text-orange-600'
    },
    {
      icon: FoldVertical,
      title: 'Dobra e Costura',
      desc: 'Dobre as tiras nos vincos centrais para formar os cadernos. Encaixe as folhas de cada caderno para costura copta.',
      color: 'bg-emerald-50 text-emerald-600'
    }
  ];

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
      <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-6">Guia de Montagem</h3>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {steps.map((step, idx) => (
          <div key={idx} className="flex gap-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${step.color}`}>
              <step.icon size={20} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-gray-900">{step.title}</h4>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">{step.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 p-4 bg-indigo-50/50 rounded-xl border border-indigo-100">
        <p className="text-xs font-bold text-indigo-900 mb-2 uppercase tracking-wide">Dica do Artesão:</p>
        <p className="text-xs text-indigo-700 leading-relaxed italic">
          "Pressione as dobras com uma dobradeira de osso ou uma régua para garantir que o pocketbook fique firme e as páginas não 'saltem' para fora."
        </p>
      </div>
    </div>
  );
}
