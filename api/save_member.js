// api/save-member.js
export default async function handler(req, res) {
    // 1. Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // 2. Grab your secret keys from Vercel
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

    try {
        // 3. Send the data to your Supabase 'members' table
        const response = await fetch(`${SUPABASE_URL}/rest/v1/members`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Prefer': 'return=representation'
            },
            body: JSON.stringify(req.body)
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error("Supabase error:", errorData);
            throw new Error('Failed to save to database');
        }

        return res.status(200).json({ success: true, message: 'Member saved successfully!' });

    } catch (error) {
        console.error('Server Error:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}