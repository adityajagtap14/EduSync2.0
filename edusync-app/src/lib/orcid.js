const ORCID_API = 'https://pub.orcid.org/v3.0';

export async function fetchOrcidWorks(orcidId) {
  if (!orcidId || !/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(orcidId)) {
    throw new Error('Invalid ORCID ID format. Use: 0000-0000-0000-0000');
  }

  const res = await fetch(`${ORCID_API}/${orcidId}/works`, {
    headers: { 'Accept': 'application/json' },
  });

  if (!res.ok) {
    if (res.status === 404) throw new Error('ORCID profile not found.');
    throw new Error(`ORCID API error (${res.status})`);
  }

  const data = await res.json();
  const works = (data.group || []).map(g => {
    const summary = g['work-summary']?.[0];
    if (!summary) return null;

    const title = summary.title?.title?.value || 'Untitled';
    const year = summary['publication-date']?.year?.value || '—';
    const journal = summary['journal-title']?.value || '—';
    const type = summary.type?.replace(/-/g, ' ') || 'publication';
    const doi = summary['external-ids']?.['external-id']?.find(e => e['external-id-type'] === 'doi')?.['external-id-value'];

    return { title, year, journal, type, doi };
  }).filter(Boolean);

  return works;
}
