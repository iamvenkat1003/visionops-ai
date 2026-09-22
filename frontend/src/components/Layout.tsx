import { useEffect, useState } from "react";
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  CircleHelp,
  Cpu,
  History,
  LogOut,
  Menu,
  MessageSquare,
  Moon,
  ScanLine,
  ShieldCheck,
  Sun,
  X,
} from "lucide-react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useResource } from "../hooks/useResource";
import type { Health } from "../services/types";
import { Badge, Logo } from "./Common";
import { Button } from "./ui/button";

export function Layout() {
  const { user, logout } = useAuth();
  const { data: health, error } = useResource<Health>("/api/health", 10000);
  const [dark, setDark] = useState(
    localStorage.getItem("visionops-theme") === "dark",
  );
  const [menu, setMenu] = useState(false);
  const location = useLocation();
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("visionops-theme", dark ? "dark" : "light");
  }, [dark]);
  useEffect(() => {
    setMenu(false);
    window.scrollTo(0, 0);
  }, [location.pathname]);
  const employee = user?.role !== "GUEST";
  const links = [
    {
      label: "Analyze",
      path: "/analyze",
      icon: ScanLine,
      group: "WORKSPACE",
      visible: true,
    },
    {
      label: "Prediction history",
      path: "/history",
      icon: History,
      visible: employee,
    },
    {
      label: "Analytics",
      path: "/analytics",
      icon: BarChart3,
      group: "OBSERVABILITY",
      visible: employee,
    },
    {
      label: "Model performance",
      path: "/performance",
      icon: Cpu,
      visible: employee,
    },
    {
      label: "Help & documentation",
      path: "/help",
      icon: CircleHelp,
      group: "SUPPORT",
      visible: true,
    },
    {
      label: "Feedback",
      path: "/feedback",
      icon: MessageSquare,
      visible: employee,
    },
    {
      label: "Administration",
      path: "/admin",
      icon: ShieldCheck,
      group: "MANAGEMENT",
      visible: user?.role === "ADMIN",
    },
  ];
  const healthy = !error && health?.status === "healthy";
  return (
    <div className="app-shell">
      {menu && (
        <button
          className="sidebar-scrim"
          aria-label="Close navigation"
          onClick={() => setMenu(false)}
        />
      )}
      <aside className={`sidebar ${menu ? "open" : ""}`}>
        <div className="sidebar-brand">
          <Logo />
          <button
            className="mobile-close"
            onClick={() => setMenu(false)}
            aria-label="Close navigation"
          >
            <X size={20} />
          </button>
        </div>
        <div className="workspace-switch">
          <span className="workspace-avatar">V</span>
          <div>
            <strong>VisionOps workspace</strong>
            <span>Local environment</span>
          </div>
          <Badge>v1.0</Badge>
        </div>
        <nav aria-label="Main navigation">
          {links
            .filter((l) => l.visible)
            .map((link) => (
              <div key={link.path}>
                {link.group && <div className="nav-group">{link.group}</div>}
                <NavLink
                  className={({ isActive }) =>
                    `nav-link ${isActive ? "active" : ""}`
                  }
                  to={link.path}
                >
                  <link.icon size={18} />
                  <span>{link.label}</span>
                  {link.path === "/analyze" && <span className="nav-dot" />}
                </NavLink>
              </div>
            ))}
        </nav>
        <div className="sidebar-bottom">
          {user?.role === "GUEST" && (
            <div className="guest-note">
              <ScanLine size={18} />
              <strong>Explore with more context</strong>
              <p>Sign in to revisit predictions and see your analytics.</p>
              <Button variant="ghost" size="sm" onClick={logout}>
                Employee sign in <ArrowUpRight size={14} />
              </Button>
            </div>
          )}
          <div className="sidebar-health">
            <span className={`status-dot ${healthy ? "" : "warning"}`} />
            <span>
              {error
                ? "Status unavailable"
                : healthy
                  ? "System operational"
                  : "System needs attention"}
            </span>
            <Activity size={13} />
          </div>
          <div className="user-block">
            <div className="avatar">
              {user?.name
                .split(" ")
                .map((s) => s[0])
                .slice(0, 2)
                .join("")}
            </div>
            <div>
              <strong>{user?.name}</strong>
              <span>{user?.role.toLowerCase()}</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDark(!dark)}
              aria-label={dark ? "Use light theme" : "Use dark theme"}
            >
              {dark ? <Sun size={17} /> : <Moon size={17} />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={logout}
              aria-label="Sign out"
            >
              <LogOut size={17} />
            </Button>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="mobile-menu"
              aria-label="Open navigation"
              onClick={() => setMenu(true)}
            >
              <Menu size={21} />
            </button>
            <span>Workspace</span>
            <span className="slash">/</span>
            <strong>
              {links.find((l) => location.pathname.startsWith(l.path))?.label ||
                "Prediction details"}
            </strong>
          </div>
          <div className="topbar-right">
            <span className="environment">
              <span className="status-dot" />
              Local development
            </span>
            <Badge tone={health?.demo_mode ? "amber" : ""}>
              {health?.demo_mode ? "Synthetic demo mode" : "YOLO11n"}
            </Badge>
          </div>
        </header>
        <main className="main-content">
          <Outlet />
        </main>
        <footer className="app-footer">
          <span>
            VisionOps AI <span>·</span> Computer Vision Intelligence &
            Observability
          </span>
          <span>Built for a closer look.</span>
        </footer>
      </div>
    </div>
  );
}
