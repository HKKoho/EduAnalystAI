
export enum AnalysisStatus {
  IDLE = 'IDLE',
  FETCHING = 'FETCHING_TRANSCRIPT',
  ANALYZING = 'ANALYZING_CONTENT',
  SUMMARIZING = 'SUMMARIZING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}

export interface AnalysisResult {
  title: string;
  author: string;
  markdown: string;
  timestamp: number;
  url: string;
}

export interface AnalysisState {
  status: AnalysisStatus;
  result: AnalysisResult | null;
  error: string | null;
}
