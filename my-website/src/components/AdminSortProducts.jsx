import React, { useState, useEffect } from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, TouchSensor } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, rectSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Save, X, Package, GripVertical, AlertCircle } from 'lucide-react';
import { sortByBarcodeOrder } from '../barcodeOrder';

// --- Sortable Item Component ---
const SortableItem = ({ item, getImage }) => {
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

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`relative bg-white rounded-3xl border-2 ${isDragging ? 'border-indigo-500 scale-105' : 'border-slate-100'} shadow-sm hover:shadow-xl overflow-hidden flex flex-col group transition-all duration-300`}
        >
            <div
                className="absolute top-0 left-0 w-full h-8 bg-slate-100 flex items-center justify-center cursor-grab active:cursor-grabbing text-slate-400 hover:text-indigo-600 transition-colors z-20"
                {...attributes}
                {...listeners}
            >
                <GripVertical size={16} />
            </div>

            <div className="aspect-[4/3] p-6 relative flex items-center justify-center bg-gradient-to-b from-transparent to-slate-50/50 mt-8">
                {getImage && getImage(item) ? (
                    <img
                        src={getImage(item)}
                        alt={item.name}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-contain filter drop-shadow-xl transition-transform duration-500 pointer-events-none"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <Package size={48} className="text-slate-200" />
                    </div>
                )}
            </div>

            <div className="p-5 flex-1 flex flex-col bg-white">
                <div className="flex flex-col mb-1 min-h-[2.5em] justify-start w-full text-right" dir="rtl">
                    <h3 className="text-sm font-bold text-slate-800 leading-tight">
                        {item.productType || item.group || ' '}
                    </h3>
                    <p className="text-xs text-slate-500 font-medium line-clamp-1 mt-0.5" title={item.name}>
                        {item.name || 'Unknown Product'}
                    </p>
                </div>
                <p className="text-sm font-mono text-slate-500 mb-2 text-right">{item.barcode}</p>
            </div>
        </div>
    );
};

// --- Main Sorting Component ---
export default function AdminSortProducts({ items, initialOrder, onSave, onCancel, title = "ترتيب المنتجات", getImage }) {
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
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6" dir="ltr">
                                {localItems.map(item => (
                                    <SortableItem key={item.id} item={item} getImage={getImage} />
                                ))}
                            </div>
                        </SortableContext>
                    </DndContext>
                </div>
            </div>
        </div>
    );
}
