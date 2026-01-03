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

  if (payload.type !== "INSERT" || payload.table !== "confessions") {
    return new Response("Ignored");
  }

  const confession = payload.record;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: users } = await supabase
    .from("users")
    .select("fcmToken")
    .eq("collegeId", confession.collegeId)
    .not("fcmToken", "is", null);

  if (!users || users.length === 0) {
    return new Response("No users");
  }

  const tokens = users.map((u) => u.fcmToken).filter(Boolean);

  const title = "UniConfess";
  const body = "Someone posted a new confession 👀";

  await Promise.allSettled(
    tokens.map((token) =>
      admin.messaging().send({
        token,
        notification: { title, body },
        data: { confessionId: confession.id },
      })
    )
  );

  return new Response("Done");
});
