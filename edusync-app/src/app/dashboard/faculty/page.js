'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/Toast';
import KpiCard from '@/components/KpiCard';
import Modal from '@/components/Modal';
import { fetchOrcidWorks } from '@/lib/orcid';

export default function FacultyPage() {
  const showToast = useToast();
  const [faculty, setFaculty] = useState(null);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showLogModal, setShowLogModal] = useState(false);

  const [actType, setActType] = useState('Lecture');
  const [actDesc, setActDesc] = useState('');
  const [actHours, setActHours] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // ORCID state
  const [orcidId, setOrcidId] = useState('');
  const [publications, setPublications] = useState([]);
  const [orcidLoading, setOrcidLoading] = useState(false);
  const [showOrcidModal, setShowOrcidModal] = useState(false);

  useEffect(() => { loadFacultyData(); }, []);

  async function loadFacultyData() {
    try {
      const stored = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('edusync_user') || '{}') : {};
      const { data: allFaculty } = await supabase.from('faculty').select('*');
      const { data: allActivities } = await supabase.from('activities').select('*').order('created_at', { ascending: false });

      if (!allFaculty || allFaculty.length === 0) { setLoading(false); return; }

      const me = allFaculty.find(f => f.email === stored.email);
      if (!me) { showToast('No faculty profile found for your account.', 'error'); setLoading(false); return; }
      setFaculty(me);
      setActivities((allActivities || []).filter(a => a.faculty_id === me.id));
    } catch (err) {
      showToast('Failed to load data.', 'error');
    }
    setLoading(false);
  }

  const totalFte = activities.reduce((sum, a) => sum + parseFloat(a.fte_value || 0), 0);
  const cappedFte = Math.min(totalFte, 40);
  const status = totalFte > 40 ? 'Overload' : totalFte >= 38 ? 'Warning' : 'Compliant';

  async function handleSubmitActivity(e) {
    e.preventDefault();
    if (!actDesc || !actHours || !faculty) return;
    setSubmitting(true);

    const multipliers = { Lecture: 2.0, Laboratory: 1.5, Clinical: 1.5, Workshop: 1.5 };
    const fteValue = Math.round(parseFloat(actHours) * (multipliers[actType] || 1.0) * 10) / 10;

    try {
      const { data: newActivity, error } = await supabase
        .from('activities')
        .insert({ faculty_id: faculty.id, activity_type: actType, description: actDesc, hours: parseFloat(actHours), fte_value: fteValue, status: 'Verified' })
        .select().single();

      if (error) throw new Error(error.message);
      setActivities(prev => [newActivity, ...prev]);
      showToast(`Activity logged — ${fteValue} FTE.`, 'success');
      setShowLogModal(false);
      setActDesc(''); setActHours(''); setActType('Lecture');
    } catch (err) {
      showToast('Failed to save.', 'error');
    }
    setSubmitting(false);
  }

  async function handleDeleteActivity(id) {
    try {
      const { error } = await supabase.from('activities').delete().eq('id', id);
      if (error) throw new Error(error.message);
      setActivities(prev => prev.filter(a => a.id !== id));
      showToast('Activity removed.', 'success');
    } catch (err) {
      showToast('Failed to delete.', 'error');
    }
  }

  // ─── Feature 4: ORCID Import ─────────────────────────────────────
  async function handleOrcidFetch() {
    setOrcidLoading(true);
    try {
      const works = await fetchOrcidWorks(orcidId.trim());
      setPublications(works);
      showToast(`Imported ${works.length} publications from ORCID.`, 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
    setOrcidLoading(false);
  }

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}><div className="spinner"></div></div>;

  const user = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('edusync_user') || '{}') : {};

  return (
    <>
      <header className="header-bar">
        <div>
          <h1 style={{ fontSize: '1.8rem' }}>My Workload</h1>
          <p style={{ color: 'var(--text-muted)' }}>Welcome, <strong>{user.name || 'Faculty'}</strong>.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-outline" onClick={() => setShowOrcidModal(true)}>
            <i className="fa-solid fa-book-open"></i> Import ORCID
          </button>
          <button className="btn btn-primary" onClick={() => setShowLogModal(true)}>
            <i className="fa-solid fa-plus"></i> Log Activity
          </button>
        </div>
      </header>

      <div className="kpi-grid">
        <KpiCard title="Tracked FTE" value={`${cappedFte.toFixed(1)} / 40.0`} badge={status} badgeType={status === 'Overload' ? 'danger' : status === 'Warning' ? 'warning' : 'success'} />
        <KpiCard title="Activities Logged" value={`${activities.length}`} badge="This Semester" badgeType="neutral" />
        <KpiCard title="Publications" value={`${publications.length}`} badge={publications.length > 0 ? 'Via ORCID' : 'Import from ORCID'} badgeType={publications.length > 0 ? 'success' : 'neutral'} />
      </div>

      <div className="card">
        <h3 style={{ marginBottom: '1.5rem' }}>Activity Log</h3>
        <table>
          <thead><tr><th>Date</th><th>Type</th><th>Description</th><th>Hours</th><th>FTE</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {activities.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No activities on record.</td></tr>
            ) : (
              activities.map(a => (
                <tr key={a.id}>
                  <td>{new Date(a.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}</td>
                  <td>{a.activity_type}</td>
                  <td>{a.description}</td>
                  <td>{a.hours}</td>
                  <td><strong>{parseFloat(a.fte_value).toFixed(1)}</strong></td>
                  <td><span className="badge badge-success">{a.status}</span></td>
                  <td>
                    <button className="btn btn-outline" style={{ padding: '2px 8px', fontSize: '0.75rem', color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={() => handleDeleteActivity(a.id)} title="Delete">
                      <i className="fa-solid fa-trash"></i>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Publications from ORCID */}
      {publications.length > 0 && (
        <div className="card">
          <h3 style={{ marginBottom: '1.5rem' }}>
            <i className="fa-solid fa-graduation-cap" style={{ color: 'var(--accent)', marginRight: 8 }}></i>
            Publications (ORCID)
          </h3>
          <table>
            <thead><tr><th>Title</th><th>Year</th><th>Journal</th><th>Type</th><th>DOI</th></tr></thead>
            <tbody>
              {publications.map((p, i) => (
                <tr key={i}>
                  <td><strong>{p.title}</strong></td>
                  <td>{p.year}</td>
                  <td>{p.journal}</td>
                  <td><span className="badge badge-neutral" style={{ textTransform: 'capitalize' }}>{p.type}</span></td>
                  <td>{p.doi ? <a href={`https://doi.org/${p.doi}`} target="_blank" rel="noopener noreferrer">{p.doi}</a> : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Log Activity Modal */}
      <Modal isOpen={showLogModal} onClose={() => setShowLogModal(false)} title="Log Activity">
        <form onSubmit={handleSubmitActivity}>
          <div className="form-group">
            <label>Category</label>
            <select value={actType} onChange={(e) => setActType(e.target.value)}>
              <option value="Lecture">Lecture / Teaching</option>
              <option value="Laboratory">Laboratory / Workshop</option>
              <option value="Administrative">Administrative</option>
              <option value="Research">Research</option>
              <option value="Mentoring">Mentoring</option>
              <option value="Clinical">Clinical / Practical</option>
            </select>
          </div>
          <div className="form-group">
            <label>Description</label>
            <input type="text" placeholder="e.g. CS-101 Midterm Grading" value={actDesc} onChange={(e) => setActDesc(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Hours</label>
            <input type="number" step="0.5" min="0.5" max="20" value={actHours} onChange={(e) => setActHours(e.target.value)} required />
          </div>
          <div style={{ display: 'flex', gap: '10px', marginTop: '1.5rem' }}>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={submitting}>
              {submitting ? <><i className="fa-solid fa-circle-notch fa-spin"></i> Saving...</> : 'Save'}
            </button>
            <button type="button" className="btn btn-outline" onClick={() => setShowLogModal(false)}>Cancel</button>
          </div>
        </form>
      </Modal>

      {/* ORCID Import Modal */}
      <Modal isOpen={showOrcidModal} onClose={() => setShowOrcidModal(false)} title="Import from ORCID">
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
          Enter your ORCID ID to fetch your publications from the ORCID public registry.
        </p>
        <div className="form-group">
          <label>ORCID ID</label>
          <input type="text" placeholder="0000-0002-1825-0097" value={orcidId} onChange={(e) => setOrcidId(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: '10px', marginTop: '1.5rem' }}>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleOrcidFetch} disabled={orcidLoading || !orcidId.trim()}>
            {orcidLoading ? <><i className="fa-solid fa-circle-notch fa-spin"></i> Fetching...</> : <><i className="fa-solid fa-download"></i> Import</>}
          </button>
          <button className="btn btn-outline" onClick={() => setShowOrcidModal(false)}>Cancel</button>
        </div>
      </Modal>
    </>
  );
}
