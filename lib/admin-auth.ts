import { getChatGPTUser } from '@/app/chatgpt-auth';
// Server-only allowlist: verified Site owner's account from Sites metadata.
// Identity headers are supplied and sanitized by the Sites dispatcher.
const OWNER_EMAIL = '941031steven@gmail.com';
export async function adminAccess() {
  const user = await getChatGPTUser();
  return { user, allowed: !!user && user.email.toLowerCase() === OWNER_EMAIL };
}
