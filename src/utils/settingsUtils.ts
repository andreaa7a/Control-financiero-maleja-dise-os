import {
  BusinessSettings,
  Expense,
  ExpenseCategoriesConfig,
  FixedExpenseConfig,
  FixedExpenseFrequency,
  ProductionCost,
  PurchaseOrder,
  Sale,
} from '../types/finance';
import { isValidCalendarDate } from './validation';

export const DEFAULT_SALE_CATEGORIES: string[] = [
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

export const DEFAULT_EXPENSE_CATEGORIES: ExpenseCategoriesConfig = {
  Fijo: [
    'Arriendo',
    'Energía',
    'Agua',
    'Internet',
    'Nómina',
    'Seguridad social',
    'Suscripciones',
    'Otros gastos recurrentes',
  ],
  Variable: [
    'Compra de vinilos',
    'Tintas',
    'Papel',
    'Materiales de impresión',
    'Laminados',
    'Insumos DTF',
    'Empaques',
    'Transporte',
    'Mantenimiento de maquinaria',
    'Publicidad',
    'Comisiones',
    'Otros',
  ],
  Extraordinario: [
    'Reparaciones',
    'Compra de equipos',
    'Adecuaciones del local',
    'Otros imprevistos',
  ],
};

export const DEFAULT_PAYMENT_METHODS: string[] = [
  'Efectivo',
  'Transferencia Bancaria',
  'Nequi / DaviPlata',
  'Tarjeta',
  'Crédito',
];

export const DEFAULT_FIXED_EXPENSES_CONFIG: FixedExpenseConfig[] = [
  {
    id: 'FE-001',
    name: 'Arriendo local comercial y taller',
    category: 'Arriendo',
    amount: 1800000,
    frequency: 'Mensual',
    dueDate: '2026-12-01',
    paymentMethod: 'Transferencia Bancaria',
    active: true,
    notes: 'Pago dentro de los primeros 5 días del mes',
  },
  {
    id: 'FE-002',
    name: 'Energía eléctrica, agua e internet fibra',
    category: 'Energía',
    amount: 450000,
    frequency: 'Mensual',
    dueDate: '2026-12-05',
    paymentMethod: 'Transferencia Bancaria',
    active: true,
    notes: 'Servicios públicos del taller',
  },
];

export const FIXED_EXPENSE_FREQUENCIES: FixedExpenseFrequency[] = [
  'Semanal',
  'Quincenal',
  'Mensual',
  'Bimestral',
  'Trimestral',
  'Semestral',
  'Anual',
];

export function isValidLogoUrl(url?: string): boolean {
  if (!url || !url.trim()) return true;
  const trimmed = url.trim();
  if (trimmed.length > 160000) return false;
  if (/^https:\/\/[^\s]+$/i.test(trimmed)) return true;
  if (/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/i.test(trimmed)) return true;
  return false;
}

export function normalizeBusinessSettings(
  raw?: Partial<BusinessSettings> | null
): BusinessSettings {
  const safeNum = (v: unknown, fallback: number) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  };

  const cleanList = (arr: unknown, fallback: string[]): string[] => {
    if (!Array.isArray(arr)) return [...fallback];
    const filtered = arr
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter((item) => item.length > 0 && item.length <= 80);
    return filtered.length > 0 ? Array.from(new Set(filtered)) : [...fallback];
  };

  const rawExpCats = raw?.expenseCategories;
  const expenseCategories: ExpenseCategoriesConfig = {
    Fijo: cleanList(rawExpCats?.Fijo, DEFAULT_EXPENSE_CATEGORIES.Fijo),
    Variable: cleanList(rawExpCats?.Variable, DEFAULT_EXPENSE_CATEGORIES.Variable),
    Extraordinario: cleanList(
      rawExpCats?.Extraordinario,
      DEFAULT_EXPENSE_CATEGORIES.Extraordinario
    ),
  };

  const fixedExpensesConfig: FixedExpenseConfig[] = Array.isArray(raw?.fixedExpensesConfig)
    ? raw!.fixedExpensesConfig
        .filter((f) => f && typeof f === 'object' && f.id && f.name)
        .map((f) => ({
          id: String(f.id).slice(0, 50),
          name: String(f.name).trim().slice(0, 150),
          category: String(f.category || 'Otros gastos recurrentes').trim().slice(0, 100),
          amount: Math.max(0, Number(f.amount) || 0),
          frequency: FIXED_EXPENSE_FREQUENCIES.includes(f.frequency) ? f.frequency : 'Mensual',
          dueDate: isValidCalendarDate(String(f.dueDate || ''))
            ? String(f.dueDate)
            : '2026-12-01',
          paymentMethod: String(f.paymentMethod || 'Transferencia Bancaria').slice(0, 50),
          active: f.active !== false,
          notes: f.notes ? String(f.notes).trim().slice(0, 300) : undefined,
        }))
    : DEFAULT_FIXED_EXPENSES_CONFIG.map((f) => ({ ...f }));

  const logoCandidate = typeof raw?.logoUrl === 'string' ? raw.logoUrl.trim() : '';

  return {
    companyName:
      typeof raw?.companyName === 'string' && raw.companyName.trim()
        ? raw.companyName.trim().slice(0, 120)
        : 'MALEJA DISEÑOS',
    nit:
      typeof raw?.nit === 'string' && raw.nit.trim()
        ? raw.nit.trim().slice(0, 50)
        : '900.123.456-7',
    address:
      typeof raw?.address === 'string'
        ? raw.address.trim().slice(0, 200)
        : 'Calle 45 # 23-14, Local 201, Medellín',
    phone:
      typeof raw?.phone === 'string'
        ? raw.phone.trim().slice(0, 50)
        : '+57 310 456 7890',
    email:
      typeof raw?.email === 'string'
        ? raw.email.trim().slice(0, 100)
        : 'contacto@malejadesignos.com',
    logoUrl: isValidLogoUrl(logoCandidate) ? logoCandidate : '',
    defaultTaxRate: safeNum(raw?.defaultTaxRate, 0),
    currencyCode: 'COP',
    currencySymbol:
      typeof raw?.currencySymbol === 'string' && raw.currencySymbol.trim()
        ? raw.currencySymbol.trim().slice(0, 10)
        : '$',
    monthlySalesGoal: safeNum(raw?.monthlySalesGoal, 5000000),
    monthlyProfitGoal: safeNum(raw?.monthlyProfitGoal, 2000000),
    monthlyPurchasesBudget: safeNum(raw?.monthlyPurchasesBudget, 2000000),
    saleCategories: cleanList(raw?.saleCategories, DEFAULT_SALE_CATEGORIES),
    expenseCategories,
    paymentMethods: cleanList(raw?.paymentMethods, DEFAULT_PAYMENT_METHODS),
    fixedExpensesConfig,
  };
}

