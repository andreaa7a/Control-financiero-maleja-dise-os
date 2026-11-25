import React, { useState } from 'react';
import { AccountReceivable, Sale, BusinessSettings } from '../types/finance';
import { formatCOP } from '../utils/formatters';
import { exportReceivablesToExcel, exportReceivablesToPDF } from '../utils/exportUtils';
import { DollarSign, Clock, Phone, Search, Calendar, FileSpreadsheet, FileText } from 'lucide-react';

interface ReceivablesViewProps {
  sales: Sale[];
  receivables: AccountReceivable[];
  settings: BusinessSettings;
  onRecordPayment: (saleId: string) => void;
}

export const ReceivablesView: React.FC<ReceivablesViewProps> = ({
  sales,
  receivables,
  settings,
  onRecordPayment,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Pendiente' | 'Parcial'>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const filteredReceivables = receivables.filter((rec) => {
    const sale = sales.find((s) => s.id === rec.saleId);
    const saleDate = sale?.date || rec.dueDate;
    const matchesSearch =
      rec.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rec.saleId.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'Parcial' && rec.paidAmount > 0) ||
      (statusFilter === 'Pendiente' && rec.paidAmount === 0);
    const matchesFrom = !dateFrom || saleDate >= dateFrom;
    const matchesTo = !dateTo || saleDate <= dateTo;

    return matchesSearch && matchesStatus && matchesFrom && matchesTo;
  });

  const totalPendingSum = filteredReceivables.reduce((acc, r) => acc + r.pendingAmount, 0);

  const getAppliedFilters = () => {
    const filters: string[] = [];
    if (statusFilter !== 'all') {
      filters.push(`Estado: ${statusFilter === 'Parcial' ? 'Parcialmente Pagada (Con Abonos)' : 'Pendiente sin Abonos'}`);
    }
    if (searchTerm.trim()) filters.push(`Búsqueda: "${searchTerm.trim()}"`);
    return filters;
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-10">
      <div className="bg-white dark:bg-[#0d1322] border border-slate-200 dark:border-[#1e293b] rounded-2xl p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 shadow-sm dark:shadow-xl transition-colors">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Cuentas por Cobrar</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Gestión de saldos pendientes de clientes y abonos recibidos</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() =>
              exportReceivablesToExcel(filteredReceivables, sales, settings, {
                dateFrom,
                dateTo,
                appliedFilters: getAppliedFilters(),
              })
            }
            className="px-3.5 py-2.5 bg-slate-100 dark:bg-[#111827] hover:bg-slate-200 dark:hover:bg-[#1e293b] border border-slate-200 dark:border-[#1e293b] text-slate-800 dark:text-slate-200 font-semibold rounded-xl text-xs transition-all flex items-center gap-2 shadow-sm"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Exportar Excel</span>
          </button>
          <button
            type="button"
            onClick={() =>
              exportReceivablesToPDF(filteredReceivables, sales, settings, {
                dateFrom,
                dateTo,
                appliedFilters: getAppliedFilters(),
              })
            }
            className="px-3.5 py-2.5 bg-slate-100 dark:bg-[#111827] hover:bg-slate-200 dark:hover:bg-[#1e293b] border border-slate-200 dark:border-[#1e293b] text-slate-800 dark:text-slate-200 font-semibold rounded-xl text-xs transition-all flex items-center gap-2 shadow-sm"
          >
            <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>Descargar PDF</span>
          </button>

          <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 px-4 py-2.5 rounded-2xl flex items-center space-x-3">
            <div className="p-2 bg-amber-500 text-white rounded-xl">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] text-amber-700 dark:text-amber-300 font-semibold uppercase tracking-wider">Total por Cobrar</p>
              <p className="text-lg font-black text-amber-600 dark:text-amber-400">{formatCOP(totalPendingSum)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white dark:bg-[#0d1322] border border-slate-200 dark:border-[#1e293b] p-4 rounded-2xl shadow-sm dark:shadow-none flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 transition-colors">
        <div className="relative w-full lg:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Buscar cliente o Nº venta..."
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
              className="px-2.5 py-1.5 bg-slate-100 dark:bg-[#111827] text-slate-600 dark:text-slate-300 rounded-lg text-[11px] font-semibold"
            >
              Limpiar
            </button>
          )}
        </div>

        <div className="flex items-center space-x-1.5">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Estado:</span>
          {[
            { id: 'all', label: 'Todas' },
            { id: 'Parcial', label: 'Con Abonos' },
            { id: 'Pendiente', label: 'Sin Abonos' },
          ].map((st) => (
            <button
              key={st.id}
              onClick={() => setStatusFilter(st.id as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === st.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-[#111827] text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-[#1e293b]'
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-[#0d1322] border border-slate-200 dark:border-[#1e293b] rounded-2xl shadow-sm dark:shadow-xl overflow-hidden transition-colors">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-[#111827] border-b border-slate-200 dark:border-[#1e293b] text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">
                <th className="p-4">Ref. Venta / Fecha</th>
                <th className="p-4">Cliente</th>
                <th className="p-4 text-right">Total Venta</th>
                <th className="p-4 text-right">Abonado</th>
                <th className="p-4 text-right">Saldo Pendiente</th>
                <th className="p-4 text-center">Estado</th>
                <th className="p-4 text-center">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-[#1e293b] text-xs">
              {filteredReceivables.map((rec) => {
                const sale = sales.find(s => s.id === rec.saleId);
                return (
                  <tr key={rec.id} className="hover:bg-slate-50 dark:hover:bg-[#111827]/50 transition-colors">
                    <td className="p-4">
                      <span className="font-bold text-slate-900 dark:text-white">{rec.saleId}</span>
                      <p className="text-[10px] text-slate-500">{sale?.date || rec.dueDate}</p>
                    </td>
                    <td className="p-4">
                      <p className="font-semibold text-slate-800 dark:text-slate-200">{rec.clientName}</p>
                      {sale?.clientPhone && (
                        <p className="text-[10px] text-slate-500 flex items-center space-x-1 mt-0.5">
                          <Phone className="w-3 h-3" />
                          <span>{sale.clientPhone}</span>
                        </p>
                      )}
                    </td>
                    <td className="p-4 text-right font-medium text-slate-600 dark:text-slate-300">{formatCOP(rec.totalAmount)}</td>
                    <td className="p-4 text-right font-bold text-emerald-600 dark:text-emerald-400">{formatCOP(rec.paidAmount)}</td>
                    <td className="p-4 text-right font-black text-rose-600 dark:text-rose-400">{formatCOP(rec.pendingAmount)}</td>
                    <td className="p-4 text-center">
                      <span className="inline-flex px-2.5 py-1 rounded-md text-[10px] font-semibold bg-amber-50 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30">
                        {rec.paidAmount > 0 ? 'Abono Parcial' : 'Pendiente'}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <button
                        onClick={() => onRecordPayment(rec.saleId)}
                        className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-semibold rounded-xl shadow-md transition-all flex items-center justify-center space-x-1.5 mx-auto"
                      >
                        <DollarSign className="w-4 h-4" />
                        <span>Registrar Pago</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filteredReceivables.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-slate-500">
                    No hay cuentas por cobrar pendientes con los filtros seleccionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
