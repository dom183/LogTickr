import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2022-11-15",
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Ensure we always get a string for userId
    const userId =
      typeof body.userId === "string"
        ? body.userId
        : typeof body.userid === "string"
        ? body.userid
        : "";

    const couponId = body.couponId ? String(body.couponId) : undefined;

    if (!userId) {
      console.error("Missing userId in request body:", body);
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    console.info("Received body for checkout session:", body);
    console.info("Creating Stripe checkout session for userId:", userId);

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID!,
          quantity: 1,
        },
      ],
      discounts: couponId ? [{ coupon: couponId }] : undefined,
      allow_promotion_codes: true,
      success_url: `${req.headers.get("origin")}/`,
      cancel_url: `${req.headers.get("origin")}/`,
      client_reference_id: userId,
      metadata: {
        user_id: userId,
      },
    });

    console.info("Stripe session created successfully:", session.id);

    return NextResponse.json({ sessionId: session.id });
  } catch (err: unknown) {
    console.error("Stripe checkout session creation failed:", err);
    const message =
      err instanceof Error ? err.message : "Unknown error during checkout session creation";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}