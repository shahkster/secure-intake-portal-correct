import React, { useEffect, useMemo, useState } from "react";

const api = async (url, options = {}) => {
  const response = await fetch(url, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  let data = {};
  try { data = await response.json(); } catch { /* empty */ }
  if (!response.ok) {
    const error = new Error(data.error || data.message || "Something went wrong.");
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
};

const formatDate = (value) => {
  if (!value) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
};

const digits = (value, max) => String(value || "").replace(/\D/g, "").slice(0, max);
const formatSSN = (value) => value ? `${value.slice(0, 3)}-${value.slice(3, 5)}-${value.slice(5)}` : "";
const mask = (value, keep = 4) => value ? `${"•".repeat(Math.max(0, value.length - keep))}${value.slice(-keep)}` : "—";

function Notice() {
  return (
    <div className="test-notice">
      <strong>Test environment</strong>
      <span>Use fictitious information until you have completed a security and compliance review.</span>
    </div>
  );
}

function Shell({ children, agent = false, onLogout }) {
  return (
    <div className="app-shell">
      <Notice />
      <header className="site-header">
        <div className="header-inner">
          <div className="brand">
            <div className="brand-mark" aria-hidden="true">S</div>
            <div>
              <div className="brand-name">Secure Client Portal</div>
              <div className="brand-subtitle">Confidential information request</div>
            </div>
          </div>
          {agent && (
            <button className="text-button" onClick={onLogout}>Sign out</button>
          )}
        </div>
      </header>
      <main className="main-wrap">{children}</main>
      <footer className="site-footer">
        <div>Information is transmitted over an encrypted connection.</div>
        <div>Secure Client Portal</div>
      </footer>
    </div>
  );
}

function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const data = await api("/api/auth-login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      onLogin(data.email);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell>
      <div className="narrow-page">
        <section className="panel login-panel">
          <div className="panel-heading">
            <p className="eyebrow">Agent access</p>
            <h1>Sign in</h1>
            <p>Use the email and password configured for this portal.</p>
          </div>
          <form className="form-stack" onSubmit={submit}>
            <label>
              <span>Email address</span>
              <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>
            <label>
              <span>Password</span>
              <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </label>
            {error && <div className="error-box">{error}</div>}
            <button className="primary-button" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
          </form>
        </section>
      </div>
    </Shell>
  );
}

function CreateRequest({ onCreated }) {
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [wantSSN, setWantSSN] = useState(true);
  const [wantDOB, setWantDOB] = useState(true);
  const [wantBank, setWantBank] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const data = await api("/api/requests", {
        method: "POST",
        body: JSON.stringify({ first, last, wantSSN, wantDOB, wantBank }),
      });
      setFirst("");
      setLast("");
      setWantSSN(true);
      setWantDOB(true);
      setWantBank(false);
      onCreated(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel">
      <div className="panel-heading compact-heading">
        <p className="eyebrow">New request</p>
        <h2>Create a secure client link</h2>
        <p>Enter the client’s name and select the information you need.</p>
      </div>
      <form className="form-stack" onSubmit={submit}>
        <div className="two-column">
          <label>
            <span>First name</span>
            <input value={first} onChange={(e) => setFirst(e.target.value)} autoComplete="off" required />
          </label>
          <label>
            <span>Last name</span>
            <input value={last} onChange={(e) => setLast(e.target.value)} autoComplete="off" required />
          </label>
        </div>
        <fieldset className="request-options">
          <legend>Information requested</legend>
          <label className={wantSSN ? "option-card selected" : "option-card"}>
            <input type="checkbox" checked={wantSSN} onChange={(e) => setWantSSN(e.target.checked)} />
            <span>
              <strong>Social Security number</strong>
              <small>The client enters a nine-digit Social Security number.</small>
            </span>
          </label>
          <label className={wantDOB ? "option-card selected" : "option-card"}>
            <input type="checkbox" checked={wantDOB} onChange={(e) => setWantDOB(e.target.checked)} />
            <span>
              <strong>Date of birth</strong>
              <small>The client enters their date of birth on the secure form.</small>
            </span>
          </label>
          <label className={wantBank ? "option-card selected" : "option-card"}>
            <input type="checkbox" checked={wantBank} onChange={(e) => setWantBank(e.target.checked)} />
            <span>
              <strong>Routing and account number</strong>
              <small>The routing number is checked for a valid ABA checksum.</small>
            </span>
          </label>
        </fieldset>
        {error && <div className="error-box">{error}</div>}
        <button className="primary-button align-start" disabled={busy || !first.trim() || !last.trim() || (!wantSSN && !wantDOB && !wantBank)}>
          {busy ? "Creating…" : "Create secure link"}
        </button>
      </form>
    </section>
  );
}

function CreatedLink({ item, onClose }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(item.link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };
  return (
    <section className="panel created-panel">
      <div className="success-row">
        <div className="success-icon">✓</div>
        <div>
          <h2>Secure link created</h2>
          <p>Send this link to {item.request.first} {item.request.last}. It expires {formatDate(item.request.expiresAt)}.</p>
        </div>
      </div>
      <div className="link-box">
        <code>{item.link}</code>
        <button className="secondary-button" onClick={copy}>{copied ? "Copied" : "Copy link"}</button>
      </div>
      <div className="button-row">
        <button className="text-button" onClick={onClose}>Create another request</button>
      </div>
    </section>
  );
}

function StatusBadge({ status }) {
  const label = { sent: "Awaiting client", submitted: "Received", locked: "Locked", expired: "Expired" }[status] || status;
  return <span className={`status status-${status}`}>{label}</span>;
}

function RevealValue({ label, value, format }) {
  const [open, setOpen] = useState(false);
  const visible = open ? (format ? format(value) : value) : mask(value);
  return (
    <div className="detail-row">
      <div>
        <span className="detail-label">{label}</span>
        <div className="detail-value">{visible}</div>
      </div>
      <button className="text-button" onClick={() => setOpen(!open)}>{open ? "Hide" : "Show"}</button>
    </div>
  );
}

function ReviewPanel({ request, onClose, onChanged }) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    api(`/api/request-reveal?id=${encodeURIComponent(request.id)}`, { method: "POST", body: "{}" })
      .then((result) => active && setData(result))
      .catch((err) => active && setError(err.message))
      .finally(() => active && setBusy(false));
    return () => { active = false; };
  }, [request.id]);

  const remove = async () => {
    if (!window.confirm("Permanently delete this request and its submitted information?")) return;
    try {
      await api(`/api/request?id=${encodeURIComponent(request.id)}`, { method: "DELETE" });
      onChanged();
      onClose();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <section className="panel review-panel">
      <div className="review-header">
        <div>
          <button className="text-button back-button" onClick={onClose}>← Back to requests</button>
          <h2>{request.first} {request.last}</h2>
          <p>Submitted {formatDate(request.submittedAt)}</p>
        </div>
        <button className="danger-button" onClick={remove}>Delete</button>
      </div>
      {busy && <div className="loading-block">Opening submission…</div>}
      {error && <div className="error-box">{error}</div>}
      {data?.payload && (
        <div className="details-card">
          {data.payload.dob && (
            <div className="detail-row static-row">
              <div>
                <span className="detail-label">Date of birth</span>
                <div className="detail-value">{data.payload.dob}</div>
              </div>
            </div>
          )}
          {data.payload.ssn && <RevealValue label="Social Security number" value={data.payload.ssn} format={formatSSN} />}
          {data.payload.routing && (
            <div className="detail-row static-row">
              <div>
                <span className="detail-label">Routing number</span>
                <div className="detail-value">{data.payload.routing}</div>
              </div>
            </div>
          )}
          {data.payload.account && <RevealValue label="Account number" value={data.payload.account} />}
        </div>
      )}
      <p className="small-note">Opening this submission is recorded in the audit table.</p>
    </section>
  );
}

