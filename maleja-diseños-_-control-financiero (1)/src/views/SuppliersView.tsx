import React, { useState } from 'react';
import { Supplier, PurchaseOrder, BusinessSettings } from '../types/finance';
import { formatCOP, getTodayString } from '../utils/formatters';
import { exportPurchasesToExcel, exportPurchasesToPDF } from '../utils/exportUtils';
import {
  generateUniqueId,
  validateSupplierInput,
  validatePurchaseOrderInput,
  isDuplicateSupplierName,
  isDuplicatePurchaseSignature,
} from '../utils/validation';
import { Plus, Trash2, Edit3, X, Phone, Mail, FileSpreadsheet, FileText, Search, Calendar, AlertCircle } from 'lucide-react';

interface SuppliersViewProps {
  suppliers: Supplier[];
  purchaseOrders: PurchaseOrder[];
  settings: BusinessSettings;
  onAddSupplier: (supplier: Supplier) => Promise<void> | void;
  onUpdateSupplier: (supplier: Supplier) => Promise<void> | void;
  onAddPurchase: (po: PurchaseOrder) => Promise<void> | void;
  onUpdatePurchase: (po: PurchaseOrder) => Promise<void> | void;
  onDeleteSupplier: (id: string) => Promise<void> | void;
  onDeletePurchase: (id: string) => Promise<void> | void;
}

