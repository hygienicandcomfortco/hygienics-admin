import { supabase } from "../utils/supabase"
import { useState, useMemo, useEffect } from "react";
import AdminLayout from "../components/AdminLayout";
import {
  MdSearch, MdVisibility, MdTrendingUp, MdAdd, MdClose,
  MdPrint, MdWhatsapp, MdInventory, MdEdit, MdDelete, MdRemoveCircle,
  MdCheck, MdBlock, MdPayments
} from "react-icons/md";

function Orders() {
  /* =======================
      STATE MANAGEMENT
  ======================= */
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
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
    status: "New",
    payment_status: "Pending", // New Field
    payment_method: "Cash"      // New Field
  });

  const [quickProductForm, setQuickProductForm] = useState({ 
    name: "", category: "General", price: "", purchasePrice: "", stock: "", imageUrl: "" 
  });

  const [showCategoryInput, setShowCategoryInput] = useState(false);
  const [newCategory, setNewCategory] = useState("");

  const trackingStatuses = ["New", "Packed", "Shipped", "Delivered"];
  // New Dropdown Options
  const paymentStatuses = ["Pending", "Paid", "Partially Paid"];
  const paymentMethods = ["Cash", "Online", "COD", "Bank Transfer"];

  /* =======================
      EFFECTS
  ======================= */
  useEffect(() => {
    fetchOrders();
    fetchProducts();
  }, []);

  useEffect(() => { localStorage.setItem("products", JSON.stringify(products)); }, [products]);
  useEffect(() => { localStorage.setItem("categories", JSON.stringify(categories)); }, [categories]);

  /* =======================
      HANDLERS
  ======================= */
  const userRole = localStorage.getItem("userRole");

  const fetchProducts = async () => {
    const { data, error } = await supabase.from("products").select("*").order('name');
    if (!error && data) setProducts(data);
  };

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
          is_approved,
          payment_status,
          payment_method
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

  /* =======================
      WHATSAPP STATUS ALERTS
  ======================= */
  const sendStatusUpdateWhatsApp = (order, newStatus) => {
    const phone = order.phone_number.replace(/\D/g, "");
    let message = "";

    if (newStatus === "Packed") {
      message = `Hello ${order.customer_name}, Your order (ID: ${order.id.toString().split('-')[0]}) has been PACKED and is ready for dispatch. Thank you!`;
    } else if (newStatus === "Shipped") {
      message = `Hello ${order.customer_name}, Good news! Your order (ID: ${order.id.toString().split('-')[0]}) has been SHIPPED. It will reach you shortly.`;
    } else if (newStatus === "Delivered") {
      message = `Hello ${order.customer_name}, Your order (ID: ${order.id.toString().split('-')[0]}) has been DELIVERED. We hope you love the products!`;
    }

    if (message) {
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
    }
  };

  const updateOrderStatus = async (orderId, newStatus) => {
    const orderObj = orders.find(o => o.id === orderId);
    try {
      const { error } = await supabase
        .from("orders")
        .update({ status: newStatus })
        .eq("id", orderId);
      
      if (error) throw error;
      
      if (["Packed", "Shipped", "Delivered"].includes(newStatus) && orderObj) {
        sendStatusUpdateWhatsApp(orderObj, newStatus);
      }

      fetchOrders();
    } catch (err) {
      alert("Failed to update status: " + err.message);
    }
  };

  const sendWhatsAppConfirmation = (order) => {
    const phone = order.phone_number.replace(/\D/g, "");
    const message = `Hello ${order.customer_name}, as per your confirmation on call, we have confirmed your order (Ref ID: ${order.id.toString().split('-')[0]}). Thank you for shopping with Hygienic & Comfort Co.!`;
    const encodedMsg = encodeURIComponent(message);
    window.open(`https://wa.me/${phone}?text=${encodedMsg}`, '_blank');
  };

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
        payment_status: orderForm.payment_status,
        payment_method: orderForm.payment_method
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

  const resetOrderForm = () => {
    setOrderForm({ 
        customer: "", 
        phone: "", 
        items: [], 
        status: "New",
        payment_status: "Pending",
        payment_method: "Cash"
    });
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
      payment_status: order.payment_status || "Pending",
      payment_method: order.payment_method || "Cash",
      items: editableItems 
    });
    setShowOrderModal(true);
  };

  /* =========================
      PROFESSIONAL INVOICE GENERATOR (FIXED DESIGN)
  ========================= */
  const handleProfessionalPrint = (order) => {
    const printWindow = window.open('', '_blank', 'width=900,height=1000');
    
    let itemsHtml = "";
    try {
        const rawItems = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
        if (Array.isArray(rawItems)) {
            itemsHtml = rawItems.map((item, index) => `
              <tr>
                <td style="padding: 15px; border-bottom: 1px solid #edf2f7; text-align: center; color: #718096;">${index + 1}</td>
                <td style="padding: 15px; border-bottom: 1px solid #edf2f7;">
                  <div style="font-weight: 700; color: #2d3748; font-size: 14px;">${item.productName || item.name || 'Product'}</div>
                </td>
                <td style="padding: 15px; border-bottom: 1px solid #edf2f7; text-align: center; font-weight: 600; color: #4a5568;">${item.qty} PCS</td>
                <td style="padding: 15px; border-bottom: 1px solid #edf2f7; text-align: right; color: #4a5568;">₹${Number(item.price || 0).toLocaleString('en-IN')}</td>
                <td style="padding: 15px; border-bottom: 1px solid #edf2f7; text-align: right; font-weight: 700; color: #1a365d;">₹${Number(item.total || item.qty * item.price || 0).toLocaleString('en-IN')}</td>
              </tr>
            `).join('');
        }
    } catch (e) {
        itemsHtml = `<tr><td colspan="5" style="padding: 20px; text-align: center;">${order.items}</td></tr>`;
    }

    const invoiceHtml = `
      <html>
      <head>
        <title>Invoice #${order.id.toString().split('-')[0]}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap');
          body { font-family: 'Plus Jakarta Sans', sans-serif; color: #1a202c; margin: 0; padding: 0; background: #fff; }
          .container { width: 800px; margin: 40px auto; padding: 50px; border: 1px solid #e2e8f0; border-radius: 20px; box-shadow: 0 10px 25px rgba(0,0,0,0.05); }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 4px solid #2563eb; padding-bottom: 30px; margin-bottom: 40px; }
          .brand h1 { margin: 0; color: #1e3a8a; font-size: 28px; font-weight: 800; letter-spacing: -1px; }
          .brand p { margin: 5px 0; font-size: 13px; color: #64748b; font-weight: 600; }
          .inv-meta { text-align: right; }
          .inv-meta h2 { margin: 0; color: #2563eb; font-size: 32px; font-weight: 800; }
          .info-row { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 40px; background: #f8fafc; padding: 30px; border-radius: 15px; }
          .info-box h4 { margin: 0 0 10px 0; font-size: 11px; text-transform: uppercase; color: #3b82f6; letter-spacing: 1.5px; }
          .info-box p { margin: 3px 0; font-weight: 700; font-size: 16px; color: #1e293b; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
          th { background: #1e3a8a; color: white; text-align: left; padding: 15px; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; }
          .total-section { border-top: 2px solid #e2e8f0; padding-top: 20px; display: flex; justify-content: flex-end; }
          .total-pill { background: #1e3a8a; color: white; padding: 20px 40px; border-radius: 15px; font-size: 22px; font-weight: 800; }
          .footer { margin-top: 60px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #edf2f7; padding-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="brand">
              <h1>HYGIENIC & COMFORT CO.</h1>
              <p>Shop no.1, Bhausaheb Paranjape Chawl, Ambernath (E), 421502</p>
              <p>Phone: +91 93077 60665 | GST: 27AABCH1234F1Z5</p>
            </div>
            <div class="inv-meta">
              <h2>INVOICE</h2>
              <p style="font-weight: 800; color: #64748b;">REF: #${order.id.toString().split('-')[0].toUpperCase()}</p>
            </div>
          </div>

          <div class="info-row">
            <div class="info-box">
              <h4>Billed To Customer</h4>
              <p>${order.customer_name || 'Walking Customer'}</p>
              <p style="font-size: 14px; color: #64748b;">${order.phone_number || 'No Phone'}</p>
            </div>
            <div class="info-box" style="text-align: right;">
              <h4>Billing Details</h4>
              <p>Date: ${new Date(order.created_at).toLocaleDateString('en-IN')}</p>
              <p style="color: ${order.payment_status === 'Paid' ? '#059669' : '#d97706'}; font-size: 14px; font-weight: bold;">
                Status: ${order.payment_status?.toUpperCase() || 'PENDING'} / ${order.payment_method?.toUpperCase() || 'CASH'}
              </p>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="text-align: center; border-radius: 10px 0 0 0;">#</th>
                <th>Product Description</th>
                <th style="text-align: center;">Qty</th>
                <th style="text-align: right;">Unit Price</th>
                <th style="text-align: right; border-radius: 0 10px 0 0;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <div class="total-section">
            <div class="total-pill">
              Total Amount: ₹${(order.total_price || 0).toLocaleString('en-IN')}
            </div>
          </div>

          <div class="footer">
            Thank you for shopping with us! This is a computer generated invoice.<br>
            Please visit again for more Hygienic & Comfort products.
          </div>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(invoiceHtml);
    printWindow.document.close();
    setTimeout(() => {
        printWindow.print();
    }, 500);
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
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-sm font-black text-slate-400 uppercase tracking-widest border-b-2 border-slate-50">
                <th className="px-6 py-5 w-32">Ref ID</th>
                <th className="px-6 py-5 w-60">Customer</th>
                <th className="px-6 py-5 min-w-[280px]">Order Details</th>
                <th className="px-6 py-5 text-center w-40">Payment</th>
                <th className="px-6 py-5 text-center w-52">Status</th>
                <th className="px-6 py-5 text-right w-36">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan="6" className="py-20 text-center text-slate-400 font-bold text-lg italic">Fetching orders from cloud...</td></tr>
              ) : filteredOrders.length === 0 ? (
                <tr><td colSpan="6" className="py-20 text-center text-slate-400 font-bold text-lg italic">Loading.....</td></tr>
              ) : filteredOrders.map(o => (
                <tr key={o.id} className="hover:bg-slate-50/80 transition-all group">
                  <td className="px-6 py-8 align-top">
                    <span className="font-black text-slate-900 text-base uppercase bg-slate-100 px-3 py-1.5 rounded-lg block text-center">
                        {o.id.toString().split('-')[0]}
                    </span>
                  </td>

                  <td className="px-6 py-8 align-top">
                    <div className="flex flex-col">
                        <span className="font-black text-slate-900 text-lg leading-tight">{o.customer_name || 'Walking Customer'}</span>
                        <span className="text-sm text-slate-500 font-bold mt-2">
                            {o.phone_number}
                        </span>
                    </div>
                  </td>

                  <td className="px-6 py-8 align-top">
                    <div className="flex flex-col gap-2">
                       {(() => {
                        try {
                            if (!o.items) return <span className="text-xs text-slate-400 italic">Empty Order</span>;
                            const parsed = typeof o.items === 'string' ? (o.items.startsWith('[') ? JSON.parse(o.items) : o.items) : o.items;
                            
                            if (Array.isArray(parsed)) {
                                return parsed.map((item, i) => (
                                    <div key={i} className="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl border border-slate-100 max-w-sm">
                                        <span className="font-black text-slate-900 text-sm leading-tight">
                                            {item.productName || item.name}
                                        </span>
                                        <div className="flex items-center gap-3">
                                            <span className="text-[10px] text-slate-400 font-bold">₹{item.price}</span>
                                            <span className="font-black text-blue-600 bg-blue-50 px-2.5 py-1 rounded text-sm">
                                                x{item.qty}
                                            </span>
                                        </div>
                                    </div>
                                ));
                            }
                            return <span className="font-black text-slate-900 text-base leading-tight">{parsed}</span>;
                        } catch(e) { return <span className="text-xs text-rose-500 italic">Data Parsing Error</span>; }
                       })()}
                    </div>
                  </td>
                  
                  <td className="px-6 py-8 align-top text-center">
                    <div className="flex flex-col items-center gap-1">
                        <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase ${o.payment_status === 'Paid' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                            {o.payment_status || 'Pending'}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400">{o.payment_method || 'Cash'}</span>
                    </div>
                  </td>

                  <td className="px-6 py-8 align-top text-center">
                    <select 
                      disabled={o.status === "Cancelled" || !o.is_approved}
                      value={o.status}
                      onChange={(e) => updateOrderStatus(o.id, e.target.value)}
                      className={`h-11 px-3 rounded-2xl text-[11px] font-black uppercase tracking-widest border-2 outline-none transition-all appearance-none text-center w-full
                        ${o.status === "Delivered" ? "bg-blue-600 border-blue-600 text-white" : "bg-white border-slate-200 text-slate-700 focus:border-blue-400 shadow-sm"}
                        (${(o.status === "Cancelled" || !o.is_approved) ? "opacity-40 cursor-not-allowed" : "cursor-pointer hover:border-blue-300"}
                      `}
                    >
                      {trackingStatuses.map(status => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                      {o.status === "Cancelled" && <option value="Cancelled">Cancelled</option>}
                    </select>
                  </td>

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
                        ><MdDelete size={20} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- MODAL FOR NEW/EDIT ORDER --- */}
      {showOrderModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[1100] p-4">
          <div className="bg-white w-full max-w-4xl rounded-[40px] shadow-2xl p-10 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-8 border-b pb-6">
              <h3 className="text-2xl font-black text-slate-900 uppercase">{isEditing ? "Edit Order Record" : "Authorize Manual Order"}</h3>
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

              {/* PAYMENT DROPDOWNS */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Payment Status</label>
                    <select 
                        className="w-full h-14 bg-slate-50 border-2 border-slate-50 rounded-2xl px-6 outline-none font-bold"
                        value={orderForm.payment_status}
                        onChange={e => setOrderForm({...orderForm, payment_status: e.target.value})}
                    >
                        {paymentStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Payment Method</label>
                    <select 
                        className="w-full h-14 bg-slate-50 border-2 border-slate-50 rounded-2xl px-6 outline-none font-bold"
                        value={orderForm.payment_method}
                        onChange={e => setOrderForm({...orderForm, payment_method: e.target.value})}
                    >
                        {paymentMethods.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                </div>
              </div>

              <div className="p-6 bg-slate-50 rounded-3xl border-2 border-slate-100 space-y-4">
                <select className="w-full h-14 bg-white border-2 border-slate-100 rounded-2xl px-6 outline-none font-bold" onChange={e => { if(e.target.value) addProductToOrder(e.target.value); e.target.value = ""; }}>
                  <option value="">Search and Add Product...</option>
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
                      <div className="w-24 text-right">
                         <p className="font-black text-slate-900 text-sm">₹{item.total}</p>
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
              <button type="submit" className="w-full h-16 bg-blue-600 text-white rounded-2xl font-black uppercase shadow-xl hover:bg-blue-700 active:scale-95 transition-all">
                {isEditing ? "Save Changes" : "Authorize Order"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* --- SELECTED ORDER SUMMARY MODAL --- */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[1100] p-4">
          <div className="bg-white w-full max-w-lg rounded-[40px] p-10 overflow-y-auto max-h-[80vh]">
            <div className="flex justify-between items-center mb-8 border-b pb-4">
              <h3 className="text-2xl font-black uppercase text-slate-900">Order Summary</h3>
              <button onClick={() => setSelectedOrder(null)} className="text-2xl text-slate-300 hover:text-rose-500">✕</button>
            </div>
            <div className="space-y-4">
              <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold text-slate-500 uppercase text-[10px] tracking-widest">Customer Details</p>
                    <h2 className="text-2xl font-black text-slate-900">{selectedOrder.customer_name || 'Walking Customer'}</h2>
                    <p className="text-slate-600 font-bold text-lg">{selectedOrder.phone_number}</p>
                  </div>
                  <div className="text-right">
                    <span className={`px-4 py-2 rounded-xl text-xs font-black uppercase ${selectedOrder.payment_status === 'Paid' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                        {selectedOrder.payment_status || 'Pending'}
                    </span>
                    <p className="text-[10px] font-bold text-slate-400 mt-2">{selectedOrder.payment_method}</p>
                  </div>
              </div>
              <div className="space-y-2 border-y py-6 my-2">
                {(() => {
                  try {
                    const parsed = typeof selectedOrder.items === 'string' ? (selectedOrder.items.startsWith('[') ? JSON.parse(selectedOrder.items) : selectedOrder.items) : selectedOrder.items;
                    if (Array.isArray(parsed)) {
                        return parsed.map((item, i) => (
                          <div key={i} className="flex justify-between text-base py-1">
                            <span className="font-bold text-slate-700">{item.productName || item.name} <span className="text-slate-400 ml-1">x{item.qty}</span></span>
                            <span className="font-black text-slate-900">₹{Number(item.total || item.qty * item.price || 0).toLocaleString()}</span>
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
            <button onClick={() => handleProfessionalPrint(selectedOrder)} className="w-full h-16 bg-slate-900 text-white rounded-2xl font-black flex items-center justify-center gap-3 transition-colors hover:bg-slate-800 text-lg uppercase tracking-widest mt-6 shadow-xl"><MdPrint size={24} /> Print Professional Invoice</button>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

export default Orders;
