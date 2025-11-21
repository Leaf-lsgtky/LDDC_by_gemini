
// Mirroring LDDC/common/models

export enum Source {
  MULTI = 'MULTI',
  QM = 'QM', // QQ Music
  KG = 'KG', // Kugou
  NE = 'NE', // Netease
  LRCLIB = 'LRCLIB',
  Local = 'Local',
}

export enum LyricsType {
  PlainText = 0,
  VERBATIM = 1, // Word-by-word
  LINEBYLINE = 2,
}

export enum ProcessStatus {
  IDLE = 'IDLE',
  SCANNING = 'SCANNING',
  SEARCHING = 'SEARCHING',
  MATCHED = 'MATCHED',
  FAILED = 'FAILED',
  SAVED = 'SAVED',
}

export interface Artist {
  name: string;
}

export interface SongInfo {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number; // ms
  path: string;
  source: Source;
  status: ProcessStatus;
  lyricsType?: LyricsType;
  coverUrl?: string; // Optional for UI
}

export interface LyricInfo {
  id: string;
  songId: string;
  source: Source;
  title: string;
  artist: string;
  content: string; // The actual LRC content
  type: LyricsType;
}

export interface SearchResult {
    id: string;
    lyricId?: string; // For fetching content (Lrclib uses id)
    title: string;
    artist: string;
    album: string;
    source: Source;
    type: LyricsType;
}

export interface AppConfig {
  sources: Source[];
  minScore: number;
  autoSave: boolean;
  filenameFormat: string;
}
