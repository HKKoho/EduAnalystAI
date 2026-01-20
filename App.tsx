
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Youtube, Clipboard, FileText, Moon, Sun, History, ChevronRight, X, LayoutDashboard, Upload, Image, FileUp, Globe, Loader2, Mic, FileType } from 'lucide-react';
import { AnalysisStatus, AnalysisState, AnalysisResult } from './types';
import { apiService, ApiError, summarizeDocument, analyzeImage, analyzeAudio, WORD_COUNT_OPTIONS, WordCountOption, Language as ApiLanguage } from './services/apiService';
import StatusBadge from './components/StatusBadge';
import MarkdownRenderer from './components/MarkdownRenderer';
import { Language, translations } from './locales/translations';

const App: React.FC = () => {
  const [darkMode, setDarkMode] = useState(false);
  const [language, setLanguage] = useState<Language>('en');
  const [inputValue, setInputValue] = useState('');
  const [state, setState] = useState<AnalysisState>({
    status: AnalysisStatus.IDLE,
    result: null,
    error: null
  });
  const [history, setHistory] = useState<AnalysisResult[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // File upload states
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [documentWordCount, setDocumentWordCount] = useState<WordCountOption>(300);
  const [imageWordCount, setImageWordCount] = useState<WordCountOption>(300);
  const [audioWordCount, setAudioWordCount] = useState<WordCountOption>(300);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  // Transcript input states
  const [transcriptText, setTranscriptText] = useState('');
  const [transcriptWordCount, setTranscriptWordCount] = useState<WordCountOption>(300);

  // URL analysis word count
  const [urlWordCount, setUrlWordCount] = useState<WordCountOption>(300);

  // Get translations for current language
  const t = translations[language];

  useEffect(() => {
    const savedHistory = localStorage.getItem('edu_analyst_history');
    if (savedHistory) {
      setHistory(JSON.parse(savedHistory));
    }

    // Load saved language preference
    const savedLanguage = localStorage.getItem('edu_analyst_language') as Language;
    if (savedLanguage && (savedLanguage === 'en' || savedLanguage === 'zh-TW')) {
      setLanguage(savedLanguage);
    }

    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setDarkMode(true);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('edu_analyst_history', JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    localStorage.setItem('edu_analyst_language', language);
  }, [language]);

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    document.documentElement.classList.toggle('dark');
  };

  const toggleLanguage = () => {
    setLanguage(prev => prev === 'en' ? 'zh-TW' : 'en');
  };

  const handleAnalyze = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputValue.trim()) return;

    setState({ ...state, status: AnalysisStatus.FETCHING, error: null });

    try {
      const isUrl = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/.test(inputValue);

      // Use backend API service instead of direct Gemini calls
      const result = await apiService.analyze(
        inputValue,
        isUrl,
        (status) => setState(prev => ({ ...prev, status })),
        urlWordCount,
        language as ApiLanguage
      );

      setState({
        status: AnalysisStatus.COMPLETED,
        result: result,
        error: null
      });

      setHistory(prev => [result, ...prev].slice(0, 10));
    } catch (err: unknown) {
      const errorMessage = err instanceof ApiError
        ? err.message
        : err instanceof Error
          ? err.message
          : 'An unexpected error occurred.';

      setState({
        status: AnalysisStatus.ERROR,
        result: null,
        error: errorMessage
      });
    }
  };

  const copyToClipboard = () => {
    if (state.result) {
      navigator.clipboard.writeText(state.result.markdown);
      alert(t.copiedAlert);
    }
  };

  const loadFromHistory = (item: AnalysisResult) => {
    setState({
      status: AnalysisStatus.COMPLETED,
      result: item,
      error: null
    });
    setInputValue(item.url || '');
    setShowHistory(false);
  };

  // Handle document file selection
  const handleDocumentSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setDocumentFile(file);
    }
  };

  // Handle image file selection
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
    }
  };

  // Handle document summarization
  const handleDocumentSummarize = async () => {
    if (!documentFile) return;

    setState({ ...state, status: AnalysisStatus.FETCHING, error: null });

    try {
      const result = await summarizeDocument(
        documentFile,
        documentWordCount,
        (status) => setState(prev => ({ ...prev, status })),
        language as ApiLanguage
      );

      setState({
        status: AnalysisStatus.COMPLETED,
        result: result,
        error: null
      });

      setHistory(prev => [result, ...prev].slice(0, 10));
      setDocumentFile(null);
      if (documentInputRef.current) {
        documentInputRef.current.value = '';
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof ApiError
        ? err.message
        : err instanceof Error
          ? err.message
          : 'An unexpected error occurred.';

      setState({
        status: AnalysisStatus.ERROR,
        result: null,
        error: errorMessage
      });
    }
  };

  // Handle image analysis
  const handleImageAnalyze = async () => {
    if (!imageFile) return;

    setState({ ...state, status: AnalysisStatus.FETCHING, error: null });

    try {
      const result = await analyzeImage(
        imageFile,
        imageWordCount,
        (status) => setState(prev => ({ ...prev, status })),
        language as ApiLanguage
      );

      setState({
        status: AnalysisStatus.COMPLETED,
        result: result,
        error: null
      });

      setHistory(prev => [result, ...prev].slice(0, 10));
      setImageFile(null);
      if (imageInputRef.current) {
        imageInputRef.current.value = '';
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof ApiError
        ? err.message
        : err instanceof Error
          ? err.message
          : 'An unexpected error occurred.';

      setState({
        status: AnalysisStatus.ERROR,
        result: null,
        error: errorMessage
      });
    }
  };

  // Handle audio file selection
  const handleAudioSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAudioFile(file);
    }
  };

  // Handle audio analysis
  const handleAudioAnalyze = async () => {
    if (!audioFile) return;

    setState({ ...state, status: AnalysisStatus.FETCHING, error: null });

    try {
      const result = await analyzeAudio(
        audioFile,
        audioWordCount,
        (status) => setState(prev => ({ ...prev, status })),
        language as ApiLanguage
      );

      setState({
        status: AnalysisStatus.COMPLETED,
        result: result,
        error: null
      });

      setHistory(prev => [result, ...prev].slice(0, 10));
      setAudioFile(null);
      if (audioInputRef.current) {
        audioInputRef.current.value = '';
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof ApiError
        ? err.message
        : err instanceof Error
          ? err.message
          : 'An unexpected error occurred.';

      setState({
        status: AnalysisStatus.ERROR,
        result: null,
        error: errorMessage
      });
    }
  };

  // Handle transcript analysis
  const handleTranscriptAnalyze = async () => {
    if (!transcriptText.trim()) return;

    setState({ ...state, status: AnalysisStatus.FETCHING, error: null });

    try {
      const result = await apiService.analyze(
        transcriptText,
        false,
        (status) => setState(prev => ({ ...prev, status })),
        transcriptWordCount,
        language as ApiLanguage
      );

      setState({
        status: AnalysisStatus.COMPLETED,
        result: result,
        error: null
      });

      setHistory(prev => [result, ...prev].slice(0, 10));
      setTranscriptText('');
    } catch (err: unknown) {
      const errorMessage = err instanceof ApiError
        ? err.message
        : err instanceof Error
          ? err.message
          : 'An unexpected error occurred.';

      setState({
        status: AnalysisStatus.ERROR,
        result: null,
        error: errorMessage
      });
    }
  };

  const isProcessing = state.status !== AnalysisStatus.IDLE &&
                       state.status !== AnalysisStatus.COMPLETED &&
                       state.status !== AnalysisStatus.ERROR;

  return (
    <div className={`min-h-screen transition-colors duration-300 ${darkMode ? 'dark bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>

      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-white/80 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-slate-900 dark:bg-white rounded-lg">
              <LayoutDashboard className="w-5 h-5 text-white dark:text-slate-900" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">{t.appName} <span className="text-slate-500 font-normal">{t.appSubtitle}</span></h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleLanguage}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors flex items-center gap-1.5"
              title={t.switchLanguage}
            >
              <Globe className="w-5 h-5" />
              <span className="text-xs font-bold">{language === 'en' ? '中' : 'EN'}</span>
            </button>
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
              title={t.viewHistory}
            >
              <History className="w-5 h-5" />
            </button>
            <button
              onClick={toggleDarkMode}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
            >
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Input Section */}
        <section className="mb-12">
          <div className="text-center mb-8">
            <h2 className="text-4xl font-bold mb-4">{t.mainTitle}</h2>
            <p className="text-slate-500 dark:text-slate-400 max-w-2xl mx-auto">
              {t.mainSubtitle}
            </p>
          </div>

          <form onSubmit={handleAnalyze} className="relative group">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
              <Youtube className="w-6 h-6 text-slate-400 group-focus-within:text-slate-900 dark:group-focus-within:text-white transition-colors" />
            </div>
            <input
              type="text"
              placeholder={t.inputPlaceholder}
              className="w-full pl-14 pr-56 py-5 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 dark:focus:border-slate-500 outline-none transition-all text-lg"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
            />
            <div className="absolute right-3 inset-y-3 flex items-center gap-2">
              <select
                value={urlWordCount}
                onChange={(e) => setUrlWordCount(Number(e.target.value) as WordCountOption)}
                className="px-2 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
              >
                {WORD_COUNT_OPTIONS.map((count) => (
                  <option key={count} value={count}>
                    {count} {t.words}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                disabled={isProcessing}
                className="px-6 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-xl hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {t.analyzeButton} <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </form>

          {/* File Upload Section */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Document Upload */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-slate-200 dark:border-slate-800 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <FileUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white">{t.documentSummary}</h3>
                  <p className="text-xs text-slate-500">{t.documentTypes}</p>
                </div>
              </div>

              <input
                ref={documentInputRef}
                type="file"
                accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                onChange={handleDocumentSelect}
                className="hidden"
                id="document-upload"
              />

              <label
                htmlFor="document-upload"
                className="flex items-center justify-center gap-2 w-full py-3 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl cursor-pointer hover:border-slate-400 dark:hover:border-slate-600 transition-colors mb-4"
              >
                <Upload className="w-4 h-4 text-slate-500" />
                <span className="text-sm text-slate-600 dark:text-slate-400">
                  {documentFile ? documentFile.name : t.chooseDocument}
                </span>
              </label>

              <div className="flex gap-3">
                <select
                  value={documentWordCount}
                  onChange={(e) => setDocumentWordCount(Number(e.target.value) as WordCountOption)}
                  className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {WORD_COUNT_OPTIONS.map((count) => (
                    <option key={count} value={count}>
                      {count} {t.words}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleDocumentSummarize}
                  disabled={!documentFile || isProcessing}
                  className="px-4 py-2 bg-blue-600 text-white font-bold text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {t.summarizeButton}
                </button>
              </div>
            </div>

            {/* Image Upload */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-slate-200 dark:border-slate-800 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                  <Image className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white">{t.imageAnalysis}</h3>
                  <p className="text-xs text-slate-500">{t.imageTypes}</p>
                </div>
              </div>

              <input
                ref={imageInputRef}
                type="file"
                accept=".png,.jpg,.jpeg,.gif,.webp,image/png,image/jpeg,image/gif,image/webp"
                onChange={handleImageSelect}
                className="hidden"
                id="image-upload"
              />

              <label
                htmlFor="image-upload"
                className="flex items-center justify-center gap-2 w-full py-3 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl cursor-pointer hover:border-slate-400 dark:hover:border-slate-600 transition-colors mb-4"
              >
                <Upload className="w-4 h-4 text-slate-500" />
                <span className="text-sm text-slate-600 dark:text-slate-400">
                  {imageFile ? imageFile.name : t.chooseImage}
                </span>
              </label>

              <div className="flex gap-3">
                <select
                  value={imageWordCount}
                  onChange={(e) => setImageWordCount(Number(e.target.value) as WordCountOption)}
                  className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  {WORD_COUNT_OPTIONS.map((count) => (
                    <option key={count} value={count}>
                      {count} {t.words}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleImageAnalyze}
                  disabled={!imageFile || isProcessing}
                  className="px-4 py-2 bg-purple-600 text-white font-bold text-sm rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {t.analyzeButton}
                </button>
              </div>
            </div>

            {/* Audio Upload */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-slate-200 dark:border-slate-800 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                  <Mic className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white">{t.audioAnalysis}</h3>
                  <p className="text-xs text-slate-500">{t.audioTypes}</p>
                </div>
              </div>

              <input
                ref={audioInputRef}
                type="file"
                accept=".mp3,.wav,.ogg,.m4a,.flac,.webm,audio/mpeg,audio/wav,audio/ogg,audio/mp4,audio/flac,audio/webm"
                onChange={handleAudioSelect}
                className="hidden"
                id="audio-upload"
              />

              <label
                htmlFor="audio-upload"
                className="flex items-center justify-center gap-2 w-full py-3 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl cursor-pointer hover:border-slate-400 dark:hover:border-slate-600 transition-colors mb-4"
              >
                <Upload className="w-4 h-4 text-slate-500" />
                <span className="text-sm text-slate-600 dark:text-slate-400">
                  {audioFile ? audioFile.name : t.chooseAudio}
                </span>
              </label>

              <div className="flex gap-3">
                <select
                  value={audioWordCount}
                  onChange={(e) => setAudioWordCount(Number(e.target.value) as WordCountOption)}
                  className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  {WORD_COUNT_OPTIONS.map((count) => (
                    <option key={count} value={count}>
                      {count} {t.words}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleAudioAnalyze}
                  disabled={!audioFile || isProcessing}
                  className="px-4 py-2 bg-orange-600 text-white font-bold text-sm rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {t.analyzeButton}
                </button>
              </div>
            </div>

            {/* Transcript Input */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-slate-200 dark:border-slate-800 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <FileType className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white">{t.transcriptAnalysis}</h3>
                  <p className="text-xs text-slate-500">{t.transcriptDescription}</p>
                </div>
              </div>

              <textarea
                placeholder={t.transcriptPlaceholder}
                value={transcriptText}
                onChange={(e) => setTranscriptText(e.target.value)}
                className="w-full h-32 px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none mb-4"
              />

              <div className="flex gap-3">
                <select
                  value={transcriptWordCount}
                  onChange={(e) => setTranscriptWordCount(Number(e.target.value) as WordCountOption)}
                  className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  {WORD_COUNT_OPTIONS.map((count) => (
                    <option key={count} value={count}>
                      {count} {t.words}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleTranscriptAnalyze}
                  disabled={!transcriptText.trim() || isProcessing}
                  className="px-4 py-2 bg-green-600 text-white font-bold text-sm rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {t.analyzeButton}
                </button>
              </div>
            </div>
          </div>

          {/* Enhanced Loading State */}
          <div className="mt-6 flex flex-wrap gap-4 justify-center">
            {isProcessing ? (
              <div className="flex flex-col items-center gap-4 py-8">
                {/* Animated Loading Indicator */}
                <div className="relative">
                  <div className="w-16 h-16 border-4 border-slate-200 dark:border-slate-800 rounded-full"></div>
                  <div className="absolute top-0 left-0 w-16 h-16 border-4 border-transparent border-t-blue-500 dark:border-t-blue-400 rounded-full animate-spin"></div>
                  <div className="absolute top-2 left-2 w-12 h-12 border-4 border-transparent border-t-purple-500 dark:border-t-purple-400 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
                </div>
                <StatusBadge status={state.status} language={language} />
                {/* Animated dots */}
                <div className="flex gap-1">
                  <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '0ms' }}></span>
                  <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '150ms' }}></span>
                  <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '300ms' }}></span>
                </div>
              </div>
            ) : (
              <StatusBadge status={state.status} language={language} />
            )}
          </div>
        </section>

        {/* Error State */}
        {state.error && (
          <div className="mb-12 p-6 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 rounded-2xl flex items-start gap-4 animate-in fade-in slide-in-from-bottom-4">
            <X className="w-6 h-6 text-rose-500 shrink-0 mt-1" />
            <div>
              <h3 className="font-bold text-rose-800 dark:text-rose-200">{t.errorTitle}</h3>
              <p className="text-rose-700 dark:text-rose-300">{state.error}</p>
              <button
                onClick={() => setState({ ...state, status: AnalysisStatus.IDLE, error: null })}
                className="mt-2 text-sm font-bold underline hover:opacity-80"
              >
                {t.dismissButton}
              </button>
            </div>
          </div>
        )}

        {/* Results Section */}
        {state.result && (
          <article className="animate-in fade-in slide-in-from-bottom-8 duration-500">
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
              <div className="p-6 sm:p-10 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <div>
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">
                    <FileText className="w-4 h-4" />
                    {t.educationalThesis}
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900 dark:text-white">
                    {t.analysisReport}: {state.result.title}
                  </h3>
                  <p className="text-slate-400 text-sm mt-1">
                    {t.generatedOn} {new Date(state.result.timestamp).toLocaleString(language === 'zh-TW' ? 'zh-TW' : 'en-US')}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={copyToClipboard}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg font-bold text-sm transition-colors"
                  >
                    <Clipboard className="w-4 h-4" /> {t.copyText}
                  </button>
                </div>
              </div>

              <div className="p-6 sm:p-10 max-h-[800px] overflow-y-auto custom-scrollbar">
                <MarkdownRenderer content={state.result.markdown} />
              </div>

              <div className="bg-slate-50 dark:bg-slate-950 p-6 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
                <p className="text-xs text-slate-500 italic">
                  {t.analysisFooter}
                </p>
                <div className="flex gap-2">
                  <span className="w-2 h-2 rounded-full bg-slate-300"></span>
                  <span className="w-2 h-2 rounded-full bg-slate-300"></span>
                  <span className="w-2 h-2 rounded-full bg-slate-300"></span>
                </div>
              </div>
            </div>
          </article>
        )}

        {/* Empty State */}
        {!state.result && state.status === AnalysisStatus.IDLE && (
          <div className="py-20 text-center text-slate-400">
            <div className="inline-block p-4 bg-slate-100 dark:bg-slate-900 rounded-full mb-4">
              <Search className="w-8 h-8" />
            </div>
            <p className="text-lg">{t.emptyStateText}</p>
          </div>
        )}
      </main>

      {/* History Slide-over */}
      {showHistory && (
        <div className="fixed inset-0 z-[60] flex justify-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowHistory(false)} />
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 h-full shadow-2xl animate-in slide-in-from-right duration-300 flex flex-col">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h2 className="text-xl font-bold">{t.historyTitle}</h2>
              <button onClick={() => setShowHistory(false)} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {history.length === 0 ? (
                <p className="text-center text-slate-500 py-20 italic">{t.noHistoryFound}</p>
              ) : (
                history.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => loadFromHistory(item)}
                    className="w-full text-left p-4 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-slate-900 dark:hover:border-slate-500 transition-all group"
                  >
                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                      {item.url ? <Youtube className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
                      {new Date(item.timestamp).toLocaleDateString(language === 'zh-TW' ? 'zh-TW' : 'en-US')}
                    </div>
                    <div className="font-bold text-slate-900 dark:text-slate-100 group-hover:text-slate-600 dark:group-hover:text-white transition-colors line-clamp-2">
                      {item.title}
                    </div>
                  </button>
                ))
              )}
            </div>
            {history.length > 0 && (
              <div className="p-6 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => {
                    setHistory([]);
                    localStorage.removeItem('edu_analyst_history');
                  }}
                  className="w-full py-3 bg-rose-50 text-rose-600 font-bold rounded-xl text-sm"
                >
                  {t.clearAllHistory}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="mt-20 border-t border-slate-100 dark:border-slate-900 py-12">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-4 opacity-50">
            <div className="p-1 bg-slate-900 dark:bg-white rounded">
              <LayoutDashboard className="w-3 h-3 text-white dark:text-slate-900" />
            </div>
            <span className="text-sm font-bold">{t.appName} {t.appSubtitle}</span>
          </div>
          <p className="text-xs text-slate-500 max-w-lg mx-auto leading-relaxed">
            {t.footerDescription}
          </p>
        </div>
      </footer>
    </div>
  );
};

export default App;
