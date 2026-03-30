import { useState, useEffect, useMemo } from 'react';
import { useWarehouse } from '@/contexts/WarehouseContext';
import { Plus, X, Copy, Pencil, Trash2, FileText } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { MovementType, StockMovement, MovementItem } from '@/types/warehouse';
import { UNITS } from '../utils/movementUtils';

export interface MovementDialogsProps {
  addMovement: any;
  updateMovement: any;
  deleteMovement: any;
  getProductName: any;
  getWarehouseName: any;
  getSupplierName: any;
  getClientName: any;
  getUserName: any;
  refreshAll: any;
  products: any[];
  warehouses: any[];
  suppliers: any[];
  clients: any[];
  movements: any[];
  isAdmin: boolean;
  toast: any;
  addSingleOpen: boolean;
  setAddSingleOpen: (open: boolean) => void;
  addMultiOpen: boolean;
  setAddMultiOpen: (open: boolean) => void;
  editFullOpen: boolean;
  setEditFullOpen: (open: boolean) => void;
  duplicateOpen: boolean;
  setDuplicateOpen: (open: boolean) => void;
  deleteOpen: boolean;
  setDeleteOpen: (open: boolean) => void;
  bulkDeleteOpen: boolean;
  setBulkDeleteOpen: (open: boolean) => void;
  editingMovement: StockMovement | null;
  setEditingMovement: (movement: StockMovement | null) => void;
  duplicateMovement: StockMovement | null;
  setDuplicateMovement: (movement: StockMovement | null) => void;
  deletingMovement: StockMovement | null;
  setDeletingMovement: (movement: StockMovement | null) => void;
  selectedItems: Set<string>;
  setSelectedItems: (items: Set<string>) => void;
  validateProductUnit: (productId: string, selectedUnit: string) => boolean;
  getCurrentStock: (productId: string, warehouseId: string) => number;
  getProductMinQty: (productId: string) => number;
  getStockMapForWarehouse: (warehouseId: string) => Map<string, number>;
  preventDecimal: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  refreshAll: () => Promise<void>;
}

