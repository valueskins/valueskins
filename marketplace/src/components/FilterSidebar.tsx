'use client';

import React from 'react';

interface FilterSidebarProps {
  onFilterChange: (filters: {
    budgetMin: number;
    budgetMax: number;
    dealType: string[];
    professions: string[];
  }) => void;
}

export default function FilterSidebar({ onFilterChange }: FilterSidebarProps) {
  const [budgetMin, setBudgetMin] = React.useState(0);
  const [budgetMax, setBudgetMax] = React.useState(50000);
  const [dealTypes, setDealTypes] = React.useState<string[]>([]);
  const [professions, setProfessions] = React.useState<string[]>([]);

  React.useEffect(() => {
    onFilterChange({
      budgetMin,
      budgetMax,
      dealType: dealTypes,
      professions,
    });
  }, [budgetMin, budgetMax, dealTypes, professions, onFilterChange]);

  const dealTypeOptions = ['Paid', 'Barter', 'Equity', 'Ambassador'];
  const professionOptions = ['Restaurant', 'Boutique', 'SaaS Company', 'Gym', 'Hotel'];

  return (
    <div style={{
      background: 'var(--c-surface)',
      border: '1px solid var(--c-border)',
      borderRadius: '8px',
      padding: '20px',
      height: 'fit-content',
    }}>
      <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px', color: 'var(--c-text)' }}>
        Filters
      </h3>

      {/* Budget */}
      <div style={{ marginBottom: '20px' }}>
        <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--c-text-variant)', display: 'block', marginBottom: '8px' }}>
          Budget Range
        </label>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="number"
            value={budgetMin}
            onChange={(e) => setBudgetMin(Number(e.target.value))}
            style={{
              width: '50%',
              padding: '8px',
              border: '1px solid var(--c-border)',
              borderRadius: '4px',
              fontSize: '12px',
            }}
            placeholder="Min"
          />
          <input
            type="number"
            value={budgetMax}
            onChange={(e) => setBudgetMax(Number(e.target.value))}
            style={{
              width: '50%',
              padding: '8px',
              border: '1px solid var(--c-border)',
              borderRadius: '4px',
              fontSize: '12px',
            }}
            placeholder="Max"
          />
        </div>
        <div style={{ fontSize: '10px', color: 'var(--c-text-variant)', marginTop: '6px' }}>
          ${budgetMin.toLocaleString()} - ${budgetMax.toLocaleString()}
        </div>
      </div>

      {/* Deal Type */}
      <div style={{ marginBottom: '20px' }}>
        <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--c-text-variant)', display: 'block', marginBottom: '8px' }}>
          Deal Type
        </label>
        {dealTypeOptions.map((type) => (
          <label key={type} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={dealTypes.includes(type)}
              onChange={(e) => {
                if (e.target.checked) {
                  setDealTypes([...dealTypes, type]);
                } else {
                  setDealTypes(dealTypes.filter((t) => t !== type));
                }
              }}
              style={{ cursor: 'pointer' }}
            />
            <span style={{ fontSize: '12px', color: 'var(--c-text)' }}>{type}</span>
          </label>
        ))}
      </div>

      {/* Professions */}
      <div>
        <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--c-text-variant)', display: 'block', marginBottom: '8px' }}>
          Professions
        </label>
        {professionOptions.map((prof) => (
          <label key={prof} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={professions.includes(prof)}
              onChange={(e) => {
                if (e.target.checked) {
                  setProfessions([...professions, prof]);
                } else {
                  setProfessions(professions.filter((p) => p !== prof));
                }
              }}
              style={{ cursor: 'pointer' }}
            />
            <span style={{ fontSize: '12px', color: 'var(--c-text)' }}>{prof}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
