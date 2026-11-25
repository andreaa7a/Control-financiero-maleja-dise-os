import {
  Sale,
  Expense,
  ProductionCost,
  PurchaseOrder,
  ServiceCategory,
} from '../types/finance';
import { FinancialReportPayload } from './exportUtils';
import { isValidCalendarDate } from './validation';

const SERVICE_CATEGORIES: ServiceCategory[] = [
  'Diseño gráfico',
  'Tarjetas de presentación',
  'Volantes',
  'Pendones',
  'Calcomanías',
  'Impresión digital',
  'DTF y estampados',
  'Personalización de motocicletas',
  'Avisos publicitarios',
  'Serigrafía',
  'Otros servicios',
];

function matchProductNameToCategory(
  productName: string,
  configuredCategories: string[] = SERVICE_CATEGORIES
): ServiceCategory | null {
  const lower = productName.toLowerCase();
  const direct = configuredCategories.find((cat) => lower.includes(cat.toLowerCase()));
  if (direct) return direct;

  if (lower.includes('vinilo') || lower.includes('impresión')) return 'Impresión digital';
  if (lower.includes('dtf') || lower.includes('estampado') || lower.includes('camiseta')) return 'DTF y estampados';
  if (lower.includes('tarjeta')) return 'Tarjetas de presentación';
  if (lower.includes('volante')) return 'Volantes';
  if (lower.includes('pendón') || lower.includes('pendon')) return 'Pendones';
  if (lower.includes('calcoman')) return 'Calcomanías';
  if (lower.includes('moto')) return 'Personalización de motocicletas';
  if (lower.includes('aviso') || lower.includes('letrero')) return 'Avisos publicitarios';
  if (lower.includes('diseño')) return 'Diseño gráfico';
  if (lower.includes('serigraf')) return 'Serigrafía';
  return null;
}

