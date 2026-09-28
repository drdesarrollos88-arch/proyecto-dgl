interface RateLimitEntry {
  count: number;
  firstAttempt: number;
  lockedUntil?: number;
}

const attemptsMap = new Map<string, RateLimitEntry>();

// Clean up old entries every 15 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of attemptsMap.entries()) {
    if (entry.lockedUntil && entry.lockedUntil < now) {
      attemptsMap.delete(key);
    } else if (now - entry.firstAttempt > 30 * 60 * 1000) {
      attemptsMap.delete(key);
    }
  }
}, 15 * 60 * 1000);

export function checkRateLimit(key: string): { allowed: boolean; retryAfterSeconds?: number } {
  const now = Date.now();
  const entry = attemptsMap.get(key);

  if (!entry) {
    return { allowed: true };
  }

  if (entry.lockedUntil && entry.lockedUntil > now) {
    const remaining = Math.ceil((entry.lockedUntil - now) / 1000);
    return { allowed: false, retryAfterSeconds: remaining };
  }

  // Window expired (10 minutes)
  if (now - entry.firstAttempt > 10 * 60 * 1000) {
    attemptsMap.delete(key);
    return { allowed: true };
  }

  if (entry.count >= 5) {
    entry.lockedUntil = now + 15 * 60 * 1000; // Lock for 15 minutes
    return { allowed: false, retryAfterSeconds: 15 * 60 };
  }

  return { allowed: true };
}

export function recordFailedAttempt(key: string) {
  const now = Date.now();
  const entry = attemptsMap.get(key);

  if (!entry || now - entry.firstAttempt > 10 * 60 * 1000) {
    attemptsMap.set(key, { count: 1, firstAttempt: now });
  } else {
    entry.count += 1;
    if (entry.count >= 5) {
      entry.lockedUntil = now + 15 * 60 * 1000;
    }
  }
}

export function resetLoginAttempts(key: string) {
  attemptsMap.delete(key);
}

// Dual check (IP and user identifier)
export function checkDualRateLimit(ip: string, identifier?: string): { allowed: boolean; retryAfterSeconds?: number } {
  const ipCheck = checkRateLimit(`ip:${ip}`);
  if (!ipCheck.allowed) return ipCheck;

  if (identifier) {
    const cleanId = identifier.trim().toLowerCase();
    const idCheck = checkRateLimit(`user:${cleanId}`);
    if (!idCheck.allowed) return idCheck;
  }

  return { allowed: true };
}

export function recordDualFailedAttempt(ip: string, identifier?: string) {
  recordFailedAttempt(`ip:${ip}`);
  if (identifier) {
    recordFailedAttempt(`user:${identifier.trim().toLowerCase()}`);
  }
}

export function resetDualLoginAttempts(ip: string, identifier?: string) {
  resetLoginAttempts(`ip:${ip}`);
  if (identifier) {
    resetLoginAttempts(`user:${identifier.trim().toLowerCase()}`);
  }
}
