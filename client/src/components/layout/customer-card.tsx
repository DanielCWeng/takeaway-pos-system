import type { CustomerInfo, OrderType } from '../../types';
import { Button } from '../ui/button';
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs';

interface CustomerCardProps {
  orderType: OrderType;
  onChangeOrderType: (type: OrderType) => void;
  customerInfo?: CustomerInfo;
}

export function CustomerCard({ orderType, onChangeOrderType, customerInfo }: CustomerCardProps) {
  const empty = '\u2014';
  const infoRows = [
    { label: 'Name', value: customerInfo?.name || empty },
    { label: 'Phone', value: customerInfo?.phone || empty },
    { label: 'Address', value: customerInfo?.address || customerInfo?.postcode || empty },
  ];

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
        onValueChange={value => onChangeOrderType(value as OrderType)}
        className="mt-2"
      >
        <TabsList className="h-11 w-full pos-tabs-list">
          <TabsTrigger className="flex-1 text-sm tracking-[0.05em] pos-tabs-trigger" value="collection">
            Collection
          </TabsTrigger>
          <TabsTrigger className="flex-1 text-sm tracking-[0.05em] pos-tabs-trigger" value="delivery">
            Delivery
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="mt-2 grid gap-1 text-xs flex-1">
        {infoRows.map(row => {
          const isEmpty = row.value === empty;
          return (
            <div key={row.label} className="flex items-center justify-between">
              <span className="text-muted-foreground">{row.label}</span>
              <span
                className={
                  isEmpty
                    ? 'pos-value font-mono text-muted-foreground'
                    : 'pos-value font-mono text-foreground'
                }
              >
                {row.value}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
