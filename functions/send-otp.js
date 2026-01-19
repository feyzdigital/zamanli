// Cloudflare Pages Functions - Twilio Send OTP

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
        const { phone } = await request.json();
        
        if (!phone) {
            return new Response(JSON.stringify({ error: 'Telefon numarası gerekli' }), { 
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

        const twilioUrl = `https://verify.twilio.com/v2/Services/${verifySid}/Verifications`;
        
        const response = await fetch(twilioUrl, {
            method: 'POST',
            headers: {
                'Authorization': 'Basic ' + btoa(`${accountSid}:${authToken}`),
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                'To': formattedPhone,
                'Channel': 'sms'
            })
        });

        const result = await response.json();

        if (response.ok) {
            return new Response(JSON.stringify({ 
                success: true, 
                status: result.status,
                message: 'Doğrulama kodu gönderildi'
            }), { status: 200, headers });
        } else {
            return new Response(JSON.stringify({ 
                error: 'SMS gönderilemedi', 
                details: result.message 
            }), { status: 500, headers });
        }

    } catch (error) {
        console.error('Twilio error:', error);
        return new Response(JSON.stringify({ 
            error: 'SMS gönderilemedi', 
            details: error.message 
        }), { status: 500, headers });
    }
}
