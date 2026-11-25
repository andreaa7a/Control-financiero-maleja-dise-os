import React from 'react';
import { Sparkles, Plus, Search, LogOut, User, Sun, Moon, Menu, X } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import type { ActiveTab } from './Sidebar';

export interface GlobalSearchResult {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  tab: ActiveTab;
}

interface NavbarProps {
  onOpenAiAdvisor: () => void;
  onNewSale: () => void;
  onNewExpense: () => void;
  onToggleMobileMenu: () => void;
  pendingReceivablesCount: number;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  searchResults?: GlobalSearchResult[];
  onSelectSearchResult?: (tab: ActiveTab) => void;
  userEmail?: string | null;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenAiAdvisor,
  onNewSale,
  onNewExpense,
  onToggleMobileMenu,
  pendingReceivablesCount,
  searchTerm,
  setSearchTerm,
  searchResults = [],
  onSelectSearchResult,
  userEmail,
  onLogout,
}) => {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  const showDropdown = searchTerm.trim().length >= 2;

  return (
    <header className="bg-white/95 dark:bg-[#0b1120] border-b border-slate-200 dark:border-[#1e293b] sticky top-0 z-30 px-3 sm:px-6 py-3 flex items-center justify-between gap-2 sm:gap-3 transition-colors duration-200 backdrop-blur-md">
      {/* Left: Mobile Menu Button + Search Bar */}
      <div className="flex items-center space-x-2 sm:space-x-4 flex-1 max-w-md min-w-0">
        <button
          type="button"
          onClick={onToggleMobileMenu}
          aria-label="Abrir menú de navegación"
          className="lg:hidden p-2 bg-slate-100 dark:bg-[#111827] border border-slate-200 dark:border-[#1e293b] rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-[#1e293b] shrink-0"
        >
          <Menu className="w-4 h-4" />
        </button>

        <div className="relative w-full min-w-0">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 sm:top-3 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar ventas, clientes, gastos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-8 py-2 bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-[#1e293b] rounded-xl text-xs sm:text-sm text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors shadow-inner"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              aria-label="Limpiar búsqueda"
              className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          {showDropdown && (
            <div className="absolute left-0 right-0 mt-2 bg-white dark:bg-[#0d1322] border border-slate-200 dark:border-[#1e293b] rounded-2xl shadow-2xl overflow-hidden z-50 max-h-80 overflow-y-auto">
              {searchResults.length === 0 ? (
                <div className="p-4 text-xs text-slate-500 dark:text-slate-400 text-center">
                  No hay coincidencias para "{searchTerm.trim()}".
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-[#1e293b]">
                  {searchResults.map((item) => (
                    <button
                      key={`${item.tab}-${item.id}`}
                      type="button"
                      onClick={() => {
                        onSelectSearchResult?.(item.tab);
                        setSearchTerm('');
                      }}
                      className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-[#111827] flex items-center justify-between gap-3 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {item.title}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          {item.subtitle}
                        </p>
                      </div>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-blue-50 dark:bg-blue-600/20 text-blue-700 dark:text-blue-300 shrink-0">
                        {item.badge}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right Actions & Profile */}
      <div className="flex items-center space-x-1.5 sm:space-x-3 shrink-0">
        {pendingReceivablesCount > 0 && (
          <div className="hidden md:flex items-center space-x-1.5 px-3 py-1.5 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl text-amber-700 dark:text-amber-400 text-xs font-medium">
            <span className="w-2 h-2 rounded-full bg-amber-500 dark:bg-amber-400 animate-pulse"></span>
            <span>{pendingReceivablesCount} por cobrar</span>
          </div>
        )}

        <button
          type="button"
          onClick={onOpenAiAdvisor}
          className="px-2.5 sm:px-3.5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-md dark:shadow-lg dark:shadow-blue-950 transition-all flex items-center space-x-1.5"
          title="Abrir Asistente IA"
        >
          <Sparkles className="w-4 h-4 text-blue-100" />
          <span className="hidden sm:inline">Asistente IA</span>
        </button>

        <div className="hidden sm:flex items-center space-x-2">
          <button
            type="button"
            onClick={onNewSale}
            className="px-3 sm:px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-semibold rounded-xl transition-all flex items-center space-x-1 shadow-sm"
            title="Ir a Ventas"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden lg:inline">Venta</span>
          </button>
          <button
            type="button"
            onClick={onNewExpense}
            className="px-3 sm:px-3.5 py-2 bg-slate-100 dark:bg-[#1e293b] hover:bg-slate-200 dark:hover:bg-[#334155] text-slate-700 dark:text-slate-200 text-xs sm:text-sm font-semibold rounded-xl transition-all flex items-center space-x-1 border border-slate-200 dark:border-[#334155]"
            title="Ir a Gastos"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden lg:inline">Gasto</span>
          </button>
        </div>

        {/* Theme Switcher Button (Sun & Moon) */}
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          className="flex items-center gap-0.5 sm:gap-1 p-1 bg-slate-100 dark:bg-[#111827] border border-slate-200 dark:border-[#1e293b] rounded-xl transition-all hover:border-blue-500/50 shadow-sm"
        >
          <span
            className={`p-1.5 rounded-lg transition-all ${
              !isDark
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sun className="w-3.5 h-3.5" />
          </span>
          <span
            className={`p-1.5 rounded-lg transition-all ${
              isDark
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Moon className="w-3.5 h-3.5" />
          </span>
        </button>

        <div className="h-6 w-px bg-slate-200 dark:bg-[#1e293b] hidden sm:block"></div>

        {/* User & Logout */}
        <div className="flex items-center space-x-2 text-slate-600 dark:text-slate-400">
          <div className="hidden sm:flex items-center space-x-2.5 pl-1">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-xs shadow-md">
              <User className="w-4 h-4" />
            </div>
            <div className="hidden md:block text-left">
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block truncate max-w-[130px]">
                {userEmail || 'Maleja Admin'}
              </span>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block font-medium">Sesión Segura</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onLogout}
            className="p-2 bg-slate-100 dark:bg-[#111827] hover:bg-rose-50 dark:hover:bg-rose-500/20 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-xl transition-colors border border-slate-200 dark:border-[#1e293b]"
            title="Cerrar Sesión"
            aria-label="Cerrar Sesión"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
