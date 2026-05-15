export function WhatsAppIcon({ size = 20 }: { size?: number }) {
  return (
    <img
      src="/whatsapp-logo.png"
      alt=""
      width={size}
      height={size}
      className="block object-contain"
      style={{ width: size, height: size }}
    />
  );
}
