const crypto = require("crypto");

/**
 * Verifies a passcode against the SETTINGS_PASSCODE environment variable.
 * Used for the "unlock" UX before showing Settings or the add/edit/delete
 * form. The dashboard's actual writes are separately re-checked against the
 * same variable in api/contacts.js, so this endpoint only affects UX, not
 * enforcement.
 */
module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }

  const configuredPasscode = process.env.SETTINGS_PASSCODE;
  if (!configuredPasscode) {
    res.status(500).json({ ok: false, error: "SETTINGS_PASSCODE is not configured on the server." });
    return;
  }

  const submitted = String((req.body && req.body.passcode) || "");
  const bufA = Buffer.from(submitted);
  const bufB = Buffer.from(String(configuredPasscode));
  const ok = bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);

  res.status(200).json({ ok });
};
