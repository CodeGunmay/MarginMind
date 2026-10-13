import './env';

export interface SmsProvider { sendOtp(phone: string, code: string): Promise<void> }
export const smsProvider = () => process.env.SMS_PROVIDER || 'mock';
export async function sendOtp(phone: string, code: string): Promise<void> {
  switch (smsProvider()) {
    case 'mock': console.log(`[Mock SMS] ${phone}: ${code}`); return;
    case 'twilio': {
      const credentials = [process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN, process.env.TWILIO_FROM];
      throw new Error(credentials.every(Boolean) ? 'Twilio sending is not implemented' : 'Twilio credentials are missing');
    }
    case 'firebase': {
      const credential = process.env.FIREBASE_SERVICE_ACCOUNT;
      throw new Error(credential ? 'Firebase sending is not implemented' : 'Firebase credentials are missing');
    }
    default: throw new Error('Unknown SMS provider');
  }
}
export const sms: SmsProvider = { sendOtp };
