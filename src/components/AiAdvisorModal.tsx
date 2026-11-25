import React, { useState } from 'react';
import { Sale, Expense, ProductionCost } from '../types/finance';
import { formatCOP } from '../utils/formatters';
import { getCurrentIdToken } from '../services/firebaseService';
import { Bot, X, Sparkles, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

interface AiAdvisorModalProps {
  isOpen: boolean;
  onClose: () => void;
  sales: Sale[];
  expenses: Expense[];
  productionCosts: ProductionCost[];
}

export const AiAdvisorModal: React.FC<AiAdvisorModalProps> = ({
  isOpen,
  onClose,
  sales,
  expenses,
  productionCosts,
}) => {
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleRunAnalysis = async () => {
    setLoading(true);
    setError(null);

    try {
      const totalSales = sales.reduce((acc, s) => acc + s.total, 0);
      const totalCollected = sales.reduce((acc, s) => acc + s.amountPaid, 0);
      const totalPending = Math.max(0, totalSales - totalCollected);
      const totalExpenses = expenses.reduce((acc, e) => acc + e.amount, 0);
      const totalProduction = productionCosts.reduce((acc, p) => acc + p.totalCost, 0);
      const netProfit = totalSales - totalProduction - totalExpenses;

      const summaryPrompt = `
Eres un asesor financiero experto para "Maleja Diseños", una empresa colombiana de publicidad, impresión digital, gran formato y diseño gráfico.
Analiza los siguientes datos financieros resumidos del negocio en pesos colombianos (COP) y proporciona un diagnóstico profesional, claro, motivador y con recomendaciones tácticas para mejorar la rentabilidad, el flujo de caja y el control de costos.

DATOS FINANCIEROS:
- Ventas Facturadas Registradas: ${formatCOP(totalSales)}
- Dinero Real Recibido: ${formatCOP(totalCollected)}
- Cuentas por Cobrar Pendientes: ${formatCOP(totalPending)}
- Gastos Operativos Totales (Fijos y Variables): ${formatCOP(totalExpenses)}
- Costos Directos de Producción: ${formatCOP(totalProduction)}
- Utilidad Neta Estimada (Ventas - Costos Producción - Gastos): ${formatCOP(netProfit)}
- Número de Ventas Registradas: ${sales.length}
- Número de Gastos Registrados: ${expenses.length}

Por favor responde en español, de manera estructurada con viñetas:
1. Diagnóstico general de la salud financiera de Maleja Diseños.
2. Análisis de márgenes y control de costos (materiales, mano de obra, gastos fijos).
3. Sugerencias clave para acelerar el recaudo de cuentas por cobrar.
4. Tres recomendaciones estratégicas para impulsar las ventas en el sector de artes gráficas y publicidad.
`;

      const idToken = await getCurrentIdToken();
      if (!idToken) {
        throw new Error('Tu sesión no está activa. Inicia sesión nuevamente.');
      }

      const res = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ summaryPrompt }),
      });

      const payload = (await res.json().catch(() => ({}))) as { text?: string; error?: string };
      if (!res.ok) {
        throw new Error(payload.error || 'Error al consultar el Asesor IA.');
      }

      setAnalysis(payload.text || 'No se pudo generar el análisis en este momento.');
    } catch (err: any) {
      setError(err?.message || 'Error al conectar con la Inteligencia Artificial.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/70 p-4 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-[#0d1322] border border-slate-200 dark:border-[#1e293b] rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-5 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-white/15 rounded-xl backdrop-blur-md">
              <Sparkles className="w-6 h-6 text-blue-100" />
            </div>
            <div>
              <h3 className="text-xl font-bold">Asesor Financiero IA - Maleja Diseños</h3>
              <p className="text-xs text-blue-100">Análisis inteligente de rentabilidad y flujo de caja</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-blue-100 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {!analysis && !loading && (
            <div className="text-center py-10 space-y-4">
              <div className="w-16 h-16 bg-blue-50 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center mx-auto">
                <Bot className="w-8 h-8" />
              </div>
              <h4 className="text-lg font-bold text-slate-900 dark:text-white">¿Listo para auditar tus finanzas?</h4>
              <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto">
                La Inteligencia Artificial analizará tus ventas, ingresos reales, costos de producción y gastos actuales para darte recomendaciones financieras a la medida de Maleja Diseños.
              </p>
              <button
                type="button"
                onClick={handleRunAnalysis}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-xl shadow-lg shadow-blue-600/20 dark:shadow-blue-950 transition-all transform hover:-translate-y-0.5 flex items-center space-x-2 mx-auto"
              >
                <Sparkles className="w-5 h-5" />
                <span>Analizar Finanzas con IA</span>
              </button>
            </div>
          )}

          {loading && (
            <div className="text-center py-16 space-y-4">
              <Loader2 className="w-12 h-12 text-blue-600 dark:text-blue-400 animate-spin mx-auto" />
              <p className="text-slate-600 dark:text-slate-300 font-medium">Analizando datos contables y generando recomendaciones...</p>
            </div>
          )}

          {error && (
            <div className="p-4 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 rounded-xl flex items-start space-x-3 text-rose-800 dark:text-rose-300">
              <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5" />
              <div>
                <h5 className="font-semibold">Aviso</h5>
                <p className="text-sm">{error}</p>
              </div>
            </div>
          )}

          {analysis && !loading && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-[#1e293b]">
                <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider flex items-center space-x-1">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Diagnóstico Financiero Generado</span>
                </span>
                <button
                  type="button"
                  onClick={handleRunAnalysis}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
                >
                  Volver a analizar
                </button>
              </div>
              <div className="prose dark:prose-invert max-w-none text-sm leading-relaxed bg-slate-50 dark:bg-[#111827] text-slate-800 dark:text-slate-200 p-6 rounded-2xl border border-slate-200 dark:border-[#1e293b] whitespace-pre-line">
                {analysis}
              </div>
            </div>
          )}
        </div>

        <div className="bg-slate-50 dark:bg-[#111827] px-6 py-4 border-t border-slate-200 dark:border-[#1e293b] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-200 dark:bg-[#1e293b] hover:bg-slate-300 dark:hover:bg-[#334155] text-slate-700 dark:text-slate-200 font-medium rounded-xl transition-colors text-sm"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
