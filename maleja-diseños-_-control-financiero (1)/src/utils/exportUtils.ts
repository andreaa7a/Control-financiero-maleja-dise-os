import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Sale,
  Expense,
  PurchaseOrder,
  AccountReceivable,
  ProductionCost,
  BusinessSettings,
} from '../types/finance';
import { formatCOP, formatDate, getTodayString } from './formatters';

export interface ExportMeta {
  dateFrom?: string;
  dateTo?: string;
  appliedFilters?: string[];
}

export type FinancialReportKey =
  | 'pnl'
  | 'daily_sales'
  | 'monthly_sales'
  | 'yearly_sales'
  | 'fixed_expenses'
  | 'variable_expenses'
  | 'production_costs'
  | 'gross_profit'
  | 'net_profit'
  | 'receivables'
  | 'suppliers_purchases'
  | 'monthly_comparison'
  | 'service_profitability';

export interface FinancialReportPayload {
  totalSalesBilled: number;
  totalCollected: number;
  totalFixedExpenses: number;
  totalVarExpenses: number;
  totalExpenses: number;
  totalProduction: number;
  totalPurchases: number;
  grossProfit: number;
  grossMargin: number;
  netEstimatedProfit: number;
  netRealProfit: number;
  dailySalesList: { date: string; count: number; billed: number; collected: number }[];
  monthlySalesList: { month: string; count: number; billed: number; collected: number }[];
  yearlySalesList: { year: string; count: number; billed: number; collected: number }[];
  fixedExpensesList: Expense[];
  variableExpensesList: Expense[];
  productionCosts: ProductionCost[];
  receivablesList: {
    id: string;
    date: string;
    clientName: string;
    clientPhone: string;
    total: number;
    paid: number;
    pending: number;
    status: string;
  }[];
  purchaseOrders: PurchaseOrder[];
  monthlyComparisonList: {
    month: string;
    salesCount: number;
    billed: number;
    collected: number;
    expenses: number;
    productionCost: number;
    estimatedProfit: number;
  }[];
  serviceProfitability: {
    category: string;
    count: number;
    billed: number;
    cost: number;
    profit: number;
    margin: number;
  }[];
}

function getCompanyName(settings?: BusinessSettings): string {
  return settings?.companyName?.trim() || 'Maleja Diseños';
}

export function formatPeriodLabel(dateFrom?: string, dateTo?: string): string {
  if (dateFrom && dateTo) {
    return `Del ${formatDate(dateFrom)} al ${formatDate(dateTo)}`;
  }
  if (dateFrom) {
    return `Desde ${formatDate(dateFrom)}`;
  }
  if (dateTo) {
    return `Hasta ${formatDate(dateTo)}`;
  }
  return 'Histórico completo (Todas las fechas)';
}

