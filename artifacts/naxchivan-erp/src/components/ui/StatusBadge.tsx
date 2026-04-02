import { cn } from "@/lib/utils";
import { ApartmentStatus, PaymentStatus, RentalStatus, InternetStatus } from "@workspace/api-client-react";

export function StatusBadge({ status, type = 'default' }: { status: string, type?: 'apartment' | 'payment' | 'rental' | 'internet' | 'default' }) {
  let colorClass = "bg-gray-100 text-gray-800 border-gray-200";
  let label = status;

  if (type === 'apartment') {
    switch (status) {
      case ApartmentStatus.available:
        colorClass = "bg-emerald-100 text-emerald-800 border-emerald-200";
        label = "Boş";
        break;
      case ApartmentStatus.sold:
        colorClass = "bg-rose-100 text-rose-800 border-rose-200";
        label = "Satılıb";
        break;
      case ApartmentStatus.reserved:
        colorClass = "bg-amber-100 text-amber-800 border-amber-200";
        label = "Rezerv";
        break;
    }
  } else if (type === 'payment') {
    switch (status) {
      case PaymentStatus.paid:
        colorClass = "bg-emerald-100 text-emerald-800 border-emerald-200";
        label = "Ödənilib";
        break;
      case PaymentStatus.pending:
        colorClass = "bg-amber-100 text-amber-800 border-amber-200";
        label = "Gözləyir";
        break;
      case PaymentStatus.overdue:
        colorClass = "bg-rose-100 text-rose-800 border-rose-200";
        label = "Gecikib";
        break;
    }
  } else if (type === 'rental') {
    switch (status) {
      case RentalStatus.active:
        colorClass = "bg-emerald-100 text-emerald-800 border-emerald-200";
        label = "Aktiv";
        break;
      case RentalStatus.ended:
        colorClass = "bg-slate-100 text-slate-800 border-slate-200";
        label = "Bitib";
        break;
    }
  } else if (type === 'internet') {
    switch (status) {
      case InternetStatus.active:
        colorClass = "bg-emerald-100 text-emerald-800 border-emerald-200";
        label = "Aktiv";
        break;
      case InternetStatus.expired:
        colorClass = "bg-rose-100 text-rose-800 border-rose-200";
        label = "Müddəti bitib";
        break;
      case InternetStatus.cancelled:
        colorClass = "bg-slate-100 text-slate-800 border-slate-200";
        label = "Ləğv edilib";
        break;
    }
  } else {
    // defaults for object status etc
    if (status === 'available') { colorClass = "bg-emerald-100 text-emerald-800"; label = "Boş"; }
    if (status === 'sold') { colorClass = "bg-rose-100 text-rose-800"; label = "Satılıb"; }
    if (status === 'rented') { colorClass = "bg-indigo-100 text-indigo-800"; label = "İcarədə"; }
    if (status === 'cash') { colorClass = "bg-emerald-100 text-emerald-800"; label = "Nağd"; }
    if (status === 'credit') { colorClass = "bg-blue-100 text-blue-800"; label = "Kredit"; }
  }

  return (
    <span className={cn("px-2.5 py-1 text-xs font-semibold rounded-full border shadow-sm", colorClass)}>
      {label}
    </span>
  );
}
