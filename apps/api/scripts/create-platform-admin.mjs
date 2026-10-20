#!/usr/bin/env node
// Create (or reset the password of) a Wepilo platform admin.
//
//   pnpm --filter @wepilo/api admin:create -- --email you@wepilo.com --name "Your Name" [--remote]
//
// Prompts for the password so it never lands in shell history. Local D1 by default.
import { execFileSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import bcrypt from "bcryptjs";

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? undefined : args[i + 1];
};
const email = flag("email")?.trim().toLowerCase();
const name = flag("name")?.trim();
const remote = args.includes("--remote");

if (!email || !name) {
  console.error('Usage: admin:create -- --email you@example.com --name "Your Name" [--remote]');
  process.exit(1);
}

const rl = createInterface({ input: process.stdin, output: process.stdout });
const password = process.env.ADMIN_PASSWORD ?? (await rl.question("Password (min 12 chars): "));
rl.close();
if (password.length < 12) {
  console.error("Password must be at least 12 characters.");
  process.exit(1);
}

const hash = await bcrypt.hash(password, 10);
const q = (v) => `'${String(v).replace(/'/g, "''")}'`;
const sql =
  `INSERT INTO platform_admins (email, name, password) VALUES (${q(email)}, ${q(name)}, ${q(hash)}) ` +
  `ON CONFLICT(email) DO UPDATE SET name = excluded.name, password = excluded.password, is_active = 1, ` +
  `updated_at = unixepoch() * 1000;`;

execFileSync(
  "pnpm",
  ["wrangler", "d1", "execute", "DB", remote ? "--remote" : "--local", "--command", sql],
  { stdio: "inherit" },
);
console.log(`\nPlatform admin ready: ${email}. Sign in at /admin/login.`);
