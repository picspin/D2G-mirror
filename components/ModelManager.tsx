import React, { useState, useEffect } from 'react';
import { useModel } from '../hooks/useModel';
import { useTranslation } from '../hooks/useTranslation';
import type { ModelConfig, CustomModelConfig, ProviderConfig } from '../types';
import { testCustomModelConnection, fetchCustomModels } from '../services/aiService';
import { ReloadIcon } from './icons';

type ConfigurationTarget = 'dataToGraph' | 'graphToData';

const ModelManager: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const { modelConfig, setModelConfig } = useModel();
    const { t } = useTranslation();
    
    const [configuring, setConfiguring] = useState<ConfigurationTarget>('dataToGraph');
    const [localConfigs, setLocalConfigs] = useState<ModelConfig>(JSON.parse(JSON.stringify(modelConfig))); // Deep copy
    
    const [models, setModels] = useState<string[]>([]);
    const [isLoadingModels, setIsLoadingModels] = useState(false);
    const [fetchModelsError, setFetchModelsError] = useState<string | null>(null);
    const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle');
    const [testMessage, setTestMessage] = useState<string>('');

    // Reset state when the configuration target changes
    useEffect(() => {
        setModels([]);
        setTestStatus('idle');
        setTestMessage('');
        setFetchModelsError(null);
    }, [configuring]);
    
    const currentProviderConfig = localConfigs[configuring];
    const currentCustomConfig = currentProviderConfig.custom || { baseUrl: '', apiKey: '', model: '' };

    const handleProviderTabClick = (provider: 'google' | 'custom') => {
        setLocalConfigs(prev => ({
            ...prev,
            [configuring]: { ...prev[configuring], provider }
        }));
        setTestStatus('idle');
    };

    const handleCustomConfigChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setLocalConfigs(prev => ({
            ...prev,
            [configuring]: {
                ...prev[configuring],
                custom: {
                    ...(prev[configuring].custom || { baseUrl: '', apiKey: '', model: '' }),
                    [name]: value
                }
            }
        }));
        setTestStatus('idle');
        setFetchModelsError(null);
    };

    const handleFetchModels = async () => {
        if (!currentCustomConfig.baseUrl || !currentCustomConfig.apiKey) return;
        setIsLoadingModels(true);
        setFetchModelsError(null);
        setModels([]);
        try {
            const fetchedModels = await fetchCustomModels(currentCustomConfig);
            setModels(fetchedModels);
            if (fetchedModels.length > 0 && !fetchedModels.includes(currentCustomConfig.model)) {
                handleCustomConfigChange({ target: { name: 'model', value: fetchedModels[0] } } as any);
            }
        } catch (error) {
            setFetchModelsError(error instanceof Error ? error.message : "An unknown error occurred.");
        } finally {
            setIsLoadingModels(false);
        }
    };

    const handleTest = async () => {
        setTestStatus('testing');
        setTestMessage('');
        try {
            await testCustomModelConnection(currentCustomConfig);
            setTestStatus('success');
            setTestMessage(t('modelManager.testSuccess'));
        } catch (error) {
            setTestStatus('failed');
            setTestMessage(error instanceof Error ? error.message : t('modelManager.testFailed'));
        }
    };

    const handleSave = () => {
        setModelConfig(localConfigs);
        onClose();
    };

    const CustomModelPanel = (
         <div className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('modelManager.apiUrl')}</label>
                <input type="text" name="baseUrl" value={currentCustomConfig.baseUrl} onChange={handleCustomConfigChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400" placeholder="https://api.example.com/v1" />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('modelManager.apiKey')}</label>
                <input type="password" name="apiKey" value={currentCustomConfig.apiKey} onChange={handleCustomConfigChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400" placeholder="sk-..." />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('modelManager.modelName')}</label>
                <div className="flex items-center gap-2">
                    <select name="model" value={currentCustomConfig.model} onChange={handleCustomConfigChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white">
                        {currentCustomConfig.model && !models.includes(currentCustomConfig.model) && <option value={currentCustomConfig.model}>{currentCustomConfig.model}</option>}
                        {models.map(m => <option key={m} value={m}>{m}</option>)}
                        {models.length === 0 && !currentCustomConfig.model && <option value="">{t('modelManager.fetchModels')}</option>}
                    </select>
                    <button onClick={handleFetchModels} disabled={isLoadingModels} className="p-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50">
                        {isLoadingModels ? <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div> : <ReloadIcon />}
                    </button>
                </div>
                {fetchModelsError && <p className="text-xs text-red-600 mt-1">{fetchModelsError}</p>}
                {!isLoadingModels && models.length === 0 && !fetchModelsError && <p className="text-xs text-gray-500 mt-1">{t('modelManager.noModels')}</p>}
            </div>
            <div className="flex items-center justify-between">
                <button onClick={handleTest} disabled={testStatus === 'testing' || !currentCustomConfig.model} className="px-4 py-2 text-sm font-semibold text-indigo-600 border border-indigo-300 rounded-lg hover:bg-indigo-50 transition-colors disabled:opacity-50">
                    {testStatus === 'testing' ? t('modelManager.testing') : t('modelManager.testButton')}
                </button>
                {testStatus === 'success' && <span className="text-sm text-green-600">{testMessage}</span>}
                {testStatus === 'failed' && <span className="text-sm text-red-600">{testMessage}</span>}
            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
            <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-2xl w-full max-w-lg p-6 border border-white/50" onClick={e => e.stopPropagation()}>
                <h2 className="text-2xl font-bold text-gray-800 mb-4">{t('modelManager.title')}</h2>

                {/* Main Feature Tabs */}
                <div className="flex bg-gray-200/50 rounded-lg p-1 mb-4">
                    <button onClick={() => setConfiguring('dataToGraph')} className={`w-1/2 px-4 py-2 text-sm font-semibold rounded-md transition-all ${configuring === 'dataToGraph' ? 'bg-white shadow text-indigo-600' : 'text-gray-600'}`}>
                        {t('modelManager.configureDataToGraph')}
                    </button>
                    <button onClick={() => setConfiguring('graphToData')} className={`w-1/2 px-4 py-2 text-sm font-semibold rounded-md transition-all ${configuring === 'graphToData' ? 'bg-white shadow text-purple-600' : 'text-gray-600'}`}>
                         {t('modelManager.configureGraphToData')}
                    </button>
                </div>

                {/* Provider Tabs */}
                <div className="flex border-b border-gray-200 mb-4">
                    <button onClick={() => handleProviderTabClick('google')} className={`px-4 py-2 text-sm font-medium transition-colors ${currentProviderConfig.provider === 'google' ? 'border-b-2 border-indigo-500 text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}>
                        Google Gemini
                    </button>
                    <button onClick={() => handleProviderTabClick('custom')} className={`px-4 py-2 text-sm font-medium transition-colors ${currentProviderConfig.provider === 'custom' ? 'border-b-2 border-indigo-500 text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}>
                        {t('modelManager.customTab')}
                    </button>
                </div>

                {/* Content */}
                <div className="min-h-[290px]">
                    {currentProviderConfig.provider === 'google' && (
                        <p className="text-sm text-gray-600 bg-gray-100 p-3 rounded-lg">
                            {configuring === 'dataToGraph' ? t('modelManager.googleDescData') : t('modelManager.googleDescGraph')}
                        </p>
                    )}
                    {currentProviderConfig.provider === 'custom' && CustomModelPanel}
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors">
                        {t('modelManager.cancel')}
                    </button>
                    <button onClick={handleSave} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors">
                        {t('modelManager.save')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ModelManager;