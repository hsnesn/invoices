#!/usr/bin/env node
/**
 * Run migration 00019 (email settings and templates).
 * Requires DATABASE_URL in .env.local (Supabase Dashboard → Project Settings → Database → Connection string)
 * Or run the SQL manually in Supabase Dashboard → SQL Editor.
 */
require("dotenv").config({ path: ".env.local" });
const { Client } = require("pg");
const fs = require("fs");
const path = require("path");

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("DATABASE_URL not found in .env.local");
  console.error("Add it from: Supabase Dashboard → Project Settings → Database → Connection string (URI)");
  process.exit(1);
}

const sqlPath = path.join(__dirname, "../supabase/migrations/00019_email_settings_and_templates.sql");
const sql = fs.readFileSync(sqlPath, "utf8");

async function run() {
  const client = new Client({ connectionString: dbUrl });
  try {
    await client.connect();
    await client.query(sql);
    console.log("Migration 00019 applied successfully.");
  } catch (err) {
    console.error("Migration failed:", err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
