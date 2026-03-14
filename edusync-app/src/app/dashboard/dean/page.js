'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/Toast';
import Modal from '@/components/Modal';

export default function DeanPage() {
  const showToast = useToast();
  const [roster, setRoster] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFaculty, setSelectedFaculty] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);

  const [allFaculty, setAllFaculty] = useState([]);
  const [allActivities, setAllActivities] = useState([]);
  const [maxHours, setMaxHours] = useState(40);

  const buildRoster = useCallback((faculty, activities, max) => {
    return faculty.map(f => {
      const fac_acts = activities.filter(a => a.faculty_id === f.id);
      const totalFte = fac_acts.reduce((s, a) => s + parseFloat(a.fte_value || 0), 0);
      return {
        ...f,
        fte: Math.round(totalFte * 10) / 10,
        capped_fte: Math.round(Math.min(totalFte, max) * 10) / 10,
        status: totalFte > max ? 'Overload' : totalFte >= max - 2 ? 'Warning' : 'Compliant',
        activities: fac_acts,
      };
    });
  }, []);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const { data: faculty } = await supabase.from('faculty').select('*');
      const { data: activities } = await supabase.from('activities').select('*');
      const { data: settingsData } = await supabase.from('settings').select('*');
      if (!faculty || !activities) return;

      const settings = {};
      (settingsData || []).forEach(s => { settings[s.key] = s.value; });
      const max = parseFloat(settings.max_weekly_hours || '40');
      setMaxHours(max);
      setAllFaculty(faculty);
      setAllActivities(activities);
      setRoster(buildRoster(faculty, activities, max));
    } catch (err) {
      showToast('Failed to load roster.', 'error');
    }
    setLoading(false);
  }

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel('dean-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activities' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setAllActivities(prev => { const u = [payload.new, ...prev]; setRoster(buildRoster(allFaculty, u, maxHours)); return u; });
          showToast('Roster updated — new activity logged.', 'success');
        } else if (payload.eventType === 'DELETE') {
          setAllActivities(prev => { const u = prev.filter(a => a.id !== payload.old.id); setRoster(buildRoster(allFaculty, u, maxHours)); return u; });
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'faculty' }, () => {
        loadData(); // Reload when faculty records change
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [allFaculty, maxHours, buildRoster, showToast]);

  function openDetail(fac) {
    setSelectedFaculty(fac);
    setEditForm({ name: fac.name, department: fac.department, subject: fac.subject || '', semester: fac.semester || '', is_phd: fac.is_phd });
    setEditing(false);
    setShowDetailModal(true);
  }

  async function handleSaveEdit() {
    if (!selectedFaculty) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('faculty').update({
        name: editForm.name,
        department: editForm.department,
        subject: editForm.subject,
        semester: editForm.semester,
        is_phd: editForm.is_phd,
      }).eq('id', selectedFaculty.id);

      if (error) throw new Error(error.message);

      // Update local state
      setAllFaculty(prev => {
        const updated = prev.map(f => f.id === selectedFaculty.id ? { ...f, ...editForm } : f);
        setRoster(buildRoster(updated, allActivities, maxHours));
        return updated;
      });
      setSelectedFaculty(prev => ({ ...prev, ...editForm }));
      setEditing(false);
      showToast('Faculty details updated.', 'success');
    } catch (err) {
      showToast('Failed to save: ' + err.message, 'error');
    }
    setSaving(false);
  }

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}><div className="spinner"></div></div>;

  return (
    <>
      <header className="header-bar">
        <div>
          <h1 style={{ fontSize: '1.8rem' }}>Faculty Roster</h1>
          <p style={{ color: 'var(--text-muted)' }}>
            Workload and compliance status for all faculty.
            <span className="badge badge-success" style={{ marginLeft: 8 }}><span className="pulse" style={{ marginRight: 4 }}></span> Live</span>
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => window.print()}>
          <i className="fa-solid fa-print"></i> Print
        </button>
      </header>

      <div className="card">
        <table>
          <thead>
            <tr><th>Name</th><th>Department</th><th>Subject</th><th>FTE</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {roster.map(fac => (
              <tr key={fac.id}>
                <td><strong className="faculty-link" onClick={() => openDetail(fac)}>{fac.name}</strong></td>
                <td>{fac.department}</td>
                <td>{fac.subject || '—'}</td>
                <td><strong>{fac.capped_fte.toFixed(1)}</strong></td>
                <td><span className={`badge badge-${fac.status === 'Overload' ? 'danger' : fac.status === 'Warning' ? 'warning' : 'success'}`}>{fac.status}</span></td>
                <td>
                  <button className="btn btn-outline" style={{ padding: '4px 10px', fontSize: '0.75rem' }} onClick={() => { openDetail(fac); setEditing(true); }}>
                    <i className="fa-solid fa-pen"></i>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Detail / Edit Modal */}
      <Modal isOpen={showDetailModal} onClose={() => setShowDetailModal(false)} maxWidth="540px">
        {selectedFaculty && !editing && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '1.5rem' }}>
              <div className="avatar">{selectedFaculty.name.split(' ').map(n => n[0]).join('').replace('.', '').slice(0, 2)}</div>
              <div style={{ flex: 1 }}>
                <h3 style={{ marginBottom: '2px' }}>{selectedFaculty.name}</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{selectedFaculty.department}</p>
              </div>
              <button className="btn btn-outline" style={{ fontSize: '0.8rem' }} onClick={() => setEditing(true)}>
                <i className="fa-solid fa-pen"></i> Edit
              </button>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginBottom: '1.5rem' }}>
              <div style={{ flex: 1, background: 'var(--bg-input)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>FTE</label>
                <p style={{ fontSize: '1.5rem', fontWeight: 700 }}>{selectedFaculty.capped_fte.toFixed(1)} Hrs</p>
                <span className={`badge badge-${selectedFaculty.status === 'Overload' ? 'danger' : 'success'}`}>{selectedFaculty.status}</span>
              </div>
              <div style={{ flex: 1, background: 'var(--bg-input)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Semester</label>
                <p style={{ fontSize: '1.5rem', fontWeight: 700 }}>{selectedFaculty.semester}</p>
                <span className="badge badge-neutral">{selectedFaculty.subject || '—'}</span>
              </div>
            </div>

            <h4 style={{ fontSize: '0.85rem', marginBottom: '8px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Workload Breakdown</h4>
            {selectedFaculty.activities.length === 0
              ? <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No activities on record.</p>
              : <ul style={{ listStyle: 'none', padding: 0 }}>{selectedFaculty.activities.map((a, i) => (
                  <li key={i} className="breakdown-item"><span>{a.activity_type}: {a.description}</span><span>{parseFloat(a.fte_value).toFixed(1)} Hrs</span></li>
                ))}</ul>
            }
            <div style={{ textAlign: 'right', marginTop: '1.5rem' }}>
              <button className="btn btn-primary" onClick={() => setShowDetailModal(false)}>Close</button>
            </div>
          </>
        )}

        {selectedFaculty && editing && (
          <>
            <h3 style={{ marginBottom: '1.5rem' }}>Edit Faculty</h3>
            <div className="form-group">
              <label>Name</label>
              <input type="text" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Department</label>
              <select value={editForm.department} onChange={e => setEditForm(f => ({ ...f, department: e.target.value }))}>
                <option value="Computer Science">Computer Science</option>
                <option value="AI & ML">AI & ML</option>
                <option value="Mechanical">Mechanical</option>
                <option value="Civil">Civil</option>
                <option value="Electrical">Electrical</option>
                <option value="Biotech">Biotech</option>
                <option value="Unassigned">Unassigned</option>
              </select>
            </div>
            <div className="form-group">
              <label>Subject</label>
              <input type="text" value={editForm.subject} onChange={e => setEditForm(f => ({ ...f, subject: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Semester</label>
              <input type="text" value={editForm.semester} onChange={e => setEditForm(f => ({ ...f, semester: e.target.value }))} />
            </div>
            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <input type="checkbox" id="is_phd" checked={editForm.is_phd} onChange={e => setEditForm(f => ({ ...f, is_phd: e.target.checked }))} style={{ width: 'auto' }} />
              <label htmlFor="is_phd" style={{ marginBottom: 0 }}>Ph.D. Holder</label>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '1.5rem' }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSaveEdit} disabled={saving}>
                {saving ? <><i className="fa-solid fa-circle-notch fa-spin"></i> Saving...</> : <><i className="fa-solid fa-floppy-disk"></i> Save</>}
              </button>
              <button className="btn btn-outline" onClick={() => setEditing(false)}>Cancel</button>
            </div>
          </>
        )}
      </Modal>
    </>
  );
}
