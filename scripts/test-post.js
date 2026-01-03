
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

const newConfession = {
    id: 'test-' + Date.now(),
    "userId": "test-user-id",
    username: "TestUser",
    "userAvatar": "https://example.com/avatar.png",
    content: "This is a test confession 4.",
    "collegeId": "general",
    timestamp: Date.now(),
    "isAnonymous": false,
    likes: [],
    hidden: false
};

(async () => {
    try {
        const res = await fetch(`${url}/rest/v1/confessions`, {
            method: 'POST',
            headers: {
                'apikey': key,
                'Authorization': `Bearer ${key}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            body: JSON.stringify(newConfession)
        });

        const text = await res.text();
        fs.writeFileSync('post_result.json', JSON.stringify({
            status: res.status,
            statusText: res.statusText,
            body: text
        }, null, 2));

    } catch (e) {
        console.error("Network Error:", e);
    }
})();
