
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicPath = path.resolve(__dirname, '../public');

// Distinct "chime" or "alert" sound for admin notifications
// Using a different sound from the same source for consistency
const soundUrl = "https://codeskulptor-demos.commondatastorage.googleapis.com/pang/arrow.mp3";

(async () => {
    try {
        console.log("Downloading admin sound...");
        const res = await fetch(soundUrl);
        if (!res.ok) throw new Error(`Failed to fetch: ${res.statusText}`);

        const arrayBuffer = await res.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        fs.writeFileSync(path.join(publicPath, 'admin-notification.mp3'), buffer);
        console.log("✅ Created public/admin-notification.mp3");
    } catch (e) {
        console.error("Error creating sound:", e);
    }
})();
