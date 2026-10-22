import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";

export function Layout() {
  const { user, ready, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <Link to="/" className="brand">
            <span className="brand-mark" aria-hidden="true">✦</span> Kinweb
          </Link>
          <nav className="nav">
            <NavLink to="/" end>Search</NavLink>
            {user && <NavLink to="/me">My family</NavLink>}
            {ready && (user ? (
              <button
                className="btn-ghost"
                onClick={() => { signOut(); navigate("/"); }}
                title={user.email}
              >
                Sign out
              </button>
            ) : (
              <NavLink to="/signin" className="nav-cta">Sign in</NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="wrap">
        <Outlet />
      </main>
    </>
  );
}
