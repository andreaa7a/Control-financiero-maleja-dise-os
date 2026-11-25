import React, { useState } from 'react';
import { 
  loginWithGoogle, 
  loginWithEmail, 
  registerWithEmail, 
  resetPassword,
  formatFirebaseAuthError 
} from '../services/firebaseService';
import { useTheme } from '../context/ThemeContext';
import { Printer, Lock, Mail, ArrowRight, AlertCircle, CheckCircle2, Sun, Moon } from 'lucide-react';

interface AuthViewProps {
  onLoginSuccess: () => void;
}

export const AuthView: React.FC<AuthViewProps> = ({ onLoginSuccess }) => {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  const [isRegister, setIsRegister] = useState(false);
  const [isForgot, setIsForgot] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      await loginWithGoogle();
      onLoginSuccess();
    } catch (err: any) {
      console.error('Google login error:', err);
      setError(formatFirebaseAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('Por favor ingrese un correo electrónico válido.');
      return;
    }

    if (!isForgot && password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    setLoading(true);

    try {
      if (isForgot) {
        await resetPassword(trimmedEmail);
        setMessage('Se ha enviado un enlace para restablecer su contraseña a su correo.');
        setIsForgot(false);
      } else if (isRegister) {
        await registerWithEmail(trimmedEmail, password);
        setMessage('Cuenta creada. Revisa tu correo para verificar tu dirección; el acceso requiere autorización del propietario del negocio.');
        onLoginSuccess();
      } else {
        await loginWithEmail(trimmedEmail, password);
        onLoginSuccess();
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      setError(formatFirebaseAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f4f7fb] dark:bg-[#070b14] text-slate-900 dark:text-slate-100 flex items-center justify-center p-4 selection:bg-blue-600 selection:text-white font-sans relative transition-colors duration-200">
      {/* Top-right Theme Switcher */}
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
        title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
        className="fixed top-5 right-5 z-20 flex items-center gap-1 p-1 bg-white dark:bg-[#0d1322] border border-slate-200 dark:border-[#1e293b] rounded-xl shadow-md transition-all hover:border-blue-500/50"
      >
        <span className={`p-1.5 rounded-lg transition-all ${!isDark ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400'}`}>
          <Sun className="w-4 h-4" />
        </span>
        <span className={`p-1.5 rounded-lg transition-all ${isDark ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500'}`}>
          <Moon className="w-4 h-4" />
        </span>
      </button>

      <div className="w-full max-w-md bg-white dark:bg-[#0d1322] border border-slate-200 dark:border-[#1e293b] rounded-3xl p-8 shadow-xl dark:shadow-2xl relative overflow-hidden space-y-8 animate-fadeIn">
        {/* Glow effect */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-600/10 dark:bg-blue-600/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-purple-600/10 dark:bg-purple-600/20 rounded-full blur-3xl pointer-events-none"></div>

        {/* Brand Header */}
        <div className="text-center space-y-3 relative z-10">
          <div className="w-14 h-14 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center text-white mx-auto shadow-lg shadow-blue-600/20 dark:shadow-blue-950">
            <Printer className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Maleja Diseños</h1>
            <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold uppercase tracking-widest mt-0.5">Control Financiero Empresarial</p>
          </div>
        </div>

        {/* Error / Success feedback */}
        {error && (
          <div className="p-3.5 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 rounded-2xl flex items-center gap-3 text-xs text-rose-700 dark:text-rose-300">
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {message && (
          <div className="p-3.5 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-2xl flex items-center gap-3 text-xs text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            <span>{message}</span>
          </div>
        )}

        {/* Google One-Click Login */}
        {!isForgot && (
          <div className="space-y-3 relative z-10">
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full py-3 px-4 bg-slate-50 dark:bg-[#111827] hover:bg-slate-100 dark:hover:bg-[#1e293b] border border-slate-200 dark:border-[#1e293b] rounded-2xl font-semibold text-xs text-slate-800 dark:text-white transition-all flex items-center justify-center space-x-3 shadow-sm group"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              <span>Continuar con Google</span>
            </button>

            <div className="flex items-center my-4">
              <div className="flex-1 border-t border-slate-200 dark:border-[#1e293b]"></div>
              <span className="px-3 text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-widest font-bold">o con correo</span>
              <div className="flex-1 border-t border-slate-200 dark:border-[#1e293b]"></div>
            </div>
          </div>
        )}

        {/* Email Form */}
        <form onSubmit={handleSubmit} className="space-y-4 relative z-10 text-xs">
          <div>
            <label className="block font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">Correo Electrónico</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-3.5" />
              <input
                type="email"
                placeholder="nombre@negocio.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-[#111827] border border-slate-200 dark:border-[#1e293b] rounded-2xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-blue-500 font-medium"
                required
              />
            </div>
          </div>

          {!isForgot && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Contraseña</label>
                {!isRegister && (
                  <button
                    type="button"
                    onClick={() => setIsForgot(true)}
                    className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline font-semibold"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-3.5" />
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-[#111827] border border-slate-200 dark:border-[#1e293b] rounded-2xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-blue-500 font-medium"
                  required
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-2xl shadow-lg shadow-blue-600/20 dark:shadow-blue-950 transition-all flex items-center justify-center space-x-2 mt-2"
          >
            <span>{isForgot ? 'Enviar instrucciones' : isRegister ? 'Crear Cuenta' : 'Iniciar Sesión'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Footer toggles */}
        <div className="text-center space-y-2 pt-2 border-t border-slate-200 dark:border-[#1e293b] text-xs relative z-10">
          {isForgot ? (
            <button
              type="button"
              onClick={() => setIsForgot(false)}
              className="text-blue-600 dark:text-blue-400 hover:underline font-semibold"
            >
              ← Volver al inicio de sesión
            </button>
          ) : (
            <p className="text-slate-500 dark:text-slate-400">
              {isRegister ? '¿Ya tienes una cuenta?' : '¿No tienes una cuenta en Maleja Diseños?'}{' '}
              <button
                type="button"
                onClick={() => setIsRegister(!isRegister)}
                className="text-blue-600 dark:text-blue-400 hover:underline font-bold ml-1"
              >
                {isRegister ? 'Inicia sesión' : 'Regístrate aquí'}
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
