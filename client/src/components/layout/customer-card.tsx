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
  const addressValue =
    [customerInfo?.line1, customerInfo?.line2, customerInfo?.town, customerInfo?.postcode]
      .filter(Boolean)
      .join(", ") || empty;

  return (
    <div className="pos-panel flex h-full flex-col p-2">
      <Tabs value={orderType} onValueChange={(value) => onChangeOrderType(value as OrderType)}>
        <TabsList className="h-14 w-full gap-1 border-2 border-b-gray-500 border-r-gray-500 border-l-gray-100 border-t-gray-100 bg-gray-300 p-1">
          <TabsTrigger
            className="pos-order-type-trigger h-full flex-1 gap-2 border-2 border-b-gray-500 border-r-gray-500 border-l-gray-100 border-t-gray-100 bg-gray-300 px-2 text-base font-bold text-black"
            value="collection"
          >
            <span className="text-xl" aria-hidden="true">
              🏪
            </span>
            <span>Collection</span>
          </TabsTrigger>
          <TabsTrigger
            className="pos-order-type-trigger h-full flex-1 gap-2 border-2 border-b-gray-500 border-r-gray-500 border-l-gray-100 border-t-gray-100 bg-gray-300 px-2 text-base font-bold text-black"
            value="delivery"
          >
            <span className="text-xl" aria-hidden="true">
              🚚
            </span>
            <span>Delivery</span>
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
              addressValue !== empty
                ? "pos-value font-mono text-foreground"
                : "pos-value font-mono text-muted-foreground"
            }
          >
            {addressValue}
          </span>
        </div>
      </div>
    </div>
  );
}
