import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';

export async function POST(req) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'GEMINI_API_KEY not set in .env' }, { status: 500 });
  }

  try {
    const { faculty, activities, settings } = await req.json();

    const maxHours = parseFloat(settings?.max_weekly_hours || '40');

    // Build a concise data summary for the AI
    const facultySummary = (faculty || []).map(f => {
      const fActs = (activities || []).filter(a => a.faculty_id === f.id);
      const totalFte = fActs.reduce((s, a) => s + parseFloat(a.fte_value || 0), 0);
      const status = totalFte > maxHours ? 'OVERLOADED' : totalFte >= maxHours - 2 ? 'WARNING' : 'OK';
      return `${f.name} (${f.department}) — FTE: ${totalFte.toFixed(1)}/${maxHours}, Status: ${status}, Activities: ${fActs.length}`;
    }).join('\n');

    const prompt = `You are an academic workload advisor for an engineering college. Analyze this faculty data and give exactly 3 short, actionable insights. Be specific — mention names and numbers. Each insight should be 1-2 sentences max.

Faculty Data:
${facultySummary}

Format your response as a JSON array of 3 objects: [{"title": "short title", "text": "insight text", "type": "warning|success|info"}]
Return ONLY the JSON array, no markdown.`;

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    // Parse the JSON from the response
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return NextResponse.json({ insights: [{ title: 'Analysis Complete', text: text.slice(0, 200), type: 'info' }] });
    }

    const insights = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ insights });
  } catch (err) {
    console.error('Gemini API error:', err);
    return NextResponse.json({ error: err.message || 'AI analysis failed' }, { status: 500 });
  }
}
