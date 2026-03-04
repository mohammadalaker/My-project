import React, { useState, useEffect } from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, TouchSensor } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, rectSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Save, X, Package, GripVertical, AlertCircle } from 'lucide-react';
import { sortByBarcodeOrder } from '../barcodeOrder';

// --- Sortable Item Component ---
const SortableItem = ({ item }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: item.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : 1,
        opacity: isDragging ? 0.8 : 1,
        boxShadow: isDragging ? '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' : undefined,
    };

    const getImageUrl = (item) => {
        if (!item.image) return null;
        return item.image.startsWith('http') ? item.image : `https://ixomkchbntcynqllaxhs.supabase.co/storage/v1/object/public/products/${item.image}`;
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`relative bg-white rounded-2xl border-2 ${isDragging ? 'border-indigo-500 scale-105' : 'border-slate-200'} shadow-sm overflow-hidden flex flex-col`}
        >
            <div
                className="absolute top-0 left-0 w-full h-8 bg-slate-100 flex items-center justify-center cursor-grab active:cursor-grabbing text-slate-400 hover:text-indigo-600 transition-colors z-20"
                {...attributes}
                {...listeners}
            >
                <GripVertical size={16} />
            </div>

            <div className="aspect-square bg-slate-50 flex items-center justify-center p-4 mt-8 relative">
                {getImageUrl(item) ? (
                    <img src={getImageUrl(item)} alt={item.name} className="w-full h-full object-contain pointer-events-none" />
                ) : (
                    <Package className="text-slate-300 w-12 h-12" />
                )}
            </div>

            <div className="p-3 text-right flex-1 flex flex-col bg-white">
                <p className="text-[10px] font-bold text-slate-400 truncate mb-1">{item.group}</p>
                <p className="text-xs font-bold text-slate-800 line-clamp-2 leading-tight flex-1">{item.name}</p>
                <p className="text-[10px] text-slate-500 font-mono mt-1">{item.barcode}</p>
            </div>
        </div>
    );
};

// --- Main Sorting Component ---
export default function AdminSortProducts({ items, initialOrder, onSave, onCancel, title = "ترتيب المنتجات" }) {
    const [localItems, setLocalItems] = useState([]);

    useEffect(() => {
        // Flatten and sort items initially based on barcodeOrder
        const sorted = sortByBarcodeOrder([...items], initialOrder);
        setLocalItems(sorted);
    }, [items, initialOrder]);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 5 },
        }),
        useSensor(TouchSensor, {
            activationConstraint: { delay: 250, tolerance: 5 },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = (event) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            setLocalItems((items) => {
                const oldIndex = items.findIndex((i) => i.id === active.id);
                const newIndex = items.findIndex((i) => i.id === over.id);
                return arrayMove(items, oldIndex, newIndex);
            });
        }
    };

    const handleSave = () => {
        const newBarcodeOrder = localItems.map(item => String(item.barcode).trim());
        onSave(newBarcodeOrder);
    };

    return (
        <div className="fixed inset-0 bg-slate-50 z-[100] flex flex-col animate-fade-in pb-10 overflow-hidden text-right" dir="rtl">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm sticky top-0 z-50 shrink-0">
                <div>
                    <h2 className="text-xl font-black text-slate-800">{title}</h2>
                    <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                        <AlertCircle size={14} /> اسحب وافلت البطاقات لتغيير ترتيب العرض
                    </p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50"
                    >
                        <X size={18} className="inline-block ml-1" /> إلغاء
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-6 py-2 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 shadow-md shadow-indigo-600/20"
                    >
                        <Save size={18} className="inline-block ml-1" /> حفظ الترتيب
                    </button>
                </div>
            </div>

            {/* Grid Container */}
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-slate-50">
                <div className="max-w-7xl mx-auto">
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                    >
                        <SortableContext
                            items={localItems.map(i => i.id)}
                            strategy={rectSortingStrategy}
                        >
                            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-4">
                                {localItems.map(item => (
                                    <SortableItem key={item.id} item={item} />
                                ))}
                            </div>
                        </SortableContext>
                    </DndContext>
                </div>
            </div>
        </div>
    );
}
