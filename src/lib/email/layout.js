import { assertAbsoluteHttpUrl, escapeHtml } from '@/lib/email/utils';

function renderParagraphs(paragraphs) {
  return paragraphs
    .filter(Boolean)
    .map(
      (paragraph) => `
        <p style="margin:0 0 16px;font-size:16px;line-height:1.7;color:#334155;">
          ${escapeHtml(paragraph)}
        </p>
      `,
    )
    .join('');
}

function renderDetails(details) {
  if (!details?.length) {
    return '';
  }

  const items = details
    .filter(Boolean)
    .map(
      (detail) => `
        <tr>
          <td style="padding:0 0 10px;">
            <table role="presentation" width="100%" cellPadding="0" cellSpacing="0">
              <tr>
                <td width="18" style="width:18px;vertical-align:top;padding-top:8px;">
                  <span style="display:block;width:8px;height:8px;border-radius:999px;background-color:#4f46e5;"></span>
                </td>
                <td style="vertical-align:top;font-size:15px;line-height:1.7;color:#1e293b;">
                  ${escapeHtml(detail)}
                </td>
              </tr>
            </table>
          </td>
        </tr>
      `,
    )
    .join('');

  return `
    <table role="presentation" width="100%" cellPadding="0" cellSpacing="0" style="margin:0 0 24px;background-color:#eef2ff;border:1px solid #c7d2fe;border-radius:16px;padding:18px 20px;">
      <tr>
        <td>
          <p style="margin:0 0 12px;font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#4338ca;">Helpful details</p>
          <table role="presentation" width="100%" cellPadding="0" cellSpacing="0">
            ${items}
          </table>
        </td>
      </tr>
    </table>
  `;
}

function renderFooterLines(footerLines) {
  return footerLines
    .filter(Boolean)
    .map((line) => `<div style="margin-bottom:4px;">${escapeHtml(line)}</div>`)
    .join('');
}

export function renderActionEmailHtml({
  appName,
  previewText,
  eyebrow,
  title,
  lead,
  paragraphs = [],
  details = [],
  ctaLabel,
  ctaUrl,
  fallbackHint,
  footerLines = [],
}) {
  const safeUrl = assertAbsoluteHttpUrl(ctaUrl, 'ctaUrl');
  const safeAppName = escapeHtml(appName);
  const safePreviewText = escapeHtml(previewText);
  const safeEyebrow = escapeHtml(eyebrow);
  const safeTitle = escapeHtml(title);
  const safeLead = escapeHtml(lead);
  const safeCtaLabel = escapeHtml(ctaLabel);
  const safeFallbackHint = escapeHtml(fallbackHint);

  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${safeTitle}</title>
      </head>
      <body style="margin:0;padding:0;background-color:#f4f7fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0f172a;">
        <div style="display:none;max-height:0;overflow:hidden;opacity:0;visibility:hidden;">
          ${safePreviewText}
        </div>
        <table role="presentation" width="100%" cellPadding="0" cellSpacing="0" style="width:100%;margin:0;padding:24px 12px;background-color:#f4f7fb;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellPadding="0" cellSpacing="0" style="max-width:640px;width:100%;">
                <tr>
                  <td style="padding-bottom:16px;text-align:center;">
                    <span style="display:inline-block;padding:8px 14px;border-radius:999px;background-color:#e0e7ff;color:#4338ca;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">
                      ${safeAppName}
                    </span>
                  </td>
                </tr>
                <tr>
                  <td style="background-color:#ffffff;border:1px solid #e2e8f0;border-radius:22px;padding:40px 32px;box-shadow:0 18px 45px rgba(15,23,42,0.08);">
                    <p style="margin:0 0 12px;font-size:14px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#6366f1;">${safeEyebrow}</p>
                    <h1 style="margin:0 0 16px;font-size:32px;line-height:1.2;color:#0f172a;">${safeTitle}</h1>
                    <p style="margin:0 0 20px;font-size:17px;line-height:1.7;color:#334155;">${safeLead}</p>
                    ${renderParagraphs(paragraphs)}
                    ${renderDetails(details)}
                    <table role="presentation" cellPadding="0" cellSpacing="0" style="margin:0 0 24px;">
                      <tr>
                        <td align="center" style="border-radius:14px;background-color:#4f46e5;">
                          <a href="${safeUrl}" style="display:inline-block;padding:15px 24px;font-size:16px;font-weight:700;line-height:1;color:#ffffff;text-decoration:none;border-radius:14px;">
                            ${safeCtaLabel}
                          </a>
                        </td>
                      </tr>
                    </table>
                    <p style="margin:0 0 12px;font-size:14px;line-height:1.7;color:#475569;">${safeFallbackHint}</p>
                    <p style="margin:0 0 28px;padding:14px 16px;background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;word-break:break-all;font-size:14px;line-height:1.7;">
                      <a href="${safeUrl}" style="color:#4f46e5;text-decoration:none;">${escapeHtml(safeUrl)}</a>
                    </p>
                    <table role="presentation" width="100%" cellPadding="0" cellSpacing="0" style="margin:0 0 18px;">
                      <tr>
                        <td style="height:1px;background-color:#e2e8f0;font-size:0;line-height:0;">&nbsp;</td>
                      </tr>
                    </table>
                    <p style="margin:0;font-size:14px;line-height:1.7;color:#94a3b8;">
                      For security reasons, please do not forward this email.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:18px 12px 0;text-align:center;font-size:12px;line-height:1.6;color:#94a3b8;">
                    ${renderFooterLines(footerLines)}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
}

export function renderActionEmailText({
  title,
  lead,
  paragraphs = [],
  details = [],
  ctaLabel,
  ctaUrl,
  footerLines = [],
}) {
  const sections = [title, '', lead];

  for (const paragraph of paragraphs.filter(Boolean)) {
    sections.push('', paragraph);
  }

  if (details.length) {
    sections.push('', 'Details:');
    for (const detail of details.filter(Boolean)) {
      sections.push(`- ${detail}`);
    }
  }

  sections.push('', `${ctaLabel}:`, ctaUrl);

  if (footerLines.length) {
    sections.push('', ...footerLines.filter(Boolean));
  }

  return sections.join('\n');
}
