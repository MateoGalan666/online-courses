import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'antigravity-secret-key-12345';

/**
 * Genera un hash SHA-256 de una contraseña.
 */
export function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

/**
 * Genera un token JWT firmado mediante HMAC-SHA256 (Base64url).
 */
export function generateToken(payload: object): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  
  const base64Header = Buffer.from(JSON.stringify(header)).toString('base64url');
  const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${base64Header}.${base64Payload}`)
    .digest('base64url');
    
  return `${base64Header}.${base64Payload}.${signature}`;
}

/**
 * Valida un token JWT y retorna su payload deserializado, o null si es inválido.
 */
export function verifyToken(token: string): any | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const [base64Header, base64Payload, signature] = parts;
    
    // Validar firma
    const expectedSignature = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(`${base64Header}.${base64Payload}`)
      .digest('base64url');
      
    if (signature !== expectedSignature) {
      return null;
    }
    
    // Deserializar payload
    const payloadStr = Buffer.from(base64Payload, 'base64url').toString('utf8');
    return JSON.parse(payloadStr);
  } catch (error) {
    return null;
  }
}
