interface Props {
  value: string;
  size?: number;
  className?: string;
}

export function QRCode({ value, size = 160, className }: Props) {
  const src = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=8&data=${encodeURIComponent(
    value,
  )}`;
  return (
    <img
      src={src}
      alt={`QR code for ${value}`}
      width={size}
      height={size}
      className={className}
      loading="lazy"
    />
  );
}
