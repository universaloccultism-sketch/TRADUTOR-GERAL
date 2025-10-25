
import React from 'react';
import { BookIcon } from './IconComponents';

export const Header: React.FC = () => {
  return (
    <header className="text-center">
        <div className="flex items-center justify-center gap-4 mb-2">
            <BookIcon />
            <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white">
                Tradutor Literário Inteligente
            </h1>
        </div>
      <p className="text-lg text-slate-600 dark:text-slate-400">
        Traduções fiéis ao contexto, capturando a essência de cada obra.
      </p>
    </header>
  );
};
