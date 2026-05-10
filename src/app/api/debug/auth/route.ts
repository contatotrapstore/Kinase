import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

// Endpoint de debug temporário
export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll().map((c) => ({
    name: c.name,
    valueLen: c.value.length,
  }));

  const supabase = await createClient();
  const userResult = await supabase.auth.getUser();
  const sessionResult = await supabase.auth.getSession();

  return NextResponse.json({
    cookies: allCookies,
    cookieCount: allCookies.length,
    headers: {
      authorization: request.headers.get("authorization"),
      cookie: request.headers.get("cookie")?.slice(0, 100),
    },
    getUser: {
      hasUser: !!userResult.data.user,
      email: userResult.data.user?.email,
      errorMsg: userResult.error?.message,
    },
    getSession: {
      hasSession: !!sessionResult.data.session,
      errorMsg: sessionResult.error?.message,
    },
  });
}
