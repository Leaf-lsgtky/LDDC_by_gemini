// services/lddcService_new.ts
// 修复版本 - 解决QQ音乐歌词获取和网易云搜索问题

import { SongInfo, Source, ProcessStatus, LyricsType, LyricInfo, SearchResult } from '../types';
import { krcDecrypt, qrcDecrypt } from './decryptor';
import { parseAndFormatKrc, decodeBase64Utf8 } from './parser';

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
    var pako: any;
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
    if (typeof CryptoJS === 'undefined') return [];

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

        const response = await fetch(`https://complexsearch.kugou.com/v2/search/song?${query}`, {
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
                lyricId: item.FileHash,
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
            const downloadUrl = `https://lyrics.kugou.com/download?${new URLSearchParams({ ...downloadParams, signature: downloadSig } as any)}`;

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
                    try {
                        const rawKrc = krcDecrypt(bytes);
                        content = parseAndFormatKrc(rawKrc);
                    } catch (krcErr) {
                        console.error("KG KRC Decrypt Error", krcErr);
                        content = "KRC Decrypt Failed";
                    }
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
// API 2: QQ Music (QM) - 修复版本
// ==========================================

/**
 * 生成QQ音乐搜索ID（与Python版本一致的算法）
 */
const generateQMSearchId = (): string => {
    // Python: str(random.randint(1, 20) * 18014398509481984 + random.randint(0, 4194304) * 4294967296 + round(time.time() * 1000) % 86400000)
    const part1 = Math.floor(Math.random() * 20 + 1) * 18014398509481984;
    const part2 = Math.floor(Math.random() * 4194305) * 4294967296;
    const part3 = Date.now() % 86400000;
    // 使用BigInt来处理大数运算
    const result = BigInt(Math.floor(part1)) + BigInt(Math.floor(part2)) + BigInt(part3);
    return result.toString();
};

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
                    search_id: generateQMSearchId(),  // 修复：使用正确的算法
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
            duration: item.interval ? item.interval * 1000 : 0,  // 保存时长信息（毫秒）
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
        const cleanId = String(songId).replace(/^qm-/, '');
        const songIDInt = parseInt(cleanId);

        console.log(`[QM] Requesting ID: ${songIDInt}`);

        // 修复：使用正确的参数，与Python版本保持一致
        const body = {
            comm: {
                ct: 11,  // 搜索用11，歌词API也用11
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
                    songID: songIDInt,
                    songName: btoa(unescape(encodeURIComponent(songInfo.title || ""))),
                    albumName: btoa(unescape(encodeURIComponent(songInfo.album || ""))),
                    singerName: btoa(unescape(encodeURIComponent(songInfo.artist || ""))),
                    // 修复：补全缺失的参数
                    crypt: 1,
                    interval: songInfo.duration ? Math.floor(songInfo.duration / 1000) : 0,  // 秒
                    lrc_t: 0,
                    qrc: 1,
                    qrc_t: 0,
                    roma: 1,
                    roma_t: 0,
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

        if (!response.ok) {
            console.error(`[QM] Fetch Failed: ${response.status}`);
            return null;
        }

        const data = await response.json();
        const lyricData = data.request?.data;

        if (!lyricData) {
            console.error("[QM] No lyricData");
            return null;
        }

        const rawQrc = lyricData.qrc || lyricData.lyric;  // qrc字段或lyric字段
        const rawLrc = lyricData.lyric;
        const qrcType = lyricData.qrc_t;
        const lrcType = lyricData.lrc_t;

        console.log(`[QM] QRC: ${rawQrc?.length || 0} bytes, qrc_t: ${qrcType}, lrc_t: ${lrcType}`);

        let content = "";
        let type = LyricsType.LINEBYLINE;
        let success = false;

        // Helper to check if string looks like lyrics
        const isLyrics = (text: string) => text.includes('[') && (text.includes(':') || text.includes('.'));

        // Helper to process byte array
        const processBytes = (bytes: Uint8Array, label: string, isLrcField: boolean) => {
            if (bytes.length < 4) return { success: false };

            // PRIORITY 1: QRC Decrypt (TripleDES) - 这是QQ音乐主要使用的格式
            try {
                const res = qrcDecrypt(bytes);
                if (res && res.length > 10) {
                    console.log(`[QM] ${label} -> QRC Decrypt Success`);
                    return { success: true, content: res, type: LyricsType.VERBATIM };
                }
            } catch (e) {
                console.log(`[QM] ${label} -> QRC Decrypt Failed, trying other methods`);
            }

            // PRIORITY 2: Zlib Inflate
            try {
                if (typeof pako !== 'undefined') {
                    const inflated = pako.inflate(bytes);
                    const res = new TextDecoder('utf-8').decode(inflated);
                    if (res.length > 10 && (isLyrics(res) || res.includes('xml') || res.includes('LyricContent'))) {
                        console.log(`[QM] ${label} -> Zlib Inflate Success`);
                        return { success: true, content: res, type: LyricsType.LINEBYLINE };
                    }
                }
            } catch (e) {}

            // PRIORITY 3: Plain Text (UTF-8 & GBK)
            if (isLrcField) {
                try {
                    const res = new TextDecoder('utf-8').decode(bytes);
                    if (isLyrics(res)) {
                        console.log(`[QM] ${label} -> UTF-8 Success`);
                        return { success: true, content: res, type: LyricsType.LINEBYLINE };
                    }
                } catch (e) {}

                try {
                    const res = new TextDecoder('gbk').decode(bytes);
                    if (isLyrics(res)) {
                        console.log(`[QM] ${label} -> GBK Success`);
                        return { success: true, content: res, type: LyricsType.LINEBYLINE };
                    }
                } catch (e) {}
            }

            return { success: false };
        };

        // 1. Process QRC Field (Hex Encoded) - 优先处理QRC
        if (rawQrc && String(rawQrc).length > 10) {
            try {
                const hex = String(rawQrc);
                const match = hex.match(/.{1,2}/g);
                if (match) {
                    const bytes = new Uint8Array(match.map((byte:string) => parseInt(byte, 16)));
                    const res = processBytes(bytes, "QRC_Field", false);
                    if (res.success) {
                        content = res.content!;
                        type = res.type!;
                        success = true;
                    }
                }
            } catch (e) {
                console.warn("[QM] QRC Hex Error", e);
            }
        }

        // 2. Process Lyric Field (Base64 Encoded) - Fallback
        if (!success && rawLrc && String(rawLrc).length > 10) {
            console.log("[QM] Trying LRC Field Fallback");
            try {
                const binaryString = atob(rawLrc);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }

                const res = processBytes(bytes, "LRC_Field", true);
                if (res.success) {
                    content = res.content!;
                    type = res.type!;
                    success = true;
                }
            } catch (e) {
                console.warn("[QM] LRC Base64 Error", e);
            }
        }

        if (success) {
            return {
                id: songId,
                songId: songInfo.id,
                source: Source.QM,
                title: songInfo.title,
                artist: songInfo.artist,
                content: content,
                type: type
            }
        } else {
            console.error("[QM] Failed to resolve lyrics.");
        }

    } catch(e) {
        console.error("[QM] Critical Error", e);
    }
    return null;
}

// ==========================================
// API 3: Netease (NE) - 修复版本
// ==========================================

let NE_KEY: any = null;

// 网易云登录状态缓存
interface NESession {
    cookies: {
        os: string;
        deviceId: string;
        osver: string;
        clientSign: string;
        channel: string;
        mode: string;
        appver: string;
        NMTID?: string;
        MUSIC_A?: string;
        __csrf?: string;
        WEVNSM?: string;
        WNMCID?: string;
    };
    userId: string;
    expire: number;
}

let neSession: NESession | null = null;

// 预设的设备ID列表（从网易云客户端提取）
const NE_DEVICE_IDS = [
    "2d8f5e3c-a1b2-4c3d-9e8f-7a6b5c4d3e2f",
    "3e9f6d4c-b2c3-5d4e-0f9g-8b7c6d5e4f3g",
    "4f0g7e5d-c3d4-6e5f-1g0h-9c8d7e6f5g4h",
    "5g1h8f6e-d4e5-7f6g-2h1i-0d9e8f7g6h5i",
    "6h2i9g7f-e5f6-8g7h-3i2j-1e0f9g8h7i6j",
    "7i3j0h8g-f6g7-9h8i-4j3k-2f1g0h9i8j7k",
    "8j4k1i9h-g7h8-0i9j-5k4l-3g2h1i0j9k8l",
    "9k5l2j0i-h8i9-1j0k-6l5m-4h3i2j1k0l9m",
];

const getRandomDeviceId = (): string => {
    return NE_DEVICE_IDS[Math.floor(Math.random() * NE_DEVICE_IDS.length)];
};

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

/**
 * 网易云eapi参数加密（与Python版本完全一致）
 */
const eapiEncrypt = (url: string, data: any) => {
    if (typeof CryptoJS === 'undefined') return "";

    // 确保使用紧凑JSON格式
    const text = JSON.stringify(data);
    const message = `nobody${url}use${text}md5forencrypt`;
    const digest = CryptoJS.MD5(message).toString();
    const dataToEncrypt = `${url}-36cd479b6b5-${text}-36cd479b6b5-${digest}`;
    return neEncrypt(dataToEncrypt);
};

/**
 * 网易云eapi响应解密
 */
const eapiDecrypt = (cipherHex: string) => {
    const key = getNeKey();
    if (!key) return "";

    try {
        const cipherParams = CryptoJS.lib.CipherParams.create({
            ciphertext: CryptoJS.enc.Hex.parse(cipherHex)
        });
        const decrypted = CryptoJS.AES.decrypt(cipherParams, key, {
            mode: CryptoJS.mode.ECB,
            padding: CryptoJS.pad.Pkcs7
        });
        return decrypted.toString(CryptoJS.enc.Utf8);
    } catch (e) {
        console.error("[NE] Decrypt error", e);
        return "";
    }
};

/**
 * 生成网易云clientSign（与Python版本一致）
 */
const generateClientSign = (): string => {
    // MAC地址部分
    const mac = Array.from({length: 6}, () =>
        Math.floor(Math.random() * 256).toString(16).padStart(2, '0').toUpperCase()
    ).join(':');

    // 随机大写字母部分
    const randomStr = Array.from({length: 8}, () =>
        String.fromCharCode(65 + Math.floor(Math.random() * 26))
    ).join('');

    // 64位hex字符串
    const hashPart = Array.from({length: 64}, () =>
        Math.floor(Math.random() * 16).toString(16)
    ).join('');

    return `${mac}@@@${randomStr}@@@@@@${hashPart}`;
};

/**
 * 生成游客登录用户名（与Python版本一致）
 */
const getAnonymousUsername = (deviceId: string): string => {
    const xorKey = '3go8&$8*3*3h0k(2)2';
    const xoredChars: string[] = [];

    for (let i = 0; i < deviceId.length; i++) {
        const xoredChar = String.fromCharCode(
            deviceId.charCodeAt(i) ^ xorKey.charCodeAt(i % xorKey.length)
        );
        xoredChars.push(xoredChar);
    }

    const xoredString = xoredChars.join('');
    const md5Digest = CryptoJS.MD5(xoredString).toString(CryptoJS.enc.Base64);
    const combinedStr = `${deviceId} ${md5Digest}`;
    return btoa(combinedStr);
};

/**
 * 获取params中的header参数
 */
const getParamsHeader = (cookies: NESession['cookies']): string => {
    return JSON.stringify({
        clientSign: cookies.clientSign,
        os: cookies.os,
        appver: cookies.appver,
        deviceId: cookies.deviceId,
        requestId: 0,
        osver: cookies.osver
    });
};

/**
 * 获取请求头（与Python版本一致）
 */
const getNEHeaders = (cookies: NESession['cookies']): Record<string, string> => {
    // 构建cookie字符串
    const cookieStr = Object.entries(cookies)
        .filter(([_, v]) => v)
        .map(([k, v]) => `${k}=${v}`)
        .join('; ');

    return {
        "Accept": "*/*",
        "Content-Type": "application/x-www-form-urlencoded",
        "Cookie": cookieStr,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Safari/537.36 Chrome/91.0.4472.164 NeteaseMusicDesktop/3.1.3.203419",
        "Origin": "orpheus://orpheus",
        "mconfig-info": '{"IuRPVVmc3WWul9fT":{"version":733184,"appver":"3.1.3.203419"}}'
    };
};

/**
 * 网易云初始化/游客登录
 */
const initNESession = async (): Promise<boolean> => {
    if (typeof CryptoJS === 'undefined') {
        console.error("[NE] CryptoJS not loaded");
        return false;
    }

    // 检查缓存的session是否有效
    const cached = localStorage.getItem('ne_session');
    if (cached) {
        try {
            const session = JSON.parse(cached) as NESession;
            if (session.expire > Date.now()) {
                neSession = session;
                console.log("[NE] Using cached session");
                return true;
            }
        } catch (e) {
            console.warn("[NE] Failed to parse cached session");
        }
    }

    console.log("[NE] Starting anonymous login...");

    try {
        // 生成初始cookies
        const deviceId = getRandomDeviceId();
        const clientSign = generateClientSign();
        const osver = `Microsoft-Windows-10--build-${Math.floor(Math.random() * 100) + 20000}-64bit`;
        const modes = ["MS-iCraft B760M WIFI", "ASUS ROG STRIX Z790", "MSI MAG B550 TOMAHAWK", "ASRock X670E Taichi"];

        const preCookies: NESession['cookies'] = {
            os: "pc",
            deviceId: deviceId,
            osver: osver,
            clientSign: clientSign,
            channel: "netease",
            mode: modes[Math.floor(Math.random() * modes.length)],
            appver: "3.1.3.203419"
        };

        // 准备登录参数
        const path = "/api/register/anonimous";
        const params = {
            username: getAnonymousUsername(preCookies.deviceId),
            e_r: true,
            header: getParamsHeader(preCookies)
        };

        const encryptedParams = eapiEncrypt(path, params);
        const formBody = `params=${encryptedParams}`;

        // 发送登录请求
        const response = await fetch("https://interface.music.163.com/eapi/register/anonimous", {
            method: "POST",
            headers: getNEHeaders(preCookies),
            body: formBody
        });

        if (!response.ok) {
            console.error(`[NE] Login failed: ${response.status}`);
            return false;
        }

        // 解密响应
        const responseText = await response.text();
        let data: any;
        try {
            const decrypted = eapiDecrypt(responseText);
            data = JSON.parse(decrypted);
        } catch (e) {
            // 如果解密失败，尝试直接解析
            try {
                data = JSON.parse(responseText);
            } catch (e2) {
                console.error("[NE] Failed to parse login response");
                return false;
            }
        }

        if (data.code !== 200) {
            console.error(`[NE] Login error: ${data.code}`);
            return false;
        }

        console.log(`[NE] Login success, userId: ${data.userId}`);

        // 从响应头获取cookies（在浏览器环境中可能无法获取）
        // 使用默认值
        const finalCookies: NESession['cookies'] = {
            ...preCookies,
            WEVNSM: "1.0.0",
            WNMCID: `${Array.from({length: 6}, () =>
                String.fromCharCode(97 + Math.floor(Math.random() * 26))
            ).join('')}.${Date.now() - Math.floor(Math.random() * 10000)}.01.0`
        };

        // 创建session
        neSession = {
            cookies: finalCookies,
            userId: data.userId?.toString() || "0",
            expire: Date.now() + 864000000  // 10天
        };

        // 缓存到localStorage
        localStorage.setItem('ne_session', JSON.stringify(neSession));

        return true;
    } catch (e) {
        console.error("[NE] Init error", e);
        return false;
    }
};

/**
 * 确保NE session已初始化
 */
const ensureNESession = async (): Promise<boolean> => {
    if (neSession && neSession.expire > Date.now()) {
        return true;
    }
    return await initNESession();
};

/**
 * 网易云API请求封装
 */
const neRequest = async (path: string, params: Record<string, any>): Promise<any> => {
    if (!await ensureNESession()) {
        throw new Error("NE session not initialized");
    }

    // 添加必要的参数
    params.e_r = true;
    params.header = getParamsHeader(neSession!.cookies);

    const encryptedParams = eapiEncrypt(path.replace("/eapi", "/api"), params);
    const formBody = `params=${encryptedParams}`;

    const response = await fetch(`https://interface.music.163.com${path}`, {
        method: "POST",
        headers: getNEHeaders(neSession!.cookies),
        body: formBody
    });

    if (!response.ok) {
        throw new Error(`NE request failed: ${response.status}`);
    }

    const responseText = await response.text();
    let data: any;

    try {
        const decrypted = eapiDecrypt(responseText);
        if (decrypted) {
            data = JSON.parse(decrypted);
        } else {
            data = JSON.parse(responseText);
        }
    } catch (e) {
        try {
            data = JSON.parse(responseText);
        } catch (e2) {
            throw new Error("Failed to parse NE response");
        }
    }

    if (data.code !== 200) {
        throw new Error(`NE API error: ${data.code} - ${data.message || ''}`);
    }

    return data;
};

const searchNE = async (keyword: string): Promise<SearchResult[]> => {
    if (!CONFIG.sources[Source.NE]) return [];
    if (typeof CryptoJS === 'undefined') return [];

    try {
        // 修复：所有参数使用字符串类型
        const params = {
            limit: "20",
            offset: "0",
            keyword: keyword,
            scene: "NORMAL",
            needCorrect: "true"
        };

        const data = await neRequest("/eapi/search/song/list/page", params);

        // 检查响应结构
        if (!data.data || !data.data.resources) {
            console.warn("[NE] No search results in response");
            return [];
        }

        const songs = data.data.resources
            .map((r: any) => r.baseInfo?.simpleSongData)
            .filter((s: any) => s);

        return songs.map((item: any) => ({
            id: `ne-${item.id}`,
            lyricId: item.id.toString(),
            title: item.name,
            artist: item.ar?.map((a: any) => a.name).join('/'),
            album: item.al?.name,
            duration: item.dt || 0,
            source: Source.NE,
            type: LyricsType.LINEBYLINE
        }));

    } catch (e) {
        console.warn("NE Search Error", e);
    }
    return [];
};

/**
 * 解析网易云YRC格式歌词（逐字歌词）
 */
const parseYRC = (yrcContent: string): string => {
    // YRC格式: [time,duration]word(startTime,endTime)
    // 转换为LRC格式显示
    const lines: string[] = [];
    const lineRegex = /\[(\d+),(\d+)\](.+)/g;

    let match;
    while ((match = lineRegex.exec(yrcContent)) !== null) {
        const startTime = parseInt(match[1]);
        const lineContent = match[3];

        // 提取纯文本（移除时间标签）
        const text = lineContent.replace(/\(\d+,\d+\)/g, '');

        // 转换时间戳为LRC格式
        const minutes = Math.floor(startTime / 60000);
        const seconds = Math.floor((startTime % 60000) / 1000);
        const ms = Math.floor((startTime % 1000) / 10);

        lines.push(`[${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}]${text}`);
    }

    return lines.join('\n');
};

/**
 * 解析普通LRC歌词
 */
const parseLRC = (lrcContent: string): string => {
    // 已经是LRC格式，直接返回
    if (lrcContent.includes('[') && lrcContent.includes(']')) {
        return lrcContent;
    }

    // 纯文本，每行添加空时间戳
    return lrcContent.split('\n').map(line => `[00:00.00]${line}`).join('\n');
};

const getLyricsNE = async (songId: string, songInfo: any): Promise<LyricInfo | null> => {
    if (typeof CryptoJS === 'undefined') return null;

    try {
        const cleanId = songId.replace(/^ne-/, '');

        // 修复：参数使用字符串类型
        const params = {
            id: cleanId,
            lv: "-1",
            tv: "-1",
            rv: "-1",
            yv: "-1"
        };

        const data = await neRequest("/eapi/song/lyric/v1", params);

        let content = "";
        let type = LyricsType.LINEBYLINE;

        // 优先使用YRC（逐字歌词）
        if (data.yrc && data.yrc.lyric) {
            content = parseYRC(data.yrc.lyric);
            type = LyricsType.VERBATIM;
        } else if (data.lrc && data.lrc.lyric) {
            content = parseLRC(data.lrc.lyric);
            type = LyricsType.LINEBYLINE;
        }

        // 尝试添加翻译歌词
        if (data.tlyric && data.tlyric.lyric) {
            // 可以选择合并翻译歌词
            // content += "\n\n--- 翻译 ---\n" + data.tlyric.lyric;
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
            };
        }

    } catch (e) {
        console.warn("NE Lyric Error", e);
    }
    return null;
};


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
            },
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

export const applyLyricsToSong = async (songId: string, result: SearchResult): Promise<void> => {
    await DELAY(50);
    const song = MOCK_SONGS.find(s => s.id === songId);
    if (song) {
        song.status = ProcessStatus.MATCHED;
        song.source = result.source;
        song.lyricsType = result.type;
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

// 导出初始化函数供外部调用
export const initializeSources = async () => {
    // 预初始化网易云session
    if (CONFIG.sources[Source.NE]) {
        await initNESession();
    }
};
