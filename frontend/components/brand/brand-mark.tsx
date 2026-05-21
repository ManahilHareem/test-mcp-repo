import Image from "next/image";
import Link from "next/link";

type BrandMarkProps = {
  subtitle?: string;
  imageSize?: number;
  textSizeClassName?: string;
};

export function BrandMark({
  imageSize = 44,
  textSizeClassName = "text-xl",
}: BrandMarkProps) {
  return (
    <Link
      className="flex items-center gap-3 transition hover:opacity-90"
      href="https://truenorthprojects.net"
      rel="noreferrer"
      target="_blank"
    >
      <div className="overflow-hidden rounded-full border border-gold/40 bg-white/5 shadow-sm">
        <Image
          alt="TrueNorth logo"
          height={imageSize}
          priority
          src="/brand/logo.jpeg"
          width={imageSize}
        />
      </div>
      <div>
        <p className={`font-serif ${textSizeClassName}`}>TrueNorth</p>
        <p className="text-xs uppercase tracking-[0.24em] text-mist">Live Your TrueNorth Today</p>
      </div>
    </Link>
  );
}
