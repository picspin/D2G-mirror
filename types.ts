
export enum Mode {
  DATA_TO_GRAPH = 'DATA_TO_GRAPH',
  GRAPH_TO_DATA = 'GRAPH_TO_DATA',
}

export interface GraphSuggestion {
  title: string;
  spec: any;
}

export interface ExtractedDataResponse {
    isChart: boolean;
    report?: string;
    reason?: string;
}

export type ModelProviderType = 'google' | 'custom';

export interface CustomModelConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface ModelConfig {
  provider: ModelProviderType;
  custom?: CustomModelConfig;
}