import React, { useState } from 'react';
import { Sale, Expense, ProductionCost, PurchaseOrder, PaymentMethod, AuditLog } from '../types/finance';
import { formatCOP } from '../utils/formatters';
import { Search, Eye, Trash2, X, AlertCircle, ArrowUpRight, ArrowDownLeft, ShieldCheck } from 'lucide-react';

interface HistoryViewProps {
  sales: Sale[];
  expenses: Expense[];
  productionCosts: ProductionCost[];
  purchaseOrders: PurchaseOrder[];
  auditLogs?: AuditLog[];
  onUpdateSale?: (sale: Sale) => void;
  onDeleteSale?: (id: string) => void;
  onUpdateExpense?: (expense: Expense) => void;
  onDeleteExpense?: (id: string) => void;
  onDeleteProductionCost?: (id: string) => void;
  onDeletePurchase?: (id: string) => void;
}

export type MovementType = 'Venta' | 'Gasto Fijo' | 'Gasto Variable' | 'Gasto Extraordinario' | 'Costo Producción' | 'Compra Proveedor';

interface UnifiedMovement {
  id: string;
  originalId: string;
  date: string;
  type: MovementType;
  title: string;
  category: string;
  amount: number;
  paymentMethod: PaymentMethod | string;
  status: string;
  isIncome: boolean;
  raw: Sale | Expense | ProductionCost | PurchaseOrder;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  sales,
  expenses,
  productionCosts,
  purchaseOrders,
  auditLogs = [],
  onDeleteSale,
  onDeleteExpense,
  onDeleteProductionCost,
  onDeletePurchase,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'movements' | 'audit'>('movements');
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [methodFilter, setMethodFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const [selectedMovement, setSelectedMovement] = useState<UnifiedMovement | null>(null);
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<UnifiedMovement | null>(null);

  const movements: UnifiedMovement[] = [
    ...sales.map(s => ({
      id: `sale-${s.id}`,
      originalId: s.id,
      date: s.date,
      type: 'Venta' as MovementType,
      title: `Venta #${s.id} - ${s.clientName}`,
      category: s.items[0]?.category || 'Diseño gráfico',
      amount: s.total,
      paymentMethod: s.paymentMethod,
      status: s.paymentStatus,
      isIncome: true,
      raw: s,
    })),
    ...expenses.map(e => ({
      id: `exp-${e.id}`,
      originalId: e.id,
      date: e.date,
      type: (e.type === 'Fijo' ? 'Gasto Fijo' : e.type === 'Variable' ? 'Gasto Variable' : 'Gasto Extraordinario') as MovementType,
      title: e.description,
      category: e.category,
      amount: e.amount,
      paymentMethod: e.paymentMethod,
      status: e.status,
      isIncome: false,
      raw: e,
    })),
    ...productionCosts.map(pc => ({
      id: `pc-${pc.id}`,
      originalId: pc.id,
      date: pc.date,
      type: 'Costo Producción' as MovementType,
      title: `Producción: ${pc.productName} (${pc.clientName})`,
      category: pc.productName,
      amount: pc.totalCost,
      paymentMethod: 'N/A',
      status: 'Registrado',
      isIncome: false,
      raw: pc,
    })),
    ...purchaseOrders.map(po => ({
      id: `po-${po.id}`,
      originalId: po.id,
      date: po.date,
      type: 'Compra Proveedor' as MovementType,
      title: `Compra a ${po.supplierName}: ${po.itemsDescription}`,
      category: 'Insumos / Proveedores',
      amount: po.amount,
      paymentMethod: po.paymentMethod,
      status: po.status,
      isIncome: false,
      raw: po,
    })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  const allCategories = Array.from(new Set(movements.map(m => m.category)));
  const allMethods = Array.from(new Set(movements.map(m => m.paymentMethod)));

  const filtered = movements.filter(m => {
    const matchesSearch = m.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          m.originalId.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          m.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === 'all' || m.type === typeFilter;
    const matchesMethod = methodFilter === 'all' || m.paymentMethod === methodFilter;
    const matchesCategory = categoryFilter === 'all' || m.category === categoryFilter;
    return matchesSearch && matchesType && matchesMethod && matchesCategory;
  });

  const handleConfirmDelete = async () => {
    if (!deleteConfirmTarget) return;
    const { type, originalId } = deleteConfirmTarget;
    setDeleteConfirmTarget(null);

    try {
      if (type === 'Venta' && onDeleteSale) {
        await onDeleteSale(originalId);
      } else if ((type === 'Gasto Fijo' || type === 'Gasto Variable' || type === 'Gasto Extraordinario') && onDeleteExpense) {
        await onDeleteExpense(originalId);
      } else if (type === 'Costo Producción' && onDeleteProductionCost) {
        await onDeleteProductionCost(originalId);
      } else if (type === 'Compra Proveedor' && onDeletePurchase) {
        await onDeletePurchase(originalId);
      }
    } catch (err) {
      console.error('Error deleting movement from HistoryView:', err);
    }
  };

  const getBadgeStyle = (type: MovementType) => {
    switch (type) {
      case 'Venta':
        return 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30';
      case 'Gasto Fijo':
        return 'bg-blue-50 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/30';
      case 'Gasto Variable':
        return 'bg-amber-50 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/30';
      case 'Gasto Extraordinario':
        return 'bg-purple-50 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-500/30';
      case 'Costo Producción':
        return 'bg-rose-50 dark:bg-rose-500/20 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-500/30';
      case 'Compra Proveedor':
        return 'bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/30';
      default:
        return 'bg-slate-100 dark:bg-slate-500/20 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-500/30';
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Header */}
      <div className="bg-white dark:bg-[#0d1322] border border-slate-200 dark:border-[#1e293b] rounded-2xl p-6 shadow-sm dark:shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-colors">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>Historial y Auditoría de Operaciones</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Registro cronológico unificado y bitácora de auditoría de Maleja Diseños
          </p>
        </div>
        <div className="flex items-center gap-2 bg-slate-50 dark:bg-[#111827] px-4 py-2 rounded-xl border border-slate-200 dark:border-[#1e293b] text-xs">
          <span className="text-slate-500 dark:text-slate-400">Total movimientos:</span>
          <span className="font-bold text-slate-900 dark:text-white">{movements.length}</span>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex space-x-2 border-b border-slate-200 dark:border-[#1e293b] pb-2">
        <button
          onClick={() => setActiveSubTab('movements')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeSubTab === 'movements' 
              ? 'bg-blue-600 text-white shadow-md' 
              : 'bg-white dark:bg-[#0d1322] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-[#1e293b] hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          Movimientos Financieros ({movements.length})
        </button>
        <button
          onClick={() => setActiveSubTab('audit')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
            activeSubTab === 'audit' 
              ? 'bg-blue-600 text-white shadow-md' 
              : 'bg-white dark:bg-[#0d1322] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-[#1e293b] hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Registro de Auditoría ({auditLogs.length})</span>
        </button>
      </div>

      {activeSubTab === 'movements' ? (
        <>
          {/* Filters Bar */}
          <div className="bg-white dark:bg-[#0d1322] border border-slate-200 dark:border-[#1e293b] p-4 rounded-2xl shadow-sm dark:shadow-lg space-y-4 transition-colors">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  placeholder="Buscar por descripción, ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-[#1e293b] rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-[#1e293b] rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="all">Todos los tipos</option>
                  <option value="Venta">Ventas</option>
                  <option value="Gasto Fijo">Gastos Fijos</option>
                  <option value="Gasto Variable">Gastos Variables</option>
                  <option value="Gasto Extraordinario">Gastos Extraordinarios</option>
                  <option value="Costo Producción">Costos de Producción</option>
                  <option value="Compra Proveedor">Compras Proveedores</option>
                </select>
              </div>

              <div>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-[#1e293b] rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="all">Todas las categorías</option>
                  {allCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <select
                  value={methodFilter}
                  onChange={(e) => setMethodFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-[#1e293b] rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="all">Todos los medios de pago</option>
                  {allMethods.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Movements Table */}
          <div className="bg-white dark:bg-[#0d1322] border border-slate-200 dark:border-[#1e293b] rounded-2xl shadow-sm dark:shadow-xl overflow-hidden transition-colors">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-[#111827] border-b border-slate-200 dark:border-[#1e293b] text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    <th className="p-4">Fecha / ID</th>
                    <th className="p-4">Tipo</th>
                    <th className="p-4">Descripción / Categoría</th>
                    <th className="p-4">Medio Pago</th>
                    <th className="p-4">Estado</th>
                    <th className="p-4 text-right">Valor</th>
                    <th className="p-4 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-[#1e293b] text-xs">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-500">
                        No se encontraron movimientos con los filtros seleccionados.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-[#111827]/50 transition-colors group">
                        <td className="p-4 whitespace-nowrap">
                          <div className="font-bold text-slate-900 dark:text-white">{item.date}</div>
                          <div className="text-[10px] text-slate-500 font-mono">{item.originalId}</div>
                        </td>
                        <td className="p-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-semibold border ${getBadgeStyle(item.type)}`}>
                            {item.type}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="font-semibold text-slate-800 dark:text-slate-200 max-w-xs truncate">{item.title}</div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400">{item.category}</div>
                        </td>
                        <td className="p-4 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          {item.paymentMethod}
                        </td>
                        <td className="p-4 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ${
                            item.status === 'Pagado' ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' :
                            item.status === 'Parcial' ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400' :
                            'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400'
                          }`}>
                            {item.status}
                          </span>
                        </td>
                        <td className={`p-4 text-right font-black whitespace-nowrap ${item.isIncome ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-800 dark:text-slate-200'}`}>
                          <div className="flex items-center justify-end gap-1">
                            {item.isIncome ? (
                              <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            ) : (
                              <ArrowUpRight className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                            )}
                            <span>{item.isIncome ? `+ ${formatCOP(item.amount)}` : `- ${formatCOP(item.amount)}`}</span>
                          </div>
                        </td>
                        <td className="p-4 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => setSelectedMovement(item)}
                              className="p-1.5 bg-slate-100 dark:bg-[#111827] hover:bg-blue-50 dark:hover:bg-blue-600/20 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg transition-colors"
                              title="Ver Detalle"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setDeleteConfirmTarget(item)}
                              className="p-1.5 bg-slate-100 dark:bg-[#111827] hover:bg-rose-50 dark:hover:bg-rose-600/20 text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg transition-colors"
                              title="Eliminar Movimiento"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        /* Audit Log View */
        <div className="bg-white dark:bg-[#0d1322] border border-slate-200 dark:border-[#1e293b] rounded-2xl shadow-sm dark:shadow-xl overflow-hidden transition-colors">
          <div className="p-4 bg-slate-50 dark:bg-[#111827] border-b border-slate-200 dark:border-[#1e293b] flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">Bitácora de Eventos y Auditoría del Sistema</span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400">Total registros: {auditLogs.length}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-[#0f172a] border-b border-slate-200 dark:border-[#1e293b] text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">
                  <th className="p-4">Marca Temporal</th>
                  <th className="p-4">Módulo</th>
                  <th className="p-4">Acción</th>
                  <th className="p-4">Detalle / Descripción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-[#1e293b] text-xs">
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-slate-500">
                      No hay registros de auditoría aún.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-[#111827]/50 transition-colors">
                      <td className="p-4 font-mono text-slate-500 dark:text-slate-400 text-[11px]">{log.timestamp}</td>
                      <td className="p-4 font-bold text-slate-900 dark:text-white">{log.module}</td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          log.action === 'CREACIÓN' ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400' :
                          log.action === 'MODIFICACIÓN' ? 'bg-blue-50 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400' :
                          'bg-rose-50 dark:bg-rose-500/20 text-rose-700 dark:text-rose-400'
                        }`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="p-4 text-slate-600 dark:text-slate-300">{log.description}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedMovement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/70 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-[#0d1322] border border-slate-200 dark:border-[#1e293b] rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="bg-slate-50 dark:bg-[#111827] border-b border-slate-200 dark:border-[#1e293b] p-5 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className={`px-2.5 py-1 rounded-md text-xs font-bold border ${getBadgeStyle(selectedMovement.type)}`}>
                  {selectedMovement.type}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">ID: {selectedMovement.originalId}</span>
              </div>
              <button onClick={() => setSelectedMovement(null)} className="text-slate-400 hover:text-slate-700 dark:hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4 text-xs">
              <div>
                <span className="text-slate-500 dark:text-slate-400 block uppercase font-bold text-[10px] mb-1">Título / Descripción</span>
                <p className="text-slate-900 dark:text-white font-semibold text-sm">{selectedMovement.title}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 dark:bg-[#111827] p-3 rounded-xl border border-slate-200 dark:border-[#1e293b]">
                  <span className="text-slate-500 dark:text-slate-400 block uppercase font-bold text-[10px] mb-1">Fecha</span>
                  <p className="text-slate-900 dark:text-white font-medium">{selectedMovement.date}</p>
                </div>
                <div className="bg-slate-50 dark:bg-[#111827] p-3 rounded-xl border border-slate-200 dark:border-[#1e293b]">
                  <span className="text-slate-500 dark:text-slate-400 block uppercase font-bold text-[10px] mb-1">Valor Total</span>
                  <p className={`font-black text-sm ${selectedMovement.isIncome ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'}`}>
                    {formatCOP(selectedMovement.amount)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 dark:bg-[#111827] p-3 rounded-xl border border-slate-200 dark:border-[#1e293b]">
                  <span className="text-slate-500 dark:text-slate-400 block uppercase font-bold text-[10px] mb-1">Medio de Pago</span>
                  <p className="text-slate-900 dark:text-white font-medium">{selectedMovement.paymentMethod}</p>
                </div>
                <div className="bg-slate-50 dark:bg-[#111827] p-3 rounded-xl border border-slate-200 dark:border-[#1e293b]">
                  <span className="text-slate-500 dark:text-slate-400 block uppercase font-bold text-[10px] mb-1">Estado</span>
                  <p className="text-slate-900 dark:text-white font-medium">{selectedMovement.status}</p>
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-[#111827] p-3 rounded-xl border border-slate-200 dark:border-[#1e293b]">
                <span className="text-slate-500 dark:text-slate-400 block uppercase font-bold text-[10px] mb-1">Categoría</span>
                <p className="text-slate-900 dark:text-white font-medium">{selectedMovement.category}</p>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-[#111827] border-t border-slate-200 dark:border-[#1e293b] p-4 flex justify-end">
              <button
                onClick={() => setSelectedMovement(null)}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl text-xs transition-colors"
              >
                Cerrar Detalle
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/70 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-[#0d1322] border border-slate-200 dark:border-[#1e293b] rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden p-6 text-center space-y-4">
            <div className="w-12 h-12 bg-rose-50 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-full flex items-center justify-center mx-auto border border-rose-200 dark:border-rose-500/30">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">¿Confirmar Eliminación?</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Estás a punto de eliminar el registro <span className="text-slate-900 dark:text-white font-semibold">{deleteConfirmTarget.title}</span> ({formatCOP(deleteConfirmTarget.amount)}). Esta acción actualizará los totales y no se puede deshacer.
            </p>
            <div className="flex items-center justify-center space-x-3 pt-2">
              <button
                onClick={() => setDeleteConfirmTarget(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-[#111827] hover:bg-slate-200 dark:hover:bg-[#1e293b] text-slate-700 dark:text-slate-300 font-semibold rounded-xl text-xs"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDelete}
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
