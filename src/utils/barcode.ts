import QRCode from 'qrcode';

/**
 * ISO/IEC 15417 Code 128 bar/space width patterns (index 0..106).
 * Values 0..94 map directly to ASCII 32..126 in Code 128B.
 * 104 = Start Code B, 106 = Stop Pattern (13 modules).
 */
const CODE128_PATTERNS: readonly string[] = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312',
  '132212', '221213', '221312', '231212', '112232', '122132', '122231', '113222',
  '123122', '123221', '223211', '221132', '221231', '213212', '223112', '312131',
  '311222', '321122', '321221', '312212', '322112', '322211', '212123', '212321',
  '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121',
  '313121', '211331', '231131', '213113', '213311', '213131', '311123', '311321',
  '331121', '312113', '312311', '332111', '314111', '221411', '431111', '111224',
  '111422', '121124', '121421', '141122', '141221', '112214', '112412', '122114',
  '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112',
  '421211', '212141', '214121', '412121', '111143', '111341', '131141', '114113',
  '114311', '411113', '411311', '113141', '114131', '311141', '411131', '211412',
  '211214', '211232', '2331112',
];

export interface BarcodeBar {
  x: number;
  width: number;
}

export interface Code128Result {
  bars: BarcodeBar[];
  totalWidth: number;
  encodedText: string;
}

/**
 * Encodes printable ASCII text (32..126) into a standards-compliant Code 128B
 * vector bar layout including mandatory 10-module left and right quiet zones.
 */
export function encodeCode128B(rawText: string): Code128Result {
  const sanitized = rawText
    .split('')
    .map((ch) => {
      const code = ch.charCodeAt(0);
      return code >= 32 && code <= 126 ? ch : ' ';
    })
    .join('')
    .trim();

  const textToEncode = sanitized.length > 0 ? sanitized.slice(0, 48) : 'TORCH-LIGHT-01';

  const START_B = 104;
  const STOP = 106;

  const codes: number[] = [START_B];
  let checksum = START_B;

  for (let i = 0; i < textToEncode.length; i++) {
    const val = textToEncode.charCodeAt(i) - 32;
    codes.push(val);
    checksum += val * (i + 1);
  }

  codes.push(checksum % 103);
  codes.push(STOP);

  const QUIET_ZONE = 10;
  let cursor = QUIET_ZONE;
  const bars: BarcodeBar[] = [];

  for (const code of codes) {
    const pattern = CODE128_PATTERNS[code];
    for (let i = 0; i < pattern.length; i++) {
      const moduleWidth = Number(pattern[i]);
      // Even indices are black bars; odd indices are white spaces
      if (i % 2 === 0) {
        bars.push({ x: cursor, width: moduleWidth });
      }
      cursor += moduleWidth;
    }
  }

  return {
    bars,
    totalWidth: cursor + QUIET_ZONE,
    encodedText: textToEncode,
  };
}

export interface QrMatrixResult {
  size: number;
  cells: Array<{ x: number; y: number }>;
  quietZone: number;
}

/**
 * Generates an ISO/IEC 18004 high-error-correction QR code matrix.
 */
export function generateQrMatrix(rawText: string): QrMatrixResult {
  const content = rawText.trim().length > 0 ? rawText.trim() : 'TORCH-LIGHT-SCANNER';
  const qr = QRCode.create(content, { errorCorrectionLevel: 'H' });
  const size = qr.modules.size;
  const cells: Array<{ x: number; y: number }> = [];

  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (qr.modules.get(row, col)) {
        cells.push({ x: col, y: row });
      }
    }
  }

  return {
    size,
    cells,
    quietZone: 4,
  };
}
