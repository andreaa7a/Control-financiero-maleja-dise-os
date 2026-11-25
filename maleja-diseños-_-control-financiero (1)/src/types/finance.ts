export type ServiceCategory =
  | 'Diseño gráfico'
  | 'Tarjetas de presentación'
  | 'Volantes'
  | 'Pendones'
  | 'Calcomanías'
  | 'Impresión digital'
  | 'DTF y estampados'
  | 'Personalización de motocicletas'
  | 'Avisos publicitarios'
  | 'Serigrafía'
  | 'Otros servicios'
  | (string & {});

export type PaymentStatus = 'Pagado' | 'Parcial' | 'Pendiente';

export type PaymentMethod =
  | 'Efectivo'
  | 'Transferencia Bancaria'
  | 'Nequi / DaviPlata'
  | 'Tarjeta'
  | 'Crédito'
  | (string & {});

export interface SaleItem {
  id: string;
  category: ServiceCategory;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Sale {
  id: string;
  date: string; // YYYY-MM-DD
  clientName: string;
  clientPhone?: string;
  clientEmail?: string;
  items: SaleItem[];
  subtotal: number;
  discount: number;
  total: number;
  amountPaid: number; // Pagos recibidos
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  lastPaymentDate?: string;
  notes?: string;
}

export interface PaymentReceived {
  id: string;
  saleId: string;
  date: string;
  amount: number;
  paymentMethod: PaymentMethod;
  reference?: string;
  notes?: string;
}

export type ExpenseType = 'Fijo' | 'Variable' | 'Extraordinario';

export interface Expense {
  id: string;
  date: string;
  category: string;
  type: ExpenseType;
  description: string;
  amount: number;
  paymentMethod: PaymentMethod;
  supplier?: string;
  receiptNumber?: string;
  status: 'Pagado' | 'Pendiente';
  isRecurring?: boolean;
  notes?: string;
}

export interface MaterialTemplate {
  id: string;
  name: string;
  unit: string; // e.g. 'metro', 'rollo', 'unidad', 'litro'
  unitPrice: number;
}

export interface ProductionCost {
  id: string;
  date: string;
  orderReference: string; // ID de venta relacionado
  clientName: string;
  productName: string; // Ej. Tarjetas de presentación, Pendones, Vinilo
  quantityProduced: number;
  materialName: string;
  materialQuantity: number;
  materialUnitPrice: number;
  materialTotalCost: number;
  laborCost: number;
  productionTime: string; // Ej. '2 horas'
  otherCosts: number;
  totalCost: number;
  unitCost: number;
  salePrice: number;
  grossProfit: number;
  profitMargin: number; // %
  description: string;
  // Legacy fields for backward compatibility
  materialCost?: number;
  machineCost?: number;
}

export interface Supplier {
  id: string;
  name: string;
  category: string;
  contactPerson: string;
  phone: string;
  email: string;
  address?: string;
  notes?: string;
}

export interface PurchaseOrder {
  id: string;
  date: string;
  supplierId: string;
  supplierName: string;
  itemsDescription: string;
  amount: number;
  status: 'Pagado' | 'Pendiente';
  paymentMethod: PaymentMethod;
  notes?: string;
}

export interface AccountReceivable {
  id: string;
  saleId: string;
  clientName: string;
  clientPhone?: string;
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  dueDate: string;
  status: 'Pendiente' | 'Vencido' | 'Pagado';
}

export type TimeFilter = 'day' | 'week' | 'month' | 'year' | 'custom';

export type FixedExpenseFrequency =
  | 'Semanal'
  | 'Quincenal'
  | 'Mensual'
  | 'Bimestral'
  | 'Trimestral'
  | 'Semestral'
  | 'Anual';

export interface FixedExpenseConfig {
  id: string;
  name: string;
  category: string;
  amount: number;
  frequency: FixedExpenseFrequency;
  dueDate: string; // YYYY-MM-DD
  paymentMethod: PaymentMethod;
  active: boolean;
  notes?: string;
}

export interface ExpenseCategoriesConfig {
  Fijo: string[];
  Variable: string[];
  Extraordinario: string[];
}

export interface BusinessSettings {
  companyName: string;
  nit: string;
  address: string;
  phone: string;
  email: string;
  logoUrl?: string;
  defaultTaxRate: number;
  currencyCode: string;
  currencySymbol: string;
  monthlySalesGoal: number;
  monthlyProfitGoal: number;
  monthlyPurchasesBudget: number;
  saleCategories: string[];
  expenseCategories: ExpenseCategoriesConfig;
  paymentMethods: string[];
  fixedExpensesConfig: FixedExpenseConfig[];
}

export interface AuditLog {
  id: string;
  timestamp: string;
  action: 'CREACIÓN' | 'MODIFICACIÓN' | 'ELIMINACIÓN';
  module: 'Ventas' | 'Gastos' | 'Costos Producción' | 'Proveedores' | 'Compras' | 'Abonos' | 'Sistema';
  description: string;
}