export const MovementDialogs: React.FC<MovementDialogsProps> = ({
  addMovement,
  updateMovement,
  deleteMovement,
  getProductName,
  getWarehouseName,
  getSupplierName,
  getClientName,
  products,
  warehouses,
  suppliers,
  clients,
  isAdmin,
  toast,
  addSingleOpen,
  setAddSingleOpen,
  addMultiOpen,
  setAddMultiOpen,
  editFullOpen,
  setEditFullOpen,
  duplicateOpen,
  setDuplicateOpen,
  deleteOpen,
  setDeleteOpen,
  bulkDeleteOpen,
  setBulkDeleteOpen,
  editingMovement,
  setEditingMovement,
  duplicateMovement,
  setDuplicateMovement,
  deletingMovement,
  setDeletingMovement,
  selectedItems,
  setSelectedItems,
  validateProductUnit,
  getCurrentStock,
  getProductMinQty,
  getStockMapForWarehouse,
  preventDecimal,
  refreshAll,
}) => {
  const [saving, setSaving] = useState(false);
  const [movementType, setMovementType] = useState<'single' | 'multi'>('single');

  // ========== نموذج الحركة الواحدة ==========
  const [form, setForm] = useState({
    product_id: '',
    warehouse_id: '',
    type: 'in' as MovementType,
    quantity: null as number | null,
    entity_id: '',
    entity_type: 'supplier' as 'supplier' | 'client',
    date: new Date().toISOString().split('T')[0],
    notes: '',
    unit: ''
  });

  // ========== نموذج الحركة المتعددة ==========
  const [multiForm, setMultiForm] = useState({
    warehouse_id: '',
    type: 'in' as MovementType,
    entity_id: '',
    entity_type: 'supplier' as 'supplier' | 'client',
    date: new Date().toISOString().split('T')[0],
    notes: ''
  });
  const [items, setItems] = useState<MovementItem[]>([
    { product_id: '', quantity: null, unit: '', notes: '' }
  ]);

  // ========== نموذج التعديل الشامل للحركة المفردة ==========
  const [editSingleForm, setEditSingleForm] = useState({
    product_id: '',
    warehouse_id: '',
    type: 'in' as MovementType,
    quantity: null as number | null,
    entity_id: '',
    entity_type: 'supplier' as 'supplier' | 'client',
    date: '',
    notes: '',
    unit: ''
  });

  // ========== نموذج التعديل الشامل للحركة المتعددة ==========
  const [editMultiForm, setEditMultiForm] = useState({
    warehouse_id: '',
    type: 'in' as MovementType,
    entity_id: '',
    entity_type: 'supplier' as 'supplier' | 'client',
    date: '',
    notes: ''
  });
  const [editItems, setEditItems] = useState<MovementItem[]>([]);
  const [editType, setEditType] = useState<'single' | 'multi'>('single');

  // ========== نموذج النسخ للحركة المفردة ==========
  const [duplicateSingleForm, setDuplicateSingleForm] = useState({
    product_id: '',
    warehouse_id: '',
    type: 'in' as MovementType,
    quantity: null as number | null,
    entity_id: '',
    entity_type: 'supplier' as 'supplier' | 'client',
    date: '',
    notes: '',
    unit: ''
  });

  // ========== نموذج النسخ للحركة المتعددة ==========
  const [duplicateMultiForm, setDuplicateMultiForm] = useState({
    warehouse_id: '',
    type: 'in' as MovementType,
    entity_id: '',
    entity_type: 'supplier' as 'supplier' | 'client',
    date: '',
    notes: ''
  });
  const [duplicateItems, setDuplicateItems] = useState<MovementItem[]>([]);
  const [duplicateType, setDuplicateType] = useState<'single' | 'multi'>('single');

  // ========== useEffect لملء بيانات التعديل عند فتح الحوار ==========
  useEffect(() => {
    if (editingMovement && editFullOpen) {
      if (editingMovement.product_id) {
        setEditType('single');
        setEditSingleForm({
          product_id: editingMovement.product_id,
          warehouse_id: editingMovement.warehouse_id,
          type: editingMovement.type,
          quantity: editingMovement.quantity ?? null,
          entity_id: editingMovement.entity_id,
          entity_type: editingMovement.entity_type,
          date: editingMovement.date,
          notes: editingMovement.notes || '',
          unit: editingMovement.unit || ''
        });
      } else if (editingMovement.items && editingMovement.items.length > 0) {
        setEditType('multi');
        setEditMultiForm({
          warehouse_id: editingMovement.warehouse_id,
          type: editingMovement.type,
          entity_id: editingMovement.entity_id,
          entity_type: editingMovement.entity_type,
          date: editingMovement.date,
          notes: editingMovement.notes || ''
        });
        setEditItems(editingMovement.items.map(item => ({ ...item })));
      }
    }
  }, [editingMovement, editFullOpen]);

  // ========== useEffect لملء بيانات النسخ عند فتح الحوار ==========
  useEffect(() => {
    if (duplicateMovement && duplicateOpen) {
      if (duplicateMovement.product_id) {
        setDuplicateType('single');
        setDuplicateSingleForm({
          product_id: duplicateMovement.product_id,
          warehouse_id: duplicateMovement.warehouse_id,
          type: duplicateMovement.type,
          quantity: duplicateMovement.quantity ?? null,
          entity_id: duplicateMovement.entity_id,
          entity_type: duplicateMovement.entity_type,
          date: new Date().toISOString().split('T')[0],
          notes: duplicateMovement.notes || '',
          unit: duplicateMovement.unit || ''
        });
      } else if (duplicateMovement.items && duplicateMovement.items.length > 0) {
        setDuplicateType('multi');
        setDuplicateMultiForm({
          warehouse_id: duplicateMovement.warehouse_id,
          type: duplicateMovement.type,
          entity_id: duplicateMovement.entity_id,
          entity_type: duplicateMovement.entity_type,
          date: new Date().toISOString().split('T')[0],
          notes: duplicateMovement.notes || ''
        });
        setDuplicateItems(duplicateMovement.items.map(item => ({ ...item, quantity: item.quantity })));
      }
    }
  }, [duplicateMovement, duplicateOpen]);

  // ========== دوال مساعدة للإضافة ==========
  const handleTypeChange = (type: MovementType) => {
    const entity_type = type === 'in' ? 'supplier' : 'client';
    const entity_id = '';
    if (movementType === 'single') setForm({ ...form, type, entity_type, entity_id });
    else setMultiForm({ ...multiForm, type, entity_type, entity_id });
  };

  const addItem = () => setItems([...items, { product_id: '', quantity: null, unit: '', notes: '' }]);
  const removeItem = (index: number) => setItems(items.filter((_, i) => i !== index));
  const updateItem = (index: number, field: keyof MovementItem, value: any) => {
    const newItems = [...items];
    if (field === 'quantity') {
      const numericValue = value === '' ? null : Number(value);
      newItems[index] = { ...newItems[index], [field]: numericValue };
    } else {
      newItems[index] = { ...newItems[index], [field]: value };
    }
    setItems(newItems);
  };

  // ========== دوال مساعدة للتعديل ==========
  const addEditItem = () => setEditItems([...editItems, { product_id: '', quantity: null, unit: '', notes: '' }]);
  const removeEditItem = (index: number) => setEditItems(editItems.filter((_, i) => i !== index));
  const updateEditItem = (index: number, field: keyof MovementItem, value: any) => {
    const newItems = [...editItems];
    if (field === 'quantity') {
      const numericValue = value === '' ? null : Number(value);
      newItems[index] = { ...newItems[index], [field]: numericValue };
    } else {
      newItems[index] = { ...newItems[index], [field]: value };
    }
    setEditItems(newItems);
  };

  // ========== دوال مساعدة للنسخ ==========
  const addDuplicateItem = () => setDuplicateItems([...duplicateItems, { product_id: '', quantity: null, unit: '', notes: '' }]);
  const removeDuplicateItem = (index: number) => setDuplicateItems(duplicateItems.filter((_, i) => i !== index));
  const updateDuplicateItem = (index: number, field: keyof MovementItem, value: any) => {
    const newItems = [...duplicateItems];
    if (field === 'quantity') {
      const numericValue = value === '' ? null : Number(value);
      newItems[index] = { ...newItems[index], [field]: numericValue };
    } else {
      newItems[index] = { ...newItems[index], [field]: value };
    }
    setDuplicateItems(newItems);
  };

  // ========== ✅ دالة التحقق من الوحدة مع دعم التحويل ==========
  const validateProductUnitWithConversion = (productId: string, selectedUnit: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) {
      toast({ title: 'خطأ', description: 'المنتج غير موجود', variant: 'destructive' });
      return false;
    }

    // إذا كانت الوحدة المختارة هي نفس وحدة المنتج
    if (product.unit === selectedUnit) return true;

    // ✅ التحقق من إمكانية التحويل (إذا كان المنتج له pack_size)
    if (product.pack_size && product.pack_size > 1) {
      // كرتون ← علبة / قطعة
      if (product.unit === 'كرتون' && (selectedUnit === 'علبة' || selectedUnit === 'قطعة')) {
        return true;
      }
      // علبة ← كرتون
      if (product.unit === 'علبة' && selectedUnit === 'كرتون') {
        return true;
      }
      // كيس ← كيلو
      if (product.unit === 'كيس' && selectedUnit === 'كيلو') {
        return true;
      }
      // كيلو ← كيس
      if (product.unit === 'كيلو' && selectedUnit === 'كيس') {
        return true;
      }
    }

    toast({
      title: 'خطأ في الوحدة',
      description: `المنتج "${product.name}" وحدته الأساسية هي "${product.unit}". لا يمكن تسجيل حركة بوحدة "${selectedUnit}".`,
      variant: 'destructive'
    });
    return false;
  };

  // ========== ✅ دالة تحويل الكمية إلى وحدة المنتج الأساسية ==========
  const convertToProductUnit = (product: any, quantity: number, selectedUnit: string) => {
    if (!product || !product.pack_size || product.pack_size <= 1) {
      return { quantity, unit: selectedUnit };
    }

    // كرتون ← علبة/قطعة (المنتج وحدته كرتون، والمستخدم اختار علبة)
    if (product.unit === 'كرتون' && selectedUnit === 'علبة') {
      return { quantity: quantity / product.pack_size, unit: 'كرتون' };
    }
    // علبة ← كرتون (المنتج وحدته علبة، والمستخدم اختار كرتون)
    if (product.unit === 'علبة' && selectedUnit === 'كرتون') {
      return { quantity: quantity * product.pack_size, unit: 'علبة' };
    }
    // كيس ← كيلو
    if (product.unit === 'كيس' && selectedUnit === 'كيلو') {
      return { quantity: quantity / product.pack_size, unit: 'كيس' };
    }
    // كيلو ← كيس
    if (product.unit === 'كيلو' && selectedUnit === 'كيس') {
      return { quantity: quantity * product.pack_size, unit: 'كيلو' };
    }
    // كرتون ← قطعة
    if (product.unit === 'كرتون' && selectedUnit === 'قطعة') {
      return { quantity: quantity / product.pack_size, unit: 'كرتون' };
    }

    return { quantity, unit: selectedUnit };
  };

  // ========== دوال الحفظ ==========
  const handleAddSave = async () => {
    setSaving(true);
    try {
      if (movementType === 'single') {
        // التحقق من الحقول الأساسية
        if (!form.warehouse_id) {
          toast({ title: 'خطأ', description: 'الرجاء اختيار المخزن', variant: 'destructive' });
          return;
        }
        if (!form.product_id) {
          toast({ title: 'خطأ', description: 'الرجاء اختيار المنتج', variant: 'destructive' });
          return;
        }
        if (!form.unit) {
          toast({ title: 'خطأ', description: 'الرجاء اختيار الوحدة', variant: 'destructive' });
          return;
        }
        if (!form.entity_id) {
          const entityName = form.type === 'in' ? 'المورد' : 'جهة الصرف';
          toast({ title: 'خطأ', description: `الرجاء اختيار ${entityName}`, variant: 'destructive' });
          return;
        }
        if (form.quantity === null || form.quantity <= 0) {
          toast({ title: 'خطأ', description: 'الكمية يجب أن تكون أكبر من صفر', variant: 'destructive' });
          return;
        }

        // ✅ التحقق من الوحدة مع دعم التحويل
        if (!validateProductUnitWithConversion(form.product_id, form.unit)) return;

        // ✅ تحويل الكمية إلى وحدة المنتج الأساسية
        const product = products.find(p => p.id === form.product_id);
        const converted = convertToProductUnit(product, form.quantity, form.unit);
        
        // التحقق من الرصيد بعد التحويل
        const currentStock = getCurrentStock(form.product_id, form.warehouse_id);
        if (form.type === 'out') {
          if (currentStock < converted.quantity) {
            toast({
              title: 'خطأ في الكمية',
              description: `الرصيد المتوفر في مخزن (${getWarehouseName(form.warehouse_id)}) هو (${currentStock}) فقط. لا يمكن صرف كمية أكبر.`,
              variant: 'destructive'
            });
            return;
          }
          const minQty = getProductMinQty(form.product_id);
          const newStock = currentStock - converted.quantity;
          if (newStock < minQty && minQty > 0) {
            toast({
              title: '⚠️ تحذير: مخزون أقل من الحد الأدنى',
              description: `بعد هذه العملية، سيصبح المخزون (${newStock}) وهو أقل من الحد الأدنى المحدد (${minQty}).`,
              variant: 'destructive'
            });
            return;
          }
        }

        await addMovement({ ...form, quantity: converted.quantity, unit: converted.unit });
        const typeMsg = form.type === 'in' ? 'تم توريد للمخزن بنجاح' : 'تم تصدير حركة بنجاح';
        toast({ title: editingMovement ? 'تم التعديل' : (form.type === 'in' ? '✅ توريد' : '📤 تصدير'), description: typeMsg });
      } else {
        // حركة متعددة (نفس الكود السابق مع دعم التحويل)
        if (!multiForm.warehouse_id) {
          toast({ title: 'خطأ', description: 'الرجاء اختيار المخزن', variant: 'destructive' });
          return;
        }
        if (!multiForm.entity_id) {
          const entityName = multiForm.type === 'in' ? 'المورد' : 'جهة الصرف';
          toast({ title: 'خطأ', description: `الرجاء اختيار ${entityName}`, variant: 'destructive' });
          return;
        }
        if (items.length === 0) {
          toast({ title: 'خطأ', description: 'يجب إضافة صنف واحد على الأقل', variant: 'destructive' });
          return;
        }

        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          if (!item.product_id) {
            toast({ title: 'خطأ', description: `الصنف ${i+1}: الرجاء اختيار منتج`, variant: 'destructive' });
            return;
          }
          if (!item.unit) {
            toast({ title: 'خطأ', description: `الصنف ${i+1}: الرجاء اختيار الوحدة`, variant: 'destructive' });
            return;
          }
          if (item.quantity === null || item.quantity <= 0) {
            toast({ title: 'خطأ', description: `الصنف ${i+1}: الكمية يجب أن تكون أكبر من صفر`, variant: 'destructive' });
            return;
          }
          if (!validateProductUnitWithConversion(item.product_id, item.unit)) return;
        }

        if (multiForm.type === 'out') {
          const stockMap = getStockMapForWarehouse(multiForm.warehouse_id);
          for (const item of items) {
            const product = products.find(p => p.id === item.product_id);
            const converted = convertToProductUnit(product, item.quantity, item.unit);
            const currentStock = stockMap.get(item.product_id) || 0;
            if (currentStock < converted.quantity) {
              toast({
                title: 'خطأ في الكمية',
                description: `المنتج ${getProductName(item.product_id)}: الرصيد المتوفر في المخزن هو ${currentStock} فقط.`,
                variant: 'destructive'
              });
              return;
            }
            const minQty = getProductMinQty(item.product_id);
            const newStock = currentStock - converted.quantity;
            if (newStock < minQty && minQty > 0) {
              toast({
                title: '⚠️ تحذير: مخزون أقل من الحد الأدنى',
                description: `المنتج ${getProductName(item.product_id)}: بعد الصرف سيصبح المخزون (${newStock}) وهو أقل من الحد الأدنى المحدد (${minQty}).`,
                variant: 'destructive'
              });
              return;
            }
          }
        }

        const itemsToSave = items.map(item => {
          const product = products.find(p => p.id === item.product_id);
          const converted = convertToProductUnit(product, item.quantity, item.unit);
          return { ...item, quantity: converted.quantity, unit: converted.unit };
        });
        
        await addMovement({
          type: multiForm.type,
          warehouse_id: multiForm.warehouse_id,
          entity_type: multiForm.entity_type,
          entity_id: multiForm.entity_id,
          date: multiForm.date,
          notes: multiForm.notes,
          items: itemsToSave
        });
        toast({ title: '✅ تمت الإضافة', description: `تم تسجيل حركة لـ ${items.length} منتج بنجاح` });
      }
      setAddSingleOpen(false);
      setAddMultiOpen(false);
      await refreshAll();
    } catch (error) {
      console.error('Error saving movement:', error);
      toast({ title: 'خطأ', description: 'حدث خطأ أثناء حفظ الحركة', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleEditSave = async () => {
    if (!editingMovement) return;
    
    setSaving(true);
    try {
      if (editType === 'single') {
        if (!editSingleForm.warehouse_id) {
          toast({ title: 'خطأ', description: 'الرجاء اختيار المخزن', variant: 'destructive' });
          return;
        }
        if (!editSingleForm.product_id) {
          toast({ title: 'خطأ', description: 'الرجاء اختيار المنتج', variant: 'destructive' });
          return;
        }
        if (!editSingleForm.unit) {
          toast({ title: 'خطأ', description: 'الرجاء اختيار الوحدة', variant: 'destructive' });
          return;
        }
        if (!editSingleForm.entity_id) {
          const entityName = editSingleForm.type === 'in' ? 'المورد' : 'جهة الصرف';
          toast({ title: 'خطأ', description: `الرجاء اختيار ${entityName}`, variant: 'destructive' });
          return;
        }
        if (editSingleForm.quantity === null || editSingleForm.quantity <= 0) {
          toast({ title: 'خطأ', description: 'الكمية يجب أن تكون أكبر من صفر', variant: 'destructive' });
          return;
        }
        
        if (!validateProductUnitWithConversion(editSingleForm.product_id, editSingleForm.unit)) return;
        
        const product = products.find(p => p.id === editSingleForm.product_id);
        const converted = convertToProductUnit(product, editSingleForm.quantity, editSingleForm.unit);
        
        await updateMovement({
          ...editingMovement,
          ...editSingleForm,
          quantity: converted.quantity,
          unit: converted.unit
        });
        toast({ title: 'تم التعديل', description: 'تم تعديل الحركة بنجاح' });
      } else {
        // حركة متعددة
        if (!editMultiForm.warehouse_id) {
          toast({ title: 'خطأ', description: 'الرجاء اختيار المخزن', variant: 'destructive' });
          return;
        }
        if (!editMultiForm.entity_id) {
          const entityName = editMultiForm.type === 'in' ? 'المورد' : 'جهة الصرف';
          toast({ title: 'خطأ', description: `الرجاء اختيار ${entityName}`, variant: 'destructive' });
          return;
        }
        if (editItems.length === 0) {
          toast({ title: 'خطأ', description: 'يجب إضافة صنف واحد على الأقل', variant: 'destructive' });
          return;
        }
        
        for (let i = 0; i < editItems.length; i++) {
          const item = editItems[i];
          if (!item.product_id) {
            toast({ title: 'خطأ', description: `الصنف ${i+1}: الرجاء اختيار منتج`, variant: 'destructive' });
            return;
          }
          if (!item.unit) {
            toast({ title: 'خطأ', description: `الصنف ${i+1}: الرجاء اختيار الوحدة`, variant: 'destructive' });
            return;
          }
          if (item.quantity === null || item.quantity <= 0) {
            toast({ title: 'خطأ', description: `الصنف ${i+1}: الكمية يجب أن تكون أكبر من صفر`, variant: 'destructive' });
            return;
          }
          if (!validateProductUnitWithConversion(item.product_id, item.unit)) return;
        }
        
        const itemsToSave = editItems.map(item => {
          const product = products.find(p => p.id === item.product_id);
          const converted = convertToProductUnit(product, item.quantity, item.unit);
          return { ...item, quantity: converted.quantity, unit: converted.unit };
        });
        
        await updateMovement({
          ...editingMovement,
          ...editMultiForm,
          items: itemsToSave
        });
        toast({ title: 'تم التعديل', description: 'تم تعديل الحركة بنجاح' });
      }
      
      setEditFullOpen(false);
      setEditingMovement(null);
      await refreshAll();
    } catch (error) {
      console.error('Error updating movement:', error);
      toast({ title: 'خطأ', description: 'حدث خطأ أثناء تعديل الحركة', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDuplicateSave = async () => {
    if (!duplicateMovement) return;
    
    setSaving(true);
    try {
      let newMovement: any;
      
      if (duplicateType === 'single') {
        if (!duplicateSingleForm.warehouse_id) {
          toast({ title: 'خطأ', description: 'الرجاء اختيار المخزن', variant: 'destructive' });
          return;
        }
        if (!duplicateSingleForm.product_id) {
          toast({ title: 'خطأ', description: 'الرجاء اختيار المنتج', variant: 'destructive' });
          return;
        }
        if (!duplicateSingleForm.unit) {
          toast({ title: 'خطأ', description: 'الرجاء اختيار الوحدة', variant: 'destructive' });
          return;
        }
        if (!duplicateSingleForm.entity_id) {
          const entityName = duplicateSingleForm.type === 'in' ? 'المورد' : 'جهة الصرف';
          toast({ title: 'خطأ', description: `الرجاء اختيار ${entityName}`, variant: 'destructive' });
          return;
        }
        if (duplicateSingleForm.quantity === null || duplicateSingleForm.quantity <= 0) {
          toast({ title: 'خطأ', description: 'الكمية يجب أن تكون أكبر من صفر', variant: 'destructive' });
          return;
        }
        
        if (!validateProductUnitWithConversion(duplicateSingleForm.product_id, duplicateSingleForm.unit)) return;
        
        const product = products.find(p => p.id === duplicateSingleForm.product_id);
        const converted = convertToProductUnit(product, duplicateSingleForm.quantity, duplicateSingleForm.unit);
        
        newMovement = {
          warehouse_id: duplicateSingleForm.warehouse_id,
          type: duplicateSingleForm.type,
          entity_id: duplicateSingleForm.entity_id,
          entity_type: duplicateSingleForm.entity_type,
          date: duplicateSingleForm.date,
          notes: duplicateSingleForm.notes,
          product_id: duplicateSingleForm.product_id,
          quantity: converted.quantity,
          unit: converted.unit
        };
      } else {
        if (!duplicateMultiForm.warehouse_id) {
          toast({ title: 'خطأ', description: 'الرجاء اختيار المخزن', variant: 'destructive' });
          return;
        }
        if (!duplicateMultiForm.entity_id) {
          const entityName = duplicateMultiForm.type === 'in' ? 'المورد' : 'جهة الصرف';
          toast({ title: 'خطأ', description: `الرجاء اختيار ${entityName}`, variant: 'destructive' });
          return;
        }
        if (duplicateItems.length === 0) {
          toast({ title: 'خطأ', description: 'يجب إضافة صنف واحد على الأقل', variant: 'destructive' });
          return;
        }
        
        for (let i = 0; i < duplicateItems.length; i++) {
          const item = duplicateItems[i];
          if (!item.product_id) {
            toast({ title: 'خطأ', description: `الصنف ${i+1}: الرجاء اختيار منتج`, variant: 'destructive' });
            return;
          }
          if (!item.unit) {
            toast({ title: 'خطأ', description: `الصنف ${i+1}: الرجاء اختيار الوحدة`, variant: 'destructive' });
            return;
          }
          if (item.quantity === null || item.quantity <= 0) {
            toast({ title: 'خطأ', description: `الصنف ${i+1}: الكمية يجب أن تكون أكبر من صفر`, variant: 'destructive' });
            return;
          }
          if (!validateProductUnitWithConversion(item.product_id, item.unit)) return;
        }
        
        const itemsToSave = duplicateItems.map(item => {
          const product = products.find(p => p.id === item.product_id);
          const converted = convertToProductUnit(product, item.quantity, item.unit);
          return { ...item, quantity: converted.quantity, unit: converted.unit };
        });
        
        newMovement = {
          warehouse_id: duplicateMultiForm.warehouse_id,
          type: duplicateMultiForm.type,
          entity_id: duplicateMultiForm.entity_id,
          entity_type: duplicateMultiForm.entity_type,
          date: duplicateMultiForm.date,
          notes: duplicateMultiForm.notes,
          items: itemsToSave
        };
      }
      
      await addMovement(newMovement);
      toast({ title: 'تم النسخ', description: 'تم نسخ الحركة بنجاح' });
      setDuplicateOpen(false);
      setDuplicateMovement(null);
      await refreshAll();
    } catch (error) {
      console.error('Error duplicating movement:', error);
      toast({ title: 'خطأ', description: 'حدث خطأ أثناء نسخ الحركة', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingMovement) return;
    await deleteMovement(deletingMovement.id);
    toast({ title: 'تم الحذف', description: 'تم حذف الحركة وتحديث الرصيد تلقائيًا' });
    setDeleteOpen(false);
    setDeletingMovement(null);
  };

  const handleBulkDelete = async () => {
    for (const id of Array.from(selectedItems)) await deleteMovement(id);
    toast({ title: 'تم الحذف', description: `تم حذف ${selectedItems.size} حركة بنجاح` });
    setSelectedItems(new Set());
    setBulkDeleteOpen(false);
  };

  // ========== عرض معلومات التحويل للمستخدم ==========
  const getConversionInfo = () => {
    if (!form.product_id || !form.unit) return null;
    const product = products.find(p => p.id === form.product_id);
    if (!product || !product.pack_size || product.pack_size <= 1) return null;
    
    if (product.unit === 'كرتون' && form.unit === 'علبة') {
      const cartonQty = (form.quantity || 0) / product.pack_size;
      return (
        <div className="bg-primary/10 rounded-md p-2 text-xs border border-primary/20">
          <span className="font-semibold">🔄 تحويل تلقائي:</span>{' '}
          {form.quantity} علبة = {cartonQty.toFixed(2)} كرتون
        </div>
      );
    }
    if (product.unit === 'علبة' && form.unit === 'كرتون') {
      const boxQty = (form.quantity || 0) * product.pack_size;
      return (
        <div className="bg-primary/10 rounded-md p-2 text-xs border border-primary/20">
          <span className="font-semibold">🔄 تحويل تلقائي:</span>{' '}
          {form.quantity} كرتون = {boxQty} علبة
        </div>
      );
    }
    if (product.unit === 'كيس' && form.unit === 'كيلو') {
      const bagQty = (form.quantity || 0) / product.pack_size;
      return (
        <div className="bg-primary/10 rounded-md p-2 text-xs border border-primary/20">
          <span className="font-semibold">🔄 تحويل تلقائي:</span>{' '}
          {form.quantity} كيلو = {bagQty.toFixed(2)} كيس
        </div>
      );
    }
    if (product.unit === 'كيلو' && form.unit === 'كيس') {
      const kgQty = (form.quantity || 0) * product.pack_size;
      return (
        <div className="bg-primary/10 rounded-md p-2 text-xs border border-primary/20">
          <span className="font-semibold">🔄 تحويل تلقائي:</span>{' '}
          {form.quantity} كيس = {kgQty} كيلو
        </div>
      );
    }
    if (product.unit === 'كرتون' && form.unit === 'قطعة') {
      const cartonQty = (form.quantity || 0) / product.pack_size;
      return (
        <div className="bg-primary/10 rounded-md p-2 text-xs border border-primary/20">
          <span className="font-semibold">🔄 تحويل تلقائي:</span>{' '}
          {form.quantity} قطعة = {cartonQty.toFixed(2)} كرتون
        </div>
      );
    }
    return null;
  };

  // ========== JSX ==========
  return (
    <>
      {/* حوار إضافة حركة مفردة */}
      <Dialog open={addSingleOpen} onOpenChange={setAddSingleOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>تسجيل حركة مخزون</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:gap-4 mt-2">
            {/* نوع الحركة */}
            <div className="space-y-1.5">
              <Label className="text-xs sm:text-sm">نوع الحركة</Label>
              <div className="flex gap-2">
                <button onClick={() => handleTypeChange('in')} className={`flex-1 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-semibold transition-colors ${form.type === 'in' ? 'bg-success text-success-foreground' : 'bg-secondary text-secondary-foreground'}`}>وارد</button>
                <button onClick={() => handleTypeChange('out')} className={`flex-1 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-semibold transition-colors ${form.type === 'out' ? 'bg-destructive text-destructive-foreground' : 'bg-secondary text-secondary-foreground'}`}>صادر</button>
              </div>
            </div>

            {/* المخزن */}
            <div className="space-y-1.5">
              <Label className="text-xs sm:text-sm">المخزن <span className="text-destructive">*</span></Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.warehouse_id}
                onChange={e => setForm({ ...form, warehouse_id: e.target.value })}
              >
                <option value="" disabled>اختر المخزن</option>
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>

            {/* جهة الصرف / المورد */}
            <div className="space-y-1.5">
              <Label className="text-xs sm:text-sm">
                {form.entity_type === 'supplier' ? 'المورد' : 'جهة الصرف'}
                <span className="text-destructive">*</span>
              </Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.entity_id}
                onChange={e => setForm({ ...form, entity_id: e.target.value })}
              >
                <option value="" disabled>اختر {form.entity_type === 'supplier' ? 'المورد' : 'جهة الصرف'}</option>
                {(form.entity_type === 'supplier' ? suppliers : clients).map(ent => (
                  <option key={ent.id} value={ent.id}>{ent.name}</option>
                ))}
              </select>
            </div>

            {/* التاريخ */}
            <div className="space-y-1.5">
              <Label className="text-xs sm:text-sm">التاريخ</Label>
              <Input
                type="date"
                value={form.date}
                onChange={e => setForm({ ...form, date: e.target.value })}
              />
            </div>

            {/* المنتج */}
            <div className="space-y-1.5">
              <Label className="text-xs sm:text-sm">المنتج <span className="text-destructive">*</span></Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.product_id}
                onChange={e => setForm({ ...form, product_id: e.target.value })}
              >
                <option value="" disabled>اختر المنتج</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs sm:text-sm">الكمية <span className="text-destructive">*</span></Label>
                <Input
                  type="number"
                  placeholder="أدخل الكمية"
                  value={form.quantity === null ? '' : form.quantity}
                  onChange={e => setForm({ ...form, quantity: e.target.value === '' ? null : Number(e.target.value) })}
                  onKeyDown={preventDecimal}
                  step="1"
                  min="0"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs sm:text-sm">الوحدة <span className="text-destructive">*</span></Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.unit}
                  onChange={e => setForm({ ...form, unit: e.target.value })}
                >
                  <option value="" disabled>اختر الوحدة</option>
                  {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>

            {/* ✅ عرض معلومات التحويل */}
            {getConversionInfo()}

            {/* ملاحظات عامة */}
            <div className="space-y-1.5">
              <Label className="text-xs sm:text-sm">ملاحظات عامة</Label>
              <Input
                placeholder="أدخل ملاحظات (اختياري)"
                value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
              />
            </div>

            <Button onClick={handleAddSave} disabled={saving} className="gradient-primary border-0">
              {saving ? 'جاري الحفظ...' : 'تسجيل الحركة'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* باقي الحوارات (متعددة، تعديل، نسخ، حذف) - نفس الكود السابق */}
      {/* ... */}
    </>
  );
};
