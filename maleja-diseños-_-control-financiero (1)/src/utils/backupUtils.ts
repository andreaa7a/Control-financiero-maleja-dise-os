import {
  Sale,
  Expense,
  ProductionCost,
  Supplier,
  PurchaseOrder,
  MaterialTemplate,
  BusinessSettings,
  AuditLog,
} from '../types/finance';
import { normalizeBusinessSettings } from './settingsUtils';

export type RestoreMode = 'merge_missing' | 'upsert' | 'replace';

export interface RestoreModuleSelection {
  sales: boolean;
  expenses: boolean;
  productionCosts: boolean;
  suppliers: boolean;
  purchaseOrders: boolean;
  materialTemplates: boolean;
  settings: boolean;
  auditLogs: boolean;
}

export interface BackupMetadata {
  appName: string;
  schemaVersion: string;
  exportDate: string;
  companyName: string;
  createdBy: string;
  counts: {
    sales: number;
    expenses: number;
    productionCosts: number;
    suppliers: number;
    purchaseOrders: number;
    materialTemplates: number;
    auditLogs: number;
  };
}

export interface BackupPayload {
  metadata?: BackupMetadata;
  sales: Sale[];
  expenses: Expense[];
  productionCosts: ProductionCost[];
  suppliers: Supplier[];
  purchaseOrders: PurchaseOrder[];
  materialTemplates?: MaterialTemplate[];
  settings?: BusinessSettings;
  auditLogs?: AuditLog[];
  exportDate?: string;
}

export interface BackupValidationResult {
  valid: boolean;
  error?: string;
  warnings: string[];
  payload?: BackupPayload;
}

export function createBackupPayload(params: {
  sales: Sale[];
  expenses: Expense[];
  productionCosts: ProductionCost[];
  suppliers: Supplier[];
  purchaseOrders: PurchaseOrder[];
  materialTemplates: MaterialTemplate[];
  settings: BusinessSettings;
  auditLogs: AuditLog[];
  userEmail?: string | null;
}): BackupPayload {
  const nowIso = new Date().toISOString();
  return {
    metadata: {
      appName: 'Maleja Diseños | Control Financiero',
      schemaVersion: '2.0',
      exportDate: nowIso,
      companyName: params.settings.companyName || 'Maleja Diseños',
      createdBy: params.userEmail || 'usuario',
      counts: {
        sales: params.sales.length,
        expenses: params.expenses.length,
        productionCosts: params.productionCosts.length,
        suppliers: params.suppliers.length,
        purchaseOrders: params.purchaseOrders.length,
        materialTemplates: params.materialTemplates.length,
        auditLogs: params.auditLogs.length,
      },
    },
    sales: params.sales,
    expenses: params.expenses,
    productionCosts: params.productionCosts,
    suppliers: params.suppliers,
    purchaseOrders: params.purchaseOrders,
    materialTemplates: params.materialTemplates,
    settings: params.settings,
    auditLogs: params.auditLogs,
    exportDate: nowIso,
  };
}