export function buildFinancialReportData(params: {
  sales: Sale[];
  expenses: Expense[];
  productionCosts: ProductionCost[];
  purchaseOrders: PurchaseOrder[];
  dateFrom?: string;
  dateTo?: string;
  saleCategories?: string[];
}): {
  filteredSales: Sale[];
  filteredExpenses: Expense[];
  filteredProduction: ProductionCost[];
  filteredPurchases: PurchaseOrder[];
  totalPaidExpenses: number;
  pendingExpensesTotal: number;
  payload: FinancialReportPayload;
} {
  const validFrom = params.dateFrom && isValidCalendarDate(params.dateFrom) ? params.dateFrom : '';
  const validTo = params.dateTo && isValidCalendarDate(params.dateTo) ? params.dateTo : '';

  const inRange = (d: string) => (!validFrom || d >= validFrom) && (!validTo || d <= validTo);

  const filteredSales = params.sales.filter((s) => inRange(s.date));
  const filteredExpenses = params.expenses.filter((e) => inRange(e.date));
  const filteredProduction = params.productionCosts.filter((pc) => inRange(pc.date));
  const filteredPurchases = params.purchaseOrders.filter((po) => inRange(po.date));

  const totalSalesBilled = filteredSales.reduce((acc, s) => acc + s.total, 0);
  const totalCollected = filteredSales.reduce((acc, s) => acc + s.amountPaid, 0);
  const totalFixedExpenses = filteredExpenses
    .filter((e) => e.type === 'Fijo')
    .reduce((acc, e) => acc + e.amount, 0);
  const totalVarExpenses = filteredExpenses
    .filter((e) => e.type === 'Variable' || e.type === 'Extraordinario')
    .reduce((acc, e) => acc + e.amount, 0);
  const totalExpenses = totalFixedExpenses + totalVarExpenses;
  const totalPaidExpenses = filteredExpenses
    .filter((e) => e.status === 'Pagado')
    .reduce((acc, e) => acc + e.amount, 0);
  const pendingExpensesTotal = filteredExpenses
    .filter((e) => e.status === 'Pendiente')
    .reduce((acc, e) => acc + e.amount, 0);

  const totalProduction = filteredProduction.reduce((acc, pc) => acc + pc.totalCost, 0);
  const totalPurchases = filteredPurchases.reduce((acc, po) => acc + po.amount, 0);

  const grossProfit = totalSalesBilled - totalProduction;
  const grossMargin = totalSalesBilled > 0 ? (grossProfit / totalSalesBilled) * 100 : 0;
  const netEstimatedProfit = grossProfit - totalExpenses;
  // Flujo de Caja Neto Real: solo descuenta gastos efectivamente pagados (no pendientes por pagar)
  const netRealProfit = totalCollected - totalPaidExpenses - totalProduction;

  // 1. Daily Sales
  const dailySalesMap = filteredSales.reduce((acc, s) => {
    if (!acc[s.date]) acc[s.date] = { date: s.date, count: 0, billed: 0, collected: 0 };
    acc[s.date].count += 1;
    acc[s.date].billed += s.total;
    acc[s.date].collected += s.amountPaid;
    return acc;
  }, {} as Record<string, { date: string; count: number; billed: number; collected: number }>);
  const dailySalesList = Object.values(dailySalesMap).sort((a, b) => b.date.localeCompare(a.date));

  // 2. Monthly Sales
  const monthlySalesMap = filteredSales.reduce((acc, s) => {
    const month = s.date.substring(0, 7);
    if (!acc[month]) acc[month] = { month, count: 0, billed: 0, collected: 0 };
    acc[month].count += 1;
    acc[month].billed += s.total;
    acc[month].collected += s.amountPaid;
    return acc;
  }, {} as Record<string, { month: string; count: number; billed: number; collected: number }>);
  const monthlySalesList = Object.values(monthlySalesMap).sort((a, b) => b.month.localeCompare(a.month));

  // 3. Yearly Sales
  const yearlySalesMap = filteredSales.reduce((acc, s) => {
    const year = s.date.substring(0, 4);
    if (!acc[year]) acc[year] = { year, count: 0, billed: 0, collected: 0 };
    acc[year].count += 1;
    acc[year].billed += s.total;
    acc[year].collected += s.amountPaid;
    return acc;
  }, {} as Record<string, { year: string; count: number; billed: number; collected: number }>);
  const yearlySalesList = Object.values(yearlySalesMap).sort((a, b) => b.year.localeCompare(a.year));

  // 4 & 5. Fixed and Variable Expenses
  const fixedExpensesList = filteredExpenses.filter((e) => e.type === 'Fijo');
  const variableExpensesList = filteredExpenses.filter(
    (e) => e.type === 'Variable' || e.type === 'Extraordinario'
  );

  // 9. Receivables
  const receivablesList = filteredSales
    .map((s) => ({
      id: s.id,
      date: s.date,
      clientName: s.clientName,
      clientPhone: s.clientPhone || 'N/A',
      total: s.total,
      paid: s.amountPaid,
      pending: Math.max(0, s.total - s.amountPaid),
      status: s.paymentStatus,
    }))
    .filter((r) => r.pending > 0);

  // 11. Monthly Comparison
  const monthlyComparisonMap: Record<
    string,
    {
      month: string;
      salesCount: number;
      billed: number;
      collected: number;
      expenses: number;
      productionCost: number;
      estimatedProfit: number;
    }
  > = {};

  filteredSales.forEach((s) => {
    const m = s.date.substring(0, 7);
    if (!monthlyComparisonMap[m]) {
      monthlyComparisonMap[m] = {
        month: m,
        salesCount: 0,
        billed: 0,
        collected: 0,
        expenses: 0,
        productionCost: 0,
        estimatedProfit: 0,
      };
    }
    monthlyComparisonMap[m].salesCount += 1;
    monthlyComparisonMap[m].billed += s.total;
    monthlyComparisonMap[m].collected += s.amountPaid;
  });

  filteredExpenses.forEach((e) => {
    const m = e.date.substring(0, 7);
    if (!monthlyComparisonMap[m]) {
      monthlyComparisonMap[m] = {
        month: m,
        salesCount: 0,
        billed: 0,
        collected: 0,
        expenses: 0,
        productionCost: 0,
        estimatedProfit: 0,
      };
    }
    monthlyComparisonMap[m].expenses += e.amount;
  });

  filteredProduction.forEach((pc) => {
    const m = pc.date.substring(0, 7);
    if (!monthlyComparisonMap[m]) {
      monthlyComparisonMap[m] = {
        month: m,
        salesCount: 0,
        billed: 0,
        collected: 0,
        expenses: 0,
        productionCost: 0,
        estimatedProfit: 0,
      };
    }
    monthlyComparisonMap[m].productionCost += pc.totalCost;
  });

  const monthlyComparisonList = Object.values(monthlyComparisonMap)
    .map((row) => ({
      ...row,
      estimatedProfit: row.billed - row.productionCost - row.expenses,
    }))
    .sort((a, b) => b.month.localeCompare(a.month));

  // 12. Service Profitability based 100% on real ProductionCost records (zero fictitious estimates)
  const costByCategory: Record<string, number> = {};
  const salesById = new Map(filteredSales.map((s) => [s.id, s]));
  const baseCategories =
    params.saleCategories && params.saleCategories.length > 0
      ? params.saleCategories
      : SERVICE_CATEGORIES;
  const mergedCategories = Array.from(
    new Set([
      ...baseCategories,
      ...filteredSales.flatMap((s) => s.items.map((it) => it.category)),
    ])
  );

  filteredProduction.forEach((pc) => {
    const guessedCat = matchProductNameToCategory(pc.productName, mergedCategories);
    const linkedSale = salesById.get(pc.orderReference);

    if (linkedSale && linkedSale.items.length > 0) {
      if (guessedCat && linkedSale.items.some((it) => it.category === guessedCat)) {
        costByCategory[guessedCat] = (costByCategory[guessedCat] || 0) + pc.totalCost;
        return;
      }
      const saleItemsTotal = linkedSale.items.reduce((a, it) => a + it.total, 0);
      if (saleItemsTotal > 0) {
        linkedSale.items.forEach((it) => {
          const share = it.total / saleItemsTotal;
          costByCategory[it.category] = (costByCategory[it.category] || 0) + pc.totalCost * share;
        });
        return;
      }
    }

    const fallbackCat = guessedCat || 'Otros servicios';
    costByCategory[fallbackCat] = (costByCategory[fallbackCat] || 0) + pc.totalCost;
  });

  const serviceProfitability = mergedCategories.map((cat) => {
    let billed = 0;
    let count = 0;
    filteredSales.forEach((s) => {
      const discountRatio = s.subtotal > 0 ? s.total / s.subtotal : 1;
      s.items.forEach((item) => {
        if (item.category === cat) {
          billed += item.total * discountRatio;
          count += item.quantity;
        }
      });
    });

    const roundedBilled = Math.round(billed);
    const cost = Math.round(costByCategory[cat] || 0);
    const profit = roundedBilled - cost;
    const margin = roundedBilled > 0 ? (profit / roundedBilled) * 100 : 0;

    return { category: cat, count, billed: roundedBilled, cost, profit, margin };
  }).filter((s) => s.billed > 0 || s.count > 0 || s.cost > 0);

  return {
    filteredSales,
    filteredExpenses,
    filteredProduction,
    filteredPurchases,
    totalPaidExpenses,
    pendingExpensesTotal,
    payload: {
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
      productionCosts: filteredProduction,
      receivablesList,
      purchaseOrders: filteredPurchases,
      monthlyComparisonList,
      serviceProfitability,
    },
  };
}
