import React, { createContext, useState, useEffect, useMemo } from 'react';
import type { ModelConfig, CustomModelConfig } from '../types';

interface ModelContextType {
  modelConfig: ModelConfig;
  setModelConfig: (config: ModelConfig) => void;
}

export const ModelContext = createContext<ModelContextType>({
  modelConfig: { provider: 'google' },
  setModelConfig: () => {},
});

export const ModelProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [modelConfig, setModelConfig] = useState<ModelConfig>(() => {
    if (typeof window === 'undefined') return { provider: 'google' };
    try {
      const savedConfig = localStorage.getItem('modelConfig');
      return savedConfig ? JSON.parse(savedConfig) : { provider: 'google' };
    } catch (error) {
      console.error("Failed to parse model config from localStorage", error);
      return { provider: 'google' };
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
