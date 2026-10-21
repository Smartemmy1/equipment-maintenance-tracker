import { Link, NavLink, Route, Routes } from "react-router-dom";
import { EquipmentDetail } from "./pages/EquipmentDetail";
import { EquipmentList } from "./pages/EquipmentList";
import { Overview } from "./pages/Overview";
import { Schedule } from "./pages/Schedule";

const NAV = [
  { to: "/", label: "Overview", end: true },
  { to: "/equipment", label: "Equipment", end: false },
  { to: "/schedule", label: "Schedule", end: false },
];

export function App() {
  return (
    <div className="shell">
      <nav className="sidebar" aria-label="Main">
        <Link to="/" className="brand">
          <svg viewBox="0 0 32 32" aria-hidden="true">
            <path d="M9 4h14a3 3 0 0 1 3 3v19a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3z" fill="var(--yellow)" />
            <circle cx="16" cy="9.5" r="2.5" fill="var(--navy)" />
            <rect x="10" y="16" width="12" height="2.5" rx="1" fill="var(--navy)" />
            <rect x="10" y="21" width="8" height="2.5" rx="1" fill="var(--navy)" />
          </svg>
          Maintenance Tracker
        </Link>
        <ul>
          {NAV.map((n) => (
            <li key={n.to}>
              <NavLink to={n.to} end={n.end}>
                {n.label}
              </NavLink>
            </li>
          ))}
        </ul>
        <a href="/docs" className="sidebar-foot">
          API docs
        </a>
      </nav>
      <main className="content">
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/equipment" element={<EquipmentList />} />
          <Route path="/equipment/:id" element={<EquipmentDetail />} />
          <Route path="/schedule" element={<Schedule />} />
          <Route
            path="*"
            element={
              <>
                <h1>Page not found</h1>
                <Link to="/">Go to the overview</Link>
              </>
            }
          />
        </Routes>
      </main>
    </div>
  );
}
