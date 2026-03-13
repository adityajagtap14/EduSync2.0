'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/Toast';

export default function AdminPage() {
  const showToast = useToast();
  const [settings, setSettings] = useState({ lecture_multiplier: '2.0', lab_multiplier: '1.5', max_weekly_hours: '40' });
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const { data: settingsData } = await supabase.from('settings').select('*');
      if (settingsData) {
        const s = {};
        settingsData.forEach(row => { s[row.key] = row.value; });
        setSettings(prev => ({ ...prev, ...s }));
      }

      const { data: usersData } = await supabase.from('users').select('id, name, email, role, created_at').order('created_at', { ascending: false });
      if (usersData) setUsers(usersData);
    } catch (err) {
      showToast('Failed to load settings.', 'error');
    }
    setLoading(false);
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      for (const [key, value] of Object.entries(settings)) {
        await supabase.from('settings').upsert({ key, value, updated_at: new Date().toISOString() });
      }
      showToast('Settings saved.', 'success');
    } catch (err) {
      showToast('Failed to save.', 'error');
    }
    setSaving(false);
  }

  async function handleDeleteUser(id) {
    try {
      const { error } = await supabase.from('users').delete().eq('id', id);
      if (error) throw new Error(error.message);
      setUsers(prev => prev.filter(u => u.id !== id));
      showToast('User removed.', 'success');
    } catch (err) {
      showToast('Failed to delete user.', 'error');
    }
  }

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}><div className="spinner"></div></div>;

  return (
    <>
      <header className="header-bar">
        <div>
          <h1 style={{ fontSize: '1.8rem' }}>Settings</h1>
          <p style={{ color: 'var(--text-muted)' }}>Manage system parameters and user accounts.</p>
        </div>
      </header>

      {/* FTE Multipliers */}
      <div className="card" style={{ maxWidth: '800px' }}>
        <h3 style={{ marginBottom: '1.5rem', color: 'var(--primary)' }}>FTE Multipliers</h3>
        <form onSubmit={handleSave}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            <div className="form-group">
              <label>Lecture Multiplier</label>
              <input type="number" step="0.1" value={settings.lecture_multiplier} onChange={(e) => setSettings(s => ({ ...s, lecture_multiplier: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Lab / Clinical Multiplier</label>
              <input type="number" step="0.1" value={settings.lab_multiplier} onChange={(e) => setSettings(s => ({ ...s, lab_multiplier: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Max Weekly Hours</label>
              <input type="number" step="1" value={settings.max_weekly_hours} onChange={(e) => setSettings(s => ({ ...s, max_weekly_hours: e.target.value }))} />
            </div>
          </div>
          <button type="submit" className="btn btn-primary" style={{ marginTop: '1rem' }} disabled={saving}>
            {saving ? <><i className="fa-solid fa-circle-notch fa-spin"></i> Saving...</> : <><i className="fa-solid fa-floppy-disk"></i> Save</>}
          </button>
        </form>
      </div>

      {/* User Management */}
      <div className="card">
        <h3 style={{ marginBottom: '1.5rem', color: 'var(--primary)' }}>User Accounts</h3>
        <table>
          <thead>
            <tr><th>Name</th><th>Email</th><th>Role</th><th>Created</th><th></th></tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td><strong>{u.name}</strong></td>
                <td>{u.email}</td>
                <td><span className="badge badge-neutral" style={{ textTransform: 'capitalize' }}>{u.role}</span></td>
                <td>{new Date(u.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                <td>
                  <button
                    className="btn btn-outline"
                    style={{ padding: '2px 8px', fontSize: '0.75rem', color: 'var(--danger)', borderColor: 'var(--danger)' }}
                    onClick={() => handleDeleteUser(u.id)}
                    title="Delete user"
                  >
                    <i className="fa-solid fa-trash"></i>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
