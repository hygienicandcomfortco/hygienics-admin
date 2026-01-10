import { useState } from "react";
import AdminLayout from "../components/AdminLayout";
import { MdSettings, MdDarkMode, MdLightMode, MdStore, MdLocationOn, MdPhone } from "react-icons/md";

function Settings({ isDark, setIsDark }) {
  const [shopInfo, setShopInfo] = useState({
    name: "Hygienic & Comfort Co.",
    address: "Shop no.1, Bhausaheb Paranjape Chawl, Ambernath East",
    phone: "9307760665"
  });

  return (
    <AdminLayout>
      <div className="mb-8 px-4">
        <h2 className="text-3xl font-black text-white uppercase tracking-tight">System Settings</h2>
        <p className="text-slate-400 text-sm font-bold uppercase tracking-widest mt-1">Configure your workspace preference</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 px-4">
        
        {/* THEME CONFIGURATION */}
        <div className="bg-white dark:bg-slate-800 rounded-[40px] p-10 shadow-2xl border border-slate-100 dark:border-slate-700 transition-colors">
          <h4 className="text-lg font-black text-slate-900 dark:text-white uppercase mb-8 flex items-center gap-2">
            <MdDarkMode className="text-blue-600" /> Appearance
          </h4>
          
          <div className="flex items-center justify-between p-6 bg-slate-50 dark:bg-slate-900/50 rounded-3xl border border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center text-blue-600">
                {isDark ? <MdDarkMode size={24} /> : <MdLightMode size={24} />}
              </div>
              <div>
                <p className="font-black text-slate-800 dark:text-white text-sm">Dark Mode</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase">Reduce eye strain at night</p>
              </div>
            </div>

            {/* TOGGLE SWITCH */}
            <button 
              onClick={() => setIsDark(!isDark)}
              className={`w-14 h-8 rounded-full p-1 transition-all duration-300 ${isDark ? 'bg-blue-600' : 'bg-slate-300'}`}
            >
              <div className={`w-6 h-6 bg-white rounded-full shadow-md transform transition-transform duration-300 ${isDark ? 'translate-x-6' : 'translate-x-0'}`} />
            </button>
          </div>
        </div>

        {/* SHOP INFORMATION */}
        <div className="bg-white dark:bg-slate-800 rounded-[40px] p-10 shadow-2xl border border-slate-100 dark:border-slate-700 transition-colors">
          <h4 className="text-lg font-black text-slate-900 dark:text-white uppercase mb-8 flex items-center gap-2">
            <MdStore className="text-blue-600" /> Store Profile
          </h4>
          
          <div className="space-y-4">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Shop Name</label>
              <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-700">
                <MdStore className="text-slate-400" />
                <input className="bg-transparent border-none outline-none font-bold text-slate-700 dark:text-slate-200 w-full" value={shopInfo.name} disabled />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Phone</label>
              <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-700">
                <MdPhone className="text-slate-400" />
                <input className="bg-transparent border-none outline-none font-bold text-slate-700 dark:text-slate-200 w-full" value={shopInfo.phone} disabled />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Location</label>
              <div className="flex items-start gap-3 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-700">
                <MdLocationOn className="text-slate-400 mt-1" />
                <textarea className="bg-transparent border-none outline-none font-bold text-slate-700 dark:text-slate-200 w-full h-20 resize-none" value={shopInfo.address} disabled />
              </div>
            </div>
          </div>
        </div>

      </div>
    </AdminLayout>
  );
}

export default Settings;