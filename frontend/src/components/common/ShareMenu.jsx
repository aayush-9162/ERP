import { useState } from 'react';
import toast from 'react-hot-toast';
import { HiOutlineShare, HiOutlineMail, HiOutlineClipboardCopy, HiOutlinePrinter, HiOutlineX } from 'react-icons/hi';

/**
 * Share menu for invoices, quotations, and purchase orders.
 *
 * Props:
 *  - title: "Invoice INV-202604-0001"
 *  - docType: "Invoice" | "Quotation" | "Purchase Order"
 *  - docNumber: "INV-202604-0001"
 *  - customerName: "TechSoft Solutions"
 *  - amount: "64,400.00"
 *  - companyName: "Acme Industries"
 */
export default function ShareMenu({ title, docType = 'Invoice', docNumber, customerName, amount, companyName }) {
  const [open, setOpen] = useState(false);

  const pageUrl = window.location.href;

  const shareText = [
    `${docType}: ${docNumber}`,
    companyName ? `From: ${companyName}` : '',
    customerName ? `To: ${customerName}` : '',
    amount ? `Amount: ₹${amount}` : '',
    '',
    `View: ${pageUrl}`,
  ].filter(Boolean).join('\n');

  function handleWhatsApp() {
    const url = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
    window.open(url, '_blank');
    setOpen(false);
  }

  function handleEmail() {
    const subject = encodeURIComponent(`${docType} ${docNumber} — ${companyName || 'ERP System'}`);
    const body = encodeURIComponent(shareText);
    window.open(`mailto:?subject=${subject}&body=${body}`, '_self');
    setOpen(false);
  }

  function handleCopyLink() {
    navigator.clipboard.writeText(pageUrl).then(() => {
      toast.success('Link copied to clipboard');
    }).catch(() => {
      // Fallback for older browsers
      const input = document.createElement('input');
      input.value = pageUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      toast.success('Link copied');
    });
    setOpen(false);
  }

  function handleCopyDetails() {
    navigator.clipboard.writeText(shareText).then(() => {
      toast.success('Details copied to clipboard');
    }).catch(() => toast.error('Copy failed'));
    setOpen(false);
  }

  function handlePrint() {
    window.print();
    setOpen(false);
  }

  function handleNativeShare() {
    if (navigator.share) {
      navigator.share({
        title: `${docType} ${docNumber}`,
        text: shareText,
        url: pageUrl,
      }).catch(() => {});
    }
    setOpen(false);
  }

  return (
    <div className="relative print:hidden" data-print-hide>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
      >
        <HiOutlineShare className="h-4 w-4" />
        Share
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

          {/* Menu */}
          <div className="absolute right-0 z-50 mt-2 w-56 rounded-xl bg-white py-2 shadow-lg ring-1 ring-gray-200">
            <div className="px-3 py-2 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase">Share {docType}</p>
            </div>

            <button onClick={handleWhatsApp} className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-600 text-base">W</span>
              WhatsApp
            </button>

            <button onClick={handleEmail} className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100"><HiOutlineMail className="h-4 w-4 text-blue-600" /></span>
              Email
            </button>

            {navigator.share && (
              <button onClick={handleNativeShare} className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100"><HiOutlineShare className="h-4 w-4 text-purple-600" /></span>
                More Options...
              </button>
            )}

            <div className="my-1 border-t border-gray-100" />

            <button onClick={handleCopyLink} className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100"><HiOutlineClipboardCopy className="h-4 w-4 text-gray-600" /></span>
              Copy Link
            </button>

            <button onClick={handleCopyDetails} className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100"><HiOutlineClipboardCopy className="h-4 w-4 text-gray-600" /></span>
              Copy Details
            </button>

            <button onClick={handlePrint} className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100"><HiOutlinePrinter className="h-4 w-4 text-gray-600" /></span>
              Print / PDF
            </button>
          </div>
        </>
      )}
    </div>
  );
}
