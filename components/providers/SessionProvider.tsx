"use client";

// Re-export Auth.js's client SessionProvider so the root layout (a server
// component) can wrap the tree without itself becoming a client component.
// This lets small client islands (AccountMenu) read the session while public
// pages remain server-rendered/static for SEO.
export { SessionProvider } from "next-auth/react";
