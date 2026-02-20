const functions = require("firebase-functions");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");

admin.initializeApp();

function isAdultRole(roleType) {
  return roleType === "Parent" || roleType === "Adult Leader";
}

// ---- SMTP config (set as Functions config or secrets) ----
// You will set these securely (NOT in frontend):
// SMTP_USER = 248stsimons@gmail.com
// SMTP_PASS = your Gmail App Password (16 chars)
// SMTP_HOST = smtp.gmail.com
// SMTP_PORT = 465
function getSmtpConfig() {
  // Using functions config: firebase functions:config:set smtp.user="..." smtp.pass="..."
  const cfg = functions.config() || {};
  const smtp = cfg.smtp || {};

  const host = smtp.host || "smtp.gmail.com";
  const port = Number(smtp.port || 465);
  const user = smtp.user || "";
  const pass = smtp.pass || "";

  if (!user || !pass) {
    throw new Error("SMTP credentials missing. Set functions config smtp.user and smtp.pass.");
  }

  return { host, port, user, pass };
}

function buildTransport() {
  const { host, port, user, pass } = getSmtpConfig();
  const secure = port === 465;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass }
  });
}

async function getAccountInfo(uid) {
  const snap = await admin.firestore().doc(`accountInfo/${uid}`).get();
  if (!snap.exists) return null;
  return snap.data() || null;
}

function isApprovedAccount(info) {
  return info && (info.authRole === "admin" || info.authRole === "viewer");
}

exports.sendTroopMail = functions.firestore
  .document("mailOutbox/{messageId}")
  .onCreate(async (snap, context) => {
    const msgId = context.params.messageId;
    const data = snap.data() || {};

    // quick structure validation
    const fromUid = data.fromUid;
    const toUids = Array.isArray(data.toUids) ? data.toUids : [];
    const subject = (data.subject || "").toString();
    const body = (data.body || "").toString();

    const msgRef = snap.ref;

    try {
      await msgRef.update({ status: "processing", processingAt: admin.firestore.FieldValue.serverTimestamp() });

      if (!fromUid || typeof fromUid !== "string") {
        await msgRef.update({ status: "rejected", error: "Missing fromUid." });
        return;
      }
      if (toUids.length < 1 || toUids.length > 20) {
        await msgRef.update({ status: "rejected", error: "Recipient count must be 1–20." });
        return;
      }
      if (!subject.trim() || subject.length > 160) {
        await msgRef.update({ status: "rejected", error: "Subject required (max 160)." });
        return;
      }
      if (!body.trim() || body.length > 5000) {
        await msgRef.update({ status: "rejected", error: "Message body required (max 5000)." });
        return;
      }

      // Load sender
      const senderInfo = await getAccountInfo(fromUid);
      if (!isApprovedAccount(senderInfo)) {
        await msgRef.update({ status: "rejected", error: "Sender is not approved." });
        return;
      }

      const senderRoleType = senderInfo.roleType || "Scout";
      const senderIsAdult = isAdultRole(senderRoleType);

      const senderEmail = (senderInfo.email || "").toString().trim();
      const senderName = (senderInfo.fullName || senderInfo.displayName || senderEmail || fromUid).toString().trim();

      if (!senderEmail) {
        await msgRef.update({ status: "rejected", error: "Sender email missing in accountInfo." });
        return;
      }

      // Load recipients
      const recipients = [];
      for (const uid of toUids) {
        if (!uid || typeof uid !== "string") continue;
        if (uid === fromUid) continue; // do not email self
        const info = await getAccountInfo(uid);
        if (!isApprovedAccount(info)) continue; // skip unapproved
        const email = (info.email || "").toString().trim();
        if (!email) continue;
        recipients.push({
          uid,
          email,
          roleType: info.roleType || "",
          fullName: (info.fullName || "").toString().trim()
        });
      }

      if (recipients.length === 0) {
        await msgRef.update({ status: "rejected", error: "No valid approved recipients with email." });
        return;
      }

      const adultCount = recipients.filter(r => isAdultRole(r.roleType)).length;

      // Safety rules (server-side, authoritative)
      if (!senderIsAdult) {
        // Scout: 0 adults OR 2+ adults
        if (!(adultCount === 0 || adultCount >= 2)) {
          await msgRef.update({
            status: "rejected",
            error: "Scout rule violation: must include 0 adults or 2+ adults."
          });
          return;
        }
      } else {
        // Adult: must include at least 1 adult recipient
        if (adultCount < 1) {
          await msgRef.update({
            status: "rejected",
            error: "Adult rule violation: must include at least 1 adult recipient."
          });
          return;
        }
      }

      const transporter = buildTransport();

      // Private mode: one email per recipient
      const fromHeader = `Troop 248 Website <${getSmtpConfig().user}>`; // your troop gmail
      const replyToHeader = `${senderName} <${senderEmail}>`;

      const sendResults = [];
      for (const r of recipients) {
        const toName = r.fullName ? `${r.fullName} <${r.email}>` : r.email;

        const mail = {
          from: fromHeader,
          to: toName,
          replyTo: replyToHeader,
          subject: subject.trim(),
          text:
            `${body.trim()}\n\n` +
            `—\nSent via Troop 248 Website\n` +
            `Replying will email: ${senderName} (${senderEmail})`,
        };

        const info = await transporter.sendMail(mail);
        sendResults.push({ uid: r.uid, email: r.email, messageId: info.messageId || null });
      }

      await msgRef.update({
        status: "sent",
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        deliveredCount: sendResults.length
      });

      // Optional: write an audit log
      await admin.firestore().collection("mailAudit").add({
        outboxId: msgId,
        fromUid,
        toUids: recipients.map(r => r.uid),
        deliveredCount: sendResults.length,
        senderRoleType,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

    } catch (err) {
      console.error("sendTroopMail error:", err);
      await msgRef.update({
        status: "error",
        error: err && err.message ? err.message : "Unknown error"
      });
    }
  });
