
import React, { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { Source } from '../types';
import { getConfig, updateConfig } from '../services/lddcService';

const Toggle: React.FC<{ label: string; description?: string; checked: boolean; onChange: (v: boolean) => void }> = ({ label, description, checked, onChange }) => (
    <div className="flex items-center justify-between py-4 border-b border-gray-800 last:border-0">
        <div>
            <div className="font-medium text-gray-200">{label}</div>
            {description && <div className="text-xs text-gray-500 mt-0.5">{description}</div>}
        </div>
        <button 
            onClick={() => onChange(!checked)}
            className={`w-12 h-6 rounded-full relative transition-colors duration-200 ${checked ? 'bg-primary-600' : 'bg-gray-700'}`}
        >
            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-200 ${checked ? 'left-7' : 'left-1'}`} />
        </button>
    </div>
);

export const Settings: React.FC = () => {
    const [config, setConfig] = useState(getConfig());

    // Update local state and persist immediately
    const handleSourceChange = (source: Source, val: boolean) => {
        const newConfig = { ...config, sources: { ...config.sources, [source]: val } };
        setConfig(newConfig);
        updateConfig(newConfig);
    };

    const handleAutoSaveChange = (val: boolean) => {
        const newConfig = { ...config, autoSave: val };
        setConfig(newConfig);
        updateConfig(newConfig);
    };

    return (
        <Layout title="设置">
            <div className="mb-6">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 pl-2">歌词来源</h3>
                <div className="bg-gray-900 rounded-xl px-4 border border-gray-800">
                    <Toggle 
                        label="QQ音乐 (QM)" 
                        checked={config.sources[Source.QM]} 
                        onChange={(v) => handleSourceChange(Source.QM, v)} 
                    />
                    <Toggle 
                        label="酷狗音乐 (KG)" 
                        checked={config.sources[Source.KG]} 
                        onChange={(v) => handleSourceChange(Source.KG, v)} 
                    />
                    <Toggle 
                        label="网易云音乐 (NE)" 
                        checked={config.sources[Source.NE]} 
                        onChange={(v) => handleSourceChange(Source.NE, v)} 
                    />
                    <Toggle 
                        label="Lrclib.net" 
                        checked={config.sources[Source.LRCLIB]} 
                        onChange={(v) => handleSourceChange(Source.LRCLIB, v)} 
                    />
                </div>
            </div>

            <div className="mb-6">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 pl-2">自动化</h3>
                <div className="bg-gray-900 rounded-xl px-4 border border-gray-800">
                    <Toggle 
                        label="自动保存" 
                        description="匹配成功后自动写入标签文件"
                        checked={config.autoSave} 
                        onChange={handleAutoSaveChange} 
                    />
                </div>
            </div>

            <div className="text-center mt-8 mb-8">
                 <p className="text-xs text-gray-600">LDDC Mobile v0.9.3</p>
                 <p className="text-[10px] text-gray-700 mt-1">基于 Python Core (LDDC)</p>
            </div>
        </Layout>
    );
};
