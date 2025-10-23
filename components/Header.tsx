import React from 'react';
import LanguageToggle from './LanguageToggle';

const Header: React.FC = () => {
  return (
    <div className="absolute top-4 right-4 flex items-center">
      <LanguageToggle />
    </div>
  );
};

export default Header;