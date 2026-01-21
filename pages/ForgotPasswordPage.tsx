/**
 * Forgot Password Page for Edu-Analyst AI
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, AlertCircle, Loader2, LayoutDashboard, CheckCircle, ArrowLeft } from 'lucide-react';
import { forgotPassword, AuthApiError } from '../services/authApi';
import { Language, translations } from '../locales/translations';

interface ForgotPasswordPageProps {
  darkMode: boolean;
  language: Language;
}

export default function ForgotPasswordPage({ darkMode, language }: ForgotPasswordPageProps) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const t = translations[language];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await forgotPassword(email);
      setSubmitted(true);
    } catch (err) {
      if (err instanceof AuthApiError) {
        setError(err.message);
      } else {
        setError(language === 'zh-TW' ? '發送重設郵件時發生錯誤' : 'An error occurred while sending the reset email');
      }
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className={`min-h-screen flex items-center justify-center px-4 ${darkMode ? 'dark bg-slate-950' : 'bg-slate-50'}`}>
        <div className="w-full max-w-md">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-8 border border-slate-200 dark:border-slate-800 text-center">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
              {language === 'zh-TW' ? '請查看您的電子郵件' : 'Check your email'}
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              {language === 'zh-TW'
                ? `如果 ${email} 存在帳戶，您將收到一封包含密碼重設連結的電子郵件。`
                : `If an account exists for ${email}, you will receive an email with a password reset link.`}
            </p>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            >
              <ArrowLeft className="w-4 h-4" />
              {language === 'zh-TW' ? '返回登入' : 'Back to login'}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex items-center justify-center px-4 ${darkMode ? 'dark bg-slate-950' : 'bg-slate-50'}`}>
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="p-2 bg-slate-900 dark:bg-white rounded-lg">
              <LayoutDashboard className="w-6 h-6 text-white dark:text-slate-900" />
            </div>
            <span className="text-2xl font-bold text-slate-900 dark:text-white">{t.appName}</span>
          </div>
          <h1 className="text-xl font-semibold text-slate-700 dark:text-slate-300">
            {language === 'zh-TW' ? '重設您的密碼' : 'Reset your password'}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
            {language === 'zh-TW'
              ? '輸入您的電子郵件，我們將發送重設密碼的連結給您。'
              : "Enter your email and we'll send you a link to reset your password."}
          </p>
        </div>

        {/* Form */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-8 border border-slate-200 dark:border-slate-800">
          {error && (
            <div className="mb-6 p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
              <p className="text-sm text-rose-700 dark:text-rose-300">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                {language === 'zh-TW' ? '電子郵件' : 'Email'}
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 dark:text-white"
                  placeholder={language === 'zh-TW' ? '輸入您的電子郵件' : 'Enter your email'}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 transition-opacity"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                language === 'zh-TW' ? '發送重設連結' : 'Send Reset Link'
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            >
              <ArrowLeft className="w-4 h-4" />
              {language === 'zh-TW' ? '返回登入' : 'Back to login'}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
