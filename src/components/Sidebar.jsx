import { Link, useLocation } from "react-router-dom";
import { useState } from "react";
import { 
  MdDashboard, 
  MdInventory, 
  MdShoppingCart, 
  MdPeople, 
  MdLogout, 
  MdErrorOutline 
} from "react-icons/md";
// Import your actual logo from the assets folder
import logo from "../assets/logo.png";

function Sidebar() {
  const location = useLocation();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Function to determine if a link is currently active
  const isActive = (path) => location.pathname === path;

  const handleFinalLogout = () => {
    // 1. Remove only authentication data (preserves your products/categories)
    localStorage.removeItem("isLoggedIn");
    sessionStorage.removeItem("isLoggedIn");
    
    // 2. Clear modal
    setShowLogoutConfirm(false);
    
    // 3. FORCE REFRESH to Login page
    // This is the primary fix for the "white screen" issue
    window.location.href = "/#/login";
  };

  return (
    <>
      <aside className="w-64 bg-[#0f172a]/50 backdrop-blur-xl text-slate-400 p-6 flex flex-col border-r border-slate-800 z-20">
        {/* LOGO SECTION */}
        <div className="flex items-center gap-3 mb-10">
          <img 
            src={logo} 
            alt="H&C Logo" 
            className="w-10 h-10 object-contain shadow-lg rounded-lg" 
          />
          <div>
            <h1 className="text-white text-lg font-black tracking-tight uppercase leading-none">
              Admin Panel
            </h1>
            <p className="text-[8px] text-slate-500 font-bold tracking-widest uppercase mt-1">
              Hygienics & Comfort
            </p>
          </div>
        </div>
        
        {/* NAVIGATION LINKS */}
        <nav className="flex-1 space-y-2 font-bold text-sm">
          <Link 
            to="/dashboard" 
            className={`flex items-center gap-3 p-4 rounded-xl transition-all ${
              isActive("/dashboard") ? "bg-blue-600/10 text-blue-400 shadow-inner" : "hover:bg-slate-800/50 hover:text-white"
            }`}
          >
            <MdDashboard size={22}/> Dashboard
          </Link>

          <Link 
            to="/products" 
            className={`flex items-center gap-3 p-4 rounded-xl transition-all ${
              isActive("/products") ? "bg-blue-600/10 text-blue-400 shadow-inner" : "hover:bg-slate-800/50 hover:text-white"
            }`}
          >
            <MdInventory size={22}/> Products
          </Link>

          <Link 
            to="/orders" 
            className={`flex items-center gap-3 p-4 rounded-xl transition-all ${
              isActive("/orders") ? "bg-blue-600/10 text-blue-400 shadow-inner" : "hover:bg-slate-800/50 hover:text-white"
            }`}
          >
            <MdShoppingCart size={22}/> Orders
          </Link>

          <Link 
            to="/customers" 
            className={`flex items-center gap-3 p-4 rounded-xl transition-all ${
              isActive("/customers") ? "bg-blue-600/10 text-blue-400 shadow-inner" : "hover:bg-slate-800/50 hover:text-white"
            }`}
          >
            <MdPeople size={22}/> Customers
          </Link>
        </nav>
        
        {/* LOGOUT BUTTON */}
        <button 
          onClick={() => setShowLogoutConfirm(true)}
          className="flex items-center gap-3 p-4 bg-slate-900/50 text-slate-300 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-rose-500 hover:text-white transition-all border border-slate-800 mt-auto shadow-2xl active:scale-95"
        >
          <MdLogout size={18} /> Logout Session
        </button>
      </aside>

      {/* LOGOUT CONFIRMATION MODAL */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[1000] p-4">
          <div className="bg-white w-full max-w-sm rounded-[40px] p-10 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center">
              <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mb-6 ring-8 ring-rose-50/50">
                <MdErrorOutline size={40} />
              </div>
              <h3 className="text-2xl font-black text-slate-800 mb-2 uppercase tracking-tighter">
                End Session?
              </h3>
              <p className="text-slate-500 text-sm font-medium mb-10 leading-relaxed">
                Your data is safe. You will need to login again to manage your inventory.
              </p>
              <div className="flex flex-col w-full gap-3">
                <button 
                  onClick={handleFinalLogout}
                  className="w-full bg-slate-900 text-white py-5 rounded-[24px] font-black uppercase tracking-widest text-[10px] hover:bg-rose-600 transition-all shadow-xl"
                >
                  Yes, Log Me Out
                </button>
                <button 
                  onClick={() => setShowLogoutConfirm(false)}
                  className="w-full bg-slate-100 text-slate-400 py-4 rounded-[20px] font-black uppercase tracking-widest text-[10px] hover:text-slate-600 transition-colors"
                >
                  Stay Logged In
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default Sidebar;
