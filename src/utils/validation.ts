import {
  Sale,
  SaleItem,
  Expense,
  ProductionCost,
  Supplier,
  PurchaseOrder,
  PaymentStatus,
} from '../types/finance';
import { formatCOP } from './formatters';

export interface ValidationResult<T = void> {
  valid: boolean;
  error?: string;
  data?: T;
}

/**
 * Validates that a string is a real calendar date in YYYY-MM-DD format
 * (rejecting invalid calendar dates like 2026-02-30 or 2025-02-29).
 */
export function isValidCalendarDate(dateStr: string): boolean {
  if (!dateStr || typeof dateStr !== 'string') return false;
  const trimmed = dateStr.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return false;

  const [yStr, mStr, dStr] = trimmed.split('-');
  const year = Number(yStr);
  const month = Number(mStr);
  const day = Number(dStr);

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (year < 2000 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;

  const constructed = new Date(year, month - 1, day);
  return (
    constructed.getFullYear() === year &&
    constructed.getMonth() === month - 1 &&
    constructed.getDate() === day
  );
}

/**
 * Generates a collision-free sequential ID for a given prefix against existing IDs.
 * Examples:
 *  - generateUniqueId('VEN-2026-', existingIds) -> 'VEN-2026-004'
 *  - generateUniqueId('PC-', existingIds) -> 'PC-004'
 */
export function generateUniqueId(prefix: string, existingIds: string[], padLength = 3): string {
  const existingSet = new Set(existingIds);
  let maxNum = 0;

  for (const id of existingIds) {
    if (id.startsWith(prefix)) {
      const suffix = id.slice(prefix.length);
      if (/^\d+$/.test(suffix)) {
        const parsed = parseInt(suffix, 10);
        if (parsed > maxNum) maxNum = parsed;
      }
    }
  }

  let nextNum = maxNum + 1;
  let candidate = `${prefix}${String(nextNum).padStart(padLength, '0')}`;
  while (existingSet.has(candidate)) {
    nextNum += 1;
    candidate = `${prefix}${String(nextNum).padStart(padLength, '0')}`;
  }

  return candidate;
}

export function isValidDocumentId(id: string): boolean {
  return typeof id === 'string' && id.length > 0 && id.length <= 50 && /^[a-zA-Z0-9_-]+$/.test(id);
}

export function calculateSaleFinancials(items: SaleItem[], discount: number, amountPaid: number): {
  subtotal: number;
  total: number;
  amountPaid: number;
  paymentStatus: PaymentStatus;
} {
  const normalizedItems = items.map((item) => ({
    ...item,
    total: Number(item.quantity) * Number(item.unitPrice),
  }));
  const subtotal = normalizedItems.reduce((acc, item) => acc + item.total, 0);
  const total = Math.max(0, subtotal - discount);

  let paymentStatus: PaymentStatus = 'Pendiente';
  if (total === 0 || amountPaid >= total) {
    paymentStatus = 'Pagado';
  } else if (amountPaid > 0) {
    paymentStatus = 'Parcial';
  }

  return { subtotal, total, amountPaid, paymentStatus };
}

export function validateSaleInput(input: {
  date: string;
  clientName: string;
  items: SaleItem[];
  discount: number;
  amountPaid: number;
}): ValidationResult<{ subtotal: number; total: number; paymentStatus: PaymentStatus }> {
  if (!isValidCalendarDate(input.date)) {
    return { valid: false, error: 'La fecha de la venta no es válida (use formato YYYY-MM-DD real).' };
  }
  const clientName = (input.clientName || '').trim();
  if (!clientName) {
    return { valid: false, error: 'Por favor ingrese el nombre del cliente.' };
  }
  if (clientName.length > 150) {
    return { valid: false, error: 'El nombre del cliente no puede superar 150 caracteres.' };
  }
  if (!Array.isArray(input.items) || input.items.length === 0) {
    return { valid: false, error: 'Debe agregar al menos un producto o servicio a la venta.' };
  }
  for (let i = 0; i < input.items.length; i++) {
    const item = input.items[i];
    if (!item.description || !item.description.trim()) {
      return { valid: false, error: `El ítem #${i + 1} requiere una descripción.` };
    }
    if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
      return { valid: false, error: `La cantidad del ítem #${i + 1} debe ser mayor a cero.` };
    }
    if (!Number.isFinite(item.unitPrice) || item.unitPrice <= 0) {
      return { valid: false, error: `El precio unitario del ítem #${i + 1} debe ser mayor a cero.` };
    }
  }
  if (!Number.isFinite(input.discount) || input.discount < 0) {
    return { valid: false, error: 'El descuento no puede ser negativo.' };
  }

  const subtotal = input.items.reduce((acc, it) => acc + Number(it.quantity) * Number(it.unitPrice), 0);
  if (input.discount > subtotal) {
    return { valid: false, error: `El descuento (${formatCOP(input.discount)}) no puede superar el subtotal (${formatCOP(subtotal)}).` };
  }

  const total = subtotal - input.discount;
  if (!Number.isFinite(input.amountPaid) || input.amountPaid < 0) {
    return { valid: false, error: 'El valor recibido no puede ser negativo.' };
  }
  if (input.amountPaid > total) {
    return { valid: false, error: `El valor recibido (${formatCOP(input.amountPaid)}) no puede superar el total de la venta (${formatCOP(total)}).` };
  }

  const financials = calculateSaleFinancials(input.items, input.discount, input.amountPaid);
  return {
    valid: true,
    data: {
      subtotal: financials.subtotal,
      total: financials.total,
      paymentStatus: financials.paymentStatus,
    },
  };
}

