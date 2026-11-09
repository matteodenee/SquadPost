import type { TextStyle } from './types.js';

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

export function fittedFontSize(text: string, width: number, style: TextStyle): number {
  const availableWidth = width - style.horizontalPadding * 2;
  const estimatedGlyphWidth = style.fontStyle === 'italic' ? 0.76 : 0.7;
  const estimatedWidth = Math.max(1, [...text].length) * style.fontSize * estimatedGlyphWidth;
  return Math.max(
    style.minFontSize,
    Math.min(style.fontSize, style.fontSize * (availableWidth / estimatedWidth)),
  );
}

export function createTextPlateSvg(
  text: string,
  width: number,
  height: number,
  style: TextStyle,
  transparentBackground = false,
): Buffer {
  const fontSize = fittedFontSize(text, width, style);
  const safeText = escapeXml(text);
  const italic = style.fontStyle === 'italic' ? 'italic' : 'normal';

  return Buffer.from(`
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      ${transparentBackground ? '' : `<rect width="${width}" height="${height}" fill="${style.backgroundColor}" />`}
      <text x="50%" y="50%" text-anchor="middle" dominant-baseline="central"
        font-family="${escapeXml(style.fontFamily)}" font-size="${fontSize}"
        font-weight="${style.fontWeight}" font-style="${italic}" fill="${style.color}">${safeText}</text>
    </svg>
  `);
}
