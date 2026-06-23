
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, ShieldCheck, Upload, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function DamageReplacementPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    orderId: '',
    productName: '',
    deliveryDate: '',
    issueType: '',
    description: '',
  });

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [ticketId, setTicketId] = useState('');

  const [errors, setErrors] = useState<Record<string, string>>({});

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
      if (errors.image) {
        setErrors((prev) => {
          const next = { ...prev };
          delete next.image;
          return next;
        });
      }
    }
  }

  function validate() {
    const nextErrors: Record<string, string> = {};
    if (!formData.name.trim()) nextErrors.name = 'Name is required';
    if (!formData.email.trim()) {
      nextErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      nextErrors.email = 'Invalid email address';
    }
    if (!formData.phone.trim()) nextErrors.phone = 'Phone number is required';
    if (!formData.orderId.trim()) nextErrors.orderId = 'Order ID is required';
    if (!formData.productName.trim()) nextErrors.productName = 'Product name is required';
    if (!formData.issueType) nextErrors.issueType = 'Please select the issue type';
    if (!formData.description.trim()) nextErrors.description = 'Please describe the damage in detail';
    if (!imageFile) nextErrors.image = 'Proof of damage photo is required';

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) {
      toast.error('Please fix the errors before submitting');
      return;
    }

    setLoading(true);
    // Simulate API request delay
    await new Promise((resolve) => setTimeout(resolve, 1800));
    setLoading(false);

    // Generate random mock ticket ID
    const randomTicket = `PLG-DR-${Math.floor(100000 + Math.random() * 900000)}`;
    setTicketId(randomTicket);
    setSuccess(true);
    toast.success('Replacement claim submitted successfully!');
  }

  if (success) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 sm:py-24 flex flex-col items-center text-center animate-fade-in">
        <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600 mb-6 shadow-inner">
          <CheckCircle2 size={44} />
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 leading-tight">Claim Submitted Successfully</h2>
        <p className="text-gray-500 mt-3 text-sm sm:text-base max-w-md">
          We have received your damage replacement request. Our team will review the photos and initiate a replacement or refund within 24-48 hours.
        </p>

        <div className="mt-8 bg-gray-50 border border-gray-100 rounded-2xl p-5 w-full max-w-sm text-left">
          <div className="flex justify-between text-sm py-1.5 border-b border-gray-200/50">
            <span className="text-gray-400">Ticket Reference</span>
            <span className="font-bold text-gray-800">{ticketId}</span>
          </div>
          <div className="flex justify-between text-sm py-1.5 border-b border-gray-200/50">
            <span className="text-gray-400">Order ID</span>
            <span className="font-medium text-gray-700">{formData.orderId.toUpperCase()}</span>
          </div>
          <div className="flex justify-between text-sm py-1.5">
            <span className="text-gray-400">Product Name</span>
            <span className="font-medium text-gray-700 truncate max-w-[180px]">{formData.productName}</span>
          </div>
        </div>

        <div className="mt-10 flex flex-col sm:flex-row gap-3 w-full max-w-xs sm:max-w-md justify-center">
          <Link
            to="/products"
            className="flex-1 py-3 px-6 bg-primary hover:bg-primary/95 text-white font-bold rounded-xl shadow-md hover:shadow-lg transition active:scale-[0.98] text-sm text-center"
          >
            Continue Shopping
          </Link>
          <Link
            to="/"
            className="flex-1 py-3 px-6 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 font-bold rounded-xl shadow-sm transition active:scale-[0.98] text-sm text-center"
          >
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12">
      {/* Back Button */}
      <Link to="/" className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-gray-500 hover:text-primary transition mb-6">
        <ArrowLeft size={16} /> Back to Home
      </Link>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden">
        {/* Header Block */}
        <div className="bg-gradient-to-br from-[#1B4332] to-[#2D6A4F] text-white p-6 sm:p-10 relative">
          <div className="absolute right-6 top-1/2 -translate-y-1/2 opacity-[0.08] pointer-events-none select-none hidden sm:block">
            <ShieldCheck size={160} />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight leading-none">Damage Replacement Form</h1>
          <p className="text-emerald-100/90 text-sm mt-3 leading-relaxed max-w-xl">
            Did your plant arrive withered or did a ceramic pot break in transit? Fill out this quick form with pictures of the damaged item, and our plant doctors will ship a replacement immediately.
          </p>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 sm:p-10 space-y-6 sm:space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
            {/* Name */}
            <div>
              <label htmlFor="name" className="block text-xs sm:text-sm font-bold text-gray-700 mb-1.5">Full Name *</label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className={`w-full px-4 py-3 text-sm border rounded-xl focus:outline-none focus:ring-1 ${
                  errors.name ? 'border-red-400 focus:ring-red-400' : 'border-gray-200 focus:ring-primary-light'
                }`}
                placeholder="Enter your name"
              />
              {errors.name && <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle size={12} /> {errors.name}</p>}
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-xs sm:text-sm font-bold text-gray-700 mb-1.5">Email Address *</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className={`w-full px-4 py-3 text-sm border rounded-xl focus:outline-none focus:ring-1 ${
                  errors.email ? 'border-red-400 focus:ring-red-400' : 'border-gray-200 focus:ring-primary-light'
                }`}
                placeholder="you@example.com"
              />
              {errors.email && <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle size={12} /> {errors.email}</p>}
            </div>

            {/* Phone */}
            <div>
              <label htmlFor="phone" className="block text-xs sm:text-sm font-bold text-gray-700 mb-1.5">Phone Number *</label>
              <input
                type="tel"
                id="phone"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                className={`w-full px-4 py-3 text-sm border rounded-xl focus:outline-none focus:ring-1 ${
                  errors.phone ? 'border-red-400 focus:ring-red-400' : 'border-gray-200 focus:ring-primary-light'
                }`}
                placeholder="Enter mobile number"
              />
              {errors.phone && <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle size={12} /> {errors.phone}</p>}
            </div>

            {/* Order ID */}
            <div>
              <label htmlFor="orderId" className="block text-xs sm:text-sm font-bold text-gray-700 mb-1.5">Order ID *</label>
              <input
                type="text"
                id="orderId"
                name="orderId"
                value={formData.orderId}
                onChange={handleInputChange}
                className={`w-full px-4 py-3 text-sm border rounded-xl focus:outline-none focus:ring-1 ${
                  errors.orderId ? 'border-red-400 focus:ring-red-400' : 'border-gray-200 focus:ring-primary-light'
                }`}
                placeholder="e.g. PLG-98402"
              />
              {errors.orderId && <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle size={12} /> {errors.orderId}</p>}
            </div>

            {/* Product Name */}
            <div>
              <label htmlFor="productName" className="block text-xs sm:text-sm font-bold text-gray-700 mb-1.5">Product to Replace *</label>
              <input
                type="text"
                id="productName"
                name="productName"
                value={formData.productName}
                onChange={handleInputChange}
                className={`w-full px-4 py-3 text-sm border rounded-xl focus:outline-none focus:ring-1 ${
                  errors.productName ? 'border-red-400 focus:ring-red-400' : 'border-gray-200 focus:ring-primary-light'
                }`}
                placeholder="e.g. Snake Plant / Ceramic Pot"
              />
              {errors.productName && <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle size={12} /> {errors.productName}</p>}
            </div>

            {/* Issue Type */}
            <div>
              <label htmlFor="issueType" className="block text-xs sm:text-sm font-bold text-gray-700 mb-1.5">What went wrong? *</label>
              <select
                id="issueType"
                name="issueType"
                value={formData.issueType}
                onChange={handleInputChange}
                className={`w-full px-4 py-3 text-sm border rounded-xl focus:outline-none focus:ring-1 ${
                  errors.issueType ? 'border-red-400 focus:ring-red-400' : 'border-gray-200 focus:ring-primary-light'
                }`}
              >
                <option value="">Select the issue</option>
                <option value="broken_pot">Broken Pot / Planter</option>
                <option value="damaged_plant">Broken Stems / Leaves (Transit)</option>
                <option value="withered_plant">Withered / Dead Plant</option>
                <option value="wrong_item">Incorrect Product Delivered</option>
                <option value="missing_item">Missing Items</option>
              </select>
              {errors.issueType && <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle size={12} /> {errors.issueType}</p>}
            </div>
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-xs sm:text-sm font-bold text-gray-700 mb-1.5">Detailed Description *</label>
            <textarea
              id="description"
              name="description"
              rows={4}
              value={formData.description}
              onChange={handleInputChange}
              className={`w-full px-4 py-3 text-sm border rounded-xl focus:outline-none focus:ring-1 ${
                errors.description ? 'border-red-400 focus:ring-red-400' : 'border-gray-200 focus:ring-primary-light'
              }`}
              placeholder="Please describe what parts are broken or explain the condition of the plant upon arrival."
            />
            {errors.description && <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle size={12} /> {errors.description}</p>}
          </div>

          {/* Image upload */}
          <div>
            <span className="block text-xs sm:text-sm font-bold text-gray-700 mb-1.5">Photo Proof of Damage *</span>
            <div className={`relative flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-2xl transition ${
              errors.image ? 'border-red-400 bg-red-50/10' : 'border-gray-200 hover:bg-gray-50'
            }`}>
              <input
                type="file"
                id="damage_photo"
                accept="image/*"
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              {imagePreview ? (
                <div className="flex flex-col items-center gap-3">
                  <img src={imagePreview} alt="Damage Preview" className="h-32 w-auto object-cover rounded-xl border" />
                  <p className="text-xs font-semibold text-primary">Click or drag another image to replace</p>
                </div>
              ) : (
                <div className="flex flex-col items-center text-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-primary mb-1">
                    <Upload size={20} />
                  </div>
                  <p className="text-sm font-bold text-gray-700">Upload Damage Photo</p>
                  <p className="text-[11px] text-gray-400 max-w-xs">Supports PNG, JPG, or JPEG. Max size 5MB.</p>
                </div>
              )}
            </div>
            {errors.image && <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1"><AlertCircle size={12} /> {errors.image}</p>}
          </div>

          {/* Guarantee Alert */}
          <div className="p-4 bg-emerald-50/60 border border-emerald-100 rounded-2xl flex gap-3 text-emerald-800">
            <ShieldCheck size={20} className="shrink-0 mt-0.5" />
            <div className="text-xs leading-normal">
              <span className="font-bold">Plantoga thrive guarantee active.</span> All transit damages are 100% covered. We do not ask you to ship the damaged plants back!
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-primary hover:bg-primary/95 text-white font-bold rounded-2xl transition active:scale-[0.98] shadow-md hover:shadow-lg disabled:opacity-50 text-sm sm:text-base flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Submitting request...</span>
              </>
            ) : (
              <span>Submit Replacement Request</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
