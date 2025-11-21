
import React, { useEffect, useState } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { Layout } from '../components/Layout';
import { getLyricsContent, getSongById, searchOnlineLyrics, applyLyricsToSong } from '../services/lddcService'; 
import { LyricInfo, SongInfo, Source, SearchResult, LyricsType } from '../types';
import { Icons } from '../components/Icon';

const { useParams } = ReactRouterDOM;

const SourceMap: Record<Source, string> = {
    [Source.MULTI]: '聚合',
    [Source.QM]: 'QQ音乐',
    [Source.KG]: '酷狗',
    [Source.NE]: '网易云',
    [Source.LRCLIB]: 'Lrclib',
    [Source.Local]: '本地'
};

export const LyricsDetail: React.FC = () => {
    const { id } = useParams();
    const [lyrics, setLyrics] = useState<LyricInfo | null>(null);
    const [song, setSong] = useState<SongInfo | undefined>(undefined);
    const [loading, setLoading] = useState(true);
    const [showSearch, setShowSearch] = useState(false);
    
    const loadData = async (specificLyricId?: string) => {
        if(id) {
            const s = getSongById(id);
            setSong(s ? {...s} : undefined); 
            if (s) {
                setLoading(true);
                // Use passed ID or temp ID from auto-match or fallback to song.id
                const l = await getLyricsContent(id, specificLyricId);
                setLyrics(l);
                setLoading(false);
            }
        }
    };

    useEffect(() => {
        loadData();
    }, [id]);

    if (!song) return <div className="text-center mt-20 text-gray-500">未找到歌曲</div>;

    return (
        <Layout title="歌词详情" showBack>
            <div className="flex flex-col items-center mb-6">
                <div className="w-32 h-32 bg-gray-800 rounded-lg shadow-2xl mb-4 overflow-hidden relative">
                     {song.coverUrl ? (
                        <img src={song.coverUrl} className="w-full h-full object-cover" />
                     ) : (
                         <div className="w-full h-full flex items-center justify-center bg-gray-800">
                             <Icons.Music className="w-12 h-12 text-gray-600" />
                         </div>
                     )}
                     <div className="absolute inset-0 border border-white/10 rounded-lg"></div>
                </div>
                <h2 className="text-xl font-bold text-white text-center px-4">{song.title}</h2>
                <p className="text-primary-400">{song.artist}</p>
            </div>

            <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden flex flex-col h-[400px]">
                <div className="flex items-center justify-between px-4 py-3 bg-gray-800/50 border-b border-gray-800">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-gray-400">
                            来源: {lyrics?.source ? SourceMap[lyrics.source] : (song.source ? SourceMap[song.source] : '无')}
                        </span>
                        {lyrics?.type === LyricsType.VERBATIM && (
                            <span className="text-[10px] bg-primary-900/50 text-primary-300 px-1.5 py-0.5 rounded border border-primary-800">逐字</span>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => loadData()} className="p-1.5 bg-gray-700 rounded hover:bg-gray-600" title="重新加载">
                            <Icons.ArrowPath className="w-4 h-4" />
                        </button>
                    </div>
                </div>
                
                <div className="flex-1 p-4 overflow-y-auto font-mono text-sm leading-loose text-gray-300 whitespace-pre-wrap scroll-smooth">
                    {loading ? (
                        <div className="h-full flex items-center justify-center">
                            <Icons.ArrowPath className="w-8 h-8 animate-spin text-gray-600" />
                        </div>
                    ) : lyrics ? (
                        lyrics.content
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-gray-500 gap-2">
                            <span className="text-lg">未找到歌词</span>
                            <span className="text-xs opacity-50">请检查网络连接 (需支持CORS或使用APK)</span>
                        </div>
                    )}
                </div>
            </div>

            <div className="mt-6 flex gap-3 pb-8">
                <button 
                    onClick={() => setShowSearch(true)}
                    className="flex-1 py-3 bg-gray-800 rounded-xl font-semibold text-gray-300 hover:bg-gray-700 transition-colors active:scale-95 duration-200"
                >
                    手动搜索
                </button>
                <button 
                    disabled={!lyrics}
                    className="flex-1 py-3 bg-primary-600 rounded-xl font-bold text-white shadow-lg shadow-primary-900/50 hover:bg-primary-500 transition-colors active:scale-95 duration-200 disabled:opacity-50 disabled:shadow-none"
                >
                    保存到标签
                </button>
            </div>

            {/* Search Modal */}
            {showSearch && (
                <SearchModal 
                    defaultKeyword={`${song.artist} ${song.title}`} 
                    onClose={() => setShowSearch(false)}
                    onSelect={async (result) => {
                        setLoading(true);
                        setShowSearch(false);
                        if (id) {
                            await applyLyricsToSong(id, result);
                            // Pass the lyricId if it exists to fetch correct content immediately
                            loadData(result.lyricId);
                        }
                    }}
                />
            )}
        </Layout>
    );
};

interface SearchModalProps {
    defaultKeyword: string;
    onClose: () => void;
    onSelect: (result: SearchResult) => void;
}

const SearchModal: React.FC<SearchModalProps> = ({ defaultKeyword, onClose, onSelect }) => {
    const [keyword, setKeyword] = useState(defaultKeyword);
    const [results, setResults] = useState<SearchResult[]>([]);
    const [searching, setSearching] = useState(false);

    const handleSearch = async () => {
        if (!keyword.trim()) return;
        setSearching(true);
        const data = await searchOnlineLyrics(keyword);
        setResults(data);
        setSearching(false);
    };

    useEffect(() => {
        handleSearch();
    }, []);

    return (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col animate-in fade-in duration-200">
            <div className="p-4 bg-gray-900 border-b border-gray-800 flex gap-3 items-center">
                <button onClick={onClose}>
                    <Icons.ChevronLeft className="w-6 h-6 text-gray-400" />
                </button>
                <input 
                    className="flex-1 bg-gray-800 border-none rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-primary-500 outline-none"
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
                <button 
                    onClick={handleSearch}
                    className="bg-primary-600 text-white px-4 py-2 rounded-lg font-medium text-sm"
                >
                    搜索
                </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4">
                {searching ? (
                    <div className="flex justify-center pt-20">
                        <Icons.ArrowPath className="w-8 h-8 animate-spin text-primary-500" />
                    </div>
                ) : (
                    <div className="space-y-2">
                        {results.map(res => (
                            <div 
                                key={res.id}
                                onClick={() => onSelect(res)}
                                className="bg-gray-800 p-3 rounded-lg flex items-center justify-between active:bg-gray-700"
                            >
                                <div className="min-w-0 flex-1 mr-2">
                                    <div className="text-sm font-bold text-white truncate">{res.title}</div>
                                    <div className="text-xs text-gray-400 truncate">{res.artist} - {res.album}</div>
                                </div>
                                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                    <span className="text-[10px] bg-gray-700 text-gray-300 px-1.5 rounded">
                                        {SourceMap[res.source]}
                                    </span>
                                    <span className={`text-[10px] px-1.5 rounded ${res.type === LyricsType.VERBATIM ? 'text-primary-300 bg-primary-900/30' : 'text-gray-500'}`}>
                                        {res.type === LyricsType.VERBATIM ? '逐字' : '逐行'}
                                    </span>
                                </div>
                            </div>
                        ))}
                        {results.length === 0 && !searching && (
                            <div className="text-center text-gray-500 pt-20">无搜索结果</div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}