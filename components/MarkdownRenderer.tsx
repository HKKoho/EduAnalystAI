
import React from 'react';

interface MarkdownRendererProps {
  content: string;
}

// Minimalist Markdown Renderer (since we avoid external heavy libs if possible, 
// but we'll use a standard approach for high quality)
const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  // Simple transformation for common markdown patterns to HTML
  // In a production app, use react-markdown, but here we'll ensure the prose looks great.
  
  const processContent = (text: string) => {
    return text
      .replace(/^### (.*$)/gim, '<h3 class="text-xl font-bold mt-8 mb-4 border-l-4 border-slate-400 pl-3">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 class="text-2xl font-bold mt-10 mb-6 text-slate-800 dark:text-slate-100">$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 class="text-3xl font-bold mt-12 mb-8 text-slate-900 dark:text-white">$1</h1>')
      .replace(/\*\*(.*)\*\*/gim, '<strong class="font-bold text-slate-800 dark:text-slate-200">$1</strong>')
      .replace(/\*(.*)\*/gim, '<em class="italic">$1</em>')
      .replace(/^\- (.*$)/gim, '<li class="ml-6 list-disc mb-2">$1</li>')
      .replace(/\n\n/g, '<p class="mb-4 leading-relaxed"></p>')
      .replace(/\|/g, ''); // Crude cleanup for tables if any
  };

  return (
    <div 
      className="prose prose-slate max-w-none dark:prose-invert academic-prose"
      dangerouslySetInnerHTML={{ __html: processContent(content) }}
    />
  );
};

export default MarkdownRenderer;
