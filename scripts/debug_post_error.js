
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load env
const envPath = path.resolve(process.cwd(), '.env.local');
const envConfig = dotenv.parse(fs.readFileSync(envPath));

const supabaseUrl = envConfig.VITE_SUPABASE_URL;
const supabaseKey = envConfig.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testInsert() {
    console.log("Testing insert...");

    // Simulate the failing payload from App.tsx
    // user.id would be a string.
    const payload = {
        userId: 'test-user-id',
        username: 'Debug User',
        content: 'Debug Post Content',
        collegeId: 'general',
        isAnonymous: false,
        userAvatar: 'https://ui-avatars.com/api/?name=Debug',
        likes: [],
        timestamp: Date.now(),
        hidden: false
    };

    const { data, error } = await supabase.from('confessions').insert(payload).select().single();

    if (error) {
        console.error("Insert Error:", JSON.stringify(error, null, 2));
    } else {
        console.log("Insert Success:", data);
    }
}

testInsert();
