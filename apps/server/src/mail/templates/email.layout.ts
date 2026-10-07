export interface EmailCallout {
  type: "info" | "warning";
  html: string;
}

export interface EmailCta {
  label: string;
  url: string;
}

export interface EmailLayoutOptions {
  title: string;
  heading: string;
  bodyHtml: string;
  cta?: EmailCta;
  callout?: EmailCallout;
  fallbackUrl?: string;
}

export function escapeHtml(unsafe: string): string {
  return unsafe
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// URLs are interpolated into href attributes: only http(s) pass through,
// everything else (javascript:, data:, ...) becomes "#" so a future caller
// cannot introduce href XSS. renderEmailLayout escapes the sanitized URL
// again via escapeHtml before interpolating.
export function sanitizeUrl(url: string): string {
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return "#";
}

// Subjects become SMTP headers: strip CR/LF to block header injection.
// Nodemailer sanitizes too, but defense belongs at the template boundary.
export function sanitizeSubject(subject: string): string {
  return subject.replace(/[\r\n]+/g, " ").trim();
}

export function renderEmailLayout(options: EmailLayoutOptions): string {
  const safeCtaUrl = options.cta ? escapeHtml(sanitizeUrl(options.cta.url)) : "";
  const safeFallbackUrl = options.fallbackUrl ? escapeHtml(sanitizeUrl(options.fallbackUrl)) : "";
  const ctaHtml = options.cta
    ? `
      <div style="margin: 28px 0; text-align: center;">
        <a href="${safeCtaUrl}" style="background-color: #4f46e5; color: #ffffff; font-size: 15px; font-weight: 600; text-decoration: none; padding: 12px 28px; border-radius: 6px; display: inline-block;">${escapeHtml(options.cta.label)}</a>
      </div>
    `
    : "";

  let calloutHtml = "";
  if (options.callout) {
    if (options.callout.type === "warning") {
      calloutHtml = `
        <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 12px 16px; margin: 24px 0; border-radius: 0 4px 4px 0;">
          <p style="margin: 0; font-size: 13px; line-height: 20px; color: #991b1b; font-weight: 500;">
            ${options.callout.html}
          </p>
        </div>
      `;
    } else {
      calloutHtml = `
        <div style="background-color: #f1f5f9; border-left: 4px solid #4f46e5; padding: 12px 16px; margin: 24px 0; border-radius: 0 4px 4px 0;">
          <p style="margin: 0; font-size: 13px; line-height: 20px; color: #475569;">
            ${options.callout.html}
          </p>
        </div>
      `;
    }
  }

  const fallbackLinkHtml = options.fallbackUrl
    ? `
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 28px 0 20px 0;" />
      <p style="margin: 0 0 8px 0; font-size: 12px; color: #64748b;">
        If the button above does not work, copy and paste this link into your web browser:
      </p>
      <p style="margin: 0; font-size: 12px; word-break: break-all; color: #4f46e5;">
        <a href="${safeFallbackUrl}" style="color: #4f46e5; text-decoration: underline;">${safeFallbackUrl}</a>
      </p>
    `
    : "";

  return `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(options.title)}</title>
  </head>
  <body style="margin: 0; padding: 24px; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
    <div style="max-width: 560px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05);">
      <div style="background-color: #0f172a; padding: 24px 32px; text-align: left;">
        <h1 style="margin: 0; font-size: 20px; font-weight: 700; color: #ffffff; letter-spacing: -0.025em;">Project Alpha</h1>
      </div>
      <div style="padding: 32px;">
        <h2 style="margin-top: 0; margin-bottom: 16px; font-size: 18px; font-weight: 600; color: #0f172a;">${escapeHtml(options.heading)}</h2>
        ${options.bodyHtml}
        ${ctaHtml}
        ${calloutHtml}
        ${fallbackLinkHtml}
      </div>
    </div>
  </body>
</html>
  `.trim();
}
