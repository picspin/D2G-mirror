import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from '../hooks/useTheme';
import { SunIcon, MoonIcon, MonitorIcon } from './icons';
import { useTranslation } from '../hooks/useTranslation';

const ThemeToggle: React.FC = () => {
  const { theme, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();

  const themeIcons: { [key: string]: React.ReactNode } = {
    light: <SunIcon />,
    dark: <MoonIcon />,
    system: <MonitorIcon />,
  };
  
  const themeLabels: { [key: string]: string } = {
    light: t('theme.light'),
    dark: t('theme.dark'),
    system: t('theme.system'),
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
        className="w-10 h-10 flex items-center justify-center bg-white/50 dark:bg-slate-800/50 backdrop-blur-md rounded-full text-gray-600 dark:text-gray-300 hover:bg-white/80 dark:hover:bg-slate-700/80 transition-colors"
        aria-label="Toggle theme"
      >
        {themeIcons[theme]}
      </button>
      {isOpen && (
        <div className="absolute top-12 right-0 w-36 bg-white/70 dark:bg-slate-800/70 backdrop-blur-lg rounded-lg shadow-xl border border-white/50 dark:border-slate-700/50 p-1.5">
          {Object.keys(themeIcons).map((themeKey) => (
            <button
              key={themeKey}
              onClick={() => {
                setTheme(themeKey as 'light' | 'dark' | 'system');
                setIsOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors ${
                theme === themeKey
                  ? 'bg-indigo-500 text-white'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200/50 dark:hover:bg-slate-700'
              }`}
            >
              {themeIcons[themeKey]}
              <span>{themeLabels[themeKey]}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ThemeToggle;
