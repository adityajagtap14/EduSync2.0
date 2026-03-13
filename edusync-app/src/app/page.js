'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ToastProvider, useToast } from '@/components/Toast';

const ROLE_REDIRECTS = {
  dean: '/dashboard/unified',
  unified: '/dashboard/unified',
  faculty: '/dashboard/faculty',
  admin: '/dashboard/admin',
};

function LoginPage() {
  const router = useRouter();
  const showToast = useToast();
  const [tab, setTab] = useState('signin');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Sign-in state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPass, setShowLoginPass] = useState(false);

  // Sign-up state
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupRole, setSignupRole] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirm, setSignupConfirm] = useState('');
  const [showSignupPass, setShowSignupPass] = useState(false);

  // Auto-redirect if already logged in
  useEffect(() => {
    const stored = localStorage.getItem('edusync_user');
    if (stored) {
      try {
        const u = JSON.parse(stored);
        if (u.role) router.replace(ROLE_REDIRECTS[u.role] || '/dashboard/unified');
      } catch { /* ignore */ }
    }
  }, [router]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    if (!loginEmail.includes('@')) { setError('Enter a valid email address.'); return; }
    if (!loginPassword) { setError('Enter your password.'); return; }

    setLoading(true);
    try {
      const { data: users, error: fetchErr } = await supabase
        .from('users').select('*').eq('email', loginEmail.trim().toLowerCase());

      if (fetchErr) throw new Error(fetchErr.message);
      if (!users || users.length === 0) { setError('No account found. Please sign up.'); setLoading(false); return; }

      const user = users[0];
      if (user.password_hash !== loginPassword) { setError('Incorrect password.'); setLoading(false); return; }

      localStorage.setItem('edusync_user', JSON.stringify({
        id: user.id, name: user.name, email: user.email, role: user.role,
      }));
      showToast('Signed in.', 'success');
      router.push(ROLE_REDIRECTS[user.role] || '/dashboard/unified');
    } catch (err) {
      setError(err.message || 'Login failed.');
    }
    setLoading(false);
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');
    if (!signupName || signupName.trim().length < 2) { setError('Enter your full name.'); return; }
    if (!signupEmail.includes('@')) { setError('Enter a valid email.'); return; }
    if (!signupRole) { setError('Select a role.'); return; }
    if (!signupPassword || signupPassword.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (signupPassword !== signupConfirm) { setError('Passwords do not match.'); return; }

    setLoading(true);
    try {
      const emailLower = signupEmail.trim().toLowerCase();
      const { data: existing } = await supabase.from('users').select('id').eq('email', emailLower);
      if (existing && existing.length > 0) { setError('Account exists. Please sign in.'); setLoading(false); return; }

      const { data: newUser, error: insertErr } = await supabase
        .from('users')
        .insert({ name: signupName.trim(), email: emailLower, password_hash: signupPassword, role: signupRole })
        .select().single();

      if (insertErr) throw new Error(insertErr.message);

      localStorage.setItem('edusync_user', JSON.stringify({
        id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role,
      }));
      showToast('Account created.', 'success');
      router.push(ROLE_REDIRECTS[newUser.role] || '/dashboard/unified');
    } catch (err) {
      setError(err.message || 'Signup failed.');
    }
    setLoading(false);
  };

  const fillDemo = (email, pass) => {
    setLoginEmail(email);
    setLoginPassword(pass);
    setTab('signin');
    setError('');
  };

  return (
    <div className="login-body">
      <div className="orb orb-1"></div>
      <div className="orb orb-2"></div>
      <div className="orb orb-3"></div>

      <div className="glass-login-card fade-in-up">
        <div className="login-brand">
          <div className="brand-content">
            <div className="logo-icon"><i className="fa-solid fa-building-columns"></i></div>
            <h1>EduSync.</h1>
            <p>Faculty Activity &amp; Compliance Tracker</p>
            <div className="brand-features">
              <span><i className="fa-solid fa-check"></i> Workload Tracking</span>
              <span><i className="fa-solid fa-check"></i> Compliance Analytics</span>
              <span><i className="fa-solid fa-check"></i> Report Generation</span>
            </div>
          </div>
        </div>

        <div className="login-form-section">
          <div className="auth-tabs">
            <button className={`auth-tab ${tab === 'signin' ? 'active' : ''}`} onClick={() => { setTab('signin'); setError(''); }}>Sign In</button>
            <button className={`auth-tab ${tab === 'signup' ? 'active' : ''}`} onClick={() => { setTab('signup'); setError(''); }}>Create Account</button>
          </div>

          {tab === 'signin' && (
            <div className="auth-form-panel">
              <h2>Welcome Back</h2>
              <p className="subtitle">Sign in to your dashboard.</p>
              <form onSubmit={handleLogin}>
                <div className="input-container">
                  <input type="email" placeholder=" " value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} required autoComplete="email" />
                  <label className="floating-label">Email Address</label>
                  <i className="fa-solid fa-envelope input-icon"></i>
                </div>
                <div className="input-container">
                  <input type={showLoginPass ? 'text' : 'password'} placeholder=" " value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} required minLength={6} autoComplete="current-password" />
                  <label className="floating-label">Password</label>
                  <i className="fa-solid fa-lock input-icon"></i>
                  <i className={`fa-solid ${showLoginPass ? 'fa-eye-slash' : 'fa-eye'} password-toggle`} onClick={() => setShowLoginPass(!showLoginPass)}></i>
                </div>
                {error && <div className="error-message"><i className="fa-solid fa-circle-xmark"></i> {error}</div>}
                <button type="submit" className="btn-glow" disabled={loading}>
                  {loading ? <><i className="fa-solid fa-circle-notch fa-spin"></i> Verifying...</> : <>Sign In <i className="fa-solid fa-arrow-right" style={{ marginLeft: '8px' }}></i></>}
                </button>
              </form>
              <div className="auth-footer"><p>No account? <a href="#" onClick={(e) => { e.preventDefault(); setTab('signup'); setError(''); }}>Create one</a></p></div>
              <div className="demo-credentials">
                <p><i className="fa-solid fa-circle-info"></i> Quick access:</p>
                <div className="demo-list">
                  <span onClick={() => fillDemo('dean@edusync.edu', 'dean123')}>Dean</span>
                  <span onClick={() => fillDemo('faculty@edusync.edu', 'faculty123')}>Faculty</span>
                  <span onClick={() => fillDemo('admin@edusync.edu', 'admin123')}>Admin</span>
                </div>
              </div>
            </div>
          )}

          {tab === 'signup' && (
            <div className="auth-form-panel">
              <h2>Create Account</h2>
              <p className="subtitle">Set up your profile to get started.</p>
              <form onSubmit={handleSignup}>
                <div className="input-container">
                  <input type="text" placeholder=" " value={signupName} onChange={(e) => setSignupName(e.target.value)} required minLength={2} autoComplete="name" />
                  <label className="floating-label">Full Name</label>
                  <i className="fa-solid fa-user input-icon"></i>
                </div>
                <div className="input-container">
                  <input type="email" placeholder=" " value={signupEmail} onChange={(e) => setSignupEmail(e.target.value)} required autoComplete="email" />
                  <label className="floating-label">Email Address</label>
                  <i className="fa-solid fa-envelope input-icon"></i>
                </div>
                <div className="input-container">
                  <select value={signupRole} onChange={(e) => setSignupRole(e.target.value)} required>
                    <option value="" disabled hidden></option>
                    <option value="unified">Dean / HOD</option>
                    <option value="faculty">Faculty</option>
                    <option value="admin">Administrator</option>
                  </select>
                  <label className="floating-label">Role</label>
                  <i className="fa-solid fa-user-shield input-icon"></i>
                </div>
                <div className="input-container">
                  <input type={showSignupPass ? 'text' : 'password'} placeholder=" " value={signupPassword} onChange={(e) => setSignupPassword(e.target.value)} required minLength={6} autoComplete="new-password" />
                  <label className="floating-label">Password</label>
                  <i className="fa-solid fa-lock input-icon"></i>
                  <i className={`fa-solid ${showSignupPass ? 'fa-eye-slash' : 'fa-eye'} password-toggle`} onClick={() => setShowSignupPass(!showSignupPass)}></i>
                </div>
                <div className="input-container">
                  <input type="password" placeholder=" " value={signupConfirm} onChange={(e) => setSignupConfirm(e.target.value)} required minLength={6} autoComplete="new-password" />
                  <label className="floating-label">Confirm Password</label>
                  <i className="fa-solid fa-shield-halved input-icon"></i>
                </div>
                {error && <div className="error-message"><i className="fa-solid fa-circle-xmark"></i> {error}</div>}
                <button type="submit" className="btn-glow" disabled={loading}>
                  {loading ? <><i className="fa-solid fa-circle-notch fa-spin"></i> Creating...</> : <>Create Account <i className="fa-solid fa-user-plus" style={{ marginLeft: '8px' }}></i></>}
                </button>
              </form>
              <div className="auth-footer"><p>Have an account? <a href="#" onClick={(e) => { e.preventDefault(); setTab('signin'); setError(''); }}>Sign in</a></p></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  return (<ToastProvider><LoginPage /></ToastProvider>);
}
