import React, { useState } from 'react';
import { ProductionCost, Sale, MaterialTemplate } from '../types/finance';
import { formatCOP, getTodayString } from '../utils/formatters';
import {
  generateUniqueId,
  calculateProductionMetrics,
  validateProductionCostInput,
} from '../utils/validation';
import {
  Plus,
  Search,
  Trash2,
  Edit3,
  X,
  BookOpen,
  AlertCircle,
} from 'lucide-react';

interface ProductionViewProps {
  productionCosts: ProductionCost[];
  sales: Sale[];
  materialTemplates: MaterialTemplate[];
  onAddProductionCost: (pc: ProductionCost) => Promise<void> | void;
  onUpdateProductionCost: (pc: ProductionCost) => Promise<void> | void;
  onDeleteProductionCost: (id: string) => Promise<void> | void;
  onAddMaterialTemplate: (template: MaterialTemplate) => void;
}

const commonProducts = [
  'Tarjetas de presentación',
  'Volantes',
  'Pendones',
  'Calcomanías',
  'Impresión en vinilo',
  'DTF',
  'Estampados',
  'Avisos publicitarios',
  'Personalización de motocicletas',
  'Otro',
];

export const ProductionView: React.FC<ProductionViewProps> = ({
  productionCosts,
  sales,
  materialTemplates,
  onAddProductionCost,
  onUpdateProductionCost,
  onDeleteProductionCost,
  onAddMaterialTemplate,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMaterialModalOpen, setIsMaterialModalOpen] = useState(false);
  const [editingPC, setEditingPC] = useState<ProductionCost | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProductionCost | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [materialError, setMaterialError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [date, setDate] = useState(getTodayString());
  const [orderReference, setOrderReference] = useState(sales[0]?.id || 'OTRO');
  const [clientName, setClientName] = useState(sales[0]?.clientName || '');
  const [productName, setProductName] = useState(commonProducts[0]);
  const [quantityProduced, setQuantityProduced] = useState<number>(1);
  const [selectedMaterialId, setSelectedMaterialId] = useState(materialTemplates[0]?.id || '');
  const [materialName, setMaterialName] = useState(materialTemplates[0]?.name || '');
  const [materialQuantity, setMaterialQuantity] = useState<number>(1);
  const [materialUnitPrice, setMaterialUnitPrice] = useState<number>(materialTemplates[0]?.unitPrice || 0);
  const [laborCost, setLaborCost] = useState<number>(0);
  const [productionTime, setProductionTime] = useState('1 hora');
  const [otherCosts, setOtherCosts] = useState<number>(0);
  const [manualSalePrice, setManualSalePrice] = useState<number>(0);
  const [description, setDescription] = useState('');

  // Material template modal state
  const [newMatName, setNewMatName] = useState('');
  const [newMatUnit, setNewMatUnit] = useState('metro');
  const [newMatPrice, setNewMatPrice] = useState<number>(0);

  const handleOpenNew = () => {
    setEditingPC(null);
    setFormError(null);
    setIsSubmitting(false);
    setDate(getTodayString());
    setOrderReference(sales[0]?.id || 'OTRO');
    setClientName(sales[0]?.clientName || 'Cliente General');
    setProductName(commonProducts[0]);
    setQuantityProduced(1);
    setSelectedMaterialId(materialTemplates[0]?.id || '');
    setMaterialName(materialTemplates[0]?.name || '');
    setMaterialQuantity(1);
    setMaterialUnitPrice(materialTemplates[0]?.unitPrice || 0);
    setLaborCost(0);
    setProductionTime('1 hora');
    setOtherCosts(0);
    setManualSalePrice(sales[0]?.total || 0);
    setDescription('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (pc: ProductionCost) => {
    setEditingPC(pc);
    setFormError(null);
    setIsSubmitting(false);
    setDate(pc.date);
    setOrderReference(pc.orderReference);
    setClientName(pc.clientName);
    setProductName(pc.productName);
    setQuantityProduced(pc.quantityProduced);
    setMaterialName(pc.materialName);
    setMaterialQuantity(pc.materialQuantity);
    setMaterialUnitPrice(pc.materialUnitPrice);
    setLaborCost(pc.laborCost);
    setProductionTime(pc.productionTime);
    setOtherCosts(pc.otherCosts);
    setManualSalePrice(pc.salePrice);
    setDescription(pc.description);
    setIsModalOpen(true);
  };

  const handleSaleSelect = (saleId: string) => {
    setFormError(null);
    setOrderReference(saleId);
    const found = sales.find(s => s.id === saleId);
    if (found) {
      setClientName(found.clientName);
      setManualSalePrice(found.total);
    }
  };

  const handleMaterialTemplateSelect = (matId: string) => {
    setSelectedMaterialId(matId);
    const mat = materialTemplates.find(m => m.id === matId);
    if (mat) {
      setMaterialName(mat.name);
      setMaterialUnitPrice(mat.unitPrice);
    }
  };

  // Automatic calculations
  const {
    materialTotalCost,
    totalCost,
    unitCost,
    grossProfit,
    profitMargin,
  } = calculateProductionMetrics({
    quantityProduced,
    materialQuantity,
    materialUnitPrice,
    laborCost,
    otherCosts,
    salePrice: manualSalePrice,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setFormError(null);

    const validation = validateProductionCostInput(
      {
        date,
        orderReference,
        clientName,
        productName,
        quantityProduced,
        materialName,
        materialQuantity,
        materialUnitPrice,
        laborCost,
        otherCosts,
        salePrice: manualSalePrice,
      },
      productionCosts,
      editingPC?.id
    );

    if (!validation.valid) {
      setFormError(validation.error || 'Por favor verifique los datos de producción.');
      return;
    }

    if (editingPC && !productionCosts.some((pc) => pc.id === editingPC.id)) {
      setFormError('Este registro de costo ya no existe en el sistema.');
      return;
    }

    const nextPcId = generateUniqueId(
      'PC-',
      productionCosts.map((pc) => pc.id)
    );

    const pcData: ProductionCost = {
      id: editingPC ? editingPC.id : nextPcId,
      date,
      orderReference: (orderReference.trim() || 'OTRO').slice(0, 50),
      clientName: clientName.trim().slice(0, 150),
      productName: productName.trim().slice(0, 100),
      quantityProduced,
      materialName: materialName.trim().slice(0, 100),
      materialQuantity,
      materialUnitPrice,
      materialTotalCost,
      laborCost,
      productionTime: (productionTime.trim() || '1 hora').slice(0, 50),
      otherCosts,
      totalCost,
      unitCost,
      salePrice: manualSalePrice,
      grossProfit,
      profitMargin,
      description: (description || `Producción de ${productName}`).trim().slice(0, 300),
    };

    setIsSubmitting(true);
    try {
      if (editingPC) {
        await onUpdateProductionCost(pcData);
      } else {
        await onAddProductionCost(pcData);
      }
      setIsModalOpen(false);
    } catch (err: any) {
      setFormError(err?.message || 'Error al guardar el costo de producción en la base de datos.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMaterialTemplateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMaterialError(null);
    if (!newMatName.trim()) {
      setMaterialError('Ingrese el nombre del material.');
      return;
    }
    if (!newMatUnit.trim()) {
      setMaterialError('Ingrese la unidad de medida.');
      return;
    }
    if (!Number.isFinite(newMatPrice) || newMatPrice <= 0) {
      setMaterialError('El costo unitario del material debe ser mayor a cero.');
      return;
    }
    if (materialTemplates.some((m) => m.name.trim().toLowerCase() === newMatName.trim().toLowerCase())) {
      setMaterialError('Este material ya se encuentra registrado en el catálogo.');
      return;
    }

    const newTemplate: MaterialTemplate = {
      id: generateUniqueId('mat-', materialTemplates.map((m) => m.id), 1),
      name: newMatName.trim(),
      unit: newMatUnit.trim(),
      unitPrice: newMatPrice,
    };

    onAddMaterialTemplate(newTemplate);
    setNewMatName('');
    setNewMatPrice(0);
    setIsMaterialModalOpen(false);
  };

  const filtered = productionCosts.filter(pc =>
    pc.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    pc.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    pc.orderReference.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalProductionSum = filtered.reduce((acc, pc) => acc + pc.totalCost, 0);

  return (
    <div className="space-y-6 animate-fadeIn pb-10">
      {/* Header */}
      <div className="bg-white dark:bg-[#0d1322] border border-slate-200 dark:border-[#1e293b] rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-sm dark:shadow-xl transition-colors">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">Costos de Producción y Rentabilidad</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Control de costos de materiales, mano de obra y margen real por trabajo</p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsMaterialModalOpen(true)}
            className="px-3.5 py-2.5 bg-slate-100 dark:bg-[#162032] hover:bg-slate-200 dark:hover:bg-[#1e293b] border border-slate-200 dark:border-[#1e293b] text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl transition-all flex items-center space-x-1.5"
          >
            <BookOpen className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>Catálogo de Materiales</span>
          </button>
          <button
            onClick={handleOpenNew}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl shadow-md dark:shadow-lg dark:shadow-blue-950 transition-all flex items-center justify-center space-x-2"
          >
            <Plus className="w-5 h-5" />
            <span>Registrar Costo de Producción</span>
          </button>
        </div>
      </div>

      {/* Filters bar */}
      <div className="bg-white dark:bg-[#0d1322] border border-slate-200 dark:border-[#1e293b] p-4 rounded-2xl shadow-sm dark:shadow-none flex flex-col sm:flex-row items-center justify-between gap-4 transition-colors">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Buscar por producto, cliente u orden..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-[#1e293b] rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>
        <div className="text-xs font-bold text-slate-800 dark:text-white bg-slate-50 dark:bg-[#111827] border border-slate-200 dark:border-[#1e293b] px-4 py-2 rounded-xl">
          Total Costos Producción: <span className="text-rose-600 dark:text-rose-400">{formatCOP(totalProductionSum)}</span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-[#0d1322] border border-slate-200 dark:border-[#1e293b] rounded-2xl shadow-sm dark:shadow-xl overflow-hidden transition-colors">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-[#111827] border-b border-slate-200 dark:border-[#1e293b] text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">
                <th className="p-4">Producto / Ref</th>
                <th className="p-4">Cliente / Cant.</th>
                <th className="p-4 text-right">Costo Total</th>
                <th className="p-4 text-right">Costo Unitario</th>
                <th className="p-4 text-right">Precio Venta</th>
                <th className="p-4 text-right">Utilidad Bruta</th>
                <th className="p-4 text-center">Margen</th>
                <th className="p-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-[#1e293b] text-xs">
              {filtered.map((pc) => (
                <tr key={pc.id} className="hover:bg-slate-50 dark:hover:bg-[#111827]/50 transition-colors">
                  <td className="p-4">
                    <span className="font-bold text-slate-900 dark:text-white">{pc.productName}</span>
                    <p className="text-[10px] text-blue-600 dark:text-blue-400">Ref: {pc.orderReference}</p>
                  </td>
                  <td className="p-4">
                    <p className="font-semibold text-slate-800 dark:text-slate-200">{pc.clientName}</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">Producidos: {pc.quantityProduced} un.</p>
                  </td>
                  <td className="p-4 text-right font-black text-rose-600 dark:text-rose-400">{formatCOP(pc.totalCost)}</td>
                  <td className="p-4 text-right text-slate-600 dark:text-slate-300">{formatCOP(pc.unitCost)}</td>
                  <td className="p-4 text-right font-bold text-slate-900 dark:text-slate-100">{formatCOP(pc.salePrice)}</td>
                  <td className="p-4 text-right font-black text-emerald-600 dark:text-emerald-400">{formatCOP(pc.grossProfit)}</td>
                  <td className="p-4 text-center">
                    <span className={`inline-flex px-2.5 py-1 rounded-md text-[10px] font-bold ${
                      pc.profitMargin >= 40 
                        ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400' 
                        : 'bg-amber-50 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400'
                    }`}>
                      {pc.profitMargin.toFixed(1)}%
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    <div className="flex items-center justify-center space-x-2">
                      <button onClick={() => handleOpenEdit(pc)} className="p-1.5 bg-slate-100 dark:bg-[#111827] text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-lg">
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button onClick={() => setDeleteTarget(pc)} className="p-1.5 bg-rose-50 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500/30 rounded-lg" title="Eliminar Costo">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-slate-500">
                    No se encontraron registros de costos de producción.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Registrar / Editar Costo de Producción */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/70 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-[#0d1322] border border-slate-200 dark:border-[#1e293b] rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-slate-50 dark:bg-[#111827] text-slate-900 dark:text-white p-5 flex items-center justify-between border-b border-slate-200 dark:border-[#1e293b]">
              <h3 className="text-lg font-bold">
                {editingPC ? 'Editar Costo de Producción' : 'Registrar Costo y Rentabilidad de Trabajo'}
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
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">Fecha *</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-[#1e293b] rounded-xl text-slate-900 dark:text-white font-medium"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">Venta Relacionada</label>
                  <select
                    value={orderReference}
                    onChange={(e) => handleSaleSelect(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-[#1e293b] rounded-xl text-slate-900 dark:text-white font-medium"
                  >
                    {sales.map((s) => (
                      <option key={s.id} value={s.id}>{s.id} - {s.clientName} ({formatCOP(s.total)})</option>
                    ))}
                    <option value="OTRO">Otro / General</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">Cliente</label>
                  <input
                    type="text"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-[#1e293b] rounded-xl text-slate-900 dark:text-white font-medium"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">Nombre del Producto / Servicio *</label>
                  <select
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-[#1e293b] rounded-xl text-slate-900 dark:text-white font-medium"
                  >
                    {commonProducts.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">Cantidad Producida *</label>
                  <input
                    type="number"
                    min="1"
                    value={quantityProduced}
                    onChange={(e) => setQuantityProduced(parseInt(e.target.value) || 1)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-[#1e293b] rounded-xl text-slate-900 dark:text-white font-bold"
                    required
                  />
                </div>
              </div>

              {/* Material selection */}
              <div className="p-4 bg-slate-50 dark:bg-[#111827] border border-slate-200 dark:border-[#1e293b] rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-700 dark:text-slate-300 uppercase">Material Utilizado</h4>
                  <select
                    value={selectedMaterialId}
                    onChange={(e) => handleMaterialTemplateSelect(e.target.value)}
                    className="px-3 py-1.5 bg-white dark:bg-[#070b14] border border-slate-200 dark:border-[#1e293b] rounded-lg text-slate-900 dark:text-white text-xs"
                  >
                    <option value="">-- Usar plantilla de material --</option>
                    {materialTemplates.map(m => (
                      <option key={m.id} value={m.id}>{m.name} ({formatCOP(m.unitPrice)}/{m.unit})</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-500 uppercase">Nombre Material</label>
                    <input
                      type="text"
                      value={materialName}
                      onChange={(e) => setMaterialName(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-[#070b14] border border-slate-200 dark:border-[#1e293b] rounded-lg text-slate-900 dark:text-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-500 uppercase">Cantidad Material</label>
                    <input
                      type="number"
                      min="0.1"
                      step="0.1"
                      value={materialQuantity}
                      onChange={(e) => setMaterialQuantity(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-white dark:bg-[#070b14] border border-slate-200 dark:border-[#1e293b] rounded-lg text-slate-900 dark:text-white font-bold"
                      required
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-500 uppercase">Costo Unit. Material ($)</label>
                    <input
                      type="number"
                      min="0"
                      step="500"
                      value={materialUnitPrice}
                      onChange={(e) => setMaterialUnitPrice(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-white dark:bg-[#070b14] border border-slate-200 dark:border-[#1e293b] rounded-lg text-slate-900 dark:text-white font-bold"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">Mano de Obra ($)</label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={laborCost}
                    onChange={(e) => setLaborCost(parseFloat(e.target.value) || 0)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-[#1e293b] rounded-xl text-slate-900 dark:text-white font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">Tiempo de Producción</label>
                  <input
                    type="text"
                    placeholder="Ej. 2 horas"
                    value={productionTime}
                    onChange={(e) => setProductionTime(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-[#1e293b] rounded-xl text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">Otros Costos Directos ($)</label>
                  <input
                    type="number"
                    min="0"
                    step="500"
                    value={otherCosts}
                    onChange={(e) => setOtherCosts(parseFloat(e.target.value) || 0)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-[#1e293b] rounded-xl text-slate-900 dark:text-white font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">Precio de Venta Neto ($)</label>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={manualSalePrice}
                  onChange={(e) => setManualSalePrice(parseFloat(e.target.value) || 0)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-[#1e293b] rounded-xl text-slate-900 dark:text-white font-bold"
                  required
                />
              </div>

              {/* Live Calculations Summary Box */}
              <div className="p-4 bg-slate-50 dark:bg-[#111827] rounded-xl border border-slate-200 dark:border-[#1e293b] grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase">Costo Total</p>
                  <p className="text-sm font-black text-rose-600 dark:text-rose-400 mt-1">{formatCOP(totalCost)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase">Costo Unitario</p>
                  <p className="text-sm font-black text-slate-800 dark:text-slate-200 mt-1">{formatCOP(unitCost)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase">Utilidad Bruta</p>
                  <p className="text-sm font-black text-emerald-600 dark:text-emerald-400 mt-1">{formatCOP(grossProfit)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase">Margen %</p>
                  <p className="text-sm font-black text-blue-600 dark:text-blue-400 mt-1">{profitMargin.toFixed(1)}%</p>
                </div>
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
                  {isSubmitting ? 'Guardando...' : 'Guardar Costo y Rentabilidad'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Material Template Catalog Modal */}
      {isMaterialModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/70 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-[#0d1322] border border-slate-200 dark:border-[#1e293b] rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
            <div className="bg-slate-50 dark:bg-[#111827] text-slate-900 dark:text-white p-5 flex items-center justify-between border-b border-slate-200 dark:border-[#1e293b]">
              <h3 className="text-lg font-bold">Catálogo de Materiales Habituales</h3>
              <button onClick={() => setIsMaterialModalOpen(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-white"><X className="w-6 h-6" /></button>
            </div>
            
            <div className="p-6 space-y-4 text-xs">
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {materialTemplates.map(m => (
                  <div key={m.id} className="p-3 bg-slate-50 dark:bg-[#111827] border border-slate-200 dark:border-[#1e293b] rounded-xl flex items-center justify-between">
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white">{m.name}</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">Unidad de medida: {m.unit}</p>
                    </div>
                    <span className="font-black text-blue-600 dark:text-blue-400">{formatCOP(m.unitPrice)}</span>
                  </div>
                ))}
              </div>

              <form onSubmit={handleMaterialTemplateSubmit} className="pt-4 border-t border-slate-200 dark:border-[#1e293b] space-y-3">
                <h4 className="font-bold text-slate-700 dark:text-slate-300">Añadir Nuevo Material al Catálogo</h4>
                {materialError && (
                  <div className="p-3 bg-rose-50 dark:bg-rose-500/15 border border-rose-200 dark:border-rose-500/30 rounded-xl flex items-center gap-2 text-rose-700 dark:text-rose-300 font-medium">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{materialError}</span>
                  </div>
                )}
                <div>
                  <label className="block font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Nombre del Material</label>
                  <input
                    type="text"
                    placeholder="Ej. Vinilo Microperforado"
                    value={newMatName}
                    onChange={(e) => setNewMatName(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-[#1e293b] rounded-xl text-slate-900 dark:text-white"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Unidad</label>
                    <input
                      type="text"
                      placeholder="metro, pliegos, litro"
                      value={newMatUnit}
                      onChange={(e) => setNewMatUnit(e.target.value)}
                      className="w-full px-3.5 py-2 bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-[#1e293b] rounded-xl text-slate-900 dark:text-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Costo Unitario ($)</label>
                    <input
                      type="number"
                      min="1"
                      step="500"
                      value={newMatPrice}
                      onChange={(e) => setNewMatPrice(parseFloat(e.target.value) || 0)}
                      className="w-full px-3.5 py-2 bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-[#1e293b] rounded-xl text-slate-900 dark:text-white font-bold"
                      required
                    />
                  </div>
                </div>
                <div className="flex justify-end pt-2">
                  <button type="submit" className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl">
                    Guardar en Catálogo
                  </button>
                </div>
              </form>
            </div>
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
            <h3 className="text-base font-bold text-slate-900 dark:text-white">¿Eliminar Costo de Producción?</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Se eliminará el costo de <span className="font-bold text-slate-900 dark:text-white">{deleteTarget.productName}</span> (Ref: {deleteTarget.orderReference}) por{' '}
              <span className="font-bold text-rose-600 dark:text-rose-400">{formatCOP(deleteTarget.totalCost)}</span>.
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
                  await onDeleteProductionCost(id);
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
