import { formatCurrency } from '../../lib/format';
import { Button } from '../ui/button';
import { Separator } from '../ui/separator';

interface OrderSummaryProps {
  subtotal: number;
  deliveryFee: number;
  total: number;
  onAccept: () => void;
}

export function OrderSummary({ subtotal, deliveryFee, total, onAccept }: OrderSummaryProps) {
  return (
    <div className="pos-panel flex h-full flex-col p-3">
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-0.5">
          <span className="pos-kicker">Summary</span>
          <span className="font-display text-sm font-semibold tracking-tight text-foreground">
            Totals
          </span>
        </div>
        <div className="pos-value font-display text-lg font-semibold tracking-tight text-foreground">
          {formatCurrency(total)}
        </div>
      </div>
      <Separator className="my-2" />
      <div className="grid gap-1 text-xs text-muted-foreground">
        <div className="flex items-center justify-between">
          <span>Subtotal</span>
          <span className="pos-value font-mono text-foreground">{formatCurrency(subtotal)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Delivery</span>
          <span className="pos-value font-mono text-foreground">{formatCurrency(deliveryFee)}</span>
        </div>
      </div>
      <Button variant="positive" className="mt-auto h-11 w-full text-sm tracking-[0.14em] pos-menu-action uppercase shadow-md" onClick={onAccept}>
        Accept Order
      </Button>
    </div>
  );
}
