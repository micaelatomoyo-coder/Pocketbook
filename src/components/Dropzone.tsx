
import React, { useState, useCallback } from 'react';
import { Upload, FileText, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface DropzoneProps {
  onFileSelect: (file: File) => void;
  selectedFile: File | null;
  onClear: () => void;
  onError?: (msg: string) => void;
}

export function Dropzone({ onFileSelect, selectedFile, onClear, onError }: DropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);

  const isPdfFile = (file: File) => {
    return file.type === 'application/pdf' || 
           file.type.includes('pdf') || 
           file.name.toLowerCase().endsWith('.pdf');
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;

    if (file.size === 0) {
      onError?.('O arquivo selecionado está vazio (0 bytes). Selecione um arquivo PDF com conteúdo ou teste com o modelo de exemplo.');
      return;
    }

    if (isPdfFile(file)) {
      onFileSelect(file);
    } else {
      onError?.('Por favor, selecione um arquivo no formato PDF (.pdf).');
    }
  }, [onFileSelect, onError]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size === 0) {
      onError?.('O arquivo selecionado está vazio (0 bytes). Selecione um arquivo PDF com conteúdo ou teste com o modelo de exemplo.');
      e.target.value = '';
      return;
    }

    if (isPdfFile(file)) {
      onFileSelect(file);
    } else {
      onError?.('Por favor, selecione um arquivo no formato PDF (.pdf).');
    }
    // Reset so same file can be re-selected if needed
    e.target.value = '';
  };

  return (
    <div className="w-full">
      <AnimatePresence mode="wait">
        {!selectedFile ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`relative group h-64 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center transition-all duration-300 overflow-hidden ${
              isDragging ? 'border-indigo-500 bg-indigo-50/50' : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50/50'
            }`}
          >
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-5">
              <Upload size={160} />
            </div>
            
            <div className="z-10 flex flex-col items-center text-center p-6">
              <div className={`mb-4 w-16 h-16 rounded-full flex items-center justify-center transition-colors duration-300 ${isDragging ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-400 group-hover:bg-indigo-100 group-hover:text-indigo-600'}`}>
                <Upload size={28} />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Upload do seu PDF</h3>
              <p className="text-sm text-gray-500 mb-6 max-w-xs">Arraste seu arquivo aqui ou clique para selecionar</p>
              
              <label className="cursor-pointer bg-white border border-gray-200 text-gray-700 px-6 py-2.5 rounded-xl font-medium shadow-sm hover:shadow-md hover:border-indigo-200 hover:text-indigo-600 transition-all active:scale-95">
                Selecionar Arquivo
                <input type="file" className="hidden" accept="application/pdf" onChange={handleFileInput} />
              </label>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="selected"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-6 bg-white border border-indigo-100 rounded-2xl shadow-sm flex items-center justify-between"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                <FileText size={24} />
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 truncate max-w-[200px] sm:max-w-xs">{selectedFile.name}</h4>
                <p className="text-xs text-gray-500 font-medium">{(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • PDF Document</p>
              </div>
            </div>
            <button 
              onClick={onClear}
              className="p-2 text-gray-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
            >
              <X size={20} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
