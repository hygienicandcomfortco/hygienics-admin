import { useState, useEffect } from "react";
import { Link } from "react-router-dom"; 
import AdminLayout from "../components/AdminLayout";
import { supabase } from "../lib/supabase"; 
import { 
  MdInventory, 
  MdWarning, 
  MdAttachMoney, 
  MdTrendingUp, 
  MdShoppingCart,
  MdHistory,
  MdFiberManualRecord
} from "react-icons/md";

function Dashboard() {
  // 1. DETERMINE USER ROLE FROM LOCALSTORAGE
  const userRole = localStorage.getItem("userRole")?.toUpperCase() || "STAFF";
  const isAdmin = userRole === "ADMIN" || userRole === "SUPER ADMIN";

  const [stats, setStats] = useState({
    totalProducts: 0,
    lowStockCount: 0,
    inventoryValue: 0,
    totalOrders: 0,
    revenue: 0
  });
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const { data: products } = await supabase.from("products").select("*");
      const { data: orders } = await supabase
        .from("orders")
        .select("*, customers(customer_name)")
        .order("created_at", { ascending: false });

      if (products && orders) {
        // Calculation logic for total stock value
        const totalVal = products.reduce((acc, p) => {
            const price = Number(p.purchase_price || p.purchasePrice || 0);
            const qty = Number(p.stock || 0);
            return acc + (price * qty);
        }, 0);

        const lowStock = products.filter(p => Number(p.stock) <= 5).length;
        const totalRev = orders.reduce((acc, o) => acc + Number(o.total || 0), 0);

        setStats({
          totalProducts: products.length,
          lowStockCount: lowStock,
          inventoryValue: totalVal,
          totalOrders: orders.length,
          revenue: totalRev
        });

        setActivities(orders.slice(0, 5));
      }
    } catch (err) {
      console.error("Dashboard Sync Error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const channel = supabase
      .channel('db-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, () => fetchDashboardData())
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  // 2. CONFIGURE CARDS WITH CONDITIONAL VALUE MASKING
  const statCards = [
    { title: "Total Inventory", value: stats.totalProducts, icon: <MdInventory size={24} />, color: "text-blue-600", bg: "bg-blue-50", label: "Unique Items" },
    { title: "Stock Alerts", value: stats.lowStockCount, icon: <MdWarning size={24} />, color: "text-rose-600", bg: "bg-rose-50", label: "Needs Restocking", pulse: stats.lowStockCount > 0 },
    { 
      title: "Stock Value", 
      value: isAdmin ? `₹${stats.inventoryValue.toLocaleString('en-IN')}` : "₹ **** ", 
      icon: <MdAttachMoney size={24} />, 
      color: "text-emerald-600", 
      bg: "bg-emerald-50", 
      label: "Assets Valuation",
      masked: !isAdmin 
    },
    { 
      title: "Sales Revenue", 
      value: isAdmin ? `₹${stats.revenue.toLocaleString('en-IN')}` : "₹ **** ", 
      icon: <MdTrendingUp size={24} />, 
      color: "text-amber-600", 
      bg: "bg-amber-50", 
      label: "Lifetime Total",
      masked: !isAdmin
    }
  ];

  return (
    <AdminLayout>
      <div className="mb-10 px-4 flex justify-between items-end">
        <div>
          <h2 className="text-4xl font-black text-white tracking-tight uppercase">Dashboard</h2>
          <div className="flex items-center gap-2 mt-2">
            <MdFiberManualRecord className="text-emerald-500 animate-pulse" />
            <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Live • Hygienic & Comfort CO. Cloud Connected</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 px-4 mb-10">
        {statCards.map((card, idx) => (
          <div key={idx} className="bg-white p-8 rounded-[40px] shadow-2xl border border-slate-100 transition-all duration-300">
            <div className="flex justify-between items-start mb-6">
              <div className={`${card.bg} ${card.color} w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg`}>{card.icon}</div>
              {card.pulse && (
                <span className="flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
                </span>
              )}
            </div>
            <div className="space-y-1">
              <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">{card.title}</p>
              {/* DISPLAY MASKED TEXT WITH LOWER OPACITY FOR STAFF */}
              <h3 className={`text-3xl font-black text-slate-900 tracking-tighter ${card.masked ? 'opacity-40 tracking-[0.2em]' : ''}`}>
                {loading ? "..." : card.value}
              </h3>
              <p className="text-slate-400 text-[10px] font-bold uppercase">{card.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="px-4 pb-10">
        <div className="bg-slate-900/40 backdrop-blur-xl rounded-[40px] border border-white/10 p-10 shadow-2xl">
          <div className="flex justify-between items-center mb-10">
            <h3 className="text-white text-xl font-black uppercase tracking-tight flex items-center gap-3">
              <MdHistory className="text-blue-500" size={28} /> Recent Web Activity
            </h3>
            <Link to="/orders" className="text-blue-400 text-xs font-black uppercase tracking-widest hover:text-blue-300">View All Logs</Link>
          </div>
          
          <div className="grid grid-cols-1 gap-4">
            {activities.length > 0 ? activities.map((order) => (
              <Link 
                key={order.id} 
                to="/orders" 
                className="flex items-center gap-5 p-5 rounded-3xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all cursor-pointer group"
              >
                <div className="w-12 h-12 rounded-2xl bg-blue-500/20 text-blue-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <MdShoppingCart size={24} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-white font-black text-sm">New Order #{order.id.toString().split('-')[0].toUpperCase()}</p>
                    <span className="text-[10px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full font-bold uppercase tracking-tighter opacity-0 group-hover:opacity-100 transition-opacity">
                      Open Manager
                    </span>
                  </div>
                  <p className="text-slate-500 text-[10px] font-black uppercase mt-1">
                    Customer: {order.customers?.customer_name || 'Walk-in'} • Amount: {isAdmin ? `₹${order.total}` : "₹ ****"}
                  </p>
                </div>
                <span className="text-slate-600 text-[10px] font-black uppercase">
                    {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </Link>
            )) : <p className="text-slate-500 font-bold text-center py-10">No recent activity detected.</p>}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

export default Dashboard;