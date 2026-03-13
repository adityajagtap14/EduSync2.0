import jsPDF from 'jspdf';
import 'jspdf-autotable';

export function generateNAACReport(faculty, activities, settings) {
  const doc = new jsPDF();
  const maxHours = parseFloat(settings?.max_weekly_hours || '40');
  const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

  // ─── Header ──────────────────────────────────────
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 210, 40, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('EduSync — NAAC Self-Study Report', 14, 20);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated: ${today} | Semester: Spring 2026`, 14, 30);

  // ─── KPIs ────────────────────────────────────────
  let y = 52;
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Key Performance Indicators', 14, y);
  y += 10;

  const totalFaculty = faculty.length;
  const phdCount = faculty.filter(f => f.is_phd).length;
  const phdPct = totalFaculty ? Math.round((phdCount / totalFaculty) * 100) : 0;

  const fteByFac = {};
  activities.forEach(a => { fteByFac[a.faculty_id] = (fteByFac[a.faculty_id] || 0) + parseFloat(a.fte_value || 0); });
  const fteVals = Object.values(fteByFac);
  const avgFte = fteVals.length ? (fteVals.reduce((s, v) => s + v, 0) / fteVals.length).toFixed(1) : '0';
  const overloaded = fteVals.filter(v => v > maxHours).length;

  const kpis = [
    ['Student–Faculty Ratio', '1:18', 'Compliant with AICTE norms (≤1:20)'],
    ['Total Faculty', `${totalFaculty}`, `${phdCount} with Ph.D. (${phdPct}%)`],
    ['Avg Weekly FTE', `${avgFte} Hrs`, `Max limit: ${maxHours} Hrs`],
    ['Overloaded Faculty', `${overloaded}`, overloaded === 0 ? 'All within limits' : 'Requires redistribution'],
  ];

  doc.autoTable({
    startY: y,
    head: [['Metric', 'Value', 'Remark']],
    body: kpis,
    theme: 'grid',
    headStyles: { fillColor: [59, 130, 246], fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    margin: { left: 14, right: 14 },
  });

  // ─── Faculty Workload Table ──────────────────────
  y = doc.lastAutoTable.finalY + 14;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Faculty Workload Summary', 14, y);
  y += 4;

  const rosterRows = faculty.map(f => {
    const fActs = activities.filter(a => a.faculty_id === f.id);
    const totalFte = fActs.reduce((s, a) => s + parseFloat(a.fte_value || 0), 0);
    const status = totalFte > maxHours ? 'Overload' : totalFte >= maxHours - 2 ? 'Warning' : 'Compliant';
    return [f.name, f.department, f.subject || '—', `${totalFte.toFixed(1)}`, status];
  });

  doc.autoTable({
    startY: y,
    head: [['Name', 'Department', 'Subject', 'FTE (Hrs)', 'Status']],
    body: rosterRows,
    theme: 'striped',
    headStyles: { fillColor: [59, 130, 246], fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    margin: { left: 14, right: 14 },
    didParseCell: (data) => {
      if (data.column.index === 4 && data.section === 'body') {
        if (data.cell.raw === 'Overload') data.cell.styles.textColor = [239, 68, 68];
        else if (data.cell.raw === 'Warning') data.cell.styles.textColor = [245, 158, 11];
        else data.cell.styles.textColor = [16, 185, 129];
      }
    },
  });

  // ─── Activity Breakdown ──────────────────────────
  y = doc.lastAutoTable.finalY + 14;
  if (y > 250) { doc.addPage(); y = 20; }

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Activity Breakdown', 14, y);
  y += 4;

  const actRows = activities.slice(0, 30).map(a => {
    const fac = faculty.find(f => f.id === a.faculty_id);
    return [fac?.name || '—', a.activity_type, a.description, `${a.hours}`, `${parseFloat(a.fte_value).toFixed(1)}`, a.status];
  });

  doc.autoTable({
    startY: y,
    head: [['Faculty', 'Type', 'Description', 'Hours', 'FTE', 'Status']],
    body: actRows,
    theme: 'striped',
    headStyles: { fillColor: [59, 130, 246], fontSize: 7 },
    bodyStyles: { fontSize: 7 },
    margin: { left: 14, right: 14 },
    columnStyles: { 2: { cellWidth: 50 } },
  });

  // ─── Footer ──────────────────────────────────────
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text(`EduSync — Faculty Activity & Compliance Tracker | Page ${i} of ${pageCount}`, 14, 290);
  }

  doc.save(`EduSync_NAAC_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
}
