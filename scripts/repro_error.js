import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qstizfuimenznizfhpkk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFzdGl6ZnVpbWVuem5pemZocGtrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3MjQ4MDIsImV4cCI6MjA4MTMwMDgwMn0.YQ6Y_uGJRv2RtiIFho9kvcgbsNRFDOawQnYM61RuG8c';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testInsert() {
    console.log("Testing insert without ID...");

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
