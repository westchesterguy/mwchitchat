import { MARK_URL } from "@/lib/sites";

/**
 * The dog over MW, white, for the navy header. The image is the hub's full
 * lockup, cropped at the MW so MICHAEL WINTER never shows beneath the mark:
 * the frame is 590x653 of the 590x940 artwork.
 */
export function Mark({ className = "" }: { className?: string }) {
  return (
    <span className={`block shrink-0 overflow-hidden aspect-[590/653] ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={MARK_URL} alt="" width={590} height={940} className="block h-auto w-full max-w-none" />
    </span>
  );
}
