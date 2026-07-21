import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join } from 'path';

const root = 'D:/koa.ticketing/apps/web/src';

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx|ts)$/.test(name)) out.push(p);
  }
  return out;
}

function ensureImport(src, line) {
  if (src.includes(line)) return src;
  const lines = src.split('\n');
  let last = 0;
  for (let i = 0; i < lines.length; i++) if (lines[i].startsWith('import ')) last = i;
  lines.splice(last + 1, 0, line);
  return lines.join('\n');
}

let fixed = 0;
for (const file of walk(root)) {
  let s = readFileSync(file, 'utf8');
  const before = s;
  s = s.replace(/(\s*<Icon icon=\{[^}]+\} size="[^"]+" \/>\s*)\1+/g, '$1');
  const lines = s.split('\n');
  const seen = new Set();
  const out = [];
  for (const line of lines) {
    if (
      line.startsWith('import ') &&
      (line.includes("from 'lucide-react'") ||
        line.includes("from '@/components/Icon'") ||
        line.includes("from '@/components/EmptyState'") ||
        line.includes("from '@/lib/nav-icons'"))
    ) {
      const key = line.trim();
      if (seen.has(key)) continue;
      seen.add(key);
    }
    out.push(line);
  }
  s = out.join('\n');
  if (s !== before) {
    writeFileSync(file, s);
    fixed++;
    console.log('deduped', file.replace(root, ''));
  }
}
console.log('DEDUPED', fixed);

function patch(file, fn) {
  if (!existsSync(file)) {
    console.log('skip', file);
    return;
  }
  let s = readFileSync(file, 'utf8');
  s = fn(s);
  writeFileSync(file, s);
  console.log('patched', file.split(/[/\\]/).slice(-2).join('/'));
}

patch(join(root, 'app/app/admin/roles/page.tsx'), (s) => {
  s = ensureImport(s, "import { Save, Users } from 'lucide-react';");
  s = ensureImport(s, "import { Icon } from '@/components/Icon';");
  if (!s.includes('icon={Save}')) {
    s = s.replace(
      "{saving ? 'Saving…' : 'Save roles'}",
      "<Icon icon={Save} size=\"sm\" />\n                      {saving ? 'Saving…' : 'Save roles'}",
    );
  }
  if (s.includes('Select a user') && !s.includes('<Icon icon={Users}')) {
    s = s.replace(
      '<div className={styles.emptyPanel}>\n                  <strong>Select a user</strong>',
      '<div className={styles.emptyPanel}>\n                  <Icon icon={Users} size="lg" />\n                  <strong>Select a user</strong>',
    );
  }
  return s;
});

patch(join(root, 'app/app/admin/teams/page.tsx'), (s) => {
  s = ensureImport(s, "import { Plus, Save, Users } from 'lucide-react';");
  s = ensureImport(s, "import { EmptyState } from '@/components/EmptyState';");
  s = ensureImport(s, "import { Icon } from '@/components/Icon';");
  if (!s.includes('icon={Plus}')) {
    s = s.replace(
      "{busy ? 'Creating…' : 'Create team'}",
      "<Icon icon={Plus} size=\"sm\" />\n                    {busy ? 'Creating…' : 'Create team'}",
    );
  }
  if (!s.includes('icon={Save}')) {
    s = s.replace(
      "{busy ? 'Saving…' : 'Save changes'}",
      "<Icon icon={Save} size=\"sm\" />\n                        {busy ? 'Saving…' : 'Save changes'}",
    );
  }
  if (!s.includes('<EmptyState icon={Users}>')) {
    s = s.replace(
      /<p className=\{styles\.empty\}>\s*No teams yet[\s\S]*?<\/p>/,
      '<EmptyState icon={Users}>No teams yet. Create a service team to route work.</EmptyState>',
    );
    s = s.replace(
      /<p className=\{styles\.empty\}>Select a team to view details\.\s*<\/p>/,
      '<EmptyState icon={Users}>Select a team to view details.</EmptyState>',
    );
  }
  return s;
});

patch(join(root, 'app/app/admin/branding/page.tsx'), (s) => {
  s = ensureImport(s, "import { RotateCcw, Save } from 'lucide-react';");
  s = ensureImport(s, "import { Icon } from '@/components/Icon';");
  s = ensureImport(s, "import { BrandMarkIcon } from '@/lib/nav-icons';");
  if (!s.includes('icon={Save}')) {
    s = s.replace(
      "{busy ? 'Saving…' : 'Save'}",
      "<Icon icon={Save} size=\"sm\" />\n            {busy ? 'Saving…' : 'Save'}",
    );
  }
  if (!s.includes('icon={RotateCcw}')) {
    s = s.replace(
      'Reset to defaults',
      '<Icon icon={RotateCcw} size="sm" />\n            Reset to defaults',
    );
  }
  s = s.replace(
    /<span className=\{styles\.defaultMark\} aria-hidden \/>/g,
    '<span className={styles.defaultMark} aria-hidden><Icon icon={BrandMarkIcon} size="md" /></span>',
  );
  return s;
});

