import React, { useState, useRef, useEffect } from 'react';
import {
  Sale,
  Expense,
  ProductionCost,
  PurchaseOrder,
  BusinessSettings,
  ServiceCategory,
  PaymentMethod,
  ExpenseType,
} from '../types/finance';
import { formatCOP, getTodayString } from '../utils/formatters';
import {
  generateUniqueId,
  validateSaleInput,
  validateExpenseInput,
  validatePaymentInput,
  isValidCalendarDate,
} from '../utils/validation';
import { getCurrentIdToken } from '../services/firebaseService';
import { Bot, X, Sparkles, Send, User, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';

interface AiAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  sales: Sale[];
  expenses: Expense[];
  productionCosts: ProductionCost[];
  purchaseOrders: PurchaseOrder[];
  settings: BusinessSettings;
  onAddSale: (sale: Sale) => Promise<void> | void;
  onAddExpense: (expense: Expense) => Promise<void> | void;
  onRecordPaymentDirect?: (saleId: string, amount: number) => Promise<void>;
  onRecordPaymentModal: (saleId: string) => void;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  isError?: boolean;
  pendingAction?: {
    type: 'SALE' | 'EXPENSE' | 'PAYMENT';
    data: any;
    summary: string;
  };
}

const QUICK_PROMPTS = [
  '¿Cuánto vendí este mes y cuánto dinero recibí?',
  '¿Cuánto debo cobrar a mis clientes?',
  '¿Qué servicio me deja mayor rentabilidad?',
  'Haz un diagnóstico financiero completo',
];

