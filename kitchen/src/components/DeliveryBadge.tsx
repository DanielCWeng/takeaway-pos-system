interface Props {
  orderType: "collection" | "delivery";
}

/**
 * Small pill badge indicating delivery or collection.
 * Delivery is amber (requires driver); collection is zinc (just hand over counter).
 */
export function DeliveryBadge({ orderType }: Props) {
  const isDelivery = orderType === "delivery";

  return (
    <span
      className={[
        "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full",
        "text-xs font-bold tracking-widest uppercase",
        isDelivery
          ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
          : "bg-zinc-700/40 text-zinc-400 border border-zinc-600/30",
      ].join(" ")}
    >
      {isDelivery ? "🛵 Delivery" : "🏃 Collection"}
    </span>
  );
}
