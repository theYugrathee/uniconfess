
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../.env.local');

let content;
try { content = fs.readFileSync(envPath, 'utf8'); } catch (e) { process.exit(1); }

const vars = {};
content.split('\n').forEach(line => {
    const [key, ...val] = line.split('=');
    if (key && val) vars[key.trim()] = val.join('=').trim();
});

const url = vars['VITE_SUPABASE_URL'];
const key = vars['VITE_SUPABASE_ANON_KEY'];

console.log("Testing URL:", url);

(async () => {
    // 1. Get a user
    const res = await fetch(`${url}/rest/v1/users?select=*&limit=1`, {
        headers: {
            'apikey': key,
            'Authorization': `Bearer ${key}`
        }
    });

    if (res.ok) {
        const users = await res.json();
        if (users.length > 0) {
            const user = users[0];
            console.log("Updating user:", user.id, user.username);

            // 2. Update user
            const updateRes = await fetch(`${url}/rest/v1/users?id=eq.${user.id}`, {
                method: 'PATCH',
                headers: {
                    'apikey': key,
                    'Authorization': `Bearer ${key}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation'
                },
                body: JSON.stringify({ collegeId: 'c1' })
            });

            if (updateRes.ok) {
                const updated = await updateRes.json();
                console.log("✅ Update Successful:", updated[0]);
            } else {
                console.log("❌ Update Failed:", updateRes.status, await updateRes.text());
            }

        } else {
            console.log("No users found to update.");
        }
    } else {
        console.log("Failed to fetch users:", res.status);
    }
})();
