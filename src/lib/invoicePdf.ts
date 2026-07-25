import jsPDF from "jspdf";

export interface InvoiceItem {
  label: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
}

export interface InvoiceData {
  type: "vente" | "achat";
  invoiceNumber: string;
  date: string; // ISO
  partyLabel: string; // "Client" ou "Fournisseur"
  partyName: string;
  items: InvoiceItem[];
  total: number;
  paid: number;
  extraLine: { label: string; value: string }; // "Statut" ou "Mode"
  remainingDue?: number; // affiché en plus si > 0 ("Reste à payer")
  company: {
    name: string;
    subtitle?: string;
    phone?: string;
    address?: string;
    logoUrl?: string;
  };
  currency: string;
}

async function loadImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function buildInvoiceDoc(data: InvoiceData): Promise<jsPDF> {
  const fmt = (n: number) => `${n.toLocaleString("fr-FR").replace(/[\u00A0\u202F\u2009]/g, " ")} ${data.currency}`;
  const W = 110; // largeur en mm, format "ticket"
  const doc = new jsPDF({ unit: "mm", format: [W, 260] });
  const cx = W / 2;
  let y = 12;

  if (data.company.logoUrl) {
    const dataUrl = await loadImageAsDataUrl(data.company.logoUrl);
    if (dataUrl) {
      doc.addImage(dataUrl, "PNG", cx - 8, y - 6, 16, 16);
      y += 12;
    }
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(data.company.name, cx, y, { align: "center" });
  y += 5;

  if (data.company.subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(data.company.subtitle, cx, y, { align: "center" });
    y += 4;
  }
  if (data.company.address) {
    doc.setFontSize(8);
    doc.text(data.company.address, cx, y, { align: "center" });
    y += 4;
  }
  if (data.company.phone) {
    doc.text(`Tel: ${data.company.phone}`, cx, y, { align: "center" });
    y += 5;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(data.type === "vente" ? "FACTURE DE VENTE" : "BON D'ACHAT", cx, y, { align: "center" });
  y += 6;

  doc.setLineDashPattern([1, 1], 0);
  doc.line(6, y, W - 6, y);
  y += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`N° ${data.invoiceNumber}`, 6, y);
  y += 4;
  doc.text(new Date(data.date).toLocaleString("fr-FR"), 6, y);
  y += 4;
  doc.text(`${data.partyLabel} : ${data.partyName}`, 6, y);
  y += 5;

  doc.line(6, y, W - 6, y);
  y += 5;

  doc.setFont("helvetica", "bold");
  doc.text("Désignation", 6, y);
  doc.text("Total", W - 6, y, { align: "right" });
  y += 5;
  doc.setLineDashPattern([], 0);
  doc.line(6, y - 2, W - 6, y - 2);

  doc.setFont("helvetica", "normal");
  data.items.forEach((item) => {
    doc.setFont("helvetica", "bold");
    doc.text(item.label, 6, y);
    y += 4;
    doc.setFont("helvetica", "normal");
    doc.text(`${item.quantity} ${item.unit} x ${fmt(item.unitPrice)}`, 6, y);
    doc.text(fmt(item.total), W - 6, y, { align: "right" });
    y += 6;
  });

  y += 1;
  doc.setFillColor(22, 163, 74);
  doc.rect(6, y - 5, W - 12, 8, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("TOTAL", 8, y);
  doc.text(fmt(data.total), W - 8, y, { align: "right" });
  y += 8;

  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Payé", 6, y);
  doc.text(fmt(data.paid), W - 6, y, { align: "right" });
  y += 5;
  doc.text(data.extraLine.label, 6, y);
  doc.text(data.extraLine.value, W - 6, y, { align: "right" });
  y += 5;

  if (data.remainingDue && data.remainingDue > 0) {
    doc.setTextColor(200, 0, 0);
    doc.setFont("helvetica", "bold");
    doc.text("Reste à payer", 6, y);
    doc.text(fmt(data.remainingDue), W - 6, y, { align: "right" });
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "normal");
    y += 6;
  } else {
    y += 1;
  }

  doc.setLineDashPattern([1, 1], 0);
  doc.line(6, y, W - 6, y);
  y += 6;

  doc.setLineDashPattern([], 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Merci pour votre confiance.", cx, y, { align: "center" });
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(data.company.name, cx, y, { align: "center" });
  y += 4;
  if (data.company.phone) {
    doc.text(`Service client : ${data.company.phone}`, cx, y, { align: "center" });
    y += 4;
  }
  doc.text("Document à conserver", cx, y, { align: "center" });

  return doc;
}
