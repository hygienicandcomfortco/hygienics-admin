import { useState, useRef, useEffect } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { 
  MdLogout, MdErrorOutline, MdDashboard, MdInventory, 
  MdShoppingCart, MdPeople, MdPerson, MdSettings, MdShield 
} from "react-icons/md";
import logo from "../assets/logo.png";
import { supabase } from "../utils/supabase"; // Path updated to match your explorer

function AdminLayout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [liveOrderAlert, setLiveOrderAlert] = useState(null);
  const menuRef = useRef(null);
  const seenOrderIdsRef = useRef(new Set());
  const alertTimeoutRef = useRef(null);

  /* =======================
      USER DATA (Dynamic)
  ======================= */
  // Pulling exactly what was stored during login to prevent "Main Admin" default
  const userName = localStorage.getItem("userName") || "Admin User";
  const userRole = localStorage.getItem("userRole") || "Staff"; 
  
  const getInitials = (name) => {
    return name
      .split(" ")
      .filter(Boolean)
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2); 
  };

  const userInitials = getInitials(userName);

  const showLiveOrderAlert = (order) => {
    if (alertTimeoutRef.current) {
      clearTimeout(alertTimeoutRef.current);
    }

    setLiveOrderAlert({
      id: order?.id,
      customer: order?.customer_name || "Walk-in Customer",
      total: Number(order?.total_price || 0).toLocaleString("en-IN"),
    });

    alertTimeoutRef.current = setTimeout(() => {
      setLiveOrderAlert(null);
    }, 8000);
  };

  /* =======================
      REAL-TIME NOTIFICATIONS
  ======================= */
  useEffect(() => {
    // 1. Request permission when notifications are supported
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }

    // 2. Setup subscription for order alerts
    const orderChannel = supabase
      .channel("admin-order-alerts")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders" },
        (payload) => {
          const order = payload?.new || {};
          const orderId = order?.id;
          if (orderId && seenOrderIdsRef.current.has(orderId)) return;
          if (orderId) seenOrderIdsRef.current.add(orderId);

          showLiveOrderAlert(order);

          // Mobile haptic feedback on supported devices
          if ("vibrate" in navigator) {
            navigator.vibrate([120, 80, 120]);
          }

          // Play alert sound
          const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3");
          audio.play().catch(() => console.log("Sound alert ready. Click dashboard once to enable."));

          // Browser notification
          if ("Notification" in window && Notification.permission === "granted") {
            new Notification("New Order Received", {
              body: `Customer: ${order.customer_name || "Walk-in Customer"}\nTotal: Rs ${Number(order.total_price || 0).toLocaleString("en-IN")}`,
              icon: logo,
            });
          }
        }
      )
      .subscribe();

    return () => {
      if (alertTimeoutRef.current) {
        clearTimeout(alertTimeoutRef.current);
      }
      supabase.removeChannel(orderChannel);
    };
  }, [logo]);
  /* =======================
      CLICK OUTSIDE LOGIC
  ======================= */
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleFinalLogout = async () => {
    await supabase.auth.signOut();
    localStorage.clear();
    sessionStorage.clear();
    setShowLogoutConfirm(false);
    navigate("/login");
  };

  const isActive = (path) => location.pathname === path;

  return (
    <div className="flex h-screen bg-[#f8fafc] dark:bg-[#0b1220] transition-colors duration-300 relative overflow-hidden">
      
      {/* Background Decor */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-600/10 dark:bg-blue-900/30 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[10%] w-[30%] h-[30%] rounded-full bg-indigo-600/10 dark:bg-indigo-900/30 blur-[100px] pointer-events-none" />

      {/* SIDEBAR */}
      <aside className="w-64 bg-white/80 dark:bg-[#0f172a]/70 backdrop-blur-md text-slate-600 dark:text-slate-300 p-6 flex flex-col border-r border-slate-200 dark:border-slate-800 z-20 transition-colors">
        <div className="flex items-center gap-3 mb-10">
          <Link to="/dashboard" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl overflow-hidden shadow-lg cursor-pointer">
              <img src={logo} alt="H&C Logo" className="w-full h-full object-contain" />
            </div>
          </Link>
          <h1 className="text-slate-900 dark:text-white text-lg font-black tracking-tight uppercase">Admin Panel</h1>
        </div>
        
        <nav className="flex-1 space-y-2 font-bold text-sm">
          <Link to="/dashboard" className={`flex items-center gap-3 p-4 rounded-xl transition-all ${isActive("/dashboard") ? "bg-blue-50 text-blue-700 dark:bg-blue-600/20 dark:text-blue-300" : "hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white"}`}>
            <MdDashboard size={22}/> Dashboard
          </Link>
          <Link to="/products" className={`flex items-center gap-3 p-4 rounded-xl transition-all ${isActive("/products") ? "bg-blue-50 text-blue-700 dark:bg-blue-600/20 dark:text-blue-300" : "hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white"}`}>
            <MdInventory size={22}/> Products
          </Link>
          <Link to="/orders" className={`flex items-center gap-3 p-4 rounded-xl transition-all ${isActive("/orders") ? "bg-blue-50 text-blue-700 dark:bg-blue-600/20 dark:text-blue-300" : "hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white"}`}>
            <MdShoppingCart size={22}/> Orders
          </Link>
          <Link to="/customers" className={`flex items-center gap-3 p-4 rounded-xl transition-all ${isActive("/customers") ? "bg-blue-50 text-blue-700 dark:bg-blue-600/20 dark:text-blue-300" : "hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white"}`}>
            <MdPeople size={22} /> Customers
          </Link>
        </nav>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 overflow-y-auto relative z-10 flex flex-col">
        {liveOrderAlert && (
          <div className="fixed top-4 left-4 right-4 sm:left-auto sm:w-[360px] sm:right-6 z-[1200]">
            <Link
              to="/orders"
              className="block rounded-2xl border border-emerald-300/40 bg-emerald-500 text-white shadow-2xl px-4 py-3"
              onClick={() => setLiveOrderAlert(null)}
            >
              <p className="text-[10px] font-black uppercase tracking-widest opacity-90">New Order Alert</p>
              <p className="text-sm font-black leading-tight mt-1">{liveOrderAlert.customer}</p>
              <p className="text-xs font-bold mt-1">Total: Rs {liveOrderAlert.total}</p>
              <p className="text-[10px] font-black uppercase tracking-wide mt-2 opacity-90">Tap to open Orders</p>
            </Link>
          </div>
        )}

        <header className="flex justify-between items-center p-8 bg-white/70 dark:bg-[#0b1220]/80 backdrop-blur-sm transition-colors relative z-[50] border-b border-slate-100 dark:border-slate-800">
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-blue-600 dark:text-blue-300 uppercase tracking-[0.2em] mb-1">System Management</span>
              <h2 className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase">Dashboard {location.pathname.replace('/', ' / ')}</h2>
            </div>

            <div className="relative" ref={menuRef}>
               <button 
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="w-10 h-10 rounded-xl bg-blue-600 border border-blue-400 flex items-center justify-center text-white text-xs font-black shadow-lg shadow-blue-900/40 hover:scale-105 active:scale-95 transition-all"
               >
                {userInitials}
               </button>

               {showProfileMenu && (
                <div className="absolute right-0 mt-3 w-64 bg-white dark:bg-[#0f172a] rounded-[32px] shadow-2xl border border-slate-100 dark:border-slate-800 p-2 z-[100] animate-in fade-in zoom-in-95 duration-200 origin-top-right">
                  <div className="p-5 border-b border-slate-50 dark:border-slate-800">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300 flex items-center justify-center font-black">
                          {userInitials}
                        </div>
                        <div className="flex flex-col">
                            <span className="text-slate-900 dark:text-white font-black text-sm leading-none">{userName}</span>
                            <span className="text-slate-400 dark:text-slate-500 text-[10px] font-bold mt-1 uppercase tracking-tighter">
                              {userRole}
                            </span>
                        </div>
                    </div>
                  </div>
                  
                  <div className="p-2 space-y-1">
                    <Link to="/profile" onClick={() => setShowProfileMenu(false)} className="w-full flex items-center gap-3 p-3 rounded-2xl text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors font-bold text-xs uppercase tracking-tight">
                      <MdPerson size={20} className="text-slate-400 dark:text-slate-500" /> My Profile
                    </Link>
                    <Link to="/settings" onClick={() => setShowProfileMenu(false)} className="w-full flex items-center gap-3 p-3 rounded-2xl text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors font-bold text-xs uppercase tracking-tight">
                      <MdSettings size={20} className="text-slate-400 dark:text-slate-500" /> Settings
                    </Link>
                    <div className="h-px bg-slate-50 dark:bg-slate-800 my-1 mx-2" />
                    <button onClick={() => { setShowProfileMenu(false); setShowLogoutConfirm(true); }} className="w-full flex items-center gap-3 p-3 rounded-2xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 transition-colors font-bold text-xs uppercase tracking-tight">
                      <MdLogout size={20} /> Sign Out
                    </button>
                  </div>
                </div>
               )}
            </div>
        </header>

        <div className="px-8 pb-10 flex-1">{children}</div>
      </main>

      {/* LOGOUT CONFIRMATION MODAL */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center z-[1000] p-4">
          <div className="bg-white dark:bg-[#0f172a] w-full max-w-sm rounded-[40px] p-10 shadow-2xl border border-slate-100 dark:border-slate-800 animate-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center">
              <div className="w-20 h-20 bg-rose-50 text-rose-500 dark:bg-rose-900/30 rounded-full flex items-center justify-center mb-6 ring-8 ring-rose-50/50">
                <MdErrorOutline size={40} />
              </div>
              <h3 className="text-2xl font-black text-slate-800 dark:text-white mb-2 tracking-tighter uppercase">End Session?</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-10 leading-relaxed">Are You Sure you want to Logout.</p>
              <div className="flex flex-col w-full gap-3">
                <button onClick={handleFinalLogout} className="w-full bg-slate-900 dark:bg-blue-600 text-white py-5 rounded-[24px] font-black uppercase tracking-widest text-[10px] hover:bg-rose-600 transition-all shadow-xl">Yes, Log Me Out</button>
                <button onClick={() => setShowLogoutConfirm(false)} className="w-full bg-white dark:bg-slate-900 text-slate-400 dark:text-slate-500 py-4 rounded-[20px] font-black uppercase tracking-widest text-[10px] hover:text-slate-600 transition-colors">Stay Logged In</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminLayout;

