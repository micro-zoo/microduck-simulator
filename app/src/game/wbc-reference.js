export function parseWbcReferenceCsv(text, { frames, width, label = "reference" }) {
  if (!Number.isInteger(frames) || frames <= 0 || !Number.isInteger(width) || width <= 0) {
    throw new Error(`WBC ${label} metadata must declare positive integer dimensions`);
  }
  const lines = text.replace(/\r\n?/g, "\n").replace(/\n$/, "").split("\n");
  if (lines.length !== frames) {
    throw new Error(`WBC ${label} has ${lines.length} rows, expected ${frames}`);
  }
  const values = new Float32Array(frames * width);
  for (let row = 0; row < frames; row++) {
    const columns = lines[row].split(",");
    if (columns.length !== width) {
      throw new Error(`WBC ${label} row ${row + 1} has ${columns.length} columns, expected ${width}`);
    }
    for (let column = 0; column < width; column++) {
      const encoded = columns[column].trim();
      const value = Number(encoded);
      if (encoded === "" || !Number.isFinite(value)) {
        throw new Error(`WBC ${label} row ${row + 1} column ${column + 1} is not finite`);
      }
      values[row * width + column] = value;
    }
  }
  return values;
}
