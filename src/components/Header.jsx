import { useNavigate } from "react-router-dom"

function Header() {
  const navigate = useNavigate()

  const logout = () => {
  localStorage.removeItem("isLoggedIn")
  sessionStorage.removeItem("isLoggedIn")
  navigate("/")
}

  return (
    <header className="h-16 bg-white shadow flex items-center justify-between px-6">
      <h1 className="text-xl font-semibold">Dashboard</h1>

      <button
        onClick={logout}
        className="text-sm bg-gray-900 text-white px-3 py-1 rounded hover:bg-gray-800"
      >
        Logout
      </button>
    </header>
  )
}

export default Header
