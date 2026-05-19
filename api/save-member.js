export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // 1. Intercept the payload and isolate the digital receipt
    const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const invoice_id = payload.invoice_id;
    if (!invoice_id) {
        console.warn("Security Alert: Request blocked. No invoice ID provided.");
        return res.status(400).json({ error: 'Security Exception: No payment receipt provided.' });
    }

    const INTASEND_SECRET_KEY = process.env.INTASEND_SECRET_KEY;
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

    if (!INTASEND_SECRET_KEY) {
        console.error("CRITICAL: Missing INTASEND_SECRET_KEY in Vercel environment.");
        return res.status(500).json({ error: 'Server misconfiguration.' });
    }

    try {
        // --- THE BOUNCER: VERIFY WITH INTASEND DIRECTLY ---
        const verifyReq = await fetch('https://payment.intasend.com/api/v1/payment/status/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${INTASEND_SECRET_KEY}`
            },
            body: JSON.stringify({ invoice_id: invoice_id })
        });

        const paymentStatus = await verifyReq.json();

        // If it's not COMPLETE, kick them out
        if (!paymentStatus.invoice || paymentStatus.invoice.state !== 'COMPLETE') {
            console.warn(`Fraud or failed payment attempt blocked. State: ${paymentStatus.invoice?.state}`);
            return res.status(403).json({ error: 'Payment verification failed. Access denied.' });
        }

        // --- THE VAULT: SAVE TO SUPABASE ---
        const dbReq = await fetch(`${SUPABASE_URL}/rest/v1/members`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Prefer': 'return=representation'
            },
            body: JSON.stringify(payload)
        });

        if (!dbReq.ok) {
            const dbError = await dbReq.text();
            console.error('Database insertion failed:', dbError);
            throw new Error('Database save failed.');
        }

        return res.status(200).json({ success: true, message: 'Payment verified and member safely added!' });

    } catch (error) {
        console.error('Server/Security Error:', error.message);
        return res.status(500).json({ error: 'Internal server error during verification.' });
    }
}