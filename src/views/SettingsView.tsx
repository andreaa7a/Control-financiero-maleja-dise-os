import React, { useState, useRef, useEffect } from 'react';
import {
  BusinessSettings,
  Sale,
  Expense,
  ProductionCost,
  Supplier,
  PurchaseOrder,
  MaterialTemplate,
  AccountReceivable,
  AuditLog,
  FixedExpenseConfig,
  FixedExpenseFrequency,
  ExpenseType,
} from '../types/finance';
import {
  Save,
  Download,
  RotateCcw,
  CheckCircle2,
  Sun,
  Moon,
  Upload,
  ShieldCheck,
  AlertTriangle,
  FileSpreadsheet,
  FileText,
  Calendar,
  Database,
  X,
  BookOpen,
  Building2,
  Target,
  Repeat,
  Tags,
  Plus,
  Edit3,
  Trash2,
  Image as ImageIcon,
  Printer,
  Check,
  Info,
  Receipt,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { formatCOP, formatDate, getTodayString } from '../utils/formatters';
import {
  DEFAULT_SALE_CATEGORIES,
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_PAYMENT_METHODS,
  FIXED_EXPENSE_FREQUENCIES,
  isValidLogoUrl,
  calculateMonthlyEquivalent,
  calculateTotalMonthlyFixedExpenses,
  calculateMonthlyGoalsProgress,
  validateFixedExpenseConfigInput,
  resizeAndValidateLogoFile,
} from '../utils/settingsUtils';
import { generateUniqueId } from '../utils/validation';
import {
  exportSalesToExcel,
  exportSalesToPDF,
  exportExpensesToExcel,
  exportExpensesToPDF,
  exportPurchasesToExcel,
  exportPurchasesToPDF,
  exportReceivablesToExcel,
  exportReceivablesToPDF,
  exportConsolidatedWorkbookToExcel,
} from '../utils/exportUtils';
import {
  BackupPayload,
  RestoreMode,
  RestoreModuleSelection,
  parseAndValidateBackup,
  mergeCollectionByMode,
} from '../utils/backupUtils';

export interface RestoreResult {
  success: boolean;
  message: string;
}

type SettingsSectionTab = 'general' | 'goals' | 'fixed_expenses' | 'catalogs' | 'backups';

interface SettingsViewProps {
  settings: BusinessSettings;
  sales: Sale[];
  expenses: Expense[];
  productionCosts: ProductionCost[];
  suppliers: Supplier[];
  purchaseOrders: PurchaseOrder[];
  materialTemplates: MaterialTemplate[];
  receivables: AccountReceivable[];
  auditLogs: AuditLog[];
  lastBackupAt: string | null;
  isCloudConnected: boolean | null;
  onUpdateSettings: (newSettings: BusinessSettings) => Promise<void> | void;
  onResetData: () => void;
  onExportData: () => void;
  onRestoreBackup: (
    payload: BackupPayload,
    mode: RestoreMode,
    selection: RestoreModuleSelection
  ) => Promise<RestoreResult>;
  onQuickRegisterFixedExpense?: (config: FixedExpenseConfig) => Promise<void> | void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  sales,
  expenses,
  productionCosts,
  suppliers,
  purchaseOrders,
  receivables,
  auditLogs,
  lastBackupAt,
  isCloudConnected,
  onUpdateSettings,
  onResetData,
  onExportData,
  onRestoreBackup,
  onQuickRegisterFixedExpense,
}) => {
  const { theme, setTheme } = useTheme();
  const [activeSection, setActiveSection] = useState<SettingsSectionTab>('general');

  // General Info State
  const [companyName, setCompanyName] = useState(settings.companyName);
  const [nit, setNit] = useState(settings.nit);
  const [address, setAddress] = useState(settings.address);
  const [phone, setPhone] = useState(settings.phone);
  const [email, setEmail] = useState(settings.email);
  const [logoUrl, setLogoUrl] = useState(settings.logoUrl || '');
  const [logoError, setLogoError] = useState<string | null>(null);
  const logoFileInputRef = useRef<HTMLInputElement | null>(null);

  // Financial Goals & Budget State
  const [monthlySalesGoal, setMonthlySalesGoal] = useState<number>(settings.monthlySalesGoal);
  const [monthlyProfitGoal, setMonthlyProfitGoal] = useState<number>(settings.monthlyProfitGoal);
  const [monthlyPurchasesBudget, setMonthlyPurchasesBudget] = useState<number>(
    settings.monthlyPurchasesBudget
  );

  // Feedback banners
  const [savedSuccess, setSavedSuccess] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Fixed Expense Modal State
  const [isFixedModalOpen, setIsFixedModalOpen] = useState(false);
  const [editingFixed, setEditingFixed] = useState<FixedExpenseConfig | null>(null);
  const [deleteFixedTarget, setDeleteFixedTarget] = useState<FixedExpenseConfig | null>(null);
  const [fixedError, setFixedError] = useState<string | null>(null);
  const [feName, setFeName] = useState('');
  const [feCategory, setFeCategory] = useState(settings.expenseCategories.Fijo[0] || 'Arriendo');
  const [feAmount, setFeAmount] = useState<number>(0);
  const [feFrequency, setFeFrequency] = useState<FixedExpenseFrequency>('Mensual');
  const [feDueDate, setFeDueDate] = useState(getTodayString());
  const [fePaymentMethod, setFePaymentMethod] = useState(
    settings.paymentMethods[0] || 'Transferencia Bancaria'
  );
  const [feActive, setFeActive] = useState(true);
  const [feNotes, setFeNotes] = useState('');
  const [registeringFeId, setRegisteringFeId] = useState<string | null>(null);

  // Catalog Management State
  const [newSaleCategory, setNewSaleCategory] = useState('');
  const [editingSaleCatIdx, setEditingSaleCatIdx] = useState<number | null>(null);
  const [editingSaleCatVal, setEditingSaleCatVal] = useState('');

  const [activeExpCatType, setActiveExpCatType] = useState<ExpenseType>('Fijo');
  const [newExpCategory, setNewExpCategory] = useState('');
  const [editingExpCatIdx, setEditingExpCatIdx] = useState<number | null>(null);
  const [editingExpCatVal, setEditingExpCatVal] = useState('');

  const [newPaymentMethod, setNewPaymentMethod] = useState('');
  const [editingPmIdx, setEditingPmIdx] = useState<number | null>(null);
  const [editingPmVal, setEditingPmVal] = useState('');

  const [catalogError, setCatalogError] = useState<string | null>(null);

  // Quick export range
  const [expDateFrom, setExpDateFrom] = useState('');
  const [expDateTo, setExpDateTo] = useState('');

  // Controlled Restore State
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoreSuccess, setRestoreSuccess] = useState<string | null>(null);
  const [pendingBackup, setPendingBackup] = useState<BackupPayload | null>(null);
  const [pendingWarnings, setPendingWarnings] = useState<string[]>([]);
  const [restoreMode, setRestoreMode] = useState<RestoreMode>('merge_missing');
  const [confirmReplaceWord, setConfirmReplaceWord] = useState('');
  const [isRestoring, setIsRestoring] = useState(false);
  const [moduleSelection, setModuleSelection] = useState<RestoreModuleSelection>({
    sales: true,
    expenses: true,
    productionCosts: true,
    suppliers: true,
    purchaseOrders: true,
    materialTemplates: true,
    settings: false,
    auditLogs: true,
  });

  // Sync draft state when cloud settings arrive or backup restores
  useEffect(() => {
    setCompanyName(settings.companyName);
    setNit(settings.nit);
    setAddress(settings.address);
    setPhone(settings.phone);
    setEmail(settings.email);
    setLogoUrl(settings.logoUrl || '');
    setMonthlySalesGoal(settings.monthlySalesGoal);
    setMonthlyProfitGoal(settings.monthlyProfitGoal);
    setMonthlyPurchasesBudget(settings.monthlyPurchasesBudget);
  }, [settings]);

  const notifySaved = (msg: string) => {
    setSettingsError(null);
    setSavedSuccess(msg);
    setTimeout(() => setSavedSuccess(null), 3500);
  };

  // Save General Info
  const handleGeneralSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsError(null);
    setLogoError(null);

    if (!companyName.trim()) {
      setSettingsError('El nombre comercial del negocio es obligatorio.');
      return;
    }
    if (!nit.trim()) {
      setSettingsError('El NIT o cédula es obligatorio.');
      return;
    }
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setSettingsError('Ingrese un correo electrónico válido.');
      return;
    }
    if (!isValidLogoUrl(logoUrl)) {
      setLogoError(
        'La URL del logo debe comenzar por https:// o corresponder a una imagen PNG/JPG/WEBP cargada.'
      );
      return;
    }

    try {
      await onUpdateSettings({
        ...settings,
        companyName: companyName.trim().slice(0, 120),
        nit: nit.trim().slice(0, 50),
        address: address.trim().slice(0, 200),
        phone: phone.trim().slice(0, 50),
        email: email.trim().slice(0, 100),
        logoUrl: logoUrl.trim(),
        currencyCode: 'COP',
        currencySymbol: '$',
      });
      notifySaved('Información general del negocio actualizada correctamente.');
    } catch (err: any) {
      setSettingsError(err?.message || 'Error al guardar la configuración en la base de datos.');
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setLogoError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    const res = await resizeAndValidateLogoFile(file);
    if (logoFileInputRef.current) logoFileInputRef.current.value = '';
    if (!res.valid || !res.dataUrl) {
      setLogoError(res.error || 'No se pudo procesar el logo.');
      return;
    }
    setLogoUrl(res.dataUrl);
  };

  // Save Goals & Budget
  const handleGoalsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsError(null);

    if (!Number.isFinite(monthlySalesGoal) || monthlySalesGoal < 0) {
      setSettingsError('La meta de ventas mensual no puede ser negativa.');
      return;
    }
    if (!Number.isFinite(monthlyProfitGoal) || monthlyProfitGoal < 0) {
      setSettingsError('La meta de utilidad mensual no puede ser negativa.');
      return;
    }
    if (!Number.isFinite(monthlyPurchasesBudget) || monthlyPurchasesBudget < 0) {
      setSettingsError('El presupuesto para compras no puede ser negativo.');
      return;
    }

    try {
      await onUpdateSettings({
        ...settings,
        monthlySalesGoal: Math.round(monthlySalesGoal),
        monthlyProfitGoal: Math.round(monthlyProfitGoal),
        monthlyPurchasesBudget: Math.round(monthlyPurchasesBudget),
      });
      notifySaved('Metas financieras y presupuesto mensual guardados sin alterar históricos.');
    } catch (err: any) {
      setSettingsError(err?.message || 'Error al guardar las metas en la base de datos.');
    }
  };

  // Live Goals Progress Calculation (uses current draft goal inputs for immediate feedback)
  const goalsProgress = calculateMonthlyGoalsProgress({
    sales,
    expenses,
    productionCosts,
    purchaseOrders,
    settings: {
      ...settings,
      monthlySalesGoal,
      monthlyProfitGoal,
      monthlyPurchasesBudget,
    },
  });

  // Fixed Expenses Handlers
  const totalMonthlyFixed = calculateTotalMonthlyFixedExpenses(settings.fixedExpensesConfig);
  const activeFixedCount = settings.fixedExpensesConfig.filter((f) => f.active).length;

  const handleOpenNewFixed = () => {
    setEditingFixed(null);
    setFixedError(null);
    setFeName('');
    setFeCategory(settings.expenseCategories.Fijo[0] || 'Arriendo');
    setFeAmount(0);
    setFeFrequency('Mensual');
    setFeDueDate(getTodayString());
    setFePaymentMethod(settings.paymentMethods[0] || 'Transferencia Bancaria');
    setFeActive(true);
    setFeNotes('');
    setIsFixedModalOpen(true);
  };

  const handleOpenEditFixed = (item: FixedExpenseConfig) => {
    setEditingFixed(item);
    setFixedError(null);
    setFeName(item.name);
    setFeCategory(item.category);
    setFeAmount(item.amount);
    setFeFrequency(item.frequency);
    setFeDueDate(item.dueDate);
    setFePaymentMethod(item.paymentMethod);
    setFeActive(item.active);
    setFeNotes(item.notes || '');
    setIsFixedModalOpen(true);
  };

  const handleSaveFixedExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setFixedError(null);

    const validation = validateFixedExpenseConfigInput({
      name: feName,
      category: feCategory,
      amount: feAmount,
      dueDate: feDueDate,
      paymentMethod: fePaymentMethod,
    });
    if (!validation.valid) {
      setFixedError(validation.error || 'Revise los datos del gasto fijo.');
      return;
    }

    const nextId =
      editingFixed?.id ||
      generateUniqueId(
        'FE-',
        settings.fixedExpensesConfig.map((f) => f.id)
      );

    const nextItem: FixedExpenseConfig = {
      id: nextId,
      name: feName.trim(),
      category: feCategory.trim(),
      amount: Math.round(feAmount),
      frequency: feFrequency,
      dueDate: feDueDate,
      paymentMethod: fePaymentMethod,
      active: feActive,
      notes: feNotes.trim() || undefined,
    };

    const updatedList = editingFixed
      ? settings.fixedExpensesConfig.map((f) => (f.id === editingFixed.id ? nextItem : f))
      : [...settings.fixedExpensesConfig, nextItem];

    try {
      await onUpdateSettings({
        ...settings,
        fixedExpensesConfig: updatedList,
      });

      setIsFixedModalOpen(false);
      notifySaved(
        editingFixed
          ? `Gasto fijo "${nextItem.name}" actualizado.`
          : `Gasto fijo "${nextItem.name}" agregado.`
      );
    } catch (err: any) {
      setFixedError(err?.message || 'Error al guardar el gasto fijo en la base de datos.');
    }
  };

  const handleToggleFixedActive = async (item: FixedExpenseConfig) => {
    const updatedList = settings.fixedExpensesConfig.map((f) =>
      f.id === item.id ? { ...f, active: !f.active } : f
    );
    await onUpdateSettings({
      ...settings,
      fixedExpensesConfig: updatedList,
    });
    notifySaved(`Estado de "${item.name}" actualizado.`);
  };

  const handleDeleteFixedConfirm = async () => {
    if (!deleteFixedTarget) return;
    const targetName = deleteFixedTarget.name;
    const updatedList = settings.fixedExpensesConfig.filter((f) => f.id !== deleteFixedTarget.id);
    setDeleteFixedTarget(null);
    await onUpdateSettings({
      ...settings,
      fixedExpensesConfig: updatedList,
    });
    notifySaved(`Gasto fijo "${targetName}" eliminado de la configuración (históricos intactos).`);
  };

  // Catalog Management Handlers
  const handleAddSaleCategory = async () => {
    setCatalogError(null);
    const val = newSaleCategory.trim().slice(0, 80);
    if (!val) return;
    if (settings.saleCategories.some((c) => c.toLowerCase() === val.toLowerCase())) {
      setCatalogError(`La categoría de venta "${val}" ya existe.`);
      return;
    }
    if (settings.saleCategories.length >= 50) {
      setCatalogError('Límite máximo de 50 categorías de venta alcanzado.');
      return;
    }
    await onUpdateSettings({
      ...settings,
      saleCategories: [...settings.saleCategories, val],
    });
    setNewSaleCategory('');
    notifySaved(`Categoría de venta "${val}" añadida.`);
  };

  const handleSaveSaleCategoryRename = async (idx: number) => {
    setCatalogError(null);
    const val = editingSaleCatVal.trim().slice(0, 80);
    if (!val) {
      setCatalogError('El nombre de la categoría no puede quedar vacío.');
      return;
    }
    if (
      settings.saleCategories.some((c, i) => i !== idx && c.toLowerCase() === val.toLowerCase())
    ) {
      setCatalogError(`Ya existe otra categoría de venta llamada "${val}".`);
      return;
    }
    const next = settings.saleCategories.map((c, i) => (i === idx ? val : c));
    await onUpdateSettings({ ...settings, saleCategories: next });
    setEditingSaleCatIdx(null);
    notifySaved('Categoría de venta actualizada.');
  };

  const handleDeleteSaleCategory = async (idx: number) => {
    setCatalogError(null);
    if (settings.saleCategories.length <= 1) {
      setCatalogError('Debe mantener al menos una categoría de ventas activa.');
      return;
    }
    const next = settings.saleCategories.filter((_, i) => i !== idx);
    await onUpdateSettings({ ...settings, saleCategories: next });
    notifySaved('Categoría eliminada del catálogo de ventas.');
  };

  const handleAddExpCategory = async () => {
    setCatalogError(null);
    const val = newExpCategory.trim().slice(0, 80);
    if (!val) return;
    const current = settings.expenseCategories[activeExpCatType];
    if (current.some((c) => c.toLowerCase() === val.toLowerCase())) {
      setCatalogError(`La categoría "${val}" ya existe en gastos ${activeExpCatType}.`);
      return;
    }
    if (current.length >= 50) {
      setCatalogError('Límite máximo de 50 categorías alcanzado.');
      return;
    }
    await onUpdateSettings({
      ...settings,
      expenseCategories: {
        ...settings.expenseCategories,
        [activeExpCatType]: [...current, val],
      },
    });
    setNewExpCategory('');
    notifySaved(`Categoría de gasto "${val}" añadida.`);
  };

  const handleSaveExpCategoryRename = async (idx: number) => {
    setCatalogError(null);
    const val = editingExpCatVal.trim().slice(0, 80);
    if (!val) {
      setCatalogError('El nombre de la categoría no puede quedar vacío.');
      return;
    }
    const current = settings.expenseCategories[activeExpCatType];
    if (current.some((c, i) => i !== idx && c.toLowerCase() === val.toLowerCase())) {
      setCatalogError(`Ya existe una categoría "${val}" en este tipo de gasto.`);
      return;
    }
    const next = current.map((c, i) => (i === idx ? val : c));
    await onUpdateSettings({
      ...settings,
      expenseCategories: {
        ...settings.expenseCategories,
        [activeExpCatType]: next,
      },
    });
    setEditingExpCatIdx(null);
    notifySaved('Categoría de gasto actualizada.');
  };

  const handleDeleteExpCategory = async (idx: number) => {
    setCatalogError(null);
    const current = settings.expenseCategories[activeExpCatType];
    if (current.length <= 1) {
      setCatalogError(`Debe conservar al menos una categoría para gastos ${activeExpCatType}.`);
      return;
    }
    const next = current.filter((_, i) => i !== idx);
    await onUpdateSettings({
      ...settings,
      expenseCategories: {
        ...settings.expenseCategories,
        [activeExpCatType]: next,
      },
    });
    notifySaved('Categoría eliminada del catálogo de gastos.');
  };

  const handleAddPaymentMethod = async () => {
    setCatalogError(null);
    const val = newPaymentMethod.trim().slice(0, 50);
    if (!val) return;
    if (settings.paymentMethods.some((m) => m.toLowerCase() === val.toLowerCase())) {
      setCatalogError(`El medio de pago "${val}" ya existe.`);
      return;
    }
    if (settings.paymentMethods.length >= 30) {
      setCatalogError('Límite máximo de 30 medios de pago alcanzado.');
      return;
    }
    await onUpdateSettings({
      ...settings,
      paymentMethods: [...settings.paymentMethods, val],
    });
    setNewPaymentMethod('');
    notifySaved(`Medio de pago "${val}" agregado.`);
  };

  const handleSavePaymentMethodRename = async (idx: number) => {
    setCatalogError(null);
    const val = editingPmVal.trim().slice(0, 50);
    if (!val) {
      setCatalogError('El medio de pago no puede quedar vacío.');
      return;
    }
    if (settings.paymentMethods.some((m, i) => i !== idx && m.toLowerCase() === val.toLowerCase())) {
      setCatalogError(`Ya existe un medio de pago "${val}".`);
      return;
    }
    const next = settings.paymentMethods.map((m, i) => (i === idx ? val : m));
    await onUpdateSettings({ ...settings, paymentMethods: next });
    setEditingPmIdx(null);
    notifySaved('Medio de pago actualizado.');
  };

  const handleDeletePaymentMethod = async (idx: number) => {
    setCatalogError(null);
    if (settings.paymentMethods.length <= 1) {
      setCatalogError('Debe mantener al menos un medio de pago disponible.');
      return;
    }
    const next = settings.paymentMethods.filter((_, i) => i !== idx);
    await onUpdateSettings({ ...settings, paymentMethods: next });
    notifySaved('Medio de pago eliminado.');
  };

  // Filtered slices for Export Hub (read-only, never alters originals)
  const filteredSales = sales.filter(
    (s) => (!expDateFrom || s.date >= expDateFrom) && (!expDateTo || s.date <= expDateTo)
  );
  const filteredExpenses = expenses.filter(
    (e) => (!expDateFrom || e.date >= expDateFrom) && (!expDateTo || e.date <= expDateTo)
  );
  const filteredPurchases = purchaseOrders.filter(
    (p) => (!expDateFrom || p.date >= expDateFrom) && (!expDateTo || p.date <= expDateTo)
  );
  const filteredProduction = productionCosts.filter(
    (pc) => (!expDateFrom || pc.date >= expDateFrom) && (!expDateTo || pc.date <= expDateTo)
  );
  const filteredReceivables = receivables.filter((r) => {
    const sale = sales.find((s) => s.id === r.saleId);
    const d = sale?.date || r.dueDate;
    return (!expDateFrom || d >= expDateFrom) && (!expDateTo || d <= expDateTo);
  });

  const exportMeta = {
    dateFrom: expDateFrom,
    dateTo: expDateTo,
    appliedFilters: ['Exportación desde Centro de Respaldo'],
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setRestoreError(null);
    setRestoreSuccess(null);
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const validation = parseAndValidateBackup(text);
      if (!validation.valid || !validation.payload) {
        setRestoreError(validation.error || 'Archivo de respaldo inválido.');
      } else {
        setPendingBackup(validation.payload);
        setPendingWarnings(validation.warnings);
        setRestoreMode('merge_missing');
        setConfirmReplaceWord('');
        setModuleSelection({
          sales: validation.payload.sales.length > 0,
          expenses: validation.payload.expenses.length > 0,
          productionCosts: validation.payload.productionCosts.length > 0,
          suppliers: validation.payload.suppliers.length > 0,
          purchaseOrders: validation.payload.purchaseOrders.length > 0,
          materialTemplates: Boolean(validation.payload.materialTemplates?.length),
          settings: Boolean(validation.payload.settings),
          auditLogs: Boolean(validation.payload.auditLogs?.length),
        });
      }
    } catch {
      setRestoreError('No se pudo leer el archivo seleccionado.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleExecuteRestore = async () => {
    if (!pendingBackup) return;
    if (restoreMode === 'replace' && confirmReplaceWord.trim().toUpperCase() !== 'RESTAURAR') {
      return;
    }

    setIsRestoring(true);
    setRestoreError(null);
    try {
      const result = await onRestoreBackup(pendingBackup, restoreMode, moduleSelection);
      if (result.success) {
        setRestoreSuccess(result.message);
        setPendingBackup(null);
      } else {
        setRestoreError(result.message);
      }
    } catch (err) {
      setRestoreError(
        err instanceof Error ? err.message : 'Ocurrió un error al restaurar la copia de seguridad.'
      );
    } finally {
      setIsRestoring(false);
    }
  };

  const previewStats = pendingBackup
    ? [
        {
          key: 'sales' as const,
          label: 'Ventas',
          current: sales.length,
          incoming: pendingBackup.sales.length,
          diff: mergeCollectionByMode(sales, pendingBackup.sales, restoreMode),
        },
        {
          key: 'expenses' as const,
          label: 'Gastos',
          current: expenses.length,
          incoming: pendingBackup.expenses.length,
          diff: mergeCollectionByMode(expenses, pendingBackup.expenses, restoreMode),
        },
        {
          key: 'purchaseOrders' as const,
          label: 'Compras',
          current: purchaseOrders.length,
          incoming: pendingBackup.purchaseOrders.length,
          diff: mergeCollectionByMode(purchaseOrders, pendingBackup.purchaseOrders, restoreMode),
        },
        {
          key: 'productionCosts' as const,
          label: 'Costos Producción',
          current: productionCosts.length,
          incoming: pendingBackup.productionCosts.length,
          diff: mergeCollectionByMode(productionCosts, pendingBackup.productionCosts, restoreMode),
        },
        {
          key: 'suppliers' as const,
          label: 'Proveedores',
          current: suppliers.length,
          incoming: pendingBackup.suppliers.length,
          diff: mergeCollectionByMode(suppliers, pendingBackup.suppliers, restoreMode),
        },
        {
          key: 'auditLogs' as const,
          label: 'Auditoría',
          current: auditLogs.length,
          incoming: pendingBackup.auditLogs?.length || 0,
          diff: mergeCollectionByMode(auditLogs, pendingBackup.auditLogs || [], restoreMode),
        },
      ]
    : [];

  const getDueStatus = (dueDate: string, active: boolean) => {
    if (!active) {
      return {
        label: 'Pausado',
        cls: 'bg-slate-100 dark:bg-[#111827] text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-[#1e293b]',
      };
    }
    const today = getTodayString();
    const diffDays = Math.ceil(
      (new Date(dueDate + 'T00:00:00').getTime() - new Date(today + 'T00:00:00').getTime()) /
        (1000 * 60 * 60 * 24)
    );
    if (diffDays < 0) {
      return {
        label: 'Vencido',
        cls: 'bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30',
      };
    }
    if (diffDays <= 5) {
      return {
        label: `Vence en ${diffDays === 0 ? 'hoy' : `${diffDays}d`}`,
        cls: 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30',
      };
    }
    return {
      label: 'Programado',
      cls: 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30',
    };
  };

  const sectionTabs: { id: SettingsSectionTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'general', label: 'Información General', icon: Building2 },
    { id: 'goals', label: 'Metas y Presupuesto', icon: Target },
    { id: 'fixed_expenses', label: 'Gastos Fijos', icon: Repeat },
    { id: 'catalogs', label: 'Categorías y Medios de Pago', icon: Tags },
    { id: 'backups', label: 'Apariencia, Exportación y Respaldos', icon: Database },
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-fadeIn pb-12">
      {/* Header */}
      <div className="bg-white dark:bg-[#0d1322] border border-slate-200 dark:border-[#1e293b] rounded-2xl p-6 shadow-sm dark:shadow-xl transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            Configuración del Negocio
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Administra los datos comerciales de {settings.companyName}, metas financieras, gastos fijos, catálogos y respaldos en tiempo real.
          </p>
        </div>
        <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-600 dark:text-slate-300 px-3 py-2 bg-slate-50 dark:bg-[#111827] border border-slate-200 dark:border-[#1e293b] rounded-xl shrink-0">
          <span>Moneda base:</span>
          <span className="font-bold text-blue-600 dark:text-blue-400">
            {settings.currencyCode || 'COP'} ({settings.currencySymbol || '$'})
          </span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white dark:bg-[#0d1322] border border-slate-200 dark:border-[#1e293b] p-2 rounded-2xl shadow-sm flex items-center gap-1.5 overflow-x-auto">
        {sectionTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSection === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveSection(tab.id);
                setSettingsError(null);
                setCatalogError(null);
              }}
              className={`px-3.5 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap flex items-center gap-2 transition-all ${
                isActive
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#111827] hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Feedback Alerts */}
      {savedSuccess && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 rounded-xl text-emerald-700 dark:text-emerald-300 flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="font-medium">{savedSuccess}</span>
          </div>
          <button
            type="button"
            onClick={() => setSavedSuccess(null)}
            className="text-emerald-700 dark:text-emerald-300 hover:underline font-semibold"
          >
            Cerrar
          </button>
        </div>
      )}

      {settingsError && (
        <div className="p-4 bg-rose-50 dark:bg-rose-500/15 border border-rose-200 dark:border-rose-500/30 rounded-xl text-rose-700 dark:text-rose-300 flex items-center space-x-2 text-xs font-medium">
          <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
          <span>{settingsError}</span>
        </div>
      )}

      {restoreSuccess && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-500/20 border border-emerald-200 dark:border-emerald-500/30 rounded-xl text-emerald-700 dark:text-emerald-300 flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="font-medium">{restoreSuccess}</span>
          </div>
          <button
            type="button"
            onClick={() => setRestoreSuccess(null)}
            className="text-emerald-600 dark:text-emerald-300 hover:underline font-semibold"
          >
            Cerrar
          </button>
        </div>
      )}

      {restoreError && (
        <div className="p-4 bg-rose-50 dark:bg-rose-500/20 border border-rose-200 dark:border-rose-500/30 rounded-xl text-rose-700 dark:text-rose-300 flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
            <span className="font-medium">{restoreError}</span>
          </div>
          <button
            type="button"
            onClick={() => setRestoreError(null)}
            className="text-rose-600 dark:text-rose-300 hover:underline font-semibold"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 1: INFORMACIÓN GENERAL                                            */}
      {/* ===================================================================== */}
      {activeSection === 'general' && (
        <div className="bg-white dark:bg-[#0d1322] border border-slate-200 dark:border-[#1e293b] rounded-2xl p-6 sm:p-8 shadow-sm dark:shadow-xl text-xs transition-colors">
          <form onSubmit={handleGeneralSubmit} className="space-y-6">
            <div className="pb-4 border-b border-slate-200 dark:border-[#1e293b] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                  Información General del Negocio
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Estos datos identifican tu negocio en la barra lateral, facturas exportadas, reportes Excel y documentos PDF.
                </p>
              </div>
            </div>

            {/* Logo Upload & Preview */}
            <div className="p-5 bg-slate-50 dark:bg-[#111827] border border-slate-200 dark:border-[#1e293b] rounded-2xl flex flex-col md:flex-row items-start md:items-center gap-6">
              <div className="w-20 h-20 rounded-2xl bg-white dark:bg-[#070b14] border border-slate-200 dark:border-[#1e293b] flex items-center justify-center overflow-hidden shrink-0">
                {logoUrl && isValidLogoUrl(logoUrl) ? (
                  <img
                    src={logoUrl}
                    alt={`Logo ${companyName}`}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-contain p-1.5"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center">
                    <Printer className="w-6 h-6" />
                  </div>
                )}
              </div>

              <div className="flex-1 space-y-3 w-full">
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white text-xs">Logo del Negocio</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Sube una imagen PNG, JPG o WEBP (se optimiza automáticamente para impresiones y PDF) o pega una URL HTTPS segura.
                  </p>
                </div>

                {logoError && (
                  <p className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold">{logoError}</p>
                )}

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                  <input
                    ref={logoFileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => logoFileInputRef.current?.click()}
                    className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap"
                  >
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span>Subir Imagen</span>
                  </button>
                  <input
                    type="text"
                    placeholder="O pegar URL https://..."
                    value={logoUrl.startsWith('data:image/') ? '' : logoUrl}
                    onChange={(e) => {
                      setLogoError(null);
                      setLogoUrl(e.target.value);
                    }}
                    className="flex-1 px-3.5 py-2 bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-[#1e293b] rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                  />
                  {logoUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        setLogoUrl('');
                        setLogoError(null);
                      }}
                      className="px-3 py-2 bg-white dark:bg-[#0d1322] border border-slate-200 dark:border-[#1e293b] text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 font-semibold rounded-xl"
                    >
                      Quitar logo
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block font-bold text-slate-600 dark:text-slate-400 uppercase mb-1.5">
                  Nombre Comercial *
                </label>
                <input
                  type="text"
                  maxLength={120}
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-[#1e293b] rounded-xl text-slate-900 dark:text-white font-medium focus:outline-none focus:border-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block font-bold text-slate-600 dark:text-slate-400 uppercase mb-1.5">
                  NIT / Cédula *
                </label>
                <input
                  type="text"
                  maxLength={50}
                  value={nit}
                  onChange={(e) => setNit(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-[#1e293b] rounded-xl text-slate-900 dark:text-white font-medium focus:outline-none focus:border-blue-500"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <div>
                <label className="block font-bold text-slate-600 dark:text-slate-400 uppercase mb-1.5">
                  Teléfono de Contacto
                </label>
                <input
                  type="text"
                  maxLength={50}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-[#1e293b] rounded-xl text-slate-900 dark:text-white font-medium focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-600 dark:text-slate-400 uppercase mb-1.5">
                  Correo Electrónico
                </label>
                <input
                  type="email"
                  maxLength={100}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-[#1e293b] rounded-xl text-slate-900 dark:text-white font-medium focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-600 dark:text-slate-400 uppercase mb-1.5">
                  Moneda del Sistema
                </label>
                <input
                  type="text"
                  value="COP — Peso Colombiano ($)"
                  readOnly
                  className="w-full px-4 py-2.5 bg-slate-100 dark:bg-[#070b14] border border-slate-200 dark:border-[#1e293b] rounded-xl text-slate-600 dark:text-slate-300 font-semibold cursor-default"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-600 dark:text-slate-400 uppercase mb-1.5">
                Dirección Comercial / Taller
              </label>
              <input
                type="text"
                maxLength={200}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-[#1e293b] rounded-xl text-slate-900 dark:text-white font-medium focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-[#1e293b]">
              <button
                type="submit"
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl shadow-md transition-all flex items-center space-x-2"
              >
                <Save className="w-4 h-4" />
                <span>Guardar Información General</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: METAS Y PRESUPUESTO                                            */}
      {/* ===================================================================== */}
      {activeSection === 'goals' && (
        <div className="space-y-6">
          <div className="p-4 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 rounded-2xl flex items-start gap-3 text-xs text-blue-900 dark:text-blue-200">
            <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <p>
              Las metas y presupuestos mensuales pueden ajustarse en cualquier momento. Los cambios se reflejan de inmediato en los indicadores de cumplimiento sin modificar ningún movimiento histórico registrado.
            </p>
          </div>

          {/* Live Goal Tracking Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Sales Goal Card */}
            <div className="bg-white dark:bg-[#0d1322] border border-slate-200 dark:border-[#1e293b] rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Meta de Ventas ({goalsProgress.monthPrefix})
                </span>
                <span className="text-sm font-black text-blue-600 dark:text-blue-400 tabular-nums">
                  {goalsProgress.salesPct.toFixed(1)}%
                </span>
              </div>
              <div className="space-y-1">
                <p className="text-2xl font-black text-slate-900 dark:text-white tabular-nums">
                  {formatCOP(goalsProgress.currentSales)}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                  de {formatCOP(goalsProgress.salesGoal)} configurados
                </p>
              </div>
              <div className="w-full h-2.5 bg-slate-100 dark:bg-[#111827] rounded-full overflow-hidden border border-slate-200 dark:border-[#1e293b]">
                <div
                  className="h-full bg-blue-600 rounded-full transition-all duration-300"
                  style={{ width: `${goalsProgress.salesPct}%` }}
                />
              </div>
              <div className="pt-2 border-t border-slate-200 dark:border-[#1e293b] flex items-center justify-between text-xs">
                {goalsProgress.salesRemaining > 0 ? (
                  <>
                    <span className="text-slate-500 dark:text-slate-400">Falta para la meta:</span>
                    <span className="font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                      {formatCOP(goalsProgress.salesRemaining)}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                      Meta alcanzada
                    </span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                      +{formatCOP(goalsProgress.salesSurplus)}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Profit Goal Card */}
            <div className="bg-white dark:bg-[#0d1322] border border-slate-200 dark:border-[#1e293b] rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Meta de Utilidad Neta
                </span>
                <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {goalsProgress.profitPct.toFixed(1)}%
                </span>
              </div>
              <div className="space-y-1">
                <p
                  className={`text-2xl font-black tabular-nums ${
                    goalsProgress.currentProfit >= 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {formatCOP(goalsProgress.currentProfit)}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                  de {formatCOP(goalsProgress.profitGoal)} estimados
                </p>
              </div>
              <div className="w-full h-2.5 bg-slate-100 dark:bg-[#111827] rounded-full overflow-hidden border border-slate-200 dark:border-[#1e293b]">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                  style={{ width: `${goalsProgress.profitPct}%` }}
                />
              </div>
              <div className="pt-2 border-t border-slate-200 dark:border-[#1e293b] flex items-center justify-between text-xs">
                {goalsProgress.profitRemaining > 0 ? (
                  <>
                    <span className="text-slate-500 dark:text-slate-400">Falta para la meta:</span>
                    <span className="font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                      {formatCOP(goalsProgress.profitRemaining)}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                      Meta alcanzada
                    </span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                      +{formatCOP(goalsProgress.profitSurplus)}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Purchases Budget Card */}
            <div className="bg-white dark:bg-[#0d1322] border border-slate-200 dark:border-[#1e293b] rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Presupuesto de Compras
                </span>
                <span
                  className={`text-sm font-black tabular-nums ${
                    goalsProgress.purchasesExceededBy > 0
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-indigo-600 dark:text-indigo-400'
                  }`}
                >
                  {goalsProgress.purchasesPct.toFixed(1)}%
                </span>
              </div>
              <div className="space-y-1">
                <p className="text-2xl font-black text-slate-900 dark:text-white tabular-nums">
                  {formatCOP(goalsProgress.currentPurchases)}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                  de {formatCOP(goalsProgress.purchasesBudget)} asignados
                </p>
              </div>
              <div className="w-full h-2.5 bg-slate-100 dark:bg-[#111827] rounded-full overflow-hidden border border-slate-200 dark:border-[#1e293b]">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    goalsProgress.purchasesExceededBy > 0 ? 'bg-rose-500' : 'bg-indigo-500'
                  }`}
                  style={{ width: `${goalsProgress.purchasesPct}%` }}
                />
              </div>
              <div className="pt-2 border-t border-slate-200 dark:border-[#1e293b] flex items-center justify-between text-xs">
                {goalsProgress.purchasesExceededBy > 0 ? (
                  <>
                    <span className="text-rose-600 dark:text-rose-400 font-semibold">Excedido en:</span>
                    <span className="font-bold text-rose-600 dark:text-rose-400 tabular-nums">
                      {formatCOP(goalsProgress.purchasesExceededBy)}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-slate-500 dark:text-slate-400">Disponible del mes:</span>
                    <span className="font-bold text-slate-900 dark:text-white tabular-nums">
                      {formatCOP(goalsProgress.purchasesRemaining)}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Editable Goals Form */}
          <div className="bg-white dark:bg-[#0d1322] border border-slate-200 dark:border-[#1e293b] rounded-2xl p-6 sm:p-8 shadow-sm text-xs">
            <form onSubmit={handleGoalsSubmit} className="space-y-6">
              <div className="pb-4 border-b border-slate-200 dark:border-[#1e293b] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                    Parámetros Financieros Mensuales (COP)
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Define tus objetivos de facturación, utilidad y tope mensual de compras a proveedores.
                  </p>
                </div>
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
                  Gastos fijos programados/mes: {formatCOP(totalMonthlyFixed)}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-400 uppercase mb-1.5">
                    Meta de Ventas Mensual (COP)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="50000"
                    value={monthlySalesGoal}
                    onChange={(e) => setMonthlySalesGoal(Math.max(0, Number(e.target.value) || 0))}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-[#1e293b] rounded-xl text-slate-900 dark:text-white font-bold tabular-nums focus:outline-none focus:border-blue-500"
                    required
                  />
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
                    Actual: {formatCOP(monthlySalesGoal)}
                  </p>
                </div>

                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-400 uppercase mb-1.5">
                    Meta de Utilidad Mensual (COP)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="50000"
                    value={monthlyProfitGoal}
                    onChange={(e) => setMonthlyProfitGoal(Math.max(0, Number(e.target.value) || 0))}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-[#1e293b] rounded-xl text-emerald-600 dark:text-emerald-400 font-bold tabular-nums focus:outline-none focus:border-blue-500"
                    required
                  />
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
                    Actual: {formatCOP(monthlyProfitGoal)}
                  </p>
                </div>

                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-400 uppercase mb-1.5">
                    Presupuesto para Compras (COP)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="50000"
                    value={monthlyPurchasesBudget}
                    onChange={(e) =>
                      setMonthlyPurchasesBudget(Math.max(0, Number(e.target.value) || 0))
                    }
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-[#1e293b] rounded-xl text-slate-900 dark:text-white font-bold tabular-nums focus:outline-none focus:border-blue-500"
                    required
                  />
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
                    Actual: {formatCOP(monthlyPurchasesBudget)}
                  </p>
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-[#1e293b]">
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl shadow-md transition-all flex items-center space-x-2"
                >
                  <Save className="w-4 h-4" />
                  <span>Guardar Metas y Presupuesto</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: CONFIGURACIÓN DE GASTOS FIJOS                                  */}
      {/* ===================================================================== */}
      {activeSection === 'fixed_expenses' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#0d1322] border border-slate-200 dark:border-[#1e293b] rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Plantilla de Gastos Fijos Periódicos
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Establece el valor, periodicidad y fecha de vencimiento de cada obligación fija sin alterar el historial ya contabilizado.
              </p>
            </div>
            <button
              type="button"
              onClick={handleOpenNewFixed}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl text-xs shadow-sm flex items-center gap-2 whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>Nuevo Gasto Fijo</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-[#0d1322] border border-slate-200 dark:border-[#1e293b] rounded-2xl p-5">
              <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">
                Gastos Fijos Activos
              </p>
              <p className="text-2xl font-black text-slate-900 dark:text-white mt-1 tabular-nums">
                {activeFixedCount}{' '}
                <span className="text-xs font-medium text-slate-500">
                  de {settings.fixedExpensesConfig.length}
                </span>
              </p>
            </div>
            <div className="bg-white dark:bg-[#0d1322] border border-slate-200 dark:border-[#1e293b] rounded-2xl p-5">
              <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">
                Carga Mensual Equivalente
              </p>
              <p className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1 tabular-nums">
                {formatCOP(totalMonthlyFixed)}
              </p>
            </div>
            <div className="bg-white dark:bg-[#0d1322] border border-slate-200 dark:border-[#1e293b] rounded-2xl p-5">
              <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">
                Cobertura Frente a Meta Ventas
              </p>
              <p className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1 tabular-nums">
                {settings.monthlySalesGoal > 0
                  ? `${((totalMonthlyFixed / settings.monthlySalesGoal) * 100).toFixed(1)}%`
                  : '0.0%'}
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-[#0d1322] border border-slate-200 dark:border-[#1e293b] rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-[#111827] border-b border-slate-200 dark:border-[#1e293b] text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">
                    <th className="p-4">Concepto / Categoría</th>
                    <th className="p-4">Periodicidad</th>
                    <th className="p-4">Vencimiento</th>
                    <th className="p-4 text-right">Valor Configurado</th>
                    <th className="p-4 text-right">Equiv. Mensual</th>
                    <th className="p-4 text-center">Estado</th>
                    <th className="p-4 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-[#1e293b]">
                  {settings.fixedExpensesConfig.map((fe) => {
                    const statusBadge = getDueStatus(fe.dueDate, fe.active);
                    const monthlyEq = calculateMonthlyEquivalent(fe.amount, fe.frequency);
                    return (
                      <tr
                        key={fe.id}
                        className={`hover:bg-slate-50 dark:hover:bg-[#111827]/50 transition-colors ${
                          !fe.active ? 'opacity-65' : ''
                        }`}
                      >
                        <td className="p-4">
                          <p className="font-bold text-slate-900 dark:text-white">{fe.name}</p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            {fe.category} • {fe.paymentMethod}
                          </p>
                        </td>
                        <td className="p-4 font-semibold text-slate-700 dark:text-slate-300">
                          {fe.frequency}
                        </td>
                        <td className="p-4 tabular-nums text-slate-700 dark:text-slate-300">
                          {formatDate(fe.dueDate)}
                        </td>
                        <td className="p-4 text-right font-bold text-slate-900 dark:text-white tabular-nums">
                          {formatCOP(fe.amount)}
                        </td>
                        <td className="p-4 text-right font-semibold text-rose-600 dark:text-rose-400 tabular-nums">
                          {formatCOP(monthlyEq)}
                        </td>
                        <td className="p-4 text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleFixedActive(fe)}
                            title="Alternar activo/pausado"
                            className={`inline-flex px-2.5 py-1 rounded-md text-[10px] font-semibold ${statusBadge.cls}`}
                          >
                            {statusBadge.label}
                          </button>
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {onQuickRegisterFixedExpense && (
                              <button
                                type="button"
                                disabled={registeringFeId === fe.id}
                                onClick={async () => {
                                  setRegisteringFeId(fe.id);
                                  try {
                                    await onQuickRegisterFixedExpense(fe);
                                    notifySaved(`Gasto real registrado desde "${fe.name}".`);
                                  } finally {
                                    setRegisteringFeId(null);
                                  }
                                }}
                                title="Registrar pago real en Gastos"
                                className="px-2.5 py-1.5 bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/25 rounded-lg text-[11px] font-semibold flex items-center gap-1"
                              >
                                <Receipt className="w-3.5 h-3.5" />
                                <span>Registrar</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleOpenEditFixed(fe)}
                              title="Editar gasto fijo"
                              className="p-1.5 bg-slate-100 dark:bg-[#111827] text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-lg"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteFixedTarget(fe)}
                              title="Eliminar gasto fijo"
                              className="p-1.5 bg-rose-50 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500/25 rounded-lg"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {settings.fixedExpensesConfig.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center py-10 text-slate-500">
                        No hay gastos fijos configurados todavía. Haz clic en "Nuevo Gasto Fijo" para agregar uno.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 4: CATEGORÍAS Y MEDIOS DE PAGO                                    */}
      {/* ===================================================================== */}
      {activeSection === 'catalogs' && (
        <div className="space-y-6 text-xs">
          {catalogError && (
            <div className="p-4 bg-rose-50 dark:bg-rose-500/15 border border-rose-200 dark:border-rose-500/30 rounded-xl text-rose-700 dark:text-rose-300 flex items-center gap-2 font-medium">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{catalogError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Categorías de Ventas */}
            <div className="bg-white dark:bg-[#0d1322] border border-slate-200 dark:border-[#1e293b] rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-[#1e293b]">
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                    Categorías de Ventas ({settings.saleCategories.length})
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Servicios y productos disponibles al facturar ventas
                  </p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    await onUpdateSettings({
                      ...settings,
                      saleCategories: [...DEFAULT_SALE_CATEGORIES],
                    });
                    notifySaved('Categorías de ventas restauradas a valores predeterminados.');
                  }}
                  className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Restaurar base
                </button>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  maxLength={80}
                  placeholder="Nueva categoría de venta..."
                  value={newSaleCategory}
                  onChange={(e) => setNewSaleCategory(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddSaleCategory();
                    }
                  }}
                  className="flex-1 px-3.5 py-2 bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-[#1e293b] rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={handleAddSaleCategory}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Agregar</span>
                </button>
              </div>

              <div className="divide-y divide-slate-200 dark:divide-[#1e293b] border border-slate-200 dark:border-[#1e293b] rounded-xl max-h-80 overflow-y-auto">
                {settings.saleCategories.map((cat, idx) => (
                  <div
                    key={`${cat}-${idx}`}
                    className="px-3.5 py-2.5 flex items-center justify-between gap-2 bg-white dark:bg-[#0d1322]"
                  >
                    {editingSaleCatIdx === idx ? (
                      <div className="flex-1 flex items-center gap-2">
                        <input
                          type="text"
                          maxLength={80}
                          value={editingSaleCatVal}
                          onChange={(e) => setEditingSaleCatVal(e.target.value)}
                          className="flex-1 px-2.5 py-1 bg-slate-50 dark:bg-[#0f172a] border border-blue-500 rounded-lg text-slate-900 dark:text-white"
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveSaleCategoryRename(idx)}
                          className="p-1.5 bg-emerald-600 text-white rounded-lg"
                          title="Guardar nombre"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingSaleCatIdx(null)}
                          className="p-1.5 bg-slate-200 dark:bg-[#1e293b] text-slate-700 dark:text-slate-300 rounded-lg"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="font-medium text-slate-800 dark:text-slate-200">{cat}</span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingSaleCatIdx(idx);
                              setEditingSaleCatVal(cat);
                            }}
                            className="p-1.5 text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg"
                            title="Editar"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteSaleCategory(idx)}
                            className="p-1.5 text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg"
                            title="Eliminar"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Medios de Pago */}
            <div className="bg-white dark:bg-[#0d1322] border border-slate-200 dark:border-[#1e293b] rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-[#1e293b]">
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                    Medios de Pago ({settings.paymentMethods.length})
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Métodos habilitados en ventas, gastos y órdenes de compra
                  </p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    await onUpdateSettings({
                      ...settings,
                      paymentMethods: [...DEFAULT_PAYMENT_METHODS],
                    });
                    notifySaved('Medios de pago restaurados a valores predeterminados.');
                  }}
                  className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Restaurar base
                </button>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  maxLength={50}
                  placeholder="Ej. Bancolombia QR, Datafono..."
                  value={newPaymentMethod}
                  onChange={(e) => setNewPaymentMethod(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddPaymentMethod();
                    }
                  }}
                  className="flex-1 px-3.5 py-2 bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-[#1e293b] rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={handleAddPaymentMethod}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Agregar</span>
                </button>
              </div>

              <div className="divide-y divide-slate-200 dark:divide-[#1e293b] border border-slate-200 dark:border-[#1e293b] rounded-xl max-h-80 overflow-y-auto">
                {settings.paymentMethods.map((pm, idx) => (
                  <div
                    key={`${pm}-${idx}`}
                    className="px-3.5 py-2.5 flex items-center justify-between gap-2 bg-white dark:bg-[#0d1322]"
                  >
                    {editingPmIdx === idx ? (
                      <div className="flex-1 flex items-center gap-2">
                        <input
                          type="text"
                          maxLength={50}
                          value={editingPmVal}
                          onChange={(e) => setEditingPmVal(e.target.value)}
                          className="flex-1 px-2.5 py-1 bg-slate-50 dark:bg-[#0f172a] border border-blue-500 rounded-lg text-slate-900 dark:text-white"
                        />
                        <button
                          type="button"
                          onClick={() => handleSavePaymentMethodRename(idx)}
                          className="p-1.5 bg-emerald-600 text-white rounded-lg"
                          title="Guardar nombre"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingPmIdx(null)}
                          className="p-1.5 bg-slate-200 dark:bg-[#1e293b] text-slate-700 dark:text-slate-300 rounded-lg"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="font-medium text-slate-800 dark:text-slate-200">{pm}</span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingPmIdx(idx);
                              setEditingPmVal(pm);
                            }}
                            className="p-1.5 text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg"
                            title="Editar"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeletePaymentMethod(idx)}
                            className="p-1.5 text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg"
                            title="Eliminar"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Categorías de Gastos por Tipo */}
          <div className="bg-white dark:bg-[#0d1322] border border-slate-200 dark:border-[#1e293b] rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-[#1e293b]">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                  Categorías de Gastos por Tipo
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Administra las categorías para gastos fijos, variables y extraordinarios sin afectar registros previos
                </p>
              </div>
              <div className="flex items-center gap-2">
                {(['Fijo', 'Variable', 'Extraordinario'] as ExpenseType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      setActiveExpCatType(t);
                      setEditingExpCatIdx(null);
                    }}
                    className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                      activeExpCatType === t
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 dark:bg-[#111827] text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {t} ({settings.expenseCategories[t].length})
                  </button>
                ))}
                <button
                  type="button"
                  onClick={async () => {
                    await onUpdateSettings({
                      ...settings,
                      expenseCategories: {
                        Fijo: [...DEFAULT_EXPENSE_CATEGORIES.Fijo],
                        Variable: [...DEFAULT_EXPENSE_CATEGORIES.Variable],
                        Extraordinario: [...DEFAULT_EXPENSE_CATEGORIES.Extraordinario],
                      },
                    });
                    notifySaved('Categorías de gastos restauradas a valores predeterminados.');
                  }}
                  className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline ml-2"
                >
                  Restaurar base
                </button>
              </div>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                maxLength={80}
                placeholder={`Nueva categoría para gastos ${activeExpCatType}...`}
                value={newExpCategory}
                onChange={(e) => setNewExpCategory(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddExpCategory();
                  }
                }}
                className="flex-1 px-3.5 py-2 bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-[#1e293b] rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
              />
              <button
                type="button"
                onClick={handleAddExpCategory}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Agregar</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {settings.expenseCategories[activeExpCatType].map((cat, idx) => (
                <div
                  key={`${cat}-${idx}`}
                  className="px-3.5 py-2.5 bg-slate-50 dark:bg-[#111827] border border-slate-200 dark:border-[#1e293b] rounded-xl flex items-center justify-between gap-2"
                >
                  {editingExpCatIdx === idx ? (
                    <div className="flex-1 flex items-center gap-1.5">
                      <input
                        type="text"
                        maxLength={80}
                        value={editingExpCatVal}
                        onChange={(e) => setEditingExpCatVal(e.target.value)}
                        className="flex-1 min-w-0 px-2 py-1 bg-white dark:bg-[#0f172a] border border-blue-500 rounded-lg text-slate-900 dark:text-white"
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveExpCategoryRename(idx)}
                        className="p-1 bg-emerald-600 text-white rounded-md"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingExpCatIdx(null)}
                        className="p-1 bg-slate-200 dark:bg-[#1e293b] text-slate-700 dark:text-slate-300 rounded-md"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                        {cat}
                      </span>
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingExpCatIdx(idx);
                            setEditingExpCatVal(cat);
                          }}
                          className="p-1 text-slate-500 hover:text-blue-600 dark:hover:text-blue-400"
                          title="Editar"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteExpCategory(idx)}
                          className="p-1 text-slate-500 hover:text-rose-600 dark:hover:text-rose-400"
                          title="Eliminar"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 5: APARIENCIA, EXPORTACIÓN Y RESPALDOS                            */}
      {/* ===================================================================== */}
      {activeSection === 'backups' && (
        <div className="space-y-6">
          {/* Appearance Selector */}
          <div className="bg-white dark:bg-[#0d1322] border border-slate-200 dark:border-[#1e293b] rounded-2xl p-6 sm:p-8 shadow-sm dark:shadow-xl text-xs transition-colors">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                  Apariencia de la Interfaz
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Selecciona entre modo oscuro o modo claro según tu preferencia
                </p>
              </div>
              <div className="flex items-center gap-2 p-1 bg-slate-100 dark:bg-[#111827] border border-slate-200 dark:border-[#1e293b] rounded-xl">
                <button
                  type="button"
                  onClick={() => setTheme('light')}
                  className={`px-3.5 py-2 rounded-lg font-semibold flex items-center gap-1.5 transition-all ${
                    theme === 'light'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Sun className="w-3.5 h-3.5" />
                  <span>Modo Claro</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTheme('dark')}
                  className={`px-3.5 py-2 rounded-lg font-semibold flex items-center gap-1.5 transition-all ${
                    theme === 'dark'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Moon className="w-3.5 h-3.5" />
                  <span>Modo Oscuro</span>
                </button>
              </div>
            </div>
          </div>

          {/* Centro de Exportación Excel & PDF */}
          <div className="bg-white dark:bg-[#0d1322] border border-slate-200 dark:border-[#1e293b] rounded-2xl p-6 sm:p-8 shadow-sm dark:shadow-xl space-y-6 text-xs transition-colors">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-[#1e293b]">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                  Centro de Exportación (Excel y PDF)
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Exporta módulos individuales o el libro consolidado con nombre del negocio, periodo, fecha de generación, totales y detalles.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  Periodo:
                </span>
                <input
                  type="date"
                  value={expDateFrom}
                  onChange={(e) => setExpDateFrom(e.target.value)}
                  aria-label="Fecha desde exportación"
                  className="px-3 py-1.5 bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-[#1e293b] rounded-lg text-xs text-slate-900 dark:text-white"
                />
                <span className="text-slate-400">a</span>
                <input
                  type="date"
                  value={expDateTo}
                  onChange={(e) => setExpDateTo(e.target.value)}
                  aria-label="Fecha hasta exportación"
                  className="px-3 py-1.5 bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-[#1e293b] rounded-lg text-xs text-slate-900 dark:text-white"
                />
                {(expDateFrom || expDateTo) && (
                  <button
                    type="button"
                    onClick={() => {
                      setExpDateFrom('');
                      setExpDateTo('');
                    }}
                    className="px-2.5 py-1.5 bg-slate-100 dark:bg-[#111827] text-slate-600 dark:text-slate-300 rounded-lg text-[11px] font-semibold"
                  >
                    Limpiar
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                {
                  title: 'Ventas',
                  count: `${filteredSales.length} registros en periodo`,
                  onExcel: () => exportSalesToExcel(filteredSales, settings, exportMeta),
                  onPDF: () => exportSalesToPDF(filteredSales, settings, exportMeta),
                },
                {
                  title: 'Gastos',
                  count: `${filteredExpenses.length} registros en periodo`,
                  onExcel: () => exportExpensesToExcel(filteredExpenses, settings, exportMeta),
                  onPDF: () => exportExpensesToPDF(filteredExpenses, settings, exportMeta),
                },
                {
                  title: 'Compras a Proveedores',
                  count: `${filteredPurchases.length} registros en periodo`,
                  onExcel: () => exportPurchasesToExcel(filteredPurchases, settings, exportMeta),
                  onPDF: () => exportPurchasesToPDF(filteredPurchases, settings, exportMeta),
                },
                {
                  title: 'Cuentas por Cobrar',
                  count: `${filteredReceivables.length} cuentas pendientes`,
                  onExcel: () =>
                    exportReceivablesToExcel(filteredReceivables, sales, settings, exportMeta),
                  onPDF: () =>
                    exportReceivablesToPDF(filteredReceivables, sales, settings, exportMeta),
                },
              ].map((mod) => (
                <div
                  key={mod.title}
                  className="p-4 bg-slate-50 dark:bg-[#111827] border border-slate-200 dark:border-[#1e293b] rounded-xl flex items-center justify-between gap-3"
                >
                  <div>
                    <p className="font-bold text-slate-900 dark:text-white text-xs">{mod.title}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">{mod.count}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={mod.onExcel}
                      className="px-3 py-2 bg-white dark:bg-[#0d1322] hover:bg-emerald-50 dark:hover:bg-emerald-500/10 border border-slate-200 dark:border-[#1e293b] text-slate-800 dark:text-slate-200 font-semibold rounded-lg flex items-center gap-1.5 transition-colors"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>Excel</span>
                    </button>
                    <button
                      type="button"
                      onClick={mod.onPDF}
                      className="px-3 py-2 bg-white dark:bg-[#0d1322] hover:bg-blue-50 dark:hover:bg-blue-500/10 border border-slate-200 dark:border-[#1e293b] text-slate-800 dark:text-slate-200 font-semibold rounded-lg flex items-center gap-1.5 transition-colors"
                    >
                      <FileText className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      <span>PDF</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="font-bold text-blue-900 dark:text-blue-200 text-xs">
                  Libro Financiero Consolidado Multi-Hoja (.xlsx)
                </p>
                <p className="text-[11px] text-blue-700 dark:text-blue-300/80">
                  Incluye hojas separadas de Resumen, Ventas, Gastos, Compras, Cuentas por Cobrar y Costos de Producción del periodo seleccionado.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  exportConsolidatedWorkbookToExcel({
                    sales: filteredSales,
                    expenses: filteredExpenses,
                    purchases: filteredPurchases,
                    receivables: filteredReceivables,
                    productionCosts: filteredProduction,
                    settings,
                    meta: exportMeta,
                  })
                }
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl shadow-sm transition-colors flex items-center gap-2 whitespace-nowrap"
              >
                <BookOpen className="w-4 h-4" />
                <span>Exportar Libro Completo</span>
              </button>
            </div>
          </div>

          {/* Copias de Seguridad y Restauración Controlada */}
          <div className="bg-white dark:bg-[#0d1322] border border-slate-200 dark:border-[#1e293b] rounded-2xl p-6 sm:p-8 shadow-sm dark:shadow-xl space-y-6 text-xs transition-colors">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-[#1e293b]">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                  <Database className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>Copias de Seguridad y Restauración Controlada</span>
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Estado de sincronización: {isCloudConnected ? 'Cloud Firestore Conectado' : 'Modo Local'}
                  {lastBackupAt ? ` • Último respaldo: ${lastBackupAt}` : ''}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { label: 'Ventas', val: sales.length },
                { label: 'Gastos', val: expenses.length },
                { label: 'Compras', val: purchaseOrders.length },
                { label: 'Producción', val: productionCosts.length },
                { label: 'Proveedores', val: suppliers.length },
                { label: 'Auditoría', val: auditLogs.length },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="p-3 bg-slate-50 dark:bg-[#111827] border border-slate-200 dark:border-[#1e293b] rounded-xl text-center"
                >
                  <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">
                    {stat.label}
                  </p>
                  <p className="text-lg font-black text-slate-900 dark:text-white mt-0.5 tabular-nums">
                    {stat.val}
                  </p>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 bg-slate-50 dark:bg-[#111827] rounded-2xl border border-slate-200 dark:border-[#1e293b]">
              <div>
                <h4 className="font-bold text-slate-900 dark:text-white">
                  1. Crear Copia de Seguridad Completa (.json)
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Descarga un respaldo íntegro de todas las colecciones, plantillas, configuración y auditoría sin modificar ningún dato original.
                </p>
              </div>
              <button
                type="button"
                onClick={onExportData}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-colors flex items-center space-x-2 shadow-sm whitespace-nowrap"
              >
                <Download className="w-4 h-4" />
                <span>Descargar Respaldo</span>
              </button>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 bg-slate-50 dark:bg-[#111827] rounded-2xl border border-slate-200 dark:border-[#1e293b]">
              <div>
                <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>2. Restaurar Copia de Seguridad (Validación Previa)</span>
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Analiza el archivo de respaldo, previsualiza diferencias y elige combinar sin sobrescribir, actualizar o reemplazar de forma controlada.
                </p>
              </div>
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  onChange={handleFileSelected}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2.5 bg-slate-200 dark:bg-[#1e293b] hover:bg-slate-300 dark:hover:bg-[#334155] text-slate-800 dark:text-white font-semibold rounded-xl transition-colors flex items-center space-x-2 whitespace-nowrap"
                >
                  <Upload className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Cargar Respaldo (.json)</span>
                </button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 bg-rose-50 dark:bg-rose-500/10 rounded-2xl border border-rose-200 dark:border-rose-500/30">
              <div>
                <h4 className="font-bold text-rose-700 dark:text-rose-300">
                  Restablecer Datos de Demostración
                </h4>
                <p className="text-[11px] text-rose-600/80 dark:text-rose-300/70">
                  Vuelve a cargar los registros iniciales de demostración.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowResetConfirm(true)}
                className="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-xl transition-colors flex items-center space-x-2 whitespace-nowrap"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Restablecer Demo</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: AGREGAR / EDITAR GASTO FIJO                                    */}
      {/* ===================================================================== */}
      {isFixedModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/75 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-[#0d1322] border border-slate-200 dark:border-[#1e293b] rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-slate-50 dark:bg-[#111827] text-slate-900 dark:text-white p-5 flex items-center justify-between border-b border-slate-200 dark:border-[#1e293b]">
              <h3 className="text-base font-bold">
                {editingFixed ? 'Editar Gasto Fijo Configurado' : 'Nuevo Gasto Fijo Recurrente'}
              </h3>
              <button
                type="button"
                onClick={() => setIsFixedModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveFixedExpense} className="p-6 overflow-y-auto space-y-4 text-xs">
              {fixedError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-500/15 border border-rose-200 dark:border-rose-500/30 rounded-xl text-rose-700 dark:text-rose-300 font-medium">
                  {fixedError}
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">
                  Nombre o Concepto *
                </label>
                <input
                  type="text"
                  maxLength={150}
                  placeholder="Ej. Arriendo local comercial"
                  value={feName}
                  onChange={(e) => setFeName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-[#1e293b] rounded-xl text-slate-900 dark:text-white font-medium"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">
                    Categoría *
                  </label>
                  <select
                    value={feCategory}
                    onChange={(e) => setFeCategory(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-[#1e293b] rounded-xl text-slate-900 dark:text-white font-medium"
                  >
                    {Array.from(new Set([...settings.expenseCategories.Fijo, feCategory])).map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">
                    Valor (COP) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1000"
                    value={feAmount}
                    onChange={(e) => setFeAmount(parseFloat(e.target.value) || 0)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-[#1e293b] rounded-xl font-bold text-rose-600 dark:text-rose-400 tabular-nums"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">
                    Periodicidad *
                  </label>
                  <select
                    value={feFrequency}
                    onChange={(e) => setFeFrequency(e.target.value as FixedExpenseFrequency)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-[#1e293b] rounded-xl text-slate-900 dark:text-white font-medium"
                  >
                    {FIXED_EXPENSE_FREQUENCIES.map((freq) => (
                      <option key={freq} value={freq}>
                        {freq}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
                    Equivalente mensual: {formatCOP(calculateMonthlyEquivalent(feAmount, feFrequency))}
                  </p>
                </div>

                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">
                    Fecha de Vencimiento *
                  </label>
                  <input
                    type="date"
                    value={feDueDate}
                    onChange={(e) => setFeDueDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-[#1e293b] rounded-xl text-slate-900 dark:text-white font-medium"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">
                  Medio de Pago Habitual
                </label>
                <select
                  value={fePaymentMethod}
                  onChange={(e) => setFePaymentMethod(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-[#1e293b] rounded-xl text-slate-900 dark:text-white font-medium"
                >
                  {Array.from(new Set([...settings.paymentMethods, fePaymentMethod])).map((pm) => (
                    <option key={pm} value={pm}>
                      {pm}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2.5 pt-1">
                <input
                  type="checkbox"
                  id="feActiveCheck"
                  checked={feActive}
                  onChange={(e) => setFeActive(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600"
                />
                <label htmlFor="feActiveCheck" className="text-slate-700 dark:text-slate-200 font-medium cursor-pointer">
                  Gasto fijo activo en proyección mensual
                </label>
              </div>

              <div>
                <label className="block font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">
                  Notas u Observaciones
                </label>
                <textarea
                  rows={2}
                  maxLength={300}
                  value={feNotes}
                  onChange={(e) => setFeNotes(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-[#1e293b] rounded-xl text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-200 dark:border-[#1e293b]">
                <button
                  type="button"
                  onClick={() => setIsFixedModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-[#1e293b] text-slate-700 dark:text-slate-200 font-semibold rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl shadow-sm"
                >
                  Guardar Gasto Fijo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Confirmación Eliminar Gasto Fijo */}
      {deleteFixedTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/75 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-[#0d1322] border border-slate-200 dark:border-[#1e293b] rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center space-y-4">
            <div className="w-12 h-12 bg-rose-50 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-full flex items-center justify-center mx-auto border border-rose-200 dark:border-rose-500/30">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">¿Eliminar Gasto Fijo?</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Se eliminará la plantilla <span className="font-bold text-slate-900 dark:text-white">{deleteFixedTarget.name}</span> ({formatCOP(deleteFixedTarget.amount)}). Los gastos ya registrados en el historial permanecerán intactos.
            </p>
            <div className="flex justify-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeleteFixedTarget(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-[#111827] text-slate-700 dark:text-slate-300 font-semibold rounded-xl text-xs"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteFixedConfirm}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-xl text-xs"
              >
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Restauración Controlada */}
      {pendingBackup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/75 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-[#0d1322] border border-slate-200 dark:border-[#1e293b] rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-slate-50 dark:bg-[#111827] text-slate-900 dark:text-white p-5 flex items-center justify-between border-b border-slate-200 dark:border-[#1e293b]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-600 text-white rounded-xl">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold">
                    Restauración Controlada de Copia de Seguridad
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Revisa el contenido del respaldo y selecciona exactamente cómo aplicar los datos
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPendingBackup(null)}
                disabled={isRestoring}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 text-xs flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-slate-50 dark:bg-[#111827] border border-slate-200 dark:border-[#1e293b] rounded-xl">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">
                    Negocio en Respaldo
                  </span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {pendingBackup.metadata?.companyName ||
                      pendingBackup.settings?.companyName ||
                      'Maleja Diseños'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">
                    Fecha de Exportación
                  </span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {pendingBackup.exportDate
                      ? new Date(pendingBackup.exportDate).toLocaleString('es-CO')
                      : 'No especificada'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">
                    Generado por
                  </span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {pendingBackup.metadata?.createdBy || 'Sistema'}
                  </span>
                </div>
              </div>

              {pendingWarnings.length > 0 && (
                <div className="p-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl text-amber-800 dark:text-amber-300 space-y-1">
                  <p className="font-bold">Advertencias de validación ({pendingWarnings.length}):</p>
                  <ul className="list-disc pl-4 text-[11px]">
                    {pendingWarnings.slice(0, 5).map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="space-y-2">
                <p className="font-bold text-slate-700 dark:text-slate-300 uppercase text-[11px]">
                  1. Modo de Restauración
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {[
                    {
                      id: 'merge_missing' as const,
                      title: 'Combinar Seguro (Recomendado)',
                      desc: 'Solo agrega registros nuevos cuyo ID no exista. No sobrescribe ni elimina nada.',
                    },
                    {
                      id: 'upsert' as const,
                      title: 'Combinar y Actualizar',
                      desc: 'Actualiza los registros existentes con igual ID y agrega los nuevos sin eliminar otros.',
                    },
                    {
                      id: 'replace' as const,
                      title: 'Reemplazo Controlado',
                      desc: 'Descarga un respaldo preventivo automático y reemplaza los módulos marcados.',
                    },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setRestoreMode(opt.id)}
                      className={`p-3.5 rounded-xl border text-left transition-all ${
                        restoreMode === opt.id
                          ? 'border-blue-600 bg-blue-50 dark:bg-blue-600/15 ring-1 ring-blue-600'
                          : 'border-slate-200 dark:border-[#1e293b] bg-slate-50 dark:bg-[#111827] hover:border-slate-300 dark:hover:border-slate-600'
                      }`}
                    >
                      <p
                        className={`font-bold ${
                          restoreMode === opt.id
                            ? 'text-blue-700 dark:text-blue-300'
                            : 'text-slate-900 dark:text-white'
                        }`}
                      >
                        {opt.title}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">{opt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="font-bold text-slate-700 dark:text-slate-300 uppercase text-[11px]">
                  2. Módulos a Restaurar y Comparación
                </p>
                <div className="overflow-x-auto border border-slate-200 dark:border-[#1e293b] rounded-xl">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-[#111827] border-b border-slate-200 dark:border-[#1e293b] text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">
                        <th className="p-3">Incluir</th>
                        <th className="p-3">Módulo</th>
                        <th className="p-3 text-center">Actuales</th>
                        <th className="p-3 text-center">En Respaldo</th>
                        <th className="p-3 text-center">Resultado Estimado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-[#1e293b]">
                      {previewStats.map((row) => (
                        <tr key={row.key} className="hover:bg-slate-50 dark:hover:bg-[#111827]/40">
                          <td className="p-3">
                            <input
                              type="checkbox"
                              checked={moduleSelection[row.key]}
                              onChange={(e) =>
                                setModuleSelection({ ...moduleSelection, [row.key]: e.target.checked })
                              }
                              className="w-4 h-4 rounded text-blue-600"
                            />
                          </td>
                          <td className="p-3 font-bold text-slate-900 dark:text-white">{row.label}</td>
                          <td className="p-3 text-center text-slate-600 dark:text-slate-300">
                            {row.current}
                          </td>
                          <td className="p-3 text-center text-blue-600 dark:text-blue-400 font-bold">
                            {row.incoming}
                          </td>
                          <td className="p-3 text-center">
                            {moduleSelection[row.key] ? (
                              <span className="px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-semibold text-[11px]">
                                {row.diff.result.length} total (+{row.diff.added} nuevos
                                {row.diff.updated > 0 ? `, ${row.diff.updated} act.` : ''})
                              </span>
                            ) : (
                              <span className="text-slate-400 text-[11px]">Omitido</span>
                            )}
                          </td>
                        </tr>
                      ))}

                      {pendingBackup.settings && (
                        <tr className="hover:bg-slate-50 dark:hover:bg-[#111827]/40">
                          <td className="p-3">
                            <input
                              type="checkbox"
                              checked={moduleSelection.settings}
                              onChange={(e) =>
                                setModuleSelection({ ...moduleSelection, settings: e.target.checked })
                              }
                              className="w-4 h-4 rounded text-blue-600"
                            />
                          </td>
                          <td className="p-3 font-bold text-slate-900 dark:text-white">
                            Configuración del Negocio
                          </td>
                          <td className="p-3 text-center text-slate-500">1</td>
                          <td className="p-3 text-center text-blue-600 dark:text-blue-400 font-bold">1</td>
                          <td className="p-3 text-center text-slate-600 dark:text-slate-300">
                            {moduleSelection.settings ? 'Se actualizará configuración' : 'Sin cambios'}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {restoreMode === 'replace' && (
                <div className="p-4 bg-rose-50 dark:bg-rose-500/15 border border-rose-200 dark:border-rose-500/30 rounded-xl space-y-2">
                  <p className="font-bold text-rose-700 dark:text-rose-300 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Confirmación de Reemplazo Total</span>
                  </p>
                  <p className="text-[11px] text-rose-600 dark:text-rose-300/80">
                    Antes de reemplazar, el sistema descargará automáticamente un respaldo de seguridad del estado actual. Para continuar, escribe{' '}
                    <strong>RESTAURAR</strong>:
                  </p>
                  <input
                    type="text"
                    placeholder="Escribe RESTAURAR"
                    value={confirmReplaceWord}
                    onChange={(e) => setConfirmReplaceWord(e.target.value)}
                    className="w-full sm:w-64 px-3 py-2 bg-white dark:bg-[#0f172a] border border-rose-300 dark:border-rose-500/40 rounded-lg text-slate-900 dark:text-white font-bold uppercase"
                  />
                </div>
              )}
            </div>

            <div className="bg-slate-50 dark:bg-[#111827] border-t border-slate-200 dark:border-[#1e293b] p-4 flex justify-end gap-3">
              <button
                type="button"
                disabled={isRestoring}
                onClick={() => setPendingBackup(null)}
                className="px-4 py-2 bg-slate-200 dark:bg-[#1e293b] hover:bg-slate-300 dark:hover:bg-[#334155] text-slate-800 dark:text-slate-200 font-semibold rounded-xl text-xs"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={
                  isRestoring ||
                  (restoreMode === 'replace' &&
                    confirmReplaceWord.trim().toUpperCase() !== 'RESTAURAR')
                }
                onClick={handleExecuteRestore}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold rounded-xl text-xs shadow-md flex items-center gap-2"
              >
                {isRestoring ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    <span>Restaurando...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Confirmar Restauración</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmación de Restablecimiento */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/75 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-[#0d1322] border border-slate-200 dark:border-[#1e293b] rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  ¿Restablecer datos locales de demostración?
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                  Esta acción devolverá las tablas locales a los valores iniciales de demostración. Recomendamos descargar una copia de seguridad antes de continuar.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="px-4 py-2 bg-slate-100 dark:bg-[#1e293b] text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  onResetData();
                  setShowResetConfirm(false);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold"
              >
                Confirmar Restablecimiento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
