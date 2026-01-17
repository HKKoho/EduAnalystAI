
import React from 'react';
import { AnalysisStatus } from '../types';
import { Loader2, Search, BrainCircuit, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import { Language, translations } from '../locales/translations';

interface StatusBadgeProps {
  status: AnalysisStatus;
  language: Language;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, language }) => {
  const t = translations[language];

  const getStatusConfig = () => {
    switch (status) {
      case AnalysisStatus.FETCHING:
        return {
          icon: <Search className="w-5 h-5 animate-pulse" />,
          text: t.statusFetching,
          color: 'text-blue-500 bg-blue-50 dark:bg-blue-900/20'
        };
      case AnalysisStatus.ANALYZING:
        return {
          icon: <BrainCircuit className="w-5 h-5 animate-spin-slow" />,
          text: t.statusAnalyzing,
          color: 'text-purple-500 bg-purple-50 dark:bg-purple-900/20'
        };
      case AnalysisStatus.SUMMARIZING:
        return {
          icon: <FileText className="w-5 h-5 animate-bounce" />,
          text: t.statusSummarizing,
          color: 'text-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
        };
      case AnalysisStatus.COMPLETED:
        return {
          icon: <CheckCircle2 className="w-5 h-5" />,
          text: t.statusCompleted,
          color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
        };
      case AnalysisStatus.ERROR:
        return {
          icon: <AlertCircle className="w-5 h-5" />,
          text: t.statusError,
          color: 'text-rose-500 bg-rose-50 dark:bg-rose-900/20'
        };
      default:
        return null;
    }
  };

  const config = getStatusConfig();
  if (!config) return null;

  return (
    <div className={`flex items-center gap-3 px-4 py-2 rounded-full border border-current transition-all duration-300 ${config.color}`}>
      {config.icon}
      <span className="text-sm font-semibold tracking-wide uppercase">{config.text}</span>
    </div>
  );
};

export default StatusBadge;
