import { randomBytes, scrypt as derive, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
const scrypt = promisify(derive);
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const key = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${key.toString('hex')}`;
}
export async function checkPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  const [salt, expected] = hash.split(':');
  const key = (await scrypt(password, salt, 64)) as Buffer;
  const target = Buffer.from(expected, 'hex');
  return key.length === target.length && timingSafeEqual(key, target);
}
