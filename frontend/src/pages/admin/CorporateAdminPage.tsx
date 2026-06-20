import { useState } from 'react';
import { Phone, Mail, Building, FileText, ChevronRight, X, ArrowRight, MessageSquare, Info, User } from 'lucide-react';
import toast from 'react-hot-toast';

interface Inquiry {
  id: number;
  fullName: string;
  phone: string;
  email: string;
  companyName: string;
  customisation: string;
  status: 'new' | 'review' | 'quoted' | 'approved' | 'cancelled';
  date: string;
  qtyRequested: number;
}

const INITIAL_INQUIRIES: Inquiry[] = [
  {
    id: 101,
    fullName: 'Rajesh Sharma',
    phone: '+91 98765 43210',
    email: 'rajesh@reliance.com',
    companyName: 'Reliance Industries',
    customisation: 'Need 500 Snake Plants in customized ceramic pots with company logo stickers printed on the front for Diwali gifting.',
    status: 'new',
    date: '2026-06-18T10:30:00Z',
    qtyRequested: 500,
  },
  {
    id: 102,
    fullName: 'Sneha Patel',
    phone: '+91 70123 45678',
    email: 'sneha.p@tcs.com',
    companyName: 'Tata Consultancy Services',
    customisation: 'Looking for low-maintenance office desk plants. Prefer Jade and Money Plants in eco-friendly coir pots. Qty: 200.',
    status: 'review',
    date: '2026-06-16T14:15:00Z',
    qtyRequested: 200,
  },
  {
    id: 103,
    fullName: 'Amit Verma',
    phone: '+91 81234 56789',
    email: 'amit@infosys.com',
    companyName: 'Infosys Ltd',
    customisation: 'Premium wooden tray gift hampers containing a plant, a copper bottle, and organic chocolates. Need quotation for 100 sets.',
    status: 'quoted',
    date: '2026-06-12T09:00:00Z',
    qtyRequested: 100,
  },
  {
    id: 104,
    fullName: 'Priya Nair',
    phone: '+91 90909 09090',
    email: 'priya@wipro.com',
    companyName: 'Wipro Limited',
    customisation: 'Requesting 50 customized Bonsais in ceramic pots for executive onboarding gifts.',
    status: 'approved',
    date: '2026-06-08T11:45:00Z',
    qtyRequested: 50,
  },
];

const STATUS_LABELS: Record<string, string> = {
  new: '📥 New Inquiry',
  review: '🔍 Under Review',
  quoted: '📄 Quotation Sent',
  approved: '✅ Approved & Booked',
  cancelled: '❌ Cancelled',
};

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-50 text-blue-800 border-blue-200',
  review: 'bg-amber-50 text-amber-800 border-amber-200',
  quoted: 'bg-purple-50 text-purple-800 border-purple-200',
  approved: 'bg-green-50 text-green-800 border-green-200',
  cancelled: 'bg-red-50 text-red-800 border-red-200',
};