export function calculateMonthlyEquivalent(
  amount: number,
  frequency: FixedExpenseFrequency
): number {
  const safeAmount = Math.max(0, Number(amount) || 0);
  switch (frequency) {
    case 'Semanal':
      return Math.round(safeAmount * 4.33);
    case 'Quincenal':
      return Math.round(safeAmount * 2);
    case 'Mensual':
      return Math.round(safeAmount);
    case 'Bimestral':
      return Math.round(safeAmount / 2);
    case 'Trimestral':
      return Math.round(safeAmount / 3);
    case 'Semestral':
      return Math.round(safeAmount / 6);
    case 'Anual':
      return Math.round(safeAmount / 12);
    default:
      return Math.round(safeAmount);
  }
}

export function calculateTotalMonthlyFixedExpenses(configs: FixedExpenseConfig[]): number {
  return configs
    .filter((c) => c.active)
    .reduce((acc, c) => acc + calculateMonthlyEquivalent(c.amount, c.frequency), 0);
}

export function calculateMonthlyGoalsProgress(params: {
  sales: Sale[];
  expenses: Expense[];
  productionCosts: ProductionCost[];
  purchaseOrders: PurchaseOrder[];
  settings: BusinessSettings;
  referenceDate?: Date;
}) {
  const ref = params.referenceDate || new Date();
  const monthPrefix = `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, '0')}`;

  const monthSales = params.sales.filter((s) => s.date.startsWith(monthPrefix));
  const monthExpenses = params.expenses.filter((e) => e.date.startsWith(monthPrefix));
  const monthProd = params.productionCosts.filter((p) => p.date.startsWith(monthPrefix));
  const monthPurchases = params.purchaseOrders.filter((p) => p.date.startsWith(monthPrefix));

  const currentSales = monthSales.reduce((acc, s) => acc + s.total, 0);
  const currentExpenses = monthExpenses.reduce((acc, e) => acc + e.amount, 0);
  const currentProduction = monthProd.reduce((acc, p) => acc + p.totalCost, 0);
  const currentProfit = currentSales - currentProduction - currentExpenses;
  const currentPurchases = monthPurchases.reduce((acc, p) => acc + p.amount, 0);

  const salesGoal = Math.max(0, params.settings.monthlySalesGoal || 0);
  const profitGoal = Math.max(0, params.settings.monthlyProfitGoal || 0);
  const purchasesBudget = Math.max(0, params.settings.monthlyPurchasesBudget || 0);

  const salesRemaining = Math.max(0, salesGoal - currentSales);
  const salesSurplus = Math.max(0, currentSales - salesGoal);
  const salesPct = salesGoal > 0 ? Math.min(100, (currentSales / salesGoal) * 100) : 0;

  const profitRemaining = Math.max(0, profitGoal - currentProfit);
  const profitSurplus = Math.max(0, currentProfit - profitGoal);
  const profitPct =
    profitGoal > 0 ? Math.min(100, Math.max(0, (currentProfit / profitGoal) * 100)) : 0;

  const purchasesRemaining = Math.max(0, purchasesBudget - currentPurchases);
  const purchasesExceededBy = Math.max(0, currentPurchases - purchasesBudget);
  const purchasesPct =
    purchasesBudget > 0 ? Math.min(100, (currentPurchases / purchasesBudget) * 100) : 0;

  return {
    monthPrefix,
    currentSales,
    salesGoal,
    salesRemaining,
    salesSurplus,
    salesPct,
    currentProfit,
    profitGoal,
    profitRemaining,
    profitSurplus,
    profitPct,
    currentPurchases,
    purchasesBudget,
    purchasesRemaining,
    purchasesExceededBy,
    purchasesPct,
  };
}

