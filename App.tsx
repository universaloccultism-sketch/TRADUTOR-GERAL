

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Header } from './components/Header';
import { TextAreaInput } from './components/TextAreaInput';
import { TranslationOutput } from './components/TranslationOutput';
import { TranslateIcon, CancelIcon, UploadIcon, FileIcon, CloseIcon, TrashIcon } from './components/IconComponents';
import { translateChapters, TranslationProfile, ChapterResult } from './services/geminiService';

declare const mammoth: any;

const languages = [
  { code: 'en', name: 'Inglês' },
  { code: 'pt-BR', name: 'Português (Brasil)' },
  { code: 'es', name: 'Espanhol' },
  { code: 'fr', name: 'Francês' },
  { code: 'de', name: 'Alemão' },
  { code: 'it', name: 'Italiano' },
  { code: 'ja', name: 'Japonês' },
  { code: 'ko', name: 'Coreano' },
  { code: 'ru', name: 'Russo' },
  { code: 'zh-CN', name: 'Chinês (Simplificado)' },
];

const LanguageSelector: React.FC<{
  id: string;
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
}> = ({ id, label, value, onChange }) => (
  <div>
    <label htmlFor={id} className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
      {label}
    </label>
    <select
      id={id}
      value={value}
      onChange={onChange}
      className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 transition duration-150 ease-in-out text-base"
    >
      {languages.map(lang => (
        <option key={lang.code} value={lang.name}>
          {lang.name}
        </option>
      ))}
    </select>
  </div>
);

const FileUpload: React.FC<{
  onFileSelect: (file: File) => void;
  selectedFile: File | null;
  onFileClear: () => void;
  sourceLanguage: string;
}> = ({ onFileSelect, selectedFile, onFileClear, sourceLanguage }) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragEnter = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.name.endsWith('.docx')) {
        onFileSelect(file);
      } else {
        alert('Por favor, selecione um arquivo .docx');
      }
      e.dataTransfer.clearData();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
       const file = e.target.files[0];
       if (file.name.endsWith('.docx')) {
        onFileSelect(file);
      } else {
        alert('Por favor, selecione um arquivo .docx');
      }
    }
  };

  return (
    <div className="w-full">
       <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
        Arquivo em {sourceLanguage} (.docx)
      </label>
      {selectedFile ? (
        <div className="flex items-center justify-between p-4 bg-slate-100 dark:bg-slate-800 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg">
          <div className="flex items-center gap-3 overflow-hidden">
            <FileIcon />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">{selectedFile.name}</span>
          </div>
          <button onClick={onFileClear} className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 flex-shrink-0" aria-label="Remover arquivo">
            <CloseIcon />
          </button>
        </div>
      ) : (
        <label
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          htmlFor="file-upload"
          className={`relative block w-full h-48 p-3 bg-white dark:bg-slate-800 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg cursor-pointer transition-colors duration-200 ${isDragging ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20' : ''}`}
        >
          <div className="flex flex-col items-center justify-center h-full text-center">
            <UploadIcon />
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              <span className="font-semibold text-yellow-600 dark:text-yellow-400">Clique para enviar</span> ou arraste e solte
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-500">Apenas arquivos .docx</p>
          </div>
          <input id="file-upload" name="file-upload" type="file" className="sr-only" onChange={handleFileChange} accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" />
        </label>
      )}
    </div>
  );
};

