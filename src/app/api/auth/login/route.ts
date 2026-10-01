import { type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPassword, setSessionCookie } from "@/lib/auth";
import { loginSchema } from "@/lib/validation";
import { ok, route, unauthorized } from "@/lib/http";
import {
  assertNotThrottled,
  clearFailedLogins,
  clientIp,
  recordFailedLogin,
} from "@/lib/services/login-throttle";

// bcrypt hash of a random string nobody knows. When the email does not exist
// we still run a full bcrypt compare against it, so the response time does
// not reveal which emails have an account.
const DUMMY_HASH = "$2a$10$Kc85yKIotL4ZrfBNOcByf.PCdSReYZgUv4FXXVlrJhHOxqbTVyvnu";

export const POST = route(async (req: NextRequest) => {
  const body = loginSchema.parse(await req.json());
  const email = body.email.trim().toLowerCase();
  const ip = clientIp(req.headers);

  await assertNotThrottled(email, ip);

  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
  });
  const passwordOk = await verifyPassword(body.password, user?.passwordHash ?? DUMMY_HASH);

  if (!user || !user.active || !passwordOk) {
    await recordFailedLogin(email, ip);
    // Same message for every case: never tell whether the email exists.
    throw unauthorized("Invalid email or password.");
  }

  await clearFailedLogins(email);
  await setSessionCookie(user);
  return ok({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  });
});
