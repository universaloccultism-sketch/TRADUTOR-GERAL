
import React, { useState } from 'react';
import { CopyIcon, CheckIcon } from './IconComponents';
import { ChapterResult } from '../services/geminiService'; // Import ChapterResult

interface TranslationOutputProps {
  chapterResults: ChapterResult[]; // Changed from text: string
  isLoading: boolean;
  error: string | null;
  progress: number;
  targetLanguage: string;
}

const SkeletonLoader: React.FC = () => (
    <div className="space-y-4 animate-pulse p-6">
      <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4"></div>
      <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-full"></div>
      <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-5/6"></div>
      <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-full"></div>
      <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-4/5"></div>
      <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/2 mt-6"></div>
      <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-full"></div>
       <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-full"></div>
    </div>
);

export const TranslationOutput: React.FC<TranslationOutputProps> = ({ chapterResults, isLoading, error, progress, targetLanguage }) => {
  const [isCopiedAll, setIsCopiedAll] = useState(false); // State for 'Copiar Tudo' button
  const [copiedChapterId, setCopiedChapterId] = useState<string | null>(null); // State for individual chapter copy

  const handleCopyAll = () => {
    // Collect text only from successfully translated chapters
    const fullTranslatedText = chapterResults
      .filter(c => c.status === 'success' && c.translated !== null)
      .map(c => c.translated)
      .join('\n\n'); // Join with double newline for readability between chapters

    if (!fullTranslatedText || isCopiedAll) return;
    navigator.clipboard.writeText(fullTranslatedText).then(() => {
      setIsCopiedAll(true);
      setTimeout(() => {
        setIsCopiedAll(false);
      }, 2000);
    }).catch(err => {
        console.error('Failed to copy all text: ', err);
    });
  };

  const handleChapterCopy = (chapterId: string, textToCopy: string | null) => {
    if (!textToCopy || copiedChapterId === chapterId) return;

    navigator.clipboard.writeText(textToCopy).then(() => {
        setCopiedChapterId(chapterId);
        setTimeout(() => {
            setCopiedChapterId(null);
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy chapter text: ', err);
    });
  };
  
  const hasContent = chapterResults.some(c => c.status === 'success' || c.status === 'failed' || c.status === 'translating');
  const hasSuccessfulChapters = chapterResults.some(c => c.status === 'success');

  const renderContent = () => {
    if (isLoading && chapterResults.length === 0) { // Initial loading state without any chapters started
      return (
        <div className="p-6">
          <div className="mb-4">
            <div className="flex justify-between mb-1">
                <span className="text-base font-medium text-slate-700 dark:text-slate-300">Preparando tradução...</span>
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{Math.round(progress)}%</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2.5 dark:bg-slate-700">
                <div 
                    className="bg-yellow-500 h-2.5 rounded-full transition-all duration-300 ease-linear" 
                    style={{width: `${progress}%`}}>
                </div>
            </div>
          </div>
          <SkeletonLoader />
        </div>
      );
    }
    
    if (error && chapterResults.length === 0) { // Overall error, no chapters processed
        return (
            <div className="flex flex-col items-center justify-center h-full p-6 text-center">
                <svg className="w-16 h-16 text-red-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                <h3 className="text-lg font-semibold text-red-600 dark:text-red-400">Erro na Tradução</h3>
                <p className="text-slate-600 dark:text-slate-400 mt-1">{error}</p>
            </div>
        );
    }

    if (chapterResults.length > 0) {
      return (
        <div className="p-4 space-y-4 max-h-[calc(100vh-16rem)] overflow-y-auto"> {/* Adjust height as needed */}
           {(isLoading || progress > 0) && ( // Show progress bar if loading or some progress has been made
                <div className="mb-4">
                    <div className="flex justify-between mb-1">
                        <span className="text-base font-medium text-slate-700 dark:text-slate-300">Traduzindo capítulos...</span>
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{Math.round(progress)}%</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2.5 dark:bg-slate-700">
                        <div 
                            className="bg-yellow-500 h-2.5 rounded-full transition-all duration-300 ease-linear" 
                            style={{width: `${progress}%`}}>
                        </div>
                    </div>
                </div>
            )}
          {chapterResults.map(chapter => (
            <div
              key={chapter.id}
              className={`p-4 rounded-lg shadow-sm border-2 ${
                chapter.status === 'success' ? 'border-green-500 bg-green-50 dark:bg-green-900/20' :
                chapter.status === 'failed' ? 'border-red-500 bg-red-50 dark:bg-red-900/20' :
                chapter.status === 'translating' ? 'border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 animate-pulse' :
                'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700'
              }`}
            >
              <h3 className="font-semibold text-lg mb-2 text-slate-800 dark:text-slate-100 flex justify-between items-center">
                <span>
                  {chapter.chapterTitle || 'Texto Traduzido'}
                  {chapter.status === 'translating' && <span className="ml-2 text-sm text-yellow-600 dark:text-yellow-400"> (Traduzindo...)</span>}
                </span>
                {chapter.status === 'success' && chapter.translated && (
                    <button
                        onClick={() => handleChapterCopy(chapter.id, chapter.translated)}
                        disabled={copiedChapterId === chapter.id}
                        className="flex items-center gap-1 text-xs bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600 font-semibold py-1 px-2 rounded-md shadow-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-100 dark:focus:ring-offset-slate-900/50 focus:ring-yellow-500 disabled:opacity-75 disabled:cursor-default"
                        aria-live="polite"
                    >
                        {copiedChapterId === chapter.id ? <CheckIcon className="h-4 w-4" /> : <CopyIcon className="h-4 w-4" />}
                        {copiedChapterId === chapter.id ? 'Copiado!' : 'Copiar'}
                    </button>
                )}
              </h3>
              {chapter.status === 'success' && chapter.translated && (
                <p className="whitespace-pre-wrap text-slate-700 dark:text-slate-200 max-h-24 overflow-y-auto pr-2">{chapter.translated}</p>
              )}
              {chapter.status === 'failed' && chapter.error && (
                <p className="text-red-700 dark:text-red-300 font-medium">Erro: {chapter.error}</p>
              )}
               {chapter.status === 'pending' && (
                <p className="text-slate-500 dark:text-slate-400">Aguardando início da tradução...</p>
              )}
            </div>
          ))}
        </div>
      );
    }

    // Default empty state
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <svg className="w-16 h-16 text-slate-400 dark:text-slate-500 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5h12M9 3v2m4 13-4-4m0 0l4-4m-4 4h12M3 17h12a2 2 0 002-2V7a2 2 0 00-2-2H3a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
        <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300">Aguardando Tradução</h3>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          O status da sua tradução aparecerá aqui.
        </p>
      </div>
    );
  };

  return (
    <div className="h-full w-full flex flex-col">
        <div className="bg-slate-100 dark:bg-slate-900/50 p-3 rounded-t-lg border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">Resultado da Tradução ({targetLanguage})</h2>
            {hasSuccessfulChapters && !isLoading && !error && ( // Only show copy if there's successful content and not loading/error
                 <button
                    onClick={handleCopyAll}
                    disabled={isCopiedAll}
                    className="flex items-center gap-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600 font-semibold py-1.5 px-3 rounded-md shadow-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-100 dark:focus:ring-offset-slate-900/50 focus:ring-yellow-500 text-sm disabled:opacity-75 disabled:cursor-default"
                    aria-live="polite"
                >
                    {isCopiedAll ? <CheckIcon /> : <CopyIcon />}
                    {isCopiedAll ? 'Copiado!' : 'Copiar Tudo'}
                </button>
            )}
        </div>
        <div className={`flex-grow flex flex-col relative ${(!hasContent || isLoading || error) ? 'justify-center' : ''}`}>
            {renderContent()}
        </div>
    </div>
  );
};
