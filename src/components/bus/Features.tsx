import React from 'react';
import { Shield, Clock, CreditCard, Smartphone, Headphones, Award } from 'lucide-react';

const items = [
  { icon: Shield, title: 'Secure Payments', desc: 'Bank-grade encryption on every transaction. Your data is always protected.' },
  { icon: Clock, title: 'Book in Seconds', desc: 'Compare hundreds of routes and finish booking in under 60 seconds.' },
  { icon: CreditCard, title: 'Flexible Cancellation', desc: 'Change plans? Cancel up to 2 hours before departure for a refund.' },
  { icon: Smartphone, title: 'E-Tickets with QR', desc: 'Skip the counter. Board directly by scanning your phone.' },
  { icon: Headphones, title: '24/7 Support', desc: 'Our team is always available via chat, phone, or email.' },
  { icon: Award, title: 'Best Price Guarantee', desc: "Find it cheaper elsewhere? We'll refund the difference." },
];

const Features: React.FC = () => (
  <section className="py-20 bg-white">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="text-center mb-12">
        <span className="inline-block px-3 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded-full mb-3 uppercase tracking-wider">Why BusGo</span>
        <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-3">Built for travelers, trusted by millions</h2>
        <p className="text-slate-600 max-w-2xl mx-auto">Everything you need for stress-free bus travel, all in one app.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {items.map((it, i) => (
          <div key={i} className="group p-6 rounded-2xl bg-slate-50 hover:bg-white border border-transparent hover:border-blue-100 hover:shadow-xl transition-all">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-700 to-blue-900 flex items-center justify-center mb-4 group-hover:scale-110 transition">
              <it.icon className="w-6 h-6 text-white" />
            </div>
            <h3 className="font-bold text-slate-900 text-lg mb-1">{it.title}</h3>
            <p className="text-sm text-slate-600 leading-relaxed">{it.desc}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default Features;