const App: React.FC = () => {
  const [contextText, setContextText] = useState<string>('');
  const [inputText, setInputText] = useState<string>('');
  const [chapterResults, setChapterResults] = useState<ChapterResult[]>([]); // Changed from translatedText
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<TranslationProfile>('Fiel');
  const [progress, setProgress] = useState<number>(0);
  const [sourceLang, setSourceLang] = useState('Inglês');
  const [targetLang, setTargetLang] = useState('Português (Brasil)');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (chapterResults.length > 0) {
      const completedChapters = chapterResults.filter(c => c.status === 'success' || c.status === 'failed').length;
      const totalChapters = chapterResults.length;
      if (totalChapters > 0) {
        setProgress(Math.round((completedChapters / totalChapters) * 100));
      } else {
        setProgress(0);
      }
    } else {
      setProgress(0);
    }
  }, [chapterResults]);


  const handleFileSelect = async (file: File) => {
    setSelectedFile(file);
    setError(null);
    setChapterResults([]); // Clear previous results
    setInputText(''); 
    
    try {
        const reader = new FileReader();
        reader.onload = async (event) => {
            const arrayBuffer = event.target?.result;
            if (arrayBuffer) {
                const result = await mammoth.extractRawText({ arrayBuffer });
                setInputText(result.value);
            }
        };
        reader.onerror = () => {
             setError('Erro ao ler o arquivo.');
        };
        reader.readAsArrayBuffer(file);
    } catch (e) {
        setError('Não foi possível processar o arquivo .docx.');
        console.error(e);
    }
  };

  const handleFileClear = () => {
      setSelectedFile(null);
      setInputText('');
      setChapterResults([]); // Clear results
      setError(null);
  };
  
  const handleTranslate = useCallback(async () => {
    if (!inputText.trim()) {
      setError('Por favor, selecione um arquivo .docx para traduzir.');
      return;
    }
      
    setIsLoading(true);
    setError(null);
    setChapterResults([]); // Clear previous results before starting
    setProgress(0);

    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    try {
      await translateChapters( // Changed to translateChapters
          inputText, 
          contextText, 
          profile,
          sourceLang,
          targetLang,
          (updatedChapter) => {
            // Callback to update individual chapter status/content
            setChapterResults(prev => {
                const existingChapterIndex = prev.findIndex(c => c.id === updatedChapter.id);
                if (existingChapterIndex > -1) {
                    // Update existing chapter
                    const newResults = [...prev];
                    newResults[existingChapterIndex] = updatedChapter;
                    return newResults;
                } else {
                    // Add new chapter (e.g., if it's the first time processing this chapter)
                    return [...prev, updatedChapter];
                }
            });
          },
          signal
      );
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('Translation cancelled by user.');
        setChapterResults([]); // Clear results on cancel
        setError(null);
      } else {
        // For general errors not tied to a specific chapter
        setError(err.message || 'Ocorreu um erro ao traduzir. Por favor, tente novamente.');
        console.error(err);
      }
      // If an overall error occurs, individual chapter errors might also be present
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }, [inputText, contextText, profile, sourceLang, targetLang]);
  
  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsLoading(false); // Ensure loading state is false after cancel
    setProgress(0); // Reset progress on cancel
  };

  const handleClearAll = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setContextText('');
    setInputText('');
    setChapterResults([]); // Clear chapter results
    setIsLoading(false);
    setError(null);
    setProfile('Fiel');
    setProgress(0);
    setSourceLang('Inglês');
    setTargetLang('Português (Brasil)');
    setSelectedFile(null);
  };

  const profiles: TranslationProfile[] = ['Literária', 'Fiel', 'Natural'];
  const showProfileSelector = sourceLang === 'Inglês' && targetLang === 'Português (Brasil)');

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-sans p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <Header />
        <main className="mt-8">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
            {/* Input Section */}
            <div className="lg:col-span-3 flex flex-col gap-6">
              <div className="grid grid-cols-2 gap-4">
                  <LanguageSelector 
                    id="source-lang"
                    label="Traduzir de"
                    value={sourceLang}
                    onChange={(e) => setSourceLang(e.target.value)}
                  />
                   <LanguageSelector 
                    id="target-lang"
                    label="Traduzir para"
                    value={targetLang}
                    onChange={(e) => setTargetLang(e.target.value)}
                  />
              </div>

              <TextAreaInput
                id="context"
                label="Contexto da Obra (Opcional, mas recomendado)"
                value={contextText}
                onChange={(e) => setContextText(e.target.value)}
                placeholder="Ex: Gênero do livro, época, resumo da história, estilo do autor, etc. Quanto mais detalhes, melhor a tradução."
                rows={5}
              />
              
              <FileUpload
                onFileSelect={handleFileSelect}
                selectedFile={selectedFile}
                onFileClear={handleFileClear}
                sourceLanguage={sourceLang}
              />

              {/* Profile Selector */}
              {showProfileSelector && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Estilo de Tradução
                  </label>
                  <div className="flex bg-slate-200 dark:bg-slate-800 rounded-lg p-1">
                    {profiles.map((p) => (
                      <button
                        key={p}
                        onClick={() => setProfile(p)}
                        className={`w-full py-2 px-3 rounded-md text-sm font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-200 dark:focus:ring-offset-slate-800 focus:ring-yellow-500 ${
                          profile === p
                            ? 'bg-white dark:bg-slate-900/75 text-yellow-600 dark:text-yellow-400 shadow'
                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-300/50 dark:hover:bg-slate-700/50'
                        }`}
                        aria-pressed={profile === p}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {isLoading ? (
                <button
                  onClick={handleCancel}
                  className="w-full flex items-center justify-center gap-3 bg-red-600 text-white font-semibold py-3 px-6 rounded-lg shadow-md hover:bg-red-700 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  <CancelIcon />
                  Cancelar Tradução
                </button>
              ) : (
                <div className="flex flex-col sm:flex-row gap-4">
                  <button
                    onClick={handleTranslate}
                    disabled={!inputText}
                    className="flex-1 flex items-center justify-center gap-3 bg-yellow-500 text-slate-800 font-semibold py-3 px-6 rounded-lg shadow-md hover:bg-yellow-600 disabled:bg-yellow-300 disabled:cursor-not-allowed transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
                  >
                    <TranslateIcon />
                    Traduzir
                  </button>
                  <button
                    onClick={handleClearAll}
                    className="sm:flex-none flex items-center justify-center gap-3 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold py-3 px-6 rounded-lg shadow-sm hover:bg-slate-300 dark:hover:bg-slate-600 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-50 dark:focus:ring-offset-slate-900 focus:ring-slate-500"
                    aria-label="Limpar tudo"
                  >
                    <TrashIcon />
                    Limpar Tudo
                  </button>
                </div>
              )}
            </div>

            {/* Output Section */}
            <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700">
              <TranslationOutput
                chapterResults={chapterResults} // Pass chapter results
                isLoading={isLoading}
                error={error}
                progress={progress}
                targetLanguage={targetLang}
              />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;