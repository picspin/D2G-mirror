
import React from 'react';
import { useTranslation } from '../hooks/useTranslation';

const Loader: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center gap-4 text-white font-semibold">
      <style>{`
        .pacman-container {
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .pacman {
          width: 0;
          height: 0;
          border-right: 30px solid transparent;
          border-top: 30px solid #FFD700;
          border-left: 30px solid #FFD700;
          border-bottom: 30px solid #FFD700;
          border-top-left-radius: 30px;
          border-top-right-radius: 30px;
          border-bottom-left-radius: 30px;
          border-bottom-right-radius: 30px;
          animation: pacman-chomp 0.5s infinite;
          position: relative;
        }
        .pacman-eye {
            position: absolute;
            width: 8px;
            height: 8px;
            background-color: #000;
            border-radius: 50%;
            top: -15px;
            right: 5px;
        }
        @keyframes pacman-chomp {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(-35deg); }
        }
        .dot {
          width: 10px;
          height: 10px;
          background-color: #FFB8AE;
          border-radius: 50%;
          margin-left: 15px;
          animation: dot-move 1.5s linear infinite;
        }
        .dot:nth-child(2) { animation-delay: -0.5s; }
        .dot:nth-child(3) { animation-delay: -1s; }
        
        @keyframes dot-move {
            0% { transform: translateX(0); opacity: 1; }
            100% { transform: translateX(-80px); opacity: 0; }
        }
      `}</style>
      <div className="pacman-container">
        <div className="pacman"><div className="pacman-eye"></div></div>
        <div className="dot"></div>
        <div className="dot"></div>
        <div className="dot"></div>
      </div>
      <p className="mt-2 text-lg animate-pulse">{t('loader.digesting')}</p>
    </div>
  );
};

export default Loader;