export function validateFixedExpenseConfigInput(input: {
  name: string;
  category: string;
  amount: number;
  dueDate: string;
  paymentMethod: string;
}): { valid: boolean; error?: string } {
  if (!input.name || !input.name.trim()) {
    return { valid: false, error: 'Ingrese el nombre o concepto del gasto fijo.' };
  }
  if (input.name.trim().length > 150) {
    return { valid: false, error: 'El nombre del gasto fijo no puede superar 150 caracteres.' };
  }
  if (!input.category || !input.category.trim()) {
    return { valid: false, error: 'Seleccione una categoría para el gasto fijo.' };
  }
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return { valid: false, error: 'El valor del gasto fijo debe ser mayor a cero.' };
  }
  if (!isValidCalendarDate(input.dueDate)) {
    return { valid: false, error: 'La fecha de vencimiento debe tener formato YYYY-MM-DD válido.' };
  }
  if (!input.paymentMethod || !input.paymentMethod.trim()) {
    return { valid: false, error: 'Seleccione el medio de pago habitual.' };
  }
  return { valid: true };
}

export async function resizeAndValidateLogoFile(
  file: File
): Promise<{ valid: boolean; dataUrl?: string; error?: string }> {
  const allowedTypes = ['image/png', 'image/jpeg', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: 'Formato no permitido. Use únicamente imágenes PNG, JPG o WEBP.',
    };
  }
  if (file.size > 5 * 1024 * 1024) {
    return {
      valid: false,
      error: 'La imagen supera el tamaño máximo permitido de 5 MB.',
    };
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 220;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const ratio = Math.min(maxDim / width, maxDim / height);
          width = Math.max(1, Math.round(width * ratio));
          height = Math.max(1, Math.round(height * ratio));
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve({ valid: false, error: 'No se pudo procesar la imagen del logo.' });
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);

        let dataUrl = canvas.toDataURL('image/webp', 0.85);
        if (!dataUrl.startsWith('data:image/webp') || dataUrl.length > 140000) {
          dataUrl = canvas.toDataURL('image/png');
        }
        if (dataUrl.length > 150000) {
          dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        }
        if (dataUrl.length > 155000) {
          resolve({
            valid: false,
            error: 'El logo sigue siendo demasiado pesado tras la compresión. Intente con una imagen más simple.',
          });
          return;
        }
        resolve({ valid: true, dataUrl });
      };
      img.onerror = () => resolve({ valid: false, error: 'El archivo seleccionado no es una imagen válida.' });
      img.src = String(reader.result || '');
    };
    reader.onerror = () => resolve({ valid: false, error: 'No se pudo leer el archivo del logo.' });
    reader.readAsDataURL(file);
  });
}
