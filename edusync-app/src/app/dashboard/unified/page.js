'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/Toast';
import KpiCard from '@/components/KpiCard';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

// ─── CSV Download ──────────────────────────────────────────────────
function downloadCSV(faculty, activities) {
  const rows = [['Name', 'Department', 'Subject', 'Activity', 'Description', 'Hours', 'FTE', 'Status']];
  const fMap = {};
  faculty.forEach(f => { fMap[f.id] = f; });
  activities.forEach(a => {
    const f = fMap[a.faculty_id] || {};
    rows.push([f.name || '', f.department || '', f.subject || '', a.activity_type, a.description, a.hours, a.fte_value, a.status]);
  });
  const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `edusync_report_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function UnifiedPage() {
  const showToast = useToast();
  const [kpis, setKpis] = useState(null);
  const [chartData, setChartData] = useState(null);
  const [feed, setFeed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [allFaculty, setAllFaculty] = useState([]);
  const [allActivities, setAllActivities] = useState([]);
  const [allSettings, setAllSettings] = useState({});

  // AI Insights state
  const [insights, setInsights] = useState([]);
  const [insightsLoading, setInsightsLoading] = useState(false);

  // PDF state
  const [pdfLoading, setPdfLoading] = useState(false);

  const processData = useCallback((faculty, activities, settingsObj) => {
    const maxHours = parseFloat(settingsObj.max_weekly_hours || '40');
    const totalFaculty = faculty.length;
    const phdCount = faculty.filter(f => f.is_phd).length;
    const phdProportion = totalFaculty ? Math.round((phdCount / totalFaculty) * 1000) / 10 : 0;

    const fteByFaculty = {};
    activities.forEach(a => { fteByFaculty[a.faculty_id] = (fteByFaculty[a.faculty_id] || 0) + parseFloat(a.fte_value || 0); });
    const fteValues = Object.values(fteByFaculty);
    const avgFte = fteValues.length ? Math.round((fteValues.reduce((s, v) => s + v, 0) / fteValues.length) * 10) / 10 : 0;

    setKpis({
      sfr: '1:18', sfrStatus: 'Compliant',
      phdProportion: `${phdProportion}%`, phdStatus: phdProportion >= 30 ? 'Exceeds Mandate' : 'Below Mandate',
      avgFte: `${avgFte} Hrs`, avgFteStatus: avgFte < maxHours - 2 ? 'Healthy' : avgFte < maxHours ? 'Nearing Limit' : 'Critical',
    });

    // Chart
    const fidToDept = {};
    faculty.forEach(f => { fidToDept[f.id] = f.department; });
    const deptFte = {}, deptFaculty = {};
    activities.forEach(a => {
      const dept = fidToDept[a.faculty_id] || 'Unknown';
      deptFte[dept] = (deptFte[dept] || 0) + parseFloat(a.fte_value || 0);
      if (!deptFaculty[dept]) deptFaculty[dept] = new Set();
      deptFaculty[dept].add(a.faculty_id);
    });
    const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4'];
    const labels = Object.keys(deptFte).sort();
    setChartData({
      labels,
      datasets: [{ label: 'Avg FTE', data: labels.map(d => Math.round((deptFte[d] / (deptFaculty[d]?.size || 1)) * 10) / 10), backgroundColor: labels.map((_, i) => colors[i % colors.length]), borderRadius: 6 }],
    });

    // Feed
    const facultyMap = {};
    faculty.forEach(f => { facultyMap[f.id] = f.name; });
    setFeed(activities.slice(0, 8).map(a => ({
      name: facultyMap[a.faculty_id] || 'Unknown',
      text: `${a.activity_type}: ${a.description}`,
      hours: a.hours,
    })));
  }, []);

  useEffect(() => {
    async function loadData() {
      try {
        const { data: faculty } = await supabase.from('faculty').select('*');
        const { data: activities } = await supabase.from('activities').select('*').order('created_at', { ascending: false });
        const { data: settingsData } = await supabase.from('settings').select('*');

        if (!faculty || !activities) return;
        setAllFaculty(faculty);
        setAllActivities(activities);

        const settingsObj = {};
        (settingsData || []).forEach(s => { settingsObj[s.key] = s.value; });
        setAllSettings(settingsObj);

        processData(faculty, activities, settingsObj);
      } catch (err) {
        showToast('Failed to load data.', 'error');
      }
      setLoading(false);
    }
    loadData();
  }, [processData, showToast]);

  // ─── Feature 3: Supabase Realtime ────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel('activities-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activities' }, (payload) => {
        const newAct = payload.new;
        setAllActivities(prev => {
          const updated = [newAct, ...prev];
          // Re-process the data with the new activity
          processData(allFaculty, updated, allSettings);
          return updated;
        });
        showToast('New activity logged — dashboard updated.', 'success');
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [allFaculty, allSettings, processData, showToast]);

  // ─── Feature 1: Fetch AI Insights ────────────────────────────────
  async function fetchInsights() {
    setInsightsLoading(true);
    try {
      const res = await fetch('/api/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ faculty: allFaculty, activities: allActivities, settings: allSettings }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setInsights(data.insights || []);
    } catch (err) {
      showToast('AI analysis failed: ' + err.message, 'error');
    }
    setInsightsLoading(false);
  }

  // ─── Feature 2: Generate PDF Report ──────────────────────────────
  async function handleGeneratePDF() {
    setPdfLoading(true);
    try {
      // Dynamic import to avoid SSR issues with jsPDF
      const { generateNAACReport } = await import('@/lib/generateReport');
      generateNAACReport(allFaculty, allActivities, allSettings);
      showToast('NAAC report downloaded.', 'success');
    } catch (err) {
      showToast('PDF generation failed: ' + err.message, 'error');
    }
    setPdfLoading(false);
  }

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}><div className="spinner"></div></div>;

  const insightIcons = { warning: '⚠️', success: '✅', info: '💡' };

  return (
    <>
      <header className="header-bar">
        <div>
          <h1 style={{ fontSize: '1.8rem' }}>Dashboard</h1>
          <p style={{ color: 'var(--text-muted)' }}>Institutional workload and compliance at a glance.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-outline" onClick={() => { downloadCSV(allFaculty, allActivities); showToast('CSV downloaded.', 'success'); }}>
            <i className="fa-solid fa-file-csv"></i> CSV
          </button>
          <button className="btn btn-primary" onClick={handleGeneratePDF} disabled={pdfLoading}>
            {pdfLoading ? <><i className="fa-solid fa-circle-notch fa-spin"></i> Generating...</> : <><i className="fa-solid fa-file-pdf"></i> NAAC Report</>}
          </button>
        </div>
      </header>

      {kpis && (
        <div className="kpi-grid">
          <KpiCard title="Student-Faculty Ratio" value={kpis.sfr} badge={kpis.sfrStatus} badgeType="success" />
          <KpiCard title="Ph.D. Proportion" value={kpis.phdProportion} badge={kpis.phdStatus} badgeType="success" />
          <KpiCard title="Avg Weekly FTE" value={kpis.avgFte} badge={kpis.avgFteStatus} badgeType={kpis.avgFteStatus === 'Healthy' ? 'success' : kpis.avgFteStatus === 'Critical' ? 'danger' : 'warning'} />
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
        <div className="card" style={{ marginBottom: 0 }}>
          <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>Department Workload (Avg FTE)</h3>
          <div style={{ height: '250px', position: 'relative' }}>
            {chartData && <Bar data={chartData} options={{
              responsive: true, maintainAspectRatio: false,
              plugins: { legend: { display: false } },
              scales: {
                y: { max: 50, grid: { color: 'rgba(51,65,85,0.3)', borderDash: [5, 5] }, ticks: { color: '#64748b' } },
                x: { grid: { display: false }, ticks: { color: '#64748b' } },
              },
            }} />}
          </div>
        </div>

        <div className="card" style={{ marginBottom: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1.1rem' }}>Recent Activities</h3>
            <span className="badge badge-success"><span className="pulse" style={{ marginRight: 4 }}></span> Live</span>
          </div>
          <div className="live-feed">
            {feed.map((item, i) => (
              <div className="feed-item" key={i}>
                <div className="feed-icon">📋</div>
                <div>
                  <div className="feed-text"><strong>{item.name}</strong> — {item.text}</div>
                  <div className="feed-time"><span className="pulse"></span> {item.hours} hrs</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Feature 1: AI Insights Panel ────────────────────────── */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '1.1rem' }}><i className="fa-solid fa-wand-magic-sparkles" style={{ color: 'var(--accent)', marginRight: 8 }}></i>AI Insights</h3>
          <button className="btn btn-outline" onClick={fetchInsights} disabled={insightsLoading} style={{ fontSize: '0.8rem' }}>
            {insightsLoading ? <><i className="fa-solid fa-circle-notch fa-spin"></i> Analyzing...</> : <><i className="fa-solid fa-bolt"></i> Analyze</>}
          </button>
        </div>

        {insights.length === 0 && !insightsLoading && (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Click <strong>Analyze</strong> to get AI-powered workload recommendations from Gemini.
          </p>
        )}

        {insights.length > 0 && (
          <div style={{ display: 'grid', gap: '12px' }}>
            {insights.map((ins, i) => (
              <div key={i} className="insight-box" style={{
                borderLeftColor: ins.type === 'warning' ? 'var(--warning)' : ins.type === 'success' ? 'var(--success)' : 'var(--primary)',
                borderLeftWidth: '3px',
                borderLeftStyle: 'solid',
              }}>
                <strong>{insightIcons[ins.type] || '💡'} {ins.title}</strong>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px' }}>{ins.text}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
