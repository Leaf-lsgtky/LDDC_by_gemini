
import { SongInfo, Source, ProcessStatus, LyricsType, LyricInfo, SearchResult } from '../types';
import { krcDecrypt, qrcDecrypt } from './decryptor';

// ==========================================
// Configuration & Persistence
// ==========================================

let CONFIG = {
    sources: {
        [Source.QM]: localStorage.getItem('cfg_source_qm') !== 'false',
        [Source.KG]: localStorage.getItem('cfg_source_kg') !== 'false',
        [Source.NE]: localStorage.getItem('cfg_source_ne') !== 'false',
        [Source.LRCLIB]: localStorage.getItem('cfg_source_lrclib') !== 'false',
    },
    minScore: parseInt(localStorage.getItem('cfg_min_score') || '60'),
    autoSave: localStorage.getItem('cfg_auto_save') === 'true'
};

export const updateConfig = (newConfig: typeof CONFIG) => {
    CONFIG = newConfig;
    localStorage.setItem('cfg_source_qm', String(newConfig.sources[Source.QM]));
    localStorage.setItem('cfg_source_kg', String(newConfig.sources[Source.KG]));
    localStorage.setItem('cfg_source_ne', String(newConfig.sources[Source.NE]));
    localStorage.setItem('cfg_source_lrclib', String(newConfig.sources[Source.LRCLIB]));
    localStorage.setItem('cfg_min_score', String(newConfig.minScore));
    localStorage.setItem('cfg_auto_save', String(newConfig.autoSave));
};

export const getConfig = () => CONFIG;

// ==========================================
// Global State & Helpers
// ==========================================
import { krcDecrypt, qrcDecrypt } from './decryptor';

// ==========================================
// Configuration & Persistence
// ==========================================

let CONFIG = {
    sources: {
        [Source.QM]: localStorage.getItem('cfg_source_qm') !== 'false',
        [Source.KG]: localStorage.getItem('cfg_source_kg') !== 'false',
        [Source.NE]: localStorage.getItem('cfg_source_ne') !== 'false',
        [Source.LRCLIB]: localStorage.getItem('cfg_source_lrclib') !== 'false',
    },
    minScore: parseInt(localStorage.getItem('cfg_min_score') || '60'),
    autoSave: localStorage.getItem('cfg_auto_save') === 'true'
};

export const updateConfig = (newConfig: typeof CONFIG) => {
    CONFIG = newConfig;
    localStorage.setItem('cfg_source_qm', String(newConfig.sources[Source.QM]));
    localStorage.setItem('cfg_source_kg', String(newConfig.sources[Source.KG]));
    localStorage.setItem('cfg_source_ne', String(newConfig.sources[Source.NE]));
    localStorage.setItem('cfg_source_lrclib', String(newConfig.sources[Source.LRCLIB]));
    localStorage.setItem('cfg_min_score', String(newConfig.minScore));
    localStorage.setItem('cfg_auto_save', String(newConfig.autoSave));
};

export const getConfig = () => CONFIG;

// ==========================================
// Global State & Helpers
// ==========================================

const DELAY = (ms: number) => new Promise(res => setTimeout(res, ms));
export let MOCK_SONGS: SongInfo[] = [];

declare global {
    interface Window {
        jsmediatags: any;
    }
    var CryptoJS: any;
    var CryptoJS: any;
}

// ==========================================
// API 1: Kugou (KG) - Ported from kg.py
// ==========================================
const KG_SALT = "LnT6xpN3khm36zse0QzvmgTZ3waWdRSA";

const signKG = (params: Record<string, any>) => {
    if (typeof CryptoJS === 'undefined') return "";
    const keys = Object.keys(params).sort();
    let str = KG_SALT;
    for (const k of keys) {
        str += `${k}=${params[k]}`;
    }
    str += KG_SALT;
    return CryptoJS.MD5(str).toString();
};

