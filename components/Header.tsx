import React, { useState } from 'react';
import LanguageToggle from './LanguageToggle';
import ModelManager from './ModelManager';
import { SettingsIcon } from './icons';

const Header: React.FC = () => {
  const [isModelManagerOpen, setIsModelManagerOpen] = useState(false);

  return (
    <>
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <LanguageToggle />
        <button
          onClick={() => setIsModelManagerOpen(true)}
          className="w-10 h-10 flex items-center justify-center bg-white/50 backdrop-blur-md rounded-full text-gray-600 hover:bg-white/80 transition-colors"
          aria-label="Open Model Settings"
        >
          <SettingsIcon />
        </button>
      </div>
      {isModelManagerOpen && <ModelManager onClose={() => setIsModelManagerOpen(false)} />}
    </>
  );
};

export default Header;