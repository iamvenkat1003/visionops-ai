import { useState } from "react";
import type { FormEvent } from "react";
import {
  ArrowRight,
  Box,
  Check,
  Eye,
  EyeOff,
  Layers3,
  Loader2,
  ScanLine,
} from "lucide-react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { errorMessage } from "../services/api";
import { Badge, ErrorNotice, Logo } from "../components/Common";
import { Button } from "../components/ui/button";

export function Login() {
  const { user, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  if (user) return <Navigate to="/analyze" replace />;
  const submit = async (event?: FormEvent, guest = false) => {
    event?.preventDefault();
    setBusy(guest ? "guest" : "login");
    setError("");
    try {
      await login(guest ? undefined : email, guest ? undefined : password);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy("");
    }
  };
  return (
    <div className="login-page">
      <section className="login-story">
        <Logo />
        <div className="login-story-content">
          <Badge tone="green">A clearer view of your vision models</Badge>
          <h1>
            See the objects.
            <br />
            Understand
            <br />
            <em>the system.</em>
          </h1>
          <p>
            From a single image to the bigger picture.
            <br />
            Object detection, meaningful insights, and human feedback in one
            workspace.
          </p>
          <div className="vision-illustration" aria-hidden="true">
            <div className="illustration-grid" />
            <div className="illustration-box one">
              <span>
                object detection <b>98%</b>
              </span>
              <Box size={84} strokeWidth={0.65} />
            </div>
            <div className="illustration-box two">
              <span>observability</span>
              <Layers3 size={46} strokeWidth={0.8} />
            </div>
            <div className="scan-cross">+</div>
            <div className="illustration-caption">
              <ScanLine size={15} /> Every prediction. In perspective.
            </div>
          </div>
        </div>
        <span className="login-story-footer">
          COMPUTER VISION INTELLIGENCE & OBSERVABILITY
        </span>
      </section>
      <section className="login-panel">
        <div className="login-form">
          <span className="eyebrow">YOUR VISION WORKSPACE</span>
          <h2>Welcome to VisionOps.</h2>
          <p>Sign in to analyze, monitor, and improve.</p>
          {error && <ErrorNotice message={error} />}
          <form onSubmit={(e) => void submit(e)}>
            <label htmlFor="email">Work email</label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <label htmlFor="password">Password</label>
            <div className="password-field">
              <input
                id="password"
                type={show ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                aria-label={show ? "Hide password" : "Show password"}
                onClick={() => setShow(!show)}
              >
                {show ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
            <Button type="submit" disabled={!!busy} className="full-width">
              {busy === "login" ? (
                <Loader2 size={17} className="spin" />
              ) : (
                <>
                  Sign in to workspace <ArrowRight size={17} />
                </>
              )}
            </Button>
          </form>
          <div className="divider">
            <span>or take a look around</span>
          </div>
          <Button
            variant="outline"
            className="full-width"
            disabled={!!busy}
            onClick={() => void submit(undefined, true)}
          >
            {busy === "guest" ? (
              <Loader2 className="spin" size={17} />
            ) : (
              <>
                Continue as Guest <ArrowRight size={17} />
              </>
            )}
          </Button>
          <div className="login-benefits">
            <span>
              <Check size={14} /> No account needed
            </span>
            <span>
              <Check size={14} /> Real object detection
            </span>
          </div>
          <details className="demo-credentials">
            <summary>Using the local demo?</summary>
            <p>
              Choose an account to fill its local demonstration credentials.
            </p>
            <div className="inline-actions">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setEmail("employee@visionops.local");
                  setPassword("EmployeeDemo!2026");
                }}
              >
                Employee
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setEmail("admin@visionops.local");
                  setPassword("AdminDemo!2026");
                }}
              >
                Administrator
              </Button>
            </div>
            <small>
              These defaults work only while the demo account settings are
              unchanged.
            </small>
          </details>
        </div>
        <div className="login-panel-footer">
          <span className="status-dot" /> Local-first. Your images stay on this
          server.
        </div>
      </section>
    </div>
  );
}
