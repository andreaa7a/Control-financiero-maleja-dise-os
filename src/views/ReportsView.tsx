import React, { useState, useMemo } from 'react';
import { Sale, Expense, ProductionCost, PurchaseOrder, BusinessSettings } from '../types/finance';
import { formatCOP, getTodayString } from '../utils/formatters';
import { buildFinancialReportData } from '../utils/reportCalculations';
import {
  exportFinancialReportToExcel,
  exportFinancialReportToPDF,
  exportConsolidatedWorkbookToExcel,
  FinancialReportKey,
  formatPeriodLabel,
} from '../utils/exportUtils';
import { 
  FileSpreadsheet,
  FileText, 
  TrendingUp, 
  DollarSign, 
  ShoppingBag, 
  Layers, 
  Briefcase, 
  Calendar, 
  PieChart, 
  Users,
  BarChart3,
  BookOpen,
} from 'lucide-react';

interface ReportsViewProps {
  sales: Sale[];
  expenses: Expense[];
  productionCosts: ProductionCost[];
  purchaseOrders: PurchaseOrder[];
  settings: BusinessSettings;
}

type PeriodPreset = 'all' | 'today' | 'week' | 'month' | 'prev_month' | 'year' | 'custom';

export const ReportsView: React.FC<ReportsViewProps> = ({
  sales,
  expenses,
  productionCosts,
  purchaseOrders,
  settings,
}) => {
  const [activeReport, setActiveReport] = useState<FinancialReportKey>('pnl');
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const handleApplyPreset = (preset: PeriodPreset) => {
    setPeriodPreset(preset);
    const now = new Date();
    const today = getTodayString();

    if (preset === 'all') {
      setDateFrom('');
      setDateTo('');
    } else if (preset === 'today') {
      setDateFrom(today);
      setDateTo(today);
    } else if (preset === 'week') {
      const d = new Date(now);
      d.setDate(now.getDate() - 7);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      setDateFrom(`${y}-${m}-${day}`);
      setDateTo(today);
    } else if (preset === 'month') {
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      setDateFrom(`${y}-${m}-01`);
      setDateTo(today);
    } else if (preset === 'prev_month') {
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const prevEnd = new Date(now.getFullYear(), now.getMonth(), 0);
      const y1 = prev.getFullYear();
      const m1 = String(prev.getMonth() + 1).padStart(2, '0');
      const y2 = prevEnd.getFullYear();
      const m2 = String(prevEnd.getMonth() + 1).padStart(2, '0');
      const d2 = String(prevEnd.getDate()).padStart(2, '0');
      setDateFrom(`${y1}-${m1}-01`);
      setDateTo(`${y2}-${m2}-${d2}`);
    } else if (preset === 'year') {
      setDateFrom(`${now.getFullYear()}-01-01`);
      setDateTo(today);
    }
  };

  const reportBundle = useMemo(
    () =>
      buildFinancialReportData({
        sales,
        expenses,
        productionCosts,
        purchaseOrders,
        dateFrom,
        dateTo,
        saleCategories: settings.saleCategories,
      }),
    [sales, expenses, productionCosts, purchaseOrders, dateFrom, dateTo, settings.saleCategories]
  );

  const {
    filteredSales,
    filteredExpenses,
    filteredProduction,
    filteredPurchases,
    payload: reportPayload,
  } = reportBundle;

  const {
    totalSalesBilled,
    totalCollected,
    totalFixedExpenses,
    totalVarExpenses,
    totalExpenses,
    totalProduction,
    totalPurchases,
    grossProfit,
    grossMargin,
    netEstimatedProfit,
    netRealProfit,
    dailySalesList,
    monthlySalesList,
    yearlySalesList,
    fixedExpensesList,
    variableExpensesList,
    receivablesList,
    monthlyComparisonList,
    serviceProfitability,
  } = reportPayload;

  const exportMeta = {
    dateFrom,
    dateTo,
    appliedFilters: [
      periodPreset !== 'all' ? `Rango rápido: ${periodPreset}` : 'Todos los periodos',
    ],
  };

  const handleConsolidatedExcel = () => {
    const derivedReceivables = receivablesList.map((r) => ({
      id: `AR-${r.id}`,
      saleId: r.id,
      clientName: r.clientName,
      clientPhone: r.clientPhone,
      totalAmount: r.total,
      paidAmount: r.paid,
      pendingAmount: r.pending,
      dueDate: r.date,
      status: 'Pendiente' as const,
    }));
    exportConsolidatedWorkbookToExcel({
      sales: filteredSales,
      expenses: filteredExpenses,
      purchases: filteredPurchases,
      receivables: derivedReceivables,
      productionCosts: filteredProduction,
      settings,
      meta: exportMeta,
    });
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Header */}
      <div className="bg-white dark:bg-[#0d1322] border border-slate-200 dark:border-[#1e293b] rounded-2xl p-6 shadow-sm dark:shadow-xl flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 transition-colors">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>Informes Financieros y Estado de Resultados</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Generación automática de reportes ejecutivos basados 100% en registros reales de {settings.companyName}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => exportFinancialReportToExcel(activeReport, reportPayload, settings, exportMeta)}
            className="px-3.5 py-2.5 bg-slate-100 dark:bg-[#111827] hover:bg-slate-200 dark:hover:bg-[#1e293b] border border-slate-200 dark:border-[#1e293b] text-slate-800 dark:text-slate-200 font-semibold rounded-xl text-xs flex items-center gap-2 transition-colors shadow-sm"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Exportar Informe Excel</span>
          </button>
          <button
            type="button"
            onClick={handleConsolidatedExcel}
            className="px-3.5 py-2.5 bg-slate-100 dark:bg-[#111827] hover:bg-slate-200 dark:hover:bg-[#1e293b] border border-slate-200 dark:border-[#1e293b] text-slate-800 dark:text-slate-200 font-semibold rounded-xl text-xs flex items-center gap-2 transition-colors shadow-sm"
          >
            <BookOpen className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>Consolidado Excel</span>
          </button>
          <button
            type="button"
            onClick={() => exportFinancialReportToPDF(activeReport, reportPayload, settings, exportMeta)}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl text-xs flex items-center gap-2 transition-colors shadow-md dark:shadow-blue-950"
          >
            <FileText className="w-4 h-4" />
            <span>Descargar PDF</span>
          </button>
        </div>
      </div>

      {/* Period & Date Selector */}
      <div className="bg-white dark:bg-[#0d1322] border border-slate-200 dark:border-[#1e293b] p-4 rounded-2xl shadow-sm dark:shadow-lg flex flex-col xl:flex-row xl:items-center justify-between gap-4 transition-colors">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mr-1 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            Periodo:
          </span>
          {[
            { id: 'all', label: 'Histórico Completo' },
            { id: 'today', label: 'Hoy' },
            { id: 'week', label: 'Últimos 7 días' },
            { id: 'month', label: 'Este Mes' },
            { id: 'prev_month', label: 'Mes Anterior' },
            { id: 'year', label: 'Este Año' },
          ].map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => handleApplyPreset(preset.id as PeriodPreset)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                periodPreset === preset.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-[#111827] text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-[#1e293b]'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-semibold text-slate-500 dark:text-slate-400">Rango exacto:</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setPeriodPreset('custom');
              setDateFrom(e.target.value);
            }}
            aria-label="Fecha desde"
            className="px-3 py-1.5 bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-[#1e293b] rounded-lg text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
          />
          <span className="text-slate-400">a</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setPeriodPreset('custom');
              setDateTo(e.target.value);
            }}
            aria-label="Fecha hasta"
            className="px-3 py-1.5 bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-[#1e293b] rounded-lg text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
          />
          <span className="px-2.5 py-1 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30 rounded-lg text-[11px] font-semibold">
            {formatPeriodLabel(dateFrom, dateTo)}
          </span>
        </div>
      </div>

      {/* Reports Selector Tabs */}
      <div className="bg-white dark:bg-[#0d1322] border border-slate-200 dark:border-[#1e293b] p-3 rounded-2xl shadow-sm dark:shadow-lg overflow-x-auto flex items-center gap-2 transition-colors">
        {[
          { id: 'pnl', label: 'Estado P&L General', icon: FileText },
          { id: 'daily_sales', label: 'Ventas Diarias', icon: Calendar },
          { id: 'monthly_sales', label: 'Ventas Mensuales', icon: TrendingUp },
          { id: 'yearly_sales', label: 'Ventas Anuales', icon: DollarSign },
          { id: 'fixed_expenses', label: 'Gastos Fijos', icon: Layers },
          { id: 'variable_expenses', label: 'Gastos Variables', icon: Layers },
          { id: 'production_costs', label: 'Costos Producción', icon: ShoppingBag },
          { id: 'gross_profit', label: 'Utilidad Bruta', icon: TrendingUp },
          { id: 'net_profit', label: 'Utilidad Neta', icon: DollarSign },
          { id: 'receivables', label: 'Cuentas por Cobrar', icon: Users },
          { id: 'suppliers_purchases', label: 'Compras y Proveedores', icon: Briefcase },
          { id: 'monthly_comparison', label: 'Comparación Mensual', icon: BarChart3 },
          { id: 'service_profitability', label: 'Rentabilidad por Servicio', icon: PieChart },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeReport === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveReport(tab.id as FinancialReportKey)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-2 ${
                isActive 
                  ? 'bg-blue-600 text-white shadow-md dark:shadow-lg dark:shadow-blue-950' 
                  : 'bg-slate-100 dark:bg-[#111827] text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-[#1e293b] hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Report Content View */}
      <div className="bg-white dark:bg-[#0d1322] border border-slate-200 dark:border-[#1e293b] rounded-2xl p-6 lg:p-8 shadow-sm dark:shadow-xl space-y-6 text-xs transition-colors">
        
        {/* 1. P&L General */}
        {activeReport === 'pnl' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-[#1e293b]">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">Estado de Resultados Integral (P&L)</h3>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  {settings.companyName} • Periodo: {formatPeriodLabel(dateFrom, dateTo)}
                </p>
              </div>
              <span className="px-3 py-1 bg-blue-50 dark:bg-[#111827] border border-blue-200 dark:border-[#1e293b] text-blue-700 dark:text-blue-400 rounded-full font-bold">
                COP ($) Moneda Real
              </span>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between font-bold text-slate-900 dark:text-white text-sm">
                  <span>1. INGRESOS OPERACIONALES (VENTAS FACTURADAS)</span>
                  <span className="text-emerald-600 dark:text-emerald-400">{formatCOP(totalSalesBilled)}</span>
                </div>
                <div className="pl-4 space-y-1 text-slate-500 dark:text-slate-400">
                  <div className="flex justify-between">
                    <span>Dinero Efectivamente Recibido (Caja / Bancos):</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">{formatCOP(totalCollected)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Cuentas por Cobrar Pendientes:</span>
                    <span className="font-semibold text-amber-600 dark:text-amber-400">{formatCOP(totalSalesBilled - totalCollected)}</span>
                  </div>
                </div>
              </div>

              <hr className="border-slate-200 dark:border-[#1e293b]" />

              <div className="space-y-2">
                <div className="flex justify-between font-bold text-slate-900 dark:text-white text-sm">
                  <span>2. COSTOS DIRECTOS DE PRODUCCIÓN</span>
                  <span className="text-rose-600 dark:text-rose-400">- {formatCOP(totalProduction)}</span>
                </div>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-[#111827] border border-slate-200 dark:border-[#1e293b] rounded-xl flex justify-between font-black text-slate-900 dark:text-white text-sm">
                <span>UTILIDAD BRUTA ({grossMargin.toFixed(1)}% margen):</span>
                <span className="text-blue-600 dark:text-blue-400">{formatCOP(grossProfit)}</span>
              </div>

              <hr className="border-slate-200 dark:border-[#1e293b]" />

              <div className="space-y-2">
                <div className="flex justify-between font-bold text-slate-900 dark:text-white text-sm">
                  <span>3. GASTOS OPERATIVOS (FIJOS + VARIABLES)</span>
                  <span className="text-rose-600 dark:text-rose-400">- {formatCOP(totalExpenses)}</span>
                </div>
                <div className="pl-4 space-y-1 text-slate-500 dark:text-slate-400">
                  <div className="flex justify-between">
                    <span>Gastos Fijos:</span>
                    <span className="text-slate-700 dark:text-slate-300">{formatCOP(totalFixedExpenses)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Gastos Variables / Extraordinarios:</span>
                    <span className="text-slate-700 dark:text-slate-300">{formatCOP(totalVarExpenses)}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                <div className="p-5 bg-gradient-to-r from-blue-50 to-white dark:from-blue-950 dark:to-[#0d1322] text-slate-900 dark:text-white rounded-2xl border border-blue-200 dark:border-blue-500/30 shadow-sm dark:shadow-lg">
                  <p className="font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wider text-[10px]">Utilidad Neta Estimada (Contable)</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Ventas Facturadas - Costos - Gastos</p>
                  <p className={`text-xl font-black mt-2 ${netEstimatedProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                    {formatCOP(netEstimatedProfit)}
                  </p>
                </div>

                <div className="p-5 bg-gradient-to-r from-emerald-50 to-white dark:from-emerald-950 dark:to-[#0d1322] text-slate-900 dark:text-white rounded-2xl border border-emerald-200 dark:border-emerald-500/30 shadow-sm dark:shadow-lg">
                  <p className="font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider text-[10px]">Flujo de Caja Neto Real</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Dinero Recibido - Costos - Gastos Pagados</p>
                  <p className={`text-xl font-black mt-2 ${netRealProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                    {formatCOP(netRealProfit)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2. Daily Sales */}
        {activeReport === 'daily_sales' && (
          <div className="space-y-4 animate-fadeIn">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Informe de Ventas Diarias</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-[#111827] border-b border-slate-200 dark:border-[#1e293b] text-slate-500 dark:text-slate-400 font-bold uppercase text-[10px]">
                    <th className="p-3">Fecha</th>
                    <th className="p-3 text-center">Nº Ventas</th>
                    <th className="p-3 text-right">Facturado (COP)</th>
                    <th className="p-3 text-right">Recibido (COP)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-[#1e293b]">
                  {dailySalesList.map(row => (
                    <tr key={row.date} className="hover:bg-slate-50 dark:hover:bg-[#111827]/50">
                      <td className="p-3 font-bold text-slate-900 dark:text-white">{row.date}</td>
                      <td className="p-3 text-center text-slate-600 dark:text-slate-300">{row.count}</td>
                      <td className="p-3 text-right font-bold text-emerald-600 dark:text-emerald-400">{formatCOP(row.billed)}</td>
                      <td className="p-3 text-right font-semibold text-blue-600 dark:text-blue-400">{formatCOP(row.collected)}</td>
                    </tr>
                  ))}
                  {dailySalesList.length === 0 && (
                    <tr><td colSpan={4} className="p-6 text-center text-slate-500">Sin ventas en el periodo seleccionado.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 3. Monthly Sales */}
        {activeReport === 'monthly_sales' && (
          <div className="space-y-4 animate-fadeIn">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Informe de Ventas Mensuales</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-[#111827] border-b border-slate-200 dark:border-[#1e293b] text-slate-500 dark:text-slate-400 font-bold uppercase text-[10px]">
                    <th className="p-3">Periodo (Mes)</th>
                    <th className="p-3 text-center">Nº Ventas</th>
                    <th className="p-3 text-right">Facturado (COP)</th>
                    <th className="p-3 text-right">Recibido (COP)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-[#1e293b]">
                  {monthlySalesList.map(row => (
                    <tr key={row.month} className="hover:bg-slate-50 dark:hover:bg-[#111827]/50">
                      <td className="p-3 font-bold text-slate-900 dark:text-white">{row.month}</td>
                      <td className="p-3 text-center text-slate-600 dark:text-slate-300">{row.count}</td>
                      <td className="p-3 text-right font-bold text-emerald-600 dark:text-emerald-400">{formatCOP(row.billed)}</td>
                      <td className="p-3 text-right font-semibold text-blue-600 dark:text-blue-400">{formatCOP(row.collected)}</td>
                    </tr>
                  ))}
                  {monthlySalesList.length === 0 && (
                    <tr><td colSpan={4} className="p-6 text-center text-slate-500">Sin ventas en el periodo seleccionado.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 4. Yearly Sales */}
        {activeReport === 'yearly_sales' && (
          <div className="space-y-4 animate-fadeIn">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Informe de Ventas Anuales</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-[#111827] border-b border-slate-200 dark:border-[#1e293b] text-slate-500 dark:text-slate-400 font-bold uppercase text-[10px]">
                    <th className="p-3">Año</th>
                    <th className="p-3 text-center">Nº Ventas</th>
                    <th className="p-3 text-right">Facturado (COP)</th>
                    <th className="p-3 text-right">Recibido (COP)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-[#1e293b]">
                  {yearlySalesList.map(row => (
                    <tr key={row.year} className="hover:bg-slate-50 dark:hover:bg-[#111827]/50">
                      <td className="p-3 font-bold text-slate-900 dark:text-white">{row.year}</td>
                      <td className="p-3 text-center text-slate-600 dark:text-slate-300">{row.count}</td>
                      <td className="p-3 text-right font-bold text-emerald-600 dark:text-emerald-400">{formatCOP(row.billed)}</td>
                      <td className="p-3 text-right font-semibold text-blue-600 dark:text-blue-400">{formatCOP(row.collected)}</td>
                    </tr>
                  ))}
                  {yearlySalesList.length === 0 && (
                    <tr><td colSpan={4} className="p-6 text-center text-slate-500">Sin ventas anuales en el periodo seleccionado.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 5. Fixed Expenses */}
        {activeReport === 'fixed_expenses' && (
          <div className="space-y-4 animate-fadeIn">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Informe de Gastos Fijos</h3>
              <span className="font-black text-rose-600 dark:text-rose-400 text-sm">Total: {formatCOP(totalFixedExpenses)}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-[#111827] border-b border-slate-200 dark:border-[#1e293b] text-slate-500 dark:text-slate-400 font-bold uppercase text-[10px]">
                    <th className="p-3">Fecha</th>
                    <th className="p-3">Descripción</th>
                    <th className="p-3">Categoría</th>
                    <th className="p-3">Medio de Pago</th>
                    <th className="p-3 text-right">Valor (COP)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-[#1e293b]">
                  {fixedExpensesList.map(e => (
                    <tr key={e.id} className="hover:bg-slate-50 dark:hover:bg-[#111827]/50">
                      <td className="p-3 text-slate-600 dark:text-slate-300">{e.date}</td>
                      <td className="p-3 font-semibold text-slate-900 dark:text-white">{e.description}</td>
                      <td className="p-3 text-slate-500 dark:text-slate-400">{e.category}</td>
                      <td className="p-3 text-slate-600 dark:text-slate-300">{e.paymentMethod}</td>
                      <td className="p-3 text-right font-bold text-rose-600 dark:text-rose-400">- {formatCOP(e.amount)}</td>
                    </tr>
                  ))}
                  {fixedExpensesList.length === 0 && (
                    <tr><td colSpan={5} className="p-6 text-center text-slate-500">Sin gastos fijos en el periodo seleccionado.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 6. Variable Expenses */}
        {activeReport === 'variable_expenses' && (
          <div className="space-y-4 animate-fadeIn">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Informe de Gastos Variables y Extraordinarios</h3>
              <span className="font-black text-rose-600 dark:text-rose-400 text-sm">Total: {formatCOP(totalVarExpenses)}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-[#111827] border-b border-slate-200 dark:border-[#1e293b] text-slate-500 dark:text-slate-400 font-bold uppercase text-[10px]">
                    <th className="p-3">Fecha</th>
                    <th className="p-3">Tipo</th>
                    <th className="p-3">Descripción</th>
                    <th className="p-3">Categoría</th>
                    <th className="p-3 text-right">Valor (COP)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-[#1e293b]">
                  {variableExpensesList.map(e => (
                    <tr key={e.id} className="hover:bg-slate-50 dark:hover:bg-[#111827]/50">
                      <td className="p-3 text-slate-600 dark:text-slate-300">{e.date}</td>
                      <td className="p-3 text-amber-600 dark:text-amber-400 font-semibold">{e.type}</td>
                      <td className="p-3 font-semibold text-slate-900 dark:text-white">{e.description}</td>
                      <td className="p-3 text-slate-500 dark:text-slate-400">{e.category}</td>
                      <td className="p-3 text-right font-bold text-rose-600 dark:text-rose-400">- {formatCOP(e.amount)}</td>
                    </tr>
                  ))}
                  {variableExpensesList.length === 0 && (
                    <tr><td colSpan={5} className="p-6 text-center text-slate-500">Sin gastos variables en el periodo seleccionado.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 7. Production Costs */}
        {activeReport === 'production_costs' && (
          <div className="space-y-4 animate-fadeIn">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Informe de Costos de Producción</h3>
              <span className="font-black text-rose-600 dark:text-rose-400 text-sm">Total Costos: {formatCOP(totalProduction)}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-[#111827] border-b border-slate-200 dark:border-[#1e293b] text-slate-500 dark:text-slate-400 font-bold uppercase text-[10px]">
                    <th className="p-3">Referencia / Cliente</th>
                    <th className="p-3">Producto</th>
                    <th className="p-3 text-center">Cantidad</th>
                    <th className="p-3 text-right">Costo Total</th>
                    <th className="p-3 text-right">Costo Unitario</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-[#1e293b]">
                  {filteredProduction.map(pc => (
                    <tr key={pc.id} className="hover:bg-slate-50 dark:hover:bg-[#111827]/50">
                      <td className="p-3">
                        <div className="font-bold text-slate-900 dark:text-white">{pc.orderReference}</div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">{pc.clientName}</div>
                      </td>
                      <td className="p-3 font-semibold text-slate-800 dark:text-slate-200">{pc.productName}</td>
                      <td className="p-3 text-center text-slate-600 dark:text-slate-300">{pc.quantityProduced}</td>
                      <td className="p-3 text-right font-bold text-rose-600 dark:text-rose-400">{formatCOP(pc.totalCost)}</td>
                      <td className="p-3 text-right text-slate-600 dark:text-slate-300">{formatCOP(pc.unitCost)}</td>
                    </tr>
                  ))}
                  {filteredProduction.length === 0 && (
                    <tr><td colSpan={5} className="p-6 text-center text-slate-500">Sin costos de producción en el periodo seleccionado.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 8. Gross Profit */}
        {activeReport === 'gross_profit' && (
          <div className="space-y-4 animate-fadeIn">
            <div className="p-6 bg-slate-50 dark:bg-[#111827] border border-slate-200 dark:border-[#1e293b] rounded-2xl flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Utilidad Bruta Consolidada</h3>
                <p className="text-slate-500 dark:text-slate-400 text-[10px] mt-1">Ventas Facturadas menos Costos de Producción Directos</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-black text-blue-600 dark:text-blue-400">{formatCOP(grossProfit)}</p>
                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold mt-1">Margen: {grossMargin.toFixed(1)}%</p>
              </div>
            </div>
          </div>
        )}

        {/* 9. Net Profit */}
        {activeReport === 'net_profit' && (
          <div className="space-y-4 animate-fadeIn">
            <div className="p-6 bg-slate-50 dark:bg-[#111827] border border-slate-200 dark:border-[#1e293b] rounded-2xl flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Utilidad Neta Estimada</h3>
                <p className="text-slate-500 dark:text-slate-400 text-[10px] mt-1">Utilidad Bruta menos Gastos Operativos (Fijos + Variables)</p>
              </div>
              <div className="text-right">
                <p className={`text-2xl font-black ${netEstimatedProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                  {formatCOP(netEstimatedProfit)}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mt-1">Flujo Real: {formatCOP(netRealProfit)}</p>
              </div>
            </div>
          </div>
        )}

        {/* 10. Receivables */}
        {activeReport === 'receivables' && (
          <div className="space-y-4 animate-fadeIn">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Informe de Cuentas por Cobrar (Pendientes)</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-[#111827] border-b border-slate-200 dark:border-[#1e293b] text-slate-500 dark:text-slate-400 font-bold uppercase text-[10px]">
                    <th className="p-3">Venta ID / Fecha</th>
                    <th className="p-3">Cliente</th>
                    <th className="p-3 text-right">Total Venta</th>
                    <th className="p-3 text-right">Abonado</th>
                    <th className="p-3 text-right">Saldo Pendiente</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-[#1e293b]">
                  {receivablesList.map(r => (
                    <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-[#111827]/50">
                      <td className="p-3">
                        <div className="font-bold text-slate-900 dark:text-white">#{r.id}</div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">{r.date}</div>
                      </td>
                      <td className="p-3 font-semibold text-slate-800 dark:text-slate-200">{r.clientName}</td>
                      <td className="p-3 text-right text-slate-600 dark:text-slate-300">{formatCOP(r.total)}</td>
                      <td className="p-3 text-right text-emerald-600 dark:text-emerald-400">{formatCOP(r.paid)}</td>
                      <td className="p-3 text-right font-black text-amber-600 dark:text-amber-400">{formatCOP(r.pending)}</td>
                    </tr>
                  ))}
                  {receivablesList.length === 0 && (
                    <tr><td colSpan={5} className="p-6 text-center text-slate-500">No hay cuentas por cobrar pendientes en el periodo seleccionado.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 11. Suppliers and Purchases */}
        {activeReport === 'suppliers_purchases' && (
          <div className="space-y-4 animate-fadeIn">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Informe de Compras y Proveedores</h3>
              <span className="font-black text-indigo-600 dark:text-indigo-400 text-sm">Total Compras: {formatCOP(totalPurchases)}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-[#111827] border-b border-slate-200 dark:border-[#1e293b] text-slate-500 dark:text-slate-400 font-bold uppercase text-[10px]">
                    <th className="p-3">Fecha</th>
                    <th className="p-3">Proveedor</th>
                    <th className="p-3">Descripción de Insumos</th>
                    <th className="p-3">Estado</th>
                    <th className="p-3 text-right">Valor (COP)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-[#1e293b]">
                  {filteredPurchases.map(po => (
                    <tr key={po.id} className="hover:bg-slate-50 dark:hover:bg-[#111827]/50">
                      <td className="p-3 text-slate-600 dark:text-slate-300">{po.date}</td>
                      <td className="p-3 font-bold text-slate-900 dark:text-white">{po.supplierName}</td>
                      <td className="p-3 text-slate-600 dark:text-slate-300">{po.itemsDescription}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                          {po.status}
                        </span>
                      </td>
                      <td className="p-3 text-right font-bold text-indigo-600 dark:text-indigo-400">- {formatCOP(po.amount)}</td>
                    </tr>
                  ))}
                  {filteredPurchases.length === 0 && (
                    <tr><td colSpan={5} className="p-6 text-center text-slate-500">Sin compras registradas en el periodo seleccionado.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 12. Monthly Comparison */}
        {activeReport === 'monthly_comparison' && (
          <div className="space-y-4 animate-fadeIn">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Comparación Financiera entre Meses</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-[#111827] border-b border-slate-200 dark:border-[#1e293b] text-slate-500 dark:text-slate-400 font-bold uppercase text-[10px]">
                    <th className="p-3">Mes</th>
                    <th className="p-3 text-center">Nº Ventas</th>
                    <th className="p-3 text-right">Facturado</th>
                    <th className="p-3 text-right">Recibido</th>
                    <th className="p-3 text-right">Gastos Operativos</th>
                    <th className="p-3 text-right">Costos Producción</th>
                    <th className="p-3 text-right">Utilidad Estimada</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-[#1e293b]">
                  {monthlyComparisonList.map(m => (
                    <tr key={m.month} className="hover:bg-slate-50 dark:hover:bg-[#111827]/50">
                      <td className="p-3 font-bold text-slate-900 dark:text-white">{m.month}</td>
                      <td className="p-3 text-center text-slate-600 dark:text-slate-300">{m.salesCount}</td>
                      <td className="p-3 text-right font-semibold text-emerald-600 dark:text-emerald-400">{formatCOP(m.billed)}</td>
                      <td className="p-3 text-right text-blue-600 dark:text-blue-400">{formatCOP(m.collected)}</td>
                      <td className="p-3 text-right text-rose-600 dark:text-rose-400">{formatCOP(m.expenses)}</td>
                      <td className="p-3 text-right text-amber-600 dark:text-amber-400">{formatCOP(m.productionCost)}</td>
                      <td className={`p-3 text-right font-black ${m.estimatedProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                        {formatCOP(m.estimatedProfit)}
                      </td>
                    </tr>
                  ))}
                  {monthlyComparisonList.length === 0 && (
                    <tr><td colSpan={7} className="p-6 text-center text-slate-500">Sin movimientos en el periodo seleccionado.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 13. Service Profitability */}
        {activeReport === 'service_profitability' && (
          <div className="space-y-4 animate-fadeIn">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Rentabilidad por Servicio / Categoría</h3>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Calculado exclusivamente con costos reales registrados en Producción
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-[#111827] border-b border-slate-200 dark:border-[#1e293b] text-slate-500 dark:text-slate-400 font-bold uppercase text-[10px]">
                    <th className="p-3">Servicio / Categoría</th>
                    <th className="p-3 text-center">Unidades</th>
                    <th className="p-3 text-right">Ventas Totales</th>
                    <th className="p-3 text-right">Costo Producción</th>
                    <th className="p-3 text-right">Utilidad Bruta</th>
                    <th className="p-3 text-right">Margen %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-[#1e293b]">
                  {serviceProfitability.map(item => (
                    <tr key={item.category} className="hover:bg-slate-50 dark:hover:bg-[#111827]/50">
                      <td className="p-3 font-bold text-slate-900 dark:text-white">{item.category}</td>
                      <td className="p-3 text-center text-slate-600 dark:text-slate-300">{item.count}</td>
                      <td className="p-3 text-right font-semibold text-emerald-600 dark:text-emerald-400">{formatCOP(item.billed)}</td>
                      <td className="p-3 text-right text-rose-600 dark:text-rose-400">{formatCOP(item.cost)}</td>
                      <td className="p-3 text-right font-bold text-blue-600 dark:text-blue-400">{formatCOP(item.profit)}</td>
                      <td className="p-3 text-right font-black text-amber-600 dark:text-amber-400">{item.margin.toFixed(1)}%</td>
                    </tr>
                  ))}
                  {serviceProfitability.length === 0 && (
                    <tr><td colSpan={6} className="p-6 text-center text-slate-500">Sin datos de rentabilidad por servicio en el periodo seleccionado.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
