import { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  Search, 
  ChevronDown, 
  ChevronUp, 
  Mail, 
  Phone, 
  ShieldCheck, 
  HelpCircle, 
  HeartHandshake,
  Truck,
  CreditCard,
  Leaf
} from 'lucide-react';

interface FAQItem {
  id: number;
  question: string;
  answer: string;
  category: 'general' | 'shipping' | 'care' | 'orders';
}

const FAQ_DATA: FAQItem[] = [
  // General Category
  {
    id: 1,
    question: "What is Plantoga?",
    answer: "Plantoga is India's premium online destination for fresh, nursery-grown plants, organic seeds, and designer pots. We handle everything from curation to door-step delivery, ensuring your green friends arrive healthy, stress-free, and thriving.",
    category: "general"
  },
  {
    id: 2,
    question: "Do you customize orders for corporate gifting?",
    answer: "Yes! We specialize in customized green gifting for corporate events, employee welcome kits, rewards programs, and client appreciation. Visit our Corporate Gifting page or contact us to receive a curated catalog.",
    category: "general"
  },
  {
    id: 3,
    question: "What is the Plantoga quality guarantee?",
    answer: "We offer a 100% Thrive Guarantee. If any plant or pot arrives damaged, withered, or incorrect, simply submit our Damage Replacement form with a photo within 48 hours, and we'll ship a replacement immediately, completely free of charge. No return shipment required!",
    category: "general"
  },
  // Shipping Category
  {
    id: 4,
    question: "Where do you deliver?",
    answer: "We safely deliver plants, seeds, and pots to over 15,000 pin codes across India, covering all major metropolitan areas and tier 1 and tier 2 cities.",
    category: "shipping"
  },
  {
    id: 5,
    question: "How long does delivery take?",
    answer: "Standard deliveries take 3 to 7 business days depending on your location. Metro orders are typically delivered faster within 2 to 4 days.",
    category: "shipping"
  },
  {
    id: 6,
    question: "Are there any shipping charges?",
    answer: "We offer Free Shipping on all orders above ₹999. For orders below this threshold, a flat shipping fee of ₹75 is applied.",
    category: "shipping"
  },
  {
    id: 7,
    question: "How do I track my order?",
    answer: "Once your order is shipped, you will receive an email and SMS with your tracking details. You can also log in and click 'Track Order' in the footer to check real-time status.",
    category: "shipping"
  },
  // Care Category
  {
    id: 8,
    question: "How do I care for my plant after it arrives?",
    answer: "Allow your plant to settle for 24-48 hours before watering or repotting. Keep it in indirect, bright sunlight first so it can acclimate to your space. You can find detailed, plant-specific care instructions on the product page for each specific plant.",
    category: "care"
  },
  {
    id: 9,
    question: "My plant looks slightly droopy after transit. What should I do?",
    answer: "It is completely normal for plants to experience transit stress. Give it a small splash of water (if the soil is dry) and place it in a bright, well-ventilated spot (avoid direct hot sun). Within a day or two, it will perk back up!",
    category: "care"
  },
  {
    id: 10,
    question: "How often should I water my plants?",
    answer: "The golden rule is to water only when the top 1-2 inches of soil feels dry to the touch. Stick your finger in the soil to check. Overwatering is the most common cause of plant distress, so when in doubt, it is better to underwater.",
    category: "care"
  },
  // Orders & Payments Category
  {
    id: 11,
    question: "What payment methods do you accept?",
    answer: "We accept all major credit/debit cards, UPI (Google Pay, PhonePe, Paytm), Netbanking, and popular digital wallets. Cash on Delivery (COD) is also available for select pin codes.",
    category: "orders"
  },
  {
    id: 12,
    question: "Can I cancel or modify my order?",
    answer: "You can cancel or modify your order within 2 hours of placing it. Please call or WhatsApp our support team at +91 7083883105 to request changes.",
    category: "orders"
  }
];