export const AiAssistantModal: React.FC<AiAssistantModalProps> = ({
  isOpen,
  onClose,
  sales,
  expenses,
  productionCosts,
  purchaseOrders,
  settings,
  onAddSale,
  onAddExpense,
  onRecordPaymentDirect,
  onRecordPaymentModal,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      sender: 'assistant',
      text: '¡Hola! Soy tu asistente administrativo y financiero de Maleja Diseños. Puedo responder preguntas sobre tus ventas, gastos, costos y cuentas por cobrar usando tus datos reales, o preparar registros desde lenguaje natural (ej: "Hoy vendí $150.000 en calcomanías" o "El cliente Juan abonó $100.000"). ¿En qué te ayudo hoy?',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmingActionId, setConfirmingActionId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  if (!isOpen) return null;

  const buildFinancialContext = (): string => {
    const today = getTodayString();
    const currentMonth = today.slice(0, 7);
    const totalSales = sales.reduce((acc, s) => acc + s.total, 0);
    const totalCollected = sales.reduce((acc, s) => acc + s.amountPaid, 0);
    const totalPending = Math.max(0, totalSales - totalCollected);
    const totalExpenses = expenses.reduce((acc, e) => acc + e.amount, 0);
    const totalProduction = productionCosts.reduce((acc, p) => acc + p.totalCost, 0);
    const totalPurchases = purchaseOrders.reduce((acc, p) => acc + p.amount, 0);

    const monthSales = sales.filter((s) => s.date.startsWith(currentMonth));
    const monthSalesTotal = monthSales.reduce((acc, s) => acc + s.total, 0);
    const monthExpensesTotal = expenses
      .filter((e) => e.date.startsWith(currentMonth))
      .reduce((acc, e) => acc + e.amount, 0);

    const openReceivables = sales
      .filter((s) => s.total - s.amountPaid > 0)
      .map((s) => ({
        id: s.id,
        clientName: s.clientName,
        date: s.date,
        total: s.total,
        amountPaid: s.amountPaid,
        pending: s.total - s.amountPaid,
      }));

    return `
Eres el asistente financiero y administrativo de "${settings.companyName || 'Maleja Diseños'}", un taller de artes gráficas y publicidad en Colombia (${settings.currencyCode || 'COP'}).
Fecha actual local (Colombia): ${today}.

DATOS REALES ACTUALES:
- Ventas históricas facturadas: ${formatCOP(totalSales)} (${sales.length} ventas)
- Ventas del mes actual (${currentMonth}): ${formatCOP(monthSalesTotal)} (${monthSales.length} ventas)
- Dinero efectivamente recibido (Caja/Bancos): ${formatCOP(totalCollected)}
- Cartera pendiente por cobrar: ${formatCOP(totalPending)}
- Gastos operativos totales: ${formatCOP(totalExpenses)} (${expenses.length} registros; este mes: ${formatCOP(monthExpensesTotal)})
- Costos directos de producción: ${formatCOP(totalProduction)} (${productionCosts.length} órdenes)
- Compras a proveedores: ${formatCOP(totalPurchases)} (${purchaseOrders.length} órdenes)
- Categorías de ventas válidas: ${JSON.stringify(settings.saleCategories)}
- Categorías de gastos válidas: ${JSON.stringify(settings.expenseCategories)}
- Medios de pago válidos: ${JSON.stringify(settings.paymentMethods)}
- Cuentas por cobrar abiertas: ${JSON.stringify(openReceivables.slice(0, 20))}
- Ventas recientes: ${JSON.stringify(sales.slice(0, 20))}
- Gastos recientes: ${JSON.stringify(expenses.slice(0, 20))}
- Costos de producción recientes: ${JSON.stringify(productionCosts.slice(0, 15))}
- Compras recientes: ${JSON.stringify(purchaseOrders.slice(0, 15))}

REGLAS ESTRICTAS:
1. Responde siempre en español claro y sencillo utilizando ÚNICAMENTE los datos reales suministrados. No confundas ventas facturadas con dinero recibido, ni costos de producción con gastos operativos.
2. Nunca inventes cifras, fechas ni nombres de clientes. Si falta un dato indispensable para registrar una operación (por ejemplo, valor o descripción), pregúntalo antes de emitir el JSON.
3. Si el usuario solicita registrar una Venta, Gasto o Abono y tienes los datos necesarios, incluye un único bloque JSON válido dentro de \`\`\`json ... \`\`\` con esta estructura exacta:
\`\`\`json
{
  "action": "CREATE_SALE" | "CREATE_EXPENSE" | "RECORD_PAYMENT",
  "data": {
    "saleId": "opcional si aplica a un abono",
    "date": "${today}",
    "clientName": "...",
    "description": "...",
    "category": "...",
    "expenseType": "Fijo" | "Variable" | "Extraordinario",
    "amount": 0,
    "amountPaid": 0,
    "paymentMethod": "Transferencia Bancaria"
  },
  "summary": "Resumen claro en español de la operación que se registrará tras confirmación..."
}
\`\`\`
4. Nunca modifiques ni elimines registros existentes por iniciativa propia.
`;
  };

  const sendPrompt = async (userText: string) => {
    if (!userText.trim() || loading) return;

    const cleanPrompt = userText.trim();
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: cleanPrompt,
    };

    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const idToken = await getCurrentIdToken();
      if (!idToken) {
        throw new Error('Tu sesión no está activa. Inicia sesión nuevamente.');
      }

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          prompt: cleanPrompt,
          systemContext: buildFinancialContext(),
        }),
      });

      const payload = (await res.json().catch(() => ({}))) as { text?: string; error?: string };
      if (!res.ok) {
        throw new Error(payload.error || 'No se pudo consultar el asistente IA.');
      }

      const responseText = payload.text || 'No se pudo procesar tu solicitud.';
      const jsonMatch = responseText.match(/```json([\s\S]*?)```/);
      if (jsonMatch) {
        try {
          const parsedAction = JSON.parse(jsonMatch[1].trim());
          const cleanText = responseText.replace(/```json[\s\S]*?```/, '').trim();
          const mappedType: 'SALE' | 'EXPENSE' | 'PAYMENT' =
            parsedAction.action === 'CREATE_SALE'
              ? 'SALE'
              : parsedAction.action === 'CREATE_EXPENSE'
              ? 'EXPENSE'
              : 'PAYMENT';

          setMessages((prev) => [
            ...prev,
            {
              id: (Date.now() + 1).toString(),
              sender: 'assistant',
              text:
                cleanText ||
                'He preparado el resumen de la operación. Por favor confirma antes de guardar:',
              pendingAction: {
                type: mappedType,
                data: parsedAction.data || {},
                summary: parsedAction.summary || 'Confirmar registro de movimiento financiero.',
              },
            },
          ]);
          return;
        } catch (parseErr) {
          console.error('JSON parse error from AI action:', parseErr);
        }
      }

      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: 'assistant',
          text: responseText,
        },
      ]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: 'assistant',
          isError: true,
          text: err?.message || 'Error de conexión con el asistente IA.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;
    const text = input;
    setInput('');
    await sendPrompt(text);
  };

  const handleConfirmAction = async (
    msgId: string,
    pendingAction: NonNullable<ChatMessage['pendingAction']>
  ) => {
    if (confirmingActionId) return;
    const { type, data } = pendingAction;
    const today = getTodayString();
    const actionDate =
      typeof data.date === 'string' && isValidCalendarDate(data.date) ? data.date : today;
    const year = actionDate.slice(0, 4) || String(new Date().getFullYear());

    setConfirmingActionId(msgId);
    try {
      if (type === 'SALE') {
        const amount = Number(data.amount) || 0;
        const paid =
          data.amountPaid !== undefined && Number.isFinite(Number(data.amountPaid))
            ? Number(data.amountPaid)
            : amount;
        const items = [
          {
            id: `item-${Date.now()}`,
            category: (data.category as ServiceCategory) || settings.saleCategories[0] || 'Impresión digital',
            description: String(data.description || 'Servicio gráfico').trim().slice(0, 200),
            quantity: 1,
            unitPrice: amount,
            total: amount,
          },
        ];
        const validation = validateSaleInput({
          date: actionDate,
          clientName: data.clientName || 'Cliente General',
          items,
          discount: 0,
          amountPaid: paid,
        });
        if (!validation.valid || !validation.data) {
          throw new Error(validation.error || 'Datos de venta inválidos.');
        }

        const newSale: Sale = {
          id: generateUniqueId(`VEN-${year}-`, sales.map((s) => s.id)),
          date: actionDate,
          clientName: String(data.clientName || 'Cliente General').trim().slice(0, 150),
          items,
          subtotal: validation.data.subtotal,
          discount: 0,
          total: validation.data.total,
          amountPaid: paid,
          paymentStatus: validation.data.paymentStatus,
          paymentMethod:
            (data.paymentMethod as PaymentMethod) ||
            settings.paymentMethods[0] ||
            'Transferencia Bancaria',
          notes: 'Registrado mediante Asistente IA',
        };
        await onAddSale(newSale);
        setMessages((prev) => [
          ...prev.map((m) => (m.id === msgId ? { ...m, pendingAction: undefined } : m)),
          {
            id: Date.now().toString(),
            sender: 'assistant',
            text: `¡Venta #${newSale.id} guardada en la base de datos por ${formatCOP(newSale.total)}!`,
          },
        ]);
      } else if (type === 'EXPENSE') {
        const amount = Number(data.amount) || 0;
        const expType: ExpenseType =
          data.expenseType === 'Fijo' || data.expenseType === 'Extraordinario'
            ? data.expenseType
            : 'Variable';
        const fallbackCat =
          settings.expenseCategories[expType]?.[0] || 'Materiales de impresión';
        const category = String(data.category || fallbackCat).trim().slice(0, 100);
        const description = String(data.description || 'Gasto operativo').trim().slice(0, 200);

        const validation = validateExpenseInput({
          date: actionDate,
          category,
          description,
          amount,
        });
        if (!validation.valid) {
          throw new Error(validation.error || 'Datos de gasto inválidos.');
        }

        const newExpense: Expense = {
          id: generateUniqueId(`EXP-${year}-`, expenses.map((e) => e.id)),
          date: actionDate,
          category,
          type: expType,
          description,
          amount,
          paymentMethod:
            (data.paymentMethod as PaymentMethod) ||
            settings.paymentMethods[0] ||
            'Transferencia Bancaria',
          status: 'Pagado',
          notes: 'Registrado mediante Asistente IA',
        };
        await onAddExpense(newExpense);
        setMessages((prev) => [
          ...prev.map((m) => (m.id === msgId ? { ...m, pendingAction: undefined } : m)),
          {
            id: Date.now().toString(),
            sender: 'assistant',
            text: `¡Gasto (${newExpense.type}) guardado en la base de datos por ${formatCOP(newExpense.amount)}!`,
          },
        ]);
      } else if (type === 'PAYMENT') {
        const amount = Number(data.amount) || 0;
        const requestedSaleId = String(data.saleId || '').trim();
        const clientQuery = String(data.clientName || '').trim().toLowerCase();

        const targetSale =
          sales.find((s) => s.id === requestedSaleId && s.total - s.amountPaid > 0) ||
          sales.find(
            (s) =>
              clientQuery &&
              s.clientName.toLowerCase().includes(clientQuery) &&
              s.total - s.amountPaid > 0
          );

        if (!targetSale) {
          throw new Error(
            'No encontré una venta con saldo pendiente para ese cliente. Puedes registrar el abono desde Cuentas por Cobrar.'
          );
        }

        const validation = validatePaymentInput(amount, targetSale);
        if (!validation.valid) {
          throw new Error(validation.error || 'Monto de abono inválido.');
        }

        if (onRecordPaymentDirect) {
          await onRecordPaymentDirect(targetSale.id, amount);
          setMessages((prev) => [
            ...prev.map((m) => (m.id === msgId ? { ...m, pendingAction: undefined } : m)),
            {
              id: Date.now().toString(),
              sender: 'assistant',
              text: `¡Abono de ${formatCOP(amount)} aplicado a la venta #${targetSale.id} (${targetSale.clientName})! Saldo pendiente actualizado: ${formatCOP(
                Math.max(0, targetSale.total - targetSale.amountPaid - amount)
              )}.`,
            },
          ]);
        } else {
          setMessages((prev) =>
            prev.map((m) => (m.id === msgId ? { ...m, pendingAction: undefined } : m))
          );
          onRecordPaymentModal(targetSale.id);
        }
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          sender: 'assistant',
          isError: true,
          text: `No se pudo completar la operación: ${err?.message || 'Error al guardar en la base de datos.'}`,
        },
      ]);
    } finally {
      setConfirmingActionId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/70 p-3 sm:p-4 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-[#0d1322] border border-slate-200 dark:border-[#1e293b] rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col h-[85vh] max-h-[720px]">
        {/* Header */}
        <div className="bg-slate-50 dark:bg-[#111827] border-b border-slate-200 dark:border-[#1e293b] p-4 sm:p-5 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-600/20 dark:shadow-blue-950 shrink-0">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
                <span>Asistente IA - Maleja Diseños</span>
                <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-full text-[10px] font-semibold border border-blue-200 dark:border-blue-500/30">
                  Gemini IA
                </span>
              </h3>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                Consultas reales y registro controlado por lenguaje natural
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1.5 rounded-xl"
            aria-label="Cerrar asistente"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Prompts */}
        <div className="px-4 py-2.5 bg-white dark:bg-[#0d1322] border-b border-slate-200 dark:border-[#1e293b] flex items-center gap-2 overflow-x-auto">
          {QUICK_PROMPTS.map((q) => (
            <button
              key={q}
              type="button"
              disabled={loading}
              onClick={() => sendPrompt(q)}
              className="px-2.5 py-1 bg-slate-100 dark:bg-[#111827] hover:bg-blue-50 dark:hover:bg-blue-600/20 text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 border border-slate-200 dark:border-[#1e293b] rounded-lg text-[11px] font-medium whitespace-nowrap transition-colors"
            >
              {q}
            </button>
          ))}
        </div>

        {/* Chat Messages */}
        <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4 text-xs bg-[#f8fafc] dark:bg-[#0b101d]">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[88%] p-4 rounded-2xl space-y-3 ${
                  msg.sender === 'user'
                    ? 'bg-blue-600 text-white rounded-br-none shadow-md'
                    : msg.isError
                    ? 'bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-800 dark:text-rose-200 rounded-bl-none'
                    : 'bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#1e293b] text-slate-800 dark:text-slate-200 rounded-bl-none shadow-sm dark:shadow-md'
                }`}
              >
                <div
                  className={`flex items-center space-x-2 pb-1 border-b text-[10px] font-semibold ${
                    msg.sender === 'user'
                      ? 'border-white/20 text-blue-100'
                      : 'border-slate-100 dark:border-white/10 text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {msg.sender === 'user' ? (
                    <User className="w-3.5 h-3.5" />
                  ) : msg.isError ? (
                    <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  )}
                  <span>{msg.sender === 'user' ? 'Tú' : 'Asistente IA'}</span>
                </div>
                <p className="leading-relaxed whitespace-pre-line">{msg.text}</p>

                {/* Pending Action Confirmation Card */}
                {msg.pendingAction && (
                  <div className="p-4 bg-slate-50 dark:bg-[#070b14] border border-blue-200 dark:border-blue-500/30 rounded-xl space-y-3">
                    <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Resumen de Operación Detectada</span>
                    </div>
                    <p className="text-slate-700 dark:text-slate-300 font-medium">
                      {msg.pendingAction.summary}
                    </p>
                    <div className="flex justify-end space-x-2 pt-2 border-t border-slate-200 dark:border-[#1e293b]">
                      <button
                        type="button"
                        disabled={confirmingActionId === msg.id}
                        onClick={() =>
                          setMessages((prev) =>
                            prev.map((m) => (m.id === msg.id ? { ...m, pendingAction: undefined } : m))
                          )
                        }
                        className="px-3 py-1.5 bg-slate-200 dark:bg-[#111827] text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg font-semibold"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        disabled={confirmingActionId === msg.id}
                        onClick={() => handleConfirmAction(msg.id, msg.pendingAction!)}
                        className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold rounded-lg shadow-md"
                      >
                        {confirmingActionId === msg.id ? 'Guardando...' : 'Confirmar y Guardar'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#1e293b] p-4 rounded-2xl rounded-bl-none flex items-center space-x-3 text-slate-500 dark:text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin text-blue-600 dark:text-blue-400" />
                <span>Analizando datos reales y generando respuesta...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <form
          onSubmit={handleSendMessage}
          className="p-3 sm:p-4 bg-white dark:bg-[#111827] border-t border-slate-200 dark:border-[#1e293b] flex items-center space-x-3"
        >
          <input
            type="text"
            placeholder="Ej: ¿Cuánto vendí este mes? o Hoy gasté $50.000 en tintas..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 px-4 py-3 bg-slate-50 dark:bg-[#070b14] border border-slate-200 dark:border-[#1e293b] rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500 text-xs"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="p-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl shadow-lg transition-colors flex items-center justify-center"
            aria-label="Enviar consulta"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
