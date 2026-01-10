import jsPDF from "jspdf";
import "jspdf-autotable";

export const generateInvoice = (order) => {
  const doc = new jsPDF();

  doc.setFontSize(18);
  doc.text("HYGIENIC & COMFORT CO.", 14, 20);

  doc.setFontSize(11);
  doc.text(`Invoice ID: ${order.id}`, 14, 30);
  doc.text(`Customer: ${order.customers.customer_name}`, 14, 38);
  doc.text(`Phone: ${order.customers.phone}`, 14, 46);
  doc.text(`Date: ${new Date(order.created_at).toLocaleDateString()}`, 14, 54);

  const rows = order.items.map(i => [
    i.productName,
    i.qty,
    `₹${i.price}`,
    `₹${i.total}`
  ]);

  doc.autoTable({
    startY: 65,
    head: [["Product", "Qty", "Price", "Total"]],
    body: rows,
  });

  doc.text(
    `Grand Total: ₹${order.total}`,
    14,
    doc.lastAutoTable.finalY + 10
  );

  doc.save(`Invoice-${order.id}.pdf`);
};
