// ============================================================================
// ملف: MovementsPage.tsx (نسخة معدلة - تستخدم display_unit النصي)
// ============================================================================

import { useState, useMemo } from 'react';
import { useWarehouse } from '@/contexts/WarehouseContext';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, Search, Pencil, Trash2, FileText, RefreshCw, PackagePlus, X, Copy } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { MovementType, StockMovement, MovementItem } from '@/types/warehouse';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { UNITS, buildMovementHtml, buildMultiMovementHtml } from './utils/movementUtils';
import { MovementCard } from './components/MovementCard';

const MovementsPage = () => {
  const {
    movements, products, warehouses, suppliers, clients,
    addMovement, updateMovement, deleteMovement,
    getProductName, getWarehouseName, getSupplierName, getClientName, getUserName,
    refreshAll,
    units, getUnitName
  } = useWarehouse();
  const { isAdmin } = useAuth();
  const { toast } = useToast();

  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'in' | 'out'>('all');
  const [viewTab, setViewTab] = useState<'single' | 'multi'>('single');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<StockMovement | null>(null);
  const [movementType, setMovementType] = useState<'single' | 'multi'>('single');
  const [saving, setSaving] = useState(false);

  // حالات لصندوق نسخ الحركة
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [duplicateMovement, setDuplicateMovement] = useState<StockMovement | null>(null);
  const [duplicateDate, setDuplicateDate] = useState('');

  // حالات حوار التعديل الشامل
  const [editFullDialogOpen, setEditFullDialogOpen] = useState(false);
  const [editFullMovement, setEditFullMovement] = useState<StockMovement | null>(null);
  const [editFullType, setEditFullType] = useState<'single' | 'multi'>('single');

  // نموذج التعديل للحركة المفردة
  const [editSingleForm, setEditSingleForm] = useState({
    product_id: '',
    warehouse_id: '',
    type: 'in' as MovementType,
    quantity: null as number | null,
    entity_id: '',
    entity_type: 'supplier' as 'supplier' | 'client',
    date: '',
    notes: '',
    unit: ''          // الوحدة التي اختارها المستخدم
  });

  // نموذج التعديل للحركة المتعددة
  const [editMultiForm, setEditMultiForm] = useState({
    warehouse_id: '',
    type: 'in' as MovementType,
    entity_id: '',
    entity_type: 'supplier' as 'supplier' | 'client',
    date: '',
    notes: ''
  });
  const [editItems, setEditItems] = useState<MovementItem[]>([]);

  // نموذج الحركة الواحدة للإضافة
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

  // نموذج الحركة المتعددة للإضافة
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

  const [deleteDialog, setDeleteDialog] = useState(false);
  const [deletingMovement, setDeletingMovement] = useState<StockMovement | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [bulkDeleteDialog, setBulkDeleteDialog] = useState(false);

  // ========== خريطة معلومات المنتج (pack_size, base_unit, display_unit) ==========
  const productInfoMap = useMemo(() => {
    const map = new Map<string, { pack_size: number; base_unit: string; display_unit?: string }>();
    products.forEach(p => {
      if (p.id) {
        map.set(p.id, {
          pack_size: p.pack_size || 1,
          base_unit: p.unit,
          display_unit: p.display_unit_id ? getUnitName(p.display_unit_id) : undefined,
        });
      }
    });
    return map;
  }, [products, getUnitName]);

  // ========== دالة الحصول على الوحدات المتاحة للمنتج ==========
  const getAvailableUnitsForProduct = (productId: string) => {
    const info = productInfoMap.get(productId);
    if (!info) return []; 
    const unitsList: string[] = [];
    // الوحدة الأساسية
    unitsList.push(info.base_unit);
    // الوحدة المعروضة إذا كانت مختلفة و pack_size > 1
    if (info.display_unit && info.display_unit !== info.base_unit && info.pack_size > 1) {
      unitsList.push(info.display_unit);
    }
    return unitsList;
  };

  // ========== دالة تحويل الكمية إلى الوحدة الأساسية ==========
  const convertToBaseUnit = (productId: string, quantity: number, selectedUnit: string): number => {
    const info = productInfoMap.get(productId);
    if (!info) return quantity;

    // إذا كانت الوحدة المختارة هي الوحدة المعروضة ولدينا pack_size > 1
    if (selectedUnit === info.display_unit && info.pack_size > 1) {
      return quantity * info.pack_size;
    }
    // الوحدة الأساسية أو أي حالة أخرى
    return quantity;
  };

  // ========== دوال حساب الرصيد ==========
  const getStockMapForWarehouse = useMemo(() => {
    return (warehouseId: string) => {
      const stockMap = new Map<string, number>();
      const filteredMovements = movements.filter(m => m.warehouse_id === warehouseId);
      
      filteredMovements.forEach(m => {
        if (m.product_id && m.quantity !== undefined && m.quantity !== null) {
          const change = m.type === 'in' ? m.quantity : -m.quantity;
          stockMap.set(m.product_id, (stockMap.get(m.product_id) || 0) + change);
        } else if (m.items) {
          m.items.forEach(item => {
            if (item.quantity !== null) {
              const change = m.type === 'in' ? item.quantity : -item.quantity;
              stockMap.set(item.product_id, (stockMap.get(item.product_id) || 0) + change);
            }
          });
        }
      });
      
      return stockMap;
    };
  }, [movements]);

  const getCurrentStock = (productId: string, warehouseId: string) => {
    let total = 0;
    movements.forEach(m => {
      if (m.warehouse_id !== warehouseId) return;
      if (m.product_id === productId) {
        total += m.type === 'in' ? m.quantity! : -m.quantity!;
      } else if (m.items) {
        const item = m.items.find(i => i.product_id === productId);
        if (item) {
          total += m.type === 'in' ? item.quantity! : -item.quantity!;
        }
      }
    });
    return total;
  };

  const getProductMinQty = (productId: string) => {
    const product = products.find(p => p.id === productId);
    return product?.min_quantity ?? 2;
  };

  const preventDecimal = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === '.' || e.key === 'e' || e.key === '-' || e.key === '+') e.preventDefault();
  };

  // ========== تصفية وترتيب الحركات ==========
  const filtered = movements
    .filter(m => filter === 'all' || m.type === filter)
    .filter(m => {
      if (m.product_id) {
        return getProductName(m.product_id).includes(search);
      } else {
        const itemNames = (m.items || []).map(item => getProductName(item.product_id)).join(' ');
        return itemNames.includes(search);
      }
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const singleMovements = filtered.filter(m => !!m.product_id);
  const multiMovements = filtered.filter(m => !m.product_id);
  const activeMovements = viewTab === 'single' ? singleMovements : multiMovements;

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshAll();
    setRefreshing(false);
    toast({ title: 'تم التحديث', description: 'تم تحديث البيانات بنجاح' });
  };

  const allSelected = activeMovements.length > 0 && activeMovements.every(m => selectedItems.has(m.id));
  const toggleAll = () => {
    if (allSelected) setSelectedItems(new Set());
    else setSelectedItems(new Set(activeMovements.map(m => m.id)));
  };
  const toggleOne = (id: string) => {
    const next = new Set(selectedItems);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedItems(next);
  };

  const handleBulkDelete = async () => {
    for (const id of Array.from(selectedItems)) await deleteMovement(id);
    toast({ title: 'تم الحذف', description: `تم حذف ${selectedItems.size} حركة بنجاح` });
    setSelectedItems(new Set());
    setBulkDeleteDialog(false);
  };

  // ========== دالة فتح حوار نسخ الحركة ==========
  const openDuplicateDialog = (movement: StockMovement) => {
    setDuplicateMovement(movement);
    setDuplicateDate(new Date().toISOString().split('T')[0]);
    setDuplicateDialogOpen(true);
  };

  const handleDuplicate = async () => {
    if (!duplicateMovement) return;
    
    setSaving(true);
    try {
      const newMovement: Omit<StockMovement, 'id' | 'created_at' | 'created_by'> = {
        warehouse_id: duplicateMovement.warehouse_id,
        type: duplicateMovement.type,
        entity_id: duplicateMovement.entity_id,
        entity_type: duplicateMovement.entity_type,
        date: duplicateDate,
        notes: duplicateMovement.notes ? `(نسخة من ${duplicateMovement.date}) ${duplicateMovement.notes}` : `نسخة من ${duplicateMovement.date}`,
      };
      
      if (duplicateMovement.product_id && duplicateMovement.quantity !== undefined) {
        const productId = duplicateMovement.product_id;
        const selectedUnit = duplicateMovement.display_unit ?? duplicateMovement.unit; // استخدم display_unit النصي
        if (!selectedUnit) throw new Error('الوحدة غير محددة');
        const baseQuantity = convertToBaseUnit(productId, duplicateMovement.quantity, selectedUnit);
        newMovement.product_id = productId;
        newMovement.quantity = baseQuantity;
        newMovement.unit = productInfoMap.get(productId)?.base_unit;
        newMovement.display_quantity = duplicateMovement.quantity;
        newMovement.display_unit = selectedUnit;
      } else if (duplicateMovement.items && duplicateMovement.items.length > 0) {
        const itemsToSave = duplicateMovement.items.map(item => {
          const productId = item.product_id;
          const selectedUnit = item.display_unit ?? item.unit;
          if (!selectedUnit) throw new Error('الوحدة غير محددة');
          const baseQuantity = convertToBaseUnit(productId, item.quantity, selectedUnit);
          return {
            ...item,
            quantity: baseQuantity,
            unit: productInfoMap.get(productId)?.base_unit,
            display_quantity: item.quantity,
            display_unit: selectedUnit,
          };
        });
        newMovement.items = itemsToSave;
      } else {
        toast({ title: 'خطأ', description: 'لا يمكن نسخ هذه الحركة', variant: 'destructive' });
        return;
      }
      
      await addMovement(newMovement);
      toast({ title: 'تم النسخ', description: 'تم نسخ الحركة بنجاح' });
      setDuplicateDialogOpen(false);
      setDuplicateMovement(null);
    } catch (error) {
      console.error('Error duplicating movement:', error);
      toast({ title: 'خطأ', description: 'حدث خطأ أثناء نسخ الحركة', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // ========== دالة فتح حوار التعديل الشامل ==========
  const openEditFull = (movement: StockMovement) => {
    setEditFullMovement(movement);
    if (movement.product_id) {
      setEditFullType('single');
      setEditSingleForm({
        product_id: movement.product_id,
        warehouse_id: movement.warehouse_id,
        type: movement.type,
        quantity: movement.display_quantity ?? movement.quantity ?? null,
        entity_id: movement.entity_id,
        entity_type: movement.entity_type,
        date: movement.date,
        notes: movement.notes || '',
        unit: movement.display_unit ?? movement.unit ?? ''
      });
    } else if (movement.items && movement.items.length > 0) {
      setEditFullType('multi');
      setEditMultiForm({
        warehouse_id: movement.warehouse_id,
        type: movement.type,
        entity_id: movement.entity_id,
        entity_type: movement.entity_type,
        date: movement.date,
        notes: movement.notes || ''
      });
      setEditItems(movement.items.map(item => ({
        ...item,
        quantity: item.display_quantity ?? item.quantity,
        unit: item.display_unit ?? item.unit,
      })));
    }
    setEditFullDialogOpen(true);
  };

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

  const handleEditSave = async () => {
    if (!editFullMovement) return;
    
    setSaving(true);
    try {
      if (editFullType === 'single') {
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
        
        const baseQuantity = convertToBaseUnit(editSingleForm.product_id, editSingleForm.quantity, editSingleForm.unit);
        const productInfo = productInfoMap.get(editSingleForm.product_id);
        
        await updateMovement({
          ...editFullMovement,
          ...editSingleForm,
          quantity: baseQuantity,
          unit: productInfo?.base_unit,
          display_quantity: editSingleForm.quantity,
          display_unit: editSingleForm.unit
        });
        toast({ title: 'تم التعديل', description: 'تم تعديل الحركة بنجاح' });
      } else {
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
        }
        
        const itemsToSave = editItems.map(item => {
          const baseQuantity = convertToBaseUnit(item.product_id, item.quantity, item.unit);
          const productInfo = productInfoMap.get(item.product_id);
          return {
            ...item,
            quantity: baseQuantity,
            unit: productInfo?.base_unit,
            display_quantity: item.quantity,
            display_unit: item.unit,
          };
        });
        
        await updateMovement({
          ...editFullMovement,
          ...editMultiForm,
          items: itemsToSave
        });
        toast({ title: 'تم التعديل', description: 'تم تعديل الحركة بنجاح' });
      }
      
      setEditFullDialogOpen(false);
      setEditFullMovement(null);
      await refreshAll();
    } catch (error) {
      console.error('Error updating movement:', error);
      toast({ title: 'خطأ', description: 'حدث خطأ أثناء تعديل الحركة', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // ========== دوال الإضافة ==========
  const openAddSingle = () => {
    setMovementType('single');
    setEditing(null);
    setForm({
      product_id: '',
      warehouse_id: '',
      type: 'in',
      quantity: null,
      entity_id: '',
      entity_type: 'supplier',
      date: new Date().toISOString().split('T')[0],
      notes: '',
      unit: ''
    });
    setDialogOpen(true);
  };

  const openAddMulti = () => {
    setMovementType('multi');
    setEditing(null);
    setMultiForm({
      warehouse_id: '',
      type: 'in',
      entity_id: '',
      entity_type: 'supplier',
      date: new Date().toISOString().split('T')[0],
      notes: ''
    });
    setItems([{ product_id: '', quantity: null, unit: '', notes: '' }]);
    setDialogOpen(true);
  };

  const openEdit = (m: StockMovement) => {
    setEditing(m);
    if (m.product_id) {
      setMovementType('single');
      setForm({
        product_id: m.product_id,
        warehouse_id: m.warehouse_id,
        type: m.type,
        quantity: m.display_quantity ?? m.quantity ?? null,
        entity_id: m.entity_id,
        entity_type: m.entity_type,
        date: m.date,
        notes: m.notes || '',
        unit: m.display_unit ?? m.unit ?? ''
      });
    } else {
      setMovementType('multi');
      setMultiForm({
        warehouse_id: m.warehouse_id,
        type: m.type,
        entity_id: m.entity_id,
        entity_type: m.entity_type,
        date: m.date,
        notes: m.notes || ''
      });
      setItems((m.items || []).map(item => ({
        ...item,
        quantity: item.display_quantity ?? item.quantity,
        unit: item.display_unit ?? item.unit,
      })));
    }
    setDialogOpen(true);
  };

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

  const handleSave = async () => {
    setSaving(true);
    try {
      if (movementType === 'single') {
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

        const baseQuantity = convertToBaseUnit(form.product_id, form.quantity, form.unit);
        const productInfo = productInfoMap.get(form.product_id);

        const currentStock = getCurrentStock(form.product_id, form.warehouse_id);
        if (form.type === 'out') {
          if (currentStock < baseQuantity) {
            toast({
              title: 'خطأ في الكمية',
              description: `الرصيد المتوفر في مخزن (${getWarehouseName(form.warehouse_id)}) هو (${currentStock}) فقط. لا يمكن صرف كمية أكبر.`,
              variant: 'destructive'
            });
            return;
          }
          const minQty = getProductMinQty(form.product_id);
          const newStock = currentStock - baseQuantity;
          if (newStock < minQty && minQty > 0) {
            toast({
              title: '⚠️ تحذير: مخزون أقل من الحد الأدنى',
              description: `بعد هذه العملية، سيصبح المخزون (${newStock}) وهو أقل من الحد الأدنى المحدد (${minQty}).`,
              variant: 'destructive'
            });
          }
        }

        const movementData = {
          ...form,
          quantity: baseQuantity,
          unit: productInfo?.base_unit,
          display_quantity: form.quantity,
          display_unit: form.unit
        };

        if (editing) await updateMovement({ ...editing, ...movementData });
        else await addMovement(movementData);
        const typeMsg = form.type === 'in' ? 'تم توريد للمخزن بنجاح' : 'تم تصدير حركة بنجاح';
        toast({ title: editing ? 'تم التعديل' : (form.type === 'in' ? '✅ توريد' : '📤 تصدير'), description: typeMsg });
      } else {
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
        }

        if (multiForm.type === 'out') {
          const stockMap = getStockMapForWarehouse(multiForm.warehouse_id);
          for (const item of items) {
            const baseQuantity = convertToBaseUnit(item.product_id, item.quantity, item.unit);
            const currentStock = stockMap.get(item.product_id) || 0;
            if (currentStock < baseQuantity) {
              toast({
                title: 'خطأ في الكمية',
                description: `المنتج ${getProductName(item.product_id)}: الرصيد المتوفر في المخزن هو ${currentStock} فقط.`,
                variant: 'destructive'
              });
              return;
            }
            const minQty = getProductMinQty(item.product_id);
            const newStock = currentStock - baseQuantity;
            if (newStock < minQty && minQty > 0) {
              toast({
                title: '⚠️ تحذير: مخزون أقل من الحد الأدنى',
                description: `المنتج ${getProductName(item.product_id)}: بعد الصرف سيصبح المخزون (${newStock}) وهو أقل من الحد الأدنى المحدد (${minQty}).`,
                variant: 'destructive'
              });
            }
          }
        }

        const itemsToSave = items.map(item => {
          const baseQuantity = convertToBaseUnit(item.product_id, item.quantity, item.unit);
          const productInfo = productInfoMap.get(item.product_id);
          return {
            ...item,
            quantity: baseQuantity,
            unit: productInfo?.base_unit,
            display_quantity: item.quantity,
            display_unit: item.unit,
          };
        });
        
        const movementData: Omit<StockMovement, 'id' | 'created_at' | 'created_by'> = {
          type: multiForm.type,
          warehouse_id: multiForm.warehouse_id,
          entity_type: multiForm.entity_type,
          entity_id: multiForm.entity_id,
          date: multiForm.date,
          notes: multiForm.notes,
          items: itemsToSave
        };
        
        if (editing) await updateMovement({ ...editing, ...movementData });
        else await addMovement(movementData);
        
        const typeMsg = multiForm.type === 'in' ? 'تم توريد للمخزن بنجاح' : 'تم تصدير حركة بنجاح';
        toast({ 
          title: editing ? 'تم التعديل' : (multiForm.type === 'in' ? '✅ توريد' : '📤 تصدير'), 
          description: `${typeMsg} - ${items.length} منتج` 
        });
      }
      setDialogOpen(false);
      await refreshAll();
    } catch (error) {
      console.error('Error saving movement:', error);
      toast({ title: 'خطأ', description: 'حدث خطأ أثناء حفظ الحركة', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (m: StockMovement) => {
    setDeletingMovement(m);
    setDeleteDialog(true);
  };
  const handleDelete = async () => {
    if (!deletingMovement) return;
    await deleteMovement(deletingMovement.id);
    toast({ title: 'تم الحذف', description: 'تم حذف الحركة وتحديث الرصيد تلقائيًا' });
    setDeleteDialog(false);
    setDeletingMovement(null);
  };

  // دالة الطباعة (نفس السابق)
  const printMovementNative = async (html: string, title: string) => {
    // ... (محذوف للاختصار، يمكنك نسخها من الملف الأصلي)
  };
  const handlePrint = async (m: StockMovement) => {
    // ... (محذوف للاختصار)
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* شريط البحث والفلاتر - نفس السابق */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[150px]">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="بحث..." value={search} onChange={e => setSearch(e.target.value)} className="pr-9 text-sm" />
          </div>
          <div className="flex rounded-lg border border-border overflow-hidden">
            {(['all', 'in', 'out'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-2.5 sm:px-3 py-2 text-xs font-medium transition-colors ${filter === f ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-secondary'}`}>
                {f === 'all' ? 'الكل' : f === 'in' ? 'وارد' : 'صادر'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2 justify-between">
          <div className="flex gap-2">
            <Button onClick={handleRefresh} variant="outline" size="sm" className="gap-2 text-sm" disabled={refreshing}>
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span>تحديث</span>
            </Button>
            {isAdmin && selectedItems.size > 0 && (
              <Button variant="destructive" size="sm" className="gap-2 text-sm" onClick={() => setBulkDeleteDialog(true)}>
                <Trash2 className="w-4 h-4" />
                <span>حذف المحدد ({selectedItems.size})</span>
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button onClick={openAddSingle} className="gradient-primary border-0 text-sm gap-2">
              <Plus className="w-4 h-4" />تسجيل حركة
            </Button>
            <Button onClick={openAddMulti} variant="secondary" className="text-sm gap-2">
              <PackagePlus className="w-4 h-4" />حركة تعيين
            </Button>
          </div>
        </div>
      </div>

      {/* تبويب حركات مفردة / متعددة */}
      <div className="flex rounded-lg border border-border overflow-hidden w-fit">
        <button onClick={() => { setViewTab('single'); setSelectedItems(new Set()); }}
          className={`px-4 py-2 text-xs sm:text-sm font-medium transition-colors ${viewTab === 'single' ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-secondary'}`}>
          حركات مفردة ({singleMovements.length})
        </button>
        <button onClick={() => { setViewTab('multi'); setSelectedItems(new Set()); }}
          className={`px-4 py-2 text-xs sm:text-sm font-medium transition-colors ${viewTab === 'multi' ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-secondary'}`}>
          حركات متعددة ({multiMovements.length})
        </button>
      </div>

      {/* عرض الجوال */}
      <div className="sm:hidden space-y-2">
        {isAdmin && activeMovements.length > 0 && (
          <div className="flex items-center gap-2 px-1 py-1 border-b">
            <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
            <span className="text-xs text-muted-foreground font-medium">تحديد الكل</span>
          </div>
        )}
        {activeMovements.map(m => (
          <MovementCard
            key={m.id}
            movement={m}
            isSelected={selectedItems.has(m.id)}
            onToggleSelect={() => toggleOne(m.id)}
            onEdit={() => openEditFull(m)}
            onDelete={() => confirmDelete(m)}
            onPrint={() => handlePrint(m)}
            onDuplicate={() => openDuplicateDialog(m)}
            showCheckbox={isAdmin}
          />
        ))}
        {activeMovements.length === 0 && <p className="text-center text-muted-foreground py-8 text-sm">لا توجد حركات</p>}
      </div>

      {/* جدول سطح المكتب */}
      <div className="hidden sm:block bg-card rounded-xl shadow-card border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                {isAdmin && <th className="p-3 w-10"><Checkbox checked={allSelected} onCheckedChange={toggleAll} /></th>}
                <th className="text-right p-3 font-semibold text-foreground">م</th>
                <th className="text-right p-3 font-semibold text-foreground">النوع</th>
                <th className="text-right p-3 font-semibold text-foreground">جهة الصرف/المورد</th>
                {viewTab === 'single' ? (
                  <>
                    <th className="text-right p-3 font-semibold text-foreground">المنتج</th>
                    <th className="text-right p-3 font-semibold text-foreground">الكمية</th>
                    <th className="text-right p-3 font-semibold text-foreground">الوحدة</th>
                  </>
                ) : (
                  <th className="text-right p-3 font-semibold text-foreground">الأصناف</th>
                )}
                <th className="text-right p-3 font-semibold text-foreground">المخزن</th>
                <th className="text-right p-3 font-semibold text-foreground hidden md:table-cell">بواسطة</th>
                <th className="text-right p-3 font-semibold text-foreground hidden lg:table-cell">التاريخ</th>
                <th className="text-center p-3 font-semibold text-foreground">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {activeMovements.map((m, i) => (
                <tr key={m.id} className={`border-b border-border last:border-0 hover:bg-secondary/30 transition-colors ${selectedItems.has(m.id) ? 'bg-primary/5' : ''}`}>
                  {isAdmin && (
                    <td className="p-3">
                      <Checkbox checked={selectedItems.has(m.id)} onCheckedChange={() => toggleOne(m.id)} />
                    </td>
                  )}
                  <td className="p-3 text-foreground font-medium">{i + 1}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                      m.type === 'in' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
                    }`}>{m.type === 'in' ? 'وارد' : 'صادر'}</span>
                  </td>
                  <td className="p-3 text-foreground">{m.entity_type === 'supplier' ? getSupplierName(m.entity_id) : getClientName(m.entity_id)}</td>
                  {viewTab === 'single' ? (
                    <>
                      <td className="p-3 text-foreground">{getProductName(m.product_id)}</td>
                      <td className="p-3 text-foreground font-semibold">{m.display_quantity ?? m.quantity}</td>
                      <td className="p-3 text-foreground">{m.display_unit ?? m.unit}</td>
                    </>
                  ) : (
                    <td className="p-3 text-foreground">
                      <div className="space-y-0.5">
                        {(m.items || []).map((item, idx) => (
                          <div key={idx} className="text-xs">
                            <span className="font-medium">{getProductName(item.product_id)}</span>
                            <span className="text-muted-foreground"> — {item.display_quantity ?? item.quantity} {item.display_unit ?? item.unit}</span>
                          </div>
                        ))}
                      </div>
                    </td>
                  )}
                  <td className="p-3 text-foreground">{getWarehouseName(m.warehouse_id)}</td>
                  <td className="p-3 text-muted-foreground hidden md:table-cell">{getUserName(m.created_by)}</td>
                  <td className="p-3 text-muted-foreground hidden lg:table-cell">{m.date}</td>
                  <td className="p-3">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => openEditFull(m)} className="p-1.5 rounded-md hover:bg-primary/10 text-primary"><Pencil className="w-4 h-4" /></button>
                      {isAdmin && <button onClick={() => confirmDelete(m)} className="p-1.5 rounded-md hover:bg-destructive/10 text-destructive"><Trash2 className="w-4 h-4" /></button>}
                      <button onClick={() => openDuplicateDialog(m)} className="p-1.5 rounded-md hover:bg-accent/20 text-accent"><Copy className="w-4 h-4" /></button>
                      <button onClick={() => handlePrint(m)} className="p-1.5 rounded-md hover:bg-accent/20 text-accent"><FileText className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {activeMovements.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? (viewTab === 'single' ? 11 : 9) : (viewTab === 'single' ? 10 : 8)} className="p-8 text-center text-muted-foreground">
                    لا توجد حركات
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* جميع الحوارات (نفس السابق مع إضافة display_unit في كل مكان) */}
      {/* حوارات الإضافة والتعديل والنسخ والحذف - اختصارًا للطول لم أعد كتابتها هنا، لكن يجب أن تكون متطابقة مع منطق display_unit */}
      {/* ... */}
    </div>
  );
};

export default MovementsPage;