const searchKG = async (keyword: string): Promise<SearchResult[]> => {
    if (!CONFIG.sources[Source.KG]) return [];
    if (typeof CryptoJS === 'undefined') return []; // Safety check

    try {
        const params = {
            appid: "3116",
            clienttime: Math.floor(Date.now() / 1000),
            clientver: "11070",
            dfid: "-",
            keyword: keyword,
            mid: CryptoJS.MD5(Date.now().toString()).toString(),
            page: 1,
            pagesize: 20,
            platform: "AndroidFilter",
            userid: "0",
            uuid: "-",
            sorttype: 0
        };
        
        const signature = signKG(params);
        const query = new URLSearchParams({ ...params, signature } as any).toString();
        
        const response = await fetch(`http://complexsearch.kugou.com/v2/search/song?${query}`, {
            method: 'GET',
            headers: {
                'User-Agent': 'Android14-1070-11070-201-0-SearchSong-wifi',
                'KG-RC': '1',
                'KG-Thrift-Client': '1'
            }
        });

        const data = await response.json();
        if (data.status === 1 && data.data && data.data.lists) {
            return data.data.lists.map((item: any) => ({
                id: `kg-${item.ID}`, 
                lyricId: item.FileHash, // KG uses Hash for lyrics
                title: item.SongName,
                artist: item.SingerName,
                album: item.AlbumName,
                source: Source.KG,
                type: LyricsType.VERBATIM 
            }));
        }
    } catch (e) {
        console.warn("KG Search Error", e);
    }
    return [];
};

const getLyricsKG = async (hash: string, songInfo: any): Promise<LyricInfo | null> => {
    if (typeof CryptoJS === 'undefined') return null;
    try {
        // 1. Search candidates
        const searchParams = {
            appid: "3116",
            clienttime: Math.floor(Date.now() / 1000),
            clientver: "11070",
            duration: songInfo.duration || 0,
            hash: hash,
            keyword: `${songInfo.artist} - ${songInfo.title}`,
            mid: CryptoJS.MD5(Date.now().toString()).toString(),
            man: "no",
            userid: "0"
        };
        const searchSig = signKG(searchParams);
        const searchUrl = `https://lyrics.kugou.com/v1/search?${new URLSearchParams({ ...searchParams, signature: searchSig } as any)}`;
        
        const searchResp = await fetch(searchUrl);
        const searchData = await searchResp.json();
        
        if (searchData.status === 200 && searchData.candidates && searchData.candidates.length > 0) {
            const bestMatch = searchData.candidates[0];
            
            // 2. Download
            const downloadParams = {
                accesskey: bestMatch.accesskey,
                appid: "3116",
                charset: "utf8",
                client: "mobi",
                clientver: "11070",
                fmt: "krc",
                id: bestMatch.id,
                userid: "0",
                ver: 1
            };
            const downloadSig = signKG(downloadParams);
            const downloadUrl = `http://lyrics.kugou.com/download?${new URLSearchParams({ ...downloadParams, signature: downloadSig } as any)}`;
            
            const dlResp = await fetch(downloadUrl);
            const dlData = await dlResp.json();
            
            if (dlData.status === 200 && dlData.content) {
                const binaryString = atob(dlData.content);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                
                let content = "";
                if (dlData.fmt === 'krc') {
                    content = krcDecrypt(bytes);
                } else {
                    content = new TextDecoder('utf-8').decode(bytes);
                }

                return {
                    id: bestMatch.id,
                    songId: songInfo.id,
                    source: Source.KG,
                    title: songInfo.title,
                    artist: songInfo.artist,
                    content: content,
                    type: LyricsType.VERBATIM
                };
            }
        }
    } catch (e) {
        console.warn("KG Lyrics Error", e);
    }
    return null;
}


// ==========================================
// API 2: QQ Music (QM) - Ported from qm.py
// ==========================================

