// Cloudflare Pages Functions - Twilio Verify OTP

// CORS preflight
export async function onRequestOptions() {
    return new Response(null, {
        status: 200,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
        }
    });
}

// POST handler
export async function onRequestPost(context) {
    const { request, env } = context;
    
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
    };

    try {
        const { phone, code } = await request.json();
        
        if (!phone || !code) {
            return new Response(JSON.stringify({ error: 'Telefon ve kod gerekli' }), { 
                status: 400, 
                headers 
            });
        }

        // Telefon formatı: +90 ile başlamalı
        const formattedPhone = phone.startsWith('+') ? phone : '+90' + phone.replace(/^0/, '');

        // Twilio API çağrısı (fetch ile)
        const accountSid = env.TWILIO_ACCOUNT_SID;
        const authToken = env.TWILIO_AUTH_TOKEN;
        const verifySid = env.TWILIO_VERIFY_SID;

        const twilioUrl = `https://verify.twilio.com/v2/Services/${verifySid}/VerificationCheck`;
        
        const response = await fetch(twilioUrl, {
            method: 'POST',
            headers: {
                'Authorization': 'Basic ' + btoa(`${accountSid}:${authToken}`),
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                'To': formattedPhone,
                'Code': code
            })
        });

        const result = await response.json();

        if (response.ok && result.status === 'approved') {
            return new Response(JSON.stringify({ 
                success: true, 
                status: 'approved',
                message: 'Telefon doğrulandı'
            }), { status: 200, headers });
        } else {
            return new Response(JSON.stringify({ 
                success: false, 
                status: result.status || 'failed',
                message: 'Kod hatalı veya süresi dolmuş'
            }), { status: 400, headers });
        }

    } catch (error) {
        console.error('Twilio error:', error);
        return new Response(JSON.stringify({ 
            error: 'Doğrulama yapılamadı', 
            details: error.message 
        }), { status: 500, headers });
    }
}
