
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
    // Simulate a completely new user ID
    const randomId = 'user-' + Math.random().toString(36).substring(7);
    console.log("Simulating post from:", randomId);

    const post = {
        id: crypto.randomUUID(),
        "userId": randomId,
        username: "stranger",
        "userAvatar": "",
        content: "Hello from a stranger!",
        "collegeId": "c1",
        timestamp: Date.now(),
        "isAnonymous": false,
        likes: [],
        hidden: false
    };

    console.log("Posting...", post);

    try {
        const res = await fetch(`${url}/rest/v1/confessions`, {
            method: 'POST',
            headers: {
                'apikey': key,
                'Authorization': `Bearer ${key}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            body: JSON.stringify(post)
        });

        if (res.ok) {
            console.log("✅ Post Successful!");
            console.log(await res.json());
        } else {
            console.log("❌ Post Failed:", res.status, res.statusText);
            console.log(await res.text());
        }
    } catch (e) {
        console.error("Network Error:", e);
    }

})();
