/**
 * One-shot patcher: adds lucide Icon usage across major LogIT pages.
 * Run: node apps/web/scripts/apply-icons.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const root = join(import.meta.dirname, '..', 'src');

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}
function write(rel, content) {
  writeFileSync(join(root, rel), content);
  console.log('wrote', rel);
}
function ensureImport(src, importLine) {
  if (src.includes(importLine)) return src;
  // after last import
  const lines = src.split('\n');
  let last = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('import ')) last = i;
  }
  lines.splice(last + 1, 0, importLine);
  return lines.join('\n');
}

// --- login ---
{
  let s = read('app/login/page.tsx');
  s = ensureImport(s, "import { LogIn } from 'lucide-react';");
  s = ensureImport(s, "import { Icon } from '@/components/Icon';");
  s = ensureImport(s, "import { BrandMarkIcon } from '@/lib/nav-icons';");
  s = s.replace(
    '<span className={styles.mark} aria-hidden />',
    `<span className={styles.mark} aria-hidden>
            <Icon icon={BrandMarkIcon} size="md" />
          </span>`,
  );
  s = s.replace(
    /\{loading \? 'Signing in…' : 'Sign in'\}/,
    `<Icon icon={LogIn} size="sm" />
            {loading ? 'Signing in…' : 'Sign in'}`,
  );
  write('app/login/page.tsx', s);
}

// --- approvals ---
{
  let s = read('app/app/approvals/page.tsx');
  s = ensureImport(s, "import { Check, ClipboardCheck, X } from 'lucide-react';");
  s = ensureImport(s, "import { EmptyState } from '@/components/EmptyState';");
  s = ensureImport(s, "import { Icon } from '@/components/Icon';");
  if (!s.includes('<EmptyState')) {
    s = s.replace(
      /\{items\.length === 0 \? \(\s*<p className=\{styles\.emptyState\}>[\s\S]*?<\/p>\s*\) : \(/,
      `{items.length === 0 ? (
          <EmptyState icon={ClipboardCheck}>
            No pending approvals right now.{' '}
            <a href="/app">Back to Home</a>
          </EmptyState>
        ) : (`,
    );
  }
  s = s.replace(/>\s*Approve\s*</, '>\n                      <Icon icon={Check} size="sm" />\n                      Approve\n                    <');
  s = s.replace(/>\s*Reject\s*</, '>\n                      <Icon icon={X} size="sm" />\n                      Reject\n                    <');
  write('app/app/approvals/page.tsx', s);
}

// --- tickets list ---
{
  let s = read('app/app/tickets/page.tsx');
  s = ensureImport(s, "import { CircleDot, Flag, Plus, Ticket } from 'lucide-react';");
  s = ensureImport(s, "import { EmptyState } from '@/components/EmptyState';");
  s = ensureImport(s, "import { Icon } from '@/components/Icon';");
  s = s.replace(
    /\{saving \? 'Submitting…' : 'Submit ticket'\}/,
    `<Icon icon={Plus} size="sm" />
                {saving ? 'Submitting…' : 'Submit ticket'}`,
  );
  if (s.includes('No tickets yet.') && !s.includes('<EmptyState icon={Ticket}')) {
    s = s.replace(
      /\{tickets\.length === 0 \? \(\s*<p className=\{styles\.empty\}>[\s\S]*?<\/p>\s*\) : \(/,
      `{tickets.length === 0 ? (
            <EmptyState icon={Ticket} className={styles.empty}>
              No tickets yet.
              {canWrite ? (
                <>
                  {' '}
                  Use the form to submit one, or{' '}
                  <a href="/app/catalog">browse the catalog</a>.
                </>
              ) : (
                <>
                  {' '}
                  <a href="/app">Back to Home</a>
                </>
              )}
            </EmptyState>
          ) : (`,
    );
  }
  write('app/app/tickets/page.tsx', s);
}

// --- knowledge ---
{
  let s = read('app/app/knowledge/page.tsx');
  s = ensureImport(s, "import { BookOpen, Plus, Send } from 'lucide-react';");
  s = ensureImport(s, "import { EmptyState } from '@/components/EmptyState';");
  s = ensureImport(s, "import { Icon } from '@/components/Icon';");
  s = s.replace(
    />\s*Create article\s*</,
    '>\n              <Icon icon={Plus} size="sm" />\n              Create article\n            <',
  );
  s = s.replace(/>\s*Publish\s*</, '>\n                      <Icon icon={Send} size="sm" />\n                      Publish\n                    <');
  if (!s.includes('<EmptyState icon={BookOpen}')) {
    s = s.replace(
      /\{items\.length === 0 \? \(\s*<p className=\{styles\.emptyState\}>[\s\S]*?<\/p>\s*\) : \(/,
      `{items.length === 0 ? (
          <EmptyState icon={BookOpen}>
            No articles yet.{' '}
            {canWrite ? (
              <a href="/app/knowledge/new">Create the first article</a>
            ) : (
              <a href="/app">Back to Home</a>
            )}
          </EmptyState>
        ) : (`,
    );
  }
  write('app/app/knowledge/page.tsx', s);
}

// --- catalog ---
{
  let s = read('app/app/catalog/page.tsx');
  s = ensureImport(s, "import { LayoutGrid, Plus, Ticket } from 'lucide-react';");
  s = ensureImport(s, "import { EmptyState } from '@/components/EmptyState';");
  s = ensureImport(s, "import { Icon } from '@/components/Icon';");
  s = s.replace(
    />\s*Create a request\s*</,
    '>\n            <Icon icon={Ticket} size="sm" />\n            Create a request\n          <',
  );
  if (!s.includes('<EmptyState icon={LayoutGrid}')) {
    s = s.replace(
      /\{items\.length === 0 \? \(\s*<p className=\{styles\.emptyState\}>[\s\S]*?<\/p>\s*\) : \(/,
      `{items.length === 0 ? (
          <EmptyState icon={LayoutGrid}>
            No catalog items yet.{' '}
            {canManage ? (
              <button type="button" className={styles.btn} onClick={() => setShowCreate(true)}>
                <Icon icon={Plus} size="sm" />
                Add the first item
              </button>
            ) : (
              <>
                You can still <a href="/app/tickets">create a ticket</a>.
              </>
            )}
          </EmptyState>
        ) : (`,
    );
  }
  write('app/app/catalog/page.tsx', s);
}

// --- assets ---
{
  let s = read('app/app/assets/page.tsx');
  s = ensureImport(s, "import { Monitor, Plus, Ticket } from 'lucide-react';");
  s = ensureImport(s, "import { EmptyState } from '@/components/EmptyState';");
  s = ensureImport(s, "import { Icon } from '@/components/Icon';");
  if (!s.includes('<EmptyState icon={Monitor}')) {
    s = s.replace(
      /\{items\.length === 0 \? \(\s*<p className=\{styles\.emptyState\}>[\s\S]*?<\/p>\s*\) : \(/,
      `{items.length === 0 ? (
          <EmptyState icon={Monitor}>
            No assets in inventory yet.{' '}
            {canWrite ? (
              <button type="button" className={styles.btn} onClick={() => setShowCreate(true)}>
                <Icon icon={Plus} size="sm" />
                Register the first asset
              </button>
            ) : (
              <a href="/app">Back to Home</a>
            )}
          </EmptyState>
        ) : (`,
    );
  }
  write('app/app/assets/page.tsx', s);
}

// --- reports ---
{
  let s = read('app/app/reports/page.tsx');
  s = ensureImport(s, "import { BarChart3, Ticket } from 'lucide-react';");
  s = ensureImport(s, "import { EmptyState } from '@/components/EmptyState';");
  s = ensureImport(s, "import { Icon } from '@/components/Icon';");
  s = s.replace(
    />\s*Open ticket queue\s*</,
    '>\n            <Icon icon={Ticket} size="sm" />\n            Open ticket queue\n          <',
  );
  if (!s.includes('<EmptyState icon={BarChart3}')) {
    s = s.replace(
      /<p className=\{styles\.emptyState\}>\s*Summary unavailable\.[\s\S]*?<\/p>/,
      `<EmptyState icon={BarChart3}>
            Summary unavailable. <a href="/app/tickets">Open Tickets</a>
          </EmptyState>`,
    );
  }
  write('app/app/reports/page.tsx', s);
}

// --- home page ---
{
  let s = read('app/app/page.tsx');
  s = ensureImport(
    s,
    "import {\n  AlertTriangle,\n  Bell,\n  CircleDot,\n  FolderOpen,\n  Ticket,\n  UserX,\n} from 'lucide-react';",
  );
  s = ensureImport(s, "import { EmptyState } from '@/components/EmptyState';");
  s = ensureImport(s, "import { Icon } from '@/components/Icon';");
  s = s.replace(
    /<h2 className=\{styles\.sectionTitle\}>Notifications<\/h2>/g,
    `<h2 className={styles.sectionTitle}>
              <Icon icon={Bell} size="sm" />
              Notifications
            </h2>`,
  );
  s = s.replace(
    /<h2 className=\{styles\.sectionTitle\}>Recent tickets<\/h2>/,
    `<h2 className={styles.sectionTitle}>
              <Icon icon={Ticket} size="sm" />
              Recent tickets
            </h2>`,
  );
  if (!s.includes('<EmptyState icon={Ticket}>')) {
    s = s.replace(
      /\{tickets\.length === 0 \? \(\s*<p className=\{styles\.emptyState\}>[\s\S]*?<\/p>\s*\) : \(/,
      `{tickets.length === 0 ? (
              <EmptyState icon={Ticket}>
                No tickets in your view yet.{' '}
                {can(user, 'tickets:write') ? (
                  <a href="/app/tickets">Create a ticket</a>
                ) : (
                  <a href="/app/tickets">Open Tickets</a>
                )}
              </EmptyState>
            ) : (`,
    );
  }
  if (s.includes('summary.openTickets') && !s.includes('statsIcon')) {
    s = s.replace(
      /\{summary \? \(\s*<div className=\{styles\.stats\}>[\s\S]*?<\/div>\s*\) : null\}/,
      `{summary ? (
          <div className={styles.stats}>
            <div>
              <span className={styles.statsIcon}><Icon icon={FolderOpen} size="sm" /></span>
              <strong>{summary.openTickets}</strong>
              <span>Open</span>
            </div>
            <div>
              <span className={styles.statsIcon}><Icon icon={Ticket} size="sm" /></span>
              <strong>{summary.createdToday}</strong>
              <span>Created today</span>
            </div>
            <div>
              <span className={styles.statsIcon}><Icon icon={CircleDot} size="sm" /></span>
              <strong>{summary.resolvedToday}</strong>
              <span>Resolved today</span>
            </div>
            <div>
              <span className={styles.statsIcon}><Icon icon={AlertTriangle} size="sm" /></span>
              <strong>{summary.slaBreaches}</strong>
              <span>SLA breaches</span>
            </div>
            <div>
              <span className={styles.statsIcon}><Icon icon={UserX} size="sm" /></span>
              <strong>{summary.unassigned}</strong>
              <span>Unassigned</span>
            </div>
          </div>
        ) : null}`,
    );
  }
  write('app/app/page.tsx', s);
}

// --- ticket detail ---
{
  const rel = 'app/app/tickets/[id]/page.tsx';
  if (!existsSync(join(root, rel))) {
    console.log('skip', rel);
  } else {
    let s = read(rel);
    s = ensureImport(
      s,
      "import {\n  ArrowLeft,\n  CircleDot,\n  Flag,\n  MessageSquare,\n  Save,\n  Trash2,\n  UserRound,\n} from 'lucide-react';",
    );
    s = ensureImport(s, "import { Icon } from '@/components/Icon';");
    s = s.replace(
      /<a href="\/app\/tickets">(?:← )?Tickets<\/a>|<a href="\/app\/tickets">Back to Tickets<\/a>/,
      `<a href="/app/tickets">
          <Icon icon={ArrowLeft} size="sm" />
          Back to Tickets
        </a>`,
    );
    s = s.replace(
      /aria-label=\{`Delete ticket \$\{ticket\.number\}`\}\s*onClick=\{onDelete\}\s*>\s*Delete\s*</,
      `aria-label={\`Delete ticket \${ticket.number}\`}
                  onClick={onDelete}
                >
                  <Icon icon={Trash2} size="sm" />
                  Delete
                <`,
    );
    s = s.replace(
      /\{saving \? 'Saving…' : 'Save assignment'\}|Save assignment/,
      (m) =>
        m.includes('Icon')
          ? m
          : `<Icon icon={Save} size="sm" />\n                  Save assignment`,
    );
    // only first occurrence if duplicated awkwardly — cleanup later via build
    write(rel, s);
  }
}

// --- attachments ---
{
  let s = read('components/TicketAttachments.tsx');
  s = ensureImport(s, "import { Download, Paperclip, Trash2 } from 'lucide-react';");
  s = ensureImport(s, "import { EmptyState } from '@/components/EmptyState';");
  s = ensureImport(s, "import { Icon } from '@/components/Icon';");
  s = s.replace(
    /\{busy \? 'Uploading…' : 'Attach files'\}/,
    `<Icon icon={Paperclip} size="sm" />
              {busy ? 'Uploading…' : 'Attach files'}`,
  );
  s = s.replace(/>\s*Choose files\s*</, '>\n          <Icon icon={Paperclip} size="sm" />\n          Choose files\n        <');
  s = s.replace(/>\s*Download\s*</g, '>\n                <Icon icon={Download} size="sm" />\n                Download\n              <');
  if (!s.includes('<EmptyState icon={Paperclip}>')) {
    s = s.replace(
      /\{attachments\.length === 0 \? \(\s*<p className=\{styles\.empty\}>[\s\S]*?<\/p>\s*\) : \(/,
      `{attachments.length === 0 ? (
        <EmptyState icon={Paperclip}>
          {canUpload
            ? 'No files yet — use Attach files to add screenshots or documents.'
            : 'No attachments on this ticket.'}
        </EmptyState>
      ) : (`,
    );
  }
  write('components/TicketAttachments.tsx', s);
}

console.log('done');
