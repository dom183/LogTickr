import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@12.14.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY")!;
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const stripe = new Stripe(stripeSecretKey, { apiVersion: "2022-11-15" });
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

serve(async (req) => {
  const sig = req.headers.get("stripe-signature")!;

  // Read the raw request body as a Uint8Array
  const buf = await req.arrayBuffer();
  const body = new Uint8Array(buf);

  let event;
  try {
    // Async signature verification with the raw body
    event = await stripe.webhooks.constructEventAsync(
      body,
      sig,
      Deno.env.get("STRIPE_WEBHOOK_SECRET")!
    );
  } catch (err) {
    console.error("Stripe webhook verification failed:", (err as Error).message);
    return new Response(`Webhook Error: ${(err as Error).message}`, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    try {
      const session = event.data.object as Stripe.Checkout.Session;
      console.log("Stripe webhook event received:", session);
      const userId = session.metadata?.user_id;
      console.log("Updating user with userId:", userId);
      if (userId) {
        await supabase
          .from("profiles")
          .update({ role: "premium" })
          .eq("user_id", userId);
      }
    } catch (err) {
      console.error("Error handling checkout.session.completed:", err);
    }
  }

  if (event.type === "customer.subscription.deleted") {
    try {
      const subscription = event.data.object as Stripe.Subscription;
      console.log("Stripe webhook event received:", subscription);
      const userId = subscription.metadata?.user_id;
      console.log("Updating user with userId:", userId);
      if (userId) {
        await supabase
          .from("profiles")
          .update({ role: "free" })
          .eq("user_id", userId);
      }
    } catch (err) {
      console.error("Error handling customer.subscription.deleted:", err);
    }
  }

  return new Response("ok", { status: 200 });
});
