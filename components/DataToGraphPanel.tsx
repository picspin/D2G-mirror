import React, { useState, useCallback, useMemo } from 'react';
import type { GraphSuggestion, ChartType } from '../types';
import { analyzeDataForGraphSuggestions } from '../services/aiService';
import Loader from './Loader';
import { BarChartIcon, LineChartIcon, PieChartIcon, RadarChartIcon, ScatterChartIcon } from './icons';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, ScatterChart, Scatter, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useTranslation } from '../hooks/useTranslation';
import { useModel } from '../hooks/useModel';

const CHART_ICONS: Record<ChartType, React.ReactNode> = {
  Bar: <BarChartIcon />,
  Line: <LineChartIcon />,
  Pie: <PieChartIcon />,
  Radar: <RadarChartIcon />,
  Scatter: <ScatterChartIcon />,
};

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#0088fe', '#00c49f'];

const FileUpload: React.FC<{ onFileUpload: (file: File) => void; disabled: boolean }> = ({ onFileUpload, disabled }) => {
  const [isDragging, setIsDragging] = useState(false);
  const { t } = useTranslation();

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      !disabled && setIsDragging(true);
    } else if (e.type === 'dragleave') {
      setIsDragging(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (disabled || !e.dataTransfer.files || e.dataTransfer.files.length === 0) return;
    onFileUpload(e.dataTransfer.files[0]);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled || !e.target.files || e.target.files.length === 0) return;
    onFileUpload(e.target.files[0]);
  };

  return (
    <label
      onDragEnter={handleDrag}
      onDragOver={handleDrag}
      onDragLeave={handleDrag}
      onDrop={handleDrop}
      className={`flex flex-col items-center justify-center w-full h-36 border-2 border-dashed rounded-xl cursor-pointer transition-colors duration-300 ease-in-out ${
        isDragging ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 hover:border-indigo-400 hover:bg-indigo-50/50'
      } ${disabled ? 'cursor-not-allowed bg-gray-100' : ''}`}
    >
      <div className="flex flex-col items-center justify-center pt-5 pb-6">
        <svg className="w-10 h-10 mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
        <p className="mb-2 text-sm text-gray-500"><span className="font-semibold">{t('fileUpload.click')}</span> {t('fileUpload.orDrag')}</p>
        <p className="text-xs text-gray-500">{t('dataToGraph.fileTypes')}</p>
      </div>
      <input type="file" className="hidden" onChange={handleChange} accept=".txt,.csv,.json" disabled={disabled} />
    </label>
  );
};

