// Génère src/types/database.ts (types Supabase) à partir de supabase/schema.sql — source de vérité unique.
//   node scripts/gen-db-types.mjs          → écrit le fichier
//   node scripts/gen-db-types.mjs --check  → échoue si le fichier n'est pas à jour (utilisé par `npm run check`)
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
const sql = fs.readFileSync(path.join(root, 'supabase/schema.sql'), 'utf8').replace(/--[^\n]*/g, '');

const TS = (t) => {
  t = t.trim().toLowerCase();
  if (t.endsWith('[]')) return `${TS(t.slice(0, -2))}[]`;
  if (/^(uuid|text|citext|varchar|date|timestamptz|timestamp|time)/.test(t) || t.startsWith('character varying')) return 'string';
  if (/^(int|integer|smallint|bigint|numeric|decimal|real|double|float|serial)/.test(t)) return 'number';
  if (/^bool/.test(t)) return 'boolean';
  if (/^jsonb?/.test(t)) return 'Json';
  throw new Error(`Type SQL non géré : ${t}`);
};
const splitTop = (s) => {
  const out = [];
  let d = 0,
    cur = '';
  for (const ch of s) {
    if (ch === '(') d++;
    if (ch === ')') d--;
    if (ch === ',' && d === 0) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out;
};

const tables = {};
for (const m of sql.matchAll(/create table (?:if not exists )?public\.(\w+)\s*\(/g)) {
  let i = m.index + m[0].length,
    d = 1;
  const start = i;
  while (d > 0 && i < sql.length) {
    if (sql[i] === '(') d++;
    if (sql[i] === ')') d--;
    i++;
  }
  const cols = [];
  for (const part of splitTop(sql.slice(start, i - 1))) {
    const p = part.trim().replace(/\s+/g, ' ');
    if (!p) continue;
    if (/^(primary key|unique|check|constraint|foreign key|exclude)\b/i.test(p)) continue;
    const mm = p.match(
      /^"?(\w+)"? ((?:double precision|character varying|timestamp with time zone|[a-z0-9_]+(?:\(\d+(?:,\s*\d+)?\))?)(?:\[\])?)(.*)$/i,
    );
    if (!mm) throw new Error(`Colonne non analysable dans ${m[1]} : ${p}`);
    const [, name, type, rest] = mm;
    const r = rest.toLowerCase();
    const pk = /primary key/.test(r);
    const notNull = /not null/.test(r) || pk;
    cols.push({
      name,
      ts: type.toLowerCase().startsWith('timestamp with') ? 'string' : TS(type.replace(/\(.*\)/, '')),
      nullable: !notNull,
      optionalInsert: /default|generated/.test(r) || !notNull,
    });
  }
  tables[m[1]] = cols;
}
const RPC_PUBLIC = new Set([
  'validate_discount',
  'create_order',
  'attach_payment_proof',
  'attach_order_location',
  'admin_set_order_status',
  'admin_adjust_stock',
  'create_return_request',
  'mark_conversation_read',
  'confirm_order_delivery',
  'admin_dashboard',
  'admin_send_promotion',
  'ensure_profile',
  'release_expired_reservations',
]);
const fns = [];
for (const m of sql.matchAll(/create or replace function public\.(\w+)\(([^)]*)\)\s*returns\s+([a-z0-9_[\]]+)/gi)) {
  if (!RPC_PUBLIC.has(m[1])) continue;
  const args = splitTop(m[2])
    .map((a) => a.trim())
    .filter(Boolean)
    .map((a) => {
      const x = a.match(/^(\w+)\s+([a-z0-9_ ]+?(?:\[\])?)(?:\s+default\s+.+)?$/i);
      if (!x) throw new Error(`Argument non analysable ${m[1]}: ${a}`);
      return { name: x[1], ts: TS(x[2]), optional: /default/i.test(a) };
    });
  const ret = m[3].toLowerCase();
  if (ret === 'trigger') continue;
  fns.push({ name: m[1], args, ret });
}
// Fonctions utilitaires internes (non appelées depuis le frontend) : on ne garde que celles utilisables par un client.

const out = [];
out.push(
  '/* eslint-disable */\n// FICHIER GÉNÉRÉ par scripts/gen-db-types.mjs à partir de supabase/schema.sql — ne pas modifier à la main.\n',
);
out.push('export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];\n');
out.push('export interface Database {\n  public: {\n    Tables: {');
for (const [name, cols] of Object.entries(tables)) {
  const row = cols.map((c) => `          ${c.name}: ${c.ts}${c.nullable ? ' | null' : ''};`).join('\n');
  const ins = cols.map((c) => `          ${c.name}${c.optionalInsert ? '?' : ''}: ${c.ts}${c.nullable ? ' | null' : ''};`).join('\n');
  const upd = cols.map((c) => `          ${c.name}?: ${c.ts}${c.nullable ? ' | null' : ''};`).join('\n');
  out.push(
    `      ${name}: {\n        Row: {\n${row}\n        };\n        Insert: {\n${ins}\n        };\n        Update: {\n${upd}\n        };\n        Relationships: [];\n      };`,
  );
}
out.push('    };\n    Views: {');
out.push(`      customers: {
        Row: { id: string; first_name: string; last_name: string; email: string | null; phone: string | null; country_code: string | null; city: string | null; created_at: string; orders_count: number; total_spent: number; last_activity: string | null };
        Relationships: [];
      };`);
out.push('    };\n    Functions: {');
for (const f of fns.filter((x) => RPC_PUBLIC.has(x.name))) {
  const ret = f.ret === 'void' ? 'undefined' : TS(f.ret);
  const args = f.args.length
    ? `{ ${f.args.map((a) => `${a.name}${a.optional ? '?' : ''}: ${a.ts}${a.optional ? ' | null' : ''}`).join('; ')} }`
    : 'Record<PropertyKey, never>';
  out.push(`      ${f.name}: { Args: ${args}; Returns: ${ret} };`);
}
out.push('    };\n    Enums: { [key: string]: never };\n    CompositeTypes: { [key: string]: never };\n  };\n}\n');
out.push("export type TableName = keyof Database['public']['Tables'];");
out.push("export type Row<T extends TableName> = Database['public']['Tables'][T]['Row'];");
out.push("export type RpcName = keyof Database['public']['Functions'];\n");
const text = out.join('\n');
const target = path.join(root, 'src/types/database.ts');
if (process.argv[2] === '--check') {
  const cur = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : '';
  if (cur !== text) {
    console.error('src/types/database.ts est obsolète : lancez `npm run db:types`');
    process.exit(1);
  }
  console.log(`database.ts à jour (${Object.keys(tables).length} tables)`);
} else {
  fs.writeFileSync(target, text);
  console.log(`database.ts généré : ${Object.keys(tables).length} tables, ${fns.filter((x) => RPC_PUBLIC.has(x.name)).length} RPC`);
}
