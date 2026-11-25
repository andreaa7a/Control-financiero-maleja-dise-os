import { Sale, Expense, ProductionCost, PurchaseOrder } from '../types/finance';
import { getTodayString } from './formatters';
import { isValidCalendarDate } from './validation';

export type DashboardTimeFilter = 'today' | 'week' | 'month' | 'prev_month' | 'year' | 'custom';

function toLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function isDateInRange(
  dateStr: string,
  filter: DashboardTimeFilter,
  customStart?: string,
  customEnd?: string,
  referenceDate: Date = new Date()
): boolean {
  if (!isValidCalendarDate(dateStr)) return false;

  const todayStr = toLocalDateStr(referenceDate);

  if (filter === 'today') {
    return dateStr === todayStr;
  }

  if (filter === 'week') {
    const start = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate() - 7);
    const startStr = toLocalDateStr(start);
    return dateStr >= startStr && dateStr <= todayStr;
  }

  if (filter === 'month') {
    const monthPrefix = todayStr.slice(0, 7);
    return dateStr.startsWith(monthPrefix);
  }

  if (filter === 'prev_month') {
    const prevMonthDate = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - 1, 1);
    const prevPrefix = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;
    return dateStr.startsWith(prevPrefix);
  }

  if (filter === 'year') {
    return dateStr.startsWith(String(referenceDate.getFullYear()));
  }

  if (filter === 'custom') {
    if (customStart && !isValidCalendarDate(customStart)) return false;
    if (customEnd && !isValidCalendarDate(customEnd)) return false;
    if (customStart && dateStr < customStart) return false;
    if (customEnd && dateStr > customEnd) return false;
    return true;
  }

  return true;
}

export function filterSalesByRange(sales: Sale[], filter: DashboardTimeFilter, start?: string, end?: string, ref?: Date): Sale[] {
  return sales.filter(s => isDateInRange(s.date, filter, start, end, ref));
}

export function filterExpensesByRange(expenses: Expense[], filter: DashboardTimeFilter, start?: string, end?: string, ref?: Date): Expense[] {
  return expenses.filter(e => isDateInRange(e.date, filter, start, end, ref));
}

export function filterProductionByRange(costs: ProductionCost[], filter: DashboardTimeFilter, start?: string, end?: string, ref?: Date): ProductionCost[] {
  return costs.filter(pc => isDateInRange(pc.date, filter, start, end, ref));
}

export function filterPurchasesByRange(purchases: PurchaseOrder[], filter: DashboardTimeFilter, start?: string, end?: string, ref?: Date): PurchaseOrder[] {
  return purchases.filter(po => isDateInRange(po.date, filter, start, end, ref));
}

export { getTodayString };