const searchQM = async (keyword: string): Promise<SearchResult[]> => {
    if (!CONFIG.sources[Source.QM]) return [];
    try {
        const body = {
            comm: {
                ct: 11,
                cv: "1003006",
                v: "1003006",
                tmeAppID: "qqmusiclight",
                nettype: "NETWORK_WIFI",
                udid: "0"
            },
            request: {
                method: "DoSearchForQQMusicLite",
                module: "music.search.SearchCgiService",
                param: {
                    search_id: Math.random().toString().replace('0.',''),
                    remoteplace: "search.android.keyboard",
                    query: keyword,
                    search_type: 0,
                    num_per_page: 20,
                    page_num: 1,
                    highlight: 0,
                    nqc_flag: 0,
                    page_id: 1,
                    grp: 1
                }
            }
        };

        const response = await fetch("https://u.y.qq.com/cgi-bin/musicu.fcg", {
            method: "POST",
            body: JSON.stringify(body)
        });
        
        const data = await response.json();
        const songList = data.request?.data?.body?.item_song || [];
        
        return songList.map((item: any) => ({
            id: `qm-${item.id}`,
            lyricId: item.id.toString(),
            title: item.title,
            artist: item.singer?.map((s:any) => s.name).join('/'),
            album: item.album?.name,
            source: Source.QM,
            type: LyricsType.VERBATIM
        }));

    } catch (e) {
        console.warn("QM Search Error", e);
    }
    return [];
};

const getLyricsQM = async (songId: string, songInfo: any): Promise<LyricInfo | null> => {
    try {
        const body = {
            comm: {
                ct: 11,
                cv: "1003006",
                v: "1003006",
                tmeAppID: "qqmusiclight",
                nettype: "NETWORK_WIFI",
                udid: "0"
            },
            request: {
                method: "GetPlayLyricInfo",
                module: "music.musichallSong.PlayLyricInfo",
                param: {
                    songID: parseInt(songId),
                    songName: btoa(unescape(encodeURIComponent(songInfo.title))), // Base64 Encode
                    albumName: btoa(unescape(encodeURIComponent(songInfo.album || ""))),
                    singerName: btoa(unescape(encodeURIComponent(songInfo.artist))),
                    qrc: 1,
                    qrc_t: 0,
                    trans: 1,
                    trans_t: 0,
                    type: 0
                }
            }
        };

        const response = await fetch("https://u.y.qq.com/cgi-bin/musicu.fcg", {
            method: "POST",
            body: JSON.stringify(body)
        });
        
        const data = await response.json();
        const lyricData = data.request?.data;
        
        if (lyricData) {
            // Priority: QRC > Lyric
            const rawQrc = lyricData.qrc;
            const rawLrc = lyricData.lyric;
            
            if (rawQrc) {
                // Fix: Force convert to string to avoid TypeError
                const hex = String(rawQrc);
                if (hex) {
                    const match = hex.match(/.{1,2}/g);
                    if (match) {
                        const bytes = new Uint8Array(match.map((byte:string) => parseInt(byte, 16)));
                        const content = qrcDecrypt(bytes);
                        return {
                            id: songId,
                            songId: songInfo.id,
                            source: Source.QM,
                            title: songInfo.title,
                            artist: songInfo.artist,
                            content: content,
                            type: LyricsType.VERBATIM
                        }
                    }
                }
            } else if (rawLrc) {
                return {
                    id: songId,
                    songId: songInfo.id,
                    source: Source.QM,
                    title: songInfo.title,
                    artist: songInfo.artist,
                    content: atob(rawLrc), // Standard LRC is base64
                    type: LyricsType.LINEBYLINE
                }
            }
        }

    } catch(e) {
        console.warn("QM Lyric Error", e);
    }
    return null;
}

// ==========================================
// API 3: Netease (NE) - Ported from ne.py & eapi.py
// ==========================================

// LAZY LOAD KEY to prevent crash if CryptoJS is not ready
let NE_KEY: any = null;

const getNeKey = () => {
    if (!NE_KEY && typeof CryptoJS !== 'undefined') {
        NE_KEY = CryptoJS.enc.Utf8.parse("e82ckenh8dichen8");
    }
    return NE_KEY;
};

