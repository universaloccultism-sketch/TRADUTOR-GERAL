
import React from 'react';

interface TextAreaInputProps {
  id: string;
  label: string;
  value: string;
  onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder: string;
  rows: number;
}

export const TextAreaInput: React.FC<TextAreaInputProps> = ({ id, label, value, onChange, placeholder, rows }) => {
  return (
    <div className="w-full">
      <label htmlFor={id} className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
        {label}
      </label>
      <textarea
        id={id}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={rows}
        className="w-full p-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition duration-150 ease-in-out text-base placeholder-slate-400 dark:placeholder-slate-500"
      />
    </div>
  );
};
