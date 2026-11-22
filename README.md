# Chetan Kirana — Online Grocery Store

React + Vite storefront for Chikhali, Maharashtra. Includes product search, category filters, cart, customer checkout details, COD/UPI selection, WhatsApp order handoff and a separate `/admin` route.

## Local setup
1. Install Node.js LTS.
2. Extract this ZIP.
3. In the project folder run `npm install`.
4. Copy `.env.example` to `.env`.
5. Add your Supabase Project URL and **anon/publishable public key** in `.env`.
6. Run `npm run dev`.

## Vercel deployment
Import the GitHub repository into Vercel. Build command: `npm run build`; output directory: `dist`. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as environment variables.

## Supabase setup
Run `supabase/setup.sql` and then `supabase/orders.sql` in Supabase SQL Editor. Your admin auth user must be present in `public.admin_users`. The existing admin UID from project setup should be inserted there if not already done.

## Important notes
- Never expose the Supabase `service_role` key or database password in frontend files.
- UPI payment confirmation is manual; this site does not automatically verify UPI payments.
- Delivery radius/address is checked manually by the shop.
- Free hosting/database plans have usage limits and may change.