const neEncrypt = (text: string) => {
    const key = getNeKey();
    if (!key) return "";

    const encrypted = CryptoJS.AES.encrypt(text, key, {
        mode: CryptoJS.mode.ECB,
        padding: CryptoJS.pad.Pkcs7
    });
    return encrypted.ciphertext.toString(CryptoJS.enc.Hex).toUpperCase();
};

const eapiEncrypt = (url: string, data: any) => {
    if (typeof CryptoJS === 'undefined') return "";
    
    const text = JSON.stringify(data);
    const message = `nobody${url}use${text}md5forencrypt`;
    const digest = CryptoJS.MD5(message).toString();
    const dataToEncrypt = `${url}-36cd479b6b5-${text}-36cd479b6b5-${digest}`;
    return neEncrypt(dataToEncrypt);
};

const eapiDecrypt = (cipherHex: string) => {
    const key = getNeKey();
    if (!key) return "";

    const cipherParams = CryptoJS.lib.CipherParams.create({
        ciphertext: CryptoJS.enc.Hex.parse(cipherHex)
    });
    const decrypted = CryptoJS.AES.decrypt(cipherParams, key, {
        mode: CryptoJS.mode.ECB,
        padding: CryptoJS.pad.Pkcs7
    });
    return decrypted.toString(CryptoJS.enc.Utf8);
}

const searchNE = async (keyword: string): Promise<SearchResult[]> => {
    if (!CONFIG.sources[Source.NE]) return [];
    if (typeof CryptoJS === 'undefined') return [];

    try {
        const url = "/api/search/song/list/page";
        const params = {
            limit: 20,
            offset: 0,
            keyword: keyword,
            scene: "NORMAL",
            needCorrect: true,
            e_r: true,
            header: "{}" 
        };
        
        const encryptedParams = eapiEncrypt(url, params);
        const formBody = new URLSearchParams();
        formBody.append('params', encryptedParams);

        const response = await fetch("https://interface.music.163.com/eapi/search/song/list/page", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "User-Agent": "NeteaseMusicDesktop/3.1.3.203419",
                "Cookie": "os=pc; appver=3.1.3.203419"
            },
            body: formBody
        });

        const text = await response.text();
        let jsonStr = "";
        try {
            jsonStr = eapiDecrypt(text);
        } catch (e) {
            jsonStr = text; 
        }
        
        const data = JSON.parse(jsonStr);
        const songs = data.data?.resources?.map((r:any) => r.baseInfo?.simpleSongData) || [];

        return songs.map((item: any) => ({
            id: `ne-${item.id}`,
            lyricId: item.id.toString(),
            title: item.name,
            artist: item.ar?.map((a:any) => a.name).join('/'),
            album: item.al?.name,
            source: Source.NE,
            type: LyricsType.LINEBYLINE
        }));

    } catch (e) {
        console.warn("NE Search Error", e);
    }
    return [];
}

const getLyricsNE = async (songId: string, songInfo: any): Promise<LyricInfo | null> => {
    if (typeof CryptoJS === 'undefined') return null;
    try {
        const url = "/api/song/lyric/v1";
        const params = {
            id: songId,
            lv: -1,
            tv: -1,
            rv: -1,
            kv: -1,
            yv: -1,
            e_r: true,
            header: "{}"
        };
        
        const encryptedParams = eapiEncrypt(url, params);
        const formBody = new URLSearchParams();
        formBody.append('params', encryptedParams);

        const response = await fetch("https://interface.music.163.com/eapi/song/lyric/v1", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "User-Agent": "NeteaseMusicDesktop/3.1.3.203419",
                "Cookie": "os=pc; appver=3.1.3.203419"
            },
            body: formBody
        });

        const text = await response.text();
        let jsonStr = "";
        try {
            jsonStr = eapiDecrypt(text);
        } catch(e) { jsonStr = text; }
        
        const data = JSON.parse(jsonStr);
        
        // Priority: yrc > lrc
        let content = "";
        let type = LyricsType.LINEBYLINE;

        if (data.yrc && data.yrc.lyric) {
            content = data.yrc.lyric;
            type = LyricsType.VERBATIM; // YRC is verbatim
        } else if (data.lrc && data.lrc.lyric) {
            content = data.lrc.lyric;
        }

        if (content) {
            return {
                id: songId,
                songId: songInfo.id,
                source: Source.NE,
                title: songInfo.title,
                artist: songInfo.artist,
                content: content,
                type: type
            }
        }

    } catch (e) {
        console.warn("NE Lyric Error", e);
    }
    return null;
}