export function validatePaymentInput(
  amount: number,
  sale: Sale | undefined
): ValidationResult<{ newAmountPaid: number; newStatus: PaymentStatus; pendingBalance: number }> {
  if (!sale) {
    return { valid: false, error: 'La venta seleccionada no existe o fue eliminada.' };
  }
  const pendingBalance = Math.max(0, sale.total - sale.amountPaid);
  if (pendingBalance <= 0) {
    return { valid: false, error: 'Esta venta ya se encuentra pagada en su totalidad.' };
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return { valid: false, error: 'El valor del abono debe ser mayor a cero.' };
  }
  if (amount > pendingBalance) {
    return {
      valid: false,
      error: `El abono (${formatCOP(amount)}) no puede superar el saldo pendiente (${formatCOP(pendingBalance)}).`,
    };
  }

  const newAmountPaid = sale.amountPaid + amount;
  const newStatus: PaymentStatus = newAmountPaid >= sale.total ? 'Pagado' : 'Parcial';
  return {
    valid: true,
    data: { newAmountPaid, newStatus, pendingBalance },
  };
}

export function validateExpenseInput(input: {
  date: string;
  category: string;
  description: string;
  amount: number;
}): ValidationResult {
  if (!isValidCalendarDate(input.date)) {
    return { valid: false, error: 'La fecha del gasto no es válida (use formato YYYY-MM-DD real).' };
  }
  if (!input.category || !input.category.trim()) {
    return { valid: false, error: 'Por favor seleccione una categoría válida.' };
  }
  if (!input.description || !input.description.trim()) {
    return { valid: false, error: 'Por favor ingrese la descripción del gasto.' };
  }
  if (input.description.trim().length > 200) {
    return { valid: false, error: 'La descripción no puede superar 200 caracteres.' };
  }
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return { valid: false, error: 'El valor del gasto debe ser mayor a cero (no se permiten valores negativos o en cero).' };
  }
  return { valid: true };
}

export function calculateProductionMetrics(input: {
  quantityProduced: number;
  materialQuantity: number;
  materialUnitPrice: number;
  laborCost: number;
  otherCosts: number;
  salePrice: number;
}) {
  const qty = Number(input.quantityProduced);
  const materialTotalCost = Number(input.materialQuantity) * Number(input.materialUnitPrice);
  const totalCost = materialTotalCost + Number(input.laborCost) + Number(input.otherCosts);
  const unitCost = qty > 0 ? totalCost / qty : 0;
  const salePrice = Number(input.salePrice);
  const grossProfit = salePrice - totalCost;
  const profitMargin = salePrice > 0 ? (grossProfit / salePrice) * 100 : 0;

  return {
    materialTotalCost,
    totalCost,
    unitCost,
    grossProfit,
    profitMargin,
  };
}

export function hasDuplicateProductionCost(
  existingCosts: ProductionCost[],
  orderReference: string,
  productName: string,
  excludeId?: string
): boolean {
  const ref = (orderReference || '').trim().toUpperCase();
  const prod = (productName || '').trim().toLowerCase();
  if (!ref || ref === 'OTRO') return false;

  return existingCosts.some(
    (pc) =>
      pc.id !== excludeId &&
      pc.orderReference.trim().toUpperCase() === ref &&
      pc.productName.trim().toLowerCase() === prod
  );
}

