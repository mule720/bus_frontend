import React from 'react';

const stats = [
  { value: '2M+', label: 'Happy travelers' },
  { value: '250+', label: 'Bus operators' },
  { value: '12K+', label: 'Daily trips' },
  { value: '4.8', label: 'Avg rating' },
];

const Stats: React.FC = () => (
  <section className="py-10 bg-gradient-to-r from-blue-900 via-blue-800 to-blue-900 text-white">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {stats.map((s, i) => (
          <div key={i} className="text-center">
            <div className="text-3xl md:text-4xl font-bold text-orange-400">{s.value}</div>
            <div className="text-sm text-blue-100 mt-1">{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default Stats;
