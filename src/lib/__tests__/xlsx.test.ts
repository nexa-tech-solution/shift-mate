import { crc32, buildXlsx } from '../xlsx';

describe('xlsx', () => {
  it('crc32 matches the reference value', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });

  it('writes a zip with the sheet, numbers as numbers and text escaped', () => {
    const out = buildXlsx([['Date', 'Hours'], ['2026-11-09', '7.50'], ['<b>&', 'x']], [1]);
    expect(String.fromCharCode(out[0], out[1])).toBe('PK');
    const text = new TextDecoder().decode(out);
    expect(text).toContain('<c r="B2"><v>7.5</v></c>');
    expect(text).toContain('&#60;b&#62;&#38;');
    expect(text).toContain('<c r="B3" t="inlineStr"');
    // end-of-central-directory records 6 entries
    const eocd = new DataView(out.buffer, out.length - 22);
    expect(eocd.getUint32(0, true)).toBe(0x06054b50);
    expect(eocd.getUint16(10, true)).toBe(6);
  });
});
