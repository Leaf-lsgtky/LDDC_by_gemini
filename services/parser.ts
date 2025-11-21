
export const formatTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    const millisecond = ms % 1000;
    return `[${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(millisecond).padStart(3, '0')}]`;
};

export const parseAndFormatKrc = (krcContent: string): string => {
    const lines = krcContent.split(/\r?\n/);
    let result = "";

    // Matches: [offset, duration]content
    const lineRegex = /^\[(\d+),(\d+)\](.*)$/;
    // Matches: <start,duration,0>text
    const wordRegex = /<(\d+),(\d+),\d+>([^<]*)/g;

    for (const line of lines) {
        const lineMatch = line.match(lineRegex);
        if (!lineMatch) continue;

        const lineStart = parseInt(lineMatch[1]);
        const content = lineMatch[3];

        let builtLine = "";
        let hasWords = false;
        
        let match;
        // Reset regex state
        wordRegex.lastIndex = 0;
        
        while ((match = wordRegex.exec(content)) !== null) {
            hasWords = true;
            const wordStartRel = parseInt(match[1]);
            const text = match[3];
            const wordStartAbs = lineStart + wordStartRel;
            
            builtLine += `${formatTime(wordStartAbs)}${text}`;
        }
        
        if (!hasWords) {
            // Fallback for lines without verbatim tags (e.g. ID tags or plain lines)
            // If content is empty, we might still want the timestamp if it's a spacer
            builtLine = `${formatTime(lineStart)}${content}`;
        }

        result += builtLine + "\n";
    }

    return result;
};

export const decodeBase64Utf8 = (base64: string): string => {
    try {
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return new TextDecoder('utf-8').decode(bytes);
    } catch (e) {
        console.error("Decode Error", e);
        return "";
    }
};