function RequestsList({ requests, loading, onRefresh, onReview, onDelete }) {
  return (
    <section className="panel requests-panel">
      <div className="list-header">
        <div>
          <p className="eyebrow">Requests</p>
          <h2>Client requests</h2>
        </div>
        <button className="secondary-button" onClick={onRefresh} disabled={loading}>{loading ? "Refreshing…" : "Refresh"}</button>
      </div>
      {requests.length === 0 && !loading ? (
        <div className="empty-state">No requests have been created yet.</div>
      ) : (
        <div className="request-list">
          {requests.map((request) => (
            <div className="request-item" key={request.id}>
              <div className="request-main">
                <div className="request-title-row">
                  <strong>{request.first} {request.last}</strong>
                  <StatusBadge status={request.status} />
                </div>
                <div className="request-meta">
                  {[request.wantSSN && "SSN", request.wantDOB && "DOB", request.wantBank && "Bank information"].filter(Boolean).join(" · ")}
                  <span>Created {formatDate(request.createdAt)}</span>
                </div>
              </div>
              <div className="request-actions">
                {request.status === "submitted" && <button className="secondary-button" onClick={() => onReview(request)}>Review</button>}
                <button className="text-button muted-action" onClick={() => onDelete(request)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Dashboard({ email, onLogout }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [created, setCreated] = useState(null);
  const [reviewing, setReviewing] = useState(null);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api("/api/requests");
      setRequests(data.requests || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const remove = async (request) => {
    if (!window.confirm(`Delete the request for ${request.first} ${request.last}?`)) return;
    try {
      await api(`/api/request?id=${encodeURIComponent(request.id)}`, { method: "DELETE" });
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  if (reviewing) {
    return (
      <Shell agent onLogout={onLogout}>
        <ReviewPanel request={reviewing} onClose={() => setReviewing(null)} onChanged={load} />
      </Shell>
    );
  }

  return (
    <Shell agent onLogout={onLogout}>
      <div className="dashboard-heading">
        <div>
          <p className="eyebrow">Agent workspace</p>
          <h1>Client information requests</h1>
          <p>Signed in as {email}</p>
        </div>
      </div>
      {error && <div className="error-box page-error">{error}</div>}
      <div className="dashboard-grid">
        <div>{created ? <CreatedLink item={created} onClose={() => setCreated(null)} /> : <CreateRequest onCreated={(data) => { setCreated(data); load(); }} />}</div>
        <RequestsList requests={requests} loading={loading} onRefresh={load} onReview={setReviewing} onDelete={remove} />
      </div>
    </Shell>
  );
}

function AgentPortal() {
  const [state, setState] = useState({ checking: true, email: null });
  useEffect(() => {
    api("/api/auth-me")
      .then((data) => setState({ checking: false, email: data.email }))
      .catch(() => setState({ checking: false, email: null }));
  }, []);

  const logout = async () => {
    try { await api("/api/auth-logout", { method: "POST", body: "{}" }); } catch { /* ignore */ }
    setState({ checking: false, email: null });
  };

  if (state.checking) return <Shell><div className="loading-page">Loading portal…</div></Shell>;
  if (!state.email) return <Login onLogin={(email) => setState({ checking: false, email })} />;
  return <Dashboard email={state.email} onLogout={logout} />;
}

function ClientClosed({ title, message }) {
  return (
    <Shell>
      <div className="narrow-page">
        <section className="panel client-panel">
          <div className="panel-heading">
            <p className="eyebrow">Secure request</p>
            <h1>{title}</h1>
            <p>{message}</p>
          </div>
        </section>
      </div>
    </Shell>
  );
}

function ClientPortal({ token }) {
  const [requestInfo, setRequestInfo] = useState(null);
  const [stage, setStage] = useState("loading");
  const [lastName, setLastName] = useState("");
  const [dob, setDob] = useState("");
  const [ssn, setSsn] = useState("");
  const [routing, setRouting] = useState("");
  const [account, setAccount] = useState("");
  const [showSSN, setShowSSN] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [closed, setClosed] = useState(null);

  useEffect(() => {
    api(`/api/public-request?token=${encodeURIComponent(token)}`)
      .then((data) => { setRequestInfo(data); setStage("verify"); })
      .catch((err) => {
        setClosed({
          title: err.data?.state === "locked" ? "This link is locked" : err.data?.state === "completed" ? "Request already completed" : "Link unavailable",
          message: err.message,
        });
      });
  }, [token]);

  const verify = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/api/public-verify", { method: "POST", body: JSON.stringify({ token, lastName }) });
      setStage("fill");
    } catch (err) {
      setError(err.message + (err.data?.attemptsRemaining !== undefined && !err.data?.locked ? ` ${err.data.attemptsRemaining} attempt${err.data.attemptsRemaining === 1 ? "" : "s"} remaining.` : ""));
      if (err.data?.locked) setClosed({ title: "This link is locked", message: err.message });
    } finally {
      setBusy(false);
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/api/public-submit", {
        method: "POST",
        body: JSON.stringify({ token, dob, ssn, routing, account }),
      });
      setStage("done");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (closed) return <ClientClosed title={closed.title} message={closed.message} />;
  if (stage === "loading") return <Shell><div className="loading-page">Opening secure request…</div></Shell>;
  if (stage === "done") return <ClientClosed title="Information received" message="Your information was submitted successfully. This link is now closed and cannot be used again." />;

  return (
    <Shell>
      <div className="narrow-page">
        <div className="progress-line">
          <span className={stage === "verify" ? "active" : "complete"}>1. Verify</span>
          <span className={stage === "fill" ? "active" : ""}>2. Submit</span>
        </div>
        <section className="panel client-panel">
          {stage === "verify" ? (
            <>
              <div className="panel-heading">
                <p className="eyebrow">Identity verification</p>
                <h1>Confirm your identity, {requestInfo.firstName}</h1>
                <p>Your Agent requested information to complete your life insurance application. Enter your last name exactly as it appears on file.</p>
              </div>
              <form className="form-stack" onSubmit={verify}>
                <label>
                  <span>Last name</span>
                  <input autoComplete="family-name" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
                </label>
                {error && <div className="error-box">{error}</div>}
                <button className="primary-button align-start" disabled={busy || !lastName.trim()}>{busy ? "Checking…" : "Continue"}</button>
              </form>
              <p className="small-note">Three unsuccessful attempts will lock this link.</p>
            </>
          ) : (
            <>
              <div className="panel-heading">
                <p className="eyebrow">Secure submission</p>
                <h1>Your information</h1>
                <p>Complete the requested fields below. Sensitive numbers are hidden while you type.</p>
              </div>
              <form className="form-stack" onSubmit={submit}>
                {(requestInfo.wantSSN || requestInfo.wantDOB) && (
                  <div className="field-section">
                    <h3>Identity information</h3>
                    {requestInfo.wantDOB && (
                      <label>
                        <span>Date of birth</span>
                        <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} required />
                      </label>
                    )}
                    {requestInfo.wantSSN && (
                      <label>
                        <span className="label-with-action">Social Security number <button type="button" className="inline-action" onClick={() => setShowSSN(!showSSN)}>{showSSN ? "Hide" : "Show"}</button></span>
                        <input type={showSSN ? "text" : "password"} inputMode="numeric" autoComplete="off" value={ssn} onChange={(e) => setSsn(digits(e.target.value, 9))} placeholder="9 digits" required />
                        <small>{ssn.length} of 9 digits</small>
                      </label>
                    )}
                  </div>
                )}
                {requestInfo.wantBank && (
                  <div className="field-section">
                    <h3>Bank information</h3>
                    <label>
                      <span>Routing number</span>
                      <input inputMode="numeric" autoComplete="off" value={routing} onChange={(e) => setRouting(digits(e.target.value, 9))} placeholder="9 digits" required />
                    </label>
                    <label>
                      <span className="label-with-action">Account number <button type="button" className="inline-action" onClick={() => setShowAccount(!showAccount)}>{showAccount ? "Hide" : "Show"}</button></span>
                      <input type={showAccount ? "text" : "password"} inputMode="numeric" autoComplete="off" value={account} onChange={(e) => setAccount(digits(e.target.value, 17))} placeholder="4–17 digits" required />
                    </label>
                  </div>
                )}
                {error && <div className="error-box">{error}</div>}
                <button className="primary-button align-start" disabled={busy}>{busy ? "Submitting…" : "Submit securely"}</button>
              </form>
            </>
          )}
        </section>
      </div>
    </Shell>
  );
}

export default function App() {
  const token = useMemo(() => {
    const match = window.location.pathname.match(/^\/r\/([^/]+)\/?$/);
    return match ? decodeURIComponent(match[1]) : null;
  }, []);
  return token ? <ClientPortal token={token} /> : <AgentPortal />;
}
