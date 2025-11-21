
import { SongInfo, Source, ProcessStatus, LyricsType, LyricInfo, SearchResult } from '../types';
import { krcDecrypt, qrcDecrypt, qmc1Decrypt } from './decryptor';

const DELAY = (ms: number) => new Promise(res => setTimeout(res, ms));

// Shared state - Acts as a global store
export let MOCK_SONGS: SongInfo[] = [];

declare global {
    interface Window {
        jsmediatags: any;
    }
}

/**
 * 使用 jsmediatags 从文件读取真实元数据
 */
const extractMetadata = (file: File): Promise<{ title?: string; artist?: string; album?: string; coverUrl?: string }> => {
    return new Promise((resolve) => {
        if (!window.jsmediatags) {
            console.warn('jsmediatags not loaded');
            resolve({});
            return;
        }

        window.jsmediatags.read(file, {
            onSuccess: (tag: any) => {
                const tags = tag.tags;
                let coverUrl = undefined;

                if (tags.picture) {
                    const { data, format } = tags.picture;
                    let base64String = "";
                    for (let i = 0; i < data.length; i++) {
                        base64String += String.fromCharCode(data[i]);
                    }
                    coverUrl = `data:${format};base64,${window.btoa(base64String)}`;
                }

                resolve({
                    title: tags.title,
                    artist: tags.artist,
                    album: tags.album,
                    coverUrl
                });
            },
            onError: (error: any) => {
                // console.log('Metadata read error:', error);
                resolve({}); 
            }
        });
    });
};

export const processFileImport = async (files: FileList): Promise<SongInfo[]> => {
    const newSongs: SongInfo[] = [];
    
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // 简单判断是否为加密歌词文件
        if (file.name.endsWith('.krc') || file.name.endsWith('.qrc') || file.name.endsWith('.qmcflac')) {
            // 这里暂不处理纯歌词文件的导入作为歌曲，
            // 实际逻辑应该是关联到已有歌曲，或者作为一个纯文本查看
            // 为了演示，我们这里只处理音频文件导入
        }

        let artist = '未知歌手';
        let title = file.name.replace(/\.[^/.]+$/, "");
        if (title.includes('-')) {
            const parts = title.split('-');
            artist = parts[0].trim();
            title = parts.slice(1).join('-').trim();
        }

        const metadata = await extractMetadata(file);
        
        newSongs.push({
            id: Math.random().toString(36).substring(7),
            title: metadata.title || title,
            artist: metadata.artist || artist,
            album: metadata.album || '未知专辑',
            duration: 0,
            path: file.name, 
            source: Source.Local,
            status: ProcessStatus.IDLE,
            coverUrl: metadata.coverUrl
        });
    }
    
    MOCK_SONGS = [...MOCK_SONGS, ...newSongs];
    return newSongs;
};

export const deleteSongs = (ids: string[]) => {
    MOCK_SONGS = MOCK_SONGS.filter(s => !ids.includes(s.id));
    return MOCK_SONGS;
};

export const getSongById = (id: string) => MOCK_SONGS.find(s => s.id === id);

export const autoFetchLyrics = async (song: SongInfo): Promise<SongInfo> => {
  // 1. 真实搜索 Lrclib
  try {
      const realResults = await searchOnlineLyrics(`${song.artist} ${song.title}`);
      if (realResults.length > 0) {
          // 优先找 Lrclib
          const lrclibMatch = realResults.find(r => r.source === Source.LRCLIB);
          const bestMatch = lrclibMatch || realResults[0];
          
          const updated = {
            ...song,
            status: ProcessStatus.MATCHED,
            source: bestMatch.source,
            lyricsType: bestMatch.type
          };
          MOCK_SONGS = MOCK_SONGS.map(s => s.id === song.id ? updated : s);
          return updated;
      }
  } catch (e) {
      console.error("Auto fetch error", e);
  }

  // 2. 真实搜索失败，状态标记为 FAILED
  await DELAY(200);
  const updated = {
    ...song,
    status: ProcessStatus.FAILED,
    source: Source.MULTI,
  };
  MOCK_SONGS = MOCK_SONGS.map(s => s.id === song.id ? updated : s);
  return updated;
};

