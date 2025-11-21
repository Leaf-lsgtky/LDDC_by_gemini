// ... imports

// ... existing code ...

const getLyricsQM = async (songId: string, songInfo: any): Promise<LyricInfo | null> => {
    try {
        const cleanId = String(songId).replace(/^qm-/, '');
        const songIDInt = parseInt(cleanId);
        
        console.log(`[QM] Requesting ID: ${songIDInt}`);

        const body = {
            comm: { ct: 11, cv: "1003006", v: "1003006", tmeAppID: "qqmusiclight", nettype: "NETWORK_WIFI", udid: "0" },
            request: {
                method: "GetPlayLyricInfo",
                module: "music.musichallSong.PlayLyricInfo",
                param: {
                    songID: songIDInt,
                    songName: btoa(unescape(encodeURIComponent(songInfo.title))),
                    albumName: btoa(unescape(encodeURIComponent(songInfo.album || ""))),
                    singerName: btoa(unescape(encodeURIComponent(songInfo.artist))),
                    qrc: 1, qrc_t: 0, trans: 1, trans_t: 0, type: 0
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
        
        const rawQrc = lyricData.qrc;
        const rawLrc = lyricData.lyric;
        
        console.log(`[QM] QRC Len: ${rawQrc?.length}, LRC Len: ${rawLrc?.length}`);

        let content = "";
        let type = LyricsType.LINEBYLINE;
        let success = false;
        
        // Helper to check if string looks like lyrics
        const isLyrics = (text: string) => text.includes('[') && text.includes(']') && (text.includes(':') || text.includes('.'));

        // Helper to process byte array
        const processBytes = (bytes: Uint8Array, label: string, isLrcField: boolean) => {
            if (bytes.length < 4) return { success: false };

            // A. If it's the LRC field, TRY PLAIN TEXT FIRST (UTF-8 & GBK)
            // This fixes the issue where we tried to decrypt plain text and failed.
            if (isLrcField) {
                // 1. UTF-8
                try {
                    const res = new TextDecoder('utf-8').decode(bytes);
                    if (isLyrics(res)) {
                        console.log(`[QM] ${label} -> UTF-8 Success`);
                        return { success: true, content: res, type: LyricsType.LINEBYLINE };
                    }
                } catch (e) {}

                // 2. GBK (Common in older Chinese lyrics)
                try {
                    const res = new TextDecoder('gbk').decode(bytes);
                    if (isLyrics(res)) {
                        console.log(`[QM] ${label} -> GBK Success`);
                        return { success: true, content: res, type: LyricsType.LINEBYLINE };
                    }
                } catch (e) {}
            }

            // B. Try QRC Decrypt (TripleDES)
            try {
                const res = qrcDecrypt(bytes);
                // Check if result looks valid (e.g., XML or Lyric structure)
                if (res && res.length > 10) {
                    console.log(`[QM] ${label} -> QRC Decrypt Success`);
                    // QRC is often XML-like or strict format, assume Verbatim
                    return { success: true, content: res, type: LyricsType.VERBATIM };
                }
            } catch (e) { 
                // console.log(`[QM] ${label} -> QRC Decrypt Failed: ${e}`);
            }

            // C. Try Direct Inflate (Zlib)
            try {
                if (typeof pako !== 'undefined') {
                    const inflated = pako.inflate(bytes);
                    const res = new TextDecoder('utf-8').decode(inflated);
                    if (res && res.length > 10) {
                        console.log(`[QM] ${label} -> Zlib Inflate Success`);
                        return { success: true, content: res, type: LyricsType.LINEBYLINE };
                    }
                }
            } catch (e) {}

            return { success: false };
        };

        // 1. Process QRC Field (Hex Encoded)
        if (rawQrc && String(rawQrc).length > 10) { // Ignore short/empty/0 values
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
            // QRC content formatting hook (if it's XML, we might need to parse it)
            // For now, we assume decryptor returns raw text or XML that is readable enough.
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

// ... rest of file