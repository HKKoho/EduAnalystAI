/**
 * Login Page for Edu-Analyst AI
 */

import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { LogIn, Mail, Lock, AlertCircle, Loader2, LayoutDashboard } from 'lucide-react';
import { useAuth, AuthApiError } from '../contexts/AuthContext';
import { Language, translations } from '../locales/translations';

interface LoginPageProps {
  darkMode: boolean;
  language: Language;
}

export default function LoginPage({ darkMode, language }: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const t = translations[language];
  const from = (location.state as { from?: Location })?.from?.pathname || '/';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      if (err instanceof AuthApiError) {
        setError(err.message);
      } else {
        setError(language === 'zh-TW' ? '登入時發生錯誤' : 'An error occurred during login');
      }
    } finally {
      setLoading(false);
    }
  };

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
            {language === 'zh-TW' ? '登入您的帳戶' : 'Sign in to your account'}
          </h1>
        </div>

        {/* Login Form */}
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

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                {language === 'zh-TW' ? '密碼' : 'Password'}
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 dark:text-white"
                  placeholder={language === 'zh-TW' ? '輸入您的密碼' : 'Enter your password'}
                />
              </div>
            </div>

            <div className="flex items-center justify-end">
              <Link
                to="/forgot-password"
                className="text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                {language === 'zh-TW' ? '忘記密碼？' : 'Forgot password?'}
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 transition-opacity"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  {language === 'zh-TW' ? '登入' : 'Sign In'}
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {language === 'zh-TW' ? '還沒有帳戶？' : "Don't have an account?"}{' '}
              <Link to="/register" className="font-semibold text-slate-900 dark:text-white hover:underline">
                {language === 'zh-TW' ? '註冊' : 'Sign up'}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
