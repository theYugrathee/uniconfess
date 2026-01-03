
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../.env.local');

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
    console.error("Missing Supabase credentials");
    process.exit(1);
}

console.log("Testing URL:", url);

(async () => {
    try {
        const res = await fetch(`${url}/rest/v1/confessions?select=*`, {
            headers: {
                'apikey': key,
                'Authorization': `Bearer ${key}`
            }
        });

        if (res.ok) {
            const data = await res.json();
            console.log(`✅ Found ${data.length} confessions.`);
            if (data.length > 0) {
                console.log("Sample:", JSON.stringify(data[0], null, 2));
            } else {
                console.log("⚠️  Table is empty. Try posting something via the UI.");
            }
        } else {
            console.log("❌ Request Failed:", res.status, res.statusText);
            const text = await res.text();
            console.log("Response:", text);
        }
    } catch (e) {
        console.error("Network Error:", e);
    }
})();