export function validateProductionCostInput(
  input: {
    date: string;
    orderReference: string;
    clientName: string;
    productName: string;
    quantityProduced: number;
    materialName: string;
    materialQuantity: number;
    materialUnitPrice: number;
    laborCost: number;
    otherCosts: number;
    salePrice: number;
  },
  existingCosts: ProductionCost[],
  excludeId?: string
): ValidationResult {
  if (!isValidCalendarDate(input.date)) {
    return { valid: false, error: 'La fecha del registro de producción no es válida.' };
  }
  if (!input.clientName || !input.clientName.trim()) {
    return { valid: false, error: 'Por favor ingrese el nombre del cliente u orden.' };
  }
  if (!input.productName || !input.productName.trim()) {
    return { valid: false, error: 'Por favor seleccione o ingrese el producto/servicio.' };
  }
  if (!Number.isFinite(input.quantityProduced) || input.quantityProduced <= 0) {
    return { valid: false, error: 'La cantidad producida debe ser mayor a cero.' };
  }
  if (!input.materialName || !input.materialName.trim()) {
    return { valid: false, error: 'Por favor indique el material utilizado.' };
  }
  if (!Number.isFinite(input.materialQuantity) || input.materialQuantity <= 0) {
    return { valid: false, error: 'La cantidad de material debe ser mayor a cero.' };
  }
  if (!Number.isFinite(input.materialUnitPrice) || input.materialUnitPrice < 0) {
    return { valid: false, error: 'El costo unitario del material no puede ser negativo.' };
  }
  if (!Number.isFinite(input.laborCost) || input.laborCost < 0) {
    return { valid: false, error: 'El costo de mano de obra no puede ser negativo.' };
  }
  if (!Number.isFinite(input.otherCosts) || input.otherCosts < 0) {
    return { valid: false, error: 'Otros costos directos no pueden ser negativos.' };
  }
  if (!Number.isFinite(input.salePrice) || input.salePrice < 0) {
    return { valid: false, error: 'El precio de venta no puede ser negativo.' };
  }
  if (hasDuplicateProductionCost(existingCosts, input.orderReference, input.productName, excludeId)) {
    return {
      valid: false,
      error: `Ya existe un costo de producción registrado para la orden ${input.orderReference} con el producto "${input.productName}". Edite el registro existente para evitar costos duplicados.`,
    };
  }
  return { valid: true };
}

export function validateSupplierInput(input: { name: string }): ValidationResult {
  if (!input.name || !input.name.trim()) {
    return { valid: false, error: 'Por favor ingrese el nombre del proveedor o empresa.' };
  }
  if (input.name.trim().length > 150) {
    return { valid: false, error: 'El nombre del proveedor no puede superar 150 caracteres.' };
  }
  return { valid: true };
}

export function validatePurchaseOrderInput(input: {
  date: string;
  itemsDescription: string;
  amount: number;
}): ValidationResult {
  if (!isValidCalendarDate(input.date)) {
    return { valid: false, error: 'La fecha de la orden de compra no es válida.' };
  }
  if (!input.itemsDescription || !input.itemsDescription.trim()) {
    return { valid: false, error: 'Por favor ingrese la descripción de la compra.' };
  }
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return { valid: false, error: 'El monto de la compra debe ser mayor a cero.' };
  }
  return { valid: true };
}

/**
 * Checks whether an almost-identical financial movement already exists on the same date and amount,
 * preventing accidental duplicate registrations during rapid clicks or repeated submissions.
 */
export function isDuplicateSaleSignature(
  sales: Sale[],
  candidate: { date: string; clientName: string; total: number },
  excludeId?: string
): boolean {
  const normClient = candidate.clientName.trim().toLowerCase();
  return sales.some(
    (s) =>
      s.id !== excludeId &&
      s.date === candidate.date &&
      s.clientName.trim().toLowerCase() === normClient &&
      s.total === candidate.total
  );
}

export function isDuplicateExpenseSignature(
  expenses: Expense[],
  candidate: { date: string; description: string; amount: number; type: string },
  excludeId?: string
): boolean {
  const normDesc = candidate.description.trim().toLowerCase();
  return expenses.some(
    (e) =>
      e.id !== excludeId &&
      e.date === candidate.date &&
      e.type === candidate.type &&
      e.description.trim().toLowerCase() === normDesc &&
      e.amount === candidate.amount
  );
}

export function isDuplicatePurchaseSignature(
  purchases: PurchaseOrder[],
  candidate: { date: string; supplierName: string; itemsDescription: string; amount: number },
  excludeId?: string
): boolean {
  const normSup = candidate.supplierName.trim().toLowerCase();
  const normDesc = candidate.itemsDescription.trim().toLowerCase();
  return purchases.some(
    (p) =>
      p.id !== excludeId &&
      p.date === candidate.date &&
      p.supplierName.trim().toLowerCase() === normSup &&
      p.itemsDescription.trim().toLowerCase() === normDesc &&
      p.amount === candidate.amount
  );
}

export function isDuplicateSupplierName(
  suppliers: Supplier[],
  name: string,
  excludeId?: string
): boolean {
  const norm = name.trim().toLowerCase();
  return suppliers.some((s) => s.id !== excludeId && s.name.trim().toLowerCase() === norm);
}
