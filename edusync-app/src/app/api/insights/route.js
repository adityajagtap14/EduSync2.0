import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';

function generateLocalInsights(faculty, activities, settings) {
  const maxHours = parseFloat(settings?.max_weekly_hours || '40');
  const insights = [];

  const fteMap = {};
  (activities || []).forEach(a => { fteMap[a.faculty_id] = (fteMap[a.faculty_id] || 0) + parseFloat(a.fte_value || 0); });

  const overloaded = (faculty || []).filter(f => (fteMap[f.id] || 0) > maxHours);
  const underloaded = (faculty || []).filter(f => (fteMap[f.id] || 0) < maxHours * 0.5);
  const fteValues = Object.values(fteMap);
  const avgFte = fteValues.length ? (fteValues.reduce((s, v) => s + v, 0) / fteValues.length).toFixed(1) : 0;

  if (overloaded.length > 0) {
    const names = overloaded.map(f => f.name).join(', ');
    insights.push({
      title: 'Workload Alert',
      text: `${names} ${overloaded.length > 1 ? 'are' : 'is'} exceeding the ${maxHours}-hour weekly limit. Consider redistribution.`,
      type: 'warning',
    });
  } else {
    insights.push({
      title: 'Compliance Healthy',
      text: `All faculty are within the ${maxHours}-hour weekly FTE limit. The institution is fully compliant.`,
      type: 'success',
    });
  }

  if (underloaded.length > 0) {
    const names = underloaded.slice(0, 2).map(f => `${f.name} (${(fteMap[f.id] || 0).toFixed(1)} hrs)`).join(', ');
    insights.push({
      title: 'Capacity Available',
      text: `${names} ${underloaded.length > 2 ? `and ${underloaded.length - 2} others` : ''} are below 50% capacity and can take on more duties.`,
      type: 'info',
    });
  } else {
    insights.push({
      title: 'Optimal Utilization',
      text: `All faculty are above 50% FTE utilization. Average workload is ${avgFte} hours.`,
      type: 'success',
    });
  }

  const deptFte = {};
  (faculty || []).forEach(f => { const dept = f.department; deptFte[dept] = (deptFte[dept] || 0) + (fteMap[f.id] || 0); });
  const depts = Object.entries(deptFte).sort((a, b) => b[1] - a[1]);
  if (depts.length >= 2) {
    insights.push({
      title: 'Department Imbalance',
      text: `${depts[0][0]} has the highest aggregate FTE (${depts[0][1].toFixed(1)} hrs) while ${depts[depts.length - 1][0]} has the lowest (${depts[depts.length - 1][1].toFixed(1)} hrs).`,
      type: 'info',
    });
  }

  return insights.slice(0, 3);
}

export async function POST(req) {
  try {
    const { faculty, activities, settings } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;

    // Try Gemini AI first
    if (apiKey && apiKey.trim() !== '' && apiKey !== 'your_gemini_api_key_here') {
      try {
        const maxHours = parseFloat(settings?.max_weekly_hours || '40');
        const facultySummary = (faculty || []).map(f => {
          const fActs = (activities || []).filter(a => a.faculty_id === f.id);
          const totalFte = fActs.reduce((s, a) => s + parseFloat(a.fte_value || 0), 0);
          return `${f.name} (${f.department}) FTE: ${totalFte.toFixed(1)}/${maxHours}`;
        }).join('\\n');

        const prompt = `You are an academic workload advisor. Analyze this faculty data and give exactly 3 short, actionable insights mentioning names. Format strictly as a JSON array of 3 objects: [{"title": "short title", "text": "insight text", "type": "warning|success|info"}]. Data: ${facultySummary}`;

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
        const result = await model.generateContent(prompt);
        const text = result.response.text().trim();

        const jsonMatch = text.match(/\\[[\\s\\S]*\\]/);
        if (jsonMatch) {
          return NextResponse.json({ insights: JSON.parse(jsonMatch[0]), source: 'gemini' });
        }
      } catch (err) {
        console.log('Gemini failed, falling back to local analysis:', err.message);
      }
    }

    // Fallback: generate insights locally
    const insights = generateLocalInsights(faculty, activities, settings);
    return NextResponse.json({ insights, source: 'local' });
    
  } catch (err) {
    console.error('API Error:', err);
    return NextResponse.json({ error: 'Failed to process request.' }, { status: 500 });
  }
}
