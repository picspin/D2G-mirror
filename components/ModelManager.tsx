
import React, { useState } from 'react';
import { useModel } from '../hooks/useModel';
import { useTranslation } from '../hooks/useTranslation';
import type { ModelProviderType, CustomModelConfig } from '../types';
import { testCustomModelConnection, fetchCustomModels } from '../services/aiService';
import { ReloadIcon } from './icons';

const ModelManager: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const { modelConfig, setModelConfig } = useModel();
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<ModelProviderType>(modelConfig.provider);

    const [customConfig, setCustomConfig] = useState<CustomModelConfig>(
        modelConfig.custom || { baseUrl: '', apiKey: '', model: '' }
    );
    
    const [models, setModels] = useState<string[]>([]);
    const [isLoadingModels, setIsLoadingModels] = useState(false);
    const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle');

    const handleCustomConfigChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setCustomConfig({ ...customConfig, [e.target.name]: e.target.value });
        setTestStatus('idle');
    };

    const handleFetchModels = async () => {
        if (!customConfig.baseUrl || !customConfig.apiKey) return;
        setIsLoadingModels(true);
        setModels([]);
        const fetchedModels = await fetchCustomModels(customConfig);
        setModels(fetchedModels);
        if (fetchedModels.length > 0 && !fetchedModels.includes(customConfig.model)) {
            setCustomConfig(prev => ({ ...prev, model: fetchedModels[0] }));
        }
        setIsLoadingModels(false);
    };

    const handleTest = async () => {
        setTestStatus('testing');
        const success = await testCustomModelConnection(customConfig);
        setTestStatus(success ? 'success' : 'failed');
    };

    const handleSave = () => {
        if (activeTab === 'google') {
            setModelConfig({ provider: 'google' });
        } else {
            setModelConfig({ provider: 'custom', custom: customConfig });
        }
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
            <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-2xl w-full max-w-md p-6 border border-white/50" onClick={e => e.stopPropagation()}>
                <h2 className="text-2xl font-bold text-gray-800 mb-4">{t('modelManager.title')}</h2>
                
                {/* Tabs */}
                <div className="flex border-b border-gray-200 mb-4">
                    <button onClick={() => setActiveTab('google')} className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'google' ? 'border-b-2 border-indigo-500 text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}>
                        Google Gemini
                    </button>
                    <button onClick={() => setActiveTab('custom')} className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'custom' ? 'border-b-2 border-indigo-500 text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}>
                        {t('modelManager.customTab')}
                    </button>
                </div>

                {/* Content */}
                <div>
                    {activeTab === 'google' && (
                        <p className="text-sm text-gray-600 bg-gray-100 p-3 rounded-lg">{t('modelManager.googleDesc')}</p>
                    )}
                    {activeTab === 'custom' && (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">{t('modelManager.apiUrl')}</label>
                                <input type="text" name="baseUrl" value={customConfig.baseUrl} onChange={handleCustomConfigChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400" placeholder="https://api.example.com/v1" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">{t('modelManager.apiKey')}</label>
                                <input type="password" name="apiKey" value={customConfig.apiKey} onChange={handleCustomConfigChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400" placeholder="sk-..." />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">{t('modelManager.modelName')}</label>
                                <div className="flex items-center gap-2">
                                    <select name="model" value={customConfig.model} onChange={handleCustomConfigChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white">
                                        {customConfig.model && !models.includes(customConfig.model) && <option value={customConfig.model}>{customConfig.model}</option>}
                                        {models.map(m => <option key={m} value={m}>{m}</option>)}
                                        {models.length === 0 && !customConfig.model && <option value="">{t('modelManager.fetchModels')}</option>}
                                    </select>
                                    <button onClick={handleFetchModels} disabled={isLoadingModels} className="p-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50">
                                        {isLoadingModels ? <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div> : <ReloadIcon />}
                                    </button>
                                </div>
                                {!isLoadingModels && models.length === 0 && <p className="text-xs text-gray-500 mt-1">{t('modelManager.noModels')}</p>}
                            </div>
                            <div className="flex items-center justify-between">
                               <button onClick={handleTest} disabled={testStatus === 'testing' || !customConfig.model} className="px-4 py-2 text-sm font-semibold text-indigo-600 border border-indigo-300 rounded-lg hover:bg-indigo-50 transition-colors disabled:opacity-50">
                                    {testStatus === 'testing' ? t('modelManager.testing') : t('modelManager.testButton')}
                                </button>
                                {testStatus === 'success' && <span className="text-sm text-green-600">{t('modelManager.testSuccess')}</span>}
                                {testStatus === 'failed' && <span className="text-sm text-red-600">{t('modelManager.testFailed')}</span>}
                            </div>
                        </div>
                    )}
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