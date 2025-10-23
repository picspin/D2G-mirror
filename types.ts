
export enum Mode {
  DATA_TO_GRAPH = 'DATA_TO_GRAPH',
  GRAPH_TO_DATA = 'GRAPH_TO_DATA',
}

export type ChartType = 'Bar' | 'Line' | 'Pie' | 'Scatter' | 'Radar';

export interface GraphSuggestion {
  chartType: ChartType;
  title: string;
  reason: string;
  data: any[]; 
}

export interface ExtractedDataResponse {
    isChart: boolean;
    data?: any[];
    reason?: string;
}

export type OutputFormat = 'table' | 'json' | 'csv' | 'markdown';

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