import { useState } from "react";
import { supabase } from "../lib/supabase"; 
import { Eye, EyeOff, Lock, Mail, Loader2, ShieldCheck } from "lucide-react";

function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    const email = e.target.email.value;
    const password = e.target.password.value;

    try {
      // 1. Authenticate with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;

      // 2. Fetch the specific role for this user from your 'profiles' table
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role, full_name")
        .eq("id", authData.user.id)
        .single();

      if (profileError) {
        // Fallback if profile doesn't exist yet: sign out and show error
        await supabase.auth.signOut();
        throw new Error("User profile not found. Please contact admin.");
      }

      // 3. Store session metadata in localStorage
      localStorage.setItem("userRole", profile.role);
      localStorage.setItem("userName", profile.full_name || "Staff Member");
      localStorage.setItem("isLoggedIn", "true");

      // 4. Role-Based Redirection
      // window.location.href is used to ensure a clean state load
      if (profile.role === "admin") {
        window.location.href = "/dashboard";
      } else {
        // Staff members go directly to the Orders terminal
        window.location.href = "/orders"; 
      }

    } catch (err) {
      // Handle standard Supabase errors or custom profile errors
      setError(err.message || "Invalid email or password");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f172a] fixed inset-0 z-[9999]">
      <div className="w-full max-w-md px-6">
        <div className="bg-white p-10 rounded-[40px] shadow-2xl">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-blue-100">
              <ShieldCheck className="text-white w-10 h-10" />
            </div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Admin Login</h2>
            <p className="text-slate-400 text-xs font-black uppercase tracking-[0.2em] mt-2">Hygienic & Comfort Co.</p>
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 text-[10px] font-black text-center uppercase tracking-widest leading-relaxed">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input 
                name="email" 
                type="email" 
                placeholder="Email" 
                required 
                className="w-full h-14 bg-slate-50 border-2 border-slate-100 pl-12 pr-4 rounded-2xl focus:border-blue-500 outline-none font-bold text-slate-900 transition-all placeholder:text-slate-300" 
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input 
                name="password" 
                type={showPassword ? "text" : "password"} 
                placeholder="Password" 
                required 
                className="w-full h-14 bg-slate-50 border-2 border-slate-100 pl-12 pr-12 rounded-2xl focus:border-blue-500 outline-none font-bold text-slate-900 transition-all placeholder:text-slate-300" 
              />
              <button 
                type="button" 
                onClick={() => setShowPassword(!showPassword)} 
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>

            <button 
              type="submit" 
              disabled={isLoading} 
              className="w-full bg-slate-900 text-white h-16 rounded-2xl font-black uppercase tracking-[0.2em] text-xs hover:bg-black transition-all shadow-xl shadow-slate-100 active:scale-[0.98] disabled:opacity-70 disabled:active:scale-100"
            >
              {isLoading ? (
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="animate-spin w-5 h-5" />
                  <span>Verifying...</span>
                </div>
              ) : "Authorize Session"}
            </button>
          </form>
        </div>
        
        <p className="text-center mt-8 text-slate-500 text-[10px] font-black uppercase tracking-widest">
          Secure Terminal Access &copy; 2026
        </p>
      </div>
    </div>
  );
}

export default Login;