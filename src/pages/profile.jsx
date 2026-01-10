import { useState, useEffect } from "react";
import AdminLayout from "../components/AdminLayout";
import { MdPerson, MdEmail, MdShield, MdUpdate, MdBadge } from "react-icons/md";
import { supabase } from "../lib/supabase";

function Profile() {
  const [user, setUser] = useState({
    name: localStorage.getItem("userName") || "Staff Member",
    role: localStorage.getItem("userRole") || "Staff",
    email: "",
    empId: "" // Added field for dynamic ID
  });
  const [loading, setLoading] = useState(true);

  /* =======================
      FETCH BACKEND DATA
  ======================= */
  useEffect(() => {
    async function getProfile() {
      setLoading(true);
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

      if (authError) {
        console.error("Auth Error:", authError.message);
      } else if (authUser) {
        // FETCH DYNAMIC ID FROM PROFILES TABLE
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('employee_id, role')
          .eq('id', authUser.id)
          .single();

        setUser(prev => ({
          ...prev,
          email: authUser.email,
          name: authUser.user_metadata?.full_name || prev.name,
          // Use the ID from DB or fallback to placeholder
          empId: profileData?.employee_id || "NOT SET" 
        }));
        
        localStorage.setItem("userEmail", authUser.email);
      }
      setLoading(false);
    }
    getProfile();
  }, []);

  /* =======================
      HANDLERS
  ======================= */
  const handlePasswordReset = async () => {
    if (!user.email) {
      alert("Error: User email not found.");
      return;
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        // IMPORTANT: redirectTo must be added to Supabase Redirect URLs
        redirectTo: `${window.location.origin}/profile`, 
      });

      if (error) throw error;
      
      alert(`A secure password reset link has been sent to: ${user.email}`);
    } catch (err) {
      console.error("Reset failed:", err);
      alert("Failed to send reset link: " + err.message);
    }
  };

  return (
    <AdminLayout>
      <div className="mb-8 px-4">
        <h2 className="text-3xl font-black text-white uppercase tracking-tight">Account Profile</h2>
        <p className="text-slate-400 text-sm font-bold uppercase tracking-widest mt-1">Manage your identity and security</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 px-4">
        {/* Left Card: Identity */}
        <div className="bg-white rounded-[40px] p-10 shadow-2xl border border-slate-100 flex flex-col items-center text-center">
          <div className="w-32 h-32 bg-blue-600 rounded-full flex items-center justify-center text-white text-4xl font-black mb-6 shadow-xl shadow-blue-200">
            {user.name.split(" ").map(n => n[0]).join("").toUpperCase()}
          </div>
          <h3 className="text-2xl font-black text-slate-900">{user.name}</h3>
          <span className="bg-blue-50 text-blue-600 px-4 py-1 rounded-full text-[10px] font-black uppercase mt-2 border border-blue-100">
            {user.role}
          </span>
          
          <div className="w-full mt-10 space-y-4 border-t pt-8">
            <div className="flex items-center gap-4 text-left">
              <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400"><MdEmail size={20} /></div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase">Email Address</p>
                <p className="font-bold text-slate-700 truncate max-w-[180px]">
                  {loading ? "Fetching..." : user.email || "No Email Found"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4 text-left">
              <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400"><MdShield size={20} /></div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase">Security Level</p>
                <p className="font-bold text-slate-700">Encrypted Session</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Card: Activity & Permissions */}
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white rounded-[40px] p-10 shadow-2xl border border-slate-100">
            <h4 className="text-lg font-black text-slate-900 uppercase mb-6 flex items-center gap-2">
              <MdBadge className="text-blue-600" /> Professional ID
            </h4>
            <div className="grid grid-cols-2 gap-6">
              <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                <p className="text-[10px] font-black text-slate-400 uppercase">Employee ID</p>
                {/* DYNAMIC ID DISPLAY */}
                <p className="font-black text-xl text-slate-900 mt-1 uppercase tracking-tighter">
                    {loading ? "..." : user.empId}
                </p>
              </div>
              <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                <p className="text-[10px] font-black text-slate-400 uppercase">Access Level</p>
                <p className="font-black text-xl text-slate-900 mt-1 uppercase">{user.role}</p>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 rounded-[40px] p-10 shadow-2xl text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 p-10 opacity-10">
                <MdUpdate size={120} />
            </div>
            <h4 className="text-lg font-black uppercase mb-4 relative z-10">Session Info</h4>
            <p className="text-slate-400 text-sm font-bold relative z-10 mb-6">
                Last Login: {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}
            </p>
            <button 
              onClick={handlePasswordReset}
              disabled={loading}
              className={`bg-blue-600 px-8 py-4 rounded-2xl font-black uppercase text-xs transition-all relative z-10 shadow-lg shadow-blue-900 ${loading ? 'opacity-50' : 'hover:bg-blue-500 hover:scale-105 active:scale-95'}`}
            >
              {loading ? "Processing..." : "Reset Credentials"}
            </button>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

export default Profile;