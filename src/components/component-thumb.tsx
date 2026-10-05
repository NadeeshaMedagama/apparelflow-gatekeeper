import { Shirt } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/cn";

/** Pattern-piece pictogram shown next to a component name (decorative; the name is the label). */
export function ComponentThumb({ imageUrl, size = "md" }: { imageUrl: string | null; size?: "sm" | "md" }) {
  const box = size === "sm" ? "size-9" : "size-11";
  return (
    <span
      className={cn("flex shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50", box)}
      aria-hidden="true"
    >
      {imageUrl ? (
        <Image src={imageUrl} alt="" width={36} height={36} unoptimized className="size-[80%]" />
      ) : (
        <Shirt className="size-5 text-slate-500" />
      )}
    </span>
  );
}
