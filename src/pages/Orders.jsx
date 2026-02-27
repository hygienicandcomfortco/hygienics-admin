import { supabase } from "../utils/supabase"
import { useState, useMemo, useEffect } from "react";
import AdminLayout from "../components/AdminLayout";
import {
  MdSearch, MdVisibility, MdTrendingUp, MdAdd, MdClose,
  MdPrint, MdWhatsapp, MdInventory, MdEdit, MdDelete, MdRemoveCircle,
  MdCheck, MdBlock, MdPayments
} from "react-icons/md";

const extractItems = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === "object") {
    const candidates = [value.items, value.cart, value.cartItems, value.products, value.order_items];
    for (const candidate of candidates) {
      if (Array.isArray(candidate)) return candidate;
    }
  }
  return value;
};

const parseItemsFromText = (raw = "") => {
  const text = asText(raw).trim();
  if (!text) return [];

  const parsed = [];
  const regex = /(.+?)\s+x(\d+)(?=,|$)/gi;
  let match;

  while ((match = regex.exec(text)) !== null) {
    const name = asText(match[1]).trim().replace(/^,+\s*/, "");
    const qty = Math.max(1, Number(match[2] || 1));
    if (name) parsed.push({ productName: name, qty, price: 0, total: 0 });
  }

  if (parsed.length > 0) return parsed;

  return text
    .split(",")
    .map((part) => asText(part).trim())
    .filter(Boolean)
    .map((part) => {
      const m = part.match(/(.+?)\s+x(\d+)$/i);
      if (m) {
        return {
          productName: asText(m[1]).trim(),
          qty: Math.max(1, Number(m[2] || 1)),
          price: 0,
          total: 0
        };
      }
      return { productName: part, qty: 1, price: 0, total: 0 };
    });
};

const normalizeItems = (raw) => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try {
      return extractItems(JSON.parse(raw));
    } catch {
      const parsedTextItems = parseItemsFromText(raw);
      return parsedTextItems.length > 0 ? parsedTextItems : raw;
    }
  }
  return extractItems(raw);
};

const getItemName = (item) => item?.productName || item?.name || item?.title || "Product";
const getItemQty = (item) => Number(item?.qty ?? item?.quantity ?? item?.count ?? 1);
const getItemPrice = (item) => Number(item?.price ?? item?.unit_price ?? item?.unitPrice ?? item?.sale_price ?? item?.rate ?? 0);
const getItemTotal = (item) => Number(item?.total ?? item?.line_total ?? item?.amount ?? (getItemQty(item) * getItemPrice(item)));
const normalizePhone = (value = "") => String(value ?? "").replace(/\D/g, "").replace(/^91/, "").slice(-10);
const asText = (value) => (value == null ? "" : String(value));
const escapeHtml = (value = "") => asText(value)
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#39;");
const normalizeName = (value = "") => asText(value).trim().toLowerCase();
const getCustomerAddress = (customer = {}) =>
  customer?.address
  || customer?.full_address
  || customer?.customer_address
  || customer?.shipping_address
  || customer?.delivery_address
  || customer?.billing_address
  || customer?.address_line1
  || customer?.address_line_1
  || customer?.address1
  || customer?.house_address
  || "";
const formatDateTime = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
};

