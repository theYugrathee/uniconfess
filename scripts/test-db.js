
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../.env.local');

console.log("Reading env from:", envPath);
let content;
try {
    content = fs.readFileSync(envPath, 'utf8');
} catch (e) {
    console.error("Could not read .env.local");
    process.exit(1);
}

const vars = {};
content.split('\n').forEach(line => {
    const [key, ...val] = line.split('=');
    if (key && val) {
        vars[key.trim()] = val.join('=').trim();
    }
});

const url = vars['VITE_SUPABASE_URL'];
const key = vars['VITE_SUPABASE_ANON_KEY'];

if (!url || !key) {
    console.error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY");
    process.exit(1);
}

console.log("Testing URL:", url);

(async () => {
    try {
        const res = await fetch(`${url}/rest/v1/users?select=count`, {
            headers: {
                'apikey': key,
                'Authorization': `Bearer ${key}`
            }
        });

        if (res.ok) {
            console.log("✅ Connection Successful! 'users' table found.");
        } else {
            console.log("❌ Request Failed:", res.status, res.statusText);
            const text = await res.text();
            console.log("Response:", text);
            if (res.status === 404 || text.includes('relation "public.users" does not exist') || text.includes('PGRST205')) {
                console.log("\n⚠️  DIAGNOSIS: The 'users' table does not exist. Please run the schema.sql!");
            }
        }
    } catch (e) {
        console.error("Network Error:", e);
    }
})();
