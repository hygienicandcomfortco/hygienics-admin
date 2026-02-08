import { useState } from "react";
import { supabase } from "../utils/supabase"
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
      // 1. Authenticate user
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;

      // 2. Fetch role from profile
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role, full_name")
        .eq("id", authData.user.id)
        .single();

      if (profileError) {
        await supabase.auth.signOut();
        throw new Error("User profile not found. Contact admin.");
      }

      // 3. Save metadata
      localStorage.setItem("userRole", profile.role);
      localStorage.setItem("userName", profile.full_name || "Staff Member");
      localStorage.setItem("isLoggedIn", "true");

      // 4. Redirect using HASH for GitHub Pages
      if (profile.role === "admin") {
        window.location.href = "/#/dashboard";
      } else {
        window.location.href = "/#/orders";
      }

    } catch (err) {
      setError(err.message || "Invalid email or password");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] dark:bg-[#0b1220] fixed inset-0 z-[9999]">
      <div className="w-full max-w-md px-6">
        <div className="bg-white dark:bg-[#0f172a] p-10 rounded-[40px] shadow-2xl border border-slate-100 dark:border-slate-800">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-blue-100">
              <ShieldCheck className="text-white w-10 h-10" />
            </div>
            <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight uppercase">Admin Login</h2>
            <p className="text-slate-400 dark:text-slate-500 text-xs font-black uppercase tracking-[0.2em] mt-2">Hygienic & Comfort Co.</p>
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 text-[10px] font-black text-center uppercase tracking-widest leading-relaxed">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 w-5 h-5" />
              <input
                name="email"
                type="email"
                placeholder="Email"
                required
                className="w-full h-14 bg-slate-50 dark:bg-slate-900/60 border-2 border-slate-100 dark:border-slate-800 pl-12 pr-4 rounded-2xl focus:border-blue-500 outline-none font-bold text-slate-900 dark:text-white transition-all placeholder:text-slate-300 dark:placeholder:text-slate-500"
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 w-5 h-5" />
              <input
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                required
                className="w-full h-14 bg-slate-50 dark:bg-slate-900/60 border-2 border-slate-100 dark:border-slate-800 pl-12 pr-12 rounded-2xl focus:border-blue-500 outline-none font-bold text-slate-900 dark:text-white transition-all placeholder:text-slate-300 dark:placeholder:text-slate-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-600 transition-colors"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 text-white h-16 rounded-2xl font-black uppercase tracking-[0.2em] text-xs hover:bg-blue-700 transition-all shadow-xl shadow-slate-100 active:scale-[0.98] disabled:opacity-70 disabled:active:scale-100"
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

        <p className="text-center mt-8 text-slate-400 dark:text-slate-500 text-[10px] font-black uppercase tracking-widest">
          Secure Terminal Access &copy; 2026
        </p>
      </div>
    </div>
  );
}

export default Login;