export const saveLyricsToTag = async (song: SongInfo): Promise<SongInfo> => {
  // 这是一个纯前端演示，无法真正写入文件系统
  // 但如果要实现，可以使用 File System Access API (Chrome) 或 Capacitor Filesystem
  await DELAY(200); 
  const updated = { ...song, status: ProcessStatus.SAVED };
  MOCK_SONGS = MOCK_SONGS.map(s => s.id === song.id ? updated : s);
  return updated;
};

/**
 * 获取具体歌词内容
 * 
 * 严禁使用模拟数据。
 * 如果是 LRCLIB -> 真实 HTTP 请求
 * 如果是其他 -> 尝试真实请求（浏览器会 CORS 失败，App 可能成功），失败则返回错误。
 */
export const getLyricsContent = async (songId: string, specificLyricId?: string): Promise<LyricInfo | null> => {
    const song = getSongById(songId);
    if (!song) return null;

    // Case 1: LRCLIB
    if (song.source === Source.LRCLIB || (specificLyricId && !specificLyricId.startsWith('local'))) {
        try {
            const query = `${song.artist} ${song.title}`;
            const response = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(query)}`);
            const data = await response.json();
            
            const match = specificLyricId ? data.find((d:any) => d.id.toString() === specificLyricId) : data[0];

            if (match) {
                return {
                    id: match.id.toString(),
                    songId: songId,
                    source: Source.LRCLIB,
                    title: match.trackName,
                    artist: match.artistName,
                    content: match.syncedLyrics || match.plainLyrics || "",
                    type: match.syncedLyrics ? LyricsType.LINEBYLINE : LyricsType.PlainText
                };
            }
        } catch (e) {
            console.error("Lrclib fetch error", e);
        }
        return null;
    }

    // Case 2: Local Encrypted Files (Future feature)
    // 可以在这里添加读取本地文件并调用 krcDecrypt/qrcDecrypt 的逻辑
    
    // Case 3: Other Sources (QM/KG/NE)
    // 由于没有后端代理，且要求不模拟假数据，这里我们只能尝试真实请求
    // 在浏览器环境中这通常会失败，因此直接返回 null，让 UI 显示空白
    
    console.warn("无法直连该源，且禁止模拟数据。请在支持 CORS 的环境或使用 Lrclib。");
    return null;
}

/**
 * 搜索歌词
 * 仅保留真实逻辑
 */
export const searchOnlineLyrics = async (keyword: string): Promise<SearchResult[]> => {
    const results: SearchResult[] = [];

    // 1. 真实请求 Lrclib
    try {
        const response = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(keyword)}`);
        if (response.ok) {
            const data = await response.json();
            data.slice(0, 10).forEach((item: any) => {
                results.push({
                    id: `lrclib-${item.id}`,
                    lyricId: item.id.toString(),
                    title: item.trackName,
                    artist: item.artistName,
                    album: item.albumName,
                    source: Source.LRCLIB,
                    type: item.syncedLyrics ? LyricsType.LINEBYLINE : LyricsType.PlainText
                });
            });
        }
    } catch (e) {
        console.warn("Lrclib search failed", e);
    }

    // 2. QQ/KG/NE 真实请求尝试 (仅示例，实际需解决签名和跨域)
    // 这里不再添加任何 Mock 数据
    
    return results;
};

export const applyLyricsToSong = async (songId: string, result: SearchResult): Promise<void> => {
    await DELAY(100);
    const song = MOCK_SONGS.find(s => s.id === songId);
    if (song) {
        song.status = ProcessStatus.MATCHED;
        song.source = result.source;
        song.lyricsType = result.type;
        MOCK_SONGS = [...MOCK_SONGS];
    }
};
