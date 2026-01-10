import { useState, useEffect, useMemo } from "react";
import { supabase } from "../lib/supabase";
import AdminLayout from "../components/AdminLayout";
import { 
  MdHistory, MdDelete, MdSearch, MdAdd, 
  MdArrowDownward, MdArrowUpward, MdContentCopy, MdEdit, MdQrCodeScanner 
} from "react-icons/md";

const PLACEHOLDER = "https://via.placeholder.com/150?text=No+Image";
const ITEMS_PER_PAGE = 8;

function Products() {
  /* =======================
      STATE MANAGEMENT
  ======================= */
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // UI States
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [stockFilter, setStockFilter] = useState("All");
  const [sortBy, setSortBy] = useState(null);
  const [sortOrder, setSortOrder] = useState("asc");
  const [page, setPage] = useState(1);
  const [categories, setCategories] = useState([]);

  // Modal & Menu States
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentProductId, setCurrentProductId] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [showCategoryInput, setShowCategoryInput] = useState(false);
  const [inventoryProduct, setInventoryProduct] = useState(null); 
  const [stockModal, setStockModal] = useState(null); 

  // Form States
  const [form, setForm] = useState({ 
    name: "", 
    category: "", 
    price: "", 
    purchasePrice: "", 
    stock: "", 
    minStock: 5, 
    barcode: "", 
    images: [],
    description: "" // Added Description
  });
  const [imageUrl, setImageUrl] = useState("");
  const [newCategory, setNewCategory] = useState("");

  // Live Calculation States
  const [calcQty, setCalcQty] = useState(0);
  const [calcPrice, setCalcPrice] = useState(0);
  const [calcNote, setCalcNote] = useState("");
  const [calcReason, setCalcReason] = useState("New Shipment");

  /* =======================
      EFFECTS & API CALLS
  ======================= */
  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Fetch products error:", error);
    } else {
      setProducts(data);
    }
    setLoading(false);
  };

  const fetchCategories = async () => {
    const { data, error } = await supabase
      .from("products")
      .select("category");

    if (!error && data) {
      const uniqueCategories = [...new Set(data.map(item => item.category).filter(Boolean))];
      setCategories(uniqueCategories);
    }
  };

  /* =======================
      IMAGE HELPERS
  ======================= */
  const addImageToForm = () => {
    if (imageUrl.trim()) {
      setForm(prev => ({ ...prev, images: [...prev.images, imageUrl.trim()] }));
      setImageUrl("");
    }
  };

  const removeImageFromForm = (index) => {
    setForm(prev => ({ ...prev, images: prev.images.filter((_, i) => i !== index) }));
  };

  /* =======================
      HANDLERS
  ======================= */
  const userRole = localStorage.getItem("userRole");

  const saveProduct = async (e) => {
    e.preventDefault();

    const productData = {
      name: form.name,
      category: form.category,
      price: Number(form.price),
      purchase_price: Number(form.purchasePrice || 0), 
      stock: Number(form.stock || 0),
      min_stock: Number(form.minStock || 5),
      barcode: form.barcode || null,
      images: form.images || [],
      description: form.description || "", // Included description in payload
    };

    if (isEditing) {
      const { error } = await supabase
        .from("products")
        .update(productData)
        .eq("id", currentProductId);
      if (error) alert("Update failed: " + error.message);
    } else {
      const { error } = await supabase.from("products").insert([productData]);
      if (error) alert("Insertion failed: " + error.message);
    }

    setShowModal(false);
    fetchProducts();
  };

  const deleteProduct = async (id) => {
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) alert("Delete failed");
    else fetchProducts();
  };

  const updateInventory = async (productId, qty, type, note, price, reason) => {
    const quantity = Number(qty);
    const unitPrice = Number(price);

    const { error: logError } = await supabase
      .from("inventory_logs")
      .insert([{
        product_id: productId,
        type,
        qty: quantity,
        price: unitPrice,
        reason,
        note,
      }]);

    if (logError) return console.error(logError);

    const { error: stockError } = await supabase.rpc("update_product_stock", {
      pid: productId,
      delta: type === "IN" ? quantity : -quantity
    });

    if (stockError) alert("Stock update failed");
    else {
      setStockModal(null);
      fetchProducts();
    }
  };

  const cloneProduct = async (p) => {
    const { error } = await supabase.from("products").insert({
      name: `${p.name} (Copy)`,
      category: p.category,
      price: p.price,
      purchase_price: p.purchase_price,
      stock: p.stock,
      barcode: p.barcode,
      images: p.images,
      description: p.description // Added description to clone
    });
    if (!error) fetchProducts();
  };

  const handleAddCategory = () => {
    const trimmed = newCategory.trim();
    if (trimmed && !categories.includes(trimmed)) {
      setCategories([...categories, trimmed]);
      setForm(prev => ({ ...prev, category: trimmed }));
      setNewCategory("");
      setShowCategoryInput(false);
    }
  };

  /* =======================
      FILTER LOGIC
  ======================= */
  const filteredProducts = useMemo(() => {
    return [...products]
      .filter((p) => {
        const matchesSearch = p.name?.toLowerCase().includes(searchTerm.toLowerCase()) || p.barcode?.includes(searchTerm);
        const matchesCategory = selectedCategory === "All" || p.category === selectedCategory;
        const isLow = p.stock <= (p.min_stock || 5);
        const matchesStock = stockFilter === "All" || (stockFilter === "Low" && isLow) || (stockFilter === "Healthy" && !isLow);
        return matchesSearch && matchesCategory && matchesStock;
      })
      .sort((a, b) => {
        if (!sortBy) return 0;
        let valA = a[sortBy] || 0; let valB = b[sortBy] || 0;
        return sortOrder === "asc" ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
      });
  }, [products, searchTerm, selectedCategory, stockFilter, sortBy, sortOrder]);

  const paginatedProducts = filteredProducts.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE) || 1;

  return (
    <AdminLayout>
      <div className="flex justify-between items-center mb-6 px-4">
        <h2 className="text-3xl font-black text-white tracking-tight uppercase">Inventory</h2>
      </div>

      {/* TOOLBAR */}
      <div className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-100 mb-8 mx-4">
        <div className="flex flex-col lg:flex-row justify-between gap-6 mb-6">
          <div className="relative w-full lg:w-[500px]">
            <MdSearch className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 z-10" size={24} />
            <input 
              placeholder="Scan barcode or type item name..." 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
              className="w-full h-14 pl-14 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-blue-50 transition-all font-semibold text-slate-900 bg-white" 
            />
          </div>
          <div className="flex gap-4">
            {userRole === "admin" && (
              <button 
                onClick={() => { 
                  setIsEditing(false); 
                  setForm({ name: "", category: "", price: "", purchasePrice: "", stock: "", minStock: 5, barcode: "", images: [], description: "" }); 
                  setShowModal(true); 
                }} 
                className="h-14 bg-slate-900 text-white px-8 rounded-2xl flex items-center gap-3 hover:bg-black transition-all font-bold shadow-xl"
              >
                <MdAdd size={24} /> New Product
              </button>
            )}
            <button onClick={() => setShowCategoryManager(true)} className="h-14 border border-slate-200 px-8 rounded-2xl hover:bg-slate-50 transition-all font-bold text-slate-600">Categories</button>
          </div>
        </div>
        <div className="flex flex-wrap gap-6 items-center">
            <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="h-11 border border-slate-200 px-5 rounded-xl bg-slate-50 text-sm font-bold text-slate-700">
                <option value="All">All Categories</option>
                {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
            <select value={stockFilter} onChange={(e) => setStockFilter(e.target.value)} className="h-11 border border-slate-200 px-5 rounded-xl bg-slate-50 text-sm font-bold text-slate-700">
                <option value="All">Stock: All</option>
                <option value="Low">Status: Low Stock</option>
                <option value="Healthy">Status: Healthy</option>
            </select>
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-[40px] shadow-sm border border-slate-100 mx-4 overflow-hidden">
        <div className="grid grid-cols-12 bg-slate-50/50 border-b border-slate-100 p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">
            <div className="col-span-1 text-center">Preview</div>
            <div className="col-span-5 px-4">Product Details</div>
            <div className="col-span-2 text-center">Inventory</div>
            <div className="col-span-2 text-center">Unit Price</div>
            <div className="col-span-2 text-right pr-4">Actions</div>
        </div>
        <div className="divide-y divide-slate-50">
            {paginatedProducts.map((p, index) => {
              const isLow = p.stock <= (p.min_stock || 5);
              return (
                <div key={p.id} className="grid grid-cols-12 items-center p-6 group hover:bg-slate-50/50 transition-all">
                  <div className="col-span-1 flex justify-center">
                      <img src={p.images?.[0] || PLACEHOLDER} className="w-14 h-14 object-cover rounded-2xl border border-slate-200 shadow-sm" alt="" />
                  </div>
                  <div className="col-span-5 px-4">
                      <p className="font-black text-slate-900 text-base tracking-tight leading-tight">{p.name}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[10px] font-bold text-blue-700 uppercase tracking-widest bg-blue-50 px-2 py-0.5 rounded">{p.category}</span>
                        {p.barcode && <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded text-[9px] font-black flex items-center gap-1"><MdQrCodeScanner size={12}/> {p.barcode}</span>}
                      </div>
                  </div>
                  <div className="col-span-2 flex justify-center">
                      <div className={`flex flex-col items-center px-5 py-2 rounded-2xl border ${isLow ? 'bg-rose-50 border-rose-200 animate-pulse' : 'bg-slate-50 border-slate-200'}`}>
                        <span className={`text-base font-black ${isLow ? 'text-rose-700' : 'text-slate-900'}`}>{p.stock}</span>
                        <span className="text-[10px] text-slate-500 font-black uppercase">Units</span>
                      </div>
                  </div>
                  <div className="col-span-2 text-center font-black">
                      <p className="text-base text-slate-900">₹{Number(p.price).toFixed(2)}</p>
                      {userRole === "admin" && (
                        <p className="text-[10px] text-slate-500 font-bold uppercase mt-0.5 bg-slate-100 inline-block px-2 rounded">
                          Cost: ₹{Number(p.purchase_price || 0).toFixed(2)}
                        </p>
                      )}
                  </div>
                  <div className="col-span-2 text-right pr-4 relative">
                    <div className="flex items-center justify-end gap-2">
                        {userRole === "admin" && (
                          <button 
                            onClick={() => { 
                              setForm({
                                name: p.name,
                                category: p.category,
                                price: p.price,
                                purchasePrice: p.purchase_price,
                                stock: p.stock,
                                minStock: p.min_stock,
                                barcode: p.barcode,
                                images: p.images || [],
                                description: p.description || "" // Load description for editing
                              }); 
                              setCurrentProductId(p.id); 
                              setIsEditing(true); 
                              setShowModal(true); 
                            }} 
                            className="p-2.5 text-amber-700 bg-amber-50 rounded-xl opacity-0 group-hover:opacity-100 transition-all border border-amber-100"
                          >
                            <MdEdit size={20}/>
                          </button>
                        )}
                        <button onClick={() => setOpenMenuId(openMenuId === p.id ? null : p.id)} className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-slate-900">⋮</button>
                    </div>
                    {openMenuId === p.id && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setOpenMenuId(null)} />
                        <div className={`absolute right-4 w-56 bg-white border border-slate-100 rounded-[24px] shadow-2xl z-50 py-3 ${index >= paginatedProducts.length - 2 ? "bottom-full mb-2" : "top-full mt-2"}`}>
                          <button onClick={() => { setStockModal({ product: p, type: "IN" }); setCalcPrice(p.purchase_price); setOpenMenuId(null); }} className="flex items-center gap-4 w-full px-6 py-3 text-xs hover:bg-emerald-50 text-emerald-700 font-black uppercase tracking-wider transition-all"><MdArrowDownward size={18}/> Stock In</button>
                          <button onClick={() => { setStockModal({ product: p, type: "OUT" }); setCalcPrice(p.purchase_price); setOpenMenuId(null); }} className="flex items-center gap-4 w-full px-6 py-3 text-xs hover:bg-rose-50 text-rose-700 font-black uppercase tracking-wider transition-all"><MdArrowUpward size={18}/> Stock Out</button>
                          {userRole === "admin" && (
                            <>
                              <button onClick={() => { cloneProduct(p); setOpenMenuId(null); }} className="flex items-center gap-4 w-full px-6 py-3 text-xs hover:bg-slate-50 text-slate-600 font-bold transition-all"><MdContentCopy size={18}/> Duplicate</button>
                              <div className="h-px bg-slate-50 my-1 mx-4" />
                              <button onClick={() => { deleteProduct(p.id); setOpenMenuId(null); }} className="flex items-center gap-4 w-full px-6 py-3 text-xs hover:bg-rose-50 text-rose-600 font-bold transition-all"><MdDelete size={18}/> Remove</button>
                            </>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* Stock Transaction Modal */}
      {stockModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
          <div className="bg-white w-full max-w-lg rounded-[40px] shadow-2xl p-10">
            <h3 className="text-2xl font-black text-slate-800 mb-6 uppercase tracking-tight">{stockModal.product.name} ({stockModal.type})</h3>
            <form onSubmit={(e) => {
              e.preventDefault();
              updateInventory(stockModal.product.id, calcQty, stockModal.type, calcNote, calcPrice, calcReason);
            }} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Quantity</label>
                  <input type="number" required value={calcQty} onChange={(e) => setCalcQty(e.target.value)} className="w-full h-14 border-2 border-slate-100 rounded-2xl px-5 font-black text-lg outline-none focus:border-blue-500" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Category</label>
                  <select value={calcReason} onChange={(e) => setCalcReason(e.target.value)} className="w-full h-14 border-2 border-slate-100 rounded-2xl px-4 font-bold outline-none bg-slate-50">
                    <option value="New Shipment">New Shipment</option>
                    <option value="Return">Return</option>
                    <option value="Correction">Correction</option>
                    <option value="Damage">Damage</option>
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Unit Cost at Entry (₹)</label>
                <input type="number" step="0.01" value={calcPrice} onChange={(e) => setCalcPrice(e.target.value)} className="w-full h-14 border-2 border-slate-100 rounded-2xl px-5 font-black text-blue-600" />
              </div>
              <textarea placeholder="Notes..." value={calcNote} onChange={(e) => setCalcNote(e.target.value)} className="w-full h-24 border-2 border-slate-100 rounded-2xl p-5 font-medium text-sm outline-none" />
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setStockModal(null)} className="flex-1 py-4 font-black text-slate-400 uppercase tracking-widest text-xs">Cancel</button>
                <button type="submit" className={`flex-1 py-4 rounded-2xl text-white font-black uppercase tracking-widest text-xs shadow-lg ${stockModal.type === 'IN' ? 'bg-emerald-500' : 'bg-rose-500'}`}>Authorize</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Product Edit/New Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
          <div className="bg-white w-full max-w-xl p-10 rounded-[40px] shadow-2xl overflow-y-auto max-h-[90vh]">
            <h3 className="text-3xl font-black text-slate-800 mb-8 uppercase tracking-tighter">{isEditing ? "Modify Item" : "Create Item"}</h3>
            <form onSubmit={saveProduct} className="space-y-6">
              
              {/* IMAGE URL INPUT SECTION */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase block ml-2">Product Images</label>
                <div className="flex gap-2">
                  <input 
                    placeholder="Add image url" 
                    value={imageUrl} 
                    onChange={(e) => setImageUrl(e.target.value)} 
                    className="flex-1 h-12 border-2 border-slate-100 rounded-xl px-4 font-bold outline-none bg-slate-50/50" 
                  />
                  <button 
                    type="button" 
                    onClick={addImageToForm} 
                    className="bg-slate-900 text-white px-4 rounded-xl font-bold text-xs"
                  >
                    Add
                  </button>
                </div>
                <div className="flex gap-2 mt-2 flex-wrap">
                  {form.images.map((img, idx) => (
                    <div key={idx} className="relative w-16 h-16 group">
                      <img src={img} className="w-full h-full object-cover rounded-lg border" alt="" />
                      <button 
                        type="button" 
                        onClick={() => removeImageFromForm(idx)}
                        className="absolute -top-2 -right-2 bg-rose-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px]"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <input placeholder="Product Name" required value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} className="w-full h-14 border-2 border-slate-100 rounded-2xl px-6 font-bold outline-none bg-slate-50/50" />
              
              {/* NEW DESCRIPTION FIELD */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase block ml-2">Description</label>
                <textarea 
                  placeholder="Enter product details, specs, or notes..." 
                  value={form.description} 
                  onChange={(e) => setForm({...form, description: e.target.value})} 
                  className="w-full h-24 border-2 border-slate-100 rounded-2xl p-4 font-medium text-sm outline-none bg-slate-50/50 resize-none focus:border-blue-500 transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <select value={form.category} required onChange={(e) => e.target.value === "__new__" ? setShowCategoryInput(true) : setForm({...form, category: e.target.value})} className="h-14 border-2 border-slate-100 rounded-2xl px-5 font-bold outline-none bg-slate-50/50">
                  <option value="">Category</option>
                  {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  <option value="__new__">+ New Category</option>
                </select>
                <input placeholder="Barcode" value={form.barcode} onChange={(e) => setForm({...form, barcode: e.target.value})} className="h-14 border-2 border-slate-100 rounded-2xl px-6 font-bold bg-slate-50/50" />
              </div>
              {showCategoryInput && (
                <div className="flex gap-2 p-2 bg-blue-50 rounded-2xl border border-blue-100">
                  <input placeholder="Category Name" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} className="flex-1 bg-transparent px-4 font-bold text-sm" />
                  <button type="button" onClick={handleAddCategory} className="bg-blue-600 text-white px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest">Add</button>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase block ml-2">Sale Price</label>
                  <input type="number" required value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="h-14 w-full border-2 border-slate-100 rounded-2xl px-6 font-bold text-center" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase block ml-2">Purchase Cost</label>
                  <input type="number" value={form.purchasePrice} onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })} className="h-14 w-full border-2 border-slate-100 rounded-2xl px-6 font-bold text-center" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase block ml-2">Stock Count</label>
                  <input type="number" required value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} className="h-14 w-full border-2 border-slate-100 rounded-2xl px-6 font-black bg-slate-900 text-white text-center" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase block ml-2">Low Alert Level</label>
                  <input type="number" value={form.minStock} onChange={(e) => setForm({ ...form, minStock: e.target.value })} className="h-14 w-full border-2 border-slate-100 rounded-2xl px-6 font-bold text-center" />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-6">
                <button type="button" onClick={() => setShowModal(false)} className="px-8 font-black text-slate-400 uppercase tracking-widest text-[10px]">Discard</button>
                <button type="submit" className="bg-blue-600 text-white px-10 py-4 rounded-2xl font-black shadow-xl uppercase tracking-widest text-[10px]">Save Item</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Category Manager Modal */}
      {showCategoryManager && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
          <div className="bg-white w-full max-w-sm rounded-[40px] p-10 shadow-2xl">
            <h3 className="text-xl font-black text-slate-800 mb-6 text-center uppercase tracking-tight">Manage Categories</h3>
            <div className="space-y-3 mb-10 max-h-60 overflow-y-auto">
              {categories.map(cat => (
                <div key={cat} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <span className="font-bold text-slate-700">{cat}</span>
                  <button onClick={() => setCategories(categories.filter(c => c !== cat))} className="text-slate-300 hover:text-rose-500 transition-colors"><MdDelete size={20} /></button>
                </div>
              ))}
            </div>
            <button onClick={() => setShowCategoryManager(false)} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest">Close</button>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

export default Products;