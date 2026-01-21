/**
 * Reset Password Page for Edu-Analyst AI
 */

import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, AlertCircle, Loader2, LayoutDashboard, CheckCircle, ArrowLeft } from 'lucide-react';
import { resetPassword, AuthApiError } from '../services/authApi';
import { Language, translations } from '../locales/translations';

interface ResetPasswordPageProps {
  darkMode: boolean;
  language: Language;
}

export default function ResetPasswordPage({ darkMode, language }: ResetPasswordPageProps) {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const navigate = useNavigate();
  const t = translations[language];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError(language === 'zh-TW' ? '無效的重設連結' : 'Invalid reset link');
      return;
    }

    if (password !== confirmPassword) {
      setError(language === 'zh-TW' ? '密碼不相符' : 'Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError(language === 'zh-TW' ? '密碼至少需要 8 個字元' : 'Password must be at least 8 characters');
      return;
    }

    setLoading(true);

    try {
      await resetPassword(token, password);
      setSuccess(true);
    } catch (err) {
      if (err instanceof AuthApiError) {
        setError(err.message);
      } else {
        setError(language === 'zh-TW' ? '重設密碼時發生錯誤' : 'An error occurred while resetting your password');
      }
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className={`min-h-screen flex items-center justify-center px-4 ${darkMode ? 'dark bg-slate-950' : 'bg-slate-50'}`}>
        <div className="w-full max-w-md">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-8 border border-slate-200 dark:border-slate-800 text-center">
            <div className="w-16 h-16 bg-rose-100 dark:bg-rose-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-rose-600 dark:text-rose-400" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
              {language === 'zh-TW' ? '無效的重設連結' : 'Invalid Reset Link'}
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              {language === 'zh-TW'
                ? '此密碼重設連結無效或已過期。請重新申請密碼重設。'
                : 'This password reset link is invalid or has expired. Please request a new password reset.'}
            </p>
            <Link
              to="/forgot-password"
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-lg hover:opacity-90"
            >
              {language === 'zh-TW' ? '重新申請' : 'Request Again'}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className={`min-h-screen flex items-center justify-center px-4 ${darkMode ? 'dark bg-slate-950' : 'bg-slate-50'}`}>
        <div className="w-full max-w-md">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-8 border border-slate-200 dark:border-slate-800 text-center">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
              {language === 'zh-TW' ? '密碼已重設' : 'Password Reset'}
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              {language === 'zh-TW'
                ? '您的密碼已成功重設。請使用新密碼登入。'
                : 'Your password has been successfully reset. Please sign in with your new password.'}
            </p>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-lg hover:opacity-90"
            >
              {language === 'zh-TW' ? '前往登入' : 'Go to Login'}
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
            {language === 'zh-TW' ? '設定新密碼' : 'Set new password'}
          </h1>
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
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                {language === 'zh-TW' ? '新密碼' : 'New Password'}
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 dark:text-white"
                  placeholder={language === 'zh-TW' ? '輸入新密碼（至少 8 字元）' : 'Enter new password (min 8 characters)'}
                />
              </div>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                {language === 'zh-TW' ? '確認新密碼' : 'Confirm New Password'}
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 dark:text-white"
                  placeholder={language === 'zh-TW' ? '再次輸入新密碼' : 'Confirm new password'}
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
                language === 'zh-TW' ? '重設密碼' : 'Reset Password'
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
