import type { CustomerInfo, OrderType } from "../../types";
import { Button } from "../ui/button";
import { Tabs, TabsList, TabsTrigger } from "../ui/tabs";

interface CustomerCardProps {
  orderType: OrderType;
  onChangeOrderType: (type: OrderType) => void;
  customerInfo?: CustomerInfo;
  onDialPhone: (phone: string) => void;
}

export function CustomerCard({
  orderType,
  onChangeOrderType,
  customerInfo,
  onDialPhone,
}: CustomerCardProps) {
  const empty = "\u2014";
  const phoneValue = customerInfo?.phone?.startsWith("UNKNOWN-")
    ? "Anonymous"
    : customerInfo?.phone || empty;
  const canDial = Boolean(customerInfo?.phone && !customerInfo.phone.startsWith("UNKNOWN-"));

  return (
    <div className="pos-panel flex h-full flex-col p-3">
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-0.5">
          <span className="pos-kicker">Customer</span>
          <span className="font-display text-sm font-semibold tracking-tight text-foreground">
            Details
          </span>
        </div>
        <Button variant="info" size="sm" className="h-9 px-3 text-xs">
          Add
        </Button>
      </div>

      <Tabs
        value={orderType}
        onValueChange={(value) => onChangeOrderType(value as OrderType)}
        className="mt-2"
      >
        <TabsList className="h-11 w-full pos-tabs-list">
          <TabsTrigger
            className="flex-1 text-sm tracking-[0.05em] pos-tabs-trigger"
            value="collection"
          >
            Collection
          </TabsTrigger>
          <TabsTrigger
            className="flex-1 text-sm tracking-[0.05em] pos-tabs-trigger"
            value="delivery"
          >
            Delivery
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="mt-2 grid gap-1 text-xs flex-1">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Name</span>
          <span
            className={
              customerInfo?.name
                ? "pos-value font-mono text-foreground"
                : "pos-value font-mono text-muted-foreground"
            }
          >
            {customerInfo?.name || empty}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground">Phone</span>
          <div className="flex items-center gap-2">
            <span
              className={
                phoneValue === empty
                  ? "pos-value font-mono text-muted-foreground"
                  : "pos-value font-mono text-foreground"
              }
            >
              {phoneValue}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 px-2 text-[11px]"
              onClick={() => customerInfo?.phone && onDialPhone(customerInfo.phone)}
              disabled={!canDial}
            >
              Dial
            </Button>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Address</span>
          <span
            className={
              customerInfo?.address || customerInfo?.postcode
                ? "pos-value font-mono text-foreground"
                : "pos-value font-mono text-muted-foreground"
            }
          >
            {customerInfo?.address || customerInfo?.postcode || empty}
          </span>
        </div>
      </div>
    </div>
  );
}