// ==========================================
// Main Service Logic
// ==========================================

const extractMetadata = (file: File): Promise<{ title?: string; artist?: string; album?: string; coverUrl?: string }> => {
    return new Promise((resolve) => {
        if (!window.jsmediatags) {
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
                resolve({ title: tags.title, artist: tags.artist, album: tags.album, coverUrl });
                resolve({ title: tags.title, artist: tags.artist, album: tags.album, coverUrl });
            },
            onError: () => resolve({})
            onError: () => resolve({})
        });
    });
};

export const processFileImport = async (files: FileList): Promise<SongInfo[]> => {
    const newSongs: SongInfo[] = [];
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
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

export const searchOnlineLyrics = async (keyword: string): Promise<SearchResult[]> => {
    const promises: Promise<SearchResult[]>[] = [];

    // 1. Lrclib
    if (CONFIG.sources[Source.LRCLIB]) {
        promises.push(fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(keyword)}`)
            .then(r => r.json())
            .then(data => Array.isArray(data) ? data.slice(0, 10).map((item: any) => ({
                id: `lrclib-${item.id}`,
                lyricId: item.id.toString(),
                title: item.trackName,
                artist: item.artistName,
                album: item.albumName,
                source: Source.LRCLIB,
                type: item.syncedLyrics ? LyricsType.LINEBYLINE : LyricsType.PlainText
            })) : [])
            .catch(() => [])
        );
    }

    // 2. Real Sources
    promises.push(searchKG(keyword));
    promises.push(searchQM(keyword));
    promises.push(searchNE(keyword));

    const results = await Promise.all(promises);
    return results.flat();
export const searchOnlineLyrics = async (keyword: string): Promise<SearchResult[]> => {
    const promises: Promise<SearchResult[]>[] = [];

    // 1. Lrclib
    if (CONFIG.sources[Source.LRCLIB]) {
        promises.push(fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(keyword)}`)
            .then(r => r.json())
            .then(data => Array.isArray(data) ? data.slice(0, 10).map((item: any) => ({
                id: `lrclib-${item.id}`,
                lyricId: item.id.toString(),
                title: item.trackName,
                artist: item.artistName,
                album: item.albumName,
                source: Source.LRCLIB,
                type: item.syncedLyrics ? LyricsType.LINEBYLINE : LyricsType.PlainText
            })) : [])
            .catch(() => [])
        );
    }

    // 2. Real Sources
    promises.push(searchKG(keyword));
    promises.push(searchQM(keyword));
    promises.push(searchNE(keyword));

    const results = await Promise.all(promises);
    return results.flat();
};

