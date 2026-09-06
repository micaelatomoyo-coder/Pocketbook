
import { GenerationHistory } from '../types';
import { History as HistoryIcon, Download, FileType } from 'lucide-react';

interface HistoryProps {
  items: GenerationHistory[];
  loading: boolean;
}

export function History({ items, loading }: HistoryProps) {
  if (loading) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-gray-400">
        <HistoryIcon size={16} />
        <h3 className="text-sm font-bold uppercase tracking-widest">Atividades Recentes</h3>
      </div>

      <div className="grid grid-cols-1 gap-2">
        {items.length === 0 ? (
          <div className="p-8 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200">
            <p className="text-xs font-medium text-gray-400">Nenhuma geração registrada ainda.</p>
          </div>
        ) : (
          items.map((item) => (
            <div key={item.id} className="group flex items-center justify-between p-4 bg-white border border-gray-100 rounded-xl hover:border-indigo-200 transition-all hover:shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-50 rounded-lg flex items-center justify-center text-gray-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                  <FileType size={16} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-gray-900 truncate max-w-[150px]">{item.fileName}</h4>
                  <p className="text-[10px] text-gray-400 font-medium">
                    {item.preset} • {item.pageCount} pgs • {new Date(item.timestamp).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                 <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded">{item.sheetsGenerated} Folhas</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
