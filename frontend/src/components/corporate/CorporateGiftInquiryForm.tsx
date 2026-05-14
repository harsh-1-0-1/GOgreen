import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, Phone } from 'lucide-react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { z } from 'zod';
import { submitCorporateGiftInquiry } from '@/lib/corporateGifting';

const inquirySchema = z.object({
  fullName: z.string().trim().min(2, 'Please enter your full name.'),
  phone: z
    .string()
    .trim()
    .regex(/^(\+91[\s-]?)?[6-9]\d{9}$/, 'Please enter a valid Indian WhatsApp number.'),
  email: z.string().trim().email('Please enter a valid email address.'),
  companyName: z.string().trim().min(2, 'Please enter your company name.'),
  customisation: z.string().trim().optional(),
});

type InquiryFormValues = z.infer<typeof inquirySchema>;

const FIELDS: Array<{
  name: keyof InquiryFormValues;
  label: string;
  type?: string;
  autoComplete?: string;
}> = [
  { name: 'fullName', label: 'Full Name', autoComplete: 'name' },
  { name: 'phone', label: 'Phone (WhatsApp No.)', type: 'tel', autoComplete: 'tel' },
  { name: 'email', label: 'Email', type: 'email', autoComplete: 'email' },
  { name: 'companyName', label: 'Company Name', autoComplete: 'organization' },
];

export default function CorporateGiftInquiryForm() {
  const [formError, setFormError] = useState('');
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<InquiryFormValues>({
    resolver: zodResolver(inquirySchema),
    defaultValues: {
      fullName: '',
      phone: '',
      email: '',
      companyName: '',
      customisation: '',
    },
  });

  async function onSubmit(values: InquiryFormValues) {
    setFormError('');
    try {
      await submitCorporateGiftInquiry({
        fullName: values.fullName,
        phone: values.phone,
        email: values.email,
        companyName: values.companyName,
        customisation: values.customisation || undefined,
      });
      toast.success('Thank you! Our team will get in touch with you shortly.');
      reset();
    } catch {
      const message = 'We could not submit your request. Please try again or call us directly.';
      setFormError(message);
      toast.error(message);
    }
  }

  return (
    <section
      id="corporate-inquiry"
      className="mx-auto w-full max-w-2xl px-4 pb-14 pt-4 sm:px-6 sm:pb-20"
      aria-labelledby="corporate-gifting-form-heading"
    >
      <div className="rounded-[28px] border border-white/80 bg-white/95 p-5 shadow-[0_24px_70px_rgba(27,67,50,0.14)] backdrop-blur sm:p-8 md:p-10">
        <div className="mb-7 text-center sm:mb-8">
          <p className="mb-3 inline-flex items-center justify-center rounded-full bg-primary-light/10 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-primary">
            Plantoga Corporate Desk
          </p>
          <h1
            id="corporate-gifting-form-heading"
            className="text-3xl font-bold tracking-tight text-[#183B2A] sm:text-4xl"
          >
            Corporate Gifting / Bulk Order
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-gray-600 sm:text-base">
            Fill out the form below &amp; our team will get in touch with you.
          </p>
          <a
            href="tel:+917083883105"
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#F2F8F1] px-4 py-2 text-sm font-semibold text-primary transition hover:bg-primary hover:text-white"
          >
            <Phone size={16} />
            Call Us On : +91 7083883105
          </a>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {FIELDS.map((field) => (
            <div key={field.name}>
              <label htmlFor={field.name} className="mb-1.5 block text-sm font-semibold text-gray-700">
                {field.label}
              </label>
              <input
                id={field.name}
                type={field.type || 'text'}
                autoComplete={field.autoComplete}
                aria-invalid={Boolean(errors[field.name])}
                {...register(field.name)}
                className="w-full rounded-2xl border border-gray-200 bg-[#FBFCF8] px-4 py-3.5 text-[15px] text-gray-900 outline-none transition duration-200 placeholder:text-gray-400 hover:border-primary-light/70 focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary-light/20"
              />
              {errors[field.name] && (
                <p className="mt-1.5 text-xs font-medium text-red-600">{errors[field.name]?.message}</p>
              )}
            </div>
          ))}

          <div>
            <label htmlFor="customisation" className="mb-1.5 block text-sm font-semibold text-gray-700">
              Customisation (If Any)
            </label>
            <textarea
              id="customisation"
              rows={4}
              {...register('customisation')}
              className="w-full resize-none rounded-2xl border border-gray-200 bg-[#FBFCF8] px-4 py-3.5 text-[15px] text-gray-900 outline-none transition duration-200 placeholder:text-gray-400 hover:border-primary-light/70 focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary-light/20"
            />
            {errors.customisation && (
              <p className="mt-1.5 text-xs font-medium text-red-600">{errors.customisation.message}</p>
            )}
          </div>

          {formError && (
            <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{formError}</p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="group mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-primary px-7 py-4 text-base font-bold text-white shadow-[0_16px_34px_rgba(45,106,79,0.28)] transition duration-300 hover:-translate-y-0.5 hover:bg-[#245940] hover:shadow-[0_20px_42px_rgba(45,106,79,0.34)] focus:outline-none focus:ring-4 focus:ring-primary-light/30 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0"
          >
            {isSubmitting ? 'Submitting...' : 'Submit'}
            <ArrowRight size={18} className="transition group-hover:translate-x-1" />
          </button>
        </form>
      </div>
    </section>
  );
}
