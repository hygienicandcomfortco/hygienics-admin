import { useParams, Link, useNavigate } from "react-router-dom";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "../lib/supabase";
import AdminLayout from "../components/AdminLayout";
import { MdArrowBack, MdPrint, MdHistory, MdSearch, MdReceiptLong } from "react-icons/md";

function CustomerProfile() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [customer, setCustomer] = useState(null);
  const [orders, setOrders] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCustomerAndOrders();
  }, [id]);

  const fetchCustomerAndOrders = async () => {
    setLoading(true);

    try {
      // 1. Fetch Customer Data
      const { data: customerData, error: customerError } = await supabase
        .from("customers")
        .select("*")
        .eq("id", id)
        .single();

      if (customerError) {
        console.error("Customer Fetch Error:", customerError);
        navigate("/customers");
        return;
      }

      // 2. Fetch Order History
      // Strategy: Try searching by customer_id (UUID) OR by customer_name (Fallback)
      let { data: ordersData, error: ordersError } = await supabase
        .from("orders")
        .select("id, created_at, total_price, items, status, customer_name")
        .eq("customer_id", id) 
        .order("created_at", { ascending: false });

      // FALLBACK: If no orders found by UUID, try matching by name (helps with older data)
      if (!ordersData || ordersData.length === 0) {
        const { data: fallbackData } = await supabase
          .from("orders")
          .select("id, created_at, total_price, items, status, customer_name")
          .eq("customer_name", customerData.customer_name)
          .order("created_at", { ascending: false });
        
        if (fallbackData) ordersData = fallbackData;
      }

      if (ordersError) console.error("Orders Fetch Error:", ordersError);

      setCustomer(customerData);
      setOrders(ordersData || []);
    } catch (err) {
      console.error("Unexpected Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const displayTotalSpent = useMemo(() => {
    if (orders.length > 0) {
      return orders.reduce((sum, o) => sum + Number(o.total_price || 0), 0);
    }
    return Number(customer?.total_spend || 0);
  }, [customer, orders]);

  const displayTotalOrders = useMemo(() => {
    return orders.length > 0 ? orders.length : Number(customer?.total_orders || 0);
  }, [customer, orders]);

  const filteredOrders = useMemo(() => {
    return orders.filter(o =>
      !searchTerm || o.id.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [orders, searchTerm]);

  /* =========================
      PROFESSIONAL PRINT
  ========================= */
  const handlePrintSummary = () => {
    const printWindow = window.open("", "_blank", "width=900,height=900");
    const orderRows = orders.map((o, i) => `
      <tr style="border-bottom: 1px solid #eee;">
        <td style="padding: 12px; text-align: center;">${i + 1}</td>
        <td style="padding: 12px;">${new Date(o.created_at).toLocaleDateString('en-IN')}</td>
        <td style="padding: 12px; font-family: monospace;">#${o.id.slice(0, 8).toUpperCase()}</td>
        <td style="padding: 12px;">${o.items || 'N/A'}</td>
        <td style="padding: 12px; text-align: right; font-weight: bold;">₹${Number(o.total_price || 0).toLocaleString('en-IN')}</td>
      </tr>
    `).join("");

    const html = `
      <html>
        <head>
          <title>Statement - ${customer?.customer_name}</title>
          <style>
            body { font-family: 'Segoe UI', sans-serif; padding: 30px; color: #333; }
            .header-container { display: flex; justify-content: space-between; border-bottom: 3px solid #1e3a8a; padding-bottom: 15px; margin-bottom: 25px; }
            .company-info h1 { margin: 0; color: #1e3a8a; text-transform: uppercase; }
            table { width: 100%; border-collapse: collapse; }
            th { background: #1e3a8a; color: white; padding: 12px; text-align: left; font-size: 11px; text-transform: uppercase; }
            .footer-total { margin-top: 25px; text-align: right; font-size: 20px; font-weight: 800; border-top: 2px solid #1e3a8a; padding: 15px; color: #1e3a8a; }
          </style>
        </head>
        <body>
          <div class="header-container">
            <div class="company-info">
              <h1>Hygienic & Comfort Co.</h1>
              <p>Account Statement Summary</p>
            </div>
            <div style="text-align: right">
              <h2>STATEMENT</h2>
              <p>Date: ${new Date().toLocaleDateString('en-IN')}</p>
            </div>
          </div>
          <div style="margin-bottom: 20px;">
            <strong>Customer:</strong> ${customer?.customer_name}<br>
            <strong>Phone:</strong> ${customer?.phone}
          </div>
          <table>
            <thead>
              <tr><th>#</th><th>Date</th><th>Order Ref</th><th>Items</th><th style="text-align: right">Amount</th></tr>
            </thead>
            <tbody>${orderRows}</tbody>
          </table>
          <div class="footer-total">Total Spent: ₹${displayTotalSpent.toLocaleString('en-IN')}</div>
        </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = () => { printWindow.print(); };
  };

  if (loading) return (
    <AdminLayout>
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-white text-xl font-black uppercase tracking-widest animate-pulse">
          Loading Data...
        </div>
      </div>
    </AdminLayout>
  );

  return (
    <AdminLayout>
      <div className="px-4">
        <div className="flex justify-between items-center mb-8">
          <Link to="/customers" className="text-blue-400 font-bold flex items-center gap-2 hover:text-blue-300 transition-all">
            <MdArrowBack /> Back to Customers
          </Link>
          <button
            onClick={handlePrintSummary}
            className="bg-blue-600 text-white px-6 py-2 rounded-xl font-black flex items-center gap-2 hover:bg-blue-700 transition-colors shadow-lg"
          >
            <MdPrint /> Print Statement
          </button>
        </div>

        {/* Profile Card */}
        <div className="bg-white rounded-[40px] p-10 shadow-2xl mb-10 border border-slate-100 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5">
             <MdReceiptLong size={180} />
          </div>
          
          <div className="relative z-10">
            <h2 className="text-5xl font-black text-slate-900 tracking-tighter mb-2">{customer.customer_name}</h2>
            <p className="text-slate-500 font-bold text-xl mb-10">{customer.phone}</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-slate-50 p-8 rounded-[32px] border border-slate-100 flex flex-col justify-center">
                <p className="text-xs uppercase font-black text-slate-400 tracking-widest mb-2">Lifetime Orders</p>
                <p className="text-5xl font-black text-slate-900">{displayTotalOrders}</p>
              </div>
              <div className="bg-blue-600 p-8 rounded-[32px] text-white shadow-2xl flex flex-col justify-center">
                <p className="text-xs uppercase font-black text-blue-100 tracking-widest mb-2">Total Spent</p>
                <p className="text-5xl font-black">₹{displayTotalSpent.toLocaleString('en-IN')}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Order History Table */}
        <div className="bg-white rounded-[40px] shadow-2xl overflow-hidden border border-slate-100 mb-20">
          <div className="p-8 flex flex-col lg:flex-row justify-between items-center bg-slate-50 border-b gap-6">
            <div className="flex items-center gap-4">
              <MdHistory size={32} className="text-blue-600" />
              <h3 className="font-black text-slate-800 text-2xl uppercase tracking-tight">Ledger / History</h3>
            </div>
            <div className="relative w-full lg:w-96">
              <MdSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl" />
              <input
                placeholder="Search Reference ID..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-6 py-4 rounded-2xl border-2 border-slate-100 font-bold focus:outline-none focus:border-blue-500 transition-all text-slate-700"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead className="bg-slate-50 text-[11px] uppercase font-black text-slate-400 tracking-widest">
                <tr>
                  <th className="p-6 text-left border-b">Placement Date</th>
                  <th className="p-6 text-left border-b">Ordered Items</th>
                  <th className="p-6 text-left border-b">Reference ID</th>
                  <th className="p-6 text-center border-b">Status</th>
                  <th className="p-6 text-right border-b">Grand Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="p-32 text-center">
                      <div className="flex flex-col items-center gap-4 opacity-30">
                        <MdHistory size={80} />
                        <p className="font-black text-2xl uppercase tracking-widest">No Records Found</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map(o => (
                    <tr key={o.id} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="p-6 whitespace-nowrap">
                        <div className="font-black text-slate-900">{new Date(o.created_at).toLocaleDateString('en-IN')}</div>
                        <div className="text-[11px] text-slate-400 font-bold uppercase">{new Date(o.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                      </td>
                      <td className="p-6">
                        <div className="text-sm font-bold text-slate-700 max-w-sm leading-relaxed">
                           {o.items || <span className="text-slate-300 italic">No details</span>}
                        </div>
                      </td>
                      <td className="p-6">
                         <code className="text-xs bg-slate-100 px-3 py-1.5 rounded-lg text-slate-500 font-mono font-bold">
                            #{o.id.toString().toUpperCase().slice(0, 12)}...
                         </code>
                      </td>
                      <td className="p-6 text-center">
                        <span className={`inline-block px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest ${
                          o.status === 'Delivered' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {o.status || 'NEW'}
                        </span>
                      </td>
                      <td className="p-6 text-right">
                        <div className="text-2xl font-black text-slate-900">
                           ₹{Number(o.total_price || 0).toLocaleString('en-IN')}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

export default CustomerProfile;