
import React from 'react';
import { SongInfo, ProcessStatus, LyricsType, Source } from '../types';
import { Icons } from './Icon';

interface SongCardProps {
  song: SongInfo;
  onClick: () => void;
  onRetry: () => void;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (selected: boolean) => void;
}

const SourceMap: Record<Source, string> = {
    [Source.MULTI]: '聚合',
    [Source.QM]: 'QQ音乐',
    [Source.KG]: '酷狗',
    [Source.NE]: '网易云',
    [Source.LRCLIB]: 'Lrclib',
    [Source.Local]: '本地'
};

export const SongCard: React.FC<SongCardProps> = ({ song, onClick, onRetry, selectable, selected, onSelect }) => {
  const getStatusIcon = () => {
    switch (song.status) {
      case ProcessStatus.MATCHED:
      case ProcessStatus.SAVED:
        return <Icons.CheckCircle className="w-6 h-6 text-green-400" />;
      case ProcessStatus.FAILED:
        return <Icons.XCircle className="w-6 h-6 text-red-400" />;
      case ProcessStatus.SEARCHING:
      case ProcessStatus.SCANNING:
        return <Icons.ArrowPath className="w-6 h-6 text-primary-400 animate-spin" />;
      default:
        return null;
    }
  };

  const isProcessing = song.status === ProcessStatus.SEARCHING || song.status === ProcessStatus.SCANNING;

  const handleCardClick = () => {
      if (selectable && onSelect) {
          onSelect(!selected);
      } else {
          onClick();
      }
  };

  return (
    <div 
        onClick={handleCardClick}
        className={`relative flex items-center gap-4 p-3 mb-3 rounded-xl bg-gray-850 border active:scale-[0.98] transition-all duration-100 
        ${selected ? 'border-primary-500 bg-primary-900/10' : 'border-gray-800'}
        ${song.status === ProcessStatus.FAILED && !selected ? 'border-red-900/30' : ''}`}
    >
      {/* Selection Checkbox */}
      {selectable && (
          <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${selected ? 'bg-primary-500 border-primary-500' : 'border-gray-600 bg-gray-800'}`}>
              {selected && <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg>}
          </div>
      )}

      {/* Album Art Placeholder */}
      <div className="relative flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden bg-gray-700">
        {song.coverUrl ? (
            <img src={song.coverUrl} alt={song.album} className="w-full h-full object-cover" />
        ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-500">
                <Icons.Music className="w-8 h-8" />
            </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <h3 className={`text-sm font-semibold truncate ${selected ? 'text-primary-200' : 'text-gray-100'}`}>{song.title}</h3>
        <p className="text-xs text-gray-400 truncate">{song.artist}</p>
        
        <div className="flex items-center gap-2 mt-1">
            {song.status === ProcessStatus.MATCHED || song.status === ProcessStatus.SAVED ? (
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${song.lyricsType === LyricsType.VERBATIM ? 'bg-primary-900/50 text-primary-300 border border-primary-800' : 'bg-gray-700 text-gray-300'}`}>
                    {song.lyricsType === LyricsType.VERBATIM ? '逐字' : '逐行'}
                </span>
            ) : null}
            {song.source && song.status !== ProcessStatus.FAILED && song.source !== Source.Local && (
                <span className="text-[10px] text-gray-500 uppercase tracking-wider">{SourceMap[song.source]}</span>
            )}
        </div>
      </div>

      {/* Status Action (Hidden in selection mode) */}
      {!selectable && (
          <div className="flex-shrink-0">
            {song.status === ProcessStatus.FAILED ? (
                <button 
                    onClick={(e) => {
                        e.stopPropagation();
                        onRetry();
                    }}
                    className="p-2 bg-gray-800 rounded-full hover:bg-gray-700"
                >
                    <Icons.ArrowPath className="w-5 h-5 text-gray-400" />
                </button>
            ) : (
                getStatusIcon()
            )}
          </div>
      )}
      
      {/* Progress Bar Line */}
      {isProcessing && (
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-800 rounded-b-xl overflow-hidden">
              <div className="h-full bg-primary-500 animate-pulse-fast w-full origin-left"></div>
          </div>
      )}
    </div>
  );
};
