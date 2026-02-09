
import os

file_path = r'c:\Users\Maslamani\Desktop\MY PORJECT 1\my-website\src\App.jsx'

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

start_index = -1
end_index = -1

# Find the start of the block
for i, line in enumerate(lines):
    if 'showOrderPanel && (' in line:
        # Check if the next line starts the aside
        if i + 1 < len(lines) and '<aside' in lines[i+1]:
            start_index = i - 1 # Include the opening brace {
            break

# Find the end of the block
if start_index != -1:
    for i in range(start_index, len(lines)):
        if '</aside>' in lines[i]:
            end_index = i + 2 # Include the closing ) and }
            break

if start_index != -1 and end_index != -1:
    print(f"Found block from line {start_index+1} to {end_index+1}")
    
    new_content = """      {
        showOrderPanel && (
          <aside className="flex-shrink-0 min-h-0 w-[min(520px,100vw)] sm:w-[500px] flex flex-col overflow-hidden bg-slate-900/95 backdrop-blur-2xl border-l border-white/10 shadow-2xl z-50 transition-all duration-500 text-slate-100">
            {/* Header / Tabs */}
            <div className="flex-shrink-0 bg-slate-900/50 border-b border-white/10 backdrop-blur-sm">
               <div className="flex items-center justify-between px-6 py-5">
                  <div>
                    <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-3">
                       <span className="relative flex h-3 w-3">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-orange-500"></span>
                        </span>
                       POS Terminal
                    </h2>
                    <p className="text-xs text-slate-400 font-bold tracking-wide uppercase mt-1 ml-6">
                      Order #{Math.floor(Math.random() * 90000) + 10000}
                    </p>
                  </div>
                  <button onClick={() => setShowOrderPanel(false)} className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center transition-all hover:rotate-90">
                    <X size={20} />
                  </button>
               </div>
               
               {/* Tabs */}
               <div className="flex px-6 space-x-8 mt-2">
                  <button 
                    onClick={() => setActiveTab('items')}
                    className={`pb-4 text-sm font-bold transition-all relative flex items-center gap-2 ${activeTab === 'items' ? 'text-orange-400' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    Items 
                    <span className={`px-2 py-0.5 rounded text-[10px] ${activeTab === 'items' ? 'bg-orange-500/20 text-orange-400' : 'bg-white/10 text-slate-400'}`}>
                      {orderLines.length}
                    </span>
                    {activeTab === 'items' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-500 shadow-[0_0_12px_rgba(249,115,22,0.8)]" />}
                  </button>
                  <button 
                    onClick={() => setActiveTab('customer')} 
                    className={`pb-4 text-sm font-bold transition-all relative flex items-center gap-2 ${activeTab === 'customer' ? 'text-orange-400' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    Customer
                    {orderInfo.companyName && <span className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-500 rounded-full border border-slate-900" />}
                    {activeTab === 'customer' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-500 shadow-[0_0_12px_rgba(249,115,22,0.8)]" />}
                  </button>
               </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar-dark bg-gradient-to-b from-transparent to-black/30">
              
              {/* TAB: ITEMS */}
              {activeTab === 'items' && (
                <div className="p-4 space-y-3">
                  {orderLines.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full py-32 text-center px-10 opacity-60">
                      <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mb-6 border border-dashed border-white/10">
                        <Package className="text-slate-500" size={40} strokeWidth={1.5} />
                      </div>
                      <p className="text-lg font-bold text-slate-300 mb-2">Cart is Empty</p>
                      <p className="text-sm text-slate-500 max-w-[200px] leading-relaxed">Start scanning or select items from the catalog.</p>
                      <button onClick={() => setMode('catalog')} className="mt-8 px-8 py-3 rounded-xl bg-orange-500 text-white text-sm font-bold hover:bg-orange-600 transition-all shadow-lg shadow-orange-500/20">
                        Open Catalog
                      </button>
                    </div>
                  ) : (
                    orderLinesByBox.map((o, idx) => {
                      const prevBox = idx > 0 ? getLineBox(orderLinesByBox[idx - 1]) : null;
                      const box = getLineBox(o);
                      const showBox = prevBox !== box;
                      return (
                        <div key={o.id} className="animate-fade-in-right" style={{ animationDelay: `${idx * 40}ms` }}>
                           {showBox && box && (
                              <div className="flex items-center gap-3 my-6 px-1">
                                 <div className="h-px flex-1 bg-white/10"></div>
                                 <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Box {box}</span>
                                 <div className="h-px flex-1 bg-white/10"></div>
                              </div>
                           )}
                           <div className="group relative bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 hover:border-white/10 rounded-2xl p-4 transition-all duration-300 hover:shadow-xl hover:shadow-black/20">
                              <div className="flex gap-4">
                                <div className="w-16 h-16 rounded-xl bg-white/10 flex items-center justify-center shrink-0 overflow-hidden border border-white/5 relative">
                                   {getImage(o.item) ? (
                                     <img src={getImage(o.item)} alt="" className="w-full h-full object-contain p-2" />
                                   ) : (
                                     <Package size={24} className="text-slate-700" />
                                   )}
                                </div>
                                <div className="flex-1 min-w-0">
                                   <div className="flex justify-between items-start gap-3">
                                      <h4 className="text-sm font-bold text-slate-100 line-clamp-2 leading-relaxed">{o.item?.name}</h4>
                                      <button onClick={() => removeFromOrder(o.id)} className="text-slate-600 hover:text-rose-500 transition-colors bg-black/40 p-2 rounded-lg hover:bg-rose-500/10 -mt-1 -mr-1">
                                         <Trash2 size={16} />
                                      </button>
                                   </div>
                                   <p className="text-[10px] font-mono text-slate-500 mt-1 flex items-center gap-2">
                                     <span className="bg-white/5 px-1.5 py-0.5 rounded text-slate-400">{o.item?.barcode}</span>
                                     {o.item?.group && <span className="text-slate-600">• {o.item?.group}</span>}
                                   </p>
                                   
                                   <div className="flex items-center justify-between mt-4">
                                      {/* Dark Qty Control */}
                                      <div className="flex items-center bg-black/40 rounded-lg p-0.5 border border-white/5 shadow-inner">
                                         <button 
                                           onClick={() => setOrderQty(o.id, Math.max(1, o.qty - 1))}
                                           className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 rounded-md transition-colors"
                                         >-</button>
                                         <input 
                                           className="w-12 bg-transparent text-center text-sm font-bold text-white outline-none" 
                                           value={o.qty} 
                                           onChange={(e) => setOrderQty(o.id, e.target.value)}
                                         />
                                         <button 
                                           onClick={() => setOrderQty(o.id, parseInt(o.qty) + 1)}
                                           className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 rounded-md transition-colors"
                                         >+</button>
                                      </div>
                                      
                                      <div className="text-right">
                                         {getLineDiscountPercent(o) > 0 && (
                                            <div className="flex items-center justify-end gap-1.5 mb-0.5">
                                              <span className="text-[10px] text-slate-500 line-through decoration-slate-600">₪{getLineOriginalPrice(o)}</span>
                                              <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-1 rounded font-bold">-{getLineDiscountPercent(o)}%</span>
                                            </div>
                                         )}
                                         <div className="flex items-baseline justify-end gap-0.5">
                                            <span className="text-xs text-orange-500/70 font-bold">₪</span>
                                            <span className="text-orange-400 font-black text-lg tracking-tight shadow-orange-500/50 drop-shadow-[0_0_8px_rgba(249,115,22,0.3)]">
                                              {getLineTotal(o).toFixed(2)}
                                            </span>
                                         </div>
                                      </div>
                                   </div>
                                </div>
                              </div>
                           </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* TAB: CUSTOMER */}
              {activeTab === 'customer' && (
                 <div className="p-6 animate-fade-in space-y-8">
                    <div className="bg-gradient-to-br from-orange-500/10 to-amber-500/5 border border-orange-500/20 rounded-2xl p-5 flex items-start gap-4 shadow-[0_0_40px_-10px_rgba(249,115,22,0.1)]">
                       <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center shrink-0 border border-orange-500/20">
                          <span className="text-orange-400 text-lg">👤</span>
                       </div>
                       <div>
                          <p className="text-sm font-bold text-orange-100">Customer Details</p>
                          <p className="text-xs text-orange-200/50 mt-1 leading-relaxed">Details entered here will appear on the final invoice/receipt.</p>
                       </div>
                    </div>

                    <div className="space-y-6">
                       <div className="space-y-2">
                          <label className="text-[10px] uppercase tracking-widest font-bold text-slate-500 ml-1">Company / Name</label>
                          <input 
                            value={orderInfo.companyName}
                            onChange={(e) => setOrderInfoField('companyName', e.target.value)}
                            className="w-full bg-white/[0.03] hover:bg-white/[0.06] focus:bg-white/[0.08] border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white placeholder-slate-600 focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50 outline-none transition-all"
                            placeholder="Enter Name..."
                          />
                       </div>
                       
                       <div className="space-y-2">
                          <label className="text-[10px] uppercase tracking-widest font-bold text-slate-500 ml-1">Phone Number</label>
                          <input 
                            value={orderInfo.phone}
                            onChange={(e) => setOrderInfoField('phone', e.target.value)}
                            className="w-full bg-white/[0.03] hover:bg-white/[0.06] focus:bg-white/[0.08] border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white placeholder-slate-600 focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50 outline-none transition-all font-mono"
                            placeholder="050..."
                          />
                       </div>

                       <div className="grid grid-cols-2 gap-5">
                          <div className="space-y-2">
                             <label className="text-[10px] uppercase tracking-widest font-bold text-slate-500 ml-1">Date</label>
                             <input 
                               type="date"
                               value={orderInfo.orderDate}
                               onChange={(e) => setOrderInfoField('orderDate', e.target.value)}
                               className="w-full bg-white/[0.03] hover:bg-white/[0.06] focus:bg-white/[0.08] border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50 outline-none transition-all"
                             />
                          </div>
                          <div className="space-y-2">
                             <label className="text-[10px] uppercase tracking-widest font-bold text-slate-500 ml-1">Cust No.</label>
                             <input 
                               value={orderInfo.customerNumber}
                               onChange={(e) => setOrderInfoField('customerNumber', e.target.value)}
                               className="w-full bg-white/[0.03] hover:bg-white/[0.06] focus:bg-white/[0.08] border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white placeholder-slate-600 focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50 outline-none transition-all"
                               placeholder="#"
                             />
                          </div>
                       </div>
                       
                       <div className="space-y-2">
                          <label className="text-[10px] uppercase tracking-widest font-bold text-slate-500 ml-1">Address</label>
                          <input 
                            value={orderInfo.address}
                            onChange={(e) => setOrderInfoField('address', e.target.value)}
                            className="w-full bg-white/[0.03] hover:bg-white/[0.06] focus:bg-white/[0.08] border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white placeholder-slate-600 focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50 outline-none transition-all"
                            placeholder="City, Street..."
                          />
                       </div>
                    </div>
                 </div>
              )}
            </div>

            {/* Sticky Order Totals */}
            <div className="flex-shrink-0 bg-slate-950/80 backdrop-blur-md border-t border-white/10 p-6 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] z-20">
               <div className="flex justify-between items-end mb-5">
                  <div>
                     <p className="text-slate-500 text-[10px] font-bold tracking-widest uppercase mb-1">Total Amount</p>
                     <p className="text-4xl font-black text-white tracking-tighter drop-shadow-lg">
                       <span className="text-2xl text-slate-500 mr-1">₪</span>
                       {itemTotalWithTax(orderLines).toFixed(2)}
                     </p>
                  </div>
                  <div className="text-right">
                     <p className="text-slate-500 text-[10px] font-medium uppercase tracking-widest mb-1">Items Included</p>
                     <div className="inline-flex items-center px-3 py-1 bg-white/10 rounded-lg border border-white/5">
                        <span className="text-lg font-bold text-slate-200">{orderLines.length}</span>
                     </div>
                  </div>
               </div>
               
               <div className="grid grid-cols-4 gap-3">
                  <button onClick={handlePrintOrder} className="col-span-2 py-4 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white font-bold rounded-2xl shadow-[0_0_20px_rgba(249,115,22,0.4)] transition-all transform hover:-translate-y-0.5 active:scale-95 flex items-center justify-center gap-3">
                     <span className="text-xl">🖨️</span> Print Order
                  </button>
                  <button onClick={handleSaveInvoice} className="col-span-1 py-4 bg-white/5 hover:bg-white/10 text-white font-bold rounded-2xl border border-white/10 transition-all hover:border-white/20">
                     Save
                  </button>
                  <button onClick={() => setActiveTab(activeTab === 'items' ? 'customer' : 'items')} className="col-span-1 py-4 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white font-bold rounded-2xl border border-white/10 transition-all hover:border-white/20">
                     {activeTab === 'items' ? 'Next >' : '< Back'}
                  </button>
               </div>
               
               <div className="flex justify-between mt-4 px-1 opacity-70 hover:opacity-100 transition-opacity">
                  <button onClick={clearOrder} className="text-[10px] font-bold text-rose-500 hover:text-rose-400 uppercase tracking-widest transition-colors flex items-center gap-2">
                    <Trash2 size={12} /> Clear Order
                  </button>
                  <button onClick={handleExportExcel} className="text-[10px] font-bold text-emerald-500 hover:text-emerald-400 uppercase tracking-widest transition-colors">Export Excel</button>
               </div>
            </div>
          </aside>
        )
      }
"""
    
    # Replace content
    new_lines = lines[:start_index] + [new_content] + lines[end_index+1:]
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.writelines(new_lines)
    
    print("Successfully updated App.jsx")

else:
    print("Could not find the block to replace.")
    print(f"Start index: {start_index}")
