const GBP = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  minimumFractionDigits: 2,
});

export function formatCurrency(value: number) {
  return GBP.format(value);
}
