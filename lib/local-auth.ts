/**
 * Local authentication (no Supabase needed)
 * Uses cookies for session persistence
 */

import { cookies } from "next/headers";

export interface User {
  id: string;
  email: string;
  name: string;
  role: "owner" | "manager" | "maintenance";
}

const users: Map<string, { email: string; password: string; user: User }> = new Map();
const sessions: Map<string, User> = new Map();

// Initialize with demo user
export function initDemoUsers() {
  const demoUser: User = {
    id: "demo-owner",
    email: "demo@realestatemanagement.local",
    name: "Demo Owner",
    role: "owner",
  };

  users.set("demo@realestatemanagement.local", {
    email: "demo@realestatemanagement.local",
    password: "demo123",
    user: demoUser,
  });
}

initDemoUsers();

export async function signIn(email: string, password: string): Promise<User> {
  const user = users.get(email);

  if (!user) {
    // Auto-create new user (first user is owner, rest are maintenance)
    const newUser: User = {
      id: `user-${Date.now()}`,
      email,
      name: email.split("@")[0],
      role: users.size === 0 ? "owner" : "maintenance",
    };

    users.set(email, { email, password, user: newUser });

    // Create session and set cookie
    const sessionId = `session-${Date.now()}-${Math.random()}`;
    sessions.set(sessionId, newUser);
    (await cookies()).set("session_id", sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return newUser;
  }

  if (user.password !== password) {
    throw new Error("Invalid password");
  }

  // Create session and set cookie
  const sessionId = `session-${Date.now()}-${Math.random()}`;
  sessions.set(sessionId, user.user);
  (await cookies()).set("session_id", sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });

  return user.user;
}

export async function signOut(): Promise<void> {
  (await cookies()).delete("session_id");
}

export async function getCurrentUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("session_id")?.value;

  if (!sessionId) return null;

  return sessions.get(sessionId) || null;
}

export function setCurrentUser(user: User | null): void {
  // Deprecated - use signIn/signOut instead
}
