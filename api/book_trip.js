export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // 1. Safely open the payload envelope
    const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { invoice_id, student_name, phone, trip_id } = payload;

    if (!invoice_id || !trip_id) {
        console.warn("Security Alert: Missing receipt or trip ID.");
        return res.status(400).json({ error: 'Security Exception: Missing required booking data.' });
    }

    const INTASEND_SECRET_KEY = process.env.INTASEND_SECRET_KEY;
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

    try {
        // --- LAYER 1: THE INVENTORY CHECK ---
        // Ask the vault: How many seats are actually left on this specific trip?
        const checkSeats = await fetch(`${SUPABASE_URL}/rest/v1/trips?trip_id=eq.${trip_id}&select=total_seats,seats_booked`, {
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
        const tripData = await checkSeats.json();

        if (!tripData || tripData.length === 0) {
            return res.status(404).json({ error: 'Trip not found in database.' });
        }

        const { total_seats, seats_booked } = tripData[0];
        
        // THE HARD LOCK: If booked equals total, kick them out immediately.
        if (seats_booked >= total_seats) {
            console.warn(`Trip ${trip_id} is SOLD OUT. Blocked payment attempt.`);
            return res.status(403).json({ error: 'SOLD OUT. There are no seats left on this bus.' });
        }

        // --- LAYER 2: THE BANK CHECK ---
        // Because we are testing, this points to SANDBOX. 
        const verifyReq = await fetch('https://sandbox.intasend.com/api/v1/payment/status/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${INTASEND_SECRET_KEY}`
            },
            body: JSON.stringify({ invoice_id: invoice_id })
        });
        const paymentStatus = await verifyReq.json();

        if (!paymentStatus.invoice || paymentStatus.invoice.state !== 'COMPLETE') {
            console.warn(`Invalid trip payment attempt. State: ${paymentStatus.invoice?.state}`);
            return res.status(403).json({ error: 'Payment verification failed. Access denied.' });
        }

        // --- LAYER 3: SAVE TO PASSENGER MANIFEST ---
        // We use the invoice_id as the booking_id so every ticket is cryptographically unique.
        const insertBooking = await fetch(`${SUPABASE_URL}/rest/v1/bookings`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Prefer': 'return=representation'
            },
            body: JSON.stringify({ 
                booking_id: invoice_id, 
                student_name: student_name, 
                phone: phone, 
                invoice_id: invoice_id, 
                trip_id: trip_id 
            })
        });

        if (!insertBooking.ok) {
            throw new Error('Failed to save to bookings table.');
        }

        // --- LAYER 4: UPDATE THE SEAT COUNTER ---
        // Add 1 to the seats_booked column to lock out future buyers.
        const updateSeats = await fetch(`${SUPABASE_URL}/rest/v1/trips?trip_id=eq.${trip_id}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`
            },
            body: JSON.stringify({ seats_booked: seats_booked + 1 })
        });

        return res.status(200).json({ success: true, message: 'Seat confirmed and booked!' });

    } catch (error) {
        console.error('Server/Security Error:', error.message);
        return res.status(500).json({ error: 'Internal server error during booking.' });
    }
}