export const SuppliersView: React.FC<SuppliersViewProps> = ({
  suppliers,
  purchaseOrders,
  settings,
  onAddSupplier,
  onUpdateSupplier,
  onAddPurchase,
  onUpdatePurchase,
  onDeleteSupplier,
  onDeletePurchase,
}) => {
  const [activeTab, setActiveTab] = useState<'suppliers' | 'purchases'>('suppliers');
  const [purchaseSearch, setPurchaseSearch] = useState('');
  const [purchaseStatusFilter, setPurchaseStatusFilter] = useState<'all' | 'Pagado' | 'Pendiente'>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);

  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [editingPurchase, setEditingPurchase] = useState<PurchaseOrder | null>(null);
  const [deleteSupplierTarget, setDeleteSupplierTarget] = useState<Supplier | null>(null);
  const [deletePurchaseTarget, setDeletePurchaseTarget] = useState<PurchaseOrder | null>(null);
  const [supError, setSupError] = useState<string | null>(null);
  const [poError, setPoError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [supName, setSupName] = useState('');
  const [supCategory, setSupCategory] = useState('');
  const [supContact, setSupContact] = useState('');
  const [supPhone, setSupPhone] = useState('');
  const [supEmail, setSupEmail] = useState('');
  const [supAddress, setSupAddress] = useState('');
  const [supNotes, setSupNotes] = useState('');

  const configuredPaymentMethods = settings.paymentMethods?.length
    ? settings.paymentMethods
    : ['Transferencia Bancaria', 'Efectivo', 'Nequi / DaviPlata', 'Tarjeta', 'Crédito'];

  const [poDate, setPoDate] = useState(getTodayString());
  const [selectedSupplierId, setSelectedSupplierId] = useState(suppliers[0]?.id || '');
  const [itemsDesc, setItemsDesc] = useState('');
  const [poAmount, setPoAmount] = useState<number>(0);
  const [poStatus, setPoStatus] = useState<'Pagado' | 'Pendiente'>('Pagado');
  const [poPaymentMethod, setPoPaymentMethod] = useState<string>(
    configuredPaymentMethods[0] || 'Transferencia Bancaria'
  );

  const handleOpenNewSupplier = () => {
    setEditingSupplier(null);
    setSupError(null);
    setIsSubmitting(false);
    setSupName('');
    setSupCategory('');
    setSupContact('');
    setSupPhone('');
    setSupEmail('');
    setSupAddress('');
    setSupNotes('');
    setIsSupplierModalOpen(true);
  };

  const handleOpenEditSupplier = (sup: Supplier) => {
    setEditingSupplier(sup);
    setSupError(null);
    setIsSubmitting(false);
    setSupName(sup.name);
    setSupCategory(sup.category);
    setSupContact(sup.contactPerson || '');
    setSupPhone(sup.phone || '');
    setSupEmail(sup.email || '');
    setSupAddress(sup.address || '');
    setSupNotes(sup.notes || '');
    setIsSupplierModalOpen(true);
  };

  const handleSupplierSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setSupError(null);

    const validation = validateSupplierInput({ name: supName });
    if (!validation.valid) {
      setSupError(validation.error || 'Verifique los datos del proveedor.');
      return;
    }
    if (isDuplicateSupplierName(suppliers, supName, editingSupplier?.id)) {
      setSupError('Ya existe un proveedor registrado con ese nombre.');
      return;
    }
    if (editingSupplier && !suppliers.some((s) => s.id === editingSupplier.id)) {
      setSupError('Este proveedor ya no existe en el sistema.');
      return;
    }

    const nextSupId = generateUniqueId('sup-', suppliers.map((s) => s.id), 1);

    const supData: Supplier = {
      id: editingSupplier ? editingSupplier.id : nextSupId,
      name: supName.trim().slice(0, 150),
      category: (supCategory.trim() || 'Insumos').slice(0, 100),
      contactPerson: supContact.trim().slice(0, 100),
      phone: supPhone.trim().slice(0, 50),
      email: supEmail.trim().slice(0, 100),
      address: supAddress.trim().slice(0, 200) || undefined,
      notes: supNotes.trim().slice(0, 300) || undefined,
    };

    setIsSubmitting(true);
    try {
      if (editingSupplier) {
        await onUpdateSupplier(supData);
      } else {
        await onAddSupplier(supData);
      }
      setIsSupplierModalOpen(false);
    } catch (err: any) {
      setSupError(err?.message || 'Error al guardar el proveedor en la base de datos.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenNewPurchase = () => {
    setEditingPurchase(null);
    setPoError(null);
    setIsSubmitting(false);
    setPoDate(getTodayString());
    setSelectedSupplierId(suppliers[0]?.id || '');
    setItemsDesc('');
    setPoAmount(0);
    setPoStatus('Pagado');
    setPoPaymentMethod(configuredPaymentMethods[0] || 'Transferencia Bancaria');
    setIsPurchaseModalOpen(true);
  };

  const handleOpenEditPurchase = (po: PurchaseOrder) => {
    setEditingPurchase(po);
    setPoError(null);
    setIsSubmitting(false);
    setPoDate(po.date);
    setSelectedSupplierId(po.supplierId);
    setItemsDesc(po.itemsDescription);
    setPoAmount(po.amount);
    setPoStatus(po.status);
    setPoPaymentMethod(po.paymentMethod || configuredPaymentMethods[0] || 'Transferencia Bancaria');
    setIsPurchaseModalOpen(true);
  };

  const handlePurchaseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setPoError(null);

    const validation = validatePurchaseOrderInput({
      date: poDate,
      itemsDescription: itemsDesc,
      amount: poAmount,
    });
    if (!validation.valid) {
      setPoError(validation.error || 'Verifique los datos de la compra.');
      return;
    }

    const supplierObj = suppliers.find(s => s.id === selectedSupplierId);
    const supplierName = supplierObj ? supplierObj.name : 'Proveedor General';

    if (
      !editingPurchase &&
      isDuplicatePurchaseSignature(purchaseOrders, {
        date: poDate,
        supplierName,
        itemsDescription: itemsDesc,
        amount: poAmount,
      })
    ) {
      setPoError('Ya existe una orden de compra idéntica registrada para este proveedor, fecha y monto.');
      return;
    }

    if (editingPurchase && !purchaseOrders.some((p) => p.id === editingPurchase.id)) {
      setPoError('Esta orden de compra ya no existe en el sistema.');
      return;
    }

    const nextPoId = generateUniqueId('COM-', purchaseOrders.map((p) => p.id));

    const poData: PurchaseOrder = {
      id: editingPurchase ? editingPurchase.id : nextPoId,
      date: poDate,
      supplierId: (selectedSupplierId || '').slice(0, 50),
      supplierName: supplierName.slice(0, 150),
      itemsDescription: itemsDesc.trim().slice(0, 300),
      amount: poAmount,
      status: poStatus,
      paymentMethod: (poPaymentMethod || 'Transferencia Bancaria').slice(0, 50),
    };

    setIsSubmitting(true);
    try {
      if (editingPurchase) {
        await onUpdatePurchase(poData);
      } else {
        await onAddPurchase(poData);
      }
      setIsPurchaseModalOpen(false);
    } catch (err: any) {
      setPoError(err?.message || 'Error al guardar la orden de compra en la base de datos.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredPurchases = purchaseOrders.filter(po => {
    const matchesSearch =
      po.supplierName.toLowerCase().includes(purchaseSearch.toLowerCase()) ||
      po.itemsDescription.toLowerCase().includes(purchaseSearch.toLowerCase()) ||
      po.id.toLowerCase().includes(purchaseSearch.toLowerCase());
    const matchesStatus = purchaseStatusFilter === 'all' || po.status === purchaseStatusFilter;
    const matchesFrom = !dateFrom || po.date >= dateFrom;
    const matchesTo = !dateTo || po.date <= dateTo;
    return matchesSearch && matchesStatus && matchesFrom && matchesTo;
  });

  const getPurchaseFilters = () => {
    const filters: string[] = [];
    if (purchaseStatusFilter !== 'all') filters.push(`Estado: ${purchaseStatusFilter}`);
    if (purchaseSearch.trim()) filters.push(`Búsqueda: "${purchaseSearch.trim()}"`);
    return filters;
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-10">
      <div className="bg-white dark:bg-[#0d1322] border border-slate-200 dark:border-[#1e293b] rounded-2xl p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 shadow-sm dark:shadow-xl transition-colors">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Compras y Proveedores</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Gestión de proveedores e insumos gráficos</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => exportPurchasesToExcel(filteredPurchases, settings, { dateFrom, dateTo, appliedFilters: getPurchaseFilters() })}
            className="px-3.5 py-2.5 bg-slate-100 dark:bg-[#111827] hover:bg-slate-200 dark:hover:bg-[#1e293b] border border-slate-200 dark:border-[#1e293b] text-slate-800 dark:text-slate-200 font-semibold rounded-xl text-xs transition-all flex items-center gap-2 shadow-sm"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Exportar Compras Excel</span>
          </button>
          <button
            type="button"
            onClick={() => exportPurchasesToPDF(filteredPurchases, settings, { dateFrom, dateTo, appliedFilters: getPurchaseFilters() })}
            className="px-3.5 py-2.5 bg-slate-100 dark:bg-[#111827] hover:bg-slate-200 dark:hover:bg-[#1e293b] border border-slate-200 dark:border-[#1e293b] text-slate-800 dark:text-slate-200 font-semibold rounded-xl text-xs transition-all flex items-center gap-2 shadow-sm"
          >
            <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>PDF Compras</span>
          </button>
          <button
            onClick={() => {
              if (activeTab === 'suppliers') handleOpenNewSupplier();
              else handleOpenNewPurchase();
            }}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl shadow-md dark:shadow-lg dark:shadow-blue-950 transition-all flex items-center space-x-2 text-xs"
          >
            <Plus className="w-4 h-4" />
            <span>{activeTab === 'suppliers' ? 'Nuevo Proveedor' : 'Nueva Compra'}</span>
          </button>
        </div>
      </div>

      <div className="flex space-x-2 border-b border-slate-200 dark:border-[#1e293b] pb-2">
        <button
          onClick={() => setActiveTab('suppliers')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'suppliers' 
              ? 'bg-blue-600 text-white shadow-md' 
              : 'bg-white dark:bg-[#0d1322] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-[#1e293b] hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          Proveedores ({suppliers.length})
        </button>
        <button
          onClick={() => setActiveTab('purchases')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'purchases' 
              ? 'bg-blue-600 text-white shadow-md' 
              : 'bg-white dark:bg-[#0d1322] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-[#1e293b] hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          Órdenes de Compra ({purchaseOrders.length})
        </button>
      </div>

      {activeTab === 'suppliers' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {suppliers.map((sup) => (
            <div key={sup.id} className="bg-white dark:bg-[#0d1322] border border-slate-200 dark:border-[#1e293b] rounded-2xl p-6 shadow-sm dark:shadow-xl space-y-4 flex flex-col justify-between transition-colors">
              <div className="space-y-2">
                <div className="flex items-start justify-between">
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">{sup.name}</h3>
                  <div className="flex items-center space-x-1">
                    <button onClick={() => handleOpenEditSupplier(sup)} className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1">
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button onClick={() => setDeleteSupplierTarget(sup)} className="text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 p-1" title="Eliminar Proveedor">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <span className="inline-block px-2.5 py-0.5 bg-blue-50 dark:bg-[#111827] border border-blue-200 dark:border-[#1e293b] text-blue-700 dark:text-blue-300 rounded-md text-xs font-semibold">
                  {sup.category}
                </span>
                {sup.contactPerson && <p className="text-xs text-slate-500 dark:text-slate-400">Contacto: <span className="font-medium text-slate-900 dark:text-white">{sup.contactPerson}</span></p>}
              </div>

              <div className="space-y-1.5 pt-3 border-t border-slate-200 dark:border-[#1e293b] text-xs text-slate-500 dark:text-slate-400">
                {sup.phone && <div className="flex items-center space-x-2"><Phone className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" /><span>{sup.phone}</span></div>}
                {sup.email && <div className="flex items-center space-x-2"><Mail className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" /><span className="truncate">{sup.email}</span></div>}
              </div>

              {sup.notes && <p className="text-xs text-slate-500 italic bg-slate-50 dark:bg-[#111827] p-2.5 rounded-xl border border-slate-100 dark:border-transparent">"{sup.notes}"</p>}
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Purchase Filters */}
          <div className="bg-white dark:bg-[#0d1322] border border-slate-200 dark:border-[#1e293b] p-4 rounded-2xl shadow-sm dark:shadow-none flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 transition-colors">
            <div className="relative w-full lg:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder="Buscar compra, proveedor o ID..."
                value={purchaseSearch}
                onChange={(e) => setPurchaseSearch(e.target.value)}
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
                  className="px-2.5 py-1.5 bg-slate-100 dark:bg-[#111827] text-slate-600 dark:text-slate-300 rounded-lg text-[11px] font-semibold"
                >
                  Limpiar
                </button>
              )}
            </div>

            <div className="flex items-center space-x-1.5">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Estado:</span>
              {(['all', 'Pagado', 'Pendiente'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setPurchaseStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    purchaseStatusFilter === st
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-[#111827] text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-[#1e293b]'
                  }`}
                >
                  {st === 'all' ? 'Todas' : st}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-[#0d1322] border border-slate-200 dark:border-[#1e293b] rounded-2xl shadow-sm dark:shadow-xl overflow-hidden transition-colors">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-[#111827] border-b border-slate-200 dark:border-[#1e293b] text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">
                    <th className="p-4">ID / Fecha</th>
                    <th className="p-4">Proveedor</th>
                    <th className="p-4">Descripción</th>
                    <th className="p-4 text-right">Monto</th>
                    <th className="p-4 text-center">Estado</th>
                    <th className="p-4 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-[#1e293b] text-xs">
                  {filteredPurchases.map((po) => (
                    <tr key={po.id} className="hover:bg-slate-50 dark:hover:bg-[#111827]/50 transition-colors">
                      <td className="p-4">
                        <span className="font-bold text-slate-900 dark:text-white">{po.id}</span>
                        <p className="text-[10px] text-slate-500">{po.date}</p>
                      </td>
                      <td className="p-4 font-semibold text-slate-800 dark:text-slate-200">{po.supplierName}</td>
                      <td className="p-4 text-slate-600 dark:text-slate-300 max-w-xs">{po.itemsDescription}</td>
                      <td className="p-4 text-right font-black text-slate-900 dark:text-white">{formatCOP(po.amount)}</td>
                      <td className="p-4 text-center">
                        <span className={`inline-flex px-2.5 py-1 rounded-md text-[10px] font-semibold ${
                          po.status === 'Pagado' 
                            ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400' 
                            : 'bg-amber-50 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400'
                        }`}>
                          {po.status}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center space-x-2">
                          <button onClick={() => handleOpenEditPurchase(po)} className="p-1.5 bg-slate-100 dark:bg-[#111827] text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-lg">
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button onClick={() => setDeletePurchaseTarget(po)} className="p-1.5 bg-rose-50 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500/30 rounded-lg" title="Eliminar Compra">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredPurchases.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-10 text-slate-500">
                        No se encontraron compras con los filtros seleccionados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Supplier Modal */}
      {isSupplierModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/70 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-[#0d1322] border border-slate-200 dark:border-[#1e293b] rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
            <div className="bg-slate-50 dark:bg-[#111827] text-slate-900 dark:text-white p-5 flex items-center justify-between border-b border-slate-200 dark:border-[#1e293b]">
              <h3 className="text-lg font-bold">{editingSupplier ? 'Editar Proveedor' : 'Nuevo Proveedor'}</h3>
              <button onClick={() => setIsSupplierModalOpen(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-white"><X className="w-6 h-6" /></button>
            </div>
            <form onSubmit={handleSupplierSubmit} className="p-6 space-y-4 text-xs">
              {supError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-500/15 border border-rose-200 dark:border-rose-500/30 rounded-xl flex items-center gap-2 text-rose-700 dark:text-rose-300 font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{supError}</span>
                </div>
              )}
              <div>
                <label className="block font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">Empresa / Proveedor *</label>
                <input type="text" value={supName} onChange={(e) => setSupName(e.target.value)} className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-[#1e293b] rounded-xl text-slate-900 dark:text-white font-medium" required />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">Categoría</label>
                  <input type="text" value={supCategory} onChange={(e) => setSupCategory(e.target.value)} className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-[#1e293b] rounded-xl text-slate-900 dark:text-white font-medium" />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">Contacto</label>
                  <input type="text" value={supContact} onChange={(e) => setSupContact(e.target.value)} className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-[#1e293b] rounded-xl text-slate-900 dark:text-white font-medium" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">Teléfono</label>
                  <input type="text" value={supPhone} onChange={(e) => setSupPhone(e.target.value)} className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-[#1e293b] rounded-xl text-slate-900 dark:text-white font-medium" />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">Email</label>
                  <input type="email" value={supEmail} onChange={(e) => setSupEmail(e.target.value)} className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-[#1e293b] rounded-xl text-slate-900 dark:text-white font-medium" />
                </div>
              </div>
              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200 dark:border-[#1e293b]">
                <button type="button" onClick={() => setIsSupplierModalOpen(false)} className="px-5 py-2.5 bg-slate-100 dark:bg-[#1e293b] text-slate-700 dark:text-slate-200 font-semibold rounded-xl">Cancelar</button>
                <button type="submit" disabled={isSubmitting} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold rounded-xl shadow-md">
                  {isSubmitting ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Purchase Modal */}
      {isPurchaseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/70 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-[#0d1322] border border-slate-200 dark:border-[#1e293b] rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
            <div className="bg-slate-50 dark:bg-[#111827] text-slate-900 dark:text-white p-5 flex items-center justify-between border-b border-slate-200 dark:border-[#1e293b]">
              <h3 className="text-lg font-bold">{editingPurchase ? 'Editar Orden de Compra' : 'Nueva Orden de Compra'}</h3>
              <button onClick={() => setIsPurchaseModalOpen(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-white"><X className="w-6 h-6" /></button>
            </div>
            <form onSubmit={handlePurchaseSubmit} className="p-6 space-y-4 text-xs">
              {poError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-500/15 border border-rose-200 dark:border-rose-500/30 rounded-xl flex items-center gap-2 text-rose-700 dark:text-rose-300 font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{poError}</span>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">Fecha</label>
                  <input type="date" value={poDate} onChange={(e) => setPoDate(e.target.value)} className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-[#1e293b] rounded-xl text-slate-900 dark:text-white font-medium" required />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">Proveedor</label>
                  <select value={selectedSupplierId} onChange={(e) => setSelectedSupplierId(e.target.value)} className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-[#1e293b] rounded-xl text-slate-900 dark:text-white font-medium">
                    <option value="">Proveedor General</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">Descripción de la Compra *</label>
                <input type="text" value={itemsDesc} onChange={(e) => setItemsDesc(e.target.value)} className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-[#1e293b] rounded-xl text-slate-900 dark:text-white font-medium" required />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">Monto Total ($) *</label>
                  <input type="number" min="1" step="1000" value={poAmount} onChange={(e) => setPoAmount(parseFloat(e.target.value) || 0)} className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-[#1e293b] rounded-xl font-bold text-slate-900 dark:text-white" required />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">Estado</label>
                  <select value={poStatus} onChange={(e) => setPoStatus(e.target.value as any)} className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-[#1e293b] rounded-xl text-slate-900 dark:text-white font-medium">
                    <option value="Pagado">Pagado</option>
                    <option value="Pendiente">Pendiente</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">Medio de Pago</label>
                <select
                  value={poPaymentMethod}
                  onChange={(e) => setPoPaymentMethod(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-[#1e293b] rounded-xl text-slate-900 dark:text-white font-medium"
                >
                  {Array.from(new Set([...configuredPaymentMethods, poPaymentMethod])).map((pm) => (
                    <option key={pm} value={pm}>{pm}</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200 dark:border-[#1e293b]">
                <button type="button" onClick={() => setIsPurchaseModalOpen(false)} className="px-5 py-2.5 bg-slate-100 dark:bg-[#1e293b] text-slate-700 dark:text-slate-200 font-semibold rounded-xl">Cancelar</button>
                <button type="submit" disabled={isSubmitting} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold rounded-xl shadow-md">
                  {isSubmitting ? 'Guardando...' : 'Guardar Compra'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Supplier Confirmation Modal */}
      {deleteSupplierTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/70 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-[#0d1322] border border-slate-200 dark:border-[#1e293b] rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden p-6 text-center space-y-4">
            <div className="w-12 h-12 bg-rose-50 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-full flex items-center justify-center mx-auto border border-rose-200 dark:border-rose-500/30">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">¿Eliminar Proveedor?</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Se eliminará el proveedor <span className="font-bold text-slate-900 dark:text-white">{deleteSupplierTarget.name}</span>. Las compras históricas asociadas conservarán su registro.
            </p>
            <div className="flex items-center justify-center space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteSupplierTarget(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-[#111827] text-slate-700 dark:text-slate-300 font-semibold rounded-xl text-xs"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  const id = deleteSupplierTarget.id;
                  setDeleteSupplierTarget(null);
                  await onDeleteSupplier(id);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-xl text-xs shadow-md"
              >
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Purchase Confirmation Modal */}
      {deletePurchaseTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/70 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-[#0d1322] border border-slate-200 dark:border-[#1e293b] rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden p-6 text-center space-y-4">
            <div className="w-12 h-12 bg-rose-50 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-full flex items-center justify-center mx-auto border border-rose-200 dark:border-rose-500/30">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">¿Eliminar Orden de Compra?</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Se eliminará la compra <span className="font-bold text-slate-900 dark:text-white">{deletePurchaseTarget.id}</span> ({deletePurchaseTarget.supplierName}) por{' '}
              <span className="font-bold text-rose-600 dark:text-rose-400">{formatCOP(deletePurchaseTarget.amount)}</span>.
            </p>
            <div className="flex items-center justify-center space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletePurchaseTarget(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-[#111827] text-slate-700 dark:text-slate-300 font-semibold rounded-xl text-xs"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  const id = deletePurchaseTarget.id;
                  setDeletePurchaseTarget(null);
                  await onDeletePurchase(id);
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