export function downloadBackupJson(payload: BackupPayload, prefix = 'respaldo_maleja_disenos') {
  const jsonString = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  anchor.href = url;
  anchor.download = `${prefix}_${stamp}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function clampString(val: unknown, maxLen: number, fallback = ''): string {
  const s = typeof val === 'string' ? val.trim() : val != null ? String(val) : fallback;
  return s.slice(0, maxLen);
}

function safeNumber(val: unknown, fallback = 0): number {
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

export function parseAndValidateBackup(rawText: string): BackupValidationResult {
  const warnings: string[] = [];
  let parsed: any;

  try {
    parsed = JSON.parse(rawText);
  } catch {
    return {
      valid: false,
      error: 'El archivo seleccionado no tiene un formato JSON válido.',
      warnings,
    };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {
      valid: false,
      error: 'La estructura raíz del archivo de respaldo no es válida.',
      warnings,
    };
  }

  const hasKnownArrays =
    Array.isArray(parsed.sales) ||
    Array.isArray(parsed.expenses) ||
    Array.isArray(parsed.productionCosts) ||
    Array.isArray(parsed.suppliers) ||
    Array.isArray(parsed.purchaseOrders);

  if (!hasKnownArrays) {
    return {
      valid: false,
      error: 'El archivo no contiene colecciones financieras reconocidas de Maleja Diseños.',
      warnings,
    };
  }

  // Validate and sanitize each collection respecting firebase-blueprint.json bounds
  const sales: Sale[] = [];
  if (Array.isArray(parsed.sales)) {
    parsed.sales.forEach((s: any, idx: number) => {
      if (!s || typeof s !== 'object' || !s.id || !s.clientName) {
        warnings.push(`Venta omitida en posición ${idx + 1} por datos incompletos.`);
        return;
      }
      sales.push({
        id: clampString(s.id, 50),
        date: clampString(s.date || new Date().toISOString().split('T')[0], 20),
        clientName: clampString(s.clientName, 150),
        clientPhone: s.clientPhone ? clampString(s.clientPhone, 50) : undefined,
        clientEmail: s.clientEmail ? clampString(s.clientEmail, 100) : undefined,
        items: Array.isArray(s.items) ? s.items : [],
        subtotal: safeNumber(s.subtotal, safeNumber(s.total, 0)),
        discount: safeNumber(s.discount, 0),
        total: safeNumber(s.total, 0),
        amountPaid: Math.min(safeNumber(s.amountPaid, 0), safeNumber(s.total, 0)),
        paymentStatus: s.paymentStatus === 'Pagado' || s.paymentStatus === 'Parcial' || s.paymentStatus === 'Pendiente'
          ? s.paymentStatus
          : 'Pendiente',
        paymentMethod: s.paymentMethod || 'Efectivo',
        lastPaymentDate: s.lastPaymentDate ? clampString(s.lastPaymentDate, 20) : undefined,
        notes: s.notes ? clampString(s.notes, 500) : undefined,
      });
    });
  }

  const expenses: Expense[] = [];
  if (Array.isArray(parsed.expenses)) {
    parsed.expenses.forEach((e: any, idx: number) => {
      if (!e || typeof e !== 'object' || !e.id || !e.description) {
        warnings.push(`Gasto omitido en posición ${idx + 1} por datos incompletos.`);
        return;
      }
      expenses.push({
        id: clampString(e.id, 50),
        date: clampString(e.date || new Date().toISOString().split('T')[0], 20),
        category: clampString(e.category || 'Otros', 100),
        type: e.type === 'Fijo' || e.type === 'Variable' || e.type === 'Extraordinario' ? e.type : 'Variable',
        description: clampString(e.description, 200),
        amount: safeNumber(e.amount, 0),
        paymentMethod: e.paymentMethod || 'Efectivo',
        supplier: e.supplier ? clampString(e.supplier, 100) : undefined,
        receiptNumber: e.receiptNumber ? clampString(e.receiptNumber, 50) : undefined,
        status: e.status === 'Pendiente' ? 'Pendiente' : 'Pagado',
        isRecurring: Boolean(e.isRecurring),
        notes: e.notes ? clampString(e.notes, 300) : undefined,
      });
    });
  }

  const productionCosts: ProductionCost[] = [];
  if (Array.isArray(parsed.productionCosts)) {
    parsed.productionCosts.forEach((pc: any, idx: number) => {
      if (!pc || typeof pc !== 'object' || !pc.id) {
        warnings.push(`Costo de producción omitido en posición ${idx + 1}.`);
        return;
      }
      const qty = Math.max(1, safeNumber(pc.quantityProduced, 1));
      const matTotal = safeNumber(pc.materialTotalCost ?? pc.materialCost, 0);
      const labor = safeNumber(pc.laborCost, 0);
      const other = safeNumber(pc.otherCosts ?? pc.machineCost, 0);
      const totalCost = safeNumber(pc.totalCost, matTotal + labor + other);
      const unitCost = safeNumber(pc.unitCost, totalCost / qty);
      const salePrice = safeNumber(pc.salePrice, 0);
      const grossProfit = safeNumber(pc.grossProfit, salePrice - totalCost);
      const profitMargin = safeNumber(pc.profitMargin, salePrice > 0 ? (grossProfit / salePrice) * 100 : 0);

      productionCosts.push({
        id: clampString(pc.id, 50),
        date: clampString(pc.date || new Date().toISOString().split('T')[0], 20),
        orderReference: clampString(pc.orderReference || 'OTRO', 50),
        clientName: clampString(pc.clientName || 'Cliente General', 150),
        productName: clampString(pc.productName || pc.description || 'Producto Gráfico', 100),
        quantityProduced: qty,
        materialName: clampString(pc.materialName || 'Materiales Varios', 100),
        materialQuantity: safeNumber(pc.materialQuantity, 1),
        materialUnitPrice: safeNumber(pc.materialUnitPrice, matTotal),
        materialTotalCost: matTotal,
        laborCost: labor,
        productionTime: clampString(pc.productionTime || '1 hora', 50),
        otherCosts: other,
        totalCost,
        unitCost,
        salePrice,
        grossProfit,
        profitMargin,
        description: clampString(pc.description || 'Costo de producción', 300),
      });
    });
  }

  const suppliers: Supplier[] = [];
  if (Array.isArray(parsed.suppliers)) {
    parsed.suppliers.forEach((sup: any, idx: number) => {
      if (!sup || typeof sup !== 'object' || !sup.id || !sup.name) {
        warnings.push(`Proveedor omitido en posición ${idx + 1}.`);
        return;
      }
      suppliers.push({
        id: clampString(sup.id, 50),
        name: clampString(sup.name, 150),
        category: clampString(sup.category || 'Insumos', 100),
        contactPerson: clampString(sup.contactPerson || '', 100),
        phone: clampString(sup.phone || '', 50),
        email: clampString(sup.email || '', 100),
        address: sup.address ? clampString(sup.address, 200) : undefined,
        notes: sup.notes ? clampString(sup.notes, 300) : undefined,
      });
    });
  }

  const purchaseOrders: PurchaseOrder[] = [];
  if (Array.isArray(parsed.purchaseOrders)) {
    parsed.purchaseOrders.forEach((po: any, idx: number) => {
      if (!po || typeof po !== 'object' || !po.id || !po.supplierName) {
        warnings.push(`Orden de compra omitida en posición ${idx + 1}.`);
        return;
      }
      purchaseOrders.push({
        id: clampString(po.id, 50),
        date: clampString(po.date || new Date().toISOString().split('T')[0], 20),
        supplierId: clampString(po.supplierId || '', 50),
        supplierName: clampString(po.supplierName, 150),
        itemsDescription: clampString(po.itemsDescription || 'Insumos gráficos', 300),
        amount: safeNumber(po.amount, 0),
        status: po.status === 'Pendiente' ? 'Pendiente' : 'Pagado',
        paymentMethod: po.paymentMethod || 'Transferencia Bancaria',
        notes: po.notes ? clampString(po.notes, 300) : undefined,
      });
    });
  }

  const materialTemplates: MaterialTemplate[] | undefined = Array.isArray(parsed.materialTemplates)
    ? parsed.materialTemplates.filter((m: any) => m && m.id && m.name)
    : undefined;

  const auditLogs: AuditLog[] | undefined = Array.isArray(parsed.auditLogs)
    ? parsed.auditLogs
        .filter((a: any) => a && a.id && a.timestamp && a.action && a.module && a.description)
        .map((a: any) => ({
          id: clampString(a.id, 50),
          timestamp: clampString(a.timestamp, 50),
          action: a.action,
          module: a.module,
          description: clampString(a.description, 300),
        }))
    : undefined;

  const settings: BusinessSettings | undefined =
    parsed.settings && typeof parsed.settings === 'object' && parsed.settings.companyName
      ? normalizeBusinessSettings(parsed.settings)
      : undefined;

  return {
    valid: true,
    warnings,
    payload: {
      metadata: parsed.metadata,
      sales,
      expenses,
      productionCosts,
      suppliers,
      purchaseOrders,
      materialTemplates,
      settings,
      auditLogs,
      exportDate: parsed.exportDate || parsed.metadata?.exportDate,
    },
  };
}

export function mergeCollectionByMode<T extends { id: string }>(
  current: T[],
  incoming: T[],
  mode: RestoreMode
): { result: T[]; added: number; updated: number; unchanged: number } {
  if (mode === 'replace') {
    return {
      result: [...incoming],
      added: incoming.length,
      updated: 0,
      unchanged: 0,
    };
  }

  const map = new Map<string, T>();
  current.forEach((item) => map.set(item.id, item));

  let added = 0;
  let updated = 0;

  incoming.forEach((item) => {
    if (!map.has(item.id)) {
      map.set(item.id, item);
      added += 1;
    } else if (mode === 'upsert') {
      map.set(item.id, item);
      updated += 1;
    }
  });

  const unchanged = Math.max(0, current.length - updated);
  return {
    result: Array.from(map.values()),
    added,
    updated,
    unchanged,
  };
}
