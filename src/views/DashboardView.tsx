import React, { useState } from 'react';
import { 
  Sale, 
  Expense, 
  ProductionCost, 
  PurchaseOrder, 
  AccountReceivable,
  BusinessSettings,
} from '../types/finance';
import { formatCOP, getTodayString } from '../utils/formatters';
import {
  calculateMonthlyGoalsProgress,
  calculateTotalMonthlyFixedExpenses,
} from '../utils/settingsUtils';
import { 
  DashboardTimeFilter, 
  filterSalesByRange, 
  filterExpensesByRange, 
  filterProductionByRange, 
  filterPurchasesByRange 
} from '../utils/dateFilters';
import { 
  TrendingUp, 
  ShoppingBag, 
  Receipt, 
  Cpu, 
  CreditCard, 
  DollarSign, 
  Wallet, 
  Plus, 
  BarChart3,
  PieChart,
  Target,
} from 'lucide-react';

interface DashboardViewProps {
  sales: Sale[];
  expenses: Expense[];
  productionCosts: ProductionCost[];
  purchaseOrders: PurchaseOrder[];
  receivables: AccountReceivable[];
  settings: BusinessSettings;
  onNavigate: (tab: any) => void;
  onRecordPayment: (saleId: string) => void;
  onOpenNewSale: () => void;
  onOpenNewExpense: () => void;
  onOpenNewPurchase: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  sales,
  expenses,
  productionCosts,
  purchaseOrders,
  receivables,
  settings,
  onNavigate,
  onOpenNewSale,
  onOpenNewExpense,
  onOpenNewPurchase,
}) => {
  const [timeFilter, setTimeFilter] = useState<DashboardTimeFilter>('month');
  const [customStart, setCustomStart] = useState(getTodayString());
  const [customEnd, setCustomEnd] = useState(getTodayString());

  // Filtered datasets based on selected time range
  const filteredSales = filterSalesByRange(sales, timeFilter, customStart, customEnd);
  const filteredExpenses = filterExpensesByRange(expenses, timeFilter, customStart, customEnd);
  const filteredProduction = filterProductionByRange(productionCosts, timeFilter, customStart, customEnd);
  void filterPurchasesByRange;

  // Calculations
  const totalSales = filteredSales.reduce((acc, s) => acc + s.total, 0);
  const totalCollected = filteredSales.reduce((acc, s) => acc + s.amountPaid, 0);
  const totalExpenses = filteredExpenses.reduce((acc, e) => acc + e.amount, 0);
  const fixedExpenses = filteredExpenses.filter(e => e.type === 'Fijo').reduce((acc, e) => acc + e.amount, 0);
  const variableAndExtraExpenses = filteredExpenses.filter(e => e.type !== 'Fijo').reduce((acc, e) => acc + e.amount, 0);
  const totalProduction = filteredProduction.reduce((acc, pc) => acc + pc.totalCost, 0);
  
  // Utilidad Bruta = Ventas Netas - Costos de Producción
  const grossProfit = totalSales - totalProduction;
  // Utilidad Neta Estimada = Utilidad Bruta - Gastos Operativos
  const estimatedNetProfit = grossProfit - totalExpenses;
  
  // Cuentas por cobrar total general
  const totalReceivables = receivables.reduce((acc, r) => acc + r.pendingAmount, 0);

  // Monthly goals & fixed expenses progress based on configured BusinessSettings
  const goalsProgress = calculateMonthlyGoalsProgress({
    sales,
    expenses,
    productionCosts,
    purchaseOrders,
    settings,
  });
  const totalConfiguredFixedMonthly = calculateTotalMonthlyFixedExpenses(
    settings.fixedExpensesConfig || []
  );

  // Top products & services sold (proportional net revenue after discount)
  const categoryRevenueMap: Record<string, number> = {};
  filteredSales.forEach(s => {
    const discountRatio = s.subtotal > 0 ? s.total / s.subtotal : 1;
    s.items.forEach(item => {
      categoryRevenueMap[item.category] =
        (categoryRevenueMap[item.category] || 0) + item.total * discountRatio;
    });
  });
  const topCategories = Object.entries(categoryRevenueMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Expense distribution by category
  const expenseCategoryMap: Record<string, number> = {};
  filteredExpenses.forEach(e => {
    expenseCategoryMap[e.category] = (expenseCategoryMap[e.category] || 0) + e.amount;
  });
  const topExpenseCategories = Object.entries(expenseCategoryMap)
    .sort((a, b) => b[1] - a[1]);

  // Daily sales map for chart
  const dailySalesMap: Record<string, number> = {};
  filteredSales.forEach(s => {
    dailySalesMap[s.date] = (dailySalesMap[s.date] || 0) + s.total;
  });
  const dailySalesArray = Object.entries(dailySalesMap)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-7);

  const isEmpty = sales.length === 0 && expenses.length === 0;

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Quick Action Bar & Filter Selector */}
      <div className="bg-white dark:bg-[#0d1322] border border-slate-200 dark:border-[#1e293b] rounded-2xl p-6 shadow-sm dark:shadow-xl flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 transition-colors">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">Panel Financiero General</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Resumen en tiempo real de operaciones, costos y rentabilidad de {settings.companyName || 'Maleja Diseños'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={onOpenNewSale}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl shadow-md transition-all flex items-center space-x-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Registrar Venta</span>
          </button>
          <button
            onClick={onOpenNewExpense}
            className="px-3.5 py-2 bg-slate-100 dark:bg-[#162032] hover:bg-slate-200 dark:hover:bg-[#1e293b] border border-slate-200 dark:border-[#1e293b] text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl transition-all flex items-center space-x-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Registrar Gasto</span>
          </button>
          <button
            onClick={onOpenNewPurchase}
            className="px-3.5 py-2 bg-slate-100 dark:bg-[#162032] hover:bg-slate-200 dark:hover:bg-[#1e293b] border border-slate-200 dark:border-[#1e293b] text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl transition-all flex items-center space-x-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Registrar Compra</span>
          </button>
        </div>
      </div>

      {/* Time Filters Bar */}
      <div className="bg-white dark:bg-[#0d1322] border border-slate-200 dark:border-[#1e293b] p-4 rounded-2xl shadow-sm dark:shadow-none flex flex-col sm:flex-row items-center justify-between gap-4 transition-colors">
        <div className="flex items-center space-x-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mr-2">Periodo:</span>
          {[
            { id: 'today', label: 'Hoy' },
            { id: 'week', label: 'Esta Semana' },
            { id: 'month', label: 'Este Mes' },
            { id: 'prev_month', label: 'Mes Anterior' },
            { id: 'year', label: 'Este Año' },
            { id: 'custom', label: 'Personalizado' },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setTimeFilter(f.id as DashboardTimeFilter)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                timeFilter === f.id
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-slate-100 dark:bg-[#111827] text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-[#1e293b] hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {timeFilter === 'custom' && (
          <div className="flex items-center space-x-2 text-xs">
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 dark:bg-[#111827] border border-slate-200 dark:border-[#1e293b] rounded-lg text-slate-900 dark:text-white"
            />
            <span className="text-slate-500">hasta</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 dark:bg-[#111827] border border-slate-200 dark:border-[#1e293b] rounded-lg text-slate-900 dark:text-white"
            />
          </div>
        )}
      </div>

      {isEmpty ? (
        <div className="bg-white dark:bg-[#0d1322] border border-slate-200 dark:border-[#1e293b] rounded-2xl p-12 text-center space-y-4 shadow-sm dark:shadow-xl">
          <div className="w-16 h-16 bg-blue-50 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center mx-auto">
            <BarChart3 className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">No hay registros financieros todavía</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            Comienza registrando tu primera venta o gasto utilizando los botones superiores para visualizar todos los indicadores y gráficos en tiempo real.
          </p>
        </div>
      ) : (
        <>
          {/* 7 Required Indicators Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Ventas del periodo */}
            <div className="bg-white dark:bg-[#0d1322] border border-slate-200 dark:border-[#1e293b] rounded-2xl p-5 shadow-sm dark:shadow-xl flex flex-col justify-between transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Ventas del Periodo</span>
                <div className="p-2 bg-blue-50 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400 rounded-xl"><ShoppingBag className="w-4 h-4" /></div>
              </div>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-4">{formatCOP(totalSales)}</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">{filteredSales.length} transacciones registradas</p>
            </div>

            {/* 2. Dinero recibido */}
            <div className="bg-white dark:bg-[#0d1322] border border-slate-200 dark:border-[#1e293b] rounded-2xl p-5 shadow-sm dark:shadow-xl flex flex-col justify-between transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Dinero Recibido</span>
                <div className="p-2 bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl"><Wallet className="w-4 h-4" /></div>
              </div>
              <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-4">{formatCOP(totalCollected)}</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Efectivo, Nequi y Transferencias</p>
            </div>

            {/* 3. Gastos del periodo */}
            <div className="bg-white dark:bg-[#0d1322] border border-slate-200 dark:border-[#1e293b] rounded-2xl p-5 shadow-sm dark:shadow-xl flex flex-col justify-between transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Gastos del Periodo</span>
                <div className="p-2 bg-rose-50 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-xl"><Receipt className="w-4 h-4" /></div>
              </div>
              <h3 className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-4">{formatCOP(totalExpenses)}</h3>
              <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                <span>Fijos: {formatCOP(fixedExpenses)}</span>
                <span>Var/Ext: {formatCOP(variableAndExtraExpenses)}</span>
              </div>
            </div>

            {/* 4. Costos de producción */}
            <div className="bg-white dark:bg-[#0d1322] border border-slate-200 dark:border-[#1e293b] rounded-2xl p-5 shadow-sm dark:shadow-xl flex flex-col justify-between transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Costos de Producción</span>
                <div className="p-2 bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-xl"><Cpu className="w-4 h-4" /></div>
              </div>
              <h3 className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-4">{formatCOP(totalProduction)}</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Materiales, tintas y mano de obra</p>
            </div>

            {/* 5. Utilidad bruta */}
            <div className="bg-white dark:bg-[#0d1322] border border-slate-200 dark:border-[#1e293b] rounded-2xl p-5 shadow-sm dark:shadow-xl flex flex-col justify-between transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Utilidad Bruta</span>
                <div className="p-2 bg-blue-50 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-xl"><TrendingUp className="w-4 h-4" /></div>
              </div>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-4">{formatCOP(grossProfit)}</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Ventas netas menos costos directos</p>
            </div>

            {/* 6. Utilidad neta estimada */}
            <div className="bg-white dark:bg-[#0d1322] border border-slate-200 dark:border-[#1e293b] rounded-2xl p-5 shadow-sm dark:shadow-xl flex flex-col justify-between transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Utilidad Neta Estimada</span>
                <div className="p-2 bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl"><DollarSign className="w-4 h-4" /></div>
              </div>
              <h3 className={`text-2xl font-black mt-4 ${estimatedNetProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {formatCOP(estimatedNetProfit)}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Utilidad bruta menos gastos operativos</p>
            </div>

            {/* 7. Cuentas por cobrar */}
            <div className="bg-white dark:bg-[#0d1322] border border-slate-200 dark:border-[#1e293b] rounded-2xl p-5 shadow-sm dark:shadow-xl flex flex-col justify-between lg:col-span-2 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Cuentas por Cobrar Pendientes</span>
                <div className="p-2 bg-amber-50 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-xl"><CreditCard className="w-4 h-4" /></div>
              </div>
              <div className="flex items-baseline justify-between mt-4">
                <h3 className="text-2xl font-black text-amber-600 dark:text-amber-400">{formatCOP(totalReceivables)}</h3>
                <button
                  onClick={() => onNavigate('receivables')}
                  className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Gestionar cobros →
                </button>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">{receivables.length} facturas con saldo pendiente de clientes</p>
            </div>
          </div>

          {/* Monthly Targets & Fixed Commitments Indicator */}
          <div className="bg-white dark:bg-[#0d1322] border border-slate-200 dark:border-[#1e293b] rounded-2xl p-6 shadow-sm dark:shadow-xl space-y-5 transition-colors">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-slate-200 dark:border-[#1e293b]">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-blue-50 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400 rounded-xl"><Target className="w-5 h-5" /></div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Seguimiento de Metas del Mes ({goalsProgress.monthPrefix})
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                    Gastos fijos programados: {formatCOP(totalConfiguredFixedMonthly)} / mes
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('settings')}
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline self-start sm:self-center"
              >
                Configurar metas →
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-xs">
              {/* Meta Ventas */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-600 dark:text-slate-300 uppercase text-[11px]">Meta Ventas</span>
                  <span className="font-black text-blue-600 dark:text-blue-400 tabular-nums">{goalsProgress.salesPct.toFixed(1)}%</span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 dark:bg-[#111827] rounded-full overflow-hidden border border-slate-200 dark:border-[#1e293b]">
                  <div
                    className="h-full bg-blue-600 rounded-full transition-all duration-500"
                    style={{ width: `${goalsProgress.salesPct}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] tabular-nums">
                  <span className="text-slate-500 dark:text-slate-400">
                    {formatCOP(goalsProgress.currentSales)} / {formatCOP(goalsProgress.salesGoal)}
                  </span>
                  {goalsProgress.salesRemaining > 0 ? (
                    <span className="font-bold text-amber-600 dark:text-amber-400">
                      Falta {formatCOP(goalsProgress.salesRemaining)}
                    </span>
                  ) : (
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      Superada (+{formatCOP(goalsProgress.salesSurplus)})
                    </span>
                  )}
                </div>
              </div>

              {/* Meta Utilidad */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-600 dark:text-slate-300 uppercase text-[11px]">Meta Utilidad Neta</span>
                  <span className="font-black text-emerald-600 dark:text-emerald-400 tabular-nums">{goalsProgress.profitPct.toFixed(1)}%</span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 dark:bg-[#111827] rounded-full overflow-hidden border border-slate-200 dark:border-[#1e293b]">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                    style={{ width: `${goalsProgress.profitPct}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] tabular-nums">
                  <span className="text-slate-500 dark:text-slate-400">
                    {formatCOP(goalsProgress.currentProfit)} / {formatCOP(goalsProgress.profitGoal)}
                  </span>
                  {goalsProgress.profitRemaining > 0 ? (
                    <span className="font-bold text-amber-600 dark:text-amber-400">
                      Falta {formatCOP(goalsProgress.profitRemaining)}
                    </span>
                  ) : (
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      Superada (+{formatCOP(goalsProgress.profitSurplus)})
                    </span>
                  )}
                </div>
              </div>

              {/* Presupuesto Compras */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-600 dark:text-slate-300 uppercase text-[11px]">Presupuesto Compras</span>
                  <span className={`font-black tabular-nums ${goalsProgress.purchasesExceededBy > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-indigo-600 dark:text-indigo-400'}`}>
                    {goalsProgress.purchasesPct.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 dark:bg-[#111827] rounded-full overflow-hidden border border-slate-200 dark:border-[#1e293b]">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${goalsProgress.purchasesExceededBy > 0 ? 'bg-rose-500' : 'bg-indigo-500'}`}
                    style={{ width: `${goalsProgress.purchasesPct}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] tabular-nums">
                  <span className="text-slate-500 dark:text-slate-400">
                    {formatCOP(goalsProgress.currentPurchases)} / {formatCOP(goalsProgress.purchasesBudget)}
                  </span>
                  {goalsProgress.purchasesExceededBy > 0 ? (
                    <span className="font-bold text-rose-600 dark:text-rose-400">
                      Excedido {formatCOP(goalsProgress.purchasesExceededBy)}
                    </span>
                  ) : (
                    <span className="font-bold text-slate-700 dark:text-slate-300">
                      Disp. {formatCOP(goalsProgress.purchasesRemaining)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Ventas por día chart */}
            <div className="bg-white dark:bg-[#0d1322] border border-slate-200 dark:border-[#1e293b] rounded-2xl p-6 shadow-sm dark:shadow-xl space-y-4 transition-colors">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <BarChart3 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>Ventas por Día (Recientes)</span>
              </h3>
              <div className="space-y-3 pt-2">
                {dailySalesArray.map(([date, amount]) => {
                  const maxDay = Math.max(...dailySalesArray.map(d => d[1]), 1);
                  const widthPct = Math.round((amount / maxDay) * 100);
                  return (
                    <div key={date} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">{date}</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatCOP(amount)}</span>
                      </div>
                      <div className="w-full h-2.5 bg-slate-100 dark:bg-[#111827] rounded-full overflow-hidden">
                        <div className="h-full bg-blue-600 dark:bg-blue-500 rounded-full" style={{ width: `${widthPct}%` }}></div>
                      </div>
                    </div>
                  );
                })}
                {dailySalesArray.length === 0 && (
                  <p className="text-xs text-slate-500 text-center py-6">No hay datos de ventas en este periodo.</p>
                )}
              </div>
            </div>

            {/* Distribución de Gastos por Categoría */}
            <div className="bg-white dark:bg-[#0d1322] border border-slate-200 dark:border-[#1e293b] rounded-2xl p-6 shadow-sm dark:shadow-xl space-y-4 transition-colors">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <PieChart className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                <span>Distribución de Gastos por Categoría</span>
              </h3>
              <div className="space-y-3 pt-2 max-h-60 overflow-y-auto">
                {topExpenseCategories.map(([cat, amount]) => {
                  const pct = totalExpenses > 0 ? ((amount / totalExpenses) * 100).toFixed(1) : '0';
                  return (
                    <div key={cat} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">{cat} ({pct}%)</span>
                        <span className="font-bold text-rose-600 dark:text-rose-400">{formatCOP(amount)}</span>
                      </div>
                      <div className="w-full h-2.5 bg-slate-100 dark:bg-[#111827] rounded-full overflow-hidden">
                        <div className="h-full bg-rose-500 rounded-full" style={{ width: `${pct}%` }}></div>
                      </div>
                    </div>
                  );
                })}
                {topExpenseCategories.length === 0 && (
                  <p className="text-xs text-slate-500 text-center py-6">No hay gastos registrados en este periodo.</p>
                )}
              </div>
            </div>
          </div>

          {/* Additional Sections */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Top Products / Services */}
            <div className="bg-white dark:bg-[#0d1322] border border-slate-200 dark:border-[#1e293b] rounded-2xl p-6 shadow-sm dark:shadow-xl space-y-4 transition-colors">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Servicios Más Vendidos</h3>
              <div className="space-y-3">
                {topCategories.map(([cat, rev]) => (
                  <div key={cat} className="p-3 bg-slate-50 dark:bg-[#111827] border border-slate-200 dark:border-[#1e293b] rounded-xl flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate pr-2">{cat}</span>
                    <span className="text-xs font-black text-blue-600 dark:text-blue-400">{formatCOP(rev)}</span>
                  </div>
                ))}
                {topCategories.length === 0 && (
                  <p className="text-xs text-slate-500 text-center py-4">Sin datos de servicios.</p>
                )}
              </div>
            </div>

            {/* Recent Sales */}
            <div className="bg-white dark:bg-[#0d1322] border border-slate-200 dark:border-[#1e293b] rounded-2xl p-6 shadow-sm dark:shadow-xl space-y-4 transition-colors">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Últimas Ventas</h3>
                <button onClick={() => onNavigate('sales')} className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium">Ver todas</button>
              </div>
              <div className="space-y-3">
                {filteredSales.slice(0, 4).map(s => (
                  <div key={s.id} className="p-3 bg-slate-50 dark:bg-[#111827] border border-slate-200 dark:border-[#1e293b] rounded-xl flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-white">{s.clientName}</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">{s.date}</p>
                    </div>
                    <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">{formatCOP(s.total)}</span>
                  </div>
                ))}
                {filteredSales.length === 0 && (
                  <p className="text-xs text-slate-500 text-center py-4">Sin ventas recientes.</p>
                )}
              </div>
            </div>

            {/* Recent Expenses */}
            <div className="bg-white dark:bg-[#0d1322] border border-slate-200 dark:border-[#1e293b] rounded-2xl p-6 shadow-sm dark:shadow-xl space-y-4 transition-colors">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Últimos Gastos</h3>
                <button onClick={() => onNavigate('expenses')} className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium">Ver todos</button>
              </div>
              <div className="space-y-3">
                {filteredExpenses.slice(0, 4).map(e => (
                  <div key={e.id} className="p-3 bg-slate-50 dark:bg-[#111827] border border-slate-200 dark:border-[#1e293b] rounded-xl flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-white">{e.category}</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[140px]">{e.description}</p>
                    </div>
                    <span className="text-xs font-black text-rose-600 dark:text-rose-400">{formatCOP(e.amount)}</span>
                  </div>
                ))}
                {filteredExpenses.length === 0 && (
                  <p className="text-xs text-slate-500 text-center py-4">Sin gastos recientes.</p>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
