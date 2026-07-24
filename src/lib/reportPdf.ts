import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface IndicatorRow {
  label: string;
  value: string;
}

export interface InventoryRow {
  type: string;
  product: string;
  unit: string;
  costPrice: string;
  salePrice: string;
  stock: string;
}

export interface ReportData {
  title: string;
  periodLabel: string;
  indicators: IndicatorRow[];
  inventory: InventoryRow[];
  company: {
    name: string;
    subtitle?: string;
    phone?: string;
    address?: string;
    logoUrl?: string;
  };
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

export async function buildReportDoc(data: ReportData): Promise<jsPDF> {
  const COMPANY = data.company;
  const doc = new jsPDF();

  // En-tête
  doc.setFillColor(22, 101, 52);
  doc.rect(0, 0, 210, 26, "F");

  if (COMPANY.logoUrl) {
    const dataUrl = await loadImageAsDataUrl(COMPANY.logoUrl);
    if (dataUrl) {
      doc.setFillColor(255, 255, 255);
      doc.circle(196, 13, 9, "F");
      doc.addImage(dataUrl, "PNG", 189, 6, 14, 14);
    }
  }

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(17);
  doc.setFont("helvetica", "bold");
  doc.text(COMPANY.name, 14, 12);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(data.title, 14, 19);
  if (COMPANY.phone || COMPANY.address) {
    doc.text(`${COMPANY.phone}  ${COMPANY.address}`, 14, 24);
  }

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(data.periodLabel, 14, 35);

  // Tableau indicateurs, présenté en 2 colonnes de paires
  const pairs: string[][] = [];
  for (let i = 0; i < data.indicators.length; i += 2) {
    const a = data.indicators[i];
    const b = data.indicators[i + 1];
    pairs.push([a.label, a.value, b ? b.label : "", b ? b.value : ""]);
  }

  autoTable(doc, {
    startY: 39,
    head: [["Indicateur", "Valeur", "Indicateur", "Valeur"]],
    body: pairs,
    headStyles: { fillColor: [22, 163, 74] },
    styles: { fontSize: 9 },
  });

  // Tableau inventaire
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const finalY = (doc as any).lastAutoTable.finalY + 8;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Inventaire (état actuel)", 14, finalY);

  autoTable(doc, {
    startY: finalY + 4,
    head: [["Type", "Produit", "Conditionnement", "P. Achat", "P. Vente", "Stock"]],
    body: data.inventory.map((r) => [r.type, r.product, r.unit, r.costPrice, r.salePrice, r.stock]),
    headStyles: { fillColor: [22, 163, 74] },
    styles: { fontSize: 9 },
  });

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`${COMPANY.name} — page ${i}/${pageCount}`, 105, 290, { align: "center" });
  }

  return doc;
}
