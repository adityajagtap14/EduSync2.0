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

  const buildRoster = useCallback((faculty, activities, maxHours) => {
    return faculty.map(f => {
      const fac_acts = activities.filter(a => a.faculty_id === f.id);
      const totalFte = fac_acts.reduce((s, a) => s + parseFloat(a.fte_value || 0), 0);
      return {
        ...f,
        fte: Math.round(totalFte * 10) / 10,
        capped_fte: Math.round(Math.min(totalFte, maxHours) * 10) / 10,
        status: totalFte > maxHours ? 'Overload' : totalFte >= maxHours - 2 ? 'Warning' : 'Compliant',
        activities: fac_acts,
      };
    });
  }, []);

  const [allFaculty, setAllFaculty] = useState([]);
  const [allActivities, setAllActivities] = useState([]);
  const [maxHours, setMaxHours] = useState(40);

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

  // ─── Realtime: auto-update when activities change ────────────────
  useEffect(() => {
    const channel = supabase
      .channel('dean-activities-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activities' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setAllActivities(prev => {
            const updated = [payload.new, ...prev];
            setRoster(buildRoster(allFaculty, updated, maxHours));
            return updated;
          });
          showToast('Faculty roster updated — new activity logged.', 'success');
        } else if (payload.eventType === 'DELETE') {
          setAllActivities(prev => {
            const updated = prev.filter(a => a.id !== payload.old.id);
            setRoster(buildRoster(allFaculty, updated, maxHours));
            return updated;
          });
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [allFaculty, maxHours, buildRoster, showToast]);

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
            <tr>
              <th>Name</th>
              <th>Department</th>
              <th>Subject</th>
              <th>FTE</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {roster.map(fac => (
              <tr key={fac.id}>
                <td>
                  <strong className="faculty-link" onClick={() => { setSelectedFaculty(fac); setShowDetailModal(true); }}>
                    {fac.name}
                  </strong>
                </td>
                <td>{fac.department}</td>
                <td>{fac.subject || '—'}</td>
                <td><strong>{fac.capped_fte.toFixed(1)}</strong></td>
                <td>
                  <span className={`badge badge-${fac.status === 'Overload' ? 'danger' : fac.status === 'Warning' ? 'warning' : 'success'}`}>
                    {fac.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal isOpen={showDetailModal} onClose={() => setShowDetailModal(false)} maxWidth="520px">
        {selectedFaculty && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '1.5rem' }}>
              <div className="avatar">
                {selectedFaculty.name.split(' ').map(n => n[0]).join('').replace('.', '').slice(0, 2)}
              </div>
              <div>
                <h3 style={{ marginBottom: '2px' }}>{selectedFaculty.name}</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{selectedFaculty.department}</p>
              </div>
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
            {selectedFaculty.activities.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No activities on record.</p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0 }}>
                {selectedFaculty.activities.map((a, i) => (
                  <li key={i} className="breakdown-item">
                    <span>{a.activity_type}: {a.description}</span>
                    <span>{parseFloat(a.fte_value).toFixed(1)} Hrs</span>
                  </li>
                ))}
              </ul>
            )}

            <div style={{ textAlign: 'right', marginTop: '1.5rem' }}>
              <button className="btn btn-primary" onClick={() => setShowDetailModal(false)}>Close</button>
            </div>
          </>
        )}
      </Modal>
    </>
  );
}
