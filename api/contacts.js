const crypto = require("crypto");

function timingSafeEqualStr(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Proxies the dashboard's contact AND resource-type (category) reads/
 * writes to the Google Apps Script Web App backing the shared Google
 * Sheet. The Sheet URL never reaches the browser: it lives only in the
 * SHEETS_API_URL server environment variable.
 *
 * Reads (GET) are open to any visitor and return both `contacts` and
 * `categories`. Writes (POST: create/update/delete for contacts, and
 * createCategory/updateCategory/deleteCategory for resource types)
 * require a `passcode` field matching the SETTINGS_PASSCODE environment
 * variable, checked here on the server so the real secret is never shipped
 * to the client.
 *
 * The one exception is action "rate": anyone can rate a contact without a
 * passcode. To make sure that can't be abused to change anything else,
 * the payload forwarded to Apps Script for "rate" is rebuilt here from
 * scratch with only `id` and a clamped `rating` — whatever else a caller
 * puts in the request body is ignored.
 */
module.exports = async (req, res) => {
  const sheetsUrl = process.env.SHEETS_API_URL;
  if (!sheetsUrl) {
    res.status(500).json({ error: "SHEETS_API_URL is not configured on the server." });
    return;
  }

  if (req.method === "GET") {
    try {
      const response = await fetch(`${sheetsUrl}?action=list`);
      const data = await response.json();
      res.status(200).json(data);
    } catch (err) {
      res.status(502).json({ error: "Could not reach the Google Sheet backend." });
    }
    return;
  }

  if (req.method === "POST") {
    const body = req.body || {};
    let forwardBody = body;

    if (body.action === "rate") {
      const ratingNum = parseInt(body.rating, 10);
      forwardBody = {
        action: "rate",
        id: String(body.id || ""),
        rating: Number.isFinite(ratingNum) ? Math.max(1, Math.min(5, ratingNum)) : "",
      };
    } else {
      const configuredPasscode = process.env.SETTINGS_PASSCODE;
      const submitted = body.passcode;

      if (!configuredPasscode || !submitted || !timingSafeEqualStr(submitted, configuredPasscode)) {
        res.status(401).json({ error: "Invalid passcode." });
        return;
      }
    }

    try {
      const response = await fetch(sheetsUrl, {
        method: "POST",
        body: JSON.stringify(forwardBody),
      });
      const data = await response.json();
      res.status(200).json(data);
    } catch (err) {
      res.status(502).json({ error: "Could not reach the Google Sheet backend." });
    }
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
};