const DataToGraphPanel: React.FC = () => {
    const [file, setFile] = useState<File | null>(null);
    const [url, setUrl] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [suggestions, setSuggestions] = useState<GraphSuggestion[]>([]);
    const [selectedSuggestion, setSelectedSuggestion] = useState<GraphSuggestion | null>(null);
    const { t } = useTranslation();
    const { modelConfig } = useModel();

    const handleFileUpload = (uploadedFile: File) => {
        setFile(uploadedFile);
        setUrl('');
        setError(null);
        setSuggestions([]);
        setSelectedSuggestion(null);
    };

    const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setUrl(e.target.value);
        setFile(null);
        setError(null);
        setSuggestions([]);
        setSelectedSuggestion(null);
    }

    const handleDigest = useCallback(async () => {
        if (!file && !url) return;

        setIsLoading(true);
        setError(null);
        setSuggestions([]);
        setSelectedSuggestion(null);

        try {
            let content: string;
            if (file) {
                content = await file.text();
            } else {
                 if (!url.startsWith('http')) {
                    throw new Error(t('errors.invalidUrl'));
                }
                const response = await fetch(url);
                if (!response.ok) {
                    throw new Error(t('errors.urlFetchFailed'));
                }
                content = await response.text();
            }

            if (!content) {
                setError(t('errors.fileEmpty'));
                setIsLoading(false);
                return;
            }
            const newSuggestions = await analyzeDataForGraphSuggestions(content, modelConfig);
            setSuggestions(newSuggestions);
            if(newSuggestions.length > 0) {
                setSelectedSuggestion(newSuggestions[0]);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : t('errors.unknown'));
        } finally {
            setIsLoading(false);
        }
    }, [file, url, t, modelConfig]);

    const renderedChart = useMemo(() => {
        if (!selectedSuggestion) return null;
        
        const { chartType, data } = selectedSuggestion;
        const dataKey = Object.keys(data[0] || {}).find(k => k !== 'name' && k !== 'x' && k !== 'y') || 'value';
        
        return (
            <ResponsiveContainer width="100%" height={400}>
                {chartType === 'Bar' ? (
                    <BarChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey={dataKey} fill="#8884d8" />
                    </BarChart>
                ) : chartType === 'Line' ? (
                    <LineChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey={dataKey} stroke="#82ca9d" />
                    </LineChart>
                ) : chartType === 'Pie' ? (
                    <PieChart>
                        <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={150} fill="#8884d8" label>
                          {data.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                        </Pie>
                        <Tooltip />
                        <Legend />
                    </PieChart>
                ) : chartType === 'Scatter' ? (
                    <ScatterChart>
                        <CartesianGrid />
                        <XAxis type="number" dataKey="x" name="x" />
                        <YAxis type="number" dataKey="y" name="y" />
                        <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                        <Scatter name="A dataset" data={data} fill="#8884d8" />
                    </ScatterChart>
                ) : chartType === 'Radar' ? (
                    <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
                        <PolarGrid />
                        <PolarAngleAxis dataKey="name" />
                        <PolarRadiusAxis />
                        <Radar name="Metrics" dataKey={dataKey} stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
                        <Tooltip />
                        <Legend />
                    </RadarChart>
                ) : null}
            </ResponsiveContainer>
        );
    }, [selectedSuggestion]);

    return (
        <div className="p-8 bg-white/40 backdrop-blur-xl border border-white/50 rounded-3xl shadow-2xl shadow-indigo-200/50 h-full flex flex-col gap-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                <div>
                    <h2 className="text-xl font-semibold text-gray-700 mb-2">{t('dataToGraph.step1')}</h2>
                     <FileUpload onFileUpload={handleFileUpload} disabled={isLoading} />
                     <div className="relative flex py-2 items-center">
                        <div className="flex-grow border-t border-gray-300"></div>
                        <span className="flex-shrink mx-4 text-gray-400 text-sm">OR</span>
                        <div className="flex-grow border-t border-gray-300"></div>
                    </div>
                     <input
                        type="text"
                        placeholder={t('urlInput.placeholderData')}
                        value={url}
                        onChange={handleUrlChange}
                        disabled={isLoading}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:bg-gray-100"
                    />
                </div>
                <div className="flex flex-col h-full">
                    <h2 className="text-xl font-semibold text-gray-700 mb-2">{t('dataToGraph.step2')}</h2>
                    <div className="flex-grow flex items-center">
                        <button
                            onClick={handleDigest}
                            disabled={!file && !url || isLoading}
                            className="w-full h-24 bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-bold py-3 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-md flex items-center justify-center text-lg focus:outline-none focus:ring-4 focus:ring-indigo-300"
                        >
                            {isLoading ? <Loader /> : `✨ ${t('dataToGraph.generateButton')}`}
                        </button>
                    </div>
                </div>
            </div>

            {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative" role="alert">{error}</div>}

            {suggestions.length > 0 && (
                <div className="flex-grow flex flex-col min-h-0">
                    <h2 className="text-xl font-semibold text-gray-700 mb-3">{t('dataToGraph.step3')}</h2>
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        {suggestions.map((s, i) => (
                            <button
                                key={i}
                                onClick={() => setSelectedSuggestion(s)}
                                className={`p-4 rounded-xl transition-all duration-300 text-left ${selectedSuggestion?.title === s.title ? 'bg-indigo-500 text-white shadow-lg scale-105' : 'bg-white/60 hover:bg-white'}`}
                            >
                                <div className="flex items-center gap-3">
                                  <div className={`text-2xl ${selectedSuggestion?.title === s.title ? 'text-white' : 'text-gray-700'}`}>{CHART_ICONS[s.chartType]}</div>
                                  <div>
                                    <h3 className="font-semibold">{t('chartTypes.' + s.chartType.toLowerCase())}</h3>
                                    <p className={`text-sm ${selectedSuggestion?.title === s.title ? 'text-indigo-100' : 'text-gray-600'}`}>{s.title}</p>
                                  </div>
                                </div>
                            </button>
                        ))}
                    </div>
                    {selectedSuggestion && (
                         <div className="flex-grow bg-white/60 rounded-xl p-4 min-h-[400px]">
                           {renderedChart}
                         </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default DataToGraphPanel;