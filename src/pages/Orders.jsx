import { supabase } from "../lib/supabase";
import { useState, useMemo, useEffect } from "react";
import AdminLayout from "../components/AdminLayout";
import {
  MdSearch, MdVisibility, MdTrendingUp, MdAdd, MdClose,
  MdPrint, MdWhatsapp, MdInventory, MdEdit, MdDelete, MdRemoveCircle,
  MdCheck, MdBlock
} from "react-icons/md";

function Orders() {
  /* =======================
      STATE MANAGEMENT
  ======================= */
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState(() => JSON.parse(localStorage.getItem("products") || "[]"));
  const [categories, setCategories] = useState(() => {
    const saved = localStorage.getItem("categories");
    return saved ? JSON.parse(saved) : ["General", "Hygienic", "Comfort"];
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [selectedOrder, setSelectedOrder] = useState(null);
  
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showQuickProductModal, setShowQuickProductModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentOrderId, setCurrentOrderId] = useState(null);

  const [customerSuggestions, setCustomerSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [orderForm, setOrderForm] = useState({
    customer: "",
    phone: "",
    items: [], 
    status: "New"
  });

  const [quickProductForm, setQuickProductForm] = useState({ 
    name: "", category: "General", price: "", purchasePrice: "", stock: "", imageUrl: "" 
  });

  const [showCategoryInput, setShowCategoryInput] = useState(false);
  const [newCategory, setNewCategory] = useState("");

  // Status Options for Tracking
  const trackingStatuses = ["New", "Packed", "Shipped", "Delivered"];

  /* =======================
      EFFECTS
  ======================= */
  useEffect(() => {
    fetchOrders();
  }, []);

  useEffect(() => { localStorage.setItem("products", JSON.stringify(products)); }, [products]);
  useEffect(() => { localStorage.setItem("categories", JSON.stringify(categories)); }, [categories]);

  /* =======================
      HANDLERS
  ======================= */
  const userRole = localStorage.getItem("userRole");

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("orders")
        .select(`
          id,
          items,
          total_price,
          status,
          created_at,
          customer_name,
          phone_number,
          is_approved
        `) 
        .order("created_at", { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error("Fetch orders failed", error);
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      const { error } = await supabase
        .from("orders")
        .update({ status: newStatus })
        .eq("id", orderId);
      
      if (error) throw error;
      fetchOrders();
    } catch (err) {
      alert("Failed to update status: " + err.message);
    }
  };

  // Helper to send WhatsApp confirmation
  const sendWhatsAppConfirmation = (order) => {
    const phone = order.phone_number.replace(/\D/g, ""); // Clean phone number
    const message = `Hello ${order.customer_name}, as per your confirmation on call, we have confirmed your order (Ref ID: ${order.id.toString().split('-')[0]}). Thank you for shopping with Hygienic & Comfort Co.!`;
    const encodedMsg = encodeURIComponent(message);
    window.open(`https://wa.me/${phone}?text=${encodedMsg}`, '_blank');
  };

  // Approval/Cancellation Logic - FIXED: Approved orders now stay as "New"
  const handleOrderApproval = async (orderId, approve) => {
    const orderObj = orders.find(o => o.id === orderId);
    try {
      const { error } = await supabase
        .from("orders")
        .update({ 
          is_approved: approve,
          status: approve ? "New" : "Cancelled" 
        })
        .eq("id", orderId);

      if (error) throw error;
      
      fetchOrders();
      
      if (approve && orderObj) {
        sendWhatsAppConfirmation(orderObj);
      }
      
      alert(approve ? "Order Approved & WhatsApp confirmation opened!" : "Order Cancelled");
    } catch (err) {
      alert("Action failed: " + err.message);
    }
  };

  const handleCustomerSearch = async (val) => {
    setOrderForm({ ...orderForm, customer: val });
    
    if (val.length < 2) {
      setCustomerSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const { data, error } = await supabase
      .from("customers")
      .select("customer_name, phone")
      .ilike("customer_name", `%${val}%`)
      .limit(5);

    if (!error && data) {
      setCustomerSuggestions(data);
      setShowSuggestions(true);
    }
  };

  const selectExistingCustomer = (cust) => {
    const cleanPhone = (cust.phone || "").replace("+91", "").trim();
    setOrderForm({
      ...orderForm,
      customer: cust.customer_name,
      phone: cleanPhone
    });
    setShowSuggestions(false);
  };

  const addProductToOrder = (productId) => {
    const p = products.find(prod => String(prod.id) === String(productId));
    if (!p) return;
    const exists = orderForm.items.find(item => String(item.productId) === String(productId));
    if (exists) return alert("Product already added.");

    const newItem = {
      productId: String(p.id),
      productName: p.name,
      qty: 1,
      price: Number(p.price),
      total: Number(p.price)
    };
    setOrderForm(prev => ({ ...prev, items: [...prev.items, newItem] }));
  };

  const updateItemQty = (index, newQty) => {
    const updatedItems = [...orderForm.items];
    updatedItems[index].qty = Number(newQty);
    updatedItems[index].total = updatedItems[index].qty * updatedItems[index].price;
    setOrderForm(prev => ({ ...prev, items: updatedItems }));
  };

  const removeItem = (index) => {
    setOrderForm(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }));
  };

  const orderGrandTotal = useMemo(() => {
    return (orderForm.items || []).reduce((sum, item) => sum + (item.total || 0), 0);
  }, [orderForm.items]);

  const saveOrder = async (e) => {
    e.preventDefault();

    if (orderForm.phone.length !== 10) {
      alert("Please enter a 10-digit phone number.");
      return;
    }

    try {
      const orderPayload = {
        customer_name: orderForm.customer,
        phone_number: "+91" + orderForm.phone.replace("+91", "").trim(),
        items: orderForm.items, 
        total_price: orderGrandTotal,
        status: orderForm.status,
      };

      if (isEditing && currentOrderId) {
        const { error: updateError } = await supabase
          .from("orders")
          .update(orderPayload)
          .eq("id", currentOrderId);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from("orders")
          .insert([orderPayload]);
        if (insertError) throw insertError;
      }

      await fetchOrders();
      resetOrderForm();
      setShowOrderModal(false);
      alert(isEditing ? "Order Updated!" : "Order Authorized!");
    } catch (err) {
      alert("Database Error: " + err.message);
    }
  };

  const handleQuickAddProduct = (e) => {
    e.preventDefault();
    const newProd = { 
      id: Date.now(), 
      name: quickProductForm.name, 
      price: Number(quickProductForm.price), 
      purchasePrice: Number(quickProductForm.purchasePrice),
      stock: Number(quickProductForm.stock), 
      category: quickProductForm.category
    };
    setProducts(prev => [newProd, ...prev]);
    addProductToOrder(newProd.id);
    setShowQuickProductModal(false);
  };

  const handleAddCategory = () => {
    if (!newCategory.trim()) return;
    const updatedCats = [...categories, newCategory.trim()];
    setCategories(updatedCats);
    setQuickProductForm(prev => ({ ...prev, category: newCategory.trim() }));
    setNewCategory("");
    setShowCategoryInput(false);
  };

  const resetOrderForm = () => {
    setOrderForm({ customer: "", phone: "", items: [], status: "New" });
    setIsEditing(false);
    setCurrentOrderId(null);
  };

  const openEditModal = (order) => {
    setIsEditing(true);
    setCurrentOrderId(order.id);
    
    let editableItems = [];
    try {
        const rawItems = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
        editableItems = Array.isArray(rawItems) ? rawItems : [];
    } catch (e) {
        editableItems = [];
    }

    setOrderForm({
      customer: order.customer_name || "",
      phone: (order.phone_number || "").replace("+91", "").trim(),
      status: order.status || "New",
      items: editableItems 
    });
    setShowOrderModal(true);
  };

  /* =========================
      PROFESSIONAL INVOICE GENERATOR
  ========================= */
  const handleProfessionalPrint = (order) => {
    const printWindow = window.open('', '_blank', 'width=900,height=1000');
    
    let itemsHtml = "";
    try {
        const rawItems = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
        if (Array.isArray(rawItems)) {
            itemsHtml = rawItems.map((item, index) => `
              <tr>
                <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: center;">${index + 1}</td>
                <td style="padding: 12px; border-bottom: 1px solid #eee;">
                  <div style="font-weight: bold; color: #333;">${item.productName || item.name || 'Product'}</div>
                </td>
                <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: center;">${item.qty} PAC</td>
                <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right;">₹${Number(item.price || 0).toFixed(2)}</td>
                <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right; font-weight: bold;">₹${Number(item.total || 0).toFixed(2)}</td>
              </tr>
            `).join('');
        } else {
            itemsHtml = `<tr><td colspan="5" style="padding: 20px; text-align: center;">${order.items || 'No Item Details'}</td></tr>`;
        }
    } catch (e) {
        itemsHtml = `<tr><td colspan="5" style="padding: 20px; text-align: center;">${order.items}</td></tr>`;
    }

    const invoiceHtml = `
      <html>
      <head>
        <title>Invoice - ${order.id}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap');
          body { font-family: 'Inter', sans-serif; color: #444; margin: 0; padding: 40px; }
          .invoice-container { max-width: 800px; margin: auto; border: 1px solid #eee; padding: 30px; border-radius: 8px; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; border-bottom: 2px solid #3b82f6; padding-bottom: 20px; }
          .company-info h1 { margin: 0; color: #1e3a8a; font-size: 24px; text-transform: uppercase; }
          .company-info p { margin: 5px 0; font-size: 12px; line-height: 1.4; color: #666; }
          .invoice-label { text-align: right; }
          .invoice-label h2 { margin: 0; color: #3b82f6; letter-spacing: 2px; }
          .details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; background: #f8fafc; padding: 20px; border-radius: 8px; }
          .details-box h4 { margin: 0 0 10px 0; font-size: 10px; text-transform: uppercase; color: #94a3b8; letter-spacing: 1px; }
          .details-box p { margin: 2px 0; font-weight: bold; font-size: 14px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
          th { background: #1e3a8a; color: white; text-transform: uppercase; font-size: 11px; padding: 12px; letter-spacing: 1px; }
          .totals-area { display: flex; justify-content: flex-end; }
          .grand-total { background: #1e3a8a; color: white; padding: 15px; border-radius: 4px; margin-top: 10px; width: 250px; text-align: right; }
        </style>
      </head>
      <body>
        <div class="invoice-container">
          <div class="header">
            <div class="company-info">
              <h1>Hygienic & Comfort Co.</h1>
              <p>Shop no.1, Bhausaheb Paranjape Chawl Near Shiv mandir,<br>Ambernath East, Thane Central, MAHARASHTRA - 421502</p>
            </div>
            <div class="invoice-label">
              <h2>INVOICE</h2>
              <p style="font-size: 12px;">Date: ${new Date(order.created_at).toLocaleDateString('en-IN')}</p>
            </div>
          </div>

          <div class="details-grid">
            <div class="details-box">
              <h4>Billed To</h4>
              <p style="font-size: 18px; color: #1e3a8a;">${order.customer_name || 'Walking Customer'}</p>
              <p>Ph: ${order.phone_number || 'N/A'}</p>
            </div>
            <div class="details-box" style="text-align: right;">
              <h4>Payment Status</h4>
              <p style="color: #059669; font-weight: bold;">PAID</p>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>#</th>
                <th style="text-align: left;">Item Description</th>
                <th>Qty</th>
                <th style="text-align: right;">Rate</th>
                <th style="text-align: right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <div class="totals-area">
              <div class="grand-total">
                <span style="font-weight: bold;">Total Amount: ₹${(order.total_price || 0).toLocaleString('en-IN')}</span>
              </div>
          </div>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(invoiceHtml);
    printWindow.document.close();
    printWindow.print();
  };

  /* =========================
      FILTER LOGIC
  ========================= */
  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      const customerName = (o.customer_name || "").toLowerCase();
      const customerPhone = (o.phone_number || "");
      const search = searchTerm.toLowerCase();
      return customerName.includes(search) || customerPhone.includes(search);
    });
  }, [orders, searchTerm]);

  return (
    <AdminLayout>
      <div className="mb-8 px-4 flex justify-between items-end">
        <div className="flex flex-col gap-4">
            <h2 className="text-4xl font-black text-white uppercase tracking-tight">Order Management</h2>
            <div className="relative w-80">
               <MdSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl" />
               <input 
                 type="text" 
                 placeholder="Search orders..." 
                 className="w-full bg-slate-800 border-none rounded-2xl py-3.5 pl-12 pr-4 text-white text-base outline-none ring-1 ring-slate-700 focus:ring-2 focus:ring-blue-500 transition-all"
                 value={searchTerm}
                 onChange={(e) => setSearchTerm(e.target.value)}
               />
            </div>
        </div>
        <button onClick={() => { resetOrderForm(); setShowOrderModal(true); }} className="bg-blue-600 hover:bg-blue-700 text-white py-4 px-10 rounded-2xl font-black text-base flex items-center gap-2 shadow-lg transition-all active:scale-95"><MdAdd size={24} /> New Order</button>
      </div>

      <div className="bg-white rounded-[40px] shadow-2xl p-6 mx-4 overflow-hidden border border-slate-100">
        <div className="overflow-x-auto">
          {/* Professional Table Alignment: Removed table-fixed for better flow, using specific widths on critical headers only */}
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-sm font-black text-slate-400 uppercase tracking-widest border-b-2 border-slate-50">
                <th className="px-6 py-5 w-32">Ref ID</th>
                <th className="px-6 py-5 w-60">Customer Details</th>
                <th className="px-6 py-5 min-w-[280px]">Ordered Items</th>
                <th className="px-6 py-5 text-center w-44">Approval</th>
                <th className="px-6 py-5 text-center w-52">Status Tracking</th>
                <th className="px-6 py-5 text-right w-36">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan="6" className="py-20 text-center text-slate-400 font-bold text-lg italic">Fetching orders from cloud...</td></tr>
              ) : filteredOrders.length === 0 ? (
                <tr><td colSpan="6" className="py-20 text-center text-slate-400 font-bold text-lg italic">No matching orders found.</td></tr>
              ) : filteredOrders.map(o => (
                <tr key={o.id} className="hover:bg-slate-50/80 transition-all group">
                  {/* REF ID */}
                  <td className="px-6 py-8 align-top">
                    <span className="font-black text-slate-900 text-base uppercase bg-slate-100 px-3 py-1.5 rounded-lg block text-center">
                        {o.id.toString().split('-')[0]}
                    </span>
                  </td>

                  {/* CUSTOMER COLUMN */}
                  <td className="px-6 py-8 align-top">
                    <div className="flex flex-col">
                        <span className="font-black text-slate-900 text-lg leading-tight">{o.customer_name || 'Walking Customer'}</span>
                        <span className="text-sm text-slate-500 font-bold mt-2">
                            {o.phone_number?.startsWith('+91') ? o.phone_number : `+91 ${o.phone_number}`}
                        </span>
                    </div>
                  </td>

                  {/* ITEMS COLUMN - Restructured for readability and professional alignment */}
                  <td className="px-6 py-8 align-top">
                    <div className="flex flex-col gap-2">
                       {(() => {
                        try {
                            if (!o.items) return <span className="text-xs text-slate-400 italic">Empty Order</span>;
                            const parsed = typeof o.items === 'string' ? (o.items.startsWith('[') ? JSON.parse(o.items) : o.items) : o.items;
                            
                            if (Array.isArray(parsed)) {
                                return parsed.map((item, i) => (
                                    <div key={i} className="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl border border-slate-100 max-w-sm">
                                        <span className="font-black text-slate-900 text-base leading-tight">
                                            {item.productName || item.name}
                                        </span>
                                        <span className="font-black text-blue-600 bg-blue-50 px-2.5 py-1 rounded text-sm ml-4">
                                            x{item.qty}
                                        </span>
                                    </div>
                                ));
                            }
                            // Fallback for older data format
                            return <span className="font-black text-slate-900 text-base leading-tight">{parsed}</span>;
                        } catch(e) { return <span className="text-xs text-rose-500 italic">Data Parsing Error</span>; }
                       })()}
                    </div>
                  </td>
                  
                  {/* APPROVAL CELL */}
                  <td className="px-6 py-8 align-top text-center">
                    {o.status === "Cancelled" ? (
                      <span className="bg-rose-100 text-rose-600 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider">Rejected</span>
                    ) : !o.is_approved ? (
                      <div className="flex justify-center gap-2">
                        <button 
                          onClick={() => handleOrderApproval(o.id, true)} 
                          className="p-3 bg-emerald-100 text-emerald-600 rounded-2xl hover:bg-emerald-600 hover:text-white transition-all shadow-sm active:scale-90"
                          title="Confirm & WhatsApp"
                        >
                          <MdCheck size={22} />
                        </button>
                        <button 
                          onClick={() => handleOrderApproval(o.id, false)} 
                          className="p-3 bg-rose-100 text-rose-600 rounded-2xl hover:bg-rose-600 hover:text-white transition-all shadow-sm active:scale-90"
                          title="Reject Order"
                        >
                          <MdBlock size={22} />
                        </button>
                      </div>
                    ) : (
                      <span className="bg-emerald-100 text-emerald-600 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider inline-flex items-center gap-2">
                        <MdCheck size={16} /> Approved
                      </span>
                    )}
                  </td>

                  {/* STATUS TRACKING CELL */}
                  <td className="px-6 py-8 align-top text-center">
                    <select 
                      disabled={o.status === "Cancelled" || !o.is_approved}
                      value={o.status}
                      onChange={(e) => updateOrderStatus(o.id, e.target.value)}
                      className={`h-11 px-3 rounded-2xl text-[11px] font-black uppercase tracking-widest border-2 outline-none transition-all appearance-none text-center w-full
                        ${o.status === "Delivered" ? "bg-blue-600 border-blue-600 text-white" : "bg-white border-slate-200 text-slate-700 focus:border-blue-400 shadow-sm"}
                        ${(o.status === "Cancelled" || !o.is_approved) ? "opacity-40 cursor-not-allowed" : "cursor-pointer hover:border-blue-300"}
                      `}
                    >
                      {trackingStatuses.map(status => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                      {o.status === "Cancelled" && <option value="Cancelled">Cancelled</option>}
                    </select>
                  </td>

                  {/* ACTIONS CELL */}
                  <td className="px-6 py-8 align-top text-right">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => setSelectedOrder(o)} className="p-3 text-blue-600 bg-blue-50 rounded-2xl hover:bg-blue-600 hover:text-white transition-all shadow-sm"><MdVisibility size={20} /></button>
                      <button onClick={() => openEditModal(o)} className="p-3 text-amber-600 bg-amber-50 rounded-2xl hover:bg-amber-600 hover:text-white transition-all shadow-sm"><MdEdit size={20} /></button>
                      {userRole === "admin" && (
                        <button
                          onClick={async () => {
                            if (!window.confirm("Delete order record permanently?")) return;
                            const { error } = await supabase.from("orders").delete().eq("id", o.id);
                            if (error) alert("Failed to delete order");
                            else fetchOrders();
                          }}
                          className="p-3 text-rose-600 bg-rose-50 rounded-2xl hover:bg-rose-600 hover:text-white transition-all shadow-sm"
                        >
                          <MdDelete size={20} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- MODALS (Code retained for full working logic) --- */}
      {showOrderModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[1100] p-4">
          <div className="bg-white w-full max-w-3xl rounded-[40px] shadow-2xl p-10 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-8 border-b pb-6">
              <h3 className="text-2xl font-black text-slate-900 uppercase">{isEditing ? "Edit Order" : "New Order"}</h3>
              <button onClick={() => { setShowOrderModal(false); resetOrderForm(); }} className="text-slate-300 hover:text-rose-500 transition-all text-2xl font-bold"><MdClose /></button>
            </div>

            <form onSubmit={saveOrder} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="relative">
                    <input 
                      required 
                      placeholder="Customer Name" 
                      className="w-full h-14 bg-slate-50 border-2 border-slate-50 rounded-2xl px-6 outline-none font-bold" 
                      value={orderForm.customer} 
                      onChange={e => handleCustomerSearch(e.target.value)}
                      onFocus={() => orderForm.customer.length >= 2 && setShowSuggestions(true)}
                      onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                    />
                    {showSuggestions && customerSuggestions.length > 0 && (
                      <div className="absolute z-[1200] w-full bg-white mt-1 border border-slate-100 rounded-2xl shadow-xl overflow-hidden max-h-48 overflow-y-auto">
                        {customerSuggestions.map((cust, idx) => (
                          <div key={idx} className="p-4 hover:bg-blue-50 cursor-pointer border-b border-slate-50 last:border-none transition-colors" onClick={() => selectExistingCustomer(cust)}>
                            <p className="font-black text-slate-800 text-sm">{cust.customer_name}</p>
                            <p className="text-[10px] text-slate-400 font-bold">{cust.phone}</p>
                          </div>
                        ))}
                      </div>
                    )}
                </div>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-slate-400">+91</span>
                  <input required type="tel" placeholder="Phone Number" className="w-full h-14 bg-slate-50 border-2 border-slate-50 rounded-2xl pl-14 pr-6 outline-none font-bold" value={orderForm.phone} onChange={e => setOrderForm({ ...orderForm, phone: e.target.value.replace(/\D/g, "").slice(0, 10) })} />
                </div>
              </div>

              <div className="p-6 bg-slate-50 rounded-3xl border-2 border-slate-100 space-y-4">
                <select className="w-full h-14 bg-white border-2 border-slate-100 rounded-2xl px-6 outline-none font-bold" onChange={e => { if(e.target.value) addProductToOrder(e.target.value); e.target.value = ""; }}>
                  <option value="">Search and Add...</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name} - ₹{p.price}</option>)}
                </select>
                <div className="space-y-2 mt-4">
                  {(orderForm.items || []).map((item, index) => (
                    <div key={index} className="flex items-center gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                      <div className="flex-1">
                        <p className="font-black text-slate-800 text-sm">{item.productName}</p>
                        <p className="text-[10px] text-slate-400 font-bold">Unit Price: ₹{item.price}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-slate-400 uppercase">Qty:</span>
                        <input type="number" min="1" className="w-16 h-10 border-2 border-slate-100 rounded-lg text-center font-bold" value={item.qty} onChange={e => updateItemQty(index, e.target.value)} />
                      </div>
                      <button type="button" onClick={() => removeItem(index)} className="text-rose-500"><MdRemoveCircle size={20} /></button>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-slate-900 h-20 rounded-3xl px-10 flex items-center justify-between shadow-xl">
                <span className="text-slate-400 text-xs font-black uppercase tracking-widest">Grand Total</span>
                <span className="text-white font-black text-3xl">₹{orderGrandTotal.toLocaleString()}</span>
              </div>
              <button type="submit" className="w-full h-16 bg-blue-600 text-white rounded-2xl font-black uppercase shadow-xl hover:bg-blue-700 active:scale-95 transition-all">Authorize Order</button>
            </form>
          </div>
        </div>
      )}

      {selectedOrder && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[1100] p-4">
          <div className="bg-white w-full max-w-lg rounded-[40px] p-10 overflow-y-auto max-h-[80vh]">
            <div className="flex justify-between items-center mb-8 border-b pb-4">
              <h3 className="text-2xl font-black uppercase text-slate-900">Order Summary</h3>
              <button onClick={() => setSelectedOrder(null)} className="text-2xl text-slate-300 hover:text-rose-500">✕</button>
            </div>
            <div className="space-y-4">
              <p className="font-bold text-slate-500 uppercase text-[10px] tracking-widest">Customer Details</p>
              <h2 className="text-2xl font-black text-slate-900">{selectedOrder.customer_name || 'Walking Customer'}</h2>
              <p className="text-slate-600 font-bold text-lg">{selectedOrder.phone_number?.startsWith('+91') ? selectedOrder.phone_number : `+91 ${selectedOrder.phone_number}`}</p>
              <div className="space-y-2 border-y py-6 my-2">
                {(() => {
                  try {
                    const parsed = typeof selectedOrder.items === 'string' ? (selectedOrder.items.startsWith('[') ? JSON.parse(selectedOrder.items) : selectedOrder.items) : selectedOrder.items;
                    if (Array.isArray(parsed)) {
                        return parsed.map((item, i) => (
                          <div key={i} className="flex justify-between text-base py-1">
                            <span className="font-bold text-slate-700">{item.productName || item.name} <span className="text-slate-400 ml-1">x{item.qty}</span></span>
                            <span className="font-black text-slate-900">₹{Number(item.total || 0).toLocaleString()}</span>
                          </div>
                        ));
                    }
                    return <div className="text-sm font-bold text-blue-700">{parsed}</div>;
                  } catch(e) { return <div className="text-sm font-bold text-slate-400">Error loading items</div>; }
                })()}
              </div>
              <div className="flex justify-between items-center py-4">
                <span className="text-xl font-black text-slate-500 uppercase tracking-tighter">Grand Total</span>
                <span className="text-blue-600 text-4xl font-black">₹{(selectedOrder.total_price || 0).toLocaleString()}</span>
              </div>
            </div>
            <button onClick={() => handleProfessionalPrint(selectedOrder)} className="w-full h-16 bg-slate-900 text-white rounded-2xl font-black flex items-center justify-center gap-3 transition-colors hover:bg-slate-800 text-lg uppercase tracking-widest mt-6 shadow-xl"><MdPrint size={24} /> Print Invoice</button>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

export default Orders;