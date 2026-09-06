
import { Printer, Scissors, FoldVertical, RefreshCw } from 'lucide-react';

export function Instructions() {
  const steps = [
    {
      icon: Printer,
      title: 'Impressão Duplex',
      desc: 'Imprima em modo "Frente e Verso". Escolha a opção "Viras na Borda Curta" (Short Edge Bind).',
      color: 'bg-blue-50 text-blue-600'
    },
    {
      icon: RefreshCw,
      title: 'Orientação',
      desc: 'Certifique-se de que a escala está em 100% ou "Tamanho Real" nas configurações da sua impressora.',
      color: 'bg-purple-50 text-purple-600'
    },
    {
      icon: Scissors,
      title: 'Corte Central',
      desc: 'Para A6, corte a folha A4 exatamente ao meio na horizontal para obter duas tiras A5.',
      color: 'bg-orange-50 text-orange-600'
    },
    {
      icon: FoldVertical,
      title: 'Dobra Final',
      desc: 'Dobre as tiras A5 ao meio para formar o caderno A6. Encaixe um dentro do outro para formar o livro.',
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
