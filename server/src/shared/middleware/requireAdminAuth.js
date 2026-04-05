import { timingSafeEqual } from "crypto";
import { config } from "../../config/index.js";

function safeTokenEquals(expected, provided) {
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(provided, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Guard sensitive admin/GDPR routes with a server-side bearer token.
 *
 * Expected header:
 *   Authorization: Bearer <ADMIN_API_TOKEN>
 */
export function requireAdminAuth(req, res, next) {
  const expected = config.security.adminApiToken;
  if (!expected) {
    return res.status(503).json({
      error: {
        code: "ADMIN_AUTH_NOT_CONFIGURED",
        message: "Admin API authentication is not configured on the server",
        details: {},
      },
    });
  }

  const authHeader = req.get("authorization") ?? "";
  const [scheme, token] = authHeader.split(" ");

  if (scheme?.toLowerCase() !== "bearer" || !token || !safeTokenEquals(expected, token)) {
    return res.status(403).json({
      error: {
        code: "FORBIDDEN",
        message: "Admin authentication required",
        details: {},
      },
    });
  }

  return next();
}