function getGenerationTimestamp(): string {
  return new Date().toLocaleString('es-CO', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function getFileStamp(): string {
  return getTodayString();
}

function formatFiltersLabel(appliedFilters?: string[]): string {
  const clean = (appliedFilters || []).filter(Boolean);
  return clean.length > 0 ? clean.join(' | ') : 'Sin filtros adicionales (Todos los registros del periodo)';
}

function computeAutoColWidths(rows: (string | number | null | undefined)[][]): XLSX.ColInfo[] {
  const colWidths: number[] = [];
  rows.forEach((row) => {
    row.forEach((cell, idx) => {
      const len = cell !== null && cell !== undefined ? String(cell).length : 0;
      const clamped = Math.min(Math.max(len + 3, 12), 48);
      if (!colWidths[idx] || clamped > colWidths[idx]) {
        colWidths[idx] = clamped;
      }
    });
  });
  return colWidths.map((wch) => ({ wch }));
}

function buildExcelSheet(
  reportTitle: string,
  settings: BusinessSettings,
  meta: ExportMeta,
  headers: string[],
  dataRows: (string | number)[][],
  summaryRows: [string, string | number][]
): XLSX.WorkSheet {
  const companyName = getCompanyName(settings);
  const periodLabel = formatPeriodLabel(meta.dateFrom, meta.dateTo);
  const generatedAt = getGenerationTimestamp();
  const filtersLabel = formatFiltersLabel(meta.appliedFilters);

  const sheetData: (string | number)[][] = [
    [`${companyName.toUpperCase()} — ${reportTitle.toUpperCase()}`],
    [`NIT / Cédula: ${settings.nit || 'N/A'} | Teléfono: ${settings.phone || 'N/A'} | Correo: ${settings.email || 'N/A'}`],
    ['Periodo consultado:', periodLabel],
    ['Fecha de generación:', generatedAt],
    ['Filtros aplicados:', filtersLabel],
    ['Registros incluidos:', dataRows.length],
    [],
    headers,
    ...dataRows,
    [],
    ['RESUMEN Y TOTALES CORRESPONDIENTES'],
    ...summaryRows.map(([label, val]) => [label, val]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(sheetData);
  ws['!cols'] = computeAutoColWidths(sheetData);
  return ws;
}

function downloadWorkbook(wb: XLSX.WorkBook, filename: string) {
  XLSX.writeFile(wb, filename);
}

function createBrandedPDF(
  reportTitle: string,
  settings: BusinessSettings,
  meta: ExportMeta,
  recordCount: number,
  orientation: 'portrait' | 'landscape' = 'landscape'
): { doc: jsPDF; startY: number } {
  const doc = new jsPDF({ orientation, unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const companyName = getCompanyName(settings);
  const periodLabel = formatPeriodLabel(meta.dateFrom, meta.dateTo);
  const generatedAt = getGenerationTimestamp();
  const filtersLabel = formatFiltersLabel(meta.appliedFilters);

  // Header band
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 28, 'F');

  doc.setFillColor(37, 99, 235);
  doc.rect(0, 26, pageWidth, 2, 'F');

  let textLeftX = 14;
  if (settings.logoUrl && /^data:image\/(png|jpeg);base64,/i.test(settings.logoUrl)) {
    try {
      const fmt = settings.logoUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG';
      doc.addImage(settings.logoUrl, fmt, 14, 5, 16, 16);
      textLeftX = 34;
    } catch {
      textLeftX = 14;
    }
  }

  // Business Name & Details
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(companyName.toUpperCase(), textLeftX, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(203, 213, 225);
  const contactLine = `NIT: ${settings.nit || 'N/A'}  •  Tel: ${settings.phone || 'N/A'}  •  ${settings.email || ''}`;
  doc.text(contactLine, textLeftX, 18);
  if (settings.address) {
    doc.text(settings.address, textLeftX, 23);
  }

  // Report Title on right
  doc.setTextColor(96, 165, 250);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(reportTitle, pageWidth - 14, 13, { align: 'right' });

  doc.setTextColor(226, 232, 240);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const currencyLabel = `${settings.currencyCode || 'COP'} (${settings.currencySymbol || '$'})`;
  doc.text(`Control Financiero • Moneda: ${currencyLabel}`, pageWidth - 14, 19, { align: 'right' });

  // Metadata Box
  doc.setFillColor(244, 247, 251);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, 32, pageWidth - 28, 19, 2, 2, 'FD');

  doc.setTextColor(51, 65, 85);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.text('Periodo consultado:', 18, 38);
  doc.setFont('helvetica', 'normal');
  doc.text(periodLabel, 50, 38);

  doc.setFont('helvetica', 'bold');
  doc.text('Fecha de generación:', pageWidth / 2 + 4, 38);
  doc.setFont('helvetica', 'normal');
  doc.text(generatedAt, pageWidth / 2 + 39, 38);

  doc.setFont('helvetica', 'bold');
  doc.text('Filtros aplicados:', 18, 45);
  doc.setFont('helvetica', 'normal');
  const maxFilterWidth = pageWidth - 95;
  const splitFilter = doc.splitTextToSize(filtersLabel, maxFilterWidth);
  doc.text(splitFilter[0] || '', 47, 45);

  doc.setFont('helvetica', 'bold');
  doc.text(`Registros: ${recordCount}`, pageWidth - 18, 45, { align: 'right' });

  return { doc, startY: 56 };
}

function finalizePDF(doc: jsPDF, companyName: string, filename: string) {
  const pageCount = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `${companyName} | Control Financiero — Documento generado automáticamente sin alterar registros`,
      14,
      pageHeight - 8
    );
    doc.text(`Página ${i} de ${pageCount}`, pageWidth - 14, pageHeight - 8, { align: 'right' });
  }

  doc.save(filename);
}

// ==========================================
// 1. VENTAS (EXCEL & PDF)
// ==========================================

export function exportSalesToExcel(sales: Sale[], settings: BusinessSettings, meta: ExportMeta = {}) {
  const headers = [
    'Nº Venta',
    'Fecha',
    'Cliente',
    'Teléfono',
    'Categoría Principal',
    'Detalle / Servicios',
    'Subtotal (COP)',
    'Descuento (COP)',
    'Valor Total (COP)',
    'Abonado / Recibido (COP)',
    'Saldo Pendiente (COP)',
    'Estado',
    'Medio de Pago',
    'Último Abono',
  ];

  const rows = sales.map((s) => {
    const pending = Math.max(0, s.total - s.amountPaid);
    const itemsSummary = s.items.map((i) => `${i.quantity}x ${i.description}`).join(' | ');
    return [
      s.id,
      s.date,
      s.clientName,
      s.clientPhone || 'N/A',
      s.items[0]?.category || 'Otros servicios',
      itemsSummary,
      s.subtotal,
      s.discount,
      s.total,
      s.amountPaid,
      pending,
      s.paymentStatus === 'Parcial' ? 'Abono' : s.paymentStatus,
      s.paymentMethod,
      s.lastPaymentDate || '-',
    ];
  });

  const totalSubtotal = sales.reduce((acc, s) => acc + s.subtotal, 0);
  const totalDiscount = sales.reduce((acc, s) => acc + s.discount, 0);
  const totalBilled = sales.reduce((acc, s) => acc + s.total, 0);
  const totalPaid = sales.reduce((acc, s) => acc + s.amountPaid, 0);
  const totalPending = Math.max(0, totalBilled - totalPaid);

  const ws = buildExcelSheet('Reporte de Ventas', settings, meta, headers, rows, [
    ['Total Ventas Registradas', sales.length],
    ['Subtotal Acumulado (COP)', totalSubtotal],
    ['Descuentos Aplicados (COP)', totalDiscount],
    ['Total Facturado (COP)', totalBilled],
    ['Total Dinero Recibido (COP)', totalPaid],
    ['Total Saldo Pendiente por Cobrar (COP)', totalPending],
  ]);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Ventas');
  downloadWorkbook(wb, `ventas_maleja_disenos_${getFileStamp()}.xlsx`);
}

export function exportSalesToPDF(sales: Sale[], settings: BusinessSettings, meta: ExportMeta = {}) {
  const { doc, startY } = createBrandedPDF('Reporte de Ventas', settings, meta, sales.length, 'landscape');

  const totalBilled = sales.reduce((acc, s) => acc + s.total, 0);
  const totalPaid = sales.reduce((acc, s) => acc + s.amountPaid, 0);
  const totalPending = Math.max(0, totalBilled - totalPaid);

  const body = sales.map((s) => {
    const pending = Math.max(0, s.total - s.amountPaid);
    const detail = s.items.map((i) => `${i.quantity}x ${i.description}`).join(', ');
    return [
      s.id,
      formatDate(s.date),
      s.clientName,
      detail,
      s.paymentMethod,
      s.paymentStatus === 'Parcial' ? 'Abono' : s.paymentStatus,
      formatCOP(s.total),
      formatCOP(s.amountPaid),
      formatCOP(pending),
    ];
  });

  autoTable(doc, {
    startY,
    head: [['Nº Venta', 'Fecha', 'Cliente', 'Detalle', 'Medio Pago', 'Estado', 'Total', 'Recibido', 'Saldo']],
    body,
    foot: [[
      'TOTALES',
      `${sales.length} ventas`,
      '',
      '',
      '',
      '',
      formatCOP(totalBilled),
      formatCOP(totalPaid),
      formatCOP(totalPending),
    ]],
    styles: { fontSize: 8, cellPadding: 2.5 },
    headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
    footStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      6: { halign: 'right', fontStyle: 'bold' },
      7: { halign: 'right' },
      8: { halign: 'right' },
    },
  });

  finalizePDF(doc, getCompanyName(settings), `ventas_maleja_disenos_${getFileStamp()}.pdf`);
}

// ==========================================
// 2. GASTOS (EXCEL & PDF)
// ==========================================

export function exportExpensesToExcel(expenses: Expense[], settings: BusinessSettings, meta: ExportMeta = {}) {
  const headers = [
    'ID Gasto',
    'Fecha',
    'Tipo',
    'Categoría',
    'Descripción',
    'Proveedor',
    'Medio de Pago',
    'Estado',
    'Recurrente',
    'Valor (COP)',
    'Observaciones',
  ];

  const rows = expenses.map((e) => [
    e.id,
    e.date,
    e.type,
    e.category,
    e.description,
    e.supplier || 'N/A',
    e.paymentMethod,
    e.status,
    e.isRecurring ? 'Sí' : 'No',
    e.amount,
    e.notes || '',
  ]);

  const totalAll = expenses.reduce((acc, e) => acc + e.amount, 0);
  const totalPaid = expenses.filter((e) => e.status === 'Pagado').reduce((acc, e) => acc + e.amount, 0);
  const totalPending = expenses.filter((e) => e.status === 'Pendiente').reduce((acc, e) => acc + e.amount, 0);
  const totalFixed = expenses.filter((e) => e.type === 'Fijo').reduce((acc, e) => acc + e.amount, 0);
  const totalVariable = expenses.filter((e) => e.type !== 'Fijo').reduce((acc, e) => acc + e.amount, 0);

  const ws = buildExcelSheet('Reporte de Gastos', settings, meta, headers, rows, [
    ['Cantidad de Gastos', expenses.length],
    ['Total Gastos Fijos (COP)', totalFixed],
    ['Total Gastos Variables / Extraordinarios (COP)', totalVariable],
    ['Total Gastos Pagados (COP)', totalPaid],
    ['Total Gastos Pendientes (COP)', totalPending],
    ['Total General de Gastos (COP)', totalAll],
  ]);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Gastos');
  downloadWorkbook(wb, `gastos_maleja_disenos_${getFileStamp()}.xlsx`);
}

export function exportExpensesToPDF(expenses: Expense[], settings: BusinessSettings, meta: ExportMeta = {}) {
  const { doc, startY } = createBrandedPDF('Reporte de Gastos', settings, meta, expenses.length, 'landscape');

  const totalAll = expenses.reduce((acc, e) => acc + e.amount, 0);
  const totalPaid = expenses.filter((e) => e.status === 'Pagado').reduce((acc, e) => acc + e.amount, 0);
  const totalPending = expenses.filter((e) => e.status === 'Pendiente').reduce((acc, e) => acc + e.amount, 0);

  const body = expenses.map((e) => [
    e.id,
    formatDate(e.date),
    e.type,
    e.category,
    e.description,
    e.supplier || 'N/A',
    e.paymentMethod,
    e.status,
    formatCOP(e.amount),
  ]);

  autoTable(doc, {
    startY,
    head: [['ID', 'Fecha', 'Tipo', 'Categoría', 'Descripción', 'Proveedor', 'Medio Pago', 'Estado', 'Valor']],
    body,
    foot: [
      ['TOTAL PAGADO', '', '', '', '', '', '', '', formatCOP(totalPaid)],
      ['TOTAL PENDIENTE', '', '', '', '', '', '', '', formatCOP(totalPending)],
      ['TOTAL GENERAL', `${expenses.length} gastos`, '', '', '', '', '', '', formatCOP(totalAll)],
    ],
    styles: { fontSize: 8, cellPadding: 2.5 },
    headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
    footStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      8: { halign: 'right', fontStyle: 'bold' },
    },
  });

  finalizePDF(doc, getCompanyName(settings), `gastos_maleja_disenos_${getFileStamp()}.pdf`);
}

// ==========================================
// 3. COMPRAS (EXCEL & PDF)
// ==========================================

export function exportPurchasesToExcel(purchases: PurchaseOrder[], settings: BusinessSettings, meta: ExportMeta = {}) {
  const headers = [
    'ID Compra',
    'Fecha',
    'Proveedor',
    'Descripción de Insumos / Productos',
    'Medio de Pago',
    'Estado',
    'Monto Total (COP)',
    'Notas',
  ];

  const rows = purchases.map((po) => [
    po.id,
    po.date,
    po.supplierName,
    po.itemsDescription,
    po.paymentMethod,
    po.status,
    po.amount,
    po.notes || '',
  ]);

  const totalAll = purchases.reduce((acc, po) => acc + po.amount, 0);
  const totalPaid = purchases.filter((po) => po.status === 'Pagado').reduce((acc, po) => acc + po.amount, 0);
  const totalPending = purchases.filter((po) => po.status === 'Pendiente').reduce((acc, po) => acc + po.amount, 0);

  const ws = buildExcelSheet('Reporte de Compras a Proveedores', settings, meta, headers, rows, [
    ['Cantidad de Compras', purchases.length],
    ['Total Compras Pagadas (COP)', totalPaid],
    ['Total Compras Pendientes por Pagar (COP)', totalPending],
    ['Total General de Compras (COP)', totalAll],
  ]);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Compras');
  downloadWorkbook(wb, `compras_maleja_disenos_${getFileStamp()}.xlsx`);
}

export function exportPurchasesToPDF(purchases: PurchaseOrder[], settings: BusinessSettings, meta: ExportMeta = {}) {
  const { doc, startY } = createBrandedPDF('Reporte de Compras a Proveedores', settings, meta, purchases.length, 'landscape');

  const totalAll = purchases.reduce((acc, po) => acc + po.amount, 0);
  const totalPaid = purchases.filter((po) => po.status === 'Pagado').reduce((acc, po) => acc + po.amount, 0);
  const totalPending = purchases.filter((po) => po.status === 'Pendiente').reduce((acc, po) => acc + po.amount, 0);

  const body = purchases.map((po) => [
    po.id,
    formatDate(po.date),
    po.supplierName,
    po.itemsDescription,
    po.paymentMethod,
    po.status,
    formatCOP(po.amount),
  ]);

  autoTable(doc, {
    startY,
    head: [['ID Compra', 'Fecha', 'Proveedor', 'Descripción', 'Medio de Pago', 'Estado', 'Monto']],
    body,
    foot: [
      ['TOTAL PAGADO', '', '', '', '', '', formatCOP(totalPaid)],
      ['TOTAL PENDIENTE', '', '', '', '', '', formatCOP(totalPending)],
      ['TOTAL COMPRAS', `${purchases.length} órdenes`, '', '', '', '', formatCOP(totalAll)],
    ],
    styles: { fontSize: 8.5, cellPadding: 2.5 },
    headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
    footStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      6: { halign: 'right', fontStyle: 'bold' },
    },
  });

  finalizePDF(doc, getCompanyName(settings), `compras_maleja_disenos_${getFileStamp()}.pdf`);
}

