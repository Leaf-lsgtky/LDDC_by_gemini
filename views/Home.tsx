
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { SongCard } from '../components/SongCard';
import { processFileImport, autoFetchLyrics, saveLyricsToTag, MOCK_SONGS, deleteSongs } from '../services/lddcService';
import { SongInfo, ProcessStatus } from '../types';
import { Icons } from '../components/Icon';

export const Home: React.FC = () => {
    // Initialize from GLOBAL MOCK_SONGS to ensure persistence when navigating back
    const [songs, setSongs] = useState<SongInfo[]>(MOCK_SONGS);
    const [processing, setProcessing] = useState(false);
    
    // Selection State
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const fileInputRef = useRef<HTMLInputElement>(null);
    const navigate = useNavigate();

    // Sync local state with global state whenever Home mounts or re-renders
    useEffect(() => {
        setSongs(MOCK_SONGS);
    }, []);

    const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        const newSongs = await processFileImport(files);
        setSongs([...MOCK_SONGS]); // Refresh from global store
        event.target.value = '';
    };

    const processQueue = async () => {
        setProcessing(true);
        // Only process songs that haven't been matched yet
        const queue = MOCK_SONGS.filter(s => s.status === ProcessStatus.IDLE || s.status === ProcessStatus.FAILED);
        
        for (const song of queue) {
            // Update UI to searching
            updateSongStatus(song.id, { ...song, status: ProcessStatus.SEARCHING });
            
            const updated = await autoFetchLyrics(song);
            
            let finalState = updated;
            if (updated.status === ProcessStatus.MATCHED) {
                 finalState = await saveLyricsToTag(updated);
            }
            updateSongStatus(song.id, finalState);
        }
        setProcessing(false);
    };

    // Helper to update both Global and Local state
    const updateSongStatus = (id: string, newSong: SongInfo) => {
        const index = MOCK_SONGS.findIndex(s => s.id === id);
        if (index !== -1) {
            MOCK_SONGS[index] = newSong;
            setSongs([...MOCK_SONGS]);
        }
    };

    const retrySong = async (id: string) => {
        const song = songs.find(s => s.id === id);
        if(!song) return;
        updateSongStatus(id, { ...song, status: ProcessStatus.SEARCHING });
        const updated = await autoFetchLyrics(song);
        updateSongStatus(id, updated);
    };

    // Selection Logic
    const toggleSelectionMode = () => {
        setIsSelectionMode(!isSelectionMode);
        setSelectedIds(new Set());
    };

    const toggleSelect = (id: string, selected: boolean) => {
        const newSet = new Set(selectedIds);
        if (selected) {
            newSet.add(id);
        } else {
            newSet.delete(id);
        }
        setSelectedIds(newSet);
    };

    const handleDelete = () => {
        if (window.confirm(`确定要删除选中的 ${selectedIds.size} 首歌曲吗？`)) {
            const remaining = deleteSongs(Array.from(selectedIds));
            setSongs([...remaining]);
            setIsSelectionMode(false);
            setSelectedIds(new Set());
        }
    };

    const handleSelectAll = () => {
        if (selectedIds.size === songs.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(songs.map(s => s.id)));
        }
    };

    const stats = {
        total: songs.length,
        success: songs.filter(s => s.status === ProcessStatus.SAVED || s.status === ProcessStatus.MATCHED).length,
        failed: songs.filter(s => s.status === ProcessStatus.FAILED).length
    };

    return (
        <Layout 
            title="我的音乐" 
            action={
                <div className="flex gap-2">
                    {songs.length > 0 && (
                        <button onClick={toggleSelectionMode} className={`p-2 rounded-full transition-colors ${isSelectionMode ? 'bg-primary-600 text-white' : 'bg-gray-800 hover:bg-gray-700 text-gray-300'}`}>
                            {isSelectionMode ? <Icons.CheckCircle className="w-5 h-5" /> : <Icons.Cog className="w-5 h-5" />}
                        </button>
                    )}
                    <button onClick={() => fileInputRef.current?.click()} className="p-2 bg-gray-800 rounded-full hover:bg-gray-700 transition-colors">
                        <Icons.Folder className="w-5 h-5 text-gray-300" />
                    </button>
                </div>
            }
        >
            <input 
                type="file" 
                multiple 
                accept="audio/*" 
                className="hidden" 
                ref={fileInputRef} 
                onChange={handleFileSelect} 
            />

            {/* Stats Dashboard (Hidden in Selection Mode) */}
            {!isSelectionMode && (
                <div className="grid grid-cols-3 gap-3 mb-6">
                    <div className="bg-gray-900 p-3 rounded-xl border border-gray-800">
                        <div className="text-xs text-gray-500 uppercase font-bold">总数</div>
                        <div className="text-xl font-bold text-white">{stats.total}</div>
                    </div>
                    <div className="bg-gray-900 p-3 rounded-xl border border-gray-800">
                        <div className="text-xs text-gray-500 uppercase font-bold">已匹配</div>
                        <div className="text-xl font-bold text-primary-400">{stats.success}</div>
                    </div>
                    <div className="bg-gray-900 p-3 rounded-xl border border-gray-800">
                        <div className="text-xs text-gray-500 uppercase font-bold">失败</div>
                        <div className="text-xl font-bold text-orange-400">{stats.failed}</div>
                    </div>
                </div>
            )}

            {/* Selection Header */}
            {isSelectionMode && (
                <div className="flex items-center justify-between mb-4 px-2">
                    <div className="text-sm text-gray-300">已选择 {selectedIds.size} 项</div>
                    <button onClick={handleSelectAll} className="text-primary-400 text-sm font-medium">
                        {selectedIds.size === songs.length ? '取消全选' : '全选'}
                    </button>
                </div>
            )}

            {/* Song List */}
            <div className="pb-24">
                {songs.map(song => (
                    <SongCard 
                        key={song.id} 
                        song={song} 
                        onClick={() => navigate(`/lyrics/${song.id}`)}
                        onRetry={() => retrySong(song.id)}
                        selectable={isSelectionMode}
                        selected={selectedIds.has(song.id)}
                        onSelect={(selected) => toggleSelect(song.id, selected)}
                    />
                ))}
                
                {songs.length === 0 && (
                    <div className="text-center mt-20 text-gray-500">
                        <Icons.Folder className="w-16 h-16 mx-auto mb-4 opacity-20" />
                        <p>点击右上角文件夹图标</p>
                        <button onClick={() => fileInputRef.current?.click()} className="mt-2 text-primary-400 text-sm font-semibold">
                            导入本地歌曲
                        </button>
                        <p className="text-xs text-gray-600 mt-4 max-w-xs mx-auto">
                            支持读取 ID3 标签 (封面、歌手、歌名)<br/>
                            支持识别 QMC/KRC 加密文件
                        </p>
                    </div>
                )}
            </div>

            {/* Floating Action Button (Normal Mode) */}
            {songs.length > 0 && !processing && !isSelectionMode && (
                <div className="fixed bottom-20 right-6 z-40">
                    <button 
                        onClick={processQueue}
                        className="bg-primary-600 hover:bg-primary-500 text-white rounded-full p-4 shadow-lg shadow-primary-900/50 transition-all active:scale-90"
                    >
                        <Icons.ArrowPath className="w-6 h-6" />
                    </button>
                </div>
            )}

            {/* Action Bar (Selection Mode) */}
            {isSelectionMode && (
                <div className="fixed bottom-6 left-6 right-6 z-40 flex gap-3">
                    <button 
                        onClick={() => setIsSelectionMode(false)}
                        className="flex-1 bg-gray-800 text-gray-300 py-3 rounded-xl font-medium shadow-lg border border-gray-700"
                    >
                        取消
                    </button>
                    <button 
                        onClick={handleDelete}
                        disabled={selectedIds.size === 0}
                        className="flex-1 bg-red-600 text-white py-3 rounded-xl font-medium shadow-lg shadow-red-900/50 disabled:opacity-50 disabled:shadow-none"
                    >
                        删除 ({selectedIds.size})
                    </button>
                </div>
            )}
        </Layout>
    );
};