export default function CorporateAdminPage() {
  const [inquiries, setInquiries] = useState<Inquiry[]>(INITIAL_INQUIRIES);
  const [selectedInquiry, setSelectedInquiry] = useState<Inquiry | null>(null);

  const handleStatusChange = (id: number, newStatus: Inquiry['status']) => {
    const updated = inquiries.map((inq) => {
      if (inq.id === id) {
        return { ...inq, status: newStatus };
      }
      return inq;
    });
    setInquiries(updated);
    if (selectedInquiry?.id === id) {
      setSelectedInquiry({ ...selectedInquiry, status: newStatus });
    }
    toast.success(`Inquiry status updated to: ${newStatus.toUpperCase()}`);
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Corporate & Bulk Inquiries</h1>
        <p className="text-xs text-gray-500 mt-0.5">Manage large order requests from corporate clients for employee onboarding, festivals, and desk plants.</p>
      </div>

      {/* Info strip */}
      <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex gap-3 shadow-sm">
        <div className="bg-primary/10 w-9 h-9 rounded-lg flex items-center justify-center text-primary shrink-0">
          <Info size={18} />
        </div>
        <div className="text-xs text-gray-600 leading-normal">
          <p className="font-bold text-primary">How do clients submit these?</p>
          <p className="mt-0.5">Submissions arrive when customers fill out the corporate gifting form on `/corporate-gifting`. They are currently forwarded to your email. This panel helps you track progress status centrally.</p>
        </div>
      </div>

      {/* List Layout */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b bg-gray-50">
              <th className="px-5 py-3.5 font-semibold text-xs">Client ID</th>
              <th className="px-5 py-3.5 font-semibold text-xs">Customer Name</th>
              <th className="px-5 py-3.5 font-semibold text-xs">Company Name</th>
              <th className="px-5 py-3.5 font-semibold text-xs">Qty Requested</th>
              <th className="px-5 py-3.5 font-semibold text-xs">Current Stage</th>
              <th className="px-5 py-3.5 font-semibold text-xs">Submitted On</th>
            </tr>
          </thead>
          <tbody>
            {inquiries.map((inq) => (
              <tr
                key={inq.id}
                onClick={() => setSelectedInquiry(inq)}
                className="border-b last:border-0 hover:bg-gray-50/50 cursor-pointer transition-colors"
              >
                <td className="px-5 py-4 text-gray-400 font-semibold">#{inq.id}</td>
                <td className="px-5 py-4 font-semibold text-gray-900">{inq.fullName}</td>
                <td className="px-5 py-4 text-gray-700 font-medium">{inq.companyName}</td>
                <td className="px-5 py-4 text-gray-950 font-bold">{inq.qtyRequested} units</td>
                <td className="px-5 py-4">
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border capitalize ${STATUS_COLORS[inq.status]}`}>
                    {STATUS_LABELS[inq.status]}
                  </span>
                </td>
                <td className="px-5 py-4 text-gray-400 text-xs">{new Date(inq.date).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Detail Drawer */}
      {selectedInquiry && (
        <>
          <div className="fixed inset-0 bg-black/55 z-50 transition-opacity" onClick={() => setSelectedInquiry(null)} />
          <div className="fixed inset-0 sm:inset-auto sm:top-0 sm:right-0 sm:h-full sm:w-full sm:max-w-md bg-[#FAFAF8] z-50 sm:shadow-2xl flex flex-col overflow-hidden">
            
            <div className="flex items-center justify-between p-4 sm:p-5 border-b bg-white shrink-0">
              <div>
                <h3 className="font-bold text-lg text-gray-900">Inquiry Details</h3>
                <p className="text-xs text-gray-500 mt-0.5">Reference ID: #{selectedInquiry.id}</p>
              </div>
              <button onClick={() => setSelectedInquiry(null)} className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
              
              {/* Contact Card */}
              <div className="bg-white p-4 rounded-xl border border-gray-200 space-y-2">
                <span className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Company Contact</span>
                <p className="text-base font-bold text-gray-900 flex items-center gap-1.5"><Building size={16} className="text-gray-400" /> {selectedInquiry.companyName}</p>
                <p className="text-sm font-semibold text-gray-700 flex items-center gap-1.5"><User size={15} className="text-gray-400" /> {selectedInquiry.fullName}</p>
                <div className="grid grid-cols-2 gap-2 pt-2 border-t text-xs text-gray-600">
                  <a href={`tel:${selectedInquiry.phone}`} className="flex items-center gap-1 hover:text-primary"><Phone size={13} /> {selectedInquiry.phone}</a>
                  <a href={`mailto:${selectedInquiry.email}`} className="flex items-center gap-1 hover:text-primary truncate"><Mail size={13} /> {selectedInquiry.email}</a>
                </div>
              </div>

              {/* Requirement Card */}
              <div className="bg-white p-4 rounded-xl border border-gray-200 space-y-2">
                <span className="text-[10px] font-bold text-gray-400 uppercase block">Requirements</span>
                <p className="text-xs text-gray-800 font-bold">Volume Requested: {selectedInquiry.qtyRequested} units</p>
                <div className="bg-gray-50 p-3 rounded-lg border text-xs text-gray-600 leading-normal flex gap-1.5">
                  <FileText size={16} className="shrink-0 text-gray-400 mt-0.5" />
                  <p className="italic">"{selectedInquiry.customisation}"</p>
                </div>
              </div>

              {/* Status Update Panel */}
              <div className="bg-white p-4 rounded-xl border border-gray-200 space-y-3">
                <span className="text-[10px] font-bold text-gray-400 uppercase block">Change Deal Stage</span>
                <div className="grid grid-cols-1 gap-2">
                  {Object.entries(STATUS_LABELS).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => handleStatusChange(selectedInquiry.id, key as Inquiry['status'])}
                      className={`w-full py-2 px-3 border rounded-xl text-xs font-semibold text-left transition flex items-center justify-between ${
                        selectedInquiry.status === key
                          ? 'bg-primary text-white border-primary shadow-sm'
                          : 'bg-white hover:bg-gray-50 text-gray-700'
                      }`}
                    >
                      <span>{label}</span>
                      {selectedInquiry.status === key && <span>✓</span>}
                    </button>
                  ))}
                </div>
              </div>

            </div>
          </div>
        </>
      )}

    </div>
  );
}