// ==========================================
// 4. CUENTAS POR COBRAR (EXCEL & PDF)
// ==========================================

export function exportReceivablesToExcel(
  receivables: AccountReceivable[],
  sales: Sale[],
  settings: BusinessSettings,
  meta: ExportMeta = {}
) {
  const headers = [
    'Nº Venta',
    'Fecha Venta',
    'Cliente',
    'Teléfono',
    'Detalle del Pedido',
    'Último Abono',
    'Total Venta (COP)',
    'Total Abonado (COP)',
    'Saldo Pendiente (COP)',
    'Estado Cuenta',
  ];

  const rows = receivables.map((rec) => {
    const sale = sales.find((s) => s.id === rec.saleId);
    const detail = sale ? sale.items.map((i) => `${i.quantity}x ${i.description}`).join(' | ') : '-';
    const accountState = rec.paidAmount > 0 ? 'Abono Parcial' : 'Pendiente Total';
    return [
      rec.saleId,
      sale?.date || rec.dueDate,
      rec.clientName,
      sale?.clientPhone || rec.clientPhone || 'N/A',
      detail,
      sale?.lastPaymentDate || 'Sin abonos',
      rec.totalAmount,
      rec.paidAmount,
      rec.pendingAmount,
      accountState,
    ];
  });

  const totalSales = receivables.reduce((acc, r) => acc + r.totalAmount, 0);
  const totalPaid = receivables.reduce((acc, r) => acc + r.paidAmount, 0);
  const totalPending = receivables.reduce((acc, r) => acc + r.pendingAmount, 0);

  const ws = buildExcelSheet('Cuentas por Cobrar', settings, meta, headers, rows, [
    ['Cantidad de Cuentas Pendientes', receivables.length],
    ['Valor Total de Ventas con Saldo (COP)', totalSales],
    ['Total Abonos Recibidos (COP)', totalPaid],
    ['Total Saldo Pendiente por Cobrar (COP)', totalPending],
  ]);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Cuentas por Cobrar');
  downloadWorkbook(wb, `cuentas_por_cobrar_maleja_disenos_${getFileStamp()}.xlsx`);
}

