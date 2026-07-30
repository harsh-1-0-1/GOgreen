import { ArrowDown, Building2, CheckCircle2, Gift, Leaf, PackageCheck, ShieldCheck, Sparkles, Truck } from 'lucide-react';
import CorporateGiftInquiryForm from '@/components/corporate/CorporateGiftInquiryForm';
import { useBanners } from '@/hooks/useBanners';

const TRUST_POINTS = [
  { icon: Truck, title: 'Last Mile Delivery', text: 'Coordinated dispatches for offices, events, and distributed teams.' },
  { icon: Sparkles, title: '100% Customizable', text: 'Planters, sleeves, cards, hampers, and branded notes tailored to your brief.' },
  { icon: PackageCheck, title: 'Secure Packaging', text: 'Premium gift-ready packing designed to keep every plant protected.' },
];

const OCCASIONS = [
  'Employee welcome kits',
  'Client appreciation',
  'Rewards & recognition',
  'Work anniversaries',
  'Festive hampers',
  'Conference giveaways',
];

const PROCESS = [
  'Share your requirement',
  'Get a curated proposal',
  'Approve customisation',
  'Receive doorstep delivery',
];

export default function CorporateGiftingPage() {
  const { data: corporateBanners = [] } = useBanners('corporate_gifting');

  return (
    <div className="overflow-hidden bg-[#F8FAF4]">
      <CorporateGiftInquiryForm />
      {corporateBanners.length > 0 && (
        <section className="bg-white py-3 sm:py-4">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10 xl:px-16">
            <div className="grid gap-3">
              {corporateBanners.map((banner) => (
                <a
                  key={banner.id}
                  href={banner.cta_link || '#corporate-inquiry'}
                  className="group relative block overflow-hidden rounded-2xl bg-[#173A2A] shadow-[0_16px_44px_rgba(27,67,50,0.14)]"
                  style={{ backgroundColor: banner.bg_color }}
                >
                  <div className="relative min-h-[150px] sm:min-h-[190px]">
                    {banner.image_url ? (
                      <img
                        src={banner.image_url}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.02]"
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : null}
                    <div className="relative flex min-h-[150px] max-w-2xl flex-col justify-center px-5 py-6 sm:min-h-[190px] sm:px-8">
                      {banner.badge_text && (
                        <span className="mb-3 w-fit rounded-full bg-white/90 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
                          {banner.badge_text}
                        </span>
                      )}
                      <h2
                        className="text-2xl font-bold tracking-tight sm:text-3xl"
                        style={{ color: banner.text_color }}
                      >
                        {banner.title}
                      </h2>
                      {banner.subtitle && (
                        <p
                          className="mt-2 max-w-xl text-sm leading-6 sm:text-base"
                          style={{ color: banner.text_color }}
                        >
                          {banner.subtitle}
                        </p>
                      )}
                      {banner.cta_text && (
                        <span className="mt-4 w-fit rounded-full bg-white px-5 py-2 text-xs font-bold text-primary shadow-sm">
                          {banner.cta_text}
                        </span>
                      )}
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </section>
      )}
      <section className="relative isolate">
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(115deg,#edf5e8_0%,#fffaf1_48%,#eff8f1_100%)]" />
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[1.02fr_0.98fr] lg:px-10 lg:py-20 xl:px-16">
          <div className="animate-corporate-fade-up">
            <p className="mb-4 inline-flex rounded-full bg-white/80 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-primary shadow-sm ring-1 ring-primary-light/20">
              Premium green gifting for teams
            </p>
            <h2 className="max-w-3xl text-4xl font-bold tracking-tight text-[#173A2A] sm:text-5xl lg:text-6xl">
              Thoughtful corporate gifts that feel personal, polished, and alive.
            </h2>
            <p className="mt-5 max-w-2xl text-base leading-7 text-gray-600 sm:text-lg">
              Curated Plantoga hampers for employees, clients, partners, events, and bulk gifting programs with dependable service from enquiry to delivery.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href="#corporate-inquiry"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-7 py-3.5 text-sm font-bold text-white shadow-[0_16px_36px_rgba(45,106,79,0.26)] transition hover:-translate-y-0.5 hover:bg-[#245940]"
              >
                Enquire Now
                <ArrowDown size={17} />
              </a>
              <a
                href="tel:+917083883105"
                className="inline-flex items-center justify-center rounded-full bg-white px-7 py-3.5 text-sm font-bold text-primary shadow-sm ring-1 ring-primary-light/30 transition hover:-translate-y-0.5 hover:ring-primary"
              >
                Call +91 7083883105
              </a>
            </div>
          </div>

          <div className="relative animate-corporate-fade-up animation-delay-150">
            <div className="aspect-[4/3] overflow-hidden rounded-[32px] shadow-[0_30px_80px_rgba(27,67,50,0.22)] ring-1 ring-white/80">
              <img
                src="https://images.unsplash.com/photo-1485955900006-10f4d324d411?w=1200&q=85&auto=format&fit=crop"
                alt="Premium potted plants arranged for gifting"
                className="h-full w-full object-cover"
              />
            </div>
            <div className="absolute -bottom-5 left-5 right-5 rounded-3xl bg-white/95 p-4 shadow-[0_18px_50px_rgba(27,67,50,0.18)] backdrop-blur sm:left-auto sm:right-6 sm:w-72">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-light/15 text-primary">
                  <Gift size={22} />
                </div>
                <div>
                  <p className="text-sm font-bold text-[#173A2A]">Custom green hampers</p>
                  <p className="text-xs leading-5 text-gray-500">Bulk orders, branded notes, and premium packaging.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white py-8 sm:py-10">
        <div className="mx-auto grid max-w-7xl gap-4 px-4 sm:px-6 md:grid-cols-3 lg:px-10 xl:px-16">
          {TRUST_POINTS.map(({ icon: Icon, title, text }) => (
            <article key={title} className="rounded-3xl border border-gray-100 bg-white p-5 shadow-[0_12px_34px_rgba(27,67,50,0.07)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_42px_rgba(27,67,50,0.11)]">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary-light/12 text-primary">
                <Icon size={23} />
              </div>
              <h3 className="text-base font-bold text-[#173A2A]">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-gray-600">{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[0.95fr_1.05fr] lg:px-10 xl:px-16">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-primary">Corporate-ready assortments</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-[#173A2A] sm:text-4xl">
            Built for every business occasion.
          </h2>
          <p className="mt-4 text-base leading-7 text-gray-600">
            Choose from plant hampers, desk plants, ceramic planter sets, festive green gifts, and fully custom combinations designed for a premium unboxing experience.
          </p>
          <div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {OCCASIONS.map((occasion) => (
              <div key={occasion} className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-gray-700 shadow-sm ring-1 ring-gray-100">
                <CheckCircle2 size={18} className="shrink-0 text-primary" />
                {occasion}
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="overflow-hidden rounded-[28px] bg-white shadow-[0_16px_44px_rgba(27,67,50,0.1)]">
            <img
              src="https://images.unsplash.com/photo-1497215728101-856f4ea42174?w=900&q=85&auto=format&fit=crop"
              alt="Office desk with plants"
              className="h-72 w-full object-cover sm:h-full"
            />
          </div>
          <div className="space-y-4">
            <div className="rounded-[28px] bg-[#173A2A] p-6 text-white shadow-[0_16px_44px_rgba(27,67,50,0.18)]">
              <Building2 size={28} className="mb-8 text-green-200" />
              <p className="text-4xl font-bold">500+</p>
              <p className="mt-2 text-sm leading-6 text-white/70">plants and hampers can be planned for bulk gifting programs.</p>
            </div>
            <div className="rounded-[28px] bg-white p-6 shadow-[0_16px_44px_rgba(27,67,50,0.08)] ring-1 ring-gray-100">
              <Leaf size={28} className="mb-8 text-primary" />
              <p className="text-xl font-bold text-[#173A2A]">Eco-conscious gifting</p>
              <p className="mt-2 text-sm leading-6 text-gray-600">Memorable gifts that stay on desks and in homes long after the event.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10 xl:px-16">
          <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-primary">Simple process</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-[#173A2A] sm:text-4xl">From enquiry to delivery, handled.</h2>
            </div>
            <p className="max-w-md text-sm leading-6 text-gray-600">
              Our team helps with curation, branding, packaging, timelines, and order coordination.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-4">
            {PROCESS.map((step, index) => (
              <div key={step} className="rounded-3xl bg-[#F8FAF4] p-5 ring-1 ring-primary-light/15">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
                  {index + 1}
                </span>
                <p className="mt-6 text-base font-bold text-[#173A2A]">{step}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative bg-[linear-gradient(180deg,#F8FAF4_0%,#EEF7EA_100%)] py-12 sm:py-16">
        <div className="mx-auto max-w-5xl px-4 text-center sm:px-6">
          <ShieldCheck className="mx-auto mb-4 text-primary" size={34} />
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-primary">Trusted corporate support</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-[#173A2A] sm:text-4xl">
            Premium plant gifting, made effortless for your team.
          </h2>
        </div>
      </section>
    </div>
  );
}
