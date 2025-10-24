
import React, { createContext, useState, useEffect, useMemo } from 'react';
import type { ModelConfig } from '../types';

interface ModelContextType {
  modelConfig: ModelConfig;
  setModelConfig: (config: ModelConfig) => void;
}

const defaultModelConfig: ModelConfig = {
    dataToGraph: { provider: 'google' },
    graphToData: { provider: 'google' },
};

export const ModelContext = createContext<ModelContextType>({
  modelConfig: defaultModelConfig,
  setModelConfig: () => {},
});

export const ModelProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [modelConfig, setModelConfig] = useState<ModelConfig>(() => {
    if (typeof window === 'undefined') return defaultModelConfig;
    try {
      const savedConfigString = localStorage.getItem('modelConfig');
      if (!savedConfigString) return defaultModelConfig;
      
      const savedConfig = JSON.parse(savedConfigString);

      // Migration logic: if the old format is detected (doesn't have dataToGraph),
      // convert it to the new format.
      if (savedConfig.provider && !savedConfig.dataToGraph) {
          const migratedConfig = {
              dataToGraph: { ...savedConfig },
              graphToData: { ...savedConfig },
          };
          localStorage.setItem('modelConfig', JSON.stringify(migratedConfig));
          return migratedConfig;
      }

      // Check if the loaded config has the correct shape
      if (savedConfig.dataToGraph && savedConfig.graphToData) {
          return savedConfig;
      }

      return defaultModelConfig;

    } catch (error) {
      console.error("Failed to parse model config from localStorage", error);
      return defaultModelConfig;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('modelConfig', JSON.stringify(modelConfig));
    } catch (error) {
      console.error("Failed to save model config to localStorage", error);
    }
  }, [modelConfig]);

  const value = useMemo(() => ({ modelConfig, setModelConfig }), [modelConfig]);

  return <ModelContext.Provider value={value}>{children}</ModelContext.Provider>;
};
