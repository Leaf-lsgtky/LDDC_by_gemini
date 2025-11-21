import React, { useState } from 'react';
import { Layout } from '../components/Layout';
import { Source } from '../types';

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
    // 基于 LDDC/core/api/lyrics 中的源文件
    const [sources, setSources] = useState<Record<string, boolean>>({
        [Source.QM]: true,     // qm.py
        [Source.KG]: true,     // kg.py
        [Source.NE]: true,     // ne.py
        [Source.LRCLIB]: true, // lrclib.py
    });
    
    const [verbatim, setVerbatim] = useState(true);
    const [autoSave, setAutoSave] = useState(false);

    return (
        <Layout title="设置">
            <div className="mb-6">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 pl-2">歌词来源</h3>
                <div className="bg-gray-900 rounded-xl px-4 border border-gray-800">
                    <Toggle 
                        label="QQ音乐 (QM)" 
                        checked={sources[Source.QM]} 
                        onChange={(v) => setSources(prev => ({ ...prev, [Source.QM]: v }))} 
                    />
                    <Toggle 
                        label="酷狗音乐 (KG)" 
                        checked={sources[Source.KG]} 
                        onChange={(v) => setSources(prev => ({ ...prev, [Source.KG]: v }))} 
                    />
                    <Toggle 
                        label="网易云音乐 (NE)" 
                        checked={sources[Source.NE]} 
                        onChange={(v) => setSources(prev => ({ ...prev, [Source.NE]: v }))} 
                    />
                    <Toggle 
                        label="Lrclib.net" 
                        checked={sources[Source.LRCLIB]} 
                        onChange={(v) => setSources(prev => ({ ...prev, [Source.LRCLIB]: v }))} 
                    />
                </div>
            </div>

            <div className="mb-6">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 pl-2">匹配选项</h3>
                <div className="bg-gray-900 rounded-xl px-4 border border-gray-800">
                    <Toggle 
                        label="优先逐字歌词" 
                        description="优先匹配包含逐字时间戳的歌词(KRC/QRC/ESLYT)"
                        checked={verbatim} 
                        onChange={setVerbatim} 
                    />
                    <div className="py-4 border-b border-gray-800">
                        <div className="flex justify-between mb-2">
                            <span className="text-gray-200">最低匹配分数</span>
                            <span className="text-primary-400 font-mono">60</span>
                        </div>
                        <input type="range" className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary-500" />
                    </div>
                </div>
            </div>

            <div className="mb-6">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 pl-2">自动化</h3>
                <div className="bg-gray-900 rounded-xl px-4 border border-gray-800">
                    <Toggle 
                        label="自动保存" 
                        description="匹配成功后自动写入标签文件"
                        checked={autoSave} 
                        onChange={setAutoSave} 
                    />
                </div>
            </div>

            <div className="text-center mt-8 mb-8">
                 <p className="text-xs text-gray-600">LDDC Mobile v0.9.2</p>
                 <p className="text-[10px] text-gray-700 mt-1">基于 Python Core (LDDC)</p>
            </div>
        </Layout>
    );
};