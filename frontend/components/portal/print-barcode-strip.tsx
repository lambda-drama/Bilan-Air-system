export function PrintBarcodeStrip({ value }: { value: string }) {
  const bars = value.split("").map((ch, i) => (ch.charCodeAt(0) + i) % 3 + 1);

  return (
    <div className="flex h-14 w-full max-w-[11rem] items-end justify-center gap-px overflow-hidden" aria-hidden>
      {bars.map((w, i) => (
        <div
          key={`${value}-${i}`}
          className="bg-navy"
          style={{ width: w, height: `${55 + (i % 5) * 8}%` }}
        />
      ))}
    </div>
  );
}
