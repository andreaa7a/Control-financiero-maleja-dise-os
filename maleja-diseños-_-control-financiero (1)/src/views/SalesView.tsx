import React, { useState } from 'react';
import { Sale, SaleItem, ServiceCategory, PaymentMethod, PaymentStatus, BusinessSettings } from '../types/finance';
import { formatCOP, getTodayString } from '../utils/formatters';
import { exportSalesToExcel, exportSalesToPDF } from '../utils/exportUtils';
import {
  generateUniqueId,
  validateSaleInput,
  isDuplicateSaleSignature,
} from '../utils/validation';
import { 
  Plus, 
  Search, 
  Trash2, 
  Edit3, 
  DollarSign, 
  X,
  FileSpreadsheet,
  FileText,
  Calendar,
  AlertCircle,
} from 'lucide-react';

interface SalesViewProps {
  sales: Sale[];
  settings: BusinessSettings;
  onAddSale: (sale: Sale) => Promise<void> | void;
  onUpdateSale: (sale: Sale) => Promise<void> | void;
  onDeleteSale: (saleId: string) => Promise<void> | void;
  onRecordPaymentModal: (saleId: string) => void;
}

const defaultCategories: ServiceCategory[] = [
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

export const SalesView: React.FC<SalesViewProps> = ({
  sales,
  settings,
  onAddSale,
  onUpdateSale,
  onDeleteSale,
  onRecordPaymentModal,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Sale | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const configuredCategories = settings.saleCategories?.length
    ? settings.saleCategories
    : defaultCategories;
  const configuredPaymentMethods = settings.paymentMethods?.length
    ? settings.paymentMethods
    : ['Efectivo', 'Transferencia Bancaria', 'Nequi / DaviPlata', 'Tarjeta', 'Crédito'];

  // Form state
  const [formDate, setFormDate] = useState(getTodayString());
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    configuredPaymentMethods[0] || 'Transferencia Bancaria'
  );
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<SaleItem[]>([
    {
      id: '1',
      category: configuredCategories[0] || 'Impresión digital',
      description: '',
      quantity: 1,
      unitPrice: 0,
      total: 0,
    },
  ]);
  const [discount, setDiscount] = useState<number>(0);
  const [amountPaid, setAmountPaid] = useState<number>(0);

  // Collision-free consecutive number generator
  const nextSaleNumber = generateUniqueId(
    `VEN-${new Date().getFullYear()}-`,
    sales.map((s) => s.id)
  );

  const handleOpenNewModal = () => {
    setEditingSale(null);
    setFormError(null);
    setIsSubmitting(false);
    setFormDate(getTodayString());
    setClientName('');
    setClientPhone('');
    setClientEmail('');
    setPaymentMethod(configuredPaymentMethods[0] || 'Transferencia Bancaria');
    setNotes('');
    setItems([
      {
        id: Date.now().toString(),
        category: configuredCategories[0] || 'Impresión digital',
        description: '',
        quantity: 1,
        unitPrice: 0,
        total: 0,
      },
    ]);
    setDiscount(0);
    setAmountPaid(0);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (sale: Sale) => {
    setEditingSale(sale);
    setFormError(null);
    setIsSubmitting(false);
    setFormDate(sale.date);
    setClientName(sale.clientName);
    setClientPhone(sale.clientPhone || '');
    setClientEmail(sale.clientEmail || '');
    setPaymentMethod(sale.paymentMethod);
    setNotes(sale.notes || '');
    setItems(sale.items.map((it) => ({ ...it })));
    setDiscount(sale.discount);
    setAmountPaid(sale.amountPaid);
    setIsModalOpen(true);
  };

  const handleAddItem = () => {
    setItems([
      ...items,
      {
        id: Date.now().toString(),
        category: configuredCategories[0] || 'Impresión digital',
        description: '',
        quantity: 1,
        unitPrice: 0,
        total: 0,
      },
    ]);
  };

  const handleRemoveItem = (id: string) => {
    if (items.length === 1) return;
    setItems(items.filter(item => item.id !== id));
  };

  const handleItemChange = (id: string, field: keyof SaleItem, value: any) => {
    setFormError(null);
    setItems(items.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value };
        if (field === 'quantity' || field === 'unitPrice') {
          updated.total = Number(updated.quantity) * Number(updated.unitPrice);
        }
        return updated;
      }
      return item;
    }));
  };

  const subtotal = items.reduce((acc, item) => acc + item.total, 0);
  const total = Math.max(0, subtotal - discount);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setFormError(null);

    const validation = validateSaleInput({
      date: formDate,
      clientName,
      items,
      discount,
      amountPaid,
    });

    if (!validation.valid || !validation.data) {
      setFormError(validation.error || 'Verifique los datos de la venta.');
      return;
    }

    if (!editingSale && isDuplicateSaleSignature(sales, { date: formDate, clientName, total: validation.data.total })) {
      setFormError('Ya existe una venta registrada para este mismo cliente, fecha y valor total. Verifique para evitar duplicados.');
      return;
    }

    if (editingSale && !sales.some((s) => s.id === editingSale.id)) {
      setFormError('Esta venta ya no existe en el sistema.');
      return;
    }

    const saleData: Sale = {
      id: editingSale ? editingSale.id : nextSaleNumber,
      date: formDate,
      clientName: clientName.trim().slice(0, 150),
      clientPhone: clientPhone.trim().slice(0, 50) || undefined,
      clientEmail: clientEmail.trim().slice(0, 100) || undefined,
      items: items.map((it) => ({
        ...it,
        description: it.description.trim().slice(0, 200),
        total: Number(it.quantity) * Number(it.unitPrice),
      })),
      subtotal: validation.data.subtotal,
      discount,
      total: validation.data.total,
      amountPaid,
      paymentStatus: validation.data.paymentStatus,
      paymentMethod,
      notes: notes.trim().slice(0, 500) || undefined,
      ...(editingSale?.lastPaymentDate ? { lastPaymentDate: editingSale.lastPaymentDate } : {}),
    };

    setIsSubmitting(true);
    try {
      if (editingSale) {
        await onUpdateSale(saleData);
      } else {
        await onAddSale(saleData);
      }
      setIsModalOpen(false);
    } catch (err: any) {
      setFormError(err?.message || 'Error de conexión al guardar la venta en la base de datos.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredSales = sales.filter(sale => {
    const matchesSearch = 
      sale.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sale.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sale.items.some(i => i.description.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = statusFilter === 'all' || sale.paymentStatus === statusFilter;
    const matchesFrom = !dateFrom || sale.date >= dateFrom;
    const matchesTo = !dateTo || sale.date <= dateTo;
    return matchesSearch && matchesStatus && matchesFrom && matchesTo;
  });

  const getAppliedFilters = () => {
    const filters: string[] = [];
    if (statusFilter !== 'all') filters.push(`Estado: ${statusFilter === 'Parcial' ? 'Abono' : statusFilter}`);
    if (searchTerm.trim()) filters.push(`Búsqueda: "${searchTerm.trim()}"`);
    return filters;
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-10">
      {/* Header */}
      <div className="bg-white dark:bg-[#0d1322] border border-slate-200 dark:border-[#1e293b] rounded-2xl p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 shadow-sm dark:shadow-xl transition-colors">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">Módulo: Registrar Venta</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Control de servicios de diseño, impresión y productos publicitarios</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => exportSalesToExcel(filteredSales, settings, { dateFrom, dateTo, appliedFilters: getAppliedFilters() })}
            className="px-3.5 py-2.5 bg-slate-100 dark:bg-[#111827] hover:bg-slate-200 dark:hover:bg-[#1e293b] border border-slate-200 dark:border-[#1e293b] text-slate-800 dark:text-slate-200 font-semibold rounded-xl text-xs transition-all flex items-center gap-2 shadow-sm"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Exportar Excel</span>
          </button>
          <button
            type="button"
            onClick={() => exportSalesToPDF(filteredSales, settings, { dateFrom, dateTo, appliedFilters: getAppliedFilters() })}
            className="px-3.5 py-2.5 bg-slate-100 dark:bg-[#111827] hover:bg-slate-200 dark:hover:bg-[#1e293b] border border-slate-200 dark:border-[#1e293b] text-slate-800 dark:text-slate-200 font-semibold rounded-xl text-xs transition-all flex items-center gap-2 shadow-sm"
          >
            <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>Descargar PDF</span>
          </button>
          <button
            onClick={handleOpenNewModal}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl shadow-md dark:shadow-lg dark:shadow-blue-950 transition-all flex items-center justify-center space-x-2 text-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Registrar Venta</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-[#0d1322] border border-slate-200 dark:border-[#1e293b] p-4 rounded-2xl shadow-sm dark:shadow-none flex flex-col gap-4 transition-colors">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          <div className="relative w-full lg:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Buscar por cliente, ID o descripción..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-[#1e293b] rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              Periodo:
            </span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              aria-label="Fecha desde"
              className="px-3 py-1.5 bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-[#1e293b] rounded-lg text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
            />
            <span className="text-xs text-slate-400">a</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              aria-label="Fecha hasta"
              className="px-3 py-1.5 bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-[#1e293b] rounded-lg text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
            />
            {(dateFrom || dateTo) && (
              <button
                type="button"
                onClick={() => { setDateFrom(''); setDateTo(''); }}
                className="px-2.5 py-1.5 bg-slate-100 dark:bg-[#111827] hover:bg-slate-200 dark:hover:bg-[#1e293b] text-slate-600 dark:text-slate-300 rounded-lg text-[11px] font-semibold"
              >
                Limpiar fechas
              </button>
            )}
          </div>

          <div className="flex items-center space-x-2 overflow-x-auto pb-1 sm:pb-0">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Estado:</span>
            {['all', 'Pagado', 'Parcial', 'Pendiente'].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  statusFilter === status
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-slate-100 dark:bg-[#111827] text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-[#1e293b]'
                }`}
              >
                {status === 'all' ? 'Todas' : status === 'Parcial' ? 'Abono' : status}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Sales Table */}
      <div className="bg-white dark:bg-[#0d1322] border border-slate-200 dark:border-[#1e293b] rounded-2xl shadow-sm dark:shadow-xl overflow-hidden transition-colors">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-[#111827] border-b border-slate-200 dark:border-[#1e293b] text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">
                <th className="p-4">Nº Venta / Fecha</th>
                <th className="p-4">Cliente</th>
                <th className="p-4">Detalle / Servicios</th>
                <th className="p-4 text-right">Valor Total</th>
                <th className="p-4 text-right">Recibido / Saldo</th>
                <th className="p-4 text-center">Estado</th>
                <th className="p-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-[#1e293b] text-xs">
              {filteredSales.map((sale) => {
                const saldo = sale.total - sale.amountPaid;
                return (
                  <tr key={sale.id} className="hover:bg-slate-50 dark:hover:bg-[#111827]/50 transition-colors">
                    <td className="p-4">
                      <span className="font-bold text-slate-900 dark:text-white">{sale.id}</span>
                      <p className="text-[10px] text-slate-500">{sale.date}</p>
                    </td>
                    <td className="p-4">
                      <p className="font-semibold text-slate-800 dark:text-slate-200">{sale.clientName}</p>
                      {sale.clientPhone && <p className="text-[10px] text-slate-500">{sale.clientPhone}</p>}
                    </td>
                    <td className="p-4 max-w-xs text-slate-600 dark:text-slate-300">
                      <p className="truncate font-medium">
                        {sale.items.map(i => `${i.quantity}x ${i.description}`).join(' | ')}
                      </p>
                      <span className="inline-block mt-1 px-2 py-0.5 bg-blue-50 dark:bg-[#111827] border border-blue-200 dark:border-[#1e293b] text-blue-700 dark:text-blue-300 rounded-md text-[10px]">
                        {sale.items[0]?.category}
                      </span>
                    </td>
                    <td className="p-4 text-right font-black text-slate-900 dark:text-white">
                      {formatCOP(sale.total)}
                    </td>
                    <td className="p-4 text-right">
                      <p className="font-bold text-emerald-600 dark:text-emerald-400">{formatCOP(sale.amountPaid)}</p>
                      {saldo > 0 && (
                        <p className="text-[10px] font-semibold text-rose-600 dark:text-rose-400">Saldo: {formatCOP(saldo)}</p>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-semibold ${
                        sale.paymentStatus === 'Pagado'
                          ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30'
                          : sale.paymentStatus === 'Parcial'
                          ? 'bg-amber-50 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30'
                          : 'bg-rose-50 dark:bg-rose-500/20 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30'
                      }`}>
                        {sale.paymentStatus === 'Parcial' ? 'Abono' : sale.paymentStatus}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center space-x-2">
                        {saldo > 0 && (
                          <button
                            onClick={() => onRecordPaymentModal(sale.id)}
                            title="Registrar Abono"
                            className="p-1.5 bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/30 rounded-lg transition-colors"
                          >
                            <DollarSign className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleOpenEditModal(sale)}
                          title="Editar Venta"
                          className="p-1.5 bg-slate-100 dark:bg-[#111827] text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-lg transition-colors"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(sale)}
                          title="Eliminar Venta"
                          className="p-1.5 bg-rose-50 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500/30 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredSales.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-slate-500">
                    No se encontraron ventas registradas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Registrar / Editar Venta Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/70 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-[#0d1322] border border-slate-200 dark:border-[#1e293b] rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-slate-50 dark:bg-[#111827] text-slate-900 dark:text-white p-5 flex items-center justify-between border-b border-slate-200 dark:border-[#1e293b]">
              <div>
                <h3 className="text-lg font-bold">
                  {editingSale ? `Editar Venta (${editingSale.id})` : `Registrar Venta (${nextSaleNumber})`}
                </h3>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">ID Único Consecutivo automático</p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded-lg"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
              {formError && (
                <div className="p-3.5 bg-rose-50 dark:bg-rose-500/15 border border-rose-200 dark:border-rose-500/30 rounded-xl flex items-center gap-2.5 text-rose-700 dark:text-rose-300 font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                  <span>{formError}</span>
                </div>
              )}
              {/* Client & Date Info */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">Fecha de Venta</label>
                  <input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-[#1e293b] rounded-xl text-slate-900 dark:text-white font-medium focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">Nombre del Cliente *</label>
                  <input
                    type="text"
                    placeholder="Ej. Inmobiliaria S.A.S."
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-[#1e293b] rounded-xl text-slate-900 dark:text-white font-medium focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">Contacto Opcional</label>
                  <input
                    type="text"
                    placeholder="+57 310..."
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-[#1e293b] rounded-xl text-slate-900 dark:text-white font-medium focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Items Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-600 dark:text-slate-400 uppercase">Productos y Servicios</h4>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-colors flex items-center space-x-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Agregar Ítem</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {items.map((item) => (
                    <div key={item.id} className="p-4 bg-slate-50 dark:bg-[#111827] border border-slate-200 dark:border-[#1e293b] rounded-xl space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                        <div className="sm:col-span-5">
                          <label className="block font-semibold text-slate-500 uppercase mb-1">Categoría</label>
                          <select
                            value={item.category}
                            onChange={(e) => handleItemChange(item.id, 'category', e.target.value as ServiceCategory)}
                            className="w-full px-3 py-2 bg-white dark:bg-[#070b14] border border-slate-200 dark:border-[#1e293b] rounded-lg text-slate-900 dark:text-white"
                          >
                            {Array.from(new Set([...configuredCategories, item.category])).map((cat) => (
                              <option key={cat} value={cat}>{cat}</option>
                            ))}
                          </select>
                        </div>
                        <div className="sm:col-span-6">
                          <label className="block font-semibold text-slate-500 uppercase mb-1">Descripción del Servicio/Producto *</label>
                          <input
                            type="text"
                            placeholder="Ej. Pendón laminado 2x1m"
                            value={item.description}
                            onChange={(e) => handleItemChange(item.id, 'description', e.target.value)}
                            className="w-full px-3 py-2 bg-white dark:bg-[#070b14] border border-slate-200 dark:border-[#1e293b] rounded-lg text-slate-900 dark:text-white"
                            required
                          />
                        </div>
                        <div className="sm:col-span-1 flex justify-end">
                          {items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(item.id)}
                              className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/20 rounded-lg mt-5 sm:mt-0"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3 pt-2 border-t border-slate-200 dark:border-[#1e293b]">
                        <div>
                          <label className="block font-semibold text-slate-500 uppercase">Cantidad *</label>
                          <input
                            type="number"
                            min="1"
                            value={item.quantity || ''}
                            onChange={(e) =>
                              handleItemChange(
                                item.id,
                                'quantity',
                                e.target.value === '' ? 0 : Math.max(0, parseInt(e.target.value, 10) || 0)
                              )
                            }
                            className="w-full px-3 py-1.5 bg-white dark:bg-[#070b14] border border-slate-200 dark:border-[#1e293b] rounded-lg text-slate-900 dark:text-white font-bold"
                            required
                          />
                        </div>
                        <div>
                          <label className="block font-semibold text-slate-500 uppercase">Precio Unitario ($) *</label>
                          <input
                            type="number"
                            min="1"
                            step="1000"
                            value={item.unitPrice}
                            onChange={(e) => handleItemChange(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                            className="w-full px-3 py-1.5 bg-white dark:bg-[#070b14] border border-slate-200 dark:border-[#1e293b] rounded-lg text-slate-900 dark:text-white font-bold"
                            required
                          />
                        </div>
                        <div>
                          <label className="block font-semibold text-slate-500 uppercase">Subtotal</label>
                          <div className="px-3 py-1.5 bg-white dark:bg-[#070b14] border border-slate-200 dark:border-transparent rounded-lg font-black text-slate-900 dark:text-white mt-0.5">
                            {formatCOP(item.total)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Payment Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-200 dark:border-[#1e293b]">
                <div className="space-y-4">
                  <div>
                    <label className="block font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">Forma de Pago</label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-[#1e293b] rounded-xl text-slate-900 dark:text-white font-medium"
                    >
                      {Array.from(new Set([...configuredPaymentMethods, paymentMethod])).map((pm) => (
                        <option key={pm} value={pm}>{pm}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">Notas u Observaciones</label>
                    <textarea
                      rows={2}
                      placeholder="Instrucciones especiales..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full px-3.5 py-2 bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-[#1e293b] rounded-xl text-slate-900 dark:text-white font-medium"
                    />
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-[#111827] p-5 rounded-2xl border border-slate-200 dark:border-[#1e293b] space-y-3">
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>Subtotal:</span>
                    <span className="font-bold text-slate-900 dark:text-white">{formatCOP(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600 dark:text-slate-400 items-center">
                    <span>Descuento ($):</span>
                    <input
                      type="number"
                      min="0"
                      value={discount}
                      onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                      className="w-28 px-2 py-1 bg-white dark:bg-[#070b14] border border-slate-200 dark:border-[#1e293b] rounded-lg font-bold text-slate-900 dark:text-white text-right"
                    />
                  </div>
                  <div className="flex justify-between font-black text-slate-900 dark:text-white pt-2 border-t border-slate-200 dark:border-[#1e293b] text-sm">
                    <span>Valor Total:</span>
                    <span className="text-blue-600 dark:text-blue-400">{formatCOP(total)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600 dark:text-slate-400 items-center pt-2 border-t border-slate-200 dark:border-[#1e293b]">
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">Valor Recibido ($):</span>
                    <input
                      type="number"
                      min="0"
                      max={total}
                      value={amountPaid}
                      onChange={(e) => setAmountPaid(parseFloat(e.target.value) || 0)}
                      className="w-28 px-2 py-1 bg-white dark:bg-[#070b14] border border-emerald-500/50 rounded-lg font-bold text-emerald-600 dark:text-emerald-400 text-right"
                    />
                  </div>
                  <div className="flex justify-between text-slate-600 dark:text-slate-400 pt-1">
                    <span>Saldo Pendiente:</span>
                    <span className="font-bold text-rose-600 dark:text-rose-400">{formatCOP(Math.max(0, total - amountPaid))}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200 dark:border-[#1e293b]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 bg-slate-100 dark:bg-[#1e293b] hover:bg-slate-200 dark:hover:bg-[#334155] text-slate-700 dark:text-slate-200 font-semibold rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold rounded-xl shadow-md transition-all"
                >
                  {isSubmitting ? 'Guardando...' : 'Guardar venta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/70 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-[#0d1322] border border-slate-200 dark:border-[#1e293b] rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden p-6 text-center space-y-4">
            <div className="w-12 h-12 bg-rose-50 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-full flex items-center justify-center mx-auto border border-rose-200 dark:border-rose-500/30">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">¿Eliminar Venta?</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Se eliminará la venta <span className="font-bold text-slate-900 dark:text-white">{deleteTarget.id}</span> de{' '}
              <span className="font-semibold text-slate-800 dark:text-slate-200">{deleteTarget.clientName}</span> por{' '}
              <span className="font-bold text-rose-600 dark:text-rose-400">{formatCOP(deleteTarget.total)}</span>. Los indicadores y cuentas por cobrar se recalcularán automáticamente.
            </p>
            <div className="flex items-center justify-center space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-[#111827] hover:bg-slate-200 dark:hover:bg-[#1e293b] text-slate-700 dark:text-slate-300 font-semibold rounded-xl text-xs"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  const id = deleteTarget.id;
                  setDeleteTarget(null);
                  await onDeleteSale(id);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-xl text-xs shadow-md"
              >
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
