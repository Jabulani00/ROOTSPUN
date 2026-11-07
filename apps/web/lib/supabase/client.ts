"use client";

import { browserClient } from "@rootspun/db";

/** Browser Supabase client. Safe: anon key + user session, protected by RLS. */
export const createClient = browserClient;
