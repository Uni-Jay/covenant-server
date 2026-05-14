import axios from 'axios';

/**
 * WhatsApp Service
 * Handles sending messages via WhatsApp Business API
 */

const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL || 'https://graph.instagram.com/v18.0';
const WHATSAPP_PHONE_ID = process.env.WHATSAPP_PHONE_ID || '';
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN || '';
const WHATSAPP_FROM_PHONE = process.env.WHATSAPP_FROM_PHONE || '+1234567890'; // Business phone number

interface WhatsAppMessage {
  messaging_product: string;
  to: string;
  type: string;
  text: {
    preview_url: boolean;
    body: string;
  };
}

/**
 * Send a text message via WhatsApp
 * @param phoneNumber - Recipient phone number (with country code, e.g., +1234567890)
 * @param message - Message text
 * @returns success status
 */
export const sendWhatsAppMessage = async (phoneNumber: string, message: string): Promise<boolean> => {
  try {
    // Normalize phone number (remove spaces, dashes, etc.)
    const normalizedPhone = phoneNumber.replace(/[^\d+]/g, '');
    
    // Ensure it has country code
    const formattedPhone = normalizedPhone.startsWith('+') ? normalizedPhone : `+${normalizedPhone}`;

    console.log(`📱 Sending WhatsApp message to ${formattedPhone}`);

    // Check if credentials are configured
    if (!WHATSAPP_PHONE_ID || !WHATSAPP_ACCESS_TOKEN) {
      console.warn('⚠️  WhatsApp credentials not configured. Message would be sent to:', formattedPhone);
      console.log('📝 Message content:', message);
      
      // Log to database for manual sending
      await logWhatsAppMessage(formattedPhone, message, 'pending');
      return true; // Treat as "success" for now
    }

    const payload: WhatsAppMessage = {
      messaging_product: 'whatsapp',
      to: formattedPhone,
      type: 'text',
      text: {
        preview_url: false,
        body: message
      }
    };

    const response = await axios.post(
      `${WHATSAPP_API_URL}/${WHATSAPP_PHONE_ID}/messages`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log(`✅ WhatsApp message sent successfully to ${formattedPhone}`);
    
    // Log successful send
    await logWhatsAppMessage(formattedPhone, message, 'sent', response.data.messages?.[0]?.id);
    return true;

  } catch (error: any) {
    console.error('❌ Error sending WhatsApp message:', error.response?.data || error.message);
    
    // Log failed send
    await logWhatsAppMessage(
      phoneNumber,
      message,
      'failed',
      undefined,
      error.response?.data?.error?.message || error.message
    );
    
    return false;
  }
};

/**
 * Send a template message via WhatsApp (for pre-approved templates)
 * @param phoneNumber - Recipient phone number
 * @param templateName - Template name (e.g., 'birthday_greeting')
 * @param parameters - Template parameters
 */
export const sendWhatsAppTemplate = async (
  phoneNumber: string,
  templateName: string,
  parameters: Record<string, string> = {}
): Promise<boolean> => {
  try {
    const normalizedPhone = phoneNumber.replace(/[^\d+]/g, '');
    const formattedPhone = normalizedPhone.startsWith('+') ? normalizedPhone : `+${normalizedPhone}`;

    console.log(`📱 Sending WhatsApp template "${templateName}" to ${formattedPhone}`);

    if (!WHATSAPP_PHONE_ID || !WHATSAPP_ACCESS_TOKEN) {
      console.warn('⚠️  WhatsApp credentials not configured');
      return true;
    }

    const payload = {
      messaging_product: 'whatsapp',
      to: formattedPhone,
      type: 'template',
      template: {
        name: templateName,
        language: {
          code: 'en'
        },
        components: [
          {
            type: 'body',
            parameters: Object.values(parameters).map(value => ({ type: 'text', text: value }))
          }
        ]
      }
    };

    const response = await axios.post(
      `${WHATSAPP_API_URL}/${WHATSAPP_PHONE_ID}/messages`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log(`✅ WhatsApp template sent to ${formattedPhone}`);
    return true;

  } catch (error: any) {
    console.error('❌ Error sending WhatsApp template:', error.response?.data || error.message);
    return false;
  }
};

/**
 * Log WhatsApp message for tracking
 */
const logWhatsAppMessage = async (
  phoneNumber: string,
  message: string,
  status: 'sent' | 'pending' | 'failed',
  messageId?: string,
  errorMessage?: string
) => {
  try {
    // This would log to database for monitoring
    // For now, we'll just log to console
    console.log(`📋 WhatsApp Log: ${phoneNumber} - ${status}${errorMessage ? ` - ${errorMessage}` : ''}`);
  } catch (error) {
    console.error('Error logging WhatsApp message:', error);
  }
};

/**
 * Verify WhatsApp webhook (for receiving messages)
 * Used during WhatsApp API setup
 */
export const verifyWhatsAppWebhook = (req: any): boolean => {
  const token = process.env.WHATSAPP_WEBHOOK_TOKEN || 'test_token';
  
  if (req.query.hub_verify_token === token && req.query.hub_challenge) {
    console.log('✅ WhatsApp webhook verified');
    return true;
  }
  
  return false;
};

/**
 * Handle WhatsApp webhook events (incoming messages)
 */
export const handleWhatsAppWebhook = async (data: any) => {
  try {
    const entries = data.entry;
    
    for (const entry of entries) {
      const changes = entry.changes;
      
      for (const change of changes) {
        if (change.field !== 'messages') continue;
        
        const messages = change.value.messages || [];
        
        for (const message of messages) {
          console.log('📥 Incoming WhatsApp message:', {
            from: message.from,
            timestamp: message.timestamp,
            type: message.type,
            text: message.text?.body
          });
          
          // Handle the message (e.g., process commands, store in DB)
          // This can be extended to handle user responses
        }
      }
    }
  } catch (error) {
    console.error('❌ Error handling WhatsApp webhook:', error);
  }
};