export default function FaqPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<'all' | 'general' | 'shipping' | 'care' | 'orders'>('all');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Filter FAQs based on search query and selected category
  const filteredFAQs = FAQ_DATA.filter((faq) => {
    const matchesSearch = 
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = activeCategory === 'all' || faq.category === activeCategory;
    
    return matchesSearch && matchesCategory;
  });

  const categories = [
    { id: 'all', label: 'All FAQs', icon: HelpCircle },
    { id: 'general', label: 'General', icon: HeartHandshake },
    { id: 'shipping', label: 'Shipping', icon: Truck },
    { id: 'care', label: 'Plant Care', icon: Leaf },
    { id: 'orders', label: 'Orders & Payments', icon: CreditCard },
  ] as const;

  const toggleExpand = (id: number) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="overflow-hidden bg-[#F8FAF4] min-h-screen">
      {/* Header / Hero Section */}
      <div className="bg-gradient-to-br from-[#1B4332] to-[#2D6A4F] text-white py-12 sm:py-20 relative">
        <div className="absolute right-12 top-1/2 -translate-y-1/2 opacity-[0.05] pointer-events-none select-none hidden md:block">
          <HelpCircle size={240} />
        </div>
        
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
          <Link 
            to="/" 
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-100 hover:text-white transition mb-6 bg-white/10 px-3 py-1.5 rounded-full backdrop-blur-sm"
          >
            <ArrowLeft size={14} /> Back to Home
          </Link>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight">
            Frequently Asked Questions
          </h1>
          <p className="text-emerald-100/90 text-sm sm:text-base mt-4 leading-relaxed max-w-xl mx-auto">
            Find answers to common queries about delivery timelines, plant care, corporate requests, and transit security.
          </p>

          {/* Search Box */}
          <div className="mt-8 max-w-xl mx-auto relative rounded-2xl shadow-lg bg-white overflow-hidden text-gray-800 focus-within:ring-2 focus-within:ring-primary-light transition-all">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
              <Search size={20} />
            </div>
            <input
              type="text"
              placeholder="Search questions or keywords..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-4 text-sm sm:text-base border-none focus:outline-none focus:ring-0 bg-transparent text-gray-900"
            />
          </div>
        </div>
      </div>

      {/* Main content */}
      <main className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
        {/* Categories Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap sm:justify-center">
          {categories.map((cat) => {
            const Icon = cat.icon;
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => {
                  setActiveCategory(cat.id);
                  setExpandedId(null);
                }}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-xs sm:text-sm font-semibold transition shrink-0 shadow-sm ${
                  isActive
                    ? 'bg-primary text-white'
                    : 'bg-white text-gray-600 border border-gray-150 hover:bg-gray-50'
                }`}
              >
                <Icon size={16} />
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* FAQs List */}
        <section className="mt-8 space-y-4">
          {filteredFAQs.length > 0 ? (
            filteredFAQs.map((faq) => {
              const isExpanded = expandedId === faq.id;
              return (
                <article 
                  key={faq.id}
                  onClick={() => toggleExpand(faq.id)}
                  className="bg-white rounded-2xl border border-gray-100 p-5 sm:p-6 shadow-sm hover:shadow-md transition cursor-pointer select-none"
                >
                  <div className="flex justify-between items-start gap-4">
                    <h3 className="text-sm sm:text-base font-bold text-[#173A2A]">
                      {faq.question}
                    </h3>
                    <button 
                      className={`text-[#2D6A4F] p-1 rounded-lg hover:bg-emerald-50 transition shrink-0 ${
                        isExpanded ? 'bg-emerald-50' : ''
                      }`}
                      aria-label={isExpanded ? 'Collapse' : 'Expand'}
                    >
                      {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </button>
                  </div>
                  
                  {isExpanded && (
                    <div className="mt-4 text-xs sm:text-sm leading-relaxed text-gray-650 border-t border-gray-100 pt-4 animate-[fadeInScale_0.15s_ease-out]">
                      {faq.answer}
                    </div>
                  )}
                </article>
              );
            })
          ) : (
            <div className="text-center py-12 bg-white rounded-3xl border border-gray-100 shadow-sm">
              <HelpCircle size={48} className="mx-auto text-gray-300 mb-3" />
              <h3 className="text-base font-bold text-gray-700">No matching questions found</h3>
              <p className="text-xs text-gray-400 mt-1">Try searching for other terms or check different categories.</p>
            </div>
          )}
        </section>

        {/* Still Have Questions Banner */}
        <section className="mt-12 sm:mt-16 bg-[#EEF7EA] border border-emerald-100 rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="text-center md:text-left">
            <h2 className="text-lg sm:text-xl font-black text-[#173A2A]">
              Still have questions?
            </h2>
            <p className="text-xs sm:text-sm text-gray-655 mt-1 max-w-md leading-relaxed">
              If you couldn't find the answer you were looking for, please feel free to reach out to our team. We're happy to help!
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto shrink-0">
            <a
              href="mailto:support@gogreen.com"
              className="flex items-center justify-center gap-2 py-3 px-5 bg-white border border-gray-200 text-gray-750 text-xs sm:text-sm font-bold rounded-xl shadow-sm hover:bg-gray-50 transition"
            >
              <Mail size={16} className="text-primary" />
              Email Us
            </a>
            <a
              href="tel:+917083883105"
              className="flex items-center justify-center gap-2 py-3 px-5 bg-primary text-white text-xs sm:text-sm font-bold rounded-xl shadow-md hover:bg-primary/95 transition"
            >
              <Phone size={16} />
              Call Support
            </a>
          </div>
        </section>

        {/* Guarantee Banner */}
        <div className="mt-6 p-4 bg-emerald-50/60 border border-emerald-100 rounded-2xl flex gap-3 text-emerald-800 max-w-lg mx-auto">
          <ShieldCheck size={20} className="shrink-0 mt-0.5" />
          <div className="text-xs leading-normal">
            <span className="font-bold">Plantoga thrive guarantee.</span> All transit damages are 100% covered. Simply visit our <Link to="/damage-replacement" className="underline font-bold hover:text-emerald-950">Damage Replacement Form</Link> to file a replacement request.
          </div>
        </div>
      </main>
    </div>
  );
}