function Orders() {
  /* =======================
      STATE MANAGEMENT
  ======================= */
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [customerAddresses, setCustomerAddresses] = useState([]);
  const [categories, setCategories] = useState(() => {
    try {
      const saved = localStorage.getItem("categories");
      const parsed = saved ? JSON.parse(saved) : null;
      return Array.isArray(parsed) ? parsed : ["General", "Hygienic", "Comfort"];
    } catch {
      return ["General", "Hygienic", "Comfort"];
    }
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [expandedOrderItems, setExpandedOrderItems] = useState({});
  
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showQuickProductModal, setShowQuickProductModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentOrderId, setCurrentOrderId] = useState(null);
  const [editOriginal, setEditOriginal] = useState(null);

  const [customerSuggestions, setCustomerSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [orderForm, setOrderForm] = useState({
    customer: "",
    phone: "",
    email: "",
    address: "",
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

  const toggleExpandedItems = (orderId) => {
    setExpandedOrderItems((prev) => ({
      ...prev,
      [orderId]: !prev[orderId]
    }));
  };

  const findProductByItemName = (itemName = "") => {
    const target = normalizeName(itemName);
    if (!target) return null;

    const exact = products.find((p) => normalizeName(p.name) === target);
    if (exact) return exact;

    return products.find((p) => {
      const productName = normalizeName(p.name);
      return productName.includes(target) || target.includes(productName);
    }) || null;
  };

  const buildPricedItems = (order = {}) => {
    const parsed = normalizeItems(order.items);
    if (!Array.isArray(parsed) || parsed.length === 0) return [];

    const base = parsed.map((item) => {
      const qty = Math.max(1, getItemQty(item));
      const product = findProductByItemName(getItemName(item));
      const productPrice = Number(product?.price || 0);
      const productMrp = Number(product?.mrp ?? product?.original_price ?? product?.compare_at_price ?? 0);
      const givenPrice = Number(getItemPrice(item) || 0);
      const givenTotal = Number(getItemTotal(item) || 0);

      return {
        raw: item,
        name: getItemName(item),
        qty,
        productPrice: productPrice > 0 ? productPrice : 0,
        productMrp: productMrp > 0 ? productMrp : 0,
        givenPrice: givenPrice > 0 ? givenPrice : 0,
        givenTotal: givenTotal > 0 ? givenTotal : 0
      };
    });

    const totalQty = base.reduce((sum, item) => sum + item.qty, 0);
    const orderTotal = Math.max(0, Number(order.total_price || 0));
    const avgUnit = totalQty > 0 ? orderTotal / totalQty : 0;

    const priced = base.map((item) => {
      const unit = item.givenPrice || item.productPrice || avgUnit || 0;
      const line = item.givenTotal || (unit * item.qty);
      const mrp = item.productMrp || Math.max(unit, line / item.qty);
      return {
        ...item.raw,
        productName: item.name,
        qty: item.qty,
        price: unit,
        mrp,
        total: line
      };
    });

    const summed = priced.reduce((sum, item) => sum + Number(item.total || 0), 0);
    const delta = orderTotal - summed;
    if (priced.length > 0 && orderTotal > 0 && Math.abs(delta) >= 0.5) {
      const last = priced.length - 1;
      priced[last] = { ...priced[last], total: Math.max(0, Number(priced[last].total || 0) + delta) };
    }

    return priced;
  };

  const findMatchingCustomer = (order = {}) => {
    const orderPhone = normalizePhone(order.phone_number || "");
    const orderEmail = asText(order.email || order.customer_email).toLowerCase();
    return customers.find((customer) => {
      const customerPhone = normalizePhone(customer.phone || customer.phone_number || "");
      const customerEmail = asText(customer.email).toLowerCase();
      const phoneMatch = orderPhone && customerPhone && orderPhone === customerPhone;
      const emailMatch = orderEmail && customerEmail && orderEmail === customerEmail;
      return phoneMatch || emailMatch;
    });
  };

  const formatAddressRecord = (addressRecord = {}) => {
    if (!addressRecord || typeof addressRecord !== "object") return "";
    const fullAddress = asText(
      addressRecord.full_address
      || addressRecord.address
      || addressRecord.address_line
      || addressRecord.street
    ).trim();
    const city = asText(addressRecord.city).trim();
    const pincode = asText(addressRecord.pincode).trim();
    const tail = [city, pincode].filter(Boolean).join(" - ");
    if (fullAddress && tail) return `${fullAddress}, ${tail}`;
    return fullAddress || tail;
  };

  const findAddressRecord = (order = {}, matchedCustomer = null) => {
    if (!Array.isArray(customerAddresses) || customerAddresses.length === 0) return null;
    const customer = matchedCustomer || findMatchingCustomer(order);
    const candidateUserIds = [
      customer?.user_id,
      customer?.id,
      order?.user_id,
      order?.customer_id
    ].filter(Boolean);

    if (candidateUserIds.length > 0) {
      const byUserId = customerAddresses.find((addr) => {
        const addrUserId = asText(addr.user_id).trim();
        return addrUserId && candidateUserIds.includes(addrUserId);
      });
      if (byUserId) return byUserId;
    }

    const targetName = normalizeName(order.customer_name || customer?.customer_name);
    if (!targetName) return null;

    const candidates = customerAddresses.filter((addr) => {
      const addrName = normalizeName(addr.full_name);
      if (!addrName) return false;
      if (addrName === targetName) return true;
      if (addrName.includes(targetName) || targetName.includes(addrName)) return true;

      const targetParts = targetName.split(/\s+/).filter((p) => p.length >= 3);
      if (targetParts.length === 0) return false;
      return targetParts.every((part) => addrName.includes(part));
    });

    if (candidates.length === 0) return null;
    const preferred = candidates.find((addr) => addr.is_default);
    return preferred || candidates[0];
  };

  const getResolvedCustomerAddress = (order = {}) => {
    const addressOnOrder = getCustomerAddress(order);
    if (addressOnOrder) return addressOnOrder;
    const matchedCustomer = findMatchingCustomer(order);
    const addressOnCustomer = getCustomerAddress(matchedCustomer);
    if (addressOnCustomer) return addressOnCustomer;
    const addressRecord = findAddressRecord(order, matchedCustomer);
    return formatAddressRecord(addressRecord);
  };

  /* =======================
      EFFECTS
  ======================= */
  useEffect(() => {
    fetchOrders();
    fetchProducts();
    fetchCustomers();
    fetchCustomerAddresses();
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

  const fetchCustomers = async () => {
    const { data, error } = await supabase
      .from("customers")
      .select("*");
    if (!error && data) setCustomers(data);
  };

  const fetchCustomerAddresses = async () => {
    const { data, error } = await supabase
      .from("customer_addresses")
      .select("user_id, full_name, full_address, city, pincode, is_default, created_at")
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });

    if (!error) {
      setCustomerAddresses(data || []);
      return;
    }

    const { data: fallbackData, error: fallbackError } = await supabase
      .from("customer_addresses")
      .select("*");

    if (fallbackError) {
      console.warn("Fetch customer_addresses failed:", fallbackError.message);
      setCustomerAddresses([]);
      return;
    }

    setCustomerAddresses(fallbackData || []);
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
          email,
          address,
          is_approved,
          payment_status,
          payment_method,
          delivered_at
        `) 
        .order("created_at", { ascending: false });

      if (!error) {
        setOrders(data || []);
        return;
      }

      // Fallback if `email` column doesn't exist in orders table
      if (String(error.message || "").toLowerCase().includes("column") && String(error.message || "").toLowerCase().includes("email")) {
        const { data: fallbackData, error: fallbackError } = await supabase
          .from("orders")
          .select(`
            id,
            items,
            total_price,
            status,
            created_at,
            customer_name,
            phone_number,
            address,
            is_approved,
            payment_status,
            payment_method,
            delivered_at
          `)
          .order("created_at", { ascending: false });

        if (fallbackError) throw fallbackError;
        setOrders(fallbackData || []);
        return;
      }

      throw error;
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
    const phone = (order.phone_number || "").replace(/\D/g, "");
    let message = "";

    if (newStatus === "Packed") {
      message = `Hello ${order.customer_name}, Your order (ID: ${asText(order.id).split("-")[0]}) has been PACKED and is ready for dispatch. Thank you!`;
    } else if (newStatus === "Shipped") {
      message = `Hello ${order.customer_name}, Good news! Your order (ID: ${asText(order.id).split("-")[0]}) has been SHIPPED. It will reach you shortly.`;
    } else if (newStatus === "Delivered") {
      message = `Hello ${order.customer_name}, Your order (ID: ${asText(order.id).split("-")[0]}) has been DELIVERED. We hope you love the products!`;
    }

    if (message) {
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
    }
  };

  const updateOrderStatus = async (orderId, newStatus) => {
    const orderObj = orders.find(o => o.id === orderId);
    try {
      const updatePayload = { status: newStatus };
      if (newStatus === "Delivered") {
        updatePayload.delivered_at = new Date().toISOString();
      } else if (orderObj?.delivered_at) {
        updatePayload.delivered_at = null;
      }

      const { error } = await supabase
        .from("orders")
        .update(updatePayload)
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
    const phone = (order.phone_number || "").replace(/\D/g, "");
    const message = `Hello ${order.customer_name}, as per your confirmation on call, we have confirmed your order (Ref ID: ${asText(order.id).split("-")[0]}). Thank you for shopping with Hygienic & Comfort Co.!`;
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

  const upsertCustomerFromOrder = async (form) => {
    const phone = normalizePhone(form.phone || "");
    const email = (form.email || "").trim();
    const name = (form.customer || "").trim();

    if (!phone && !email && !name) return;

    let findQuery = supabase.from("customers").select("id").limit(1);
    if (phone && email) {
      findQuery = findQuery.or(`phone.eq.${phone},email.eq.${email}`);
    } else if (phone) {
      findQuery = findQuery.eq("phone", phone);
    } else if (email) {
      findQuery = findQuery.eq("email", email);
    }

    const { data: existing, error: findError } = await findQuery;
    if (findError) return;

    const payload = {};
    if (name) payload.customer_name = name;
    if (phone) payload.phone = phone;
    if (email) payload.email = email;
    if (form.address) payload.address = form.address;

    if (existing && existing.length > 0) {
      await supabase.from("customers").update(payload).eq("id", existing[0].id);
    } else {
      await supabase.from("customers").insert([{ ...payload, total_orders: 0, total_spend: 0 }]);
    }
  };

  const handleCustomerSearch = async (val) => {
    setOrderForm((prev) => ({ ...prev, customer: val, address: "" }));
    
    if (val.length < 2) {
      setCustomerSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .ilike("customer_name", `%${val}%`)
      .limit(5);

    if (!error && data) {
      setCustomerSuggestions(data);
      setShowSuggestions(true);
    }
  };

  const selectExistingCustomer = (cust) => {
    const cleanPhone = (cust.phone || "").replace("+91", "").trim();
    const resolvedAddress = getResolvedCustomerAddress({
      customer_name: cust.customer_name,
      phone_number: cust.phone || cust.phone_number || "",
      email: cust.email || "",
      user_id: cust.user_id,
      customer_id: cust.id
    });
    setOrderForm({
      ...orderForm,
      customer: cust.customer_name,
      phone: cleanPhone,
      email: cust.email || "",
      address: resolvedAddress
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

    if (!isEditing && orderForm.phone.length !== 10) {
      alert("Please enter a 10-digit phone number.");
      return;
    }

    try {
      if (isEditing && currentOrderId) {
        const updatePayload = {};
        const original = editOriginal || {};

        const originalName = (original.customer_name || "").trim();
        const originalPhone = normalizePhone(original.phone_number || "");
        const originalEmail = (original.email || original.customer_email || "").trim();
        const originalAddress = (original.address || "").trim();
        const originalItems = Array.isArray(normalizeItems(original.items)) ? normalizeItems(original.items) : [];
        const originalStatus = original.status || "New";
        const originalDeliveredAt = original.delivered_at || null;
        const originalPaymentStatus = original.payment_status || "Pending";
        const originalPaymentMethod = original.payment_method || "Cash";

        if ((orderForm.customer || "").trim() !== originalName) {
          updatePayload.customer_name = (orderForm.customer || "").trim();
        }

        const nextPhone = normalizePhone(orderForm.phone || "");
        if (nextPhone && nextPhone !== originalPhone) {
          if (nextPhone.length !== 10) {
            alert("Please enter a 10-digit phone number.");
            return;
          }
          updatePayload.phone_number = "+91" + nextPhone;
        }

        const nextEmail = (orderForm.email || "").trim();
        if (nextEmail !== originalEmail) {
          updatePayload.email = nextEmail || null;
        }
        const nextAddress = (orderForm.address || "").trim();
        if (nextAddress !== originalAddress) {
          updatePayload.address = nextAddress || null;
        }

        if (JSON.stringify(orderForm.items || []) !== JSON.stringify(originalItems)) {
          updatePayload.items = orderForm.items || [];
          updatePayload.total_price = orderGrandTotal;
        }

        if (orderForm.status !== originalStatus) {
          updatePayload.status = orderForm.status;
          updatePayload.delivered_at = orderForm.status === "Delivered" ? new Date().toISOString() : null;
        } else if (originalStatus === "Delivered" && originalDeliveredAt == null) {
          updatePayload.delivered_at = new Date().toISOString();
        }
        if (orderForm.payment_status !== originalPaymentStatus) updatePayload.payment_status = orderForm.payment_status;
        if (orderForm.payment_method !== originalPaymentMethod) updatePayload.payment_method = orderForm.payment_method;

        if (Object.keys(updatePayload).length === 0) {
          alert("No changes to save.");
          return;
        }

        const { error: updateError } = await supabase
          .from("orders")
          .update(updatePayload)
          .eq("id", currentOrderId);
        if (!updateError) {
          // ok
        } else if (String(updateError.message || "").toLowerCase().includes("column") && String(updateError.message || "").toLowerCase().includes("email")) {
          const { error: retryError } = await supabase
            .from("orders")
            .update({ ...updatePayload, email: undefined })
            .eq("id", currentOrderId);
          if (retryError) throw retryError;
        } else {
          throw updateError;
        }
      } else {
        const orderPayload = {
          customer_name: orderForm.customer,
          phone_number: "+91" + orderForm.phone.replace("+91", "").trim(),
          email: orderForm.email || null,
          address: orderForm.address || null,
          items: orderForm.items,
          total_price: orderGrandTotal,
          status: orderForm.status,
          delivered_at: orderForm.status === "Delivered" ? new Date().toISOString() : null,
          payment_status: orderForm.payment_status,
          payment_method: orderForm.payment_method
        };
        const { error: insertError } = await supabase
          .from("orders")
          .insert([orderPayload]);
        if (!insertError) {
          // ok
        } else if (String(insertError.message || "").toLowerCase().includes("column") && String(insertError.message || "").toLowerCase().includes("email")) {
          const { error: retryError } = await supabase
            .from("orders")
            .insert([{ ...orderPayload, email: undefined }]);
          if (retryError) throw retryError;
        } else {
          throw insertError;
        }
      }

      await fetchOrders();
      await upsertCustomerFromOrder(orderForm);
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
        email: "",
        address: "",
        items: [], 
        status: "New",
        payment_status: "Pending",
        payment_method: "Cash"
    });
    setIsEditing(false);
    setCurrentOrderId(null);
    setEditOriginal(null);
  };

  const openEditModal = (order) => {
    setIsEditing(true);
    setCurrentOrderId(order.id);
    setEditOriginal(order);
    
    const editableItems = Array.isArray(normalizeItems(order.items)) ? normalizeItems(order.items) : [];

    setOrderForm({
      customer: order.customer_name || "",
      phone: (order.phone_number || "").replace("+91", "").trim(),
      email: order.email || order.customer_email || "",
      address: getResolvedCustomerAddress(order),
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
    const resolvedAddress = getResolvedCustomerAddress(order);
    let itemsHtml = "";
    let totalQty = 0;
    let mrpTotal = 0;
    let unitPriceTotal = 0;
    let discountTotal = 0;
    const orderTotal = Math.max(0, Number(order.total_price || 0));

    try {
      const parsedItems = buildPricedItems(order);
      if (Array.isArray(parsedItems) && parsedItems.length > 0) {
        itemsHtml = parsedItems.map((item) => {
          const qty = Math.max(1, getItemQty(item));
          const unitPrice = Math.max(0, Number(getItemPrice(item) || 0));
          const lineTotal = Math.max(0, Number(getItemTotal(item) || (qty * unitPrice)));
          const itemMrp = Math.max(0, Number(item?.mrp || 0)) || Math.max(unitPrice, lineTotal / qty);
          const lineMrp = itemMrp * qty;
          const lineDiscount = Math.max(0, lineMrp - lineTotal);
          totalQty += qty;
          mrpTotal += lineMrp;
          unitPriceTotal += lineTotal;
          discountTotal += lineDiscount;

          return `
            <tr>
              <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;vertical-align:top;line-height:1.35;overflow-wrap:anywhere;">${escapeHtml(getItemName(item))}</td>
              <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;text-align:center;">${qty}</td>
              <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;text-align:right;">&#8377;${itemMrp.toLocaleString('en-IN')}</td>
              <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;text-align:right;">&#8377;${unitPrice.toLocaleString('en-IN')}</td>
              <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;text-align:right;">${lineDiscount > 0 ? `&#8377;${lineDiscount.toLocaleString('en-IN')}` : "-"}</td>
              <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:700;">&#8377;${lineTotal.toLocaleString('en-IN')}</td>
            </tr>
          `;
        }).join("");
      } else {
        itemsHtml = `
          <tr>
            <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;vertical-align:top;overflow-wrap:anywhere;">${escapeHtml(order.items || "Items not available")}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;text-align:center;">-</td>
            <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;text-align:right;">&#8377;${orderTotal.toLocaleString('en-IN')}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;text-align:right;">-</td>
            <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;text-align:right;">-</td>
            <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:700;">&#8377;${orderTotal.toLocaleString('en-IN')}</td>
          </tr>
        `;
      }
    } catch (e) {
      itemsHtml = `<tr><td colspan="6" style="padding:20px;text-align:center;color:#64748b;">Unable to load items</td></tr>`;
    }

    if (!mrpTotal) mrpTotal = orderTotal;
    if (!unitPriceTotal) unitPriceTotal = orderTotal;
    if (!totalQty) totalQty = 1;

    const invoiceNo = `INV-${asText(order.id).split("-")[0].toUpperCase()}`;
    const createdDate = new Date(order.created_at);
    const orderNo = `HC-${createdDate.getFullYear()}${String(createdDate.getMonth() + 1).padStart(2, "0")}${String(createdDate.getDate()).padStart(2, "0")}-${asText(order.id).split("-")[0].toUpperCase()}`;
    const invoiceDate = createdDate.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
    const deliveryDate = order.delivered_at
      ? new Date(order.delivered_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
      : "-";
    const customerPhone = order.phone_number || "-";
    const customerEmail = order.email || order.customer_email || "";
    const paymentMethod = escapeHtml(order.payment_method || "Cash");
    const orderStatus = escapeHtml(order.status || "New");
    const logoPath = `${window.location.origin}${window.location.pathname.replace(/\/[^/]*$/, "/")}logo.png`;

    const invoiceHtml = `
      <html>
      <head>
        <title>Invoice #${invoiceNo}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap');
          body { font-family:'Plus Jakarta Sans','Segoe UI',sans-serif; color:#0f172a; margin:0; background:#fff; }
          .invoice-page { width:800px; margin:18px auto; padding:20px; border:1px solid #e2e8f0; border-radius:12px; }
          .header { display:grid; grid-template-columns:1.15fr 0.85fr; align-items:start; gap:20px; padding-bottom:18px; border-bottom:2px solid #2563eb; }
          .brand-row { display:flex; align-items:center; gap:10px; margin-bottom:8px; }
          .brand-row img { width:50px; height:50px; border-radius:50%; border:1px solid #dbe7ff; object-fit:contain; padding:2px; background:#fff; display:block; }
          .right { text-align:right; }
          .box { border:1px solid #e2e8f0; border-radius:10px; padding:14px; margin:20px 0; }
          table { width:100%; table-layout:fixed; border-collapse:collapse; margin-bottom:18px; border:1px solid #e2e8f0; border-radius:10px; overflow:hidden; }
          th { text-align:left; padding:10px 12px; background:#f8fafc; border-bottom:1px solid #e2e8f0; }
          .foot td { background:#f8fafc; border-top:1px solid #cbd5e1; font-weight:800; }
          .footer { border-top:1px solid #e2e8f0; padding-top:14px; text-align:center; color:#64748b; font-size:12px; }
        </style>
      </head>
      <body>
        <div class="invoice-page">
          <div class="header">
            <div>
              <div class="brand-row">
                <img src="${escapeHtml(logoPath)}" alt="Logo" />
                <h2 style="margin:0;font-size:38px;line-height:1.1;color:#111827;white-space:nowrap;">Hygienic & Comfort Co.</h2>
              </div>
              <p style="margin:0;color:#334155;font-size:14px;">Ambernath East, Maharashtra</p>
              <p style="margin:4px 0 0 0;color:#334155;font-size:14px;">Contact: +91 9307760665</p>
              <p style="margin:4px 0 0 0;color:#334155;font-size:14px;">hygienicsandcomfort@gmail.com</p>
            </div>
            <div class="right">
              <p style="margin:0;font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;">Tax Invoice</p>
              <h1 style="margin:6px 0 0 0;font-size:42px;color:#2563eb;line-height:1;">INVOICE</h1>
              <p style="margin:10px 0 0 0;font-size:14px;"><b>Invoice No:</b> #${invoiceNo}</p>
              <p style="margin:4px 0 0 0;font-size:14px;"><b>Order ID:</b> ${orderNo}</p>
              <p style="margin:4px 0 0 0;font-size:14px;"><b>Date:</b> ${invoiceDate}</p>
              <p style="margin:4px 0 0 0;font-size:14px;"><b>Delivery Date:</b> ${deliveryDate}</p>
              <p style="margin:4px 0 0 0;font-size:14px;"><b>Status:</b> ${orderStatus}</p>
            </div>
          </div>

          <div class="box">
            <p style="margin:0 0 8px 0;font-size:12px;font-weight:800;color:#64748b;text-transform:uppercase;">Shipping Address</p>
            <p style="margin:0;font-weight:700;">${escapeHtml(order.customer_name || "Customer")}</p>
            <p style="margin:4px 0 0 0;">${escapeHtml(resolvedAddress || "Address not available")}</p>
            <p style="margin:4px 0 0 0;">Phone: ${escapeHtml(customerPhone)}</p>
            ${customerEmail ? `<p style="margin:4px 0 0 0;">Email: ${escapeHtml(customerEmail)}</p>` : ""}
          </div>

          <table>
            <colgroup>
              <col style="width:auto;">
              <col style="width:62px;">
              <col style="width:96px;">
              <col style="width:96px;">
              <col style="width:96px;">
              <col style="width:110px;">
            </colgroup>
            <thead>
              <tr>
                <th>Item Description</th>
                <th style="text-align:center;">Qty</th>
                <th style="text-align:right;">MRP</th>
                <th style="text-align:right;">Unit Price</th>
                <th style="text-align:right;">Discount</th>
                <th style="text-align:right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
            <tfoot class="foot">
              <tr>
                <td style="padding:10px 12px;">Totals</td>
                <td style="padding:10px 12px;text-align:center;">${totalQty}</td>
                <td style="padding:10px 12px;text-align:right;">&#8377;${mrpTotal.toLocaleString('en-IN')}</td>
                <td style="padding:10px 12px;text-align:right;">&#8377;${unitPriceTotal.toLocaleString('en-IN')}</td>
                <td style="padding:10px 12px;text-align:right;color:#15803d;">${discountTotal > 0 ? `&#8377;${discountTotal.toLocaleString('en-IN')}` : "-"}</td>
                <td style="padding:10px 12px;text-align:right;font-weight:900;">&#8377;${orderTotal.toLocaleString('en-IN')}</td>
              </tr>
            </tfoot>
          </table>

          <p style="margin:-6px 0 18px 0;text-align:right;color:#64748b;font-size:13px;">
            Payment Method: <span style="font-weight:700;color:#0f172a;">${paymentMethod}</span>
          </p>

          <div class="footer">
            <p style="margin:0 0 4px 0;">Thank you for shopping with Hygienic & Comfort Co.!</p>
            <p style="margin:0;">This is a computer-generated invoice and does not require a physical signature.</p>
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
      const customerName = asText(o.customer_name).toLowerCase();
      const customerPhone = asText(o.phone_number);
      const customerEmail = asText(o.email || o.customer_email);
      const customerMatch = customers.find(c => {
        const phoneMatch = normalizePhone(c.phone) && normalizePhone(o.phone_number) && normalizePhone(c.phone) === normalizePhone(o.phone_number);
        const email = asText(c.email).toLowerCase();
        const emailMatch = email && email === customerEmail.toLowerCase();
        return phoneMatch || emailMatch;
      });
      const fallbackPhone = customerMatch?.phone ? `+91 ${customerMatch.phone}` : "";
      const fallbackEmail = customerMatch?.email || "";
      const search = searchTerm.toLowerCase();
      return customerName.includes(search)
        || customerPhone.includes(search)
        || customerEmail.toLowerCase().includes(search)
        || fallbackPhone.includes(search)
        || fallbackEmail.toLowerCase().includes(search);
    });
  }, [orders, searchTerm, customers]);

  return (
    <AdminLayout>
      <div className="mb-6 px-4 flex flex-wrap justify-between items-end gap-4">
        <div className="flex flex-col gap-4">
            <h2 className="text-4xl font-black text-white uppercase tracking-tight">Order Management</h2>
            <div className="relative w-full max-w-md">
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
        <button onClick={() => { resetOrderForm(); setShowOrderModal(true); }} className="bg-blue-600 hover:bg-blue-700 text-white py-3.5 px-8 rounded-2xl font-black text-base flex items-center gap-2 shadow-lg transition-all active:scale-95 shrink-0"><MdAdd size={24} /> New Order</button>
      </div>

      <div className="bg-white rounded-[40px] shadow-2xl p-4 md:p-5 mx-2 md:mx-4 overflow-hidden border border-slate-100">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-xs font-black text-slate-400 uppercase tracking-widest border-b-2 border-slate-50">
                <th className="px-4 py-4 w-28">Ref ID</th>
                <th className="px-4 py-4 w-56">Customer</th>
                <th className="px-4 py-4 min-w-[220px]">Order Details</th>
                <th className="px-4 py-4 text-center w-32">Payment</th>
                <th className="px-4 py-4 text-center w-40">Status</th>
                <th className="px-4 py-4 text-center w-36">Approval</th>
                <th className="px-4 py-4 text-right w-28">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan="7" className="py-20 text-center text-slate-400 font-bold text-lg italic">Fetching orders from cloud...</td></tr>
              ) : filteredOrders.length === 0 ? (
                <tr><td colSpan="7" className="py-20 text-center text-slate-400 font-bold text-lg italic">Loading.....</td></tr>
              ) : filteredOrders.map(o => (
                <tr key={o.id} className="hover:bg-slate-50/80 transition-all group">
                  <td className="px-4 py-6 align-top">
                    <span className="font-black text-slate-900 text-base uppercase bg-slate-100 px-3 py-1.5 rounded-lg block text-center">
                        {asText(o.id).split("-")[0]}
                    </span>
                  </td>

                  <td className="px-4 py-6 align-top">
                    <div className="flex flex-col">
                        {(() => {
                          const customerMatch = customers.find(c => {
                            const phoneMatch = normalizePhone(c.phone) && normalizePhone(o.phone_number) && normalizePhone(c.phone) === normalizePhone(o.phone_number);
                            const email = asText(c.email).toLowerCase();
                            const targetEmail = asText(o.email || o.customer_email).toLowerCase();
                            const emailMatch = email && email === targetEmail;
                            return phoneMatch || emailMatch;
                          });
                          const displayPhone = o.phone_number || (customerMatch?.phone ? `+91 ${customerMatch.phone}` : "—");
                          const displayEmail = o.email || o.customer_email || customerMatch?.email || "—";
                          return (
                            <>
                              <span className="font-black text-slate-900 text-lg leading-tight">{o.customer_name || customerMatch?.customer_name || 'Walking Customer'}</span>
                              <span className="text-sm text-slate-500 font-bold mt-2">
                                {displayPhone}
                              </span>
                              <span className="text-xs text-slate-400 font-bold mt-1">
                                {displayEmail}
                              </span>
                            </>
                          );
                        })()}
                    </div>
                  </td>

                  <td className="px-4 py-6 align-top">
                    <div className="flex flex-col gap-2 max-w-[360px]">
                       {(() => {
                        try {
                            if (!o.items) return <span className="text-xs text-slate-400 italic">Empty Order</span>;
                            const parsed = buildPricedItems(o);
                            
                            if (Array.isArray(parsed)) {
                                if (parsed.length === 0) return <span className="text-xs text-slate-400 italic">Empty Order</span>;
                                const isExpanded = Boolean(expandedOrderItems[o.id]);
                                const previewItems = isExpanded ? parsed : parsed.slice(0, 3);
                                const remainingCount = parsed.length - previewItems.length;
                                return (
                                  <>
                                    {previewItems.map((item, i) => (
                                      <div key={i} className="flex items-center justify-between gap-3 bg-slate-50 px-3 py-2 rounded-xl border border-slate-100">
                                        <span className="font-black text-slate-900 text-sm leading-tight truncate" title={getItemName(item)}>
                                          {getItemName(item)}
                                        </span>
                                        <div className="flex items-center gap-2 shrink-0">
                                          <span className="text-[10px] text-slate-500 font-bold">₹{Number(getItemPrice(item) || 0).toLocaleString("en-IN")}</span>
                                          <span className="font-black text-blue-700 bg-blue-100 px-2 py-0.5 rounded text-xs">
                                            x{getItemQty(item)}
                                          </span>
                                        </div>
                                      </div>
                                    ))}
                                    {remainingCount > 0 && !isExpanded && (
                                      <button
                                        type="button"
                                        onClick={() => toggleExpandedItems(o.id)}
                                        className="text-xs font-bold text-slate-500 hover:text-blue-600 pl-1 text-left"
                                      >
                                        +{remainingCount} more item{remainingCount > 1 ? "s" : ""}
                                      </button>
                                    )}
                                    {isExpanded && parsed.length > 3 && (
                                      <button
                                        type="button"
                                        onClick={() => toggleExpandedItems(o.id)}
                                        className="text-xs font-bold text-blue-600 hover:text-blue-700 pl-1 text-left"
                                      >
                                        Show less
                                      </button>
                                    )}
                                  </>
                                );
                            }
                            if (typeof parsed === "string") {
                              return <span className="font-black text-slate-900 text-base leading-tight">{parsed}</span>;
                            }
                            return <span className="text-xs text-slate-400 italic">No item details</span>;
                        } catch(e) { return <span className="text-xs text-rose-500 italic">Data Parsing Error</span>; }
                       })()}
                    </div>
                  </td>
                  
                  <td className="px-4 py-6 align-top text-center">
                    <div className="flex flex-col items-center gap-1">
                        <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase ${o.payment_status === 'Paid' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                            {o.payment_status || 'Pending'}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400">{o.payment_method || 'Cash'}</span>
                    </div>
                  </td>

                  <td className="px-4 py-6 align-top text-center">
                    <select 
                      disabled={o.status === "Cancelled" || !o.is_approved}
                      value={o.status}
                      onChange={(e) => updateOrderStatus(o.id, e.target.value)}
                      className={`h-10 px-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border-2 outline-none transition-all appearance-none text-center w-32
                        ${o.status === "Delivered" ? "bg-blue-600 border-blue-600 text-white" : "bg-white border-slate-200 text-slate-700 focus:border-blue-400 shadow-sm"}
                        ${(o.status === "Cancelled" || !o.is_approved) ? "opacity-40 cursor-not-allowed" : "cursor-pointer hover:border-blue-300"}
                      `}
                    >
                      {trackingStatuses.map(status => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                      {o.status === "Cancelled" && <option value="Cancelled">Cancelled</option>}
                    </select>
                    {o.status === "Delivered" && o.delivered_at && (
                      <p className="mt-2 text-[10px] font-bold text-emerald-600">
                        Delivered: {formatDateTime(o.delivered_at)}
                      </p>
                    )}
                  </td>

                  <td className="px-4 py-6 align-top text-center">
                    {o.status === "Cancelled" ? (
                      <span className="px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest bg-rose-100 text-rose-600 inline-block">
                        Cancelled
                      </span>
                    ) : o.is_approved ? (
                      <span className="px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest bg-emerald-100 text-emerald-600 inline-block">
                        Approved
                      </span>
                    ) : (
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleOrderApproval(o.id, true)}
                          className="px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700 transition-all"
                        >
                          <MdCheck size={14} /> Approve
                        </button>
                        <button
                          onClick={() => handleOrderApproval(o.id, false)}
                          className="px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 bg-rose-600 text-white hover:bg-rose-700 transition-all"
                        >
                          <MdBlock size={14} /> Cancel
                        </button>
                      </div>
                    )}
                  </td>

                  <td className="px-4 py-6 align-top text-right">
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
                      required={!isEditing}
                      placeholder="Customer Name" 
                      className="w-full h-14 bg-slate-50 border-2 border-slate-50 rounded-2xl px-6 outline-none font-bold text-slate-800 placeholder:text-slate-400" 
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
                  <input required={!isEditing} type="tel" placeholder="Phone Number" className="w-full h-14 bg-slate-50 border-2 border-slate-50 rounded-2xl pl-14 pr-6 outline-none font-bold text-slate-800 placeholder:text-slate-400" value={orderForm.phone} onChange={e => setOrderForm({ ...orderForm, phone: e.target.value.replace(/\D/g, "").slice(0, 10) })} />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 ml-2 mb-1 block">Email</label>
                <input
                  type="email"
                  placeholder="name@example.com"
                  value={orderForm.email}
                  onChange={(e) => setOrderForm({ ...orderForm, email: e.target.value })}
                  className="w-full h-14 bg-slate-50 border-2 border-slate-50 rounded-2xl px-6 outline-none font-bold text-slate-800 placeholder:text-slate-400"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 ml-2 mb-1 block">Customer Address</label>
                <textarea
                  value={orderForm.address || ""}
                  readOnly
                  rows={3}
                  placeholder="Address will appear here when you select an existing customer"
                  className="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl px-6 py-4 outline-none font-bold text-slate-800 placeholder:text-slate-400 resize-none"
                />
              </div>

              {/* PAYMENT DROPDOWNS */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Payment Status</label>
                    <select 
                        className="w-full h-14 bg-slate-50 border-2 border-slate-50 rounded-2xl px-6 outline-none font-bold text-slate-800"
                        value={orderForm.payment_status}
                        onChange={e => setOrderForm({...orderForm, payment_status: e.target.value})}
                    >
                        {paymentStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Payment Method</label>
                    <select 
                        className="w-full h-14 bg-slate-50 border-2 border-slate-50 rounded-2xl px-6 outline-none font-bold text-slate-800"
                        value={orderForm.payment_method}
                        onChange={e => setOrderForm({...orderForm, payment_method: e.target.value})}
                    >
                        {paymentMethods.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                </div>
              </div>

              <div className="p-6 bg-slate-50 rounded-3xl border-2 border-slate-100 space-y-4">
                <select className="w-full h-14 bg-white border-2 border-slate-100 rounded-2xl px-6 outline-none font-bold text-slate-800" onChange={e => { if(e.target.value) addProductToOrder(e.target.value); e.target.value = ""; }}>
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
                    <p className="text-slate-500 font-semibold text-sm mt-2 max-w-xs leading-5">
                      {getResolvedCustomerAddress(selectedOrder) || "Address not available"}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={`px-4 py-2 rounded-xl text-xs font-black uppercase ${selectedOrder.payment_status === 'Paid' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                        {selectedOrder.payment_status || 'Pending'}
                    </span>
                    <p className="text-[10px] font-bold text-slate-400 mt-2">{selectedOrder.payment_method}</p>
                    {selectedOrder.status === "Delivered" && selectedOrder.delivered_at && (
                      <p className="text-[10px] font-bold text-emerald-600 mt-2">
                        Delivered: {formatDateTime(selectedOrder.delivered_at)}
                      </p>
                    )}
                  </div>
              </div>
              <div className="space-y-2 border-y py-6 my-2">
                {(() => {
                  try {
                    const parsed = buildPricedItems(selectedOrder);
                    if (Array.isArray(parsed)) {
                        if (parsed.length === 0) return <div className="text-sm font-bold text-slate-400">No items found</div>;
                        return parsed.map((item, i) => (
                          <div key={i} className="flex justify-between items-start gap-3 text-base py-1">
                            <span className="font-bold text-slate-700 leading-6 flex-1">
                              {getItemName(item)} <span className="text-slate-400 ml-1">x{getItemQty(item)}</span>
                            </span>
                            <span className="font-black text-slate-900 whitespace-nowrap">₹{Number(getItemTotal(item) || 0).toLocaleString()}</span>
                          </div>
                        ));
                    }
                    if (typeof parsed === "string") {
                      return <div className="text-sm font-bold text-blue-700">{parsed}</div>;
                    }
                    return <div className="text-sm font-bold text-slate-400">No item details</div>;
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

