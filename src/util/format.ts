import type { Sermon } from '../types';

export function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export function formatDate(epochMs: number): string {
  const d = new Date(epochMs);
  return d.toLocaleString();
}

export function sermonToMarkdown(sermon: Sermon): string {
  const lines: string[] = [];
  lines.push(`# ${sermon.outline.title}`);
  lines.push('');
  lines.push(`*Recorded ${formatDate(sermon.createdAt)} — ${formatElapsed(sermon.durationMs)}*`);
  lines.push('');
  if (sermon.outline.theme) {
    lines.push(`**Theme:** ${sermon.outline.theme}`);
    lines.push('');
  }
  if (sermon.outline.summary) {
    lines.push(sermon.outline.summary);
    lines.push('');
  }
  lines.push('## Outline');
  lines.push('');
  sermon.outline.points.forEach((p, i) => {
    lines.push(`### ${i + 1}. ${p.heading}`);
    p.subPoints.forEach((sp) => lines.push(`- ${sp}`));
    if (p.scriptures.length) {
      lines.push('');
      lines.push(`*Scriptures:* ${p.scriptures.join(', ')}`);
    }
    lines.push('');
  });
  if (sermon.scriptures.length) {
    lines.push('## Scriptures');
    lines.push('');
    sermon.scriptures.forEach((s) => {
      lines.push(`**${s.reference}**${s.translation ? ` (${s.translation})` : ''}`);
      if (s.text) lines.push(`> ${s.text}`);
      lines.push('');
    });
  }
  lines.push('## Transcript');
  lines.push('');
  lines.push(sermon.transcript || '*(no transcript)*');
  return lines.join('\n');
}