export function exportReceivablesToPDF(
  receivables: AccountReceivable[],
  sales: Sale[],
  settings: BusinessSettings,
  meta: ExportMeta = {}
) {
  const { doc, startY } = createBrandedPDF('Cuentas por Cobrar', settings, meta, receivables.length, 'landscape');

  const totalSales = receivables.reduce((acc, r) => acc + r.totalAmount, 0);
  const totalPaid = receivables.reduce((acc, r) => acc + r.paidAmount, 0);
  const totalPending = receivables.reduce((acc, r) => acc + r.pendingAmount, 0);

  const body = receivables.map((rec) => {
    const sale = sales.find((s) => s.id === rec.saleId);
    const accountState = rec.paidAmount > 0 ? 'Abono Parcial' : 'Pendiente';
    return [
      rec.saleId,
      formatDate(sale?.date || rec.dueDate),
      rec.clientName,
      sale?.clientPhone || rec.clientPhone || 'N/A',
      sale?.lastPaymentDate ? formatDate(sale.lastPaymentDate) : 'Sin abonos',
      accountState,
      formatCOP(rec.totalAmount),
      formatCOP(rec.paidAmount),
      formatCOP(rec.pendingAmount),
    ];
  });

  autoTable(doc, {
    startY,
    head: [['Nº Venta', 'Fecha Venta', 'Cliente', 'Teléfono', 'Último Abono', 'Estado', 'Total Venta', 'Abonado', 'Saldo Pendiente']],
    body,
    foot: [[
      'TOTALES',
      `${receivables.length} cuentas`,
      '',
      '',
      '',
      '',
      formatCOP(totalSales),
      formatCOP(totalPaid),
      formatCOP(totalPending),
    ]],
    styles: { fontSize: 8, cellPadding: 2.5 },
    headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
    footStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      6: { halign: 'right' },
      7: { halign: 'right' },
      8: { halign: 'right', fontStyle: 'bold' },
    },
  });

  finalizePDF(doc, getCompanyName(settings), `cuentas_por_cobrar_maleja_disenos_${getFileStamp()}.pdf`);
}

