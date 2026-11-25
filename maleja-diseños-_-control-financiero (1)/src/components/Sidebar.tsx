import React from 'react';
import {
  LayoutDashboard,
  ShoppingBag,
  Receipt,
  Cpu,
  Truck,
  CreditCard,
  History,
  FileText,
  Settings,
  Printer,
  X,
} from 'lucide-react';
import { BusinessSettings } from '../types/finance';
import { isValidLogoUrl } from '../utils/settingsUtils';

export type ActiveTab =
  | 'dashboard'
  | 'sales'
  | 'expenses'
  | 'production'
  | 'suppliers'
  | 'receivables'
  | 'history'
  | 'reports'
  | 'settings';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  pendingReceivablesCount: number;
  settings: BusinessSettings;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  pendingReceivablesCount,
  settings,
  isMobileOpen = false,
  onCloseMobile,
}) => {
  const [logoLoadError, setLogoLoadError] = React.useState(false);

  React.useEffect(() => {
    setLogoLoadError(false);
  }, [settings.logoUrl]);

  const showLogoImg = Boolean(settings.logoUrl && isValidLogoUrl(settings.logoUrl) && !logoLoadError);

  const handleSelectTab = (tab: ActiveTab) => {
    setActiveTab(tab);
    onCloseMobile?.();
  };

  const getNavBtnClass = (tab: ActiveTab) =>
    `w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
      activeTab === tab
        ? 'bg-blue-600 text-white shadow-md dark:shadow-lg dark:shadow-blue-950'
        : 'hover:bg-slate-100 dark:hover:bg-[#0f172a] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
    }`;

  return (
    <>
      {isMobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-black/50 backdrop-blur-xs z-40 lg:hidden"
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 lg:static lg:z-auto lg:w-64 bg-white dark:bg-[#070b14] text-slate-600 dark:text-slate-400 flex flex-col flex-shrink-0 border-r border-slate-200 dark:border-[#1e293b] transition-transform duration-200 ease-out ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className="p-5 lg:p-6 flex items-center justify-between space-x-3 border-b border-slate-200 dark:border-[#1e293b]">
          <div className="flex items-center space-x-3 min-w-0">
            {showLogoImg ? (
              <div className="w-9 h-9 bg-slate-50 dark:bg-[#111827] border border-slate-200 dark:border-[#1e293b] rounded-xl flex items-center justify-center overflow-hidden shrink-0">
                <img
                  src={settings.logoUrl}
                  alt={settings.companyName}
                  referrerPolicy="no-referrer"
                  onError={() => setLogoLoadError(true)}
                  className="w-full h-full object-contain p-0.5"
                />
              </div>
            ) : (
              <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-md dark:shadow-blue-950 shrink-0">
                <Printer className="w-4 h-4" />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-sm font-extrabold tracking-tight text-slate-900 dark:text-white truncate">
                {settings.companyName || 'Maleja Diseños'}
              </h1>
              <p className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold">
                Control Financiero ({settings.currencyCode || 'COP'})
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Cerrar menú"
            className="lg:hidden p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="p-4 space-y-6 flex-1 overflow-y-auto">
          {/* Main Section */}
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => handleSelectTab('dashboard')}
              className={getNavBtnClass('dashboard')}
            >
              <div className="flex items-center space-x-3">
                <LayoutDashboard className="w-4 h-4" />
                <span>Overview</span>
              </div>
            </button>
          </div>

          {/* Commercial & Operations */}
          <div className="space-y-1.5">
            <p className="px-3 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Comercial</p>

            <button
              type="button"
              onClick={() => handleSelectTab('sales')}
              className={getNavBtnClass('sales')}
            >
              <div className="flex items-center space-x-3">
                <ShoppingBag className="w-4 h-4" />
                <span>Ventas</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleSelectTab('receivables')}
              className={getNavBtnClass('receivables')}
            >
              <div className="flex items-center space-x-3">
                <CreditCard className="w-4 h-4" />
                <span>Cuentas por Cobrar</span>
              </div>
              {pendingReceivablesCount > 0 && (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500 text-white">
                  {pendingReceivablesCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => handleSelectTab('expenses')}
              className={getNavBtnClass('expenses')}
            >
              <div className="flex items-center space-x-3">
                <Receipt className="w-4 h-4" />
                <span>Gastos</span>
              </div>
            </button>
          </div>

          {/* Production & Stock */}
          <div className="space-y-1.5">
            <p className="px-3 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Producción y Stock</p>

            <button
              type="button"
              onClick={() => handleSelectTab('production')}
              className={getNavBtnClass('production')}
            >
              <div className="flex items-center space-x-3">
                <Cpu className="w-4 h-4" />
                <span>Costos Producción</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleSelectTab('suppliers')}
              className={getNavBtnClass('suppliers')}
            >
              <div className="flex items-center space-x-3">
                <Truck className="w-4 h-4" />
                <span>Proveedores & Compras</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleSelectTab('history')}
              className={getNavBtnClass('history')}
            >
              <div className="flex items-center space-x-3">
                <History className="w-4 h-4" />
                <span>Historial</span>
              </div>
            </button>
          </div>

          {/* Insights & System */}
          <div className="space-y-1.5">
            <p className="px-3 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Informes y Sistema</p>

            <button
              type="button"
              onClick={() => handleSelectTab('reports')}
              className={getNavBtnClass('reports')}
            >
              <div className="flex items-center space-x-3">
                <FileText className="w-4 h-4" />
                <span>Informes P&L</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleSelectTab('settings')}
              className={getNavBtnClass('settings')}
            >
              <div className="flex items-center space-x-3">
                <Settings className="w-4 h-4" />
                <span>Configuración</span>
              </div>
            </button>
          </div>
        </nav>
      </aside>
    </>
  );
};
