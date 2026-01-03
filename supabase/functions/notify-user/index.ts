import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import admin from "npm:firebase-admin@11.10.1";

const serviceAccount = JSON.parse(
    Deno.env.get("FIREBASE_SERVICE_ACCOUNT")!
);

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });
}

serve(async (req) => {
    const payload = await req.json();

    if (payload.type !== "INSERT" || payload.table !== "notifications") {
        return new Response("Ignored");
    }

    const notification = payload.record;

    const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: user } = await supabase
        .from("users")
        .select("fcmToken")
        .eq("id", notification.userId)
        .single();

    if (!user || !user.fcmToken) {
        return new Response("No token");
    }

    const title = notification.type === 'system' ? 'UniConfess Admin' : 'UniConfess';
    const body = notification.content || 'You have a new notification';

    try {
        await admin.messaging().send({
            token: user.fcmToken,
            notification: { title, body },
            data: {
                url: '/', // or deep link
                notificationId: notification.id
            },
        });
    } catch (error) {
        console.error("FCM Send Error:", error);
    }

    return new Response("Done");
});
