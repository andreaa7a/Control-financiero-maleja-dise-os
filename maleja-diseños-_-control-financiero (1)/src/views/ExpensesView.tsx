import React, { useState } from 'react';
import { Expense, ExpenseType, PaymentMethod, Supplier, BusinessSettings } from '../types/finance';
import { formatCOP, getTodayString } from '../utils/formatters';
import { exportExpensesToExcel, exportExpensesToPDF } from '../utils/exportUtils';
import {
  generateUniqueId,
  validateExpenseInput,
  isDuplicateExpenseSignature,
} from '../utils/validation';
import { 
  Receipt, 
  Plus, 
  Search, 
  Trash2, 
  Edit3, 
  X, 
  Clock,
  FileSpreadsheet,
  FileText,
  Calendar,
  AlertCircle,
} from 'lucide-react';

interface ExpensesViewProps {
  expenses: Expense[];
  suppliers: Supplier[];
  settings: BusinessSettings;
  onAddExpense: (expense: Expense) => Promise<void> | void;
  onUpdateExpense: (expense: Expense) => Promise<void> | void;
  onDeleteExpense: (id: string) => Promise<void> | void;
  onAddSupplier: (supplier: Supplier) => void;
}

const defaultCategoriesByType: Record<ExpenseType, string[]> = {
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

export const ExpensesView: React.FC<ExpensesViewProps> = ({
  expenses,
  suppliers,
  settings,
  onAddExpense,
  onUpdateExpense,
  onDeleteExpense,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [customCategories, setCustomCategories] = useState<Record<ExpenseType, string[]>>({
    Fijo: [],
    Variable: [],
    Extraordinario: [],
  });
  const [newCategoryInput, setNewCategoryInput] = useState('');
  const [showNewCatInput, setShowNewCatInput] = useState(false);

  const baseCategoriesByType: Record<ExpenseType, string[]> = {
    Fijo: settings.expenseCategories?.Fijo?.length
      ? settings.expenseCategories.Fijo
      : defaultCategoriesByType.Fijo,
    Variable: settings.expenseCategories?.Variable?.length
      ? settings.expenseCategories.Variable
      : defaultCategoriesByType.Variable,
    Extraordinario: settings.expenseCategories?.Extraordinario?.length
      ? settings.expenseCategories.Extraordinario
      : defaultCategoriesByType.Extraordinario,
  };
  const configuredPaymentMethods = settings.paymentMethods?.length
    ? settings.paymentMethods
    : ['Transferencia Bancaria', 'Efectivo', 'Nequi / DaviPlata', 'Tarjeta', 'Crédito'];

  // Form state
  const [date, setDate] = useState(getTodayString());
  const [type, setType] = useState<ExpenseType>('Variable');
  const [category, setCategory] = useState(baseCategoriesByType['Variable'][0]);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    configuredPaymentMethods[0] || 'Transferencia Bancaria'
  );
  const [supplier, setSupplier] = useState('');
  const [status, setStatus] = useState<'Pagado' | 'Pendiente'>('Pagado');
  const [isRecurring, setIsRecurring] = useState(false);
  const [receiptNumber, setReceiptNumber] = useState('');
  const [notes, setNotes] = useState('');

  const handleOpenNew = () => {
    setEditingExpense(null);
    setFormError(null);
    setIsSubmitting(false);
    setDate(getTodayString());
    setType('Variable');
    setCategory(baseCategoriesByType['Variable'][0]);
    setDescription('');
    setAmount(0);
    setPaymentMethod(configuredPaymentMethods[0] || 'Transferencia Bancaria');
    setSupplier('');
    setStatus('Pagado');
    setIsRecurring(false);
    setReceiptNumber('');
    setNotes('');
    setShowNewCatInput(false);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (exp: Expense) => {
    setEditingExpense(exp);
    setFormError(null);
    setIsSubmitting(false);
    setDate(exp.date);
    setType(exp.type);
    setCategory(exp.category);
    setDescription(exp.description);
    setAmount(exp.amount);
    setPaymentMethod(exp.paymentMethod);
    setSupplier(exp.supplier || '');
    setStatus(exp.status || 'Pagado');
    setIsRecurring(exp.isRecurring || false);
    setReceiptNumber(exp.receiptNumber || '');
    setNotes(exp.notes || '');
    setShowNewCatInput(false);
    setIsModalOpen(true);
  };

  const handleTypeChange = (newType: ExpenseType) => {
    setType(newType);
    const available = Array.from(
      new Set([...baseCategoriesByType[newType], ...(customCategories[newType] || [])])
    );
    setCategory(available[0] || 'Otros');
  };

  const handleAddCustomCategory = () => {
    if (!newCategoryInput.trim()) return;
    const trimmed = newCategoryInput.trim();
    setCustomCategories({
      ...customCategories,
      [type]: [...(customCategories[type] || []), trimmed],
    });
    setCategory(trimmed);
    setNewCategoryInput('');
    setShowNewCatInput(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setFormError(null);

    const validation = validateExpenseInput({
      date,
      category,
      description,
      amount,
    });

    if (!validation.valid) {
      setFormError(validation.error || 'Por favor verifique los datos del gasto.');
      return;
    }

    if (!editingExpense && isDuplicateExpenseSignature(expenses, { date, description, amount, type })) {
      setFormError('Ya existe un gasto idéntico registrado para la misma fecha, tipo y monto.');
      return;
    }

    if (editingExpense && !expenses.some((ex) => ex.id === editingExpense.id)) {
      setFormError('Este gasto ya no existe en el sistema.');
      return;
    }

    const nextExpenseId = generateUniqueId(
      `EXP-${new Date().getFullYear()}-`,
      expenses.map((ex) => ex.id)
    );

    const expenseData: Expense = {
      id: editingExpense ? editingExpense.id : nextExpenseId,
      date,
      category: category.trim().slice(0, 100),
      type,
      description: description.trim().slice(0, 200),
      amount,
      paymentMethod,
      supplier: supplier.trim().slice(0, 100) || undefined,
      status,
      isRecurring,
      receiptNumber: receiptNumber.trim().slice(0, 50) || undefined,
      notes: notes.trim().slice(0, 300) || undefined,
    };

    setIsSubmitting(true);
    try {
      if (editingExpense) {
        await onUpdateExpense(expenseData);
      } else {
        await onAddExpense(expenseData);
      }
      setIsModalOpen(false);
    } catch (err: any) {
      setFormError(err?.message || 'Error de conexión al guardar el gasto en la base de datos.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredExpenses = expenses.filter(exp => {
    const matchesSearch = 
      exp.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      exp.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (exp.supplier && exp.supplier.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesType = typeFilter === 'all' || exp.type === typeFilter;
    const matchesStatus = statusFilter === 'all' || exp.status === statusFilter;
    const matchesFrom = !dateFrom || exp.date >= dateFrom;
    const matchesTo = !dateTo || exp.date <= dateTo;
    return matchesSearch && matchesType && matchesStatus && matchesFrom && matchesTo;
  });

  const getAppliedFilters = () => {
    const filters: string[] = [];
    if (typeFilter !== 'all') filters.push(`Tipo: ${typeFilter}`);
    if (statusFilter !== 'all') filters.push(`Estado: ${statusFilter}`);
    if (searchTerm.trim()) filters.push(`Búsqueda: "${searchTerm.trim()}"`);
    return filters;
  };

  const totalFiltered = filteredExpenses
    .filter(e => e.status === 'Pagado')
    .reduce((acc, e) => acc + e.amount, 0);

  const totalPending = filteredExpenses
    .filter(e => e.status === 'Pendiente')
    .reduce((acc, e) => acc + e.amount, 0);

  const availableCategories = Array.from(
    new Set([
      ...baseCategoriesByType[type],
      ...(customCategories[type] || []),
      ...(category ? [category] : []),
    ])
  );

  return (
    <div className="space-y-6 animate-fadeIn pb-10">
      {/* Header */}
      <div className="bg-white dark:bg-[#0d1322] border border-slate-200 dark:border-[#1e293b] rounded-2xl p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 shadow-sm dark:shadow-xl transition-colors">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">Módulo: Registrar Gasto</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Control de gastos fijos, variables y extraordinarios de Maleja Diseños</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => exportExpensesToExcel(filteredExpenses, settings, { dateFrom, dateTo, appliedFilters: getAppliedFilters() })}
            className="px-3.5 py-2.5 bg-slate-100 dark:bg-[#111827] hover:bg-slate-200 dark:hover:bg-[#1e293b] border border-slate-200 dark:border-[#1e293b] text-slate-800 dark:text-slate-200 font-semibold rounded-xl text-xs transition-all flex items-center gap-2 shadow-sm"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Exportar Excel</span>
          </button>
          <button
            type="button"
            onClick={() => exportExpensesToPDF(filteredExpenses, settings, { dateFrom, dateTo, appliedFilters: getAppliedFilters() })}
            className="px-3.5 py-2.5 bg-slate-100 dark:bg-[#111827] hover:bg-slate-200 dark:hover:bg-[#1e293b] border border-slate-200 dark:border-[#1e293b] text-slate-800 dark:text-slate-200 font-semibold rounded-xl text-xs transition-all flex items-center gap-2 shadow-sm"
          >
            <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>Descargar PDF</span>
          </button>
          <button
            onClick={handleOpenNew}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl shadow-md dark:shadow-lg dark:shadow-blue-950 transition-all flex items-center justify-center space-x-2 text-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Registrar Gasto</span>
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
              placeholder="Buscar por descripción, categoría o proveedor..."
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
        </div>

        <div className="flex flex-wrap items-center gap-3 justify-between">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Tipo:</span>
            {['all', 'Fijo', 'Variable', 'Extraordinario'].map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  typeFilter === t ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 dark:bg-[#111827] text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-[#1e293b]'
                }`}
              >
                {t === 'all' ? 'Todos' : t}
              </button>
            ))}
          </div>

          <div className="flex items-center space-x-1.5">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Estado:</span>
            {['all', 'Pagado', 'Pendiente'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  statusFilter === st ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 dark:bg-[#111827] text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-[#1e293b]'
                }`}
              >
                {st === 'all' ? 'Todos' : st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Totals Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-[#0d1322] border border-slate-200 dark:border-[#1e293b] p-5 rounded-2xl shadow-sm dark:shadow-none flex items-center justify-between transition-colors">
          <div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Total Pagado (Efectivo / Salida)</p>
            <p className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">{formatCOP(totalFiltered)}</p>
          </div>
          <div className="p-3 bg-rose-50 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-xl"><Receipt className="w-6 h-6" /></div>
        </div>
        <div className="bg-white dark:bg-[#0d1322] border border-slate-200 dark:border-[#1e293b] p-5 rounded-2xl shadow-sm dark:shadow-none flex items-center justify-between transition-colors">
          <div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Total Pendiente de Pago</p>
            <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">{formatCOP(totalPending)}</p>
          </div>
          <div className="p-3 bg-amber-50 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-xl"><Clock className="w-6 h-6" /></div>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="bg-white dark:bg-[#0d1322] border border-slate-200 dark:border-[#1e293b] rounded-2xl shadow-sm dark:shadow-xl overflow-hidden transition-colors">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-[#111827] border-b border-slate-200 dark:border-[#1e293b] text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">
                <th className="p-4">Fecha / ID</th>
                <th className="p-4">Tipo / Categoría</th>
                <th className="p-4">Descripción</th>
                <th className="p-4">Proveedor</th>
                <th className="p-4 text-right">Valor</th>
                <th className="p-4 text-center">Estado</th>
                <th className="p-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-[#1e293b] text-xs">
              {filteredExpenses.map((exp) => (
                <tr key={exp.id} className="hover:bg-slate-50 dark:hover:bg-[#111827]/50 transition-colors">
                  <td className="p-4">
                    <span className="font-bold text-slate-900 dark:text-white">{exp.date}</span>
                    <p className="text-[10px] text-slate-500">{exp.id}</p>
                  </td>
                  <td className="p-4">
                    <span className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-bold ${
                      exp.type === 'Fijo' ? 'bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/30' :
                      exp.type === 'Variable' ? 'bg-blue-50 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30' :
                      'bg-purple-50 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-500/30'
                    }`}>
                      {exp.type}
                    </span>
                    <p className="font-semibold text-slate-800 dark:text-slate-200 mt-1">{exp.category}</p>
                  </td>
                  <td className="p-4 text-slate-600 dark:text-slate-300 max-w-xs">
                    <p>{exp.description}</p>
                    {exp.isRecurring && <span className="text-[10px] text-blue-600 dark:text-blue-400 italic">Recurrente mensual</span>}
                  </td>
                  <td className="p-4 text-slate-500 dark:text-slate-400">{exp.supplier || 'N/A'}</td>
                  <td className="p-4 text-right font-black text-rose-600 dark:text-rose-400">{formatCOP(exp.amount)}</td>
                  <td className="p-4 text-center">
                    <span className={`inline-flex px-2.5 py-1 rounded-md text-[10px] font-semibold ${
                      exp.status === 'Pagado'
                        ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30'
                        : 'bg-amber-50 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30'
                    }`}>
                      {exp.status}
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    <div className="flex items-center justify-center space-x-2">
                      <button onClick={() => handleOpenEdit(exp)} className="p-1.5 bg-slate-100 dark:bg-[#111827] text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-lg">
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button onClick={() => setDeleteTarget(exp)} className="p-1.5 bg-rose-50 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500/30 rounded-lg" title="Eliminar Gasto">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredExpenses.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-slate-500">
                    No se encontraron gastos registrados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Registrar / Editar Gasto */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/70 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-[#0d1322] border border-slate-200 dark:border-[#1e293b] rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-slate-50 dark:bg-[#111827] text-slate-900 dark:text-white p-5 flex items-center justify-between border-b border-slate-200 dark:border-[#1e293b]">
              <h3 className="text-lg font-bold">
                {editingExpense ? 'Editar Gasto' : 'Registrar Gasto (Fijo, Variable o Extraordinario)'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 flex-1 text-xs">
              {formError && (
                <div className="p-3.5 bg-rose-50 dark:bg-rose-500/15 border border-rose-200 dark:border-rose-500/30 rounded-xl flex items-center gap-2.5 text-rose-700 dark:text-rose-300 font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                  <span>{formError}</span>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">Fecha del Gasto *</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-[#1e293b] rounded-xl text-slate-900 dark:text-white font-medium"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">Tipo de Gasto *</label>
                  <select
                    value={type}
                    onChange={(e) => handleTypeChange(e.target.value as ExpenseType)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-[#1e293b] rounded-xl text-slate-900 dark:text-white font-medium"
                  >
                    <option value="Fijo">Fijo (Arriendo, Servicios, Nómina...)</option>
                    <option value="Variable">Variable (Vinilos, Tintas, Papel...)</option>
                    <option value="Extraordinario">Extraordinario (Reparaciones, Equipos...)</option>
                  </select>
                </div>
              </div>

              {/* Category selection & Custom creation */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-slate-600 dark:text-slate-400 uppercase">Categoría *</label>
                  <button
                    type="button"
                    onClick={() => setShowNewCatInput(!showNewCatInput)}
                    className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline font-medium"
                  >
                    {showNewCatInput ? 'Cancelar' : '+ Nueva categoría'}
                  </button>
                </div>

                {showNewCatInput ? (
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      placeholder="Nombre de la nueva categoría..."
                      value={newCategoryInput}
                      onChange={(e) => setNewCategoryInput(e.target.value)}
                      className="flex-1 px-3.5 py-2 bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-[#1e293b] rounded-xl text-slate-900 dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={handleAddCustomCategory}
                      className="px-4 py-2 bg-blue-600 text-white font-bold rounded-xl"
                    >
                      Añadir
                    </button>
                  </div>
                ) : (
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-[#1e293b] rounded-xl text-slate-900 dark:text-white font-medium"
                  >
                    {availableCategories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">Nombre o Descripción *</label>
                <input
                  type="text"
                  placeholder="Ej. Compra de rollo vinilo adhesivo Orafol"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-[#1e293b] rounded-xl text-slate-900 dark:text-white font-medium"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">Valor en COP ($) *</label>
                  <input
                    type="number"
                    min="1"
                    step="1000"
                    value={amount}
                    onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-[#1e293b] rounded-xl font-bold text-rose-600 dark:text-rose-400"
                    required
                  />
                </div>
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
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">Proveedor Opcional</label>
                  <select
                    value={supplier}
                    onChange={(e) => setSupplier(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-[#1e293b] rounded-xl text-slate-900 dark:text-white font-medium"
                  >
                    <option value="">-- Sin proveedor específico --</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.name}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">Estado del Gasto</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-[#1e293b] rounded-xl text-slate-900 dark:text-white font-medium"
                  >
                    <option value="Pagado">Pagado (Descuenta caja)</option>
                    <option value="Pendiente">Pendiente (No descuenta caja aún)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center space-x-3 pt-2">
                <input
                  type="checkbox"
                  id="recurringCheck"
                  checked={isRecurring}
                  onChange={(e) => setIsRecurring(e.target.checked)}
                  className="w-4 h-4 rounded bg-slate-50 dark:bg-[#0f172a] border border-slate-300 dark:border-[#1e293b] text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="recurringCheck" className="text-slate-700 dark:text-slate-200 font-medium cursor-pointer">
                  Marcar como gasto recurrente (mensual)
                </label>
              </div>

              <div>
                <label className="block font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">Observaciones</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-[#1e293b] rounded-xl text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200 dark:border-[#1e293b]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 bg-slate-100 dark:bg-[#1e293b] hover:bg-slate-200 dark:hover:bg-[#334155] text-slate-700 dark:text-slate-200 font-semibold rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold rounded-xl shadow-md"
                >
                  {isSubmitting ? 'Guardando...' : 'Guardar Gasto'}
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
            <h3 className="text-base font-bold text-slate-900 dark:text-white">¿Eliminar Gasto?</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Se eliminará el gasto <span className="font-bold text-slate-900 dark:text-white">{deleteTarget.description}</span> ({deleteTarget.type}) por{' '}
              <span className="font-bold text-rose-600 dark:text-rose-400">{formatCOP(deleteTarget.amount)}</span>.
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
                  await onDeleteExpense(id);
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