// ==========================================
// 5 & 6. INFORMES FINANCIEROS (EXCEL & PDF)
// ==========================================

const REPORT_LABELS: Record<FinancialReportKey, string> = {
  pnl: 'Estado de Resultados Integral (P&L)',
  daily_sales: 'Informe de Ventas Diarias',
  monthly_sales: 'Informe de Ventas Mensuales',
  yearly_sales: 'Informe de Ventas Anuales',
  fixed_expenses: 'Informe de Gastos Fijos',
  variable_expenses: 'Informe de Gastos Variables y Extraordinarios',
  production_costs: 'Informe de Costos de Producción',
  gross_profit: 'Informe de Utilidad Bruta',
  net_profit: 'Informe de Utilidad Neta Estimada',
  receivables: 'Informe de Cuentas por Cobrar',
  suppliers_purchases: 'Informe de Compras y Proveedores',
  monthly_comparison: 'Comparación Financiera entre Meses',
  service_profitability: 'Rentabilidad por Servicio',
};

function getFinancialReportTableSpec(
  reportType: FinancialReportKey,
  data: FinancialReportPayload
): {
  title: string;
  headers: string[];
  excelRows: (string | number)[][];
  pdfRows: string[][];
  summary: [string, string | number][];
  pdfFoot?: string[][];
} {
  const title = REPORT_LABELS[reportType];

  switch (reportType) {
    case 'daily_sales':
      return {
        title,
        headers: ['Fecha', 'Nº Ventas', 'Facturado (COP)', 'Recibido (COP)', 'Saldo Pendiente (COP)'],
        excelRows: data.dailySalesList.map((r) => [r.date, r.count, r.billed, r.collected, Math.max(0, r.billed - r.collected)]),
        pdfRows: data.dailySalesList.map((r) => [
          formatDate(r.date),
          String(r.count),
          formatCOP(r.billed),
          formatCOP(r.collected),
          formatCOP(Math.max(0, r.billed - r.collected)),
        ]),
        summary: [
          ['Total Días con Ventas', data.dailySalesList.length],
          ['Total Ventas Facturadas (COP)', data.totalSalesBilled],
          ['Total Dinero Recibido (COP)', data.totalCollected],
          ['Saldo Pendiente (COP)', Math.max(0, data.totalSalesBilled - data.totalCollected)],
        ],
        pdfFoot: [['TOTALES', String(data.dailySalesList.reduce((a, r) => a + r.count, 0)), formatCOP(data.totalSalesBilled), formatCOP(data.totalCollected), formatCOP(Math.max(0, data.totalSalesBilled - data.totalCollected))]],
      };

    case 'monthly_sales':
      return {
        title,
        headers: ['Mes', 'Nº Ventas', 'Facturado (COP)', 'Recibido (COP)', 'Saldo Pendiente (COP)'],
        excelRows: data.monthlySalesList.map((r) => [r.month, r.count, r.billed, r.collected, Math.max(0, r.billed - r.collected)]),
        pdfRows: data.monthlySalesList.map((r) => [
          r.month,
          String(r.count),
          formatCOP(r.billed),
          formatCOP(r.collected),
          formatCOP(Math.max(0, r.billed - r.collected)),
        ]),
        summary: [
          ['Total Meses', data.monthlySalesList.length],
          ['Total Ventas Facturadas (COP)', data.totalSalesBilled],
          ['Total Dinero Recibido (COP)', data.totalCollected],
        ],
        pdfFoot: [['TOTALES', String(data.monthlySalesList.reduce((a, r) => a + r.count, 0)), formatCOP(data.totalSalesBilled), formatCOP(data.totalCollected), formatCOP(Math.max(0, data.totalSalesBilled - data.totalCollected))]],
      };

    case 'yearly_sales':
      return {
        title,
        headers: ['Año', 'Nº Ventas', 'Facturado (COP)', 'Recibido (COP)', 'Saldo Pendiente (COP)'],
        excelRows: data.yearlySalesList.map((r) => [r.year, r.count, r.billed, r.collected, Math.max(0, r.billed - r.collected)]),
        pdfRows: data.yearlySalesList.map((r) => [
          r.year,
          String(r.count),
          formatCOP(r.billed),
          formatCOP(r.collected),
          formatCOP(Math.max(0, r.billed - r.collected)),
        ]),
        summary: [
          ['Total Ventas Facturadas (COP)', data.totalSalesBilled],
          ['Total Dinero Recibido (COP)', data.totalCollected],
        ],
        pdfFoot: [['TOTALES', String(data.yearlySalesList.reduce((a, r) => a + r.count, 0)), formatCOP(data.totalSalesBilled), formatCOP(data.totalCollected), formatCOP(Math.max(0, data.totalSalesBilled - data.totalCollected))]],
      };

    case 'fixed_expenses':
      return {
        title,
        headers: ['Fecha', 'Descripción', 'Categoría', 'Medio de Pago', 'Estado', 'Valor (COP)'],
        excelRows: data.fixedExpensesList.map((e) => [e.date, e.description, e.category, e.paymentMethod, e.status, e.amount]),
        pdfRows: data.fixedExpensesList.map((e) => [formatDate(e.date), e.description, e.category, e.paymentMethod, e.status, formatCOP(e.amount)]),
        summary: [
          ['Cantidad Gastos Fijos', data.fixedExpensesList.length],
          ['Total Gastos Fijos (COP)', data.totalFixedExpenses],
        ],
        pdfFoot: [['TOTAL GASTOS FIJOS', `${data.fixedExpensesList.length} registros`, '', '', '', formatCOP(data.totalFixedExpenses)]],
      };

    case 'variable_expenses':
      return {
        title,
        headers: ['Fecha', 'Tipo', 'Descripción', 'Categoría', 'Estado', 'Valor (COP)'],
        excelRows: data.variableExpensesList.map((e) => [e.date, e.type, e.description, e.category, e.status, e.amount]),
        pdfRows: data.variableExpensesList.map((e) => [formatDate(e.date), e.type, e.description, e.category, e.status, formatCOP(e.amount)]),
        summary: [
          ['Cantidad Gastos Variables/Extraordinarios', data.variableExpensesList.length],
          ['Total Gastos Variables/Extraordinarios (COP)', data.totalVarExpenses],
        ],
        pdfFoot: [['TOTAL', `${data.variableExpensesList.length} registros`, '', '', '', formatCOP(data.totalVarExpenses)]],
      };

    case 'production_costs':
      return {
        title,
        headers: ['Fecha', 'Referencia', 'Cliente', 'Producto', 'Cantidad', 'Costo Materiales', 'Mano de Obra', 'Otros Costos', 'Costo Total', 'Costo Unitario', 'Utilidad Bruta'],
        excelRows: data.productionCosts.map((pc) => [
          pc.date,
          pc.orderReference,
          pc.clientName,
          pc.productName,
          pc.quantityProduced,
          pc.materialTotalCost,
          pc.laborCost,
          pc.otherCosts,
          pc.totalCost,
          pc.unitCost,
          pc.grossProfit,
        ]),
        pdfRows: data.productionCosts.map((pc) => [
          formatDate(pc.date),
          pc.orderReference,
          pc.clientName,
          pc.productName,
          String(pc.quantityProduced),
          formatCOP(pc.materialTotalCost),
          formatCOP(pc.laborCost),
          formatCOP(pc.otherCosts),
          formatCOP(pc.totalCost),
          formatCOP(pc.unitCost),
        ]),
        summary: [
          ['Registros de Producción', data.productionCosts.length],
          ['Total Costos de Producción (COP)', data.totalProduction],
        ],
        pdfFoot: [['TOTAL PRODUCCIÓN', `${data.productionCosts.length} órdenes`, '', '', '', '', '', '', formatCOP(data.totalProduction), '']],
      };

    case 'receivables': {
      const totalRec = data.receivablesList.reduce((a, r) => a + r.pending, 0);
      const totalBilledRec = data.receivablesList.reduce((a, r) => a + r.total, 0);
      const totalPaidRec = data.receivablesList.reduce((a, r) => a + r.paid, 0);
      return {
        title,
        headers: ['Venta ID', 'Fecha', 'Cliente', 'Teléfono', 'Total Venta (COP)', 'Abonado (COP)', 'Saldo Pendiente (COP)'],
        excelRows: data.receivablesList.map((r) => [r.id, r.date, r.clientName, r.clientPhone, r.total, r.paid, r.pending]),
        pdfRows: data.receivablesList.map((r) => [r.id, formatDate(r.date), r.clientName, r.clientPhone, formatCOP(r.total), formatCOP(r.paid), formatCOP(r.pending)]),
        summary: [
          ['Cuentas Pendientes', data.receivablesList.length],
          ['Total Ventas con Saldo (COP)', totalBilledRec],
          ['Total Abonado (COP)', totalPaidRec],
          ['Total por Cobrar (COP)', totalRec],
        ],
        pdfFoot: [['TOTALES', `${data.receivablesList.length} cuentas`, '', '', formatCOP(totalBilledRec), formatCOP(totalPaidRec), formatCOP(totalRec)]],
      };
    }

    case 'suppliers_purchases':
      return {
        title,
        headers: ['ID Compra', 'Fecha', 'Proveedor', 'Descripción de Insumos', 'Medio Pago', 'Estado', 'Valor (COP)'],
        excelRows: data.purchaseOrders.map((po) => [po.id, po.date, po.supplierName, po.itemsDescription, po.paymentMethod, po.status, po.amount]),
        pdfRows: data.purchaseOrders.map((po) => [po.id, formatDate(po.date), po.supplierName, po.itemsDescription, po.paymentMethod, po.status, formatCOP(po.amount)]),
        summary: [
          ['Total Órdenes de Compra', data.purchaseOrders.length],
          ['Total Compras a Proveedores (COP)', data.totalPurchases],
        ],
        pdfFoot: [['TOTAL COMPRAS', `${data.purchaseOrders.length} órdenes`, '', '', '', '', formatCOP(data.totalPurchases)]],
      };

    case 'monthly_comparison':
      return {
        title,
        headers: ['Mes', 'Nº Ventas', 'Ventas Facturadas (COP)', 'Dinero Recibido (COP)', 'Gastos Operativos (COP)', 'Costos Producción (COP)', 'Utilidad Neta Estimada (COP)'],
        excelRows: data.monthlyComparisonList.map((m) => [m.month, m.salesCount, m.billed, m.collected, m.expenses, m.productionCost, m.estimatedProfit]),
        pdfRows: data.monthlyComparisonList.map((m) => [
          m.month,
          String(m.salesCount),
          formatCOP(m.billed),
          formatCOP(m.collected),
          formatCOP(m.expenses),
          formatCOP(m.productionCost),
          formatCOP(m.estimatedProfit),
        ]),
        summary: [
          ['Meses Comparados', data.monthlyComparisonList.length],
          ['Ventas Facturadas Totales (COP)', data.totalSalesBilled],
          ['Gastos Totales (COP)', data.totalExpenses],
          ['Utilidad Neta Estimada (COP)', data.netEstimatedProfit],
        ],
      };

    case 'service_profitability': {
      const totalBilledSvc = data.serviceProfitability.reduce((a, s) => a + s.billed, 0);
      const totalCostSvc = data.serviceProfitability.reduce((a, s) => a + s.cost, 0);
      const totalProfitSvc = data.serviceProfitability.reduce((a, s) => a + s.profit, 0);
      return {
        title,
        headers: ['Servicio / Categoría', 'Unidades', 'Ventas Totales (COP)', 'Costo Producción (COP)', 'Utilidad Bruta (COP)', 'Margen (%)'],
        excelRows: data.serviceProfitability.map((s) => [s.category, s.count, s.billed, s.cost, s.profit, Number(s.margin.toFixed(1))]),
        pdfRows: data.serviceProfitability.map((s) => [s.category, String(s.count), formatCOP(s.billed), formatCOP(s.cost), formatCOP(s.profit), `${s.margin.toFixed(1)}%`]),
        summary: [
          ['Servicios Evaluados', data.serviceProfitability.length],
          ['Total Ventas por Servicio (COP)', totalBilledSvc],
          ['Total Costo (COP)', totalCostSvc],
          ['Utilidad Bruta Total (COP)', totalProfitSvc],
        ],
        pdfFoot: [['TOTALES', '', formatCOP(totalBilledSvc), formatCOP(totalCostSvc), formatCOP(totalProfitSvc), '']],
      };
    }

    case 'gross_profit':
    case 'net_profit':
    case 'pnl':
    default: {
      const rows: [string, number, string][] = [
        ['1. Ingresos Operacionales (Ventas Facturadas)', data.totalSalesBilled, 'Total facturado en el periodo'],
        ['   - Dinero Efectivamente Recibido (Caja / Bancos)', data.totalCollected, 'Pagos y abonos reales recibidos'],
        ['   - Cartera Pendiente por Cobrar', Math.max(0, data.totalSalesBilled - data.totalCollected), 'Saldo pendiente de clientes'],
        ['2. Costos Directos de Producción', data.totalProduction, 'Materiales, mano de obra y otros costos directos'],
        ['3. Utilidad Bruta (Ventas Facturadas - Costos Producción)', data.grossProfit, `Margen bruto: ${data.grossMargin.toFixed(1)}%`],
        ['4. Gastos Operativos Totales', data.totalExpenses, 'Suma de gastos fijos, variables y extraordinarios'],
        ['   - Gastos Fijos', data.totalFixedExpenses, 'Arriendo, servicios, nómina, suscripciones'],
        ['   - Gastos Variables y Extraordinarios', data.totalVarExpenses, 'Insumos operativos, mantenimiento, imprevistos'],
        ['5. Utilidad Neta Estimada (Contable)', data.netEstimatedProfit, 'Utilidad Bruta menos Gastos Operativos'],
        ['6. Flujo de Caja Neto Real', data.netRealProfit, 'Dinero recibido menos costos de producción y gastos pagados'],
        ['7. Total Compras a Proveedores (Referencia)', data.totalPurchases, `${data.purchaseOrders.length} órdenes de compra`],
      ];

      return {
        title,
        headers: ['Concepto Financiero', 'Valor (COP)', 'Observación'],
        excelRows: rows.map(([concept, val, obs]) => [concept, val, obs]),
        pdfRows: rows.map(([concept, val, obs]) => [concept, formatCOP(val), obs]),
        summary: [
          ['Ventas Facturadas (COP)', data.totalSalesBilled],
          ['Dinero Recibido (COP)', data.totalCollected],
          ['Utilidad Bruta (COP)', data.grossProfit],
          ['Utilidad Neta Estimada (COP)', data.netEstimatedProfit],
          ['Flujo de Caja Neto Real (COP)', data.netRealProfit],
        ],
      };
    }
  }
}

