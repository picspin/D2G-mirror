
import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { GraphSuggestion } from '../types';
import { analyzeDataForGraphSuggestions } from '../services/aiService';
import Loader from './Loader';
import { useTranslation } from '../hooks/useTranslation';
import { useModel } from '../hooks/useModel';

declare const XLSX: any;
declare const G2: any;

const G2Chart: React.FC<{ spec: any; data: any[] }> = ({ spec, data }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<any>(null);

    useEffect(() => {
        if (!containerRef.current) return;

        const chart = new G2.Chart({
            container: containerRef.current,
            autoFit: true,
            height: 400,
        });

        const finalSpec = { ...spec };
        finalSpec.data = data;
        
        chart.options(finalSpec);
        chart.render();
        chartRef.current = chart;

        return () => {
            if (chartRef.current) {
                chartRef.current.destroy();
                chartRef.current = null;
            }
        };
    }, [spec, data]);

    return <div ref={containerRef} style={{ height: '400px' }} />;
};


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
      <input type="file" className="hidden" onChange={handleChange} accept=".txt,.csv,.json,.xls,.xlsx" disabled={disabled} />
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
    const [analysisReport, setAnalysisReport] = useState<string | null>(null);
    const [processedData, setProcessedData] = useState<any[]>([]);
    const { t } = useTranslation();
    const { modelConfig } = useModel();
    const hasData = file || url;

    const resetState = () => {
      setError(null);
      setSuggestions([]);
      setSelectedSuggestion(null);
      setAnalysisReport(null);
      setProcessedData([]);
    }

    const handleClear = () => {
        setFile(null);
        setUrl('');
        resetState();
    }

    const handleFileUpload = (uploadedFile: File) => {
        setFile(uploadedFile);
        setUrl('');
        resetState();
    };

    const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setUrl(e.target.value);
        setFile(null);
        resetState();
    }

    const handleDigest = useCallback(async () => {
        if (!file && !url) return;

        setIsLoading(true);
        resetState();

        try {
            let content: string;
            let dataForChart: any[] = [];
            
            if (file) {
                 if (file.name.endsWith('.xls') || file.name.endsWith('.xlsx')) {
                    const data = await file.arrayBuffer();
                    const workbook = XLSX.read(data);
                    const sheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[sheetName];
                    dataForChart = XLSX.utils.sheet_to_json(worksheet);
                    content = XLSX.utils.sheet_to_csv(worksheet);
                } else {
                    content = await file.text();
                    if (file.name.endsWith('.json')) {
                        dataForChart = JSON.parse(content);
                    } else if (file.name.endsWith('.csv') || file.name.endsWith('.txt')) {
                        const lines = content.split('\n').filter(l => l.trim() !== '');
                        const header = lines[0].split(',').map(h => h.trim());
                        dataForChart = lines.slice(1).map(line => {
                            const values = line.split(',').map(v => v.trim());
                            return header.reduce((obj, h, i) => {
                                const val = values[i];
                                obj[h] = !isNaN(parseFloat(val)) && isFinite(val as any) ? parseFloat(val) : val;
                                return obj;
                            }, {} as any);
                        });
                    }
                }
            } else { // URL
                 if (!url.startsWith('http')) {
                    throw new Error(t('errors.invalidUrl'));
                }
                const response = await fetch(url);
                if (!response.ok) {
                    throw new Error(t('errors.urlFetchFailed'));
                }
                // Simplified URL handling, assuming text-based content for now
                content = await response.text();
            }

            if (!content) {
                setError(t('errors.fileEmpty'));
                setIsLoading(false);
                return;
            }

            setProcessedData(dataForChart);
            const { report, suggestions: newSuggestions } = await analyzeDataForGraphSuggestions(content, modelConfig);
            setAnalysisReport(report);
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


    return (
        <div className="p-6 bg-white/40 backdrop-blur-xl border border-white/50 rounded-3xl shadow-2xl shadow-indigo-200/50 flex flex-col gap-6">
            <div className="w-full text-center pb-4 border-b border-gray-300/50">
                <div className="grid grid-cols-2">
                    <div className={`font-semibold ${hasData ? 'text-gray-500' : 'text-indigo-600'}`}>{t('dataToGraph.step1')}</div>
                    <div className={`font-semibold ${hasData ? 'text-indigo-600' : 'text-gray-500'}`}>{t('dataToGraph.step2')}</div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                <div>
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
                <div className="flex flex-col items-center justify-center h-full gap-2">
                    <button
                        onClick={handleDigest}
                        disabled={!file && !url || isLoading}
                        className="w-full h-36 bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-bold py-3 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-md flex items-center justify-center text-lg focus:outline-none focus:ring-4 focus:ring-indigo-300"
                    >
                        {isLoading ? <Loader /> : `✨ ${t('dataToGraph.generateButton')}`}
                    </button>
                    {(file || url) && !isLoading && (
                        <button
                            onClick={handleClear}
                            className="text-sm text-gray-500 hover:text-indigo-600 hover:underline"
                        >
                            Clear
                        </button>
                    )}
                </div>
            </div>

            {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative" role="alert">{error}</div>}

            {suggestions.length > 0 && (
                <div className="flex flex-col">
                    <h2 className="text-xl font-semibold text-gray-700 mb-4 text-center">{t('dataToGraph.step3')}</h2>
                    <div className="prose prose-sm max-w-none bg-white/50 p-4 rounded-lg mb-4 overflow-y-auto max-h-48 border">
                        <pre className="whitespace-pre-wrap font-sans text-sm">{analysisReport}</pre>
                    </div>

                     <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        {suggestions.map((s, i) => (
                            <button
                                key={i}
                                onClick={() => setSelectedSuggestion(s)}
                                className={`p-4 rounded-xl transition-all duration-300 text-left ${selectedSuggestion?.title === s.title ? 'bg-indigo-500 text-white shadow-lg scale-105' : 'bg-white/60 hover:bg-white'}`}
                            >
                                <h3 className="font-semibold text-center">{s.title}</h3>
                            </button>
                        ))}
                    </div>
                    {selectedSuggestion && (
                         <div className="bg-white/60 rounded-xl p-4 min-h-[420px]">
                           <G2Chart key={selectedSuggestion.title} spec={selectedSuggestion.spec} data={processedData} />
                         </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default DataToGraphPanel;