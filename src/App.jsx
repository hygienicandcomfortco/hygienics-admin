import { useState, useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";

// Page Imports
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Products from "./pages/Products";
import Orders from "./pages/Orders";
import Customers from "./pages/Customers";
import CustomerProfile from "./pages/CustomerProfile";
import Profile from "./pages/profile"; 
import Settings from "./pages/Settings"; // Ensure this file exists in /pages

// Protected Route Wrapper
const ProtectedRoute = ({ children }) => {
  const isLoggedIn = localStorage.getItem("isLoggedIn") === "true";
  return isLoggedIn ? children : <Navigate to="/#/login" replace />;
};

function App() {
  /* =======================
      DARK MODE LOGIC
  ======================= */
  const [isDark, setIsDark] = useState(() => {
    return localStorage.getItem("theme") === "dark";
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [isDark]);

  return (
    <div className="min-h-screen transition-colors duration-300"> 
      <Routes>
        {/* --- Public Routes --- */}
        <Route path="/login" element={<Login />} />

        {/* --- Protected Routes --- */}
        <Route
          path="/dashboard"
          element={<ProtectedRoute><Dashboard isDark={isDark} /></ProtectedRoute>}
        />
        <Route
          path="/products"
          element={<ProtectedRoute><Products isDark={isDark} /></ProtectedRoute>}
        />
        <Route
          path="/orders"
          element={<ProtectedRoute><Orders isDark={isDark} /></ProtectedRoute>}
        />
        <Route
          path="/customers"
          element={<ProtectedRoute><Customers isDark={isDark} /></ProtectedRoute>}
        />
        <Route
          path="/customers/:id"
          element={<ProtectedRoute><CustomerProfile isDark={isDark} /></ProtectedRoute>}
        />
        <Route 
          path="/profile" 
          element={<ProtectedRoute><Profile isDark={isDark} /></ProtectedRoute>} 
        />
        <Route 
          path="/settings" 
          element={
            <ProtectedRoute>
              <Settings isDark={isDark} setIsDark={setIsDark} />
            </ProtectedRoute>
          } 
        />

        {/* --- Fallback Route --- */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </div>
  );
}

export default App;