patch(join(root, 'app/app/audit/page.tsx'), (s) => {
  s = ensureImport(s, "import { ScrollText, Search } from 'lucide-react';");
  s = ensureImport(s, "import { EmptyState } from '@/components/EmptyState';");
  s = ensureImport(s, "import { Icon } from '@/components/Icon';");
  if (!s.includes('icon={Search}')) {
    s = s.replace(
      "{refreshing ? 'Applying…' : 'Apply filters'}",
      "<Icon icon={Search} size=\"sm\" />\n              {refreshing ? 'Applying…' : 'Apply filters'}",
    );
  }
  if (!s.includes('<EmptyState icon={ScrollText}')) {
    s = s.replace(
      /\{rows\.length === 0 \? \(\s*<div className=\{styles\.empty\}>([\s\S]*?)<\/div>\s*\) : \(/,
      '{rows.length === 0 ? (\n            <EmptyState icon={ScrollText} className={styles.empty}>$1</EmptyState>\n          ) : (',
    );
  }
  return s;
});

patch(join(root, 'app/app/admin/integrations/page.tsx'), (s) => {
  s = ensureImport(s, "import { Link2, Plug, Play } from 'lucide-react';");
  s = ensureImport(s, "import { Icon } from '@/components/Icon';");
  s = s.replace('<h2>Status</h2>', '<h2><Icon icon={Plug} size="sm" /> Status</h2>');
  s = s.replace(
    '<h2>Webhook URLs</h2>',
    '<h2><Icon icon={Link2} size="sm" /> Webhook URLs</h2>',
  );
  s = s.replace(
    '<h2>Dev simulate</h2>',
    '<h2><Icon icon={Play} size="sm" /> Dev simulate</h2>',
  );
  return s;
});

patch(join(root, 'app/app/knowledge/new/page.tsx'), (s) => {
  s = ensureImport(s, "import { Save, Send } from 'lucide-react';");
  s = ensureImport(s, "import { Icon } from '@/components/Icon';");
  if (!s.includes('icon={Save}') && !s.includes('icon={Send}')) {
    s = s.replace(
      "{saving ? 'Saving…' : publish ? 'Publish article' : 'Save draft'}",
      "<Icon icon={publish ? Send : Save} size=\"sm\" />\n              {saving ? 'Saving…' : publish ? 'Publish article' : 'Save draft'}",
    );
  }
  return s;
});

patch(join(root, 'app/app/knowledge/[slug]/page.tsx'), (s) => {
  s = ensureImport(s, "import { Plus, Save } from 'lucide-react';");
  s = ensureImport(s, "import { Icon } from '@/components/Icon';");
  if (!s.includes('icon={Save}')) {
    s = s.replace(
      "{saving ? 'Saving…' : 'Save changes'}",
      "<Icon icon={Save} size=\"sm\" />\n              {saving ? 'Saving…' : 'Save changes'}",
    );
  }
  if (!s.includes('icon={Plus}')) {
    s = s.replace(
      'Create another',
      '<Icon icon={Plus} size="sm" />\n              Create another',
    );
  }
  return s;
});

// Knowledge attachments
patch(join(root, 'components/KnowledgeAttachments.tsx'), (s) => {
  s = ensureImport(s, "import { Download, Paperclip } from 'lucide-react';");
  s = ensureImport(s, "import { EmptyState } from '@/components/EmptyState';");
  s = ensureImport(s, "import { Icon } from '@/components/Icon';");
  if (!s.includes('icon={Paperclip}')) {
    s = s.replace(
      "{busy ? 'Uploading…' : 'Attach files'}",
      "<Icon icon={Paperclip} size=\"sm\" />\n              {busy ? 'Uploading…' : 'Attach files'}",
    );
  }
  if (!s.includes('<EmptyState icon={Paperclip}>')) {
    s = s.replace(
      /\{attachments\.length === 0 \? \(\s*<p className=\{styles\.empty\}>[\s\S]*?<\/p>\s*\) : \(/,
      `{attachments.length === 0 ? (
        <EmptyState icon={Paperclip}>
          {canUpload
            ? 'No files yet — use Attach files to add downloads for readers.'
            : 'No attachments on this article.'}
        </EmptyState>
      ) : (`,
    );
  }
  if (!s.includes('icon={Download}')) {
    s = s.replace(/>\s*Download\s*</g, '>\n                <Icon icon={Download} size="sm" />\n                Download\n              <');
  }
  return s;
});

console.log('DONE');
