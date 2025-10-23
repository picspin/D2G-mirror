import React from 'react';
import { Mode } from './types';
import ToggleSwitch from './components/ToggleSwitch';
import DataToGraphPanel from './components/DataToGraphPanel';
import GraphToDataPanel from './components/GraphToDataPanel';
import Header from './components/Header';
import { useTranslation } from './hooks/useTranslation';

const App: React.FC = () => {
  const [mode, setMode] = React.useState<Mode>(Mode.DATA_TO_GRAPH);
  const { t } = useTranslation();

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-indigo-100 via-purple-100 to-pink-100 font-sans text-gray-800 flex flex-col items-center justify-center p-4 overflow-hidden relative">
      <Header />
      <header className="mb-8 text-center">
        <h1 className="text-4xl font-bold text-gray-800 tracking-tight">{t('app.title')}</h1>
        <p className="text-lg text-gray-600 mt-2">{t('app.subtitle')}</p>
      </header>
      
      <ToggleSwitch mode={mode} setMode={setMode} />

      <main className="w-full max-w-6xl flex-grow" style={{ perspective: '2000px' }}>
        <div 
          className="relative w-full h-full transition-transform duration-700" 
          style={{ transformStyle: 'preserve-3d', transform: mode === Mode.DATA_TO_GRAPH ? 'rotateY(0deg)' : 'rotateY(180deg)' }}
        >
          <div className="absolute w-full h-full" style={{ backfaceVisibility: 'hidden' }}>
            <DataToGraphPanel />
          </div>
          <div className="absolute w-full h-full" style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
            <GraphToDataPanel />
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;