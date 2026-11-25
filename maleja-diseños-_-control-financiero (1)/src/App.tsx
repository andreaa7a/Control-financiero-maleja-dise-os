import React, { useState, useEffect, useMemo } from 'react';
import {
  Sale,
  Expense,
  ProductionCost,
  Supplier,
  PurchaseOrder,
  BusinessSettings,
  AccountReceivable,
  MaterialTemplate,
  AuditLog,
  FixedExpenseConfig,
} from './types/finance';
import {
  initialSales,
  initialExpenses,
  initialProductionCosts,
  initialSuppliers,
  initialPurchaseOrders,
  initialSettings,
  initialMaterialTemplates,
} from './data/initialData';
import { Navbar, GlobalSearchResult } from './components/Navbar';
import { Sidebar, ActiveTab } from './components/Sidebar';
import { AiAssistantModal } from './components/AiAssistantModal';
import { AuthView } from './components/AuthView';
import { getTodayString, formatCOP } from './utils/formatters';
import {
  fetchCollectionData,
  saveDocumentStrict,
  deleteDocumentStrict,
  batchRestoreCollection,
  checkFirestoreStatus,
  sendUserEmailVerification,
  reloadCurrentUser,
  auth,
  logoutUser,
  onAuthStateChanged,
  User,
} from './services/firebaseService';
import {
  createBackupPayload,
  downloadBackupJson,
  mergeCollectionByMode,
  BackupPayload,
  RestoreMode,
  RestoreModuleSelection,
} from './utils/backupUtils';

import { DashboardView } from './views/DashboardView';
import { SalesView } from './views/SalesView';
import { ExpensesView } from './views/ExpensesView';
import { ProductionView } from './views/ProductionView';
import { SuppliersView } from './views/SuppliersView';
import { ReceivablesView } from './views/ReceivablesView';
import { HistoryView } from './views/HistoryView';
import { ReportsView } from './views/ReportsView';
import { SettingsView } from './views/SettingsView';
import {
  X,
  Cloud,
  CloudOff,
  AlertCircle,
  ShieldAlert,
  MailCheck,
  RefreshCw,
  LogOut,
} from 'lucide-react';
import { validatePaymentInput, generateUniqueId } from './utils/validation';
import { normalizeBusinessSettings } from './utils/settingsUtils';

const PRIMARY_OWNER_EMAIL = 'malejacalcas@gmail.com';