export const getLyricsContent = async (songId: string, specificLyricId?: string): Promise<LyricInfo | null> => {
    const song = getSongById(songId);
    if (!song) return null;

    const lyricIdToUse = specificLyricId || (song as any)._tempLyricId || song.id;
    const sourceToUse = song.source;

    if (sourceToUse === Source.KG) {
        return getLyricsKG(lyricIdToUse, song);
    }
    
    if (sourceToUse === Source.QM) {
        return getLyricsQM(lyricIdToUse, song);
    }

    if (sourceToUse === Source.NE) {
        return getLyricsNE(lyricIdToUse, song);
    }

    // Fallback / Lrclib
    try {
        const response = await fetch(`https://lrclib.net/api/get/${lyricIdToUse}`);
        const match = await response.json();
        return {
            id: match.id.toString(),
            songId: songId,
            source: Source.LRCLIB,
            title: match.trackName,
            artist: match.artistName,
            content: match.syncedLyrics || match.plainLyrics || "",
            type: match.syncedLyrics ? LyricsType.LINEBYLINE : LyricsType.PlainText
        };
    } catch(e) {}

    const lyricIdToUse = specificLyricId || (song as any)._tempLyricId || song.id;
    const sourceToUse = song.source;

    if (sourceToUse === Source.KG) {
        return getLyricsKG(lyricIdToUse, song);
    }
    
    if (sourceToUse === Source.QM) {
        return getLyricsQM(lyricIdToUse, song);
    }

    if (sourceToUse === Source.NE) {
        return getLyricsNE(lyricIdToUse, song);
    }

    // Fallback / Lrclib
    try {
        const response = await fetch(`https://lrclib.net/api/get/${lyricIdToUse}`);
        const match = await response.json();
        return {
            id: match.id.toString(),
            songId: songId,
            source: Source.LRCLIB,
            title: match.trackName,
            artist: match.artistName,
            content: match.syncedLyrics || match.plainLyrics || "",
            type: match.syncedLyrics ? LyricsType.LINEBYLINE : LyricsType.PlainText
        };
    } catch(e) {}

    return null;
};

export const autoFetchLyrics = async (song: SongInfo): Promise<SongInfo> => {
    const results = await searchOnlineLyrics(`${song.artist} ${song.title}`);
    if (results.length > 0) {
        // Simple auto-match: Prefer Verbatim, then first result
        const best = results.find(r => r.type === LyricsType.VERBATIM) || results[0];
        
        const updated = {
            ...song,
            status: ProcessStatus.MATCHED,
            source: best.source,
            lyricsType: best.type
        };
        (updated as any)._tempLyricId = best.lyricId; // Store ID for fetch
        
        MOCK_SONGS = MOCK_SONGS.map(s => s.id === song.id ? updated : s);
        return updated;
    }
    
    const updated = { ...song, status: ProcessStatus.FAILED };
    MOCK_SONGS = MOCK_SONGS.map(s => s.id === song.id ? updated : s);
    return updated;
};

export const autoFetchLyrics = async (song: SongInfo): Promise<SongInfo> => {
    const results = await searchOnlineLyrics(`${song.artist} ${song.title}`);
    if (results.length > 0) {
        // Simple auto-match: Prefer Verbatim, then first result
        const best = results.find(r => r.type === LyricsType.VERBATIM) || results[0];
        
        const updated = {
            ...song,
            status: ProcessStatus.MATCHED,
            source: best.source,
            lyricsType: best.type
        };
        (updated as any)._tempLyricId = best.lyricId; // Store ID for fetch
        
        MOCK_SONGS = MOCK_SONGS.map(s => s.id === song.id ? updated : s);
        return updated;
    }
    
    const updated = { ...song, status: ProcessStatus.FAILED };
    MOCK_SONGS = MOCK_SONGS.map(s => s.id === song.id ? updated : s);
    return updated;
};

export const applyLyricsToSong = async (songId: string, result: SearchResult): Promise<void> => {
    await DELAY(50);
    await DELAY(50);
    const song = MOCK_SONGS.find(s => s.id === songId);
    if (song) {
        song.status = ProcessStatus.MATCHED;
        song.source = result.source;
        song.lyricsType = result.type;
        (song as any)._tempLyricId = result.lyricId;
        (song as any)._tempLyricId = result.lyricId;
        MOCK_SONGS = [...MOCK_SONGS];
    }
};

export const saveLyricsToTag = async (song: SongInfo): Promise<SongInfo> => {
    await DELAY(200);
    const updated = { ...song, status: ProcessStatus.SAVED };
    MOCK_SONGS = MOCK_SONGS.map(s => s.id === song.id ? updated : s);
    return updated;
};

export const saveLyricsToTag = async (song: SongInfo): Promise<SongInfo> => {
    await DELAY(200);
    const updated = { ...song, status: ProcessStatus.SAVED };
    MOCK_SONGS = MOCK_SONGS.map(s => s.id === song.id ? updated : s);
    return updated;
};
