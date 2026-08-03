import React, { useState } from 'react';
import { Bus, Facebook, Twitter, Instagram, Youtube, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const Footer: React.FC = () => {
  const [email, setEmail] = useState('');

  const subscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes('@')) {
      toast.error('Please enter a valid email');
      return;
    }
    toast.success('Subscribed! Check your inbox for travel deals.');
    setEmail('');
  };

  return (
    <footer className="bg-slate-950 text-slate-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-8 mb-10">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-700 to-blue-900 rounded-xl flex items-center justify-center">
                <Bus className="w-6 h-6 text-white" />
              </div>
              <span className="font-bold text-xl text-white">BusGo</span>
            </div>
            <p className="text-sm text-slate-400 mb-4 max-w-sm">
              The smartest way to book bus tickets. Compare 250+ operators, 12,000+ routes, and travel with confidence.
            </p>
            <form onSubmit={subscribe} className="flex gap-2 max-w-sm">
              <div className="flex-1 relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Your email"
                  className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <Button type="submit" className="bg-orange-500 hover:bg-orange-600">Subscribe</Button>
            </form>
          </div>

          <div>
            <h4 className="font-bold text-white mb-4 text-sm uppercase tracking-wider">Company</h4>
            <ul className="space-y-2 text-sm">
              {['About Us', 'Careers', 'Press', 'Partners', 'Blog'].map((l) => (
                <li key={l}><a href="#" onClick={(e) => e.preventDefault()} className="hover:text-white transition">{l}</a></li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-white mb-4 text-sm uppercase tracking-wider">Support</h4>
            <ul className="space-y-2 text-sm">
              {['Help Center', 'Contact Us', 'Refund Policy', 'Terms', 'Privacy'].map((l) => (
                <li key={l}><a href="#" onClick={(e) => e.preventDefault()} className="hover:text-white transition">{l}</a></li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-white mb-4 text-sm uppercase tracking-wider">For Operators</h4>
            <ul className="space-y-2 text-sm">
              {['List Your Buses', 'Operator Login', 'Commission Plans', 'API Access', 'Support'].map((l) => (
                <li key={l}><a href="#" onClick={(e) => e.preventDefault()} className="hover:text-white transition">{l}</a></li>
              ))}
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs text-slate-500">© 2026 BusGo Inc. All rights reserved.</p>
          <div className="flex gap-3">
            {[Facebook, Twitter, Instagram, Youtube].map((Ic, i) => (
              <a key={i} href="#" onClick={(e) => e.preventDefault()} className="w-9 h-9 rounded-lg bg-slate-900 hover:bg-blue-700 flex items-center justify-center transition">
                <Ic className="w-4 h-4" />
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