type AuthAccessState = 'checking' | 'authorized' | 'unverified' | 'unauthorized';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [authAccessState, setAuthAccessState] = useState<AuthAccessState>('checking');
  const [verificationFeedback, setVerificationFeedback] = useState<string | null>(null);
  const [authActionLoading, setAuthActionLoading] = useState(false);

  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isCloudConnected, setIsCloudConnected] = useState<boolean | null>(null);
  const [cloudBannerError, setCloudBannerError] = useState<string | null>(null);

  // Persistent state
  const [sales, setSales] = useState<Sale[]>(() => {
    const saved = localStorage.getItem('maleja_sales');
    return saved ? JSON.parse(saved) : initialSales;
  });

  const [expenses, setExpenses] = useState<Expense[]>(() => {
    const saved = localStorage.getItem('maleja_expenses');
    return saved ? JSON.parse(saved) : initialExpenses;
  });

  const [productionCosts, setProductionCosts] = useState<ProductionCost[]>(() => {
    const saved = localStorage.getItem('maleja_production');
    if (saved) {
      try {
        const parsed: any[] = JSON.parse(saved);
        return parsed.map((pc) => {
          const qty = pc.quantityProduced || 1;
          const matTot =
            pc.materialTotalCost !== undefined ? pc.materialTotalCost : pc.materialCost || 0;
          const lab = pc.laborCost || 0;
          const oth = pc.otherCosts !== undefined ? pc.otherCosts : pc.machineCost || 0;
          const tot = pc.totalCost !== undefined ? pc.totalCost : matTot + lab + oth;
          const unit = pc.unitCost !== undefined ? pc.unitCost : tot / qty;
          const sale = pc.salePrice || 0;
          const profit = pc.grossProfit !== undefined ? pc.grossProfit : sale - tot;
          const margin =
            pc.profitMargin !== undefined ? pc.profitMargin : sale > 0 ? (profit / sale) * 100 : 0;

          return {
            id: pc.id || `PC-${Math.floor(100 + Math.random() * 900)}`,
            date: pc.date || getTodayString(),
            orderReference: pc.orderReference || 'OTRO',
            clientName: pc.clientName || 'Cliente General',
            productName: pc.productName || pc.description || 'Producto Gráfico',
            quantityProduced: qty,
            materialName: pc.materialName || 'Materiales Varios',
            materialQuantity: pc.materialQuantity || 1,
            materialUnitPrice: pc.materialUnitPrice || matTot,
            materialTotalCost: matTot,
            laborCost: lab,
            productionTime: pc.productionTime || '1 hora',
            otherCosts: oth,
            totalCost: tot,
            unitCost: unit,
            salePrice: sale,
            grossProfit: profit,
            profitMargin: margin,
            description: pc.description || 'Costo de producción',
          };
        });
      } catch (e) {
        console.error('Error parsing production costs', e);
      }
    }
    return initialProductionCosts;
  });

  const [materialTemplates, setMaterialTemplates] = useState<MaterialTemplate[]>(() => {
    const saved = localStorage.getItem('maleja_material_templates');
    return saved ? JSON.parse(saved) : initialMaterialTemplates;
  });

  const [suppliers, setSuppliers] = useState<Supplier[]>(() => {
    const saved = localStorage.getItem('maleja_suppliers');
    return saved ? JSON.parse(saved) : initialSuppliers;
  });

  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>(() => {
    const saved = localStorage.getItem('maleja_purchases');
    return saved ? JSON.parse(saved) : initialPurchaseOrders;
  });

  const [settings, setSettings] = useState<BusinessSettings>(() => {
    const saved = localStorage.getItem('maleja_settings');
    if (saved) {
      try {
        return normalizeBusinessSettings(JSON.parse(saved));
      } catch {
        return initialSettings;
      }
    }
    return initialSettings;
  });

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => {
    const saved = localStorage.getItem('maleja_audit');
    return saved ? JSON.parse(saved) : [];
  });

  const [lastBackupAt, setLastBackupAt] = useState<string | null>(() => {
    return localStorage.getItem('maleja_last_backup_at');
  });

  // Auth observer
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setVerificationFeedback(null);
      setCloudBannerError(null);
      setAuthChecked(true);
    });
    return () => unsubscribe();
  }, []);

  // Verify access and sync with Cloud Firestore once user is authenticated
  useEffect(() => {
    if (!authChecked) return;
    if (!currentUser) {
      setIsCloudConnected(null);
      setAuthAccessState('checking');
      return;
    }

    const user = currentUser;
    let cancelled = false;

    async function initCloudSync() {
      setAuthAccessState('checking');

      if (!user.emailVerified) {
        if (!cancelled) {
          setIsCloudConnected(false);
          setAuthAccessState('unverified');
        }
        return;
      }

      const cloudStatus = await checkFirestoreStatus();
      if (cancelled) return;

      if (cloudStatus === 'permission-denied') {
        setIsCloudConnected(false);
        setAuthAccessState('unauthorized');
        return;
      }

      if (cloudStatus === 'offline') {
        const isPrimary = (user.email || '').toLowerCase() === PRIMARY_OWNER_EMAIL;
        setIsCloudConnected(false);
        setAuthAccessState(isPrimary ? 'authorized' : 'unauthorized');
        return;
      }

      setIsCloudConnected(true);
      setAuthAccessState('authorized');

      const [
        cloudSales,
        cloudExpenses,
        cloudProd,
        cloudSuppliers,
        cloudPurchases,
        cloudAudit,
        cloudSettings,
        cloudMaterials,
      ] = await Promise.all([
        fetchCollectionData<Sale>('sales'),
        fetchCollectionData<Expense>('expenses'),
        fetchCollectionData<ProductionCost>('productionCosts'),
        fetchCollectionData<Supplier>('suppliers'),
        fetchCollectionData<PurchaseOrder>('purchaseOrders'),
        fetchCollectionData<AuditLog>('auditLogs'),
        fetchCollectionData<BusinessSettings & { id?: string }>('settings'),
        fetchCollectionData<MaterialTemplate>('materialTemplates'),
      ]);

      if (cancelled) return;

      const settingsDoc =
        cloudSettings?.find((s) => s.id === 'business') || cloudSettings?.[0];

      const hasAnyCloudData = Boolean(
        settingsDoc ||
          (cloudSales && cloudSales.length > 0) ||
          (cloudExpenses && cloudExpenses.length > 0) ||
          (cloudProd && cloudProd.length > 0) ||
          (cloudSuppliers && cloudSuppliers.length > 0) ||
          (cloudPurchases && cloudPurchases.length > 0) ||
          (cloudAudit && cloudAudit.length > 0)
      );

      if (hasAnyCloudData) {
        if (cloudSales !== null) setSales(cloudSales);
        if (cloudExpenses !== null) setExpenses(cloudExpenses);
        if (cloudProd !== null) setProductionCosts(cloudProd);
        if (cloudSuppliers !== null) setSuppliers(cloudSuppliers);
        if (cloudPurchases !== null) setPurchaseOrders(cloudPurchases);
        if (cloudAudit !== null) {
          setAuditLogs(
            [...cloudAudit].sort((a, b) => b.id.localeCompare(a.id))
          );
        }
        if (settingsDoc) {
          setSettings(normalizeBusinessSettings(settingsDoc));
        }
        if (cloudMaterials && cloudMaterials.length > 0) {
          setMaterialTemplates(cloudMaterials);
        }
      }
    }

    initCloudSync();
    return () => {
      cancelled = true;
    };
  }, [authChecked, currentUser]);

  // Cache authorized business data in localStorage
  useEffect(() => {
    if (authAccessState !== 'authorized') return;
    localStorage.setItem('maleja_sales', JSON.stringify(sales));
  }, [sales, authAccessState]);

  useEffect(() => {
    if (authAccessState !== 'authorized') return;
    localStorage.setItem('maleja_expenses', JSON.stringify(expenses));
  }, [expenses, authAccessState]);

  useEffect(() => {
    if (authAccessState !== 'authorized') return;
    localStorage.setItem('maleja_production', JSON.stringify(productionCosts));
  }, [productionCosts, authAccessState]);

  useEffect(() => {
    if (authAccessState !== 'authorized') return;
    localStorage.setItem('maleja_material_templates', JSON.stringify(materialTemplates));
  }, [materialTemplates, authAccessState]);

  useEffect(() => {
    if (authAccessState !== 'authorized') return;
    localStorage.setItem('maleja_suppliers', JSON.stringify(suppliers));
  }, [suppliers, authAccessState]);

  useEffect(() => {
    if (authAccessState !== 'authorized') return;
    localStorage.setItem('maleja_purchases', JSON.stringify(purchaseOrders));
  }, [purchaseOrders, authAccessState]);

  useEffect(() => {
    if (authAccessState !== 'authorized') return;
    localStorage.setItem('maleja_settings', JSON.stringify(settings));
  }, [settings, authAccessState]);

  useEffect(() => {
    if (authAccessState !== 'authorized') return;
    localStorage.setItem('maleja_audit', JSON.stringify(auditLogs));
  }, [auditLogs, authAccessState]);

  // Strict DB persistence helper (never show false success when Cloud Firestore rejects/fails)
  const persistDocOrThrow = async (collectionName: string, id: string, data: any) => {
    setCloudBannerError(null);
    if (currentUser && isCloudConnected !== false) {
      const res = await saveDocumentStrict(collectionName, id, data);
      if (!res.ok) {
        const msg = res.error || 'Error de conexión con la base de datos.';
        setCloudBannerError(msg);
        throw new Error(msg);
      }
    }
  };

  const persistDeleteOrThrow = async (collectionName: string, id: string) => {
    setCloudBannerError(null);
    if (currentUser && isCloudConnected !== false) {
      const res = await deleteDocumentStrict(collectionName, id);
      if (!res.ok) {
        const msg = res.error || 'Error de conexión al eliminar el registro en la base de datos.';
        setCloudBannerError(msg);
        throw new Error(msg);
      }
    }
  };

  // Audit Logger helper + Cloud Sync (clamped to firestore.rules limits)
  const addAudit = async (
    action: 'CREACIÓN' | 'MODIFICACIÓN' | 'ELIMINACIÓN',
    module: AuditLog['module'],
    description: string
  ) => {
    const newLog: AuditLog = {
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toLocaleString('es-CO').slice(0, 50),
      action,
      module,
      description: description.trim().slice(0, 300),
    };
    setAuditLogs((prev) => [newLog, ...prev]);
    if (currentUser && isCloudConnected !== false) {
      await saveDocumentStrict('auditLogs', newLog.id, newLog);
    }
  };

  // Update Business Settings safely (never modifies historical records)
  const handleUpdateSettings = async (nextSettings: BusinessSettings) => {
    const normalized = normalizeBusinessSettings(nextSettings);
    await persistDocOrThrow('settings', 'business', { id: 'business', ...normalized });
    setSettings(normalized);
    localStorage.setItem('maleja_settings', JSON.stringify(normalized));
    await addAudit(
      'MODIFICACIÓN',
      'Sistema',
      'Actualización de configuración del negocio, metas o gastos fijos'
    );
  };

  // Explicit user action: create a real Expense movement from a configured Fixed Expense template
  const handleQuickRegisterFixedExpense = async (config: FixedExpenseConfig) => {
    const nextId = generateUniqueId(
      `EXP-${new Date().getFullYear()}-`,
      expenses.map((ex) => ex.id)
    );
    const newExp: Expense = {
      id: nextId,
      date: getTodayString(),
      category: config.category.slice(0, 100),
      type: 'Fijo',
      description: config.name.slice(0, 200),
      amount: config.amount,
      paymentMethod: config.paymentMethod.slice(0, 50),
      status: 'Pagado',
      isRecurring: true,
      ...(config.notes ? { notes: config.notes.slice(0, 300) } : {}),
    };
    await persistDocOrThrow('expenses', newExp.id, newExp);
    setExpenses((prev) => [newExp, ...prev]);
    await addAudit(
      'CREACIÓN',
      'Gastos',
      `Registro rápido de gasto fijo (${newExp.description}) por ${formatCOP(newExp.amount)}`
    );
  };

  // Shared validated payment recorder (used by both Payment Modal and AI Assistant)
  const applySalePayment = async (saleId: string, amount: number) => {
    const targetSale = sales.find((s) => s.id === saleId);
    const validation = validatePaymentInput(amount, targetSale);
    if (!validation.valid || !validation.data || !targetSale) {
      throw new Error(validation.error || 'No se pudo validar el abono.');
    }

    const { newAmountPaid, newStatus } = validation.data;
    const updatedSale: Sale = {
      ...targetSale,
      amountPaid: newAmountPaid,
      paymentStatus: newStatus,
      lastPaymentDate: getTodayString(),
    };

    await persistDocOrThrow('sales', updatedSale.id, updatedSale);
    setSales((prev) => prev.map((sale) => (sale.id === targetSale.id ? updatedSale : sale)));
    await addAudit(
      'CREACIÓN',
      'Abonos',
      `Registro de abono/pago de ${formatCOP(amount)} a venta #${updatedSale.id}`
    );
  };

  // Derived Accounts Receivable
  const receivables: AccountReceivable[] = useMemo(
    () =>
      sales
        .map((sale) => {
          const pendingAmount = Math.max(0, sale.total - sale.amountPaid);
          return {
            id: `AR-${sale.id}`,
            saleId: sale.id,
            clientName: sale.clientName,
            clientPhone: sale.clientPhone,
            totalAmount: sale.total,
            paidAmount: sale.amountPaid,
            pendingAmount,
            dueDate: sale.date,
            status: 'Pendiente' as const,
          };
        })
        .filter((r) => r.pendingAmount > 0),
    [sales]
  );

  const pendingReceivablesCount = receivables.length;

  // Payment modal state for quick payment registration
  const [paymentModalSaleId, setPaymentModalSaleId] = useState<string | null>(null);
  const [paymentAmountInput, setPaymentAmountInput] = useState<number>(0);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  const handleOpenPaymentModal = (saleId: string) => {
    const sale = sales.find((s) => s.id === saleId);
    if (sale) {
      const saldo = Math.max(0, sale.total - sale.amountPaid);
      setPaymentAmountInput(saldo);
      setPaymentError(null);
      setIsSubmittingPayment(false);
      setPaymentModalSaleId(saleId);
    }
  };

  const handleConfirmPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentModalSaleId || isSubmittingPayment) return;
    setPaymentError(null);

    setIsSubmittingPayment(true);
    try {
      await applySalePayment(paymentModalSaleId, paymentAmountInput);
      setPaymentModalSaleId(null);
    } catch (err: any) {
      setPaymentError(err?.message || 'Error al registrar el abono en la base de datos.');
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  // Reset Data handler (preserves theme preference and backup timestamp)
  const handleResetData = () => {
    setSales(initialSales);
    setExpenses(initialExpenses);
    setProductionCosts(initialProductionCosts);
    setSuppliers(initialSuppliers);
    setPurchaseOrders(initialPurchaseOrders);
    setMaterialTemplates(initialMaterialTemplates);
    setSettings(initialSettings);
    setAuditLogs([]);
    [
      'maleja_sales',
      'maleja_expenses',
      'maleja_production',
      'maleja_material_templates',
      'maleja_suppliers',
      'maleja_purchases',
      'maleja_settings',
      'maleja_audit',
    ].forEach((k) => localStorage.removeItem(k));
  };

  // Export Data handler (Full DB Backup without modifying original data)
  const handleExportData = async () => {
    const payload = createBackupPayload({
      sales,
      expenses,
      productionCosts,
      suppliers,
      purchaseOrders,
      materialTemplates,
      settings,
      auditLogs,
      userEmail: currentUser?.email,
    });
    downloadBackupJson(payload, 'respaldo_maleja_disenos');
    const stamp = new Date().toLocaleString('es-CO');
    setLastBackupAt(stamp);
    localStorage.setItem('maleja_last_backup_at', stamp);
    await addAudit(
      'CREACIÓN',
      'Sistema',
      `Copia de seguridad completa descargada (${sales.length} ventas, ${expenses.length} gastos, ${purchaseOrders.length} compras)`
    );
  };

  // Controlled Backup Restore handler
  const handleRestoreBackup = async (
    payload: BackupPayload,
    mode: RestoreMode,
    selection: RestoreModuleSelection
  ): Promise<{ success: boolean; message: string }> => {
    try {
      if (mode === 'replace') {
        const safetyPayload = createBackupPayload({
          sales,
          expenses,
          productionCosts,
          suppliers,
          purchaseOrders,
          materialTemplates,
          settings,
          auditLogs,
          userEmail: currentUser?.email,
        });
        downloadBackupJson(safetyPayload, 'respaldo_preventivo_antes_restaurar');
      }

      const replaceExisting = mode === 'replace';
      let totalAdded = 0;
      let totalUpdated = 0;

      if (selection.sales) {
        const res = mergeCollectionByMode(sales, payload.sales, mode);
        if (isCloudConnected) await batchRestoreCollection('sales', res.result, replaceExisting);
        setSales(res.result);
        totalAdded += res.added;
        totalUpdated += res.updated;
      }

      if (selection.expenses) {
        const res = mergeCollectionByMode(expenses, payload.expenses, mode);
        if (isCloudConnected) await batchRestoreCollection('expenses', res.result, replaceExisting);
        setExpenses(res.result);
        totalAdded += res.added;
        totalUpdated += res.updated;
      }

      if (selection.productionCosts) {
        const res = mergeCollectionByMode(productionCosts, payload.productionCosts, mode);
        if (isCloudConnected) {
          await batchRestoreCollection('productionCosts', res.result, replaceExisting);
        }
        setProductionCosts(res.result);
        totalAdded += res.added;
        totalUpdated += res.updated;
      }

      if (selection.suppliers) {
        const res = mergeCollectionByMode(suppliers, payload.suppliers, mode);
        if (isCloudConnected) await batchRestoreCollection('suppliers', res.result, replaceExisting);
        setSuppliers(res.result);
        totalAdded += res.added;
        totalUpdated += res.updated;
      }

      if (selection.purchaseOrders) {
        const res = mergeCollectionByMode(purchaseOrders, payload.purchaseOrders, mode);
        if (isCloudConnected) {
          await batchRestoreCollection('purchaseOrders', res.result, replaceExisting);
        }
        setPurchaseOrders(res.result);
        totalAdded += res.added;
        totalUpdated += res.updated;
      }

      if (selection.materialTemplates && payload.materialTemplates) {
        const res = mergeCollectionByMode(materialTemplates, payload.materialTemplates, mode);
        if (isCloudConnected) {
          await batchRestoreCollection('materialTemplates', res.result, replaceExisting);
        }
        setMaterialTemplates(res.result);
      }

      if (selection.settings && payload.settings) {
        const normalizedRestored = normalizeBusinessSettings(payload.settings);
        if (isCloudConnected) {
          await persistDocOrThrow('settings', 'business', {
            id: 'business',
            ...normalizedRestored,
          });
        }
        setSettings(normalizedRestored);
      }

      if (selection.auditLogs && payload.auditLogs) {
        const res = mergeCollectionByMode(auditLogs, payload.auditLogs, mode);
        if (isCloudConnected) await batchRestoreCollection('auditLogs', res.result, replaceExisting);
        setAuditLogs(res.result);
      }

      const modeLabel =
        mode === 'merge_missing'
          ? 'Combinación segura (sin sobrescribir)'
          : mode === 'upsert'
          ? 'Combinación con actualización'
          : 'Reemplazo controlado';

      await addAudit(
        'MODIFICACIÓN',
        'Sistema',
        `Restauración controlada (${modeLabel}): ${totalAdded} registros agregados, ${totalUpdated} actualizados.`
      );

      return {
        success: true,
        message: `Restauración completada (${modeLabel}): ${totalAdded} registros agregados y ${totalUpdated} actualizados${
          isCloudConnected ? ' y sincronizados en Cloud Firestore' : ''
        }.`,
      };
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error ? error.message : 'Error al restaurar la copia de seguridad.',
      };
    }
  };

  const [searchTerm, setSearchTerm] = useState('');

  // Global quick search results for Navbar
  const globalSearchResults = useMemo<GlobalSearchResult[]>(() => {
    const q = searchTerm.trim().toLowerCase();
    if (q.length < 2) return [];
    const results: GlobalSearchResult[] = [];

    for (const s of sales) {
      if (
        s.id.toLowerCase().includes(q) ||
        s.clientName.toLowerCase().includes(q) ||
        s.items.some((i) => i.description.toLowerCase().includes(q))
      ) {
        results.push({
          id: s.id,
          title: `${s.id} • ${s.clientName}`,
          subtitle: `${s.date} — Total ${formatCOP(s.total)}`,
          badge: 'Venta',
          tab: 'sales',
        });
      }
    }

    for (const e of expenses) {
      if (
        e.description.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q) ||
        (e.supplier && e.supplier.toLowerCase().includes(q))
      ) {
        results.push({
          id: e.id,
          title: e.description,
          subtitle: `${e.date} • ${e.type} (${formatCOP(e.amount)})`,
          badge: 'Gasto',
          tab: 'expenses',
        });
      }
    }

    for (const pc of productionCosts) {
      if (
        pc.productName.toLowerCase().includes(q) ||
        pc.clientName.toLowerCase().includes(q) ||
        pc.orderReference.toLowerCase().includes(q)
      ) {
        results.push({
          id: pc.id,
          title: `${pc.productName} (${pc.orderReference})`,
          subtitle: `${pc.clientName} — Costo ${formatCOP(pc.totalCost)}`,
          badge: 'Producción',
          tab: 'production',
        });
      }
    }

    for (const sup of suppliers) {
      if (sup.name.toLowerCase().includes(q) || sup.category.toLowerCase().includes(q)) {
        results.push({
          id: sup.id,
          title: sup.name,
          subtitle: sup.category,
          badge: 'Proveedor',
          tab: 'suppliers',
        });
      }
    }

    for (const po of purchaseOrders) {
      if (
        po.supplierName.toLowerCase().includes(q) ||
        po.itemsDescription.toLowerCase().includes(q)
      ) {
        results.push({
          id: po.id,
          title: `${po.supplierName} — ${po.itemsDescription}`,
          subtitle: `${po.date} • ${formatCOP(po.amount)}`,
          badge: 'Compra',
          tab: 'suppliers',
        });
      }
    }

    return results.slice(0, 8);
  }, [searchTerm, sales, expenses, productionCosts, suppliers, purchaseOrders]);

  const handleLogout = async () => {
    setCloudBannerError(null);
    setPaymentModalSaleId(null);
    setIsAiModalOpen(false);
    setIsMobileMenuOpen(false);
    await logoutUser();
  };

  if (!authChecked || (currentUser && authAccessState === 'checking')) {
    return (
      <div className="min-h-screen bg-[#f4f7fb] dark:bg-[#070b14] flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
          Verificando sesión segura...
        </p>
      </div>
    );
  }

  if (!currentUser) {
    return <AuthView onLoginSuccess={() => {}} />;
  }

  if (authAccessState === 'unverified') {
    return (
      <div className="min-h-screen bg-[#f4f7fb] dark:bg-[#070b14] text-slate-900 dark:text-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-[#0d1322] border border-slate-200 dark:border-[#1e293b] rounded-3xl p-8 shadow-xl space-y-5 text-center">
          <div className="w-14 h-14 bg-amber-50 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-center mx-auto">
            <MailCheck className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
            Verifica tu correo electrónico
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Para proteger la información financiera de Maleja Diseños, debes confirmar la dirección{' '}
            <span className="font-bold text-slate-900 dark:text-white">{currentUser.email}</span>{' '}
            haciendo clic en el enlace enviado a tu bandeja de entrada.
          </p>
          {verificationFeedback && (
            <div className="p-3 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 rounded-xl text-xs text-blue-700 dark:text-blue-300 font-medium">
              {verificationFeedback}
            </div>
          )}
          <div className="flex flex-col gap-2.5 pt-2">
            <button
              type="button"
              disabled={authActionLoading}
              onClick={async () => {
                setAuthActionLoading(true);
                try {
                  const reloaded = await reloadCurrentUser();
                  if (reloaded?.emailVerified) {
                    setCurrentUser({ ...reloaded } as User);
                  } else {
                    setVerificationFeedback(
                      'Tu correo aún figura sin verificar. Revisa tu bandeja o spam e intenta de nuevo.'
                    );
                  }
                } finally {
                  setAuthActionLoading(false);
                }
              }}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Ya verifiqué mi correo</span>
            </button>
            <button
              type="button"
              disabled={authActionLoading}
              onClick={async () => {
                setAuthActionLoading(true);
                try {
                  await sendUserEmailVerification();
                  setVerificationFeedback('Nuevo correo de verificación enviado.');
                } catch {
                  setVerificationFeedback(
                    'Espera unos momentos antes de solicitar otro correo de verificación.'
                  );
                } finally {
                  setAuthActionLoading(false);
                }
              }}
              className="w-full py-2.5 px-4 bg-slate-100 dark:bg-[#111827] hover:bg-slate-200 dark:hover:bg-[#1e293b] text-slate-700 dark:text-slate-200 font-semibold rounded-xl text-xs border border-slate-200 dark:border-[#1e293b]"
            >
              Reenviar correo de verificación
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="w-full py-2 text-xs text-rose-600 dark:text-rose-400 hover:underline font-semibold flex items-center justify-center gap-1.5 pt-1"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Cerrar Sesión</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (authAccessState === 'unauthorized') {
    return (
      <div className="min-h-screen bg-[#f4f7fb] dark:bg-[#070b14] text-slate-900 dark:text-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-[#0d1322] border border-slate-200 dark:border-[#1e293b] rounded-3xl p-8 shadow-xl space-y-5 text-center">
          <div className="w-14 h-14 bg-rose-50 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-2xl flex items-center justify-center mx-auto">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
            Acceso Restringido
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            La cuenta <span className="font-bold text-slate-900 dark:text-white">{currentUser.email}</span>{' '}
            no tiene permisos asignados para consultar ni modificar los datos financieros de Maleja Diseños.
            Solicita autorización al propietario del negocio o ingresa con la cuenta administrativa autorizada.
          </p>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            <span>Cerrar Sesión e Ingresar con otra cuenta</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f7fb] dark:bg-[#0b0914] text-slate-900 dark:text-slate-100 flex flex-col font-sans antialiased selection:bg-blue-600 selection:text-white transition-colors duration-200">
      {/* Navbar */}
      <Navbar
        onOpenAiAdvisor={() => setIsAiModalOpen(true)}
        onNewSale={() => setActiveTab('sales')}
        onNewExpense={() => setActiveTab('expenses')}
        onToggleMobileMenu={() => setIsMobileMenuOpen((prev) => !prev)}
        pendingReceivablesCount={pendingReceivablesCount}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        searchResults={globalSearchResults}
        onSelectSearchResult={(tab) => setActiveTab(tab)}
        userEmail={currentUser.email}
        onLogout={handleLogout}
      />

      {/* Cloud connection status bar */}
      <div className="bg-white dark:bg-[#070b14] border-b border-slate-200 dark:border-[#1e293b] px-4 sm:px-6 py-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600 dark:text-slate-400 transition-colors duration-200">
        <div className="flex items-center space-x-2">
          {isCloudConnected ? (
            <>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                <Cloud className="w-3.5 h-3.5" /> Base de datos Cloud Firestore Sincronizada ({currentUser.email})
              </span>
            </>
          ) : isCloudConnected === false ? (
            <>
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              <span className="text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
                <CloudOff className="w-3.5 h-3.5" /> Modo Local / Conexión Cloud pendiente
              </span>
            </>
          ) : (
            <span>Conectando a base de datos segura...</span>
          )}
        </div>
        <div className="text-slate-500 dark:text-slate-500">
          Almacenamiento persistente seguro activo ({settings.currencyCode || 'COP'})
        </div>
      </div>

      {/* Global DB Persistence Error Banner */}
      {cloudBannerError && (
        <div className="bg-rose-50 dark:bg-rose-500/15 border-b border-rose-200 dark:border-rose-500/30 px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3 text-xs text-rose-700 dark:text-rose-300 font-medium">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{cloudBannerError}</span>
          </div>
          <button
            type="button"
            onClick={() => setCloudBannerError(null)}
            className="p-1 hover:bg-rose-100 dark:hover:bg-rose-500/20 rounded-lg"
            aria-label="Cerrar alerta"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Layout */}
      <div className="flex-1 flex flex-col lg:flex-row max-w-7xl w-full mx-auto">
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          pendingReceivablesCount={pendingReceivablesCount}
          settings={settings}
          isMobileOpen={isMobileMenuOpen}
          onCloseMobile={() => setIsMobileMenuOpen(false)}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-x-hidden">
          {activeTab === 'dashboard' && (
            <DashboardView
              sales={sales}
              expenses={expenses}
              productionCosts={productionCosts}
              purchaseOrders={purchaseOrders}
              receivables={receivables}
              settings={settings}
              onNavigate={setActiveTab}
              onRecordPayment={handleOpenPaymentModal}
              onOpenNewSale={() => setActiveTab('sales')}
              onOpenNewExpense={() => setActiveTab('expenses')}
              onOpenNewPurchase={() => setActiveTab('suppliers')}
            />
          )}

          {activeTab === 'sales' && (
            <SalesView
              sales={sales}
              settings={settings}
              onAddSale={async (s) => {
                if (sales.some((item) => item.id === s.id)) return;
                await persistDocOrThrow('sales', s.id, s);
                setSales((prev) => (prev.some((item) => item.id === s.id) ? prev : [s, ...prev]));
                await addAudit(
                  'CREACIÓN',
                  'Ventas',
                  `Registro de venta #${s.id} - ${s.clientName} por ${formatCOP(s.total)}`
                );
              }}
              onUpdateSale={async (s) => {
                if (!sales.some((item) => item.id === s.id)) {
                  throw new Error('La venta seleccionada ya no existe.');
                }
                await persistDocOrThrow('sales', s.id, s);
                setSales((prev) => prev.map((item) => (item.id === s.id ? s : item)));
                await addAudit('MODIFICACIÓN', 'Ventas', `Actualización de venta #${s.id} - ${s.clientName}`);
              }}
              onDeleteSale={async (id) => {
                const s = sales.find((item) => item.id === id);
                if (!s) return;
                await persistDeleteOrThrow('sales', id);
                setSales((prev) => prev.filter((item) => item.id !== id));
                await addAudit('ELIMINACIÓN', 'Ventas', `Eliminación de venta #${id} (${s.clientName})`);
              }}
              onRecordPaymentModal={handleOpenPaymentModal}
            />
          )}

          {activeTab === 'expenses' && (
            <ExpensesView
              expenses={expenses}
              suppliers={suppliers}
              settings={settings}
              onAddExpense={async (e) => {
                if (expenses.some((item) => item.id === e.id)) return;
                await persistDocOrThrow('expenses', e.id, e);
                setExpenses((prev) => (prev.some((item) => item.id === e.id) ? prev : [e, ...prev]));
                await addAudit(
                  'CREACIÓN',
                  'Gastos',
                  `Registro de gasto (${e.type}): ${e.description} - ${formatCOP(e.amount)}`
                );
              }}
              onUpdateExpense={async (e) => {
                if (!expenses.some((item) => item.id === e.id)) {
                  throw new Error('El gasto seleccionado ya no existe.');
                }
                await persistDocOrThrow('expenses', e.id, e);
                setExpenses((prev) => prev.map((item) => (item.id === e.id ? e : item)));
                await addAudit('MODIFICACIÓN', 'Gastos', `Actualización de gasto ${e.description}`);
              }}
              onDeleteExpense={async (id) => {
                const exp = expenses.find((e) => e.id === id);
                if (!exp) return;
                await persistDeleteOrThrow('expenses', id);
                setExpenses((prev) => prev.filter((e) => e.id !== id));
                await addAudit('ELIMINACIÓN', 'Gastos', `Eliminación de gasto ${exp.description}`);
              }}
              onAddSupplier={async (sup) => {
                if (suppliers.some((item) => item.id === sup.id)) return;
                await persistDocOrThrow('suppliers', sup.id, sup);
                setSuppliers((prev) => (prev.some((item) => item.id === sup.id) ? prev : [sup, ...prev]));
                await addAudit('CREACIÓN', 'Proveedores', `Registro de proveedor ${sup.name}`);
              }}
            />
          )}

          {activeTab === 'production' && (
            <ProductionView
              productionCosts={productionCosts}
              sales={sales}
              materialTemplates={materialTemplates}
              onAddProductionCost={async (pc) => {
                if (productionCosts.some((item) => item.id === pc.id)) return;
                await persistDocOrThrow('productionCosts', pc.id, pc);
                setProductionCosts((prev) =>
                  prev.some((item) => item.id === pc.id) ? prev : [pc, ...prev]
                );
                await addAudit(
                  'CREACIÓN',
                  'Costos Producción',
                  `Registro de costo para orden ${pc.orderReference} (${pc.productName})`
                );
              }}
              onUpdateProductionCost={async (pc) => {
                if (!productionCosts.some((item) => item.id === pc.id)) {
                  throw new Error('El costo de producción ya no existe.');
                }
                await persistDocOrThrow('productionCosts', pc.id, pc);
                setProductionCosts((prev) => prev.map((item) => (item.id === pc.id ? pc : item)));
                await addAudit(
                  'MODIFICACIÓN',
                  'Costos Producción',
                  `Actualización de costo de producción orden ${pc.orderReference}`
                );
              }}
              onDeleteProductionCost={async (id) => {
                if (!productionCosts.some((pc) => pc.id === id)) return;
                await persistDeleteOrThrow('productionCosts', id);
                setProductionCosts((prev) => prev.filter((pc) => pc.id !== id));
                await addAudit('ELIMINACIÓN', 'Costos Producción', `Eliminación de costo de producción ${id}`);
              }}
              onAddMaterialTemplate={async (tpl) => {
                if (materialTemplates.some((m) => m.id === tpl.id)) return;
                const cleanTpl: MaterialTemplate = {
                  id: tpl.id.slice(0, 50),
                  name: tpl.name.trim().slice(0, 100),
                  unit: tpl.unit.trim().slice(0, 30),
                  unitPrice: tpl.unitPrice,
                };
                await persistDocOrThrow('materialTemplates', cleanTpl.id, cleanTpl);
                setMaterialTemplates((prev) =>
                  prev.some((m) => m.id === cleanTpl.id) ? prev : [...prev, cleanTpl]
                );
              }}
            />
          )}

          {activeTab === 'suppliers' && (
            <SuppliersView
              suppliers={suppliers}
              purchaseOrders={purchaseOrders}
              settings={settings}
              onAddSupplier={async (sup) => {
                if (suppliers.some((item) => item.id === sup.id)) return;
                await persistDocOrThrow('suppliers', sup.id, sup);
                setSuppliers((prev) => (prev.some((item) => item.id === sup.id) ? prev : [sup, ...prev]));
                await addAudit('CREACIÓN', 'Proveedores', `Registro de proveedor ${sup.name}`);
              }}
              onUpdateSupplier={async (sup) => {
                if (!suppliers.some((item) => item.id === sup.id)) {
                  throw new Error('El proveedor ya no existe.');
                }
                await persistDocOrThrow('suppliers', sup.id, sup);
                setSuppliers((prev) => prev.map((s) => (s.id === sup.id ? sup : s)));
                await addAudit('MODIFICACIÓN', 'Proveedores', `Actualización de proveedor ${sup.name}`);
              }}
              onAddPurchase={async (po) => {
                if (purchaseOrders.some((item) => item.id === po.id)) return;
                await persistDocOrThrow('purchaseOrders', po.id, po);
                setPurchaseOrders((prev) =>
                  prev.some((item) => item.id === po.id) ? prev : [po, ...prev]
                );
                await addAudit(
                  'CREACIÓN',
                  'Compras',
                  `Registro de compra a ${po.supplierName} por ${formatCOP(po.amount)}`
                );
              }}
              onUpdatePurchase={async (po) => {
                if (!purchaseOrders.some((item) => item.id === po.id)) {
                  throw new Error('La orden de compra ya no existe.');
                }
                await persistDocOrThrow('purchaseOrders', po.id, po);
                setPurchaseOrders((prev) => prev.map((p) => (p.id === po.id ? po : p)));
                await addAudit('MODIFICACIÓN', 'Compras', `Actualización de compra #${po.id}`);
              }}
              onDeleteSupplier={async (id) => {
                if (!suppliers.some((s) => s.id === id)) return;
                await persistDeleteOrThrow('suppliers', id);
                setSuppliers((prev) => prev.filter((s) => s.id !== id));
                await addAudit('ELIMINACIÓN', 'Proveedores', `Eliminación de proveedor ${id}`);
              }}
              onDeletePurchase={async (id) => {
                if (!purchaseOrders.some((po) => po.id === id)) return;
                await persistDeleteOrThrow('purchaseOrders', id);
                setPurchaseOrders((prev) => prev.filter((po) => po.id !== id));
                await addAudit('ELIMINACIÓN', 'Compras', `Eliminación de orden de compra ${id}`);
              }}
            />
          )}

          {activeTab === 'receivables' && (
            <ReceivablesView
              sales={sales}
              receivables={receivables}
              settings={settings}
              onRecordPayment={handleOpenPaymentModal}
            />
          )}

          {activeTab === 'history' && (
            <HistoryView
              sales={sales}
              expenses={expenses}
              productionCosts={productionCosts}
              purchaseOrders={purchaseOrders}
              auditLogs={auditLogs}
              onDeleteSale={async (id) => {
                if (!sales.some((s) => s.id === id)) return;
                await persistDeleteOrThrow('sales', id);
                setSales((prev) => prev.filter((s) => s.id !== id));
                await addAudit('ELIMINACIÓN', 'Ventas', `Eliminación de venta #${id} desde historial`);
              }}
              onDeleteExpense={async (id) => {
                if (!expenses.some((e) => e.id === id)) return;
                await persistDeleteOrThrow('expenses', id);
                setExpenses((prev) => prev.filter((e) => e.id !== id));
                await addAudit('ELIMINACIÓN', 'Gastos', `Eliminación de gasto ${id} desde historial`);
              }}
              onDeleteProductionCost={async (id) => {
                if (!productionCosts.some((pc) => pc.id === id)) return;
                await persistDeleteOrThrow('productionCosts', id);
                setProductionCosts((prev) => prev.filter((pc) => pc.id !== id));
                await addAudit('ELIMINACIÓN', 'Costos Producción', `Eliminación de costo ${id} desde historial`);
              }}
              onDeletePurchase={async (id) => {
                if (!purchaseOrders.some((po) => po.id === id)) return;
                await persistDeleteOrThrow('purchaseOrders', id);
                setPurchaseOrders((prev) => prev.filter((po) => po.id !== id));
                await addAudit('ELIMINACIÓN', 'Compras', `Eliminación de compra ${id} desde historial`);
              }}
            />
          )}

          {activeTab === 'reports' && (
            <ReportsView
              sales={sales}
              expenses={expenses}
              productionCosts={productionCosts}
              purchaseOrders={purchaseOrders}
              settings={settings}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsView
              settings={settings}
              sales={sales}
              expenses={expenses}
              productionCosts={productionCosts}
              suppliers={suppliers}
              purchaseOrders={purchaseOrders}
              materialTemplates={materialTemplates}
              receivables={receivables}
              auditLogs={auditLogs}
              lastBackupAt={lastBackupAt}
              isCloudConnected={isCloudConnected}
              onUpdateSettings={handleUpdateSettings}
              onResetData={handleResetData}
              onExportData={handleExportData}
              onRestoreBackup={handleRestoreBackup}
              onQuickRegisterFixedExpense={handleQuickRegisterFixedExpense}
            />
          )}
        </main>
      </div>

      {/* AI Financial Assistant Modal (Q&A + Natural Language Entries via Server Proxy) */}
      <AiAssistantModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        sales={sales}
        expenses={expenses}
        productionCosts={productionCosts}
        purchaseOrders={purchaseOrders}
        settings={settings}
        onAddSale={async (s) => {
          if (sales.some((item) => item.id === s.id)) return;
          await persistDocOrThrow('sales', s.id, s);
          setSales((prev) => (prev.some((item) => item.id === s.id) ? prev : [s, ...prev]));
          await addAudit(
            'CREACIÓN',
            'Ventas',
            `Registro vía Asistente IA de venta #${s.id} - ${s.clientName} por ${formatCOP(s.total)}`
          );
        }}
        onAddExpense={async (e) => {
          if (expenses.some((item) => item.id === e.id)) return;
          await persistDocOrThrow('expenses', e.id, e);
          setExpenses((prev) => (prev.some((item) => item.id === e.id) ? prev : [e, ...prev]));
          await addAudit(
            'CREACIÓN',
            'Gastos',
            `Registro vía Asistente IA de gasto (${e.type}): ${e.description} - ${formatCOP(e.amount)}`
          );
        }}
        onRecordPaymentDirect={applySalePayment}
        onRecordPaymentModal={handleOpenPaymentModal}
      />

      {/* Record Payment Modal */}
      {paymentModalSaleId &&
        (() => {
          const modalSale = sales.find((s) => s.id === paymentModalSaleId);
          const pendingBalance = modalSale
            ? Math.max(0, modalSale.total - modalSale.amountPaid)
            : 0;
          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/70 p-4 backdrop-blur-sm animate-fadeIn">
              <div className="bg-white dark:bg-[#0d1322] border border-slate-200 dark:border-[#1e293b] rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                <div className="bg-emerald-600 dark:bg-emerald-700 text-white p-5 flex items-center justify-between">
                  <h3 className="text-lg font-bold">Registrar Abono / Pago</h3>
                  <button
                    type="button"
                    disabled={isSubmittingPayment}
                    onClick={() => setPaymentModalSaleId(null)}
                    className="text-emerald-100 hover:text-white"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
                <form onSubmit={handleConfirmPayment} className="p-6 space-y-4">
                  {paymentError && (
                    <div className="p-3 bg-rose-50 dark:bg-rose-500/15 border border-rose-200 dark:border-rose-500/30 rounded-xl text-rose-700 dark:text-rose-300 text-xs font-medium flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{paymentError}</span>
                    </div>
                  )}
                  <div className="p-3 bg-slate-50 dark:bg-[#111827] border border-slate-200 dark:border-[#1e293b] rounded-xl text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Venta ID:</span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {paymentModalSaleId}
                      </span>
                    </div>
                    {modalSale && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-slate-500 dark:text-slate-400">Cliente:</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {modalSale.clientName}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500 dark:text-slate-400">
                            Saldo pendiente máximo:
                          </span>
                          <span className="font-bold text-amber-600 dark:text-amber-400">
                            {formatCOP(pendingBalance)}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">
                      Monto a abonar en COP ($)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max={pendingBalance || undefined}
                      value={paymentAmountInput || ''}
                      onChange={(e) => {
                        setPaymentError(null);
                        setPaymentAmountInput(
                          e.target.value === '' ? 0 : parseFloat(e.target.value) || 0
                        );
                      }}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-[#1e293b] rounded-xl text-base font-bold text-emerald-600 dark:text-emerald-400 focus:outline-none focus:border-blue-500"
                      required
                    />
                  </div>
                  <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200 dark:border-[#1e293b]">
                    <button
                      type="button"
                      disabled={isSubmittingPayment}
                      onClick={() => setPaymentModalSaleId(null)}
                      className="px-5 py-2.5 bg-slate-100 dark:bg-[#1e293b] hover:bg-slate-200 dark:hover:bg-[#334155] text-slate-700 dark:text-slate-200 font-semibold rounded-xl text-sm transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingPayment}
                      className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold rounded-xl text-sm shadow-md transition-colors"
                    >
                      {isSubmittingPayment ? 'Guardando...' : 'Confirmar Pago'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          );
        })()}
    </div>
  );
}
