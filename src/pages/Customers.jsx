import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import AdminLayout from "../components/AdminLayout";
import { supabase } from "../lib/supabase";
import {
  MdPeople,
  MdAdd,
  MdClose,
  MdSearch,
  MdDelete,
  MdEdit,
} from "react-icons/md";

function Customers() {
  /* =======================
      STATE
  ======================= */
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("recent");

  const [form, setForm] = useState({
    customer_name: "",
    phone: "",
    total_spend: 0,
    total_orders: 0
  });

  /* =======================
      RESTRICTION LOGIC
  ======================= */
  const userRole = localStorage.getItem("userRole");

  /* =======================
      FETCH
  ======================= */
  const fetchCustomers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Fetch customers failed:", error);
    } else {
      setCustomers(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  /* =======================
      MODAL HANDLERS
  ======================= */
  const openModal = (cust = null) => {
    if (cust) {
      setIsEditing(true);
      setEditId(cust.id);
      setForm({
        customer_name: cust.customer_name || "",
        phone: cust.phone || "",
        total_orders: Number(cust.total_orders) || 0,
        total_spend: Number(cust.total_spend) || 0,
      });
    } else {
      setIsEditing(false);
      setEditId(null);
      setForm({
        customer_name: "",
        phone: "",
        total_orders: 0,
        total_spend: 0,
      });
    }
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();

    // 10-DIGIT VALIDATION CHECK
    if (form.phone.length !== 10) {
      alert("Please enter a valid 10-digit phone number.");
      return;
    }
    
    const payload = {
        customer_name: form.customer_name,
        phone: form.phone,
        total_orders: Number(form.total_orders),
        total_spend: Number(form.total_spend)
    };

    if (isEditing) {
      const { error } = await supabase
        .from("customers")
        .update(payload)
        .eq("id", editId);
      if (error) return alert(error.message);
    } else {
      const { error } = await supabase
        .from("customers")
        .insert([payload]);
      if (error) {
          if (error.code === '23505') return alert("A customer with this phone number already exists.");
          return alert(error.message);
      }
    }
    setShowModal(false);
    fetchCustomers();
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this customer permanently? This will also remove their order links.")) return;
    const { error } = await supabase.from("customers").delete().eq("id", id);
    if (error) alert(error.message);
    else fetchCustomers();
  };

  /* =======================
      FILTER & SORT
  ======================= */
  const processedCustomers = useMemo(() => {
    let list = [...customers];

    if (searchTerm) {
      list = list.filter((c) =>
        c.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.phone?.includes(searchTerm)
      );
    }

    if (sortBy === "name") {
      list.sort((a, b) => a.customer_name.localeCompare(b.customer_name));
    } else if (sortBy === "recent") {
      list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    } else if (sortBy === "spent") {
      list.sort((a, b) => (Number(b.total_spend) || 0) - (Number(a.total_spend) || 0));
    }

    return list;
  }, [customers, searchTerm, sortBy]);

  return (
    <AdminLayout>
      {/* HEADER */}
      <div className="flex justify-between items-center mb-8 px-4">
        <div>
          <h2 className="text-3xl font-black text-white uppercase">Customers</h2>
          <p className="text-slate-400 text-sm font-bold uppercase tracking-widest">
            {loading ? "Loading..." : `${processedCustomers.length} customers`}
          </p>
        </div>
        <button
          onClick={() => openModal()}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-2xl font-black uppercase text-xs flex items-center gap-2 transition-all"
        >
          <MdAdd size={18} /> Add Customer
        </button>
      </div>

      {/* FILTER BAR */}
      <div className="flex flex-col md:flex-row gap-4 px-4 mb-8">
        <div className="relative flex-1">
          <MdSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input
            placeholder="Search name or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 rounded-2xl bg-slate-800 border-none text-white font-bold focus:ring-2 focus:ring-blue-600 outline-none"
          />
        </div>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="p-3 px-6 rounded-2xl bg-slate-800 border-none text-white font-bold outline-none focus:ring-2 focus:ring-blue-600 cursor-pointer"
        >
          <option value="recent">Recent</option>
          <option value="name">Name A-Z</option>
          <option value="spent">Top Spent</option>
        </select>
      </div>

      {/* GRID */}
      {loading ? (
        <div className="text-center text-slate-400 py-20 font-bold uppercase tracking-widest">
          Loading customers...
        </div>
      ) : processedCustomers.length === 0 ? (
        <div className="bg-slate-800/50 p-20 rounded-[40px] text-center mx-4 border-2 border-dashed border-slate-700">
          <MdPeople size={80} className="mx-auto text-slate-700 mb-4" />
          <p className="font-black text-slate-500 uppercase tracking-tighter text-xl">
            No customers found
          </p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6 px-4 pb-12">
          {processedCustomers.map((c) => (
            <div
              key={c.id}
              className="bg-white p-8 rounded-[35px] shadow-xl border border-slate-100 hover:scale-[1.02] transition-transform"
            >
              <h3 className="font-black text-2xl text-slate-900 mb-1">{c.customer_name}</h3>
              <p className="text-slate-400 text-sm font-bold mb-6">+91 {c.phone}</p>

              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="bg-slate-50 p-4 rounded-2xl">
                  <p className="text-[10px] uppercase text-slate-400 font-black mb-1">Orders</p>
                  <p className="font-black text-xl text-slate-800">{c.total_orders || 0}</p>
                </div>
                <div className="bg-blue-50 p-4 rounded-2xl">
                  <p className="text-[10px] uppercase text-blue-400 font-black mb-1">Spent</p>
                  <p className="font-black text-xl text-blue-600">
                    ₹{Number(c.total_spend || 0).toLocaleString('en-IN')}
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <Link
                  to={`/customers/${c.id}`}
                  className="flex-1 text-center bg-slate-900 hover:bg-black text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-colors"
                >
                  View Profile
                </Link>
                
                {userRole === "admin" && (
                  <>
                    <button
                      onClick={() => openModal(c)}
                      className="p-4 bg-slate-100 text-slate-600 hover:bg-blue-600 hover:text-white rounded-2xl transition-all"
                    >
                      <MdEdit size={20} />
                    </button>
                    <button
                      onClick={() => handleDelete(c.id)}
                      className="p-4 bg-slate-100 text-slate-600 hover:bg-rose-600 hover:text-white rounded-2xl transition-all"
                    >
                      <MdDelete size={20} />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm flex items-center justify-center z-[1100] p-4">
          <div className="bg-white w-full max-w-md p-10 rounded-[40px] shadow-2xl animate-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-8">
              <h3 className="font-black text-2xl text-slate-900 uppercase">
                {isEditing ? "Edit Details" : "New Customer"}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-rose-600 transition-colors">
                <MdClose size={28} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-5">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 ml-2 mb-1 block">Full Name</label>
                <input
                  required
                  placeholder="e.g. John Doe"
                  value={form.customer_name}
                  onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                  className="w-full p-4 bg-slate-50 border-2 border-slate-50 rounded-2xl font-bold focus:border-blue-600 outline-none transition-all"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 ml-2 mb-1 block">
                  Phone Number (10 Digits)
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">+91</span>
                  <input
                    required
                    type="tel"
                    placeholder="9876543210"
                    value={form.phone}
                    onChange={(e) => {
                      // Remove non-digits and limit to 10
                      const val = e.target.value.replace(/\D/g, "").slice(0, 10);
                      setForm({ ...form, phone: val });
                    }}
                    className="w-full p-4 pl-14 bg-slate-50 border-2 border-slate-50 rounded-2xl font-bold focus:border-blue-600 outline-none transition-all"
                  />
                </div>
                {/* Validation message */}
                {form.phone.length > 0 && form.phone.length < 10 && (
                  <p className="text-[10px] text-rose-500 font-bold ml-2 mt-1 uppercase">
                    Requires {10 - form.phone.length} more digits
                  </p>
                )}
                {form.phone.length === 10 && (
                  <p className="text-[10px] text-emerald-500 font-bold ml-2 mt-1 uppercase">
                    ✓ Valid number
                  </p>
                )}
              </div>

              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-5 rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-blue-200 transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100"
                disabled={form.phone.length !== 10}
              >
                {isEditing ? "Update Profile" : "Create Account"}
              </button>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

export default Customers;