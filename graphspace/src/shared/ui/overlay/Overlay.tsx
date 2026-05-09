import type { HTMLAttributes } from "react";
import styles from "./Overlay.module.css";

type Anchor = "top-left" | "top-right" | "bottom-left" | "bottom-right";
type Direction = "row" | "column";

type Props = HTMLAttributes<HTMLDivElement> & {
  anchor?: Anchor;
  direction?: Direction;
};

const anchorClass: Record<Anchor, string> = {
  "top-left": styles["anchor-top-left"],
  "top-right": styles["anchor-top-right"],
  "bottom-left": styles["anchor-bottom-left"],
  "bottom-right": styles["anchor-bottom-right"],
};

const dirClass: Record<Direction, string> = {
  row: styles["dir-row"],
  column: styles["dir-column"],
};

export function Overlay({
  anchor = "top-left",
  direction = "row",
  className,
  ...rest
}: Props) {
  const cls = [styles.overlay, anchorClass[anchor], dirClass[direction], className]
    .filter(Boolean)
    .join(" ");
  return <div className={cls} {...rest} />;
}
