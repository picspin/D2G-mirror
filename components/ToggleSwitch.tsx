import React from 'react';
import { Mode } from '../types';
import { useTranslation } from '../hooks/useTranslation';

interface ToggleSwitchProps {
  mode: Mode;
  setMode: (mode: Mode) => void;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ mode, setMode }) => {
  const isDataToGraph = mode === Mode.DATA_TO_GRAPH;
  const { t } = useTranslation();

  return (
    <div className="relative w-80 h-14 bg-white/50 backdrop-blur-md rounded-full p-1.5 flex items-center shadow-inner mb-8">
      <div
        className={`absolute top-1.5 left-1.5 h-11 w-1/2 bg-white rounded-full shadow-lg transition-transform duration-300 ease-in-out`}
        style={{ transform: isDataToGraph ? 'translateX(0%)' : 'translateX(93%)' }}
      />
      <button
        onClick={() => setMode(Mode.DATA_TO_GRAPH)}
        className={`w-1/2 h-full rounded-full z-10 font-semibold transition-colors duration-300 ${isDataToGraph ? 'text-indigo-600' : 'text-gray-500'}`}
      >
        {t('toggle.dataToGraph')}
      </button>
      <button
        onClick={() => setMode(Mode.GRAPH_TO_DATA)}
        className={`w-1/2 h-full rounded-full z-10 font-semibold transition-colors duration-300 ${!isDataToGraph ? 'text-purple-600' : 'text-gray-500'}`}
      >
        {t('toggle.graphToData')}
      </button>
    </div>
  );
};

export default ToggleSwitch;