export function exportFinancialReportToExcel(
  reportType: FinancialReportKey,
  data: FinancialReportPayload,
  settings: BusinessSettings,
  meta: ExportMeta = {}
) {
  const spec = getFinancialReportTableSpec(reportType, data);
  const ws = buildExcelSheet(spec.title, settings, meta, spec.headers, spec.excelRows, spec.summary);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Informe');
  downloadWorkbook(wb, `informe_${reportType}_maleja_disenos_${getFileStamp()}.xlsx`);
}

export function exportFinancialReportToPDF(
  reportType: FinancialReportKey,
  data: FinancialReportPayload,
  settings: BusinessSettings,
  meta: ExportMeta = {}
) {
  const spec = getFinancialReportTableSpec(reportType, data);
  const orientation = spec.headers.length > 6 ? 'landscape' : 'portrait';
  const { doc, startY } = createBrandedPDF(spec.title, settings, meta, spec.pdfRows.length, orientation);

  autoTable(doc, {
    startY,
    head: [spec.headers],
    body: spec.pdfRows,
    foot: spec.pdfFoot,
    styles: { fontSize: 8.5, cellPadding: 2.8 },
    headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
    footStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  // Add summary totals block at bottom if no foot was already rendered or for executive clarity
  const finalY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 8 : startY + 20;
  if (finalY < doc.internal.pageSize.getHeight() - 35) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text('Totales Correspondientes del Informe', 14, finalY);

    autoTable(doc, {
      startY: finalY + 3,
      head: [['Indicador / Total', 'Valor']],
      body: spec.summary.map(([label, val]) => [
        label,
        typeof val === 'number' && label.includes('COP') ? formatCOP(val) : String(val),
      ]),
      styles: { fontSize: 8.5, cellPadding: 2.2 },
      headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold' },
      tableWidth: 130,
    });
  }

  finalizePDF(doc, getCompanyName(settings), `informe_${reportType}_maleja_disenos_${getFileStamp()}.pdf`);
}

// ==========================================
// 7. LIBRO CONSOLIDADO MULTIOJAS EXCEL
// ==========================================

export function exportConsolidatedWorkbookToExcel(params: {
  sales: Sale[];
  expenses: Expense[];
  purchases: PurchaseOrder[];
  receivables: AccountReceivable[];
  productionCosts: ProductionCost[];
  settings: BusinessSettings;
  meta?: ExportMeta;
}) {
  const { sales, expenses, purchases, receivables, productionCosts, settings, meta = {} } = params;
  const wb = XLSX.utils.book_new();

  // Sheet 1: Resumen Ejecutivo
  const totalBilled = sales.reduce((a, s) => a + s.total, 0);
  const totalCollected = sales.reduce((a, s) => a + s.amountPaid, 0);
  const totalExpenses = expenses.reduce((a, e) => a + e.amount, 0);
  const totalPurchases = purchases.reduce((a, p) => a + p.amount, 0);
  const totalProduction = productionCosts.reduce((a, p) => a + p.totalCost, 0);
  const totalReceivables = receivables.reduce((a, r) => a + r.pendingAmount, 0);
  const grossProfit = totalBilled - totalProduction;
  const netEstimated = grossProfit - totalExpenses;

  const summarySheet = buildExcelSheet(
    'Libro Financiero Consolidado',
    settings,
    meta,
    ['Concepto', 'Valor (COP)'],
    [
      ['Ventas Facturadas', totalBilled],
      ['Dinero Recibido', totalCollected],
      ['Cuentas por Cobrar Pendientes', totalReceivables],
      ['Costos Directos de Producción', totalProduction],
      ['Utilidad Bruta', grossProfit],
      ['Gastos Operativos', totalExpenses],
      ['Compras a Proveedores', totalPurchases],
      ['Utilidad Neta Estimada', netEstimated],
    ],
    [
      ['Total Ventas', sales.length],
      ['Total Gastos', expenses.length],
      ['Total Compras', purchases.length],
      ['Total Costos de Producción', productionCosts.length],
      ['Total Cuentas por Cobrar', receivables.length],
    ]
  );
  XLSX.utils.book_append_sheet(wb, summarySheet, 'Resumen');

  // Sheet 2: Ventas
  const salesSheet = buildExcelSheet(
    'Detalle de Ventas',
    settings,
    meta,
    ['Nº Venta', 'Fecha', 'Cliente', 'Detalle', 'Total (COP)', 'Recibido (COP)', 'Saldo (COP)', 'Estado', 'Medio Pago'],
    sales.map((s) => [
      s.id,
      s.date,
      s.clientName,
      s.items.map((i) => `${i.quantity}x ${i.description}`).join(' | '),
      s.total,
      s.amountPaid,
      Math.max(0, s.total - s.amountPaid),
      s.paymentStatus,
      s.paymentMethod,
    ]),
    [
      ['Total Facturado (COP)', totalBilled],
      ['Total Recibido (COP)', totalCollected],
    ]
  );
  XLSX.utils.book_append_sheet(wb, salesSheet, 'Ventas');

  // Sheet 3: Gastos
  const expensesSheet = buildExcelSheet(
    'Detalle de Gastos',
    settings,
    meta,
    ['ID', 'Fecha', 'Tipo', 'Categoría', 'Descripción', 'Proveedor', 'Estado', 'Valor (COP)'],
    expenses.map((e) => [e.id, e.date, e.type, e.category, e.description, e.supplier || 'N/A', e.status, e.amount]),
    [['Total Gastos (COP)', totalExpenses]]
  );
  XLSX.utils.book_append_sheet(wb, expensesSheet, 'Gastos');

  // Sheet 4: Compras
  const purchasesSheet = buildExcelSheet(
    'Compras a Proveedores',
    settings,
    meta,
    ['ID Compra', 'Fecha', 'Proveedor', 'Descripción', 'Medio Pago', 'Estado', 'Valor (COP)'],
    purchases.map((p) => [p.id, p.date, p.supplierName, p.itemsDescription, p.paymentMethod, p.status, p.amount]),
    [['Total Compras (COP)', totalPurchases]]
  );
  XLSX.utils.book_append_sheet(wb, purchasesSheet, 'Compras');

  // Sheet 5: Cuentas por Cobrar
  const recSheet = buildExcelSheet(
    'Cuentas por Cobrar',
    settings,
    meta,
    ['Nº Venta', 'Fecha', 'Cliente', 'Total Venta (COP)', 'Abonado (COP)', 'Saldo Pendiente (COP)'],
    receivables.map((r) => [r.saleId, r.dueDate, r.clientName, r.totalAmount, r.paidAmount, r.pendingAmount]),
    [['Total Cartera por Cobrar (COP)', totalReceivables]]
  );
  XLSX.utils.book_append_sheet(wb, recSheet, 'Cuentas por Cobrar');

  // Sheet 6: Costos Producción
  const prodSheet = buildExcelSheet(
    'Costos de Producción',
    settings,
    meta,
    ['ID', 'Fecha', 'Orden', 'Cliente', 'Producto', 'Cantidad', 'Materiales (COP)', 'Mano de Obra (COP)', 'Otros (COP)', 'Costo Total (COP)'],
    productionCosts.map((pc) => [
      pc.id,
      pc.date,
      pc.orderReference,
      pc.clientName,
      pc.productName,
      pc.quantityProduced,
      pc.materialTotalCost,
      pc.laborCost,
      pc.otherCosts,
      pc.totalCost,
    ]),
    [['Total Costos de Producción (COP)', totalProduction]]
  );
  XLSX.utils.book_append_sheet(wb, prodSheet, 'Costos Producción');

  downloadWorkbook(wb, `consolidado_maleja_disenos_${getFileStamp()}.xlsx`);
}
