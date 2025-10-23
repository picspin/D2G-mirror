import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from '../hooks/useTranslation';
import { GlobeIcon } from './icons';

const LanguageToggle: React.FC = () => {
  const { language, setLanguage } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const languages: { [key: string]: string } = {
    en: 'English',
    cn: '简体中文',
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-10 h-10 flex items-center justify-center bg-white/50 backdrop-blur-md rounded-full text-gray-600 hover:bg-white/80 transition-colors"
        aria-label="Toggle language"
      >
        <GlobeIcon />
      </button>
      {isOpen && (
        <div className="absolute top-12 right-0 w-36 bg-white/70 backdrop-blur-lg rounded-lg shadow-xl border border-white/50 p-1.5">
          {Object.keys(languages).map((langKey) => (
            <button
              key={langKey}
              onClick={() => {
                setLanguage(langKey as 'en' | 'cn');
                setIsOpen(false);
              }}
              className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors ${
                language === langKey
                  ? 'bg-indigo-500 text-white'
                  : 'text-gray-700 hover:bg-gray-200/50'
              }`}
            >
              {languages[langKey]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default LanguageToggle;