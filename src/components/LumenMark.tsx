import orrery from "@/assets/lumen-orrery.png";

type Props = {
  className?: string;
  size?: number;
};

export function LumenMark({ className, size = 24 }: Props) {
  return (
    <img
      src={orrery}
      alt="Lumen"
      width={size}
      height={size}
      className={className}
      style={{ width: size, height: size, objectFit: "contain" }}
      draggable={false}
    />
  );
}
