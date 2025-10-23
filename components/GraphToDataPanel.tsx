import React, { useState, useCallback } from 'react';
import type { ExtractedDataResponse, OutputFormat } from '../types';
import { analyzeGraphImage } from '../services/aiService';
import Loader from './Loader';
import { useTranslation } from '../hooks/useTranslation';
import { useModel } from '../hooks/useModel';

const blobToBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = (error) => reject(error);
  });

const jsonToCsv = (json: any[]): string => {
  if (!json || json.length === 0) return '';
  const headers = Object.keys(json[0]);
  const csvRows = [
    headers.join(','),
    ...json.map(row => headers.map(header => JSON.stringify(row[header])).join(','))
  ];
  return csvRows.join('\n');
};

const jsonToMarkdown = (json: any[]): string => {
  if (!json || json.length === 0) return '';
  const headers = Object.keys(json[0]);
  const headerRow = `| ${headers.join(' | ')} |`;
  const separatorRow = `| ${headers.map(() => '---').join(' | ')} |`;
  const bodyRows = json.map(row => `| ${headers.map(h => row[h]).join(' | ')} |`).join('\n');
  return `${headerRow}\n${separatorRow}\n${bodyRows}`;
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
        isDragging ? 'border-purple-500 bg-purple-50' : 'border-gray-300 hover:border-purple-400 hover:bg-purple-50/50'
      } ${disabled ? 'cursor-not-allowed bg-gray-100' : ''}`}
    >
      <div className="flex flex-col items-center justify-center pt-5 pb-6">
        <svg className="w-10 h-10 mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
        <p className="mb-2 text-sm text-gray-500"><span className="font-semibold">{t('fileUpload.click')}</span> {t('fileUpload.orDrag')}</p>
        <p className="text-xs text-gray-500">{t('graphToData.fileTypes')}</p>
      </div>
      <input type="file" className="hidden" onChange={handleChange} accept="image/jpeg,image/png,image/gif" disabled={disabled} />
    </label>
  );
};

const DataTable: React.FC<{ data: any[] }> = ({ data }) => {
    const { t } = useTranslation();
    if (!data || data.length === 0) return <p>{t('dataTable.noData')}</p>;
    const headers = Object.keys(data[0]);
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-gray-500">
                <thead className="text-xs text-gray-700 uppercase bg-gray-50/50">
                    <tr>
                        {headers.map(header => <th key={header} scope="col" className="px-6 py-3">{header}</th>)}
                    </tr>
                </thead>
                <tbody>
                    {data.map((row, i) => (
                        <tr key={i} className="bg-white/50 border-b">
                            {headers.map(header => <td key={`${i}-${header}`} className="px-6 py-4">{String(row[header])}</td>)}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

const GraphToDataPanel: React.FC = () => {
    const [file, setFile] = useState<File | null>(null);
    const [url, setUrl] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [extractedData, setExtractedData] = useState<ExtractedDataResponse | null>(null);
    const [outputFormat, setOutputFormat] = useState<OutputFormat>('table');
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const { t } = useTranslation();
    const { modelConfig } = useModel();

    const cleanup = () => {
        setError(null);
        setExtractedData(null);
        if (imagePreview && imagePreview.startsWith('blob:')) {
            URL.revokeObjectURL(imagePreview);
        }
        setImagePreview(null);
    }

    const handleFileUpload = (uploadedFile: File) => {
        cleanup();
        setFile(uploadedFile);
        setUrl('');
        setImagePreview(URL.createObjectURL(uploadedFile));
    };

    const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        cleanup();
        setUrl(e.target.value);
        setFile(null);
        if (e.target.value) {
            setImagePreview(e.target.value);
        }
    }

    const handleDigest = useCallback(async () => {
        if (!file && !url) return;

        setIsLoading(true);
        setError(null);
        setExtractedData(null);

        try {
            let base64Image: string;
            let mimeType: string;

            if (file) {
                base64Image = await blobToBase64(file);
                mimeType = file.type;
            } else {
                 if (!url.startsWith('http')) {
                    throw new Error(t('errors.invalidUrl'));
                }
                const response = await fetch(url);
                if (!response.ok) {
                    throw new Error(t('errors.urlFetchFailed'));
                }
                const blob = await response.blob();
                base64Image = await blobToBase64(blob);
                mimeType = blob.type;
            }
            
            const result = await analyzeGraphImage(base64Image, mimeType, modelConfig);
            
            if (result.isChart) {
                setExtractedData(result);
            } else {
                setError(result.reason || t('errors.notAGraph'));
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : t('errors.unknown'));
        } finally {
            setIsLoading(false);
        }
    }, [file, url, t, modelConfig]);

    return (
        <div className="p-8 bg-white/40 backdrop-blur-xl border border-white/50 rounded-3xl shadow-2xl shadow-purple-200/50 h-full flex flex-col gap-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                <div>
                  <h2 className="text-xl font-semibold text-gray-700 mb-2">{t('graphToData.step1')}</h2>
                  <FileUpload onFileUpload={handleFileUpload} disabled={isLoading} />
                  <div className="relative flex py-2 items-center">
                        <div className="flex-grow border-t border-gray-300"></div>
                        <span className="flex-shrink mx-4 text-gray-400 text-sm">OR</span>
                        <div className="flex-grow border-t border-gray-300"></div>
                    </div>
                     <input
                        type="text"
                        placeholder={t('urlInput.placeholderImage')}
                        value={url}
                        onChange={handleUrlChange}
                        disabled={isLoading}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 disabled:bg-gray-100"
                    />
                </div>
                 <div className="flex flex-col h-full">
                    <h2 className="text-xl font-semibold text-gray-700 mb-2">{t('graphToData.step2')}</h2>
                    <div className="flex-grow flex items-center">
                        <button
                            onClick={handleDigest}
                            disabled={!file && !url || isLoading}
                            className="w-full h-24 bg-gradient-to-br from-purple-500 to-pink-500 text-white font-bold py-3 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-md flex items-center justify-center text-lg focus:outline-none focus:ring-4 focus:ring-purple-300"
                        >
                            {isLoading ? <Loader /> : `🔎 ${t('graphToData.extractButton')}`}
                        </button>
                    </div>
                </div>
            </div>

            {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative" role="alert">{error}</div>}

            {(imagePreview && !extractedData && !error) && (
                 <div className="flex-grow flex flex-col items-center justify-center bg-gray-50/50 rounded-xl p-4">
                    <h3 className="text-lg font-semibold text-gray-600 mb-4">{t('graphToData.preview')}</h3>
                    <img src={imagePreview} alt={t('graphToData.previewAlt')} className="max-h-64 rounded-lg shadow-md" />
                </div>
            )}
            
            {extractedData?.data && (
                <div className="flex-grow flex flex-col min-h-0 bg-white/60 p-4 rounded-xl">
                    <h2 className="text-xl font-semibold text-gray-700 mb-3">{t('graphToData.step3')}</h2>
                    <div className="flex items-center gap-2 mb-3">
                        {(['table', 'json', 'csv', 'markdown'] as OutputFormat[]).map(format => (
                            <button
                                key={format}
                                onClick={() => setOutputFormat(format)}
                                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${outputFormat === format ? 'bg-purple-500 text-white' : 'bg-white hover:bg-purple-100'}`}
                            >
                                {format.toUpperCase()}
                            </button>
                        ))}
                    </div>
                    <div className="flex-grow overflow-auto rounded-lg border border-gray-200">
                        {outputFormat === 'table' && <DataTable data={extractedData.data} />}
                        {outputFormat === 'json' && <pre className="p-4 bg-gray-800 text-white rounded-lg text-sm"><code>{JSON.stringify(extractedData.data, null, 2)}</code></pre>}
                        {outputFormat === 'csv' && <pre className="p-4 bg-white rounded-lg text-sm"><code>{jsonToCsv(extractedData.data)}</code></pre>}
                        {outputFormat === 'markdown' && <pre className="p-4 bg-white rounded-lg text-sm"><code>{jsonToMarkdown(extractedData.data)}</code></pre>}
                    </div>
                </div>
            )}
        </div>
    );
};

export default GraphToDataPanel;